import { describe, expect, it } from "vitest";

import {
  allChildrenFill,
  Finding,
  geometryClasses,
  layerClasses,
  rootSizeClasses,
  scaleClass,
  type Cella,
  type LetturaLayer,
  type Scale,
  type TokenType,
} from "../../src/core";

/**
 * Livello 1 della CI (Story 2.21): geometria e larghezza con dati minimi
 * scritti a mano. La matrice della spec, poi un rosso/verde per regola.
 */

/** Scala della spec: `spacing.4` = 16, `spacing.10` = 40. */
const SCALE: Scale = [
  { suffix: "4", px: 16 },
  { suffix: "10", px: 40 },
];

const TOKEN_TYPES: Readonly<Record<string, TokenType>> = { "radius.lg": "borderRadius" };

const tokenTypeOf = (name: string): TokenType | undefined => TOKEN_TYPES[name];

function layer(partial: Partial<LetturaLayer> = {}): LetturaLayer {
  return { name: "box", kind: "rect", tokens: {}, style: {}, children: [], ...partial };
}

/** Un genitore senza flex, largo 200 e alto 100. */
function parent(partial: Partial<LetturaLayer> = {}): LetturaLayer {
  return layer({ name: "genitore", kind: "board", style: { width: 200, height: 100 }, ...partial });
}

/** Le classi del layer; `null` = il layer è la radice. */
function classesOf(child: LetturaLayer, of: LetturaLayer | null = parent()) {
  return layerClasses(child, { ...(of === null ? {} : { parent: of }), tokenTypeOf, scale: SCALE });
}

const avvisi = (findings: readonly Finding[]): string[] => findings.filter((finding) => finding.level === "avviso").map((finding) => finding.message);

function cell(width: number, variant: Record<string, string> = {}): Cella {
  return { variant, root: layer({ name: "Card", kind: "board", style: { width } }) };
}

