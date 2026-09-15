import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";

import { PATHS } from "../shared/paths";
import { publishReport } from "../shared/component-report";
import { bindingsDir, scanCommittedComponents } from "../emitter/artifacts";
import { BindingSchema } from "../emitter/binding-shadcn";
import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint } from "../shared/mcp-client";
import type { AliasSource } from "../extract/recipe-schema";
import { stableStringify } from "../extract/validate-recipe";
import { committedDesigns } from "./designs-loader";
import { planLibrary, type ComponentDesign } from "./library-plan";
import { parseLibrarySnapshot, readLibrarySnapshot } from "./library-reader";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import type { LibrarySnapshot } from "./library-snapshot";
import { operationsToSteps } from "./penpot-writer";
import { verifyLibrary, verifyReport } from "./verify-library";

/**
 * Logica dei comandi della library (Story 2.4, Task 5); l'entry CLI è
 * `src/cli/library.ts`:
 *
 *   bootstrap:library [--dry-run]   bootstrap una tantum su file nuovo: rifiuta se non vuota
 *   add:library      [--dry-run]    additiva: crea solo ciò che manca, segnala le differenze
 *   verify:library                  sola lettura: snapshot → verifyLibrary → report per componente → exit code
 *   verify:library --write-snapshot <path>
 *                                   lettura LIVE salvata su file (lo snapshot committato
 *                                   `data/library.snapshot.json`), poi la verifica
 *
 * Esito per componente (Story 2.8 parte B): `ok` / `rosso` / `in attesa`,
 * stampato nel terminale e, se esiste `$GITHUB_STEP_SUMMARY`, in Markdown
 * nel riepilogo del job. Exit 1 solo con almeno una voce rossa.
 *
 * Opzione `--snapshot <path>`: legge lo snapshot da file invece che live
 * (offline, seam dei test). I comandi sono LIVE come `extract:component`:
 * MAI in CI né in build — Penpot non è raggiungibile dal runner.
 *
 * L'esito lo decide SEMPRE `verifyLibrary` / l'exit code, mai il prompt
 * delle skill (AD-11).
 */

/** Design derivati da `data/designs/*.design.json` (Story 2.7): nessuna mappa a mano. */
const DESIGNS: Record<string, ComponentDesign> = committedDesigns();

/** Timeout per chiamata più ampio del default: le scritture su Penpot sono lente (Dev Notes), il default resta 15 s. */
const WRITE_TIMEOUT_MS = 60_000;

export interface CliArgs {
  mode: "bootstrap" | "add" | "verify";
  dryRun: boolean;
  snapshotPath?: string;
  /** Solo verify: salva la lettura live su file (snapshot committato, decisione 3). */
  writeSnapshotPath?: string;
  /** Solo verify: `--json <path>` scrive anche il report JSON con `kind` per problema (Story 2.9). */
  jsonPath?: string;
}

function loadSeed(): SemanticSeed {
  return JSON.parse(readFileSync(PATHS.semanticSeedPath, "utf8")) as SemanticSeed;
}

async function loadSnapshot(args: CliArgs): Promise<LibrarySnapshot> {
  if (args.snapshotPath) {
    // Validato alla fonte: uno snapshot committato malformato è un errore che nomina il campo.
    return parseLibrarySnapshot(JSON.parse(readFileSync(args.snapshotPath, "utf8")));
  }
  return readLibrarySnapshot();
}

/**
 * Serializzazione deterministica dello snapshot committato: chiavi ordinate
 * (la stessa `stableStringify` dei gate), poi indentata per diff leggibili
 * fra due letture live.
 */
export function serializeSnapshot(snapshot: LibrarySnapshot): string {
  return `${JSON.stringify(JSON.parse(stableStringify(snapshot)), null, 2)}\n`;
}

/** Scrive lo snapshot con tmp + rename: un fallimento non lascia un file a metà. */
export function writeSnapshotFile(path: string, snapshot: LibrarySnapshot): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, serializeSnapshot(snapshot), "utf8");
  renameSync(tmp, path);
}

/**
 * Binding committati per contratto (alias dei layer, Story 2.8 parte B):
 * `data/bindings/<contratto>.binding.json`, se esiste. Un binding
 * malformato non ferma la verifica: è un errore che nomina il file, per il
 * contratto (voce rossa in `verifyLibrary`).
 */
export function loadCommittedBindings(
  contractNames: readonly string[],
  dir: string = bindingsDir,
): { bindings: Record<string, AliasSource>; errors: Record<string, string> } {
  const bindings: Record<string, AliasSource> = {};
  const errors: Record<string, string> = {};
  for (const name of contractNames) {
    const path = resolve(dir, `${name}.binding.json`);
    if (!existsSync(path)) continue;
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      errors[name] = `Binding non leggibile (${path}): ${(error as Error).message}`;
      continue;
    }
    const parsed = BindingSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
      errors[name] = `Binding malformato (${path}): ${issues.join("; ")}`;
      continue;
    }
    bindings[name] = parsed.data;
  }
  return { bindings, errors };
}

function printSnapshotSummary(snapshot: LibrarySnapshot): void {
  const tokens = snapshot.sets.reduce((total, set) => total + set.tokens.length, 0);
  console.log(
    `Snapshot: ${snapshot.sets.length} set (${snapshot.sets.map((set) => set.name).join(", ")}), ${tokens} token, ${snapshot.components.length} VariantContainer, ${snapshot.componentCount} componenti totali.`,
  );
}

