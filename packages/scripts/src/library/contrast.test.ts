import { describe, expect, it } from "vitest";

import { contrastRatio, parseHex, relativeLuminance } from "./contrast";

describe("parseHex", () => {
  it("accetta esadecimale a 6 cifre con e senza cancelletto", () => {
    expect(parseHex("#006C49")).toEqual({ r: 0, g: 108, b: 73 });
    expect(parseHex("FAF4E8")).toEqual({ r: 250, g: 244, b: 232 });
  });

  it("rifiuta formati non esadecimali a 6 cifre", () => {
    expect(parseHex("fff")).toBeNull();
    expect(parseHex("#GGGGGG")).toBeNull();
    expect(parseHex("rgba(0,0,0,1)")).toBeNull();
    expect(parseHex("")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("bianco 1, nero 0", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });
});

describe("contrastRatio", () => {
  it("nero su bianco = 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("il rapporto è simmetrico", () => {
    expect(contrastRatio("#006C49", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#006C49"), 10);
  });

  it("primary #006C49 su bianco ≈ 6.5:1 (tabella del seed)", () => {
    expect(contrastRatio("#006C49", "#FFFFFF")).toBeCloseTo(6.5, 1);
  });

  it("il caso border 1.5:1 della memoria 2.1 è sotto la soglia 3:1", () => {
    // Grigio che produce esattamente 1.5:1 contro il bianco (#D3D3D3).
    expect(contrastRatio("#FFFFFF", "#D3D3D3")).toBeCloseTo(1.5, 1);
    expect(contrastRatio("#FFFFFF", "#D3D3D3")).toBeLessThan(3);
  });

  it("fallisce loud su un colore non valido", () => {
    expect(() => contrastRatio("nope", "#FFFFFF")).toThrow(/non valido/);
  });
});
