import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Badge } from "./Badge";

afterEach(() => {
  cleanup();
});

describe("Badge", () => {
  it("mostra l'etichetta come testo, non come controllo", () => {
    render(
      <main>
        <Badge label="Offerta" />
      </main>,
    );
    expect(screen.getByText("Offerta").tagName.toLowerCase()).toBe("span");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("la radice è la parte badge e resta larga quanto il contenuto", () => {
    const { container } = render(
      <main>
        <Badge label="Offerta" variant="destructive" size="sm" />
      </main>,
    );
    const root = container.querySelector('[data-slot="badge"]');
    expect(root?.tagName.toLowerCase()).toBe("span");
    expect(root?.className).toContain("w-fit");
    expect(root?.querySelector('[data-slot="label"]')?.textContent).toBe("Offerta");
  });

  it("non ha violazioni axe", async () => {
    render(
      <main>
        <Badge label="Offerta" variant="destructive" size="sm" />
      </main>,
    );
    expect((await axe(document.body)).violations).toEqual([]);
  });
});
