import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

import { toKebab } from "./shared/naming";
import { PATHS } from "./shared/paths";
import { ScriptError } from "./errors";
import { EXTRACTION_CONTRACTS, knownExtractionNames } from "./registry";

/**
 * Istantanea v2 `data/components/<kebab>.json` (Story 2.14, CAP-4): l'unico
 * artefatto di `extract`, scritto solo da lui (tmp + rename, mai a mano).
 * Sostituisce fixture + ricetta + design: `contract` (plugin data
 * `nome@versione`), `provenance` (id Penpot, `readAt`, hash stabile) e
 * `cells[cella][parte]` = token per proprietà più layout/posizione
 * (valori a parola chiave per le righe `keyword` del registro).
 *
 * Celle = cartesiano assi page builder × assi di rendering (`promo` 3 valori
 * × `hover` 2 valori = 6 board per la card); chiave cella `promo=<v>|hover=<v>`
 * come in `library-plan` (`cellKey`, `expectedCells`).
 */

export const PLUGIN_DATA_PATTERN_V2 = /^([a-z][a-z0-9-]*)@(\d+)$/;

const ProvenanceSchema = z.object({
  penpotComponentId: z.string().min(1),
  readAt: z.string().min(1),
  snapshotHash: z.string().min(1),
});

const CellsSchema = z.record(z.string().min(1), z.record(z.string().min(1), z.record(z.string().min(1), z.string().min(1))));

export const ComponentSnapshotSchema = z.object({
  contract: z.string().regex(PLUGIN_DATA_PATTERN_V2, "contract atteso come plugin data nome@versione (es. product-card@1)"),
  provenance: ProvenanceSchema,
  cells: CellsSchema,
});

export type ComponentSnapshotProvenance = z.infer<typeof ProvenanceSchema>;
export type ComponentSnapshot = z.infer<typeof ComponentSnapshotSchema>;

/** `data/components/<kebab>.json` per `<Comp>` (Pascal o kebab). */
export function componentSnapshotPathFor(componentName: string, dir: string = PATHS.componentsDir): string {
  return resolve(dir, `${toKebab(componentName)}.json`);
}

/**
 * Container con istantanea committata, nell'ordine di registrazione: per ogni
 * contratto noto del registry con file `data/components/<contract.name>.json`.
 * Niente manipolazione di stringhe kebab→Pascal: il nome esatto (PascalCase
 * del container) viene dal lookup nel registry. I file senza contratto noto
 * non sono istantanee renderizzabili e restano fuori.
 */
export function committedSnapshots(dir: string = PATHS.componentsDir): string[] {
  if (!existsSync(dir)) return [];
  const files = new Set(
    readdirSync(dir)
      .filter((entry) => entry.endsWith(".json") && entry !== ".gitkeep")
      .map((entry) => entry.slice(0, -".json".length)),
  );
  return Object.values(EXTRACTION_CONTRACTS)
    .filter((extraction) => files.has(extraction.contract.name))
    .map((extraction) => extraction.penpot.container);
}

/** Hash stabile di contenuto (contratto + celle, senza `readAt`): 12 hex come `fixtureHash`. */
export function componentSnapshotHash(contract: string, cells: ComponentSnapshot["cells"]): string {
  return createHash("sha256").update(stableStringify({ contract, cells })).digest("hex").slice(0, 12);
}

/** JSON canonico con chiavi ordinate ricorsivamente (deterministico per hash e diff). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) as string;
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

/** Celle canoniche: chiavi cella/parti/proprietà ordinate (stesso byte a parità di contenuto). */
export function canonicalCells(cells: ComponentSnapshot["cells"]): ComponentSnapshot["cells"] {
  const out: Record<string, Record<string, Record<string, string>>> = {};
  for (const cellKey of Object.keys(cells).sort()) {
    const parts = cells[cellKey]!;
    const canonParts: Record<string, Record<string, string>> = {};
    for (const part of Object.keys(parts).sort()) {
      const props = parts[part]!;
      const canonProps: Record<string, string> = {};
      for (const prop of Object.keys(props).sort()) canonProps[prop] = props[prop]!;
      canonParts[part] = canonProps;
    }
    out[cellKey] = canonParts;
  }
  return out;
}

/**
 * Costruisce l'istantanea da scrivere (hash calcolato, `readAt` adesso salvo
 * override per i test). Le celle devono già essere canoniche o lo diventano qui.
 */
