// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract alert@1, penpotComponentId seed-alert-2-16, snapshotHash e2cb5e617929).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Alert

import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

const alertRoles = { info: "status", success: "status", warning: "alert", error: "alert" } as const;

export type AlertProps = React.ComponentProps<"div"> & {
  status?: "info" | "success" | "warning" | "error";
  heading?: string;
  description?: string;
};

const headingVariantClasses = {
  "error": "font-semibold text-destructive text-sm tracking-none",
  "info": "font-semibold text-info text-sm tracking-none",
  "success": "font-semibold text-sm text-success tracking-none",
  "warning": "font-semibold text-sm text-warning tracking-none",
} as const;

const descriptionVariantClasses = {
  "error": "font-regular text-card-foreground text-sm tracking-none",
  "info": "font-regular text-card-foreground text-sm tracking-none",
  "success": "font-regular text-card-foreground text-sm tracking-none",
  "warning": "font-regular text-muted-foreground text-sm tracking-none",
} as const;

function Alert({ className, status = "info", heading = "", description = "", ...props }: AlertProps) {
  return (
    <div data-slot="alert" className={cn("bg-card flex flex-col items-start pb-4 pl-4 pr-4 pt-4 rounded-lg", className)} role={alertRoles[status]} {...props}>
      <div data-slot="alert-heading" className={headingVariantClasses[status]}>
        {heading}
      </div>
      <div data-slot="alert-description" className={descriptionVariantClasses[status]}>
        {description}
      </div>
    </div>
  );
}

export { Alert };
