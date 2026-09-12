import { describe, expect, it } from "vitest";

import { FixtureSchema, JudgmentSchema, RecipeSchema } from "./recipe-schema";

/**
 * Badge-like: cella con albero layer root + label (stessa forma letta dallo
 * snapshot di library, plugin data + shape.tokens).
 */
const validFixture = {
  componentName: "Badge",
  contract: "badge@1",
  penpotComponentId: "container-badge",
  axes: [
    { name: "variant", values: ["default", "secondary", "destructive"] },
    { name: "size", values: ["sm", "md"] },
  ],
  cells: [
    {
      variantProps: { variant: "default", size: "sm" },
      root: {
        name: "Badge",
        kind: "board",
        tokens: { fill: "color.primary", borderRadiusTopLeft: "radius.full" },
        style: { fill: ["#006C49"], borderRadiusTopLeft: 9999 },
        children: [
          {
            name: "label",
            kind: "text",
            tokens: { fill: "color.primary-foreground" },
            style: { fill: ["#FFFFFF"] },
            children: [],
          },
        ],
      },
    },
  ],
};

const validJudgment = {
  domain: "data-display",
  headless: null,
  a11y: {
    role: null,
    ariaAttributes: [],
    focusVisible: false,
    stateConveyedByTextAndColor: false,
  },
};

/** Ricetta Badge conforme: parti piatte del contratto, celle per combinazione d'assi. */
const badgeRecipe = {
  componentName: "Badge",
  parts: {
    root: {
      "variant=default|size=sm": { fill: "color.primary", paddingTop: "spacing.1" },
      "variant=default|size=md": { fill: "color.primary", paddingTop: "spacing.1" },
      "variant=secondary|size=sm": { fill: "color.secondary", paddingTop: "spacing.1" },
      "variant=secondary|size=md": { fill: "color.secondary", paddingTop: "spacing.1" },
      "variant=destructive|size=sm": { fill: "color.destructive", paddingTop: "spacing.1" },
      "variant=destructive|size=md": { fill: "color.destructive", paddingTop: "spacing.1" },
    },
    label: {
      "variant=default|size=sm": { fill: "color.primary-foreground", fontSize: "text.xs" },
      "variant=default|size=md": { fill: "color.primary-foreground", fontSize: "text.sm" },
      "variant=secondary|size=sm": { fill: "color.secondary-foreground", fontSize: "text.xs" },
      "variant=secondary|size=md": { fill: "color.secondary-foreground", fontSize: "text.sm" },
      "variant=destructive|size=sm": { fill: "color.destructive-foreground", fontSize: "text.xs" },
      "variant=destructive|size=md": { fill: "color.destructive-foreground", fontSize: "text.sm" },
    },
  },
  judgment: validJudgment,
  penpotComponentId: "container-badge",
  fixtureHash: "abc123def456",
};

/** Ricette verdi per gli altri due contratti (stessa forma, assi diversi). */
const inputRecipe = {
  componentName: "Input",
  parts: {
    root: {
      "state=default": { fill: "color.background", strokeColor: "color.border" },
      "state=focus": { fill: "color.background", strokeColor: "color.ring", shadow: "shadow.ring" },
      "state=error": { fill: "color.background", strokeColor: "color.destructive" },
      "state=disabled": { fill: "color.background", opacity: "opacity.disabled" },
    },
    placeholder: {
      "state=default": { fill: "color.muted-foreground" },
      "state=focus": { fill: "color.muted-foreground" },
      "state=error": { fill: "color.muted-foreground" },
      "state=disabled": { fill: "color.muted-foreground" },
    },
  },
  judgment: { ...validJudgment, domain: "inputs" },
  penpotComponentId: "container-input",
  fixtureHash: "abc123def456",
};

