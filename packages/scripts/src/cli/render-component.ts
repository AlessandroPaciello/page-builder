import { runRender, runRenderAll, type RenderAllArgs, type RenderCliArgs } from "../emitter/render-command";
import { isDirectInvocation } from "../shared/direct-invocation";

/**
 * Entry CLI dell'emitter shadcn (Story 2.6, AC #1): parsing, guardia e
 * `main`. La logica è in `src/emitter/render-command.ts`.
 *
 *   render:component -- <Name>|--all [--check] [--base <dir>]
 *
 * Per componente e su richiesta, MAI in build: in CI gira solo `--check`
 * (gate rigenerazione) e i gate (`gates:render`), mai la scrittura.
 */

const USAGE = "pnpm render:component -- <Nome>|--all [--check] [--base <dir>]";

export function parseArgs(args: readonly string[]): RenderCliArgs | RenderAllArgs {
  // pnpm inoltra il separatore "--" fra script e argomenti: va rimosso, non è un flag.
  const withAll = args.filter((arg) => arg !== "--");
  const allCount = withAll.filter((arg) => arg === "--all").length;
  if (allCount > 1) throw new Error("Opzione --all duplicata.");
  const rest = withAll.filter((arg) => arg !== "--all");
  let componentName: string | undefined;
  let options: string[];
  if (allCount === 1) {
    if (rest[0] !== undefined && !rest[0].startsWith("--")) {
      throw new Error(`--all e il nome componente "${rest[0]}" sono alternativi — usare: ${USAGE}.`);
    }
    options = rest;
  } else {
    [componentName, ...options] = rest;
    if (!componentName || componentName.startsWith("--")) {
      throw new Error(`Nome componente mancante — usare: ${USAGE}.`);
    }
  }
  let check = false;
  let baseDir: string | undefined;
  for (let index = 0; index < options.length; index++) {
    const arg = options[index];
    if (arg === "--check") {
      if (check) throw new Error("Opzione --check duplicata.");
      check = true;
    } else if (arg === "--base") {
      const value = options[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Opzione --base richiede una directory.");
      if (baseDir !== undefined) throw new Error(`Opzione --base duplicata ("${baseDir}" e "${value}").`);
      baseDir = value;
      index++;
    } else {
      throw new Error(`Argomento "${arg}" non riconosciuto — usare: ${USAGE}.`);
    }
  }
  if (componentName === undefined) return { all: true, check, baseDir };
  return { componentName, check, baseDir };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if ("all" in args) await runRenderAll(args);
  else await runRender(args);
}

// Esegui `main()` solo da invocazione diretta, mai a un semplice `import`
// (es. dai test che importano `parseArgs`).
if (isDirectInvocation(import.meta.url)) {
  main()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
