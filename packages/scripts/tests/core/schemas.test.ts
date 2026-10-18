import { describe, expect, it } from "vitest";

import { Change, Finding, Lettura } from "../../src/core";

/** Livello 1 della CI (Story 2.20): gli schemi del nucleo con dati scritti a mano. */

const lettura = {
  component: "badge",
  pluginData: { contract: "badge@1" },
  cells: [
    {
      variant: { tone: "neutral" },
      root: {
        name: "Badge",
        kind: "board",
        tokens: { fill: "blue.500" },
        style: { layoutDir: "row", sizingH: "auto" },
        children: [
          { name: "label", kind: "text", pluginData: { part: "label" }, tokens: {}, style: { fontSize: 14 }, children: [] },
          {
            name: "icon",
            kind: "board",
            tokens: {},
            style: {},
            instance: { component: "icon", variant: { size: "sm" }, overrides: [] },
            children: [],
          },
        ],
      },
    },
  ],
};

describe("Lettura", () => {
  it("verde: componente con celle, layer annidati, plugin data e istanze", () => {
    expect(Lettura.parse(lettura)).toEqual(lettura);
  });

  it("rosso: un layer senza `name` fallisce con il path del layer", () => {
    const broken = structuredClone(lettura) as { cells: { root: { children: Record<string, unknown>[] } }[] };
    delete broken.cells[0]!.root.children[0]!["name"];
    const result = Lettura.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual(["cells", 0, "root", "children", 0, "name"]);
  });

  it("rosso: nessuna cella, valore di stile non scalare", () => {
    expect(Lettura.safeParse({ ...lettura, cells: [] }).success).toBe(false);
    const nested = structuredClone(lettura);
    (nested.cells[0]!.root.style as Record<string, unknown>)["fill"] = { r: 1 };
    expect(Lettura.safeParse(nested).success).toBe(false);
  });

  it("i plugin data ammettono risposte con chiavi libere, solo stringhe", () => {
    expect(Lettura.safeParse({ ...lettura, pluginData: { contract: "badge@1", "risposta:root": "div" } }).success).toBe(true);
    expect(Lettura.safeParse({ ...lettura, pluginData: { part: 3 } }).success).toBe(false);
  });
});

describe("Finding", () => {
  it("verde: avviso, blocco e domanda con opzioni", () => {
    for (const finding of [
      { level: "avviso", where: "layer x", message: "m" },
      { level: "blocco", where: "parte x", message: "m" },
      { level: "domanda", where: "parte x", message: "lista o parte nuova?", key: "lista", options: ["lista", "parte nuova"] },
    ]) {
      expect(Finding.parse(finding)).toEqual(finding);
    }
  });

  it("rosso: domanda con meno di due opzioni, senza `key` o con `key` vuota, livello ignoto, messaggio vuoto", () => {
    expect(Finding.safeParse({ level: "domanda", where: "x", message: "m", key: "k", options: ["solo"] }).success).toBe(false);
    expect(Finding.safeParse({ level: "domanda", where: "x", message: "m", options: ["a", "b"] }).success).toBe(false);
    expect(Finding.safeParse({ level: "domanda", where: "x", message: "m", key: "", options: ["a", "b"] }).success).toBe(false);
    expect(Finding.safeParse({ level: "errore", where: "x", message: "m" }).success).toBe(false);
    expect(Finding.safeParse({ level: "avviso", where: "x", message: "" }).success).toBe(false);
  });
});

describe("Change", () => {
  it("verde: crea e aggiorna con contenuto, elimina senza", () => {
    for (const change of [
      { action: "crea", path: "a/Badge.styles.ts", content: "x" },
      { action: "aggiorna", path: "a/Badge.styles.ts", content: "" },
      { action: "elimina", path: "a/Badge.stories.tsx" },
    ]) {
      expect(Change.parse(change)).toEqual(change);
    }
  });

  it("rosso: crea senza contenuto, path vuoto, azione ignota, elimina con contenuto", () => {
    expect(Change.safeParse({ action: "crea", path: "a" }).success).toBe(false);
    expect(Change.safeParse({ action: "elimina", path: "" }).success).toBe(false);
    expect(Change.safeParse({ action: "rinomina", path: "a" }).success).toBe(false);
    expect(Change.safeParse({ action: "elimina", path: "a", content: "x" }).success).toBe(false);
  });
});
