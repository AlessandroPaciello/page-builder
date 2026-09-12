import type { PenpotTokenValue, TokenType } from "../theme-generator";

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

/**
 * Combinazioni usate DAI DESIGN committati (`designs/*.design.json`) e non
 * coperte dalle coppie X/X-foreground (decisione della review 2.4, 2° pass):
 * placeholder dell'Input e body dell'Accordion su background/card, testo su
 * card, stroke destructive (Input in errore) e ring (focus) su background.
 * Oggi tutte sopra soglia (verificato 2026-09-12: da 5.9:1 a 17.1:1).
 */
const DESIGN_USAGE_PAIRS: readonly ContrastPair[] = [
  { foreground: "color.muted-foreground", background: "color.background", minRatio: 4.5 },
  { foreground: "color.muted-foreground", background: "color.card", minRatio: 4.5 },
  { foreground: "color.foreground", background: "color.card", minRatio: 4.5 },
  { foreground: "color.destructive", background: "color.background", minRatio: 3 },
  { foreground: "color.ring", background: "color.card", minRatio: 3 },
];

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
 * La specifica della library: 61 token semantici + 19 coppie di contrasto.
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
  contrastPairs: [
    ...FOREGROUND_PAIRS.map(([foreground, background]) => ({ foreground, background, minRatio: 4.5 as const })),
    ...DESIGN_USAGE_PAIRS,
    {
      foreground: "color.warning-foreground",
      background: "color.warning",
      minRatio: 4.5,
      fillPairOnly: true,
    },
    { foreground: "color.border", background: "color.background", minRatio: 3 },
    { foreground: "color.input", background: "color.background", minRatio: 3 },
    { foreground: "color.ring", background: "color.background", minRatio: 3 },
  ],
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
