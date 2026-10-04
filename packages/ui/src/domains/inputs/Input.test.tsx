// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract input@1, penpotComponentId seed-input-2-16, snapshotHash 5b6d690b0623).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Input

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Input } from "./Input";

describe("Input", () => {
  it("porta il placeholder come attributo", () => {
    const { container } = render(<Input placeholder="Segnaposto" />);
    expect(container.querySelector('input[data-slot="input"][placeholder="Segnaposto"]')).not.toBeNull();
  });
  it("porta i data-slot", () => {
    const { container } = render(<Input placeholder="Segnaposto" />);
    expect(container.querySelector('[data-slot="input"]')).not.toBeNull();
  });
  it("esprime gli stati con prefissi (focus-visible:, aria-invalid:)", () => {
    const { container } = render(<Input placeholder="Segnaposto" />);
    const cls = container.querySelector('[data-slot="input"]')?.className ?? "";
    expect(cls).toMatch(/focus-visible:/);
    expect(cls).toMatch(/aria-invalid:/);
  });
  it("non ha violazioni axe (default)", async () => {
    const { container } = render(<Input placeholder="Segnaposto" />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
