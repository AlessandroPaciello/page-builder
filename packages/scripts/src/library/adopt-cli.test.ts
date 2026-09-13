import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { COMPONENT_CONTRACTS, defineContract, fingerprintPayload, SECTION_DEFINITIONS, type ComponentContract } from "@app/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BindingSchema } from "../emitter/binding-shadcn";
import { FixtureSchema } from "../recipe-schema";
import { DEFAULT_PATHS, formatDiff, main, parseAdoptArgs, type AdoptPaths } from "./adopt-cli";
import { readContractAxes } from "./adopt-variant";
import type { LibrarySnapshot } from "./library-snapshot";

const badge = COMPONENT_CONTRACTS.badge as ComponentContract;

/** Copia dei cinque file in una directory temporanea: i test non scrivono mai nel repo. */
function tempPaths(): AdoptPaths {
  const root = mkdtempSync(join(tmpdir(), "adopt-variant-"));
  const paths: AdoptPaths = {
    contractsSrcDir: join(root, "contracts-src"),
    fingerprintPath: join(root, "contracts.fingerprint.json"),
    bindingsDir: join(root, "bindings"),
    designsDir: join(root, "designs"),
  };
  mkdirSync(join(paths.contractsSrcDir, "components"), { recursive: true });
  cpSync(resolve(DEFAULT_PATHS.contractsSrcDir, "components/badge.ts"), join(paths.contractsSrcDir, "components/badge.ts"));
  cpSync(resolve(DEFAULT_PATHS.contractsSrcDir, "schema-version.ts"), join(paths.contractsSrcDir, "schema-version.ts"));
  cpSync(DEFAULT_PATHS.fingerprintPath, paths.fingerprintPath);
  cpSync(DEFAULT_PATHS.bindingsDir, paths.bindingsDir, { recursive: true });
  cpSync(DEFAULT_PATHS.designsDir, paths.designsDir, { recursive: true });
  return paths;
}

function contents(paths: AdoptPaths): Record<string, string> {
  const files = [
    join(paths.contractsSrcDir, "components/badge.ts"),
    join(paths.contractsSrcDir, "schema-version.ts"),
    paths.fingerprintPath,
    join(paths.bindingsDir, "badge.binding.json"),
    join(paths.designsDir, "badge.design.json"),
  ];
  return Object.fromEntries(files.map((file) => [file, readFileSync(file, "utf8")]));
}

/** Snapshot Badge con `variant=outline` in più (celle copiate da default). */
function outlineSnapshot(): LibrarySnapshot {
  const f = FixtureSchema.parse(JSON.parse(readFileSync(resolve(import.meta.dirname, "../recipes/badge.fixture.json"), "utf8")));
  const cells = f.cells.map((cell) => ({ variantProps: { ...cell.variantProps }, variantError: null, root: cell.root }));
  const outline = cells
    .filter((cell) => cell.variantProps.variant === "default")
    .map((cell) => ({ ...cell, variantProps: { ...cell.variantProps, variant: "outline" } }));
  return {
    sets: [],
    componentCount: 1,
    components: [
      {
        id: f.penpotComponentId,
        name: f.componentName,
        pluginData: f.contract,
        axes: ["variant", "size"],
        axesValues: { variant: ["default", "secondary", "destructive", "outline"], size: ["sm", "md"] },
        cells: [...cells, ...outline],
      },
    ],
  };
}

const envelope = (result: unknown) => ({ content: [{ type: "text", text: JSON.stringify({ result }) }] });

