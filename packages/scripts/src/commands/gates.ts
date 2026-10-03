import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { PATHS } from "../shared/paths";
import { hasRed, publishReport, VerdictCollector, type ComponentReport } from "../shared/component-report";
import type { TokenCatalog } from "../shared/theme-generator";
import { ScriptError } from "../errors";
import { committedSnapshots, loadComponentSnapshot, type ComponentSnapshot } from "../components";
import { resolveExtraction } from "../registry";
import { parseArgs, type Command } from "../shell";
import { domainBarrelContent, isGeneratedFileV2, renderCheckV2, renderComponentV2 } from "./render";

/**
 * `gates` (Story 2-15, CAP-9): il gate v2 in CI — `render --check --all`
 * in memoria + suite `ui` (con axe), report per componente su terminale e
 * `$GITHUB_STEP_SUMMARY`. Un componente divergente nomina solo sé, gli altri
 * vengono comunque verificati. Nessun comando live in CI: solo letture
 * (istantanee committate, file generati, catalogo) e la suite.
 *
 * Disegno da `src/emitter/gates-runner.ts` (v1, da non toccare né importare):
 * `VerdictCollector`/`publishReport`, esito per componente, controlli globali
 * per la suite. La v2 non ha drift (nessuna lettura live): `extract`/`render`
 * non girano mai in CI né in build, qui gira solo `--check` in memoria.
 *
 * Categorie: uso errato → `input` (1); verifiche rosse → `gate` (4)
 * nominativo. Mai `penpot`/`contract` da qui: un contratto incoerente è una
 * voce rossa `gate-failed`, non un'uscita di categoria diversa.
 * Report JSON con `--json <path>` (stesso report del terminale). Il seed live
 * (`extract`/`library` su Penpot) vuole `PENPOT_MCP_URL`/`PENPOT_MCP_TOKEN`;
 * `gates` è offline e non li legge mai.
 */

export const GATES_USAGE = "gates [--json <path>]";

/** Esito della suite `ui` (stessa forma del gate a11y v1, mai importato). */
export interface UiSuiteResult {
  /** Exit code di `pnpm test` in `packages/ui`; `null` = nessun codice prodotto. */
  readonly exitCode: number | null;
  /** File di test falliti, per il messaggio nominativo. */
  readonly failedFiles?: readonly string[];
  /** Lo spawn non è partito o è stato ucciso: mai un verde. */
  readonly spawnError?: string | null;
}

export interface GatesV2Deps {
  /** Seam per i test: container noti invece di `data/components/`. */
  readonly components?: () => string[];
  /** Seam per i test: cartella istantanee invece di `data/components/`. */
  readonly componentsDir?: string;
  /** Seam per i test: radice domini invece di `packages/ui/src/domains/`. */
  readonly domainsDir?: string;
  /** Seam per i test: catalogo iniettato invece del file committato. */
  readonly catalog?: TokenCatalog;
  /** Seam per i test: path del catalogo invece di `PATHS.catalogPath`. */
  readonly catalogPath?: string;
  /** Seam per i test: istantanea per nome invece del file committato. */
  readonly loadSnapshot?: (component: string) => ComponentSnapshot;
  /** Seam per i test: file generati invece di `ui/src/domains/`. */
  readonly existingFiles?: () => Record<string, string>;
  /** Seam per i test: esito della suite `ui` senza lanciare processi. */
  readonly runSuite?: () => UiSuiteResult;
  readonly log?: (text: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertCatalogShape(value: unknown, label: string): asserts value is TokenCatalog {
  if (value === null || typeof value !== "object" || !Array.isArray((value as { sets?: unknown }).sets)) {
    throw new ScriptError({ kind: "input", detail: `catalogo token malformato (${label}): atteso oggetto con array "sets".` });
  }
}

function loadCatalog(deps: GatesV2Deps): TokenCatalog {
  if (deps.catalog !== undefined) {
    assertCatalogShape(deps.catalog, "<injected>");
    return deps.catalog;
  }
  const path = deps.catalogPath ?? PATHS.catalogPath;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new ScriptError({ kind: "input", detail: `catalogo token non leggibile (${path}): ${messageOf(error)}` });
  }
  assertCatalogShape(parsed, path);
  return parsed;
}

function readExistingFiles(root: string): Record<string, string> {
  const existing: Record<string, string> = {};
  const visit = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      const rel = prefix.length > 0 ? `${prefix}/${entry}` : entry;
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (isDir) visit(full, rel);
      else {
        try {
          existing[rel] = readFileSync(full, "utf8");
        } catch {
          continue;
        }
      }
    }
  };
  visit(root, "");
  return existing;
}

