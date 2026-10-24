import { compile } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";

import {
  collapseRadius,
  GEOMETRY_FIXED_CLASSES,
  GEOMETRY_PREFIXES,
  ICON_LAYER_KINDS,
  PARENT_DIRS,
  RADIUS_CORNERS,
  registeredProperties,
  REGISTRY,
  scaleClass,
  scaleFromThemeCss,
  STATE_PREFIXES,
  varSuffix,
  type Scale,
  type Translation,
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
 *
 * Geometria (Story 2.21): le voci `kind: "geometry"` non si traducono da
 * sole; le loro classi sono quelle di `scaleClass` su ogni passo della scala
 * (le `--spacing-*` del tema generato) per ogni prefisso di misura e di
 * lato, i negativi dei lati, gli arbitrari, lo zero e le classi fisse.
 * La scala viene da `scaleFromThemeCss`, la stessa funzione del nucleo.
 *
 * Stati (Story 2.22): ogni classe, con il prefisso di ogni stato
 * (`STATE_PREFIXES`), produce CSS.
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
    // Le voci di geometria si espandono a parte (`expandGeometry`): qui si validano soltanto.
    if (entry.kind === "geometry") continue;
    const before = classes.length;
    const inputs =
      entry.kind === "token"
        ? theme.sets.flatMap((set) => set.tokens.filter((token) => token.type === entry.tokenType).map((token) => varSuffix(token.name, token.type)))
        : entry.values.filter((value) => value !== entry.default);
    for (const input of inputs) {
      for (const context of CONTEXTS) {
        // Ogni voce si traduce con la sua funzione: le firme coincidono (input stringa, contesto).
        const translation = (entry.translate as (value: string, context: TranslationContext) => Translation)(input, context);
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

const SIDES = GEOMETRY_PREFIXES.filter((prefix) => prefix !== "w" && prefix !== "h");

/** Le classi di geometria: ogni passo per ogni prefisso, i negativi dei lati, arbitrari, zero, classi fisse. */
function expandGeometry(scale: Scale): Expanded[] {
  const out: Expanded[] = [];
  const push = (prefix: string, px: number): void => {
    out.push({ property: `geometria ${prefix} ${px}px`, cls: scaleClass(prefix, px, scale).cls });
  };
  for (const prefix of GEOMETRY_PREFIXES) {
    for (const step of scale) push(prefix, step.px);
    push(prefix, 0);
    push(prefix, 37);
    push(prefix, 0.5);
  }
  for (const side of SIDES) {
    for (const step of scale) if (step.px !== 0) push(side, -step.px);
    push(side, -3);
  }
  for (const cls of GEOMETRY_FIXED_CLASSES) out.push({ property: "geometria (classi fisse)", cls });
  return out;
}

/** Le classi di stato: il prefisso di ogni stato davanti a ogni classe del registro e della geometria. */
function expandStates(classes: readonly Expanded[]): Expanded[] {
  return Object.entries(STATE_PREFIXES).flatMap(([state, prefix]) => classes.map(({ property, cls }) => ({ property: `${property} (${state})`, cls: `${prefix}${cls}` })));
}

/** Escape di un nome di classe in un selettore CSS (come `CSS.escape` per i caratteri ASCII). */
function cssEscape(cls: string): string {
  return cls.replace(/[^a-zA-Z0-9_\-\u0080-\uffff]/g, (char) => `\\${char}`);
}

/**
 * Il CSS contiene il selettore della classe, seguito da un carattere che non
 * continua un nome di classe: `hover:p-1` non passa grazie a `hover:p-10`.
 */
function hasSelector(css: string, cls: string): boolean {
  const escaped = `.${cssEscape(cls)}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(?=[\\s,:{.[>~+)])`).test(css);
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
    const { classes: registryClasses, emptyEntries } = expandRegistry(theme);
    expect(emptyEntries, "voci senza nessuna classe sul tema generato (manca un token del loro tipo?)").toEqual([]);
    const scale = scaleFromThemeCss(themeCss(theme));
    expect(scale.length, "la scala spacing del tema generato").toBeGreaterThan(20);
    const classes = [...registryClasses, ...expandGeometry(scale)];

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

  it("Story 2.22: ogni classe con il prefisso di ogni stato produce CSS (una build per stato)", async () => {
    const theme = catalog();
    const css = themeCss(theme);
    const plain = [...expandRegistry(theme).classes, ...expandGeometry(scaleFromThemeCss(css))];
    const states = expandStates([...new Map(plain.map((item) => [item.cls, item])).values()]);
    expect(states.length).toBeGreaterThan(4 * 300);
    const missing: string[] = [];
    for (const prefix of Object.values(STATE_PREFIXES)) {
      const batch = states.filter(({ cls }) => cls.startsWith(prefix));
      const compiler = await compile(`@import "tailwindcss";\n${css}`, { base: import.meta.dirname, onDependency: () => {} });
      const output = compiler.build(batch.map(({ cls }) => cls));
      // Tailwind scrive il selettore con la classe escapata: c'è solo se la classe produce CSS.
      for (const { property, cls } of batch) if (!hasSelector(output, cls)) missing.push(`${property}: ${cls}`);
    }
    expect(missing, "classi di stato che non producono CSS").toEqual([]);
  }, 60_000);

  it("rosso: una classe che Tailwind non conosce non produce CSS", async () => {
    const compiler = await compile(`@import "tailwindcss";\n${themeCss(catalog())}`, { base: import.meta.dirname, onDependency: () => {} });
    const empty = compiler.build([]);
    expect(compiler.build(["border-width-1"])).toBe(empty);
    expect(compiler.build(["pressed:bg-red-500"])).toBe(empty);
    expect(hasSelector(compiler.build(["hover:bg-red-500"]), "hover:bg-red-500")).toBe(true);
    expect(hasSelector(compiler.build(["hover:bg-nessun-token"]), "hover:bg-nessun-token")).toBe(false);
    // Un prefisso di un'altra classe non basta.
    expect(hasSelector(compiler.build(["hover:p-10"]), "hover:p-1")).toBe(false);
  });
});
