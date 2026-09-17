import { loadThemeCatalog, writeTheme, type ThemeDeps } from "../../theme/theme-command";
import { ScriptError } from "../errors";
import { parseArgs, type Command } from "../shell";

/**
 * `theme [--live]` (commands.md): Stadio 1 token, invariato dalla v1 —
 * cambia solo il nome del comando e l'uscita passa dal guscio. Offline
 * rigenera dalla fixture committata; `--live` legge il catalogo da Penpot e
 * aggiorna anche la fixture. Mai in CI né in build.
 *
 * Categorie: la lettura live che fallisce è `penpot`; una fixture illeggibile
 * o un catalogo che non genera (riferimenti rotti, tipi ignoti) è `input`.
 */

const USAGE = "theme [--live]";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function themeCommandWith(deps: ThemeDeps = {}): Command {
  return {
    name: "theme",
    usage: USAGE,
    async run(argv) {
      const live = parseArgs(argv, { usage: USAGE, flags: ["--live"] }).flags.has("--live");
      let catalog;
      try {
        catalog = await loadThemeCatalog(live, deps);
      } catch (error: unknown) {
        throw new ScriptError({ kind: live ? "penpot" : "input", detail: messageOf(error), cause: error });
      }
      try {
        writeTheme(catalog, live, deps);
      } catch (error: unknown) {
        throw new ScriptError({ kind: "input", detail: messageOf(error), cause: error });
      }
      return 0;
    },
  };
}

export const themeCommand: Command = themeCommandWith();
