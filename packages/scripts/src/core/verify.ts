import { COMPONENT_CONTRACTS, type ComponentContract } from "@app/contracts";

import { GEOMETRY_ENTRIES, rootSizeClasses, type Scale } from "./geometry";
import { camelCase, kebabOf, pascalCase, PART_KEY, wordsOf } from "./naming";
import { layerClasses, type TokenTypeOf } from "./registry";
import type { Cella, Finding, LetturaLayer, PluginData } from "./schemas";

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
  readonly children: string[];
  list: boolean;
  /** Il massimo numero di copie in una cella (liste). */
  copies: number;
  element?: string;
  instance?: ModelInstance;
  /** La parte è un layer (non un'istanza) in almeno una cella. */
  plainLayer?: boolean;
  /** Indice della cella → classi finali (stati compresi), solo celle non di stato. */
  readonly classes: Map<number, string[]>;
  /** Indice della cella → props di variante dell'istanza annidata. */
  readonly instanceProps: Map<number, Record<string, string>>;
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

/** Il nome kebab del contratto di un'istanza annidata (`Badge` → `badge`). */
export function instanceName(component: string): string {
  return kebabOf(component);
}

function labelOf(variant: Readonly<Record<string, string>>): string {
  const entries = Object.entries(variant);
  return entries.length === 0 ? "cella senza varianti" : `cella ${entries.map(([key, value]) => `${key}=${value}`).join(", ")}`;
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

/**
 * Il modello del componente e i suoi `Finding`. Senza contratto valido il
 * modello manca; con blocchi o domande il modello c'è ma il generatore si
 * ferma.
 */
export function analyzeComponent(lettura: { readonly component: string; readonly pluginData?: PluginData; readonly cells: readonly Cella[] }, input: CoreInput): Analysis {
  const contracts: ContractRegistry = input.contracts ?? COMPONENT_CONTRACTS;
  const findings: Finding[] = [];
  const componentWhere = `componente "${lettura.component}"`;
  const block = (where: string, message: string): void => {
    findings.push({ level: "blocco", where, message });
  };

  const found = contractOf(lettura.pluginData?.contract, contracts);
  if (found.contract === undefined) {
    block(componentWhere, `Contratto: ${found.problem!}`);
    return { findings };
  }
  const contract = found.contract;

  // Celle: assi del contratto più `state` facoltativo; le celle mancanti non sono un errore.
  const cells: ModelCell[] = [];
  const seenCells = new Set<string>();
  lettura.cells.forEach((cell, index) => {
    const label = labelOf(cell.variant);
    let ok = true;
    let state: ModelCell["state"] = "default";
    const axes: Record<string, string> = {};
    for (const [axisName, value] of Object.entries(cell.variant).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (axisName === STATE_AXIS) {
        if ((STATE_VALUES as readonly string[]).includes(value)) state = value as ModelCell["state"];
        else {
          ok = false;
          block(label, `Stato "${value}" sconosciuto: l'asse "state" ammette [${STATE_VALUES.join(", ")}].`);
        }
        continue;
      }
      const axis = contract.axes.find((candidate) => candidate.name === axisName);
      if (axis === undefined) {
        ok = false;
        block(label, `Asse "${axisName}" estraneo al contratto "${contract.name}": gli assi sono [${[...contract.axes.map((a) => a.name), STATE_AXIS].join(", ")}].`);
        continue;
      }
      if (!(axis.values as readonly string[]).includes(value)) {
        ok = false;
        block(label, `Valore "${value}" fuori contratto per l'asse "${axisName}": ammette [${axis.values.join(", ")}].`);
        continue;
      }
      axes[axisName] = value;
    }
    for (const axis of contract.axes) axes[axis.name] ??= axis.default;
    if (!ok) return;
    const identity = `${axesKey(contract, axes)}|${state}`;
    if (seenCells.has(identity)) {
      block(label, "Cella doppia: un'altra cella ha gli stessi valori di variante e lo stesso stato.");
      return;
    }
    seenCells.add(identity);
    cells.push({ index, axes, state, label });
  });
  const byRank = (a: ModelCell, b: ModelCell): number => compareRanks(cellRank(contract, a), cellRank(contract, b));
  cells.sort(byRank);
  const baseCells = cells.filter((cell) => cell.state === "default");
  const baseOf = new Map<string, ModelCell>(baseCells.map((cell) => [axesKey(contract, cell.axes), cell]));
  for (const cell of cells) {
    if (cell.state !== "default" && !baseOf.has(axesKey(contract, cell.axes))) {
      block(cell.label, `Cella di stato "${cell.state}" senza la cella base (stessi assi, state=default o senza state): la differenza non si può calcolare.`);
    }
  }

  // Parti: una visita per cella.
  const parts = new Map<string, ModelPart>();
  const occurrences = new Map<string, Occurrence[]>();
  const rootSizes = rootSizeClasses(
    cells.map((cell) => lettura.cells[cell.index]!),
    { scale: input.scale },
  );
  findings.push(...rootSizes.findings);
  const tsxMissing = input.existingTsx === undefined;
  const elementAnswers = new Map<string, string>();

  const classesOf = (cell: ModelCell, layer: LetturaLayer, parent: LetturaLayer | undefined): string[] => {
    const result = layerClasses(layer, { ...(parent === undefined ? {} : { parent }), tokenTypeOf: input.tokenTypeOf, scale: input.scale });
    findings.push(...result.findings.map((finding) => ({ ...finding, where: `${cell.label} › ${finding.where}` })));
    return result.classes;
  };

  const register = (cell: ModelCell, layer: LetturaLayer, key: string, parentKey: string | undefined, classes: string[], where: string): ModelPart | undefined => {
    let part = parts.get(key);
    if (part === undefined) {
      part = { key, parent: parentKey, layerName: layer.name, layerKind: layer.kind, children: [], list: false, copies: 1, classes: new Map(), instanceProps: new Map() };
      parts.set(key, part);
      if (parentKey !== undefined) parts.get(parentKey)?.children.push(key);
    } else if (part.parent !== parentKey) {
      block(where, `La chiave "${key}" compare in rami diversi (sotto "${part.parent ?? "nessun genitore"}" e sotto "${parentKey ?? "nessun genitore"}"): una chiave è una parte sola. Cambia la chiave di uno dei due layer.`);
      return undefined;
    }
    const answer = layer.pluginData?.[ELEMENT_KEY];
    if (answer !== undefined && !elementAnswers.has(key)) elementAnswers.set(key, answer);
    const list = occurrences.get(key) ?? [];
    list.push({ cell, classes });
    occurrences.set(key, list);
    return part;
  };

  const visitInstance = (cell: ModelCell, layer: LetturaLayer, part: ModelPart, where: string): void => {
    const instance = layer.instance!;
    const name = instanceName(instance.component);
    const nested = Object.hasOwn(contracts, name) ? contracts[name] : undefined;
    if (nested === undefined) {
      block(where, `Istanza di "${instance.component}": nessun contratto "${name}". I contratti sono [${Object.keys(contracts).sort().join(", ")}].`);
      return;
    }
    if (part.instance !== undefined && part.instance.name !== name) {
      block(where, `La parte "${part.key}" è un'istanza di "${part.instance.name}" in un'altra cella e di "${name}" qui.`);
      return;
    }
    part.instance = { name, contract: nested };
    const props: Record<string, string> = {};
    for (const [axisName, value] of Object.entries(instance.variant).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const axis = nested.axes.find((candidate) => candidate.name === axisName);
      if (axis === undefined) {
        block(where, `Istanza di "${name}": l'asse "${axisName}" non è nel contratto "${name}" (assi [${nested.axes.map((a) => a.name).join(", ")}]).`);
        continue;
      }
      if (!(axis.values as readonly string[]).includes(value)) {
        block(where, `Istanza di "${name}": valore "${value}" fuori contratto per l'asse "${axisName}" (ammette [${axis.values.join(", ")}]).`);
        continue;
      }
      props[axisName] = value;
    }
    const overrides = [...new Set(instance.overrides.filter((override) => !PLACEMENT_PROPERTIES.includes(override)))].sort();
    if (overrides.length > 0) {
      block(
        where,
        `Istanza di "${name}" con override [${overrides.join(", ")}]: un'istanza si usa così com'è, con le sole varianti del suo contratto. Togli gli override in Penpot o aggiungi una variante a "${name}".`,
      );
    }
    if (cell.state === "default") part.instanceProps.set(cell.index, props);
  };

  const visit = (cell: ModelCell, layer: LetturaLayer, parent: LetturaLayer, parentKey: string, siblings: Map<string, number>, taken: Set<string>): void => {
    const where = `${cell.label} › layer "${layer.name}"`;
    const data = layer.pluginData;
    const raw = data?.[PART_KEY_NAME];
    const visitChildren = (structural: string, childSiblings: Map<string, number>): void => {
      if (layer.instance !== undefined) return;
      for (const child of layer.children) visit(cell, child, layer, structural, childSiblings, taken);
    };
    if (raw === IGNORE_ANSWER) {
      const lost = layer.instance === undefined ? classesOf(cell, layer, parent) : [];
      if (lost.length > 0) {
        findings.push({ level: "avviso", where, message: `Layer "ignora": fuso nel genitore, le sue classi [${lost.join(" ")}] vanno perse.` });
      }
      if (layer.instance !== undefined) findings.push({ level: "avviso", where, message: `Layer "ignora" su un'istanza di "${layer.instance.component}": l'istanza non si rende.` });
      visitChildren(parentKey, siblings);
      return;
    }
    if (raw === undefined || !PART_KEY.test(raw)) {
      const invalid = raw === undefined ? "" : ` La chiave "${raw}" non è valida (kebab-case, comincia con una lettera).`;
      findings.push({
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
        const part = parts.get(key);
        if (part !== undefined) {
          part.list = true;
          part.copies = Math.max(part.copies, count + 1);
        }
        // Le copie di una lista non si visitano: sono la stessa parte.
        return;
      }
      if (repeat === "parte-nuova") {
        findings.push({
          level: "domanda",
          where,
          key: PART_KEY_NAME,
          message: `Il layer è una parte nuova ma ha ancora la chiave "${key}" del fratello: scrivi la sua chiave.`,
          options: [proposeKey(layer.name, new Set([...taken, key])), IGNORE_ANSWER],
        });
        return;
      }
      const invalid = repeat === undefined ? "" : ` La risposta "${repeat}" non è valida.`;
      findings.push({
        level: "domanda",
        where,
        key: REPEAT_KEY,
        message: `La chiave "${key}" è già di un fratello: "lista" = la parte si ripete (un .map nel TSX, una cva sola), "parte-nuova" = è un'altra parte e le serve una chiave sua.${invalid}`,
        options: [...REPEAT_ANSWERS],
      });
      return;
    }
    taken.add(key);
    if (layer.instance !== undefined) {
      const classes = classesOf(cell, placementOf(layer), parent);
      const part = register(cell, layer, key, parentKey, classes, where);
      if (part === undefined) return;
      if (part.plainLayer === true) {
        block(where, `La parte "${key}" è un layer in un'altra cella e un'istanza di "${instanceName(layer.instance.component)}" qui.`);
        return;
      }
      visitInstance(cell, layer, part, where);
      return;
    }
    const part = register(cell, layer, key, parentKey, classesOf(cell, layer, parent), where);
    if (part === undefined) return;
    if (part.instance !== undefined) block(where, `La parte "${key}" è un'istanza di "${part.instance.name}" in un'altra cella e un layer qui.`);
    part.plainLayer = true;
    visitChildren(key, new Map());
  };

  const rootKeys = new Set<string>();
  for (const cell of cells) {
    const root = lettura.cells[cell.index]!.root;
    const raw = root.pluginData?.[PART_KEY_NAME];
    const rootKey = raw !== undefined && PART_KEY.test(raw) && raw !== IGNORE_ANSWER ? raw : ROOT_KEY;
    if (raw !== undefined && rootKey !== raw) findings.push({ level: "avviso", where: `${cell.label} › layer "${root.name}"`, message: `Chiave "${raw}" non valida sulla radice: vale "${ROOT_KEY}".` });
    rootKeys.add(rootKey);
    if (rootKeys.size > 1) {
      block(`${cell.label} › layer "${root.name}"`, `La radice ha chiavi diverse tra le celle ([${[...rootKeys].join(", ")}]): la radice è una parte sola.`);
      continue;
    }
    const sizeClasses = rootSizes.classes[cells.indexOf(cell)] ?? [];
    const classes = [...new Set([...classesOf(cell, root, undefined), ...sizeClasses])].sort();
    const taken = new Set<string>([rootKey]);
    const part = register(cell, root, rootKey, undefined, classes, `${cell.label} › layer "${root.name}"`);
    if (part === undefined) continue;
    if (root.instance !== undefined) {
      block(`${cell.label} › layer "${root.name}"`, "La radice del componente è un'istanza: un componente non è una copia di un altro.");
      continue;
    }
    const siblings = new Map<string, number>();
    for (const child of root.children) visit(cell, child, root, rootKey, siblings, taken);
  }

  // Stati: la differenza dalla cella base, con il prefisso. Si generalizza solo l'asse `size`
  // (convenzione sul nome): gli altri assi devono coincidere con la cella di stato.
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

  for (const [key, list] of occurrences) {
    const part = parts.get(key)!;
    for (const { cell, classes } of list) {
      if (cell.state !== "default") continue;
      const extra = stateClasses.get(key)?.get(cell.index) ?? [];
      part.classes.set(cell.index, [...new Set([...classes, ...extra])].sort());
    }
  }

  // Elemento proposto (solo per lo scaffold).
  const ordered: ModelPart[] = [];
  const walk = (key: string): void => {
    const part = parts.get(key);
    if (part === undefined) return;
    ordered.push(part);
    for (const child of part.children) walk(child);
  };
  for (const part of parts.values()) if (part.parent === undefined) walk(part.key);
  for (const part of ordered) {
    if (part.instance !== undefined) continue;
    const answer = elementAnswers.get(part.key);
    const element = proposeElement(part.layerName, part.layerKind, answer);
    if (element !== undefined) part.element = element;
    else if (tsxMissing) {
      const invalid = answer === undefined ? "" : ` La risposta "${answer}" non è valida.`;
      findings.push({
        level: "domanda",
        where: `parte "${part.key}" (layer "${part.layerName}")`,
        key: ELEMENT_KEY,
        message: `Il nome del layer fa pensare a un titolo: quale elemento crea lo scaffold?${invalid}`,
        options: [...TITLE_ELEMENTS],
      });
    }
  }

  // Parti tolte dallo sviluppatore: la chiave non compare nel TSX.
  if (input.existingTsx !== undefined) {
    for (const part of ordered) {
      if (!isPartUsed(input.existingTsx, part.key)) {
        findings.push({
          level: "avviso",
          where: `parte "${part.key}"`,
          message: `Export inutilizzato: la parte "${part.key}" è in ${camelCase(contract.name)}Styles ma il TSX non la usa (né ".${part.key}" né ["${part.key}"]). Usala nel TSX o togli la chiave in Penpot.`,
        });
      }
    }
  }

  const model: ComponentModel = {
    contract,
    name: contract.name,
    comp: pascalCase(contract.name),
    id: camelCase(contract.name),
    cells,
    baseCells,
    parts: ordered,
  };
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
