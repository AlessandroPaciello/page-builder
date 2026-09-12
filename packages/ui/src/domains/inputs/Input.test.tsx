// @generated — DO NOT EDIT BY HAND.
// Source: pipeline fixture → ricetta → emitter shadcn (contract input@1, penpotComponentId 062d2e96-d208-8096-8008-a0a467a00e5a, fixtureHash 4c74af97e6a4).
// Regenerate with: pnpm --filter @penpot-ds/scripts render:component -- Input

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Input } from "./Input";

describe("Input", () => {
  it("renderizza i campi content", () => {
    const { getByPlaceholderText } = render(<Input placeholder="Segnaposto" />);
    expect(getByPlaceholderText("Segnaposto")).toBeTruthy();
  });

  it("non ha violazioni axe (default)", async () => {
    const { container } = render(<Input placeholder="Segnaposto" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("non ha violazioni axe (state=error)", async () => {
    const { container } = render(<Input aria-invalid placeholder="Segnaposto" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("non ha violazioni axe (state=disabled)", async () => {
    const { container } = render(<Input disabled placeholder="Segnaposto" />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
