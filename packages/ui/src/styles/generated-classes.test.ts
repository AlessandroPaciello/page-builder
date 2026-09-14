// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";

/**
 * Story 2.9: ogni classe dei componenti generati deve produrre CSS. Un
 * `text-info` senza il tema dei token non genera nulla e il componente
 * resterebbe senza colore, con i gate verdi. Compila `globals.css` con
 * `@tailwindcss/node` e prova ogni classe presa dalle stringhe di `cva`
 * (varianti comprese) e dai `className` letterali dei file `@generated`
 * sotto `src/domains`. Gira anche dentro `gates:render` (suite ui).
 */

const stylesDir = dirname(fileURLToPath(import.meta.url));
const domainsDir = join(stylesDir, "..", "domains");
const globalsCss = readFileSync(join(stylesDir, "globals.css"), "utf8");
const THEME_IMPORT = '@import "@penpot-ds/tokens/tailwind-theme.css";';

function generatedFiles(dir: string): Array<{ path: string; content: string }> {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return generatedFiles(full);
    if (!/\.tsx?$/.test(entry)) return [];
    const content = readFileSync(full, "utf8");
    return content.includes("@generated") ? [{ path: relative(domainsDir, full), content }] : [];
  });
}

/** Il testo di ogni chiamata `cva(...)`, con le parentesi bilanciate e le stringhe rispettate. */
function cvaCalls(source: string): string[] {
  const calls: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf("cva(", from);
    if (start === -1) return calls;
    let depth = 0;
    let index = start + 3;
    for (; index < source.length; index++) {
      const char = source[index];
      if (char === '"') {
        index++;
        while (index < source.length && source[index] !== '"') index += source[index] === "\\" ? 2 : 1;
      } else if (char === "(") depth++;
      else if (char === ")" && --depth === 0) break;
    }
    calls.push(source.slice(start, index + 1));
    from = index + 1;
  }
}

/** Classi di un file generato: stringhe di cva (varianti sì, chiavi e `defaultVariants` no) e `className` letterali. */
export function classesOf(source: string): string[] {
  const lists: string[] = [];
  for (const call of cvaCalls(source)) {
    const withoutDefaults = call.replace(/defaultVariants:\s*\{[^}]*\}/g, "");
    for (const match of withoutDefaults.matchAll(/"((?:[^"\\]|\\.)*)"(\s*:)?/g)) {
      if (match[2] === undefined) lists.push(match[1]!);
    }
  }
  for (const match of source.matchAll(/className="([^"]*)"/g)) lists.push(match[1]!);
  for (const match of source.matchAll(/\bcn\(\s*"([^"]*)"/g)) lists.push(match[1]!);
  return [...new Set(lists.flatMap((list) => list.split(/\s+/)).filter(Boolean))].sort();
}

/** Le classi che, compilate con `css`, non producono nessuna regola. */
async function missingClasses(css: string, classes: readonly string[]): Promise<string[]> {
  const compiler = await compile(css, { base: stylesDir, onDependency: () => {} });
  // `build` è incrementale: una classe che non aggiunge nulla all'output non genera CSS.
  let previous = compiler.build([]);
  const missing: string[] = [];
  for (const candidate of classes) {
    const next = compiler.build([candidate]);
    if (next === previous) missing.push(candidate);
    previous = next;
  }
  return missing;
}

const files = generatedFiles(domainsDir);

describe("classi dei componenti generati → CSS (Story 2.9)", () => {
  it("l'estrazione prende base e varianti di cva e i className letterali, non chiavi né defaultVariants", () => {
    const sample = `const v = cva("a b", { variants: { status: { info: "", "out-line": "c" } }, defaultVariants: { status: "info" } });
      <div className="d e" /> <span className={cn("f", className)} />`;
    expect(classesOf(sample)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("ci sono file @generated da controllare", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("ogni classe dei file @generated sotto src/domains produce CSS con globals.css", async () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const candidate of await missingClasses(globalsCss, classesOf(file.content))) {
        problems.push(`${file.path}: "${candidate}" non produce CSS`);
      }
    }
    expect(problems).toEqual([]);
  }, 60_000);

  it("rosso senza il tema dei token: text-info non produce CSS", async () => {
    expect(globalsCss).toContain(THEME_IMPORT);
    const withoutTheme = globalsCss.replace(THEME_IMPORT, "");
    const all = [...new Set(files.flatMap((file) => classesOf(file.content)))].sort();
    expect(all).toContain("text-info");
    expect(await missingClasses(withoutTheme, all)).toContain("text-info");
  }, 60_000);
});
