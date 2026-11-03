// @generated pds 1 sha256:c9be03e9000a4db2e07e18a9d094205f8c3ed6dd169f603bc4dcf2e54c7e0ff0 — non modificare a mano
import { cva } from "class-variance-authority";

import type { BadgeAxes } from "../badge/Badge.styles";

/** Assi `option` del contratto "shop-card" (v1). */
export type ShopCardAxes = {
  readonly size?: "default" | "sm";
  readonly promo?: "none" | "discount";
};

/** Le parti: la chiave è il `data-slot` dell'elemento nel TSX. */
export const shopCardParts = ["root", "image", "header", "category", "title", "description", "action", "content", "price", "footer", "cta"] as const;

/** Le parti che si ripetono (un `.map` nel TSX, una `cva` sola). */
export const shopCardListParts = [] as const;

export const shopCardStyles = {
  root: cva("bg-card border-(length:--border-width-default) border-border flex flex-col items-start overflow-hidden pl-0 pr-0 pt-0 rounded-2xl", {
    variants: {
      size: {
        default: "gap-y-4 pb-4",
        sm: "gap-y-3 pb-3",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    compoundVariants: [
      { size: "default", promo: "none", class: "h-[350px]" },
      { size: "default", promo: "discount", class: "h-[376px]" },
      { size: "sm", promo: "none", class: "h-[292px]" },
      { size: "sm", promo: "discount", class: "h-[318px]" },
    ],
    defaultVariants: { size: "default", promo: "none" },
  }),
  image: cva("rounded-xl self-stretch", {
    variants: {
      size: {
        default: "h-40",
        sm: "h-32",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  header: cva("flex flex-col gap-y-1 items-start pb-0 pt-0 self-stretch", {
    variants: {
      size: {
        default: "pl-4 pr-4",
        sm: "pl-3 pr-3",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  category: cva("font-medium font-sans h-[14px] self-stretch text-muted-foreground text-xs tracking-normal", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  title: cva("font-medium font-sans self-stretch text-card-foreground tracking-normal", {
    variants: {
      size: {
        default: "h-[19px] text-base",
        sm: "h-[17px] text-sm",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  description: cva("font-normal font-sans h-[17px] self-stretch text-muted-foreground text-sm tracking-normal", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  action: cva("", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  content: cva("flex flex-1 flex-col items-start pb-0 pt-0 self-stretch", {
    variants: {
      size: {
        default: "pl-4 pr-4",
        sm: "pl-3 pr-3",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  price: cva("font-sans font-semibold h-[19px] self-stretch text-base text-foreground tracking-normal", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  footer: cva("bg-muted flex flex-row items-center self-stretch", {
    variants: {
      size: {
        default: "pb-4 pl-4 pr-4 pt-4",
        sm: "pb-3 pl-3 pr-3 pt-3",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
  cta: cva("flex-1 font-medium font-sans h-[17px] text-primary text-sm tracking-normal", {
    variants: {
      size: {
        default: "",
        sm: "",
      },
      promo: {
        none: "",
        discount: "",
      },
    },
    defaultVariants: { size: "default", promo: "none" },
  }),
};

/** Le props di variante delle istanze annidate, per gli assi del componente. */
export const shopCardInstances = {
  action: (_axes: ShopCardAxes = {}): BadgeAxes => ({ size: "sm", variant: "destructive" }),
};
