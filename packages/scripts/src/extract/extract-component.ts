import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { componentFixtureFromSnapshot, contractByName } from "./component-reader";
import { BindingSchema } from "../emitter/binding-shadcn";
import { parseLibrarySnapshot, readLibrarySnapshot } from "../library/library-reader";
import type { LibrarySnapshot } from "../library/library-snapshot";
import {
  FixtureSchema,
  JudgmentSchema,
  cellKeyOf,
  partBindings,
  resolvePartAliases,
  type ComponentJudgment,
  type ComponentFixture,
  type ComponentRecipe,
} from "./recipe-schema";
import { toKebab } from "../shared/naming";
import { PATHS } from "../shared/paths";
import { layerTreeProblems } from "../shared/style-properties";
import { fixtureHash, type TokenCatalog } from "../shared/theme-generator";
import { validateRecipe } from "./validate-recipe";

/**
 * Logica Stage 2 per componente (Story 2.5); l'entry CLI è `src/cli/extract-component.ts`:
 *
 *   extract:component -- <ComponentName> [--snapshot <path>]
 *     estrazione da library live (o da snapshot file, seam offline): scrive
 *     <comp>.fixture.json (fatti: plugin data + shape.tokens) E
 *     <comp>.recipe.json (celle dai binding + giudizio dal file per
 *     contratto + provenienza). Gate PRIMA delle write, e write della coppia
 *     ATOMICA (rollback della fixture se la ricetta fallisce): un fallimento
 *     lascia zero artefatti.
 *   validate:recipe    -- <ComponentName>
 *     offline: conformance della coppia committata contro il contratto +
 *     gate token Stadio 1 + provenienza.
 *
 * Entrambi i comandi sono per-componente e su richiesta, MAI in CI né in
 * build (AC #1): nessuno dei due entra in turbo.json come task cacheable.
 */

const recipesDir = PATHS.recipesDir;
const judgmentsDir = PATHS.judgmentsDir;
const catalogFixturePath = PATHS.catalogPath;

/** Catalogo Stadio 1 committato: la fonte deterministica del vocabolario. Esportato per i CLI a valle (emitter, gate). */
export function loadCatalogFixture(): TokenCatalog {
  return JSON.parse(readFileSync(catalogFixturePath, "utf8")) as TokenCatalog;
}

/**
 * Seam `--snapshot <path>`: il file viene validato ALLA FONTE con
 * `parseLibrarySnapshot` (review loop 1, BH#4+ECH#3) — un JSON valido che
 * non è uno snapshot produce un errore che nomina il campo malformato, mai
 * un TypeError grezzo a valle.
 */
function loadSnapshotFile(path: string): LibrarySnapshot {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Il file snapshot "${path}" non è JSON leggibile: ${(error as Error).message}`);
  }
  try {
    return parseLibrarySnapshot(json);
  } catch (error) {
    throw new Error(`Il file snapshot "${path}" non è uno snapshot di library valido: ${(error as Error).message}`);
  }
}

/** Esportato per i CLI a valle (emitter, gate): stesso file di giudizio, stessa validazione. */
export function loadJudgment(contractName: string): ComponentJudgment {
  const path = resolve(judgmentsDir, `${contractName}.json`);
  if (!existsSync(path)) {
    throw new Error(`File di giudizio non trovato per il contratto "${contractName}": ${path} — scrivilo a mano (domain, headless, a11y).`);
  }
  const parsed = JudgmentSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
    throw new Error(`File di giudizio malformato per il contratto "${contractName}" (${path}):\n${issues.join("\n")}`);
  }
  return parsed.data;
}

const bindingsDir = PATHS.bindingsDir;

/**
 * Alias `layer → parte` dal binding committato del componente (Story 2.8
 * parte B). Nessun binding (prima estrazione di un componente nuovo) =
 * nessun alias. Un alias duplicato o verso una parte che il contratto non
 * ha lancia con l'errore nominativo: l'estrazione non indovina.
 */
export function loadPartAliases(componentName: string, dir: string = bindingsDir): Record<string, string> {
  const path = resolve(dir, `${toKebab(componentName)}.binding.json`);
  if (!existsSync(path)) return {};
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Il file "${path}" non è JSON leggibile: ${(error as Error).message}`);
  }
  const parsed = BindingSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
    throw new Error(`Binding malformato per "${componentName}" (${path}):\n${issues.join("\n")}`);
  }
  const contract = contractByName(parsed.data.contract.split("@")[0]!);
  if (contract === undefined) {
    throw new Error(
      `Il binding di "${componentName}" (${path}) dichiara il contratto "${parsed.data.contract}", che non esiste in @app/contracts — gli alias dei layer non si possono verificare.`,
    );
  }
  const { aliases, errors } = resolvePartAliases(parsed.data, contract);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return aliases;
}