const accordionItemRecipe = {
  componentName: "AccordionItem",
  parts: {
    root: {
      "state=closed": { fill: "color.card" },
      "state=open": { fill: "color.card" },
    },
    trigger: {
      "state=closed": { paddingTop: "spacing.3" },
      "state=open": { paddingTop: "spacing.3" },
    },
    label: {
      "state=closed": { fill: "color.foreground" },
      "state=open": { fill: "color.foreground" },
    },
    chevron: {
      "state=closed": { strokeColor: "color.foreground" },
      "state=open": { strokeColor: "color.foreground" },
    },
    content: {
      "state=closed": { paddingLeft: "spacing.4" },
      "state=open": { paddingLeft: "spacing.4" },
    },
    body: {
      "state=closed": { fill: "color.muted-foreground" },
      "state=open": { fill: "color.muted-foreground" },
    },
    divider: {
      "state=closed": { strokeColor: "color.border" },
      "state=open": { strokeColor: "color.border" },
    },
  },
  judgment: {
    domain: "layout",
    headless: { package: "@radix-ui/react-accordion", parts: ["Item", "Trigger", "Content"] },
    a11y: { role: null, ariaAttributes: ["aria-expanded"], focusVisible: true, stateConveyedByTextAndColor: false },
  },
  penpotComponentId: "container-accordion-item",
  fixtureHash: "abc123def456",
};

describe("FixtureSchema", () => {
  it("accetta una fixture con plugin data, albero layer e shape.tokens", () => {
    const parsed = FixtureSchema.safeParse(validFixture);
    expect(parsed.success).toBe(true);
  });

  it("rifiuta una fixture senza componentName", () => {
    const { componentName: _omitted, ...broken } = validFixture;
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta una fixture senza il plugin data del contratto", () => {
    const { contract: _omitted, ...broken } = validFixture;
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta un asse di variante con lista valori vuota", () => {
    const broken = {
      ...validFixture,
      axes: [{ name: "variant", values: [] }],
    };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta una cella con variantProps null — nella library verificata ogni board è una cella", () => {
    const broken = {
      ...validFixture,
      cells: [{ ...validFixture.cells[0]!, variantProps: null }],
    };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta una cella senza l'albero layer (root)", () => {
    const { root: _omitted, ...cell } = validFixture.cells[0]!;
    const broken = { ...validFixture, cells: [cell] };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta layer.tokens non a chiave-valore stringa", () => {
    const broken = {
      ...validFixture,
      cells: [
        {
          ...validFixture.cells[0]!,
          root: { ...validFixture.cells[0]!.root, tokens: { fill: 42 } },
        },
      ],
    };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta un albero layer annidato malformato (figlio senza name)", () => {
    const root = validFixture.cells[0]!.root;
    const broken = {
      ...validFixture,
      cells: [
        {
          ...validFixture.cells[0]!,
          root: { ...root, children: [{ ...root.children[0]!, name: undefined }] },
        },
      ],
    };
    expect(FixtureSchema.safeParse(broken).success).toBe(false);
  });
});

describe("JudgmentSchema", () => {
  it("accetta headless null e headless con package", () => {
    expect(JudgmentSchema.safeParse(validJudgment).success).toBe(true);
    expect(
      JudgmentSchema.safeParse({
        ...validJudgment,
        headless: { package: "@radix-ui/react-accordion", parts: ["Trigger"] },
      }).success,
    ).toBe(true);
  });

  it("accetta il campo comment (i giudizi sono JSON: le note stanno in un campo)", () => {
    expect(
      JudgmentSchema.safeParse({
        ...validJudgment,
        comment: "headless.parts sono componenti Radix, non parti del contratto.",
      }).success,
    ).toBe(true);
  });

  it("rifiuta un dominio fuori enum", () => {
    expect(JudgmentSchema.safeParse({ ...validJudgment, domain: "marketing" }).success).toBe(false);
  });

  it("rifiuta headless malformato (package mancante)", () => {
    expect(
      JudgmentSchema.safeParse({ ...validJudgment, headless: { parts: ["Trigger"] } }).success,
    ).toBe(false);
  });

  it("rifiuta a11y.focusVisible non booleano", () => {
    expect(
      JudgmentSchema.safeParse({ ...validJudgment, a11y: { ...validJudgment.a11y, focusVisible: "yes" } }).success,
    ).toBe(false);
  });
});

