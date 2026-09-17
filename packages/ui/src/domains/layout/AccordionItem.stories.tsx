// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract accordion-item@1, penpotComponentId 062d2e96-d208-8096-8008-a0a47165506d, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- AccordionItem

import type { Meta, StoryObj } from "@storybook/react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { AccordionItem } from "./AccordionItem";

const meta = { component: AccordionItem, title: "Layout/AccordionItem" } satisfies Meta<typeof AccordionItem>;
export default meta;

export const Default: StoryObj<typeof AccordionItem> = { args: { value: "item", label: "Etichetta", body: "Contenuto" }, decorators: [(Story) => (<AccordionPrimitive.Root collapsible type="single"><Story /></AccordionPrimitive.Root>)] };
