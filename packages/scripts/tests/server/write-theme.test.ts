import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { withGeneratedCssHeader } from "../../src/core";
import { themePathProblem, writeThemeFiles } from "../../src/server/write-theme";

/** I limiti dei path dei file del tema (Story 2.26): la stessa logica di `write-changes.ts`, su una cartella fissa. I path sono relativi a `packages/tokens/src/`. */

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "pds-theme-paths-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("themePathProblem", () => {
  it.each(["theme.css", "themes/brand-ocean.css", "fonts.css", "tokens.generated.ts", "themes/light.css"])("verde: %s", (path) => {
    expect(themePathProblem(tempRoot(), path)).toBeUndefined();
  });

  it.each([
    ["assoluto", "/etc/passwd"],
    ["con ..", "../x.css"],
    ["con .", "./theme.css"],
    ["con segmento vuoto", "theme//x.css"],
    ["con backslash", "theme\\x.css"],
    ["unità Windows", "C:/x.css"],
  ])("rosso: %s", (_label, path) => {
    expect(themePathProblem(tempRoot(), path)).toBeDefined();
  });

  it("rosso: il file è un symlink (scriverebbe fuori dal repo)", () => {
    const root = tempRoot();
    const outside = join(tempRoot(), "fuori.css");
    writeFileSync(outside, "x\n");
    mkdirSync(join(root, "packages/tokens/src"), { recursive: true });
    symlinkSync(outside, join(root, "packages/tokens/src", "theme.css"));
    expect(themePathProblem(root, "theme.css")).toMatch(/symlink/);
  });
});

describe("writeThemeFiles", () => {
  it("scrive i file validi e restituisce i path relativi alla root nell'ordine dato", () => {
    const root = tempRoot();
    const written = writeThemeFiles(root, [
      { path: "theme.css", content: withGeneratedCssHeader("a {}\n") },
      { path: "fonts.css", content: withGeneratedCssHeader("@import \"x\";\n") },
    ]);
    expect(written).toEqual(["packages/tokens/src/theme.css", "packages/tokens/src/fonts.css"]);
  });

  it("un file con `..` → errore e niente scritto", () => {
    const root = tempRoot();
    expect(() => writeThemeFiles(root, [{ path: "../index.ts", content: "x\n" }])).toThrow(/segmenti "\.\."/);
  });

  it("sovrascrive solo un file con il marker: senza marker è un errore", () => {
    const root = tempRoot();
    mkdirSync(join(root, "packages/tokens/src"), { recursive: true });
    writeFileSync(join(root, "packages/tokens/src", "theme.css"), "mio\n");
    expect(() => writeThemeFiles(root, [{ path: "theme.css", content: "nuovo\n" }])).toThrow(/senza il marker/);

    writeFileSync(join(root, "packages/tokens/src", "theme.css"), withGeneratedCssHeader("vecchio\n"));
    expect(writeThemeFiles(root, [{ path: "theme.css", content: withGeneratedCssHeader("nuovo\n") }])).toEqual(["packages/tokens/src/theme.css"]);
  });
});
