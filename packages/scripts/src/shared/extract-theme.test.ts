import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readGeneratedHeader } from "../core/hash";
import { baseCatalog, extractTheme } from "./extract-theme";
import { PATHS } from "./paths";
import type { ThemeCatalog } from "./theme-generator";
import { tokensFromCss } from "./tokens-from-css";

/**
 * `extract_theme` (Story 2.26): set e temi → base + varianti → `theme.css`,
 * `themes/<g>-<n>.css`, `fonts.css` e `tokens.generated.ts` con il marker
 * `@generated` di pds. Il giro completo (AC 2) parte dal seme dello spike e
 * dal default di Tailwind installato, come farebbe il server.
 */

const require = createRequire(import.meta.url);
const tailwindDefault = readFileSync(require.resolve("tailwindcss/theme.css"), "utf8");
const seed = readFileSync(join(PATHS.packageRoot, "tests/fixtures/seed-theme.css"), "utf8");

/** Il catalogo che produrrebbe `tokens_from_css` sul seme, servito dall'adattatore. */
function catalogFromSeed(): ThemeCatalog {
  const { sets, themes } = tokensFromCss(tailwindDefault, seed);
  return { sets, themes };
}

describe("baseCatalog", () => {
  it("esclude solo i set usati dai temi non-default di un asse", () => {
    const catalog: ThemeCatalog = {
      sets: [
        { name: "tailwind", tokens: [] },
        { name: "semantic", tokens: [] },
        { name: "brand/ocean", tokens: [] },
      ],
      themes: [
        { group: "brand", name: "default", sets: [] },
        { group: "brand", name: "ocean", sets: ["brand/ocean"] },
      ],
    };
    expect(baseCatalog(catalog).sets.map((set) => set.name)).toEqual(["tailwind", "semantic"]);
  });

  it("un gruppo con un solo tema non è un asse: tutti i set stanno nella base", () => {
    const catalog: ThemeCatalog = {
      sets: [
        { name: "a", tokens: [] },
        { name: "b", tokens: [] },
      ],
      themes: [{ group: "brand", name: "default", sets: ["a", "b"] }],
    };
    expect(baseCatalog(catalog).sets.map((set) => set.name)).toEqual(["a", "b"]);
  });

  it("un set attivato anche da un tema non-variante resta nella base (variante che attiva l'intero stack)", () => {
    const catalog: ThemeCatalog = {
      sets: [
        { name: "tailwind", tokens: [] },
        { name: "semantic", tokens: [] },
        { name: "brand/ocean", tokens: [] },
      ],
      themes: [
        { group: "brand", name: "default", sets: ["tailwind", "semantic"] },
        { group: "brand", name: "ocean", sets: ["tailwind", "semantic", "brand/ocean"] },
      ],
    };
    expect(baseCatalog(catalog).sets.map((set) => set.name)).toEqual(["tailwind", "semantic"]);
  });
});

