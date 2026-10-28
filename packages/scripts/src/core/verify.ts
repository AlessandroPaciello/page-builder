import { COMPONENT_CONTRACTS, type ComponentContract } from "@app/contracts";

import { GEOMETRY_ENTRIES, rootSizeClasses, type Scale } from "./geometry";
import { byString, variantLabel, withInvalidAnswer } from "./internal";
import { camelCase, kebabOf, pascalCase, PART_KEY, wordsOf } from "./naming";
import { layerClasses, type TokenTypeOf } from "./registry";
import type { Cella, Finding, Instance, LetturaLayer, PluginData } from "./schemas";

/**
 * Verifica di un componente intero (Story 2.22): contratto, assi e stati
 * delle celle, chiavi di parte, istanze annidate, classi dei layer. Tutto è
 * guidato dal contratto in `@app/contracts`: nessun codice per componente.
 *
 * `analyzeComponent` costruisce il modello che il generatore usa
 * (`generate.ts`); `verifyComponent` ne restituisce solo i `Finding`.
 */

export type ContractRegistry = Readonly<Record<string, ComponentContract>>;

export interface CoreInput {
  readonly tokenTypeOf: TokenTypeOf;
  /** La scala del tema (`scaleFromThemeCss`). */
  readonly scale: Scale;
  /** I contratti; di default `COMPONENT_CONTRACTS`. I test ne passano di scritti a mano. */
  readonly contracts?: ContractRegistry;
  /** Il `<Comp>.tsx` dello sviluppatore, se esiste: senza, serve lo scaffold e le sue domande. */
  readonly existingTsx?: string;
}

/** Asse riservato degli stati: mai una prop, solo celle di stato. */
export const STATE_AXIS = "state";

/** L'unico asse a cui uno stato si generalizza (convenzione sul nome): le taglie. */
export const SIZE_AXIS = "size";

export const STATE_VALUES = ["default", "hover", "active", "focus", "disabled"] as const;

export type InteractiveState = Exclude<(typeof STATE_VALUES)[number], "default">;

/** Prefisso Tailwind di ogni stato; `disabled` ricalca il default di `globals.css`. */
export const STATE_PREFIXES: Readonly<Record<InteractiveState, string>> = {
  hover: "hover:",
  active: "active:",
  focus: "focus-visible:",
  disabled: "[&:is(:disabled,[data-disabled],[aria-disabled=true])]:",
};

const INTERACTIVE_STATES = Object.keys(STATE_PREFIXES) as InteractiveState[];

/** Chiavi di plugin data scritte da `pds-code`. */
export const PART_KEY_NAME = "part";
export const REPEAT_KEY = "repeat";
export const ELEMENT_KEY = "element";
export const IGNORE_ANSWER = "ignora";
export const REPEAT_ANSWERS = ["lista", "parte-nuova"] as const;
export const TITLE_ELEMENTS = ["h2", "h3", "p"] as const;
export const ROOT_KEY = "root";

/** Override che non sono override: dimensionamento e geometria dell'istanza (bug 12). */
export const PLACEMENT_PROPERTIES: readonly string[] = ["sizingH", "sizingV", ...Object.keys(GEOMETRY_ENTRIES)];

/** Una cella normalizzata: tutti gli assi `option` (default dove manca) e lo stato. */
export interface ModelCell {
  readonly index: number;
  readonly axes: Readonly<Record<string, string>>;
  readonly state: (typeof STATE_VALUES)[number];
  readonly label: string;
}

export interface ModelInstance {
  /** Nome kebab del contratto annidato. */
  readonly name: string;
  readonly contract: ComponentContract;
}

export interface ModelPart {
  readonly key: string;
  /** La chiave del genitore; assente per la radice. */
  readonly parent: string | undefined;
  readonly layerName: string;
  readonly layerKind: string;
  /** Le chiavi dei figli, nell'ordine in cui compaiono la prima volta. */
  readonly children: readonly string[];
  readonly list: boolean;
  /** Il massimo numero di copie in una cella (liste). */
  readonly copies: number;
  readonly element?: string;
  readonly instance?: ModelInstance;
  /** La parte è un layer (non un'istanza) in almeno una cella. */
  readonly plainLayer?: boolean;
  /** Indice della cella → classi finali (stati compresi), solo celle non di stato. */
  readonly classes: ReadonlyMap<number, readonly string[]>;
  /** Indice della cella → props di variante dell'istanza annidata. */
  readonly instanceProps: ReadonlyMap<number, Readonly<Record<string, string>>>;
}