export function buildComponentSnapshot(args: {
  contract: string;
  penpotComponentId: string;
  cells: ComponentSnapshot["cells"];
  readAt?: string;
}): ComponentSnapshot {
  const cells = canonicalCells(args.cells);
  const snapshotHash = componentSnapshotHash(args.contract, cells);
  return {
    contract: args.contract,
    provenance: {
      penpotComponentId: args.penpotComponentId,
      readAt: args.readAt ?? new Date().toISOString(),
      snapshotHash,
    },
    cells,
  };
}

/** Scrittura atomica (tmp + rename): un crash non lascia mai un file troncato. */
export function writeComponentSnapshotAtomic(filePath: string, snapshot: ComponentSnapshot): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const content = `${JSON.stringify({ ...snapshot, cells: canonicalCells(snapshot.cells) }, null, 2)}\n`;
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, filePath);
}

/**
 * Confronto semantico per `--check`: contratto + `penpotComponentId` + celle.
 * `readAt` e `snapshotHash` sono ignorati (`readAt` cambia a ogni lettura,
 * l'hash deriva dalle celle).
 */
export function componentSnapshotsEqual(a: ComponentSnapshot, b: ComponentSnapshot): boolean {
  return (
    a.contract === b.contract &&
    a.provenance.penpotComponentId === b.provenance.penpotComponentId &&
    stableStringify(canonicalCells(a.cells)) === stableStringify(canonicalCells(b.cells))
  );
}

/** Differenze nominative fra due istantanee (celle/parti/proprietà), per il log di `--check`. */
export function diffComponentSnapshots(expected: ComponentSnapshot, actual: ComponentSnapshot): string[] {
  const out: string[] = [];
  if (expected.contract !== actual.contract) {
    out.push(`contract: atteso "${expected.contract}", trovato "${actual.contract}"`);
  }
  if (expected.provenance.penpotComponentId !== actual.provenance.penpotComponentId) {
    out.push(
      `provenance.penpotComponentId: atteso "${expected.provenance.penpotComponentId}", trovato "${actual.provenance.penpotComponentId}"`,
    );
  }
  const keys = new Set([...Object.keys(expected.cells), ...Object.keys(actual.cells)]);
  for (const cell of [...keys].sort()) {
    const expParts = expected.cells[cell];
    const actParts = actual.cells[cell];
    if (expParts === undefined) {
      out.push(`cella ${cell}: in più (non nel cartesiano atteso)`);
      continue;
    }
    if (actParts === undefined) {
      out.push(`cella ${cell}: assente`);
      continue;
    }
    const partNames = new Set([...Object.keys(expParts), ...Object.keys(actParts)]);
    for (const part of [...partNames].sort()) {
      const expProps = expParts[part];
      const actProps = actParts[part];
      if (expProps === undefined) {
        out.push(`cella ${cell}, parte "${part}": in più`);
        continue;
      }
      if (actProps === undefined) {
        out.push(`cella ${cell}, parte "${part}": assente`);
        continue;
      }
      const propNames = new Set([...Object.keys(expProps), ...Object.keys(actProps)]);
      for (const prop of [...propNames].sort()) {
        if (expProps[prop] !== actProps[prop]) {
          out.push(
            `cella ${cell}, parte "${part}", proprietà "${prop}": atteso "${expProps[prop] ?? "<assente>"}", trovato "${actProps[prop] ?? "<assente>"}"`,
          );
        }
      }
    }
  }
  return out;
}

/**
 * Legge l'istantanea committata e la valida alla fonte. Assente = `input`
 * (exit 1) che nomina il componente e i contratti v2 noti; malformata =
 * `contract` (exit 3) che nomina file e campo.
 */
export function loadComponentSnapshot(componentName: string, dir: string = PATHS.componentsDir): ComponentSnapshot {
  const path = componentSnapshotPathFor(componentName, dir);
  if (!existsSync(path)) {
    const known = knownExtractionNamesSafe();
    throw new ScriptError({
      kind: "input",
      component: componentName,
      detail: `istantanea non trovata per "${componentName}": ${path} — estrai prima con "extract ${componentName}" (contratti v2 noti: ${known}).`,
    });
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new ScriptError({
      kind: "contract",
      component: componentName,
      detail: `istantanea malformata (${path}): non è JSON leggibile — ${(error as Error).message}`,
    });
  }
  const parsed = ComponentSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
    throw new ScriptError({
      kind: "contract",
      component: componentName,
      detail: `istantanea malformata (${path}):\n${issues.join("\n")}`,
    });
  }
  return parsed.data;
}

function knownExtractionNamesSafe(): string {
  try {
    return knownExtractionNames().join(", ") || "<nessuno>";
  } catch {
    return "ProductCard";
  }
}
