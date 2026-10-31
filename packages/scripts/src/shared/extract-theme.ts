import { withGeneratedCssHeader } from "../core/hash";
import { generateTheme, type PenpotTheme, type PenpotTokenSet, type ThemeCatalog, type TokenCatalog } from "./theme-generator";

/**
 * Port dello spike `extract-themes.ts` (Story 2.26): Penpot (tutti i set + i
 * temi) → `theme.css`, un file per variante (`themes/<gruppo>-<nome>.css`),
 * `fonts.css` e `tokens.generated.ts`, tutti con il marker `@generated` di pds.
 * Nessuna I/O: restituisce i file come dati; è il server che li scrive.
 *
 * Regole (dallo spike):
 * - un gruppo di temi con più di un tema è un asse di varianti; il tema
 *   `default` del gruppo non aggiunge set;
 * - un set che compare solo nei temi non-default di un asse è un set di
 *   variante; tutti gli altri set formano la base (letti anche se non attivi);
 * - la variante è la base con i token sovrascritti per nome, ridotta alle sole
 *   variabili che cambiano, sotto `[data-<gruppo>="<nome>"]`.
 */

export interface ThemeFile {
  /** Relativo a `packages/tokens/src/`. */
  path: string;
  content: string;
}

export interface ExtractThemeResult {
  files: ThemeFile[];
  /** I pacchetti `@fontsource/*` da installare, deduplicati e ordinati. */
  packages: string[];
}

export interface ExtractThemeOptions {
  /** Default: `"fontsource"`. Un altro valore è un rifiuto esplicito. */
  fonts?: "fontsource";
}

/** Le famiglie di sistema o generiche: nessun `@import` in `fonts.css`. */
const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "emoji", "math", "fangsong", "inherit", "initial", "unset"]);

/** Una famiglia che il browser risolve da sé (niente file da scaricare). */
function isSystemOrGeneric(family: string): boolean {
  const f = family.trim().toLowerCase();
  return /^(ui-|system-|-apple)/.test(f) || GENERIC_FAMILIES.has(f);
}

/** "Noto Serif" → "noto-serif": il nome del pacchetto `@fontsource/*`. */
function fontsourceSlug(family: string): string {
  return family.toLowerCase().replace(/\s+/g, "-");
}

/** Gruppo e nome di un tema devono essere un identificatore CSS/CSS-safe (niente spazi, `/` o altri caratteri). */
const THEME_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Le varianti: i temi non-default di un gruppo che ha più di un tema. */
function variantThemes(themes: readonly PenpotTheme[]): PenpotTheme[] {
  const groups = new Map<string, PenpotTheme[]>();
  for (const theme of themes) groups.set(theme.group, [...(groups.get(theme.group) ?? []), theme]);
  return [...groups.values()].filter((group) => group.length > 1).flatMap((group) => group.filter((theme) => theme.name !== "default"));
}

/**
 * I nomi dei set usati SOLO dalle varianti: un set attivato anche da un tema
 * non-variante (il `default` di un asse, o il tema di un gruppo con un solo
 * tema) resta nella base. Solo i set che nessun tema non-variante usa sono
 * esclusi.
 */
function variantSetNames(themes: readonly PenpotTheme[]): Set<string> {
  const variants = variantThemes(themes);
  const variantSet = new Set(variants);
  const variantSets = new Set(variants.flatMap((theme) => theme.sets));
  for (const theme of themes) {
    if (variantSet.has(theme)) continue;
    for (const set of theme.sets) variantSets.delete(set);
  }
  return variantSets;
}

/**
 * La base di un catalogo: i set che non sono usati solo da varianti. È questa
 * che `generateTheme` sa generare (le varianti ripetono i nomi dei token e
 * colliderebbero nell'indice).
 */
export function baseCatalog(catalog: ThemeCatalog): TokenCatalog {
  const variantSets = variantSetNames(catalog.themes);
  return { sets: catalog.sets.filter((set) => !variantSets.has(set.name)) };
}

/** Le variabili `--x: y;` di un CSS generato (la base o una variante fusa). */
function cssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const m of css.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) vars.set(m[1]!, m[2]!);
  return vars;
}

