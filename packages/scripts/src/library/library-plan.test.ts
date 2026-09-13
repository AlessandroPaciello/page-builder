import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_CONTRACTS, type ComponentContract } from "@app/contracts";
import { describe, expect, it } from "vitest";

import { committedDesigns } from "./designs-loader";
import { planLibrary, pascalCase, type ComponentDesign, type LibraryPlanResult } from "./library-plan";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import { emptySnapshot, type LibrarySnapshot, type SnapshotSet } from "./library-snapshot";

const seed: SemanticSeed = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "semantic-tokens.seed.json"), "utf8"),
) as SemanticSeed;

const designs: Record<string, ComponentDesign> = committedDesigns();

// Il registry è l'unico elenco (Dev Note): i test usano i contratti reali,
// NON ricopie degli assi/parts (review 2.4).
const contracts = Object.values(COMPONENT_CONTRACTS);

function plan(input: Partial<Parameters<typeof planLibrary>[0]> = {}): LibraryPlanResult {
  return planLibrary({
    mode: "bootstrap",
    contracts,
    spec: LIBRARY_SPEC,
    seed,
    designs,
    snapshot: emptySnapshot(),
    ...input,
  });
}

function setNamed(name: string, active = true): SnapshotSet {
  return { name, active, tokens: [] };
}

describe("pascalCase", () => {
  it("badge → Badge, accordion-item → AccordionItem", () => {
    expect(pascalCase("badge")).toBe("Badge");
    expect(pascalCase("accordion-item")).toBe("AccordionItem");
  });
});

describe("bootstrap", () => {
  it("su snapshot vuoto produce operazioni complete in ordine stabile", () => {
    const result = plan();
    expect(result.refused).toBeUndefined();
    expect(result.differences).toEqual([]);

    const kinds = result.operations.map((op) => op.kind);
    expect(kinds[0]).toBe("createSet");
    expect(kinds[1]).toBe("createSet");
    expect(result.operations.slice(0, 2).map((op) => (op as { set: string }).set)).toEqual(["palette", "semantic"]);

    const tokenOps = result.operations.filter((op) => op.kind === "createToken");
    expect(tokenOps).toHaveLength(seed.palette.length + seed.semantic.length);
    const tokenSets = tokenOps.map((op) => (op as { set: string }).set);
    expect(tokenSets[0]).toBe("palette");
    expect(tokenSets.lastIndexOf("palette")).toBeLessThan(tokenSets.indexOf("semantic"));

    const containerOps = result.operations.filter((op) => op.kind === "createContainer");
    // Uno per contratto, nell'ordine del registry: conteggio derivato, non a mano.
    expect(containerOps).toHaveLength(contracts.length);
    expect(containerOps.map((op) => (op as { contract: string }).contract)).toEqual(contracts.map((c) => c.name));
  });

  it("il container Badge ha gli assi del contratto in ordine e 6 celle complete", () => {
    const result = plan();
    const badge = result.operations.find((op) => op.kind === "createContainer" && op.contract === "badge");
    expect(badge).toBeDefined();
    if (!(badge?.kind === "createContainer")) return;
    expect(badge.containerName).toBe("Badge");
    expect(badge.pluginData).toBe("badge@1");
    expect(badge.axes).toEqual([
      { name: "variant", values: ["default", "secondary", "destructive"] },
      { name: "size", values: ["sm", "md"] },
    ]);
    expect(badge.cells).toHaveLength(6);
    const keys = badge.cells.map((cell) => `${cell.variantProps.variant}|${cell.variantProps.size}`);
    expect([...keys].sort()).toEqual(
      [
        "default|sm",
        "default|md",
        "secondary|sm",
        "secondary|md",
        "destructive|sm",
        "destructive|md",
      ].sort(),
    );
    for (const cell of badge.cells) {
      const partNames = cell.parts.map((part) => part.name);
      expect(partNames).toEqual(["root", "label"]);
      const root = cell.parts[0]!;
      expect(root.tokens.fill).toBe(
        cell.variantProps.variant === "default"
          ? "color.primary"
          : cell.variantProps.variant === "secondary"
            ? "color.secondary"
            : "color.destructive",
      );
      expect(root.tokens.borderRadiusTopLeft).toBe("radius.full");
    }
  });

  it("ogni token referenziato dai design esiste nella spec", () => {
    const specNames = new Set(LIBRARY_SPEC.tokens.map((t) => t.name));
    for (const result of [plan()]) {
      for (const op of result.operations) {
        if (op.kind !== "createContainer") continue;
        for (const cell of op.cells) {
          for (const part of cell.parts) {
            for (const tokenName of Object.values(part.tokens)) {
              expect(specNames.has(tokenName), `${op.contract}: ${tokenName}`).toBe(true);
            }
          }
        }
      }
    }
  });

  it("con almeno un set presente rifiuta senza operazioni", () => {
    const result = plan({ snapshot: { ...emptySnapshot(), sets: [setNamed("mis.color")] } });
    expect(result.refused).toBeDefined();
    expect(result.refused).toContain("mis.color");
    expect(result.operations).toEqual([]);
  });

  it("con almeno un componente presente rifiuta", () => {
    const result = plan({ snapshot: { ...emptySnapshot(), componentCount: 1 } });
    expect(result.refused).toBeDefined();
    expect(result.refused).toContain("componente");
    expect(result.operations).toEqual([]);
  });
});

