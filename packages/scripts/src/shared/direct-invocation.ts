import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * True se il modulo all'URL dato è eseguito come entry CLI diretta, non
 * importato da test o da altri moduli. Unica guardia di tutti gli entrypoint
 * in `src/cli/`: una sola definizione, stessa semantica ovunque. Il
 * `realpathSync` gestisce l'invocazione via symlink (stesso schema del gate
 * `check-boundaries.mjs`).
 */
export function isDirectInvocation(moduleUrl: string): boolean {
  if (process.argv[1] === undefined) return false;
  try {
    return moduleUrl === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}
