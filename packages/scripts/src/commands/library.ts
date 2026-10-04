import { readFileSync } from "node:fs";

import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint } from "../shared/mcp-client";
import { PATHS } from "../shared/paths";
import { readLibrarySnapshot, type CallToolFn } from "../library/library-reader";
import type { LibrarySnapshot } from "../library/library-snapshot";
import type { SemanticSeed } from "../library/library-spec";
import { ScriptError } from "../errors";
import { planAdd, planBootstrap } from "../library-plan";
import { operationsToSteps, type WriteStep } from "../library-writer";
import { knownExtractionNames, resolveExtraction, EXTRACTION_CONTRACTS } from "../registry";
import { parseArgs, type Command } from "../shell";

/**
 * `library bootstrap|add <Comp> [--dry-run]` (Story 2.13, CAP-6): crea in
 * Penpot il VariantContainer dal contratto di estrazione — plugin data, assi
 * (inclusi `state`), 6 celle, layer con i nomi delle parti e token legati dal
 * registro. Rilanciato è idempotente (nessuna scrittura, differenze
 * segnalate); `--dry-run` stampa il piano senza scrivere. Solo `library`
 * scrive su Penpot; mai in CI.
 *
 * Categorie: nome ignoto o uso errato → `input` (1); lettura/scrittura MCP
 * fallita → `penpot` (2). `--snapshot` non esiste qui: vale solo come seam di
 * lettura/test (vietato in scrittura live).
 */

export const LIBRARY_USAGE = "library bootstrap|add <Comp> [--dry-run]";

/** Timeout per scrittura più ampio del default: le scritture Penpot sono lente (come v1). */
const WRITE_TIMEOUT_MS = 60_000;

export interface LibraryDeps {
  /** Default: il seed committato (`data/semantic-tokens.seed.json`). */
  readonly seed?: SemanticSeed;
  /** Default: `PATHS.semanticSeedPath`. */
  readonly seedPath?: string;
  /** Seam per i test: snapshot già pronto, zero rete. Default: lettura live. */
  readonly readSnapshot?: () => Promise<LibrarySnapshot>;
  /** Seam di lettura per i test: transport mockato di `readLibrarySnapshot`. */
  readonly callTool?: CallToolFn;
  /** Seam di scrittura per i test: default `callPenpotTool(execute_code)`. */
  readonly writeCode?: (step: WriteStep) => Promise<unknown>;
  readonly log?: (text: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validateSeedEntries(seed: { palette?: unknown; semantic?: unknown }, seedPath: string): asserts seed is SemanticSeed {
  for (const set of ["palette", "semantic"] as const) {
    const tokens = seed[set] as Array<{ name?: unknown; type?: unknown; value?: unknown }> | undefined;
    if (!Array.isArray(tokens)) continue;
    for (const [index, token] of tokens.entries()) {
      if (typeof token?.name !== "string" || token.name.length === 0 || typeof token?.type !== "string" || token.type.length === 0 || token?.value === undefined) {
        throw new ScriptError({ kind: "input", detail: `seed malformato (${seedPath}): token #${index} in "${set}" senza name/type/value.` });
      }
    }
  }
}

function loadSeed(deps: LibraryDeps): SemanticSeed {
  if (deps.seed !== undefined) {
    validateSeedEntries(deps.seed as { palette?: unknown; semantic?: unknown }, "<injected>");
    return deps.seed;
  }
  const seedPath = deps.seedPath ?? PATHS.semanticSeedPath;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(seedPath, "utf8")) as unknown;
  } catch (error: unknown) {
    throw new ScriptError({ kind: "input", detail: `seed non leggibile (${seedPath}): ${messageOf(error)}` });
  }
  const seed = parsed as { palette?: unknown; semantic?: unknown };
  if (!Array.isArray(seed?.palette) || !Array.isArray(seed?.semantic)) {
    throw new ScriptError({ kind: "input", detail: `seed malformato (${seedPath}): attesi array "palette" e "semantic".` });
  }
  validateSeedEntries(seed, seedPath);
  return seed as unknown as SemanticSeed;
}

async function defaultReadSnapshot(callTool: CallToolFn | undefined): Promise<LibrarySnapshot> {
  try {
    return await readLibrarySnapshot(callTool === undefined ? {} : { callTool });
  } catch (error: unknown) {
    if (error instanceof ScriptError) throw error;
    throw new ScriptError({ kind: "penpot", detail: messageOf(error), cause: error });
  }
}

async function defaultWriteCode(step: WriteStep): Promise<unknown> {
  const endpoint = resolveMcpEndpoint();
  let result;
  try {
    result = await callPenpotTool(
      endpoint,
      { name: "execute_code", arguments: { code: step.code } },
      `operazione "${step.description}"`,
      WRITE_TIMEOUT_MS,
    );
  } catch (error: unknown) {
    throw new ScriptError({ kind: "penpot", detail: messageOf(error), cause: error });
  }
  try {
    return parseExecuteCodeEnvelope(result, `operazione "${step.description}"`).result;
  } catch (error: unknown) {
    throw new ScriptError({ kind: "penpot", detail: messageOf(error), cause: error });
  }
}

function describeOperation(operation: ReturnType<typeof operationsToSteps>[number]): string {
  return operation.description;
}

async function safeRead(readSnapshot: () => Promise<LibrarySnapshot>, component?: string): Promise<LibrarySnapshot> {
  try {
    return await readSnapshot();
  } catch (error: unknown) {
    if (error instanceof ScriptError) throw error;
    throw new ScriptError({ kind: "penpot", ...(component === undefined ? {} : { component }), detail: messageOf(error), cause: error });
  }
}

