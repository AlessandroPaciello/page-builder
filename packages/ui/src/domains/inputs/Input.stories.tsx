// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract input@1, penpotComponentId seed-input-2-16, snapshotHash 5b6d690b0623).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Input

// Giudizio visivo — Alessandro (Story 2-16, CAP-11): story navigabile in
// Storybook con addon a11y, token dal registro, nessun difetto bloccante.

import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";

const meta = { component: Input, title: "Inputs/Input" } satisfies Meta<typeof Input>;
export default meta;

export const Default: StoryObj<typeof Input> = { args: { placeholder: "Segnaposto" } };
export const Disabled: StoryObj<typeof Input> = { args: { placeholder: "Segnaposto", disabled: true } };