describe("additiva", () => {
  /** Applica un piano a uno snapshot (helper di test: replica ciò che il writer fa live). */
  function apply(snapshot: LibrarySnapshot, result: LibraryPlanResult): LibrarySnapshot {
    const next: LibrarySnapshot = {
      sets: snapshot.sets.map((s) => ({ ...s, tokens: [...s.tokens] })),
      componentCount: snapshot.componentCount,
      components: snapshot.components.map((c) => ({ ...c })),
    };
    for (const op of result.operations) {
      if (op.kind === "createSet") {
        next.sets.push({ name: op.set, active: true, tokens: [] });
      } else if (op.kind === "createToken") {
        const set = next.sets.find((s) => s.name === op.set);
        if (!set) throw new Error(`set mancante: ${op.set}`);
        set.tokens.push({ name: op.name, type: op.type, value: op.value });
      } else if (op.kind === "addCell") {
        const container = next.components.find((c) => c.name === op.containerName);
        if (!container) throw new Error(`container mancante: ${op.containerName}`);
        container.cells = [
          ...container.cells,
          { variantProps: { ...op.variantProps }, variantError: null, root: { name: "root", kind: "board", tokens: {}, style: {}, children: [] } },
        ];
        container.axesValues = Object.fromEntries(
          Object.entries(container.axesValues).map(([axis, values]) => [
            axis,
            values.includes(op.variantProps[axis]!) ? values : [...values, op.variantProps[axis]!],
          ]),
        );
      } else {
        next.components.push({
          id: `id-${op.contract}`,
          name: op.containerName,
          pluginData: op.pluginData,
          axes: op.axes.map((axis) => axis.name),
          axesValues: Object.fromEntries(op.axes.map((axis) => [axis.name, [...axis.values]])),
          cells: op.cells.map((cell) => ({
            variantProps: { ...cell.variantProps },
            variantError: null,
            root: { name: "root", kind: "board", tokens: {}, style: {}, children: [] },
          })),
        });
      }
    }
    return next;
  }

  it("rilanciata sul risultato del bootstrap è idempotente (0 operazioni, 0 differenze)", () => {
    const first = plan();
    const snapshot = apply(emptySnapshot(), first);
    const second = plan({ mode: "additive", snapshot });
    expect(second.refused).toBeUndefined();
    expect(second.operations).toEqual([]);
    expect(second.differences).toEqual([]);
  });

  it("con un contratto nuovo nel registry crea solo quel container", () => {
    const snapshot = apply(emptySnapshot(), plan());
    // Contratto fittizio costruito a partire da uno reale (review 2.4:
    // "il registry è l'unico elenco" — il test inietta, non ricopia).
    const base = COMPONENT_CONTRACTS.input;
    const extended = [
      ...contracts,
      {
        ...base,
        name: "select",
        version: 1,
        axes: [{ name: "state", type: "state", values: ["default"], default: "default" }],
      } as ComponentContract,
    ];
    const selectDesign: ComponentDesign = {
      parts: { root: { kind: "board" }, placeholder: { kind: "text", parent: "root", text: "Scegli" } },
      cells: {
        "state=default": {
          root: { fill: "color.background" },
          placeholder: { fill: "color.muted-foreground" },
        },
      },
    };
    const result = plan({ mode: "additive", contracts: extended, designs: { ...designs, select: selectDesign }, snapshot });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0]!;
    expect(op.kind).toBe("createContainer");
    if (op.kind === "createContainer") expect(op.contract).toBe("select");
    expect(result.differences).toEqual([]);
  });

  it("con un token di valore diverso produce 1 differenza e 0 operazioni", () => {
    const snapshot = apply(emptySnapshot(), plan());
    const palette = snapshot.sets.find((s) => s.name === "palette")!;
    const accent = palette.tokens.find((t) => t.name === "accent.9")!;
    accent.value = "#000000";
    const result = plan({ mode: "additive", snapshot });
    expect(result.operations).toEqual([]);
    expect(result.differences).toHaveLength(1);
    expect(result.differences[0]?.subject).toContain("accent.9");
    expect(result.differences[0]?.found).toContain("#000000");
  });

  it("con un container che ha un asse in più produce una differenza e nessuna operazione", () => {
    const snapshot = apply(emptySnapshot(), plan());
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axes = [...badge.axes, "tone"];
    const result = plan({ mode: "additive", snapshot });
    expect(result.operations).toEqual([]);
    expect(result.differences.some((d) => d.subject.includes("Badge") && d.found.includes("tone"))).toBe(true);
  });

  it("con un container senza plugin data segnala la differenza e non duplica il container", () => {
    const snapshot = apply(emptySnapshot(), plan());
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.pluginData = null;
    const result = plan({ mode: "additive", snapshot });
    expect(result.operations).toEqual([]);
    expect(result.differences.some((d) => d.subject.includes("Badge") && d.found.includes("assente"))).toBe(true);
  });

  it("con un container dal nome incoerente produce una differenza", () => {
    const snapshot = apply(emptySnapshot(), plan());
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.name = "badge";
    const result = plan({ mode: "additive", snapshot });
    expect(result.differences.some((d) => d.subject.includes("Badge") && d.expected.includes("Badge"))).toBe(true);
  });

  it("l'additiva non rifiuta mai (anche con un set orfano procede senza refused)", () => {
    // Nome corretto (review 2.4): il test verifica che l'additiva NON rifiuti
    // — un set orfano produce solo differenze o operazioni mirate.
    const snapshot: LibrarySnapshot = { ...emptySnapshot(), sets: [setNamed("stray", false)] };
    const result = plan({ mode: "additive", snapshot });
    expect(result.refused).toBeUndefined();
  });

  describe("addCell — celle mancanti di un container esistente (Story 2.7 parte B)", () => {
    const badge = COMPONENT_CONTRACTS.badge;
    /** Badge con un valore `outline` in più sull'asse `variant`: iniettato, non ricopiato. */
    const withOutline = {
      ...badge,
      axes: badge.axes.map((axis) => (axis.name === "variant" ? { ...axis, values: [...axis.values, "outline"] } : axis)),
    } as ComponentContract;
    const extended = contracts.map((c) => (c.name === "badge" ? withOutline : c));
    const baseDesign = designs.badge!;
    const outlineCell = (size: string) => ({
      ...baseDesign.cells[`variant=default|size=${size}`]!,
      root: { ...baseDesign.cells[`variant=default|size=${size}`]!.root, fill: "color.background" },
    });
    const outlineDesigns: Record<string, ComponentDesign> = {
      ...designs,
      badge: {
        ...baseDesign,
        cells: { ...baseDesign.cells, "variant=outline|size=sm": outlineCell("sm"), "variant=outline|size=md": outlineCell("md") },
      },
    };

    it("pianifica un addCell per ogni combinazione mancante, con parti e token del design", () => {
      const snapshot = apply(emptySnapshot(), plan());
      const result = plan({ mode: "additive", contracts: extended, designs: outlineDesigns, snapshot });
      const addCells = result.operations.filter((op) => op.kind === "addCell");
      expect(result.operations).toHaveLength(2);
      expect(addCells.map((op) => op.kind === "addCell" && op.cellKey)).toEqual(["variant=outline|size=sm", "variant=outline|size=md"]);
      const existingCells = snapshot.components.find((c) => c.name === "Badge")!.cells.length;
      for (const [progressive, op] of addCells.entries()) {
        if (op.kind !== "addCell") continue;
        expect(op.contract).toBe("badge");
        expect(op.containerName).toBe("Badge");
        expect(op.index).toBe(existingCells + progressive);
        expect(op.variantProps.variant).toBe("outline");
        expect(op.parts.map((part) => part.name)).toEqual(["root", "label"]);
        expect(op.parts[0]!.tokens.fill).toBe("color.background");
        expect(op.parts[0]!.size).toEqual(baseDesign.parts.root!.size);
      }
      // Le differenze esistenti restano: i valori dell'asse divergono.
      expect(result.differences.some((d) => d.subject.includes("asse variant") && d.expected.includes("outline"))).toBe(true);
    });

    it("un secondo run sul risultato non pianifica nulla", () => {
      const snapshot = apply(emptySnapshot(), plan());
      const first = plan({ mode: "additive", contracts: extended, designs: outlineDesigns, snapshot });
      const second = plan({ mode: "additive", contracts: extended, designs: outlineDesigns, snapshot: apply(snapshot, first) });
      expect(second.operations).toEqual([]);
      expect(second.differences).toEqual([]);
    });

    it("design senza la cella mancante: errore che nomina contratto e cella", () => {
      const snapshot = apply(emptySnapshot(), plan());
      expect(() => plan({ mode: "additive", contracts: extended, designs, snapshot })).toThrow(
        /Design "badge": manca la cella "variant=outline\|size=sm"/,
      );
    });

    it("nessun addCell su un container a una versione vecchia del contratto (badge@1 vs badge@2): resta la differenza", () => {
      const snapshot = apply(emptySnapshot(), plan());
      const bumped = extended.map((c) => (c.name === "badge" ? ({ ...c, version: 2 } as ComponentContract) : c));
      const result = plan({ mode: "additive", contracts: bumped, designs: outlineDesigns, snapshot });
      expect(result.operations.filter((op) => op.kind === "addCell")).toEqual([]);
      expect(result.differences.some((d) => d.expected.includes('"badge@2"') && d.found.includes('"badge@1"'))).toBe(true);
    });

    it("nessun addCell senza container dichiarante, con due dichiaranti o con assi fuori ordine", () => {
      const noPlugin = apply(emptySnapshot(), plan());
      noPlugin.components.find((c) => c.name === "Badge")!.pluginData = null;
      expect(plan({ mode: "additive", contracts: extended, designs: outlineDesigns, snapshot: noPlugin }).operations).toEqual([]);

      const twice = apply(emptySnapshot(), plan());
      const original = twice.components.find((c) => c.name === "Badge")!;
      twice.components.push({ ...original, id: "dup", name: "BadgeCopy" });
      expect(plan({ mode: "additive", contracts: extended, designs: outlineDesigns, snapshot: twice }).operations).toEqual([]);

      const reversed = apply(emptySnapshot(), plan());
      const rev = reversed.components.find((c) => c.name === "Badge")!;
      rev.axes = [...rev.axes].reverse();
      const result = plan({ mode: "additive", contracts: extended, designs: outlineDesigns, snapshot: reversed });
      expect(result.operations).toEqual([]);
      expect(result.differences.some((d) => d.expected.startsWith("assi"))).toBe(true);
    });
  });
});
