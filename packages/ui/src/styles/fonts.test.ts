// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Story 2.29, decisione 2: ogni famiglia non di sistema del tema ha il suo
 * pacchetto `@fontsource/*` in `packages/tokens/package.json` e i suoi
 * `@import` in `fonts.css`. `extract_theme` scrive i due file insieme, ma il
 * pacchetto lo installa lo sviluppatore: senza questo gate un tema con una
 * famiglia nuova compila e a runtime il font manca in silenzio.
 *
 * Le regole di famiglia e slug sono quelle di `packages/scripts/src/shared/
 * extract-theme.ts` (il generatore): qui sono riscritte perché `packages/ui`
 * non dipende da `packages/scripts`. Se cambiano là, questo test è il posto
 * dove si vede.
 */

const require = createRequire(import.meta.url);
const tokensSrc = dirname(require.resolve("@penpot-ds/tokens/fonts.css"));
const tokensRoot = join(tokensSrc, "..");
const fontsCss = readFileSync(join(tokensSrc, "fonts.css"), "utf8");
const themeCss = readFileSync(join(tokensSrc, "theme.css"), "utf8");
const tokensPackage = JSON.parse(readFileSync(join(tokensRoot, "package.json"), "utf8")) as {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

/** Le famiglie di sistema o generiche: nessun pacchetto, nessun `@import`. */
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "emoji",
  "math",
  "fangsong",
  "inherit",
  "initial",
  "unset",
]);

/** Una famiglia che il browser risolve da sé (niente file da scaricare). */
function isSystemOrGeneric(family: string): boolean {
  const normalized = family.trim().toLowerCase();
  return /^(ui-|system-|-apple)/.test(normalized) || GENERIC_FAMILIES.has(normalized);
}

/** "Noto Serif" → "noto-serif": il nome del pacchetto `@fontsource/*`. */
function fontsourceSlug(family: string): string {
  return family.toLowerCase().replace(/\s+/g, "-");
}

/** Le famiglie dichiarate dalle variabili `--font-*` del tema (i pesi `--font-weight-*` non sono famiglie). */
function themeFamilies(css: string): string[] {
  const families: string[] = [];
  for (const match of css.matchAll(/^\s*--font-(?!weight-)([\w-]+):\s*(.+);$/gm)) {
    for (const part of match[2]!.split(",")) {
      const family = part.trim().replace(/^["']|["']$/g, "");
      if (family.length > 0) families.push(family);
    }
  }
  return families;
}

/** I pacchetti `@fontsource/*` importati da un `fonts.css`. */
function importedPackages(css: string): string[] {
  return [...new Set([...css.matchAll(/@import\s+"(@fontsource\/[^"/]+)\//g)].map((match) => match[1]!))].sort();
}

/** I pacchetti dichiarati da `packages/tokens/package.json`. */
function declaredPackages(pkg: typeof tokensPackage): Set<string> {
  return new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
}

/** Le famiglie non di sistema senza pacchetto o senza `@import`. */
function missingFontPackages(css: string, theme: string, pkg: typeof tokensPackage): string[] {
  const declared = declaredPackages(pkg);
  const imported = new Set(importedPackages(css));
  return [...new Set(themeFamilies(theme).filter((family) => !isSystemOrGeneric(family)))]
    .map((family) => ({ family, slug: fontsourceSlug(family) }))
    .flatMap(({ family, slug }) => {
      const problems: string[] = [];
      if (!declared.has(`@fontsource/${slug}`)) problems.push(`${family} → @fontsource/${slug} non è in packages/tokens/package.json`);
      if (!imported.has(`@fontsource/${slug}`)) problems.push(`${family} → nessun @import di @fontsource/${slug} in fonts.css`);
      return problems;
    });
}

/** Un `@import` in `fonts.css` che nessun pacchetto dichiarato copre. */
function undeclaredImports(css: string, pkg: typeof tokensPackage): string[] {
  const declared = declaredPackages(pkg);
  return importedPackages(css).filter((name) => !declared.has(name));
}

describe("font del tema: una famiglia, un pacchetto (Story 2.29)", () => {
  it("ogni famiglia non di sistema del tema ha il suo @fontsource in packages/tokens/package.json", () => {
    expect(missingFontPackages(fontsCss, themeCss, tokensPackage)).toEqual([]);
  });

  it("ogni @import di fonts.css ha il pacchetto dichiarato", () => {
    expect(undeclaredImports(fontsCss, tokensPackage)).toEqual([]);
    expect(importedPackages(fontsCss).length).toBeGreaterThan(0);
  });

  it("il tema ha almeno una famiglia propria (il test non è vacuo)", () => {
    const own = themeFamilies(themeCss).filter((family) => !isSystemOrGeneric(family));
    expect(own).toContain("Inter");
    expect(fontsourceSlug("Inter")).toBe("inter");
  });

  it("rosso: una famiglia nuova senza pacchetto e senza @import non passa il gate", () => {
    const theme = `${themeCss}\n  --font-serif: "Noto Serif", serif;\n`;
    const problems = missingFontPackages(fontsCss, theme, tokensPackage);
    expect(problems).toEqual([
      "Noto Serif → @fontsource/noto-serif non è in packages/tokens/package.json",
      "Noto Serif → nessun @import di @fontsource/noto-serif in fonts.css",
    ]);

    // Un @import senza pacchetto è rosso anche da solo.
    const css = `${fontsCss}@import "@fontsource/noto-serif/400.css";\n`;
    expect(undeclaredImports(css, tokensPackage)).toEqual(["@fontsource/noto-serif"]);
  });

  it("verde: la famiglia nuova con pacchetto e @import passa", () => {
    const theme = `${themeCss}\n  --font-serif: "Noto Serif", serif;\n`;
    const css = `${fontsCss}@import "@fontsource/noto-serif/400.css";\n`;
    const pkg = {
      ...tokensPackage,
      dependencies: { ...(tokensPackage.dependencies ?? {}), "@fontsource/noto-serif": "^5.3.0" },
    };
    expect(missingFontPackages(css, theme, pkg)).toEqual([]);
    expect(undeclaredImports(css, pkg)).toEqual([]);
  });
});
