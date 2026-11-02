/**
 * Assi di rendering (Story 2.28): proprietà di variante che il disegno usa per
 * mostrare una resa diversa — aperto/chiuso, con o senza la X, selezionato — e
 * che **non** sono scelte dell'editor. Il contratto dell'editor resta `option` +
 * field (AD-11 v3): qui vive l'unica dichiarazione degli assi di rendering, che
 * `verify.ts` consulta prima di bloccare un asse "estraneo" e che i test
 * leggono.
 *
 * La cella con il valore `base` è la cella di partenza; ogni altra cella
 * contribuisce la differenza di classi con il prefisso dell'asse, come `state`
 * fa con `hover:`. Un asse di rendering non produce prop, field né una voce di
 * fingerprint: le pagine salvate non cambiano.
 *
 * Penpot resta la fonte di verità: una voce qui si aggiunge solo quando il
 * disegno ha davvero le celle di quell'asse, mai per far passare un contratto.
 */
export interface RenderingAxis {
  /** Il nome della proprietà di variante in Penpot. */
  readonly name: string;
  /** I valori disegnati, nell'ordine in cui compaiono nella cella di partenza. */
  readonly values: readonly string[];
  /** Il valore della cella di partenza: le altre celle contribuiscono classi prefissate. */
  readonly base: string;
  /**
   * Il prefisso Tailwind delle classi di un valore diverso da `base`.
   * `{value}` è sostituito dal valore: `data-[open={value}]:` dà
   * `data-[open=true]:` sul valore `true`. Senza `{value}` vale così com'è.
   */
  readonly prefix: string;
}

/**
 * Contratto → assi di rendering (decisione 2026-11-01). I sei assi che il
 * disegno vivo della Multiselect usa: `open` e `display` su `multiselect`,
 * `display` su `multiselect-trigger`, `removable` su `chip`, `checked` su
 * `option` e su `checkbox`, `content` su `multiselect-panel`. I valori sono
 * quelli delle celle lette in Penpot (Multiselect: `open` false/true, `display`
 * chips/placeholder; Trigger: `display` chips/overflow/placeholder; Panel:
 * `content` options/empty). `state` non compare qui: è l'asse riservato che il
 * nucleo conosce da sempre (`STATE_AXIS`), `error` compreso. La ricerca
 * (`search`) non è un asse di rendering: è un asse `option` dei contratti
 * `multiselect` e `multiselect-panel` (Story 2.37).
 */
export const RENDERING_AXES: Readonly<Record<string, readonly RenderingAxis[]>> = {
  multiselect: [
    { name: "open", values: ["false", "true"], base: "false", prefix: "data-[open={value}]:" },
    { name: "display", values: ["chips", "placeholder"], base: "chips", prefix: "data-[display={value}]:" },
  ],
  "multiselect-trigger": [{ name: "display", values: ["chips", "overflow", "placeholder"], base: "chips", prefix: "data-[display={value}]:" }],
  "multiselect-panel": [{ name: "content", values: ["options", "empty"], base: "options", prefix: "data-[content={value}]:" }],
  chip: [{ name: "removable", values: ["false", "true"], base: "false", prefix: "data-[removable={value}]:" }],
  option: [{ name: "checked", values: ["false", "true"], base: "false", prefix: "data-[checked={value}]:" }],
  checkbox: [{ name: "checked", values: ["false", "true", "indeterminate"], base: "false", prefix: "data-[checked={value}]:" }],
};

/** Gli assi di rendering dichiarati per un contratto (nessuno se non c'è una voce). */
export function renderingAxesOf(contractName: string): readonly RenderingAxis[] {
  return RENDERING_AXES[contractName] ?? [];
}

/** Il prefisso delle classi di un valore dell'asse (`data-[open=true]:`). */
export function renderingPrefix(axis: RenderingAxis, value: string): string {
  return axis.prefix.replaceAll("{value}", value);
}
