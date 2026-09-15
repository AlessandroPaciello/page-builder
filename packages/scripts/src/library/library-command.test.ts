import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";


import { parseArgs } from "../cli/library";
import { PATHS } from "../shared/paths";
import { loadCommittedBindings, runLibrary, runVerify, serializeSnapshot, stepOutcome, writeSnapshotFile } from "./library-command";

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
      const seed = JSON.parse(readFileSync(PATHS.semanticSeedPath, "utf8"));
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
    const snapshot = JSON.parse(readFileSync(PATHS.librarySnapshotPath, "utf8"));
    const seed = JSON.parse(readFileSync(PATHS.semanticSeedPath, "utf8"));
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
      const badge = JSON.parse(readFileSync(resolve(PATHS.bindingsDir, "badge.binding.json"), "utf8"));
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

describe("verify:library --json (Story 2.9)", () => {
  it("parseArgs: --json <path> solo su verify, con un percorso", () => {
    expect(parseArgs(["verify", "--snapshot", "/tmp/s.json", "--json", "/tmp/r.json"])).toEqual({
      mode: "verify",
      dryRun: false,
      snapshotPath: "/tmp/s.json",
      jsonPath: "/tmp/r.json",
    });
    expect(() => parseArgs(["verify", "--json"])).toThrow(/richiede un percorso/);
    expect(() => parseArgs(["add", "--dry-run", "--json", "/tmp/r.json"])).toThrow(/solo su verify/);
  });

  it("runVerify con jsonPath: stesso output ed exit code di prima, JSON con un kind per ogni problema", () => {
    const dir = mkdtempSync(join(tmpdir(), "verify-json-"));
    try {
      const seed = JSON.parse(readFileSync(PATHS.semanticSeedPath, "utf8"));
      const empty = { sets: [], componentCount: 0, components: [] };
      const plain: string[] = [];
      const withJson: string[] = [];
      const jsonPath = join(dir, "verify.json");
      const plainCode = runVerify(empty, seed, { fromFile: true, env: {}, print: (text) => plain.push(text) });
      const jsonCode = runVerify(empty, seed, { fromFile: true, env: {}, print: (text) => withJson.push(text), jsonPath });
      expect(withJson).toEqual(plain);
      expect(jsonCode).toBe(plainCode);
      const json = JSON.parse(readFileSync(jsonPath, "utf8"));
      expect(json.exitCode).toBe(plainCode);
      const problems = [...json.components, ...json.global].flatMap((v: { problems: Array<{ kind: string }> }) => v.problems);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) expect(typeof problem.kind).toBe("string");
      const badge = json.components.find((v: { component: string }) => v.component === "Badge");
      expect(badge.problems.map((p: { kind: string }) => p.kind)).toContain("snapshot-stale");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("main — verify con --json (Story 2.9)", () => {
  it("inoltra jsonPath a runVerify: il file JSON esiste, ogni problema ha un kind, exitCode = exit di main", async () => {
    const dir = mkdtempSync(join(tmpdir(), "main-json-"));
    const log = console.log;
    console.log = () => {};
    try {
      const jsonPath = join(dir, "verify.json");
      const snapshotPath = PATHS.librarySnapshotPath;
      const code = await runLibrary({ mode: "verify", dryRun: false, snapshotPath, jsonPath });
      expect(existsSync(jsonPath)).toBe(true);
      const json = JSON.parse(readFileSync(jsonPath, "utf8"));
      expect(json.title).toBe("verify:library");
      expect(json.exitCode).toBe(code);
      const problems = [...json.components, ...json.global].flatMap((v: { problems: Array<{ kind?: unknown }> }) => v.problems);
      for (const problem of problems) expect(typeof problem.kind).toBe("string");
    } finally {
      console.log = log;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
