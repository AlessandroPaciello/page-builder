import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { componentFixtureFromSnapshot, contractByName } from "./component-reader";
import { parseLibrarySnapshot, readLibrarySnapshot } from "./library/library-reader";
import type { LibrarySnapshot } from "./library/library-snapshot";
import {
  FixtureSchema,
  JudgmentSchema,
  cellKeyOf,
  partBindings,
  type ComponentJudgment,
  type ComponentFixture,
  type ComponentRecipe,
} from "./recipe-schema";
import { fixtureHash, type TokenCatalog } from "./theme-generator";
import { validateRecipe } from "./validate-recipe";

/**
 * Entry CLI Stage 2 per componente (Story 2.5):
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

const here = dirname(fileURLToPath(import.meta.url));
const recipesDir = resolve(here, "recipes");
const judgmentsDir = resolve(recipesDir, "judgments");
const catalogFixturePath = resolve(here, "__fixtures__/penpot-catalog.json");

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

/** Nome file kebab-case: "LifecycleBadge" → "lifecycle-badge". Esportato per l'emitter (data-slot, nomi file). */
export function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
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

/** Nome pnpm dello script CLI per la modalità, usato nei messaggi d'errore. */
function scriptNameFor(mode: "extract" | "validate"): string {
  return mode === "extract" ? "extract:component" : "validate:recipe";
}

export function parseArgs(args: readonly string[]): {
  mode: "extract" | "validate";
  componentName: string;
  snapshotPath?: string;
} {
  // pnpm inoltra il separatore "--" fra script e argomenti: va rimosso, non è un flag.
  const [mode, componentName, ...rest] = args.filter((arg) => arg !== "--");
  if (mode !== "extract" && mode !== "validate") {
    throw new Error(
      `Modalità "${mode ?? "<mancante>"}" non riconosciuta — usare "extract" o "validate": pnpm extract:component -- <Nome> | pnpm validate:recipe -- <Nome>.`,
    );
  }
  if (!componentName || componentName.startsWith("--")) {
    throw new Error(`Nome componente mancante — usare: pnpm ${scriptNameFor(mode)} -- <Nome>.`);
  }
  let snapshotPath: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--snapshot") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Opzione --snapshot richiede un percorso file.");
      }
      // Un solo snapshot per run (review loop 1, ECH#4): l'ultimo che vince
      // in silenzio nasconderebbe la sorgente reale dei fatti.
      if (snapshotPath !== undefined) {
        throw new Error(`Opzione --snapshot duplicata ("${snapshotPath}" e "${value}") — un solo snapshot per estrazione.`);
      }
      snapshotPath = value;
      index++;
    } else {
      throw new Error(`Argomenti non riconosciuti: ${rest.join(", ")} — usare: pnpm ${scriptNameFor(mode)} -- <Nome> [--snapshot <path>].`);
    }
  }
  if (snapshotPath !== undefined && mode === "validate") {
    throw new Error("--snapshot è valido solo su extract: validate:recipe è già offline (legge i file committati).");
  }
  return { mode, componentName, snapshotPath };
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
    const { bindings, duplicates } = partBindings(cell.root);
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
  /** Destinazione degli artefatti; default `src/recipes`. Seam per i test end-to-end. */
  recipesDir?: string;
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
  const recipe = buildRecipe(fixture, catalog, judgment);

  // Gate PRIMA di qualsiasi scrittura: un fallimento lascia zero artefatti.
  const result = validateRecipe(fixture, recipe, catalog, judgment);
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

function validate(componentName: string): void {
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
  const result = validateRecipe(fixtureJson, recipeJson, catalog, judgment);
  if (result.valid) {
    console.log(`Ricetta "${componentName}" VALIDA: conformance al contratto ${fixture.contract} ok, tutti i token risolti al catalogo Stadio 1.`);
  } else {
    for (const error of result.errors) console.error(`✗ ${error}`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const { mode, componentName, snapshotPath } = parseArgs(process.argv.slice(2));
  if (mode === "extract") {
    await extract(componentName, { snapshotPath });
  } else {
    validate(componentName);
  }
}

// Esegui `main()` solo da invocazione diretta (`node --import tsx src/extract-component.ts ...`),
// mai a un semplice `import` (es. dai test che importano `parseArgs`): senza questa guardia
// ogni import del modulo chiamerebbe `main()` con l'argv del processo ospite (il test runner)
// e potenzialmente un `process.exit()` a valle.
const isDirectInvocation = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectInvocation) {
  main()
    .then(() => {
      // Exit esplicito: socket MCP/SSE aperti non devono tenere vivo il CLI.
      process.exit(process.exitCode ?? 0);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
