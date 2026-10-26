import { badge, defineContract, type ComponentContract } from "@app/contracts";
import { beforeAll, describe, expect, it } from "vitest";

import { kebabOf, Lettura, verifyComponent, type LetturaLayer } from "../../src/core";
import { readComponent } from "../../src/penpot/read-component";
import { SCALE, tokenTypeOf } from "../fixtures/components";

/**
 * Test dal vivo (Story 2.23): legge Badge, ShopCard e Carousel dal file
 * Penpot "tailwind" (Penpot 2.18.3). Si salta senza `PDS_PENPOT_LIVE=1`; si
 * lancia a mano (vedi src/penpot/README.md). Nessuna lettura salvata.
 */

const LIVE = process.env.PDS_PENPOT_LIVE === "1";

/** I contratti dei test, sugli assi del file "tailwind". */
const shopCard = defineContract({
  name: "shop-card",
  version: 1,
  axes: [
    { name: "size", type: "option", values: ["default", "sm"], default: "default" },
    { name: "promo", type: "option", values: ["none", "discount"], default: "none" },
  ],
  fields: {},
});
const carousel = defineContract({
  name: "carousel",
  version: 1,
  axes: [{ name: "perView", type: "option", values: ["1", "2", "3"], default: "1" }],
  fields: {},
});
const CONTRACTS: Readonly<Record<string, ComponentContract>> = { badge, "shop-card": shopCard, carousel };

function layers(layer: LetturaLayer): LetturaLayer[] {
  return [layer, ...layer.children.flatMap(layers)];
}

const byName = (lettura: Lettura, name: string): LetturaLayer[] => lettura.cells.flatMap((cell) => layers(cell.root)).filter((layer) => layer.name === name);

/** Le chiavi di parte che `pds-code` proporrebbe (kebab del nome), solo in memoria: Penpot non si tocca. */
function withPartKeys(lettura: Lettura): Lettura {
  const keyed = (layer: LetturaLayer): LetturaLayer => ({
    ...layer,
    pluginData: { part: kebabOf(layer.name), ...layer.pluginData },
    children: layer.children.map(keyed),
  });
  return { ...lettura, cells: lettura.cells.map((cell) => ({ ...cell, root: keyed(cell.root) })) };
}

const isRounded = (value: unknown): boolean => typeof value !== "number" || Math.round(value * 100) / 100 === value;

describe.skipIf(!LIVE)("readComponent dal vivo (Penpot, file tailwind)", { timeout: 120_000 }, () => {
  const letture: Record<string, Lettura> = {};

  beforeAll(async () => {
    for (const name of ["badge", "shop-card", "carousel"]) letture[name] = await readComponent(name);
  }, 180_000);

  it("le tre letture passano Lettura.parse, con misure e posizioni a 2 decimali", () => {
    for (const lettura of Object.values(letture)) {
      expect(Lettura.parse(lettura)).toEqual(lettura);
      for (const layer of lettura.cells.flatMap((cell) => layers(cell.root))) {
        for (const property of ["x", "y", "width", "height"]) expect(isRounded(layer.style[property]), `${layer.name}.${property}`).toBe(true);
      }
    }
  });

  it("varianti: Badge ha 6 celle {variant, size} e il contratto badge@1", () => {
    const lettura = letture["badge"]!;
    expect(lettura.pluginData?.contract).toBe("badge@1");
    expect(lettura.cells).toHaveLength(6);
    for (const cell of lettura.cells) expect(Object.keys(cell.variant).sort()).toEqual(["size", "variant"]);
  });

  it("istanza: in ogni cella ShopCard promo=discount (size=sm e size=default) il layer Action è un Badge destructive sm senza override né figli", () => {
    const cells = letture["shop-card"]!.cells.filter((candidate) => candidate.variant["promo"] === "discount");
    expect(cells.map((cell) => cell.variant["size"]).sort()).toEqual(["default", "sm"]);
    for (const cell of cells) {
      const action = layers(cell.root).find((layer) => layer.name === "Action");
      expect(action, `cella size=${cell.variant["size"]}`).toBeDefined();
      expect(action!.instance).toEqual({ component: "Badge", contract: "badge@1", variant: { variant: "destructive", size: "sm" }, overrides: [] });
      expect(action!.children).toEqual([]);
    }
  });

  it("fill in un'istanza: le ShopCard nel Carousel con sizingV fill non hanno override", () => {
    const cards = byName(letture["carousel"]!, "ShopCard").filter((layer) => layer.instance !== undefined && layer.style["sizingV"] === "fill");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(card.instance!.overrides).toEqual([]);
  });

  it("assoluti: le frecce del Carousel", () => {
    for (const [name, constraintH] of [
      ["Previous", "left"],
      ["Next", "right"],
    ] as const) {
      const arrows = byName(letture["carousel"]!, name);
      expect(arrows).toHaveLength(3);
      for (const arrow of arrows) {
        expect(arrow.style).toMatchObject({ position: "absolute", constraintH, constraintV: "center" });
        expect(typeof arrow.style["x"]).toBe("number");
        expect(typeof arrow.style["y"]).toBe("number");
      }
    }
  });

  it("flex: la radice di ShopCard", () => {
    const root = letture["shop-card"]!.cells.find((cell) => cell.variant["size"] === "default")!.root;
    expect(root.style).toMatchObject({ layoutDir: "column", layoutAlign: "start", clip: true, width: 288 });
  });

  it("nome ignoto: errore che nomina il nome cercato", async () => {
    await expect(readComponent("nope")).rejects.toThrow(/"nope"/);
  });

  it("ShopCard in verifyComponent: il Badge annidato non dà blocchi né per override né per contratto", () => {
    // Il file non ha ancora chiavi di parte (le scrive pds-code, Story 2.29): senza, la verifica
    // si ferma alla domanda `part` e non guarda l'istanza. Qui si danno in memoria, dal nome del layer.
    const findings = verifyComponent(withPartKeys(letture["shop-card"]!), { tokenTypeOf, scale: SCALE, contracts: CONTRACTS });
    expect(findings.filter((finding) => finding.level === "domanda" && finding.key === "part")).toEqual([]);
    // Controllo positivo: l'istanza c'è davvero in ogni cella promo=discount, quindi il filtro sotto non è vuoto per caso.
    const discount = letture["shop-card"]!.cells.filter((cell) => cell.variant["promo"] === "discount");
    expect(discount.length).toBeGreaterThan(0);
    for (const cell of discount) {
      expect(layers(cell.root).some((layer) => layer.name === "Action" && layer.instance?.contract === "badge@1"), `cella size=${cell.variant["size"]}`).toBe(true);
    }
    const nested = findings.filter((finding) => finding.level === "blocco" && finding.where.includes('layer "Action"'));
    expect(nested).toEqual([]);
  });
});
