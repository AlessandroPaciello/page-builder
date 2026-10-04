import { z } from "zod";

import { defineContract } from "../contract";

/**
 * ProductCard (Story 2.12, primo contratto ridotto della v2): SOLO ciò che
 * l'editor e le pagine salvate usano. Niente parti, ruoli o assi di
 * rendering: stanno nel contratto di estrazione
 * (`packages/scripts/src/contracts/product-card.extract.ts`).
 *
 * `badgeLabel` è un field del page builder (decisione dello SPEC v2): il
 * testo del badge (`Offerta`/`Sconto`) lo scrive l'editor, non è testo
 * statico del contratto di estrazione. È obbligatorio come gli altri field,
 * anche con `promo=none` (il badge non si rende e il valore resta inerte).
 */
export const productCard = defineContract({
  name: "product-card",
  version: 1,
  axes: [{ name: "promo", type: "option", values: ["none", "offer", "discount"], default: "none" }],
  fields: {
    image: { schema: z.url(), kind: "content" },
    price: { schema: z.string(), kind: "content" },
    description: { schema: z.string(), kind: "content" },
    tags: { schema: z.array(z.string()), kind: "content" },
    href: { schema: z.url(), kind: "content" },
    badgeLabel: { schema: z.string(), kind: "content" },
  },
});
