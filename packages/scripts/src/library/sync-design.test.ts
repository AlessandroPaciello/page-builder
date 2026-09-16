import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { componentFixtureFromSnapshot } from "../extract/component-reader";
import { PATHS } from "../shared/paths";
import { parseLibrarySnapshot } from "./library-reader";
import type { LibrarySnapshot } from "./library-snapshot";
import { designDrift, liveDesignCells, runSyncDesign, syncedDesignCells, type DesignCells } from "./sync-design";

/** Prova rosso/verde di `sync:design` e del confronto design ↔ Penpot (Story 2.10, C). */

const alert = COMPONENT_CONTRACTS.alert;
const snapshot = (): LibrarySnapshot => parseLibrarySnapshot(JSON.parse(readFileSync(PATHS.librarySnapshotPath, "utf8")));
const liveAlert = (): DesignCells => liveDesignCells(alert, componentFixtureFromSnapshot("Alert", snapshot()).cells);

describe("liveDesignCells / designDrift", () => {
  it("le celle live dello snapshot sono la trasposta dei binding: cella → parte → proprietà → token", () => {
    const live = liveAlert();
    expect(Object.keys(live)).toEqual(["status=info", "status=success", "status=warning", "status=error"]);
    expect(live["status=error"]!.heading).toMatchObject({ fill: "color.destructive", fontWeight: "font-weight.semibold" });
  });

  it("verde: design uguale a Penpot → nessuna differenza", () => {
    const live = liveAlert();
    expect(designDrift(structuredClone(live), live)).toEqual([]);
  });

  it("rosso: una proprietà diversa è nominata con cella, parte, proprietà e i due token", () => {
    const live = liveAlert();
    const committed = structuredClone(live);
    committed["status=warning"]!.description!.fill = "color.muted-foreground";
    expect(designDrift(committed, live)).toEqual([
      { cell: "status=warning", part: "description", property: "fill", design: "color.muted-foreground", live: "color.card-foreground" },
    ]);
  });

  it("una cella del design assente in Penpot NON è drift (seed di addCell); una cella di Penpot assente dal design sì", () => {
    const live = liveAlert();
    const { ["status=error"]: _error, ...partialLive } = live;
    expect(designDrift(live, partialLive)).toEqual([]);
    const { ["status=info"]: _info, ...partialDesign } = live;
    expect(designDrift(partialDesign, live)).toEqual([{ cell: "status=info" }]);
  });

  it("syncedDesignCells: valori di Penpot nell'ordine del design, cella solo-design conservata", () => {
    const live = liveAlert();
    const committed: DesignCells = structuredClone(live);
    committed["status=warning"]!.description = { letterSpacing: "tracking.none", fill: "color.muted-foreground" };
    committed["variant=extra"] = { root: { fill: "color.card" } };
    const synced = syncedDesignCells(committed, live);
    expect(Object.keys(synced["status=warning"]!.description!).slice(0, 2)).toEqual(["letterSpacing", "fill"]);
    expect(synced["status=warning"]!.description!.fill).toBe("color.card-foreground");
    expect(synced["variant=extra"]).toEqual({ root: { fill: "color.card" } });
    expect(designDrift(synced, live)).toEqual([]);
  });
});

describe("runSyncDesign", () => {
  let root: string;
  let printed: string[];
  const print = (text: string): void => {
    printed.push(text);
  };
  const designPath = (): string => join(root, "alert.design.json");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sync-design-"));
    printed = [];
    cpSync(join(PATHS.designsDir, "alert.design.json"), designPath());
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** Scrive nel design temporaneo le celle live con un solo valore cambiato: il caso della matrice. */
  function driftedDesign(): string {
    const design = JSON.parse(readFileSync(designPath(), "utf8")) as { parts: unknown; cells: DesignCells };
    design.cells = structuredClone(liveAlert());
    design.cells["status=warning"]!.description!.fill = "color.muted-foreground";
    const text = `${JSON.stringify(design, null, 2)}\n`;
    writeFileSync(designPath(), text);
    return text;
  }

  it("senza --yes stampa il diff e non scrive; con --yes riscrive solo le celle, poi il diff è vuoto", async () => {
    const before = driftedDesign();
    const args = { component: "Alert", yes: false, snapshotPath: PATHS.librarySnapshotPath };
    expect(await runSyncDesign(args, { designsDir: root, print })).toBe(0);
    expect(printed.join("\n")).toContain(`cella "status=warning", parte "description", proprietà "fill": design "color.muted-foreground" ≠ Penpot "color.card-foreground"`);
    expect(printed.join("\n")).toContain("Nessuna scrittura");
    expect(readFileSync(designPath(), "utf8")).toBe(before);

    expect(await runSyncDesign({ ...args, yes: true }, { designsDir: root, print })).toBe(0);
    const after = JSON.parse(readFileSync(designPath(), "utf8")) as { parts: unknown; cells: DesignCells };
    expect(after.parts).toEqual((JSON.parse(before) as { parts: unknown }).parts);
    expect(after.cells["status=warning"]!.description!.fill).toBe("color.card-foreground");

    printed = [];
    expect(await runSyncDesign(args, { designsDir: root, print })).toBe(0);
    expect(printed.join("\n")).toContain("allineato a Penpot");
  });

  it("componente assente dal registry → errore nominativo", async () => {
    await expect(runSyncDesign({ component: "Nope", yes: false, snapshotPath: PATHS.librarySnapshotPath }, { designsDir: root, print })).rejects.toThrow(
      /Contratto "Nope" non trovato nel registry/,
    );
  });

  it("componente assente dallo snapshot → errore nominativo dell'estrazione", async () => {
    const empty = join(root, "empty.snapshot.json");
    writeFileSync(empty, JSON.stringify({ ...snapshot(), components: [] }));
    await expect(runSyncDesign({ component: "Alert", yes: false, snapshotPath: empty }, { designsDir: root, print })).rejects.toThrow(
      /nessun VariantContainer della library si chiama "Alert"/,
    );
  });

  it("design assente → errore nominativo, niente creazione", async () => {
    rmSync(designPath());
    await expect(runSyncDesign({ component: "Alert", yes: false, snapshotPath: PATHS.librarySnapshotPath }, { designsDir: root, print })).rejects.toThrow(
      /Design non trovato per "Alert"/,
    );
  });
});
