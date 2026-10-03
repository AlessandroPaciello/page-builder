import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PATHS } from "./shared/paths";
import { roleAdmits, type PartRole } from "./shared/style-properties";
import type { SnapshotComponent } from "./library/library-snapshot";
import { cellKey, expectedAxes, expectedCells, partInCell, partsForCell, sameTokens } from "./library-plan";
import type { ExtractionContract } from "./extraction";

/**
 * Diff puro di `propose` (Story 2.13, CAP-7): confronta il container Penpot
 * letto con i due contratti e descrive cosa cambierebbe nei contratti, con
 * file e riga. Mai una scrittura: solo stringhe. `when` governa la presenza:
 * un `badge` assente in `promo=none` è atteso, mai un diff.
 */

export const PAGE_BUILDER_REL = "packages/contracts/src/components/product-card.ts";
export const EXTRACTION_REL = "packages/scripts/src/contracts/product-card.extract.ts";

/** Rel page builder derivata dal contratto (`product-card` → components/product-card.ts). */
export function pageBuilderRel(extraction: ExtractionContract): string {
  return `packages/contracts/src/components/${extraction.contract.name}.ts`;
}

/** Rel estrazione derivata dal contratto (`product-card` → product-card.extract.ts). */
export function extractionRel(extraction: ExtractionContract): string {
  return `packages/scripts/src/contracts/${extraction.contract.name}.extract.ts`;
}

function absPageBuilderFor(extraction: ExtractionContract): string {
  return resolve(PATHS.contractsSrcDir, `components/${extraction.contract.name}.ts`);
}

function absExtractionFor(extraction: ExtractionContract): string {
  return resolve(PATHS.packageRoot, `src/contracts/${extraction.contract.name}.extract.ts`);
}

function findLine(absPath: string, predicate: (line: string) => boolean): number {
  try {
    const lines = readFileSync(absPath, "utf8").split("\n");
    const index = lines.findIndex(predicate);
    // Fallback intenzionale: 1 cita l'inizio file quando la definizione non si trova (mai silenzio).
    return index === -1 ? 1 : index + 1;
  } catch {
    return 1;
  }
}

