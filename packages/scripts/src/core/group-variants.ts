import { COMPONENT_CONTRACTS, type ComponentContract } from "@app/contracts";
import { z } from "zod";

import { kebabOf } from "./naming";
import { renderingAxesOf } from "./rendering";
import { contractOf, STATE_AXIS, STATE_VALUES, type ContractRegistry } from "./verify";

/**
 * Raggruppamento delle celle in un container di varianti (Story 2.36,
 * operazione `group_variants`): la matrice attesa — gli assi `option` del
 * contratto, gli assi di RENDERING di `rendering.ts` e `state` quando il
 * disegno lo usa — e la validazione dei nomi delle celle. È logica pura: non
 * parla con Penpot e non scrive niente. Il sorgente `execute_code` che esegue
 * la sequenza sta in `src/penpot/group-variants.ts`; il server lo chiama solo
 * dopo che questo modulo ha validato tutto, così un nome incompleto, un valore
 * fuori contratto o una cella doppia non producono nessuna scrittura. Le
 * combinazioni non disegnate sono una nota (`notDrawn`), non un rifiuto.
 */

/** Una cella come la restituisce Penpot: il board, il nome e (per una variante) i valori di variante. */
export const VariantBoard = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  variant: z.record(z.string(), z.string()).optional(),
});

export type VariantBoard = z.infer<typeof VariantBoard>;

/** Il container che già raggruppa il componente: i suoi assi sono le proprietà della variante. */
export const VariantContainer = VariantBoard.extend({
  properties: z.array(z.string()),
  variants: z.array(VariantBoard),
});

export type VariantContainer = z.infer<typeof VariantContainer>;

/**
 * La lettura che precede ogni scrittura: il container che già raggruppa il
 * componente (se c'è), le celle sciolte `Component / Axis=Value` e i nomi dei
 * componenti del file per i messaggi d'errore.
 */
export const VariantCellsReading = z.object({
  component: z.string().min(1),
  container: VariantContainer.optional(),
  boards: z.array(VariantBoard),
  available: z.array(z.string()),
});

export type VariantCellsReading = z.infer<typeof VariantCellsReading>;

export const GROUP_VARIANTS_OUTCOMES = ["raggruppato", "già raggruppato", "singolo"] as const;

export type GroupVariantsOutcome = (typeof GROUP_VARIANTS_OUTCOMES)[number];

/** L'esito di `group_variants`: nessuno stato interno, solo quello che è successo e com'è il componente. */
export const GroupVariantsResult = z.object({
  outcome: z.enum(GROUP_VARIANTS_OUTCOMES),
  /** Il nome del contratto (kebab), non quello del layer in Penpot. */
  component: z.string().min(1),
  /** Il nome del container in Penpot. */
  container: z.string().min(1).optional(),
  /** Le proprietà di variante impostate (o già presenti), nell'ordine in cui Penpot le elenca. */
  axes: z.array(z.string()),
  cells: z.array(z.object({ name: z.string().min(1), variant: z.record(z.string(), z.string()) })),
  /** Le combinazioni della matrice che il disegno non ha: una nota, non un rifiuto. */
  notDrawn: z.array(z.string()).optional(),
});

export type GroupVariantsResult = z.infer<typeof GroupVariantsResult>;

/** Un asse della matrice: il nome della proprietà, i valori ammessi e il valore della cella di partenza. */
export interface VariantAxis {
  readonly name: string;
  readonly values: readonly string[];
  readonly base: string;
}

/** Gli assi della matrice, nell'ordine delle proprietà: prima gli `option` del contratto, poi quelli di rendering. */
export function variantAxes(contract: ComponentContract): VariantAxis[] {
  return [
    ...contract.axes.map((axis) => ({ name: axis.name, values: axis.values as readonly string[], base: axis.default })),
    ...renderingAxesOf(contract.name).map((axis) => ({ name: axis.name, values: axis.values, base: axis.base })),
  ];
}

/** Il prodotto cartesiano degli assi: le celle di partenza della matrice, nell'ordine degli assi. */
export function matrixCombinations(axes: readonly VariantAxis[]): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const axis of axes) {
    out = out.flatMap((prefix) => axis.values.map((value) => ({ ...prefix, [axis.name]: value })));
  }
  return out;
}

