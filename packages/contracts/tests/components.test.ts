import { describe, expect, it } from "vitest";

import { accordionItem } from "../src/components/accordion-item";
import { badge } from "../src/components/badge";
import { input } from "../src/components/input";
import { contractId, propsSchema } from "../src/contract";
import { COMPONENT_CONTRACTS } from "../src/registry";

describe("badge@1", () => {
  it("ha assi, tipi, valori, default e parti del prototipo", () => {
    expect(badge.name).toBe("badge");
    expect(badge.version).toBe(1);
    expect(badge.axes).toEqual([
      { name: "variant", type: "option", values: ["default", "secondary", "destructive"], default: "default" },
      { name: "size", type: "option", values: ["sm", "md"], default: "md" },
    ]);
    expect(badge.parts).toEqual(["root", "label"]);
    expect(Object.keys(badge.fields)).toEqual(["label"]);
    expect(badge.fields.label.kind).toBe("content");
  });

  it("valida le props, applica i default e preserva i campi ignoti", () => {
    const schema = propsSchema(badge);
    expect(schema.parse({ variant: "destructive", size: "sm", label: "Nuovo" })).toEqual({
      variant: "destructive",
      size: "sm",
      label: "Nuovo",
    });
    expect(schema.parse({ label: "x" })).toEqual({ variant: "default", size: "md", label: "x" });
    expect(schema.safeParse({ variant: "outline", label: "x" }).success).toBe(false);
    expect(schema.parse({ id: "Badge-1", label: "x", ignoto: true })).toMatchObject({ id: "Badge-1", ignoto: true });
  });
});

describe("input@1", () => {
  it("ha solo l'asse state di tipo state", () => {
    expect(input.name).toBe("input");
    expect(input.version).toBe(1);
    expect(input.axes).toEqual([
      { name: "state", type: "state", values: ["default", "focus", "error", "disabled"], default: "default" },
    ]);
    expect(input.parts).toEqual(["root", "placeholder"]);
    expect(Object.keys(input.fields)).toEqual(["placeholder"]);
    expect(input.fields.placeholder.kind).toBe("content");
  });

  it("non espone lo stato come prop", () => {
    expect(Object.keys(propsSchema(input).shape)).toEqual(["placeholder"]);
  });
});

describe("accordion-item@1", () => {
  it("ha l'asse state di tipo behavior e parti piatte", () => {
    expect(accordionItem.name).toBe("accordion-item");
    expect(accordionItem.version).toBe(1);
    expect(accordionItem.axes).toEqual([
      { name: "state", type: "behavior", values: ["closed", "open"], default: "closed" },
    ]);
    expect(accordionItem.parts).toEqual(["root", "trigger", "label", "chevron", "content", "body", "divider"]);
    expect(Object.keys(accordionItem.fields)).toEqual(["label", "body"]);
    expect(accordionItem.fields.label.kind).toBe("content");
    expect(accordionItem.fields.body.kind).toBe("content");
  });

  it("non espone lo stato come prop", () => {
    expect(Object.keys(propsSchema(accordionItem).shape)).toEqual(["label", "body"]);
  });
});

describe("registry e contractId", () => {
  it("elenca esattamente i tre contratti sotto il loro nome", () => {
    expect(COMPONENT_CONTRACTS).toEqual({ badge, input, "accordion-item": accordionItem });
    for (const [name, contract] of Object.entries(COMPONENT_CONTRACTS)) expect(contract.name).toBe(name);
  });

  it("produce il formato nome@versione del plugin data Penpot", () => {
    expect(contractId(badge)).toBe("badge@1");
    expect(contractId(input)).toBe("input@1");
    expect(contractId(accordionItem)).toBe("accordion-item@1");
  });
});
