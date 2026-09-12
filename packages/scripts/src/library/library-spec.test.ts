import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { LIBRARY_SPEC, type SemanticSeed, type SeedToken } from "./library-spec";
import { generateTheme, varName, type TokenCatalog } from "../theme-generator";

const here = import.meta.dirname;
const seed: SemanticSeed = JSON.parse(
  readFileSync(resolve(here, "semantic-tokens.seed.json"), "utf8"),
) as SemanticSeed;

function seedCatalog(): TokenCatalog {
  return {
    sets: [
      { name: "palette", tokens: seed.palette.map((t) => ({ ...t })) },
      { name: "semantic", tokens: seed.semantic.map((t) => ({ ...t })) },
    ],
  };
}

describe("LIBRARY_SPEC — nomi token compatibili con varSuffix", () => {
  it("produce le variabili attese senza toccare il generatore", () => {
    const expected: Array<[string, string, string]> = [
      ["color.primary", "color", "color-primary"],
      ["text.sm", "fontSizes", "text-sm"],
      ["font.sans", "fontFamilies", "font-sans"],
      ["shadow.ring", "shadow", "shadow-ring"],
      ["opacity.disabled", "opacity", "opacity-disabled"],
      ["radius.sm", "borderRadius", "radius-sm"],
      ["spacing.1", "spacing", "spacing-1"],
      ["font-weight.regular", "fontWeights", "font-weight-regular"],
      ["tracking.none", "letterSpacing", "tracking-none"],
      ["border-width.default", "borderWidth", "border-width-default"],
    ];
    for (const [name, type, variable] of expected) {
      expect(varName(name, type as never), name).toBe(variable);
    }
  });

  it("ogni token della spec produce un nome variabile unico", () => {
    const names = LIBRARY_SPEC.tokens.map((token) => varName(token.name, token.type));
    expect(new Set(names).size).toBe(names.length);
  });

  it("nessun nome token duplicato nella spec", () => {
    const names = LIBRARY_SPEC.tokens.map((token) => token.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("LIBRARY_SPEC — contenuto minimo richiesto", () => {
  it("ha i 25 token colore semantici shadcn + i 3 feedback", () => {
    for (const name of [
      "color.background",
      "color.foreground",
      "color.card",
      "color.card-foreground",
      "color.popover",
      "color.popover-foreground",
      "color.primary",
      "color.primary-foreground",
      "color.secondary",
      "color.secondary-foreground",
      "color.muted",
      "color.muted-foreground",
      "color.accent",
      "color.accent-foreground",
      "color.destructive",
      "color.destructive-foreground",
      "color.border",
      "color.input",
      "color.ring",
      "color.success",
      "color.success-foreground",
      "color.warning",
      "color.warning-foreground",
      "color.info",
      "color.info-foreground",
    ]) {
      expect(LIBRARY_SPEC.tokens.some((t) => t.name === name), name).toBe(true);
    }
  });

  it("conta 61 token: 25 color, 4 radius, 9 spacing, 7 text, 4 font-weight, 2 font, 3 tracking, 2 border-width, 1 opacity, 4 shadow", () => {
    expect(LIBRARY_SPEC.tokens).toHaveLength(61);
    const byType = new Map<string, number>();
    for (const token of LIBRARY_SPEC.tokens) byType.set(token.type, (byType.get(token.type) ?? 0) + 1);
    expect(byType.get("color")).toBe(25);
    expect(byType.get("borderRadius")).toBe(4);
    expect(byType.get("spacing")).toBe(9);
    expect(byType.get("fontSizes")).toBe(7);
    expect(byType.get("fontWeights")).toBe(4);
    expect(byType.get("fontFamilies")).toBe(2);
    expect(byType.get("letterSpacing")).toBe(3);
    expect(byType.get("borderWidth")).toBe(2);
    expect(byType.get("opacity")).toBe(1);
    expect(byType.get("shadow")).toBe(4);
  });

  it("dichiara 19 coppie di contrasto con le soglie attese", () => {
    expect(LIBRARY_SPEC.contrastPairs).toHaveLength(19);
    const textPairs = LIBRARY_SPEC.contrastPairs.filter((p) => p.minRatio === 4.5);
    const indicatorPairs = LIBRARY_SPEC.contrastPairs.filter((p) => p.minRatio === 3);
    expect(textPairs).toHaveLength(14);
    expect(indicatorPairs.map((p) => `${p.foreground} su ${p.background}`).sort()).toEqual([
      "color.border su color.background",
      "color.destructive su color.background",
      "color.input su color.background",
      "color.ring su color.background",
      "color.ring su color.card",
    ]);
  });

  it("le combinazioni usate dai design sono presidiate (review 2.4, 2° pass)", () => {
    const designPairs = [
      { foreground: "color.muted-foreground", background: "color.background" },
      { foreground: "color.muted-foreground", background: "color.card" },
      { foreground: "color.foreground", background: "color.card" },
      { foreground: "color.destructive", background: "color.background" },
      { color: undefined, background: "color.card", foreground: "color.ring" },
    ];
    for (const pair of designPairs) {
      expect(
        LIBRARY_SPEC.contrastPairs.some(
          (declared) => declared.foreground === pair.foreground && declared.background === pair.background,
        ),
        `${pair.foreground} su ${pair.background}`,
      ).toBe(true);
    }
  });

  it("warning è l'unica coppia fillPairOnly", () => {
    const fillOnly = LIBRARY_SPEC.contrastPairs.filter((p) => p.fillPairOnly);
    expect(fillOnly).toHaveLength(1);
    expect(fillOnly[0]?.foreground).toBe("color.warning-foreground");
    expect(fillOnly[0]?.background).toBe("color.warning");
  });
});

describe("seed — coerenza con la spec", () => {
  const allTokens: SeedToken[] = [...seed.palette, ...seed.semantic];

  it("il set semantic copre esattamente i token della spec (nome e tipo)", () => {
    const semanticByName = new Map(seed.semantic.map((t) => [t.name, t]));
    for (const required of LIBRARY_SPEC.tokens) {
      const seeded = semanticByName.get(required.name);
      expect(seeded, `token mancante nel seed: ${required.name}`).toBeDefined();
      expect(seeded?.type, required.name).toBe(required.type);
    }
    expect(seed.semantic).toHaveLength(LIBRARY_SPEC.tokens.length);
  });

  it("nessun token palette orfano: ogni token della palette è referenziato da un semantico", () => {
    const refs = new Set<string>();
    for (const token of seed.semantic) {
      if (typeof token.value !== "string") continue;
      const match = /^\{(.+)\}$/.exec(token.value);
      if (match?.[1]) refs.add(match[1]);
      if (Array.isArray(token.value)) {
        for (const layer of token.value) {
          if (typeof layer === "object" && layer !== null && "color" in layer) {
            const colorRef = /^\{(.+)\}$/.exec(String((layer as { color: unknown }).color));
            if (colorRef?.[1]) refs.add(colorRef[1]);
          }
        }
      }
    }
    for (const paletteToken of seed.palette) {
      expect(refs.has(paletteToken.name), `token palette orfano: ${paletteToken.name}`).toBe(true);
    }
  });

  it("ogni riferimento {…} del seed risolve a un token esistente dello stesso catalogo", () => {
    const names = new Set(allTokens.map((t) => t.name));
    for (const token of allTokens) {
      if (typeof token.value === "string") {
        const match = /^\{(.+)\}$/.exec(token.value);
        if (match?.[1]) expect(names.has(match[1]), `${token.name} → {${match[1]}}`).toBe(true);
      }
      if (Array.isArray(token.value)) {
        for (const layer of token.value) {
          if (typeof layer === "object" && layer !== null && "color" in layer) {
            const raw = String((layer as { color: unknown }).color);
            const match = /^\{(.+)\}$/.exec(raw);
            if (match?.[1]) expect(names.has(match[1]), `${token.name} → {${match[1]}}`).toBe(true);
          }
        }
      }
    }
  });

  it("i valori chiave del seed coincidono con quelli decisi (2026-09-12)", () => {
    const byName = new Map(allTokens.map((t) => [t.name, t]));
    expect(byName.get("color.background")?.value).toBe("{gray.1}");
    expect(byName.get("color.primary")?.value).toBe("{accent.9}");
    expect(byName.get("color.border")?.value).toBe("{gray.8}");
    expect(byName.get("gray.1")?.value).toBe("#FAF4E8");
    expect(byName.get("accent.9")?.value).toBe("#006C49");
    expect(byName.get("gray.8")?.value).toBe("#7A8F85");
    expect(byName.get("radius.full")?.value).toBe("9999");
    expect(byName.get("opacity.disabled")?.value).toBe("0.5");
    expect(byName.get("tracking.tight")?.value).toBe("0.5px");
    expect(byName.get("font.sans")?.value).toEqual(["Manrope"]);
  });

  it("il catalogo del seed passa generateTheme() (riferimenti, tipi, unità, collisioni)", () => {
    expect(() => generateTheme(seedCatalog())).not.toThrow();
  });
});

describe("seed — coppie di contrasto della spec", () => {
  const byName = new Map([...seed.palette, ...seed.semantic].map((t) => [t.name, t]));

  /** Risolve un token colore seguendo i riferimenti {…} fino all'hex. */
  function resolveColor(name: string, seen: string[] = []): string {
    expect(seen, `riferimento circolare su ${name}`).not.toContain(name);
    const token = byName.get(name);
    expect(token, `token assente nel seed: ${name}`).toBeDefined();
    if (token!.type !== "color" || typeof token!.value !== "string") {
      throw new Error(`token non colore: ${name}`);
    }
    const match = /^\{(.+)\}$/.exec(token!.value);
    if (match?.[1]) return resolveColor(match[1], [...seen, name]);
    return token!.value;
  }

  it("ogni coppia della spec rispetta la sua soglia sui valori risolti del seed", () => {
    for (const pair of LIBRARY_SPEC.contrastPairs) {
      const ratio = contrastRatio(resolveColor(pair.foreground), resolveColor(pair.background));
      expect(ratio, `${pair.foreground} su ${pair.background}`).toBeGreaterThanOrEqual(pair.minRatio);
    }
  });

  it("i rapporti coincidono con la tabella del seed (campioni)", () => {
    expect(contrastRatio(resolveColor("color.foreground"), resolveColor("color.background"))).toBeCloseTo(15.6, 1);
    expect(contrastRatio(resolveColor("color.primary"), resolveColor("color.primary-foreground"))).toBeCloseTo(6.5, 1);
    expect(contrastRatio(resolveColor("color.border"), resolveColor("color.background"))).toBeCloseTo(3.15, 1);
  });

  it("warning come testo su background è sotto soglia (voce deferred esplicita)", () => {
    const ratio = contrastRatio(resolveColor("color.warning"), resolveColor("color.background"));
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeCloseTo(4.44, 1);
  });
});
