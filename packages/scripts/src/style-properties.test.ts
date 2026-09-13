import { describe, expect, it } from "vitest";

import type { StyleProperty } from "./library/library-plan";
import {
  ICON_LAYER_KINDS,
  STYLE_PROPERTIES,
  layerTreeProblems,
  lookupProperty,
  propertyProblem,
  radiusCorners,
  registeredProperties,
  removalClasses,
} from "./style-properties";
import { utilityPrefixesFor } from "./token-vocabulary";

/**
 * Registro unico delle proprietà (Story 2.8 parte A): ogni riga della
 * matrice I/O della spec ha la sua prova, più la completezza rispetto a
 * `TYPE_UTILITY_PREFIXES` (il registro usa il vocabolario, non lo duplica).
 */

const where = { component: "Input", part: "root", cell: "state=default" };

describe("registro — matrice della spec", () => {
  it("tratteggio: strokeStyle dashed è registrato ma bloccato", () => {
    expect(propertyProblem("strokeStyle", { ...where, value: "dashed" })).toMatch(/^Proprietà bloccata/);
    expect(propertyProblem("strokeStyle", { ...where, value: "dotted" })).toMatch(/^Proprietà bloccata/);
  });

  it("fuori lista: strokeStyle mixed blocca con l'elenco dei valori ammessi", () => {
    expect(propertyProblem("strokeStyle", { ...where, value: "mixed" })).toMatch(
      /^Valore fuori lista.*"strokeStyle" ammette solo \[solid, dashed, dotted\]/,
    );
  });

  it("allineamento: strokeAlignment center/outer è bloccato", () => {
    expect(propertyProblem("strokeAlignment", { ...where, value: "center" })).toMatch(/^Proprietà bloccata/);
    expect(propertyProblem("strokeAlignment", { ...where, value: "outer" })).toMatch(/^Proprietà bloccata/);
  });

  it("non registrata: una proprietà ignota blocca", () => {
    expect(propertyProblem("fooBar", { ...where, token: "color.primary" })).toMatch(/^Proprietà non registrata/);
    // Anche un nome ereditato da Object.prototype non è una riga del registro.
    expect(propertyProblem("toString", where)).toMatch(/^Proprietà non registrata/);
  });

  it("icona: strokeWidth si ignora sui layer path/vector/ellipse/line per regola dichiarata", () => {
    expect(STYLE_PROPERTIES.strokeWidth.ignoreOnLayerKinds).toEqual(ICON_LAYER_KINDS);
    expect([...ICON_LAYER_KINDS].sort()).toEqual(["ellipse", "line", "path", "vector"]);
    expect(propertyProblem("strokeWidth", { ...where, token: "border-width.default" })).toBeNull();
  });

  it("strokeWidth e opacity sono supportate con verifica sulla base, senza classi", () => {
    expect(STYLE_PROPERTIES.strokeWidth.emitter.emit).toBe("coveredByBase");
    expect(STYLE_PROPERTIES.opacity.emitter.emit).toBe("coveredByBase");
    expect(STYLE_PROPERTIES.strokeWidth.emitter.baseValue("border-b")).toBe(1);
    expect(STYLE_PROPERTIES.strokeWidth.emitter.baseValue("border-ring")).toBeNull();
    expect(STYLE_PROPERTIES.opacity.emitter.baseValue("opacity-50")).toBe(0.5);
    expect(STYLE_PROPERTIES.opacity.emitter.baseValue("opacity")).toBeNull();
  });

  it("una parola chiave legata a un token è un errore", () => {
    expect(propertyProblem("strokeStyle", { ...where, token: "color.primary" })).toMatch(/parola chiave legata a un token/);
  });
});

