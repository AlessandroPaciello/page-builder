// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract accordion-item@1, penpotComponentId seed-accordionitem-2-16, snapshotHash 763d0076e7e6).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- AccordionItem

// Giudizio visivo — Alessandro (Story 2-16, CAP-11): story navigabile in
// Storybook con addon a11y, token dal registro, nessun difetto bloccante.

import type { Meta, StoryObj } from "@storybook/react";
import { Accordion } from "@base-ui/react/accordion";
import { AccordionItem } from "./AccordionItem";

const meta = { component: AccordionItem, title: "Layout/AccordionItem" } satisfies Meta<typeof AccordionItem>;
export default meta;

export const Default: StoryObj<typeof AccordionItem> = { args: { value: "item", label: "Etichetta", body: "Contenuto" }, decorators: [(Story) => (<Accordion.Root><Story /></Accordion.Root>)] };
