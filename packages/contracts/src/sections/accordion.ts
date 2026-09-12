import { z } from "zod";

import type { SectionDefinition } from "../section";

/**
 * Accordion Root: un albero di AccordionItem, non un contratto di componente
 * né una ricetta. Il nodo radice è la sezione stessa (vedi `section.ts`).
 */
export const accordion: SectionDefinition = {
  name: "accordion",
  version: 1,
  fields: {
    type: { schema: z.enum(["single", "multiple"]).default("single"), kind: "structure" },
  },
  root: {
    id: "root",
    component: "accordion",
    props: { type: "single" },
    slot: "items",
    children: [
      { id: "item-1", component: "accordion-item", props: { label: "Titolo della voce", body: "Testo della voce." } },
      { id: "item-2", component: "accordion-item", props: { label: "Titolo della voce", body: "Testo della voce." } },
    ],
  },
  slots: [{ id: "items", allow: ["accordion-item"] }],
};
