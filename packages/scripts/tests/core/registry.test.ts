import { describe, expect, it } from "vitest";

import {
  ICON_LAYER_KINDS,
  layerClasses,
  registeredProperties,
  REGISTRY,
  type LetturaLayer,
  type ParentDir,
  type RegisteredProperty,
  type TokenType,
} from "../../src/core";

/**
 * Livello 1 della CI (Story 2.20): il registro con dati minimi scritti a
 * mano. Ogni voce ha un caso verde (le sue classi) e un caso rosso (avviso,
 * nessuna classe).
 */

const TOKEN_TYPES: Readonly<Record<string, TokenType>> = {
  "blue.500": "color",
  "spacing.4": "spacing",
  "radius.lg": "borderRadius",
  "radius.sm": "borderRadius",
  "border-width.1": "borderWidth",
  "text.sm": "fontSizes",
  "font-weight.bold": "fontWeights",
  "tracking.wide": "letterSpacing",
  "font.sans": "fontFamilies",
  "opacity.50": "opacity",
  "shadow.md": "shadow",
};

const tokenTypeOf = (name: string): TokenType | undefined => TOKEN_TYPES[name];

function layer(partial: Partial<LetturaLayer> = {}): LetturaLayer {
  return { name: "box", kind: "rect", tokens: {}, style: {}, children: [], ...partial };
}

function run(partial: Partial<LetturaLayer>, parentDir: ParentDir = "none") {
  return layerClasses(layer(partial), { parentDir, tokenTypeOf });
}

interface Case {
  readonly name: string;
  readonly layer: Partial<LetturaLayer>;
  readonly parentDir?: ParentDir;
  readonly classes: readonly string[];
}

