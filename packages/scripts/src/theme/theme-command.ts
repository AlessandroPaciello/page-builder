import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PATHS } from "../shared/paths";
import { generateTheme, type TokenCatalog } from "../shared/theme-generator";
import { readPenpotTokenCatalog } from "./penpot-reader";

/**
 * Stadio 1 (token), pura rispetto al processo: nessun `process.exit*`, nessun
 * parsing di `argv`. La chiamano l'entry v1 `src/cli/generate-theme.ts` e il
 * comando v2 `theme` (Story 2.12): stesso comportamento, un solo corpo.
 */

export interface ThemeDeps {
  /** Default: `PATHS.catalogPath`. */
  readonly catalogPath?: string;
  /** Default: `PATHS.tokensSrcDir`. */
  readonly tokensSrcDir?: string;
  /** Seam per i test: lettura live mockata. Default: `readPenpotTokenCatalog()`. */
  readonly readLive?: () => Promise<TokenCatalog>;
  readonly log?: (text: string) => void;
}

/**
 * Scrittura atomica (temp + rename): un crash a metà write non lascia mai un
 * file troncato né nella fixture né nei file generati committati.
 */
function writeAtomic(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, filePath);
}

/**
 * Lettura del catalogo. In modalità live la fixture NON viene scritta qui:
 * viene aggiornata solo DOPO che la generazione è riuscita (`writeTheme`) —
 * un catalogo con riferimenti rotti o tipi sconosciuti non deve mai
 * corrompere la fixture committata.
 */
export async function loadThemeCatalog(live: boolean, deps: ThemeDeps = {}): Promise<TokenCatalog> {
  if (!live) {
    return JSON.parse(readFileSync(deps.catalogPath ?? PATHS.catalogPath, "utf8")) as TokenCatalog;
  }
  const catalog = await (deps.readLive ?? readPenpotTokenCatalog)();
  (deps.log ?? console.log)("Catalogo letto dal server MCP Penpot (live)");
  return catalog;
}

/** Genera e scrive `tailwind-theme.css` + `tokens.generated.ts`; con `live` aggiorna anche la fixture committata. */
export function writeTheme(catalog: TokenCatalog, live: boolean, deps: ThemeDeps = {}): void {
  const log = deps.log ?? console.log;
  const tokensSrcDir = deps.tokensSrcDir ?? PATHS.tokensSrcDir;
  const catalogPath = deps.catalogPath ?? PATHS.catalogPath;
  const { css, ts } = generateTheme(catalog);

  writeAtomic(resolve(tokensSrcDir, "tailwind-theme.css"), css);
  writeAtomic(resolve(tokensSrcDir, "tokens.generated.ts"), ts);

  if (live) {
    writeAtomic(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    log(`Fixture cache aggiornata: ${catalogPath}`);
  }

  log("Generati packages/tokens/src/tailwind-theme.css e tokens.generated.ts");
}

/** Corpo completo di `generate:theme` / `theme`: lettura (fixture o live) poi scrittura. */
export async function runTheme(args: { readonly live: boolean }, deps: ThemeDeps = {}): Promise<void> {
  const catalog = await loadThemeCatalog(args.live, deps);
  writeTheme(catalog, args.live, deps);
}
