// @generated — DO NOT EDIT BY HAND. (spike v3)
import type { Meta, StoryObj } from "@storybook/react";

import { ShopCard } from "./ShopCard";

const meta = { component: ShopCard, title: "Commerce/ShopCard" } satisfies Meta<typeof ShopCard>;
export default meta;

const content = { href: "/prodotti/esempio", image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='340'><rect width='100%' height='100%' fill='%23e5e5e5'/></svg>", imageAlt: "Foto del prodotto", heading: "Nome prodotto", category: "Scarpe", description: "Descrizione breve del prodotto.", price: "€ 49,90", badgeLabel: "-20%", ctaLabel: "Vedi prodotto" };

export const DefaultNone: StoryObj<typeof ShopCard> = { args: { ...content, size: "default", promo: "none" } };
export const DefaultDiscount: StoryObj<typeof ShopCard> = { args: { ...content, size: "default", promo: "discount" } };
export const SmNone: StoryObj<typeof ShopCard> = { args: { ...content, size: "sm", promo: "none" } };
export const SmDiscount: StoryObj<typeof ShopCard> = { args: { ...content, size: "sm", promo: "discount" } };
