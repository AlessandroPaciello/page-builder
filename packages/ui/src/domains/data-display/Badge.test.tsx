// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract badge@1, penpotComponentId 062d2e96-d208-8096-8008-a0a45aefa682, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- Badge

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renderizza i campi content", () => {
    const { getByText } = render(<Badge label="Etichetta" />);
    expect(getByText("Etichetta")).toBeTruthy();
  });

  it("non ha violazioni axe (default)", async () => {
    const { container } = render(<Badge label="Etichetta" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("non ha violazioni axe (variant=secondary)", async () => {
    const { container } = render(<Badge variant="secondary" label="Etichetta" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("non ha violazioni axe (variant=destructive)", async () => {
    const { container } = render(<Badge variant="destructive" label="Etichetta" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("non ha violazioni axe (size=sm)", async () => {
    const { container } = render(<Badge size="sm" label="Etichetta" />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
