import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateRecipe } from "./validate-recipe";
import type { TokenCatalog } from "./theme-generator";

const here = dirname(fileURLToPath(import.meta.url));
/** Fixture Stadio 1 committata: la nuova library (palette + semantic). */
const catalog: TokenCatalog = JSON.parse(
  readFileSync(resolve(here, "__fixtures__/penpot-catalog.json"), "utf8"),
) as TokenCatalog;

/** Fixture di componente minima e conforme al contratto badge@1. */
const validFixture = {
  componentName: "Badge",
  contract: "badge@1",
  penpotComponentId: "container-badge",
  axes: [
    { name: "variant", values: ["default", "secondary", "destructive"] },
    { name: "size", values: ["sm", "md"] },
  ],
  cells: [
    { variantProps: { variant: "default", size: "sm" }, root: cellRoot("color.primary") },
    { variantProps: { variant: "default", size: "md" }, root: cellRoot("color.primary") },
    { variantProps: { variant: "secondary", size: "sm" }, root: cellRoot("color.secondary") },
    { variantProps: { variant: "secondary", size: "md" }, root: cellRoot("color.secondary") },
    { variantProps: { variant: "destructive", size: "sm" }, root: cellRoot("color.destructive") },
    { variantProps: { variant: "destructive", size: "md" }, root: cellRoot("color.destructive") },
  ],
};

function cellRoot(fill: string) {
  return {
    name: "Badge",
    kind: "board",
    tokens: { fill, paddingTop: "spacing.1" },
    style: { fill: ["<valore>"] },
    children: [
      {
        name: "label",
        kind: "text",
        tokens: { fill: "color.primary-foreground" },
        style: { fill: ["<valore>"] },
        children: [],
      },
    ],
  };
}

const validJudgment = {
  domain: "data-display",
  headless: null,
  a11y: { role: null, ariaAttributes: [], focusVisible: false, stateConveyedByTextAndColor: false },
};

const validRecipe = {
  componentName: "Badge",
  parts: {
    root: Object.fromEntries(
      validFixture.cells.map((cell) => [
        `variant=${cell.variantProps.variant}|size=${cell.variantProps.size}`,
        { ...cell.root.tokens },
      ]),
    ),
    label: Object.fromEntries(
      validFixture.cells.map((cell) => [
        `variant=${cell.variantProps.variant}|size=${cell.variantProps.size}`,
        { ...cell.root.children[0]!.tokens },
      ]),
    ),
  },
  judgment: validJudgment,
  penpotComponentId: "container-badge",
  fixtureHash: "abc123def456",
};

