import { describe, expect, it } from "vitest";

import type { LibrarySnapshot, SnapshotLayer } from "../../library/library-snapshot";
import type { SemanticSeed } from "../../library/library-spec";
import { productCardExtraction } from "../contracts/product-card.extract";
import { ScriptError } from "../errors";
import { expectedAxes, expectedCells, partsForCell, planAdd, planBootstrap } from "../library-plan";
import { operationsToSteps } from "../library-writer";
import { libraryCommandWith } from "./library";
import { runShell, type ShellIo } from "../shell";

/**
 * `library bootstrap|add` dal contratto di estrazione (Story 2.13, CAP-6):
 * una prova rosso/verde per ogni riga della matrice della story, esito solo
 * da exit code, categorie `input` 1 / `penpot` 2. Seam `readSnapshot`/`writeCode`
 * per l'offline: zero rete. `--snapshot` non esiste in CLI (solo seam DI).
 */

const EXTRACTION = productCardExtraction;

function io(): ShellIo & { outLogs: string[]; errLogs: string[] } {
  const outLogs: string[] = [];
  const errLogs: string[] = [];
  return { outLogs, errLogs, out: (text) => outLogs.push(text), err: (text) => errLogs.push(text) };
}

function emptySnapshot(): LibrarySnapshot {
  return { sets: [], componentCount: 0, components: [] };
}

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
    const node = nodes.get(part.name)!;
    const parent = nodes.get(part.parent!);
    if (parent) parent.children.push(node);
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

const TEST_SEED: SemanticSeed = {
  palette: [{ name: "gray.1", type: "color", value: "#FAF4E8" }],
  semantic: [
    { name: "color.card", type: "color", value: "{gray.1}" },
    { name: "shadow.ring", type: "shadow", value: [{ offsetX: "0", offsetY: "0", blur: "0", spread: "3", color: "{color.ring}", inset: false }] },
  ],
};