describe("geometria — matrice della spec", () => {
  it("fix in scala: w-4", () => {
    const result = classesOf(layer({ style: { sizingH: "fix", width: 16 } }));
    expect(result).toEqual({ classes: ["w-4"], findings: [] });
  });

  it("fuori scala: w-[37px] e un avviso con spacing.10 (40px) come valore più vicino", () => {
    const result = classesOf(layer({ style: { width: 37 } }));
    expect(result.classes).toEqual(["w-[37px]"]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ level: "avviso", where: 'layer "box"' });
    expect(result.findings[0]!.message).toContain("--spacing-10 (40px)");
    expect(result.findings[0]!.message).toContain("37px");
  });

  it("tutti in fill: nessuna w- sul genitore", () => {
    const kids = [layer({ name: "a", style: { sizingH: "fill" } }), layer({ name: "b", style: { sizingH: "fill" } })];
    const box = layer({ name: "riga", style: { sizingH: "fix", width: 200, layoutDir: "row" }, children: kids });
    expect(classesOf(box).classes).toEqual(["flex", "flex-row"]);
  });

  it("radice uguale: [[], []]", () => {
    expect(rootSizeClasses([cell(200), cell(200)], { scale: SCALE })).toEqual({ classes: [[], []], findings: [] });
  });

  it("radice varia: una classe per cella, con avvisi se fuori scala", () => {
    const result = rootSizeClasses([cell(160, { size: "sm" }), cell(200, { size: "lg" })], { scale: SCALE });
    expect(result.classes).toEqual([["w-[160px]"], ["w-[200px]"]]);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]!.where).toBe('layer "Card" (cella size=sm)');
    expect(result.findings[1]!.where).toBe('layer "Card" (cella size=lg)');
  });

  it("assoluto: absolute left-4 top-0, genitore relative", () => {
    const child = layer({ style: { position: "absolute", x: 16, y: 0, sizingH: "auto", sizingV: "auto" } });
    expect(classesOf(child)).toEqual({ classes: ["absolute", "left-4", "top-0"], findings: [] });
    const box = parent({ children: [child] });
    expect(classesOf(box, null).classes).toEqual(["relative"]);
  });

  it("leftright: left-4 right-4, nessuna w-", () => {
    const child = layer({ style: { position: "absolute", constraintH: "leftright", x: 16, width: 168, sizingV: "auto", y: 0 } });
    expect(classesOf(child)).toEqual({ classes: ["absolute", "left-4", "right-4", "top-0"], findings: [] });
  });

  it("scale: avviso, nessuna classe orizzontale", () => {
    const child = layer({ style: { position: "absolute", constraintH: "scale", x: 16, width: 16, y: 0, sizingV: "auto" } });
    const result = classesOf(child);
    expect(result.classes).toEqual(["absolute", "top-0"]);
    expect(avvisi(result.findings)).toEqual([expect.stringContaining('"scale"')]);
  });

  it("esce: clip con un figlio a x -4 → overflow-hidden", () => {
    const box = parent({ style: { width: 200, height: 100, clip: true }, children: [layer({ style: { x: -4, y: 10, width: 20, height: 20 } })] });
    expect(classesOf(box, null).classes).toEqual(["overflow-hidden"]);
  });

  it("raggio + bordo: clip, raggio, figlio a x 0 → overflow-hidden", () => {
    const box = parent({
      tokens: { borderRadiusTopLeft: "radius.lg" },
      style: { width: 200, height: 100, clip: true },
      children: [layer({ style: { x: 0, y: 10, width: 20, height: 20 } })],
    });
    expect(classesOf(box, null).classes).toEqual(["overflow-hidden", "rounded-tl-lg"]);
  });

  it("ambiguo: clip, niente esce, figlio text → domanda key overflow, nessuna classe", () => {
    const box = parent({ style: { width: 200, height: 100, clip: true }, children: [layer({ kind: "text", style: { x: 10, y: 10, width: 20, height: 20 } })] });
    const result = classesOf(box, null);
    expect(result.classes).toEqual([]);
    expect(result.findings).toEqual([
      { level: "domanda", where: 'layer "genitore"', key: "overflow", message: expect.any(String), options: ["hidden", "visible"] },
    ]);
    expect(Finding.parse(result.findings[0])).toEqual(result.findings[0]);
  });

  it("risposto: pluginData.overflow visible → nessuna domanda, nessuna classe", () => {
    const box = parent({
      pluginData: { overflow: "visible" },
      style: { width: 200, height: 100, clip: true },
      children: [layer({ kind: "text", style: { x: 10, y: 10, width: 20, height: 20 } })],
    });
    expect(classesOf(box, null)).toEqual({ classes: [], findings: [] });
  });

  it("fill in hug: figlio fill in un genitore auto → domanda key fillInHugH, nessuna classe di fill", () => {
    const result = classesOf(layer({ style: { sizingH: "fill" } }), parent({ style: { sizingH: "auto", layoutDir: "row" } }));
    expect(result.classes).toEqual([]);
    expect(result.findings).toEqual([
      { level: "domanda", where: 'layer "box"', key: "fillInHugH", message: expect.any(String), options: ["fill", "hug"] },
    ]);
  });

  it("valore malformato: width \"abc\", clip \"sì\" → avvisi, nessuna classe", () => {
    const result = classesOf(layer({ style: { width: "abc", clip: "sì" }, children: [layer({ style: { x: -4 } })] }));
    expect(result.classes).toEqual([]);
    expect(result.findings.map((finding) => finding.level)).toEqual(["avviso", "avviso"]);
    expect(result.findings[0]!.message).toContain('"clip"');
    expect(result.findings[1]!.message).toContain('"width"');
  });
});

describe("geometria — scala del tema", () => {
  it("verde: misura esatta su un passo → classe del passo", () => {
    expect(scaleClass("w", 40, SCALE)).toEqual({ cls: "w-10", offScale: false });
  });

  it("verde: il tema ridefinisce un passo (spacing.5 = 24px), non si usano i multipli di 4", () => {
    const theme: Scale = [{ suffix: "5", px: 24 }];
    expect(scaleClass("w", 24, theme).cls).toBe("w-5");
    expect(scaleClass("w", 20, theme)).toMatchObject({ cls: "w-[20px]", offScale: true });
  });

  it("rosso: 1px di differenza è già fuori scala (nessuna tolleranza)", () => {
    expect(scaleClass("w", 17, SCALE)).toEqual({ cls: "w-[17px]", offScale: true, nearest: { suffix: "4", px: 16 } });
    expect(scaleClass("w", 39, SCALE)).toEqual({ cls: "w-[39px]", offScale: true, nearest: { suffix: "10", px: 40 } });
  });

  it("a parità di distanza vince il passo più piccolo", () => {
    expect(scaleClass("w", 28, SCALE).nearest).toEqual({ suffix: "4", px: 16 });
    expect(scaleClass("w", 28, [...SCALE].reverse()).nearest).toEqual({ suffix: "4", px: 16 });
  });

  it("più token alla stessa misura: vince il suffisso minore, in qualunque ordine", () => {
    const twins: Scale = [
      { suffix: "md", px: 16 },
      { suffix: "4", px: 16 },
    ];
    expect(scaleClass("w", 16, twins).cls).toBe("w-4");
    expect(scaleClass("w", 16, [...twins].reverse()).cls).toBe("w-4");
  });

  it("negativi: -left-<sfx> oppure left-[-3px]", () => {
    expect(scaleClass("left", -16, SCALE)).toEqual({ cls: "-left-4", offScale: false });
    expect(scaleClass("left", -3, SCALE)).toMatchObject({ cls: "left-[-3px]", offScale: true });
  });

  it("zero: <prefix>-0 anche senza un passo da 0px", () => {
    expect(scaleClass("top", 0, SCALE)).toEqual({ cls: "top-0", offScale: false });
  });

  it("scala vuota: arbitrario, senza passo più vicino", () => {
    expect(scaleClass("w", 16, [])).toEqual({ cls: "w-[16px]", offScale: true });
    expect(avvisi(geometryClasses(layer({ style: { width: 16 } }), { parent: parent(), scale: [] }).findings)[0]).toContain("vuota");
  });
});

