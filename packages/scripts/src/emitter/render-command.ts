import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { loadJudgment, loadPartAliases } from "../extract/extract-component";
import { validateRecipe } from "../extract/validate-recipe";
import { committedComponents, loadBaseSources, loadBinding, loadCatalog, loadFixture, loadRecipe, readExistingFiles, domainsRoot, basesDir } from "./artifacts";
import { renderCheck, renderComponent } from "./render-component";

/**
 * Logica del CLI dell'emitter shadcn (Story 2.6, AC #1); l'entry è
 * `src/cli/render-component.ts` (fail-loud, write atomico):
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

/**
 * `--all`: rende (o verifica con `--check`) ogni componente con ricetta
 * committata. In `--check` un componente divergente porta l'exit a 1 ma i
 * successivi girano comunque, così il log nomina TUTTI i divergenti. Un
 * componente che lancia (ricetta non conforme, base assente) non ferma il
 * loop: il suo errore nominativo entra nell'elenco finale.
 */
export async function runRenderAll(args: RenderAllArgs, options: RenderCliOptions = {}): Promise<void> {
  const components = committedComponents();
  const previousExitCode = process.exitCode;
  const divergent: string[] = [];
  const failed: string[] = [];
  try {
    for (const componentName of components) {
      process.exitCode = 0;
      try {
        await runRender({ componentName, check: args.check, baseDir: args.baseDir }, options);
      } catch (cause) {
        failed.push(`${componentName}: ${(cause as Error).message}`);
        continue;
      }
      if (process.exitCode !== 0) divergent.push(componentName);
    }
  } finally {
    process.exitCode = previousExitCode;
  }
  if (failed.length > 0 || divergent.length > 0) {
    process.exitCode = 1;
    const parts: string[] = [];
    if (failed.length > 0) parts.push(`${failed.length} di ${components.length} componenti in errore: ${failed.join(" | ")}`);
    if (divergent.length > 0) parts.push(`${divergent.length} di ${components.length} componenti NON a diff zero: ${divergent.join(", ")}`);
    console.error(`✗ Check fallito: ${parts.join(" — ")}.`);
    return;
  }
  console.log(`${args.check ? "Verificati" : "Resi"} ${components.length} componenti: ${components.join(", ")}.`);
}

export interface RenderCliOptions {
  /** Seam per i test: radice di destinazione invece di `packages/ui/src/domains/`. */
  domainsDir?: string;
  /** Seam per i test: radice delle basi shadcn invece di `data/bases/`. */
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
  const validation = validateRecipe(fixture, recipe, catalog, judgment, loadPartAliases(args.componentName));
  if (!validation.valid) {
    throw new Error(
      `La ricetta di "${args.componentName}" non è conforme al contratto:\n${validation.errors.join("\n")}`,
    );
  }

  const targetRoot = options.domainsDir ?? domainsRoot;
  const existing = readExistingFiles(targetRoot);
  const result = renderComponent(fixture, recipe, binding, baseSources, catalog, { existingFiles: existing });

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
