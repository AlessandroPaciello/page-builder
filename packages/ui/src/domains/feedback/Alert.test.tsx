// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract alert@1, penpotComponentId seed-alert-2-16, snapshotHash e2cb5e617929).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- Alert

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Alert } from "./Alert";

describe("Alert", () => {
  it("renderizza heading e description", () => {
    const { getByText } = render(<Alert status="info" heading="Titolo" description="Descrizione" />);
    expect(getByText("Titolo")).toBeTruthy();
    expect(getByText("Descrizione")).toBeTruthy();
  });
  it("emette role per variante (info→status, warning→alert)", () => {
    const info = render(<Alert status="info" heading="T" description="D" />);
    expect(info.container.querySelector('[data-slot="alert"]')?.getAttribute("role")).toBe("status");
    const warning = render(<Alert status="warning" heading="T" description="D" />);
    expect(warning.container.querySelector('[data-slot="alert"]')?.getAttribute("role")).toBe("alert");
  });
  it("porta i data-slot", () => {
    const { container } = render(<Alert status="info" heading="T" description="D" />);
    expect(container.querySelector('[data-slot="alert-heading"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="alert-description"]')).not.toBeNull();
  });
  it("non ha violazioni axe (info e warning)", async () => {
    const info = render(<Alert status="info" heading="Titolo" description="Descrizione" />);
    expect((await axe(info.container)).violations).toEqual([]);
    const warning = render(<Alert status="warning" heading="Titolo" description="Descrizione" />);
    expect((await axe(warning.container)).violations).toEqual([]);
  });
});
