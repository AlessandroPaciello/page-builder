import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Chip } from "./Chip";

afterEach(() => {
  cleanup();
});

describe("Chip", () => {
  it("con removable la croce è un pulsante con il nome accessibile", () => {
    render(
      <main>
        <Chip label="React" removable onRemove={() => {}} />
      </main>,
    );
    const remove = screen.getByRole("button", { name: "Rimuovi React" });
    expect(remove.getAttribute("type")).toBe("button");
  });

  it("il click sulla croce chiama onRemove", () => {
    const onRemove = vi.fn();
    render(
      <main>
        <Chip label="React" removable onRemove={onRemove} />
      </main>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi React" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("senza removable non esiste nessun pulsante", () => {
    render(
      <main>
        <Chip label="React" />
      </main>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("con removable ma senza onRemove la croce resta un'icona non interattiva", () => {
    const { container } = render(
      <main>
        <Chip label="React" removable />
      </main>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    const cross = container.querySelector('[data-slot="icon-x"]');
    expect(cross?.tagName.toLowerCase()).toBe("svg");
    expect(cross?.getAttribute("aria-hidden")).toBe("true");
  });

  it("il Chip removable non ha violazioni axe", async () => {
    render(
      <main>
        <Chip label="React" removable onRemove={() => {}} />
      </main>,
    );
    expect((await axe(document.body)).violations).toEqual([]);
  });
});
