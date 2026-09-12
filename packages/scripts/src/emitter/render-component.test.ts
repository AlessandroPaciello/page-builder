import { describe, expect, it } from "vitest";

import type { ComponentRecipe } from "../recipe-schema";
import { loadBaseSources, loadBinding, loadCatalog, loadFixture, loadRecipe } from "./artifacts";
import type { ComponentBinding } from "./binding-shadcn";
import { isGeneratedFile, renderCheck, renderComponent } from "./render-component";

/**
 * Test dell'emitter shadcn (Story 2.6): instradamento per TIPO d'asse letto
 * dal contratto, derivazione classi da `varSuffix` validata dal vocabolario,
 * determinismo byte-per-byte, skip protettivo, fail-loud nominativi.
 */

const catalog = loadCatalog();
const baseSources: Record<string, Record<string, string>> = {
  badge: loadBaseSources("badge"),
  input: loadBaseSources("input"),
  accordion: loadBaseSources("accordion"),
};

function renderCommitted(componentName: string, existingFiles?: Record<string, string>) {
  const fixture = loadFixture(componentName);
  const recipe = loadRecipe(componentName);
  const binding = loadBinding(componentName);
  const base = baseSources[binding.base]!;
  return renderComponent(fixture, recipe, binding, base, catalog, { existingFiles });
}

describe("renderComponent — instradamento per tipo d'asse", () => {
  it("Badge (assi option): 4 file @generated con provenienza e varianti cva", () => {
    const result = renderCommitted("Badge");
    expect(result.domain).toBe("data-display");
    expect(result.files.map((file) => file.path).sort()).toEqual([
      "data-display/Badge.stories.tsx",
      "data-display/Badge.test.tsx",
      "data-display/Badge.tsx",
      "data-display/index.ts",
    ]);
    const tsx = result.files.find((file) => file.path === "data-display/Badge.tsx")!.content;
    expect(tsx).toContain("cva(");
    expect(tsx).toContain("bg-primary");
    expect(tsx).toContain('secondary: "bg-secondary"');
    expect(tsx).toContain('destructive: "bg-destructive"');
    expect(tsx).toContain('sm: "pl-2 pr-2"');
    // Provenienza: penpotComponentId + fixtureHash + comando di rigenerazione.
    for (const file of result.files) {
      expect(isGeneratedFile(file.content)).toBe(true);
      expect(file.content).toContain("062d2e96-d208-8096-8008-a0a45aefa682");
      expect(file.content).toContain("4c74af97e6a4");
      expect(file.content).toContain("render:component -- Badge");
    }
  });

  it("Input (asse state): prefissi focus-visible:/aria-invalid:/disabled: e placeholder:", () => {
    const result = renderCommitted("Input");
    const tsx = result.files.find((file) => file.path === "inputs/Input.tsx")!.content;
    expect(tsx).not.toContain("cva(");
    expect(tsx).toContain("focus-visible:border-ring");
    expect(tsx).toContain("focus-visible:shadow-ring");
    expect(tsx).toContain("aria-invalid:border-destructive");
    expect(tsx).toContain("placeholder:text-muted-foreground");
    // Le classi derivano da varSuffix: la var CSS e la classe condividono il suffisso.
    expect(tsx).toContain("rounded-md");
  });

  it("AccordionItem (asse behavior): headless import riusato VERBATIM dalla base", () => {
    const result = renderCommitted("AccordionItem");
    const tsx = result.files.find((file) => file.path === "layout/AccordionItem.tsx")!.content;
    expect(tsx).toContain(`import * as AccordionPrimitive from "@radix-ui/react-accordion";`);
    expect(tsx).toContain("AccordionPrimitive.Item");
    expect(tsx).toContain("bg-card");
  });

  it("asse behavior con cella open ≠ closed emette data-[state=open]:", () => {
    const fixture = loadFixture("AccordionItem");
    const recipe = structuredClone(loadRecipe("AccordionItem")) as ComponentRecipe;
    recipe.parts.root!["state=open"]!.fill = "color.muted";
    const binding = loadBinding("AccordionItem");
    const result = renderComponent(fixture, recipe, binding, baseSources.accordion!, catalog);
    const tsx = result.files.find((file) => file.path === "layout/AccordionItem.tsx")!.content;
    expect(tsx).toContain("data-[state=open]:bg-muted");
  });
});

