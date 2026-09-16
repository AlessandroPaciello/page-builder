import type { BumpArgs } from "../library/bump-command";
import { runSyncDesign } from "../library/sync-design";
import { parseComponentArgs } from "./component-args";
import { isDirectInvocation } from "../shared/direct-invocation";

/**
 * Entry CLI di `sync:design` (Story 2.10, C): parsing, guardia e `main`. La
 * logica è in `src/library/sync-design.ts`.
 *
 *   sync:design -- <Comp> [--dry-run | --yes] [--snapshot <path>]
 */

const USAGE = "uso: pnpm sync:design -- <Comp> [--dry-run | --yes] [--snapshot <path>]";

export function parseSyncDesignArgs(args: readonly string[]): BumpArgs {
  return parseComponentArgs(args, USAGE);
}

async function main(): Promise<number> {
  return runSyncDesign(parseSyncDesignArgs(process.argv.slice(2)));
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
