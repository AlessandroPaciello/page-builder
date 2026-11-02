// Scaffold di pds: da qui in poi questo file è dello sviluppatore e la rigenerazione non lo tocca.
import type { ComponentProps } from "react";
import { Plus, X } from "lucide-react";

import { cn } from "../../lib/utils";
import { type ChipAxes, chipStyles as s } from "./Chip.styles";

export type ChipFields = {
  readonly label: string;
};

export type ChipProps = Omit<ComponentProps<"div">, keyof ChipAxes | keyof ChipFields> &
  ChipAxes &
  ChipFields & {
    /** Asse di rendering `removable` (Penpot): con la croce invece del più. */
    readonly removable?: boolean;
  };

export function Chip({ className, size, label, removable = false, ...props }: ChipProps) {
  const axes = { size };
  return (
    <div data-slot="chip" data-removable={removable} className={cn(s.root(axes), "w-fit", className)} {...props}>
      {!removable && (
        <Plus
          data-slot="icon-plus"
          aria-hidden
          absoluteStrokeWidth
          strokeWidth={1.5}
          className={cn(s["plus-path"](axes), "size-3")}
        />
      )}
      <label data-slot="label" className={s.label(axes)}>{label}</label>
      {removable && (
        <X
          data-slot="icon-x"
          aria-hidden
          absoluteStrokeWidth
          strokeWidth={1.5}
          className={cn(s["plus-path"](axes), "size-3")}
        />
      )}
    </div>
  );
}
