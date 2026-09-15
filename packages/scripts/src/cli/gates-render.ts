import { runGatesCommand, type GatesArgs } from "../emitter/gates-runner";
import { isDirectInvocation } from "../shared/direct-invocation";

/**
 * Entry CLI di `gates:render` (Story 2.6, Task 8): parsing, guardia e
 * `main`. I cinque gate e il report sono in `src/emitter/gates-runner.ts`.
 */

/** Argomenti di gates:render: solo `--json <path>`; il resto è un errore loud. */
export function parseGatesArgs(args: readonly string[]): GatesArgs {
  const rest = args.filter((arg) => arg !== "--");
  let jsonPath: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--json") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Opzione --json richiede un percorso file.");
      jsonPath = value;
      index++;
    } else {
      throw new Error(`Argomento non riconosciuto: ${arg} — usare [--json <path>].`);
    }
  }
  return jsonPath === undefined ? {} : { jsonPath };
}

async function main(): Promise<number> {
  return runGatesCommand(parseGatesArgs(process.argv.slice(2)));
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
