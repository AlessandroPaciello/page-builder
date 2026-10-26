import { describe, expect, it, vi } from "vitest";

import { registeredProperties } from "../../src/core";
import type { McpCallToolResult } from "../../src/penpot/mcp-client";
import { assertRegistryCovered, READ_COMPONENT_SOURCE, READ_PROPERTIES, readComponent, readComponentCode, type CallToolFn } from "../../src/penpot/read-component";

/**
 * Livello 1 della CI (Story 2.23): l'adattatore senza Penpot. `callTool` è
 * finto e restituisce envelope scritti a mano; nessuna lettura Penpot
 * salvata (regola 5).
 */

const envelope = (result: unknown): McpCallToolResult => ({ content: [{ type: "text", text: JSON.stringify({ result }) }] });

const fake = (response: McpCallToolResult): CallToolFn => vi.fn(async () => response);

/** La `Lettura` minima valida: un componente senza assi, una cella. */
const minimal = {
  component: "Badge",
  pluginData: { contract: "badge@1" },
  cells: [{ variant: {}, root: { name: "Badge", kind: "board", tokens: {}, style: { width: 40 }, children: [] } }],
};

describe("assertRegistryCovered", () => {
  it("verde: ogni proprietà del registro ha una regola di lettura", () => {
    expect(() => assertRegistryCovered()).not.toThrow();
    for (const property of registeredProperties()) expect(READ_PROPERTIES).toContain(property);
  });

  it("rosso: una proprietà del registro assente da READ_PROPERTIES → errore che la nomina", () => {
    const read = READ_PROPERTIES.filter((property) => property !== "letterSpacing" && property !== "clip");
    expect(() => assertRegistryCovered(read)).toThrow(/\[letterSpacing, clip\]/);
    expect(() => assertRegistryCovered(READ_PROPERTIES, [...registeredProperties(), "lineHeight"])).toThrow(/lineHeight/);
  });

  it("rosso: una voce di READ_PROPERTIES che il sorgente non scrive → errore che la nomina", () => {
    const source = READ_COMPONENT_SOURCE.split("style.clip").join("style.other");
    expect(() => assertRegistryCovered(READ_PROPERTIES, registeredProperties(), source)).toThrow(/\[clip\].*non le scrive/);
    expect(() => assertRegistryCovered([...READ_PROPERTIES, "lineHeight"], registeredProperties())).toThrow(/\[lineHeight\]/);
    expect(() => assertRegistryCovered(READ_PROPERTIES, registeredProperties(), READ_COMPONENT_SOURCE)).not.toThrow();
  });
});

describe("readComponent con callTool finto", () => {
  it("verde: una Lettura valida passa lo schema e il codice cerca il nome chiesto", async () => {
    const callTool = fake(envelope({ lettura: minimal }));
    await expect(readComponent("badge", { callTool })).resolves.toEqual(minimal);
    expect(callTool).toHaveBeenCalledWith({ name: "execute_code", arguments: { code: readComponentCode("badge") } });
    expect(readComponentCode("badge")).toContain('return readPenpotComponent("badge");');
  });

  it("il codice inietta le esclusioni degli override e non scrive su Penpot", () => {
    const code = readComponentCode("badge");
    expect(code).toContain('"sizingH","sizingV","x","y","width","height"');
    expect(code).not.toMatch(/\bset[A-Z]\w*\(/);
    expect(code).not.toMatch(/\bstorage\b/);
  });

  it("rosso: envelope con errore → errore di execute_code", async () => {
    const callTool = fake({ isError: true, content: [{ type: "text", text: "boom" }] });
    await expect(readComponent("badge", { callTool })).rejects.toThrow(/execute_code di Penpot ha riportato un errore.*boom/);
  });

  it("rosso: envelope senza `result` o non JSON → errore esplicito", async () => {
    await expect(readComponent("badge", { callTool: fake({ content: [{ type: "text", text: "{}" }] }) })).rejects.toThrow(/`result` mancante/);
    await expect(readComponent("badge", { callTool: fake({ content: [{ type: "text", text: "nope" }] }) })).rejects.toThrow(/non è JSON valido/);
  });

  it("rosso: una Lettura non valida → errore che cita il percorso zod", async () => {
    const invalid = { ...minimal, cells: [{ variant: {}, root: { ...minimal.cells[0]!.root, children: [{ name: "", kind: "text", tokens: {}, style: {}, children: [] }] } }] };
    await expect(readComponent("badge", { callTool: fake(envelope({ lettura: invalid })) })).rejects.toThrow(/cells\.0\.root\.children\.0\.name/);
    await expect(readComponent("badge", { callTool: fake(envelope({ lettura: { ...minimal, cells: [] } })) })).rejects.toThrow(/cells:/);
  });

  it("rosso: l'errore del sorgente (nome ignoto, doppio) arriva così com'è", async () => {
    const unknown = 'Nessun componente "nope" in Penpot: nessun container (o componente principale) ha il plugin data pagebuilder.contract "nope".';
    await expect(readComponent("nope", { callTool: fake(envelope({ error: unknown })) })).rejects.toThrow(unknown);
    const twice = 'Più componenti rispondono a "badge": ["Badge" (id a, contract badge@1), "Badge" (id b, contract badge@1)].';
    await expect(readComponent("badge", { callTool: fake(envelope({ error: twice })) })).rejects.toThrow(twice);
  });

  it("rosso: risultato senza `lettura` né `error` → errore esplicito", async () => {
    await expect(readComponent("badge", { callTool: fake(envelope({ altro: 1 })) })).rejects.toThrow(/né "lettura" né "error"/);
  });

  it("rosso: nome vuoto → errore prima di chiamare Penpot", async () => {
    const callTool = fake(envelope({ lettura: minimal }));
    await expect(readComponent("  ", { callTool })).rejects.toThrow(/nome del componente è vuoto/);
    expect(callTool).not.toHaveBeenCalled();
  });
});
