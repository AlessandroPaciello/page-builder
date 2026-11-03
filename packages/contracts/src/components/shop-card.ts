import { z } from "zod";

import { defineContract } from "../contract";

/**
 * ShopCard (Story 2.40): il contratto scritto dalla forma disegnata in Penpot
 * (strada dal design, CD), al posto della vecchia card della v2. Un asse
 * `option` — `size` — e i field che scrive chi compone la pagina. `price`,
 * `tagLabel` e `stockLabel` sono i testi delle tre istanze Badge (`Price`,
 * `Tag`, `Stock`), sempre visibili; il passaggio dei valori ai Badge sta nel
 * TSX (AD-5).
 */
export const shopCard = defineContract({
  name: "shop-card",
  version: 1,
  axes: [{ name: "size", type: "option", values: ["default", "sm"], default: "default" }],
  fields: {
    href: { schema: z.url(), kind: "content" },
    image: { schema: z.url(), kind: "content" },
    imageAlt: { schema: z.string(), kind: "content" },
    heading: { schema: z.string(), kind: "content" },
    description: { schema: z.string(), kind: "content" },
    price: { schema: z.string(), kind: "content" },
    tagLabel: { schema: z.string(), kind: "content" },
    stockLabel: { schema: z.string(), kind: "content" },
    ctaLabel: { schema: z.string(), kind: "content" },
  },
});
