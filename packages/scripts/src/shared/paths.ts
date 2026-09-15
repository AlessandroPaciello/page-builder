import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Unico modulo con i path dei dati committati di `@penpot-ds/scripts`, dei
 * package vicini e della radice dei file generati. Nessun altro file calcola
 * un path da `import.meta.url`: uno spostamento del codice si aggiorna qui,
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
const contractsRoot = resolve(packagesRoot, "contracts");
const uiPackageRoot = resolve(packagesRoot, "ui");

export const PATHS = {
  packageRoot,
  /** Radice del monorepo. */
  repoRoot: dirname(packagesRoot),
  dataDir,
  /** Catalogo token Stadio 1 committato (`generate:theme` lo legge; con `--live` lo riscrive). */
  catalogPath: resolve(dataDir, "penpot-catalog.json"),
  /** `<comp>.fixture.json` e `<comp>.recipe.json`. */
  recipesDir: resolve(dataDir, "recipes"),
  /** `judgments/<contratto>.json`: il giudizio scritto a mano. */
  judgmentsDir: resolve(dataDir, "recipes/judgments"),
  /** `<kebab>.binding.json`: tabelle di binding dell'emitter shadcn. */
  bindingsDir: resolve(dataDir, "bindings"),
  /** `<base>/*.tsx`: basi shadcn committate, input dell'emitter. */
  basesDir: resolve(dataDir, "bases"),
  /** `<contratto>.design.json`: il disegno di partenza della library. */
  designsDir: resolve(dataDir, "designs"),
  /** Snapshot della library committato (`verify:library --snapshot`). */
  librarySnapshotPath: resolve(dataDir, "library.snapshot.json"),
  /** Valori del bootstrap della library (palette + semantic). */
  semanticSeedPath: resolve(dataDir, "semantic-tokens.seed.json"),
  /** `packages/tokens/src`: `generate:theme` scrive qui il tema. */
  tokensSrcDir: resolve(packagesRoot, "tokens/src"),
  contractsRoot,
  /** `packages/contracts/src`: `components/<nome>.ts` e `schema-version.ts`. */
  contractsSrcDir: resolve(contractsRoot, "src"),
  fingerprintPath: resolve(contractsRoot, "tests/contracts.fingerprint.json"),
  /** `packages/ui`: la cwd della suite ui nel gate a11y. */
  uiPackageRoot,
  /** Radice dei file generati: `packages/ui/src/domains/`. */
  domainsRoot: resolve(uiPackageRoot, "src/domains"),
} as const;

export type PathKey = keyof typeof PATHS;
