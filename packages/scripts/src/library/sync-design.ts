import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { LegacyComponentContract } from "@app/contracts";

import { componentFixtureFromSnapshot, legacyContracts } from "../extract/component-reader";
import { loadPartAliases } from "../extract/extract-component";
import { cellKeyOf, partBindings } from "../extract/recipe-schema";
import { PATHS } from "../shared/paths";
import { pascalCase } from "../shared/naming";
import { formatDiff } from "./adopt-command";
import { resolveContract, type BumpArgs } from "./bump-command";
import { parseLibrarySnapshot, readLibrarySnapshot, type CallToolFn } from "./library-reader";
import { cartesian } from "./library-plan";
import type { LibrarySnapshot, SnapshotLayer } from "./library-snapshot";

/**
 * `sync:design` (Story 2.10, C): riallinea le celle del design committato
 * (`data/designs/<contratto>.design.json`) a Penpot live. Il design è il seed
 * di `addCell`: se diverge da Penpot, una cella aggiunta nascerebbe dal
 * valore vecchio. Le funzioni pure (`liveDesignCells`, `designDrift`,
 * `syncedDesignCells`) le usa anche `verify:library` per il problema
 * `design-drift`; `runSyncDesign` è il comando.
 *
 *   sync:design -- <Comp>                   stampa il diff design committato ↔ Penpot, nessuna scrittura
 *   sync:design -- <Comp> --yes             riscrive le celle del design (tmp + rename)
 *   sync:design -- <Comp> --snapshot <path> confronto su uno snapshot da file (sola lettura)
 *
 * Riscrive SOLO `cells`: `parts` (layout del seed) resta com'è. Una cella
 * del design assente in Penpot resta (è il seed di una cella da creare).
 * Legge Penpot, non lo scrive mai.
 */

/** Celle di design: chiave cella → parte → proprietà → token. */
export type DesignCells = Record<string, Record<string, Record<string, string>>>;

interface CellLike {
  readonly variantProps: Readonly<Record<string, string>> | null;
  readonly root: SnapshotLayer;
}

/**
 * Le celle di design lette da Penpot: per ogni cella del prodotto cartesiano
 * del contratto presente in Penpot, i binding `proprietà → token` per parte
 * (stessa `partBindings` dell'estrazione, con gli alias del binding). Solo le
 * parti del contratto con almeno un binding; celle fuori contratto o non
 * mappate sono affare delle altre regole.
 */
export function liveDesignCells(
  contract: Pick<LegacyComponentContract, "axes" | "parts">,
  cells: readonly CellLike[],
  aliases: Readonly<Record<string, string>> = {},
): DesignCells {
  const expected = new Set(cartesian(contract.axes).map((values) => contract.axes.map((axis, index) => `${axis.name}=${values[index]}`).join("|")));
  const out: DesignCells = {};
  for (const cell of cells) {
    if (cell.variantProps === null) continue;
    let key: string;
    try {
      key = cellKeyOf(contract.axes, cell.variantProps);
    } catch {
      continue;
    }
    if (!expected.has(key) || Object.hasOwn(out, key)) continue;
    const { bindings } = partBindings(cell.root, aliases);
    const parts: Record<string, Record<string, string>> = {};
    for (const part of contract.parts) {
      const tokens = bindings.get(part);
      if (tokens !== undefined && Object.keys(tokens).length > 0) parts[part] = { ...tokens };
    }
    out[key] = parts;
  }
  return out;
}

/** Una differenza fra design committato e Penpot, nominata cella per cella. */
export interface DesignDriftEntry {
  readonly cell: string;
  /** Assente = la cella intera manca dal design. */
  readonly part?: string;
  readonly property?: string;
  readonly design?: string;
  readonly live?: string;
}

/**
 * Le differenze delle celle presenti in Penpot: una cella del design assente
 * in Penpot non è drift (è il seed di `addCell`). Le parti vuote contano come
 * assenti su entrambi i lati.
 */
export function designDrift(committed: Readonly<DesignCells>, live: Readonly<DesignCells>): DesignDriftEntry[] {
  const entries: DesignDriftEntry[] = [];
  for (const [cell, liveParts] of Object.entries(live)) {
    const designParts = committed[cell];
    if (designParts === undefined) {
      entries.push({ cell });
      continue;
    }
    const parts = [...new Set([...Object.keys(designParts), ...Object.keys(liveParts)])];
    for (const part of parts) {
      const designTokens = designParts[part] ?? {};
      const liveTokens = liveParts[part] ?? {};
      const properties = [...new Set([...Object.keys(designTokens), ...Object.keys(liveTokens)])];
      for (const property of properties) {
        if (designTokens[property] === liveTokens[property]) continue;
        entries.push({
          cell,
          part,
          property,
          ...(designTokens[property] !== undefined ? { design: designTokens[property] } : {}),
          ...(liveTokens[property] !== undefined ? { live: liveTokens[property] } : {}),
        });
      }
    }
  }
  return entries;
}

/** Riga leggibile di una differenza: nomina cella, parte, proprietà e i due token. */
export function describeDrift(entry: DesignDriftEntry): string {
  if (entry.part === undefined) return `cella "${entry.cell}": presente in Penpot, assente dal design`;
  return `cella "${entry.cell}", parte "${entry.part}", proprietà "${entry.property}": design ${JSON.stringify(entry.design ?? "<assente>")} ≠ Penpot ${JSON.stringify(entry.live ?? "<assente>")}`;
}