describe("extract_theme — giro seme → token → CSS (AC 2)", () => {
  it("theme.css dalla base, brand-ocean.css con le tre variabili, fonts.css con Inter", () => {
    const result = extractTheme(catalogFromSeed());
    expect(result.files.map((file) => file.path)).toEqual(["theme.css", "tokens.generated.ts", "themes/brand-ocean.css", "fonts.css"]);

    const themeCss = result.files.find((file) => file.path === "theme.css")!.content;
    expect(themeCss).toContain("--color-primary: var(--color-neutral-900);");
    expect(themeCss).toContain("--color-background: var(--color-white);");
    expect(themeCss).toContain("--color-red-600: #E7000B;");
    expect([...themeCss.matchAll(/\/\* set: (.+?) \*\//g)].map((m) => m[1])).toEqual(["tailwind", "semantic"]);

    const ocean = result.files.find((file) => file.path === "themes/brand-ocean.css")!.content;
    expect(ocean).toContain('[data-brand="ocean"]');
    expect([...ocean.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1])).toEqual(["--color-primary", "--color-primary-foreground", "--color-ring"]);
    expect(ocean).toContain("--color-primary: var(--color-blue-600);");

    const fonts = result.files.find((file) => file.path === "fonts.css")!.content;
    expect(fonts).toContain('@import "@fontsource/inter/400.css";');
    expect(fonts).toContain('@import "@fontsource/inter/700.css";');
    expect(result.packages).toEqual(["@fontsource/inter"]);
  });

  it("ogni file porta il marker @generated di pds con l'hash del corpo che torna", () => {
    const result = extractTheme(catalogFromSeed());
    for (const file of result.files) {
      const header = readGeneratedHeader(file.content);
      expect(header, file.path).toBeDefined();
      expect(header!.ok, file.path).toBe(true);
    }
  });

  it("tokens.generated.ts è il TS della base (stesse scale di generateTheme)", () => {
    const result = extractTheme(catalogFromSeed());
    const ts = result.files.find((file) => file.path === "tokens.generated.ts")!.content;
    expect(ts).toContain("export const spacing = {");
    expect(ts).toContain("export const colorNames = [");
  });
});

describe("extract_theme — errori e perdite esplicite", () => {
  it("una collisione vera nella base è un errore che non scrive niente", () => {
    const catalog: ThemeCatalog = {
      themes: [],
      sets: [
        {
          name: "a",
          tokens: [
            { name: "color.dup", type: "color", value: "#111111" },
            { name: "dup", type: "color", value: "#222222" },
          ],
        },
      ],
    };
    expect(() => extractTheme(catalog)).toThrow(/[Cc]ollision/);
  });

  it("una variante con un token assente dalla base è un errore", () => {
    const catalog: ThemeCatalog = {
      themes: [
        { group: "brand", name: "default", sets: [] },
        { group: "brand", name: "ocean", sets: ["brand/ocean"] },
      ],
      sets: [
        { name: "base", tokens: [{ name: "color.primary", type: "color", value: "#111111" }] },
        { name: "brand/ocean", tokens: [{ name: "color.sconosciuto", type: "color", value: "#222222" }] },
      ],
    };
    expect(() => extractTheme(catalog)).toThrow(/assenti dalla base/);
  });

  it("un valore `fonts` non supportato è un rifiuto esplicito", () => {
    expect(() => extractTheme({ themes: [], sets: [] }, { fonts: "woff2" as "fontsource" })).toThrow(/fontsource/);
  });

  it("un gruppo o nome di variante che non è un identificatore è un errore che nomina il tema", () => {
    const cases: Array<{ group: string; name: string }> = [
      { group: "brand", name: "ocean blue" },
      { group: "brand", name: "a/b" },
      { group: "", name: "ocean" },
    ];
    for (const { group, name } of cases) {
      const catalog: ThemeCatalog = {
        themes: [
          { group, name: "default", sets: [] },
          { group, name, sets: ["variant"] },
        ],
        sets: [
          { name: "base", tokens: [{ name: "color.primary", type: "color", value: "#111111" }] },
          { name: "variant", tokens: [{ name: "color.primary", type: "color", value: "#222222" }] },
        ],
      };
      expect(() => extractTheme(catalog)).toThrow(/gruppo e nome/);
    }
  });
});

describe("extract_theme — fonts.css (AC 3)", () => {
  it("famiglie di sistema o generiche: nessun import", () => {
    const catalog: ThemeCatalog = {
      themes: [],
      sets: [{ name: "a", tokens: [{ name: "font.sans", type: "fontFamilies", value: ["ui-sans-serif", "system-ui"] }] }],
    };
    const result = extractTheme(catalog);
    const fonts = result.files.find((file) => file.path === "fonts.css")!.content;
    expect(fonts).not.toContain("@import");
    expect(result.packages).toEqual([]);
  });

  it("famiglie non di sistema: un import per ogni peso dei fontWeights", () => {
    const catalog: ThemeCatalog = {
      themes: [],
      sets: [
        {
          name: "a",
          tokens: [
            { name: "font.sans", type: "fontFamilies", value: ["Manrope"] },
            { name: "font-weight.regular", type: "fontWeights", value: "400" },
            { name: "font-weight.bold", type: "fontWeights", value: "700" },
          ],
        },
      ],
    };
    const result = extractTheme(catalog);
    const fonts = result.files.find((file) => file.path === "fonts.css")!.content;
    expect(fonts).toContain('@import "@fontsource/manrope/400.css";');
    expect(fonts).toContain('@import "@fontsource/manrope/700.css";');
    expect(result.packages).toEqual(["@fontsource/manrope"]);
  });

  it("famiglie e pesi ripetuti si deduplicano, mantenendo l'ordine", () => {
    const catalog: ThemeCatalog = {
      themes: [],
      sets: [
        {
          name: "a",
          tokens: [
            { name: "font.sans", type: "fontFamilies", value: ["Manrope"] },
            { name: "font.alt", type: "fontFamilies", value: ["Manrope"] },
            { name: "font-weight.regular", type: "fontWeights", value: "400" },
            { name: "font-weight.normal", type: "fontWeights", value: "400" },
            { name: "font-weight.bold", type: "fontWeights", value: "700" },
          ],
        },
      ],
    };
    const result = extractTheme(catalog);
    const fonts = result.files.find((file) => file.path === "fonts.css")!.content;
    const imports = [...fonts.matchAll(/@import "[^"]+";/g)].map((m) => m[0]);
    expect(imports).toEqual(['@import "@fontsource/manrope/400.css";', '@import "@fontsource/manrope/700.css";']);
    expect(result.packages).toEqual(["@fontsource/manrope"]);
  });
});
