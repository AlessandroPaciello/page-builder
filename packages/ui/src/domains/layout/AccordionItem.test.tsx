// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract accordion-item@1, penpotComponentId seed-accordionitem-2-16, snapshotHash 763d0076e7e6).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- AccordionItem

import { fireEvent, render } from "@testing-library/react";
import { Accordion } from "@base-ui/react/accordion";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import type { ReactElement } from "react";
import { AccordionItem } from "./AccordionItem";

function renderInRoot(ui: ReactElement) {
  return render(<Accordion.Root>{ui}</Accordion.Root>);
}

describe("AccordionItem", () => {
  it("renderizza label e body dopo l'apertura", () => {
    const { getByText, container } = renderInRoot(<AccordionItem value="item" label="Etichetta" body="Contenuto" />);
    const trigger = container.querySelector('[data-slot="accordion-item-trigger"]');
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);
    expect(getByText("Etichetta")).toBeTruthy();
    expect(getByText("Contenuto")).toBeTruthy();
  });
  it("usa Base UI (Accordion.Item/Trigger/Panel), non Radix", async () => {
    const { container } = renderInRoot(<AccordionItem value="item" label="Etichetta" body="Contenuto" />);
    expect(container.querySelector('[data-slot="accordion-item"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="accordion-item-trigger"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-slot="accordion-item-trigger"]')!);
    expect(container.querySelector('[data-slot="accordion-item-content"]')).not.toBeNull();
  });
  it("non ha violazioni axe (default)", async () => {
    const { container } = renderInRoot(<AccordionItem value="item" label="Etichetta" body="Contenuto" />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
