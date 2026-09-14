// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract alert@1, penpotComponentId c4c28b86-5861-80d2-8008-a2705f0d9e7a, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- Alert

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Alert } from "./Alert";

function declaredAttribute(container: HTMLElement, attribute: string): Element | null {
  const root = container.querySelector('[data-slot="alert"]');
  if (root === null) return null;
  if (attribute === "role") return root.hasAttribute("role") ? root : null;
  return root.hasAttribute(attribute) ? root : root.querySelector("[" + attribute + "]");
}

describe("Alert", () => {
  it("renderizza i campi content", () => {
    const { getByText } = render(<Alert heading="heading" description="description" />);
    expect(getByText("heading")).toBeTruthy();
    expect(getByText("description")).toBeTruthy();
  });

  it("non ha violazioni axe (default)", async () => {
    const { container } = render(<Alert heading="heading" description="description" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("non ha violazioni axe (status=success)", async () => {
    const { container } = render(<Alert status="success" heading="heading" description="description" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("non ha violazioni axe (status=warning)", async () => {
    const { container } = render(<Alert status="warning" heading="heading" description="description" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("non ha violazioni axe (status=error)", async () => {
    const { container } = render(<Alert status="error" heading="heading" description="description" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("porta il role dichiarato (alert)", () => {
    const { container } = render(<Alert heading="heading" description="description" />);
    expect(declaredAttribute(container, "role")?.getAttribute("role")).toBe("alert");
  });
});
