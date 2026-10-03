import { input } from "@app/contracts";

import { defineExtraction } from "../extraction";

/**
 * Contratto di estrazione dell'Input (Story 2.16, CAP-11): dai file v1
 * cancellati (judgment + binding dalla storia git: dominio `inputs`, headless
 * null, `focusVisible: true`, asse `state` con 4 valori). L'asse `state` è di
 * RENDERING (`state`, nessuna prop): vive qui, non nel page builder.
 *
 * Celle attese = `state` = 4 (`default`, `focus`, `error`, `disabled`). La
 * sola parte è `root` (`input`, `surface`): il field `placeholder` arriva come
 * attributo `placeholder`, gli stati come prefissi (`focus-visible:`,
 * `aria-invalid:`, `disabled:`). Nessuna parte `placeholder` separata: lo
 * styling del placeholder viaggia con la radice (semplificazione v2, nessun
 * confronto con la v1).
 */
export const inputExtraction = defineExtraction(input, {
  penpot: { container: "Input" },
  render: { domain: "inputs", headless: null },
  axes: { state: { type: "state", values: ["default", "focus", "error", "disabled"], default: "default" } },
  parts: {
    root: { role: "surface", element: "input", attribute: { placeholder: "placeholder" } },
  },
  a11y: { role: null, focusVisible: true },
});

export default inputExtraction;
