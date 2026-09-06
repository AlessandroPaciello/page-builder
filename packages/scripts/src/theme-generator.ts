import { createHash } from "node:crypto";

/**
 * Contratto di serializzazione del catalogo token Penpot letto da
 * `penpot.library.local.tokens` (vedi penpot-reader.ts). Solo i set
 * `active` vengono inclusi — filtrati a monte dal reader.
 */
export type TokenType =
  | "color"
  | "spacing"
  | "borderRadius"
  | "borderWidth"
  | "fontSizes"
  | "fontWeights"
  | "letterSpacing"
  | "fontFamilies"
  | "opacity"
  | "shadow";

export interface ShadowLayerValue {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
  inset: boolean;
}

export type PenpotTokenValue = string | string[] | ShadowLayerValue[];

export interface PenpotToken {
  name: string;
  type: TokenType;
  value: PenpotTokenValue;
}

export interface PenpotTokenSet {
  name: string;
  tokens: PenpotToken[];
}

export interface TokenCatalog {
  sets: PenpotTokenSet[];
}

export interface GeneratedTheme {
  css: string;
  ts: string;
}

/**
 * Namespace Tailwind v4 per tipo di token (AD-11 / design-system.md). Il nome
 * CSS/TS deriva sempre dal TYPE, mai dal nome del SET Penpot: un nuovo set
 * produce così una nuova sezione senza toccare questo file.
 *
 * Contratto namespace (decisione review 2.1, 2026-09-06): si usano SOLO i
 * namespace `@theme` reali di Tailwind v4, così ogni tipo genera le proprie
 * utility (es. `--spacing-mis-1` → `p-mis-1`, `gap-mis-1`, …). `borderWidth` e
 * `opacity` NON hanno un namespace in v4: le loro variabili restano
 * CSS-only (consumate via `var()` dai field Puck e dai componenti), con
 * utility create a mano solo se/ne quando serviranno. Il suffisso
 * (`varSuffix`) resta il contratto 1:1 con il nome Penpot condiviso con
 * token-resolver.ts (Story 2.2/2.3): cambia solo il prefisso lato codice.
 */
const TYPE_NAMESPACE: Record<TokenType, string> = {
  color: "color",
  spacing: "spacing",
  borderRadius: "radius",
  borderWidth: "border-width",
  fontSizes: "text",
  fontWeights: "font-weight",
  letterSpacing: "tracking",
  fontFamilies: "font",
  opacity: "opacity",
  shadow: "shadow",
};

export { TYPE_NAMESPACE };

/**
 * Tipi numerici (dimensionali) che possono referenziarsi liberamente tra loro
 * (es. `radius.mis.sm: "{radius.2}"`, o un raggio che parte da uno spacing).
 * Fuori da questo gruppo vale la regola stesso-tipo: un riferimento è legale
 * solo verso un token dello stesso tipo (decisione review 2.1, 2026-09-06) —
 * un `color` che punta a `{space.1}` è un wiring sbagliato del designer e
 * deve fallire loud, non produrre CSS sbagliato in silenzio.
 */
const NUMERIC_REF_TYPES = new Set<TokenType>(["spacing", "borderRadius", "borderWidth", "fontSizes"]);

/** Nome token Penpot valido: lettere, cifre, `.`, `_`, `-` (niente spazi, virgolette o newline che romperebbero il CSS/TS generato). */
const TOKEN_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const REFERENCE_PATTERN = /^\{(.+)\}$/;
const BARE_NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/;

function matchReference(raw: string): string | null {
  const match = REFERENCE_PATTERN.exec(raw);
  return match?.[1] ?? null;
}

function isBareNumber(raw: string): boolean {
  return BARE_NUMBER_PATTERN.test(raw);
}

