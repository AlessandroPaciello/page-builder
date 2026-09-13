import { describe, expect, it } from "vitest";

import { influencingAxes } from "./axis-influence";

const axes = [{ name: "variant" }, { name: "size" }];

describe("influencingAxes", () => {
  const cells = {
    "variant=default|size=sm": { fill: "color.primary", paddingLeft: "spacing.2" },
    "variant=default|size=md": { fill: "color.primary", paddingLeft: "spacing.3" },
    "variant=outline|size=sm": { fill: "color.background", paddingLeft: "spacing.2" },
    "variant=outline|size=md": { fill: "color.background", paddingLeft: "spacing.3" },
  };

  it("proprietà che varia con un solo asse → quell'asse", () => {
    expect(influencingAxes(axes, cells, "fill")).toEqual(["variant"]);
    expect(influencingAxes(axes, cells, "paddingLeft")).toEqual(["size"]);
  });

  it("proprietà costante → nessun asse", () => {
    expect(influencingAxes(axes, cells, "fontSize")).toEqual([]);
  });

  it("proprietà che varia con due assi → entrambi, nell'ordine degli assi", () => {
    const crossed = { ...cells, "variant=outline|size=md": { fill: "color.accent", paddingLeft: "spacing.3" } };
    expect(influencingAxes(axes, crossed, "fill")).toEqual(["variant", "size"]);
  });

  it("assenza in una cella conta come valore diverso", () => {
    const { fill: _fill, ...withoutFill } = cells["variant=outline|size=sm"];
    expect(influencingAxes(axes, { ...cells, "variant=outline|size=sm": withoutFill }, "fill")).toEqual(["variant", "size"]);
  });

  it("chiave cella malformata → errore che la nomina", () => {
    expect(() => influencingAxes(axes, { "variant|size=sm": {} }, "fill")).toThrow('chiave cella "variant|size=sm" malformata');
  });
});
