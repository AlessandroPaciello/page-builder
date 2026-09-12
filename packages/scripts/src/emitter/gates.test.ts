import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { componentFixtureFromSnapshot } from "../component-reader";
import type { LibrarySnapshot } from "../library/library-snapshot";
import type { ComponentFixture } from "../recipe-schema";
import {
  committedComponents,
  loadBaseSources,
  loadBinding,
  loadCatalog,
  loadFixture,
  loadRecipe,
  readExistingFiles,
  domainsRoot,
  recipesDir,
} from "./artifacts";
import {
  checkA11y,
  checkCompleteness,
  checkConformance,
  checkDrift,
  checkRegeneration,
} from "./gates";
import { loadJudgment } from "../extract-component";
import { renderComponent } from "./render-component";

/**
 * Prova rosso/verde dei cinque gate (Story 2.6, AC #2): per ognuno, un input
 * che lo viola lo fa fallire — testato qui, non con canary manuali. La lista
 * dei componenti è derivata dalle ricette committate, mai hard-coded.
 */

const COMPONENTS: string[] = committedComponents();
const catalog = loadCatalog();

function committedEntries() {
  return COMPONENTS.map((component) => {
    const fixture = loadFixture(component);
    const recipe = loadRecipe(component);
    const judgment = loadJudgment(fixture.contract.split("@")[0]!);
    return { component, fixture, recipe, judgment };
  });
}

describe("Copertura dei gate", () => {
  it("la lista dei componenti coperti == l'insieme delle *.recipe.json committate (nessun extra/missing)", () => {
    const committed = readdirSync(recipesDir)
      .filter((entry) => entry.endsWith(".recipe.json"))
      .map((entry) => loadRecipe(entry.replace(/\.recipe\.json$/, "")))
      .map((recipe) => recipe.componentName)
      .sort();
    expect(committed).toEqual([...COMPONENTS].sort());
  });

  it("ogni <Comp>.test.tsx committato in ui/domains importa vitest-axe e asserisce axe( (output dell'emitter, deterministico)", () => {
    const existing = readExistingFiles(domainsRoot);
    for (const component of COMPONENTS) {
      const recipe = loadRecipe(component);
      const path = `${recipe.judgment.domain}/${component}.test.tsx`;
      const content = existing[path];
      expect(content, `file di test mancante per ${component}: ${path}`).toBeDefined();
      expect(content).toContain('from "vitest-axe"');
      expect(content).toContain("axe(");
    }
  });
});

describe("Gate 1 — completezza artefatti", () => {
  it("verde sui file generati committati", () => {
    const existing = readExistingFiles(domainsRoot);
    const entries = committedEntries().map(({ component, recipe }) => ({
      component,
      domain: recipe.judgment.domain,
    }));
    expect(checkCompleteness(entries, Object.keys(existing))).toEqual({ ok: true, missing: [] });
  });

  it("rosso se manca un artefatto (lo nomina)", () => {
    const existing = Object.keys(readExistingFiles(domainsRoot)).filter((path) => !path.endsWith("Badge.stories.tsx"));
    const entries = committedEntries().map(({ component, recipe }) => ({ component, domain: recipe.judgment.domain }));
    const result = checkCompleteness(entries, existing);
    expect(result.ok).toBe(false);
    expect(result.missing).toContainEqual({ component: "Badge", path: "data-display/Badge.stories.tsx" });
  });
});

describe("Gate 2 — rigenerazione a diff zero", () => {
  function renderAll(existing: Record<string, string>) {
    return committedEntries().map(({ component, fixture, recipe }) => {
      const binding = loadBinding(component);
      const rendered = renderComponent(fixture, recipe, binding, loadBaseSources(binding.base), catalog, {
        existingFiles: existing,
      });
      return { component, files: rendered.files };
    });
  }

  it("verde sui file committati", () => {
    const existing = readExistingFiles(domainsRoot);
    expect(checkRegeneration(renderAll(existing), existing).ok).toBe(true);
  });

  it("rosso se un file generato diverge (lo nomina col componente)", () => {
    const existing = readExistingFiles(domainsRoot);
    existing["inputs/Input.tsx"] = "// @generated — manomesso\n";
    const result = checkRegeneration(renderAll(existing), existing);
    expect(result.ok).toBe(false);
    expect(result.divergences).toContainEqual({ component: "Input", path: "inputs/Input.tsx", reason: "divergente" });
  });
});

