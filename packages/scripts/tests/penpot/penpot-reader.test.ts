import { describe, expect, it } from "vitest";

import { READ_TOKEN_CATALOG_CODE } from "../../src/penpot/penpot-reader";

/**
 * Il codice eseguito in Penpot da `readPenpotTokenCatalog` (Story 2.26, bug 6):
 * legge tutti i set, anche quelli non attivi, più i temi con i loro set attivi.
 */
describe("READ_TOKEN_CATALOG_CODE", () => {
  it("legge tutti i set senza filtrare sui set attivi", () => {
    expect(READ_TOKEN_CATALOG_CODE).toContain("catalog.sets.map(");
    expect(READ_TOKEN_CATALOG_CODE).not.toMatch(/\.active\b/);
  });

  it("legge i temi con gruppo, nome e set attivi", () => {
    expect(READ_TOKEN_CATALOG_CODE).toMatch(/themes: catalog\.themes\.map\(/);
    expect(READ_TOKEN_CATALOG_CODE).toContain("theme.activeSets.map((set) => set.name)");
  });
});
