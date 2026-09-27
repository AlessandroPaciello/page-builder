// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract product-card@1, penpotComponentId container-productcard-seed, snapshotHash c5ce5b3bb421).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- ProductCard

import type { Meta, StoryObj } from "@storybook/react";
import { ProductCard } from "./ProductCard";

const meta = { component: ProductCard, title: "Commerce/ProductCard" } satisfies Meta<typeof ProductCard>;
export default meta;

export const None: StoryObj<typeof ProductCard> = { args: { promo: "none", badgeLabel: "Offerta", description: "Descrizione prodotto", href: "https://example.com/p", image: "https://example.com/p.jpg", price: "19,99 €", tags: ["Novità", "Eco"] } };
export const Offer: StoryObj<typeof ProductCard> = { args: { promo: "offer", badgeLabel: "Offerta", description: "Descrizione prodotto", href: "https://example.com/p", image: "https://example.com/p.jpg", price: "19,99 €", tags: ["Novità", "Eco"] } };
export const Discount: StoryObj<typeof ProductCard> = { args: { promo: "discount", badgeLabel: "Offerta", description: "Descrizione prodotto", href: "https://example.com/p", image: "https://example.com/p.jpg", price: "19,99 €", tags: ["Novità", "Eco"] } };
export const EmptyTags: StoryObj<typeof ProductCard> = { args: { promo: "none", badgeLabel: "Offerta", description: "Descrizione prodotto", href: "https://example.com/p", image: "https://example.com/p.jpg", price: "19,99 €", tags: [] } };
