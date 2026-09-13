import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";

import { publishReport } from "../component-report";
import { bindingsDir, scanCommittedComponents } from "../emitter/artifacts";
import { BindingSchema } from "../emitter/binding-shadcn";
import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint } from "../mcp-client";
import type { AliasSource } from "../recipe-schema";
import { stableStringify } from "../validate-recipe";
import { committedDesigns } from "./designs-loader";
import { isDirectInvocation as isDirectInvocationModule } from "./direct-invocation";
import { planLibrary, type ComponentDesign } from "./library-plan";
import { parseLibrarySnapshot, readLibrarySnapshot } from "./library-reader";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import type { LibrarySnapshot } from "./library-snapshot";
import { operationsToSteps } from "./penpot-writer";
import { verifyLibrary, verifyReport } from "./verify-library";

/**
 * Entry CLI della library (Story 2.4, Task 5):
 *
 *   bootstrap:library [--dry-run]   bootstrap una tantum su file nuovo: rifiuta se non vuota
 *   add:library      [--dry-run]    additiva: crea solo ciò che manca, segnala le differenze
 *   verify:library                  sola lettura: snapshot → verifyLibrary → report per componente → exit code
 *   verify:library --write-snapshot <path>
 *                                   lettura LIVE salvata su file (lo snapshot committato
 *                                   `src/library/library.snapshot.json`), poi la verifica
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

const SEED_PATH = new URL("./semantic-tokens.seed.json", import.meta.url);
/** Design derivati da `designs/*.design.json` (Story 2.7): nessuna mappa a mano. */
const DESIGNS: Record<string, ComponentDesign> = committedDesigns();

/** Timeout per chiamata più ampio del default: le scritture su Penpot sono lente (Dev Notes), il default resta 15 s. */
const WRITE_TIMEOUT_MS = 60_000;

export interface CliArgs {
  mode: "bootstrap" | "add" | "verify";
  dryRun: boolean;
  snapshotPath?: string;
  /** Solo verify: salva la lettura live su file (snapshot committato, decisione 3). */
  writeSnapshotPath?: string;
}

export function parseArgs(args: readonly string[]): CliArgs {
  const filtered = args.filter((arg) => arg !== "--");
  const [mode, ...rest] = filtered;
  if (mode !== "bootstrap" && mode !== "add" && mode !== "verify") {
    throw new Error(
      `Modalità "${mode ?? "<mancante>"}" non riconosciuta — usare "bootstrap", "add" o "verify": pnpm bootstrap:library | pnpm add:library | pnpm verify:library.`,
    );
  }
  let dryRun = false;
  let snapshotPath: string | undefined;
  let writeSnapshotPath: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--snapshot") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Opzione --snapshot richiede un percorso file.");
      }
      snapshotPath = value;
      index++;
    } else if (arg === "--write-snapshot") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Opzione --write-snapshot richiede un percorso file.");
      }
      writeSnapshotPath = value;
      index++;
    } else {
      throw new Error(`Argomento non riconosciuto: ${arg} — usare [--dry-run] [--snapshot <path>] [--write-snapshot <path>].`);
    }
  }
  if (dryRun && mode === "verify") {
    throw new Error("--dry-run non ha senso su verify (è già sola lettura).");
  }
  // `--snapshot` è il seam offline della SOLA lettura (review 2.4): pianificare
  // su un file ma scrivere sul Penpot live aggira il rifiuto del bootstrap
  // (basta uno snapshot vuoto) e disallinea piano e scritture.
  if (snapshotPath !== undefined && mode !== "verify" && !dryRun) {
    throw new Error("--snapshot è valido solo su verify:library oppure insieme a --dry-run.");
  }
  // `--write-snapshot` salva una lettura LIVE: con `--snapshot` salverebbe
  // una copia di un file, non Penpot (decisione 3: lo scrive lo sviluppatore dal vivo).
  if (writeSnapshotPath !== undefined && mode !== "verify") {
    throw new Error("--write-snapshot è valido solo su verify:library.");
  }
  if (writeSnapshotPath !== undefined && snapshotPath !== undefined) {
    throw new Error("--write-snapshot e --snapshot sono alternativi: --write-snapshot salva una lettura live di Penpot.");
  }
  return writeSnapshotPath === undefined ? { mode, dryRun, snapshotPath } : { mode, dryRun, snapshotPath, writeSnapshotPath };
}

function loadSeed(): SemanticSeed {
  return JSON.parse(readFileSync(SEED_PATH, "utf8")) as SemanticSeed;
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
 * `emitter/bindings/<contratto>.binding.json`, se esiste. Un binding
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
  options: { fromFile?: boolean; env?: NodeJS.ProcessEnv; print?: (text: string) => void } = {},
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
  return publishReport(verifyReport(result), options.env, options.print);
}

export async function main(args: CliArgs = parseArgs(process.argv.slice(2))): Promise<number> {
  const seed = loadSeed();
  const snapshot = await loadSnapshot(args);
  printSnapshotSummary(snapshot);

  if (args.mode === "verify") {
    if (args.writeSnapshotPath !== undefined) {
      writeSnapshotFile(args.writeSnapshotPath, snapshot);
      console.log(`Snapshot live scritto: ${args.writeSnapshotPath}`);
    }
    return runVerify(snapshot, seed, { fromFile: args.snapshotPath !== undefined });
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


// Esegui `main()` solo da invocazione diretta, mai a un semplice `import`
// (stessa guardia di extract-component.ts): senza, ogni import del modulo
// chiamerebbe main() con l'argv del processo ospite. Il realpathSync gestisce
// l'invocazione via symlink (stesso schema del gate check-boundaries.mjs).
const isDirectInvocation = isDirectInvocationModule(import.meta.url);

if (isDirectInvocation) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

