import { describe, expect, it, vi } from "vitest";

import { planGroupVariants, type GroupVariantsPlan, type VariantCellsReading } from "../../src/core";
import {
  GROUP_VARIANTS_SOURCE,
  READ_VARIANT_CELLS_SOURCE,
  groupVariants,
  groupVariantsCode,
  readVariantCellsCode,
  type CallToolFn,
} from "../../src/penpot/group-variants";
import type { McpCallToolResult } from "../../src/penpot/mcp-client";
import { CHIP_CELLS, variantCell, variantReading } from "../fixtures/components";

/**
 * Livello 1 (Story 2.28): l'adattatore `group_variants` senza Penpot. Il
 * `callTool` è finto e restituisce envelope scritti a mano: la lettura delle
 * celle non scrive, la scrittura parte solo dopo il piano del nucleo.
 */

const envelope = (result: unknown): McpCallToolResult => ({ content: [{ type: "text", text: JSON.stringify({ result }) }] });

const READER = "readVariantCells(";

/** Un `callTool` che distingue la lettura (codice con `readVariantCells`) dalla scrittura e registra i codici. */
function scripted(read: unknown, written: unknown): { callTool: CallToolFn; codes: string[] } {
  const codes: string[] = [];
  const callTool = vi.fn(async (args: { name: string; arguments: { code: string } }) => {
    codes.push(args.arguments.code);
    return envelope(args.arguments.code.includes(READER) ? read : written);
  }) as unknown as CallToolFn;
  return { callTool, codes };
}

const WRITTEN = {
  outcome: "raggruppato",
  component: "chip",
  container: "Chip",
  axes: ["size", "removable"],
  cells: CHIP_CELLS.map((cell) => ({ name: cell.name, variant: { size: cell.name.includes("size=md") ? "md" : "sm", removable: cell.name.includes("removable=true") ? "true" : "false" } })),
};

