import type { PenpotToken, PenpotTokenSet, PenpotTheme, ShadowLayerValue, TokenType } from "./theme-generator";

/**
 * Port puro dello spike `css-to-tokens.mjs` (Story 2.26): CSS Tailwind v4
 * (`@theme`) → set di token Penpot + temi. Nessuna I/O, nessuna rete: riceve le
 * due stringhe (il default di Tailwind e il seme dell'utente) e restituisce
 * dati.
 *
 * Regole (dallo spike, adattate alle decisioni 2.26):
 * - valore letterale  → set "tailwind" (primitive);
 * - valore var(--x)   → set "semantic", come riferimento "{nome-token-di-x}";
 * - un blocco `[data-<gruppo>="<nome>"] { … }` → set "<gruppo>/<nome>" + tema
 *   (gruppo <gruppo>, nome <nome>); il tema "<gruppo>/default" non aggiunge set.
 *
 * Ogni perdita è esplicita e produce un avviso che nomina la variabile: uno
 * spread negativo diventa 0, un colore oklch fuori sRGB va al più vicino in
 * hex, una variabile non traducibile è saltata.
 */

export interface TokensWarning {
  /** La variabile (o il token) a cui l'avviso si riferisce. */
  var: string;
  why: string;
}

export interface TokensFromCssResult {
  /** I set nell'ordine di scoperta: `tailwind`, `semantic`, poi i set di variante. */
  sets: PenpotTokenSet[];
  themes: PenpotTheme[];
  warnings: TokensWarning[];
}

const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];

/** Le variabili `--x: y;` dentro i blocchi `@theme { … }`. */
function parseTheme(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  const blockRe = /@theme[^{]*\{([\s\S]*?)\n\}/g;
  for (const block of css.matchAll(blockRe)) {
    const body = block[1]!.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const decl of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(decl[1]!, decl[2]!.trim());
  }
  return vars;
}

/** "0.25rem" → "4", "16px" → "16", altrimenti null. */
function remToPx(value: string): string | null {
  const match = /^(-?[\d.]+)(rem|px)$/.exec(value);
  if (!match) return null;
  const n = parseFloat(match[1]!) * (match[2] === "rem" ? 16 : 1);
  return String(Math.round(n * 1000) / 1000);
}

/** oklch → hex sRGB, con clamp esplicito fuori gamut. `none` vale 0. */
function oklchToHex(value: string): { hex: string; clamped: boolean } | null {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+|none)\s+([\d.]+|none)\s*\)$/.exec(value);
  if (!match) return null;
  const num = (s: string): number => (s === "none" ? 0 : parseFloat(s));
  const L = parseFloat(match[1]!) / (match[2] === "%" ? 100 : 1);
  const C = num(match[3]!);
  const h = (num(match[4]!) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  let clamped = false;
  const hex = lin
    .map((c) => {
      if (c < 0 || c > 1) clamped = true;
      const cc = Math.min(1, Math.max(0, c));
      const g = cc <= 0.0031308 ? 12.92 * cc : 1.055 * cc ** (1 / 2.4) - 0.055;
      return Math.round(g * 255).toString(16).padStart(2, "0");
    })
    .join("");
  return { hex: `#${hex.toUpperCase()}`, clamped };
}

/** Un colore letterale in hex; gli oklch passano per {@link oklchToHex}. */
function color(value: string): { hex: string; clamped: boolean } | null {
  if (/^#[0-9a-f]{3,8}$/i.test(value)) {
    const h = value.length === 4 ? `#${[...value.slice(1)].map((c) => c + c).join("")}` : value;
    return { hex: h.toUpperCase(), clamped: false };
  }
  return oklchToHex(value);
}

/** "0 1px 3px 0 rgb(…), 0 1px 2px -1px rgb(…)" → layer; uno spread negativo diventa 0 (Penpot non lo rappresenta). */
function parseShadow(value: string): { layers: ShadowLayerValue[]; hadNegativeSpread: boolean } | null {
  const layers = value.split(/,(?![^(]*\))/).map((s) => s.trim());
  const out: ShadowLayerValue[] = [];
  let hadNegativeSpread = false;
  for (const layer of layers) {
    const inset = /^inset\s/.test(layer);
    const body = layer.replace(/^inset\s+/, "");
    const colorM = /(rgb\([^)]*\)|#[0-9a-f]{3,8})$/i.exec(body);
    if (!colorM) return null;
    const nums = body.slice(0, colorM.index).trim().split(/\s+/).map((n) => remToPx(n === "0" ? "0px" : n));
    if (nums.some((n) => n === null) || nums.length < 2) return null;
    const rgb = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)/.exec(colorM[1]!);
    const col = rgb ? `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${rgb[4]})` : colorM[1]!;
    let spread = nums[3] ?? "0";
    if (parseFloat(spread) < 0) {
      spread = "0";
      hadNegativeSpread = true;
    }
    out.push({ offsetX: nums[0]!, offsetY: nums[1]!, blur: nums[2] ?? "0", spread, color: col, inset });
  }
  return { layers: out, hadNegativeSpread };
}

