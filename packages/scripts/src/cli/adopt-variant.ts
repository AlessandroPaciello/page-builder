import { runAdopt } from "../library/adopt-command";
import type { BumpArgs } from "../library/bump-command";
import { parseComponentArgs } from "./component-args";
import { isDirectInvocation } from "../shared/direct-invocation";

/**
 * Entry CLI di `adopt:variant` (Story 2.7 parte C): parsing, guardia e
 * `main`. La logica è in `src/library/adopt-command.ts`.
 *
 *   adopt:variant -- <Comp> [--dry-run | --yes] [--snapshot <path>]
 */

const USAGE = "uso: pnpm adopt:variant -- <Comp> [--dry-run | --yes] [--snapshot <path>]";

export function parseAdoptArgs(args: readonly string[]): BumpArgs {
  return parseComponentArgs(args, USAGE);
}

async function main(): Promise<number> {
  return runAdopt(parseAdoptArgs(process.argv.slice(2)));
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
