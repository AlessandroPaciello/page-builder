import { z } from "zod";

import { defineContract } from "../contract";

/**
 * Multiselect: composizione di `multiselect-trigger` e `multiselect-panel`
 * (istanze annidate nel disegno). Nell'editor è **un blocco solo**: i contratti
 * dei figli restano componenti della pipeline, quindi i field di contenuto che
 * il designer disegna nei figli — `placeholder` e `selected` nel trigger,
 * `options`, `searchPlaceholder` e `emptyLabel` nel pannello — si ripetono qui,
 * dove chi compone la pagina li edita. Il passaggio ai figli è nel TSX dello
 * sviluppatore, non nel contratto. `helper` è un layer proprio della
 * Multiselect (il testo di aiuto). `open`, `state` e `display` sono assi di
 * rendering o dati in Penpot e non producono prop. `search` (Story 2.37) è
 * invece una scelta dell'editor: asse `option` con default `false`, disegnato
 * sulla composizione e passato al pannello, che espone lo stesso asse.
 */
export const multiselect = defineContract({
  name: "multiselect",
  version: 1,
  axes: [
    { name: "size", type: "option", values: ["md", "sm"], default: "md" },
    { name: "search", type: "option", values: ["false", "true"], default: "false" },
  ],
  fields: {
    helper: { schema: z.string().optional(), kind: "content" },
    placeholder: { schema: z.string().optional(), kind: "content" },
    selected: { schema: z.array(z.string()), kind: "content" },
    options: { schema: z.array(z.string()), kind: "content" },
    searchPlaceholder: { schema: z.string().optional(), kind: "content" },
    emptyLabel: { schema: z.string().optional(), kind: "content" },
  },
});
