// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract badge@1, penpotComponentId 062d2e96-d208-8096-8008-a0a45aefa682, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- Badge

import { cn } from "@penpot-ds/ui/lib/utils";
import { cva } from "class-variance-authority";
import * as React from "react";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center overflow-hidden border border-transparent whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 bg-primary pb-1 pl-3 pr-3 pt-1 rounded-full",
  {
    variants: {
      variant: {
        default: "",
        secondary: "bg-secondary",
        destructive: "bg-destructive",
      },
      size: {
        sm: "pl-2 pr-2",
        md: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

const badgeLabelVariants = cva(
  "font-medium text-primary-foreground text-sm tracking-none",
  {
    variants: {
      variant: {
        default: "",
        secondary: "text-secondary-foreground",
        destructive: "text-destructive-foreground",
      },
      size: {
        sm: "text-xs",
        md: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "destructive";
  size?: "sm" | "md";
  label?: string;
}

function Badge({ className, variant, size, label, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props}>
      <span data-slot="badge-label" className={badgeLabelVariants({ variant, size })}>
        {label}
      </span>
    </span>
  );
}

export { Badge, badgeVariants, badgeLabelVariants };
