// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract accordion-item@1, penpotComponentId 062d2e96-d208-8096-8008-a0a47165506d, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- AccordionItem

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Root as AccordionRoot } from "@radix-ui/react-accordion";
import type { ReactElement } from "react";
import { AccordionItem } from "./AccordionItem";

function renderInRoot(ui: ReactElement) {
  return render(<AccordionRoot collapsible type="single">{ui}</AccordionRoot>);
}

function declaredAttribute(container: HTMLElement, attribute: string): Element | null {
  const root = container.querySelector('[data-slot="accordion-item"]');
  if (root === null) return null;
  if (attribute === "role") return root.hasAttribute("role") ? root : null;
  return root.hasAttribute(attribute) ? root : root.querySelector("[" + attribute + "]");
}

describe("AccordionItem", () => {
  it("renderizza i campi content dopo l'apertura", () => {
    const { container, getByText } = renderInRoot(<AccordionItem value="item" label="Etichetta" body="Contenuto" />);
    const trigger = container.querySelector('[data-slot="accordion-item-trigger"]');
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);
    expect(getByText("Etichetta")).toBeTruthy();
    expect(getByText("Contenuto")).toBeTruthy();
  });

  it("non ha violazioni axe (default)", async () => {
    const { container } = renderInRoot(<AccordionItem value="item" label="Etichetta" body="Contenuto" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("porta l'attributo dichiarato aria-expanded (dopo l'apertura)", () => {
    const { container } = renderInRoot(<AccordionItem value="item" label="Etichetta" body="Contenuto" />);
    const trigger = container.querySelector('[data-slot="accordion-item-trigger"]');
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);
    expect(declaredAttribute(container, "aria-expanded")).not.toBeNull();
  });

  it("porta l'attributo dichiarato aria-controls (dopo l'apertura)", () => {
    const { container } = renderInRoot(<AccordionItem value="item" label="Etichetta" body="Contenuto" />);
    const trigger = container.querySelector('[data-slot="accordion-item-trigger"]');
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);
    expect(declaredAttribute(container, "aria-controls")).not.toBeNull();
  });
});
