import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ShopCard, type ShopCardProps } from "./ShopCard";

afterEach(() => {
  cleanup();
});

const FIELDS: ShopCardProps = {
  size: "default",
  href: "https://shop.example.com/prodotti/1",
  image: "https://images.example.com/prodotti/1.jpg",
  imageAlt: "Scarpe comode, paio 1",
  heading: "Scarpe comode",
  description: "Scarpe comode per ogni giorno.",
  price: "€ 49,90",
  tags: ["Novità", "Disponibile"],
  ctaLabel: "Scopri",
};

const renderCard = (props: Partial<ShopCardProps> = {}) =>
  render(
    <main>
      <ShopCard {...FIELDS} {...props} />
    </main>,
  );

describe("ShopCard", () => {
  it("tutta la card è il link, con immagine e alt dal field", () => {
    const { container } = renderCard();
    const root = container.querySelector('[data-slot="shop-card"]');
    expect(root?.tagName.toLowerCase()).toBe("a");
    expect(root?.getAttribute("href")).toBe(FIELDS.href);
    const image = container.querySelector('[data-slot="image"]');
    expect(image?.getAttribute("src")).toBe(FIELDS.image);
    expect(image?.getAttribute("alt")).toBe(FIELDS.imageAlt);
  });

  it("mostra le parti del disegno con i field", () => {
    const { container } = renderCard();
    for (const [slot, text] of [
      ["heading", FIELDS.heading],
      ["description", FIELDS.description],
    ] as const) {
      expect(container.querySelector(`[data-slot="${slot}"]`)?.textContent).toBe(text);
    }
    expect(container.querySelector('[data-slot="cta"] [data-slot="label"]')?.textContent).toBe(FIELDS.ctaLabel);
    expect(container.querySelector('[data-slot="heading"]')?.tagName.toLowerCase()).toBe("h3");
  });

  it("le istanze Badge mostrano il prezzo e un Badge per ogni tag", () => {
    const { container } = renderCard();
    const badges = [...container.querySelectorAll('[data-slot="badge"]')];
    expect(badges.map((badge) => badge.textContent)).toEqual([FIELDS.price, ...FIELDS.tags]);
  });

  it("il nome accessibile del link contiene il testo visibile della Cta", () => {
    renderCard();
    expect(screen.getByRole("link").textContent).toContain(FIELDS.ctaLabel);
  });

  it("non ha violazioni axe", async () => {
    renderCard();
    expect((await axe(document.body)).violations).toEqual([]);
  });
});
