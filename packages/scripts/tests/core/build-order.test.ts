import { defineContract } from "@app/contracts";
import { describe, expect, it } from "vitest";

import { buildOrder, type Lettura, type PluginData } from "../../src/core";
import { badgeLettura, CONTRACTS, layer, shopCardLettura } from "../fixtures/components";

/** Livello 1 della CI (Story 2.22): ordine topologico dalle istanze annidate. */

const blocchi = (findings: readonly { level: string; message: string }[]): string[] => findings.filter((f) => f.level === "blocco").map((f) => f.message);

const contract = (name: string) => defineContract({ name, version: 1, axes: [], fields: {} });

/** Contratti di prova per gli ordini astratti. */
const ABSTRACT = { alpha: contract("alpha"), beta: contract("beta"), zeta: contract("zeta") };

/** Un componente con un'istanza di `instanceOf` nella radice. */
function containing(name: string, instanceOf: string): Lettura {
  return {
    component: name,
    pluginData: { contract: name.toLowerCase() },
    cells: [{ variant: {}, root: layer({ name, kind: "board", children: [layer({ name: "Inner", pluginData: { part: "inner" }, instance: { component: instanceOf, variant: {}, overrides: [] } })] }) }],
  };
}

describe("buildOrder", () => {
  it("ShopCard⊃Badge: prima badge, poi shop-card (qualunque sia l'ordine delle letture)", () => {
    expect(buildOrder([shopCardLettura(), badgeLettura()], [], CONTRACTS)).toEqual({ order: ["badge", "shop-card"], findings: [] });
    expect(buildOrder([badgeLettura(), shopCardLettura()], [], CONTRACTS).order).toEqual(["badge", "shop-card"]);
  });

  it("un annidato già generato basta: non entra nell'ordine", () => {
    expect(buildOrder([shopCardLettura()], ["badge"], CONTRACTS)).toEqual({ order: ["shop-card"], findings: [] });
  });

  it("rosso: annidato né letto né generato → blocco che lo nomina", () => {
    const result = buildOrder([shopCardLettura()], [], CONTRACTS);
    expect(result.order).toEqual([]);
    expect(blocchi(result.findings)).toHaveLength(1);
    expect(blocchi(result.findings)[0]).toContain('"badge"');
  });

  it("rosso: ciclo → blocco, ordine vuoto", () => {
    const result = buildOrder([containing("Alpha", "Beta"), containing("Beta", "Alpha")], [], ABSTRACT);
    expect(result.order).toEqual([]);
    expect(result.findings).toEqual([expect.objectContaining({ level: "blocco", where: "componenti [alpha, beta]" })]);
    expect(blocchi(buildOrder([containing("Alpha", "Alpha")], ["alpha"], ABSTRACT).findings)).toHaveLength(1);
  });

  it("rosso: lettura senza contratto o con un contratto sconosciuto → lo stesso blocco del contratto, ordine vuoto", () => {
    for (const pluginData of [{}, { contract: "chip" }] as PluginData[]) {
      const result = buildOrder([badgeLettura(), { ...shopCardLettura(), pluginData }], [], CONTRACTS);
      expect(result.order).toEqual([]);
      expect(result.findings).toEqual([expect.objectContaining({ level: "blocco", where: 'componente "ShopCard"' })]);
      expect(result.findings[0]!.message).toMatch(/^Contratto: /);
    }
  });

  it("rosso: due letture con lo stesso contratto → blocco", () => {
    const result = buildOrder([badgeLettura(), badgeLettura()], [], CONTRACTS);
    expect(result.order).toEqual([]);
    expect(blocchi(result.findings)[0]).toContain('"badge"');
  });

  it("i figli di un'istanza non contano: sono del componente annidato", () => {
    const lettura = containing("Alpha", "Beta");
    lettura.cells[0]!.root.children[0]!.children.push(layer({ name: "x", instance: { component: "Gamma", variant: {}, overrides: [] } }));
    expect(buildOrder([lettura], ["beta"], ABSTRACT)).toEqual({ order: ["alpha"], findings: [] });
  });

  it("a parità, ordine alfabetico", () => {
    expect(buildOrder([containing("Zeta", "Beta"), containing("Alpha", "Beta")], ["beta"], ABSTRACT).order).toEqual(["alpha", "zeta"]);
  });
});
