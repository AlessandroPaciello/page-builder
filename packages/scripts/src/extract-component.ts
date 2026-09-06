import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readComponentFixture } from "./component-reader";
import { fixtureHash, type TokenCatalog } from "./theme-generator";
import { validateRecipe } from "./validate-recipe";
import { FixtureSchema } from "./recipe-schema";

/**
 * Entry CLI Stage 2 per componente (Story 2.2, Task 3):
 *
 *   extract:component -- <ComponentName>   estrazione LIVE da Penpot, scrive <comp>.fixture.json
 *   validate:recipe    -- <ComponentName>  offline: rigira validateRecipe su fixture+ricetta committati
 *
 * Entrambi i comandi sono per-componente e su richiesta, MAI in CI né in
 * build (AC #1): nessuno dei due entra in turbo.json come task cacheable.
 * `validate:recipe` diventerà un gate CI in Story 2.3 — non wire-arlo qui.
 */

const here = dirname(fileURLToPath(import.meta.url));
const recipesDir = resolve(here, "recipes");
const catalogFixturePath = resolve(here, "__fixtures__/penpot-catalog.json");

function loadCatalogFixture(): TokenCatalog {
  return JSON.parse(readFileSync(catalogFixturePath, "utf8")) as TokenCatalog;
}

/** Nome file kebab-case: "LifecycleBadge" → "lifecycle-badge". */
function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function fixturePathFor(componentName: string): string {
  return resolve(recipesDir, `${toKebab(componentName)}.fixture.json`);
}

function recipePathFor(componentName: string): string {
  return resolve(recipesDir, `${toKebab(componentName)}.recipe.json`);
}

function writeAtomic(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, filePath);
}

function parseArgs(args: readonly string[]): { mode: "extract" | "validate"; componentName: string } {
  // pnpm inoltra il separatore "--" fra script e argomenti: va rimosso, non è un flag.
  const [mode, componentName] = args.filter((arg) => arg !== "--");
  if (mode !== "extract" && mode !== "validate") {
    throw new Error(
      `Modalità "${mode ?? "<mancante>"}" non riconosciuta — usare "extract" o "validate": pnpm extract:component -- <Nome> | pnpm validate:recipe -- <Nome>.`,
    );
  }
  if (!componentName || componentName.startsWith("--")) {
    throw new Error(`Nome componente mancante — usare: pnpm ${mode === "extract" ? "extract:component" : "validate:recipe"} -- <Nome>.`);
  }
  return { mode, componentName };
}

async function extract(componentName: string): Promise<void> {
  // Sempre live (nessun default offline): l'estrazione è per-componente e su
  // richiesta, mai batch/CI (AC #1). Il vocabolario per il binding, invece,
  // è SEMPRE la fixture Stadio 1 committata: provenienza deterministica — la
  // stessa estrazione contro lo stesso catalogo committato produce la stessa
  // fixture, e un drift Penpot↔fixture emerge nel diff della fixture scritta.
  const catalog = loadCatalogFixture();
  const fixture = await readComponentFixture(componentName, catalog);
  const parsed = FixtureSchema.parse(fixture);

  mkdirSync(recipesDir, { recursive: true });
  const path = fixturePathFor(parsed.componentName);
  writeAtomic(path, `${JSON.stringify(parsed, null, 2)}\n`);

  console.log(`Fixture scritta: ${path}`);
  console.log(`Celle lette: ${parsed.cells.length} (incluse le Default, variantProps null)`);
  console.log(`Provenienza per la ricetta (scrivi a mano ${recipePathFor(parsed.componentName)}):`);
  console.log(`  "penpotComponentId": "${parsed.penpotComponentId}"`);
  console.log(`  "fixtureHash": "${fixtureHash(catalog)}"`);
  console.log("La ricetta è un artefatto di giudizio: scrivila a mano, poi valida con validate:recipe.");
}

function validate(componentName: string): void {
  const fixturePath = fixturePathFor(componentName);
  const recipePath = recipePathFor(componentName);
  for (const [label, path] of [
    ["fixture", fixturePath],
    ["ricetta", recipePath],
  ] as const) {
    if (!existsSync(path)) {
      throw new Error(`File ${label} non trovato per "${componentName}": ${path} — estrai prima con extract:component (fixture) o scrivi la ricetta a mano.`);
    }
  }

  const catalog = loadCatalogFixture();
  const fixtureJson: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
  const recipeJson: unknown = JSON.parse(readFileSync(recipePath, "utf8"));

  // Provenienza: la ricetta deve dichiarare la stessa componente e lo stesso
  // hash di catalogo della fixture committata — un mismatch è drift esplicito.
  const fixture = FixtureSchema.parse(fixtureJson);
  const checks: Array<[boolean, string]> = [
    [fixture.componentName === componentName, `Il campo componentName della fixture ("${fixture.componentName}") non corrisponde al nome richiesto ("${componentName}").`],
  ];
  for (const [ok, message] of checks) {
    if (!ok) throw new Error(message);
  }

  const recipe = recipeJson as { componentName?: string; penpotComponentId?: string; fixtureHash?: string };
  const provenanceErrors: string[] = [];
  if (recipe.componentName !== componentName) {
    provenanceErrors.push(`componentName "${recipe.componentName}" ≠ "${componentName}"`);
  }
  if (recipe.penpotComponentId !== fixture.penpotComponentId) {
    provenanceErrors.push(`penpotComponentId "${recipe.penpotComponentId}" ≠ fixture "${fixture.penpotComponentId}"`);
  }
  if (recipe.fixtureHash !== fixtureHash(catalog)) {
    provenanceErrors.push(`fixtureHash "${recipe.fixtureHash}" ≠ catalogo Stadio 1 corrente "${fixtureHash(catalog)}" — rigenera/riautora la ricetta (drift del vocabolario token).`);
  }
  if (provenanceErrors.length > 0) {
    console.error(`Provenienza della ricetta non allineata: ${provenanceErrors.join("; ")}`);
    process.exitCode = 1;
    return;
  }

  const result = validateRecipe(recipeJson, catalog);
  if (result.valid) {
    console.log(`Ricetta "${componentName}" VALIDA: schema ok, tutte le classi cva risolte al vocabolario Stadio 1.`);
  } else {
    for (const error of result.errors) console.error(`✗ ${error}`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const { mode, componentName } = parseArgs(process.argv.slice(2));
  if (mode === "extract") {
    await extract(componentName);
  } else {
    validate(componentName);
  }
}

main()
  .then(() => {
    // Exit esplicito: socket MCP/SSE aperti non devono tenere vivo il CLI.
    process.exit(process.exitCode ?? 0);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
