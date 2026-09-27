import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { LibrarySnapshot, SnapshotLayer } from "../../library/library-snapshot";
import { PATHS } from "../../shared/paths";
import { productCardExtraction } from "../contracts/product-card.extract";
import { ScriptError } from "../errors";
import { expectedAxes, expectedCells, partsForCell } from "../library-plan";
import { runShell, type ShellIo } from "../shell";
import { loadComponentSnapshot } from "../components";
import { extractCommandWith } from "./extract";
import { renderCommandWith } from "./render";
import { gatesCommandWith, runGatesV2 } from "./gates";

/**
 * `gates` (Story 2-15, CAP-9): `render --check --all` in memoria + suite `ui`
 * con axe, report per componente. Una prova rosso/verde per ogni riga della
 * matrice, esito solo da exit code (`input` 1 / `gate` 4 nominativo). Mai
 * live: solo istantanee committate, file generati e suite.
 */

const EXTRACTION = productCardExtraction;

function io(): ShellIo & { outLogs: string[]; errLogs: string[] } {
  const outLogs: string[] = [];
  const errLogs: string[] = [];
  return { outLogs, errLogs, out: (text) => outLogs.push(text), err: (text) => errLogs.push(text) };
}

const dirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "gates-v2-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function boardName(variantProps: Readonly<Record<string, string>>): string {
  return `ProductCard ${Object.entries(variantProps).map(([axis, value]) => `${axis}=${value}`).join("|")}`;
}

function buildRoot(variantProps: Readonly<Record<string, string>>): SnapshotLayer {
  const parts = partsForCell(EXTRACTION, variantProps);
  const nodes = new Map<string, SnapshotLayer>();
  for (const part of parts) {
    const isRoot = part.name === "root";
    nodes.set(part.name, {
      name: isRoot ? boardName(variantProps) : part.layer,
      kind: part.kind === "text" ? "text" : "board",
      tokens: { ...part.tokens },
      style: {},
      children: [],
    });
  }
  for (const part of parts) {
    if (part.name === "root") continue;
    nodes.get(part.parent!)!.children.push(nodes.get(part.name)!);
  }
  return nodes.get("root")!;
}

function conformantLibrarySnapshot(): LibrarySnapshot {
  const axes = expectedAxes(EXTRACTION);
  return {
    sets: [],
    componentCount: 1,
    components: [
      {
        id: "container-id",
        name: "ProductCard",
        pluginData: EXTRACTION.pluginData,
        axes: axes.map((axis) => axis.name),
        axesValues: Object.fromEntries(axes.map((axis) => [axis.name, [...axis.values]])),
        cells: expectedCells(EXTRACTION).map((cell) => ({
          variantProps: { ...cell.variantProps },
          variantError: null,
          root: buildRoot(cell.variantProps),
        })),
      },
    ],
  };
}

function catalog(): { sets: Array<{ name: string; tokens: Array<{ name: string; type: string; value: unknown }> }> } {
  return JSON.parse(readFileSync(PATHS.catalogPath, "utf8")) as never;
}

async function greenDirs(): Promise<{ componentsDir: string; domainsDir: string }> {
  const componentsDir = tmp();
  const domainsDir = tmp();
  const extractor = extractCommandWith({ readSnapshot: async () => conformantLibrarySnapshot(), componentsDir, log: () => undefined, catalog: catalog() as never });
  expect(await runShell(["extract", "ProductCard"], [extractor], io())).toBe(0);
  const renderer = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
  expect(await runShell(["render", "--all"], [renderer], io())).toBe(0);
  // Il giudizio visivo è parte del template (decisione GIUDIZIO-VISIVO): il
  // render vero lo emette, il gate lo esige — nessuna patch qui.
  expect(readFileSync(join(domainsDir, "commerce/ProductCard.stories.tsx"), "utf8")).toContain("Giudizio visivo");
  return { componentsDir, domainsDir };
}

