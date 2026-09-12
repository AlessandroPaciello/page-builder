import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadJudgment } from "../extract-component";
import { readLibrarySnapshot } from "../library/library-reader";
import {
  committedComponents,
  loadBaseSources,
  loadBinding,
  loadCatalog,
  loadFixture,
  loadRecipe,
  readExistingFiles,
  domainsRoot,
  basesDir,
} from "./artifacts";
import {
  checkA11y,
  checkCompleteness,
  checkConformance,
  checkDrift,
  checkRegeneration,
  type CompletenessEntry,
  type ConformanceEntry,
  type DriftEntry,
  type RegenerationEntry,
} from "./gates";
import { renderComponent } from "./render-component";

/**
 * CLI dei gate del regime design→codice (Story 2.6, Task 8):
 *
 *   gates:render
 *     1. completezza artefatti    (4 file per componente in ui/domains)
 *     2. rigenerazione a diff zero (renderCheck, nessuna scrittura)
 *     3. a11y                     (esito della suite `@penpot-ds/ui`, assert axe)
 *     4. conformità al contratto  (validateRecipe sugli artefatti committati)
 *     5. drift della fixture      (Penpot live vs fixture committata)
 *
 * I componenti coperti sono derivati dalle ricette committate
 * (`src/recipes/*.recipe.json`): un componente futuro entra nei gate per
 * costruzione, non resta fuori in silenzio da una lista hard-coded.
 *
 * Il gate drift è bloccante SE E SOLO SE il runner raggiunge il server MCP
 * Penpot (decisione frozen, opzione a): altrimenti skip documentato col
 * motivo nel log, mai un verde finto; riesecuzione manuale/nightly.
 * Nessuna estrazione Penpot in CI/build: l'unica lettura live è questa, con
 * seam offline per i test.
 */

async function main(): Promise<void> {
  const catalog = loadCatalog();
  const COMPONENTS = committedComponents();
  let failed = false;

  // Gate 4 — conformità al contratto.
  const conformanceEntries: ConformanceEntry[] = [];
  const driftEntries: DriftEntry[] = [];
  for (const component of COMPONENTS) {
    const fixture = loadFixture(component);
    const recipe = loadRecipe(component);
    const judgment = loadJudgment(fixture.contract.split("@")[0]!);
    conformanceEntries.push({ component, fixture, recipe, catalog, judgment });
    driftEntries.push({ component, committedFixture: fixture });
  }
  const conformance = checkConformance(conformanceEntries);
  if (conformance.ok) {
    console.log("✔ Gate conformità al contratto: fixture e ricette conformi (validateRecipe).");
  } else {
    failed = true;
    for (const failure of conformance.failures) {
      console.error(`✗ Gate conformità — ${failure.component}:\n${failure.errors.map((e) => `  ${e}`).join("\n")}`);
    }
  }

  // Gate 1 — completezza artefatti.
  const existing = readExistingFiles(domainsRoot);
  const completenessEntries: CompletenessEntry[] = [];
  for (const component of COMPONENTS) {
    const recipe = loadRecipe(component);
    completenessEntries.push({ component, domain: recipe.judgment.domain });
  }
  const completeness = checkCompleteness(completenessEntries, Object.keys(existing));
  if (completeness.ok) {
    console.log("✔ Gate completezza artefatti: .tsx + .test.tsx + .stories.tsx + index.ts per ogni componente.");
  } else {
    failed = true;
    for (const missing of completeness.missing) {
      console.error(`✗ Gate completezza — ${missing.component}: manca ${missing.path}`);
    }
  }

  // Gate 2 — rigenerazione a diff zero (renderCheck, nessuna scrittura).
  const regenerationEntries: RegenerationEntry[] = [];
  for (const component of COMPONENTS) {
    const fixture = loadFixture(component);
    const recipe = loadRecipe(component);
    const binding = loadBinding(component);
    const baseSources = loadBaseSources(binding.base, basesDir);
    const rendered = renderComponent(fixture, recipe, binding, baseSources, catalog, { existingFiles: existing });
    regenerationEntries.push({ component, files: rendered.files });
    for (const skipped of rendered.skippedProperties) {
      console.log(
        `  SKIP proprietà "${skipped.property}" (parte "${skipped.part}", cella "${skipped.cell}", token "${skipped.token}"): ${skipped.reason}`,
      );
    }
  }
  const regeneration = checkRegeneration(regenerationEntries, existing);
  if (regeneration.ok) {
    console.log("✔ Gate rigenerazione: output dell'emitter a diff zero sui file committati.");
  } else {
    failed = true;
    for (const divergence of regeneration.divergences) {
      console.error(
        `✗ Gate rigenerazione — ${divergence.component}: file ${divergence.reason === "missing" ? "assente" : "divergente"}: ${divergence.path}`,
      );
    }
  }

  // Gate 3 — a11y: esito della suite del package ui (vitest-axe su ogni
  // componente generato). Il suite gira nel package per cwd, senza nomi di
  // package in literal: il confine scripts ↛ @penpot-ds/ui resta integro.
  // Un fallimento a monte del processo (spawn fallito, status null) NON è
  // un verde: passa nel dettaglio del gate.
  const uiPackageRoot = fileURLToPath(new URL("../../../ui", import.meta.url));
  const suite = spawnSync("pnpm", ["test"], { cwd: uiPackageRoot, stdio: "inherit" });
  const spawnError =
    suite.error?.message ?? (suite.status === null ? "il processo della suite non ha prodotto un exit code" : null);
  const a11y = checkA11y({ exitCode: suite.status, failedFiles: [], spawnError });
  if (a11y.ok) {
    console.log("✔ Gate a11y: suite ui verde (assert axe su ogni componente generato).");
  } else {
    failed = true;
    console.error(`✗ Gate a11y: ${a11y.detail}`);
  }

  // Gate 5 — drift della fixture: bloccante se e solo se Penpot è raggiungibile.
  const drift = await checkDrift({
    components: driftEntries,
    fetchLive: () => readLibrarySnapshot({ timeoutMs: 15_000 }),
  });
  if (drift.status === "ok") {
    console.log("✔ Gate drift: fixture committate allineate a Penpot live.");
  } else if (drift.status === "skipped") {
    console.log(`⊘ Gate drift SKIPPED — ${drift.reason}`);
  } else {
    failed = true;
    console.error(`✗ Gate drift: ${drift.reason}`);
  }

  if (failed) {
    console.error("gates:render: ALMENO UN GATE IN ROSSO.");
    process.exitCode = 1;
  }
}

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