/** Il corpo di `fonts.css`: un `@import` per ogni peso di ogni famiglia non di sistema. */
function renderFonts(base: TokenCatalog): { imports: string[]; packages: string[] } {
  const families: string[] = [];
  for (const set of base.sets) {
    for (const token of set.tokens) {
      if (token.type === "fontFamilies" && Array.isArray(token.value)) {
        for (const family of token.value) if (typeof family === "string") families.push(family);
      }
    }
  }
  const weights: string[] = [];
  for (const set of base.sets) for (const token of set.tokens) if (token.type === "fontWeights" && typeof token.value === "string") weights.push(token.value);

  const imports: string[] = [];
  const packages = new Set<string>();
  const seenFamilies = new Set<string>();
  const uniqueWeights = [...new Set(weights)];
  for (const family of families) {
    if (isSystemOrGeneric(family) || seenFamilies.has(family)) continue;
    seenFamilies.add(family);
    const slug = fontsourceSlug(family);
    packages.add(`@fontsource/${slug}`);
    for (const weight of uniqueWeights) imports.push(`@import "@fontsource/${slug}/${weight}.css";`);
  }
  return { imports, packages: [...packages].sort() };
}

/** La variante come base sovrascritta per nome, ridotta alle sole variabili che cambiano. */
function variantCss(variant: PenpotTheme, sets: readonly PenpotTokenSet[], base: TokenCatalog): string {
  const overrides = new Map(sets.filter((set) => variant.sets.includes(set.name)).flatMap((set) => set.tokens.map((token) => [token.name, token] as const)));
  const unknown = [...overrides.keys()].filter((name) => !base.sets.some((set) => set.tokens.some((token) => token.name === name)));
  if (unknown.length > 0) throw new Error(`variante ${variant.group}/${variant.name}: token assenti dalla base ${unknown.join(", ")}`);

  const baseVars = cssVars(generateTheme(base).css);
  const merged: TokenCatalog = { sets: base.sets.map((set) => ({ ...set, tokens: set.tokens.map((token) => overrides.get(token.name) ?? token) })) };
  const changed = [...cssVars(generateTheme(merged).css)].filter(([name, value]) => baseVars.get(name) !== value);

  return withGeneratedCssHeader(`[data-${variant.group}="${variant.name}"] {\n${changed.map(([name, value]) => `  ${name}: ${value};`).join("\n")}\n}\n`);
}

/**
 * Il catalogo completo → i file del tema. La base si riusa così com'è con
 * `generateTheme`; le varianti sono la base diff per nome, i font gli import
 * `@fontsource/*` delle famiglie non di sistema per ogni peso dei
 * `fontWeights`.
 */
export function extractTheme(catalog: ThemeCatalog, options: ExtractThemeOptions = {}): ExtractThemeResult {
  const fonts = options.fonts ?? "fontsource";
  if (fonts !== "fontsource") {
    throw new Error(`fonts "${String(fonts)}" non implementato: l'unico valore ammesso è "fontsource".`);
  }

  const base = baseCatalog(catalog);
  const { css: baseCss, ts: baseTs } = generateTheme(base);
  const files: ThemeFile[] = [
    { path: "theme.css", content: baseCss },
    { path: "tokens.generated.ts", content: baseTs },
  ];

  const variants = variantThemes(catalog.themes);
  for (const variant of variants) {
    if (!THEME_NAME_PATTERN.test(variant.group) || !THEME_NAME_PATTERN.test(variant.name)) {
      throw new Error(`tema variante "${variant.group}/${variant.name}": gruppo e nome devono contenere solo lettere, cifre, "_" o "-" (niente spazi o "/").`);
    }
    files.push({ path: `themes/${variant.group}-${variant.name}.css`, content: variantCss(variant, catalog.sets, base) });
  }

  const { imports, packages } = renderFonts(base);
  files.push({ path: "fonts.css", content: withGeneratedCssHeader(imports.length > 0 ? `${imports.join("\n")}\n` : "") });

  return { files, packages };
}