/** Esportati per i CLI a valle (emitter, gate): stesse convenzioni di path dei file committati. */
export function fixturePathFor(componentName: string, dir: string): string {
  return resolve(dir, `${toKebab(componentName)}.fixture.json`);
}

export function recipePathFor(componentName: string, dir: string): string {
  return resolve(dir, `${toKebab(componentName)}.recipe.json`);
}

function writeAtomic(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, filePath);
}

/**
 * Ricetta dai fatti: celle `proprietà → token` per parte × valore d'asse
 * derivate dai binding della fixture, giudizio dal file per contratto,
 * provenienza riregistrata. La fattorizzazione (quali layer sono parti) è
 * già nel contratto; il giudizio committato resta domain/headless/a11y.
 */
export function buildRecipe(
  fixture: ComponentFixture,
  catalog: TokenCatalog,
  judgment: ComponentJudgment,
  /** Alias `layer → parte` dal binding (Story 2.8 parte B): la ricetta resta per parti del contratto. */
  aliases: Readonly<Record<string, string>> = {},
): ComponentRecipe {
  const contractName = fixture.contract.split("@")[0]!;
  const contract = contractByName(contractName);
  if (contract === undefined) {
    throw new Error(
      `Il plugin data della fixture dichiara il contratto "${fixture.contract}", che non esiste in @app/contracts.`,
    );
  }

  const parts: ComponentRecipe["parts"] = {};
  for (const part of contract.parts) parts[part] = {};

  const seenKeys = new Set<string>();
  for (const cell of fixture.cells) {
    const key = cellKeyOf(contract.axes, cell.variantProps);
    if (seenKeys.has(key)) {
      throw new Error(`Cella duplicata "${key}" nella fixture di "${fixture.componentName}" — il prodotto cartesiano non ha duplicati.`);
    }
    seenKeys.add(key);
    // Registro delle proprietà (Story 2.8): una proprietà non registrata o
    // bloccata, nello stile o nei binding, ferma l'estrazione — mai uno skip.
    const problems = layerTreeProblems(cell.root, { component: fixture.componentName, cell: key });
    if (problems.length > 0) {
      throw new Error(`Estrazione di "${fixture.componentName}" bloccata dal registro delle proprietà:\n${problems.join("\n")}`);
    }
    const { bindings, duplicates } = partBindings(cell.root, aliases);
    // Un binding su un layer che non è una parte del contratto, o una parte
    // portata da più layer, è un segnale di stop: si segnala, non si corregge.
    if (duplicates.length > 0) {
      throw new Error(
        `Cella "${key}": due layer chiamati "${duplicates.join(", ")}" hanno binding token — ambiguo quale sia la parte: rinomina i layer in Penpot.`,
      );
    }
    for (const [bindingPart, tokens] of bindings) {
      if (!contract.parts.includes(bindingPart)) {
        throw new Error(
          `Cella "${key}": il layer "${bindingPart}" ha binding token (${Object.keys(tokens).join(", ")}) ma non è una parte del contratto "${contract.name}" — l'estrazione segnala, non corregge: allinea la library o il contratto.`,
        );
      }
      parts[bindingPart]![key] = tokens;
    }
    // Ogni parte del contratto copre OGNI cella del prodotto cartesiano,
    // anche quando nella cella non ha binding (celle vuote).
    for (const part of contract.parts) {
      if (!(key in parts[part]!)) parts[part]![key] = {};
    }
  }

  return {
    componentName: fixture.componentName,
    parts,
    judgment,
    penpotComponentId: fixture.penpotComponentId,
    fixtureHash: fixtureHash(catalog),
  };
}

export interface ExtractOptions {
  /** Seam offline: legge lo snapshot da file invece che da Penpot live. */
  snapshotPath?: string;
  /** Destinazione degli artefatti; default `data/recipes`. Seam per i test end-to-end. */
  recipesDir?: string;
  /** Directory dei binding (alias dei layer); default `data/bindings`. Seam per i test. */
  bindingsDir?: string;
}

