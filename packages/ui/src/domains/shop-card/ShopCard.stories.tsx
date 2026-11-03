// @generated pds 1 sha256:2127d3aa32fea5adc8adcb84f7dbe212b13d0045b2e2183b29052a8550146ea3 — non modificare a mano
import type { Meta, StoryObj } from "@storybook/react";

import { ShopCard } from "./ShopCard";

const meta = { title: "Domains/ShopCard", component: ShopCard } satisfies Meta<typeof ShopCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DefaultNone: Story = { args: { size: "default", promo: "none", href: "href", image: "image", imageAlt: "imageAlt", category: "category", heading: "heading", description: "description", price: "price", badgeLabel: "badgeLabel", ctaLabel: "ctaLabel" } };
export const DefaultDiscount: Story = { args: { size: "default", promo: "discount", href: "href", image: "image", imageAlt: "imageAlt", category: "category", heading: "heading", description: "description", price: "price", badgeLabel: "badgeLabel", ctaLabel: "ctaLabel" } };
export const SmNone: Story = { args: { size: "sm", promo: "none", href: "href", image: "image", imageAlt: "imageAlt", category: "category", heading: "heading", description: "description", price: "price", badgeLabel: "badgeLabel", ctaLabel: "ctaLabel" } };
export const SmDiscount: Story = { args: { size: "sm", promo: "discount", href: "href", image: "image", imageAlt: "imageAlt", category: "category", heading: "heading", description: "description", price: "price", badgeLabel: "badgeLabel", ctaLabel: "ctaLabel" } };