function defaultRunSuite(): UiSuiteResult {
  // La suite gira nel package per cwd, senza nomi di package in literal: il
  // confine scripts ↛ @penpot-ds/ui resta integro. Un fallimento a monte del
  // processo (spawn fallito, status null) NON è un verde.
  const suite = spawnSync("pnpm", ["test"], { cwd: PATHS.uiPackageRoot, stdio: "inherit", timeout: 300_000 });
  const spawnError =
    suite.error?.message ?? (suite.status === null ? "il processo della suite non ha prodotto un exit code" : null);
  return { exitCode: suite.status, failedFiles: [], spawnError };
}

function checkSuite(result: UiSuiteResult): { ok: boolean; detail: string } {
  if (result.spawnError) {
    return { ok: false, detail: `la suite ui non è riuscita a partire: ${result.spawnError}` };
  }
  if (result.exitCode === null) {
    return { ok: false, detail: "la suite ui non ha prodotto un exit code — esito indeterminabile, mai un verde vacuo" };
  }
  if (result.exitCode === 0 && (result.failedFiles ?? []).length === 0) {
    return { ok: true, detail: "suite ui verde (axe senza violazioni su ogni componente generato)" };
  }
  const failed = (result.failedFiles ?? []).join(", ");
  return {
    ok: false,
    detail: `suite ui in rosso (exit ${result.exitCode}${failed.length > 0 ? `; file: ${failed}` : ""}) — violazioni axe o test falliti`,
  };
}