type Classified =
  | { type: "color"; primitiveName: string; semanticName: string }
  | { type: Exclude<TokenType, "color">; name: string };

/** Variabile CSS → tipo e nome secondo il namespace Tailwind v4, oppure null. */
function classify(cssVar: string): Classified | null {
  const n = cssVar.slice(2);
  let m: RegExpExecArray | null;
  if ((m = /^color-(.+)$/.exec(n))) {
    const rest = m[1]!;
    const scale = /^([a-z]+)-(\d+)$/.exec(rest);
    return { type: "color", primitiveName: scale ? `${scale[1]}.${scale[2]}` : rest, semanticName: `color.${rest}` };
  }
  if ((m = /^radius-(.+)$/.exec(n))) return { type: "borderRadius", name: `radius.${m[1]}` };
  if ((m = /^text-([a-z0-9]+)$/.exec(n))) return { type: "fontSizes", name: `text.${m[1]}` };
  if ((m = /^font-weight-(.+)$/.exec(n))) return { type: "fontWeights", name: `font-weight.${m[1]}` };
  if ((m = /^tracking-(.+)$/.exec(n))) return { type: "letterSpacing", name: `tracking.${m[1]}` };
  if ((m = /^shadow-(.+)$/.exec(n))) return { type: "shadow", name: `shadow.${m[1]}` };
  if ((m = /^border-width-(.+)$/.exec(n))) return { type: "borderWidth", name: `border-width.${m[1]}` };
  if ((m = /^font-(sans|serif|mono)$/.exec(n))) return { type: "fontFamilies", name: `font.${m[1]}` };
  return null;
}

const isRef = (value: string | undefined): boolean => /^var\(\s*--[\w-]+\s*\)$/.test(value ?? "");

function tokenNameOf(cssVar: string, vars: ReadonlyMap<string, string>): string | null {
  const c = classify(cssVar);
  if (!c) return null;
  if (c.type === "color") return isRef(vars.get(cssVar)) ? c.semanticName : c.primitiveName;
  return c.name;
}

/** Famiglie di sistema o generiche: non diventano un token importabile. */
const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "emoji", "math", "fangsong", "inherit", "initial", "unset"]);

interface Converted {
  sets: Record<string, PenpotToken[]>;
  warnings: TokensWarning[];
}

function convert(vars: ReadonlyMap<string, string>): Converted {
  const sets: Record<string, PenpotToken[]> = { tailwind: [], semantic: [] };
  const warnings: TokensWarning[] = [];

  const base = vars.get("--spacing");
  if (base) {
    const unit = Number(remToPx(base));
    for (const step of SPACING_STEPS) {
      if (!Number.isInteger(step)) {
        warnings.push({ var: `spacing ${step}`, why: "passo frazionario: il punto nel nome diventerebbe un separatore" });
        continue;
      }
      sets.tailwind!.push({ type: "spacing", name: `spacing.${step}`, value: String(step * unit) });
    }
    sets.tailwind!.push({ type: "spacing", name: "spacing.px", value: "1" });
  }

  for (const [cssVar, raw] of vars) {
    if (cssVar === "--spacing") continue;
    const c = classify(cssVar);
    if (!c) {
      warnings.push({ var: cssVar, why: "nessun tipo di token Penpot/namespace del generatore" });
      continue;
    }
    const name = tokenNameOf(cssVar, vars);
    if (isRef(raw)) {
      const target = /var\(\s*(--[\w-]+)\s*\)/.exec(raw)![1]!;
      const targetName = tokenNameOf(target, vars);
      if (!targetName) {
        warnings.push({ var: cssVar, why: `riferimento a ${target} non traducibile` });
        continue;
      }
      sets.semantic!.push({ type: c.type, name: name!, value: `{${targetName}}` });
      continue;
    }
    let value: PenpotToken["value"] | null = null;
    switch (c.type) {
      case "color": {
        if (raw === "currentcolor" || raw === "transparent") {
          warnings.push({ var: cssVar, why: raw });
          continue;
        }
        const r = color(raw);
        if (r) {
          value = r.hex;
          if (r.clamped) warnings.push({ var: cssVar, why: "colore oklch fuori sRGB: portato al più vicino in hex" });
        }
        break;
      }
      case "borderRadius":
      case "borderWidth":
      case "fontSizes":
        value = remToPx(raw);
        break;
      case "fontWeights":
        value = /^\d+$/.test(raw) ? raw : null;
        break;
      case "letterSpacing":
        value = /^-?[\d.]+em$/.test(raw) ? raw : remToPx(raw) && `${remToPx(raw)}px`;
        break;
      case "shadow": {
        const parsed = parseShadow(raw);
        if (parsed) {
          value = parsed.layers;
          if (parsed.hadNegativeSpread) warnings.push({ var: cssVar, why: "spread negativo: portato a 0 (Penpot non lo rappresenta)" });
        }
        break;
      }
      case "fontFamilies": {
        const families = raw.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        const primary = families[0] ?? "";
        value = /^(ui-|system-)/.test(primary) || GENERIC_FAMILIES.has(primary.toLowerCase()) ? null : families;
        break;
      }
    }
    if (value === null || value === undefined) {
      warnings.push({ var: cssVar, why: `valore non traducibile: ${raw}` });
      continue;
    }
    sets.tailwind!.push({ type: c.type, name: name!, value });
  }
  return { sets, warnings };
}