describe("adopt-cli", () => {
  let log: ReturnType<typeof vi.spyOn>;
  let err: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    err = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parseAdoptArgs: stesse regole di bump:contract, usage di adopt:variant", () => {
    expect(parseAdoptArgs(["--", "Badge", "--yes"])).toEqual({ component: "Badge", yes: true, snapshotPath: undefined });
    expect(() => parseAdoptArgs(["Badge", "--yes", "--snapshot", "/tmp/s.json"])).toThrow(/solo senza --yes/);
    expect(() => parseAdoptArgs(["--bogus"])).toThrow(/adopt:variant/);
  });

  it("formatDiff: solo le righe cambiate", () => {
    expect(formatDiff("a\nb\nc\n", "a\nB\nc\n")).toBe("@@ riga 2\n- b\n+ B");
  });

  it("snapshot malformato (--snapshot) → exit 1 nominativo, non SyntaxError grezzo", async () => {
    const paths = tempPaths();
    const snapshotPath = join(paths.designsDir, "..", "snapshot.json");
    writeFileSync(snapshotPath, "{ non è json");
    expect(await main({ component: "Badge", yes: false, snapshotPath }, { paths })).toBe(1);
    expect(err.mock.calls.map((call: unknown[]) => String(call[0])).join("\n")).toContain(`Snapshot "${snapshotPath}" non leggibile`);
  });

  it("binding malformato (JSON non leggibile) → exit 1 nominativo col percorso", async () => {
    const paths = tempPaths();
    writeFileSync(join(paths.bindingsDir, "badge.binding.json"), "{ non è json");
    expect(await main({ component: "Badge", yes: false, snapshotPath: join(paths.designsDir, "..", "snapshot.json") }, { paths })).toBe(1);
    expect(err.mock.calls.map((call: unknown[]) => String(call[0])).join("\n")).toContain(`Binding "${join(paths.bindingsDir, "badge.binding.json")}" non è JSON leggibile`);
  });

  it("design malformato (JSON non leggibile) → exit 1 nominativo col percorso", async () => {
    const paths = tempPaths();
    writeFileSync(join(paths.designsDir, "badge.design.json"), "{ non è json");
    expect(await main({ component: "Badge", yes: false, snapshotPath: join(paths.designsDir, "..", "snapshot.json") }, { paths })).toBe(1);
    expect(err.mock.calls.map((call: unknown[]) => String(call[0])).join("\n")).toContain(`Design "${join(paths.designsDir, "badge.design.json")}" non è JSON leggibile`);
  });

  it("file sorgente mancante → errore prima di qualunque lettura di Penpot", async () => {
    const paths = tempPaths();
    rmSync(join(paths.bindingsDir, "badge.binding.json"));
    const callTool = vi.fn();
    await expect(main({ component: "Badge", yes: false }, { paths, callTool })).rejects.toThrow(/File non leggibile.*badge\.binding\.json/);
    expect(callTool).not.toHaveBeenCalled();
  });

  it("senza --yes: stampa il diff dei cinque file, exit 0, nessuna scrittura (--snapshot)", async () => {
    const paths = tempPaths();
    const before = contents(paths);
    const snapshotPath = join(paths.designsDir, "..", "snapshot.json");
    writeFileSync(snapshotPath, JSON.stringify(outlineSnapshot()));
    expect(await main({ component: "Badge", yes: false, snapshotPath }, { paths })).toBe(0);
    expect(contents(paths)).toEqual(before);
    const printed = log.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
    expect(printed).toContain("SCHEMA_VERSION 1 → 2");
    expect(printed).toContain('"outline": "outline"');
    expect(printed).toContain('+     "variant=outline|size=sm": {');
    expect(printed).toContain("Nessuna scrittura");
  });

  it("--yes: scrive i cinque file; fingerprint e binding validi sui file generati; secondo run = nulla da adottare", async () => {
    const paths = tempPaths();
    const callTool = vi.fn(async () => envelope(outlineSnapshot()));
    expect(await main({ component: "Badge", yes: true }, { paths, callTool })).toBe(0);
    expect(callTool).toHaveBeenCalledTimes(1); // sola lettura: nessuno step di scrittura su Penpot
    for (const dir of [join(paths.contractsSrcDir, "components"), paths.contractsSrcDir, dirname(paths.fingerprintPath), paths.bindingsDir, paths.designsDir]) {
      expect(readdirSync(dir).some((entry) => entry.endsWith(".tmp")), dir).toBe(false);
    }

    // Il contratto riletto dal sorgente generato: stesso hash della voce nuova (il test del fingerprint).
    const source = readFileSync(join(paths.contractsSrcDir, "components/badge.ts"), "utf8");
    const axes = readContractAxes(source, "badge.ts", "badge");
    const adopted = defineContract({
      ...badge,
      axes: badge.axes.map((axis) => ({ ...axis, values: axes[axis.name] as unknown as typeof axis.values })),
    });
    const schemaVersion = Number(/SCHEMA_VERSION = (\d+);/.exec(readFileSync(join(paths.contractsSrcDir, "schema-version.ts"), "utf8"))![1]);
    const recorded = JSON.parse(readFileSync(paths.fingerprintPath, "utf8")) as Record<string, string>;
    const components = Object.values(COMPONENT_CONTRACTS).map((c) => (c.name === "badge" ? adopted : c));
    const hash = createHash("sha256").update(fingerprintPayload(components, Object.values(SECTION_DEFINITIONS))).digest("hex");
    expect(schemaVersion).toBe(2);
    expect(recorded[String(schemaVersion)]).toBe(hash);
    expect(recorded["1"]).toBe("05ca6aceeaa588384d74dd5626e4eb22fe9d3cf09a15f7492faa1f65a910d332");

    // Validazione del binding: schema + valori = valori del contratto (come render-component).
    const binding = BindingSchema.parse(JSON.parse(readFileSync(join(paths.bindingsDir, "badge.binding.json"), "utf8")));
    for (const axis of adopted.axes) expect(Object.keys(binding.axes[axis.name]!.values)).toEqual([...axis.values]);

    const printed = log.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");
    expect(printed).toContain("extract:component");
    expect(printed).toContain("verify:library");

    // Secondo run sui file generati, col contratto adottato nel registry.
    log.mockClear();
    const contracts = Object.values(COMPONENT_CONTRACTS).map((c) => (c.name === "badge" ? adopted : c));
    const after = contents(paths);
    expect(await main({ component: "Badge", yes: true }, { paths, callTool, contracts })).toBe(0);
    expect(log.mock.calls.map((call: unknown[]) => String(call[0])).join("\n")).toContain("nulla da adottare");
    expect(contents(paths)).toEqual(after);
  });

  it("errore (valore non valido su un asse option): exit 1, nessuna scrittura", async () => {
    const paths = tempPaths();
    const before = contents(paths);
    const snapshot = outlineSnapshot();
    snapshot.components[0]!.axesValues.variant = [...snapshot.components[0]!.axesValues.variant!, "Bad Value"];
    const callTool = vi.fn(async () => envelope(snapshot));
    expect(await main({ component: "Badge", yes: true }, { paths, callTool })).toBe(1);
    expect(contents(paths)).toEqual(before);
    expect(err.mock.calls.map((call: unknown[]) => String(call[0])).join("\n")).toContain('"Bad Value"');
  });
});