async function safeWrite(writeCode: (step: WriteStep) => Promise<unknown>, step: WriteStep): Promise<unknown> {
  try {
    return await writeCode(step);
  } catch (error: unknown) {
    if (error instanceof ScriptError) throw error;
    throw new ScriptError({ kind: "penpot", detail: messageOf(error), cause: error });
  }
}

export function libraryCommandWith(deps: LibraryDeps = {}): Command {
  const log = deps.log ?? console.log;
  return {
    name: "library",
    usage: LIBRARY_USAGE,
    async run(argv) {
      const parsed = parseArgs(argv, { usage: LIBRARY_USAGE, flags: ["--dry-run", "--help"], positional: { min: 0, max: 2 } });
      if (parsed.flags.has("--help")) {
        log(`Uso: ${LIBRARY_USAGE}`);
        log(`  library bootstrap — crea set/token dal seed e i container v2 (rifiuta se la library non è vuota)`);
        log(`  library add <Comp> — crea il container del componente (idempotente, differenze segnalate)`);
        log(`  --dry-run stampa il piano senza scrivere su Penpot. Live, mai in CI.`);
        log(`  Contratti v2 noti: ${knownExtractionNames().join(", ")}`);
        return 0;
      }
      const [mode, comp] = parsed.positional;
      if (mode !== "bootstrap" && mode !== "add") {
        throw new ScriptError({
          kind: "input",
          detail: `sotto-comando "${mode ?? "<mancante>"}" non riconosciuto — uso: ${LIBRARY_USAGE}`,
        });
      }
      if (mode === "bootstrap" && comp !== undefined) {
        throw new ScriptError({ kind: "input", detail: `troppi argomenti ("${comp}" non atteso con bootstrap) — uso: ${LIBRARY_USAGE}` });
      }
      if (mode === "add" && comp === undefined) {
        throw new ScriptError({ kind: "input", detail: `argomento mancante (il componente) — uso: ${LIBRARY_USAGE}` });
      }
      const dryRun = parsed.flags.has("--dry-run");
      const readSnapshot = deps.readSnapshot ?? (() => defaultReadSnapshot(deps.callTool));
      const writeCode = deps.writeCode ?? defaultWriteCode;

      if (mode === "bootstrap") {
        const seed = loadSeed(deps);
        const extractions = Object.values(EXTRACTION_CONTRACTS);
        const snapshot = await safeRead(readSnapshot);
        const plan = planBootstrap({ extractions, seed, snapshot });
        if (plan.refused !== undefined) {
          throw new ScriptError({ kind: "input", detail: plan.refused });
        }
        if (dryRun) {
          log(`Piano (bootstrap): ${plan.operations.length} operazioni, nessuna scrittura (--dry-run).`);
          for (const operation of plan.operations) {
            if (operation.kind === "createSet") log(`  - createSet "${operation.set}"`);
            else if (operation.kind === "createToken") log(`  - createToken "${operation.name}" → set "${operation.set}"`);
            else log(`  - createContainer "${operation.containerName}" (${operation.cells.length} celle, plugin data ${operation.pluginData})`);
          }
          return 0;
        }
        const steps = operationsToSteps(plan.operations);
        for (const [index, step] of steps.entries()) {
          log(`[${index + 1}/${steps.length}] ${describeOperation(step)}…`);
          await safeWrite(writeCode, step);
        }
        log(`Bootstrap: ${plan.operations.length} operazioni scritte su Penpot.`);
        return 0;
      }

      const extraction = resolveExtraction(comp!);
      const snapshot = await safeRead(readSnapshot, extraction.penpot.container);
      const plan = planAdd(extraction, snapshot);
      if (plan.differences.length > 0) {
        log(`Differenze segnalate (${plan.differences.length}) — l'additiva segnala, non corregge:`);
        for (const difference of plan.differences) {
          log(`  - ${difference.subject}: atteso ${difference.expected}, trovato ${difference.found}`);
        }
      }
      if (plan.operations.length === 0) {
        log(`Nessuna operazione da eseguire (idempotente).`);
        return 0;
      }
      if (dryRun) {
        const container = plan.operations[0]!;
        if (container.kind !== "createContainer") throw new ScriptError({ kind: "input", detail: "Piano incoerente: add produce solo createContainer." });
        log(`Piano (add ${extraction.penpot.container}): 1 container, ${container.cells.length} celle, nessuna scrittura (--dry-run).`);
        log(`  - createContainer "${container.containerName}" (${container.cells.length} celle, plugin data ${container.pluginData})`);
        for (const cell of container.cells) {
          const layers = cell.parts.filter((part) => part.name !== "root").map((part) => part.layer);
          log(`  - cella ${Object.entries(cell.variantProps).map(([axis, value]) => `${axis}=${value}`).join("|")}: layer [${layers.join(", ")}]`);
        }
        return 0;
      }
      const steps = operationsToSteps(plan.operations);
      log(`Esecuzione di ${steps.length} step su Penpot…`);
      for (const [index, step] of steps.entries()) {
        log(`[${index + 1}/${steps.length}] ${describeOperation(step)}…`);
        await safeWrite(writeCode, step);
      }
      log(`Container "${extraction.penpot.container}" creato (6 celle, plugin data ${extraction.pluginData}).`);
      return 0;
    },
  };
}

export const libraryCommand: Command = libraryCommandWith();
