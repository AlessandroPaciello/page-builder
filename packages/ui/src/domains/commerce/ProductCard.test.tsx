// @generated — DO NOT EDIT BY HAND.
// Source: pipeline due contratti → istantanea → render (contract product-card@1, penpotComponentId container-productcard-seed, snapshotHash c5ce5b3bb421).
// Regenerate with: pnpm --filter @penpot-ds/scripts render -- ProductCard

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ProductCard } from "./ProductCard";

describe("ProductCard", () => {
  it("renderizza i campi content", () => {
    const { getByText } = render(<ProductCard badgeLabel="Offerta" description="Descrizione prodotto" href="https://example.com/p" image="https://example.com/p.jpg" price="19,99 €" tags={["Novità", "Eco"]} />);
    expect(getByText("19,99 €")).toBeTruthy();
  });
  it("nasconde le parti fuori when con promo=none", () => {
    const { queryByText } = render(<ProductCard badgeLabel="Offerta" description="Descrizione prodotto" href="https://example.com/p" image="https://example.com/p.jpg" price="19,99 €" tags={["Novità", "Eco"]} promo="none" />);
    expect(queryByText("Offerta")).toBeNull();
  });
  it("mostra le parti in when con promo=offer", () => {
    const { getByText } = render(<ProductCard badgeLabel="Offerta" description="Descrizione prodotto" href="https://example.com/p" image="https://example.com/p.jpg" price="19,99 €" tags={["Novità", "Eco"]} promo="offer" />);
    expect(getByText("Offerta")).toBeTruthy();
  });
  it("ripete le parti repeat per ogni elemento", () => {
    const { getByText } = render(<ProductCard badgeLabel="Offerta" description="Descrizione prodotto" href="https://example.com/p" image="https://example.com/p.jpg" price="19,99 €" tags={["A", "B"]} />);
    expect(getByText("A")).toBeTruthy();
    expect(getByText("B")).toBeTruthy();
  });
  it("porta i data-slot e il wiring href/src", () => {
    const { container } = render(<ProductCard badgeLabel="Offerta" description="Descrizione prodotto" href="https://example.com/p" image="https://example.com/p.jpg" price="19,99 €" tags={["Novità", "Eco"]} />);
    expect(container.querySelector('[data-slot="product-card"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="product-card-price"]')).not.toBeNull();
    expect(container.querySelector('a[data-slot="product-card"][href="https://example.com/p"]')).not.toBeNull();
    expect(container.querySelector('img[data-slot="product-card-image"][src="https://example.com/p.jpg"]')).not.toBeNull();
  });
  it("non ha violazioni axe (default)", async () => {
    const { container } = render(<ProductCard badgeLabel="Offerta" description="Descrizione prodotto" href="https://example.com/p" image="https://example.com/p.jpg" price="19,99 €" tags={["Novità", "Eco"]} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
