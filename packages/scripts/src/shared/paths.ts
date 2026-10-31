import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Unico modulo con i path dei package vicini che `@penpot-ds/scripts` legge o
 * scrive (Story 2.18, poi 2.26: la fixture committata del catalogo e il
 * comando `theme` sono stati rimossi). Nessun altro file calcola un path da
 * `import.meta.url`: uno spostamento del codice si aggiorna qui, e
 * `tests/paths.test.ts` fallisce nominando la chiave che punta a un file
 * inesistente. I seam dei test (`dir`, `root`, `paths`) restano intatti: qui
 * vivono solo i default dei comandi veri.
 */

/** `packages/scripts`: questo file è in `src/shared/`. */
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** `packages/`: la radice dei package vicini. */
const packagesRoot = dirname(packageRoot);

export const PATHS = {
  packageRoot,
  /** Radice del monorepo. */
  repoRoot: dirname(packagesRoot),
  /** `packages/tokens/src`: `extract_theme` scrive qui il tema. */
  tokensSrcDir: resolve(packagesRoot, "tokens/src"),
} as const;

export type PathKey = keyof typeof PATHS;
