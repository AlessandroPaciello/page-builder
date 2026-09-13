import { describe, expect, it } from "vitest";

import type { ComponentRecipe } from "../recipe-schema";
import { loadBaseSources, loadBinding, loadCatalog, loadFixture, loadRecipe } from "./artifacts";
import type { ComponentBinding } from "./binding-shadcn";
import { declaredA11yAssertion, isGeneratedFile, renderCheck, renderComponent } from "./render-component";

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

/** Imposta la stessa proprietà in TUTTE le celle di una parte: proprietà costante, finisce nella base. */
function setEverywhere(recipe: ComponentRecipe, part: string, property: string, token: string): void {
  for (const cell of Object.values(recipe.parts[part]!)) cell[property] = token;
}

function renderWith(componentName: string, mutate: (recipe: ComponentRecipe) => void, withCatalog = catalog) {
  const recipe = structuredClone(loadRecipe(componentName)) as ComponentRecipe;
  mutate(recipe);
  const binding = loadBinding(componentName);
  return renderComponent(loadFixture(componentName), recipe, binding, baseSources[binding.base]!, withCatalog);
}

/** Catalogo committato più un token di prova. */
function catalogWith(name: string, type: "opacity" | "borderWidth", value: string) {
  const extended = structuredClone(catalog);
  extended.sets[0]!.tokens.push({ name, type, value });
  return extended;
}

