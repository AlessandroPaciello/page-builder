import { badge, defineContract, type ComponentContract } from "@app/contracts";
import { z } from "zod";

import type { Cella, Lettura, LetturaLayer, Scale, TokenType } from "../../src/core";

/**
 * Letture scritte a mano per i test del nucleo (Story 2.22, livello 1): Badge
 * (contratto vero di `@app/contracts`) e ShopCard⊃Badge (contratto di prova,
 * scritto qui: `@app/contracts` non ha una ShopCard e la story non lo tocca).
 */

export const shopCard = defineContract({
  name: "shop-card",
  version: 1,
  axes: [{ name: "promo", type: "option", values: ["none", "offer"], default: "none" }],
  fields: {
    price: { schema: z.string(), kind: "content" },
    heading: { schema: z.string(), kind: "content" },
    note: { schema: z.string().optional(), kind: "content" },
  },
});

export const CONTRACTS: Readonly<Record<string, ComponentContract>> = { badge, "shop-card": shopCard };

export const SCALE: Scale = [
  { suffix: "1", px: 4 },
  { suffix: "2", px: 8 },
  { suffix: "3", px: 12 },
  { suffix: "4", px: 16 },
];

const TOKEN_TYPES: Readonly<Record<string, TokenType>> = {
  primary: "color",
  "primary-foreground": "color",
  secondary: "color",
  destructive: "color",
  accent: "color",
  muted: "color",
  "spacing.1": "spacing",
  "spacing.2": "spacing",
  "spacing.3": "spacing",
  "text.xs": "fontSizes",
  "text.sm": "fontSizes",
};

export const tokenTypeOf = (name: string): TokenType | undefined => TOKEN_TYPES[name];

export function layer(partial: Partial<LetturaLayer> & { name: string }): LetturaLayer {
  return { kind: "rect", tokens: {}, style: {}, children: [], ...partial };
}

export const VARIANTS = ["default", "secondary", "destructive"] as const;
export const SIZES = ["sm", "md"] as const;

const FILL: Readonly<Record<string, string>> = { default: "primary", secondary: "secondary", destructive: "destructive" };
const PADDING: Readonly<Record<string, string>> = { sm: "spacing.2", md: "spacing.3" };

/** La radice di una cella di Badge: colore dalla variante, padding dalla taglia, un testo `label`. */
export function badgeRoot(variant: string, size: string, children?: LetturaLayer[]): LetturaLayer {
  return layer({
    name: "Badge",
    kind: "board",
    tokens: { fill: FILL[variant]!, paddingLeft: PADDING[size]! },
    style: { layoutDir: "row" },
    children: children ?? [
      layer({ name: "Testo", kind: "text", pluginData: { part: "label" }, tokens: { fill: "primary-foreground", fontSize: size === "sm" ? "text.xs" : "text.sm" }, style: {} }),
    ],
  });
}

/** Badge con le sei celle complete; `children` sostituisce i figli della radice in ogni cella. */
export function badgeLettura(children?: () => LetturaLayer[]): Lettura {
  const cells: Cella[] = [];
  for (const variant of VARIANTS) for (const size of SIZES) cells.push({ variant: { variant, size }, root: badgeRoot(variant, size, children?.()) });
  return { component: "Badge", pluginData: { contract: "badge@1" }, cells };
}

/** Il layer dell'istanza di Badge dentro ShopCard. */
export function badgeInstance(variant: Record<string, string> = { variant: "destructive" }, overrides: string[] = []): LetturaLayer {
  return layer({
    name: "Action",
    kind: "board",
    pluginData: { part: "action" },
    style: { sizingH: "auto" },
    instance: { component: "Badge", variant, overrides },
    // I figli di un'istanza non si visitano: un layer senza chiave qui non dà domande.
    children: [layer({ name: "Senza chiave", kind: "text" })],
  });
}

/** ShopCard⊃Badge: un titolo, un prezzo e l'istanza `action`. */
export function shopCardLettura(instance: (promo: string) => LetturaLayer = () => badgeInstance()): Lettura {
  return {
    component: "ShopCard",
    pluginData: { contract: "shop-card" },
    cells: (["none", "offer"] as const).map((promo) => ({
      variant: { promo },
      root: layer({
        name: "Shop Card",
        kind: "board",
        tokens: { fill: promo === "offer" ? "accent" : "muted" },
        style: { layoutDir: "column" },
        children: [
          layer({ name: "Heading", kind: "text", pluginData: { part: "heading", element: "h3" }, tokens: { fontSize: "text.sm" } }),
          layer({ name: "Price", kind: "text", pluginData: { part: "price" }, tokens: { fontSize: "text.xs" } }),
          instance(promo),
        ],
      }),
    })),
  };
}
