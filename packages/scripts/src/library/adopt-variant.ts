import { createHash } from "node:crypto";
import { renameSync, rmSync, writeFileSync } from "node:fs";

import {
  COMPONENT_CONTRACTS,
  contractId,
  defineContract,
  fingerprintPayload,
  SECTION_DEFINITIONS,
  type Axis,
  type ComponentContract,
  type SectionDefinition,
} from "@app/contracts";
import ts from "typescript";

import { BindingSchema, type ComponentBinding } from "../emitter/binding-shadcn";
import { influencingAxes } from "../emitter/axis-influence";
import { partBindings } from "../recipe-schema";
import { propertyDefinition } from "../style-properties";
import { cartesian, type ComponentDesign } from "./library-plan";
import type { LibrarySnapshot, SnapshotCell, SnapshotLayer } from "./library-snapshot";

/**
 * `adopt:variant` (Story 2.7 parte C): adozione di un valore d'asse nato in
 * Penpot. Per la regola A è un cambio COMPATIBILE: si alza solo
 * `SCHEMA_VERSION` (+ voce del fingerprint), mai `contract.version` né il
 * plugin data. I cinque file derivati (contratto, `SCHEMA_VERSION`,
 * fingerprint, binding, design) si calcolano e si validano TUTTI in memoria;
 * solo un piano `adopt` completo arriva a `writeAdoption`.
 *
 * `planAdoption` è una FUNZIONE PURA (nessun I/O): riceve i sorgenti come
 * testo e restituisce i contenuti nuovi. Non tocca Penpot, giudizio, ricetta
 * né fixture (poi girano `extract:component` e `render:component`), e non
 * rimuove valori mancanti in Penpot (è l'altro senso, `addCell`).
 */

/** Un file sorgente letto dal CLI: percorso (per i messaggi e la scrittura) e testo. */
export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

export interface AdoptionSources {
  /** `packages/contracts/src/components/<nome>.ts`. */
  readonly contract: SourceFile;
  /** `packages/contracts/src/schema-version.ts`. */
  readonly schemaVersion: SourceFile;
  /** `packages/contracts/tests/contracts.fingerprint.json` (append-only). */
  readonly fingerprint: SourceFile;
  /** `packages/scripts/src/emitter/bindings/<nome>.binding.json`. */
  readonly binding: SourceFile;
  /** `packages/scripts/src/library/designs/<nome>.design.json`. */
  readonly design: SourceFile;
}

/** Contratti e sezioni su cui si calcola il fingerprint (default: il registry). */
export interface AdoptionRegistry {
  readonly components: readonly ComponentContract[];
  readonly sections: readonly SectionDefinition[];
}

export interface AdoptionFile {
  readonly label: "contratto" | "SCHEMA_VERSION" | "fingerprint" | "binding" | "design";
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

export type AdoptionPlan =
  | { readonly kind: "nothing"; readonly message: string }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "adopt";
      readonly contract: string;
      readonly containerName: string;
      /** Valori adottati per asse, nell'ordine in cui Penpot li elenca. */
      readonly added: ReadonlyArray<{ readonly axis: string; readonly values: readonly string[] }>;
      readonly schemaVersion: { readonly from: number; readonly to: number };
      readonly hash: string;
      /** Il contratto in memoria con i valori aggiunti (default invariato). */
      readonly adopted: ComponentContract;
      /** Celle aggiunte al design, in ordine di prodotto cartesiano. */
      readonly cells: readonly string[];
      readonly files: readonly AdoptionFile[];
    };

/** Stesso formato dei valori ammessi per un asse adottabile. */
export const ADOPTABLE_VALUE = /^[a-z][a-z0-9-]*$/;

const DEFAULT_REGISTRY: AdoptionRegistry = {
  components: Object.values(COMPONENT_CONTRACTS),
  sections: Object.values(SECTION_DEFINITIONS),
};

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function keyOf(axes: readonly Axis[], variantProps: Readonly<Record<string, string>>): string | null {
  const parts: string[] = [];
  for (const axis of axes) {
    const value = variantProps[axis.name];
    if (value === undefined) return null;
    parts.push(`${axis.name}=${value}`);
  }
  return parts.join("|");
}