describe("registro — errori nominativi", () => {
  it("nominano componente, parte, cella, proprietà e token o valore", () => {
    const problem = propertyProblem("strokeStyle", { ...where, value: "dashed" })!;
    for (const piece of ['"Input"', '"root"', '"state=default"', '"strokeStyle"', '"dashed"']) expect(problem).toContain(piece);
    const unregistered = propertyProblem("fooBar", { ...where, token: "color.primary" })!;
    expect(unregistered).toContain('"color.primary"');
    expect(unregistered).toMatch(/riga del registro.*mappatura.*test rosso\/verde/);
  });

  it("lookupProperty restituisce la riga di una proprietà usabile e lancia sulle altre", () => {
    expect(lookupProperty("fill").type).toEqual({ kind: "token", tokenType: "color" });
    expect(() => lookupProperty("fooBar", where)).toThrow(/non registrata.*"fooBar"/);
    expect(() => lookupProperty("fontFamilies", where)).toThrow(/bloccata.*"fontFamilies"/);
  });

  it("layerTreeProblems percorre l'albero: la radice è la parte root, i figli contano per nome", () => {
    const problems = layerTreeProblems(
      {
        name: "Input",
        tokens: { fill: "color.background" },
        style: { fill: ["#fff"], strokeStyle: "dashed" },
        children: [{ name: "placeholder", tokens: { fooBar: "x" }, style: {}, children: [] }],
      },
      { component: "Input", cell: "state=default" },
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/bloccata.*parte "root".*"strokeStyle"/);
    expect(problems[1]).toMatch(/non registrata.*parte "placeholder".*"fooBar"/);
  });
});

describe("registro — nomi ereditati", () => {
  it("una chiave di stile `toString` è non registrata e il messaggio non inventa un token", () => {
    const problems = layerTreeProblems(
      { name: "Input", tokens: {}, style: { toString: "x" }, children: [] },
      { component: "Input", cell: "state=default" },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/non registrata.*proprietà "toString", valore "x"/);
    expect(problems[0]).not.toContain("token");
  });
});

describe("registro — completezza rispetto a TYPE_UTILITY_PREFIXES", () => {
  it("ogni mappatura utility usa solo prefissi che il vocabolario del suo tipo produce", () => {
    for (const property of registeredProperties()) {
      const row = STYLE_PROPERTIES[property];
      if (row.type.kind !== "token") continue;
      const prefixes = utilityPrefixesFor(row.type.tokenType);
      const emitter = row.emitter;
      if (emitter.emit === "utility") {
        const used = [emitter.prefix, ...Object.values("byLayerKind" in emitter ? emitter.byLayerKind : {})];
        for (const prefix of used) expect(prefixes, `${property} → ${prefix}`).toContain(prefix);
      } else if (emitter.emit === "radiusCorner") {
        expect(prefixes).toContain("rounded");
        expect(emitter.corner.startsWith("rounded-")).toBe(true);
      }
    }
  });

  it("un tipo senza namespace utility v4 (borderWidth, opacity) non è mai mappato a classi", () => {
    for (const property of registeredProperties()) {
      const row = STYLE_PROPERTIES[property];
      if (row.type.kind !== "token" || utilityPrefixesFor(row.type.tokenType).length > 0) continue;
      expect(["coveredByBase", "none"], property).toContain(row.emitter.emit);
    }
  });

  it("solo due stati: una proprietà supportata ha una mappatura, una bloccata non ne ha", () => {
    for (const property of registeredProperties()) {
      const row = STYLE_PROPERTIES[property];
      if (row.status.state === "supported") expect(row.emitter.emit, property).not.toBe("none");
      else expect(row.emitter.emit, property).toBe("none");
    }
  });

  it("i quattro angoli radius, nell'ordine del registro", () => {
    expect(radiusCorners()).toEqual(["rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"]);
  });

  it("classi di rimozione (2.8 parte C): per prefisso utility risolto, solo fill le dichiara", () => {
    // Chiavi = prefissi utility: `bg` sui layer bg, `text` sui text — la
    // rimozione annulla la STESSA utility che il default emette.
    expect(STYLE_PROPERTIES.fill.emitter.removalClass).toEqual({ bg: "bg-transparent", text: "text-transparent" });
    expect(removalClasses()).toEqual(["bg-transparent", "text-transparent"]);
    // Le coveredByBase e le bloccate non guadagnano la rimozione.
    expect(STYLE_PROPERTIES.strokeWidth.emitter.emit).toBe("coveredByBase");
    expect(STYLE_PROPERTIES.opacity.emitter.emit).toBe("coveredByBase");
  });

  it("StyleProperty è derivata dal registro: le proprietà token sì, le parole chiave no", () => {
    const tokenProperty: StyleProperty = "strokeWidth";
    const blockedTokenProperty: StyleProperty = "fontFamilies";
    // @ts-expect-error — strokeStyle è una parola chiave: non si lega a un token.
    const keyword: StyleProperty = "strokeStyle";
    expect([tokenProperty, blockedTokenProperty, keyword]).toHaveLength(3);
  });
});
