import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { VerdictCollector, publishReport, type ComponentReport } from "../component-report";
import { loadJudgment } from "../extract-component";
import { readLibrarySnapshot } from "../library/library-reader";
import type { LibrarySnapshot } from "../library/library-snapshot";
import { resolvePartAliases } from "../recipe-schema";
import { contractByName } from "../component-reader";
import {
  scanCommittedComponents,
  loadBaseSources,
  loadBinding,
  loadCatalog,
  loadFixture,
  loadRecipe,
  readExistingFiles,
  domainsRoot,
  basesDir,
  type CommittedScan,
} from "./artifacts";
import {
  checkA11y,
  checkCompleteness,
  checkConformance,
  checkDeclaredA11y,
  checkDrift,
  checkRegeneration,
  type A11ySuiteResult,
  type DriftEntry,
} from "./gates";
import { renderComponent } from "./render-component";

/**
 * CLI dei gate del regime design→codice (Story 2.6, Task 8; per componente
 * dalla Story 2.8 parte B):
 *
 *   gates:render
 *     1. completezza artefatti    (4 file per componente in ui/domains)
 *     2. rigenerazione a diff zero (renderCheck, nessuna scrittura)
 *     3. a11y                     (suite `@penpot-ds/ui` = riga globale; a11y dichiarata per componente)
 *     4. conformità al contratto  (validateRecipe sugli artefatti committati)
 *     5. drift della fixture      (Penpot live vs fixture committata)
 *
 * Ogni componente è valutato in isolamento: un artefatto rotto (fixture,
 * ricetta, binding, base) rende rossa SOLO la sua voce, gli altri vengono
 * comunque valutati. Un solo report finale — terminale e, se esiste,
 * `$GITHUB_STEP_SUMMARY` — ed exit 1 solo con almeno una voce rossa.
 *
 * Il gate drift è bloccante SE E SOLO SE il runner raggiunge il server MCP
 * Penpot (decisione frozen, opzione a): altrimenti skip documentato col
 * motivo nel report (nota), mai un verde finto; riesecuzione manuale/nightly.
 */

/** Seam dei test: tutto ciò che il CLI legge da disco, dalla suite ui e da Penpot. */
export interface GatesDeps {
  /** Ricette committate: i componenti validi e le ricette malformate (per file). */
  components: () => CommittedScan;
  loadFixture: typeof loadFixture;
  loadRecipe: typeof loadRecipe;
  loadBinding: typeof loadBinding;
  loadJudgment: typeof loadJudgment;
  loadBaseSources: (base: string) => Record<string, string>;
  loadCatalog: typeof loadCatalog;
  existingFiles: () => Record<string, string>;
  runSuite: () => A11ySuiteResult;
  fetchLive: () => Promise<LibrarySnapshot>;
}

function runUiSuite(): A11ySuiteResult {
  // La suite gira nel package per cwd, senza nomi di package in literal: il
  // confine scripts ↛ @penpot-ds/ui resta integro. Un fallimento a monte del
  // processo (spawn fallito, status null) NON è un verde.
  const uiPackageRoot = fileURLToPath(new URL("../../../ui", import.meta.url));
  const suite = spawnSync("pnpm", ["test"], { cwd: uiPackageRoot, stdio: "inherit" });
  const spawnError =
    suite.error?.message ?? (suite.status === null ? "il processo della suite non ha prodotto un exit code" : null);
  return { exitCode: suite.status, failedFiles: [], spawnError };
}

