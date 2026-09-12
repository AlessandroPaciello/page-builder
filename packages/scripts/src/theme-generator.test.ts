import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { generateTheme, varName, varSuffix, type TokenCatalog } from "./theme-generator";

const here = dirname(fileURLToPath(import.meta.url));
/**
 * Dal Task 8 della Story 2.4 la fixture `penpot-catalog.json` è la NUOVA
 * library (token semantici shadcn); i test che dipendono dai nomi `mis`
 * leggono la fixture legacy, conservata solo fino alla Story 2.5.
 */
const fixturePath = resolve(here, "__fixtures__/legacy-mis-catalog.json");

function loadFixture(): TokenCatalog {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as TokenCatalog;
}

describe("varSuffix / varName — derivazione dal tipo, non dal set", () => {
  it("deriva lo stesso namespace per tipo indipendentemente dal set di provenienza", () => {
    expect(varName("color.mis.primary", "color")).toBe("color-mis-primary");
    expect(varName("space.1", "spacing")).toBe("spacing-space-1");
    expect(varName("radius.1", "borderRadius")).toBe("radius-1");
  });

  it("deduplica il segmento namespace anche quando il nome token lo ripete esplicitamente", () => {
    expect(varName("spacing.mis.1", "spacing")).toBe("spacing-mis-1");
  });

  it("non collassa in collisione due token con lo stesso indice in set diversi", () => {
    expect(varName("gray.1", "color")).toBe("color-gray-1");
    expect(varName("accent.1", "color")).toBe("color-accent-1");
    expect(varName("gray.1", "color")).not.toBe(varName("accent.1", "color"));
  });

  it("preserva per intero i nomi che non ripetono il namespace del tipo", () => {
    expect(varSuffix("letter-spacing.1", "letterSpacing")).toBe("letter-spacing-1");
    expect(varSuffix("fontSize.mis.sm", "fontSizes")).toBe("font-size-mis-sm");
  });
});