/** Il nome del contratto chiesto: `chip`, `chip@1` o il nome del layer in Penpot (`Chip`). */
function resolveContract(component: string, contracts: ContractRegistry): ComponentContract {
  const direct = contractOf(component, contracts);
  if (direct.contract !== undefined) return direct.contract;
  const kebab = kebabOf(component);
  const byLayer = Object.hasOwn(contracts, kebab) ? contracts[kebab] : undefined;
  if (byLayer !== undefined) return byLayer;
  throw new Error(
    `group_variants: nessun contratto "${component}" (né "${kebab}"): la matrice attesa si calcola dal contratto. I contratti sono [${Object.keys(contracts).sort().join(", ")}].`,
  );
}

/** Il nome di una cella sciolta: `Component / Axis=Value`. */
export interface ParsedCellName {
  readonly label: string;
  readonly variant: Readonly<Record<string, string>>;
}

/**
 * `Chip / size=md, removable=false` → `{ label: "Chip", variant: { size: "md", removable: "false" } }`.
 * Restituisce il problema quando il nome non segue la forma `Component / Axis=Value`.
 */
export function parseCellName(name: string): ParsedCellName | { readonly problem: string } {
  const slash = name.indexOf("/");
  if (slash < 0) return { problem: 'il nome non ha la forma "Component / Axis=Value"' };
  const label = name.slice(0, slash).trim();
  const rest = name.slice(slash + 1).trim();
  if (label.length === 0) return { problem: 'manca il nome del componente prima di "/"' };
  if (rest.length === 0) return { problem: 'dopo "/" non c\'è nessuna proprietà' };
  if (rest.includes("/")) return { problem: 'dopo "/" c\'è più di un livello: le proprietà sono "Axis=Value" separate da virgola' };
  const variant: Record<string, string> = {};
  for (const part of rest.split(",")) {
    const text = part.trim();
    if (text.length === 0) return { problem: "c'è una proprietà vuota tra le virgole" };
    const equal = text.indexOf("=");
    if (equal < 0) return { problem: `la proprietà "${text}" non è "Axis=Value"` };
    const key = text.slice(0, equal).trim();
    const value = text.slice(equal + 1).trim();
    if (key.length === 0 || value.length === 0) return { problem: `la proprietà "${text}" non è "Axis=Value"` };
    if (Object.hasOwn(variant, key)) return { problem: `la proprietà "${key}" compare due volte` };
    variant[key] = value;
  }
  return { label, variant };
}

/** Una cella pronta per la scrittura: il board, il nome in Penpot e i valori di variante. */
export interface PlannedCell {
  readonly id: string;
  readonly name: string;
  readonly variant: Readonly<Record<string, string>>;
}

/**
 * Il piano di `group_variants` deciso dal nucleo. `write` è vero solo per
 * `raggruppato`: `già raggruppato` e `singolo` non producono nessuna scrittura.
 */
export interface GroupVariantsPlan {
  readonly outcome: GroupVariantsOutcome;
  readonly write: boolean;
  /** Il nome del contratto (kebab). */
  readonly component: string;
  /** Il nome del container in Penpot. */
  readonly container?: string;
  readonly axes: readonly string[];
  readonly cells: readonly PlannedCell[];
  /** Le celle della matrice non disegnate (solo per `raggruppato`). */
  readonly notDrawn?: readonly string[];
}

export interface PlanGroupVariantsInput {
  /** I contratti; di default `COMPONENT_CONTRACTS`. */
  readonly contracts?: ContractRegistry;
}

/**
 * Il passo puro tra la lettura e la scrittura: riceve le celle lette da Penpot
 * e restituisce il piano validato, oppure lancia l'errore che nomina la
 * cella. L'adattatore lo chiama prima di qualunque scrittura.
 */
export type GroupVariantsPlanner = (reading: VariantCellsReading) => GroupVariantsPlan;

const quoted = (name: string): string => `«${name}»`;
const list = (items: readonly string[]): string => `[${items.join(", ")}]`;

/** Una cella letta: il nome, l'etichetta del componente e i valori, senza il controllo della matrice. */
interface ReadCell extends PlannedCell {
  readonly label: string;
}

/** L'indice del valore di un asse nella matrice; `-1` per un valore fuori contratto. */
function rankOf(axis: VariantAxis, value: string): number {
  return axis.values.indexOf(value);
}

