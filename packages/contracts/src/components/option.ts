import { z } from "zod";

import { defineContract } from "../contract";

/**
 * Option: riga del pannello della Multiselect (checkbox + etichetta). Senza
 * assi: `checked` e `state` sono dati o rendering e restano in Penpot.
 */
export const option = defineContract({
  name: "option",
  version: 1,
  axes: [],
  fields: {
    label: { schema: z.string(), kind: "content" },
  },
});
