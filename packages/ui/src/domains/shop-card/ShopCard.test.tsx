import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ShopCard, type ShopCardProps } from "./ShopCard";

afterEach(() => {
  cleanup();
});

const FIELDS: ShopCardProps = {
  size: "default",
  promo: "discount",
  href: "https://shop.example.com/prodotti/1",
  image: "https://images.example.com/prodotti/1.jpg",
  imageAlt: "Scarpe comode, paio 1",
  category: "Scarpe",
  heading: "Scarpe comode",
  description: "Scarpe comode per ogni giorno.",
  price: "€ 49,90",
  badgeLabel: "Offerta",
  ctaLabel: "Scopri",
};

describe("ShopCard", () => {
  it("tutta la card è il link, con immagine e alt dal field", () => {
    const { container } = render(
      <main>
        <ShopCard {...FIELDS} />
      </main>,
    );
    const root = container.querySelector('[data-slot="shop-card"]');
    expect(root?.tagName.toLowerCase()).toBe("a");
    expect(root?.getAttribute("href")).toBe(FIELDS.href);
    const image = container.querySelector('[data-slot="image"]');
    expect(image?.getAttribute("src")).toBe(FIELDS.image);
    expect(image?.getAttribute("alt")).toBe(FIELDS.imageAlt);
  });

  it("con promo=discount mostra il Badge col testo del field", () => {
    const { container } = render(
      <main>
        <ShopCard {...FIELDS} />
      </main>,
    );
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("data-slot")).toBe("badge");
    expect(screen.getByText("Offerta").getAttribute("data-slot")).toBe("label");
  });

  it("con promo=none il Badge non esiste e badgeLabel resta inerte", () => {
    const { container } = render(
      <main>
        <ShopCard {...FIELDS} promo="none" />
      </main>,
    );
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
    expect(screen.queryByText("Offerta")).toBeNull();
  });

  it("mostra le parti del disegno con i field", () => {
    const { container } = render(
      <main>
        <ShopCard {...FIELDS} />
      </main>,
    );
    for (const [slot, text] of [
      ["category", FIELDS.category],
      ["title", FIELDS.heading],
      ["description", FIELDS.description],
      ["price", FIELDS.price],
      ["cta", FIELDS.ctaLabel],
    ] as const) {
      expect(container.querySelector(`[data-slot="${slot}"]`)?.textContent).toBe(text);
    }
    expect(container.querySelector('[data-slot="title"]')?.tagName.toLowerCase()).toBe("h3");
  });

  it("il nome accessibile del link contiene il testo visibile della Cta", () => {
    render(
      <main>
        <ShopCard {...FIELDS} />
      </main>,
    );
    expect(screen.getByRole("link").textContent).toContain(FIELDS.ctaLabel);
  });

  it("non ha violazioni axe", async () => {
    render(
      <main>
        <ShopCard {...FIELDS} />
        <ShopCard {...FIELDS} promo="none" />
      </main>,
    );
    expect((await axe(document.body)).violations).toEqual([]);
  });
});
