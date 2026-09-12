import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadJudgment } from "../extract-component";
import { validateRecipe } from "../validate-recipe";
import { committedComponents, loadBaseSources, loadBinding, loadCatalog, loadFixture, loadRecipe, readExistingFiles, domainsRoot, basesDir } from "./artifacts";
import { renderCheck, renderComponent } from "./render-component";

/**
 * CLI dell'emitter shadcn (Story 2.6, AC #1), sul pattern di
 * `extract-component.ts` (fail-loud, `isDirectInvocation`, write atomico):
 *
 *   render:component -- <Name> [--check] [--base <dir>]
 *     genera i 4 file `@generated` in `packages/ui/src/domains/<domain>/`;
 *     `--check` riusa `renderCheck` senza scrivere: rigenerazione a diff
 *     zero, exit ≠ 0 nominando componente e file divergente. Un file senza
 *     marker `@generated` non è MAI sovrascritto (skip con log, non errore).
 *
 * Per componente e su richiesta, MAI in build: in CI gira solo `--check`
 * (gate rigenerazione) e i gate (`gates:render`), mai la scrittura.
 */

export interface RenderCliArgs {
  componentName: string;
  check: boolean;
  baseDir?: string;
}

/** `--all`: tutti i componenti con ricetta committata (`committedComponents`), mai una lista a mano. */
export interface RenderAllArgs {
  all: true;
  check: boolean;
  baseDir?: string;
}

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

/**
 * `--all`: rende (o verifica con `--check`) ogni componente con ricetta
 * committata. In `--check` un componente divergente porta l'exit a 1 ma i
 * successivi girano comunque, così il log nomina TUTTI i divergenti.
 */
export async function runRenderAll(args: RenderAllArgs, options: RenderCliOptions = {}): Promise<void> {
  const components = committedComponents();
  const previousExitCode = process.exitCode;
  const divergent: string[] = [];
  for (const componentName of components) {
    process.exitCode = 0;
    await runRender({ componentName, check: args.check, baseDir: args.baseDir }, options);
    if (process.exitCode !== 0) divergent.push(componentName);
  }
  process.exitCode = previousExitCode;
  if (divergent.length > 0) {
    process.exitCode = 1;
    console.error(
      `✗ Check fallito: ${divergent.length} di ${components.length} componenti NON a diff zero: ${divergent.join(", ")}.`,
    );
    return;
  }
  console.log(`${args.check ? "Verificati" : "Resi"} ${components.length} componenti: ${components.join(", ")}.`);
}

export interface RenderCliOptions {
  /** Seam per i test: radice di destinazione invece di `packages/ui/src/domains/`. */
  domainsDir?: string;
  /** Seam per i test: radice delle basi shadcn invece di `src/emitter/bases/`. */
  baseRoot?: string;
}

export async function runRender(args: RenderCliArgs, options: RenderCliOptions = {}): Promise<void> {
  const fixture = loadFixture(args.componentName);
  const recipe = loadRecipe(args.componentName);
  const binding = loadBinding(args.componentName);
  const catalog = loadCatalog();
  const judgment = loadJudgment(fixture.contract.split("@")[0]!);
  const baseSources = loadBaseSources(binding.base, args.baseDir ?? options.baseRoot ?? basesDir);

  // Gate conformità PRIMA del rendering: da una ricetta non conforme
  // l'emitter produrrebbe classi sbagliate in silenzio.
  const validation = validateRecipe(fixture, recipe, catalog, judgment);
  if (!validation.valid) {
    throw new Error(
      `La ricetta di "${args.componentName}" non è conforme al contratto:\n${validation.errors.join("\n")}`,
    );
  }

  const targetRoot = options.domainsDir ?? domainsRoot;
  const existing = readExistingFiles(targetRoot);
  const result = renderComponent(fixture, recipe, binding, baseSources, catalog, { existingFiles: existing });

  for (const skipped of result.skippedProperties) {
    console.log(
      `SKIP proprietà "${skipped.property}" (parte "${skipped.part}", cella "${skipped.cell}", token "${skipped.token}"): ${skipped.reason}`,
    );
  }

  if (args.check) {
    const check = renderCheck(result.files, existing);
    if (!check.equal) {
      for (const divergence of check.divergences) {
        console.error(
          `✗ ${args.componentName}: file generato ${divergence.reason === "missing" ? "assente" : "divergente"}: ${divergence.path}`,
        );
      }
      console.error(`Rigenerazione di "${args.componentName}" NON a diff zero — riestrai o rigenera con render:component.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Rigenerazione di "${args.componentName}" a diff zero (${result.files.length} file attesi).`);
    return;
  }

  for (const file of result.files) {
    const absolute = resolve(targetRoot, file.path);
    if (file.action === "skip") {
      console.log(`SKIP (senza marker @generated, mai sovrascritto): ${absolute}`);
      continue;
    }
    mkdirSync(dirname(absolute), { recursive: true });
    const tmp = `${absolute}.tmp`;
    writeFileSync(tmp, file.content, "utf8");
    renameSync(tmp, absolute);
    console.log(`Scritto: ${absolute}`);
  }
  console.log(
    `Componente "${args.componentName}" emesso in ${result.domain}/ (provenienza: penpotComponentId=${fixture.penpotComponentId} fixtureHash=${recipe.fixtureHash}).`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if ("all" in args) await runRenderAll(args);
  else await runRender(args);
}

// Esegui `main()` solo da invocazione diretta, mai a un semplice `import`
// (es. dai test che importano `parseArgs`): stessa guardia di extract-component.ts.
const isDirectInvocation = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectInvocation) {
  main()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
