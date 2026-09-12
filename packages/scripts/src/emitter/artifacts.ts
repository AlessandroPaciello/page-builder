import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalogFixture, loadJudgment, fixturePathFor, recipePathFor, toKebab } from "../extract-component";
import { FixtureSchema, RecipeSchema, type ComponentFixture, type ComponentRecipe } from "../recipe-schema";
import type { TokenCatalog } from "../theme-generator";
import { BindingSchema, type ComponentBinding } from "./binding-shadcn";

/**
 * Caricamento degli artefatti committati dell'emitter (Story 2.6): fixture e
 * ricetta da `src/recipes/`, giudizio da `src/recipes/judgments/`, binding da
 * `src/emitter/bindings/`, basi shadcn da `src/emitter/bases/`. Tutto
 * validato ALLA FONTE con gli schemi: un JSON malformato produce un errore
 * che nomina il file e il campo, mai un SyntaxError grezzo a valle.
 */

const here = dirname(fileURLToPath(import.meta.url));

export const recipesDir = resolve(here, "../recipes");
export const bindingsDir = resolve(here, "bindings");
export const basesDir = resolve(here, "bases");
/** Radice dei file generati: `packages/ui/src/domains/`. */
export const domainsRoot = resolve(here, "../../../ui/src/domains");

export function loadCatalog(): TokenCatalog {
  return loadCatalogFixture();
}

/** JSON.parse incapsulato: un file malformato è un errore che nomina file e causa, mai un SyntaxError grezzo. */
function parseJsonFile(path: string): unknown {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Il file "${path}" non è JSON leggibile: ${(error as Error).message}`);
  }
  return json;
}

export function loadFixture(componentName: string, dir: string = recipesDir): ComponentFixture {
  const path = fixturePathFor(componentName, dir);
  if (!existsSync(path)) {
    throw new Error(`Fixture non trovata per "${componentName}": ${path} — estrai prima con extract:component.`);
  }
  const parsed = FixtureSchema.safeParse(parseJsonFile(path));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
    throw new Error(`Fixture malformata per "${componentName}" (${path}):\n${issues.join("\n")}`);
  }
  return parsed.data;
}

export function loadRecipe(componentName: string, dir: string = recipesDir): ComponentRecipe {
  const path = recipePathFor(componentName, dir);
  if (!existsSync(path)) {
    throw new Error(`Ricetta non trovata per "${componentName}": ${path} — estrai prima con extract:component.`);
  }
  const parsed = RecipeSchema.safeParse(parseJsonFile(path));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
    throw new Error(`Ricetta malformata per "${componentName}" (${path}):\n${issues.join("\n")}`);
  }
  return parsed.data;
}

export function loadBinding(componentName: string, dir: string = bindingsDir): ComponentBinding {
  const path = resolve(dir, `${toKebab(componentName)}.binding.json`);
  if (!existsSync(path)) {
    throw new Error(`Binding non trovato per "${componentName}": ${path} — scrivilo a mano (base, parti, assi).`);
  }
  const parsed = BindingSchema.safeParse(parseJsonFile(path));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
    throw new Error(`Binding malformato per "${componentName}" (${path}):\n${issues.join("\n")}`);
  }
  return parsed.data;
}

/**
 * Componenti coperti dai gate, derivati dalle ricette committate
 * (`src/recipes/*.recipe.json`, validate con RecipeSchema): un componente
 * futuro con ricetta committata entra nei gate per costruzione, non resta
 * fuori in silenzio da una lista hard-coded. Ordinati per output
 * deterministico.
 */
export function committedComponents(dir: string = recipesDir): string[] {
  const components: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".recipe.json")) continue;
    const path = resolve(dir, entry);
    const parsed = RecipeSchema.safeParse(parseJsonFile(path));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
      throw new Error(`Ricetta malformata (${path}):\n${issues.join("\n")}`);
    }
    components.push(parsed.data.componentName);
  }
  if (components.length === 0) {
    throw new Error(`Nessuna ricetta committata in ${dir} — i gate non hanno componenti da coprire.`);
  }
  return components.sort();
}

/** Sorgenti della base shadcn committata: nome file → contenuto. Input dell'emitter, mai del CLI a runtime. */
export function loadBaseSources(base: string, root: string = basesDir): Record<string, string> {
  const dir = resolve(root, base);
  if (!existsSync(dir)) {
    throw new Error(`Base shadcn "${base}" non trovata: ${dir} — committala sotto src/emitter/bases/ (shadcn add una tantum).`);
  }
  const sources: Record<string, string> = {};
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isFile() && entry.endsWith(".tsx")) sources[entry] = readFileSync(full, "utf8");
  }
  if (Object.keys(sources).length === 0) {
    throw new Error(`Base shadcn "${base}" non contiene nessun file .tsx: ${dir}`);
  }
  return sources;
}

/** Contenuti esistenti sotto la radice dei domini (percorso relativo → contenuto), per skip protettivo e --check. */
export function readExistingFiles(root: string = domainsRoot): Record<string, string> {
  const existing: Record<string, string> = {};
  const visit = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relative = prefix.length > 0 ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) visit(full, relative);
      else existing[relative] = readFileSync(full, "utf8");
    }
  };
  visit(root, "");
  return existing;
}

export { loadJudgment };
