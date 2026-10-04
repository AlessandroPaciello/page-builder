// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract badge@1, penpotComponentId seed-badge-2-16, snapshotHash dbb9e4da76a2).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Badge

import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

export type BadgeProps = React.ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "destructive";
  size?: "sm" | "md";
  label?: string;
};

const rootVariantClasses = {
  "variant=default|size=md": "bg-primary flex flex-row items-center pb-1 pl-3 pr-3 pt-1 rounded-full",
  "variant=default|size=sm": "bg-primary flex flex-row items-center pb-1 pl-2 pr-2 pt-1 rounded-full",
  "variant=destructive|size=md": "bg-destructive flex flex-row items-center pb-1 pl-3 pr-3 pt-1 rounded-full",
  "variant=destructive|size=sm": "bg-destructive flex flex-row items-center pb-1 pl-2 pr-2 pt-1 rounded-full",
  "variant=secondary|size=md": "bg-secondary flex flex-row items-center pb-1 pl-3 pr-3 pt-1 rounded-full",
  "variant=secondary|size=sm": "bg-secondary flex flex-row items-center pb-1 pl-2 pr-2 pt-1 rounded-full",
} as const;

const labelVariantClasses = {
  "variant=default|size=md": "font-medium text-primary-foreground text-sm tracking-none",
  "variant=default|size=sm": "font-medium text-primary-foreground text-xs tracking-none",
  "variant=destructive|size=md": "font-medium text-destructive-foreground text-sm tracking-none",
  "variant=destructive|size=sm": "font-medium text-destructive-foreground text-xs tracking-none",
  "variant=secondary|size=md": "font-medium text-secondary-foreground text-sm tracking-none",
  "variant=secondary|size=sm": "font-medium text-secondary-foreground text-xs tracking-none",
} as const;

function Badge({ className, variant = "default", size = "md", label = "", ...props }: BadgeProps) {
  const key = `variant=${variant}|size=${size}` as keyof typeof rootVariantClasses;
  return (
    <span data-slot="badge" {...props} className={cn(rootVariantClasses[key], className)}>
      <span data-slot="badge-label" className={labelVariantClasses[key as unknown as keyof typeof labelVariantClasses]}>
        {label}
      </span>
    </span>
  );
}

export { Badge };