/** I gate v2 per componente, in un report unico. Funzione senza exit: l'esito è il report. */
export async function runGatesV2(deps: GatesV2Deps = {}): Promise<ComponentReport> {
  const verdicts = new VerdictCollector();
  const global = new VerdictCollector();
  const notes: string[] = ["Gates v2: nessun comando live in CI (solo render --check --all in memoria + suite ui)."];
  const componentsDir = deps.componentsDir ?? PATHS.componentsDir;
  const domainsDir = deps.domainsDir ?? PATHS.domainsRoot;

  let targets: string[];
  try {
    targets = deps.components !== undefined ? deps.components() : committedSnapshots(componentsDir);
  } catch (error) {
    global.red("istantanee committate", `Lettura fallita: ${messageOf(error)}`);
    return { title: "gates", components: verdicts.verdicts(), global: global.verdicts(), notes };
  }
  if (targets.length === 0) {
    global.red("istantanee committate", `Nessuna istantanea committata in ${componentsDir} — i gate non hanno componenti da coprire.`);
    return { title: "gates", components: verdicts.verdicts(), global: global.verdicts(), notes };
  }

  let catalog: TokenCatalog;
  let existing: Record<string, string>;
  try {
    catalog = loadCatalog(deps);
    existing = deps.existingFiles !== undefined ? deps.existingFiles() : readExistingFiles(domainsDir);
  } catch (error) {
    const detail = messageOf(error);
    global.red("artefatti condivisi (catalogo, ui/domains)", `Caricamento fallito: ${detail}`);
    for (const component of targets) {
      verdicts.red(component, "Non valutato: gli artefatti condivisi (catalogo, ui/domains) non sono caricabili — vedi la riga globale.");
    }
    return { title: "gates", components: verdicts.verdicts(), global: global.verdicts(), notes };
  }

  const barrels = new Map<string, Array<{ component: string; snapshot: ComponentSnapshot }>>();
  for (const component of targets) {
    verdicts.declare(component);
    let snapshot: ComponentSnapshot;
    try {
      snapshot = deps.loadSnapshot !== undefined ? deps.loadSnapshot(component) : loadComponentSnapshot(component, componentsDir);
    } catch (error) {
      verdicts.red(component, `Istantanea non caricabile — i gate di questo componente non possono girare: ${messageOf(error)}`, "gate-failed");
      continue;
    }
    let extraction: ReturnType<typeof resolveExtraction>;
    try {
      extraction = resolveExtraction(component);
    } catch (error) {
      verdicts.red(component, `Contratto di estrazione non risolto: ${messageOf(error)}`, "gate-failed");
      continue;
    }
    if (snapshot.contract !== extraction.pluginData) {
      verdicts.red(
        component,
        `Gate rigenerazione: istantanea con contract "${snapshot.contract}", atteso "${extraction.pluginData}" — riestrai con "extract ${component}".`,
        "gate-failed",
      );
      continue;
    }
    let files: ReturnType<typeof renderComponentV2>["files"];
    try {
      ({ files } = renderComponentV2(snapshot, extraction, catalog, existing));
    } catch (error) {
      verdicts.red(component, `Gate rigenerazione: il rendering è fallito — ${messageOf(error)}`, "gate-failed");
      continue;
    }
    const actionable = files.filter((file) => !file.path.endsWith("/index.ts"));
    const check = renderCheckV2(actionable, existing);
    for (const divergence of check.divergences) {
      verdicts.red(
        component,
        `Gate rigenerazione: file ${divergence.reason === "missing" ? "assente" : "divergente"}: ${divergence.path} — rigenera con "render ${component}".`,
        "gate-failed",
      );
    }
    // Il barrel è accumulato per dominio e ricalcolato via `domainBarrelContent`
    // a parte (come `render --check --all`).
    const list = barrels.get(extraction.render.domain) ?? [];
    list.push({ component, snapshot });
    barrels.set(extraction.render.domain, list);

    // Gate axe dichiarato: il test generato committato deve asserire axe.
    const testPath = `${extraction.render.domain}/${component}.test.tsx`;
    const testContent = existing[testPath];
    if (testContent === undefined) {
      // Già coperto dalla rigenerazione (missing); nessun doppio rosso.
    } else if (!testContent.includes("axe(")) {
      verdicts.red(
        component,
        `Gate a11y: ${testPath} non asserisce axe nel test committato (rigenera con render).`,
        "gate-failed",
      );
    }
    // Giudizio visivo registrato nella story (decisione GIUDIZIO-VISIVO della 2-15):
    // la story committata deve portare la nota del giudizio di Alessandro.
    const storiesPath = `${extraction.render.domain}/${component}.stories.tsx`;
    const storiesContent = existing[storiesPath];
    if (storiesContent !== undefined && !storiesContent.includes("Giudizio visivo")) {
      verdicts.red(
        component,
        `Gate story: ${storiesPath} senza nota "Giudizio visivo" — il giudizio di Alessandro va registrato nella story via render.`,
        "gate-failed",
      );
    }
  }

  // Barrel per dominio (come `render --check --all`): un solo `index.ts` per
  // dominio; senza marker esistente vale lo skip protettivo (mai errore).
  for (const [domain, entries] of [...barrels.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const expected = domainBarrelContent(entries);
    const rel = `${domain}/index.ts`;
    const current = existing[rel];
    if (current !== undefined && !isGeneratedFileV2(current)) continue;
    if (current !== expected) {
      for (const entry of entries) {
        verdicts.red(
          entry.component,
          `Gate rigenerazione: file ${current === undefined ? "assente" : "divergente"}: ${rel} — rigenera con "render --check --all".`,
          "gate-failed",
        );
      }
    }
  }

  // Gate a11y: la suite ui è una riga GLOBALE (un solo processo per tutti).
  const suiteLabel = "gate a11y — suite ui (vitest-axe)";
  global.declare(suiteLabel);
  let suite: UiSuiteResult;
  try {
    suite = deps.runSuite !== undefined ? deps.runSuite() : defaultRunSuite();
  } catch (error) {
    global.red(suiteLabel, `Gate a11y: la suite ui non è riuscita a partire: ${messageOf(error)}`, "gate-failed");
    return { title: "gates", components: verdicts.verdicts(), global: global.verdicts(), notes };
  }
  const suiteCheck = checkSuite(suite);
  if (!suiteCheck.ok) global.red(suiteLabel, `Gate a11y: ${suiteCheck.detail}`, "gate-failed");

  return { title: "gates", components: verdicts.verdicts(), global: global.verdicts(), notes };
}

export interface GatesV2Args {
  /** `--json <path>`: scrive anche il report JSON. */
  readonly jsonPath?: string;
}

/**
 * Corpo del CLI senza `process.exit`: argomenti già parsati → gate → report
 * (terminale, `$GITHUB_STEP_SUMMARY`, JSON con `--json <path>`) → throw
 * `ScriptError` `gate` (exit 4) se una voce è rossa, altrimenti 0.
 */
export function gatesCommandWith(deps: GatesV2Deps & { env?: NodeJS.ProcessEnv; print?: (text: string) => void } = {}): Command {
  const { env, print, ...gatesDeps } = deps;
  return {
    name: "gates",
    usage: GATES_USAGE,
    async run(argv) {
      const parsed = parseArgs(argv, { usage: GATES_USAGE, flags: ["--help"], options: ["--json"], positional: { min: 0, max: 0 } });
      if (parsed.flags.has("--help")) {
        const log = gatesDeps.log ?? console.log;
        log(`Uso: ${GATES_USAGE}`);
        log(`  Verifica da repo (CI-safe, mai live): render --check --all in memoria + suite ui con axe, report per componente.`);
        log(`  Un componente divergente nomina solo sé; gli altri vengono comunque verificati.`);
        log(`  --json <path> scrive anche il report JSON (stesso report del terminale, con kind per problema).`);
        log(`  Exit: 1 input (uso errato: argomento non atteso, --json senza valore) · 4 gate (verifiche rosse, nominativo).`);
        log(`  Il seed live (extract/library su Penpot) vuole PENPOT_MCP_URL/PENPOT_MCP_TOKEN; gates è offline e non li legge mai.`);
        return 0;
      }
      const jsonPath = parsed.options.get("--json");
      const report = await runGatesV2(gatesDeps);
      publishReport(report, env ?? process.env, print ?? ((text) => console.log(text)), jsonPath);
      if (hasRed(report)) {
        const redComponents = report.components.filter((verdict) => verdict.status === "red").map((verdict) => verdict.component);
        const redGlobals = report.global.filter((verdict) => verdict.status === "red").map((verdict) => verdict.component);
        const parts: string[] = [];
        if (redComponents.length > 0) parts.push(`componenti rossi: ${redComponents.join(", ")}`);
        if (redGlobals.length > 0) parts.push(`controlli globali rossi: ${redGlobals.join(", ")}`);
        const detail = `Check fallito: ${parts.join(" — ")}. Vedi il report per componente sopra (terminale e $GITHUB_STEP_SUMMARY).`;
        if (redComponents.length === 1 && redGlobals.length === 0) {
          throw new ScriptError({ kind: "gate", component: redComponents[0], detail });
        }
        throw new ScriptError({ kind: "gate", detail });
      }
      return 0;
    },
  };
}

export const gatesCommand: Command = gatesCommandWith();