interface ParsedVariant {
  group: string;
  name: string;
  vars: Map<string, string>;
}

/** I blocchi `[data-<gruppo>="<nome>"] { … }` del CSS. */
function parseVariants(css: string): ParsedVariant[] {
  const variants: ParsedVariant[] = [];
  const re = /\[data-([\w-]+)="([\w-]+)"\]\s*\{([\s\S]*?)\n\}/g;
  for (const m of css.matchAll(re)) {
    const body = m[3]!.replace(/\/\*[\s\S]*?\*\//g, "");
    const vars = new Map<string, string>();
    for (const decl of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(decl[1]!, decl[2]!.trim());
    variants.push({ group: m[1]!, name: m[2]!, vars });
  }
  return variants;
}

/** Ogni variante: solo riferimenti a primitive esistenti, con gli stessi nomi dei semantici di default. */
function convertVariants(variants: readonly ParsedVariant[], vars: ReadonlyMap<string, string>, base: Converted): { sets: Record<string, PenpotToken[]>; themes: PenpotTheme[] } {
  const known = new Set(base.sets.semantic!.map((t) => t.name));
  const themes: PenpotTheme[] = [];
  const groups = new Set<string>();
  for (const v of variants) {
    const setName = `${v.group}/${v.name}`;
    const tokens: PenpotToken[] = [];
    for (const [cssVar, raw] of v.vars) {
      const name = tokenNameOf(cssVar, new Map([[cssVar, raw]]));
      const target = /var\(\s*(--[\w-]+)\s*\)/.exec(raw)?.[1];
      const targetName = target && tokenNameOf(target, vars);
      if (!name || !targetName) {
        base.warnings.push({ var: `${setName} ${cssVar}`, why: `variante non traducibile: ${raw}` });
        continue;
      }
      if (!known.has(name)) base.warnings.push({ var: `${setName} ${cssVar}`, why: "la variante sovrascrive un ruolo che il tema di default non definisce" });
      tokens.push({ type: classify(cssVar)!.type, name, value: `{${targetName}}` });
    }
    base.sets[setName] = tokens;
    groups.add(v.group);
    themes.push({ group: v.group, name: v.name, sets: [setName] });
  }
  for (const g of groups) themes.unshift({ group: g, name: "default", sets: [] });
  return { sets: base.sets, themes };
}

/**
 * Il seme CSS (Tailwind v4 + ruoli shadcn) con il default di Tailwind anteposto
 * → set e temi Penpot. Il default viene prima, così una variabile del seme
 * sovrascrive il valore di default con lo stesso nome (come nello spike
 * `node css-to-tokens.mjs <default> <seme>`).
 */
export function tokensFromCss(defaultCss: string, seedCss: string): TokensFromCssResult {
  const vars = new Map<string, string>();
  const variants: ParsedVariant[] = [];
  for (const css of [defaultCss, seedCss]) {
    for (const [k, v] of parseTheme(css)) vars.set(k, v);
    variants.push(...parseVariants(css));
  }
  const converted = convert(vars);
  const { sets, themes } = convertVariants(variants, vars, converted);
  return {
    sets: Object.entries(sets).map(([name, tokens]) => ({ name, tokens })),
    themes,
    warnings: converted.warnings,
  };
}