describe("geometria — dimensione fissa (regola a′)", () => {
  it("verde: fix è il default (sizing assente) → w- e h-", () => {
    expect(classesOf(layer({ style: { width: 16, height: 40 } })).classes).toEqual(["h-10", "w-4"]);
  });

  it("rosso: fill e auto non danno misura", () => {
    expect(classesOf(layer({ style: { sizingH: "auto", sizingV: "auto", width: 16, height: 16 } })).classes).toEqual([]);
    expect(classesOf(layer({ style: { sizingH: "fill", width: 16 } }), parent({ style: { layoutDir: "row" } })).classes).toEqual(["flex-1"]);
  });

  it("rosso: la radice non prende misure da layerClasses", () => {
    expect(classesOf(layer({ style: { width: 16 } }), null).classes).toEqual([]);
  });

  it("tutti in fill: solo l'asse dei figli in fill perde la misura", () => {
    const kids = [layer({ name: "a", style: { sizingH: "fill", sizingV: "auto" } })];
    expect(classesOf(layer({ style: { width: 200, height: 40 }, children: kids })).classes).toEqual(["h-10"]);
  });

  it("rosso: un figlio non fill basta a tenere la misura del genitore", () => {
    const kids = [layer({ name: "a", style: { sizingH: "fill" } }), layer({ name: "b", style: { sizingH: "auto" } })];
    expect(allChildrenFill(layer({ children: kids }), "H")).toBe(false);
    expect(classesOf(layer({ style: { width: 16, sizingV: "auto" }, children: kids })).classes).toEqual(["w-4"]);
  });

  it("gli assoluti non contano tra i figli in fill; senza figli nel flusso la regola non vale", () => {
    const fill = layer({ name: "a", style: { sizingH: "fill" } });
    const abs = layer({ name: "b", style: { position: "absolute", sizingH: "auto" } });
    expect(allChildrenFill(layer({ children: [fill, abs] }), "H")).toBe(true);
    expect(allChildrenFill(layer({ children: [abs] }), "H")).toBe(false);
    expect(allChildrenFill(layer(), "H")).toBe(false);
  });

  it("radice: tutti in fill ignora la misura anche lì", () => {
    const kids = [layer({ name: "a", style: { sizingH: "fill" } })];
    const cells: Cella[] = [
      { variant: { size: "sm" }, root: layer({ name: "Card", style: { width: 160 }, children: kids }) },
      { variant: { size: "lg" }, root: layer({ name: "Card", style: { width: 200 }, children: kids }) },
    ];
    expect(rootSizeClasses(cells, { scale: SCALE }).classes).toEqual([[], []]);
  });

  it("radice: misura in scala per cella senza avvisi; hug in una cella sola → solo l'altra ha la classe", () => {
    expect(rootSizeClasses([cell(16), cell(40)], { scale: SCALE })).toEqual({ classes: [["w-4"], ["w-10"]], findings: [] });
    const hug: Cella = { variant: {}, root: layer({ name: "Card", style: { width: 16, sizingH: "auto" } }) };
    expect(rootSizeClasses([hug, cell(40)], { scale: SCALE }).classes).toEqual([[], ["w-10"]]);
  });
});

