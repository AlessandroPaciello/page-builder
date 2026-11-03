// Scaffold di pds: da qui in poi questo file è dello sviluppatore e la rigenerazione non lo tocca.
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";
import { Badge } from "../badge/Badge";
import { type ShopCardAxes, shopCardInstances, shopCardStyles as s } from "./ShopCard.styles";

export type ShopCardFields = {
  readonly href: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly heading: string;
  readonly description: string;
  readonly price: string;
  readonly tags: readonly string[];
  readonly ctaLabel: string;
};

export type ShopCardProps = Omit<ComponentProps<"a">, keyof ShopCardAxes | keyof ShopCardFields> & ShopCardAxes & ShopCardFields;

/**
 * ShopCard (Story 2.40): la card del disegno Penpot, con il Badge `Price` come
 * istanza annidata e i tag come parte ripetuta (`Tag`, una cva sola): i testi
 * arrivano dai field `price` e `tags` (un `.map`, una Badge per ogni voce).
 * Tutta la card è il link (`href`),
 * quindi la radice è un `a`: la Cta resta il testo che lo comunica, senza un
 * secondo controllo focalizzabile. `h-auto` è la resa della card in pagina:
 * l'altezza la decide il contenuto, non la misura fissa della cella di Penpot.
 */
export function ShopCard({
  className,
  size,
  href,
  image,
  imageAlt,
  heading,
  description,
  price,
  tags,
  ctaLabel,
  ...props
}: ShopCardProps) {
  const axes = { size };
  return (
    <a data-slot="shop-card" href={href} className={cn(s.root(axes), "h-auto", className)} {...props}>
      <img data-slot="image" className={cn(s.image(axes), "object-cover")} src={image} alt={imageAlt} />
      <div data-slot="body" className={s.body(axes)}>
        <div data-slot="header" className={s.header(axes)}>
          <h3 data-slot="heading" className={s.heading(axes)}>{heading}</h3>
          <Badge className={s.price(axes)} {...shopCardInstances.price(axes)} label={price} />
        </div>
        <p data-slot="description" className={s.description(axes)}>{description}</p>
        <div data-slot="tags" className={s.tags(axes)}>
          {tags.map((label, index) => (
            <Badge key={`${label}-${index}`} className={s.tag(axes)} {...shopCardInstances.tag(axes)} label={label} />
          ))}
        </div>
      </div>
      <span data-slot="cta" className={s.cta(axes)}>
        <span data-slot="label" className={s.label(axes)}>{ctaLabel}</span>
      </span>
    </a>
  );
}
