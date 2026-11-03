// Scaffold di pds: da qui in poi questo file è dello sviluppatore e la rigenerazione non lo tocca.
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";
import { Badge } from "../badge/Badge";
import { type ShopCardAxes, shopCardInstances, shopCardStyles as s } from "./ShopCard.styles";

export type ShopCardFields = {
  readonly href: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly category: string;
  readonly heading: string;
  readonly description: string;
  readonly price: string;
  readonly badgeLabel: string;
  readonly ctaLabel: string;
};

export type ShopCardProps = Omit<ComponentProps<"a">, keyof ShopCardAxes | keyof ShopCardFields> & ShopCardAxes & ShopCardFields;

/**
 * ShopCard (Story 2.40): la card del disegno Penpot, con il Badge come istanza
 * annidata. Tutta la card è il link (`href`), quindi la radice è un `a`: la Cta
 * resta il testo che lo comunica, senza un secondo controllo focalizzabile.
 * `h-auto` è la resa della card in pagina: l'altezza la decide il contenuto, non
 * la misura fissa della cella di Penpot. Con `promo="discount"` compare
 * l'istanza Badge (variante e misura dal generatore, testo dal field); con
 * `promo="none"` `badgeLabel` resta inerte.
 */
export function ShopCard({
  className,
  size,
  promo = "none",
  href,
  image,
  imageAlt,
  category,
  heading,
  description,
  price,
  badgeLabel,
  ctaLabel,
  ...props
}: ShopCardProps) {
  const axes = { size, promo };
  return (
    <a data-slot="shop-card" href={href} className={cn(s.root(axes), "h-auto", className)} {...props}>
      <img data-slot="image" className={s.image(axes)} src={image} alt={imageAlt} />
      <div data-slot="header" className={s.header(axes)}>
        {promo === "discount" && (
          <Badge className={s.action(axes)} {...shopCardInstances.action(axes)} label={badgeLabel} />
        )}
        <span data-slot="category" className={s.category(axes)}>{category}</span>
        <h3 data-slot="title" className={s.title(axes)}>{heading}</h3>
        <span data-slot="description" className={s.description(axes)}>{description}</span>
      </div>
      <div data-slot="content" className={s.content(axes)}>
        <span data-slot="price" className={s.price(axes)}>{price}</span>
      </div>
      <div data-slot="footer" className={s.footer(axes)}>
        <span data-slot="cta" className={s.cta(axes)}>{ctaLabel}</span>
      </div>
    </a>
  );
}
