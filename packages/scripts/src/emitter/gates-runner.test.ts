import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { exitCodeOf, renderMarkdown } from "../shared/component-report";
import type { LibrarySnapshot } from "../library/library-snapshot";
import { committedComponents, loadFixture } from "./artifacts";
import { parseGatesArgs } from "../cli/gates-render";
import { defaultGatesDeps, runGates, runGatesCommand, type GatesDeps } from "./gates-runner";

/**
 * Test del CLI gates:render (Story 2.8 parte B): un componente con un
 * artefatto rotto è una voce rossa, gli altri vengono comunque valutati e
 * compaiono nel report; la suite ui e la lettura live sono seam.
 */

const COMPONENTS = committedComponents();

function deps(overrides: Partial<GatesDeps> = {}): GatesDeps {
  return {
    ...defaultGatesDeps(),
    runSuite: () => ({ exitCode: 0, failedFiles: [], spawnError: null }),
    fetchLive: () => Promise.reject(new Error("Penpot irraggiungibile (test)")),
    ...overrides,
  };
}

describe("runGates — per componente", () => {
  it("tutti verdi: una voce ok per componente committato, drift skippato come nota, exit 0", async () => {
    const report = await runGates(deps());
    expect(report.components.map((v) => [v.component, v.status])).toEqual(COMPONENTS.map((c) => [c, "ok"]));
    expect(report.global.every((v) => v.status === "ok")).toBe(true);
    expect(report.notes.some((note) => note.includes("Gate drift SKIPPED"))).toBe(true);
    expect(exitCodeOf(report)).toBe(0);
    const md = renderMarkdown(report);
    for (const component of COMPONENTS) expect(md).toContain(`| ${component} | 🟢 ok |`);
  });

  it("un artefatto rotto (binding che lancia) rende rossa solo quella voce; gli altri sono valutati e ok", async () => {
    const [broken, ...others] = COMPONENTS;
    const base = defaultGatesDeps();
    const report = await runGates(
      deps({
        loadBinding: (name) => {
          if (name === broken) throw new Error(`Binding malformato per "${name}" (test)`);
          return base.loadBinding(name);
        },
      }),
    );
    const verdict = report.components.find((v) => v.component === broken)!;
    expect(verdict.status).toBe("red");
    expect(verdict.problems[0]!.message).toContain("Binding malformato");
    for (const component of others) {
      expect(report.components.find((v) => v.component === component)?.status).toBe("ok");
    }
    expect(exitCodeOf(report)).toBe(1);
  });

  it("un rendering che lancia (base assente) è rosso solo per quel componente", async () => {
    const [broken] = COMPONENTS;
    const base = defaultGatesDeps();
    const brokenBase = base.loadBinding(broken!).base;
    const report = await runGates(
      deps({
        loadBaseSources: (name) => {
          if (name === brokenBase) throw new Error(`Base shadcn "${name}" non trovata (test)`);
          return base.loadBaseSources(name);
        },
      }),
    );
    expect(report.components.find((v) => v.component === broken)?.problems.some((p) => p.message.includes("Gate rigenerazione"))).toBe(true);
    expect(report.components.filter((v) => v.status === "ok")).toHaveLength(COMPONENTS.length - 1);
  });

  it("un file generato divergente è rosso per il suo componente", async () => {
    const base = defaultGatesDeps();
    const report = await runGates(
      deps({
        existingFiles: () => {
          const files = base.existingFiles();
          files["inputs/Input.tsx"] = "// @generated — manomesso\n";
          return files;
        },
      }),
    );
    expect(report.components.find((v) => v.component === "Input")?.status).toBe("red");
    expect(report.components.find((v) => v.component === "Badge")?.status).toBe("ok");
  });

  it("la suite a11y in rosso è una riga globale rossa, non una voce di componente", async () => {
    const report = await runGates(deps({ runSuite: () => ({ exitCode: 1, failedFiles: [], spawnError: null }) }));
    expect(report.global.find((v) => v.component.includes("suite ui"))?.status).toBe("red");
    expect(report.components.every((v) => v.status === "ok")).toBe(true);
    expect(exitCodeOf(report)).toBe(1);
  });

  it("drift: live senza container → l'estrazione live di ogni componente fallisce, una voce rossa per componente", async () => {
    const report = await runGates(deps({ fetchLive: () => Promise.resolve({ sets: [], componentCount: 0, components: [] }) }));
    for (const component of COMPONENTS) {
      expect(report.components.find((v) => v.component === component)?.problems.some((p) => p.message.includes("Gate drift"))).toBe(true);
    }
  });

  it("drift: live dalle fixture committate con un token cambiato su Badge → solo Badge rosso, exit 1", async () => {
    const live: LibrarySnapshot = {
      sets: [],
      componentCount: COMPONENTS.length,
      components: COMPONENTS.map((component) => {
        const fixture = structuredClone(loadFixture(component));
        return {
          id: fixture.penpotComponentId,
          name: fixture.componentName,
          pluginData: fixture.contract,
          axes: fixture.axes.map((axis) => axis.name),
          axesValues: Object.fromEntries(fixture.axes.map((axis) => [axis.name, [...axis.values]])),
          cells: fixture.cells.map((cell) => ({ variantProps: { ...cell.variantProps }, variantError: null, root: cell.root })),
        };
      }),
    };
    live.components.find((c) => c.name === "Badge")!.cells[0]!.root.tokens.fill = "color.muted";
    const report = await runGates(deps({ fetchLive: () => Promise.resolve(live) }));
    const badge = report.components.find((v) => v.component === "Badge")!;
    expect(badge.status).toBe("red");
    expect(badge.problems.some((p) => p.message.includes("Gate drift") && p.message.includes("extract:component -- Badge"))).toBe(true);
    for (const component of COMPONENTS.filter((c) => c !== "Badge")) {
      expect(report.components.find((v) => v.component === component)?.status).toBe("ok");
    }
    expect(exitCodeOf(report)).toBe(1);
  });

  it("alias valido: layer `Label Text` + alias `label` nel binding → Badge ok", async () => {
    const base = defaultGatesDeps();
    const report = await runGates(
      deps({
        loadFixture: (name) => {
          const fixture = structuredClone(base.loadFixture(name));
          if (name === "Badge") {
            for (const cell of fixture.cells) for (const layer of cell.root.children) if (layer.name === "label") layer.name = "Label Text";
          }
          return fixture;
        },
        loadBinding: (name) => {
          const binding = structuredClone(base.loadBinding(name));
          if (name === "Badge") binding.parts.label!.aliases = ["Label Text"];
          return binding;
        },
      }),
    );
    expect(report.components.find((v) => v.component === "Badge")).toEqual({ component: "Badge", status: "ok", problems: [] });
  });

  it("alias verso una parte inesistente → Badge rosso con \"Binding: …alias…\", gli altri ok", async () => {
    const base = defaultGatesDeps();
    const report = await runGates(
      deps({
        loadBinding: (name) => {
          const binding = structuredClone(base.loadBinding(name));
          if (name === "Badge") binding.parts.label!.aliases = ["Label Text"];
          if (name === "Badge") binding.parts.icon = { ...binding.parts.label!, aliases: ["Icon"] };
          return binding;
        },
      }),
    );
    const badge = report.components.find((v) => v.component === "Badge")!;
    expect(badge.status).toBe("red");
    expect(badge.problems.some((p) => p.message.startsWith("Binding:") && p.message.includes('alias "Icon"'))).toBe(true);
    expect(report.components.find((v) => v.component === "Input")?.status).toBe("ok");
  });

  it("contratto sconosciuto nella fixture → voce rossa nominativa, gli altri valutati", async () => {
    const base = defaultGatesDeps();
    const report = await runGates(
      deps({
        loadFixture: (name) => (name === "Badge" ? { ...base.loadFixture(name), contract: "fantasma@1" } : base.loadFixture(name)),
      }),
    );
    const badge = report.components.find((v) => v.component === "Badge")!;
    expect(badge.status).toBe("red");
    expect(badge.problems[0]!.message).toMatch(/"fantasma@1", che non esiste in @app\/contracts/);
    expect(report.components.find((v) => v.component === "Input")?.status).toBe("ok");
  });

  it("ricetta committata malformata → voce rossa col nome del file, gli altri valutati e ok", async () => {
    const report = await runGates(
      deps({ components: () => ({ components: COMPONENTS, malformed: [{ file: "rotta.recipe.json", error: "Ricetta malformata (test)" }] }) }),
    );
    expect(report.components.find((v) => v.component === "rotta.recipe.json")?.status).toBe("red");
    expect(report.components.filter((v) => v.status === "ok")).toHaveLength(COMPONENTS.length);
    expect(exitCodeOf(report)).toBe(1);
  });

  it("catalogo non caricabile → riga globale rossa, nessun crash, componenti non valutati", async () => {
    const report = await runGates(
      deps({
        loadCatalog: () => {
          throw new Error("catalogo illeggibile (test)");
        },
      }),
    );
    expect(report.global.find((v) => v.component.startsWith("artefatti condivisi"))?.problems[0]?.message).toContain("catalogo illeggibile");
    expect(report.components.every((v) => v.status === "red" && v.problems[0]!.message.startsWith("Non valutato"))).toBe(true);
    expect(exitCodeOf(report)).toBe(1);
  });
});

