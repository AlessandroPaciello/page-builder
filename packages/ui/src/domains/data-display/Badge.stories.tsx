// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract badge@1, penpotComponentId seed-badge-2-16, snapshotHash dbb9e4da76a2).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Badge

// Giudizio visivo — Alessandro (Story 2-16, CAP-11): story navigabile in
// Storybook con addon a11y, token dal registro, nessun difetto bloccante.

import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta = { component: Badge, title: "DataDisplay/Badge" } satisfies Meta<typeof Badge>;
export default meta;

export const VariantDefault: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "default", size: "md" } };
export const VariantSecondary: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "secondary", size: "md" } };
export const VariantDestructive: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "destructive", size: "md" } };
export const SizeSm: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "default", size: "sm" } };
export const SizeMd: StoryObj<typeof Badge> = { args: { label: "Etichetta", variant: "default", size: "md" } };