describe("Gate 3 — a11y (esito suite ui)", () => {
  it("verde con suite a exit 0", () => {
    expect(checkA11y({ exitCode: 0 })).toEqual({ ok: true, detail: expect.stringContaining("verde") });
  });

  it("rosso con suite in fallimento (dettaglio nominativo)", () => {
    const result = checkA11y({ exitCode: 1, failedFiles: ["Badge.test.tsx"] });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("Badge.test.tsx");
  });

  it("rosso con spawn fallito (status null o errore di spawn): mai un verde vacuo", () => {
    const withError = checkA11y({ exitCode: null, spawnError: "spawn pnpm ENOENT" });
    expect(withError.ok).toBe(false);
    expect(withError.detail).toContain("spawn pnpm ENOENT");
    const withoutCode = checkA11y({ exitCode: null });
    expect(withoutCode.ok).toBe(false);
    expect(withoutCode.detail).toContain("non ha prodotto un exit code");
  });
});

describe("Gate 4 — conformità al contratto", () => {
  it("verde sugli artefatti committati (riuso validateRecipe, senza duplicare)", () => {
    const entries = committedEntries().map(({ component, fixture, recipe, judgment }) => ({
      component,
      fixture,
      recipe,
      catalog,
      judgment,
    }));
    expect(checkConformance(entries).ok).toBe(true);
  });

  it("rosso con un token che non esiste nel catalogo (literal rifiutato, errori nominativi)", () => {
    // Badge, non il primo della lista derivata (ordinata): la cella di test
    // è specifica del contratto badge (variant/size).
    const first = committedEntries().find((entry) => entry.component === "Badge")!;
    const { component, fixture, recipe, judgment } = first;
    const tampered = structuredClone(recipe);
    tampered.parts.root!["variant=default|size=md"]!.fill = "colore.inventato";
    const result = checkConformance([{ component, fixture, recipe: tampered, catalog, judgment }]);
    expect(result.ok).toBe(false);
    expect(result.failures[0]!.component).toBe(component);
    expect(result.failures[0]!.errors.join("\n")).toContain("non è un token del catalogo");
  });
});

describe("Gate 5 — drift della fixture", () => {
  function snapshotFrom(fixture: ComponentFixture): LibrarySnapshot {
    return {
      sets: [],
      componentCount: 1,
      components: [
        {
          id: fixture.penpotComponentId,
          name: fixture.componentName,
          pluginData: fixture.contract,
          axes: fixture.axes.map((axis) => axis.name),
          axesValues: Object.fromEntries(fixture.axes.map((axis) => [axis.name, [...axis.values]])),
          cells: fixture.cells.map((cell) => ({ variantProps: { ...cell.variantProps }, variantError: null, root: cell.root })),
        },
      ],
    };
  }

  function committedFixture(component: string): ComponentFixture {
    return committedEntries().find((entry) => entry.component === component)!.fixture;
  }

  it("verde quando Penpot live coincide con la fixture committata", async () => {
    const result = await checkDrift({
      components: [{ component: "Badge", committedFixture: committedFixture("Badge") }],
      fetchLive: async () => snapshotFrom(committedFixture("Badge")),
    });
    expect(result.status).toBe("ok");
  });

  it("rosso quando live diverge: nomina il componente da riestrarre", async () => {
    const snapshot = snapshotFrom(committedFixture("Badge"));
    snapshot.components[0]!.cells[0]!.root.tokens.fill = "color.muted";
    const result = await checkDrift({
      components: [{ component: "Badge", committedFixture: committedFixture("Badge") }],
      fetchLive: async () => snapshot,
    });
    expect(result.status).toBe("drift");
    expect(result.drifted).toEqual(["Badge"]);
  });

  it("Penpot irraggiungibile → skip documentato, mai finto verde", async () => {
    const result = await checkDrift({
      components: [{ component: "Badge", committedFixture: committedFixture("Badge") }],
      fetchLive: async () => {
        throw new Error("connection refused");
      },
    });
    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("connection refused");
  });

  it("la round-trip della fixture committata via snapshot produce la stessa fixture (invariante del confronto)", () => {
    const fixture = committedFixture("Badge");
    expect(componentFixtureFromSnapshot("Badge", snapshotFrom(fixture))).toEqual(fixture);
  });
});
