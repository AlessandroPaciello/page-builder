import { describe, expect, it } from "vitest";

import { componentPaths, generateComponent, verifyComponent, type Change, type Finding, type GenerateInput } from "../../src/core";
import { layer } from "../fixtures/components";
import { carouselLettura, carouselRoot, carouselSenzaVarianti, SECTION_INPUT, slide } from "../fixtures/sections";

/**
 * Livello 1 della CI (Story 2.27): verifica e generazione di una sezione con
 * `Lettura` scritte a mano. Una prova per ogni riga della matrice della spec.
 */

const input: GenerateInput = { ...SECTION_INPUT, contracts: {}, generated: [] };

const domandaDi = (findings: readonly Finding[], key: string) =>
  findings.find((finding) => finding.level === "domanda" && finding.key === key);

const contentOf = (changes: readonly Change[], suffix: string): string => {
  const change = changes.find((candidate) => candidate.path.endsWith(suffix));
  if (change === undefined || change.action === "elimina") throw new Error(`nessun Change con contenuto per ${suffix}`);
  return change.content;
};

describe("sezioni — matrice della spec", () => {
  it("field structure come asse: perView in variants, una story per cella, nessun finding", () => {
    const lettura = carouselLettura();
    expect(verifyComponent(lettura, input)).toEqual([]);
    const result = generateComponent(lettura, input);
    expect(result.findings).toEqual([]);
    const paths = componentPaths("carousel");
    const styles = contentOf(result.changes, "Carousel.styles.ts");
    expect(styles).toContain("perView");
    expect(styles).toContain('defaultVariants: { perView: "3" }');
    const stories = contentOf(result.changes, "Carousel.stories.tsx");
    expect(stories.match(/^export const \w+: Story/gm)).toHaveLength(3);
    expect(result.changes.map((change) => change.path)).toEqual(expect.arrayContaining([paths.styles, paths.stories, paths.tsx]));
  });

  it("field structure irrisolto: domanda asse, nessun Change", () => {
    const result = generateComponent(carouselSenzaVarianti(), input);
    const domanda = domandaDi(result.findings, "asse");
    expect(domanda).toMatchObject({ level: "domanda", options: ["asse", "content"] });
    expect(domanda?.message).toContain("perView");
    expect(result.changes).toEqual([]);
  });

  it("slot riconosciuto: parte slides, figli non parti, {children} e figli di default nella story", () => {
    const result = generateComponent(carouselLettura(), input);
    expect(result.findings).toEqual([]);
    const styles = contentOf(result.changes, "Carousel.styles.ts");
    expect(styles).toContain("slides");
    expect(styles).not.toMatch(/slide-?[123]/i);
    expect(domandaDi(verifyComponent(carouselLettura(), input), "part")).toBeUndefined();
    const scaffold = contentOf(result.changes, "Carousel.tsx");
    expect(scaffold).toContain('data-slot="slides"');
    expect(scaffold).toContain("{children}");
    const stories = contentOf(result.changes, "Carousel.stories.tsx");
    expect(stories).toContain("../product-card/ProductCard");
    expect(stories.match(/<ProductCard /g)).toHaveLength(9); // 3 figli di default in ciascuna delle 3 story
    expect(stories).toContain("children:");
  });

  it("slot ambiguo: domanda slot con i due id, nessun Change", () => {
    const due = {
      carousel: {
        ...input.sections!.carousel!,
        slots: [
          { id: "slides", allow: ["product-card"] },
          { id: "thumbs", allow: ["product-card"] },
        ],
      },
    } as unknown as NonNullable<GenerateInput["sections"]>;
    const lettura = carouselLettura();
    const result = generateComponent(lettura, { ...input, sections: due });
    const domanda = domandaDi(result.findings, "slot");
    expect(domanda).toMatchObject({ level: "domanda", options: ["slides", "thumbs"] });
    expect(result.changes).toEqual([]);
  });

  it("slot dichiarato sconosciuto: blocco", () => {
    const root = carouselRoot("3");
    const rotto = layer({ name: "Slides", kind: "board", pluginData: { slot: "inesistente" }, children: [slide(1)] });
    const lettura = carouselLettura([
      { variant: { perView: "3" }, root: { ...root, children: [rotto] } },
      { variant: { perView: "1" }, root: { ...root, children: [rotto] } },
      { variant: { perView: "2" }, root: { ...root, children: [rotto] } },
    ]);
    const findings = verifyComponent(lettura, input);
    expect(findings.some((finding) => finding.level === "blocco" && finding.message.includes("inesistente"))).toBe(true);
  });

  it("forma disegnata: con part ha cva e data-slot, senza part la domanda ignora", () => {
    const withPart = (pluginData?: Record<string, string>) =>
      carouselLettura(
        (["1", "2", "3"] as const).map((perView) => ({
          variant: { perView },
          root: carouselRoot(perView, [layer({ name: "Freccia", kind: "path", pluginData })]),
        })),
      );
    const chiave = generateComponent(withPart({ part: "previous-icon" }), input);
    expect(chiave.findings.filter((finding) => finding.level !== "avviso")).toEqual([]);
    expect(contentOf(chiave.changes, "Carousel.styles.ts")).toContain("previous-icon");
    expect(contentOf(chiave.changes, "Carousel.tsx")).toContain('data-slot="previous-icon"');

    const senza = generateComponent(withPart(), input);
    const domanda = domandaDi(senza.findings, "part");
    expect(domanda).toMatchObject({ level: "domanda", options: ["freccia", "ignora"] });
    expect(senza.changes).toEqual([]);
  });

  it("deterministico: due generazioni identiche byte per byte", () => {
    expect(generateComponent(carouselLettura(), input)).toEqual(generateComponent(carouselLettura(), input));
  });
});
