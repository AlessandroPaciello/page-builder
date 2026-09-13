/**
 * Quali assi influenzano una proprietà di una parte (Story 2.6, estratta in
 * Story 2.7 parte C): per ogni asse si raggruppano le celle che differiscono
 * SOLO per quell'asse; se in un gruppo la proprietà assume più valori, l'asse
 * la influenza. Una proprietà assente in una cella vale `<assente>`.
 *
 * Funzione pura, condivisa da `computePartClasses` (emitter) e da
 * `adopt:variant`: più di un asse = interazione non esprimibile in
 * cva/prefissi, e ognuno dei due chiamanti produce il suo errore nominativo.
 */

/** Chiave cella `asse=valore|…` → valori per asse. Una chiave malformata è un errore che la nomina. Condivisa con `computePartClasses`. */
export function parseCellKey(key: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const segment of key.split("|")) {
    const [name, value] = segment.split("=");
    if (name === undefined || value === undefined) {
      throw new Error(`chiave cella "${key}" malformata.`);
    }
    out[name] = value;
  }
  return out;
}

export function influencingAxes(
  axes: readonly { readonly name: string }[],
  partCells: Readonly<Record<string, Readonly<Record<string, string>>>>,
  property: string,
): string[] {
  const influencing: string[] = [];
  for (const axis of axes) {
    const others = axes.filter((candidate) => candidate.name !== axis.name);
    const groups = new Map<string, Set<string>>();
    for (const [key, cell] of Object.entries(partCells)) {
      const values = parseCellKey(key);
      const othersKey = others.map((candidate) => `${candidate.name}=${values[candidate.name] ?? ""}`).join("|");
      const group = groups.get(othersKey) ?? new Set<string>();
      group.add(cell[property] ?? "<assente>");
      groups.set(othersKey, group);
    }
    if ([...groups.values()].some((group) => group.size > 1)) influencing.push(axis.name);
  }
  return influencing;
}
