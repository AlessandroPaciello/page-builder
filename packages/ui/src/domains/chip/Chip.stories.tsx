// @generated pds 1 sha256:b0aff143eb6e901695bca3db4cee9e41d95cc244d98291dd0b4696c696d4d694 — non modificare a mano
import type { Meta, StoryObj } from "@storybook/react";

import { Chip } from "./Chip";

const meta = { title: "Domains/Chip", component: Chip } satisfies Meta<typeof Chip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Md: Story = { args: { size: "md", label: "label" } };
export const Sm: Story = { args: { size: "sm", label: "label" } };
