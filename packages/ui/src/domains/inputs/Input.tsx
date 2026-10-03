// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract input@1, penpotComponentId seed-input-2-16, snapshotHash 5b6d690b0623).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Input

import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

export type InputProps = React.ComponentProps<"input"> & {
  placeholder?: string;
};

function Input({ className, placeholder = "", ...props }: InputProps) {
  return (
    <input data-slot="input" placeholder={placeholder} {...props} className={cn("bg-background border-border pb-2 pl-3 pr-3 pt-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:border-ring focus-visible:shadow-ring aria-invalid:border-destructive", className)} />
  );
}

export { Input };