/** Verde: una o più righe per voce. */
const GREEN: Readonly<Record<RegisteredProperty, readonly Case[]>> = {
  fill: [
    { name: "sfondo", layer: { tokens: { fill: "blue.500" } }, classes: ["bg-blue-500"] },
    { name: "testo", layer: { kind: "text", tokens: { fill: "blue.500" } }, classes: ["text-blue-500"] },
    { name: "icona", layer: { kind: "ellipse", tokens: { fill: "blue.500" } }, classes: ["fill-blue-500"] },
  ],
  strokeColor: [
    { name: "bordo", layer: { tokens: { strokeColor: "blue.500" } }, classes: ["border-blue-500"] },
    { name: "icona", layer: { kind: "path", tokens: { strokeColor: "blue.500" } }, classes: ["stroke-blue-500"] },
    { name: "icona (line)", layer: { kind: "line", tokens: { strokeColor: "blue.500" } }, classes: ["stroke-blue-500"] },
  ],
  strokeWidth: [
    { name: "bordo (bug 4)", layer: { tokens: { strokeWidth: "border-width.1" } }, classes: ["border-(length:--border-width-1)"] },
    { name: "icona: geometria, nessuna classe", layer: { kind: "vector", tokens: { strokeWidth: "border-width.1" } }, classes: [] },
  ],
  strokeStyle: [
    { name: "tratteggio", layer: { style: { strokeStyle: "dashed" } }, classes: ["border-dashed"] },
    { name: "punti", layer: { style: { strokeStyle: "dotted" } }, classes: ["border-dotted"] },
    { name: "default", layer: { style: { strokeStyle: "solid" } }, classes: [] },
  ],
  strokeAlignment: [{ name: "inner è il bordo CSS", layer: { style: { strokeAlignment: "inner" } }, classes: [] }],
  borderRadiusTopLeft: [{ name: "angolo", layer: { tokens: { borderRadiusTopLeft: "radius.lg" } }, classes: ["rounded-tl-lg"] }],
  borderRadiusTopRight: [{ name: "angolo", layer: { tokens: { borderRadiusTopRight: "radius.lg" } }, classes: ["rounded-tr-lg"] }],
  borderRadiusBottomRight: [{ name: "angolo", layer: { tokens: { borderRadiusBottomRight: "radius.lg" } }, classes: ["rounded-br-lg"] }],
  borderRadiusBottomLeft: [{ name: "angolo", layer: { tokens: { borderRadiusBottomLeft: "radius.lg" } }, classes: ["rounded-bl-lg"] }],
  paddingTop: [{ name: "padding", layer: { tokens: { paddingTop: "spacing.4" } }, classes: ["pt-4"] }],
  paddingRight: [{ name: "padding", layer: { tokens: { paddingRight: "spacing.4" } }, classes: ["pr-4"] }],
  paddingBottom: [{ name: "padding", layer: { tokens: { paddingBottom: "spacing.4" } }, classes: ["pb-4"] }],
  paddingLeft: [{ name: "padding", layer: { tokens: { paddingLeft: "spacing.4" } }, classes: ["pl-4"] }],
  rowGap: [{ name: "gap", layer: { tokens: { rowGap: "spacing.4" } }, classes: ["gap-y-4"] }],
  columnGap: [{ name: "gap", layer: { tokens: { columnGap: "spacing.4" } }, classes: ["gap-x-4"] }],
  fontSize: [{ name: "dimensione", layer: { kind: "text", tokens: { fontSize: "text.sm" } }, classes: ["text-sm"] }],
  fontWeight: [{ name: "peso", layer: { kind: "text", tokens: { fontWeight: "font-weight.bold" } }, classes: ["font-bold"] }],
  letterSpacing: [{ name: "spaziatura", layer: { kind: "text", tokens: { letterSpacing: "tracking.wide" } }, classes: ["tracking-wide"] }],
  fontFamily: [{ name: "famiglia (bug 5)", layer: { kind: "text", tokens: { fontFamily: "font.sans" } }, classes: ["font-sans"] }],
  opacity: [{ name: "opacità", layer: { tokens: { opacity: "opacity.50" } }, classes: ["opacity-(--opacity-50)"] }],
  shadow: [{ name: "ombra", layer: { tokens: { shadow: "shadow.md" } }, classes: ["shadow-md"] }],
  layoutDir: [
    { name: "colonna", layer: { style: { layoutDir: "column" } }, classes: ["flex", "flex-col"] },
    { name: "riga", layer: { style: { layoutDir: "row" } }, classes: ["flex", "flex-row"] },
    { name: "default", layer: { style: { layoutDir: "none" } }, classes: [] },
  ],
  layoutAlign: [{ name: "centro", layer: { style: { layoutAlign: "center" } }, classes: ["items-center"] }],
  layoutJustify: [{ name: "spazio tra", layer: { style: { layoutJustify: "space-between" } }, classes: ["justify-between"] }],
  layoutWrap: [{ name: "a capo", layer: { style: { layoutWrap: "wrap" } }, classes: ["flex-wrap"] }],
  sizingH: [
    { name: "fill in colonna (bug 3)", layer: { style: { sizingH: "fill" } }, parentDir: "column", classes: ["self-stretch"] },
    { name: "fill in riga", layer: { style: { sizingH: "fill" } }, parentDir: "row", classes: ["flex-1"] },
    { name: "fill fuori da un flex", layer: { style: { sizingH: "fill" } }, parentDir: "none", classes: ["w-full"] },
    { name: "hug", layer: { style: { sizingH: "auto" } }, parentDir: "row", classes: [] },
    { name: "fix (misura: Story 2.21)", layer: { style: { sizingH: "fix" } }, parentDir: "row", classes: [] },
  ],
  sizingV: [
    { name: "fill in colonna (bug 3)", layer: { style: { sizingV: "fill" } }, parentDir: "column", classes: ["flex-1"] },
    { name: "fill in riga", layer: { style: { sizingV: "fill" } }, parentDir: "row", classes: ["self-stretch"] },
    { name: "fill fuori da un flex", layer: { style: { sizingV: "fill" } }, parentDir: "none", classes: ["h-full"] },
  ],
};

/** Rosso: un token del tipo sbagliato (voci token) o un valore fuori lista (voci a parola chiave). */
function redCase(property: RegisteredProperty): Partial<LetturaLayer> {
  const entry = REGISTRY[property];
  if (entry.kind === "token") return { tokens: { [property]: entry.tokenType === "color" ? "spacing.4" : "blue.500" } };
  return { style: { [property]: "fuori-lista" } };
}

describe("registro — una voce, un rosso/verde", () => {
  it("la tabella dei verdi copre ogni voce del registro", () => {
    expect(Object.keys(GREEN).sort()).toEqual(registeredProperties().sort());
  });

  for (const property of registeredProperties()) {
    describe(property, () => {
      for (const green of GREEN[property]) {
        it(`verde: ${green.name}`, () => {
          const result = run(green.layer, green.parentDir);
          expect(result.findings).toEqual([]);
          expect(result.classes).toEqual([...green.classes].sort());
        });
      }
      it("rosso: avviso che nomina la proprietà, nessuna classe", () => {
        const result = run(redCase(property));
        expect(result.classes).toEqual([]);
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]).toMatchObject({ level: "avviso", where: 'layer "box"' });
        expect(result.findings[0]!.message).toContain(`"${property}"`);
      });
    });
  }
});

