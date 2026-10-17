import { carousel } from "@app/contracts";

import { defineBinding, sectionContract } from "../v3/binding";

/**
 * Carousel — collegamento Penpot ↔ editor (pds-design [CN], 2026-10-11).
 * Sezione con slot di ShopCard: le slide e i pallini disegnati in Penpot sono
 * esempi; `perView` è l'asse delle celle. Il resto si legge dal container
 * Penpot con plugin data `carousel@1`.
 */
export const carouselBinding = defineBinding(sectionContract(carousel, { axes: ["perView"] }), {
  domain: "layout",
  a11y: { focusVisible: true },
  parts: {
    root: { element: "section", attribute: { "aria-label": "label" } },
    slides: { slot: "slides" },
    dots: { repeat: "slides" },
    previous: { element: "button" },
    next: { element: "button" },
    previousIcon: { icon: "lucide:ChevronLeft" },
    nextIcon: { icon: "lucide:ChevronRight" },
  },
});