export async function extract(
  componentName: string,
  options: ExtractOptions = {},
): Promise<{ fixturePath: string; recipePath: string }> {
  // Il vocabolario per la validazione è SEMPRE la fixture Stadio 1
  // committata: provenienza deterministica. La library, invece, arriva dal
  // snapshot (live di default, `--snapshot <path>` come seam offline).
  const catalog = loadCatalogFixture();
  const snapshot = options.snapshotPath !== undefined ? loadSnapshotFile(options.snapshotPath) : await readLibrarySnapshot();
  const fixture = componentFixtureFromSnapshot(componentName, snapshot);
  const contractName = fixture.contract.split("@")[0]!;
  const judgment = loadJudgment(contractName);
  const aliases = loadPartAliases(fixture.componentName, options.bindingsDir);
  const recipe = buildRecipe(fixture, catalog, judgment, aliases);

  // Gate PRIMA di qualsiasi scrittura: un fallimento lascia zero artefatti.
  const result = validateRecipe(fixture, recipe, catalog, judgment, aliases);
  if (!result.valid) {
    throw new Error(`La ricetta assemblata per "${fixture.componentName}" non è conforme:\n${result.errors.join("\n")}`);
  }

  const outDir = options.recipesDir ?? recipesDir;
  mkdirSync(outDir, { recursive: true });
  const fixturePath = fixturePathFor(fixture.componentName, outDir);
  const recipePath = recipePathFor(fixture.componentName, outDir);
  // Write della coppia ATOMICO (review loop 1, BH#5+ECH#5): due write
  // indipendenti lascerebbero una fixture orfana se il secondo fallisce —
  // qui il rollback della fixture ripristina "zero artefatti".
  writeAtomic(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
  try {
    writeAtomic(recipePath, `${JSON.stringify(recipe, null, 2)}\n`);
  } catch (error) {
    rmSync(fixturePath, { force: true });
    throw error;
  }

  console.log(`Fixture scritta: ${fixturePath}`);
  console.log(`Ricetta scritta: ${recipePath}`);
  console.log(`Contratto: ${fixture.contract} — celle: ${fixture.cells.length} (prodotto cartesiano completo).`);
  console.log(`Provenienza: penpotComponentId=${fixture.penpotComponentId} fixtureHash=${fixtureHash(catalog)}`);
  return { fixturePath, recipePath };
}

/** `validate:recipe`: conformance offline della coppia committata; esito in `process.exitCode`. */
export function validate(componentName: string): void {
  const fixturePath = fixturePathFor(componentName, recipesDir);
  const recipePath = recipePathFor(componentName, recipesDir);
  for (const [label, path] of [
    ["fixture", fixturePath],
    ["ricetta", recipePath],
  ] as const) {
    if (!existsSync(path)) {
      throw new Error(`File ${label} non trovato per "${componentName}": ${path} — estrai prima con extract:component (fixture e ricetta).`);
    }
  }

  const catalog = loadCatalogFixture();
  const fixtureJson: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
  const recipeJson: unknown = JSON.parse(readFileSync(recipePath, "utf8"));
  if (typeof fixtureJson !== "object" || fixtureJson === null || Array.isArray(fixtureJson)) {
    throw new Error(`Il file fixture "${fixturePath}" non contiene un oggetto JSON valido (trovato: ${JSON.stringify(fixtureJson)}).`);
  }
  if (typeof recipeJson !== "object" || recipeJson === null || Array.isArray(recipeJson)) {
    throw new Error(`Il file ricetta "${recipePath}" non contiene un oggetto JSON valido (trovato: ${JSON.stringify(recipeJson)}).`);
  }

  // Provenienza: la ricetta deve dichiarare la stessa componente e lo stesso
  // hash di catalogo della fixture committata — un mismatch è drift esplicito.
  const fixture = FixtureSchema.parse(fixtureJson);
  if (fixture.componentName !== componentName) {
    throw new Error(`Il campo componentName della fixture ("${fixture.componentName}") non corrisponde al nome richiesto ("${componentName}").`);
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
    provenanceErrors.push(`fixtureHash "${recipe.fixtureHash}" ≠ catalogo Stadio 1 corrente "${fixtureHash(catalog)}" — riestrai il componente (drift del vocabolario token).`);
  }
  if (provenanceErrors.length > 0) {
    console.error(`Provenienza della ricetta non allineata: ${provenanceErrors.join("; ")}`);
    process.exitCode = 1;
    return;
  }

  const judgment = loadJudgment(fixture.contract.split("@")[0]!);
  const result = validateRecipe(fixtureJson, recipeJson, catalog, judgment, loadPartAliases(componentName));
  if (result.valid) {
    console.log(`Ricetta "${componentName}" VALIDA: conformance al contratto ${fixture.contract} ok, tutti i token risolti al catalogo Stadio 1.`);
  } else {
    for (const error of result.errors) console.error(`✗ ${error}`);
    process.exitCode = 1;
  }
}
