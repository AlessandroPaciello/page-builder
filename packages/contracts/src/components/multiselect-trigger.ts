import { z } from "zod";

import { defineContract } from "../contract";

/**
 * Trigger della Multiselect. `placeholder` è opzionale: il layer esiste solo
 * nelle celle `display=placeholder` (campo vuoto). `selected` sono i chip, una
 * parte che si ripete. `state` e `display` (`chips`, `overflow`,
 * `placeholder`) sono assi di rendering o dati: non producono prop.
 */
export const multiselectTrigger = defineContract({
  name: "multiselect-trigger",
  version: 1,
  axes: [{ name: "size", type: "option", values: ["md", "sm"], default: "md" }],
  fields: {
    placeholder: { schema: z.string().optional(), kind: "content" },
    selected: { schema: z.array(z.string()), kind: "content" },
  },
});
