import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Unico modulo con i path dei dati committati di `@penpot-ds/scripts` e dei
 * package vicini che `theme` legge o scrive (Story 2.18: via i path della
 * v2). Nessun altro file calcola un path da `import.meta.url`: uno
 * spostamento del codice si aggiorna qui,
 * e `tests/paths.test.ts` fallisce nominando la chiave che punta a un file
 * inesistente. I seam dei test (`dir`, `root`, `paths`) restano intatti: qui
 * vivono solo i default dei comandi veri.
 */

/** `packages/scripts`: questo file è in `src/shared/`. */
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** `packages/`: la radice dei package vicini. */
const packagesRoot = dirname(packageRoot);
/** Dati committati: fuori da `src/`, così le skill e il designer puntano a una radice stabile. */
const dataDir = resolve(packageRoot, "data");

export const PATHS = {
  packageRoot,
  /** Radice del monorepo. */
  repoRoot: dirname(packagesRoot),
  dataDir,
  /** Catalogo token Stadio 1 committato (`theme` lo legge; con `--live` lo riscrive). */
  catalogPath: resolve(dataDir, "penpot-catalog.json"),
  /** `packages/tokens/src`: `theme` scrive qui il tema. */
  tokensSrcDir: resolve(packagesRoot, "tokens/src"),
} as const;

export type PathKey = keyof typeof PATHS;