describe("gates — verde (render --check --all + suite ui + axe, report per componente)", () => {
  it("verde: istantanea e generati allineati + suite ok → exit 0, report con una voce ok", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const shell = io();
    const printed: string[] = [];
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0, failedFiles: [], spawnError: null }),
      log: () => undefined,
      print: (text) => printed.push(text),
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(0);
    expect(shell.errLogs).toEqual([]);
    expect(printed.join("\n")).toMatch(/gates — 1 componenti: 1 ok/);
    expect(printed.join("\n")).toMatch(/ProductCard\s+✔ ok/);
  });

  it("--help: uso con [--json], senza letture né suite", async () => {
    const shell = io();
    const logs: string[] = [];
    let suiteCalled = false;
    const command = gatesCommandWith({
      componentsDir: tmp(),
      domainsDir: tmp(),
      catalog: catalog() as never,
      runSuite: () => {
        suiteCalled = true;
        return { exitCode: 0 };
      },
      log: (text) => logs.push(text),
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates", "--help"], [command], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/Uso: gates \[--json <path>\]/);
    expect(suiteCalled).toBe(false);
    expect(shell.errLogs).toEqual([]);
  });

  it("--json <path>: scrive il report JSON oltre al report per componente", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const dir = tmp();
    const jsonPath = join(dir, "gates.json");
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates", "--json", jsonPath], [command], shell)).toBe(0);
    const json = JSON.parse(readFileSync(jsonPath, "utf8")) as { title: string; exitCode: number; components: Array<{ component: string; status: string }> };
    expect(json.title).toBe("gates");
    expect(json.components).toEqual([{ component: "ProductCard", status: "ok", problems: [] }]);
  });

  it("$GITHUB_STEP_SUMMARY: appende il report Markdown con la riga di ProductCard", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const summaryPath = join(tmp(), "step-summary.md");
    writeFileSync(summaryPath, "");
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: { GITHUB_STEP_SUMMARY: summaryPath },
    });
    expect(await runShell(["gates"], [command], shell)).toBe(0);
    expect(readFileSync(summaryPath, "utf8")).toMatch(/\| ProductCard \| 🟢 ok \|/);
  });
});

describe("gates — rosso nominativo (exit 4 gate, solo la voce divergente)", () => {
  it("file divergente: solo la sua voce rossa, exit 4 che nomina il componente", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    writeFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "// @generated\ndivergente");
    const shell = io();
    const printed: string[] = [];
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: (text) => printed.push(text),
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    expect(printed.join("\n")).toMatch(/ProductCard\s+✖ rosso/);
    const err = shell.errLogs.join("\n");
    expect(err).toMatch(/✖ gate[\s\S]*ProductCard/);
    expect(err).toMatch(/componenti rossi: ProductCard/);
  });

  it("barrel divergente: voce rossa che nomina il barrel e il comando --all", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    writeFileSync(join(domainsDir, "commerce/index.ts"), "// @generated\ndivergente");
    const shell = io();
    const printed: string[] = [];
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: (text) => printed.push(text),
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    expect(printed.join("\n")).toMatch(/commerce\/index\.ts/);
    expect(shell.errLogs.join("\n")).toMatch(/ProductCard/);
  });

  it("istantanea corrotta: exit 4 nominativo con voce gate-failed", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    writeFileSync(join(componentsDir, "product-card.json"), "{corrotta");
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    expect(shell.errLogs.join("\n")).toMatch(/✖ gate[\s\S]*ProductCard/);
    const report = await runGatesV2({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
    });
    const verdict = report.components.find((v) => v.component === "ProductCard")!;
    expect(verdict.status).toBe("red");
    expect(verdict.problems.some((p) => p.kind === "gate-failed" && p.message.includes("Istantanea non caricabile"))).toBe(true);
  });

  it("test senza axe: voce rossa a11y che nomina il file", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const testPath = join(domainsDir, "commerce/ProductCard.test.tsx");
    writeFileSync(testPath, readFileSync(testPath, "utf8").replaceAll("axe(", "senzaAxe("));
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    expect(shell.errLogs.join("\n")).toMatch(/ProductCard/);
    const report = await runGatesV2({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
    });
    expect(report.components.find((v) => v.component === "ProductCard")?.problems.some((p) => p.message.includes("Gate a11y"))).toBe(true);
  });

  it("story senza giudizio visivo: voce rossa che nomina la story", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const storiesPath = join(domainsDir, "commerce/ProductCard.stories.tsx");
    writeFileSync(storiesPath, readFileSync(storiesPath, "utf8").replaceAll("Giudizio visivo", "Senza nota"));
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    const report = await runGatesV2({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
    });
    expect(report.components.find((v) => v.component === "ProductCard")?.problems.some((p) => p.message.includes("Gate story"))).toBe(true);
  });

  it("suite ui rossa: riga globale rossa, componenti comunque verificati e ok", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const shell = io();
    const printed: string[] = [];
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 1, failedFiles: [], spawnError: null }),
      log: () => undefined,
      print: (text) => printed.push(text),
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    expect(printed.join("\n")).toMatch(/ProductCard\s+✔ ok/);
    expect(shell.errLogs.join("\n")).toMatch(/controlli globali rossi/);
  });

  it("suite che non parte: mai un verde, exit 4 con motivo", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: null, spawnError: "spawn fallito (test)" }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    expect(shell.errLogs.join("\n")).toMatch(/✖ gate/);
  });

  it("istantanea con contract diverso: voce rossa che nomina il contract atteso", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const snapshot = loadComponentSnapshot("ProductCard", componentsDir);
    writeFileSync(join(componentsDir, "product-card.json"), JSON.stringify({ ...snapshot, contract: "product-card@2" }, null, 2));
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    expect(shell.errLogs.join("\n")).toMatch(/ProductCard/);
  });

  it("skip protettivo: file senza marker mai sovrascritto, gate verde", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    // Il tsx senza marker è sganciato dalla pipeline: il gate lo ignora (come `render --check`).
    writeFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "// scritto a mano\nmanuale");
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(0);
  });
});

