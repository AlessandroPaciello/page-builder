import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { LibrarySnapshot, SnapshotLayer } from "../../library/library-snapshot";
import { productCardExtraction } from "../contracts/product-card.extract";
import { ScriptError } from "../errors";
import { expectedAxes, expectedCells, partsForCell } from "../library-plan";
import { runShell, type ShellIo } from "../shell";
import { extractCommandWith } from "./extract";
import { loadComponentSnapshot } from "../components";

/**
 * `extract <Comp> [--check] [--snapshot <file>]` (Story 2.14, CAP-4): una
 * prova rosso/verde per ogni riga della matrice della story, esito solo da
 * exit code, categorie `input` 1 / `penpot` 2 / `contract` 3 / `gate` 4.
 * Seam `readSnapshot` per l'offline: zero rete. `--snapshot` è il file di
 * library letto invece del live (vale solo come lettura/test).
 */

const EXTRACTION = productCardExtraction;

function io(): ShellIo & { outLogs: string[]; errLogs: string[] } {
  const outLogs: string[] = [];
  const errLogs: string[] = [];
  return { outLogs, errLogs, out: (text) => outLogs.push(text), err: (text) => errLogs.push(text) };
}

const dirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "extract-v2-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function boardName(variantProps: Readonly<Record<string, string>>): string {
  return `ProductCard ${Object.entries(variantProps).map(([axis, value]) => `${axis}=${value}`).join("|")}`;
}

function buildRoot(variantProps: Readonly<Record<string, string>>): SnapshotLayer {
  const parts = partsForCell(EXTRACTION, variantProps);
  const nodes = new Map<string, SnapshotLayer>();
  for (const part of parts) {
    const isRoot = part.name === "root";
    nodes.set(part.name, {
      name: isRoot ? boardName(variantProps) : part.layer,
      kind: part.kind === "text" ? "text" : "board",
      tokens: { ...part.tokens },
      style: {},
      children: [],
    });
  }
  for (const part of parts) {
    if (part.name === "root") continue;
    nodes.get(part.parent!)!.children.push(nodes.get(part.name)!);
  }
  return nodes.get("root")!;
}

function conformantSnapshot(): LibrarySnapshot {
  const axes = expectedAxes(EXTRACTION);
  return {
    sets: [],
    componentCount: 1,
    components: [
      {
        id: "container-id",
        name: "ProductCard",
        pluginData: EXTRACTION.pluginData,
        axes: axes.map((axis) => axis.name),
        axesValues: Object.fromEntries(axes.map((axis) => [axis.name, [...axis.values]])),
        cells: expectedCells(EXTRACTION).map((cell) => ({
          variantProps: { ...cell.variantProps },
          variantError: null,
          root: buildRoot(cell.variantProps),
        })),
      },
    ],
  };
}

function visitAll(root: SnapshotLayer, visit: (layer: SnapshotLayer) => void): void {
  visit(root);
  for (const child of root.children) visitAll(child, visit);
}

