// Scaffold di pds: da qui in poi questo file è dello sviluppatore e la rigenerazione non lo tocca.
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";
import { type BadgeAxes, badgeStyles as s } from "./Badge.styles";

export type BadgeFields = {
  readonly label: string;
};

export type BadgeProps = Omit<ComponentProps<"span">, keyof BadgeAxes | keyof BadgeFields> & BadgeAxes & BadgeFields;

/**
 * Badge (Story 2.40): la pillola del disegno Penpot. Non è interattivo — il
 * contenitore decide se e cosa fare al click — quindi resta uno `span` con il
 * suo `data-slot`. `w-fit` è la resa della radice hug del disegno: senza, il
 * `flex` occupa tutta la riga. Il testo è uno `span`, non un `label`: senza un
 * controllo da etichettare un `label` è semantica sbagliata.
 */
export function Badge({ className, variant, size, label, ...props }: BadgeProps) {
  const axes = { variant, size };
  return (
    <span data-slot="badge" className={cn(s.root(axes), "w-fit", className)} {...props}>
      <span data-slot="label" className={s.label(axes)}>{label}</span>
    </span>
  );
}