export interface ComponentModel {
  readonly contract: ComponentContract;
  /** Nome kebab del contratto: cartella e `data-slot` della radice. */
  readonly name: string;
  /** PascalCase del nome del contratto. */
  readonly comp: string;
  /** camelCase del nome del contratto. */
  readonly id: string;
  readonly cells: readonly ModelCell[];
  /** Le celle non di stato, in ordine stabile (valori nell'ordine del contratto). */
  readonly baseCells: readonly ModelCell[];
  /** Le parti in ordine d'albero (la radice per prima). */
  readonly parts: readonly ModelPart[];
}

export interface Analysis {
  readonly model?: ComponentModel;
  readonly findings: Finding[];
}

/** Un contratto da `pluginData.contract` (`badge` o `badge@1`). */
export function contractOf(value: string | undefined, contracts: ContractRegistry): { contract?: ComponentContract; problem?: string } {
  if (value === undefined) return { problem: 'manca il contratto: il container non ha "contract" nei plugin data (pagebuilder).' };
  const [name, version] = value.split("@") as [string, string | undefined];
  const contract = Object.hasOwn(contracts, name) ? contracts[name] : undefined;
  if (contract === undefined) {
    return { problem: `contratto "${value}" sconosciuto: i contratti sono [${Object.keys(contracts).sort().join(", ")}].` };
  }
  if (version !== undefined && version !== String(contract.version)) {
    return { problem: `contratto "${value}": la versione nel codice è ${contract.version}. Allinea i plugin data o il contratto.` };
  }
  return { contract };
}

/**
 * Il nome kebab del contratto di un'istanza annidata: il nome in
 * `instance.contract` (`badge@1` → `badge`) se c'è, altrimenti il kebab del
 * nome del componente (`Badge` → `badge`).
 */
export function instanceName(instance: Pick<Instance, "component" | "contract">): string {
  return instance.contract === undefined ? kebabOf(instance.component) : instance.contract.split("@")[0]!;
}

/**
 * Il contratto di un'istanza annidata. Con `instance.contract` passa da
 * `contractOf`, che controlla anche la versione; senza, cerca il kebab del
 * nome del componente.
 */
export function nestedContractOf(
  instance: Pick<Instance, "component" | "contract">,
  contracts: ContractRegistry,
): { name: string; contract?: ComponentContract; problem?: string } {
  const name = instanceName(instance);
  if (instance.contract !== undefined) {
    const found = contractOf(instance.contract, contracts);
    return found.contract === undefined ? { name, problem: found.problem! } : { name, contract: found.contract };
  }
  const contract = Object.hasOwn(contracts, name) ? contracts[name] : undefined;
  if (contract === undefined) return { name, problem: `nessun contratto "${name}". I contratti sono [${Object.keys(contracts).sort().join(", ")}].` };
  return { name, contract };
}

function labelOf(variant: Readonly<Record<string, string>>): string {
  return `cella ${variantLabel(variant)}`;
}

/** Ordine stabile delle celle: i valori nell'ordine del contratto, poi lo stato. */
function cellRank(contract: ComponentContract, cell: ModelCell): number[] {
  return [
    ...contract.axes.map((axis) => (axis.values as readonly string[]).indexOf(cell.axes[axis.name]!)),
    (STATE_VALUES as readonly string[]).indexOf(cell.state),
  ];
}