describe("extract — happy e check (6 celle, 5 stadi, tmp+rename)", () => {
  it("happy: scrive data/components/product-card.json con contract, provenance e 6 celle; log dei 5 stadi", async () => {
    const dir = tmp();
    const logs: string[] = [];
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => conformantSnapshot(), componentsDir: dir, log: (text) => logs.push(text), readAt: "2026-09-27T00:00:00.000Z" });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(0);
    expect(shell.errLogs).toEqual([]);
    const logged = logs.join("\n");
    for (const stage of ["penpot:", "contract:", "parts:", "properties:", "write:"]) {
      expect(logged).toContain(stage);
    }
    const snapshot = loadComponentSnapshot("ProductCard", dir);
    expect(snapshot.contract).toBe("product-card@1");
    expect(snapshot.provenance.penpotComponentId).toBe("container-id");
    expect(snapshot.provenance.readAt).toBe("2026-09-27T00:00:00.000Z");
    expect(Object.keys(snapshot.cells).sort()).toEqual([
      "promo=discount|hover=off",
      "promo=discount|hover=on",
      "promo=none|hover=off",
      "promo=none|hover=on",
      "promo=offer|hover=off",
      "promo=offer|hover=on",
    ]);
    // `when`: badge solo nelle 4 celle promo=offer|discount.
    expect(snapshot.cells["promo=none|hover=off"]!["badge"]).toBeUndefined();
    expect(snapshot.cells["promo=offer|hover=off"]!["badge"]).toBeDefined();
    // Alias con `/` e repeat-modello: Tag/Label presente come modello singolo.
    expect(snapshot.cells["promo=offer|hover=off"]!["tagLabel"]).toBeDefined();
    // Nessun .tmp residuo.
    expect(() => readFileSync(join(dir, "product-card.json.tmp"), "utf8")).toThrow();
  });

  it("alias kebab-case product-card risolve come ProductCard", async () => {
    const dir = tmp();
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => conformantSnapshot(), componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "product-card"], [command], shell)).toBe(0);
    expect(loadComponentSnapshot("ProductCard", dir).contract).toBe("product-card@1");
  });

  it("--snapshot <file>: legge la library da file invece del live", async () => {
    const dir = tmp();
    const libraryFile = join(dir, "library.json");
    writeFileSync(libraryFile, JSON.stringify(conformantSnapshot()));
    const shell = io();
    const logs: string[] = [];
    const command = extractCommandWith({ componentsDir: dir, log: (text) => logs.push(text) });
    expect(await runShell(["extract", "ProductCard", "--snapshot", libraryFile], [command], shell)).toBe(0);
    expect(loadComponentSnapshot("ProductCard", dir).contract).toBe("product-card@1");
  });

  it("--check: confronto senza scrittura, exit 0 se identica", async () => {
    const dir = tmp();
    const logs: string[] = [];
    const first = extractCommandWith({ readSnapshot: async () => conformantSnapshot(), componentsDir: dir, log: () => undefined, readAt: "2026-09-27T00:00:00.000Z" });
    expect(await runShell(["extract", "ProductCard"], [first], io())).toBe(0);
    const before = readFileSync(join(dir, "product-card.json"), "utf8");
    const shell = io();
    const second = extractCommandWith({ readSnapshot: async () => conformantSnapshot(), componentsDir: dir, log: (text) => logs.push(text), readAt: "2026-09-28T00:00:00.000Z" });
    expect(await runShell(["extract", "ProductCard", "--check"], [second], shell)).toBe(0);
    expect(readFileSync(join(dir, "product-card.json"), "utf8")).toBe(before);
    expect(logs.join("\n")).toMatch(/identica, nessuna scrittura/);
  });

  it("--check divergente: exit 4 gate senza scrivere", async () => {
    const dir = tmp();
    const first = extractCommandWith({ readSnapshot: async () => conformantSnapshot(), componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [first], io())).toBe(0);
    const before = readFileSync(join(dir, "product-card.json"), "utf8");
    const drifted = conformantSnapshot();
    const target = drifted.components[0]!.cells.find((cell) => cell.variantProps?.promo === "offer")!;
    visitAll(target.root, (layer) => {
      if (layer.name === "Price") layer.tokens = { ...layer.tokens, fill: "color.primary" };
    });
    const shell = io();
    const second = extractCommandWith({ readSnapshot: async () => drifted, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard", "--check"], [second], shell)).toBe(4);
    expect(shell.errLogs.join("\n")).toMatch(/✖ gate[\s\S]*ProductCard[\s\S]*divergente/);
    expect(readFileSync(join(dir, "product-card.json"), "utf8")).toBe(before);
  });

  it("--help: uso con <Comp> [--check] [--snapshot], senza letture né scritture", async () => {
    const dir = tmp();
    const shell = io();
    const logs: string[] = [];
    const command = extractCommandWith({
      readSnapshot: async () => {
        throw new Error("non deve leggere");
      },
      componentsDir: dir,
      log: (text) => logs.push(text),
    });
    expect(await runShell(["extract", "--help"], [command], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/extract <Comp> \[--check\] \[--snapshot <file>\]/);
    expect(shell.errLogs).toEqual([]);
  });
});

describe("extract — rosso contract (exit 3), nessuna scrittura, nominativo con adattamenti ordinati", () => {
  it("Badge fuori when in promo=none: nomina componente, cella, parte + adattamenti designer→registro→contratto", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells.find((cell) => cell.variantProps?.promo === "none" && cell.variantProps?.hover === "off")!;
    target.root.children.push({ name: "Badge", kind: "board", tokens: { fill: "color.primary" }, style: {}, children: [] });
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    const err = shell.errLogs.join("\n");
    expect(err).toMatch(/✖ contract[\s\S]*ProductCard[\s\S]*promo=none\|hover=off[\s\S]*parte "badge"/);
    expect(err).toMatch(/Adattamenti, in ordine:[\s\S]*1\) designer[\s\S]*2\)[\s\S]*registro[\s\S]*3\)[\s\S]*contratto/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("cella mancante (5 su 6): nomina la cella assente", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.cells = snapshot.components[0]!.cells.filter((cell) => cell.variantProps?.promo !== "discount" || cell.variantProps?.hover !== "on");
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract[\s\S]*cella promo=discount\|hover=on[\s\S]*assente/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("board con variantProps null: errore contract nominativo, mai salto silenzioso", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.cells.push({
      variantProps: null,
      variantError: null,
      root: { name: "ProductCard Default", kind: "board", tokens: {}, style: {}, children: [] },
    });
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract[\s\S]*ProductCard[\s\S]*variantProps null/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("token fuori ruolo (fill su image): nomina proprietà, ruolo, parte + adattamento", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    for (const cell of snapshot.components[0]!.cells) {
      visitAll(cell.root, (layer) => {
        if (layer.name === "Image") layer.tokens = { ...layer.tokens, fill: "color.primary" };
      });
    }
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    const err = shell.errLogs.join("\n");
    expect(err).toMatch(/✖ contract[\s\S]*parte "image"[\s\S]*ruolo "image"[\s\S]*"fill"/);
    expect(err).toMatch(/Adattamenti, in ordine:/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("token con type sbagliato (fill con spacing.1 su price): nomina il type atteso", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells[0]!;
    visitAll(target.root, (layer) => {
      if (layer.name === "Price") layer.tokens = { ...layer.tokens, fill: "spacing.1" };
    });
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract[\s\S]*parte "price"[\s\S]*atteso type "color"/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("proprietà fuori registro: bloccata con adattamento", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells[0]!;
    visitAll(target.root, (layer) => {
      if (layer.name === "Price") layer.tokens = { ...layer.tokens, unknownProp: "color.primary" };
    });
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract[\s\S]*"unknownProp"/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("token inventato (fuori catalogo): nessuna scrittura", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells[0]!;
    visitAll(target.root, (layer) => {
      if (layer.name === "Price") layer.tokens = { ...layer.tokens, fill: "color.inventato" };
    });
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract[\s\S]*"color\.inventato"[\s\S]*non esiste nel catalogo/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("repeat difforme: layer ripetuti con token diversi dal modello, nomina parte e divergenza", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells.find((cell) => cell.variantProps?.promo === "offer" && cell.variantProps?.hover === "off")!;
    // Secondo Tag con token diversi dal modello (primo layer).
    const tagsNode = (() => {
      let found: SnapshotLayer | null = null;
      visitAll(target.root, (layer) => {
        if (layer.name === "Tags") found = layer;
      });
      return found!;
    })();
    const model = (() => {
      let found: SnapshotLayer | null = null;
      visitAll(target.root, (layer) => {
        if (layer.name === "Tag" && found === null) found = layer;
      });
      return found!;
    })();
    tagsNode.children.push({ name: "Tag", kind: "board", tokens: { ...model.tokens, fill: "color.primary" }, style: {}, children: [] });
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract[\s\S]*parte ripetuta "tag"[\s\S]*diversi dal modello/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("stile senza binding: nessuna scrittura", async () => {
    const dir = tmp();
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells[0]!;
    visitAll(target.root, (layer) => {
      if (layer.name === "Price") {
        layer.style = { fill: "#fff" };
        layer.tokens = {};
      }
    });
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => snapshot, componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract[\s\S]*senza binding/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });
});

describe("extract — rosso input/penpot e stadi nel log", () => {
  it("rosso (penpot, exit 2): container assente, nessuna scrittura", async () => {
    const dir = tmp();
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => ({ sets: [], componentCount: 0, components: [] }), componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(2);
    expect(shell.errLogs.join("\n")).toMatch(/✖ penpot[\s\S]*ProductCard[\s\S]*assente/);
    expect(() => readFileSync(join(dir, "product-card.json"), "utf8")).toThrow();
  });

  it("rosso (input, exit 1): nome ignoto nomina componente e contratti noti", async () => {
    const dir = tmp();
    const shell = io();
    const command = extractCommandWith({ readSnapshot: async () => conformantSnapshot(), componentsDir: dir, log: () => undefined });
    expect(await runShell(["extract", "Foo"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*"Foo"[\s\S]*ProductCard/);
  });

  it("rosso (input, exit 1): argomento mancante, --snapshot duplicato o senza valore, --snapshot illeggibile", async () => {
    const dir = tmp();
    const command = extractCommandWith({ readSnapshot: async () => conformantSnapshot(), componentsDir: dir, log: () => undefined });
    let shell = io();
    expect(await runShell(["extract"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*uso: extract <Comp>/);
    shell = io();
    expect(await runShell(["extract", "ProductCard", "--snapshot", "a.json", "--snapshot", "b.json"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*--snapshot duplicata/);
    shell = io();
    expect(await runShell(["extract", "ProductCard", "--snapshot"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*--snapshot richiede un valore/);
    shell = io();
    expect(await runShell(["extract", "ProductCard", "--snapshot", join(dir, "assente.json")], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*snapshot/);
  });

  it("rosso (penpot, exit 2): lettura MCP fallita", async () => {
    const dir = tmp();
    const shell = io();
    const command = extractCommandWith({
      readSnapshot: async () => {
        throw new Error("MCP irraggiungibile");
      },
      componentsDir: dir,
      log: () => undefined,
    });
    expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(2);
    expect(shell.errLogs.join("\n")).toMatch(/✖ penpot/);
  });

  it("stadi nel log con una sola categoria ciascuno (happy = 5 ok, rosso = stop allo stadio)", async () => {
    const dir = tmp();
    const logs: string[] = [];
    const happy = extractCommandWith({ readSnapshot: async () => conformantSnapshot(), componentsDir: dir, log: (text) => logs.push(text) });
    expect(await runShell(["extract", "ProductCard"], [happy], io())).toBe(0);
    expect(logs.filter((line) => line.startsWith("penpot:")).length).toBeGreaterThanOrEqual(1);
    expect(logs.filter((line) => line.startsWith("contract:")).length).toBeGreaterThanOrEqual(1);
    expect(logs.filter((line) => line.startsWith("parts:")).length).toBeGreaterThanOrEqual(1);
    expect(logs.filter((line) => line.startsWith("properties:")).length).toBeGreaterThanOrEqual(1);
    expect(logs.filter((line) => line.startsWith("write:")).length).toBeGreaterThanOrEqual(1);
    // Rosso alle parts: penpot+contract ok, parts fallisce, properties/write mai loggate come ok.
    const badSnapshot = conformantSnapshot();
    const target = badSnapshot.components[0]!.cells.find((cell) => cell.variantProps?.promo === "none")!;
    target.root.children.push({ name: "Badge", kind: "board", tokens: { fill: "color.primary" }, style: {}, children: [] });
    const badLogs: string[] = [];
    const bad = extractCommandWith({ readSnapshot: async () => badSnapshot, componentsDir: tmp(), log: (text) => badLogs.push(text) });
    const shell = io();
    expect(await runShell(["extract", "ProductCard"], [bad], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract/);
    expect(badLogs.join("\n")).toContain("penpot:");
    expect(badLogs.join("\n")).toContain("contract:");
    expect(badLogs.join("\n")).toContain("parts:");
  });

  it("direct run lancia ScriptError con kind corretto (una categoria per stadio)", async () => {
    const command = extractCommandWith({ readSnapshot: async () => ({ sets: [], componentCount: 0, components: [] }), componentsDir: tmp(), log: () => undefined });
    try {
      await command.run(["ProductCard"]);
      expect.unreachable("atteso ScriptError penpot");
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptError);
      expect((error as ScriptError).kind).toBe("penpot");
    }
  });
});