describe("runGates — kind per problema (Story 2.9)", () => {
  function kindsOf(report: Awaited<ReturnType<typeof runGates>>, component: string): string[] {
    return report.components.find((v) => v.component === component)?.problems.map((p) => p.kind) ?? [];
  }

  function liveFromFixtures(): LibrarySnapshot {
    return {
      sets: [],
      componentCount: COMPONENTS.length,
      components: COMPONENTS.map((component) => {
        const fixture = structuredClone(loadFixture(component));
        return {
          id: fixture.penpotComponentId,
          name: fixture.componentName,
          pluginData: fixture.contract,
          axes: fixture.axes.map((axis) => axis.name),
          axesValues: Object.fromEntries(fixture.axes.map((axis) => [axis.name, [...axis.values]])),
          cells: fixture.cells.map((cell) => ({ variantProps: { ...cell.variantProps }, variantError: null, root: cell.root })),
        };
      }),
    };
  }

  it("verde: Penpot live uguale alle fixture → nessun problema, nessun kind", async () => {
    const report = await runGates(deps({ fetchLive: () => Promise.resolve(liveFromFixtures()) }));
    expect(report.components.flatMap((v) => v.problems)).toEqual([]);
  });

  it("drift: la fixture diverge da Penpot live (token cambiato)", async () => {
    const live = liveFromFixtures();
    live.components.find((c) => c.name === "Badge")!.cells[0]!.root.tokens.fill = "color.muted";
    const report = await runGates(deps({ fetchLive: () => Promise.resolve(live) }));
    expect(kindsOf(report, "Badge")).toEqual(["drift"]);
  });

  it("estrazione live impossibile (container assente) → other, non drift", async () => {
    const report = await runGates(deps({ fetchLive: () => Promise.resolve({ sets: [], componentCount: 0, components: [] }) }));
    for (const component of COMPONENTS) expect(kindsOf(report, component)).toEqual(["other"]);
  });

  it("gate-failed: file generato divergente (componente) e suite a11y rossa (riga globale)", async () => {
    const base = defaultGatesDeps();
    const report = await runGates(
      deps({
        existingFiles: () => ({ ...base.existingFiles(), "inputs/Input.tsx": "// @generated — manomesso\n" }),
        runSuite: () => ({ exitCode: 1, failedFiles: [], spawnError: null }),
      }),
    );
    expect(new Set(kindsOf(report, "Input"))).toEqual(new Set(["gate-failed"]));
    expect(kindsOf(report, "Badge")).toEqual([]);
    expect(report.global.flatMap((v) => v.problems.map((p) => p.kind))).toEqual(["gate-failed"]);
  });

  it("other: artefatto non caricabile", async () => {
    const [broken] = COMPONENTS;
    const base = defaultGatesDeps();
    const report = await runGates(
      deps({
        loadBinding: (name) => {
          if (name === broken) throw new Error("rotto (test)");
          return base.loadBinding(name);
        },
      }),
    );
    expect(kindsOf(report, broken!)).toEqual(["other"]);
  });
});

