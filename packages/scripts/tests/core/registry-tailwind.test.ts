import { compile } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";

import {
  collapseRadius,
  ICON_LAYER_KINDS,
  PARENT_DIRS,
  RADIUS_CORNERS,
  registeredProperties,
  REGISTRY,
  varSuffix,
  type TranslationContext,
} from "../../src/core";
import { generateTheme, type TokenCatalog } from "../../src/shared/theme-generator";
import { loadTailwindCatalog } from "../fixtures/catalog";

/**
 * Livello 4 della CI (Story 2.20): ogni classe del registro, espansa sui
 * token del tema generato dal catalogo Tailwind, produce CSS con la Tailwind
 * installata. Una classe che Tailwind non conosce produce lo stesso CSS di
 * nessuna classe: è il rosso.
 *
 * Il catalogo Tailwind non ha token `opacity` (Tailwind v4 non ha quel
 * namespace): il test aggiunge un set minimo scritto a mano.
 */

const OPACITY_SET = { name: "test/opacity", tokens: [{ name: "opacity.50", type: "opacity" as const, value: "0.5" }] };

function catalog(): TokenCatalog {
  const base = loadTailwindCatalog();
  return { sets: [...base.sets, OPACITY_SET] };
}

/** Tutti i contesti in cui una voce può tradursi diversamente. */
const CONTEXTS: readonly TranslationContext[] = ["rect", "text", ...ICON_LAYER_KINDS].flatMap((layerKind) =>
  PARENT_DIRS.map((parentDir) => ({ layerKind, parentDir })),
);

interface Expanded {
  readonly property: string;
  readonly cls: string;
}

function expandRegistry(theme: TokenCatalog): { classes: Expanded[]; emptyEntries: string[] } {
  const classes: Expanded[] = [];
  const emptyEntries: string[] = [];
  for (const property of registeredProperties()) {
    const entry = REGISTRY[property];
    const before = classes.length;
    const inputs =
      entry.kind === "token"
        ? theme.sets.flatMap((set) => set.tokens.filter((token) => token.type === entry.tokenType).map((token) => varSuffix(token.name, token.type)))
        : entry.values.filter((value) => value !== entry.default);
    for (const input of inputs) {
      for (const context of CONTEXTS) {
        // Ogni voce si traduce con la sua funzione: le firme coincidono (input stringa, contesto).
        const translation = (entry.translate as (value: string, context: TranslationContext) => ReturnType<typeof entry.translate>)(input, context);
        if ("classes" in translation) for (const cls of translation.classes) classes.push({ property, cls });
      }
    }
    if (classes.length === before && !(entry.kind === "keyword" && entry.values.every((value) => value === entry.default || isUnsupported(property, value))))
      emptyEntries.push(property);
  }
  // Il collasso dei quattro angoli produce `rounded-<sfx>`.
  for (const token of theme.sets.flatMap((set) => set.tokens.filter((t) => t.type === "borderRadius"))) {
    const suffix = varSuffix(token.name, token.type);
    for (const cls of collapseRadius(RADIUS_CORNERS.map((corner) => `${corner}-${suffix}`))) classes.push({ property: "borderRadius (4 angoli)", cls });
  }
  return { classes, emptyEntries };
}

function isUnsupported(property: string, value: string): boolean {
  const entry = REGISTRY[property as keyof typeof REGISTRY];
  return entry.kind === "keyword" && "unsupported" in entry.translate(value, { layerKind: "rect", parentDir: "none" });
}

/** Il CSS del tema generato, senza l'`@import` relativo dei token extra (non serve alle utility). */
function themeCss(theme: TokenCatalog): string {
  return generateTheme(theme)
    .css.split("\n")
    .filter((line) => !line.startsWith("@import"))
    .join("\n");
}

describe("livello 4 — ogni classe del registro produce CSS con la Tailwind installata", () => {
  it("ogni voce dà almeno una classe sul tema; ogni classe produce CSS", async () => {
    const theme = catalog();
    const { classes, emptyEntries } = expandRegistry(theme);
    expect(emptyEntries, "voci senza nessuna classe sul tema generato (manca un token del loro tipo?)").toEqual([]);

    const compiler = await compile(`@import "tailwindcss";\n${themeCss(theme)}`, { base: import.meta.dirname, onDependency: () => {} });
    // `build` accumula i candidati delle chiamate precedenti: una classe produce CSS se cambia l'output della build prima.
    let previous = compiler.build([]);
    const unique = [...new Map(classes.map((item) => [item.cls, item])).values()];
    const silent: string[] = [];
    for (const { property, cls } of unique) {
      const output = compiler.build([cls]);
      if (output === previous) silent.push(`${property}: ${cls}`);
      previous = output;
    }
    expect(silent, "classi che non producono CSS").toEqual([]);
    // Una classe con variabile (`border-(length:--border-width-1)`) produce CSS anche se la variabile non esiste.
    const css = themeCss(theme);
    const undeclared = unique.flatMap(({ property, cls }) =>
      [...cls.matchAll(/--[\w-]+/g)].filter(([name]) => !css.includes(`${name}:`)).map(([name]) => `${property}: ${cls} (${name})`),
    );
    expect(undeclared, "classi che usano una variabile assente dal tema").toEqual([]);
    expect(unique.length).toBeGreaterThan(300);
  }, 60_000);

  it("rosso: una classe che Tailwind non conosce non produce CSS", async () => {
    const compiler = await compile(`@import "tailwindcss";\n${themeCss(catalog())}`, { base: import.meta.dirname, onDependency: () => {} });
    const empty = compiler.build([]);
    expect(compiler.build(["border-width-1"])).toBe(empty);
  });
});
