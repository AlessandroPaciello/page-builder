// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract input@1, penpotComponentId 062d2e96-d208-8096-8008-a0a467a00e5a, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- Input

import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

export type InputProps = React.ComponentProps<"input"> & {
  placeholder?: string;
}

function Input({ className, placeholder, ...props }: InputProps) {
  return (
    <input data-slot="input" placeholder={placeholder} className={cn("h-8 w-full min-w-0 border outline-none transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 bg-background border-border pb-2 pl-3 pr-3 pt-2 rounded-md focus-visible:border-ring focus-visible:shadow-ring aria-invalid:border-destructive disabled:border-border placeholder:font-regular placeholder:text-muted-foreground placeholder:text-sm placeholder:tracking-none", className)} {...props} />
  );
}

export { Input };