describe("RecipeSchema — tre contratti verdi", () => {
  it("accetta la ricetta Badge (mappa parti → celle proprietà→token)", () => {
    expect(RecipeSchema.safeParse(badgeRecipe).success).toBe(true);
  });

  it("accetta la ricetta Input (asse state)", () => {
    expect(RecipeSchema.safeParse(inputRecipe).success).toBe(true);
  });

  it("accetta la ricetta AccordionItem (parte annidata nel layout, piatta nelle parti)", () => {
    expect(RecipeSchema.safeParse(accordionItemRecipe).success).toBe(true);
  });
});

describe("RecipeSchema — criterio di stop: parte annidata con assi propri (AC #2)", () => {
  it("rifiuta una parte annidata come chiave dentro un'altra parte", () => {
    // "label" come chiave dentro "trigger": non è una chiave cella `asse=valore`.
    const nested = {
      ...badgeRecipe,
      parts: {
        trigger: {
          label: { "state=open": { fill: "color.foreground" } },
        },
      },
    };
    const parsed = RecipeSchema.safeParse(nested);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(JSON.stringify(parsed.error.issues)).toContain("trigger");
    }
  });

  it("rifiuta una parte annidata come valore di cella (la cella è proprietà→token, non un oggetto)", () => {
    const nested = {
      ...badgeRecipe,
      parts: {
        trigger: {
          "state=open": { label: { fill: "color.foreground" } },
        },
      },
    };
    expect(RecipeSchema.safeParse(nested).success).toBe(false);
  });

  it("rifiuta una parte annidata con assi propri a qualunque profondità di chiave cella", () => {
    const nested = {
      ...badgeRecipe,
      parts: {
        root: {
          "variant=default|size=sm": { fill: "color.primary" },
          "trigger|state=open": { fill: "color.primary" },
        },
      },
    };
    expect(RecipeSchema.safeParse(nested).success).toBe(false);
  });
});

describe("RecipeSchema — literal e malformazioni", () => {
  it("rifiuta un valore literal nella cella (es. hex)", () => {
    const literal = {
      ...badgeRecipe,
      parts: {
        ...badgeRecipe.parts,
        root: {
          ...badgeRecipe.parts.root,
          "variant=default|size=sm": { fill: "#ffdad6" },
        },
      },
    };
    const parsed = RecipeSchema.safeParse(literal);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(JSON.stringify(parsed.error.issues)).toContain("fill");
    }
  });

  it("rifiuta una parte con nome non identificatore", () => {
    const broken = {
      ...badgeRecipe,
      parts: { "Root/Inner": badgeRecipe.parts.root },
    };
    expect(RecipeSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta una chiave cella senza asse in formato asse=valore", () => {
    const broken = {
      ...badgeRecipe,
      parts: {
        ...badgeRecipe.parts,
        root: { default: badgeRecipe.parts.root["variant=default|size=sm"] },
      },
    };
    expect(RecipeSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta una chiave cella con '=' dentro il valore (review loop 1, BH#6: 'variant=a=b' colliderebbe)", () => {
    const broken = {
      ...badgeRecipe,
      parts: {
        ...badgeRecipe.parts,
        root: { "variant=a=b": badgeRecipe.parts.root["variant=default|size=sm"] },
      },
    };
    expect(RecipeSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta una chiave cella con '|' dentro il valore (due celle diverse collasserebbero nella stessa chiave)", () => {
    const broken = {
      ...badgeRecipe,
      parts: {
        ...badgeRecipe.parts,
        root: { "variant=de|fault": badgeRecipe.parts.root["variant=default|size=sm"] },
      },
    };
    expect(RecipeSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta il giudizio mancante", () => {
    const { judgment: _omitted, ...broken } = badgeRecipe;
    expect(RecipeSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta provenienza senza fixtureHash", () => {
    const { fixtureHash: _omitted, ...broken } = badgeRecipe;
    expect(RecipeSchema.safeParse(broken).success).toBe(false);
  });

  it("rifiuta fixtureHash non lungo 12 caratteri", () => {
    expect(RecipeSchema.safeParse({ ...badgeRecipe, fixtureHash: "abc123" }).success).toBe(false);
  });

  it("rifiuta provenienza senza penpotComponentId", () => {
    const { penpotComponentId: _omitted, ...broken } = badgeRecipe;
    expect(RecipeSchema.safeParse(broken).success).toBe(false);
  });
});