/** L'ordine stabile delle celle: i valori nell'ordine degli assi, poi `state`. */
function compareCells(axes: readonly VariantAxis[], a: ReadCell, b: ReadCell): number {
  for (const axis of axes) {
    const diff = rankOf(axis, a.variant[axis.name] ?? axis.base) - rankOf(axis, b.variant[axis.name] ?? axis.base);
    if (diff !== 0) return diff;
  }
  const rank = (cell: ReadCell): number => {
    const state = cell.variant[STATE_AXIS];
    return state === undefined ? 0 : rankOf({ name: STATE_AXIS, values: STATE_VALUES, base: "default" }, state) + 1;
  };
  return rank(a) - rank(b);
}

/** La cella di partenza: tutti gli assi al valore di base e `state=default`. */
function isBaseCell(axes: readonly VariantAxis[], cell: ReadCell): boolean {
  return axes.every((axis) => (cell.variant[axis.name] ?? axis.base) === axis.base) && (cell.variant[STATE_AXIS] ?? "default") === "default";
}

/** Il nome completo di una cella, nell'ordine delle proprietà: `Chip / size=sm, removable=true`. */
function cellName(label: string, properties: readonly string[], variant: Readonly<Record<string, string>>): string {
  return `${label} / ${properties.map((name) => `${name}=${variant[name] ?? ""}`).join(", ")}`;
}

/** `Chip / size=md, removable=false` → la cella, oppure l'errore che la nomina quando il nome è illeggibile. */
function readCell(board: VariantBoard): ReadCell {
  const parsed = parseCellName(board.name);
  if ("problem" in parsed) throw new Error(`group_variants: cella ${quoted(board.name)} — ${parsed.problem}.`);
  return { id: board.id, name: board.name, label: parsed.label, variant: parsed.variant };
}

/**
 * Il piano: nessuna scrittura se il componente è già un container di varianti o
 * non ha niente da raggruppare (una cella sola senza assi, o una matrice di una
 * combinazione sola); altrimenti le celle validate e ordinate, con la matrice
 * completa. Ogni problema è un errore che nomina la cella: nessuna scrittura.
 */
