import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * True se il modulo all'URL dato è eseguito come entry CLI diretta, non
 * importato da test o da altri CLI. Condiviso dai CLI della library
 * (`bump:contract`, `adopt:variant`, `add:library`): una sola definizione,
 * stessa semantica ovunque.
 */
export function isDirectInvocation(moduleUrl: string): boolean {
  if (process.argv[1] === undefined) return false;
  try {
    return moduleUrl === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}
