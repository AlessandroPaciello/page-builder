import { describe, expect, it } from "vitest";

import { comparable, normalizeVariants } from "./variant-normalize";

const contract = {
  axes: [
    { name: "variant", values: ["default", "secondary"] },
    { name: "size", values: ["sm", "md"] },
  ],
};

describe("comparable", () => {
  it("trim, spazi interni compressi, minuscole", () => {
    expect(comparable("  Out   Line ")).toBe("out line");
    expect(comparable(" SM ")).toBe("sm");
  });
});

describe("normalizeVariants", () => {
  it("maiuscole e spazi: asse `Size` e valore ` SM ` diventano `size`/`sm`, senza collisioni", () => {
    const result = normalizeVariants("Badge", contract, {
      axes: ["variant", "Size"],
      axesValues: { variant: ["default", "secondary"], Size: [" SM ", "md"] },
      cells: [{ variant: "default", Size: " SM " }],
    });
    expect(result.collisions).toEqual([]);
    expect(result.axes).toEqual(["variant", "size"]);
    expect(result.axesValues).toEqual({ variant: ["default", "secondary"], size: ["sm", "md"] });
    expect(result.cells).toEqual([{ variant: "default", size: "sm" }]);
  });

  it("ordine degli assi: per nome, nell'ordine del contratto, mai per posizione", () => {
    const result = normalizeVariants("Badge", contract, {
      axes: ["size", "variant"],
      axesValues: { size: ["sm", "md"], variant: ["default", "secondary"] },
      cells: [{ size: "md", variant: "secondary" }, null],
    });
    expect(result.axes).toEqual(["variant", "size"]);
    expect(result.cells).toEqual([{ size: "md", variant: "secondary" }, null]);
  });

  it("valori e assi senza corrispondenza restano intatti (restano \"in più\" a valle)", () => {
    const result = normalizeVariants("Badge", contract, {
      axes: ["variant", "size", "Tone"],
      axesValues: { variant: ["default", "secondary", " Info "], size: ["sm", "md"], Tone: ["x"] },
      cells: [{ variant: " Info ", size: "sm", Tone: "x" }],
    });
    expect(result.axes).toEqual(["variant", "size", "Tone"]);
    expect(result.axesValues.variant).toEqual(["default", "secondary", " Info "]);
    expect(result.cells[0]).toEqual({ variant: " Info ", size: "sm", Tone: "x" });
  });

  it("collisione: `SM` e `sm` sullo stesso asse sono un errore che nomina i due valori", () => {
    const result = normalizeVariants("Badge", contract, {
      axes: ["variant", "size"],
      axesValues: { variant: ["default", "secondary"], size: ["SM", "sm", "md"] },
      cells: [],
    });
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]).toMatch(/Componente "Badge", asse "size".*"SM", "sm".*"sm"/);
    // Nessuna scelta al posto del designer: i valori in collisione restano intatti.
    expect(result.axesValues.size).toEqual(["SM", "sm", "md"]);
  });

  it("collisione di assi: `Size` e `size` nello stesso container", () => {
    const result = normalizeVariants("Badge", contract, {
      axes: ["variant", "Size", "size"],
      axesValues: { variant: ["default", "secondary"], Size: ["sm"], size: ["md"] },
      cells: [],
    });
    expect(result.collisions.some((c) => c.includes('gli assi ["Size", "size"]'))).toBe(true);
  });
});