describe("geometria — assoluti e vincoli", () => {
  const abs = (style: LetturaLayer["style"]): LetturaLayer => layer({ style: { position: "absolute", sizingH: "auto", sizingV: "auto", x: 16, y: 16, ...style } });

  it("right: distanza dal lato destro del genitore", () => {
    expect(classesOf(abs({ constraintH: "right", x: 168, width: 16 })).classes).toEqual(["absolute", "right-4", "top-4"]);
  });

  it("bottom e topbottom", () => {
    expect(classesOf(abs({ constraintV: "bottom", y: 44, height: 16 })).classes).toEqual(["absolute", "bottom-10", "left-4"]);
    expect(classesOf(abs({ constraintV: "topbottom", sizingV: "fix", y: 16, height: 44 })).classes).toEqual(["absolute", "bottom-10", "left-4", "top-4"]);
  });

  it("rosso: leftright con sizing fix non emette w-", () => {
    const result = classesOf(abs({ constraintH: "leftright", sizingH: "fix", x: 16, width: 168 }));
    expect(result.classes.filter((cls) => cls.startsWith("w-"))).toEqual([]);
    expect(result.classes).toContain("right-4");
  });

  it("verde: assoluto fix con vincolo left tiene la misura", () => {
    expect(classesOf(abs({ sizingH: "fix", width: 16 })).classes).toEqual(["absolute", "left-4", "top-4", "w-4"]);
  });

  it("center esatto: left-1/2 -translate-x-1/2 senza avvisi", () => {
    expect(classesOf(abs({ constraintH: "center", x: 92, width: 16 }))).toEqual({
      classes: ["-translate-x-1/2", "absolute", "left-1/2", "top-4"],
      findings: [],
    });
  });

  it("center non esatto: stesse classi e un avviso", () => {
    const result = classesOf(abs({ constraintH: "center", x: 90, width: 16 }));
    expect(result.classes).toEqual(["-translate-x-1/2", "absolute", "left-1/2", "top-4"]);
    expect(avvisi(result.findings)).toEqual([expect.stringContaining("non esattamente")]);
  });

  it("center senza la larghezza del genitore: classi di centratura, nessun avviso", () => {
    expect(classesOf(abs({ constraintH: "center", x: 90, width: 16 }), parent({ style: { height: 100 } }))).toEqual({
      classes: ["-translate-x-1/2", "absolute", "left-1/2", "top-4"],
      findings: [],
    });
  });

  it("assoluto con figli assoluti: absolute, mai relative", () => {
    const child = abs({});
    expect(classesOf({ ...abs({}), children: [child] }).classes).toEqual(["absolute", "left-4", "top-4"]);
    // La radice resta il riferimento con relative.
    expect(classesOf({ ...abs({}), children: [child] }, null).classes).toEqual(["relative"]);
  });

  it("assoluto in fill: fuori dal flusso del flex → w-full/h-full, nessuna domanda", () => {
    const hugRow = parent({ style: { sizingH: "auto", sizingV: "auto", layoutDir: "row" } });
    expect(classesOf(abs({ sizingH: "fill", sizingV: "fill" }), hugRow)).toEqual({
      classes: ["absolute", "h-full", "left-4", "top-4", "w-full"],
      findings: [],
    });
  });

  it("center verticale", () => {
    expect(classesOf(abs({ constraintV: "center", y: 42, height: 16 })).classes).toEqual(["-translate-y-1/2", "absolute", "left-4", "top-1/2"]);
  });

  it("negativo: un assoluto che sporge → -left-4", () => {
    expect(classesOf(abs({ x: -16 })).classes).toEqual(["-left-4", "absolute", "top-4"]);
  });

  it("dati mancanti: avviso, nessuna classe di posizione su quell'asse", () => {
    const result = classesOf(abs({ constraintH: "right", width: 16 }), parent({ style: {} }));
    expect(result.classes).toEqual(["absolute", "top-4"]);
    expect(avvisi(result.findings)).toEqual([expect.stringContaining('"right"')]);
  });

  it("rosso: un layer nel flusso ignora x/y e i vincoli", () => {
    expect(classesOf(layer({ style: { x: 16, y: 16, constraintH: "scale", sizingH: "auto", sizingV: "auto" } }))).toEqual({ classes: [], findings: [] });
  });

  it("rosso: la radice non è mai posizionata e non prende relative senza figli assoluti", () => {
    expect(classesOf(abs({}), null).classes).toEqual([]);
  });
});

