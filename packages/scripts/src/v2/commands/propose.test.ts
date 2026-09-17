import { describe, expect, it } from "vitest";

import type { LibrarySnapshot, SnapshotLayer } from "../../library/library-snapshot";
import { productCardExtraction } from "../contracts/product-card.extract";
import { expectedAxes, expectedCells, partsForCell } from "../library-plan";
import { diffPropose } from "../propose-diff";
import { proposeCommandWith } from "./propose";
import { runShell, type ShellIo } from "../shell";

/**
 * `propose <Comp>` sola lettura (Story 2.13, CAP-7): una prova rosso/verde
 * per ogni riga della matrice della story, esito solo da exit code. Seam
 * `readSnapshot` per l'offline: zero rete, zero scritture (mai su Penpot, mai
 * sui contratti, mai sugli snapshot).
 */

const EXTRACTION = productCardExtraction;

function io(): ShellIo & { outLogs: string[]; errLogs: string[] } {
  const outLogs: string[] = [];
  const errLogs: string[] = [];
  return { outLogs, errLogs, out: (text) => outLogs.push(text), err: (text) => errLogs.push(text) };
}

function boardName(variantProps: Readonly<Record<string, string>>): string {
  return `ProductCard ${Object.entries(variantProps).map(([axis, value]) => `${axis}=${value}`).join("|")}`;
}