describe("gates — rosso input e isolamento", () => {
  it("rosso (input, exit 1): argomento non atteso, --json senza valore o duplicato", async () => {
    const base = { componentsDir: tmp(), domainsDir: tmp(), catalog: catalog() as never, runSuite: () => ({ exitCode: 0 }), log: () => undefined, print: () => undefined, env: {} };
    let shell = io();
    expect(await runShell(["gates", "ProductCard"], [gatesCommandWith(base)], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input/);
    shell = io();
    expect(await runShell(["gates", "--json"], [gatesCommandWith(base)], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*--json richiede un valore/);
    shell = io();
    expect(await runShell(["gates", "--bogus"], [gatesCommandWith(base)], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*"--bogus" non riconosciuto/);
  });

  it("nessuna istantanea: riga globale rossa, exit 4 (mai verde vacuo)", async () => {
    const shell = io();
    const command = gatesCommandWith({
      componentsDir: tmp(),
      domainsDir: tmp(),
      catalog: catalog() as never,
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
    expect(shell.errLogs.join("\n")).toMatch(/✖ gate/);
  });

  it("catalogo illeggibile: righe rosse senza crash, exit 4", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const shell = io();
    const command = gatesCommandWith({
      componentsDir,
      domainsDir,
      catalogPath: join(tmp(), "assente.json"),
      runSuite: () => ({ exitCode: 0 }),
      log: () => undefined,
      print: () => undefined,
      env: {},
    });
    expect(await runShell(["gates"], [command], shell)).toBe(4);
  });

  it("direct run lancia ScriptError con kind corretto (input per uso, gate per verifiche)", async () => {
    const { componentsDir, domainsDir } = await greenDirs();
    const inputCommand = gatesCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, runSuite: () => ({ exitCode: 0 }), log: () => undefined });
    try {
      await inputCommand.run(["--bogus"]);
      expect.unreachable("atteso ScriptError input");
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptError);
      expect((error as ScriptError).kind).toBe("input");
    }
    writeFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "// @generated\ndivergente");
    const gateCommand = gatesCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, runSuite: () => ({ exitCode: 0 }), log: () => undefined, print: () => undefined, env: {} });
    try {
      await gateCommand.run([]);
      expect.unreachable("atteso ScriptError gate");
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptError);
      expect((error as ScriptError).kind).toBe("gate");
      expect((error as ScriptError).component).toBe("ProductCard");
    }
  });

  it("mai live in CI: il sorgente non legge Penpot né scrive snapshot/contratti", () => {
    const source = readFileSync(join(PATHS.packageRoot, "src/v2/commands/gates.ts"), "utf8");
    expect(source).not.toMatch(/readLibrarySnapshot/);
    expect(source).not.toMatch(/callPenpotTool/);
    expect(source).not.toMatch(/execute_code/);
    expect(source).not.toMatch(/writeComponentSnapshotAtomic/);
    // `process.exit`/`process.exitCode` solo nel guscio (boundary v1↛v2):
    // `process.env` per $GITHUB_STEP_SUMMARY è ammesso.
    expect(source).not.toMatch(/process\.exit\s*\(/);
    expect(source).not.toMatch(/process\.exitCode/);
  });
});
