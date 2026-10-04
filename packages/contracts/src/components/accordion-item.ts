import { z } from "zod";

import { defineContract } from "../contract";

/**
 * AccordionItem ridotto (Story 2.16, v2): `closed`/`open` è comportamento
 * dell'headless (`data-state`), asse di RENDERING (`behavior`) nel contratto
 * di estrazione (`packages/scripts/src/contracts/accordion-item.extract.ts`).
 * Le parti sono piatte: in Penpot `label`/`chevron` stanno dentro `trigger` e
 * `body` dentro `content`, ma quell'annidamento è layout, non una parte con
 * assi propri.
 */
export const accordionItem = defineContract({
  name: "accordion-item",
  version: 1,
  axes: [],
  fields: {
    label: { schema: z.string(), kind: "content" },
    body: { schema: z.string(), kind: "content" },
  },
});
