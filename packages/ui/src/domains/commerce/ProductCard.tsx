// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract product-card@1, penpotComponentId container-productcard-seed, snapshotHash c5ce5b3bb421).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- ProductCard

import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

export type ProductCardProps = React.ComponentProps<"a"> & {
  promo?: "none" | "offer" | "discount";
  badgeLabel?: string;
  description?: string;
  href?: string;
  image?: string;
  price?: string;
  tags?: string[];
}

function ProductCard({ className, promo = "none", badgeLabel = "", description = "", href = "", image = "", price = "", tags = [], ...props }: ProductCardProps) {
  return (
    <a data-slot="product-card" href={href} {...props} className={cn("bg-card border-border pb-4 pl-4 pr-4 pt-4 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2", className)}>
      <div data-slot="product-card-media" className="bg-muted rounded-md">
        <img data-slot="product-card-image" src={image} className="rounded-md" alt="" />
        {(promo === "offer" || promo === "discount") && (
          <span data-slot="product-card-badge" className="bg-primary pb-1 pl-2 pr-2 pt-1 rounded-full">
            <span data-slot="product-card-badgeLabel" className="font-medium text-primary-foreground text-xs tracking-none">
              {badgeLabel}
            </span>
          </span>
        )}
      </div>
      <div data-slot="product-card-body" className="bg-card gap-y-3 pb-4 pl-4 pr-4 pt-4">
        <span data-slot="product-card-price" className="font-bold text-foreground text-lg tracking-none">
          {price}
        </span>
        <p data-slot="product-card-description" className="font-regular text-muted-foreground text-sm tracking-none">
          {description}
        </p>
        <ul data-slot="product-card-tags" className="gap-x-2 gap-y-2">
          {tags.map((item) => (
            <li key={item} data-slot="product-card-tag" className="bg-secondary pb-1 pl-2 pr-2 pt-1 rounded-full">
              <span data-slot="product-card-tagLabel" className="font-medium text-secondary-foreground text-xs tracking-none">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </a>
  );
}

export { ProductCard };