export interface ContractLines {
  readonly pageBuilderPromo: number;
  readonly extractionHover: number;
  readonly extractionParts: number;
  readonly partLines: Readonly<Record<string, number>>;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Righe dei due contratti per il diff nominativo (lette dai file, 1 se illeggibili con fallback documentato). */
export function contractLines(extraction: ExtractionContract): ContractLines {
  const pageBuilderPromo = findLine(absPageBuilderFor(extraction), (line) => /name:\s*["']promo["']/.test(line));
  const extractionHover = findLine(absExtractionFor(extraction), (line) => /\bhover\s*:\s*\{/.test(line));
  const extractionParts = findLine(absExtractionFor(extraction), (line) => /^\s*parts\s*:/.test(line));
  const partLines: Record<string, number> = {};
  try {
    const lines = readFileSync(absExtractionFor(extraction), "utf8").split("\n");
    for (const name of Object.keys(extraction.parts)) {
      const index = lines.findIndex((line) => new RegExp(`^\\s*${escapeRegExp(name)}\\s*:`).test(line));
      if (index !== -1) partLines[name] = index + 1;
    }
  } catch {
    // righe di parte assenti: il diff cita comunque il blocco parts
  }
  return { pageBuilderPromo, extractionHover, extractionParts, partLines };
}

function walkNames(root: SnapshotComponent["cells"][number]["root"], visit: (layer: { name: string; tokens: Record<string, string> }) => void): void {
  visit(root);
  for (const child of root.children) walkNames(child, visit);
}

/** Layer → parte: l'alias del contratto di estrazione, altrimenti il nome. */
function partOfLayer(extraction: ExtractionContract, layerName: string): string | undefined {
  for (const [part, definition] of Object.entries(extraction.parts)) {
    if (definition.layer === layerName) return part;
  }
  // PascalCase senza alias non mappa da solo: un layer ignoto resta ignoto.
  return undefined;
}

/**
 * Diff Penpot → contratti: una riga per differenza, ognuna con file e riga
 * dei contratti coinvolti. Vuoto = conforme.
 */
export function diffPropose(extraction: ExtractionContract, component: SnapshotComponent, lines: ContractLines = contractLines(extraction)): string[] {
  const out: string[] = [];
  const pbRel = pageBuilderRel(extraction);
  const exRel = extractionRel(extraction);
  const containerName = extraction.penpot.container;
  const axes = expectedAxes(extraction);

  if (component.name !== containerName) {
    out.push(
      `container: atteso "${containerName}" (controllo incrociato del plugin data ${extraction.pluginData}, ${exRel}:${lines.extractionParts}), trovato "${component.name}" — rinomina il container in Penpot o riallinea ${exRel}.`,
    );
  }
  if (component.pluginData !== extraction.pluginData) {
    out.push(
      `plugin data: atteso "${extraction.pluginData}" (${exRel}:${lines.extractionParts}), trovato ${component.pluginData === null ? "assente" : `"${component.pluginData}"`} — il plugin data lo scrive solo "library" (pagebuilder/contract sul container).`,
    );
  }

  // Assi e valori: Penpot avanti = valore/asse assente dai contratti.
  for (const axis of axes) {
    const isOption = extraction.contract.axes.some((candidate) => candidate.name === axis.name);
    const file = isOption ? pbRel : exRel;
    const line = isOption ? lines.pageBuilderPromo : lines.extractionHover;
    const found = component.axesValues[axis.name];
    if (found === undefined) {
      if (!component.axes.includes(axis.name)) {
        out.push(`asse "${axis.name}" assente in Penpot (assi [${component.axes.join(", ")}]) — atteso [${axis.values.join(", ")}] da ${file}:${line}.`);
      } else {
        out.push(`asse "${axis.name}" senza valori in Penpot — atteso [${axis.values.join(", ")}] da ${file}:${line}.`);
      }
      continue;
    }
    for (const value of found.filter((candidate) => !axis.values.includes(candidate)).sort()) {
      out.push(
        `asse "${axis.name}": valore "${value}" in Penpot assente dai contratti — aggiungi "${value}" a ${file}:${line} (${isOption ? `asse option del page builder` : `asse di rendering dell'estrazione`}) e valuta il \`when\` delle parti in ${exRel}:${lines.extractionParts}.`,
      );
    }
    for (const value of axis.values.filter((candidate) => !found.includes(candidate)).sort()) {
      out.push(`asse "${axis.name}": valore "${value}" dei contratti (${file}:${line}) assente in Penpot — disegna la cella o rimuovi il valore dal contratto.`);
    }
  }
  for (const axis of component.axes.filter((name) => !axes.some((expected) => expected.name === name)).sort()) {
    const values = component.axesValues[axis] ?? [];
    out.push(
      `asse "${axis}" in Penpot (valori [${values.join(", ")}]) senza voce nei contratti — aggiungi l'asse ${/^[a-z]/.test(axis) ? `in ${exRel}:${lines.extractionHover} (state/behavior) o in ${pbRel}:${lines.pageBuilderPromo} (option)` : `nei contratti`} o rimuovilo in Penpot.`,
    );
  }

  // Parti e layer per cella (solo celle del cartesiano atteso con variantProps;
  // una `variantProps` nulla si salta, ma un suo `variantError` si segnala).
  const expectedByKey = new Map(expectedCells(extraction).map((cell) => [cellKey(cell.variantProps, axes), cell]));
  component.cells.forEach((cell, index) => {
    if (cell.variantError !== null) {
      const label = cell.variantProps === null ? `cella #${index}` : `cella ${cellKey(cell.variantProps, axes.map((axis) => ({ name: axis.name })))}`;
      out.push(`${label}: variantError "${cell.variantError}" in Penpot — risolvi l'errore di variante in Penpot (il contratto non lo copre).`);
    }
  });
  // Celle duplicate: stessa chiave due volte (actualByKey collasserebbe).
  const keyCounts = new Map<string, number>();
  for (const cell of component.cells) {
    if (cell.variantProps === null) continue;
    const k = cellKey(cell.variantProps, axes.map((axis) => ({ name: axis.name })));
    keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...keyCounts.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (n > 1) out.push(`cella ${k}: ${n} celle duplicate in Penpot con gli stessi variantProps — rimuovi i duplicati in Penpot.`);
  }
  for (const cell of component.cells) {
    if (cell.variantProps === null) continue;
    const key = cellKey(cell.variantProps, axes.map((axis) => ({ name: axis.name })));
    for (const extra of Object.keys(cell.variantProps)
      .filter((name) => !axes.some((axis) => axis.name === name))
      .sort()) {
      out.push(`cella ${key}: prop d'asse extra "${extra}"="${cell.variantProps[extra]}" in Penpot senza voce nei contratti — rimuovila in Penpot o aggiungi l'asse nei contratti.`);
    }
    const expected = expectedByKey.get(key);
    if (expected === undefined) continue; // cella fuori cartesiano: già coperta dagli assi
    const actualNames = new Set<string>();
    const actualTokens = new Map<string, Array<Record<string, string>>>();
    const seen: Array<{ name: string; tokens: Record<string, string>; style: unknown; parentLayer: string | null }> = [];
    const visitSeen = (node: { name: string; tokens: Record<string, string>; style: unknown; children: Array<typeof node> }, parentLayer: string | null): void => {
      seen.push({ name: node.name, tokens: node.tokens, style: node.style, parentLayer });
      for (const child of node.children) visitSeen(child, node.name);
    };
    for (const child of cell.root.children) {
      walkNames(child, (layer) => {
        actualNames.add(layer.name);
        actualTokens.set(layer.name, [...(actualTokens.get(layer.name) ?? []), layer.tokens]);
      });
      visitSeen(child as { name: string; tokens: Record<string, string>; style: unknown; children: Array<typeof child> }, null);
    }
    // Layer duplicati: stesso nome due volte nella stessa cella.
    const layerCounts = new Map<string, number>();
    for (const entry of seen) layerCounts.set(entry.name, (layerCounts.get(entry.name) ?? 0) + 1);
    for (const [layer, count] of [...layerCounts.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (count > 1) out.push(`cella ${key}, layer "${layer}": ${count} layer duplicati in Penpot — rimuovi i duplicati in Penpot.`);
    }
    const expectedLayers = new Map<string, string>();
    for (const [part, definition] of Object.entries(extraction.parts)) {
      if (part === "root") continue;
      if (!partInCell(extraction, part, expected.variantProps)) continue;
      expectedLayers.set(definition.layer, part);
    }
    for (const [layer, part] of [...expectedLayers.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (!actualNames.has(layer)) {
        out.push(
          `cella ${key}, parte "${part}" (layer "${layer}", ${exRel}:${lines.partLines[part] ?? lines.extractionParts}): assente in Penpot — disegna il layer o rimuovi la parte dal contratto di estrazione (il \`when\` governa la presenza, mai l'assenza come errore in library).`,
        );
      }
    }
    for (const layer of [...actualNames].sort().filter((candidate) => !expectedLayers.has(candidate))) {
      const guessed = partOfLayer(extraction, layer);
      if (guessed !== undefined) {
        // Layer di una parte esistente ma fuori `when` (es. Badge in promo=none;
        // Badge/Label eredita il `when` del genitore Badge).
        const when = extraction.parts[guessed]!.when;
        if (when !== undefined) {
          out.push(
            `cella ${key}, layer "${layer}" (parte "${guessed}", ${exRel}:${lines.partLines[guessed] ?? lines.extractionParts}): presente in Penpot ma il contratto la ammette solo con ${JSON.stringify(when)} — togli il layer in Penpot o allarga il \`when\` nel contratto di estrazione.`,
          );
        } else {
          out.push(
            `cella ${key}, layer "${layer}" (parte "${guessed}", ${exRel}:${lines.partLines[guessed] ?? lines.extractionParts}): presente in Penpot ma non attesa in questa cella (il genitore è fuori \`when\`) — togli il layer in Penpot o riallinea il \`when\` nel contratto di estrazione.`,
          );
        }
      } else {
        out.push(
          `cella ${key}, layer "${layer}" in Penpot senza voce nei contratti — aggiungi la parte in ${exRel}:${lines.extractionParts} (ruolo, parent, layer) e, se rende un field, il field in ${pbRel}:${lines.pageBuilderPromo}.`,
        );
      }
    }
    // Parentela: genitore reale contro `parent` del contratto (nomi di parte).
    const partByLayer = new Map<string, string>();
    for (const [part, definition] of Object.entries(extraction.parts)) {
      if (part === "root") continue;
      if (!partInCell(extraction, part, expected.variantProps)) continue;
      partByLayer.set(definition.layer, part);
    }
    for (const occurrence of seen) {
      const part = partByLayer.get(occurrence.name);
      if (part === undefined) continue;
      const expectedParent = extraction.parts[part]!.parent ?? null;
      const expectedParentLayer = expectedParent === null || expectedParent === "root" ? null : extraction.parts[expectedParent]!.layer;
      if (occurrence.parentLayer !== expectedParentLayer) {
        out.push(
          `cella ${key}, parte "${part}" (layer "${occurrence.name}", ${exRel}:${lines.partLines[part] ?? lines.extractionParts}): genitore atteso ${expectedParentLayer === null ? `"root" (la board)` : `"${expectedParent}" (layer "${expectedParentLayer}")`}, trovato ${occurrence.parentLayer === null ? `"root" (la board)` : `(layer "${occurrence.parentLayer}")`} — riallinea la parentela in Penpot o il contratto di estrazione.`,
        );
      }
    }
    // Stili senza binding: ogni proprietà di `style` vuole un binding in tokens.
    const styleHolders: Array<{ label: string; tokens: Record<string, string>; style: unknown }> = [
      { label: `layer "${cell.root.name}" (parte "root")`, tokens: cell.root.tokens, style: (cell.root as { style?: unknown }).style ?? {} },
      ...seen.map((entry) => ({ label: `layer "${entry.name}"`, tokens: entry.tokens, style: entry.style })),
    ];
    for (const holder of styleHolders) {
      if (holder.style === null || typeof holder.style !== "object" || Array.isArray(holder.style)) continue;
      for (const property of Object.keys(holder.style as Record<string, unknown>).sort()) {
        if (holder.tokens[property] === undefined) {
          out.push(`cella ${key}, ${holder.label}: stile "${property}" valorizzato senza binding — lega il token in Penpot o rimuovi lo stile.`);
        }
      }
    }
    // Ruoli: token su proprietà che il ruolo della parte non ammette.
    for (const [layer, part] of expectedLayers) {
      const role = extraction.parts[part]!.role as PartRole;
      for (const tokens of actualTokens.get(layer) ?? []) {
        for (const property of Object.keys(tokens).sort()) {
          if (!roleAdmits(role, property)) {
            out.push(
              `cella ${key}, parte "${part}" (ruolo "${role}", ${exRel}:${lines.partLines[part] ?? lines.extractionParts}): token "${tokens[property]}" su "${property}" fuori ruolo — adattamenti in ordine: designer, poi registro, poi ruolo nel contratto di estrazione.`,
            );
          }
        }
      }
    }
    // Token: i valori reali contro i token attesi delle parti (dal piano library).
    const expectedTokens = new Map(partsForCell(extraction, expected.variantProps).map((part) => [part.name, part.tokens]));
    const expectedRootTokens = expectedTokens.get("root") ?? {};
    if (!sameTokens(expectedRootTokens, cell.root.tokens)) {
      out.push(
        `cella ${key}, parte "root" (${exRel}:${lines.partLines["root"] ?? lines.extractionParts}): token attesi ${JSON.stringify(expectedRootTokens)}, trovati ${JSON.stringify(cell.root.tokens)} — riallinea i token in Penpot o il piano della library.`,
      );
    }
    for (const [layer, part] of expectedLayers) {
      const expectedPartTokens = expectedTokens.get(part) ?? {};
      const actualList = actualTokens.get(layer) ?? [];
      if (actualList.length === 0) continue; // layer assente: già segnalato sopra
      if (!actualList.some((tokens) => sameTokens(tokens, expectedPartTokens))) {
        out.push(
          `cella ${key}, parte "${part}" (layer "${layer}", ${exRel}:${lines.partLines[part] ?? lines.extractionParts}): token attesi ${JSON.stringify(expectedPartTokens)}, trovati ${JSON.stringify(actualList[0])} — riallinea i token in Penpot o il piano della library.`,
        );
      }
    }
  }
  return out;
}
