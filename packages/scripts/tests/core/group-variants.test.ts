import { chip as chipContract, input as inputContract, multiselect as multiselectContract } from "@app/contracts";
import { describe, expect, it } from "vitest";

import { groupVariantsResult, parseCellName, planGroupVariants, variantAxes } from "../../src/core";
import { CHIP_CELLS, CHECKBOX_CELLS, variantCell, variantReading } from "../fixtures/components";

/**
 * Livello 1 (Story 2.28, `group_variants`): la matrice attesa dal contratto e
 * dagli assi di rendering, la validazione dei nomi delle celle e l'idempotenza.
 * Nessun Penpot, nessuna scrittura: il piano è dati → dati.
 */

const chip = (boards = CHIP_CELLS) => variantReading("chip", boards);

/** I valori di variante di un nome, per un confronto leggibile. */
const variantOf = (name: string): Record<string, string> => {
  const parsed = parseCellName(name);
  if ("problem" in parsed) throw new Error(parsed.problem);
  return { ...parsed.variant };
};

describe("la matrice attesa", () => {
  it("Chip: size × removable, gli assi del contratto e quelli di rendering", () => {
    expect(variantAxes(chipContract).map((axis) => [axis.name, axis.base])).toEqual([
      ["size", "md"],
      ["removable", "false"],
    ]);
  });

  it("Checkbox: solo l'asse di rendering checked, con tre valori", () => {
    const plan = planGroupVariants(variantReading("checkbox", CHECKBOX_CELLS));
    expect(plan.outcome).toBe("raggruppato");
    expect(plan.axes).toEqual(["checked"]);
    expect(plan.cells.map((cell) => cell.variant.checked)).toEqual(["false", "true", "indeterminate"]);
  });

  it("Multiselect: i due assi del contratto e il rendering dichiarato, size × open × display", () => {
    expect(variantAxes(multiselectContract).map((axis) => axis.name)).toEqual(["size", "open", "display"]);
  });
});

describe("parseCellName", () => {
  it("legge etichetta e proprietà", () => {
    expect(parseCellName("Chip / size=md, removable=false")).toEqual({ label: "Chip", variant: { size: "md", removable: "false" } });
  });

  it("rifiuta i nomi che non sono «Component / Axis=Value»", () => {
    for (const name of ["Chip", " / size=md", "Chip / ", "Chip / size=md / removable=false", "Chip / size", "Chip / size=", "Chip / size=md, size=sm"]) {
      expect(parseCellName(name), name).toHaveProperty("problem");
    }
  });
});

describe("planGroupVariants: raggruppa", () => {
  it("set completo → piano di scrittura, la cella di partenza per prima", () => {
    const plan = planGroupVariants(chip());
    expect(plan).toMatchObject({ outcome: "raggruppato", write: true, component: "chip", container: "Chip", axes: ["size", "removable"] });
    expect(plan.cells.map((cell) => cell.variant)).toEqual([
      { size: "md", removable: "false" },
      { size: "md", removable: "true" },
      { size: "sm", removable: "false" },
      { size: "sm", removable: "true" },
    ]);
  });

  it("il nome del layer in Penpot vale quanto il contratto (Chip → chip)", () => {
    expect(planGroupVariants(variantReading("Chip", CHIP_CELLS)).component).toBe("chip");
  });

  it("state: si valida solo quando il disegno lo usa, e serve una cella default per ogni combinazione", () => {
    const boards = [
      variantCell("Chip / size=md, removable=false, state=default", "a"),
      variantCell("Chip / size=md, removable=false, state=hover", "b"),
      variantCell("Chip / size=md, removable=true, state=default", "c"),
      variantCell("Chip / size=sm, removable=false, state=default", "d"),
      variantCell("Chip / size=sm, removable=true, state=default", "e"),
    ];
    const plan = planGroupVariants(variantReading("chip", boards));
    expect(plan.axes).toEqual(["size", "removable", "state"]);
    expect(plan.cells.map((cell) => cell.variant.state)).toEqual(["default", "hover", "default", "default", "default"]);
  });
});