describe("generateTheme — mapping puro contro la fixture committata", () => {
  it("produce marker @generated in entrambi i file con riferimento al comando di rigenerazione", () => {
    const { css, ts } = generateTheme(loadFixture());
    expect(css).toContain("@generated");
    expect(css).toContain("pnpm --filter @penpot-ds/scripts generate:theme");
    expect(ts).toContain("@generated");
    expect(ts).toContain("pnpm --filter @penpot-ds/scripts generate:theme");
  });

  it("raggruppa il CSS per set Penpot, in ordine di catalogo", () => {
    const { css } = generateTheme(loadFixture());
    const setComments = [...css.matchAll(/\/\* set: (.+?) \*\//g)].map((m) => m[1]);
    expect(setComments).toEqual([
      "radix.space",
      "radix.radius",
      "radix.color",
      "radix.typography",
      "mis.color",
      "mis.typography",
      "mis.radius",
      "feedback.color",
      "border.width",
      "mis.shadow",
    ]);
  });

  it("risolve i riferimenti {token.name} in var(--...), preservando l'indirection invece di appiattire il valore", () => {
    const { css } = generateTheme(loadFixture());
    expect(css).toContain("--color-mis-border: var(--color-gray-8);");
    expect(css).toContain("--color-mis-primary: var(--color-accent-9);");
  });

  it("preserva l'alpha delle shadow (bug noto: resolvedValue di Penpot la perde, per questo si usa il value grezzo)", () => {
    const { css } = generateTheme(loadFixture());
    expect(css).toContain("--shadow-mis-raised: 0px 1px 3px 0px rgba(26,28,28,0.12);");
  });

  it("formatta font-family multi-parola tra virgolette", () => {
    const { css } = generateTheme(loadFixture());
    expect(css).toContain('--font-mis-serif: "Noto Serif";');
    expect(css).toContain("--font-mis-sans: Manrope;");
  });

  it("genera scala/options/map spacing e radii per i field select Puck", () => {
    const { ts } = generateTheme(loadFixture());
    expect(ts).toContain("export const spacing = {");
    expect(ts).toContain('"space-1": 4,');
    expect(ts).toContain("export const spacingOptions = [");
    expect(ts).toContain('{ label: "space.1", value: "space-1" },');
    expect(ts).toContain("export const spacingMap = {");
    expect(ts).toContain('"space-1": "var(--spacing-space-1)",');
    expect(ts).toContain("export const radii = {");
    expect(ts).toContain('"mis-pill": 11,');
    expect(ts).toContain('"full": 9999,');
  });

  it("è idempotente: la stessa fixture produce output identico byte per byte, senza timestamp di generazione", () => {
    const catalog = loadFixture();
    const first = generateTheme(catalog);
    const second = generateTheme(catalog);
    expect(second.css).toBe(first.css);
    expect(second.ts).toBe(first.ts);
  });

  it("AC #2 — un nuovo set produce una nuova sezione CSS senza alcuna modifica a theme-generator.ts", () => {
    const catalog: TokenCatalog = {
      sets: [
        { name: "set.a", tokens: [{ name: "color.a.one", type: "color", value: "#111111" }] },
      ],
    };
    const before = generateTheme(catalog);
    expect(before.css).toContain("/* set: set.a */");
    expect(before.css).not.toContain("set.b");

    const catalogWithNewSet: TokenCatalog = {
      sets: [
        ...catalog.sets,
        { name: "set.b", tokens: [{ name: "color.b.two", type: "color", value: "#222222" }] },
      ],
    };
    const after = generateTheme(catalogWithNewSet);
    expect(after.css).toContain("/* set: set.a */");
    expect(after.css).toContain("/* set: set.b */");
    expect(after.css).toContain("--color-b-two: #222222;");
  });

  it("fallisce esplicitamente su un riferimento non risolvibile — mai un valore inventato", () => {
    const catalog: TokenCatalog = {
      sets: [{ name: "set.a", tokens: [{ name: "color.a.broken", type: "color", value: "{does.not.exist}" }] }],
    };
    expect(() => generateTheme(catalog)).toThrow(/does\.not\.exist/);
  });

  it("fallisce esplicitamente su un valore non numerico per un tipo dimensionale — nessuna unità indovinata", () => {
    const catalog: TokenCatalog = {
      sets: [{ name: "set.a", tokens: [{ name: "space.broken", type: "spacing", value: "auto" }] }],
    };
    expect(() => generateTheme(catalog)).toThrow(/non numerico/);
  });

  it("fallisce esplicitamente su una collisione di nome variabile fra token diversi", () => {
    const catalog: TokenCatalog = {
      sets: [
        {
          name: "set.a",
          tokens: [
            { name: "color.dup", type: "color", value: "#111111" },
            { name: "dup", type: "color", value: "#222222" },
          ],
        },
      ],
    };
    expect(() => generateTheme(catalog)).toThrow(/[Cc]ollision|[Cc]ollisione/);
  });
});

describe("generateTheme — guardie fail-loud (review 2.1)", () => {
  it("emette @theme static: le var sono consumate da var() inline e mappe TS, non tracciabili dallo scanner Tailwind — senza static il tree-shaking le eliminerebbe dai build di produzione", () => {
    const { css } = generateTheme(loadFixture());
    expect(css).toContain("@theme static {");
  });

  it("fallisce esplicitamente su un riferimento circolare (self e mutuo) invece di esaurire lo stack", () => {
    const selfRef: TokenCatalog = {
      sets: [{ name: "set.a", tokens: [{ name: "space.self", type: "spacing", value: "{space.self}" }] }],
    };
    expect(() => generateTheme(selfRef)).toThrow(/circolare/);

    const mutual: TokenCatalog = {
      sets: [
        {
          name: "set.a",
          tokens: [
            { name: "radius.a", type: "borderRadius", value: "{radius.b}" },
            { name: "radius.b", type: "borderRadius", value: "{radius.a}" },
          ],
        },
      ],
    };
    expect(() => generateTheme(mutual)).toThrow(/circolare/);
  });

  it("rifiuta un riferimento cross-type fuori dal gruppo numerico, e lo ammette dentro", () => {
    const illegal: TokenCatalog = {
      sets: [{ name: "set.a", tokens: [{ name: "color.wrong", type: "color", value: "{space.1}" }, { name: "space.1", type: "spacing", value: "4" }] }],
    };
    expect(() => generateTheme(illegal)).toThrow(/cross-type/);

    const legal: TokenCatalog = {
      sets: [
        {
          name: "set.a",
          tokens: [
            { name: "radius.fromSpacing", type: "borderRadius", value: "{space.1}" },
            { name: "space.1", type: "spacing", value: "4" },
          ],
        },
      ],
    };
    const { css } = generateTheme(legal);
    expect(css).toContain("--radius-from-spacing: var(--spacing-space-1);");
  });

  it("letterSpacing: rifiuta i bare number (px vs em ambiguo, mai indovinato) e accetta le unità esplicite", () => {
    const bare: TokenCatalog = {
      sets: [{ name: "set.a", tokens: [{ name: "letterSpacing.mis.tight", type: "letterSpacing", value: "0.5" }] }],
    };
    expect(() => generateTheme(bare)).toThrow(/unità esplicita/);

    const explicit: TokenCatalog = {
      sets: [
        {
          name: "set.a",
          tokens: [
            { name: "letterSpacing.mis.tight", type: "letterSpacing", value: "0.5px" },
            { name: "letter-spacing.1", type: "letterSpacing", value: "0.0025em" },
          ],
        },
      ],
    };
    const { css } = generateTheme(explicit);
    expect(css).toContain("--tracking-letter-spacing-mis-tight: 0.5px;");
    expect(css).toContain("--tracking-letter-spacing-1: 0.0025em;");
  });

  it("fallisce esplicitamente su un tipo token non gestito, senza TypeError grezzo", () => {
    const catalog = {
      sets: [{ name: "set.a", tokens: [{ name: "typography.mis.body", type: "typography", value: "{}" }] }],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(catalog)).toThrow(/Type token non gestito/);
  });

  it("fallisce esplicitamente su un value non-array per fontFamilies e shadow", () => {
    const stringFamily = {
      sets: [{ name: "set.a", tokens: [{ name: "font.mis.sans", type: "fontFamilies", value: "Manrope" }] }],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(stringFamily)).toThrow(/non è una lista/);

    const singleShadow = {
      sets: [
        {
          name: "set.a",
          tokens: [
            {
              name: "shadow.mis.one",
              type: "shadow",
              value: { offsetX: "0", offsetY: "1", blur: "3", spread: "0", color: "#000000", inset: false },
            },
          ],
        },
      ],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(singleShadow)).toThrow(/non è una lista/);
  });

  it("fallisce esplicitamente su un layer shadow senza color o con inset non booleano", () => {
    const noColor = {
      sets: [
        {
          name: "set.a",
          tokens: [
            {
              name: "shadow.mis.nocolor",
              type: "shadow",
              value: [{ offsetX: "0", offsetY: "1", blur: "3", spread: "0", inset: false }],
            },
          ],
        },
      ],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(noColor)).toThrow(/"color"/);

    const stringInset = {
      sets: [
        {
          name: "set.a",
          tokens: [
            {
              name: "shadow.mis.strinset",
              type: "shadow",
              value: [{ offsetX: "0", offsetY: "1", blur: "3", spread: "0", color: "#000000", inset: "false" }],
            },
          ],
        },
      ],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(stringInset)).toThrow(/non booleano/);
  });

  it("fallisce esplicitamente su un valore non scalare (null/numero) per color — mai 'null' emesso nel CSS", () => {
    const nullColor = {
      sets: [{ name: "set.a", tokens: [{ name: "color.null", type: "color", value: null }] }],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(nullColor)).toThrow(/non scalare/);
  });

  it("fallisce esplicitamente su un nome token fuori charset — romperebbe il CSS/TS generato", () => {
    const quoted = {
      sets: [{ name: "set.a", tokens: [{ name: 'color.a"b', type: "color", value: "#111111" }] }],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(quoted)).toThrow(/caratteri non consentiti/);
  });

  it("fallisce esplicitamente su liste vuote per fontFamilies e shadow — dichiarazione CSS vuota vietata", () => {
    const emptyFamilies = {
      sets: [{ name: "set.a", tokens: [{ name: "font.mis.empty", type: "fontFamilies", value: [] }] }],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(emptyFamilies)).toThrow(/lista vuota/);

    const emptyShadow = {
      sets: [{ name: "set.a", tokens: [{ name: "shadow.mis.empty", type: "shadow", value: [] }] }],
    } as unknown as TokenCatalog;
    expect(() => generateTheme(emptyShadow)).toThrow(/non ha layer/);
  });

  it("drift guard: i file generati committati coincidono byte per byte con la rigenerazione dalla fixture", () => {
    // I file generati committati provengono dalla fixture CORRENTE
    // (penpot-catalog.json, la nuova library dal Task 8 della Story 2.4),
    // non dalla legacy usata dagli altri test.
    const currentFixturePath = resolve(here, "__fixtures__/penpot-catalog.json");
    const { css, ts } = generateTheme(JSON.parse(readFileSync(currentFixturePath, "utf8")) as TokenCatalog);
    const committedCss = readFileSync(resolve(here, "../../tokens/src/tailwind-theme.css"), "utf8");
    const committedTs = readFileSync(resolve(here, "../../tokens/src/tokens.generated.ts"), "utf8");
    expect(css).toBe(committedCss);
    expect(ts).toBe(committedTs);
  });
});
