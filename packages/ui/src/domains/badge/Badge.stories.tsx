// @generated pds 1 sha256:31b065fcf7f531fcec3d4cea2adb7b4d57beab81d2b56a0a30916f64568671f5 — non modificare a mano
import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./Badge";

const meta = { title: "Domains/Badge", component: Badge } satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DefaultSm: Story = { args: { variant: "default", size: "sm", label: "label" } };
export const DefaultMd: Story = { args: { variant: "default", size: "md", label: "label" } };
export const SecondarySm: Story = { args: { variant: "secondary", size: "sm", label: "label" } };
export const SecondaryMd: Story = { args: { variant: "secondary", size: "md", label: "label" } };
export const DestructiveSm: Story = { args: { variant: "destructive", size: "sm", label: "label" } };
export const DestructiveMd: Story = { args: { variant: "destructive", size: "md", label: "label" } };
