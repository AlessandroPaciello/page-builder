// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract alert@1, penpotComponentId seed-alert-2-16, snapshotHash e2cb5e617929).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Alert

// Giudizio visivo — Alessandro (Story 2-16, CAP-11): story navigabile in
// Storybook con addon a11y, token dal registro, nessun difetto bloccante.

import type { Meta, StoryObj } from "@storybook/react";
import { Alert } from "./Alert";

const meta = { component: Alert, title: "Feedback/Alert" } satisfies Meta<typeof Alert>;
export default meta;

export const StatusInfo: StoryObj<typeof Alert> = { args: { status: "info", heading: "Titolo", description: "Descrizione" } };
export const StatusSuccess: StoryObj<typeof Alert> = { args: { status: "success", heading: "Titolo", description: "Descrizione" } };
export const StatusWarning: StoryObj<typeof Alert> = { args: { status: "warning", heading: "Titolo", description: "Descrizione" } };
export const StatusError: StoryObj<typeof Alert> = { args: { status: "error", heading: "Titolo", description: "Descrizione" } };
