import { z } from "zod";

import { defineContract } from "../contract";

/**
 * `closed`/`open` è comportamento dell'headless (`data-state`), non una prop.
 * Le parti sono piatte: in Penpot `label`/`chevron` stanno dentro `trigger` e
 * `body` dentro `content`, ma quell'annidamento è layout, non una parte con
 * assi propri.
 */
export const accordionItem = defineContract({
  name: "accordion-item",
  version: 1,
  axes: [{ name: "state", type: "behavior", values: ["closed", "open"], default: "closed" }],
  parts: ["root", "trigger", "label", "chevron", "content", "body", "divider"],
  partRoles: {
    root: "surface",
    trigger: "surface",
    label: "text",
    chevron: "icon",
    content: "surface",
    body: "text",
    divider: "divider",
  },
  fields: {
    label: { schema: z.string(), kind: "content" },
    body: { schema: z.string(), kind: "content" },
  },
});
