import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { readComponentFixture, type CallToolFn } from "./component-reader";
import type { TokenCatalog } from "./theme-generator";

const here = dirname(fileURLToPath(import.meta.url));
const catalog: TokenCatalog = JSON.parse(
  readFileSync(resolve(here, "__fixtures__/penpot-catalog.json"), "utf8"),
) as TokenCatalog;

/** Envelope execute_code felice: container Badge con 2 celle + Default. */
const happyEnvelope = {
  content: [
    {
      type: "text",
      text: JSON.stringify({
        result: {
          container: { id: "container-1", name: "Badge / Default" },
          axes: ["Color", "Style"],
          boards: [
            {
              id: "board-red-solid",
              name: "Red / solid",
              variantProps: { Color: "Red", Style: "solid" },
              fills: [{ fillColor: "#ffdad6" }],
              strokes: [],
              borderRadius: 9999,
              textColors: ["#ba1a1a"],
              rawCss: ".badge-red-solid { background-color: #ffdad6; color: #ba1a1a; }",
            },
            {
              id: "board-indigo-outline",
              name: "Indigo / outline",
              variantProps: { Color: "Indigo", Style: "outline" },
              fills: [],
              strokes: [{ strokeColor: "#006c49" }],
              borderRadius: 9999,
              textColors: ["#006c49"],
              rawCss: ".badge-indigo-outline { border: 1px solid #006c49; }",
            },
            {
              id: "board-default",
              name: "Default",
              variantProps: null,
              fills: [{ fillColor: "#ffdad6" }],
              strokes: [],
              borderRadius: 9999,
              textColors: ["#ba1a1a"],
              rawCss: ".badge-default { background-color: #ffdad6; }",
            },
          ],
        },
        log: "",
      }),
    },
  ],
};

function mockCallTool(result: unknown, delayMs = 0): CallToolFn {
  return vi.fn(async () => {
    if (delayMs > 0) {
      await new Promise(() => {
        /* mai risolto — per il test di timeout */
      });
    }
    return result;
  });
}

