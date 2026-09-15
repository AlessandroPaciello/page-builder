import type { PenpotTokenValue, TokenType } from "../shared/theme-generator";
import { committedDesigns } from "./designs-loader";
import type { ComponentDesign } from "./library-plan";

/**
 * Specifica della library, come dati (Story 2.4, Task 2): l'elenco minimo dei
 * token semantici richiesti, in stile shadcn (principio guida di
 * penpot-pipeline.md), con il nome Penpot e il tipo. I nomi sono scelti
 * perché `varSuffix()` (theme-generator.ts, Stadio 1) produca variabili
 * pulite senza toccare il generatore: `color.primary` → `--color-primary`,
 * `text.sm` → `--text-sm`, `font.sans` → `--font-sans`,
 * `shadow.ring` → `--shadow-ring`, `opacity.disabled` → `--opacity-disabled`.
 */

/** Un token richiesto dalla spec: nome Penpot + tipo Penpot. */
export interface RequiredToken {
  readonly name: string;
  readonly type: TokenType;
}

/**
 * Coppia di contrasto dichiarata dalla spec (vincolo non negoziabile di
 * design-system.md, reso meccanico da `verifyLibrary`): `foreground` su
 * `background` ≥ `minRatio` (4.5 testo, 3 indicatori). I nomi sono nomi
 * token Penpot della spec, risolti attraverso i riferimenti `{...}`.
 */
export interface ContrastPair {
  readonly foreground: string;
  readonly background: string;
  readonly minRatio: 4.5 | 3;
  /**
   * La coppia vale SOLO come fill+foreground: il testo di quel colore su
   * background resta fuori dalle coppie (caso `warning`, 4.44:1 come testo).
   */
  readonly fillPairOnly?: boolean;
}

export interface LibrarySpec {
  readonly tokens: readonly RequiredToken[];
  readonly contrastPairs: readonly ContrastPair[];
}

const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
] as const;

/** Coppie X / X-foreground del catalogo semantico (tutte ≥ 4.5:1). */
const FOREGROUND_PAIRS: readonly [string, string][] = [
  ["color.foreground", "color.background"],
  ["color.card-foreground", "color.card"],
  ["color.popover-foreground", "color.popover"],
  ["color.primary-foreground", "color.primary"],
  ["color.secondary-foreground", "color.secondary"],
  ["color.muted-foreground", "color.muted"],
  ["color.accent-foreground", "color.accent"],
  ["color.destructive-foreground", "color.destructive"],
  ["color.success-foreground", "color.success"],
  ["color.info-foreground", "color.info"],
];

/** Sfondo di ripiego quando nessun antenato board ha un `fill`: la pagina. */
const PAGE_BACKGROUND = "color.background";

/**
 * Coppie di contrasto RICAVATE dai design (Story 2.7, problema 6), al posto
 * della lista a mano delle combinazioni usate dai design. Per ogni cella:
 * - parte `text` con `fill` → quel colore contro il `fill` del primo antenato
 *   board che lo ha nella stessa cella (ripiego `color.background`), 4.5:1;
 * - parte con `strokeColor` → quel colore contro il `fill` del primo antenato
 *   board che lo ha (ripiego `color.background`), 3:1 (indicatore/bordo).
 * La catena degli antenati segue `parent` (assente = figlia di `root`);
 * `root` non ha antenati. Coppie deduplicate su foreground+background
 * tenendo la soglia più alta, ordinate per foreground, background, soglia.
 */
export function deriveDesignContrastPairs(designs: Readonly<Record<string, ComponentDesign>>): ContrastPair[] {
  const byPair = new Map<string, ContrastPair>();
  const add = (foreground: string, background: string, minRatio: 4.5 | 3): void => {
    const key = `${foreground}|${background}`;
    const existing = byPair.get(key);
    if (existing === undefined || existing.minRatio < minRatio) byPair.set(key, { foreground, background, minRatio });
  };

  for (const name of Object.keys(designs).sort()) {
    const design = designs[name]!;
    const parentOf = (part: string): string | null => (part === "root" ? null : (design.parts[part]?.parent ?? "root"));

    for (const cellKey of Object.keys(design.cells).sort()) {
      const cell = design.cells[cellKey]!;
      const backgroundFor = (part: string): string => {
        const seen = new Set<string>([part]);
        for (let ancestor = parentOf(part); ancestor !== null; ancestor = parentOf(ancestor)) {
          if (seen.has(ancestor)) {
            throw new Error(`Design "${name}": la catena dei parent della parte "${part}" è ciclica (${[...seen, ancestor].join(" → ")}).`);
          }
          seen.add(ancestor);
          const fill = design.parts[ancestor]?.kind === "board" ? cell[ancestor]?.fill : undefined;
          if (fill !== undefined) return fill;
        }
        return PAGE_BACKGROUND;
      };

      for (const part of Object.keys(cell).sort()) {
        const styles = cell[part]!;
        if (design.parts[part]?.kind === "text" && styles.fill !== undefined) add(styles.fill, backgroundFor(part), 4.5);
        if (styles.strokeColor !== undefined) add(styles.strokeColor, backgroundFor(part), 3);
      }
    }
  }

  // Confronto per code point, non `localeCompare`: l'ordine non dipende dalla locale ICU.
  const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return [...byPair.values()].sort(
    (a, b) =>
      byCodePoint(a.foreground, b.foreground) || byCodePoint(a.background, b.background) || a.minRatio - b.minRatio,
  );
}

