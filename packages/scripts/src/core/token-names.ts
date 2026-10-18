/**
 * Nomi dei token (Story 2.20): tipo, namespace Tailwind v4 e suffisso di
 * classe. Vivono nel nucleo perché il registro traduce un token in classe con
 * lo stesso suffisso della variabile CSS che il generatore del tema scrive
 * (`shared/theme-generator.ts` li importa da qui).
 */

/**
 * Tipo di un token Penpot, come lo serializza il catalogo
 * (`penpot.library.local.tokens`).
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
