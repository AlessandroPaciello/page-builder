import { z } from "zod";

import type { SectionDefinition, SectionNode } from "../section";

/**
 * Carousel: la sezione di prova della Story 2.27. `perView` è un field
 * `structure` con uno schema enum: in Penpot le celle disegnate con quel nome
 * diventano l'asse delle varianti. `autoplay`, `interval` e `label` li imposta
 * chi compone la pagina. `label` è il nome accessibile della regione.
 *
 * Lo slot `slides` ammette `product-card`; i tre figli di default sono gli
 * esempi che finiscono nella story (e che in Penpot restano esempi, mai parti).
 */
const slide = (n: number): SectionNode => ({
  id: `slide-${n}`,
  component: "product-card",
  props: {
    image: `https://images.example.com/prodotti/${n}.jpg`,
    price: "€ 49,90",
    description: "Scarpe comode per ogni giorno.",
    tags: ["nuovo", "bio"],
    href: `https://shop.example.com/prodotti/${n}`,
    badgeLabel: "Offerta",
  },
});

export const carousel: SectionDefinition = {
  name: "carousel",
  version: 1,
  fields: {
    perView: { schema: z.enum(["1", "2", "3"]).default("3"), kind: "structure" },
    autoplay: { schema: z.boolean().default(false), kind: "content" },
    interval: { schema: z.number().int().min(2).max(15).default(5), kind: "content" }, // secondi
    label: { schema: z.string().min(1), kind: "content" },
  },
  root: {
    id: "root",
    component: "carousel",
    props: { perView: "3", autoplay: false, interval: 5, label: "Prodotti in evidenza" },
    slot: "slides",
    children: [slide(1), slide(2), slide(3)],
  },
  slots: [{ id: "slides", allow: ["product-card"] }],
};
