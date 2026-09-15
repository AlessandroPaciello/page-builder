import { runBump, type BumpArgs } from "../library/bump-command";
import { parseComponentArgs } from "./component-args";
import { isDirectInvocation } from "../shared/direct-invocation";

/**
 * Entry CLI di `bump:contract` (Story 2.7 parte B): parsing, guardia e
 * `main`. La logica è in `src/library/bump-command.ts`.
 *
 *   bump:contract -- <Comp> [--dry-run | --yes] [--snapshot <path>]
 */

const USAGE = "uso: pnpm bump:contract -- <Comp> [--dry-run | --yes] [--snapshot <path>]";

export function parseBumpArgs(args: readonly string[]): BumpArgs {
  return parseComponentArgs(args, USAGE);
}

async function main(): Promise<number> {
  return runBump(parseBumpArgs(process.argv.slice(2)));
}

if (isDirectInvocation(import.meta.url)) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
