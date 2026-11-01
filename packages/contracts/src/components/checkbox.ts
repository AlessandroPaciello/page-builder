import { defineContract } from "../contract";

/**
 * Checkbox: controllo senza testo proprio. `checked` (`false`, `true`,
 * `indeterminate`) e `state` sono dati o rendering e restano in Penpot: il
 * contratto non ha assi né field, esiste perché la pipeline genera ogni
 * componente annidato (Option lo contiene).
 */
export const checkbox = defineContract({
  name: "checkbox",
  version: 1,
  axes: [],
  fields: {},
});