describe("renderComponent — registro delle proprietà (Story 2.8)", () => {
  it("nessuno skip: il risultato non ha più skippedProperties", () => {
    for (const component of ["Badge", "Input", "AccordionItem"]) {
      expect("skippedProperties" in renderCommitted(component)).toBe(false);
    }
  });

  it("strokeWidth coperta dalla base: 1px coincide con `border` (verde), 2px no (rosso)", () => {
    expect(() => renderWith("Input", () => {})).not.toThrow();
    expect(() => renderWith("Input", (recipe) => setEverywhere(recipe, "root", "strokeWidth", "border-width.thick"))).toThrow(
      /componente "Input", parte "root", cella "state=default", proprietà "strokeWidth", token "border-width\.thick": il token vale 2, la base shadcn esprime 1 \("border"\)/,
    );
  });

  it("strokeWidth su una parte per cui la base non esprime un bordo blocca", () => {
    expect(() => renderWith("Badge", (recipe) => setEverywhere(recipe, "label", "strokeWidth", "border-width.default"))).toThrow(
      /parte "label".*"strokeWidth".*la base shadcn non esprime "strokeWidth"/,
    );
  });

  it("opacity coperta dalla base solo con il prefisso giusto: disabled:opacity-50 sì, opacità di base no", () => {
    expect(() => renderWith("Input", (recipe) => setEverywhere(recipe, "root", "opacity", "opacity.disabled"))).toThrow(
      /parte "root".*"opacity".*non esprime "opacity" per questa parte con prefisso ""/,
    );
  });

  it("strokeWidth solo su un valore option non default: la base non ha classi per variante, blocca", () => {
    expect(() =>
      renderWith("Badge", (recipe) => {
        for (const [key, cell] of Object.entries(recipe.parts.root!)) {
          if (key.startsWith("variant=secondary|")) cell.strokeWidth = "border-width.default";
        }
      }),
    ).toThrow(/per un valore d'asse option/);
  });

  it("opacity con prefisso disabled: 0.5 coincide con disabled:opacity-50 (verde), 0.3 no (rosso)", () => {
    // Verde: la ricetta committata di Input lega opacity.disabled (0.5) alla sola cella state=disabled.
    expect(loadRecipe("Input").parts.root!["state=disabled"]!.opacity).toBe("opacity.disabled");
    expect(() => renderWith("Input", () => {})).not.toThrow();
    expect(() =>
      renderWith(
        "Input",
        (recipe) => (recipe.parts.root!["state=disabled"]!.opacity = "opacity.test"),
        catalogWith("opacity.test", "opacity", "0.3"),
      ),
    ).toThrow(/il token vale 0\.3, la base shadcn esprime 0\.5 \("disabled:opacity-50"\)/);
  });

  it("un token opacity con valore non numerico blocca", () => {
    expect(() =>
      renderWith(
        "Input",
        (recipe) => (recipe.parts.root!["state=disabled"]!.opacity = "opacity.test"),
        catalogWith("opacity.test", "opacity", "mezzo"),
      ),
    ).toThrow(/non è numerico/);
  });

  it("icona: strokeWidth sul layer path del chevron si ignora per regola, anche se non coincide con la base", () => {
    const committed = renderCommitted("AccordionItem").files;
    const result = renderWith("AccordionItem", (recipe) => setEverywhere(recipe, "chevron", "strokeWidth", "border-width.thick"));
    expect(result.files).toEqual(committed);
  });

  it("una proprietà non registrata in una cella blocca il render", () => {
    expect(() => renderWith("Badge", (recipe) => setEverywhere(recipe, "root", "fooBar", "color.primary"))).toThrow(
      /Proprietà non registrata.*componente "Badge", parte "root".*proprietà "fooBar", token "color\.primary"/,
    );
  });

  it("una proprietà bloccata in una cella blocca il render", () => {
    expect(() => renderWith("Badge", (recipe) => setEverywhere(recipe, "label", "fontFamilies", "font.sans"))).toThrow(
      /Proprietà bloccata.*parte "label".*"fontFamilies"/,
    );
  });
});

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

describe("renderComponent — a11y dichiarata nel giudizio", () => {
  const fileOf = (result: ReturnType<typeof renderCommitted>, suffix: string): string =>
    result.files.find((file) => file.path.endsWith(suffix))!.content;

  it("role dichiarato → role sulla radice prima di {...props}, e il test lo asserisce nel DOM", () => {
    const recipe = structuredClone(loadRecipe("Badge")) as ComponentRecipe;
    recipe.judgment.a11y.role = "alert";
    const result = renderComponent(loadFixture("Badge"), recipe, loadBinding("Badge"), baseSources.badge!, catalog);
    const tsx = fileOf(result, "Badge.tsx");
    expect(tsx).toMatch(/<span data-slot="badge" [^\n]*role="alert" \{\.\.\.props\}>/);
    const test = fileOf(result, "Badge.test.tsx");
    expect(test).toContain(declaredA11yAssertion("role", "alert"));
    expect(test).toContain("function declaredAttribute(");
  });

  it("senza role né aria-* dichiarati nessun attributo e nessuna asserzione in più (Badge)", () => {
    const result = renderCommitted("Badge");
    expect(fileOf(result, "Badge.tsx")).not.toContain("role=");
    expect(fileOf(result, "Badge.test.tsx")).not.toContain("declaredAttribute");
  });

  it("aria-* legato a un valore state → il test rende la prop DOM del mapping e asserisce (Input)", () => {
    const test = fileOf(renderCommitted("Input"), "Input.test.tsx");
    expect(test).toContain(`it("porta l'attributo dichiarato aria-invalid (state=error)"`);
    expect(test).toContain("<Input aria-invalid placeholder=");
    expect(test).toContain(declaredA11yAssertion("aria-invalid"));
  });

  it("aria-* dell'headless (asse behavior) → il test apre via Trigger e asserisce (AccordionItem)", () => {
    const test = fileOf(renderCommitted("AccordionItem"), "AccordionItem.test.tsx");
    for (const attribute of ["aria-expanded", "aria-controls"]) {
      expect(test).toContain(`it("porta l'attributo dichiarato ${attribute} (dopo l'apertura)"`);
      expect(test).toContain(declaredA11yAssertion(attribute));
    }
  });

  it("attributo aria-* con cifre (aria-level) è valido: test generato senza throw", () => {
    const recipe = structuredClone(loadRecipe("Badge")) as ComponentRecipe;
    recipe.judgment.a11y.ariaAttributes = ["aria-level"];
    const result = renderComponent(loadFixture("Badge"), recipe, loadBinding("Badge"), baseSources.badge!, catalog);
    const test = fileOf(result, "Badge.test.tsx");
    expect(test).toContain(`it("porta l'attributo dichiarato aria-level"`);
  });

  it("due valori di stato che mappano lo stesso aria-* → un test per ognuno, non solo il primo", () => {
    const recipe = structuredClone(loadRecipe("Input")) as ComponentRecipe;
    const binding = structuredClone(loadBinding("Input")) as ComponentBinding;
    // Anche `focus` mappa aria-invalid: entrambi gli stati devono essere asseriti.
    binding.axes.state!.values.focus = "aria-invalid:border-destructive";
    const result = renderComponent(loadFixture("Input"), recipe, binding, baseSources.input!, catalog);
    const test = fileOf(result, "Input.test.tsx");
    expect(test).toContain(`it("porta l'attributo dichiarato aria-invalid (state=error)"`);
    expect(test).toContain(`it("porta l'attributo dichiarato aria-invalid (state=focus)"`);
  });

  it("role o aria-* malformati nel giudizio → errore nominativo", () => {
    const withRole = structuredClone(loadRecipe("Badge")) as ComponentRecipe;
    withRole.judgment.a11y.role = 'alert" onClick="x';
    expect(() =>
      renderComponent(loadFixture("Badge"), withRole, loadBinding("Badge"), baseSources.badge!, catalog),
    ).toThrow(/"Badge".*a11y\.role.*non è un role ARIA valido/);
    const withAria = structuredClone(loadRecipe("Badge")) as ComponentRecipe;
    withAria.judgment.a11y.ariaAttributes = ["aria-Bad name"];
    expect(() =>
      renderComponent(loadFixture("Badge"), withAria, loadBinding("Badge"), baseSources.badge!, catalog),
    ).toThrow(/"Badge".*ariaAttributes "aria-Bad name"/);
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
