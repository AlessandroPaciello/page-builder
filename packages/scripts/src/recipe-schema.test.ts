import { describe, expect, it } from "vitest";

import { FixtureSchema, RecipeSchema } from "./recipe-schema";

const validFixture = {
  componentName: "Badge",
  penpotComponentId: "badge-default",
  variantAxes: [
    { name: "Color", values: ["Indigo", "Gray", "Green", "Red"] },
    { name: "Style", values: ["solid", "soft", "outline"] },
  ],
  cells: [
    {
      variantProps: { Color: "Red", Style: "solid" },
      penpotComponentId: "badge-red-solid",
      shapeStructure: { type: "board", children: [] },
      tokenBindings: { fill: "color.feedback.error.container" },
      rawCss: ".badge-red-solid { background-color: #ffdad6; }",
    },
    {
      variantProps: null,
      penpotComponentId: "badge-default",
      shapeStructure: { type: "board", children: [] },
      tokenBindings: {},
      rawCss: ".badge-default { background-color: #ffdad6; }",
    },
  ],
};

const validRecipe = {
  componentName: "Badge",
  domain: "data-display",
  headless: null,
  cva: {
    base: ["inline-flex", "rounded-full"],
    variants: {
      Color: { red: ["bg-feedback-error-container", "text-feedback-error"] },
      Style: { outline: ["border-mis-primary"] },
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

describe("FixtureSchema", () => {
  it("accetta una fixture completa con cella default (variantProps null)", () => {
    const parsed = FixtureSchema.safeParse(validFixture);
    expect(parsed.success).toBe(true);
  });

  it("rifiuta una fixture senza componentName", () => {
    const { componentName: _omitted, ...broken } = validFixture;
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta una cella senza rawCss", () => {
    const broken = {
      ...validFixture,
      cells: [{ ...validFixture.cells[0]!, rawCss: undefined }],
    };
    const parsed = FixtureSchema.safeParse(broken);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(JSON.stringify(parsed.error.issues)).toContain("rawCss");
    }
  });

  it("rifiuta un asse di variante con lista valori vuota", () => {
    const broken = {
      ...validFixture,
      variantAxes: [{ name: "Color", values: [] }],
    };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta una cella senza penpotComponentId", () => {
    const { penpotComponentId: _omitted, ...cell } = validFixture.cells[0]!;
    const broken = { ...validFixture, cells: [cell] };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta tokenBindings non a chiave-valore stringa", () => {
    const broken = {
      ...validFixture,
      cells: [
        {
          ...validFixture.cells[0]!,
          tokenBindings: { fill: 42 },
        },
      ],
    };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta shapeStructure assente", () => {
    const { shapeStructure: _omitted, ...cell } = validFixture.cells[0]!;
    const broken = { ...validFixture, cells: [cell] };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });
});

describe("RecipeSchema", () => {
  it("accetta una ricetta valida headless-null", () => {
    const parsed = RecipeSchema.safeParse(validRecipe);
    expect(parsed.success).toBe(true);
  });

  it("accetta una ricetta con libreria headless", () => {
    const parsed = RecipeSchema.safeParse({
      ...validRecipe,
      headless: { package: "@radix-ui/react-accordion", parts: ["Root", "Item"] },
    });
    expect(parsed.success).toBe(true);
  });

  it("rifiuta un dominio fuori enum", () => {
    const parsed = RecipeSchema.safeParse({ ...validRecipe, domain: "marketing" });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta un dominio mancante", () => {
    const { domain: _omitted, ...broken } = validRecipe;
    expect(RecipeSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta headless malformato (package mancante)", () => {
    const parsed = RecipeSchema.safeParse({
      ...validRecipe,
      headless: { parts: ["Root"] },
    });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta headless malformato (parts non array)", () => {
    const parsed = RecipeSchema.safeParse({
      ...validRecipe,
      headless: { package: "@radix-ui/react-accordion", parts: "Root" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta cva.variants malformato (valore variante non array di stringhe)", () => {
    const parsed = RecipeSchema.safeParse({
      ...validRecipe,
      cva: {
        ...validRecipe.cva,
        variants: { Color: { red: "bg-feedback-error" } },
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta defaultVariants non a chiave-valore stringa", () => {
    const parsed = RecipeSchema.safeParse({
      ...validRecipe,
      cva: { ...validRecipe.cva, defaultVariants: { Color: 2 } },
    });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta a11y.focusVisible non booleano", () => {
    const parsed = RecipeSchema.safeParse({
      ...validRecipe,
      a11y: { ...validRecipe.a11y, focusVisible: "yes" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta provenienza senza fixtureHash", () => {
    const { fixtureHash: _omitted, ...broken } = validRecipe;
    const parsed = RecipeSchema.safeParse(broken);
    expect(parsed.success).toBe(false);
  });

  it("rifiuta fixtureHash non lungo 12 caratteri", () => {
    const parsed = RecipeSchema.safeParse({ ...validRecipe, fixtureHash: "abc123" });
    expect(parsed.success).toBe(false);
  });

  it("rifiuta provenienza senza penpotComponentId", () => {
    const { penpotComponentId: _omitted, ...broken } = validRecipe;
    const parsed = RecipeSchema.safeParse(broken);
    expect(parsed.success).toBe(false);
  });
});
