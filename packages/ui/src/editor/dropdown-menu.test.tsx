import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

afterEach(() => {
  cleanup();
});

/** Stesso uso dei call site (`mode-toggle`): trigger polimorfico via `render`.
 *  Il `main` dà al contenuto un landmark (la regola axe `region` lo richiede). */
function renderMenu() {
  return render(
    <main>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline">Tema</Button>} />
        <DropdownMenuContent>
          <DropdownMenuItem>Chiaro</DropdownMenuItem>
          <DropdownMenuItem>Scuro</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    </main>,
  );
}

/** Il trigger è il Button (la sua `data-slot="button"` vince per convenzione)
 *  con la semantica del menu di Base UI. */
function trigger() {
  const found = screen.getByRole("button", { name: "Tema" });
  expect(found.getAttribute("aria-haspopup")).toBe("menu");
  return found;
}

describe("DropdownMenu", () => {
  it("il trigger con render prop mantiene l'identità del Button", () => {
    renderMenu();
    const found = trigger();
    expect(found.textContent).toContain("Tema");
    expect(found.getAttribute("class")).toContain("group/button");
  });

  it("apre il menu nel portal con il contenuto", async () => {
    renderMenu();
    expect(document.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull();
    fireEvent.click(trigger());
    expect(await screen.findByText("Chiaro")).toBeTruthy();
    expect(document.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull();
    expect(screen.getByText("Scuro")).toBeTruthy();
  });

  it("naviga con la tastiera e non ha violazioni axe", async () => {
    renderMenu();
    fireEvent.click(trigger());
    const popup = await screen.findByText("Chiaro");
    expect(popup).toBeTruthy();
    fireEvent.keyDown(document.body.querySelector('[data-slot="dropdown-menu-content"]')!, { key: "ArrowDown" });
    expect((await axe(document.body.querySelector('[data-slot="dropdown-menu-content"]')!)).violations).toEqual([]);
  });
});