describe("readComponentFixture", () => {
  it("assembla la fixture con assi derivati dalle celle e binding per esatto hex-match", async () => {
    const callTool = mockCallTool(happyEnvelope);
    const fixture = await readComponentFixture("Badge / Default", catalog, { callTool });

    expect(fixture.componentName).toBe("Badge");
    expect(fixture.penpotComponentId).toBe("container-1");
    expect(fixture.variantAxes).toEqual([
      { name: "Color", values: ["Red", "Indigo"] },
      { name: "Style", values: ["solid", "outline"] },
    ]);
    const redSolid = fixture.cells.find((cell) => cell.variantProps?.Color === "Red");
    expect(redSolid?.tokenBindings).toEqual({
      fill: "color.feedback.error.container",
      text: "color.feedback.error",
      borderRadius: "radius.mis.full",
    });
    const indigoOutline = fixture.cells.find((cell) => cell.variantProps?.Style === "outline");
    expect(indigoOutline?.tokenBindings).toEqual({
      stroke: "color.mis.primary",
      text: "color.mis.primary",
      borderRadius: "radius.mis.full",
    });
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it("include la cella Default (variantProps null) nella matrice celle", async () => {
    const fixture = await readComponentFixture("Badge / Default", catalog, { callTool: mockCallTool(happyEnvelope) });
    expect(fixture.cells.some((cell) => cell.variantProps === null)).toBe(true);
  });

  it("non scarta in silenzio una board con matched: false — la conserva come riga variantProps: null", async () => {
    const unmatchedEnvelope = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            result: {
              container: { id: "container-1", name: "Badge / Default" },
              axes: ["Color"],
              boards: [
                {
                  id: "board-red-solid",
                  name: "Red / solid",
                  cellId: "cell-red-solid",
                  variantProps: { Color: "Red" },
                  variantError: null,
                  matched: true,
                  fills: [{ fillColor: "#ffdad6" }],
                  strokes: [],
                  borderRadius: 9999,
                  textColors: ["#ba1a1a"],
                  rawCss: "",
                },
                {
                  id: "board-default",
                  name: "Default",
                  cellId: null,
                  variantProps: null,
                  variantError: null,
                  matched: false,
                  fills: [{ fillColor: "#ffdad6" }],
                  strokes: [],
                  borderRadius: 9999,
                  textColors: ["#ba1a1a"],
                  rawCss: "",
                },
              ],
            },
            log: "",
          }),
        },
      ],
    };
    const fixture = await readComponentFixture("Badge / Default", catalog, {
      callTool: mockCallTool(unmatchedEnvelope),
    });
    expect(fixture.cells).toHaveLength(2);
    const defaultCell = fixture.cells.find((cell) => cell.variantProps === null);
    expect(defaultCell?.penpotComponentId).toBe("board-default");
    expect(defaultCell?.rawCss).toBe("");
    expect(defaultCell?.tokenBindings).toEqual({
      fill: "color.feedback.error.container",
      text: "color.feedback.error",
      borderRadius: "radius.mis.full",
    });
  });

  it("applica lo stop-signal anche a una board matched:false con un colore senza corrispondenza nel catalogo", async () => {
    const unmatchedUnbindable = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            result: {
              container: { id: "container-1", name: "Badge / Default" },
              axes: ["Color"],
              boards: [
                {
                  id: "board-red-solid",
                  name: "Red / solid",
                  cellId: "cell-red-solid",
                  variantProps: { Color: "Red" },
                  variantError: null,
                  matched: true,
                  fills: [{ fillColor: "#ffdad6" }],
                  strokes: [],
                  borderRadius: 9999,
                  textColors: ["#ba1a1a"],
                  rawCss: "",
                },
                {
                  id: "board-default",
                  name: "Default",
                  cellId: null,
                  variantProps: null,
                  variantError: null,
                  matched: false,
                  fills: [{ fillColor: "#123abc" }],
                  strokes: [],
                  borderRadius: 9999,
                  textColors: [],
                  rawCss: "",
                },
              ],
            },
            log: "",
          }),
        },
      ],
    };
    await expect(
      readComponentFixture("Badge / Default", catalog, { callTool: mockCallTool(unmatchedUnbindable) }),
    ).rejects.toThrow(/#123abc[\s\S]*Default|Default[\s\S]*#123abc/);
  });

  it("rifiuta un envelope malformato nominando il campo (mancanza di `result`)", async () => {
    const callTool = mockCallTool({ content: [{ type: "text", text: JSON.stringify({ log: "ciao" }) }] });
    await expect(readComponentFixture("Badge", catalog, { callTool })).rejects.toThrow(/result/);
  });

  it("rifiuta un envelope senza contenuto testuale", async () => {
    const callTool = mockCallTool({ content: [] });
    await expect(readComponentFixture("Badge", catalog, { callTool })).rejects.toThrow(/contenuto testuale/);
  });

  it("propaga l'errore del tool execute_code (isError)", async () => {
    const callTool = mockCallTool({ isError: true, content: [{ type: "text", text: "boom" }] });
    await expect(readComponentFixture("Badge", catalog, { callTool })).rejects.toThrow(/boom/);
  });

  it("rifiuta un componente non trovato nominandolo", async () => {
    const notFound = {
      content: [
        {
          type: "text",
          text: JSON.stringify({ result: { notFound: "Input / Legacy" }, log: "" }),
        },
      ],
    };
    const callTool = mockCallTool(notFound);
    await expect(readComponentFixture("Input", catalog, { callTool })).rejects.toThrow(/Input \/ Legacy/);
  });

  it("rifiuta una shape trovata ma senza variant container nominandola", async () => {
    const noVariants = {
      content: [
        {
          type: "text",
          text: JSON.stringify({ result: { notAVariantContainer: "Badge / Default" }, log: "" }),
        },
      ],
    };
    const callTool = mockCallTool(noVariants);
    await expect(readComponentFixture("Badge", catalog, { callTool })).rejects.toThrow(/Badge \/ Default/);
  });

  it("fa stop esplicito su un hex senza corrispondenza esatta nel catalogo (nominando shape e hex)", async () => {
    const unknownHex = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            result: {
              container: { id: "container-1", name: "Badge / Default" },
              axes: ["Color"],
              boards: [
                {
                  id: "board-x",
                  name: "X / solid",
                  variantProps: { Color: "X" },
                  fills: [{ fillColor: "#123abc" }],
                  strokes: [],
                  borderRadius: null,
                  textColors: [],
                  rawCss: "",
                },
              ],
            },
            log: "",
          }),
        },
      ],
    };
    const callTool = mockCallTool(unknownHex);
    await expect(readComponentFixture("Badge", catalog, { callTool })).rejects.toThrow(
      /#123abc[\s\S]*X \/ solid|X \/ solid[\s\S]*#123abc/,
    );
  });

  it("va in timeout se il server MCP non risponde, con messaggio che nomina l'operazione", async () => {
    const callTool = mockCallTool(undefined, 30_000);
    await expect(
      readComponentFixture("Badge", catalog, { callTool, timeoutMs: 20 }),
    ).rejects.toThrow(/Timeout \(20ms\)/);
  });

  it("percorre un container senza assi (nessuna variante) come fixture a cella unica", async () => {
    const single = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            result: {
              container: { id: "container-2", name: "Simple" },
              axes: [],
              boards: [
                {
                  id: "board-only",
                  name: "Default",
                  variantProps: null,
                  fills: [{ fillColor: "#2e7d32" }],
                  strokes: [],
                  borderRadius: 0,
                  textColors: [],
                  rawCss: ".simple { background: #2e7d32; }",
                },
              ],
            },
            log: "",
          }),
        },
      ],
    };
    const fixture = await readComponentFixture("Simple", catalog, { callTool: mockCallTool(single) });
    expect(fixture.variantAxes).toEqual([]);
    expect(fixture.cells).toHaveLength(1);
    expect(fixture.cells[0]!.tokenBindings).toEqual({ fill: "color.feedback.success", borderRadius: "radius.mis.rectangle" });
  });
});