export function planGroupVariants(reading: VariantCellsReading, input: PlanGroupVariantsInput = {}): GroupVariantsPlan {
  const contract = resolveContract(reading.component, input.contracts ?? COMPONENT_CONTRACTS);
  const component = contract.name;
  const axes = variantAxes(contract);
  const axisNames = axes.map((axis) => axis.name);

  // Già raggruppato: il container c'è, non si tocca niente. Gli assi sono i suoi.
  if (reading.container !== undefined) {
    return {
      outcome: "già raggruppato",
      write: false,
      component,
      container: reading.container.name,
      axes: reading.container.properties,
      cells: reading.container.variants.map((variant) => ({ id: variant.id, name: variant.name, variant: variant.variant ?? {} })),
    };
  }

  if (reading.boards.length === 0) {
    const available = reading.available.length === 0 ? "nessuno" : list(reading.available);
    throw new Error(
      `group_variants: nessun componente ${quoted(reading.component)} in Penpot — nessun container (o componente principale) ha il plugin data pagebuilder/contract, e nessuno si chiama così o ha celle «${reading.component} / Axis=Value». Componenti nel file: ${available}.`,
    );
  }

  // Una cella sola con un nome senza proprietà è un componente senza celle: resta
  // singolo (è il caso di Multiselect Panel) e il suo nome non si legge come
  // «Component / Axis=Value», quindi non si valida.
  if (reading.boards.length === 1 && !reading.boards[0]!.name.includes("/")) {
    const [board] = reading.boards;
    return { outcome: "singolo", write: false, component, axes: [], cells: [{ id: board!.id, name: board!.name, variant: {} }] };
  }

  const cells = reading.boards.map(readCell);
  const labels = [...new Set(cells.map((cell) => cell.label))];
  if (labels.length > 1) {
    throw new Error(
      `group_variants: le celle non hanno lo stesso nome di componente: ${list(labels.map(quoted))}. Ogni cella si chiama «Component / Axis=Value» con lo stesso «Component».`,
    );
  }

  // Una matrice di una combinazione sola non è un container di varianti:
  // Penpot ne crea uno solo con almeno due celle.
  if (matrixCombinations(axes).length <= 1) {
    return {
      outcome: "singolo",
      write: false,
      component,
      axes: [],
      cells: cells.map((cell) => ({ id: cell.id, name: cell.name, variant: cell.variant })),
    };
  }

  const label = labels[0]!;
  // Le proprietà del nome: gli assi del contratto, quelli di rendering e, se il
  // disegno ha gli stati, `state` (con `state=default` dove lo stato non c'è).
  const usesState = cells.some((cell) => Object.hasOwn(cell.variant, STATE_AXIS));
  const properties = [...axisNames, ...(usesState ? [STATE_AXIS] : [])];
  const propertySet = new Set(properties);

  const seen = new Map<string, ReadCell>();
  for (const cell of cells) {
    const where = `group_variants: cella ${quoted(cell.name)}`;
    const missing = properties.filter((name) => !Object.hasOwn(cell.variant, name));
    if (missing.length > 0) {
      throw new Error(
        `${where}: mancano le proprietà ${list(missing)}. Ogni cella ha tutte le proprietà del contratto e degli assi di rendering${usesState ? ", più `state` perché il disegno ha gli stati" : ""}: ${list(properties)}.`,
      );
    }
    const extra = Object.keys(cell.variant).filter((name) => !propertySet.has(name));
    if (extra.length > 0) {
      throw new Error(`${where}: le proprietà ${list(extra)} non sono nella matrice. Le proprietà sono ${list(properties)}.`);
    }
    for (const axis of axes) {
      const value = cell.variant[axis.name]!;
      if (rankOf(axis, value) < 0) {
        throw new Error(`${where}: il valore "${value}" è fuori contratto per l'asse "${axis.name}" (ammette ${list(axis.values)}).`);
      }
    }
    if (usesState && !(STATE_VALUES as readonly string[]).includes(cell.variant[STATE_AXIS]!)) {
      throw new Error(`${where}: lo stato "${cell.variant[STATE_AXIS]}" è sconosciuto ("state" ammette ${list(STATE_VALUES)}).`);
    }
    const key = properties.map((name) => cell.variant[name]).join("|");
    const duplicate = seen.get(key);
    if (duplicate !== undefined) {
      throw new Error(`group_variants: le celle ${quoted(duplicate.name)} e ${quoted(cell.name)} hanno gli stessi valori di variante: le varianti sono distinte.`);
    }
    seen.set(key, cell);
  }

  if (cells.length < 2) {
    throw new Error(`group_variants: la cella ${quoted(cells[0]!.name)} è sola: un set ha almeno due celle.`);
  }

  // Le combinazioni non disegnate sono una nota: il disegno può non averle di proposito.
  const drawn = new Set(
    cells.filter((cell) => (cell.variant[STATE_AXIS] ?? "default") === "default").map((cell) => axisNames.map((name) => cell.variant[name]).join("|")),
  );
  const notDrawn: string[] = [];
  for (const combination of matrixCombinations(axes)) {
    const key = axisNames.map((name) => combination[name]).join("|");
    if (drawn.has(key)) continue;
    notDrawn.push(cellName(label, properties, usesState ? { ...combination, [STATE_AXIS]: "default" } : combination));
  }

  const ordered = [...cells].sort((a, b) => {
    const baseA = isBaseCell(axes, a);
    const baseB = isBaseCell(axes, b);
    if (baseA !== baseB) return baseA ? -1 : 1;
    return compareCells(axes, a, b);
  });
  if (!isBaseCell(axes, ordered[0]!)) {
    throw new Error(`group_variants: manca la cella di partenza di ${quoted(label)} (assi al valore di default e state=default).`);
  }

  return {
    outcome: "raggruppato",
    write: true,
    component,
    container: label,
    axes: properties,
    cells: ordered.map(({ id, name, variant }) => ({ id, name, variant })),
    ...(notDrawn.length > 0 ? { notDrawn } : {}),
  };
}

/** Il piano nell'uscita dello strumento: niente campi interni, solo l'esito e lo stato del componente. */
export function groupVariantsResult(plan: GroupVariantsPlan): GroupVariantsResult {
  return {
    outcome: plan.outcome,
    component: plan.component,
    ...(plan.container === undefined ? {} : { container: plan.container }),
    axes: [...plan.axes],
    cells: plan.cells.map((cell) => ({ name: cell.name, variant: { ...cell.variant } })),
    ...(plan.notDrawn === undefined ? {} : { notDrawn: [...plan.notDrawn] }),
  };
}
