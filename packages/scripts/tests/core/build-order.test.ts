import { defineContract } from "@app/contracts";
import { describe, expect, it } from "vitest";

import { buildOrder, letturaName, type Lettura, type LetturaLayer, type PluginData } from "../../src/core";
import { badgeLettura, CONTRACTS, layer, shopCardLettura } from "../fixtures/components";
import { carouselLettura, SECTIONS } from "../fixtures/sections";

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

  it("verde: il contratto annidato viene da `instance.contract`, non dal nome del componente (Story 2.23)", () => {
    const lettura = shopCardLettura(() => layer({ name: "Action", pluginData: { part: "action" }, instance: { component: "Pill", contract: "badge@1", variant: {}, overrides: [] } }));
    expect(buildOrder([lettura, badgeLettura()], [], CONTRACTS)).toEqual({ order: ["badge", "shop-card"], findings: [] });
  });

  it("rosso: `instance.contract` di un'altra versione o sconosciuto → blocco, ordine vuoto", () => {
    for (const contract of ["badge@2", "chip@1"]) {
      const lettura = shopCardLettura(() => layer({ name: "Action", pluginData: { part: "action" }, instance: { component: "Badge", contract, variant: {}, overrides: [] } }));
      const result = buildOrder([lettura, badgeLettura()], [], CONTRACTS);
      expect(result.order).toEqual([]);
      expect(result.findings).toEqual([expect.objectContaining({ level: "blocco", where: 'componente "ShopCard"', message: expect.stringMatching(new RegExp(`^Istanza annidata "${contract}": `)) })]);
    }
  });

  it("a parità, ordine alfabetico", () => {
    expect(buildOrder([containing("Zeta", "Beta"), containing("Alpha", "Beta")], ["beta"], ABSTRACT).order).toEqual(["alpha", "zeta"]);
  });

  it("una sezione da sola entra nell'ordine col suo nome: gli esempi dello slot non sono dipendenze", () => {
    const result = buildOrder([carouselLettura()], [], CONTRACTS, SECTIONS);
    expect(result).toEqual({ order: ["carousel"], findings: [] });
    // `shop-card` non è né da generare né già generato: se lo slot fosse visitato sarebbe un blocco.
    expect(result.findings.some((finding) => finding.message.includes("shop-card"))).toBe(false);
  });

  it("il nome di una lettura viene dal contratto, anche se il layer si chiama diversamente (sezione)", () => {
    const lettura = { ...carouselLettura(), component: "Prodotti" };
    expect(letturaName(lettura, CONTRACTS, SECTIONS)).toBe("carousel");
    expect(buildOrder([lettura], [], CONTRACTS, SECTIONS)).toEqual({ order: ["carousel"], findings: [] });
  });

  it("rosso: un nome in entrambi i registri è un blocco, non una precedenza", () => {
    const both = { ...CONTRACTS, carousel: contract("carousel") };
    const lettura = { ...carouselLettura(), component: "Prodotti" };
    const result = buildOrder([lettura], [], both, SECTIONS);
    expect(result.order).toEqual([]);
    expect(result.findings).toEqual([
      expect.objectContaining({ level: "blocco", where: 'componente "Prodotti"', message: expect.stringContaining("è sia un contratto di componente sia una sezione") }),
    ]);
    // Senza definizione risolta non c'è un nome: si ricade sul kebab del layer (`Prodotti` → `prodotti`).
    expect(letturaName(lettura, both, SECTIONS)).toBe("prodotti");
  });

  it("rosso: due letture della stessa sezione → blocco col nome, ordine vuoto", () => {
    const result = buildOrder([carouselLettura(), { ...carouselLettura(), component: "Prodotti" }], [], CONTRACTS, SECTIONS);
    expect(result.order).toEqual([]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        level: "blocco",
        where: 'componente "Prodotti"',
        message: 'Due letture con lo stesso nome "carousel": un contratto o una sezione si generano una volta sola.',
      }),
    ]);
  });

  it("rosso: uno slot dichiarato sconosciuto non nasconde le dipendenze dei figli", () => {
    const slides = (slot: string): LetturaLayer =>
      layer({
        name: "Slides",
        kind: "board",
        pluginData: { slot },
        children: [layer({ name: "Card", instance: { component: "Badge", variant: {}, overrides: [] } })],
      });
    const lettura = (slot: string): Lettura =>
      carouselLettura([{ variant: { perView: "3" }, root: layer({ name: "Carousel", kind: "board", children: [slides(slot)] }) }]);

    // Lo slot esiste: i figli sono esempi, nessuna dipendenza.
    expect(buildOrder([lettura("slides")], [], CONTRACTS, SECTIONS)).toEqual({ order: ["carousel"], findings: [] });

    // Lo slot dichiarato non esiste: i figli si visitano e `badge` resta una dipendenza mancante.
    const result = buildOrder([lettura("sconosciuto")], [], CONTRACTS, SECTIONS);
    expect(result.order).toEqual([]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        level: "blocco",
        where: 'componente "carousel"',
        message: 'Contiene "badge", che non è né da generare né già generato: leggi anche "badge" o generalo prima.',
      }),
    ]);
  });

  it("rosso: un contratto sconosciuto elenca anche le sezioni", () => {
    const result = buildOrder([{ ...badgeLettura(), pluginData: { contract: "widget@1" } }], [], CONTRACTS, SECTIONS);
    expect(result.order).toEqual([]);
    expect(result.findings).toEqual([expect.objectContaining({ level: "blocco", where: 'componente "Badge"' })]);
    const message = result.findings[0]!.message;
    expect(message).toContain("i contratti sono [badge, multiselect, shop-card]");
    expect(message).toContain("le sezioni sono [carousel]");
  });
});