describe("registro — matrice della spec", () => {
  it("quattro angoli con lo stesso token → rounded-<sfx>", () => {
    const tokens = { borderRadiusTopLeft: "radius.lg", borderRadiusTopRight: "radius.lg", borderRadiusBottomRight: "radius.lg", borderRadiusBottomLeft: "radius.lg" };
    expect(run({ tokens }).classes).toEqual(["rounded-lg"]);
  });

  it("angoli diversi restano separati", () => {
    const tokens = { borderRadiusTopLeft: "radius.lg", borderRadiusTopRight: "radius.lg", borderRadiusBottomRight: "radius.sm", borderRadiusBottomLeft: "radius.lg" };
    expect(run({ tokens }).classes).toEqual(["rounded-bl-lg", "rounded-br-sm", "rounded-tl-lg", "rounded-tr-lg"]);
  });

  it("fuori lista: l'avviso nomina proprietà, valore e valori ammessi e dice cosa aggiungere", () => {
    const result = run({ style: { layoutDir: "diagonal" } });
    expect(result.classes).toEqual([]);
    const message = result.findings[0]!.message;
    expect(message).toContain('"layoutDir"');
    expect(message).toContain('"diagonal"');
    expect(message).toContain("[none, row, column]");
    expect(message).toContain("aggiungi");
  });

  it("non registrata: avviso che suggerisce la voce da aggiungere, nessuna classe", () => {
    const result = run({ style: { blur: 4 } });
    expect(result.classes).toEqual([]);
    expect(result.findings).toEqual([
      { level: "avviso", where: 'layer "box"', message: expect.stringContaining('"blur" (valore 4) non registrata') },
    ]);
    expect(result.findings[0]!.message).toContain("REGISTRY");
  });

  it("token del tipo sbagliato: l'avviso dice il tipo atteso", () => {
    const result = run({ tokens: { fill: "spacing.4" } });
    expect(result.classes).toEqual([]);
    expect(result.findings[0]!.message).toContain('si aspetta "color"');
  });

  it.each(["center", "outer"])("strokeAlignment %s: avviso con valore e motivo, nessuna classe", (value) => {
    const result = run({ style: { strokeAlignment: value } });
    expect(result.classes).toEqual([]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.message).toContain(`"${value}"`);
    expect(result.findings[0]!.message).toContain("inner");
  });

  it("i layer icona sono path, vector, ellipse e line", () => {
    expect([...ICON_LAYER_KINDS].sort()).toEqual(["ellipse", "line", "path", "vector"]);
  });

  it("un token che collassa in un suffisso vuoto è un avviso, non un'eccezione", () => {
    const result = layerClasses(layer({ tokens: { fill: "color" } }), { parentDir: "none", tokenTypeOf: () => "color" });
    expect(result.classes).toEqual([]);
    expect(result.findings).toEqual([{ level: "avviso", where: 'layer "box"', message: expect.stringContaining("suffisso vuoto") }]);
  });

  it("token sconosciuto al tema, valore senza token, parola chiave legata a un token: avvisi", () => {
    expect(run({ tokens: { fill: "red.999" } }).findings[0]!.message).toContain('"red.999" non è nel tema');
    expect(run({ style: { fill: "#ff0000" } }).findings[0]!.message).toContain("senza token");
    expect(run({ tokens: { layoutDir: "spacing.4" } }).findings[0]!.message).toContain("senza token");
  });

  it("deterministica: classi ordinate e senza doppioni, avvisi in ordine di proprietà", () => {
    const result = run({
      tokens: { paddingTop: "spacing.4", fill: "blue.500" },
      style: { zeta: 1, alpha: 2, layoutDir: "column" },
    });
    expect(result.classes).toEqual(["bg-blue-500", "flex", "flex-col", "pt-4"]);
    expect(result.findings.map((finding) => finding.message.match(/"(\w+)"/)![1])).toEqual(["alpha", "zeta"]);
  });

  it("una chiave ereditata (`toString`) è non registrata", () => {
    expect(run({ style: { toString: "x" } }).findings[0]!.message).toContain('"toString" (valore "x") non registrata');
  });
});
