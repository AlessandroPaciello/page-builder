/**
 * Contrasto WCAG 2.x (luminanza relativa) come helper puro: la regola
 * "≥ 4.5:1 per il testo, ≥ 3:1 per gli indicatori" di design-system.md
 * diventa un controllo meccanico (`verifyLibrary`, regola 10), non una
 * revisione a occhio — il bug `border` 1.5:1 della Story 2.1 è la lezione.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

/** Parser dei valori colore dei token: esadecimale a 6 cifre, con o senza `#`. `null` se non valido. */
export function parseHex(value: string): Rgb | null {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match?.[1]) return null;
  const int = Number.parseInt(match[1], 16);
  return { r: (int >> 16) & 0xff, g: (int >> 8) & 0xff, b: int & 0xff };
}

function channelLuminance(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** Luminanza relativa WCAG (0..1) da canali sRGB 0..255. */
export function relativeLuminance(color: Rgb): number {
  return 0.2126 * channelLuminance(color.r) + 0.7152 * channelLuminance(color.g) + 0.0722 * channelLuminance(color.b);
}

/**
 * Rapporto di contrasto WCAG fra due valori hex: `(L1 + 0.05) / (L2 + 0.05)`
 * con L1 ≥ L2 (il rapporto è simmetrico). Lancia su hex non valido: il
 * chiamante (`verifyLibrary`) nomina il token, qui si fallisce loud.
 */
export function contrastRatio(a: string, b: string): number {
  const colorA = parseHex(a);
  const colorB = parseHex(b);
  if (!colorA) {
    throw new Error(`Colore non valido per il calcolo del contrasto: ${JSON.stringify(a)} (atteso esadecimale a 6 cifre).`);
  }
  if (!colorB) {
    throw new Error(`Colore non valido per il calcolo del contrasto: ${JSON.stringify(b)} (atteso esadecimale a 6 cifre).`);
  }
  const luminanceA = relativeLuminance(colorA);
  const luminanceB = relativeLuminance(colorB);
  const [lighter, darker] = luminanceA >= luminanceB ? [luminanceA, luminanceB] : [luminanceB, luminanceA];
  return (lighter + 0.05) / (darker + 0.05);
}
