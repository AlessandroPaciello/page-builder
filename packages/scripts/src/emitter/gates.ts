import { componentFixtureFromSnapshot } from "../component-reader";
import type { ComponentFixture } from "../recipe-schema";
import type { LibrarySnapshot } from "../library/library-snapshot";
import { stableStringify, validateRecipe } from "../validate-recipe";
import { renderCheck, type RenderedFile } from "./render-component";

/**
 * I cinque gate del regime design→codice (Story 2.6, AC #2; penpot-pipeline.md
 * «Gate di verifica»): funzioni PURE, ognuna con prova rosso/verde propria
 * nella suite — un input che viola il gate lo fa fallire, non un canary
 * manuale. Il wiring CI è in `gates-cli.ts` + `.github/workflows/ci.yml`.
 */

export interface CompletenessEntry {
  component: string;
  domain: string;
}

/** Gate 1 — Completezza artefatti: per ogni componente `.tsx` + `.test.tsx` + `.stories.tsx` + `index.ts`. */
export function checkCompleteness(
  components: readonly CompletenessEntry[],
  existingPaths: readonly string[],
): { ok: boolean; missing: Array<{ component: string; path: string }> } {
  const present = new Set(existingPaths);
  const missing: Array<{ component: string; path: string }> = [];
  for (const { component, domain } of components) {
    for (const file of [`${component}.tsx`, `${component}.test.tsx`, `${component}.stories.tsx`]) {
      const path = `${domain}/${file}`;
      if (!present.has(path)) missing.push({ component, path });
    }
    const indexPath = `${domain}/index.ts`;
    if (!present.has(indexPath)) missing.push({ component, path: indexPath });
  }
  return { ok: missing.length === 0, missing };
}

export interface RegenerationEntry {
  component: string;
  files: readonly RenderedFile[];
}

/** Gate 2 — Rigenerazione: l'emitter sugli artefatti committati produce diff zero (via `renderCheck`). */
export function checkRegeneration(
  entries: readonly RegenerationEntry[],
  existing: Record<string, string>,
): { ok: boolean; divergences: Array<{ component: string; path: string; reason: "missing" | "divergente" }> } {
  const divergences: Array<{ component: string; path: string; reason: "missing" | "divergente" }> = [];
  for (const entry of entries) {
    const check = renderCheck(entry.files, existing);
    for (const divergence of check.divergences) {
      divergences.push({ component: entry.component, ...divergence });
    }
  }
  return { ok: divergences.length === 0, divergences };
}

export interface A11ySuiteResult {
  /** Exit code della suite `@penpot-ds/ui` (vitest con assert axe su ogni componente generato). */
  exitCode: number | null;
  /** File di test falliti, per il messaggio nominativo. */
  failedFiles?: string[];
  /** Errore dello spawn della suite (processo non partito o ucciso): NON è un verde. */
  spawnError?: string | null;
}

/** Gate 3 — A11y: esito della suite ui (vitest-axe verde su ogni componente generato). */
export function checkA11y(result: A11ySuiteResult): { ok: boolean; detail: string } {
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

export interface ConformanceEntry {
  component: string;
  fixture: unknown;
  recipe: unknown;
  catalog: Parameters<typeof validateRecipe>[2];
  judgment: unknown;
}

/** Gate 4 — Conformità al contratto: riuso `validateRecipe` (assi/valori/parti, token, ricetta↔fixture, giudizio) — senza duplicare. */
export function checkConformance(entries: readonly ConformanceEntry[]): {
  ok: boolean;
  failures: Array<{ component: string; errors: string[] }>;
} {
  const failures: Array<{ component: string; errors: string[] }> = [];
  for (const entry of entries) {
    const result = validateRecipe(entry.fixture, entry.recipe, entry.catalog, entry.judgment);
    if (!result.valid) failures.push({ component: entry.component, errors: result.errors });
  }
  return { ok: failures.length === 0, failures };
}

export interface DriftEntry {
  component: string;
  committedFixture: ComponentFixture;
}

export interface DriftResult {
  status: "ok" | "drift" | "skipped";
  /** Per `drift`: i componenti da riestrarre, nominati. */
  drifted?: string[];
  /** Per `skipped`: il motivo documentato (Penpot irraggiungibile). Mai un verde finto. */
  reason?: string;
}

/**
 * Gate 5 — Drift della fixture: `hash(fixture committata) == hash(Penpot live)`
 * per ogni componente; se diverge segnala QUALE componente riestrarre. Il
 * confronto è sulla serializzazione stabile della fixture intera (equivalente
 * all'hash, ma nominativo). Il seam `fetchLive` NON può classificare l'errore
 * (rete, auth, server): qualunque fallimento della lettura live è skip
 * DOCUMENTATO col motivo e l'errore originale — mai un verde finto, mai un
 * rosso per un'indisponibilità.
 */
export async function checkDrift(options: {
  components: readonly DriftEntry[];
  fetchLive: () => Promise<LibrarySnapshot>;
}): Promise<DriftResult> {
  let live: LibrarySnapshot;
  try {
    live = await options.fetchLive();
  } catch (error) {
    return {
      status: "skipped",
      reason: `lettura live Penpot fallita (${error instanceof Error ? error.message : String(error)}) — gate drift skippato con motivo documentato: rieseguirlo manuale/nightly contro il server MCP.`,
    };
  }
  const drifted: string[] = [];
  for (const { component, committedFixture } of options.components) {
    let liveFixture: ComponentFixture;
    try {
      liveFixture = componentFixtureFromSnapshot(component, live);
    } catch (error) {
      drifted.push(`${component} (estrazione live fallita: ${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    if (stableStringify(liveFixture) !== stableStringify(committedFixture)) {
      drifted.push(component);
    }
  }
  if (drifted.length > 0) {
    return { status: "drift", drifted, reason: `riestrarre con extract:component: ${drifted.join(", ")}` };
  }
  return { status: "ok" };
}
