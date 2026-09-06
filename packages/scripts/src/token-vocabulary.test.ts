import { describe, expect, it } from "vitest";

import { buildTokenVocabulary, validateClassesAgainstVocabulary } from "./token-vocabulary";
import type { TokenCatalog } from "./theme-generator";

/**
 * Mini-catalogo di test: un token per tipo utility-producing (con nomi che
 * ripetono e non ripetono il namespace del tipo, per verificare che il
 * vocabolario componga `varSuffix`/`varName` senza reimplementarli) e i due
 * tipi senza namespace v4 (`borderWidth`, `opacity`).
 */
const catalog: TokenCatalog = {
  sets: [
    {
      name: "test.set",
      tokens: [
        { name: "gray.1", type: "color", value: "#F9F9F9" },
        { name: "color.feedback.error", type: "color", value: "#ba1a1a" },
        { name: "space.4", type: "spacing", value: "16" },
        { name: "radius.full", type: "borderRadius", value: "9999" },
        { name: "text.mis.label", type: "fontSizes", value: "14" },
        { name: "font-weight.medium", type: "fontWeights", value: "500" },
        { name: "tracking.wide", type: "letterSpacing", value: "2px" },
        { name: "font.mis.sans", type: "fontFamilies", value: ["Inter"] },
        { name: "shadow.mis.card", type: "shadow", value: [{ offsetX: "0", offsetY: "1", blur: "2", spread: "0", color: "#000", inset: false }] },
        { name: "width.thin", type: "borderWidth", value: "1" },
        { name: "opacity.1", type: "opacity", value: "0.8" },
      ],
    },
  ],
};

describe("buildTokenVocabulary", () => {
  it("espande un token color su tutti i prefissi utility del namespace v4", () => {
    const vocabulary = buildTokenVocabulary(catalog);
    for (const prefix of ["bg-", "text-", "border-", "ring-", "fill-", "stroke-"]) {
      expect(vocabulary.has(`${prefix}gray-1`)).toBe(true);
      expect(vocabulary.has(`${prefix}feedback-error`)).toBe(true);
    }
  });

  it("deduplica il namespace del tipo dal suffisso via varName (stessa derivazione di theme-generator)", () => {
    const vocabulary = buildTokenVocabulary(catalog);
    // "color.feedback.error" NON produce "bg-color-feedback-error": il
    // namespace "color" è già nel nome token e viene tolto da varSuffix.
    expect(vocabulary.has("bg-color-feedback-error")).toBe(false);
    expect(vocabulary.has("bg-feedback-error")).toBe(true);
  });

  it("espande spacing sui prefissi p*/m*/gap/inset", () => {
    const vocabulary = buildTokenVocabulary(catalog);
    for (const prefix of ["p-", "px-", "py-", "pt-", "m-", "mx-", "gap-", "inset-"]) {
      expect(vocabulary.has(`${prefix}space-4`)).toBe(true);
    }
  });

  it("espande i restanti tipi sui loro namespace (rounded/text/font/tracking/shadow)", () => {
    const vocabulary = buildTokenVocabulary(catalog);
    expect(vocabulary.has("rounded-full")).toBe(true);
    expect(vocabulary.has("text-mis-label")).toBe(true);
    expect(vocabulary.has("font-medium")).toBe(true);
    expect(vocabulary.has("tracking-wide")).toBe(true);
    expect(vocabulary.has("font-mis-sans")).toBe(true);
    expect(vocabulary.has("shadow-mis-card")).toBe(true);
  });

  it("NON genera classi per borderWidth e opacity (nessun namespace @theme v4)", () => {
    const vocabulary = buildTokenVocabulary(catalog);
    expect(vocabulary.has("border-w-thin")).toBe(false);
    expect(vocabulary.has("border-thin")).toBe(false);
    expect(vocabulary.has("opacity-1")).toBe(false);
    expect([...vocabulary].some((cls) => cls.includes("width.thin"))).toBe(false);
    expect([...vocabulary].some((cls) => cls.startsWith("opacity-"))).toBe(false);
  });
});

describe("validateClassesAgainstVocabulary", () => {
  const vocabulary = buildTokenVocabulary(catalog);

  it("accetta una classe risolta al vocabolario", () => {
    const result = validateClassesAgainstVocabulary(["bg-feedback-error"], vocabulary);
    expect(result.valid).toBe(true);
    expect(result.invalidClasses).toEqual([]);
  });

  it("rifiuta valore literal con sintassi arbitraria — esempi esatti AC #2", () => {
    for (const literal of ["bg-[#3b82f6]", "p-[7px]"]) {
      const result = validateClassesAgainstVocabulary([literal], vocabulary);
      expect(result.valid).toBe(false);
      expect(result.invalidClasses).toContain(literal);
    }
  });

  it("rifiuta valore literal anche se il vocabolario fosse enorme (indipendenza dal vocabolario)", () => {
    const huge = new Set<string>(["bg-[#3b82f6]", ...vocabulary]);
    const result = validateClassesAgainstVocabulary(["bg-[#3b82f6]"], huge);
    expect(result.valid).toBe(false);
    expect(result.invalidClasses).toEqual(["bg-[#3b82f6]"]);
  });

  it("rifiuta classi con suffisso token per tipi senza namespace v4", () => {
    const result = validateClassesAgainstVocabulary(["border-w-width-thin", "opacity-opacity-1"], vocabulary);
    expect(result.valid).toBe(false);
    expect(result.invalidClasses).toEqual(["border-w-width-thin", "opacity-opacity-1"]);
  });

  it("accetta una classe strutturale whitelisted senza che sia nel vocabolario token", () => {
    expect(vocabulary.has("flex")).toBe(false);
    const result = validateClassesAgainstVocabulary(
      ["flex", "items-center", "inline-flex", "border"],
      vocabulary,
    );
    expect(result.valid).toBe(true);
    expect(result.invalidClasses).toEqual([]);
  });

  it("rifiuta una classe fuori vocabolario nominandola (fail-loud)", () => {
    const result = validateClassesAgainstVocabulary(["bg-totally-made-up"], vocabulary);
    expect(result.valid).toBe(false);
    expect(result.invalidClasses).toEqual(["bg-totally-made-up"]);
  });

  it("separa le classi valide da quelle invalide su una lista mista", () => {
    const result = validateClassesAgainstVocabulary(
      ["flex", "bg-[#3b82f6]", "rounded-full", "items-unknown"],
      vocabulary,
    );
    expect(result.valid).toBe(false);
    expect(result.invalidClasses).toEqual(["bg-[#3b82f6]", "items-unknown"]);
  });
});