describe("library — piano puro (container, assi, 6 celle, layer, token)", () => {
  it("add su library senza card: container ProductCard con plugin data, assi promo+hover, 6 board, 11 parti, token legati", () => {
    const plan = planAdd(EXTRACTION, emptySnapshot());
    expect(plan.differences).toEqual([]);
    expect(plan.operations).toHaveLength(1);
    const operation = plan.operations[0]!;
    expect(operation.kind).toBe("createContainer");
    if (operation.kind !== "createContainer") throw new Error("atteso createContainer");
    expect(operation.containerName).toBe("ProductCard");
    expect(operation.pluginData).toBe("product-card@1");
    expect(operation.axes.map((axis) => axis.name)).toEqual(["promo", "hover"]);
    expect(operation.axes.find((axis) => axis.name === "promo")!.values).toEqual(["none", "offer", "discount"]);
    expect(operation.axes.find((axis) => axis.name === "hover")!.values).toEqual(["off", "on"]);
    expect(operation.cells).toHaveLength(6);
    const byKey = new Map(operation.cells.map((cell) => [Object.entries(cell.variantProps).map(([k, v]) => `${k}=${v}`).join("|"), cell]));
    expect([...byKey.keys()].sort()).toEqual([
      "promo=discount|hover=off",
      "promo=discount|hover=on",
      "promo=none|hover=off",
      "promo=none|hover=on",
      "promo=offer|hover=off",
      "promo=offer|hover=on",
    ]);
    // `when`: badge/badgeLabel solo in 4 celle (mai l'assenza come errore).
    expect(byKey.get("promo=none|hover=off")!.parts.map((part) => part.name)).not.toContain("badge");
    expect(byKey.get("promo=none|hover=off")!.parts.map((part) => part.name)).not.toContain("badgeLabel");
    expect(byKey.get("promo=offer|hover=on")!.parts.map((part) => part.name)).toContain("badge");
    // 11 parti nella cella con badge, 9 senza.
    expect(byKey.get("promo=offer|hover=off")!.parts).toHaveLength(11);
    expect(byKey.get("promo=none|hover=off")!.parts).toHaveLength(9);
    // Layer: default PascalCase, alias con `/`.
    const layers = new Map(byKey.get("promo=offer|hover=off")!.parts.map((part) => [part.name, part.layer]));
    expect(layers.get("badgeLabel")).toBe("Badge/Label");
    expect(layers.get("tagLabel")).toBe("Tag/Label");
    expect(layers.get("price")).toBe("Price");
    // Token legati secondo registro e ruolo: text con tipografia, image senza fill.
    const price = byKey.get("promo=offer|hover=off")!.parts.find((part) => part.name === "price")!;
    expect(price.tokens.fill).toBe("color.foreground");
    expect(price.tokens.fontSize).toBeDefined();
    const image = byKey.get("promo=offer|hover=off")!.parts.find((part) => part.name === "image")!;
    expect(image.tokens.fill).toBeUndefined();
    expect(image.tokens.borderRadiusTopLeft).toBe("radius.md");
  });

  it("bootstrap su library vuota: set, token (inclusi shadow-ring dal seed) e container", () => {
    const plan = planBootstrap({ extractions: [EXTRACTION], seed: TEST_SEED, snapshot: emptySnapshot() });
    expect(plan.refused).toBeUndefined();
    const kinds = plan.operations.map((operation) => operation.kind);
    expect(kinds).toContain("createSet");
    expect(kinds).toContain("createToken");
    expect(kinds).toContain("createContainer");
    const tokenNames = plan.operations.filter((operation) => operation.kind === "createToken").map((operation) => (operation as { name: string }).name);
    expect(tokenNames).toContain("shadow.ring");
    const steps = operationsToSteps(plan.operations);
    expect(steps.length).toBeGreaterThan(plan.operations.length);
    expect(steps[0]!.description).toContain('createSet "palette"');
    expect(steps.some((step) => step.description.includes("ProductCard"))).toBe(true);
    // Nessuna classe Tailwind nel codice generato, solo token.
    for (const step of steps) {
      expect(step.code).not.toMatch(/bg-|text-|flex|rounded-/);
    }
  });

  it("add idempotente su container conforme: nessuna operazione, nessuna differenza", () => {
    const plan = planAdd(EXTRACTION, conformantSnapshot());
    expect(plan.operations).toEqual([]);
    expect(plan.differences).toEqual([]);
  });
});

