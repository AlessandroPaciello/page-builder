import { shopCard } from "@app/contracts";

import { defineBinding } from "../v3/binding";

/**
 * ShopCard — collegamento Penpot ↔ editor (pds-design [CN], 2026-10-10).
 * Dichiara solo ciò che Penpot non sa o che cambia la struttura del codice:
 * elemento HTML, field che alimentano le parti, il Badge annidato e quando
 * esiste, accessibilità, cartella. Il resto si legge dal container Penpot
 * con plugin data `shop-card@1`.
 */
export const shopCardBinding = defineBinding(shopCard, {
  domain: "commerce",
  a11y: { focusVisible: true },
  parts: {
    root: { element: "a", attribute: { href: "href" } },
    image: { element: "img", attribute: { src: "image", alt: "imageAlt" } },
    title: { element: "h3", content: "heading" },
    category: { content: "category" }, // T6, [MS]: span (default per i testi)
    description: { element: "p", content: "description" },
    action: { component: "badge", when: { promo: ["discount"] }, fields: { label: "badgeLabel" } },
    price: { content: "price" },
    cta: { content: "ctaLabel" },
  },
});
