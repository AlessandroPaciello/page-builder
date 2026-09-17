// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract badge@1, penpotComponentId 062d2e96-d208-8096-8008-a0a45aefa682, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- Badge

import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta = { component: Badge, title: "Data Display/Badge" } satisfies Meta<typeof Badge>;
export default meta;

export const VariantDefault: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "default" } };
export const VariantSecondary: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "secondary" } };
export const VariantDestructive: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "destructive" } };
export const SizeSm: StoryObj<typeof Badge> = { args: { label: "Etichetta", size: "sm" } };
export const SizeMd: StoryObj<typeof Badge> = { args: { label: "Etichetta", size: "md" } };