const COLOR: TokenType = "color";
const RADIUS: TokenType = "borderRadius";
const SPACING: TokenType = "spacing";
const FONT_SIZES: TokenType = "fontSizes";
const FONT_WEIGHTS: TokenType = "fontWeights";
const FONT_FAMILIES: TokenType = "fontFamilies";
const LETTER_SPACING: TokenType = "letterSpacing";
const BORDER_WIDTH: TokenType = "borderWidth";
const OPACITY: TokenType = "opacity";
const SHADOW: TokenType = "shadow";

/**
 * Coppie del catalogo, indipendenti dai design: X/X-foreground, warning come
 * fill+foreground, bordi e ring sulla pagina.
 */
const CATALOG_PAIRS: readonly ContrastPair[] = [
  ...FOREGROUND_PAIRS.map(([foreground, background]) => ({ foreground, background, minRatio: 4.5 as const })),
  {
    foreground: "color.warning-foreground",
    background: "color.warning",
    minRatio: 4.5,
    fillPairOnly: true,
  },
  { foreground: "color.border", background: "color.background", minRatio: 3 },
  { foreground: "color.input", background: "color.background", minRatio: 3 },
  { foreground: "color.ring", background: "color.background", minRatio: 3 },
  /**
   * Focus ring dell'AccordionItem (su `color.card`): viene dalle classi
   * strutturali `focus-visible:ring-ring` del binding shadcn, non da un
   * design — nessun design lega `color.ring` dentro una board `card`, quindi
   * la derivazione non può ricavarla. Resta qui finché il design non la
   * esprime (Story 2.7 parte A, da decidere con Alessandro).
   */
  { foreground: "color.ring", background: "color.card", minRatio: 3 },
];

/**
 * Coppie del catalogo + coppie ricavate dai design. Una coppia ricavata già
 * presidiata dal catalogo con soglia uguale o più alta non si ripete.
 */
export function buildContrastPairs(designs: Readonly<Record<string, ComponentDesign>>): ContrastPair[] {
  const covered = (pair: ContrastPair): boolean =>
    CATALOG_PAIRS.some(
      (declared) =>
        declared.foreground === pair.foreground &&
        declared.background === pair.background &&
        !declared.fillPairOnly &&
        declared.minRatio >= pair.minRatio,
    );
  return [...CATALOG_PAIRS, ...deriveDesignContrastPairs(designs).filter((pair) => !covered(pair))];
}

/**
 * La specifica della library: 61 token semantici + le coppie di contrasto
 * (catalogo + ricavate dai design committati).
 * I token feedback (`success`/`warning`/`info` + foreground) servono a
 * LifecycleBadge e ai toast (decisione di Alessandro, 2026-09-12, UX-DR2).
 */
export const LIBRARY_SPEC: LibrarySpec = {
  tokens: [
    ...COLOR_TOKENS.map((name) => ({ name: `color.${name}`, type: COLOR })),
    { name: "radius.sm", type: RADIUS },
    { name: "radius.md", type: RADIUS },
    { name: "radius.lg", type: RADIUS },
    { name: "radius.full", type: RADIUS },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ name: `spacing.${n}`, type: SPACING })),
    { name: "text.xs", type: FONT_SIZES },
    { name: "text.sm", type: FONT_SIZES },
    { name: "text.base", type: FONT_SIZES },
    { name: "text.lg", type: FONT_SIZES },
    { name: "text.xl", type: FONT_SIZES },
    { name: "text.2xl", type: FONT_SIZES },
    { name: "text.3xl", type: FONT_SIZES },
    { name: "font-weight.regular", type: FONT_WEIGHTS },
    { name: "font-weight.medium", type: FONT_WEIGHTS },
    { name: "font-weight.semibold", type: FONT_WEIGHTS },
    { name: "font-weight.bold", type: FONT_WEIGHTS },
    { name: "font.sans", type: FONT_FAMILIES },
    { name: "font.serif", type: FONT_FAMILIES },
    { name: "tracking.none", type: LETTER_SPACING },
    { name: "tracking.tight", type: LETTER_SPACING },
    { name: "tracking.wide", type: LETTER_SPACING },
    { name: "border-width.default", type: BORDER_WIDTH },
    { name: "border-width.thick", type: BORDER_WIDTH },
    { name: "opacity.disabled", type: OPACITY },
    { name: "shadow.sm", type: SHADOW },
    { name: "shadow.md", type: SHADOW },
    { name: "shadow.lg", type: SHADOW },
    { name: "shadow.ring", type: SHADOW },
  ],
  contrastPairs: buildContrastPairs(committedDesigns()),
};

/** Un token del seed di bootstrap: stessa forma del token Penpot da creare. */
export interface SeedToken {
  readonly name: string;
  readonly type: TokenType;
  readonly value: PenpotTokenValue;
}

/**
 * Il seed di bootstrap ha DUE set attivi: `palette` (scale e colori raw, dal
 * catalogo `mis` validato) e `semantic` (token semantici che REFERENZIANO la
 * palette, es. `color.primary = {accent.9}`), così il designer cambia un
 * colore in un punto solo. Il generatore gestisce già i riferimenti tra
 * token dello stesso tipo.
 */
export interface SemanticSeed {
  readonly palette: readonly SeedToken[];
  readonly semantic: readonly SeedToken[];
}