describe("planGroupVariants: rifiuta senza scrivere", () => {
  it("una combinazione non disegnata non si rifiuta: è una nota", () => {
    const boards = CHIP_CELLS.filter((cell) => cell.id !== "chip-sm-true");
    const plan = planGroupVariants(chip(boards));
    expect(plan.outcome).toBe("raggruppato");
    expect(plan.notDrawn).toEqual(["Chip / size=sm, removable=true"]);
  });

  it("senza la cella di partenza → rifiuta nominando la cella di partenza", () => {
    const boards = CHIP_CELLS.filter((cell) => cell.id !== "chip-md-false");
    expect(() => planGroupVariants(chip(boards))).toThrow(/cella di partenza/);
  });

  it("una cella sola con le proprietà non è un set", () => {
    expect(() => planGroupVariants(chip([variantCell("Chip / size=md, removable=false", "only")]))).toThrow(/è sola/);
  });

  it("nome incompleto → nomina la cella e la proprietà mancante", () => {
    const boards = CHIP_CELLS.map((cell) => (cell.id === "chip-sm-true" ? variantCell("Chip / size=sm", "chip-sm-true") : cell));
    expect(() => planGroupVariants(chip(boards))).toThrow(/«Chip \/ size=sm»: mancano le proprietà \[removable\]/);
  });

  it("proprietà estranea → nomina la cella", () => {
    const boards = CHIP_CELLS.map((cell) => (cell.id === "chip-sm-true" ? variantCell("Chip / size=sm, removable=true, tone=dark", "chip-sm-true") : cell));
    expect(() => planGroupVariants(chip(boards))).toThrow(/«Chip \/ size=sm, removable=true, tone=dark»: le proprietà \[tone\] non sono nella matrice/);
  });

  it("valore fuori contratto → nomina la cella e l'asse", () => {
    const boards = CHIP_CELLS.map((cell) => (cell.id === "chip-sm-true" ? variantCell("Chip / size=lg, removable=true", "chip-sm-true") : cell));
    expect(() => planGroupVariants(chip(boards))).toThrow(/"lg" è fuori contratto per l'asse "size"/);
  });

  it("stato sconosciuto → nomina la cella", () => {
    const boards = CHIP_CELLS.map((cell) => ({ ...cell, name: `${cell.name}, state=${cell.id === "chip-sm-true" ? "visited" : "default"}` }));
    expect(() => planGroupVariants(chip(boards))).toThrow(/cella «Chip \/ size=sm, removable=true, state=visited»: lo stato "visited" è sconosciuto/);
  });

  it("celle doppie → le varianti sono distinte", () => {
    const boards = [...CHIP_CELLS, variantCell("Chip / size=sm, removable=true", "dup")];
    expect(() => planGroupVariants(chip(boards))).toThrow(/hanno gli stessi valori di variante/);
  });

  it("etichette diverse → nomina le etichette", () => {
    const boards = [...CHIP_CELLS, variantCell("Checkbox / size=md", "other")];
    expect(() => planGroupVariants(chip(boards))).toThrow(/non hanno lo stesso nome di componente: \[«Chip», «Checkbox»\]/);
  });

  it("nome illeggibile → nomina la cella", () => {
    const boards = [...CHIP_CELLS, variantCell("Chip", "no-props")];
    expect(() => planGroupVariants(chip(boards))).toThrow(/cella «Chip» — il nome non ha la forma/);
  });

  it("contratto sconosciuto → elenca i contratti, la matrice viene dal contratto", () => {
    expect(() => planGroupVariants(variantReading("nope", CHIP_CELLS))).toThrow(/nessun contratto "nope".*I contratti sono/);
  });
});

describe("planGroupVariants: niente da raggruppare", () => {
  it("componente a cella sola senza proprietà (Multiselect Panel) → resta singolo, nessuna scrittura", () => {
    const plan = planGroupVariants(variantReading("multiselect-panel", [variantCell("Multiselect Panel", "panel")]));
    expect(plan).toMatchObject({ outcome: "singolo", write: false, component: "multiselect-panel", axes: [] });
    expect(plan.cells.map((cell) => cell.name)).toEqual(["Multiselect Panel"]);
  });

  it("contratto senza assi e senza assi di rendering (Input) → resta singolo", () => {
    const plan = planGroupVariants(variantReading("input", [variantCell("Input", "input")]));
    expect(plan).toMatchObject({ outcome: "singolo", write: false, axes: [] });
    expect(variantAxes(inputContract)).toEqual([]);
  });
});

describe("planGroupVariants: idempotenza", () => {
  it("container già presente → già raggruppato, con i suoi assi", () => {
    const plan = planGroupVariants(
      variantReading("chip", [], {
        container: {
          id: "container",
          name: "Chip",
          properties: ["size", "removable"],
          variants: [
            { id: "a", name: "Chip", variant: { size: "md", removable: "false" } },
            { id: "b", name: "Chip", variant: { size: "sm", removable: "true" } },
          ],
        },
      }),
    );
    expect(plan).toMatchObject({ outcome: "già raggruppato", write: false, component: "chip", container: "Chip", axes: ["size", "removable"] });
    expect(plan.cells).toHaveLength(2);
    expect(plan.cells[0]!.variant).toEqual({ size: "md", removable: "false" });
  });

  it("il container vince anche quando ci sono celle sciolte", () => {
    const plan = planGroupVariants(
      variantReading("chip", CHIP_CELLS, {
        container: { id: "c", name: "Chip", properties: ["size"], variants: [{ id: "a", name: "Chip" }] },
      }),
    );
    expect(plan.outcome).toBe("già raggruppato");
  });
});

describe("groupVariantsResult", () => {
  it("l'uscita dello strumento non porta i campi interni del piano", () => {
    const result = groupVariantsResult(planGroupVariants(chip()));
    expect(result).toEqual({
      outcome: "raggruppato",
      component: "chip",
      container: "Chip",
      axes: ["size", "removable"],
      cells: CHIP_CELLS.map((cell) => ({ name: cell.name, variant: variantOf(cell.name) })),
    });
    expect(result).not.toHaveProperty("write");
  });
});
