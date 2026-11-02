// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Story 2.29, decisione 2: il tema Penpot (`packages/tokens/src/theme.css` e
 * `themes/*.css`, tutti `@generated`) deve rispettare il contrasto WCAG sulle
 * coppie di ruolo `X` / `X-foreground` (più `background`/`foreground`, la
 * coppia della pagina, che shadcn non chiama `background-foreground`). È il
 * gate di GA: un token cambiato in Penpot e riportato da `extract_theme` che
 * scende sotto soglia rende rossa la suite, senza che nessuno debba ricordarsi
 * di guardare.
 *
 * I valori non sono scritti nel test: si leggono dal tema generato e i
 * riferimenti `var(--color-…)` si risolvono sul set `tailwind`.
 */

const require = createRequire(import.meta.url);
const tokensSrc = dirname(require.resolve("@penpot-ds/tokens/theme.css"));
const themeCss = readFileSync(join(tokensSrc, "theme.css"), "utf8");
const themesDir = join(tokensSrc, "themes");

/** Il pavimento WCAG 1.4.3 per il testo normale. */
const TEXT_FLOOR = 4.5;

/**
 * Pavimenti per ruolo. `muted` è una superficie tenue (shadcn: «a subtle
 * background»), non una superficie di testo: `muted-foreground` è pensato per
 * `background`/`card`, dove il tema passa 4.5:1. La coppia resta comunque
 * controllata, al pavimento non-test di WCAG 1.4.11 (3:1).
 */
const FLOORS: Readonly<Record<string, number>> = { muted: 3 };

interface Pair {
  /** Il nome del ruolo, senza il prefisso `--color-`. */
  readonly name: string;
  readonly background: string;
  readonly foreground: string;
}

/** Le variabili `--x: y;` di un CSS generato (base o variante). */
function parseVars(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const match of css.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) vars.set(match[1]!, match[2]!.trim());
  return vars;
}

/** `var(--color-neutral-950)` → il valore letterale, ricorsivamente. */
function resolveColor(vars: ReadonlyMap<string, string>, value: string, seen: readonly string[] = []): string {
  const reference = /^var\((--[\w-]+)\)$/.exec(value.trim());
  if (reference === null) return value.trim();
  const name = reference[1]!;
  if (seen.includes(name)) throw new Error(`Riferimento circolare nel tema: ${[...seen, name].join(" → ")}`);
  const target = vars.get(name);
  if (target === undefined) throw new Error(`${name} è citato ma non è dichiarato nel tema`);
  return resolveColor(vars, target, [...seen, name]);
}

/** `#rgb` / `#rrggbb` → i tre canali in [0, 1]. Un valore con alpha non è leggibile qui. */
function channels(hex: string): readonly [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (match === null) {
    throw new Error(`Colore non leggibile dal test di contrasto: ${JSON.stringify(hex)} (atteso #rgb o #rrggbb)`);
  }
  const digits = match[1]!.length === 3 ? [...match[1]!].map((digit) => digit + digit).join("") : match[1]!;
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(digits.slice(index, index + 2), 16) / 255);
  return [r!, g!, b!];
}

/** Luminanza relativa WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Rapporto di contrasto WCAG, da 1 a 21. */
function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Ogni `--color-X` con un `--color-X-foreground`, più la coppia della pagina `background`/`foreground` (shadcn non la chiama `background-foreground`). */
function contrastPairs(vars: ReadonlyMap<string, string>): Pair[] {
  const names = new Set([...vars.keys()].filter((name) => name.startsWith("--color-")).map((name) => name.slice("--color-".length)));
  const pairs = [...names]
    .filter((name) => names.has(`${name}-foreground`))
    .sort()
    .map((name) => ({
      name,
      background: resolveColor(vars, vars.get(`--color-${name}`)!),
      foreground: resolveColor(vars, vars.get(`--color-${name}-foreground`)!),
    }));
  if (names.has("background") && names.has("foreground")) {
    pairs.unshift({
      name: "background",
      background: resolveColor(vars, vars.get("--color-background")!),
      foreground: resolveColor(vars, vars.get("--color-foreground")!),
    });
  }
  return pairs;
}

/** Le coppie sotto il loro pavimento, già formattate per il messaggio del test. */
function contrastFailures(vars: ReadonlyMap<string, string>): string[] {
  return contrastPairs(vars).flatMap((pair) => {
    const floor = FLOORS[pair.name] ?? TEXT_FLOOR;
    const ratio = contrastRatio(pair.background, pair.foreground);
    return ratio < floor
      ? [`${pair.name}: ${pair.background} su ${pair.foreground} = ${ratio.toFixed(2)}:1, sotto ${floor}:1`]
      : [];
  });
}

/** La base con le variabili di una variante sopra: è ciò che il browser vede con `[data-<gruppo>="<nome>"]`. */
function variantVars(base: ReadonlyMap<string, string>, variantCss: string): Map<string, string> {
  return new Map([...base, ...parseVars(variantCss)]);
}

const baseVars = parseVars(themeCss);
const variants = readdirSync(themesDir)
  .filter((entry) => entry.endsWith(".css"))
  .sort()
  .map((entry) => ({ entry, css: readFileSync(join(themesDir, entry), "utf8") }));

describe("contrasto delle coppie di ruolo del tema (Story 2.29)", () => {
  it("il tema ha le coppie di ruolo attese (il test non è vacuo)", () => {
    const names = contrastPairs(baseVars).map((pair) => pair.name);
    expect(names).toEqual(expect.arrayContaining(["background", "card", "destructive", "muted", "primary"]));
    expect(names.length).toBeGreaterThanOrEqual(8);
  });

  it("ogni coppia X/X-foreground della base rispetta il pavimento", () => {
    expect(contrastFailures(baseVars)).toEqual([]);
  });

  it("muted-foreground resta leggibile sulle superfici su cui è usato (background, card)", () => {
    const foreground = resolveColor(baseVars, baseVars.get("--color-muted-foreground")!);
    for (const surface of ["background", "card"]) {
      const background = resolveColor(baseVars, baseVars.get(`--color-${surface}`)!);
      const ratio = contrastRatio(background, foreground);
      expect(ratio, `muted-foreground su ${surface}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  it("ogni variante di tema rispetta il pavimento sulle coppie che cambia", () => {
    expect(variants.length).toBeGreaterThan(0);
    for (const { entry, css } of variants) {
      expect(contrastFailures(variantVars(baseVars, css)), `variante ${entry}`).toEqual([]);
    }
  });

  it("rosso: una coppia sotto soglia non passa il gate", () => {
    const broken = new Map([
      ["--color-primary", "#8A8A8A"],
      ["--color-primary-foreground", "#9A9A9A"],
    ]);
    const failures = contrastFailures(broken);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^primary: .* sotto 4\.5:1$/);
    expect(contrastRatio("#8A8A8A", "#9A9A9A")).toBeLessThan(TEXT_FLOOR);

    // Anche una variante che abbassa una coppia della base è un rosso.
    const variant = variantVars(baseVars, '[data-brand="rotto"] {\n  --color-destructive-foreground: #E7000B;\n}');
    expect(contrastFailures(variant).some((failure) => failure.startsWith("destructive:"))).toBe(true);
  });

  it("verde: la stessa coppia sopra soglia passa", () => {
    const fixed = new Map([
      ["--color-primary", "#171717"],
      ["--color-primary-foreground", "#FAFAFA"],
    ]);
    expect(contrastFailures(fixed)).toEqual([]);
    expect(contrastRatio("#171717", "#FAFAFA")).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });
});
