import { z } from "zod";

import { defineContract } from "../contract";

/** Gli stati cambiano lo stile in Penpot, ma in codice sono pseudo-classi/attributi: nessuna prop. */
export const input = defineContract({
  name: "input",
  version: 1,
  axes: [{ name: "state", type: "state", values: ["default", "focus", "error", "disabled"], default: "default" }],
  parts: ["root", "placeholder"],
  fields: {
    placeholder: { schema: z.string(), kind: "content" },
  },
});
