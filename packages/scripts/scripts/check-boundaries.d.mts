export interface BoundaryViolation {
  /** Path relativo alla root del package. */
  file: string;
  /** Numero di riga, o `"?"` per le violazioni del backstop raw (senza riga). */
  line?: number | "?";
  specifier?: string;
  /** Regola v3 violata (Story 2.19); assente per le regole di package. */
  rule?: BoundaryRule;
  /** Perché è rosso; per le regole v3 comincia con `<regola>:`. */
  reason?: string;
  text?: string;
}

/** Le regole delle cartelle v3 (Story 2.19). */
export type BoundaryRule = "core" | "penpot" | "server" | "v3";

/** Descrizione di ogni regola v3: la stampa il CLI, e ogni `reason` ne contiene il testo. */
export const BOUNDARY_RULES: Readonly<Record<BoundaryRule, string>>;

export interface BoundaryScanError {
  path: string;
  reason: string;
}

export interface BoundaryReport {
  violations: BoundaryViolation[];
  scanErrors: BoundaryScanError[];
  scannedFileCount: number;
}

/** `@app/*` vietato tranne `@app/contracts` (senza traversate `..`/`.`). */
export function isForbiddenSpecifier(specifier: string): boolean;
/** True se `specifier`, risolto rispetto a `file`, esce dalla radice del package. */
export function escapesPackageRoot(packageRoot: string, file: string, specifier: string): boolean;
/** True se `specifier` importa il client MCP (`@modelcontextprotocol/sdk/…/client…`). */
export function isMcpClientSpecifier(specifier: string): boolean;
export function checkBoundaries(options: { packageRoot: string }): BoundaryReport;