function buildRoot(variantProps: Readonly<Record<string, string>>, extraLayers: readonly string[] = [], tokenPatch: Readonly<Record<string, string>> = {}): SnapshotLayer {
  const parts = partsForCell(EXTRACTION, variantProps);
  const nodes = new Map<string, SnapshotLayer>();
  for (const part of parts) {
    const isRoot = part.name === "root";
    nodes.set(part.name, {
      name: isRoot ? boardName(variantProps) : part.layer,
      kind: part.kind === "text" ? "text" : "board",
      tokens: { ...part.tokens, ...(isRoot ? tokenPatch : {}) },
      style: {},
      children: [],
    });
  }
  for (const part of parts) {
    if (part.name === "root") continue;
    nodes.get(part.parent!)!.children.push(nodes.get(part.name)!);
  }
  const root = nodes.get("root")!;
  // Layer extra in Penpot (Penpot avanti): figli diretti della board.
  for (const layer of extraLayers) {
    root.children.push({ name: layer, kind: "board", tokens: { fill: "color.primary" }, style: {}, children: [] });
  }
  return root;
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

describe("propose — diff puro sui due contratti (file e riga, mai scritture)", () => {
  it("conforme: nessun diff (il `when` governa la presenza: badge assente in promo=none non è un diff)", () => {
    const snapshot = conformantSnapshot();
    // Prova esplicita del `when`: le 2 celle promo=none non hanno Badge/Badge/Label.
    const noneCell = snapshot.components[0]!.cells.find((cell) => cell.variantProps?.promo === "none")!;
    const names: string[] = [];
    const visit = (layer: SnapshotLayer): void => {
      names.push(layer.name);
      for (const child of layer.children) visit(child);
    };
    for (const child of noneCell.root.children) visit(child);
    expect(names).not.toContain("Badge");
    expect(names).not.toContain("Badge/Label");
    expect(diffPropose(EXTRACTION, snapshot.components[0]!)).toEqual([]);
  });

  it("asse avanti: valore Penpot assente dai contratti, con file e riga dei due contratti", () => {
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.axesValues.promo = ["none", "offer", "discount", "sale"];
    const findings = diffPropose(EXTRACTION, snapshot.components[0]!);
    expect(findings.join("\n")).toMatch(/asse "promo"[\s\S]*valore "sale"[\s\S]*packages\/contracts\/src\/components\/product-card\.ts:\d+/);
    expect(findings.join("\n")).toContain("packages/scripts/src/v2/contracts/product-card.extract.ts:");
  });

  it("asse di rendering avanti: valore hover ignoto cita il contratto di estrazione", () => {
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.axesValues.hover = ["off", "on", "half"];
    const findings = diffPropose(EXTRACTION, snapshot.components[0]!);
    expect(findings.join("\n")).toMatch(/asse "hover"[\s\S]*"half"[\s\S]*product-card\.extract\.ts:\d+/);
  });

  it("parte avanti: layer Penpot senza voce nei contratti, con parte e file coinvolti", () => {
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells.find((cell) => cell.variantProps?.promo === "offer")!;
    target.root.children.push({ name: "Wishlist", kind: "board", tokens: { fill: "color.primary" }, style: {}, children: [] });
    const findings = diffPropose(EXTRACTION, snapshot.components[0]!);
    expect(findings.join("\n")).toMatch(/layer "Wishlist"[\s\S]*senza voce[\s\S]*product-card\.extract\.ts:\d+/);
    expect(findings.join("\n")).toContain("packages/contracts/src/components/product-card.ts:");
  });

  it("ruolo avanti: token fuori ruolo cita parte, ruolo e file", () => {
    const snapshot = conformantSnapshot();
    const visit = (layer: SnapshotLayer): void => {
      if (layer.name === "Image") layer.tokens = { ...layer.tokens, fill: "color.primary" };
      for (const child of layer.children) visit(child);
    };
    for (const cell of snapshot.components[0]!.cells) visit(cell.root);
    const findings = diffPropose(EXTRACTION, snapshot.components[0]!);
    expect(findings.join("\n")).toMatch(/parte "image"[\s\S]*ruolo "image"[\s\S]*fuori ruolo[\s\S]*product-card\.extract\.ts:\d+/);
  });

  it("layer fuori `when` (Badge in promo=none): diff nominativo, non errore", () => {
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells.find((cell) => cell.variantProps?.promo === "none" && cell.variantProps?.hover === "off")!;
    target.root.children.push({ name: "Badge", kind: "board", tokens: { fill: "color.primary" }, style: {}, children: [] });
    const findings = diffPropose(EXTRACTION, snapshot.components[0]!);
    expect(findings.join("\n")).toMatch(/layer "Badge"[\s\S]*parte "badge"[\s\S]*solo con/);
  });

  it("Penpot indietro: layer mancante produce diff (non silenzio)", () => {
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells.find((cell) => cell.variantProps?.promo === "offer" && cell.variantProps?.hover === "off")!;
    const visit = (layer: SnapshotLayer): void => {
      layer.children = layer.children.filter((child) => child.name !== "Price");
      for (const child of layer.children) visit(child);
    };
    visit(target.root);
    const findings = diffPropose(EXTRACTION, snapshot.components[0]!);
    expect(findings.join("\n")).toMatch(/parte "price"[\s\S]*assente in Penpot/);
  });

  it("Penpot indietro: valore d'asse mancante produce diff", () => {
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.axesValues.hover = ["off"];
    const findings = diffPropose(EXTRACTION, snapshot.components[0]!);
    expect(findings.join("\n")).toMatch(/asse "hover"[\s\S]*"on"[\s\S]*assente in Penpot/);
  });

  it("cella con variantProps null: saltata senza crash né diff proprio", () => {
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.cells.push({
      variantProps: null,
      variantError: null,
      root: { name: "ProductCard Default", kind: "board", tokens: {}, style: {}, children: [] },
    });
    expect(diffPropose(EXTRACTION, snapshot.components[0]!)).toEqual([]);
  });
});

describe("propose — comando (sola lettura, exit code)", () => {
  it("Penpot avanti: stampa il diff con file e riga, exit 0, nessuna scrittura", async () => {
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.axesValues.promo = ["none", "offer", "discount", "sale"];
    const shell = io();
    const logs: string[] = [];
    let reads = 0;
    const command = proposeCommandWith({
      readSnapshot: async () => {
        reads++;
        return snapshot;
      },
      log: (text) => logs.push(text),
    });
    expect(await runShell(["propose", "ProductCard"], [command], shell)).toBe(0);
    expect(reads).toBe(1);
    expect(shell.errLogs).toEqual([]);
    const output = logs.join("\n");
    expect(output).toMatch(/Propose ProductCard/);
    expect(output).toContain("packages/contracts/src/components/product-card.ts:");
    expect(output).toContain("packages/scripts/src/v2/contracts/product-card.extract.ts:");
    expect(output).toMatch(/"sale"/);
  });

  it("parte avanti: diff con parte, ruolo e file coinvolti, nessuna scrittura", async () => {
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.cells[0]!.root.children.push({
      name: "Wishlist",
      kind: "board",
      tokens: { fill: "color.primary" },
      style: {},
      children: [],
    });
    const shell = io();
    const logs: string[] = [];
    const command = proposeCommandWith({ readSnapshot: async () => snapshot, log: (text) => logs.push(text) });
    expect(await runShell(["propose", "ProductCard"], [command], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/Wishlist[\s\S]*product-card\.extract\.ts:\d+/);
  });

  it("conforme: nessun diff, exit 0", async () => {
    const shell = io();
    const logs: string[] = [];
    const command = proposeCommandWith({ readSnapshot: async () => conformantSnapshot(), log: (text) => logs.push(text) });
    expect(await runShell(["propose", "ProductCard"], [command], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/nessun diff/i);
  });

  it("Penpot indietro: layer mancante produce diff (mai `nessun diff`), exit 0", async () => {
    const snapshot = conformantSnapshot();
    const target = snapshot.components[0]!.cells.find((cell) => cell.variantProps?.promo === "offer" && cell.variantProps?.hover === "off")!;
    const visit = (layer: SnapshotLayer): void => {
      layer.children = layer.children.filter((child) => child.name !== "Price");
      for (const child of layer.children) visit(child);
    };
    visit(target.root);
    const shell = io();
    const logs: string[] = [];
    const command = proposeCommandWith({ readSnapshot: async () => snapshot, log: (text) => logs.push(text) });
    expect(await runShell(["propose", "ProductCard"], [command], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/parte "price"[\s\S]*assente in Penpot/);
    expect(logs.join("\n")).not.toMatch(/nessun diff/i);
  });

  it("rosso (penpot, exit 2): container assente, errore nominativo", async () => {
    const shell = io();
    const command = proposeCommandWith({
      readSnapshot: async () => ({ sets: [], componentCount: 0, components: [] }),
      log: () => undefined,
    });
    expect(await runShell(["propose", "ProductCard"], [command], shell)).toBe(2);
    expect(shell.errLogs.join("\n")).toMatch(/✖ penpot[\s\S]*ProductCard[\s\S]*assente/);
  });

  it("rosso (input, exit 1): nome ignoto nomina il componente e i contratti v2 noti", async () => {
    const shell = io();
    const command = proposeCommandWith({ readSnapshot: async () => conformantSnapshot(), log: () => undefined });
    expect(await runShell(["propose", "Foo"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*"Foo"[\s\S]*ProductCard/);
  });

  it("rosso (penpot, exit 2): lettura MCP fallita", async () => {
    const shell = io();
    const command = proposeCommandWith({
      readSnapshot: async () => {
        throw new Error("MCP irraggiungibile");
      },
      log: () => undefined,
    });
    expect(await runShell(["propose", "ProductCard"], [command], shell)).toBe(2);
    expect(shell.errLogs.join("\n")).toMatch(/✖ penpot/);
  });

  it("propose non accetta --snapshot in CLI (seam solo DI) e non scrive mai", async () => {
    const shell = io();
    const command = proposeCommandWith({ readSnapshot: async () => conformantSnapshot(), log: () => undefined });
    expect(await runShell(["propose", "ProductCard", "--snapshot", "x.json"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*"--snapshot" non riconosciuto/);
  });

  it("--help: uso, senza letture", async () => {
    const shell = io();
    const logs: string[] = [];
    const command = proposeCommandWith({
      readSnapshot: async () => {
        throw new Error("non deve leggere");
      },
      log: (text) => logs.push(text),
    });
    expect(await runShell(["propose", "--help"], [command], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/propose <Comp>/);
  });
});
