// @generated — DO NOT EDIT BY HAND. Aspetto di ShopCard letto da Penpot (container shop-card@1).
// Regenerate with: node --import tsx src/v3/cli.ts styles ShopCard

import { cva } from "class-variance-authority";

/** Assi del componente: ogni parte li accetta tutti, così un cambio in Penpot non cambia le chiamate. */
export type ShopCardAxes = { size: "default" | "sm"; promo: "none" | "discount" };

/** Classi per parte (token Penpot → Tailwind). */
export const shopCardStyles = {
  root: cva("bg-card border-(length:--border-width-default) border-border flex flex-col items-start overflow-hidden pl-0 pr-0 pt-0 rounded-2xl", {
    variants: {
      size: { default: "gap-y-4 pb-4", sm: "gap-y-3 pb-3" },
      promo: { none: "", discount: "" },
    },
  }),
  image: cva("overflow-hidden rounded-xl self-stretch", {
    variants: {
      size: { default: "h-40", sm: "h-32" },
      promo: { none: "", discount: "" },
    },
  }),
  header: cva("flex flex-col gap-y-1 items-start overflow-hidden pb-0 pt-0 self-stretch", {
    variants: {
      size: { default: "pl-4 pr-4", sm: "pl-3 pr-3" },
      promo: { none: "", discount: "" },
    },
  }),
  category: cva("font-medium font-sans self-stretch text-muted-foreground text-xs tracking-normal", {
    variants: {
      size: { default: "", sm: "" },
      promo: { none: "", discount: "" },
    },
  }),
  title: cva("font-medium font-sans self-stretch text-card-foreground tracking-normal", {
    variants: {
      size: { default: "text-base", sm: "text-sm" },
      promo: { none: "", discount: "" },
    },
  }),
  description: cva("font-normal font-sans self-stretch text-muted-foreground text-sm tracking-normal", {
    variants: {
      size: { default: "", sm: "" },
      promo: { none: "", discount: "" },
    },
  }),
  content: cva("flex flex-1 flex-col items-start overflow-hidden pb-0 pt-0 self-stretch", {
    variants: {
      size: { default: "pl-4 pr-4", sm: "pl-3 pr-3" },
      promo: { none: "", discount: "" },
    },
  }),
  price: cva("font-sans font-semibold self-stretch text-base text-foreground tracking-normal", {
    variants: {
      size: { default: "", sm: "" },
      promo: { none: "", discount: "" },
    },
  }),
  footer: cva("bg-muted flex flex-row items-center overflow-hidden self-stretch", {
    variants: {
      size: { default: "pb-4 pl-4 pr-4 pt-4", sm: "pb-3 pl-3 pr-3 pt-3" },
      promo: { none: "", discount: "" },
    },
  }),
  cta: cva("flex-1 font-medium font-sans text-primary text-sm tracking-normal", {
    variants: {
      size: { default: "", sm: "" },
      promo: { none: "", discount: "" },
    },
  }),
};

/** Varianti scelte in Penpot per i componenti annidati. */
export const shopCardInstances = {
  action: (_axes: ShopCardAxes) => ({"variant":"destructive","size":"sm"}) as const,
};
