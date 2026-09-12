import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { COMPONENT_CONTRACTS } from "@app/contracts";

import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint } from "../mcp-client";
import { planLibrary, type ComponentDesign } from "./library-plan";
import { readLibrarySnapshot } from "./library-reader";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import type { LibrarySnapshot } from "./library-snapshot";
import { operationsToSteps } from "./penpot-writer";
import { verifyLibrary } from "./verify-library";

/**
 * Entry CLI della library (Story 2.4, Task 5):
 *
 *   bootstrap:library [--dry-run]   bootstrap una tantum su file nuovo: rifiuta se non vuota
 *   add:library      [--dry-run]    additiva: crea solo ciò che manca, segnala le differenze
 *   verify:library                  sola lettura: snapshot → verifyLibrary → exit code
 *
 * Opzione `--snapshot <path>`: legge lo snapshot da file invece che live
 * (offline, seam dei test). I comandi sono LIVE come `extract:component`:
 * MAI in CI né in build — Penpot non è raggiungibile dal runner.
 *
 * L'esito lo decide SEMPRE `verifyLibrary` / l'exit code, mai il prompt
 * delle skill (AD-11).
 */

const SEED_PATH = new URL("./semantic-tokens.seed.json", import.meta.url);
const DESIGNS: Record<string, ComponentDesign> = {
  badge: JSON.parse(readFileSync(new URL("./designs/badge.design.json", import.meta.url), "utf8")) as ComponentDesign,
  input: JSON.parse(readFileSync(new URL("./designs/input.design.json", import.meta.url), "utf8")) as ComponentDesign,
  "accordion-item": JSON.parse(
    readFileSync(new URL("./designs/accordion-item.design.json", import.meta.url), "utf8"),
  ) as ComponentDesign,
};

/** Timeout per chiamata più ampio del default: le scritture su Penpot sono lente (Dev Notes), il default resta 15 s. */
const WRITE_TIMEOUT_MS = 60_000;

export interface CliArgs {
  mode: "bootstrap" | "add" | "verify";
  dryRun: boolean;
  snapshotPath?: string;
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
    } else {
      throw new Error(`Argomento non riconosciuto: ${arg} — usare [--dry-run] [--snapshot <path>].`);
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
  return { mode, dryRun, snapshotPath };
}

function loadSeed(): SemanticSeed {
  return JSON.parse(readFileSync(SEED_PATH, "utf8")) as SemanticSeed;
}

async function loadSnapshot(args: CliArgs): Promise<LibrarySnapshot> {
  if (args.snapshotPath) {
    return JSON.parse(readFileSync(args.snapshotPath, "utf8")) as LibrarySnapshot;
  }
  return readLibrarySnapshot();
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
    parseExecuteCodeEnvelope(result, `operazione "${step.description}"`);
    console.log("ok");
  }
}

function runVerify(snapshot: LibrarySnapshot, seed: SemanticSeed): boolean {
  const result = verifyLibrary({ contracts: Object.values(COMPONENT_CONTRACTS), spec: LIBRARY_SPEC, snapshot, seed });
  if (result.ok) {
    console.log(`✔ verifyLibrary: verde (${result.errors.length} errori).`);
    return true;
  }
  console.error(`✖ verifyLibrary: ${result.errors.length} errori:`);
  for (const error of result.errors) console.error(`  - ${error}`);
  return false;
}

export async function main(args: CliArgs = parseArgs(process.argv.slice(2))): Promise<number> {
  const seed = loadSeed();
  const snapshot = await loadSnapshot(args);
  printSnapshotSummary(snapshot);

  if (args.mode === "verify") {
    return runVerify(snapshot, seed) ? 0 : 1;
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
  return runVerify(after, seed) ? 0 : 1;
}


// Esegui `main()` solo da invocazione diretta, mai a un semplice `import`
// (stessa guardia di extract-component.ts): senza, ogni import del modulo
// chiamerebbe main() con l'argv del processo ospite. Il realpathSync gestisce
// l'invocazione via symlink (stesso schema del gate check-boundaries.mjs).
const isDirectInvocation = (() => {
  if (process.argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();

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

