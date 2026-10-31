import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tokensFromCss } from "./tokens-from-css";
import { PATHS } from "./paths";

/**
 * `tokens_from_css` (Story 2.26): port puro dello spike `css-to-tokens.mjs`.
 * Il default di Tailwind è letto dal pacchetto installato (come fa il server);
 * il seme dello spike sta in `tests/fixtures/seed-theme.css`.
 */

const require = createRequire(import.meta.url);
const tailwindDefault = readFileSync(require.resolve("tailwindcss/theme.css"), "utf8");
const seed = readFileSync(join(PATHS.packageRoot, "tests/fixtures/seed-theme.css"), "utf8");

function findSet(result: ReturnType<typeof tokensFromCss>, name: string) {
  return result.sets.find((set) => set.name === name);
}

describe("tokens_from_css — il seme dello spike (AC 1)", () => {
  it("produce i set tailwind, semantic e brand/ocean, e i temi brand/default e brand/ocean", () => {
    const result = tokensFromCss(tailwindDefault, seed);
    expect(result.sets.map((set) => set.name)).toEqual(["tailwind", "semantic", "brand/ocean"]);
    expect(result.themes).toEqual([
      { group: "brand", name: "default", sets: [] },
      { group: "brand", name: "ocean", sets: ["brand/ocean"] },
    ]);
  });

  it("i ruoli shadcn diventano riferimenti alla palette, le primitive restano valori", () => {
    const result = tokensFromCss(tailwindDefault, seed);
    const semantic = findSet(result, "semantic")!;
    const primary = semantic.tokens.find((token) => token.name === "color.primary")!;
    expect(primary.value).toBe("{neutral.900}");

    const tailwind = findSet(result, "tailwind")!;
    const red600 = tailwind.tokens.find((token) => token.name === "red.600")!;
    expect(red600.value).toBe("#E7000B");
  });

  it("il set di variante contiene solo i ruoli sovrascritti, come riferimenti", () => {
    const result = tokensFromCss(tailwindDefault, seed);
    const ocean = findSet(result, "brand/ocean")!;
    expect(ocean.tokens.map((token) => token.name)).toEqual(["color.primary", "color.primary-foreground", "color.ring"]);
    expect(ocean.tokens[0]!.value).toBe("{blue.600}");
  });

  it("emette avvisi per quanto saltato o modificato (spread negativi, colori clampati, variabili senza tipo)", () => {
    const result = tokensFromCss(tailwindDefault, seed);
    expect(result.warnings.length).toBeGreaterThan(0);
    // Il default di Tailwind ha spread negativi nelle ombre (shadow-sm/md/lg/xl/2xl).
    expect(result.warnings.some((warning) => warning.why.includes("spread negativo"))).toBe(true);
    // Molti oklch del default sono fuori sRGB (es. i rossi saturi).
    expect(result.warnings.some((warning) => warning.why.includes("fuori sRGB"))).toBe(true);
    // Variabili senza tipo di token (breakpoint, container, leading, …).
    expect(result.warnings.some((warning) => warning.why.includes("nessun tipo di token"))).toBe(true);
  });
});

describe("tokens_from_css — perdite esplicite", () => {
  it("uno spread negativo diventa 0 con un avviso che nomina la variabile", () => {
    const result = tokensFromCss("@theme {\n  --shadow-sm: 0 1px 2px -1px rgb(0 0 0 / 0.1);\n}\n", "");
    const shadow = findSet(result, "tailwind")!.tokens.find((token) => token.name === "shadow.sm")!;
    expect(shadow.value).toEqual([{ offsetX: "0", offsetY: "1", blur: "2", spread: "0", color: "rgba(0,0,0,0.1)", inset: false }]);
    expect(result.warnings.some((warning) => warning.var === "--shadow-sm" && warning.why.includes("spread negativo"))).toBe(true);
  });

  it("un colore oklch fuori sRGB va al più vicino in hex con un avviso", () => {
    const result = tokensFromCss("@theme {\n  --color-sat: oklch(80% 0.35 25);\n}\n", "");
    const color = findSet(result, "tailwind")!.tokens.find((token) => token.name === "sat")!;
    expect(color.value).toMatch(/^#[0-9A-F]{6}$/);
    expect(result.warnings.some((warning) => warning.var === "--color-sat" && warning.why.includes("fuori sRGB"))).toBe(true);
  });

  it("una variabile che non ha un tipo di token viene saltata con un avviso", () => {
    const result = tokensFromCss("@theme {\n  --breakpoint-sm: 40rem;\n}\n", "");
    expect(result.sets.flatMap((set) => set.tokens)).toEqual([]);
    expect(result.warnings.some((warning) => warning.var === "--breakpoint-sm")).toBe(true);
  });

  it("una variante che sovrascrive un ruolo assente dalla base produce un avviso", () => {
    const result = tokensFromCss(
      '@theme {\n  --color-blue-600: oklch(54.6% 0.245 262.881);\n  --color-primary: var(--color-blue-600);\n}\n[data-brand="ocean"] {\n  --color-nuovo: var(--color-blue-600);\n}\n',
      "",
    );
    expect(result.warnings.some((warning) => warning.var === "brand/ocean --color-nuovo" && warning.why.includes("ruolo che il tema di default non definisce"))).toBe(true);
  });

  it("fontFamilies di sistema o generici non diventano un token importabile", () => {
    const result = tokensFromCss('@theme {\n  --font-serif: ui-serif, Georgia, serif;\n  --font-sans: "Inter", sans-serif;\n}\n', "");
    const families = findSet(result, "tailwind")!.tokens.filter((token) => token.type === "fontFamilies");
    expect(families.map((token) => token.name)).toEqual(["font.sans"]);
  });
});
