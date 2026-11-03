import { z } from "zod";

import { defineContract } from "../contract";

/**
 * ShopCard (Story 2.40): il contratto scritto dalla forma disegnata in Penpot
 * (strada dal design, CD), al posto della vecchia card della v2. Un asse
 * `option` — `size` — e i field che scrive chi compone la pagina. `price` è il
 * testo dell'istanza Badge `Price`, sempre visibile; `tags` è l'elenco dei
 * testi della parte ripetuta (`Tag`: una cva, un `.map`). Il passaggio dei
 * valori ai Badge sta nel TSX (AD-5).
 */
export const shopCard = defineContract({
  name: "shop-card",
  version: 1,
  axes: [{ name: "size", type: "option", values: ["default", "sm"], default: "default" }],
  fields: {
    href: { schema: z.url(), kind: "content" },
    image: { schema: z.url(), kind: "content", sample: "https://picsum.photos/seed/shop-card/800/600" },
    imageAlt: { schema: z.string(), kind: "content" },
    heading: { schema: z.string(), kind: "content" },
    description: { schema: z.string(), kind: "content" },
    price: { schema: z.string(), kind: "content" },
    tags: { schema: z.array(z.string()), kind: "content", sample: ["Novità", "Disponibile"] },
    ctaLabel: { schema: z.string(), kind: "content" },
  },
});
