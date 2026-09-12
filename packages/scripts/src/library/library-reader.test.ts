import { describe, expect, it } from "vitest";

import { readLibrarySnapshot } from "./library-reader";

function envelope(result: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  return { content: [{ type: "text", text: JSON.stringify({ result }) }] };
}

const validSnapshot = {
  sets: [{ name: "palette", active: true, tokens: [{ name: "gray.1", type: "color", value: "#FAF4E8" }] }],
  componentCount: 1,
  components: [
    {
      id: "c1",
      name: "Badge",
      pluginData: "badge@1",
      axes: ["variant", "size"],
      axesValues: { variant: ["default"], size: ["sm"] },
      cells: [
        {
          variantProps: { variant: "default", size: "sm" },
          variantError: null,
          root: {
            name: "root",
            kind: "board",
            tokens: { fill: "color.primary" },
            style: { fill: ["#006C49"] },
            children: [{ name: "label", kind: "text", tokens: {}, style: {}, children: [] }],
          },
        },
      ],
    },
  ],
};

describe("readLibrarySnapshot — percorso felice", () => {
  it("legge lo snapshot dall'envelope di execute_code", async () => {
    const calls: Array<{ name: string; arguments: { code: string } }> = [];
    const snapshot = await readLibrarySnapshot({
      callTool: async (args) => {
        calls.push(args);
        return envelope(validSnapshot);
      },
    });
    expect(snapshot.sets).toHaveLength(1);
    expect(snapshot.componentCount).toBe(1);
    expect(snapshot.components[0]?.pluginData).toBe("badge@1");
    expect(snapshot.components[0]?.cells[0]?.root.tokens.fill).toBe("color.primary");
    expect(snapshot.components[0]?.cells[0]?.root.children[0]?.name).toBe("label");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.name).toBe("execute_code");
    expect(calls[0]!.arguments.code).toContain('getSharedPluginData("pagebuilder", "contract")');
    expect(calls[0]!.arguments.code).toContain("isVariantContainer");
    expect(calls[0]!.arguments.code).toContain("shape.tokens");
  });

  it("i binding vuoti o null non entrano nello snapshot", async () => {
    const raw = JSON.parse(JSON.stringify(validSnapshot)) as typeof validSnapshot;
    Object.assign(raw.components[0]!.cells[0]!.root.tokens, { shadow: null, opacity: "" });
    const snapshot = await readLibrarySnapshot({ callTool: async () => envelope(raw) });
    expect(snapshot.components[0]!.cells[0]!.root.tokens).toEqual({ fill: "color.primary" });
  });
});

describe("readLibrarySnapshot — envelope malformato fallisce loud", () => {
  it("isError → errore esplicito", async () => {
    await expect(
      readLibrarySnapshot({ callTool: async () => ({ content: [{ type: "text", text: "boom" }], isError: true }) }),
    ).rejects.toThrow(/ha riportato un errore/);
  });

  it("nessun contenuto testuale → errore esplicito", async () => {
    await expect(readLibrarySnapshot({ callTool: async () => ({ content: [] }) })).rejects.toThrow(
      /non ha restituito contenuto testuale/,
    );
  });

  it("result mancante → errore esplicito", async () => {
    await expect(
      readLibrarySnapshot({ callTool: async () => ({ content: [{ type: "text", text: JSON.stringify({ log: "x" }) }] }) }),
    ).rejects.toThrow(/result.*mancante|non contiene un envelope valido/i);
  });

  it("set senza name → errore che nomina il campo", async () => {
    const raw = { sets: [{ active: true, tokens: [] }], componentCount: 0, components: [] };
    await expect(readLibrarySnapshot({ callTool: async () => envelope(raw) })).rejects.toThrow(/"set\.name"/);
  });

  it("token senza value → errore che nomina il token e il set", async () => {
    const raw = {
      sets: [{ name: "palette", active: true, tokens: [{ name: "gray.1", type: "color" }] }],
      componentCount: 0,
      components: [],
    };
    await expect(readLibrarySnapshot({ callTool: async () => envelope(raw) })).rejects.toThrow(/"gray\.1".*palette/);
  });

  it("pluginData non stringa e non null → errore esplicito", async () => {
    const raw = JSON.parse(JSON.stringify(validSnapshot)) as typeof validSnapshot;
    (raw.components[0] as unknown as { pluginData: number }).pluginData = 42;
    await expect(readLibrarySnapshot({ callTool: async () => envelope(raw) })).rejects.toThrow(/pluginData/);
  });

  it("layer malformato → errore che nomina il layer", async () => {
    const raw = JSON.parse(JSON.stringify(validSnapshot)) as typeof validSnapshot;
    (raw.components[0]!.cells[0]!.root as unknown as { name: number }).name = 7;
    await expect(readLibrarySnapshot({ callTool: async () => envelope(raw) })).rejects.toThrow(/"layer\.name"/);
  });
});

describe("readLibrarySnapshot — timeout", () => {
  it("il timeout viene propagato con il messaggio di withTimeout", async () => {
    await expect(
      readLibrarySnapshot({
        callTool: () => new Promise(() => undefined),
        timeoutMs: 20,
      }),
    ).rejects.toThrow(/Timeout \(20ms\)/);
  });
});
