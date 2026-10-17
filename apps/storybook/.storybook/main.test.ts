import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "./main";

/**
 * Pin della configurazione Storybook (Story 2.11, review Loop 2):
 * - i glob `stories` devono risolvere ad almeno una story (Story 2.18: il
 *   dropdown dell'editor), altrimenti la build esce 0 con zero story e
 *   nessun test lo segnala;
 * - l'addon a11y deve restare registrato (criterio "pannello a11y attivo");
 * - i glob (`domains/**` ed `editor/**`) devono restare in parità con lo smoke gate
 *   (packages/ui/src/stories.smoke.test.tsx), altrimenti story navigabili
 *   restano senza gate o viceversa.
 */

const here = dirname(fileURLToPath(import.meta.url));
const uiSrc = resolve(here, "../../../packages/ui/src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function extsOf(pattern: string): string[] {
  const group = /@\(([^)]+)\)/.exec(pattern)?.[1];
  if (group) return group.split("|").map((e) => `.${e}`);
  const tail = pattern.slice(pattern.lastIndexOf("."));
  return tail.includes("*") ? [] : [tail];
}

function resolvePattern(fromDir: string, pattern: string): string[] {
  const star = pattern.indexOf("*");
  const base = resolve(fromDir, star === -1 ? pattern : pattern.slice(0, star).replace(/\/$/, ""));
  let files: string[] = [];
  try {
    files = walk(base);
  } catch {
    return [];
  }
  const exts = extsOf(pattern);
  return files.filter((f) => f.includes(".stories.") && exts.some((e) => f.endsWith(e)));
}

describe("storybook config — catalogo e addon pinnati", () => {
  it("stories risolve ad almeno un modulo (solo .stories.tsx)", () => {
    const stories = (config as { stories?: unknown }).stories;
    expect(Array.isArray(stories)).toBe(true);
    const patterns = stories as string[];
    expect(patterns.length).toBeGreaterThan(0);

    const resolved = patterns.flatMap((p) => resolvePattern(here, p)).sort();
    expect(resolved.length).toBeGreaterThanOrEqual(1);
    for (const f of resolved) expect(f.endsWith(".stories.tsx")).toBe(true);
  });

  it("glob in parità con lo smoke gate (nessuna story fuori dal gate)", () => {
    const smoke = readFileSync(join(uiSrc, "stories.smoke.test.tsx"), "utf8");
    const SCOPES = ["domains", "editor"];
    for (const scope of SCOPES) expect(smoke).toContain(`./${scope}/**/*.stories.tsx`);
    const patterns = (config as { stories?: string[] }).stories ?? [];
    expect(patterns).toHaveLength(SCOPES.length);
    for (const scope of SCOPES) expect(patterns.some((p) => p.includes(`/packages/ui/src/${scope}/**/`))).toBe(true);
    const mainResolved = patterns.flatMap((p) => resolvePattern(here, p)).sort();
    const smokeResolved = SCOPES.flatMap((scope) => walk(join(uiSrc, scope)))
      .filter((f) => f.endsWith(".stories.tsx"))
      .sort();
    expect(mainResolved).toEqual(smokeResolved);
  });

  it("addon a11y registrato", () => {
    const addons = (config as { addons?: unknown }).addons as unknown[];
    const names = addons.map((a) => (typeof a === "string" ? a : (a as { name?: string }).name ?? ""));
    expect(names).toContain("@storybook/addon-a11y");
    const require = createRequire(import.meta.url);
    expect(() => require.resolve("@storybook/addon-a11y")).not.toThrow();
  });
});