function compareRanks(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? -1) - (b[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** La chiave (stringa) dei valori `option` di una cella, nell'ordine del contratto. */
export function axesKey(contract: ComponentContract, axes: Readonly<Record<string, string>>): string {
  return contract.axes.map((axis) => axes[axis.name] ?? axis.default).join("|");
}

/** Elementi suggeriti da una parola del nome del layer. */
const ELEMENT_HINTS: readonly (readonly [readonly string[], string])[] = [
  [["button"], "button"],
  [["link"], "a"],
  [["input"], "input"],
  [["label"], "label"],
  [["img", "image"], "img"],
];

const TITLE_HINTS = ["title", "heading", "titolo"];

const ELEMENT_NAME = /^[a-z][a-z0-9]*$/;

/** L'elemento proposto per una parte, oppure `undefined` se il nome è ambiguo (titolo senza risposta). */
export function proposeElement(layerName: string, layerKind: string, answer: string | undefined): string | undefined {
  if (answer !== undefined && ELEMENT_NAME.test(answer)) return answer;
  const words = wordsOf(layerName);
  for (const [hints, element] of ELEMENT_HINTS) if (hints.some((hint) => words.includes(hint))) return element;
  if (TITLE_HINTS.some((hint) => words.includes(hint))) return undefined;
  if (layerKind === "text") return "span";
  if (layerKind === "image") return "img";
  return "div";
}

/** La chiave proposta per un layer senza chiave: il kebab del nome, valido e libero. */
function proposeKey(name: string, taken: ReadonlySet<string>): string {
  let base = kebabOf(name);
  if (!PART_KEY.test(base) || base === IGNORE_ANSWER) base = base.length > 0 && PART_KEY.test(`part-${base}`) ? `part-${base}` : "part";
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

function dedupe(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = JSON.stringify(finding);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Il layer ridotto alla sola collocazione (geometria e dimensionamento): la `cva` di un'istanza. */
function placementOf(layer: LetturaLayer): LetturaLayer {
  const style = Object.fromEntries(Object.entries(layer.style).filter(([property]) => PLACEMENT_PROPERTIES.includes(property)));
  return { name: layer.name, kind: layer.kind, ...(layer.pluginData === undefined ? {} : { pluginData: layer.pluginData }), tokens: {}, style, children: [] };
}

interface Occurrence {
  readonly cell: ModelCell;
  readonly classes: string[];
}

type ComponentReading = { readonly component: string; readonly pluginData?: PluginData; readonly cells: readonly Cella[] };

const blocco = (where: string, message: string): Finding => ({ level: "blocco", where, message });

interface NormalizedCells {
  /** Le celle valide, in ordine stabile. */
  readonly cells: readonly ModelCell[];
  readonly baseCells: readonly ModelCell[];
  /** `axesKey` → la cella base con quegli assi. */
  readonly baseOf: ReadonlyMap<string, ModelCell>;
  readonly findings: Finding[];
}

/** Celle: assi del contratto più `state` facoltativo; le celle mancanti non sono un errore. */
function normalizeCells(cellsIn: readonly Cella[], contract: ComponentContract): NormalizedCells {
  const findings: Finding[] = [];
  const cells: ModelCell[] = [];
  const seenCells = new Set<string>();
  cellsIn.forEach((cell, index) => {
    const label = labelOf(cell.variant);
    let ok = true;
    let state: ModelCell["state"] = "default";
    const axes: Record<string, string> = {};
    for (const [axisName, value] of Object.entries(cell.variant).sort(([a], [b]) => byString(a, b))) {
      if (axisName === STATE_AXIS) {
        if ((STATE_VALUES as readonly string[]).includes(value)) state = value as ModelCell["state"];
        else {
          ok = false;
          findings.push(blocco(label, `Stato "${value}" sconosciuto: l'asse "state" ammette [${STATE_VALUES.join(", ")}].`));
        }
        continue;
      }
      const axis = contract.axes.find((candidate) => candidate.name === axisName);
      if (axis === undefined) {
        ok = false;
        findings.push(blocco(label, `Asse "${axisName}" estraneo al contratto "${contract.name}": gli assi sono [${[...contract.axes.map((a) => a.name), STATE_AXIS].join(", ")}].`));
        continue;
      }
      if (!(axis.values as readonly string[]).includes(value)) {
        ok = false;
        findings.push(blocco(label, `Valore "${value}" fuori contratto per l'asse "${axisName}": ammette [${axis.values.join(", ")}].`));
        continue;
      }
      axes[axisName] = value;
    }
    for (const axis of contract.axes) axes[axis.name] ??= axis.default;
    if (!ok) return;
    const identity = `${axesKey(contract, axes)}|${state}`;
    if (seenCells.has(identity)) {
      findings.push(blocco(label, "Cella doppia: un'altra cella ha gli stessi valori di variante e lo stesso stato."));
      return;
    }
    seenCells.add(identity);
    cells.push({ index, axes, state, label });
  });
  cells.sort((a, b) => compareRanks(cellRank(contract, a), cellRank(contract, b)));
  const baseCells = cells.filter((cell) => cell.state === "default");
  const baseOf = new Map<string, ModelCell>(baseCells.map((cell) => [axesKey(contract, cell.axes), cell]));
  for (const cell of cells) {
    if (cell.state !== "default" && !baseOf.has(axesKey(contract, cell.axes))) {
      findings.push(blocco(cell.label, `Cella di stato "${cell.state}" senza la cella base (stessi assi, state=default o senza state): la differenza non si può calcolare.`));
    }
  }
  return { cells, baseCells, baseOf, findings };
}

/** Una parte come la visita la incontra la prima volta: il resto del modello arriva dalle fasi successive. */
interface PartDraft {
  readonly key: string;
  readonly parent: string | undefined;
  readonly layerName: string;
  readonly layerKind: string;
  readonly children: readonly string[];
}

interface CollectedParts {
  /** Le parti nell'ordine in cui compaiono la prima volta. */
  readonly drafts: ReadonlyMap<string, PartDraft>;
  /** Chiave → le classi della parte in ogni cella in cui compare. */
  readonly occurrences: ReadonlyMap<string, readonly Occurrence[]>;
  /** Chiave → numero massimo di copie, solo per le liste. */
  readonly copies: ReadonlyMap<string, number>;
  readonly instances: ReadonlyMap<string, ModelInstance>;
  /** Le parti che sono un layer (non un'istanza) in almeno una cella. */
  readonly plainLayers: ReadonlySet<string>;
  readonly instanceProps: ReadonlyMap<string, ReadonlyMap<number, Readonly<Record<string, string>>>>;
  /** Chiave → la prima risposta `element` nei plugin data. */
  readonly elementAnswers: ReadonlyMap<string, string>;
  readonly findings: Finding[];
}

/** Lo stato di lavoro di `collectParts`: vive solo durante la visita e non esce dalla fase. */
interface Visit {
  readonly input: Pick<CoreInput, "tokenTypeOf" | "scale">;
  readonly contracts: ContractRegistry;
  readonly findings: Finding[];
  readonly drafts: Map<string, { readonly draft: PartDraft; readonly children: string[] }>;
  readonly occurrences: Map<string, Occurrence[]>;
  readonly copies: Map<string, number>;
  readonly instances: Map<string, ModelInstance>;
  readonly plainLayers: Set<string>;
  readonly instanceProps: Map<string, Map<number, Record<string, string>>>;
  readonly elementAnswers: Map<string, string>;
}

function classesOf(visit: Visit, cell: ModelCell, layer: LetturaLayer, parent: LetturaLayer | undefined): string[] {
  const result = layerClasses(layer, { ...(parent === undefined ? {} : { parent }), tokenTypeOf: visit.input.tokenTypeOf, scale: visit.input.scale });
  visit.findings.push(...result.findings.map((finding) => ({ ...finding, where: `${cell.label} › ${finding.where}` })));
  return result.classes;
}

/** Registra l'occorrenza della parte nella cella; `false` se la chiave è già di un altro ramo. */
function register(visit: Visit, cell: ModelCell, layer: LetturaLayer, key: string, parentKey: string | undefined, classes: string[], where: string): boolean {
  const known = visit.drafts.get(key);
  if (known === undefined) {
    const children: string[] = [];
    visit.drafts.set(key, { draft: { key, parent: parentKey, layerName: layer.name, layerKind: layer.kind, children }, children });
    if (parentKey !== undefined) visit.drafts.get(parentKey)?.children.push(key);
  } else if (known.draft.parent !== parentKey) {
    visit.findings.push(
      blocco(where, `La chiave "${key}" compare in rami diversi (sotto "${known.draft.parent ?? "nessun genitore"}" e sotto "${parentKey ?? "nessun genitore"}"): una chiave è una parte sola. Cambia la chiave di uno dei due layer.`),
    );
    return false;
  }
  const answer = layer.pluginData?.[ELEMENT_KEY];
  if (answer !== undefined && !visit.elementAnswers.has(key)) visit.elementAnswers.set(key, answer);
  const list = visit.occurrences.get(key) ?? [];
  list.push({ cell, classes });
  visit.occurrences.set(key, list);
  return true;
}

function visitInstance(visit: Visit, cell: ModelCell, layer: LetturaLayer, key: string, where: string): void {
  const instance = layer.instance!;
  const { name, contract: nested, problem } = nestedContractOf(instance, visit.contracts);
  if (nested === undefined) {
    visit.findings.push(blocco(where, `Istanza di "${instance.component}": ${problem!}`));
    return;
  }
  const known = visit.instances.get(key);
  if (known !== undefined && known.name !== name) {
    visit.findings.push(blocco(where, `La parte "${key}" è un'istanza di "${known.name}" in un'altra cella e di "${name}" qui.`));
    return;
  }
  visit.instances.set(key, { name, contract: nested });
  const props: Record<string, string> = {};
  for (const [axisName, value] of Object.entries(instance.variant).sort(([a], [b]) => byString(a, b))) {
    const axis = nested.axes.find((candidate) => candidate.name === axisName);
    if (axis === undefined) {
      visit.findings.push(blocco(where, `Istanza di "${name}": l'asse "${axisName}" non è nel contratto "${name}" (assi [${nested.axes.map((a) => a.name).join(", ")}]).`));
      continue;
    }
    if (!(axis.values as readonly string[]).includes(value)) {
      visit.findings.push(blocco(where, `Istanza di "${name}": valore "${value}" fuori contratto per l'asse "${axisName}" (ammette [${axis.values.join(", ")}]).`));
      continue;
    }
    props[axisName] = value;
  }
  const overrides = [...new Set(instance.overrides.filter((override) => !PLACEMENT_PROPERTIES.includes(override)))].sort();
  if (overrides.length > 0) {
    visit.findings.push(
      blocco(
        where,
        `Istanza di "${name}" con override [${overrides.join(", ")}]: un'istanza si usa così com'è, con le sole varianti del suo contratto. Togli gli override in Penpot o aggiungi una variante a "${name}".`,
      ),
    );
  }
  if (cell.state === "default") {
    const perCell = visit.instanceProps.get(key) ?? new Map<number, Record<string, string>>();
    perCell.set(cell.index, props);
    visit.instanceProps.set(key, perCell);
  }
}

function visitLayer(visit: Visit, cell: ModelCell, layer: LetturaLayer, parent: LetturaLayer, parentKey: string, siblings: Map<string, number>, taken: Set<string>): void {
  const where = `${cell.label} › layer "${layer.name}"`;
  const data = layer.pluginData;
  const raw = data?.[PART_KEY_NAME];
  const visitChildren = (structural: string, childSiblings: Map<string, number>): void => {
    if (layer.instance !== undefined) return;
    for (const child of layer.children) visitLayer(visit, cell, child, layer, structural, childSiblings, taken);
  };
  if (raw === IGNORE_ANSWER) {
    const lost = layer.instance === undefined ? classesOf(visit, cell, layer, parent) : [];
    if (lost.length > 0) {
      visit.findings.push({ level: "avviso", where, message: `Layer "ignora": fuso nel genitore, le sue classi [${lost.join(" ")}] vanno perse.` });
    }
    if (layer.instance !== undefined) visit.findings.push({ level: "avviso", where, message: `Layer "ignora" su un'istanza di "${layer.instance.component}": l'istanza non si rende.` });
    visitChildren(parentKey, siblings);
    return;
  }
  if (raw === undefined || !PART_KEY.test(raw)) {
    const invalid = raw === undefined ? "" : ` La chiave "${raw}" non è valida (kebab-case, comincia con una lettera).`;
    visit.findings.push({
      level: "domanda",
      where,
      key: PART_KEY_NAME,
      message: `Il layer non ha una chiave di parte: con una chiave diventa una parte (data-slot), con "${IGNORE_ANSWER}" si fonde nel genitore e le sue classi vanno perse.${invalid}`,
      options: [proposeKey(layer.name, taken), IGNORE_ANSWER],
    });
    visitChildren(parentKey, new Map());
    return;
  }
  const key = raw;
  const count = siblings.get(key) ?? 0;
  siblings.set(key, count + 1);
  if (count > 0) {
    const repeat = data?.[REPEAT_KEY];
    if (repeat === "lista") {
      if (visit.drafts.has(key)) visit.copies.set(key, Math.max(visit.copies.get(key) ?? 1, count + 1));
      // Le copie di una lista non si visitano: sono la stessa parte.
      return;
    }
    if (repeat === "parte-nuova") {
      visit.findings.push({
        level: "domanda",
        where,
        key: PART_KEY_NAME,
        message: `Il layer è una parte nuova ma ha ancora la chiave "${key}" del fratello: scrivi la sua chiave.`,
        options: [proposeKey(layer.name, new Set([...taken, key])), IGNORE_ANSWER],
      });
      return;
    }
    visit.findings.push({
      level: "domanda",
      where,
      key: REPEAT_KEY,
      message: withInvalidAnswer(
        `La chiave "${key}" è già di un fratello: "lista" = la parte si ripete (un .map nel TSX, una cva sola), "parte-nuova" = è un'altra parte e le serve una chiave sua.`,
        repeat,
      ),
      options: [...REPEAT_ANSWERS],
    });
    return;
  }
  taken.add(key);
  if (layer.instance !== undefined) {
    const classes = classesOf(visit, cell, placementOf(layer), parent);
    if (!register(visit, cell, layer, key, parentKey, classes, where)) return;
    if (visit.plainLayers.has(key)) {
      visit.findings.push(blocco(where, `La parte "${key}" è un layer in un'altra cella e un'istanza di "${instanceName(layer.instance)}" qui.`));
      return;
    }
    visitInstance(visit, cell, layer, key, where);
    return;
  }
  if (!register(visit, cell, layer, key, parentKey, classesOf(visit, cell, layer, parent), where)) return;
  const instance = visit.instances.get(key);
  if (instance !== undefined) visit.findings.push(blocco(where, `La parte "${key}" è un'istanza di "${instance.name}" in un'altra cella e un layer qui.`));
  visit.plainLayers.add(key);
  visitChildren(key, new Map());
}

/** Parti: una visita per cella, dalla radice in profondità. */
function collectParts(
  cells: readonly ModelCell[],
  drawn: readonly Cella[],
  rootSizes: readonly string[][],
  input: Pick<CoreInput, "tokenTypeOf" | "scale">,
  contracts: ContractRegistry,
): CollectedParts {
  const visit: Visit = {
    input: { tokenTypeOf: input.tokenTypeOf, scale: input.scale },
    contracts,
    findings: [],
    drafts: new Map(),
    occurrences: new Map(),
    copies: new Map(),
    instances: new Map(),
    plainLayers: new Set(),
    instanceProps: new Map(),
    elementAnswers: new Map(),
  };
  const rootKeys = new Set<string>();
  cells.forEach((cell, position) => {
    const root = drawn[position]!.root;
    const where = `${cell.label} › layer "${root.name}"`;
    const raw = root.pluginData?.[PART_KEY_NAME];
    const rootKey = raw !== undefined && PART_KEY.test(raw) && raw !== IGNORE_ANSWER ? raw : ROOT_KEY;
    if (raw !== undefined && rootKey !== raw) visit.findings.push({ level: "avviso", where, message: `Chiave "${raw}" non valida sulla radice: vale "${ROOT_KEY}".` });
    rootKeys.add(rootKey);
    if (rootKeys.size > 1) {
      visit.findings.push(blocco(where, `La radice ha chiavi diverse tra le celle ([${[...rootKeys].join(", ")}]): la radice è una parte sola.`));
      return;
    }
    const classes = [...new Set([...classesOf(visit, cell, root, undefined), ...(rootSizes[position] ?? [])])].sort();
    if (!register(visit, cell, root, rootKey, undefined, classes, where)) return;
    if (root.instance !== undefined) {
      visit.findings.push(blocco(where, "La radice del componente è un'istanza: un componente non è una copia di un altro."));
      return;
    }
    const taken = new Set<string>([rootKey]);
    const siblings = new Map<string, number>();
    for (const child of root.children) visitLayer(visit, cell, child, root, rootKey, siblings, taken);
  });
  const { findings, occurrences, copies, instances, plainLayers, instanceProps, elementAnswers } = visit;
  const drafts = new Map([...visit.drafts].map(([key, { draft, children }]) => [key, { ...draft, children: [...children] }]));
  return { drafts, occurrences, copies, instances, plainLayers, instanceProps, elementAnswers, findings };
}

interface StatedClasses {
  /** Chiave → indice della cella base → classi finali (stati compresi). */
  readonly classes: ReadonlyMap<string, ReadonlyMap<number, readonly string[]>>;
  readonly findings: Finding[];
}

/**
 * Stati: la differenza dalla cella base, con il prefisso. Si generalizza solo l'asse `size`
 * (convenzione sul nome): gli altri assi devono coincidere con la cella di stato.
 */
function applyStates(contract: ComponentContract, normalized: NormalizedCells, occurrences: ReadonlyMap<string, readonly Occurrence[]>): StatedClasses {
  const { cells, baseCells, baseOf } = normalized;
  const findings: Finding[] = [];
  const sizeAxis = contract.axes.find((axis) => axis.name === SIZE_AXIS);
  const stateClasses = new Map<string, Map<number, string[]>>();
  for (const state of INTERACTIVE_STATES) {
    const stateCells = cells.filter((cell) => cell.state === state);
    if (stateCells.length === 0) continue;
    for (const [key, list] of occurrences) {
      const at = (cell: ModelCell): string[] | undefined => list.find((occurrence) => occurrence.cell === cell)?.classes;
      const diffs = new Map<ModelCell, string[]>();
      for (const stateCell of stateCells) {
        const base = baseOf.get(axesKey(contract, stateCell.axes));
        if (base === undefined) continue;
        const drawn = at(stateCell);
        const baseClasses = at(base);
        if (drawn === undefined && baseClasses === undefined) continue;
        if (drawn === undefined || baseClasses === undefined) {
          findings.push({
            level: "avviso",
            where: `${stateCell.label} › parte "${key}"`,
            message: `La parte "${key}" c'è ${drawn === undefined ? "nella cella base ma non" : "solo"} nella cella di stato "${state}": lo stato non mostra né nasconde parti, nessuna classe.`,
          });
          continue;
        }
        const added = drawn.filter((cls) => !baseClasses.includes(cls));
        const removed = baseClasses.filter((cls) => !drawn.includes(cls));
        if (added.length === 0) {
          if (removed.length > 0) {
            findings.push({
              level: "avviso",
              where: `${stateCell.label} › parte "${key}"`,
              message: `La cella di stato "${state}" toglie soltanto classi [${removed.join(" ")}]: una classe non si toglie con un prefisso di stato, nessuna classe. Disegna lo stato con un valore che sostituisce.`,
            });
          }
          continue;
        }
        diffs.set(stateCell, added.map((cls) => `${STATE_PREFIXES[state]}${cls}`));
      }
      if (diffs.size === 0) continue;
      for (const target of baseCells) {
        if (at(target) === undefined) continue;
        const candidates = [...diffs.keys()].filter((cell) => contract.axes.every((axis) => axis === sizeAxis || cell.axes[axis.name] === target.axes[axis.name]));
        if (candidates.length === 0) continue;
        // La taglia disegnata, poi la taglia di default del contratto, poi la prima taglia disegnata.
        const chosen =
          (sizeAxis === undefined ? candidates[0] : undefined) ??
          candidates.find((cell) => cell.axes[sizeAxis!.name] === target.axes[sizeAxis!.name]) ??
          candidates.find((cell) => cell.axes[sizeAxis!.name] === sizeAxis!.default) ??
          candidates[0]!;
        const perCell = stateClasses.get(key) ?? new Map<number, string[]>();
        perCell.set(target.index, [...(perCell.get(target.index) ?? []), ...diffs.get(chosen)!]);
        stateClasses.set(key, perCell);
      }
    }
  }

  const classes = new Map<string, Map<number, string[]>>();
  for (const [key, list] of occurrences) {
    const perCell = new Map<number, string[]>();
    for (const { cell, classes: drawn } of list) {
      if (cell.state !== "default") continue;
      const extra = stateClasses.get(key)?.get(cell.index) ?? [];
      perCell.set(cell.index, [...new Set([...drawn, ...extra])].sort());
    }
    classes.set(key, perCell);
  }
  return { classes, findings };
}

/** Le parti in ordine d'albero: ogni radice, poi i figli in profondità. */
function treeOrder(drafts: ReadonlyMap<string, PartDraft>): PartDraft[] {
  const ordered: PartDraft[] = [];
  const walk = (key: string): void => {
    const draft = drafts.get(key);
    if (draft === undefined) return;
    ordered.push(draft);
    for (const child of draft.children) walk(child);
  };
  for (const draft of drafts.values()) if (draft.parent === undefined) walk(draft.key);
  return ordered;
}

/** Elemento proposto (solo per lo scaffold): chiave → elemento, e le domande sui titoli se manca il TSX. */
function proposeElements(
  ordered: readonly PartDraft[],
  collected: Pick<CollectedParts, "instances" | "elementAnswers">,
  tsxMissing: boolean,
): { readonly elements: ReadonlyMap<string, string>; readonly findings: Finding[] } {
  const elements = new Map<string, string>();
  const findings: Finding[] = [];
  for (const part of ordered) {
    if (collected.instances.has(part.key)) continue;
    const answer = collected.elementAnswers.get(part.key);
    const element = proposeElement(part.layerName, part.layerKind, answer);
    if (element !== undefined) elements.set(part.key, element);
    else if (tsxMissing) {
      findings.push({
        level: "domanda",
        where: `parte "${part.key}" (layer "${part.layerName}")`,
        key: ELEMENT_KEY,
        message: withInvalidAnswer("Il nome del layer fa pensare a un titolo: quale elemento crea lo scaffold?", answer),
        options: [...TITLE_ELEMENTS],
      });
    }
  }
  return { elements, findings };
}

/** Parti tolte dallo sviluppatore: la chiave non compare nel TSX. */
function findUnusedParts(ordered: readonly PartDraft[], contract: ComponentContract, existingTsx: string | undefined): Finding[] {
  if (existingTsx === undefined) return [];
  return ordered
    .filter((part) => !isPartUsed(existingTsx, part.key))
    .map((part): Finding => ({
      level: "avviso",
      where: `parte "${part.key}"`,
      message: `Export inutilizzato: la parte "${part.key}" è in ${camelCase(contract.name)}Styles ma il TSX non la usa (né ".${part.key}" né ["${part.key}"]). Usala nel TSX o togli la chiave in Penpot.`,
    }));
}

/**
 * Il modello del componente e i suoi `Finding`. Senza contratto valido il
 * modello manca; con blocchi o domande il modello c'è ma il generatore si
 * ferma.
 *
 * Le fasi, in ordine (è anche l'ordine dei `Finding`): celle (con le celle
 * di stato senza base), misure della radice, parti, stati, elementi
 * proposti, parti inutilizzate.
 */
export function analyzeComponent(lettura: ComponentReading, input: CoreInput): Analysis {
  const contracts: ContractRegistry = input.contracts ?? COMPONENT_CONTRACTS;
  const found = contractOf(lettura.pluginData?.contract, contracts);
  if (found.contract === undefined) return { findings: [blocco(`componente "${lettura.component}"`, `Contratto: ${found.problem!}`)] };
  const contract = found.contract;

  const normalized = normalizeCells(lettura.cells, contract);
  // Le celle disegnate, allineate a `normalized.cells`: le misure della radice e la visita usano le stesse posizioni.
  const drawn = normalized.cells.map((cell) => lettura.cells[cell.index]!);
  const rootSizes = rootSizeClasses(drawn, { scale: input.scale });
  const collected = collectParts(normalized.cells, drawn, rootSizes.classes, input, contracts);
  const stated = applyStates(contract, normalized, collected.occurrences);
  const ordered = treeOrder(collected.drafts);
  const proposed = proposeElements(ordered, collected, input.existingTsx === undefined);
  const unused = findUnusedParts(ordered, contract, input.existingTsx);

  const parts: ModelPart[] = ordered.map((draft) => {
    const copies = collected.copies.get(draft.key);
    const element = proposed.elements.get(draft.key);
    const instance = collected.instances.get(draft.key);
    return {
      ...draft,
      list: copies !== undefined,
      copies: copies ?? 1,
      ...(element === undefined ? {} : { element }),
      ...(instance === undefined ? {} : { instance }),
      ...(collected.plainLayers.has(draft.key) ? { plainLayer: true } : {}),
      classes: stated.classes.get(draft.key) ?? new Map(),
      instanceProps: collected.instanceProps.get(draft.key) ?? new Map(),
    };
  });

  const model: ComponentModel = {
    contract,
    name: contract.name,
    comp: pascalCase(contract.name),
    id: camelCase(contract.name),
    cells: normalized.cells,
    baseCells: normalized.baseCells,
    parts,
  };
  // L'ordine dei `Finding` è parte dell'output: segue l'ordine delle fasi, non cambiarlo.
  const findings = [...normalized.findings, ...rootSizes.findings, ...collected.findings, ...stated.findings, ...proposed.findings, ...unused];
  return { model, findings: dedupe(findings) };
}

/** Il TSX usa la chiave: contiene `.<key>` oppure `["<key>"]`. */
export function isPartUsed(tsx: string, key: string): boolean {
  // `.item` non vale per `.items` né per `.item-2`.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(tsx) || tsx.includes(`["${key}"]`);
}

/** I `Finding` di un componente: chiavi di parte, istanze, assi, stati e classi. */
export function verifyComponent(lettura: { readonly component: string; readonly pluginData?: PluginData; readonly cells: readonly Cella[] }, input: CoreInput): Finding[] {
  return analyzeComponent(lettura, input).findings;
}

/** Ferma la generazione: un blocco o una domanda. */
export const isStopping = (finding: Finding): boolean => finding.level !== "avviso";
