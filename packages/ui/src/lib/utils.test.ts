import { colorNames, fontFamilyNames, fontWeightNames, trackingNames } from "@penpot-ds/tokens/scales";
import { describe, expect, it } from "vitest";

import { cn } from "./utils";

/**
 * I nomi vengono dalle scale generate (`@penpot-ds/tokens/scales`), non da una
 * lista a mano: il tema committato si rigenera da Penpot con `extract_theme`
 * (Story 2.26) e i nomi seguono il catalogo.
 */
const weight = fontWeightNames[0];
const family = fontFamilyNames[0];
const [firstTracking, lastTracking] = [trackingNames[0], trackingNames.at(-1)!];
const color = colorNames.find((name) => name !== "destructive")!;

describe("cn — tailwind-merge con le scale dei token Penpot (Story 2.9)", () => {
  it("un peso e una famiglia non sono in conflitto", () => {
    expect(cn(`font-${weight} font-${family}`)).toBe(`font-${weight} font-${family}`);
  });

  it("colore: vince l'ultimo, la dimensione del testo resta", () => {
    expect(cn(`text-${color} text-sm`, "text-destructive")).toBe("text-sm text-destructive");
  });

  it("tracking dei token: vince l'ultimo", () => {
    expect(cn(`tracking-${firstTracking}`, `tracking-${lastTracking}`)).toBe(`tracking-${lastTracking}`);
  });
});
