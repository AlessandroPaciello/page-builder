import { z } from "zod";

import { defineContract } from "../contract";

/**
 * ShopCard (spike 2026-10-10, nome di lavoro della ProductCard derivata dalla
 * ricetta shadcn Card `base-nova`): SOLO ciò che l'editor e le pagine salvate
 * usano. `size` viene dalla ricetta; `promo` decide se il badge di sconto
 * esiste (parte condizionale). `href` ammette link relativi; `image` e
 * `badgeLabel` sono facoltativi.
 */
export const shopCard = defineContract({
  name: "shop-card",
  version: 1,
  axes: [
    { name: "size", type: "option", values: ["default", "sm"], default: "default" },
    { name: "promo", type: "option", values: ["none", "discount"], default: "none" },
  ],
  fields: {
    href: { schema: z.string().min(1), kind: "content" }, // link anche relativi (/prodotti/…)
    image: { schema: z.url().optional(), kind: "content" }, // scheda valida anche senza immagine
    imageAlt: { schema: z.string(), kind: "content" },
    heading: { schema: z.string(), kind: "content" },
    category: { schema: z.string(), kind: "content" }, // T6: parte aggiunta dal designer in Penpot
    description: { schema: z.string(), kind: "content" },
    price: { schema: z.string(), kind: "content" },
    badgeLabel: { schema: z.string().optional(), kind: "content" }, // serve solo con promo=discount
    ctaLabel: { schema: z.string(), kind: "content" },
  },
});
