import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ScriptError } from "./errors";
import {
  buildComponentSnapshot,
  canonicalCells,
  committedSnapshots,
  componentSnapshotHash,
  componentSnapshotPathFor,
  componentSnapshotsEqual,
  diffComponentSnapshots,
  loadComponentSnapshot,
  stableStringify,
  writeComponentSnapshotAtomic,
} from "./components";

/**
 * Istantanea v2 `data/components/<kebab>.json` (Story 2.14, CAP-4): formato
 * (`contract`, `provenance`, `cells`), scrittura atomica (tmp + rename),
 * confronto per `--check` (ignora `readAt`). Una prova rosso/verde per ogni
 * controllo nuovo, esito solo da exit code nei comandi (qui asserzioni
 * dirette sulle pure).
 */

const dirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "components-v2-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const CELLS = {
  "promo=none|hover=off": { root: { fill: "color.card" }, price: { fill: "color.foreground" } },
  "promo=none|hover=on": { root: { fill: "color.card" }, price: { fill: "color.foreground" } },
  "promo=offer|hover=off": { root: { fill: "color.card" }, badge: { fill: "color.primary" } },
  "promo=offer|hover=on": { root: { fill: "color.card" }, badge: { fill: "color.primary" } },
  "promo=discount|hover=off": { root: { fill: "color.card" }, badge: { fill: "color.primary" } },
  "promo=discount|hover=on": { root: { fill: "color.card" }, badge: { fill: "color.primary" } },
};

describe("components — formato istantanea", () => {
  it("verde: build calcola l'hash stabile e canonizza l'ordine delle chiavi", () => {
    const a = buildComponentSnapshot({ contract: "product-card@1", penpotComponentId: "id-1", cells: CELLS, readAt: "2026-09-27T00:00:00.000Z" });
    expect(a.contract).toBe("product-card@1");
    expect(a.provenance.penpotComponentId).toBe("id-1");
    expect(a.provenance.readAt).toBe("2026-09-27T00:00:00.000Z");
    expect(a.provenance.snapshotHash).toBe(componentSnapshotHash("product-card@1", canonicalCells(CELLS)));
    // Ordine canonico: celle, parti e proprietà ordinate.
    expect(Object.keys(a.cells)).toEqual([...Object.keys(a.cells)].sort());
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("verde: tmp + rename senza residui e roundtrip di lettura", () => {
    const dir = tmp();
    const path = componentSnapshotPathFor("ProductCard", dir);
    expect(path).toBe(join(dir, "product-card.json"));
    expect(componentSnapshotPathFor("product-card", dir)).toBe(path);
    const snapshot = buildComponentSnapshot({ contract: "product-card@1", penpotComponentId: "id-1", cells: CELLS, readAt: "2026-09-27T00:00:00.000Z" });
    writeComponentSnapshotAtomic(path, snapshot);
    expect(readFileSync(path, "utf8")).toContain('"contract": "product-card@1"');
    // Nessun .tmp residuo.
    expect(() => readFileSync(`${path}.tmp`, "utf8")).toThrow();
    expect(loadComponentSnapshot("ProductCard", dir)).toEqual(snapshot);
    expect(loadComponentSnapshot("product-card", dir)).toEqual(snapshot);
  });

  it("verde: --check ignora readAt e hash (stesse celle = uguali)", () => {
    const a = buildComponentSnapshot({ contract: "product-card@1", penpotComponentId: "id-1", cells: CELLS, readAt: "2026-09-27T00:00:00.000Z" });
    const b = buildComponentSnapshot({ contract: "product-card@1", penpotComponentId: "id-1", cells: CELLS, readAt: "2026-09-28T00:00:00.000Z" });
    expect(componentSnapshotsEqual(a, b)).toBe(true);
    expect(diffComponentSnapshots(a, b)).toEqual([]);
    const c = buildComponentSnapshot({
      contract: "product-card@1",
      penpotComponentId: "id-1",
      cells: { ...CELLS, "promo=none|hover=off": { root: { fill: "color.primary" } } },
      readAt: "2026-09-27T00:00:00.000Z",
    });
    expect(componentSnapshotsEqual(a, c)).toBe(false);
    expect(diffComponentSnapshots(a, c).join("\n")).toMatch(/cella promo=none\|hover=off, parte "root", proprietà "fill"/);
  });

  it("verde: committedSnapshots risolve i container via registry, ignora file estranei e .gitkeep", () => {
    const dir = tmp();
    writeFileSync(join(dir, ".gitkeep"), "");
    writeFileSync(join(dir, "product-card.json"), "{}");
    writeFileSync(join(dir, "other-comp.json"), "{}");
    writeFileSync(join(dir, "note.txt"), "x");
    expect(committedSnapshots(dir)).toEqual(["ProductCard"]);
    expect(committedSnapshots(join(dir, "assente"))).toEqual([]);
  });

  it("rosso (input, exit 1): istantanea assente nomina componente e contratti noti", () => {
    const dir = tmp();
    try {
      loadComponentSnapshot("Foo", dir);
      expect.unreachable("atteso ScriptError input");
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptError);
      expect((error as ScriptError).kind).toBe("input");
      expect((error as ScriptError).component).toBe("Foo");
      expect((error as ScriptError).message).toMatch(/"Foo"[\s\S]*ProductCard/);
    }
  });

  it("rosso (contract): JSON illeggibile o schema violato nomina file e campo", () => {
    const dir = tmp();
    const badJson = join(dir, "product-card.json");
    writeFileSync(badJson, "{non json");
    expect(() => loadComponentSnapshot("ProductCard", dir)).toThrow(/non è JSON leggibile/);
    writeFileSync(badJson, JSON.stringify({ contract: "nope", provenance: { penpotComponentId: "x", readAt: "y", snapshotHash: "z" }, cells: {} }));
    try {
      loadComponentSnapshot("ProductCard", dir);
      expect.unreachable("atteso ScriptError contract");
    } catch (error) {
      expect((error as ScriptError).kind).toBe("contract");
      expect((error as ScriptError).message).toMatch(/istantanea malformata/);
    }
  });
});
