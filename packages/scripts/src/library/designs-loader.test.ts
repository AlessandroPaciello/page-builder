import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { committedDesigns, designCoverage, designsDir } from "./designs-loader";

const tempDirs: string[] = [];

function tempDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "designs-loader-"));
  tempDirs.push(dir);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, "utf8");
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const minimal = JSON.stringify({ parts: { root: { kind: "board" } }, cells: {} });

describe("committedDesigns", () => {
  it("carica ogni designs/*.design.json con chiave = nome del file, ordinato", () => {
    const designs = committedDesigns();
    const files = readdirSync(designsDir)
      .filter((entry) => entry.endsWith(".design.json"))
      .map((entry) => entry.replace(/\.design\.json$/, ""))
      .sort();
    expect(Object.keys(designs)).toEqual(files);
  });

  it("ignora i file che non sono design e ordina le chiavi", () => {
    const dir = tempDir({ "zeta.design.json": minimal, "alfa.design.json": minimal, "note.md": "x" });
    expect(Object.keys(committedDesigns(dir))).toEqual(["alfa", "zeta"]);
  });

  it("directory senza design → errore che nomina la directory", () => {
    const dir = tempDir({ "note.md": "x" });
    expect(() => committedDesigns(dir)).toThrow(new RegExp(`Nessun design committato in ${dir}`));
  });

  it("JSON malformato → errore che nomina il file", () => {
    const dir = tempDir({ "rotto.design.json": "{ non json" });
    expect(() => committedDesigns(dir)).toThrow(/rotto\.design\.json.*non è JSON leggibile/);
  });

  it("forma sbagliata (senza parts/cells) → errore che nomina il file", () => {
    const dir = tempDir({ "vuoto.design.json": "{}" });
    expect(() => committedDesigns(dir)).toThrow(/vuoto\.design\.json.*non ha la forma/);
  });
});

describe("designCoverage — design ↔ registry dei contratti", () => {
  it("i design committati coprono esattamente COMPONENT_CONTRACTS, in entrambi i sensi", () => {
    const coverage = designCoverage(committedDesigns(), Object.values(COMPONENT_CONTRACTS));
    expect(coverage).toEqual({ ok: true, contractsWithoutDesign: [], designsWithoutContract: [] });
  });

  it("contratto senza design → rosso che nomina il contratto", () => {
    const coverage = designCoverage(committedDesigns(), [...Object.values(COMPONENT_CONTRACTS), { name: "select" }]);
    expect(coverage.ok).toBe(false);
    expect(coverage.contractsWithoutDesign).toEqual(["select"]);
  });

  it("design senza contratto → rosso che nomina il design", () => {
    const designs = { ...committedDesigns(), alert: JSON.parse(minimal) };
    const coverage = designCoverage(designs, Object.values(COMPONENT_CONTRACTS));
    expect(coverage.ok).toBe(false);
    expect(coverage.designsWithoutContract).toEqual(["alert"]);
  });
});
