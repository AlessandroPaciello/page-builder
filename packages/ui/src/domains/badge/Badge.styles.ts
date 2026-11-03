// @generated pds 1 sha256:9ae46e53482f0f791f3364d43c67735d1db08954e06aa0effd564906ab5b19c9 — non modificare a mano
import { cva } from "class-variance-authority";

/** Assi `option` del contratto "badge" (v1). */
export type BadgeAxes = {
  readonly variant?: "default" | "secondary" | "destructive";
  readonly size?: "sm" | "md";
};

/** Le parti: la chiave è il `data-slot` dell'elemento nel TSX. */
export const badgeParts = ["root", "label"] as const;

/** Le parti che si ripetono (un `.map` nel TSX, una `cva` sola). */
export const badgeListParts = [] as const;

export const badgeStyles = {
  root: cva("flex flex-row items-center pb-1 pt-1 rounded-full", {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        destructive: "bg-destructive",
      },
      size: {
        sm: "pl-2 pr-2",
        md: "pl-3 pr-3",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }),
  label: cva("font-medium font-sans tracking-normal", {
    variants: {
      variant: {
        default: "text-primary-foreground",
        secondary: "text-secondary-foreground",
        destructive: "text-destructive-foreground",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }),
};
