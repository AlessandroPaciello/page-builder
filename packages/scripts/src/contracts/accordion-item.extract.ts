import { accordionItem } from "@app/contracts";

import { defineExtraction } from "../extraction";

/**
 * Contratto di estrazione dell'AccordionItem (Story 2.16, CAP-11, ultimo):
 * dai file v1 cancellati (judgment + binding dalla storia git: dominio
 * `layout`, 7 parti piatte, asse `state` di tipo `behavior` con
 * `closed`/`open`). L'asse è di RENDERING (`behavior`, nessuna prop) e vive
 * qui. L'headless è Base UI (decisione ACCORDION-BASEUI dello SPEC, coerente
 * con DROPDOWN-BASEUI): `@base-ui/react`, non Radix.
 *
 * Celle attese = `state` (`behavior`) = 2 (`closed`, `open`). Parti:
 * `root`/`trigger`/`content` headless (`Item`/`Trigger`/`Content`),
 * `label`/`body` testo dai field, `chevron` icona, `divider` separatore.
 * Le parti sono piatte in Penpot (`label`/`chevron` dentro `trigger`, `body`
 * dentro `content`), ma l'annidamento è layout, non assi propri.
 */
export const accordionItemExtraction = defineExtraction(accordionItem, {
  penpot: { container: "AccordionItem" },
  render: {
    domain: "layout",
    headless: { package: "@base-ui/react", parts: { root: "Item", trigger: "Trigger", content: "Panel" } },
  },
  axes: { state: { type: "behavior", values: ["closed", "open"], default: "closed" } },
  parts: {
    root: { role: "surface", element: "div" },
    trigger: { role: "surface", element: "button", parent: "root" },
    label: { role: "text", element: "span", parent: "trigger", content: "label" },
    chevron: { role: "icon", element: "span", parent: "trigger" },
    content: { role: "surface", element: "div", parent: "root" },
    body: { role: "text", element: "div", parent: "content", content: "body" },
    divider: { role: "divider", element: "div", parent: "content" },
  },
  a11y: { role: null, focusVisible: true },
});

export default accordionItemExtraction;