describe("geometria — ritaglio", () => {
  const box = (partial: Partial<LetturaLayer>): LetturaLayer =>
    parent({ ...partial, style: { width: 200, height: 100, clip: true, ...partial.style } });
  const kid = (style: LetturaLayer["style"], partial: Partial<LetturaLayer> = {}): LetturaLayer =>
    layer({ ...partial, style: { x: 10, y: 10, width: 20, height: 20, ...style } });

  it("esce a destra o in basso → overflow-hidden", () => {
    expect(classesOf(box({ children: [kid({ x: 190 })] }), null).classes).toEqual(["overflow-hidden"]);
    expect(classesOf(box({ children: [kid({ y: 90 })] }), null).classes).toEqual(["overflow-hidden"]);
  });

  it("rosso: senza clip niente overflow-hidden, anche se un figlio esce", () => {
    expect(classesOf(box({ style: { clip: false }, children: [kid({ x: -4 })] }), null).classes).toEqual([]);
    expect(classesOf(parent({ children: [kid({ x: -4 })] }), null).classes).toEqual([]);
  });

  it("rosso: un figlio che tocca il bordo senza raggio non taglia", () => {
    expect(classesOf(box({ children: [kid({ x: 0 })] }), null).classes).toEqual([]);
  });

  it("rosso: raggio senza figli sul bordo non taglia", () => {
    expect(classesOf(box({ tokens: { borderRadiusTopLeft: "radius.lg" }, children: [kid({})] }), null).classes).toEqual(["rounded-tl-lg"]);
  });

  it("raggio + bordo destro o inferiore", () => {
    const tokens = { borderRadiusBottomRight: "radius.lg" };
    expect(classesOf(box({ tokens, children: [kid({ x: 180 })] }), null).classes).toEqual(["overflow-hidden", "rounded-br-lg"]);
    expect(classesOf(box({ tokens, children: [kid({ y: 80 })] }), null).classes).toEqual(["overflow-hidden", "rounded-br-lg"]);
  });

  it("niente esce e niente è variabile: nessuna classe, nessuna domanda", () => {
    expect(classesOf(box({ children: [kid({})] }), null)).toEqual({ classes: [], findings: [] });
  });

  it("contenuto variabile: immagine, slot, testo annidato", () => {
    for (const child of [kid({}, { kind: "image" }), kid({}, { pluginData: { slot: "media" } }), kid({}, { children: [layer({ kind: "text" })] })]) {
      expect(classesOf(box({ children: [child] }), null).findings).toEqual([expect.objectContaining({ level: "domanda", key: "overflow" })]);
    }
  });

  it("risposta hidden → overflow-hidden; risposta non valida → di nuovo la domanda", () => {
    const text = [kid({}, { kind: "text" })];
    expect(classesOf(box({ pluginData: { overflow: "hidden" }, children: text }), null)).toEqual({ classes: ["overflow-hidden"], findings: [] });
    const result = classesOf(box({ pluginData: { overflow: "boh" }, children: text }), null);
    expect(result.classes).toEqual([]);
    expect(result.findings).toEqual([expect.objectContaining({ level: "domanda", key: "overflow", message: expect.stringContaining('"boh"') })]);
  });
});

describe("geometria — fill dentro hug", () => {
  const hugRow = parent({ style: { sizingH: "auto", sizingV: "auto", layoutDir: "row" } });

  it("risposta fill → classi di fill; risposta hug → nessuna classe", () => {
    expect(classesOf(layer({ pluginData: { fillInHugH: "fill" }, style: { sizingH: "fill" } }), hugRow)).toEqual({ classes: ["flex-1"], findings: [] });
    expect(classesOf(layer({ pluginData: { fillInHugH: "hug" }, style: { sizingH: "fill" } }), hugRow)).toEqual({ classes: [], findings: [] });
  });

  it("rosso: una risposta ignorata o non valida ripropone la domanda", () => {
    const result = classesOf(layer({ pluginData: { fillInHugH: "sì" }, style: { sizingH: "fill" } }), hugRow);
    expect(result.classes).toEqual([]);
    expect(result.findings).toEqual([expect.objectContaining({ level: "domanda", key: "fillInHugH", message: expect.stringContaining('"sì"') })]);
  });

  it("verticale: chiave fillInHugV, la risposta di un asse non vale per l'altro", () => {
    const result = classesOf(layer({ pluginData: { fillInHugH: "fill" }, style: { sizingV: "fill" } }), hugRow);
    expect(result.findings).toEqual([expect.objectContaining({ level: "domanda", key: "fillInHugV" })]);
  });

  it("rosso: fill in un genitore fix non è una domanda", () => {
    expect(classesOf(layer({ style: { sizingH: "fill" } }), parent({ style: { layoutDir: "row" } }))).toEqual({ classes: ["flex-1"], findings: [] });
  });
});
