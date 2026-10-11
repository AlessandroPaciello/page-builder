import { z } from "zod";

import type { SectionDefinition } from "../section";

/**
 * Carousel (spike 2026-10-11, pds-design [CN] dalla ricetta shadcn Carousel):
 * una sezione con uno slot di ShopCard. `perView` cambia il disegno (in Penpot
 * è l'asse delle celle); `autoplay`, `interval` e `label` li imposta chi
 * compone la pagina. `label` è il nome accessibile della regione.
 */
const slide = (n: number) => ({
  id: `slide-${n}`,
  component: "shop-card",
  props: {
    href: `/prodotti/esempio-${n}`,
    imageAlt: "Foto del prodotto",
    heading: "Nome prodotto",
    category: "Scarpe",
    description: "Descrizione breve del prodotto.",
    price: "€ 49,90",
    ctaLabel: "Vedi prodotto",
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
  slots: [{ id: "slides", allow: ["shop-card"] }],
};
