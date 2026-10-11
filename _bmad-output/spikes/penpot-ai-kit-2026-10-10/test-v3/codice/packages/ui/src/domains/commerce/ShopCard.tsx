// ShopCard — creato da GC (scaffold) il 2026-10-11. Da qui il file è tuo: GC non lo riscrive.
// L'aspetto sta in ShopCard.styles.ts (@generated da Penpot). VC controlla che ogni parte di Penpot abbia il suo data-slot.

import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

import { Badge } from "../data-display";
import { shopCardInstances, shopCardStyles as s } from "./ShopCard.styles";

export type ShopCardProps = Omit<React.ComponentProps<"a">, "href" | "image" | "imageAlt" | "heading" | "category" | "description" | "price" | "badgeLabel" | "ctaLabel" | "size" | "promo"> & {
  size?: "default" | "sm";
  promo?: "none" | "discount";
  href?: string;
  image?: string;
  imageAlt?: string;
  heading?: string;
  category?: string;
  description?: string;
  price?: string;
  badgeLabel?: string;
  ctaLabel?: string;
};

function ShopCard({ className, size = "default", promo = "none", href = "", image, imageAlt = "", heading = "", category = "", description = "", price = "", badgeLabel, ctaLabel = "", ...props }: ShopCardProps) {
  const axes = { size, promo };
  // A mano: immagine rotta → segnaposto invece dell'icona del browser.
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [image]);
  return (
    <a data-slot="shop-card" {...props} href={href} className={cn(s.root(axes), "focus-visible:outline-2 focus-visible:outline-offset-2", className)}>
      {image && !failed && (
        <img data-slot="shop-card-image" src={image} alt={imageAlt} loading="lazy" onError={() => setFailed(true)} className={cn(s.image(axes), "w-full object-cover")} />
      )}
      {image && failed && <div data-slot="shop-card-image-fallback" aria-hidden="true" className={cn(s.image(axes), "aspect-video w-full bg-muted")} />}
      <div data-slot="shop-card-header" className={s.header(axes)}>
        {promo === "discount" && (
          <Badge {...shopCardInstances.action(axes)} label={badgeLabel ?? ""} />
        )}
        <span data-slot="shop-card-category" className={s.category(axes)}>{category}</span>
        <h3 data-slot="shop-card-title" className={s.title(axes)}>{heading}</h3>
        <p data-slot="shop-card-description" className={s.description(axes)}>{description}</p>
      </div>
      <div data-slot="shop-card-content" className={s.content(axes)}>
        <span data-slot="shop-card-price" className={s.price(axes)}>{price}</span>
      </div>
      <div data-slot="shop-card-footer" className={s.footer(axes)}>
        <span data-slot="shop-card-cta" aria-hidden="true" className={s.cta(axes)}>{ctaLabel}</span>
      </div>
    </a>
  );
}

export { ShopCard };
