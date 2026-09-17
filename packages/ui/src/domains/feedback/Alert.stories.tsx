// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract alert@1, penpotComponentId c4c28b86-5861-80d2-8008-a2705f0d9e7a, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- Alert

import type { Meta, StoryObj } from "@storybook/react";
import { Alert } from "./Alert";

const meta = { component: Alert, title: "Feedback/Alert" } satisfies Meta<typeof Alert>;
export default meta;

export const StatusInfo: StoryObj<typeof Alert> = { args: { heading: "heading", description: "description", status: "info" } };
export const StatusSuccess: StoryObj<typeof Alert> = { args: { heading: "heading", description: "description", status: "success" } };
export const StatusWarning: StoryObj<typeof Alert> = { args: { heading: "heading", description: "description", status: "warning" } };
export const StatusError: StoryObj<typeof Alert> = { args: { heading: "heading", description: "description", status: "error" } };