export function defaultGatesDeps(): GatesDeps {
  return {
    components: () => scanCommittedComponents(),
    loadFixture: (name) => loadFixture(name),
    loadRecipe: (name) => loadRecipe(name),
    loadBinding: (name) => loadBinding(name),
    loadJudgment,
    loadBaseSources: (base) => loadBaseSources(base, basesDir),
    loadCatalog,
    existingFiles: () => readExistingFiles(domainsRoot),
    runSuite: runUiSuite,
    fetchLive: () => readLibrarySnapshot({ timeoutMs: 15_000 }),
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** I cinque gate, per componente, in un report unico. Funzione senza exit: l'esito è il report. */
export async function runGates(deps: GatesDeps = defaultGatesDeps()): Promise<ComponentReport> {
  const verdicts = new VerdictCollector();
  const global = new VerdictCollector();
  const notes: string[] = [];
  const { components, malformed } = deps.components();
  // Una ricetta malformata è una voce rossa col nome del file; gli altri proseguono.
  for (const { file, error } of malformed) verdicts.red(file, `Ricetta committata malformata: ${error}`);
  if (components.length === 0 && malformed.length === 0) {
    global.red("ricette committate", "Nessuna ricetta committata in src/recipes — i gate non hanno componenti da coprire.");
  }

  // Artefatti condivisi (catalogo, file generati): senza, nessun gate per
  // componente può girare — riga globale rossa, componenti "non valutati".
  let catalog: ReturnType<GatesDeps["loadCatalog"]>;
  let existing: Record<string, string>;
  try {
    catalog = deps.loadCatalog();
    existing = deps.existingFiles();
  } catch (error) {
    global.red("artefatti condivisi (catalogo, ui/domains)", `Caricamento fallito: ${message(error)}`);
    for (const component of components) {
      verdicts.red(component, "Non valutato: gli artefatti condivisi (catalogo, ui/domains) non sono caricabili — vedi la riga globale.");
    }
    return { title: "gates:render", components: verdicts.verdicts(), global: global.verdicts(), notes };
  }
  const driftEntries: DriftEntry[] = [];
  const a11yEntries: Array<{ component: string; domain: string; a11y: Parameters<typeof checkDeclaredA11y>[0][number]["a11y"] }> = [];

  for (const component of components) {
    verdicts.declare(component);
    // Caricamento isolato: un artefatto rotto ferma solo questo componente.
    let loaded;
    try {
      const fixture = deps.loadFixture(component);
      const recipe = deps.loadRecipe(component);
      const contractName = fixture.contract.split("@")[0]!;
      const contract = contractByName(contractName);
      if (contract === undefined) {
        throw new Error(
          `la fixture dichiara il contratto "${fixture.contract}", che non esiste in @app/contracts — conformità e alias non verificabili.`,
        );
      }
      const judgment = deps.loadJudgment(contractName);
      const binding = deps.loadBinding(component);
      const { aliases, errors: aliasErrors } = resolvePartAliases(binding, contract);
      for (const error of aliasErrors) verdicts.red(component, `Binding: ${error}`);
      loaded = { fixture, recipe, judgment, binding, aliases };
    } catch (error) {
      verdicts.red(component, `Artefatti non caricabili — i gate di questo componente non possono girare: ${message(error)}`);
      continue;
    }
    const { fixture, recipe, judgment, binding, aliases } = loaded;
    driftEntries.push({ component, committedFixture: fixture });
    a11yEntries.push({ component, domain: recipe.judgment.domain, a11y: recipe.judgment.a11y });

    // Gate 4 — conformità al contratto.
    const conformance = checkConformance([{ component, fixture, recipe, catalog, judgment, aliases }]);
    for (const failure of conformance.failures) {
      for (const error of failure.errors) verdicts.red(component, `Gate conformità: ${error}`, "gate-failed");
    }

    // Gate 1 — completezza artefatti.
    const completeness = checkCompleteness([{ component, domain: recipe.judgment.domain }], Object.keys(existing));
    for (const missing of completeness.missing) verdicts.red(component, `Gate completezza: manca ${missing.path}`, "gate-failed");

    // Gate 2 — rigenerazione a diff zero (renderCheck, nessuna scrittura).
    try {
      const baseSources = deps.loadBaseSources(binding.base);
      const rendered = renderComponent(fixture, recipe, binding, baseSources, catalog, { existingFiles: existing });
      const regeneration = checkRegeneration([{ component, files: rendered.files }], existing);
      for (const divergence of regeneration.divergences) {
        verdicts.red(
          component,
          `Gate rigenerazione: file ${divergence.reason === "missing" ? "assente" : "divergente"}: ${divergence.path}`,
          "gate-failed",
        );
      }
    } catch (error) {
      verdicts.red(component, `Gate rigenerazione: il rendering è fallito — ${message(error)}`, "gate-failed");
    }
  }

  // Gate 3 — a11y: la suite ui è una riga GLOBALE (un solo processo per
  // tutti i componenti); l'a11y dichiarata (role/aria-* asseriti nel test
  // committato) è per componente.
  const suiteLabel = "gate a11y — suite ui (vitest-axe)";
  global.declare(suiteLabel);
  const suite = checkA11y(deps.runSuite());
  if (!suite.ok) global.red(suiteLabel, `Gate a11y: ${suite.detail}`, "gate-failed");
  const declared = checkDeclaredA11y(
    a11yEntries.map(({ component, domain, a11y }) => {
      const path = `${domain}/${component}.test.tsx`;
      return { component, path, a11y, testContent: existing[path] };
    }),
  );
  for (const missing of declared.missing) {
    verdicts.red(
      missing.component,
      `Gate a11y: ${missing.path} non asserisce nel DOM l'attributo dichiarato "${missing.attribute}" (rigenera con render:component).`,
      "gate-failed",
    );
  }

  // Gate 5 — drift della fixture: bloccante se e solo se Penpot è raggiungibile.
  const drift = await checkDrift({ components: driftEntries, fetchLive: deps.fetchLive });
  if (drift.status === "skipped") {
    notes.push(`Gate drift SKIPPED — ${drift.reason}`);
  } else if (drift.status === "drift") {
    for (const { component, detail, diverged } of drift.details ?? []) verdicts.red(component, detail, diverged ? "drift" : "other");
  } else {
    notes.push("Gate drift: fixture committate allineate a Penpot live.");
  }

  return { title: "gates:render", components: verdicts.verdicts(), global: global.verdicts(), notes };
}

export interface GatesArgs {
  /** `--json <path>` (Story 2.9): scrive anche il report JSON, con `kind` per problema. */
  jsonPath?: string;
}

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

const isDirectInvocation = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

/**
 * Entry del CLI senza `process.exit`: argomenti → gate → report (terminale,
 * `$GITHUB_STEP_SUMMARY`, JSON con `--json <path>`) → exit code.
 */
export async function runGatesCli(
  argv: readonly string[],
  deps: GatesDeps = defaultGatesDeps(),
  env: NodeJS.ProcessEnv = process.env,
  print?: (text: string) => void,
): Promise<number> {
  const args = parseGatesArgs(argv);
  const report = await runGates(deps);
  return publishReport(report, env, print, args.jsonPath);
}

if (isDirectInvocation) {
  runGatesCli(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
