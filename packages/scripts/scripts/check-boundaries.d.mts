export interface BoundaryViolation {
  /** Path relativo alla root del package. */
  file: string;
  /** Numero di riga, o `"?"` per le violazioni del backstop raw (senza riga). */
  line?: number | "?";
  specifier?: string;
  reason?: string;
  text?: string;
}

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
export function checkBoundaries(options: { packageRoot: string }): BoundaryReport;
