#!/usr/bin/env node
/**
 * Prototipo dello spike (2026-10-10): CSS Tailwind v4 (@theme) → set di token Penpot.
 *
 * Uso: node css-to-tokens.mjs <default-theme.css> [<tema-utente.css> …] > tokens.json
 * I file successivi sovrascrivono i precedenti (stessa variabile CSS).
 *
 * Regole:
 * - valore letterale  → set "tailwind" (primitive);
 * - valore var(--x)   → set "semantic", come riferimento "{nome-token-di-x}".
 * Nomi alla Tailwind: il primo segmento è il namespace del tipo, così il
 * generatore `theme` lo toglie e le classi escono pulite (bg-primary, text-sm).
 * Le primitive di colore non hanno prefisso (blue.500), come nel catalogo attuale.
 * Ciò che Penpot o il generatore non sanno rappresentare finisce in "skipped".
 */
import { readFileSync } from "node:fs";

const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];

function parseTheme(css) {
  const vars = new Map();
  const blockRe = /@theme[^{]*\{([\s\S]*?)\n\}/g;
  for (const block of css.matchAll(blockRe)) {
    const body = block[1].replace(/\/\*[\s\S]*?\*\//g, "");
    for (const decl of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(decl[1], decl[2].trim());
  }
  return vars;
}

const remToPx = (v) => {
  const m = /^(-?[\d.]+)(rem|px)$/.exec(v);
  if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1);
  return String(Math.round(n * 1000) / 1000);
};

function oklchToHex(v) {
  // `none` (CSS Color 4) = componente assente: per i neutri la tonalità vale 0.
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+|none)\s+([\d.]+|none)\s*\)$/.exec(v);
  if (!m) return null;
  const num = (s) => (s === "none" ? 0 : parseFloat(s));
  const L = parseFloat(m[1]) / (m[2] === "%" ? 100 : 1);
  const C = num(m[3]);
  const h = (num(m[4]) * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  let clamped = false;
  const hex = lin
    .map((c) => {
      if (c < 0 || c > 1) clamped = true;
      c = Math.min(1, Math.max(0, c));
      const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.round(g * 255).toString(16).padStart(2, "0");
    })
    .join("");
  return { hex: `#${hex.toUpperCase()}`, clamped };
}

function color(v) {
  if (/^#[0-9a-f]{3,8}$/i.test(v)) {
    const h = v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join("")}` : v;
    return { hex: h.toUpperCase(), clamped: false };
  }
  return oklchToHex(v);
}

function parseShadow(v) {
  // "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
  const layers = v.split(/,(?![^(]*\))/).map((s) => s.trim());
  const out = [];
  for (const layer of layers) {
    const inset = /^inset\s/.test(layer);
    const body = layer.replace(/^inset\s+/, "");
    const colorM = /(rgb\([^)]*\)|#[0-9a-f]{3,8})$/i.exec(body);
    if (!colorM) return null;
    const nums = body.slice(0, colorM.index).trim().split(/\s+/).map((n) => remToPx(n === "0" ? "0px" : n));
    if (nums.some((n) => n === null) || nums.length < 2) return null;
    const rgb = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)/.exec(colorM[1]);
    const col = rgb ? `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${rgb[4]})` : colorM[1];
    out.push({ offsetX: nums[0], offsetY: nums[1], blur: nums[2] ?? "0", spread: nums[3] ?? "0", color: col, inset });
  }
  return out;
}

/** Variabile CSS → { type, name } secondo il namespace Tailwind v4, oppure null. */
function classify(cssVar) {
  const n = cssVar.slice(2);
  let m;
  if ((m = /^color-(.+)$/.exec(n))) {
    const rest = m[1];
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

function tokenNameOf(cssVar, vars) {
  const c = classify(cssVar);
  if (!c) return null;
  if (c.type === "color") return isRef(vars.get(cssVar)) ? c.semanticName : c.primitiveName;
  return c.name;
}

const isRef = (v) => /^var\(\s*--[\w-]+\s*\)$/.test(v ?? "");

function convert(vars) {
  const sets = { tailwind: [], semantic: [] };
  const skipped = [];
  const clampedColors = [];

  const base = vars.get("--spacing");
  if (base) {
    const unit = Number(remToPx(base));
    for (const step of SPACING_STEPS) {
      if (!Number.isInteger(step)) { skipped.push({ var: `spacing ${step}`, why: "passo frazionario: il punto nel nome diventerebbe un separatore" }); continue; }
      sets.tailwind.push({ type: "spacing", name: `spacing.${step}`, value: String(step * unit) });
    }
    sets.tailwind.push({ type: "spacing", name: "spacing.px", value: "1" });
  }

  for (const [cssVar, raw] of vars) {
    if (cssVar === "--spacing") continue;
    const c = classify(cssVar);
    if (!c) { skipped.push({ var: cssVar, why: "nessun tipo di token Penpot/namespace del generatore" }); continue; }
    const name = tokenNameOf(cssVar, vars);
    if (isRef(raw)) {
      const target = /var\(\s*(--[\w-]+)\s*\)/.exec(raw)[1];
      const targetName = tokenNameOf(target, vars);
      if (!targetName) { skipped.push({ var: cssVar, why: `riferimento a ${target} non traducibile` }); continue; }
      sets.semantic.push({ type: c.type, name, value: `{${targetName}}` });
      continue;
    }
    let value = null;
    switch (c.type) {
      case "color": {
        if (raw === "currentcolor" || raw === "transparent") { skipped.push({ var: cssVar, why: raw }); continue; }
        const r = color(raw);
        if (r) { value = r.hex; if (r.clamped) clampedColors.push(name); }
        break;
      }
      case "borderRadius":
      case "borderWidth":
      case "fontSizes": value = remToPx(raw); break;
      case "fontWeights": value = /^\d+$/.test(raw) ? raw : null; break;
      case "letterSpacing": value = /^-?[\d.]+em$/.test(raw) ? raw : remToPx(raw) && `${remToPx(raw)}px`; break;
      case "shadow": value = parseShadow(raw); break;
      case "fontFamilies": {
        // Tutta la lista, ripieghi compresi: senza, il browser ripiega sul serif.
        const families = raw.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        value = /^(ui-|system-)/.test(families[0] ?? "") ? null : families;
        break;
      }
    }
    if (value === null || value === undefined) { skipped.push({ var: cssVar, why: `valore non traducibile: ${raw}` }); continue; }
    sets.tailwind.push({ type: c.type, name, value });
  }
  return { sets, skipped, clampedColors };
}

/** Blocchi `[data-<gruppo>="<nome>"] { … }` → varianti di tema. */
function parseVariants(css) {
  const variants = [];
  const re = /\[data-([\w-]+)="([\w-]+)"\]\s*\{([\s\S]*?)\n\}/g;
  for (const m of css.matchAll(re)) {
    const body = m[3].replace(/\/\*[\s\S]*?\*\//g, "");
    const vars = new Map();
    for (const decl of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(decl[1], decl[2].trim());
    variants.push({ group: m[1], name: m[2], vars });
  }
  return variants;
}

/** Ogni variante: solo riferimenti a primitive esistenti, stessi nomi dei semantici di default. */
function convertVariants(variants, vars, base) {
  const known = new Set(base.sets.semantic.map((t) => t.name));
  const themes = [];
  const groups = new Set();
  for (const v of variants) {
    const setName = `${v.group}/${v.name}`;
    const tokens = [];
    for (const [cssVar, raw] of v.vars) {
      const name = tokenNameOf(cssVar, new Map([[cssVar, raw]]));
      const target = /var\(\s*(--[\w-]+)\s*\)/.exec(raw)?.[1];
      const targetName = target && tokenNameOf(target, vars);
      if (!name || !targetName) { base.skipped.push({ var: `${setName} ${cssVar}`, why: `variante non traducibile: ${raw}` }); continue; }
      if (!known.has(name)) base.skipped.push({ var: `${setName} ${cssVar}`, why: "la variante sovrascrive un ruolo che il tema di default non definisce" });
      tokens.push({ type: classify(cssVar).type, name, value: `{${targetName}}` });
    }
    base.sets[setName] = tokens;
    groups.add(v.group);
    themes.push({ group: v.group, name: v.name, sets: [setName] });
  }
  for (const g of groups) themes.unshift({ group: g, name: "default", sets: [] });
  base.themes = themes;
  return base;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("uso: node css-to-tokens.mjs <default-theme.css> [<tema-utente.css> …]");
  process.exit(1);
}
const vars = new Map();
const variants = [];
for (const f of files) {
  const css = readFileSync(f, "utf8");
  for (const [k, v] of parseTheme(css)) vars.set(k, v);
  variants.push(...parseVariants(css));
}
process.stdout.write(JSON.stringify(convertVariants(variants, vars, convert(vars)), null, 1));
