// @generated pds 1 sha256:45f6e3b39411f1603948767df6723d41a85136c736ac3309dcb9a5ebc60736b3 — non modificare a mano
import { cva } from "class-variance-authority";

import type { BadgeAxes } from "../badge/Badge.styles";

/** Assi `option` del contratto "shop-card" (v1). */
export type ShopCardAxes = {
  readonly size?: "default" | "sm";
};

/** Le parti: la chiave è il `data-slot` dell'elemento nel TSX. */
export const shopCardParts = ["root", "image", "body", "header", "heading", "price", "description", "tags", "tag", "cta", "label"] as const;

/** Le parti che si ripetono (un `.map` nel TSX, una `cva` sola). */
export const shopCardListParts = ["tag"] as const;

export const shopCardStyles = {
  root: cva("bg-card border-(length:--border-width-default) border-border flex flex-col overflow-hidden rounded-2xl shadow-xs", {
    variants: {
      size: {
        default: "gap-y-3 pb-3 pl-3 pr-3 pt-3",
        sm: "gap-y-2 pb-2 pl-2 pr-2 pt-2",
      },
    },
    defaultVariants: { size: "default" },
  }),
  image: cva("bg-muted rounded-xl self-stretch", {
    variants: {
      size: {
        default: "h-60",
        sm: "h-[200px]",
      },
    },
    defaultVariants: { size: "default" },
  }),
  body: cva("flex flex-col gap-y-2 pb-0 pl-1 pr-1 pt-0 self-stretch", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
    },
    defaultVariants: { size: "default" },
  }),
  header: cva("flex flex-row gap-x-2 items-center justify-between self-stretch", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
    },
    defaultVariants: { size: "default" },
  }),
  heading: cva("font-bold font-sans text-card-foreground tracking-normal", {
    variants: {
      size: {
        default: "h-[22px] text-lg w-[100px]",
        sm: "h-[19px] text-base w-[89px]",
      },
    },
    defaultVariants: { size: "default" },
  }),
  price: cva("", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
    },
    defaultVariants: { size: "default" },
  }),
  description: cva("font-normal font-sans self-stretch text-muted-foreground tracking-normal", {
    variants: {
      size: {
        default: "h-[68px] text-sm",
        sm: "h-14 text-xs",
      },
    },
    defaultVariants: { size: "default" },
  }),
  tags: cva("flex flex-row gap-x-2 items-center self-stretch", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
    },
    defaultVariants: { size: "default" },
  }),
  tag: cva("", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
    },
    defaultVariants: { size: "default" },
  }),
  cta: cva("bg-primary flex flex-row items-center justify-center rounded-full self-stretch", {
    variants: {
      size: {
        default: "pb-3 pl-3 pr-3 pt-3",
        sm: "pb-2 pl-2 pr-2 pt-2",
      },
    },
    defaultVariants: { size: "default" },
  }),
  label: cva("font-sans font-semibold text-primary-foreground tracking-normal", {
    variants: {
      size: {
        default: "h-[19px] text-base w-[86px]",
        sm: "h-[17px] text-sm w-[75px]",
      },
    },
    defaultVariants: { size: "default" },
  }),
};

const shopCardPriceInstances: Readonly<Record<string, BadgeAxes>> = {
  "default": { size: "md", variant: "default" },
  "sm": { size: "sm", variant: "default" },
};

/** Le props di variante delle istanze annidate, per gli assi del componente. */
export const shopCardInstances = {
  price: (axes: ShopCardAxes = {}): BadgeAxes => shopCardPriceInstances[[axes.size ?? "default"].join("|")] ?? {},
  tag: (_axes: ShopCardAxes = {}): BadgeAxes => ({ size: "sm", variant: "secondary" }),
};
