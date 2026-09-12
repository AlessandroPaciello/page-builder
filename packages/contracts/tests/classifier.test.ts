import { describe, expect, it } from "vitest";

import { classifyField } from "../src/classifier";
import { COMPONENT_CONTRACTS, SECTION_DEFINITIONS } from "../src/registry";

const KINDS = ["structure", "content"];

describe("classifyField", () => {
  it("classifica ogni prop di ogni contratto (iterazione sul registry)", () => {
    for (const contract of Object.values(COMPONENT_CONTRACTS)) {
      for (const axis of contract.axes) {
        if (axis.type === "option") expect(classifyField(contract.name, axis.name)).toBe("structure");
      }
      for (const [name, field] of Object.entries(contract.fields)) {
        expect(KINDS).toContain(field.kind);
        expect(classifyField(contract.name, name)).toBe(field.kind);
      }
    }
  });

  it("classifica ogni field di ogni sezione (iterazione sul registry)", () => {
    for (const section of Object.values(SECTION_DEFINITIONS)) {
      for (const [name, field] of Object.entries(section.fields)) {
        expect(KINDS).toContain(field.kind);
        expect(classifyField(section.name, name)).toBe(field.kind);
      }
    }
  });

  it("asse option → structure, field content → content", () => {
    expect(classifyField("badge", "variant")).toBe("structure");
    expect(classifyField("badge", "size")).toBe("structure");
    expect(classifyField("badge", "label")).toBe("content");
  });

  it("field structure di una sezione → structure", () => {
    expect(classifyField("accordion", "type")).toBe("structure");
  });

  it("fail-safe: campo ignoto, componente ignoto e asse non-option → content", () => {
    expect(classifyField("badge", "ignoto")).toBe("content");
    expect(classifyField("badge", "id")).toBe("content");
    expect(classifyField("carousel", "variant")).toBe("content");
    expect(classifyField("input", "state")).toBe("content");
    expect(classifyField("accordion-item", "state")).toBe("content");
  });

  it("fail-safe anche sulle chiavi ereditate da Object.prototype", () => {
    expect(classifyField("constructor", "variant")).toBe("content");
    expect(classifyField("badge", "toString")).toBe("content");
    expect(classifyField("accordion", "__proto__")).toBe("content");
  });
});
