import { createHash } from "node:crypto";

/**
 * Intestazione `@generated` dei file del generatore (Story 2.22, poi 2.26):
 *
 * `// @generated pds <GENERATOR_VERSION> sha256:<hex> — non modificare a mano`
 *
 * per i file TS/TSX, e la forma a commento CSS (barra-stella, stesso testo)
 * per i file CSS del tema (`theme.css`, `fonts.css`, `themes/*.css`). La
 * lettura accetta entrambe le forme.
 *
 * L'hash è lo SHA-256 del corpo (tutto ciò che segue la prima riga), con fine
 * riga LF, calcolato con `node:crypto`: è l'unico builtin ammesso nel nucleo
 * (un hash è deterministico e non rompe la purezza).
 */

/** Versione del generatore: cambia quando cambia la forma dei file generati. */
export const GENERATOR_VERSION = "1";

/** SHA-256 di una stringa (UTF-8), in esadecimale minuscolo. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** L'intestazione in forma di commento `//` (file TS/TSX del generatore). */
const TS_HEADER = /^\/\/ @generated pds (\S+) sha256:([0-9a-f]{64}) — non modificare a mano$/;

/** L'intestazione in forma di commento `/* … *\/` (file CSS del tema). */
const CSS_HEADER = /^\/\* @generated pds (\S+) sha256:([0-9a-f]{64}) — non modificare a mano \*\/$/;

const lf = (text: string): string => text.replace(/\r\n?/g, "\n");

/** Il file completo: intestazione `//` + corpo (fine riga LF). */
export function withGeneratedHeader(body: string): string {
  const normalized = lf(body);
  return `// @generated pds ${GENERATOR_VERSION} sha256:${sha256Hex(normalized)} — non modificare a mano\n${normalized}`;
}

/** Il file completo: intestazione `/* … *\/` + corpo (fine riga LF), per i file CSS del tema. */
export function withGeneratedCssHeader(body: string): string {
  const normalized = lf(body);
  return `/* @generated pds ${GENERATOR_VERSION} sha256:${sha256Hex(normalized)} — non modificare a mano */\n${normalized}`;
}

export interface GeneratedHeader {
  readonly version: string;
  readonly hash: string;
  /** L'hash corrisponde al corpo: il file non è stato modificato a mano. */
  readonly ok: boolean;
}

/** L'intestazione `@generated` di un file, `undefined` se la prima riga non è un'intestazione del generatore. Legge entrambe le forme (commento `//` e commento CSS). */
export function readGeneratedHeader(text: string): GeneratedHeader | undefined {
  const normalized = lf(text);
  const newline = normalized.indexOf("\n");
  const first = newline === -1 ? normalized : normalized.slice(0, newline);
  const match = TS_HEADER.exec(first) ?? CSS_HEADER.exec(first);
  if (match === null) return undefined;
  const body = newline === -1 ? "" : normalized.slice(newline + 1);
  return { version: match[1]!, hash: match[2]!, ok: sha256Hex(body) === match[2] };
}

/** Il file ha il marker `@generated` del generatore (anche se modificato a mano). */
export function isGenerated(text: string): boolean {
  return readGeneratedHeader(text) !== undefined;
}
