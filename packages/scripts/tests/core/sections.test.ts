import { describe, expect, it } from "vitest";

import { componentPaths, generateComponent, verifyComponent, type Change, type Finding, type GenerateInput, type LetturaLayer } from "../../src/core";
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
    expect(stories).toContain("../shop-card/ShopCard");
    expect(stories.match(/<ShopCard /g)).toHaveLength(9); // 3 figli di default in ciascuna delle 3 story
    expect(stories).toContain("children:");
  });

  it("slot ambiguo: domanda slot con i due id, nessun Change", () => {
    const due = {
      carousel: {
        ...input.sections!.carousel!,
        slots: [
          { id: "slides", allow: ["shop-card"] },
          { id: "thumbs", allow: ["shop-card"] },
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

/**
 * Matrice della Story 2.33: una prova per riga. `when` è un attributo della
 * parte (validato contro i field del contratto) e la risposta `content` alla
 * domanda `asse` sta nei plugin data del container, una chiave per field.
 */
describe("sezioni — rendering condizionale e risposta content (Story 2.33)", () => {
  const part = (when: string, extra: Record<string, string> = {}) =>
    layer({ name: "Offerta", kind: "text", pluginData: { part: "offer", when, ...extra } });

  const inEveryCell = (nodes: readonly LetturaLayer[]) =>
    (["1", "2", "3"] as const).map((perView) => ({ variant: { perView }, root: carouselRoot(perView, nodes) }));

  it("when valido: lo scaffold avvolge la parte in {field ? (…) : null}", () => {
    const lettura = carouselLettura(inEveryCell([part("label")]));
    expect(verifyComponent(lettura, input)).toEqual([]);
    const result = generateComponent(lettura, input);
    expect(result.findings).toEqual([]);
    const scaffold = contentOf(result.changes, "Carousel.tsx");
    expect(scaffold).toContain("{label ? (");
    expect(scaffold).toContain(") : null}");
    expect(scaffold).toMatch(/\{label \? \(\n\s+<span data-slot="offer"[^\n]*\n\s+\) : null\}/);
  });

  it("when su lista: il ternario sta fuori dall'Array.from", () => {
    const lettura = carouselLettura(inEveryCell([part("label", { repeat: "lista" }), part("label", { repeat: "lista" })]));
    const result = generateComponent(lettura, input);
    expect(result.findings).toEqual([]);
    const scaffold = contentOf(result.changes, "Carousel.tsx");
    expect(scaffold).toMatch(/\{label \? \(\n\s+\{Array\.from\(/);
  });

  it("when sconosciuto o asse: blocco con l'elenco dei field, nessun Change", () => {
    const sconosciuto = generateComponent(carouselLettura(inEveryCell([part("nope")])), input);
    expect(sconosciuto.findings).toContainEqual(
      expect.objectContaining({ level: "blocco", where: 'parte "offer"', message: expect.stringContaining('when="nope"') }),
    );
    expect(sconosciuto.findings.find((finding) => finding.level === "blocco")?.message).toContain("[autoplay, interval, label]");
    expect(sconosciuto.changes).toEqual([]);

    const asse = generateComponent(carouselLettura(inEveryCell([part("perView")])), input);
    expect(asse.findings).toContainEqual(expect.objectContaining({ level: "blocco", message: expect.stringContaining('when="perView"') }));
    expect(asse.changes).toEqual([]);
  });

  it("when diverso tra celle: blocco, nessun Change", () => {
    const lettura = carouselLettura([
      { variant: { perView: "1" }, root: carouselRoot("1", [part("label")]) },
      { variant: { perView: "2" }, root: carouselRoot("2", [part("interval")]) },
      { variant: { perView: "3" }, root: carouselRoot("3", [part("label")]) },
    ]);
    const result = generateComponent(lettura, input);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        level: "blocco",
        where: 'cella perView=2 › layer "Offerta"',
        message: expect.stringContaining('when="label"'),
      }),
    );
    expect(result.changes).toEqual([]);
  });

  it("when presente in una cella e assente in un'altra: blocco, nessun Change", () => {
    const senza = layer({ name: "Offerta", kind: "text", pluginData: { part: "offer" } });
    const conWhen = part("label");
    for (const celle of [
      [conWhen, senza, senza],
      [senza, conWhen, conWhen],
    ]) {
      const lettura = carouselLettura(
        (["1", "2", "3"] as const).map((perView, i) => ({ variant: { perView }, root: carouselRoot(perView, [celle[i]!]) })),
      );
      const result = generateComponent(lettura, input);
      expect(result.findings).toContainEqual(expect.objectContaining({ level: "blocco", message: expect.stringContaining("nessun when") }));
      expect(result.changes).toEqual([]);
    }
  });

  it("when sulla radice: blocco, nessun Change", () => {
    const lettura = carouselLettura(
      (["1", "2", "3"] as const).map((perView) => ({
        variant: { perView },
        root: { ...carouselRoot(perView), pluginData: { when: "label" } },
      })),
    );
    const result = generateComponent(lettura, input);
    const blocchi = result.findings.filter((finding) => finding.level === "blocco" && finding.message.includes('La radice ha when="label"'));
    expect(blocchi.length).toBeGreaterThan(0);
    expect(result.changes).toEqual([]);
  });

  it("risposta content: la domanda asse si chiude, perView resta un field (e when può nominarlo)", () => {
    const lettura = {
      ...carouselSenzaVarianti(),
      pluginData: { contract: "carousel@1", "asse.perView": "content" },
      cells: [{ variant: {}, root: carouselRoot("3", [part("perView")]) }],
    };
    const result = generateComponent(lettura, input);
    expect(domandaDi(result.findings, "asse")).toBeUndefined();
    expect(result.findings).toEqual([]);
    const styles = contentOf(result.changes, "Carousel.styles.ts");
    expect(styles).not.toContain("perView: {");
    expect(styles).toContain("export type CarouselAxes = Record<never, never>;");
    const scaffold = contentOf(result.changes, "Carousel.tsx");
    expect(scaffold).toContain('readonly perView?: "1" | "2" | "3";');
    expect(scaffold).toContain("perView,");
    expect(scaffold).toContain("{perView ? (");
  });

  it("risposta non valida (valore fuori dalle opzioni, field non structure, field inesistente): blocco", () => {
    const answers: readonly Readonly<Record<string, string>>[] = [{ "asse.perView": "boh" }, { "asse.autoplay": "content" }, { "asse.nope": "content" }];
    for (const answer of answers) {
      const lettura = { ...carouselSenzaVarianti(), pluginData: { contract: "carousel@1", ...answer } };
      const result = generateComponent(lettura, input);
      expect(result.findings.some((finding) => finding.level === "blocco")).toBe(true);
      expect(result.changes).toEqual([]);
    }
  });

  it("content su un field disegnato: vince il disegno (asse) con un avviso", () => {
    const lettura = { ...carouselLettura(), pluginData: { contract: "carousel@1", "asse.perView": "content" } };
    const result = generateComponent(lettura, input);
    expect(result.findings).toEqual([
      expect.objectContaining({ level: "avviso", where: 'sezione "carousel" › field "perView"', message: expect.stringContaining("vince il disegno") }),
    ]);
    expect(contentOf(result.changes, "Carousel.styles.ts")).toContain('defaultVariants: { perView: "3" }');
  });

  it("nessuna risposta: la domanda asse c'è ancora, invariata", () => {
    const result = generateComponent(carouselSenzaVarianti(), input);
    expect(result.findings).toEqual([
      expect.objectContaining({ level: "domanda", key: "asse", where: 'sezione "carousel" › field "perView"', options: ["asse", "content"] }),
    ]);
    expect(result.changes).toEqual([]);
  });
});
