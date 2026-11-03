// @generated pds 1 sha256:947443bf6039ac9b055799333897545f8235fabb65dc6414ace68231ae08d4a0 — non modificare a mano
import type { Meta, StoryObj } from "@storybook/react";

import { ShopCard } from "./ShopCard";

const meta = { title: "Domains/ShopCard", component: ShopCard } satisfies Meta<typeof ShopCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { decorators: [(Story) => <div style={{ width: 288 }}><Story /></div>], args: { size: "default", href: "href", image: "https://picsum.photos/seed/shop-card/800/600", imageAlt: "imageAlt", heading: "heading", description: "description", price: "price", tags: ["Novità","Disponibile"], ctaLabel: "ctaLabel" } };
export const Sm: Story = { decorators: [(Story) => <div style={{ width: 240 }}><Story /></div>], args: { size: "sm", href: "href", image: "https://picsum.photos/seed/shop-card/800/600", imageAlt: "imageAlt", heading: "heading", description: "description", price: "price", tags: ["Novità","Disponibile"], ctaLabel: "ctaLabel" } };
