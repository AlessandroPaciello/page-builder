// @generated — DO NOT EDIT BY HAND. Aspetto di Carousel letto da Penpot (container carousel@1).
// Regenerate with: node --import tsx src/v3/cli.ts styles Carousel

import { cva } from "class-variance-authority";

/** Assi del componente: ogni parte li accetta tutti, così un cambio in Penpot non cambia le chiamate. */
export type CarouselAxes = { perView: "1" | "2" | "3" };

/** Classi per parte (token Penpot → Tailwind). */
export const carouselStyles = {
  root: cva("flex flex-col gap-y-4 items-center overflow-hidden pb-0 pl-12 pr-12 pt-0 relative", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  previous: cva("-translate-y-1/2 absolute bg-background border-(length:--border-width-default) border-border flex flex-row items-center justify-center left-2 overflow-hidden rounded-full size-8 top-1/2", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  previousIcon: cva("stroke-foreground", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  viewport: cva("flex flex-col items-start overflow-hidden", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  slides: cva("flex flex-row gap-x-4 items-start overflow-hidden", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  slidesItem: cva("*:h-full min-w-0 self-stretch shrink-0", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  dots: cva("flex flex-row gap-x-2 items-center overflow-hidden", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  dotActive: cva("bg-primary rounded-full size-2", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  dot: cva("bg-muted rounded-full size-2", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  next: cva("-translate-y-1/2 absolute bg-background border-(length:--border-width-default) border-border flex flex-row items-center justify-center overflow-hidden right-2 rounded-full size-8 top-1/2", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
  nextIcon: cva("stroke-foreground", {
    variants: {
      perView: { "1": "", "2": "", "3": "" },
    },
  }),
};
