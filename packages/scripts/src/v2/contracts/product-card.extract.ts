import { productCard } from "@app/contracts";

import { defineExtraction } from "../extraction";

/**
 * Contratto di estrazione della ProductCard (Story 2.12, prima prova del
 * modello v2; dalla simulazione della forge del 2026-09-16). Il testo del
 * badge NON è statico: è il field `badgeLabel` del page builder, reso come
 * contenuto della parte `badgeLabel` (decisione dello SPEC v2).
 *
 * Celle attese = `promo × hover` = 6. `badge` e `badgeLabel` obbligatorie in
 * 4 celle, vietate in 2 (`when`). `tag` si ripete per ogni elemento di
 * `tags`: il primo layer è il modello, gli altri devono avere gli stessi
 * token. `badge` è sovrapposto all'immagine dentro `media` (posizione
 * assoluta letta da Penpot): `img` è un elemento void e non ha figli.
 */
export const productCardExtraction = defineExtraction(productCard, {
  penpot: { container: "ProductCard" },
  render: { domain: "commerce", headless: null },
  axes: { hover: { type: "state", values: ["off", "on"], default: "off" } },
  parts: {
    root: { role: "surface", element: "a", attribute: { href: "href" } },
    // `img` è void: il badge sovrapposto sta accanto all'immagine dentro `media`, non dentro `img`.
    media: { role: "surface", element: "div", parent: "root" },
    image: { role: "image", element: "img", parent: "media", attribute: { src: "image" } },
    badge: { role: "surface", element: "span", parent: "media", when: { promo: ["offer", "discount"] } },
    badgeLabel: { role: "text", element: "span", parent: "badge", layer: "Badge/Label", content: "badgeLabel" },
    body: { role: "surface", element: "div", parent: "root" },
    price: { role: "text", element: "span", parent: "body", content: "price" },
    description: { role: "text", element: "p", parent: "body", content: "description" },
    tags: { role: "surface", element: "ul", parent: "body" },
    tag: { role: "surface", element: "li", parent: "tags", repeat: "tags" },
    tagLabel: { role: "text", element: "span", parent: "tag", layer: "Tag/Label", content: "$item" },
  },
  a11y: { role: null, focusVisible: true },
});

export default productCardExtraction;