describe("library — comando (exit code, dry-run, idempotenza, rifiuti)", () => {
  it("add crea il container: exit 0 con scritture (6 celle + container)", async () => {
    const shell = io();
    const writes: string[] = [];
    const logs: string[] = [];
    const command = libraryCommandWith({
      readSnapshot: async () => emptySnapshot(),
      writeCode: async (step) => {
        writes.push(step.description);
        return {};
      },
      log: (text) => logs.push(text),
    });
    expect(await runShell(["library", "add", "ProductCard"], [command], shell)).toBe(0);
    expect(shell.errLogs).toEqual([]);
    // 6 celle + 1 container = 7 step di scrittura.
    expect(writes).toHaveLength(7);
    expect(writes[0]).toContain("promo=none|hover=off");
    expect(writes.at(-1)).toContain('createVariantContainer "ProductCard"');
    expect(logs.join("\n")).toContain("ProductCard");
  });

  it("add idempotente: exit 0 senza scritture", async () => {
    const shell = io();
    let writes = 0;
    const logs: string[] = [];
    const command = libraryCommandWith({
      readSnapshot: async () => conformantSnapshot(),
      writeCode: async () => {
        writes++;
        return {};
      },
      log: (text) => logs.push(text),
    });
    expect(await runShell(["library", "add", "ProductCard"], [command], shell)).toBe(0);
    expect(writes).toBe(0);
    expect(logs.join("\n")).toMatch(/idempotente|Nessuna operazione/);
  });

  it("add idempotente con differenze: exit 0 senza scritture, differenze segnalate", async () => {
    const snapshot = conformantSnapshot();
    snapshot.components[0]!.cells[0]!.root.children[0]!.tokens = { fill: "color.primary" };
    const shell = io();
    let writes = 0;
    const logs: string[] = [];
    const command = libraryCommandWith({
      readSnapshot: async () => snapshot,
      writeCode: async () => {
        writes++;
        return {};
      },
      log: (text) => logs.push(text),
    });
    expect(await runShell(["library", "add", "ProductCard"], [command], shell)).toBe(0);
    expect(writes).toBe(0);
    expect(logs.join("\n")).toMatch(/Differenze segnalate/);
  });

  it("dry-run: stampa il piano, nessuna scrittura", async () => {
    const shell = io();
    let writes = 0;
    const logs: string[] = [];
    const command = libraryCommandWith({
      readSnapshot: async () => emptySnapshot(),
      writeCode: async () => {
        writes++;
        return {};
      },
      log: (text) => logs.push(text),
    });
    expect(await runShell(["library", "add", "ProductCard", "--dry-run"], [command], shell)).toBe(0);
    expect(writes).toBe(0);
    expect(logs.join("\n")).toMatch(/--dry-run/);
    expect(logs.join("\n")).toContain("ProductCard");
  });

  it("bootstrap su library esistente: rifiuto input (exit 1), nessuna scrittura", async () => {
    const shell = io();
    let writes = 0;
    const command = libraryCommandWith({
      seed: TEST_SEED,
      readSnapshot: async () => ({ sets: [{ name: "palette", active: true, tokens: [] }], componentCount: 0, components: [] }),
      writeCode: async () => {
        writes++;
        return {};
      },
      log: () => undefined,
    });
    expect(await runShell(["library", "bootstrap"], [command], shell)).toBe(1);
    expect(writes).toBe(0);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*Bootstrap rifiutato/);
  });

  it("bootstrap con container presente: rifiuto input (exit 1), nessuna scrittura", async () => {
    const shell = io();
    let writes = 0;
    const command = libraryCommandWith({
      seed: TEST_SEED,
      readSnapshot: async () => conformantSnapshot(),
      writeCode: async () => {
        writes++;
        return {};
      },
      log: () => undefined,
    });
    expect(await runShell(["library", "bootstrap"], [command], shell)).toBe(1);
    expect(writes).toBe(0);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input/);
  });

  it("bootstrap --dry-run su library vuota: piano senza scritture, con shadow-ring", async () => {
    const shell = io();
    let writes = 0;
    const logs: string[] = [];
    const command = libraryCommandWith({
      seed: TEST_SEED,
      readSnapshot: async () => emptySnapshot(),
      writeCode: async () => {
        writes++;
        return {};
      },
      log: (text) => logs.push(text),
    });
    expect(await runShell(["library", "bootstrap", "--dry-run"], [command], shell)).toBe(0);
    expect(writes).toBe(0);
    expect(logs.join("\n")).toContain("shadow.ring");
  });

  it("rosso (input, exit 1): nome ignoto nomina il componente e i contratti v2 noti", async () => {
    const shell = io();
    const command = libraryCommandWith({ readSnapshot: async () => emptySnapshot(), log: () => undefined });
    expect(await runShell(["library", "add", "Foo"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*"Foo"[\s\S]*ProductCard/);
  });

  it("rosso (input, exit 1): sotto-comando ignoto, add senza componente, --snapshot rifiutato", async () => {
    const command = libraryCommandWith({ readSnapshot: async () => emptySnapshot(), log: () => undefined });
    let shell = io();
    expect(await runShell(["library", "frobnicate"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input/);
    shell = io();
    expect(await runShell(["library", "add"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*uso: library bootstrap\|add/);
    // `--snapshot` vale solo come seam di lettura/test: in scrittura live è input.
    shell = io();
    expect(await runShell(["library", "add", "ProductCard", "--snapshot", "x.json"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*"--snapshot" non riconosciuto/);
  });

  it("rosso (penpot, exit 2): lettura MCP fallita", async () => {
    const shell = io();
    const command = libraryCommandWith({
      readSnapshot: async () => {
        throw new Error("MCP irraggiungibile");
      },
      log: () => undefined,
    });
    // Il comando traduce gli errori di lettura in `penpot`: qui via run diretto.
    try {
      await command.run(["add", "ProductCard"]);
      expect.unreachable("atteso ScriptError penpot");
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptError);
      expect((error as ScriptError).kind).toBe("penpot");
    }
    expect(await runShell(["library", "add", "ProductCard"], [command], shell)).toBe(2);
    expect(shell.errLogs.join("\n")).toMatch(/✖ penpot/);
  });

  it("--help: uso con bootstrap|add, senza letture né scritture", async () => {
    const shell = io();
    const logs: string[] = [];
    const command = libraryCommandWith({
      readSnapshot: async () => {
        throw new Error("non deve leggere");
      },
      writeCode: async () => {
        throw new Error("non deve scrivere");
      },
      log: (text) => logs.push(text),
    });
    expect(await runShell(["library", "--help"], [command], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/bootstrap\|add/);
    expect(shell.errLogs).toEqual([]);
  });

  it("rosso (penpot, exit 2): add con writeCode che rifiuta", async () => {
    const shell = io();
    const command = libraryCommandWith({
      readSnapshot: async () => emptySnapshot(),
      writeCode: async () => {
        throw new Error("MCP scrittura fallita");
      },
      log: () => undefined,
    });
    expect(await runShell(["library", "add", "ProductCard"], [command], shell)).toBe(2);
    expect(shell.errLogs.join("\n")).toMatch(/✖ penpot/);
  });

  it("rosso (penpot, exit 2): bootstrap con writeCode che rifiuta", async () => {
    const shell = io();
    const command = libraryCommandWith({
      seed: TEST_SEED,
      readSnapshot: async () => emptySnapshot(),
      writeCode: async () => {
        throw new Error("MCP scrittura fallita");
      },
      log: () => undefined,
    });
    expect(await runShell(["library", "bootstrap"], [command], shell)).toBe(2);
    expect(shell.errLogs.join("\n")).toMatch(/✖ penpot/);
  });

  it("bootstrap live su snapshot vuoto: 2 set + 3 token + 1 container = 12 scritture", async () => {
    const shell = io();
    const writes: string[] = [];
    const command = libraryCommandWith({
      seed: TEST_SEED,
      readSnapshot: async () => emptySnapshot(),
      writeCode: async (step) => {
        writes.push(step.description);
        return {};
      },
      log: () => undefined,
    });
    expect(await runShell(["library", "bootstrap"], [command], shell)).toBe(0);
    expect(shell.errLogs).toEqual([]);
    // 2 createSet + 3 createToken + 6 celle + 1 container.
    expect(writes).toHaveLength(12);
    expect(writes.filter((description) => description.startsWith("createSet"))).toHaveLength(2);
    expect(writes.filter((description) => description.startsWith("createToken"))).toHaveLength(3);
    expect(writes.at(-1)).toContain('createVariantContainer "ProductCard"');
  });
});

describe("library — writer: il codice execute_code compila", () => {
  // Come la v1 (penpot-writer.test.ts): un errore di sintassi silenterebbe lato execute_code.
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...params: unknown[]) => Promise<unknown>;

  it("ogni step di add compila", () => {
    const plan = planAdd(EXTRACTION, emptySnapshot());
    for (const step of operationsToSteps(plan.operations)) {
      expect(() => new AsyncFunction(step.code), step.description).not.toThrow();
    }
  });

  it("ogni step di bootstrap compila", () => {
    const plan = planBootstrap({ extractions: [EXTRACTION], seed: TEST_SEED, snapshot: emptySnapshot() });
    for (const step of operationsToSteps(plan.operations)) {
      expect(() => new AsyncFunction(step.code), step.description).not.toThrow();
    }
  });
});