function walkLayers(root: SnapshotLayer, visit: (layer: SnapshotLayer) => void): void {
  visit(root);
  for (const child of root.children) walkLayers(child, visit);
}

// ---------------------------------------------------------------------------
// Sorgente del contratto: modifica e rilettura via AST TypeScript.
// ---------------------------------------------------------------------------

function propertyNamed(object: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  return object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name,
  );
}

function stringOf(node: ts.Expression | undefined): string | undefined {
  return node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

/**
 * Trova l'UNICA chiamata `defineContract({ name: "<contratto>", axes: [...] })`
 * del sorgente e restituisce, per asse, l'array letterale `values`.
 * Qualunque forma diversa (valori calcolati, spread, due chiamate) è un errore
 * nominativo: il comando non indovina dove scrivere.
 */
function contractAxesArrays(
  text: string,
  path: string,
  contractName: string,
): { arrays: Map<string, ts.ArrayLiteralExpression>; source: ts.SourceFile } {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const calls: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineContract" &&
      node.arguments[0] !== undefined &&
      ts.isObjectLiteralExpression(node.arguments[0]) &&
      stringOf(propertyNamed(node.arguments[0], "name")?.initializer) === contractName
    ) {
      calls.push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (calls.length !== 1) {
    throw new Error(
      `Contratto "${contractName}": in ${path} attesa UNA chiamata defineContract({ name: "${contractName}", … }), trovate ${calls.length}.`,
    );
  }
  const axes = propertyNamed(calls[0]!, "axes")?.initializer;
  if (axes === undefined || !ts.isArrayLiteralExpression(axes)) {
    throw new Error(`Contratto "${contractName}": in ${path} "axes" non è un array letterale.`);
  }
  const arrays = new Map<string, ts.ArrayLiteralExpression>();
  for (const element of axes.elements) {
    if (!ts.isObjectLiteralExpression(element)) {
      throw new Error(`Contratto "${contractName}": in ${path} un elemento di "axes" non è un oggetto letterale.`);
    }
    const name = stringOf(propertyNamed(element, "name")?.initializer);
    const values = propertyNamed(element, "values")?.initializer;
    if (name === undefined) throw new Error(`Contratto "${contractName}": in ${path} un asse non ha "name" letterale.`);
    if (values === undefined || !ts.isArrayLiteralExpression(values)) {
      throw new Error(`Contratto "${contractName}", asse "${name}": in ${path} "values" non è un array letterale.`);
    }
    arrays.set(name, values);
  }
  return { arrays, source };
}

/** Valori letterali per asse, letti dal sorgente: è la rilettura dopo la modifica. */
export function readContractAxes(text: string, path: string, contractName: string): Record<string, string[]> {
  const { arrays } = contractAxesArrays(text, path, contractName);
  const out: Record<string, string[]> = {};
  for (const [axis, array] of arrays) {
    out[axis] = array.elements.map((element) => {
      const value = stringOf(element);
      if (value === undefined) {
        throw new Error(`Contratto "${contractName}", asse "${axis}": in ${path} un valore non è una stringa letterale.`);
      }
      return value;
    });
  }
  return out;
}

/** Aggiunge in coda all'array `values` di ogni asse i valori adottati, rispettando le virgolette esistenti. */
export function addValuesToContractSource(
  text: string,
  path: string,
  contractName: string,
  additions: ReadonlyArray<{ readonly axis: string; readonly values: readonly string[] }>,
): string {
  const { arrays, source } = contractAxesArrays(text, path, contractName);
  const edits: Array<{ at: number; insert: string }> = [];
  for (const { axis, values } of additions) {
    const array = arrays.get(axis);
    if (array === undefined) throw new Error(`Contratto "${contractName}": in ${path} manca l'asse "${axis}".`);
    const last = array.elements[array.elements.length - 1];
    if (last === undefined) throw new Error(`Contratto "${contractName}", asse "${axis}": in ${path} "values" è vuoto.`);
    const quote = last.getText(source).startsWith("'") ? "'" : '"';
    edits.push({ at: last.getEnd(), insert: values.map((value) => `, ${quote}${value}${quote}`).join("") });
  }
  let out = text;
  for (const edit of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, edit.at) + edit.insert + out.slice(edit.at);
  return out;
}

/**
 * Cella di design dai binding Penpot, con parti e proprietà nell'ordine della
 * prima cella del design (le chiavi nuove in coda): solo leggibilità del diff,
 * i valori sono quelli di Penpot.
 */
function orderLikeDesign(
  design: ComponentDesign,
  bindings: ReadonlyMap<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  const reference = Object.values(design.cells)[0] ?? {};
  const rank = (order: readonly string[], key: string): number => {
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };
  const partOrder = Object.keys(reference);
  const parts = [...bindings.keys()].sort((a, b) => rank(partOrder, a) - rank(partOrder, b));
  return Object.fromEntries(
    parts.map((part) => {
      const tokens = bindings.get(part)!;
      const propertyOrder = Object.keys(reference[part] ?? {});
      const properties = Object.keys(tokens).sort((a, b) => rank(propertyOrder, a) - rank(propertyOrder, b));
      return [part, Object.fromEntries(properties.map((property) => [property, tokens[property]!]))];
    }),
  );
}

const SCHEMA_VERSION_DECLARATION = /export const SCHEMA_VERSION = ([1-9]\d*);/g;

// ---------------------------------------------------------------------------
// Il piano.
// ---------------------------------------------------------------------------

export function planAdoption(
  contract: ComponentContract,
  snapshot: LibrarySnapshot,
  design: ComponentDesign,
  binding: ComponentBinding,
  sources: AdoptionSources,
  registry: AdoptionRegistry = DEFAULT_REGISTRY,
): AdoptionPlan {
  const name = contract.name;
  const error = (message: string): AdoptionPlan => ({ kind: "error", message });
  const expectedId = contractId(contract);

  // --- Container dichiarante ------------------------------------------------
  const declaring = snapshot.components.filter((component) => (component.pluginData ?? "").split("@")[0] === name);
  if (declaring.length === 0) {
    return error(`Contratto "${name}": nessun VariantContainer lo dichiara via plugin data pagebuilder/contract — niente da adottare.`);
  }
  if (declaring.length > 1) {
    return error(
      `Contratto "${name}": ${declaring.length} container lo dichiarano (${declaring.map((c) => `"${c.name}"`).join(", ")}) — un solo container per contratto; adopt:variant non sceglie da quale adottare.`,
    );
  }
  const container = declaring[0]!;
  if (container.pluginData !== expectedId) {
    return error(
      `Contratto "${name}": il container "${container.name}" ha plugin data "${container.pluginData}", atteso "${expectedId}" — adopt:variant non tocca contract.version né il plugin data (per un cambio incompatibile: bump:contract).`,
    );
  }
  const expectedAxes = contract.axes.map((axis) => axis.name);
  if (container.axes.length !== expectedAxes.length || container.axes.some((axis, index) => axis !== expectedAxes[index])) {
    return error(
      `Contratto "${name}": il container "${container.name}" ha proprietà di variante [${container.axes.join(", ")}] ≠ assi del contratto [${expectedAxes.join(", ")}] — assi e ordine si allineano in Penpot, non si adottano.`,
    );
  }

  // --- Valori in più (stesso criterio della regola 4 di verify:library) -----
  const added: Array<{ axis: string; values: string[] }> = [];
  for (const axis of contract.axes) {
    const found = container.axesValues[axis.name];
    if (found === undefined) {
      return error(`Contratto "${name}": il container "${container.name}" non ha i valori della proprietà d'asse "${axis.name}" (currentValues assente).`);
    }
    const extra = found.filter((value) => !axis.values.includes(value));
    if (extra.length > 0) added.push({ axis: axis.name, values: [...new Set(extra)] });
  }
  if (added.length === 0) {
    return {
      kind: "nothing",
      message: `Contratto "${name}": il container "${container.name}" non ha valori d'asse in più rispetto al contratto — nulla da adottare.`,
    };
  }

  const errors: string[] = [];
  for (const { axis, values } of added) {
    const type = contract.axes.find((candidate) => candidate.name === axis)!.type;
    if (type !== "option") {
      errors.push(
        `Contratto "${name}", asse "${axis}" (${type}): valori in più [${values.join(", ")}] non adottabili — un asse ${type} non ha un mapping 1:1 con una prop (è ${type === "state" ? "uno stato del browser" : "uno stato dell'headless"}): va deciso a mano.`,
      );
      continue;
    }
    for (const value of values) {
      if (!ADOPTABLE_VALUE.test(value)) {
        errors.push(
          `Contratto "${name}", asse "${axis}": il valore "${value}" non è valido — atteso ${String(ADOPTABLE_VALUE)} (rinominalo in Penpot).`,
        );
      }
    }
  }
  if (errors.length > 0) return error(errors.join("\n"));

  // --- Contratto in memoria (valori in coda, default invariato) -------------
  const adoptedAxes: Axis[] = contract.axes.map((axis) => {
    const addition = added.find((entry) => entry.axis === axis.name);
    return addition ? { ...axis, values: [...axis.values, ...addition.values] as unknown as Axis["values"] } : axis;
  });
  let adopted: ComponentContract;
  try {
    adopted = defineContract({ ...contract, axes: adoptedAxes });
  } catch (cause) {
    return error(`Contratto "${name}": il contratto con i valori adottati non è valido — ${(cause as Error).message}`);
  }

  // --- Celle in Penpot -------------------------------------------------------
  const cellsByKey = new Map<string, SnapshotCell[]>();
  for (const cell of container.cells) {
    if (cell.variantProps === null) continue;
    const key = keyOf(adopted.axes, cell.variantProps);
    if (key === null) continue;
    cellsByKey.set(key, [...(cellsByKey.get(key) ?? []), cell]);
  }
  const isNew = (props: Record<string, string>): boolean =>
    added.some(({ axis, values }) => values.includes(props[axis] ?? ""));
  const propsOf = (axes: readonly Axis[], values: readonly string[]): Record<string, string> =>
    Object.fromEntries(axes.map((axis, index) => [axis.name, values[index]!]));
  const newKeys = cartesian(adopted.axes)
    .map((values) => propsOf(adopted.axes, values))
    .filter(isNew)
    .map((props) => keyOf(adopted.axes, props)!);

  const defaultKey = keyOf(adopted.axes, Object.fromEntries(adopted.axes.map((axis) => [axis.name, axis.default])))!;
  const defaultCells = cellsByKey.get(defaultKey) ?? [];
  // La cella default deve esistere ed essere unica: è il riferimento da cui
  // `adopt-cli` copia le celle nuove, e il punto di confronto per le
  // proprietà che una variante può omettere (rimozione per variante, Story
  // 2.8 parte C). Senza di essa (o con più di una) non si adotta in silenzio.
  if (defaultCells.length === 0) {
    errors.push(`Contratto "${name}": manca in Penpot la cella default "${defaultKey}" — il confronto con il default non è affidabile.`);
  } else if (defaultCells.length > 1) {
    errors.push(`Contratto "${name}": la cella default "${defaultKey}" compare ${defaultCells.length} volte in Penpot — il confronto con il default non è affidabile.`);
  }
  const defaultBindings = defaultCells.length === 1 ? partBindings(defaultCells[0]!.root).bindings : new Map<string, Record<string, string>>();

  const newCells = new Map<string, Record<string, Record<string, string>>>();
  for (const key of newKeys) {
    const found = cellsByKey.get(key) ?? [];
    if (found.length === 0) {
      errors.push(`Contratto "${name}": manca in Penpot la cella "${key}" — la variante adottata deve coprire il prodotto cartesiano completo.`);
      continue;
    }
    if (found.length > 1) {
      errors.push(`Contratto "${name}": la cella "${key}" compare ${found.length} volte in Penpot — duplicato.`);
      continue;
    }
    const cell = found[0]!;
    if (cell.variantError !== null) {
      errors.push(`Contratto "${name}", cella "${key}": variantError "${String(cell.variantError)}" — la matrice varianti è incoerente.`);
      continue;
    }
    // Literal: stesso criterio della regola 7 (proprietà di stile senza binding).
    let literal = false;
    walkLayers(cell.root, (layer) => {
      for (const property of Object.keys(layer.style)) {
        if (!layer.tokens[property]) {
          literal = true;
          errors.push(
            `Contratto "${name}", cella "${key}", layer "${layer.name}": la proprietà di stile "${property}" è valorizzata ma non ha binding a un token — un literal non è adottabile.`,
          );
        }
      }
    });
    if (literal) continue;
    // Parti del contratto: ogni parte (tranne root, che è la board) ha un layer.
    const layerNames = new Set<string>();
    walkLayers(cell.root, (layer) => layerNames.add(layer.name));
    for (const part of adopted.parts) {
      if (part !== "root" && !layerNames.has(part)) {
        errors.push(`Contratto "${name}", cella "${key}": manca la parte "${part}" (nessun layer con questo nome).`);
      }
    }
    const { bindings, duplicates } = partBindings(cell.root);
    // Una proprietà presente nella cella default e assente da una cella di un
    // asse option non default è esprimibile SOLO se la riga del registro
    // dichiara una classe di rimozione (Story 2.8 parte C): la variante
    // emette quella classe, la classe del default resta nella base cva. Per
    // le proprietà senza rimozione mappata (fontWeight, shadow, padding…)
    // l'emitter non sa rimuovere nulla: l'adopt le rifiuta, altrimenti i
    // cinque file si scrivono e poi `render:component` fallisce. Adopt e
    // emitter dicono la stessa cosa.
    for (const [part, tokens] of defaultBindings) {
      for (const property of Object.keys(tokens)) {
        if (bindings.get(part)?.[property] !== undefined) continue;
        const definition = propertyDefinition(property);
        const removal = definition?.emitter;
        if (
          definition === undefined ||
          removal?.emit !== "utility" ||
          removal.removalClass === undefined
        ) {
          errors.push(
            `Contratto "${name}", cella "${key}", parte "${part}": manca la proprietà "${property}" presente nella cella default "${defaultKey}" — la classe di rimozione non è mappata nel registro: l'emitter non può esprimere la rimozione.`,
          );
        }
      }
    }
    for (const part of duplicates) {
      errors.push(`Contratto "${name}", cella "${key}": più layer con binding si chiamano "${part}" — parte ambigua.`);
    }
    for (const part of bindings.keys()) {
      if (!adopted.parts.includes(part)) {
        errors.push(
          `Contratto "${name}", cella "${key}", layer "${part}": ha binding a token ma non è una parte del contratto [${adopted.parts.join(", ")}].`,
        );
      } else if (design.parts[part] === undefined) {
        errors.push(`Contratto "${name}", cella "${key}": la parte "${part}" non è nel design (parts).`);
      }
    }
    if (duplicates.length === 0) newCells.set(key, orderLikeDesign(design, bindings));
  }
  if (errors.length > 0) return error(errors.join("\n"));

  // --- Espressività: ogni proprietà di ogni parte varia con un solo asse ----
  const partCells = new Map<string, Record<string, Record<string, string>>>();
  for (const [key, cells] of cellsByKey) {
    if (cells.length !== 1 || cells[0]!.variantError !== null) continue;
    for (const [part, tokens] of partBindings(cells[0]!.root).bindings) {
      partCells.set(part, { ...(partCells.get(part) ?? {}), [key]: tokens });
    }
  }
  for (const [part, cells] of partCells) {
    const properties = [...new Set(Object.values(cells).flatMap((cell) => Object.keys(cell)))].sort();
    for (const property of properties) {
      const influencing = influencingAxes(adopted.axes, cells, property);
      if (influencing.length > 1) {
        errors.push(
          `Contratto "${name}": dopo l'adozione la proprietà "${property}" della parte "${part}" varia con più assi (${influencing.join(", ")}) — interazione non esprimibile in cva: allinea le celle in Penpot.`,
        );
      }
    }
  }
  if (errors.length > 0) return error(errors.join("\n"));

  // --- Binding ---------------------------------------------------------------
  if (binding.contract !== expectedId) {
    return error(`Contratto "${name}": il binding ${sources.binding.path} dichiara "${binding.contract}", atteso "${expectedId}".`);
  }
  let rawBinding: { axes?: Record<string, { type?: string; values?: Record<string, string> }> };
  try {
    rawBinding = JSON.parse(sources.binding.text) as typeof rawBinding;
  } catch (cause) {
    return error(`Il binding ${sources.binding.path} non è JSON leggibile: ${(cause as Error).message}`);
  }
  for (const { axis, values } of added) {
    const bound = rawBinding.axes?.[axis];
    if (bound === undefined || bound.values === undefined || bound.type !== "option") {
      errors.push(`Contratto "${name}", asse "${axis}": il binding ${sources.binding.path} non ha l'asse option "${axis}" con i suoi valori.`);
      continue;
    }
    for (const value of values) {
      if (Object.hasOwn(bound.values, value)) {
        errors.push(`Contratto "${name}", asse "${axis}": il binding ha già il valore "${value}" — non si riscrive una voce esistente.`);
      } else {
        bound.values[value] = value;
      }
    }
  }
  const bindingAfter = `${JSON.stringify(rawBinding, null, 2)}\n`;
  const parsedBinding = BindingSchema.safeParse(JSON.parse(bindingAfter));
  if (!parsedBinding.success) {
    errors.push(`Il binding generato non passa BindingSchema: ${parsedBinding.error.issues.map((issue) => issue.message).join("; ")}`);
  } else {
    for (const axis of adopted.axes) {
      const bound = parsedBinding.data.axes[axis.name];
      const boundValues = Object.keys(bound?.values ?? {});
      const mismatch = axis.values.some((value) => !boundValues.includes(value)) || boundValues.some((value) => !axis.values.includes(value));
      if (mismatch) {
        errors.push(`Contratto "${name}", asse "${axis.name}": valori del binding [${boundValues.join(", ")}] ≠ valori del contratto [${axis.values.join(", ")}].`);
      }
    }
  }

  // --- Design ----------------------------------------------------------------
  let rawDesign: { cells?: Record<string, unknown> };
  try {
    rawDesign = JSON.parse(sources.design.text) as typeof rawDesign;
  } catch (cause) {
    return error(`Il design ${sources.design.path} non è JSON leggibile: ${(cause as Error).message}`);
  }
  if (rawDesign.cells === undefined || typeof rawDesign.cells !== "object") {
    return error(`Il design ${sources.design.path} non ha "cells".`);
  }
  for (const [key, cell] of newCells) {
    if (key in rawDesign.cells || key in design.cells) {
      errors.push(`Contratto "${name}": il design ha già la cella "${key}" — non si riscrive una voce esistente.`);
    } else {
      rawDesign.cells[key] = cell;
    }
  }
  const designAfter = `${JSON.stringify(rawDesign, null, 2)}\n`;
  if (errors.length > 0) return error(errors.join("\n"));

  // --- SCHEMA_VERSION + fingerprint -------------------------------------------
  const matches = [...sources.schemaVersion.text.matchAll(SCHEMA_VERSION_DECLARATION)];
  if (matches.length !== 1) {
    return error(
      `${sources.schemaVersion.path}: attesa UNA dichiarazione "export const SCHEMA_VERSION = <intero>;", trovate ${matches.length}.`,
    );
  }
  const from = Number(matches[0]![1]);
  const to = from + 1;
  const schemaVersionAfter = sources.schemaVersion.text.replace(SCHEMA_VERSION_DECLARATION, `export const SCHEMA_VERSION = ${to};`);

  let recorded: Record<string, unknown>;
  try {
    recorded = JSON.parse(sources.fingerprint.text) as Record<string, unknown>;
  } catch (cause) {
    return error(`Il fingerprint ${sources.fingerprint.path} non è JSON leggibile: ${(cause as Error).message}`);
  }
  if (typeof recorded[String(from)] !== "string") {
    return error(`${sources.fingerprint.path}: manca la voce "${from}" della SCHEMA_VERSION corrente — sistema il fingerprint prima di adottare.`);
  }
  if (Object.keys(recorded).some((key) => Number(key) > from)) {
    return error(`${sources.fingerprint.path}: ha voci oltre la SCHEMA_VERSION corrente ${from} — non si riscrive una voce esistente.`);
  }
  const components = registry.components;
  if (!components.some((candidate) => candidate.name === name)) {
    return error(`Contratto "${name}": assente dal registry su cui si calcola il fingerprint.`);
  }
  const currentHash = sha256(fingerprintPayload(components, registry.sections));
  if (currentHash !== recorded[String(from)]) {
    return error(
      `${sources.fingerprint.path}: l'hash dei contratti attuali (${currentHash}) ≠ voce "${from}" — contratti già cambiati senza bump: sistemali prima di adottare.`,
    );
  }
  const hash = sha256(
    fingerprintPayload(
      components.map((candidate) => (candidate.name === name ? adopted : candidate)),
      registry.sections,
    ),
  );
  const fingerprintAfter = `${JSON.stringify({ ...recorded, [String(to)]: hash }, null, 2)}\n`;

  // --- Sorgente del contratto (AST) + rilettura ------------------------------
  let contractAfter: string;
  try {
    contractAfter = addValuesToContractSource(sources.contract.text, sources.contract.path, name, added);
    const reread = readContractAxes(contractAfter, sources.contract.path, name);
    for (const axis of adopted.axes) {
      const values = reread[axis.name] ?? [];
      if (values.join(" ") !== axis.values.join(" ")) {
        throw new Error(
          `Contratto "${name}", asse "${axis.name}": il sorgente riletto ha [${values.join(", ")}], atteso [${axis.values.join(", ")}].`,
        );
      }
    }
  } catch (cause) {
    return error((cause as Error).message);
  }

  return {
    kind: "adopt",
    contract: name,
    containerName: container.name,
    added,
    schemaVersion: { from, to },
    hash,
    adopted,
    cells: [...newCells.keys()],
    files: [
      { label: "contratto", path: sources.contract.path, before: sources.contract.text, after: contractAfter },
      { label: "SCHEMA_VERSION", path: sources.schemaVersion.path, before: sources.schemaVersion.text, after: schemaVersionAfter },
      { label: "fingerprint", path: sources.fingerprint.path, before: sources.fingerprint.text, after: fingerprintAfter },
      { label: "binding", path: sources.binding.path, before: sources.binding.text, after: bindingAfter },
      { label: "design", path: sources.design.path, before: sources.design.text, after: designAfter },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scrittura: prima tutti i tmp, poi i rename (atomico per file).
// ---------------------------------------------------------------------------

export interface WriteIo {
  writeFileSync: (path: string, content: string) => void;
  renameSync: (from: string, to: string) => void;
  rmSync: (path: string) => void;
}

const DEFAULT_IO: WriteIo = {
  writeFileSync: (path, content) => writeFileSync(path, content, "utf8"),
  renameSync,
  rmSync: (path) => rmSync(path, { force: true }),
};

/**
 * Consuma un piano già calcolato: scrive ogni contenuto in un file temporaneo
 * accanto al destinatario e solo quando TUTTI i tmp sono scritti li rinomina.
 * Se un tmp fallisce, i tmp già scritti si rimuovono e nessun destinatario è
 * toccato.
 */
export function writeAdoption(files: readonly AdoptionFile[], io: WriteIo = DEFAULT_IO): void {
  const pending = files.map((file) => ({ file, tmp: `${file.path}.adopt-${process.pid}.tmp` }));
  const written: string[] = [];
  try {
    for (const { file, tmp } of pending) {
      io.writeFileSync(tmp, file.after);
      written.push(tmp);
    }
  } catch (cause) {
    for (const tmp of written) {
      try {
        io.rmSync(tmp);
      } catch {
        // La pulizia non è indispensabile: vince l'errore originale.
      }
    }
    throw new Error(`Scrittura interrotta prima di toccare i file: ${(cause as Error).message}`);
  }
  const replaced: string[] = [];
  for (const [index, { file, tmp }] of pending.entries()) {
    try {
      io.renameSync(tmp, file.path);
    } catch (cause) {
      for (const rest of pending.slice(index)) {
        try {
          io.rmSync(rest.tmp);
        } catch {
          // La pulizia non è indispensabile: vince l'errore originale.
        }
      }
      const unchanged = pending.slice(index).map((entry) => entry.file.path);
      throw new Error(
        `Scrittura interrotta a metà: ${(cause as Error).message}. File già sostituiti: [${replaced.join(", ")}]; file invariati: [${unchanged.join(", ")}] — ripristina i sostituiti con git (git checkout -- <file>) e rilancia.`,
      );
    }
    replaced.push(file.path);
  }
}
