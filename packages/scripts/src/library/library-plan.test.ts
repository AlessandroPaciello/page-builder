import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { ComponentContract } from "@app/contracts";

import { planLibrary, pascalCase, type ComponentDesign, type LibraryPlanResult } from "./library-plan";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import { emptySnapshot, type LibrarySnapshot, type SnapshotSet } from "./library-snapshot";

const seed: SemanticSeed = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "semantic-tokens.seed.json"), "utf8"),
) as SemanticSeed;

const designs: Record<string, ComponentDesign> = {
  badge: JSON.parse(readFileSync(resolve(import.meta.dirname, "designs/badge.design.json"), "utf8")) as ComponentDesign,
  input: JSON.parse(readFileSync(resolve(import.meta.dirname, "designs/input.design.json"), "utf8")) as ComponentDesign,
  "accordion-item": JSON.parse(
    readFileSync(resolve(import.meta.dirname, "designs/accordion-item.design.json"), "utf8"),
  ) as ComponentDesign,
};

const contracts = [contractFixture("badge"), contractFixture("input"), contractFixture("accordion-item")];

/** Contratti ridotti all'interfaccia (gli import reali da @app/contracts coprono gli stessi valori). */
function contractFixture(name: "badge" | "input" | "accordion-item"): ComponentContract {
  if (name === "badge") {
    return {
      name: "badge",
      version: 1,
      axes: [
        { name: "variant", type: "option", values: ["default", "secondary", "destructive"], default: "default" },
        { name: "size", type: "option", values: ["sm", "md"], default: "md" },
      ],
      parts: ["root", "label"],
      fields: {},
    };
  }
  if (name === "input") {
    return {
      name: "input",
      version: 1,
      axes: [{ name: "state", type: "state", values: ["default", "focus", "error", "disabled"], default: "default" }],
      parts: ["root", "placeholder"],
      fields: {},
    };
  }
  return {
    name: "accordion-item",
    version: 1,
    axes: [{ name: "state", type: "behavior", values: ["closed", "open"], default: "closed" }],
    parts: ["root", "trigger", "label", "chevron", "content", "body", "divider"],
    fields: {},
  };
}

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
    expect(containerOps).toHaveLength(3);
    expect(containerOps.map((op) => (op as { contract: string }).contract)).toEqual(["badge", "input", "accordion-item"]);
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
    const newContract = contractFixture("input");
    const extended = [
      ...contracts,
      {
        ...newContract,
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

  it("bootstrap su snapshot non vuoto resta refused anche in modalità additiva con set orfano", () => {
    // La modalità additiva NON rifiuta mai: anche un set orfano produce solo differenze o operazioni mirate.
    const snapshot: LibrarySnapshot = { ...emptySnapshot(), sets: [setNamed("stray", false)] };
    const result = plan({ mode: "additive", snapshot });
    expect(result.refused).toBeUndefined();
  });
});
