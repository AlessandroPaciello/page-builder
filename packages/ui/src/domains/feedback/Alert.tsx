// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract alert@1, penpotComponentId c4c28b86-5861-80d2-8008-a2705f0d9e7a, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- Alert

import { cn } from "@penpot-ds/ui/lib/utils";
import { cva } from "class-variance-authority";
import * as React from "react";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current bg-card pb-4 pl-4 pr-4 pt-4 rounded-lg",
  {
    variants: {
      status: {
        info: "",
        success: "",
        warning: "",
        error: "",
      },
    },
    defaultVariants: {
      status: "info",
    },
  },
);

const alertHeadingVariants = cva(
  "col-start-2 line-clamp-1 min-h-4 font-semibold text-info text-sm tracking-none",
  {
    variants: {
      status: {
        info: "",
        success: "text-success",
        warning: "text-warning",
        error: "text-destructive",
      },
    },
    defaultVariants: {
      status: "info",
    },
  },
);

const alertDescriptionVariants = cva(
  "col-start-2 grid justify-items-start gap-1 [&_p]:leading-relaxed font-regular text-card-foreground text-sm tracking-none",
  {
    variants: {
      status: {
        info: "",
        success: "text-card-foreground",
        warning: "text-muted-foreground",
        error: "text-card-foreground",
      },
    },
    defaultVariants: {
      status: "info",
    },
  },
);

export type AlertProps = React.ComponentProps<"div"> & {
  status?: "info" | "success" | "warning" | "error";
  heading?: string;
  description?: string;
}

function Alert({ className, status, heading, description, ...props }: AlertProps) {
  return (
    <div data-slot="alert" className={cn(alertVariants({ status }), className)} role="alert" {...props}>
      <div data-slot="alert-heading" className={cn(alertHeadingVariants({ status }))}>
        {heading}
      </div>
      <div data-slot="alert-description" className={cn(alertDescriptionVariants({ status }))}>
        {description}
      </div>
    </div>
  );
}

export { Alert, alertVariants, alertHeadingVariants, alertDescriptionVariants };
