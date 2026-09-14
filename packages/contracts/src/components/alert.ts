import { z } from "zod";

import { defineContract } from "../contract";

/**
 * Lo stato si comunica con testo + colore, mai solo col colore: `heading`
 * porta il testo, il colore arriva dalla cella dello stato. Il field si chiama
 * `heading` e non `title`, che è un attributo HTML globale.
 */
export const alert = defineContract({
  name: "alert",
  version: 1,
  axes: [{ name: "status", type: "option", values: ["info", "success", "warning", "error"], default: "info" }],
  parts: ["root", "heading", "description"],
  fields: {
    heading: { schema: z.string(), kind: "content" },
    description: { schema: z.string(), kind: "content" },
  },
});
