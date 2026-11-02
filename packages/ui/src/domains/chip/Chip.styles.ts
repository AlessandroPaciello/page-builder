// @generated pds 1 sha256:5c1fb0651412ea92de5d55b51f2e41349ad671da2f9b50855a441c51dd25f98c — non modificare a mano
import { cva } from "class-variance-authority";

/** Assi `option` del contratto "chip" (v1). */
export type ChipAxes = {
  readonly size?: "md" | "sm";
};

/** Le parti: la chiave è il `data-slot` dell'elemento nel TSX. */
export const chipParts = ["root", "icon-plus", "plus-path", "label", "icon-x", "x-path"] as const;

/** Le parti che si ripetono (un `.map` nel TSX, una `cva` sola). */
export const chipListParts = ["plus-path", "x-path"] as const;

export const chipStyles = {
  root: cva("bg-secondary flex flex-row gap-x-1 items-center pl-2 pr-2 rounded-sm", {
    variants: {
      size: {
        md: "data-[removable=true]:gap-x-2 pb-1 pt-1",
        sm: "pb-px pt-px",
      },
    },
    defaultVariants: { size: "md" },
  }),
  "icon-plus": cva("", {
    variants: {
      size: {
        md: "h-[5px] w-[5px]",
        sm: "h-[7px] w-[7px]",
      },
    },
    defaultVariants: { size: "md" },
  }),
  "plus-path": cva("h-[0.01px] stroke-secondary-foreground", {
    variants: {
      size: {
        md: "w-[5px]",
        sm: "w-[7px]",
      },
    },
    defaultVariants: { size: "md" },
  }),
  label: cva("font-medium font-sans text-secondary-foreground text-xs", {
    variants: {
      size: {
        md: "",
        sm: "",
      },
    },
    defaultVariants: { size: "md" },
  }),
  "icon-x": cva("", {
    variants: {
      size: {
        md: "",
        sm: "",
      },
    },
    defaultVariants: { size: "md" },
  }),
  "x-path": cva("", {
    variants: {
      size: {
        md: "",
        sm: "",
      },
    },
    defaultVariants: { size: "md" },
  }),
};
