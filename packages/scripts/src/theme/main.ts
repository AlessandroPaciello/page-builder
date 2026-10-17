import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { loadThemeCatalog, writeTheme, type ThemeDeps } from "./theme-command";

/**
 * Entrypoint di `pnpm --filter @penpot-ds/scripts theme [--live]` (Story
 * 2.18): sostituisce il guscio CLI della v2, rimosso. Offline rigenera il tema
 * dalla fixture committata; `--live` legge il catalogo da Penpot e aggiorna
 * anche la fixture. Mai in CI né in build.
 *
 * Uscite (le stesse del guscio v2):
 *   0  tema rigenerato
 *   1  input: argomento ignoto, fixture illeggibile, catalogo che non genera
 *   2  penpot: la lettura live fallisce (MCP irraggiungibile, token mancante)
 *
 * `themeMain` è pura rispetto al processo (restituisce il codice); solo
 * l'invocazione diretta qui sotto chiama `process.exit`: esplicito, perché
 * un transport MCP rimasto aperto (timeout di `withTimeout`) terrebbe vivo
 * il processo.
 */

export const USAGE = "uso: pnpm --filter @penpot-ds/scripts theme [-- --live]";

export interface ThemeMainDeps extends ThemeDeps {
  /** Default: `console.error`. */
  readonly err?: (text: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function themeMain(argv: readonly string[], deps: ThemeMainDeps = {}): Promise<number> {
  const err = deps.err ?? console.error;
  const args = argv.filter((arg) => arg !== "--");
  const unknown = args.filter((arg) => arg !== "--live");
  if (unknown.length > 0 || args.length > 1) {
    const detail = unknown.length > 0 ? `argomento "${unknown[0]}" non riconosciuto` : "opzione --live duplicata";
    err(`✖ input  ${detail}\n  ${USAGE}`);
    return 1;
  }
  const live = args.length === 1;

  let catalog;
  try {
    catalog = await loadThemeCatalog(live, deps);
  } catch (error: unknown) {
    err(`✖ ${live ? "penpot" : "input"}\n  ${messageOf(error)}`);
    return live ? 2 : 1;
  }
  try {
    writeTheme(catalog, live, deps);
  } catch (error: unknown) {
    err(`✖ input\n  ${messageOf(error)}`);
    return 1;
  }
  return 0;
}

/** Vero solo se questo modulo è l'entry eseguita, mai a un `import` dei test. */
function isDirectInvocation(): boolean {
  if (process.argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  void themeMain(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