/** Spezza un nome token in parole normalizzate (case + separatori uniformati). */
function toWords(raw: string): string[] {
  return raw
    .replace(/[._]/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .split("-")
    .filter(Boolean);
}

/**
 * Suffisso di variabile derivato dal nome token: se il nome ripete già il
 * namespace del tipo (es. "color.mis.primary" per type "color"), quel
 * segmento viene tolto per evitare `--color-color-mis-primary`. Altrimenti
 * il nome resta intero (es. "gray.1" → "gray-1"), garantendo che non ci sia
 * mai collisione fra token con lo stesso indice ma set diversi (gray.1 vs
 * accent.1). Riusata da Story 2.2/2.3 (token-resolver.ts) per le classi dei
 * componenti: stesso suffisso in CSS var e classe Tailwind.
 */
export function varSuffix(tokenName: string, type: TokenType): string {
  const namespace = TYPE_NAMESPACE[type];
  if (!namespace) {
    throw new Error(
      `Type token non gestito "${String(type)}" per il token "${tokenName}" — tipi supportati: ${Object.keys(TYPE_NAMESPACE).join(", ")}. Aggiungi il tipo al generatore o correggi il token in Penpot.`,
    );
  }
  const typeWords = toWords(namespace);
  const nameWords = toWords(tokenName);
  const startsWithType = typeWords.every((word, i) => nameWords[i] === word);
  const remainder = startsWithType ? nameWords.slice(typeWords.length) : nameWords;
  if (remainder.length === 0) {
    throw new Error(
      `Token "${tokenName}" (type "${type}") collassa in un suffisso vuoto dopo aver tolto il namespace del tipo — rinominalo in Penpot con un segmento distintivo.`,
    );
  }
  return remainder.join("-");
}

export function varName(tokenName: string, type: TokenType): string {
  return `${TYPE_NAMESPACE[type]}-${varSuffix(tokenName, type)}`;
}

interface IndexedToken extends PenpotToken {
  setName: string;
  varName: string;
}

function buildIndex(catalog: TokenCatalog): Map<string, IndexedToken> {
  const index = new Map<string, IndexedToken>();
  const varNameOwners = new Map<string, IndexedToken>();

  for (const set of catalog.sets) {
    for (const token of set.tokens) {
      if (!TOKEN_NAME_PATTERN.test(token.name)) {
        throw new Error(
          `Il nome token "${token.name}" (set "${set.name}") contiene caratteri non consentiti — ammessi lettere, cifre, ".", "_", "-". Rinominalo in Penpot: un nome fuori charset romperebbe il CSS/TS generato.`,
        );
      }
      if (index.has(token.name)) {
        const existing = index.get(token.name)!;
        throw new Error(
          `Nome token duplicato "${token.name}" nei set "${existing.setName}" e "${set.name}" — i nomi token Penpot devono essere unici nel catalogo.`,
        );
      }

      const name = varName(token.name, token.type);
      const owner = varNameOwners.get(name);
      if (owner) {
        throw new Error(
          `Collisione sul nome variabile "--${name}": generato sia da "${owner.name}" (set "${owner.setName}") sia da "${token.name}" (set "${set.name}"). Rinomina uno dei due token in Penpot per disambiguare.`,
        );
      }

      const indexed: IndexedToken = { ...token, setName: set.name, varName: name };
      index.set(token.name, indexed);
      varNameOwners.set(name, indexed);
    }
  }

  return index;
}

function assertRefCompatible(token: IndexedToken, target: IndexedToken): void {
  const compatible =
    (NUMERIC_REF_TYPES.has(token.type) && NUMERIC_REF_TYPES.has(target.type)) || token.type === target.type;
  if (!compatible) {
    throw new Error(
      `Il token "${token.name}" (type "${token.type}") referenzia "{${target.name}}" (type "${target.type}") — riferimento cross-type non consentito: i tipi numerici (${[...NUMERIC_REF_TYPES].join(", ")}) si referenziano liberamente, gli altri solo stesso tipo. Correggi il riferimento in Penpot.`,
    );
  }
}

function resolveCssScalar(token: IndexedToken, raw: string, index: Map<string, IndexedToken>): string {
  const ref = matchReference(raw);
  if (ref) {
    const target = index.get(ref);
    if (!target) {
      throw new Error(
        `Il token "${token.name}" referenzia "{${ref}}", che non esiste nel catalogo — rigenera la fixture con --live o correggi il riferimento in Penpot.`,
      );
    }
    assertRefCompatible(token, target);
    return `var(--${target.varName})`;
  }

  switch (token.type) {
    case "color":
    case "fontWeights":
    case "opacity":
      return raw;
    case "letterSpacing":
      // Decisione review 2.1 (2026-09-06): il tracking non viene mai
      // indovinato. In Penpot px ed em coesistono e un bare number ("0.5")
      // è ambiguo: sbagliare l'unità è un errore visivo ~16×.
      if (isBareNumber(raw)) {
        throw new Error(
          `Il token "${token.name}" (type "letterSpacing") ha valore senza unità esplicita "${raw}" — px ed em sono ambigui e nessuna unità viene indovinata: correggi il token in Penpot con l'unità esplicita (px o em).`,
        );
      }
      return raw;
    case "spacing":
    case "borderRadius":
    case "borderWidth":
    case "fontSizes":
      if (!isBareNumber(raw)) {
        throw new Error(
          `Il token "${token.name}" (type "${token.type}") ha valore non numerico "${raw}" — nessun'unità viene indovinata, correggi il valore in Penpot.`,
        );
      }
      return `${raw}px`;
    default:
      throw new Error(`Type token non gestito "${token.type}" per il token "${token.name}".`);
  }
}

function pxOrThrow(token: IndexedToken, raw: string, field: string): string {
  if (!isBareNumber(raw)) {
    throw new Error(
      `Il token shadow "${token.name}" ha un valore non numerico per "${field}": "${raw}" — nessun'unità viene indovinata.`,
    );
  }
  return `${raw}px`;
}

/**
 * Risolve il campo `color` di un layer shadow: può essere un letterale o un
 * riferimento — ma SOLO verso un token di tipo color (il colore di un'ombra
 * che punta a `{space.1}` è un wiring sbagliato, non un valore).
 */
function resolveShadowColor(token: IndexedToken, raw: string, index: Map<string, IndexedToken>): string {
  const ref = matchReference(raw);
  if (ref) {
    const target = index.get(ref);
    if (!target) {
      throw new Error(
        `Il layer shadow del token "${token.name}" referenzia "{${ref}}", che non esiste nel catalogo — correggi il riferimento in Penpot.`,
      );
    }
    if (target.type !== "color") {
      throw new Error(
        `Il layer shadow del token "${token.name}" referenzia "{${target.name}}" (type "${target.type}") — il colore di una shadow può referenziare solo token di tipo color.`,
      );
    }
    return `var(--${target.varName})`;
  }
  return raw;
}

function formatShadowLayer(token: IndexedToken, layer: ShadowLayerValue, index: Map<string, IndexedToken>): string {
  if (!layer || typeof layer !== "object") {
    throw new Error(
      `Il token shadow "${token.name}" ha un layer malformato (${JSON.stringify(layer) ?? "null"}) — atteso un oggetto { offsetX, offsetY, blur, spread, color, inset }.`,
    );
  }
  if (typeof layer.color !== "string" || layer.color.length === 0) {
    throw new Error(
      `Il token shadow "${token.name}" ha un layer senza campo "color" valido — un'ombra senza colore emetterebbe "undefined" nel CSS generato.`,
    );
  }
  if (typeof layer.inset !== "boolean") {
    throw new Error(
      `Il token shadow "${token.name}" ha un layer con "inset" non booleano (${JSON.stringify(layer.inset)}) — Penpot serializza true/false: correggi il valore in Penpot.`,
    );
  }
  const color = resolveShadowColor(token, layer.color, index);
  const parts = [
    pxOrThrow(token, layer.offsetX, "offsetX"),
    pxOrThrow(token, layer.offsetY, "offsetY"),
    pxOrThrow(token, layer.blur, "blur"),
    pxOrThrow(token, layer.spread, "spread"),
    color,
  ];
  return layer.inset ? `inset ${parts.join(" ")}` : parts.join(" ");
}

/** Family valido: niente virgolette, backslash o newline che romperebbero il letterale CSS generato. */
function assertValidFamily(token: IndexedToken, family: string): void {
  if (!/^[^"\\\r\n]*$/.test(family)) {
    throw new Error(
      `Il token "${token.name}" (type "fontFamilies") contiene un family con caratteri non validi (${JSON.stringify(family)}) — virgolette, backslash e newline non sono ammessi: correggi il token in Penpot.`,
    );
  }
}

function resolveCssValue(token: IndexedToken, index: Map<string, IndexedToken>): string {
  if (token.type === "fontFamilies") {
    if (!Array.isArray(token.value)) {
      throw new Error(
        `Il token "${token.name}" (type "fontFamilies") ha un valore che non è una lista (${JSON.stringify(token.value)}) — atteso un array di family: correggi il token in Penpot.`,
      );
    }
    const families = token.value as string[];
    if (families.length === 0) {
      throw new Error(
        `Il token "${token.name}" (type "fontFamilies") ha una lista vuota — emetterebbe una dichiarazione CSS vuota: correggi o elimina il token in Penpot.`,
      );
    }
    families.forEach((family) => assertValidFamily(token, family));
    return families.map((family) => (family.includes(" ") ? `"${family}"` : family)).join(", ");
  }
  if (token.type === "shadow") {
    if (!Array.isArray(token.value)) {
      throw new Error(
        `Il token "${token.name}" (type "shadow") ha un valore che non è una lista di layer (${JSON.stringify(token.value)}) — correggi il token in Penpot.`,
      );
    }
    const layers = token.value as ShadowLayerValue[];
    if (layers.length === 0) {
      throw new Error(
        `Il token "${token.name}" (type "shadow") non ha layer — emetterebbe una dichiarazione CSS vuota: correggi o elimina il token in Penpot.`,
      );
    }
    return layers.map((layer) => formatShadowLayer(token, layer, index)).join(", ");
  }
  if (typeof token.value !== "string") {
    throw new Error(
      `Il token "${token.name}" (type "${token.type}") ha un valore non scalare (${typeof token.value}) — attesa una stringa: correggi il token in Penpot.`,
    );
  }
  return resolveCssScalar(token, token.value, index);
}

/** Risolve ricorsivamente un token numerico (spacing/radius/...) fino al valore letterale, seguendo i riferimenti `{...}`. */
function resolveNumericValue(token: IndexedToken, index: Map<string, IndexedToken>, seen: readonly string[] = []): number {
  if (seen.includes(token.name)) {
    throw new Error(
      `Riferimento circolare tra token: ${[...seen, token.name].join(" → ")} — correggi i riferimenti in Penpot.`,
    );
  }
  if (typeof token.value !== "string") {
    throw new Error(`Il token "${token.name}" (type "${token.type}") non ha un valore scalare numerico.`);
  }
  const ref = matchReference(token.value);
  if (ref) {
    const target = index.get(ref);
    if (!target) {
      throw new Error(
        `Il token "${token.name}" referenzia "{${ref}}", che non esiste nel catalogo — rigenera la fixture con --live o correggi il riferimento in Penpot.`,
      );
    }
    assertRefCompatible(token, target);
    return resolveNumericValue(target, index, [...seen, token.name]);
  }
  if (!isBareNumber(token.value)) {
    throw new Error(
      `Il token "${token.name}" (type "${token.type}") ha valore non numerico "${token.value}" — non può entrare nella scala TS.`,
    );
  }
  return Number(token.value);
}

interface ScaleEntry {
  suffix: string;
  name: string;
  numeric: number;
}

function collectByType(catalog: TokenCatalog, index: Map<string, IndexedToken>, type: TokenType): ScaleEntry[] {
  const entries: ScaleEntry[] = [];
  const prefixLength = TYPE_NAMESPACE[type].length + 1;
  for (const set of catalog.sets) {
    for (const token of set.tokens) {
      if (token.type !== type) continue;
      const indexed = index.get(token.name)!;
      entries.push({
        suffix: indexed.varName.slice(prefixLength),
        name: token.name,
        numeric: resolveNumericValue(indexed, index),
      });
    }
  }
  return entries;
}

function renderRecordLiteral(entries: ScaleEntry[], valueOf: (entry: ScaleEntry) => string): string {
  const lines = entries.map((entry) => `  "${entry.suffix}": ${valueOf(entry)},`);
  return `{\n${lines.join("\n")}\n}`;
}

function renderScale(exportName: string, entries: ScaleEntry[]): string {
  return `export const ${exportName} = ${renderRecordLiteral(entries, (e) => String(e.numeric))} as const;`;
}

function renderOptions(exportName: string, entries: ScaleEntry[]): string {
  const lines = entries.map((entry) => `  { label: "${entry.name}", value: "${entry.suffix}" },`);
  return `export const ${exportName} = [\n${lines.join("\n")}\n] as const;`;
}

function renderMap(exportName: string, entries: ScaleEntry[], namespace: string): string {
  return `export const ${exportName} = ${renderRecordLiteral(entries, (e) => `"var(--${namespace}-${e.suffix})"`)} as const;`;
}

/**
 * Impronta di provenienza del catalogo: sha256 del JSON serializzato, tronco
 * a 12 caratteri. Riusata da Story 2.2 (fixture/ricetta componenti) come
 * campo `fixtureHash` della ricetta — esportata invece di duplicare
 * l'algoritmo.
 */
export function fixtureHash(catalog: TokenCatalog): string {
  return createHash("sha256").update(JSON.stringify(catalog)).digest("hex").slice(0, 12);
}

const REGEN_COMMAND = "pnpm --filter @penpot-ds/scripts generate:theme";

function cssHeader(hash: string): string {
  return [
    "/* @generated from Penpot design tokens — DO NOT EDIT BY HAND. */",
    `/* Regenerate with: ${REGEN_COMMAND} */`,
    `/* Source catalog fixture hash: ${hash} */`,
  ].join("\n");
}

function tsHeader(hash: string): string {
  return [
    "// @generated from Penpot design tokens — DO NOT EDIT BY HAND.",
    `// Regenerate with: ${REGEN_COMMAND}`,
    `// Source catalog fixture hash: ${hash}`,
  ].join("\n");
}

/**
 * Mapping puro e testabile TokenCatalog → { css, ts }. Nessuna I/O, nessuna
 * chiamata di rete: la stessa fixture produce sempre lo stesso output byte
 * per byte (l'hash della fixture sostituisce un timestamp come provenienza,
 * evitando non-determinismo da Date.now()).
 */
export function generateTheme(catalog: TokenCatalog): GeneratedTheme {
  const index = buildIndex(catalog);
  const hash = fixtureHash(catalog);

  const cssSections = catalog.sets.map((set) => {
    const lines = set.tokens.map((token) => {
      const indexed = index.get(token.name)!;
      return `  --${indexed.varName}: ${resolveCssValue(indexed, index)};`;
    });
    return `  /* set: ${set.name} */\n${lines.join("\n")}`;
  });

  const css = `${cssHeader(hash)}
@import "./tailwind-extras.css";

@theme static {
${cssSections.join("\n\n")}
}
`;

  const spacingEntries = collectByType(catalog, index, "spacing");
  const radiusEntries = collectByType(catalog, index, "borderRadius");

  const ts = `${tsHeader(hash)}

${renderScale("spacing", spacingEntries)}

${renderOptions("spacingOptions", spacingEntries)}

${renderMap("spacingMap", spacingEntries, TYPE_NAMESPACE.spacing)}

${renderScale("radii", radiusEntries)}

${renderOptions("radiiOptions", radiusEntries)}

${renderMap("radiiMap", radiusEntries, TYPE_NAMESPACE.borderRadius)}
`;

  return { css, ts };
}
