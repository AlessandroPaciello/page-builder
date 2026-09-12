import { describe, expect, it } from "vitest";
import { z } from "zod";

import { contractId, defineContract, propsSchema } from "../src/contract";

const valid = {
  name: "demo-chip",
  version: 1,
  axes: [
    { name: "tone", type: "option", values: ["neutral", "loud"], default: "neutral" },
    { name: "state", type: "state", values: ["default", "focus"], default: "default" },
  ],
  parts: ["root", "label"],
  fields: { label: { schema: z.string(), kind: "content" } },
} as const;

describe("defineContract", () => {
  it("accetta un contratto valido e lo restituisce intatto", () => {
    const contract = defineContract(valid);
    expect(contract).toBe(valid);
    expect(contractId(contract)).toBe("demo-chip@1");
  });

  it.each([
    ["nome non kebab-case", { ...valid, name: "DemoChip" }, /DemoChip.*name "DemoChip" non è kebab-case/],
    ["nome con trattino finale", { ...valid, name: "demo-" }, /name/],
    ["versione 0", { ...valid, version: 0 }, /demo-chip.*version/],
    ["versione non intera", { ...valid, version: 1.5 }, /demo-chip.*version/],
    [
      "asse duplicato",
      { ...valid, axes: [valid.axes[0], { ...valid.axes[0], values: ["a"], default: "a" }] },
      /demo-chip.*asse "tone".*duplicat/,
    ],
    [
      "valore duplicato in un asse",
      { ...valid, axes: [{ ...valid.axes[0], values: ["neutral", "neutral"] }] },
      /demo-chip.*asse "tone".*valore "neutral".*duplicat/,
    ],
    [
      "default fuori dai valori",
      { ...valid, axes: [{ ...valid.axes[0], default: "quiet" }] },
      /demo-chip.*asse "tone".*default "quiet"/,
    ],
    ["parte duplicata", { ...valid, parts: ["root", "root"] }, /demo-chip.*parte "root".*duplicat/],
    [
      "parte con nome non valido",
      { ...valid, parts: ["root", "root label"] },
      /demo-chip.*parte "root label".*nome non valido/,
    ],
    [
      "asse con nome non valido",
      { ...valid, axes: [{ ...valid.axes[0], name: "bad axis" }] },
      /demo-chip.*asse "bad axis".*nome non valido/,
    ],
    [
      "field che collide con un asse option",
      { ...valid, fields: { ...valid.fields, tone: { schema: z.string(), kind: "content" } } },
      /demo-chip.*field "tone".*collide con l'asse "tone" \(option\)/,
    ],
    [
      "field che collide con un asse non-option",
      { ...valid, fields: { ...valid.fields, state: { schema: z.string(), kind: "content" } } },
      /demo-chip.*field "state".*collide con l'asse "state" \(state\)/,
    ],
    [
      "field con nome non valido",
      { ...valid, fields: { ...valid.fields, "bad field": { schema: z.string(), kind: "content" } } },
      /demo-chip.*field "bad field".*nome non valido/,
    ],
    [
      "field con chiave prototipale",
      { ...valid, fields: { ...valid.fields, ["__proto__"]: { schema: z.string(), kind: "content" } } },
      /demo-chip.*field "__proto__".*nome non valido/,
    ],
    [
      "field senza schema Zod",
      { ...valid, fields: { ...valid.fields, body: { schema: "non-uno-schema", kind: "content" } } },
      /demo-chip.*field "body".*schema Zod/,
    ],
  ])("rifiuta %s nominando contratto e campo", (_label, def, message) => {
    expect(() => defineContract(def as never)).toThrow(message);
  });
});

describe("propsSchema", () => {
  const schema = propsSchema(defineContract(valid));

  it("trasforma gli assi option in enum con default e ignora gli assi state/behavior", () => {
    expect(schema.parse({ label: "x" })).toEqual({ tone: "neutral", label: "x" });
    expect(Object.keys(schema.shape)).toEqual(["tone", "label"]);
  });

  it("rifiuta un valore fuori dall'asse", () => {
    expect(schema.safeParse({ tone: "quiet", label: "x" }).success).toBe(false);
  });

  it("preserva i campi ignoti (round-trip lossless, id di Puck)", () => {
    expect(schema.parse({ id: "Badge-1", label: "x", extra: 42 })).toEqual({
      id: "Badge-1",
      tone: "neutral",
      label: "x",
      extra: 42,
    });
  });
});
