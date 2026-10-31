// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { preprocessCSS, resolveConfig } from "vite";
import { describe, expect, it } from "vitest";

/**
 * Story 2.17: il tema Penpot deve vincere nel CSS che il browser riceve.
 * `@tailwindcss/node` (gli altri test) accetta un `@import` ovunque; la
 * pipeline CSS di Vite (Storybook) scarta quello che sta dopo altre regole.
 * Qui si compila `globals.css` con `preprocessCSS` di Vite, la stessa
 * pipeline di Storybook, e si confrontano le utility con i valori letti da
 * `theme.css` (mai scritti nel test).
 */

const stylesDir = dirname(fileURLToPath(import.meta.url));
const uiRoot = join(stylesDir, "..", "..");
const globalsPath = join(stylesDir, "globals.css");
const globalsCss = readFileSync(globalsPath, "utf8");
const THEME_IMPORT = '@import "@penpot-ds/tokens/theme.css";';
const themeCss = readFileSync(
  createRequire(import.meta.url).resolve("@penpot-ds/tokens/theme.css"),
  "utf8",
);
const PROBE = '\n@source inline("bg-primary rounded-lg font-sans");\n';

function themeValue(name: string): string {
  const match = themeCss.match(new RegExp(`(?:^|[\\s;{])${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`${name} non è in theme.css`);
  return match[1]!.trim();
}

async function compileWithVite(css: string): Promise<string> {
  const config = await resolveConfig({ root: uiRoot, configFile: false, logLevel: "silent" }, "build");
  const result = await preprocessCSS(css + PROBE, globalsPath, config);
  return result.code;
}

/** La regola di un selettore di classe, es. `.bg-primary { ... }`. */
function ruleBody(css: string, selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
}

function declares(css: string, name: string, value: string): boolean {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  return new RegExp(`(?<![\\w-])${name}\\s*:\\s*${escapedValue}\\s*[;}]`).test(css);
}

/** Il testo di tutti i blocchi `@layer <name> { ... }`, con le graffe bilanciate (preflight e regole del progetto). */
function layerBlocks(css: string, name: string): string {
  const blocks: string[] = [];
  for (const match of css.matchAll(new RegExp(`@layer\\s+${name}\\s*\\{`, "g"))) {
    let depth = 0;
    let index = match.index;
    for (; index < css.length; index++) {
      if (css[index] === "{") depth++;
      else if (css[index] === "}" && --depth === 0) break;
    }
    blocks.push(css.slice(match.index, index + 1));
  }
  return blocks.join("\n");
}

function hasShadcnVar(css: string, name: string): boolean {
  return new RegExp(`(?<![\\w-])${name}\\s*:`).test(css);
}

/** Il layout di prima della 2.17: variabili shadcn, `@theme inline`, import del tema a metà. */
function oldLayout(css: string): string {
  const shadcn = `
:root {
  --primary: oklch(0.205 0 0);
  --radius: 0.625rem;
}

@theme inline {
  --font-sans: var(--font-old-sans), ui-sans-serif, system-ui, sans-serif;
  --color-primary: var(--primary);
  --radius-lg: var(--radius);
}

${THEME_IMPORT}
`;
  const withoutImport = css.replace(THEME_IMPORT, "");
  const anchor = "@custom-variant dark (&:is(.dark *));";
  if (!withoutImport.includes(anchor)) throw new Error("ancora @custom-variant mancante in globals.css");
  return withoutImport.replace(anchor, `${anchor}\n${shadcn}`);
}

describe("tema Penpot nel CSS compilato da Vite (Story 2.17)", () => {
  it("bg-primary, rounded-lg e font-sans usano le variabili del tema con i valori Penpot", async () => {
    const css = await compileWithVite(globalsCss);

    expect(ruleBody(css, ".bg-primary")).toMatch(/background-color:\s*var\(--color-primary\)/);
    expect(ruleBody(css, ".rounded-lg")).toMatch(/border-radius:\s*var\(--radius-lg\)/);
    expect(ruleBody(css, ".font-sans")).toMatch(/font-family:\s*var\(--font-sans\)/);

    for (const name of ["--color-primary", "--radius-lg", "--font-sans"]) {
      expect(declares(css, name, themeValue(name)), `${name}: ${themeValue(name)}`).toBe(true);
    }
    expect(hasShadcnVar(css, "--primary")).toBe(false);
    expect(hasShadcnVar(css, "--radius")).toBe(false);
    expect(css).not.toMatch(/geist/i);
    expect(css).not.toMatch(/next\/font/i);
  }, 60_000);

  it("focus e disabled hanno un default in @layer base con --color-ring e --opacity-disabled", async () => {
    const css = await compileWithVite(globalsCss);
    const base = layerBlocks(css, "base");
    expect(base).not.toBe("");

    expect(base).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-ring\)/);
    expect(base).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*2px/);
    const disabledRule = base.match(/([^{}]*)\{[^}]*opacity:\s*var\(--opacity-disabled\)[^}]*\}/);
    expect(disabledRule, "regola disabled in @layer base").not.toBeNull();
    const selector = disabledRule![1]!.replace(/\s+/g, "");
    const disabled = ':is(:disabled,[data-disabled],[aria-disabled="true"])';
    // Solo il disabilitato più esterno: un discendente di un disabilitato non moltiplica l'opacità.
    expect(selector).toBe(`${disabled}:not(${disabled}*)`);

    expect(base).toMatch(/html,\s*body\s*\{[^}]*font-family:\s*var\(--font-sans\)/);
    expect(base).toMatch(/(?<![\w,]\s*)body\s*\{[^}]*background-color:\s*var\(--color-background\)/);
    expect(base).toMatch(/(?<![\w,]\s*)body\s*\{[^}]*color:\s*var\(--color-foreground\)/);
    expect(declares(css, "--opacity-disabled", themeValue("--opacity-disabled"))).toBe(true);
  }, 60_000);

  it("ogni variabile del tema citata nei sorgenti di editor/ è dichiarata nel CSS compilato", async () => {
    const css = await compileWithVite(globalsCss);
    const editorDir = join(stylesDir, "..", "editor");
    const names = new Set<string>();
    for (const entry of readdirSync(editorDir).filter((name) => name.endsWith(".tsx"))) {
      const source = readFileSync(join(editorDir, entry), "utf8");
      for (const match of source.matchAll(/var\((--(?:color|radius|font)-[\w-]+)/g)) names.add(match[1]!);
    }
    expect(names.size).toBeGreaterThan(0);
    const missing = [...names].filter((name) => !new RegExp(`(?<![\\w-])${name}\\s*:`).test(css));
    expect(missing).toEqual([]);
  }, 60_000);

  it("rosso sul layout vecchio: var(--primary), var(--radius) e stack font custom", async () => {
    const css = await compileWithVite(oldLayout(globalsCss));
    const primaryOk = declares(css, "--color-primary", themeValue("--color-primary"));
    const radiusOk = declares(css, "--radius-lg", themeValue("--radius-lg"));
    const fontOk = declares(css, "--font-sans", themeValue("--font-sans"));

    expect(css).toMatch(/--color-primary:\s*var\(--primary\)/);
    expect(css).toMatch(/--radius-lg:\s*var\(--radius\)/);
    expect(css).toMatch(/font-old-sans/i);
    expect([primaryOk, radiusOk, fontOk]).toEqual([false, false, false]);
  }, 60_000);
});
