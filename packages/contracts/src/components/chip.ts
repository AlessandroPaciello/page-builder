import { z } from "zod";

import { defineContract } from "../contract";

/**
 * Chip: etichetta con rimozione, istanza ripetuta nel trigger della
 * Multiselect. `removable` (con o senza `×`, anche il chip `+N`) è deciso dal
 * componente che lo contiene, non dall'editor: resta una proprietà di
 * rendering in Penpot e non produce prop.
 */
export const chip = defineContract({
  name: "chip",
  version: 1,
  axes: [{ name: "size", type: "option", values: ["md", "sm"], default: "md" }],
  fields: {
    label: { schema: z.string(), kind: "content" },
  },
});