async function executeSteps(steps: readonly { description: string; code: string }[]): Promise<void> {
  const endpoint = resolveMcpEndpoint();
  for (const [index, step] of steps.entries()) {
    process.stdout.write(`[${index + 1}/${steps.length}] ${step.description}… `);
    const result = await callPenpotTool(
      endpoint,
      { name: "execute_code", arguments: { code: step.code } },
      `operazione "${step.description}"`,
      WRITE_TIMEOUT_MS,
    );
    // L'envelope va validato SEMPRE: un errore di esecuzione arriva come testo
    // non-JSON con `isError` undefined (verificato su Penpot 2.17.2) — senza
    // questa validazione un passo fallito passerebbe per "ok".
    const envelope = parseExecuteCodeEnvelope(result, `operazione "${step.description}"`);
    console.log(stepOutcome(envelope.result));
  }
}

/** "ok" o "saltato (motivo)": uno step con guardia (`addCell`) può restituire `skipped: true`. */
export function stepOutcome(result: unknown): string {
  const outcome = result as { skipped?: unknown; reason?: unknown } | null;
  if (outcome !== null && typeof outcome === "object" && outcome.skipped === true) {
    return `saltato (${typeof outcome.reason === "string" ? outcome.reason : "motivo non indicato"})`;
  }
  return "ok";
}

/**
 * Verifica → report per componente (terminale + `$GITHUB_STEP_SUMMARY`) →
 * exit code (decisione 1). `fromFile`: lo snapshot viene da un file
 * committato, quindi un componente committato assente è "snapshot da
 * aggiornare".
 */
export function runVerify(
  snapshot: LibrarySnapshot,
  seed: SemanticSeed,
  options: { fromFile?: boolean; env?: NodeJS.ProcessEnv; print?: (text: string) => void; jsonPath?: string } = {},
): number {
  const contracts = Object.values(COMPONENT_CONTRACTS);
  const { bindings, errors: bindingErrors } = loadCommittedBindings(contracts.map((contract) => contract.name));
  // Una ricetta committata malformata è una voce rossa col nome del file, non un crash.
  const scan = options.fromFile ? scanCommittedComponents() : undefined;
  const result = verifyLibrary({
    contracts,
    spec: LIBRARY_SPEC,
    snapshot,
    seed,
    designs: DESIGNS,
    bindings,
    bindingErrors,
    ...(scan ? { committedComponents: scan.components, malformedRecipes: scan.malformed } : {}),
  });
  return publishReport(verifyReport(result), options.env, options.print, options.jsonPath);
}

/** Corpo di `bootstrap:library` / `add:library` / `verify:library`, con argomenti già parsati: ritorna l'exit code. */
export async function runLibrary(args: CliArgs): Promise<number> {
  const seed = loadSeed();
  const snapshot = await loadSnapshot(args);
  printSnapshotSummary(snapshot);

  if (args.mode === "verify") {
    if (args.writeSnapshotPath !== undefined) {
      writeSnapshotFile(args.writeSnapshotPath, snapshot);
      console.log(`Snapshot live scritto: ${args.writeSnapshotPath}`);
    }
    return runVerify(snapshot, seed, {
      fromFile: args.snapshotPath !== undefined,
      ...(args.jsonPath === undefined ? {} : { jsonPath: args.jsonPath }),
    });
  }

  const mode = args.mode === "bootstrap" ? "bootstrap" : "additive";
  const plan = planLibrary({
    mode,
    contracts: Object.values(COMPONENT_CONTRACTS),
    spec: LIBRARY_SPEC,
    seed,
    designs: DESIGNS,
    snapshot,
  });

  if (plan.refused) {
    console.error(`✖ ${plan.refused}`);
    return 1;
  }

  if (plan.differences.length > 0) {
    console.log(`Differenze segnalate (${plan.differences.length}) — l'additiva segnala, non corregge:`);
    for (const difference of plan.differences) {
      console.log(`  - ${difference.subject}: atteso ${difference.expected}, trovato ${difference.found}`);
    }
  }

  if (args.dryRun) {
    console.log(`Piano (${mode}): ${plan.operations.length} operazioni, nessuna scrittura (--dry-run).`);
    for (const operation of plan.operations) {
      if (operation.kind === "createSet") console.log(`  - createSet "${operation.set}"`);
      else if (operation.kind === "createToken") console.log(`  - createToken "${operation.name}" → set "${operation.set}"`);
      else if (operation.kind === "addCell")
        console.log(`  - addCell "${operation.containerName}" cella "${operation.cellKey}" (contratto "${operation.contract}")`);
      else console.log(`  - createContainer "${operation.containerName}" (${operation.cells.length} celle)`);
    }
    return 0;
  }

  // La verifica gira SEMPRE (anche a 0 operazioni): l'esito lo decide
  // verifyLibrary, mai il numero di operazioni. Le differenze segnalate
  // dall'additiva NON cambiano l'exit code — è la verifica a decidere.
  if (plan.operations.length > 0) {
    const steps = operationsToSteps(plan.operations);
    console.log(`Esecuzione di ${steps.length} step su Penpot…`);
    await executeSteps(steps);
  } else {
    console.log("Nessuna operazione da eseguire (idempotente).");
  }

  const after = await readLibrarySnapshot();
  return runVerify(after, seed);
}
