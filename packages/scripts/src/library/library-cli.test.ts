import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadCommittedBindings, parseArgs, runVerify, serializeSnapshot, stepOutcome, writeSnapshotFile } from "./library-cli";

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

describe("stepOutcome", () => {
  it("\"ok\" per uno step eseguito, \"saltato (motivo)\" per uno step con skipped: true", () => {
    expect(stepOutcome({ componentId: "c1" })).toBe("ok");
    expect(stepOutcome(null)).toBe("ok");
    expect(stepOutcome({ skipped: true, reason: "la variante esiste già" })).toBe("saltato (la variante esiste già)");
    expect(stepOutcome({ skipped: true })).toBe("saltato (motivo non indicato)");
  });
});


describe("parseArgs — --write-snapshot (Story 2.8 parte B)", () => {
  it("è ammesso solo su verify e mai insieme a --snapshot", () => {
    expect(parseArgs(["verify", "--write-snapshot", "/tmp/s.json"])).toEqual({
      mode: "verify",
      dryRun: false,
      snapshotPath: undefined,
      writeSnapshotPath: "/tmp/s.json",
    });
    expect(() => parseArgs(["verify", "--write-snapshot"])).toThrow(/richiede un percorso/);
    expect(() => parseArgs(["add", "--dry-run", "--write-snapshot", "/tmp/s.json"])).toThrow(/solo su verify/);
    expect(() => parseArgs(["verify", "--snapshot", "/tmp/a.json", "--write-snapshot", "/tmp/b.json"])).toThrow(/alternativi/);
  });
});

describe("writeSnapshotFile / runVerify sullo snapshot committato", () => {
  it("lo snapshot scritto si rilegge identico (JSON deterministico, tmp + rename)", () => {
    const dir = mkdtempSync(join(tmpdir(), "snapshot-write-"));
    try {
      const path = join(dir, "library.snapshot.json");
      const snapshot = { sets: [], componentCount: 0, components: [] };
      writeSnapshotFile(path, snapshot);
      expect(readFileSync(path, "utf8")).toBe(serializeSnapshot(snapshot));
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(snapshot);
      expect(existsSync(`${path}.tmp`)).toBe(false);
      // Chiavi ordinate: l'ordine d'inserimento non cambia il file.
      const reordered = { components: [], sets: [], componentCount: 0 } as typeof snapshot;
      expect(serializeSnapshot(reordered)).toBe(serializeSnapshot(snapshot));
      expect(Object.keys(JSON.parse(serializeSnapshot(reordered)))).toEqual(["componentCount", "components", "sets"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uno snapshot vuoto da file: ogni componente committato è rosso \"snapshot da aggiornare\", exit 1, report nel summary", () => {
    const dir = mkdtempSync(join(tmpdir(), "verify-summary-"));
    try {
      const summary = join(dir, "summary.md");
      const printed: string[] = [];
      const seed = JSON.parse(readFileSync(new URL("./semantic-tokens.seed.json", import.meta.url), "utf8"));
      const code = runVerify({ sets: [], componentCount: 0, components: [] }, seed, {
        fromFile: true,
        env: { GITHUB_STEP_SUMMARY: summary },
        print: (text) => printed.push(text),
      });
      expect(code).toBe(1);
      const md = readFileSync(summary, "utf8");
      expect(md).toContain("### verify:library");
      expect(md).toMatch(/\| Badge \| 🔴 rosso \|.*snapshot da aggiornare/);
      expect(printed.join("\n")).toContain("snapshot da aggiornare");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lo snapshot committato, come in CI: nessuna voce rossa, exit 0 (l'ordine delle chiavi delle ombre non è una differenza dal seed)", () => {
    const snapshot = JSON.parse(readFileSync(new URL("./library.snapshot.json", import.meta.url), "utf8"));
    const seed = JSON.parse(readFileSync(new URL("./semantic-tokens.seed.json", import.meta.url), "utf8"));
    const printed: string[] = [];
    const code = runVerify(snapshot, seed, { fromFile: true, env: {}, print: (text) => printed.push(text) });
    expect(printed.join("\n")).not.toContain("✖ rosso");
    expect(code).toBe(0);
  });
});

describe("loadCommittedBindings", () => {
  it("un binding con alias si carica sotto la chiave del contratto; un file assente si salta; un file malformato è un errore che nomina il file", () => {
    const dir = mkdtempSync(join(tmpdir(), "bindings-"));
    try {
      const badge = JSON.parse(readFileSync(new URL("../emitter/bindings/badge.binding.json", import.meta.url), "utf8"));
      badge.parts.label.aliases = ["Label Text"];
      writeFileSync(join(dir, "badge.binding.json"), JSON.stringify(badge), "utf8");
      writeFileSync(join(dir, "accordion-item.binding.json"), JSON.stringify({ componentName: "AccordionItem" }), "utf8");
      const { bindings, errors } = loadCommittedBindings(["badge", "input", "accordion-item"], dir);
      expect(Object.keys(bindings)).toEqual(["badge"]);
      expect(bindings.badge!.parts.label!.aliases).toEqual(["Label Text"]);
      expect(Object.keys(errors)).toEqual(["accordion-item"]);
      expect(errors["accordion-item"]).toContain(join(dir, "accordion-item.binding.json"));
      expect(errors["accordion-item"]).toMatch(/Binding malformato/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
