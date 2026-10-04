// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract badge@1, penpotComponentId seed-badge-2-16, snapshotHash dbb9e4da76a2).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Badge

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renderizza il campo label", () => {
    const { getByText } = render(<Badge label="Etichetta" variant="default" size="md" />);
    expect(getByText("Etichetta")).toBeTruthy();
  });
  it("porta i data-slot e il layout dal layer Penpot (flex)", () => {
    const { container } = render(<Badge label="Etichetta" variant="default" size="md" />);
    expect(container.querySelector('[data-slot="badge"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="badge-label"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="badge"]')?.className).toMatch(/flex/);
    expect(container.querySelector('[data-slot="badge"]')?.className).toMatch(/items-center/);
  });
  it("varia con variant e size senza cva", () => {
    const { container } = render(<Badge label="Etichetta" variant="destructive" size="sm" />);
    expect(container.querySelector('[data-slot="badge"]')?.className).toMatch(/bg-destructive/);
  });
  it("non ha violazioni axe (default)", async () => {
    const { container } = render(<Badge label="Etichetta" variant="default" size="md" />);
    expect((await axe(container)).violations).toEqual([]);
  });
  it("non ha violazioni axe (varianti)", async () => {
    for (const props of [{ variant: "secondary", size: "md" }, { variant: "destructive", size: "sm" }] as const) {
      const { container, unmount } = render(<Badge label="Etichetta" {...props} />);
      expect((await axe(container)).violations).toEqual([]);
      unmount();
    }
  });
});
