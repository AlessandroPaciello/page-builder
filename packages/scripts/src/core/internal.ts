/**
 * Helper interni al nucleo, condivisi tra i suoi moduli. Questo file non è
 * riesportato da `index.ts`: niente di quello che sta qui è API pubblica.
 */

/** Il messaggio con il suffisso "La risposta X non è valida." quando c'è una risposta (sbagliata). */
export function withInvalidAnswer(message: string, answer: string | undefined): string {
  return answer === undefined ? message : `${message} La risposta "${answer}" non è valida.`;
}

/** Comparatore di stringhe per codice (lo stesso ordine di `.sort()` senza argomento). */
export function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Le varianti di una cella in chiaro: "senza varianti" oppure "k=v, …". */
export function variantLabel(variant: Readonly<Record<string, string>>): string {
  const entries = Object.entries(variant);
  return entries.length === 0 ? "senza varianti" : entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

/** I valori del dimensionamento di un layer su un asse (`auto` = hug). */
export const SIZING_VALUES = ["fix", "fill", "auto"] as const;

/** Il dimensionamento quando manca. */
export const SIZING_DEFAULT = "fix" satisfies (typeof SIZING_VALUES)[number];
