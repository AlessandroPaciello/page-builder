import { describe, expect, it } from "vitest";

import { parseArgs } from "./library-cli";

/**
 * Test del CLI di library (review 2.4): gli errori di parseArgs escono loud,
 * `--snapshot` è il seam offline della sola verifica, il dry-run è rifiutato
 * su verify. I path live restano coperti dalle prove live (Task 7).
 */
describe("parseArgs", () => {
  it("accetta le tre modalità con le opzioni ammesse", () => {
    expect(parseArgs(["bootstrap"])).toEqual({ mode: "bootstrap", dryRun: false, snapshotPath: undefined });
    expect(parseArgs(["add", "--dry-run"])).toEqual({ mode: "add", dryRun: true, snapshotPath: undefined });
    expect(parseArgs(["verify", "--snapshot", "/tmp/snap.json"])).toEqual({
      mode: "verify",
      dryRun: false,
      snapshotPath: "/tmp/snap.json",
    });
  });

  it("bootstrap --dry-run --snapshot <path> è ammesso (piano su file, zero scritture)", () => {
    expect(parseArgs(["bootstrap", "--dry-run", "--snapshot", "/tmp/s.json"])).toEqual({
      mode: "bootstrap",
      dryRun: true,
      snapshotPath: "/tmp/s.json",
    });
  });

  it("rifiuta una modalità sconosciuta, nominando quelle valide", () => {
    expect(() => parseArgs(["deploy"])).toThrow(/"deploy".*"bootstrap", "add" o "verify"/);
    expect(() => parseArgs([])).toThrow(/<mancante>/);
  });

  it("rifiuta argomenti non riconosciuti", () => {
    expect(() => parseArgs(["bootstrap", "--force"])).toThrow(/--force/);
  });

  it("rifiuta --snapshot senza valore o con un altro flag come valore", () => {
    expect(() => parseArgs(["verify", "--snapshot"])).toThrow(/richiede un percorso/);
    expect(() => parseArgs(["verify", "--snapshot", "--dry-run"])).toThrow(/richiede un percorso/);
  });

  it("rifiuta --dry-run su verify (è già sola lettura)", () => {
    expect(() => parseArgs(["verify", "--dry-run"])).toThrow(/sola lettura/);
  });

  it("rifiuta --snapshot su bootstrap/add senza --dry-run (review 2.4)", () => {
    expect(() => parseArgs(["bootstrap", "--snapshot", "/tmp/empty.json"])).toThrow(
      /solo su verify|insieme a --dry-run/,
    );
    expect(() => parseArgs(["add", "--snapshot", "/tmp/empty.json"])).toThrow(/solo su verify|insieme a --dry-run/);
  });
});
