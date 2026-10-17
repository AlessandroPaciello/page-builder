import { describe, expect, it } from "vitest";

/**
 * Barrel vuoto (Story 2.18): l'export pubblico `.` di `@penpot-ds/ui` deve
 * continuare a risolvere anche senza componenti, finché la v3 non li riporta.
 */
describe("@penpot-ds/ui — export `.`", () => {
  it("risolve e non esporta nulla", async () => {
    const ui = await import("@penpot-ds/ui");
    expect(Object.keys(ui).filter((key) => key !== "default")).toEqual([]);
  });
});
