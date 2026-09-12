import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";
import { describe, expect, it } from "vitest";

import type { Operation } from "./library-plan";
import { planLibrary } from "./library-plan";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import { emptySnapshot, type LibrarySnapshot, type SnapshotLayer } from "./library-snapshot";
import { verifyLibrary } from "./verify-library";

const seed: SemanticSeed = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "semantic-tokens.seed.json"), "utf8"),
) as SemanticSeed;

const designs = {
  badge: JSON.parse(readFileSync(resolve(import.meta.dirname, "designs/badge.design.json"), "utf8")),
  input: JSON.parse(readFileSync(resolve(import.meta.dirname, "designs/input.design.json"), "utf8")),
  "accordion-item": JSON.parse(
    readFileSync(resolve(import.meta.dirname, "designs/accordion-item.design.json"), "utf8"),
  ),
};

const contracts = Object.values(COMPONENT_CONTRACTS);

/** Costruisce lo snapshot "verde" applicando il piano del bootstrap (ciò che il writer produrrebbe live). */
function greenSnapshot(): LibrarySnapshot {
  const plan = planLibrary({ mode: "bootstrap", contracts, spec: LIBRARY_SPEC, seed, designs, snapshot: emptySnapshot() });
  if (plan.refused) throw new Error(`piano di test rifiutato: ${plan.refused}`);
  const snapshot = emptySnapshot();
  for (const op of plan.operations as Operation[]) {
    if (op.kind === "createSet") {
      snapshot.sets.push({ name: op.set, active: true, tokens: [] });
    } else if (op.kind === "createToken") {
      snapshot.sets.find((set) => set.name === op.set)!.tokens.push({ name: op.name, type: op.type, value: op.value });
    } else {
      snapshot.components.push({
        id: `id-${op.contract}`,
        name: op.containerName,
        pluginData: op.pluginData,
        axes: op.axes.map((axis) => axis.name),
        axesValues: Object.fromEntries(op.axes.map((axis) => [axis.name, [...axis.values]])),
        cells: op.cells.map((cell) => {
          const cellLayers = new Map<string, SnapshotLayer>();
          for (const part of cell.parts) {
            cellLayers.set(part.name, {
              name: part.name,
              kind: part.kind,
              tokens: { ...part.tokens },
              style: Object.fromEntries(Object.keys(part.tokens).map((property) => [property, "<valore>"])),
              children: [],
            });
          }
          const root = cellLayers.get("root")!;
          for (const part of cell.parts) {
            if (part.parent === "root") root.children.push(cellLayers.get(part.name)!);
            else if (part.parent) cellLayers.get(part.parent)!.children.push(cellLayers.get(part.name)!);
          }
          return { variantProps: { ...cell.variantProps }, variantError: null, root };
        }),
      });
    }
  }
  return snapshot;
}

function verify(snapshot: LibrarySnapshot) {
  return verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot });
}

describe("verifyLibrary — snapshot verde", () => {
  it("il risultato del bootstrap passa tutte le 10 regole", () => {
    const result = verify(greenSnapshot());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("verifyLibrary — un caso rosso per regola", () => {
  it("regola 1: contratto senza container", () => {
    const snapshot = greenSnapshot();
    snapshot.components = snapshot.components.filter((c) => c.name !== "Badge");
    const result = verify(snapshot);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("nessun VariantContainer"))).toBe(true);
  });

  it("regola 1: due container dichiarano lo stesso contratto", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    snapshot.components.push({ ...badge, id: "id-badge-2" });
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("2 container lo dichiarano"))).toBe(true);
  });

  it("regola 1: container con il nome giusto ma senza plugin data", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.pluginData = null;
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("plugin data pagebuilder/contract"))).toBe(true);
  });

  it("regola 2: nome del container ≠ PascalCase del contratto", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.name = "badge";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes('atteso "Badge"'))).toBe(true);
  });

  it("regola 3: versione nel plugin data ≠ contractId", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.pluginData = "badge@2";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes('atteso "badge@1"'))).toBe(true);
  });

  it("regola 4: proprietà di variante ≠ assi del contratto", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.axes = ["variant", "tone"];
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("proprietà di variante"))).toBe(true);
  });

  it("regola 4: valori di un asse ≠ values del contratto", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axesValues.variant = ["default", "secondary"];
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('asse "variant"') && e.includes("mancanti [destructive]"))).toBe(true);
  });

  it("regola 5: manca una cella del prodotto cartesiano", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.cells = badge.cells.filter((cell) => cell.variantProps?.size !== "sm");
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("manca la cella"))).toBe(true);
  });

  it("regola 5: variantError non nullo", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.cells[0]!.variantError = "duplicate";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes('variantError "duplicate"'))).toBe(true);
  });

  it("regola 6: manca una parte del contratto in una cella", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    for (const cell of badge.cells) {
      cell.root.children = cell.root.children.filter((layer) => layer.name !== "label");
    }
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes('manca la parte "label"'))).toBe(true);
  });

  it("regola 7: proprietà di stile valorizzata senza binding", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    const label = badge.cells[0]!.root.children.find((layer) => layer.name === "label")!;
    delete label.tokens.fill;
    const result = verify(snapshot);
    expect(
      result.errors.some((e) => e.includes('"badge"') && e.includes('"label"') && e.includes('"fill"') && e.includes("non ha binding")),
    ).toBe(true);
  });

  it("regola 7: binding che punta a un token assente dal catalogo", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    const label = badge.cells[0]!.root.children.find((layer) => layer.name === "label")!;
    label.tokens.fill = "color.nonesisto";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"color.nonesisto"') && e.includes("assente dal catalogo"))).toBe(true);
  });

  it("regola 8: manca un token richiesto dalla spec", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((s) => s.name === "semantic")!;
    semantic.tokens = semantic.tokens.filter((t) => t.name !== "opacity.disabled");
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"opacity.disabled"') && e.includes("assente dal catalogo"))).toBe(true);
  });

  it("regola 8: token con tipo diverso da quello richiesto", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((s) => s.name === "semantic")!;
    const spacing = semantic.tokens.find((t) => t.name === "spacing.1")!;
    spacing.type = "color";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"spacing.1"') && e.includes('type "color"'))).toBe(true);
  });

  it("regola 9: il catalogo non passa generateTheme()", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((s) => s.name === "semantic")!;
    semantic.tokens.find((t) => t.name === "color.primary")!.value = "{colore.inesistente}";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes("generateTheme()"))).toBe(true);
  });

  it("regola 10: coppia di contrasto sotto soglia", () => {
    const snapshot = greenSnapshot();
    const palette = snapshot.sets.find((s) => s.name === "palette")!;
    palette.tokens.find((t) => t.name === "gray.8")!.value = "#EFE8DA";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes("color.border") && e.includes("< soglia 3"))).toBe(true);
  });

  it("regola 10: valore non risolvibile a un colore è un errore che nomina la coppia", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((s) => s.name === "semantic")!;
    semantic.tokens.find((t) => t.name === "color.border")!.value = "not-a-color";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes("color.border") && e.includes("non risolvibile"))).toBe(true);
  });

  it("i container estranei senza plugin data sono ignorati", () => {
    const snapshot = greenSnapshot();
    snapshot.components.push({
      id: "id-placeholder",
      name: "Placeholder",
      pluginData: null,
      axes: [],
      axesValues: {},
      cells: [],
    });
    const result = verify(snapshot);
    expect(result.ok).toBe(true);
  });
});
