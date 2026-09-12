import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { generateTheme, type TokenCatalog } from "../theme-generator";

/**
 * Test sulla NUOVA library (Story 2.4, Task 8, AC #4): la rigenerazione live
 * ha sostituito la fixture con i token semantici shadcn; il generatore non è
 * stato toccato. Dalla Story 2.5 è l'unica fixture: la legacy `mis` è stata
 * cancellata e i test ripuntati (theme-generator.test.ts).
 */

const here = dirname(fileURLToPath(import.meta.url));
const newFixturePath = resolve(here, "../__fixtures__/penpot-catalog.json");

function loadFixture(path: string): TokenCatalog {
  return JSON.parse(readFileSync(path, "utf8")) as TokenCatalog;
}

describe("generateTheme — nuova library (fixture penpot-catalog.json)", () => {
  it("genera i nomi semantici attesi: --color-primary, --color-ring, --shadow-ring", () => {
    const { css } = generateTheme(loadFixture(newFixturePath));
    expect(css).toContain("--color-primary: var(--color-accent-9);");
    expect(css).toContain("--color-ring: var(--color-accent-9);");
    expect(css).toContain("--shadow-ring: 0px 0px 0px 3px var(--color-ring);");
  });

  it("non contiene più nomi mis-* (la library `mis` non è più la sorgente)", () => {
    const { css, ts } = generateTheme(loadFixture(newFixturePath));
    expect(css).not.toContain("mis-");
    expect(ts).not.toContain("mis-");
  });
});
