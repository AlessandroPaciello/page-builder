/**
 * Un solo errore per tutti i comandi v2 (CAP-8, Story 2.12): la categoria
 * decide l'exit code, i campi opzionali nominano dove (componente, cella,
 * parte) e `detail` dice cosa e come adattarsi. Nessun comando scrive
 * `process.exitCode`: lancia uno `ScriptError` e il guscio (`shell.ts`) lo
 * traduce in codice d'uscita. Un errore non tipizzato vale `1`.
 *
 *   1 input     argomento mancante, flag duplicato, file non leggibile
 *   2 penpot    MCP irraggiungibile, timeout, container assente
 *   3 contract  parte fuori `when`, token fuori ruolo, cella mancante, contratto di estrazione incoerente
 *   4 gate      diff in `render --check`, suite ui rossa
 */

export const ERROR_KINDS = ["input", "penpot", "contract", "gate"] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

export const EXIT_CODES: Readonly<Record<ErrorKind, 1 | 2 | 3 | 4>> = { input: 1, penpot: 2, contract: 3, gate: 4 };

export interface ScriptErrorInit {
  readonly kind: ErrorKind;
  /** Nome del componente (PascalCase, come il container Penpot). */
  readonly component?: string;
  /** Chiave della cella (`promo=none|hover=off`). */
  readonly cell?: string;
  /** Nome della parte del contratto di estrazione. */
  readonly part?: string;
  /** Cosa non va e, se esiste, l'adattamento proposto. */
  readonly detail: string;
  readonly cause?: unknown;
}

/** `ProductCard · cella promo=none|hover=off · parte "badge"`, vuoto se nessun campo è valorizzato. */
function locationOf(init: Pick<ScriptErrorInit, "component" | "cell" | "part">): string {
  const pieces: string[] = [];
  if (init.component !== undefined) pieces.push(init.component);
  if (init.cell !== undefined) pieces.push(`cella ${init.cell}`);
  if (init.part !== undefined) pieces.push(`parte "${init.part}"`);
  return pieces.join(" · ");
}

export class ScriptError extends Error {
  override readonly name = "ScriptError";
  readonly kind: ErrorKind;
  readonly component?: string;
  readonly cell?: string;
  readonly part?: string;
  readonly detail: string;

  constructor(init: ScriptErrorInit) {
    const where = locationOf(init);
    super(`${init.kind}: ${where === "" ? "" : `${where} — `}${init.detail}`, init.cause === undefined ? undefined : { cause: init.cause });
    this.kind = init.kind;
    this.detail = init.detail;
    if (init.component !== undefined) this.component = init.component;
    if (init.cell !== undefined) this.cell = init.cell;
    if (init.part !== undefined) this.part = init.part;
  }
}

/** L'exit code di un errore qualsiasi: la categoria dello `ScriptError`, altrimenti `1`. */
export function exitCodeOf(error: unknown): number {
  return error instanceof ScriptError ? EXIT_CODES[error.kind] : 1;
}

/**
 * Il messaggio a schermo, nella forma della simulazione della card:
 *
 *   ✖ contract  ProductCard · cella promo=none|hover=off · parte "badge"
 *     presente in Penpot ma il contratto la ammette solo con promo ∈ {offer, discount}. …
 */
export function formatScriptError(error: ScriptError): string {
  const where = locationOf(error);
  const head = `✖ ${error.kind}  ${where}`.trimEnd();
  return `${head}\n  ${error.detail}`;
}