describe("renderComponent — determinismo e skip protettivo", () => {
  it("stesso input → stesso output byte per byte", () => {
    const first = renderCommitted("Badge");
    const second = renderCommitted("Badge");
    expect(first.files).toEqual(second.files);
  });

  it("file senza marker @generated: skip protettivo, zero scrittura (non è un errore)", () => {
    const existing = {
      "data-display/Badge.tsx": "export const HandMade = true;\n",
      "data-display/index.ts": "export {};\n",
    };
    const result = renderCommitted("Badge", existing);
    const tsx = result.files.find((file) => file.path === "data-display/Badge.tsx")!;
    const index = result.files.find((file) => file.path === "data-display/index.ts")!;
    expect(tsx.action).toBe("skip");
    expect(index.action).toBe("skip");
    // Gli altri file (test, stories) restano in scrittura.
    expect(result.files.filter((file) => file.action === "write")).toHaveLength(2);
  });

  it("file con marker @generated: sovrascritto", () => {
    const existing = { "data-display/Badge.tsx": "// @generated — vecchio contenuto\n" };
    const result = renderCommitted("Badge", existing);
    expect(result.files.find((file) => file.path === "data-display/Badge.tsx")!.action).toBe("write");
  });
});

describe("renderCheck — confronto byte-per-byte in memoria", () => {
  it("output identico → diff zero", () => {
    const result = renderCommitted("Badge");
    const existing = Object.fromEntries(result.files.map((file) => [file.path, file.content]));
    expect(renderCheck(result.files, existing)).toEqual({ equal: true, divergences: [] });
  });

  it("file con marker divergente → drift nominato; file assente → missing; file senza marker → fuori dal confronto", () => {
    const result = renderCommitted("Badge");
    const content = (path: string): string => result.files.find((file) => file.path === path)!.content;
    const existing: Record<string, string> = {
      "data-display/Badge.tsx": "// @generated — contenuto manomesso\n",
      "data-display/Badge.stories.tsx": content("data-display/Badge.stories.tsx"),
      "data-display/index.ts": content("data-display/index.ts"),
    };
    const check = renderCheck(result.files, existing);
    expect(check.equal).toBe(false);
    expect(check.divergences).toContainEqual({ path: "data-display/Badge.tsx", reason: "divergente" });
    expect(check.divergences).toContainEqual({ path: "data-display/Badge.test.tsx", reason: "missing" });
    expect(check.divergences).toHaveLength(2);
  });
});

describe("renderComponent — fail-loud nominativi", () => {
  it("asse senza tipo nel binding → errore che nomina l'asse", () => {
    const binding = { ...loadBinding("Input"), axes: {} } as unknown as ComponentBinding;
    expect(() =>
      renderComponent(loadFixture("Input"), loadRecipe("Input"), binding, baseSources.input!, catalog),
    ).toThrow(/asse "state".*senza tipo nel binding/);
  });

  it("tipo d'asse divergente dal contratto → errore che nomina l'asse", () => {
    const binding = loadBinding("Input");
    const wrong = {
      ...binding,
      axes: { ...binding.axes, state: { ...binding.axes.state!, type: "option" } },
    } as unknown as ComponentBinding;
    expect(() =>
      renderComponent(loadFixture("Input"), loadRecipe("Input"), wrong, baseSources.input!, catalog),
    ).toThrow(/asse "state".*≠ tipo nel contratto/);
  });

  it("proprietà che varia con due assi → interazione non esprimibile, errore nominativo", () => {
    const recipe = structuredClone(loadRecipe("Badge")) as ComponentRecipe;
    recipe.parts.root!["variant=default|size=sm"]!.fill = "color.secondary";
    expect(() =>
      renderComponent(loadFixture("Badge"), recipe, loadBinding("Badge"), baseSources.badge!, catalog),
    ).toThrow(/"fill".*varia con più assi/);
  });

  it("radius parziale → classe corner fuori vocabolario, errore che nomina la classe", () => {
    const recipe = structuredClone(loadRecipe("Badge")) as ComponentRecipe;
    for (const [key, cell] of Object.entries(recipe.parts.root!)) {
      recipe.parts.root![key] = { borderRadiusTopLeft: cell!.borderRadiusTopLeft! };
    }
    expect(() =>
      renderComponent(loadFixture("Badge"), recipe, loadBinding("Badge"), baseSources.badge!, catalog),
    ).toThrow(/"rounded-tl-full".*vocabolario/);
  });

  it("token literal (non nel catalogo) → errore nominativo", () => {
    const recipe = structuredClone(loadRecipe("Badge")) as ComponentRecipe;
    for (const [key, cell] of Object.entries(recipe.parts.root!)) {
      if (key.startsWith("variant=default|")) cell!.fill = "#ba1a1a";
    }
    expect(() =>
      renderComponent(loadFixture("Badge"), recipe, loadBinding("Badge"), baseSources.badge!, catalog),
    ).toThrow(/"#ba1a1a".*non esiste nel catalogo/);
  });

  it("base shadcn mancante → errore nominativo", () => {
    expect(() =>
      renderComponent(loadFixture("Badge"), loadRecipe("Badge"), loadBinding("Badge"), {}, catalog),
    ).toThrow(/base shadcn "badge" non trovata/);
  });
});
