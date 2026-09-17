import { isDirectInvocation } from "../shared/direct-invocation";
import { libraryCommand } from "./commands/library";
import { proposeCommand } from "./commands/propose";
import { themeCommand } from "./commands/theme";
import { runShell, type Command } from "./shell";

/**
 * L'UNICO entry CLI della v2 (CAP-8): guardia di invocazione diretta,
 * `main()` che restituisce il codice, `process.exit` solo qui. I comandi
 * entrano in questa lista una story alla volta (`theme` dalla 2.12,
 * `library`/`propose` dalla 2.13, `extract`/`render` 2.14, `gates` 2.15); in
 * `package.json` ogni comando è `node --import tsx src/v2/cli.ts <comando>`.
 */
export const COMMANDS: readonly Command[] = [themeCommand, libraryCommand, proposeCommand];

export function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  return runShell(argv, COMMANDS);
}

// Solo da invocazione diretta, mai a un `import` (test o altri moduli).
if (isDirectInvocation(import.meta.url)) {
  void main().then((code) => {
    process.exit(code);
  });
}