describe("validateRecipe", () => {
  it("accetta una fixture e una ricetta conformi al contratto", () => {
    const result = validateRecipe(validFixture, validRecipe, catalog, validJudgment);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("rifiuta una fixture malformata nominando il campo incriminato", () => {
    const { contract: _omitted, ...broken } = validFixture;
    const result = validateRecipe(broken, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("fixture contract");
  });

  it("rifiuta una ricetta malformata nominando il campo incriminato", () => {
    const { judgment: _omitted, ...broken } = validRecipe;
    const result = validateRecipe(validFixture, broken, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("ricetta judgment");
  });

  it("rifiuta un file di giudizio malformato (validato con JudgmentSchema)", () => {
    const result = validateRecipe(validFixture, validRecipe, catalog, { ...validJudgment, domain: "marketing" });
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("giudizio domain");
  });

  it("rifiuta un contratto non noto in @app/contracts", () => {
    const result = validateRecipe({ ...validFixture, contract: "widget@1" }, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('"widget@1"');
  });

  it("rifiuta una versione del plugin data incoerente col contratto", () => {
    const result = validateRecipe({ ...validFixture, contract: "badge@2" }, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('"badge@2" ≠ contractId "badge@1"');
  });

  it("rifiuta assi della fixture ≠ assi del contratto (nome e ordine)", () => {
    const broken = {
      ...validFixture,
      axes: [
        { name: "variant", values: ["default", "secondary", "destructive"] },
        { name: "tone", values: ["sm", "md"] },
      ],
    };
    const result = validateRecipe(broken, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("[variant, tone] ≠ assi del contratto [variant, size]");
  });

  it("rifiuta valori di un asse ≠ valori del contratto", () => {
    const broken = {
      ...validFixture,
      axes: [
        { name: "variant", values: ["default", "secondary"] },
        { name: "size", values: ["sm", "md"] },
      ],
    };
    const result = validateRecipe(broken, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('asse "variant"');
    expect(result.errors.join("\n")).toContain("mancanti [destructive]");
  });

  it("rifiuta una fixture con una cella del prodotto cartesiano mancante", () => {
    const broken = { ...validFixture, cells: validFixture.cells.slice(0, 5) };
    const result = validateRecipe(broken, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('manca la cella "variant=destructive|size=md"');
  });

  it("rifiuta una fixture con una cella in più (fuori prodotto cartesiano)", () => {
    const broken = {
      ...validFixture,
      cells: [...validFixture.cells, { variantProps: { variant: "default", size: "lg" }, root: cellRoot("color.primary") }],
    };
    const result = validateRecipe(broken, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('"variant=default|size=lg" in più');
  });

  it("rifiuta una fixture con una cella senza valore per un asse, nominando l'asse (review loop 1, ECH#1)", () => {
    const broken = {
      ...validFixture,
      cells: [...validFixture.cells.slice(0, 5), { variantProps: { variant: "default" }, root: cellRoot("color.primary") }],
    };
    const result = validateRecipe(broken, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('senza valore per l\'asse "size"');
    expect(result.errors.join("\n")).not.toContain('"?"');
  });

  it("rifiuta una ricetta con una parte mancante e una in più, nominandole", () => {
    const { label: _omitted, ...parts } = validRecipe.parts;
    const result = validateRecipe(validFixture, { ...validRecipe, parts: { ...parts, footer: {} } }, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('mancano [label]');
    expect(result.errors.join("\n")).toContain('in più [footer]');
  });

  it("rifiuta una ricetta con una cella mancante per parte", () => {
    const parts = {
      ...validRecipe.parts,
      root: Object.fromEntries(Object.entries(validRecipe.parts.root).slice(0, 5)),
    };
    const result = validateRecipe(validFixture, { ...validRecipe, parts }, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('parte "root": mancano le celle');
  });

  it("AC #2 — rifiuta un token fuori catalogo nominando parte, cella e proprietà", () => {
    const parts = {
      ...validRecipe.parts,
      root: {
        ...validRecipe.parts.root,
        "variant=default|size=sm": { ...validRecipe.parts.root["variant=default|size=sm"]!, fill: "color.nonesisto" },
      },
    };
    const result = validateRecipe(validFixture, { ...validRecipe, parts }, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('parte "root"') && e.includes('"variant=default|size=sm"') && e.includes('"fill"') && e.includes("color.nonesisto")),
    ).toBe(true);
  });

  it("AC #2 — rifiuta un valore literal (non è un token del catalogo)", () => {
    // Un hex è rifiuto già dallo schema (charset token, vedi recipe-schema.test);
    // qui un literal col charset da token ("16px") deve fallire col messaggio
    // che nomina parte, cella e proprietà.
    const parts = {
      ...validRecipe.parts,
      root: {
        ...validRecipe.parts.root,
        "variant=default|size=sm": { ...validRecipe.parts.root["variant=default|size=sm"]!, paddingTop: "16px" },
      },
    };
    const result = validateRecipe(validFixture, { ...validRecipe, parts }, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('proprietà "paddingTop"') && e.includes('"16px"') && e.includes("literal")),
    ).toBe(true);
  });

  it("conformance ricetta↔fixture — rifiuta una cella della ricetta che diverge dai binding shape.tokens della fixture (change log loop 1, BH#2)", () => {
    // Token valido nel catalogo ma MAI estratto dalla fixture: la ricetta
    // editata a mano non passa più.
    const parts = {
      ...validRecipe.parts,
      root: {
        ...validRecipe.parts.root,
        "variant=default|size=sm": { ...validRecipe.parts.root["variant=default|size=sm"]!, paddingTop: "spacing.2" },
      },
    };
    const result = validateRecipe(validFixture, { ...validRecipe, parts }, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('ricetta↔fixture parte "root"');
    expect(result.errors.join("\n")).toContain('"variant=default|size=sm"');
    expect(result.errors.join("\n")).toContain('"spacing.2"');
  });

  it("conformance ricetta↔fixture — rifiuta un binding della fixture su un layer che non è parte del contratto", () => {
    const broken = {
      ...validFixture,
      cells: [
        ...validFixture.cells.slice(0, 5),
        {
          variantProps: { variant: "destructive", size: "md" },
          root: {
            ...cellRoot("color.destructive"),
            children: [
              ...cellRoot("color.destructive").children,
              { name: "icona", kind: "path", tokens: { strokeColor: "color.border" }, style: {}, children: [] },
            ],
          },
        },
      ],
    };
    const result = validateRecipe(broken, validRecipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('il layer "icona" ha binding token');
  });

  it("giudizio — rifiuta una ricetta il cui judgment diverge dal file per contratto (change log loop 1, BH#3)", () => {
    const divergedJudgment = { ...validJudgment, a11y: { ...validJudgment.a11y, focusVisible: true } };
    const recipe = { ...validRecipe, judgment: divergedJudgment };
    const result = validateRecipe(validFixture, recipe, catalog, validJudgment);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain('judgments/"badge".json');
  });

  it("valida pulite le coppie fixture+ricetta committate dei tre contratti (AC #1)", () => {
    for (const name of ["badge", "input", "accordion-item"]) {
      const fixture = JSON.parse(readFileSync(resolve(here, `recipes/${name}.fixture.json`), "utf8")) as unknown;
      const recipe = JSON.parse(readFileSync(resolve(here, `recipes/${name}.recipe.json`), "utf8")) as unknown;
      const judgment = JSON.parse(readFileSync(resolve(here, `recipes/judgments/${name}.json`), "utf8")) as unknown;
      const result = validateRecipe(fixture, recipe, catalog, judgment);
      expect(result.errors, `ricetta "${name}"`).toEqual([]);
      expect(result.valid, `ricetta "${name}"`).toBe(true);
    }
  });
});
