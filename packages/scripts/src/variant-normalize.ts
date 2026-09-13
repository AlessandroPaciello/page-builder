/**
 * Normalizzazione unica di assi e valori di variante verso il contratto
 * (Story 2.8 parte B): gli attriti normali di un file fatto da un designer
 * non tecnico — maiuscole, spazi, ordine degli assi — non fanno fallire la
 * pipeline. Il confronto è per NOME, mai per posizione: trim, spazi interni
 * compressi, senza maiuscole. Un nome o valore senza corrispondenza resta
 * intatto (così resta un "valore in più" per le regole a valle); due nomi
 * o valori diversi che normalizzati coincidono sono una COLLISIONE, un
 * errore nominativo — la pipeline non sceglie al posto del designer.
 */

/** Forma canonica di confronto: trim, spazi compressi, minuscole. */
export function comparable(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface ContractAxesLike {
  readonly axes: readonly { readonly name: string; readonly values: readonly string[] }[];
}

export interface VariantData {
  /** Nomi degli assi, nell'ordine del container. */
  readonly axes: readonly string[];
  /** Valori per asse (chiave = nome d'asse come nel container). */
  readonly axesValues: Readonly<Record<string, readonly string[]>>;
  /** variantProps delle celle (null = board non mappata, lasciata com'è). */
  readonly cells: ReadonlyArray<Readonly<Record<string, string>> | null>;
}

export interface NormalizedVariants {
  /** Assi del contratto trovati (nell'ordine del contratto), poi quelli senza corrispondenza intatti. */
  axes: string[];
  axesValues: Record<string, string[]>;
  cells: Array<Record<string, string> | null>;
  /** Collisioni: errori nominativi (asse o valori che normalizzati coincidono). */
  collisions: string[];
}

function mapper(
  candidates: readonly string[],
  targets: readonly string[],
  describe: (target: string, raws: string[]) => string,
): { map: Map<string, string>; collisions: string[] } {
  const byComparable = new Map(targets.map((target) => [comparable(target), target]));
  const groups = new Map<string, string[]>();
  for (const raw of new Set(candidates)) {
    const target = byComparable.get(comparable(raw));
    if (target === undefined) continue;
    groups.set(target, [...(groups.get(target) ?? []), raw]);
  }
  const map = new Map<string, string>();
  const collisions: string[] = [];
  for (const [target, raws] of groups) {
    if (raws.length > 1) {
      collisions.push(describe(target, raws));
      continue; // collisione: nessuna mappatura, i valori restano intatti
    }
    map.set(raws[0]!, target);
  }
  return { map, collisions };
}

/**
 * Normalizza gli assi di un container verso il contratto. `label` nomina il
 * componente negli errori di collisione.
 */
export function normalizeVariants(label: string, contract: ContractAxesLike, data: VariantData): NormalizedVariants {
  const axisNames = mapper(
    data.axes,
    contract.axes.map((axis) => axis.name),
    (target, raws) =>
      `Componente "${label}": gli assi [${raws.map((raw) => JSON.stringify(raw)).join(", ")}] normalizzati coincidono con l'asse del contratto "${target}" — collisione: rinomina uno dei due in Penpot.`,
  );
  const collisions = [...axisNames.collisions];
  const axisOf = (raw: string): string => axisNames.map.get(raw) ?? raw;

  const valueMaps = new Map<string, Map<string, string>>();
  for (const raw of data.axes) {
    const axis = axisOf(raw);
    const contractAxis = contract.axes.find((candidate) => candidate.name === axis);
    if (contractAxis === undefined || !axisNames.map.has(raw)) continue;
    const values = mapper(
      data.axesValues[raw] ?? [],
      contractAxis.values,
      (target, raws) =>
        `Componente "${label}", asse "${axis}": i valori [${raws.map((value) => JSON.stringify(value)).join(", ")}] normalizzati coincidono con il valore del contratto "${target}" — collisione: tienine uno solo in Penpot.`,
    );
    collisions.push(...values.collisions);
    valueMaps.set(raw, values.map);
  }
  const valueOf = (rawAxis: string, rawValue: string): string => valueMaps.get(rawAxis)?.get(rawValue) ?? rawValue;

  // Assi mappati nell'ordine del contratto (l'ordine di Penpot non conta),
  // poi quelli senza corrispondenza, intatti, nell'ordine del container.
  const mapped = new Set(axisNames.map.values());
  const axes = [
    ...contract.axes.map((axis) => axis.name).filter((name) => mapped.has(name)),
    ...data.axes.filter((raw) => !axisNames.map.has(raw)),
  ];

  const axesValues: Record<string, string[]> = {};
  for (const raw of data.axes) {
    const values = data.axesValues[raw];
    if (values === undefined) continue;
    axesValues[axisOf(raw)] = values.map((value) => valueOf(raw, value));
  }

  const cells = data.cells.map((props) => {
    if (props === null) return null;
    const out: Record<string, string> = {};
    for (const [raw, value] of Object.entries(props)) out[axisOf(raw)] = valueOf(raw, value);
    return out;
  });

  return { axes, axesValues, cells, collisions };
}