/** Ordina `keys` come `reference` (chiavi note prima, nel loro ordine), le nuove in coda nel loro ordine. */
function orderedLike<T>(values: Readonly<Record<string, T>>, reference: Readonly<Record<string, unknown>> | undefined): Record<string, T> {
  const order = Object.keys(reference ?? {});
  const rank = (key: string): number => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };
  const keys = Object.keys(values);
  const sorted = keys.map((key, index) => ({ key, index })).sort((a, b) => rank(a.key) - rank(b.key) || a.index - b.index);
  return Object.fromEntries(sorted.map(({ key }) => [key, values[key]!]));
}

/**
 * Le celle del design riallineate a Penpot: una cella presente in Penpot
 * prende i valori di Penpot (parti e proprietà nell'ordine del design, le
 * nuove in coda), una assente resta com'è. Ordine delle celle: quello del
 * design, le celle nuove in coda.
 */
export function syncedDesignCells(committed: Readonly<DesignCells>, live: Readonly<DesignCells>): DesignCells {
  const out: DesignCells = {};
  const synced = (cell: string): Record<string, Record<string, string>> => {
    const reference = committed[cell];
    const parts = orderedLike(live[cell]!, reference);
    return Object.fromEntries(Object.entries(parts).map(([part, tokens]) => [part, orderedLike(tokens, reference?.[part])]));
  };
  for (const cell of Object.keys(committed)) out[cell] = Object.hasOwn(live, cell) ? synced(cell) : committed[cell]!;
  for (const cell of Object.keys(live)) if (!Object.hasOwn(out, cell)) out[cell] = synced(cell);
  return out;
}

// ---------------------------------------------------------------------------
// Il comando.
// ---------------------------------------------------------------------------

export interface SyncDesignDeps {
  contracts?: readonly LegacyComponentContract[];
  /** Seam per i test: transport mockato, zero rete. */
  callTool?: CallToolFn;
  designsDir?: string;
  bindingsDir?: string;
  print?: (text: string) => void;
}

/** Scrittura atomica: tmp accanto al file, poi rename; un fallimento non lascia un file a metà. */
function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.sync-${process.pid}.tmp`;
  try {
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  } catch (cause) {
    rmSync(tmp, { force: true });
    throw cause;
  }
}

/** Corpo di `sync:design`, con argomenti già parsati: ritorna l'exit code. Un errore nominativo lancia. */
export async function runSyncDesign(args: BumpArgs, deps: SyncDesignDeps = {}): Promise<number> {
  const print = deps.print ?? ((text: string) => console.log(text));
  const contract = resolveContract(args.component, deps.contracts ?? legacyContracts());
  const componentName = pascalCase(contract.name);
  const designPath = resolve(deps.designsDir ?? PATHS.designsDir, `${contract.name}.design.json`);
  if (!existsSync(designPath)) {
    throw new Error(`Design non trovato per "${componentName}": ${designPath} — sync:design riallinea un design committato, non lo crea (vedi [PC]).`);
  }
  const before = readFileSync(designPath, "utf8");
  let raw: { parts?: unknown; cells?: DesignCells };
  try {
    raw = JSON.parse(before) as typeof raw;
  } catch (cause) {
    throw new Error(`Il design "${designPath}" non è JSON leggibile: ${(cause as Error).message}`);
  }
  if (raw.cells === undefined || typeof raw.cells !== "object" || Array.isArray(raw.cells)) {
    throw new Error(`Il design "${designPath}" non ha "cells".`);
  }

  let snapshot: LibrarySnapshot;
  if (args.snapshotPath !== undefined) {
    snapshot = parseLibrarySnapshot(JSON.parse(readFileSync(args.snapshotPath, "utf8")));
  } else {
    snapshot = await readLibrarySnapshot(deps.callTool ? { callTool: deps.callTool } : {});
  }
  // Componente assente, versione o nome incoerenti: errore nominativo dell'estrazione.
  const fixture = componentFixtureFromSnapshot(componentName, snapshot);
  const aliases = loadPartAliases(componentName, deps.bindingsDir);
  const live = liveDesignCells(contract, fixture.cells, aliases);

  const drift = designDrift(raw.cells, live);
  if (drift.length === 0) {
    print(`Design di "${componentName}" allineato a Penpot${args.snapshotPath !== undefined ? ` (snapshot ${args.snapshotPath})` : ""}: nessuna differenza, nessuna scrittura.`);
    return 0;
  }
  print(`Design di "${componentName}" diverso da Penpot (${drift.length} differenze):`);
  for (const entry of drift) print(`  - ${describeDrift(entry)}`);
  const after = `${JSON.stringify({ ...raw, cells: syncedDesignCells(raw.cells, live) }, null, 2)}\n`;
  print(`\n--- design: ${designPath}`);
  print(formatDiff(before, after));
  if (!args.yes) {
    print("\nNessuna scrittura: rilancia con --yes per riscrivere le celle del design (Penpot non si scrive mai).");
    return 0;
  }
  writeAtomic(designPath, after);
  print(`\n✔ Design riscritto: ${designPath}. Poi: pnpm --filter @penpot-ds/scripts verify:library`);
  return 0;
}
