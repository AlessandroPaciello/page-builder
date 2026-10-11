import { shopCard } from "@app/contracts";

import { defineExtraction } from "../extraction";

/**
 * Contratto di estrazione della ShopCard (spike 2026-10-10). Parti dalla
 * ricetta shadcn Card `base-nova` (`_bmad-output/spikes/penpot-ai-kit-2026-10-10/recipes/card.md`):
 * header/title/description/action/content/footer, più l'immagine in testa
 * (`has-[>img:first-child]` nella ricetta). Il badge di sconto è un'istanza del
 * Badge nello slot `action`, solo con `promo=discount` (`when`). La card intera è un
 * link al prodotto; il titolo è `<h3>` invece del `<div>` della ricetta.
 *
 * Celle attese = `size × promo` = 4.
 */
export const shopCardExtraction = defineExtraction(shopCard, {
  penpot: { container: "ShopCard" },
  render: { domain: "commerce", headless: null },
  parts: {
    root: { role: "surface", element: "a", attribute: { href: "href" } },
    image: { role: "image", element: "img", parent: "root", attribute: { src: "image", alt: "imageAlt" } },
    header: { role: "surface", element: "div", parent: "root" },
    title: { role: "text", element: "h3", parent: "header", content: "heading" },
    description: { role: "text", element: "p", parent: "header", content: "description" },
    // Composizione (spike): istanza del Badge; variante scelta in Penpot (D1), testo dal field (D3).
    action: { role: "surface", element: "span", parent: "header", when: { promo: ["discount"] }, component: "badge", fields: { label: "badgeLabel" } },
    content: { role: "surface", element: "div", parent: "root" },
    price: { role: "text", element: "span", parent: "content", content: "price" },
    footer: { role: "surface", element: "div", parent: "root" },
    cta: { role: "text", element: "span", parent: "footer", content: "ctaLabel" },
  },
  a11y: { role: null, focusVisible: true },
});

export default shopCardExtraction;