describe("parseGatesArgs (Story 2.9)", () => {
  it("nessun argomento o solo `--`: niente JSON; `--json <path>` lo abilita", () => {
    expect(parseGatesArgs([])).toEqual({});
    expect(parseGatesArgs(["--"])).toEqual({});
    expect(parseGatesArgs(["--", "--json", "/tmp/g.json"])).toEqual({ jsonPath: "/tmp/g.json" });
  });

  it("rifiuta --json senza percorso e argomenti sconosciuti", () => {
    expect(() => parseGatesArgs(["--json"])).toThrow(/richiede un percorso/);
    expect(() => parseGatesArgs(["--json", "--x"])).toThrow(/richiede un percorso/);
    expect(() => parseGatesArgs(["--force"])).toThrow(/--force/);
  });
});

describe("runGatesCommand — --json (Story 2.9)", () => {
  it("con --json <path> scrive il report JSON e restituisce l'exit code del report", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gates-json-"));
    try {
      const jsonPath = join(dir, "gates.json");
      const printed: string[] = [];
      const code = await runGatesCommand(parseGatesArgs(["--", "--json", jsonPath]), deps(), {}, (text) => printed.push(text));
      expect(existsSync(jsonPath)).toBe(true);
      const json = JSON.parse(readFileSync(jsonPath, "utf8"));
      expect(json.title).toBe("gates:render");
      expect(code).toBe(json.exitCode);
      expect(code).toBe(exitCodeOf(await runGates(deps())));
      expect(printed.join("\n")).toContain("gates:render —");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
