import { describe, expect, it } from "vitest";

import { parseArgs } from "./extract-component";

describe("parseArgs", () => {
  it("accetta 'extract' + nome componente, rimuovendo il separatore pnpm '--'", () => {
    expect(parseArgs(["--", "extract", "Badge"])).toEqual({ mode: "extract", componentName: "Badge" });
  });

  it("accetta 'validate' + nome componente", () => {
    expect(parseArgs(["--", "validate", "Badge"])).toEqual({ mode: "validate", componentName: "Badge" });
  });

  it("rifiuta una modalità sconosciuta nominandola", () => {
    expect(() => parseArgs(["--", "extrct", "Badge"])).toThrow(/"extrct"/);
  });

  it("rifiuta l'assenza di modalità", () => {
    expect(() => parseArgs([])).toThrow(/<mancante>/);
  });

  it("rifiuta il nome componente mancante", () => {
    expect(() => parseArgs(["--", "extract"])).toThrow(/Nome componente mancante/);
  });

  it("rifiuta un nome componente che sembra un flag", () => {
    expect(() => parseArgs(["--", "extract", "--live"])).toThrow(/Nome componente mancante/);
  });

  it("rifiuta argomenti extra dopo il nome componente, nominandoli", () => {
    expect(() => parseArgs(["--", "extract", "Badge", "--live"])).toThrow(/--live/);
  });
});