describe("i sorgenti", () => {
  it("la lettura non scrive su Penpot: niente createVariantFromComponents, niente set*, niente storage", () => {
    const code = readVariantCellsCode("chip");
    expect(code).toContain('return readVariantCells("chip");');
    expect(code).not.toContain("createVariantFromComponents");
    expect(code).not.toMatch(/\bset[A-Z]\w*\(/);
    expect(code).not.toContain("storage");
    expect(READ_VARIANT_CELLS_SOURCE).not.toContain("__PLAN__");
  });

  it("la scrittura è il solo sorgente che muta Penpot, e non scrive plugin data né token", () => {
    const plan = planGroupVariants(variantReading("chip", CHIP_CELLS));
    const code = groupVariantsCode(plan);
    expect(code).toContain('"containerName":"Chip"');
    expect(code).toContain('"axes":["size","removable"]');
    expect(code).toContain('"id":"chip-sm-true"');
    expect(code).toContain("penpot.createVariantFromComponents(boards)");
    expect(code).toContain("renameProperty");
    expect(code).toContain("setVariantProperty");
    expect(code).not.toContain("__PLAN__");
    expect(code).not.toContain("setSharedPluginData");
    expect(code).not.toContain("setPluginData");
    expect(code).not.toMatch(/addToken|applyToken|removeToken/);
    expect(GROUP_VARIANTS_SOURCE).not.toContain("pagebuilder");
  });

  it("la scrittura rifiuta un piano senza container o senza assi", () => {
    const plan = planGroupVariants(variantReading("chip", [variantCell("Chip", "only")]));
    expect(plan.outcome).toBe("singolo");
    expect(() => groupVariantsCode(plan)).toThrow(/nome del container/);
  });
});

describe("groupVariants con callTool finto", () => {
  it("verde: legge, valida e scrive, in due chiamate", async () => {
    const { callTool, codes } = scripted({ reading: variantReading("chip", CHIP_CELLS) }, WRITTEN);
    await expect(groupVariants("chip", (reading) => planGroupVariants(reading), { callTool })).resolves.toEqual(WRITTEN);
    expect(codes).toHaveLength(2);
    expect(codes[0]).toContain(READER);
    expect(codes[1]).toContain("createVariantFromComponents");
  });

  it("le combinazioni non disegnate arrivano nell'esito dopo la scrittura", async () => {
    const { callTool } = scripted({ reading: variantReading("chip", CHIP_CELLS.filter((cell) => cell.id !== "chip-sm-true")) }, WRITTEN);
    const result = await groupVariants("chip", (reading) => planGroupVariants(reading), { callTool });
    expect(result.notDrawn).toEqual(["Chip / size=sm, removable=true"]);
  });

  it("il lettore passa il nome chiesto al sorgente", async () => {
    const { callTool, codes } = scripted({ reading: variantReading("chip", CHIP_CELLS) }, WRITTEN);
    await groupVariants("Chip", (reading) => planGroupVariants(reading), { callTool });
    expect(codes[0]).toContain('return readVariantCells("Chip");');
  });

  it("già raggruppato → una chiamata sola, nessuna scrittura", async () => {
    const reading = variantReading("chip", [], {
      container: { id: "c", name: "Chip", properties: ["size"], variants: [{ id: "a", name: "Chip", variant: { size: "md" } }] },
    });
    const { callTool, codes } = scripted({ reading }, WRITTEN);
    const result = await groupVariants("chip", (r) => planGroupVariants(r), { callTool });
    expect(result).toMatchObject({ outcome: "già raggruppato", container: "Chip", axes: ["size"] });
    expect(codes).toHaveLength(1);
  });

  it("singolo → una chiamata sola, nessuna scrittura", async () => {
    const reading = variantReading("multiselect-panel", [variantCell("Multiselect Panel", "panel")]);
    const { callTool, codes } = scripted({ reading }, WRITTEN);
    const result = await groupVariants("multiselect-panel", (r) => planGroupVariants(r), { callTool });
    expect(result).toMatchObject({ outcome: "singolo", axes: [] });
    expect(codes).toHaveLength(1);
  });

  it("cella di partenza mancante → l'errore del nucleo la nomina e la scrittura non parte", async () => {
    const reading = variantReading("chip", CHIP_CELLS.filter((cell) => cell.id !== "chip-md-false"));
    const { callTool, codes } = scripted({ reading }, WRITTEN);
    await expect(groupVariants("chip", (r) => planGroupVariants(r), { callTool })).rejects.toThrow(/cella di partenza/);
    expect(codes).toHaveLength(1);
  });

  it("il sorgente risponde con un errore → si rilancia così com'è", async () => {
    const { callTool, codes } = scripted({ error: "Più componenti rispondono a \"chip\"." }, WRITTEN);
    await expect(groupVariants("chip", (r) => planGroupVariants(r), { callTool })).rejects.toThrow(/Più componenti rispondono/);
    expect(codes).toHaveLength(1);
  });

  it("una lettura che non passa lo schema → errore col percorso zod, nessuna scrittura", async () => {
    const invalid: VariantCellsReading = { ...variantReading("chip", CHIP_CELLS), boards: [{ id: "", name: "Chip / size=md" }] };
    const { callTool, codes } = scripted({ reading: invalid }, WRITTEN);
    await expect(groupVariants("chip", (r) => planGroupVariants(r), { callTool })).rejects.toThrow(/boards\.0\.id/);
    expect(codes).toHaveLength(1);
  });

  it("risultato senza reading né error → errore esplicito", async () => {
    const { callTool } = scripted({ altro: 1 }, WRITTEN);
    await expect(groupVariants("chip", (r) => planGroupVariants(r), { callTool })).rejects.toThrow(/né "reading" né "error"/);
  });

  it("l'uscita della scrittura che non passa lo schema è un errore, non un falso verde", async () => {
    const { callTool } = scripted({ reading: variantReading("chip", CHIP_CELLS) }, { outcome: "raggruppato" });
    await expect(groupVariants("chip", (r) => planGroupVariants(r), { callTool })).rejects.toThrow(/non passa lo schema/);
  });

  it("nome vuoto → errore prima di chiamare Penpot", async () => {
    const { callTool, codes } = scripted({ reading: variantReading("chip", CHIP_CELLS) }, WRITTEN);
    await expect(groupVariants("  ", (r) => planGroupVariants(r), { callTool })).rejects.toThrow(/nome del componente è vuoto/);
    expect(codes).toHaveLength(0);
  });

  it("envelope di errore → errore di execute_code", async () => {
    const callTool: CallToolFn = async () => ({ isError: true, content: [{ type: "text", text: "boom" }] });
    await expect(groupVariants("chip", (r) => planGroupVariants(r), { callTool })).rejects.toThrow(/execute_code di Penpot ha riportato un errore.*boom/);
  });
});

/**
 * Il sorgente di scrittura eseguito su un Penpot finto: l'API ha la stessa
 * forma (`createVariantFromComponents`, `variants`, `variantProps`,
 * `setVariantProperty`), le mutazioni sono asincrone come nel file vero. È la
 * prova che la sequenza — creazione, attese, nomi degli assi, valori — regge
 * senza toccare Penpot.
 */
function fakePenpot(children: readonly { id: string; name: string }[]) {
  const boards = new Map(children.map((child) => [child.id, { ...child }]));
  const properties = ["Property 1"];
  const variants = children.map((child) => ({ id: child.id, name: child.name, values: [child.name.slice(child.name.indexOf("/") + 1).trim()] }));
  let containerName = children[0]!.name.slice(0, children[0]!.name.indexOf("/")).trim();
  let containerReads = 0;
  /** Ogni mutazione arriva al "file" dopo un tick, come le `st/emit!` di Penpot. */
  const apply = (change: () => void) => setTimeout(change, 0);

  const container = {
    id: "container",
    get name() {
      return containerName;
    },
    set name(value: string) {
      containerName = value;
    },
    // Le prime due letture non vedono ancora il container: il sorgente deve attendere.
    isVariantContainer: () => {
      containerReads += 1;
      return containerReads > 2;
    },
    get variants() {
      return {
        variantComponents: () =>
          variants.map((variant) => ({
            mainInstance: () => boards.get(variant.id),
            get variantProps() {
              return Object.fromEntries(properties.map((property, index) => [property, variant.values[index] ?? ""]));
            },
            get variantError() {
              return undefined;
            },
            setVariantProperty: (pos: number, value: string) => {
              apply(() => {
                variant.values[pos] = value;
              });
            },
          })),
        renameProperty: (pos: number, name: string) => {
          apply(() => {
            properties[pos] = name;
          });
        },
        addProperty: () => {
          apply(() => {
            properties.push(`Property ${properties.length + 1}`);
            for (const variant of variants) variant.values.push("Value 1");
          });
        },
      };
    },
  };

  return {
    currentPage: { getShapeById: (id: string) => boards.get(id) ?? null },
    createVariantFromComponents: (shapes: unknown[]) => {
      if (shapes.length !== children.length) throw new Error("il finto Penpot ha ricevuto il numero sbagliato di board");
      containerReads = 0;
      return container;
    },
    /** Lo stato del "file" a fine sequenza, per le asserzioni. */
    state: () => ({ containerName, properties: [...properties], variants: variants.map((variant) => ({ name: variant.name, props: Object.fromEntries(properties.map((property, index) => [property, variant.values[index] ?? ""])) })) }),
  };
}

/** Esegue il sorgente generato come fa `execute_code`: dentro un'async IIFE. */
async function runWriteSource(plan: GroupVariantsPlan, penpot: unknown): Promise<unknown> {
  const code = groupVariantsCode(plan);
  // Solo parsing/esecuzione locale: nessuna rete.
  const run = new Function("penpot", `return (async () => { ${code} })();`) as (penpot: unknown) => Promise<unknown>;
  return await run(penpot);
}

describe("il sorgente di scrittura su un Penpot finto", () => {
  it("Chip: crea il container, attende, rinomina gli assi e imposta i valori", async () => {
    const plan = planGroupVariants(variantReading("chip", CHIP_CELLS));
    const penpot = fakePenpot(CHIP_CELLS);
    await expect(runWriteSource(plan, penpot)).resolves.toEqual(WRITTEN);
    expect(penpot.state()).toEqual({
      containerName: "Chip",
      properties: ["size", "removable"],
      variants: [
        { name: CHIP_CELLS[0]!.name, props: { size: "md", removable: "false" } },
        { name: CHIP_CELLS[1]!.name, props: { size: "md", removable: "true" } },
        { name: CHIP_CELLS[2]!.name, props: { size: "sm", removable: "false" } },
        { name: CHIP_CELLS[3]!.name, props: { size: "sm", removable: "true" } },
      ],
    });
  });

  it("una cella fuori dalla pagina corrente ferma la scrittura prima di creare il container", async () => {
    const plan = planGroupVariants(variantReading("chip", CHIP_CELLS));
    const penpot = fakePenpot(CHIP_CELLS);
    penpot.currentPage.getShapeById = () => null;
    await expect(runWriteSource(plan, penpot)).rejects.toThrow(/non è nella pagina corrente/);
  });
});
