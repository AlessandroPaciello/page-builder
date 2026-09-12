import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateRecipe } from "./validate-recipe";
import type { TokenCatalog } from "./theme-generator";

const here = dirname(fileURLToPath(import.meta.url));
/** Fixture legacy `mis`: la ricetta Badge valida qui viene sostituita in Story 2.5 (Story 2.4, Task 8). */
const fixturePath = resolve(here, "__fixtures__/legacy-mis-catalog.json");
const catalog: TokenCatalog = JSON.parse(readFileSync(fixturePath, "utf8")) as TokenCatalog;

const validRecipe = {
  componentName: "Badge",
  domain: "data-display",
  headless: null,
  cva: {
    base: ["inline-flex", "rounded-full"],
    variants: {
      Color: {
        indigo: ["bg-mis-primary", "text-accent-contrast"],
        gray: ["bg-gray-surface", "text-mis-text"],
      },
      Style: {
        outline: ["border-mis-primary"],
      },
    },
    defaultVariants: { Color: "gray", Style: "solid" },
  },
  a11y: {
    role: null,
    ariaAttributes: [],
    focusVisible: false,
    stateConveyedByTextAndColor: false,
  },
  penpotComponentId: "badge-default",
  fixtureHash: "abc123def456",
};

describe("validateRecipe", () => {
  it("accetta una ricetta le cui classi sono tutte risolte al vocabolario Stadio 1", () => {
    const result = validateRecipe(validRecipe, catalog);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.invalidClasses).toEqual([]);
  });

  it("rifiuta una ricetta malformata nominando il campo incriminato", () => {
    const { domain: _omitted, ...broken } = validRecipe;
    const result = validateRecipe(broken, catalog);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("domain");
  });

  it("rifiuta una ricetta con classe valore-arbitrario nominando la classe (esempi esatti AC #2)", () => {
    const result = validateRecipe(
      {
        ...validRecipe,
        cva: {
          ...validRecipe.cva,
          variants: { Color: { indigo: ["bg-[#3b82f6]"] }, Style: validRecipe.cva.variants.Style },
        },
      },
      catalog,
    );
    expect(result.valid).toBe(false);
    expect(result.invalidClasses).toContain("bg-[#3b82f6]");
  });

  it("rifiuta una ricetta con classe fuori vocabolario nominando la classe (fail-loud)", () => {
    const result = validateRecipe(
      {
        ...validRecipe,
        cva: {
          ...validRecipe.cva,
          base: [...validRecipe.cva.base, "bg-nonexistent-token"],
        },
      },
      catalog,
    );
    expect(result.valid).toBe(false);
    expect(result.invalidClasses).toContain("bg-nonexistent-token");
  });

  it("valida anche le classi di base, non solo le varianti", () => {
    const result = validateRecipe(
      {
        ...validRecipe,
        cva: { ...validRecipe.cva, base: ["p-[7px]"] },
      },
      catalog,
    );
    expect(result.valid).toBe(false);
    expect(result.invalidClasses).toContain("p-[7px]");
  });

  it("accetta classi strutturali whitelisted senza binding token", () => {
    const result = validateRecipe(validRecipe, catalog);
    expect(result.invalidClasses).not.toContain("inline-flex");
    expect(result.invalidClasses).not.toContain("rounded-full");
  });

  it("valida pulita la ricetta Badge reale committata contro la fixture Stadio 1 reale (Task 5, AC #2)", () => {
    const badgeFixture = JSON.parse(
      readFileSync(resolve(here, "recipes/badge.recipe.json"), "utf8"),
    ) as unknown;
    const result = validateRecipe(badgeFixture, catalog);
    expect(result.errors).toEqual([]);
    expect(result.invalidClasses).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
