import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import {
  BOUNDARY_RULES,
  checkBoundaries,
  isForbiddenSpecifier,
  isMcpClientSpecifier,
  type BoundaryReport,
} from "../scripts/check-boundaries.mjs";

/**
 * Prova rosso/verde del gate di `packages/scripts` (Story 2.4, Task 9,
 * action item retro Epic 1): se un caso rosso passa, il gate è rotto, non il
 * test. Il test sta in `tests/` (non in `src/`) perché il gate scansiona
 * `src/` e i casi rossi conterrebbero gli specifier vietati.
 */

const REAL_PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), "../../");

let roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

/** Crea un package finto con `src/` popolata dai file indicati. */
function fakePackage(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "scripts-boundaries-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe("isForbiddenSpecifier", () => {
  it("`@app/contracts` è ammesso, con o senza sottopercorso", () => {
    expect(isForbiddenSpecifier("@app/contracts")).toBe(false);
    expect(isForbiddenSpecifier("@app/contracts/registry")).toBe(false);
  });

  it("`@app/*` diverso da contracts è vietato, anche con traversata", () => {
    expect(isForbiddenSpecifier("@app/domain")).toBe(true);
    expect(isForbiddenSpecifier("@app/contracts/../domain")).toBe(true);
    expect(isForbiddenSpecifier("@app/contracts/..")).toBe(true);
    expect(isForbiddenSpecifier("@app/contractsx")).toBe(true);
  });

  it("`@penpot-ds/ui` e `apps/*` restano vietati", () => {
    expect(isForbiddenSpecifier("@penpot-ds/ui")).toBe(true);
    expect(isForbiddenSpecifier("@penpot-ds/ui/editor")).toBe(true);
    expect(isForbiddenSpecifier("apps/web")).toBe(true);
  });

  it("gli specifier estranei non riguardano il gate", () => {
    expect(isForbiddenSpecifier("@modelcontextprotocol/sdk")).toBe(false);
    expect(isForbiddenSpecifier("@penpot-ds/tokens")).toBe(false);
    expect(isForbiddenSpecifier("./shared/paths")).toBe(false);
  });
});

describe("checkBoundaries: verde", () => {
  it("import di @app/contracts in src/", () => {
    const report = checkBoundaries({
      packageRoot: fakePackage({
        "src/index.ts": 'import { COMPONENT_CONTRACTS } from "@app/contracts";\nimport { x } from "./local";\nexport { x };\n',
        "src/local.ts": 'import type { ComponentContract } from "@app/contracts";\nexport const x = 1;\n',
      }),
    });
    expect(report).toEqual({ violations: [], scanErrors: [], scannedFileCount: 2 });
  });

  it("import relativo interno fra cartelle di src/ (`../shared/paths`) è verde", () => {
    const report = checkBoundaries({
      packageRoot: fakePackage({
        "src/shared/paths.ts": "export const PATHS = {};\n",
        "src/cli/main.ts": 'import { PATHS } from "../shared/paths";\nexport { PATHS };\n',
        "src/index.ts": 'export { PATHS } from "./shared/paths";\n',
      }),
    });
    expect(report).toEqual({ violations: [], scanErrors: [], scannedFileCount: 3 });
  });

  it("un literal `../` che non è un import (path in un messaggio) non riguarda il check dei relativi", () => {
    const report = checkBoundaries({
      packageRoot: fakePackage({ "src/index.ts": 'export const hint = "../../tokens/src";\n' }),
    });
    expect(report.violations).toEqual([]);
  });

  it("un import vietato in una base shadcn `data/bases/x/x.tsx` è rosso", () => {
    const report = checkBoundaries({
      packageRoot: fakePackage({
        "src/index.ts": "export const x = 1;\n",
        "data/bases/x/x.tsx": 'import { Button } from "@penpot-ds/ui";\nexport { Button };\n',
      }),
    });
    expect(report.violations.some((v) => v.specifier === "@penpot-ds/ui" && v.file === join("data", "bases", "x", "x.tsx")), JSON.stringify(report)).toBe(true);
  });

  it("il package reale packages/scripts è verde (pipeline unica, senza basi v1)", () => {
    const report = checkBoundaries({ packageRoot: REAL_PACKAGE_ROOT });
    expect(report.violations).toEqual([]);
    expect(report.scanErrors).toEqual([]);
    expect(report.scannedFileCount).toBeGreaterThan(0);
    // Senza data/bases/ (v1 cancellata, Story 2.16): solo src/ viene scansionato.
    const srcCount = readdirSync(join(REAL_PACKAGE_ROOT, "src"), { recursive: true }).filter((entry) => /\.tsx?$/.test(String(entry))).length;
    expect(report.scannedFileCount).toBe(srcCount);
  });
});

describe("checkBoundaries: rosso", () => {
  function checkSource(source: string): BoundaryReport {
    return checkBoundaries({
      packageRoot: fakePackage({
        "src/index.ts": 'import { x } from "./local";\nexport { x };\n',
        "src/local.ts": source,
      }),
    });
  }

  function expectRed(report: BoundaryReport, specifier: string): void {
    expect(report.violations.some((violation) => violation.specifier === specifier), JSON.stringify(report)).toBe(true);
  }

  it("`@app/domain` è rosso", () => {
    expectRed(checkSource('import { x } from "@app/domain";\n'), "@app/domain");
  });

  it("`@app/contracts/../domain` è rosso (traversata)", () => {
    expectRed(checkSource('import { x } from "@app/contracts/../domain";\n'), "@app/contracts/../domain");
  });

  it("`@penpot-ds/ui` è rosso", () => {
    expectRed(checkSource('import { Button } from "@penpot-ds/ui";\n'), "@penpot-ds/ui");
  });

  it("`apps/web` è rosso", () => {
    expectRed(checkSource('import { page } from "apps/web";\n'), "apps/web");
  });

  it("lo specifier vietato in una stringa non-import è comunque rosso via backstop raw (fail-closed)", () => {
    const report = checkSource('export const target = "@app/domain";\n');
    expect(report.violations.some((violation) => violation.line === "?" && violation.text?.includes("backstop raw")), JSON.stringify(report)).toBe(true);
    // Non è un import: il parser non lo legge come specifier.
    expect(report.violations.some((violation) => violation.specifier === "@app/domain")).toBe(false);
  });

  it("il CLI invocato come in CI (`node scripts/check-boundaries.mjs`) scansiona davvero ed esce 0", () => {
    // Regression review 2.4: se isDirectInvocation regredisce a sempre-falso,
    // il gate diventa un no-op silenzioso con exit 0 in CI. Il test esegue lo
    // script ESATTAMENTE come fa `lint` (packages/scripts/package.json).
    const stdout = execFileSync("node", ["./scripts/check-boundaries.mjs"], {
      cwd: REAL_PACKAGE_ROOT,
      encoding: "utf8",
    });
    expect(stdout).toContain("✔ Confine scripts rispettato");
  });

  it("un file in src/ con @app/ fuori dai literal (desync) è rosso via backstop raw", () => {
    const report = checkBoundaries({
      packageRoot: fakePackage({
        "src/index.ts": "const from = `@app/domain`;\n",
      }),
    });
    expect(report.violations.some((violation) => violation.text?.includes("backstop raw"))).toBe(true);
  });

  it("import apps/web mascherato da apici misti sulla stessa riga è rosso (review 2.4)", () => {
    // Regression: il pair-matching dei literal perde l'ultimo literal della
    // riga se un apice interno spezza la coppia — il backstop raw su apps/
    // deve prenderlo comunque.
    const report = checkSource("const a = \"it's\"; import x from 'apps/web';\n");
    expect(report.violations.length).toBeGreaterThan(0);
  });

  it("import relativo `../../apps/web/src/x` fuori dalla radice del package è rosso, con file, riga e specifier", () => {
    const report = checkSource('export const a = 1;\nimport { page } from "../../apps/web/src/x";\n');
    const violation = report.violations.find((entry) => entry.specifier === "../../apps/web/src/x");
    expect(violation, JSON.stringify(report)).toMatchObject({ file: join("src", "local.ts"), line: 2 });
    expect(violation?.reason).toMatch(/fuori dalla radice del package/);
  });

  it("import relativo `../../ui/src/y` fuori dalla radice del package è rosso", () => {
    expectRed(checkSource('import { Button } from "../../ui/src/y";\n'), "../../ui/src/y");
  });

  it("import dinamico e side-effect relativi fuori dal package sono rossi", () => {
    expectRed(checkSource('await import("../../ui/src/y");\n'), "../../ui/src/y");
    expectRed(checkSource('import "../../outside";\n'), "../../outside");
  });

  it("apps/web in una stringa fuori da qualunque literal scannerizzato è rosso via backstop raw", () => {
    // Apici annidati rompono il pair-matching dei literal: la vista raw
    // (dopo lo strip dei commenti) deve comunque bloccare apps/.
    const report = checkBoundaries({
      packageRoot: fakePackage({
        "src/index.ts": "const hint = 'usa apps/web per l\\'app';\nexport {};\n",
      }),
    });
    expect(report.violations.length).toBeGreaterThan(0);
  });
});

/**
 * Il gate legge gli import veri con il parser TypeScript, non con regex sul
 * testo, e ammette `node:crypto` nel nucleo (spec confini-core-crypto-e-gate-import).
 */
describe("checkBoundaries: import veri e node:crypto nel nucleo", () => {
  const coreFile = join("src", "core", "a.ts");

  function check(files: Record<string, string>): BoundaryReport {
    return checkBoundaries({ packageRoot: fakePackage({ "src/index.ts": "export const ok = 1;\n", ...files }) });
  }

  function coreViolations(report: BoundaryReport) {
    return report.violations.filter((violation) => violation.rule === "core");
  }

  it("verde: `node:crypto` nel nucleo", () => {
    const report = check({
      "src/core/a.ts": 'import { createHash } from "node:crypto";\nexport const h = createHash("sha256").update("x").digest("hex");\n',
    });
    expect(report).toEqual({ violations: [], scanErrors: [], scannedFileCount: 2 });
  });

  it("rosso: altri builtin, `crypto` senza prefisso e sottopercorsi di `node:crypto`, con la riga", () => {
    for (const specifier of ["node:fs", "crypto", "node:crypto/x"]) {
      const report = check({ "src/core/a.ts": `export const a = 1;\nimport x from ${JSON.stringify(specifier)};\nexport { x };\n` });
      const found = coreViolations(report);
      expect(found.length, JSON.stringify(report)).toBeGreaterThan(0);
      expect(found[0], JSON.stringify(report)).toMatchObject({ file: coreFile, line: 2, specifier });
    }
  });

  it("verde: un testo che sembra un import, in un template o in una stringa del nucleo", () => {
    const report = check({
      "src/core/a.ts":
        'export const line = `import x from "node:fs";`;\nexport const copy = "copia from \'x\'";\nexport const call = "require(\'fs\') e import(\'fs\')";\n',
    });
    expect(report.violations, JSON.stringify(report)).toEqual([]);
    expect(report.scanErrors).toEqual([]);
  });

  it("rosso: ogni forma di import vero fuori dalla lista bianca del nucleo", () => {
    const sources = [
      'import x from "lodash";\nexport { x };\n',
      'export * from "lodash";\n',
      'export const m = await import("lodash");\n',
      'const m = require("lodash");\nexport { m };\n',
      'export type M = typeof import("lodash");\n',
      'import m = require("lodash");\nexport { m };\n',
      'import type { X } from "lodash";\nexport type Y = X;\n',
      'export type { X } from "lodash";\n',
      'export { x } from "lodash";\n',
      'export const m = module.require("lodash");\n',
      'export const m = (require)("lodash");\n',
    ];
    for (const source of sources) {
      const report = check({ "src/core/a.ts": source });
      const found = coreViolations(report);
      expect(found.length, `${source}\n${JSON.stringify(report)}`).toBeGreaterThan(0);
      expect(found[0]).toMatchObject({ file: coreFile, line: 1, specifier: "lodash" });
      expect(found[0]!.reason).toContain("core");
    }
  });

  it("rosso: `require(name)` con argomento non letterale nel nucleo, con la riga", () => {
    const report = check({ "src/core/a.ts": 'const name = "lodash";\nexport const m = require(name);\n' });
    expect(coreViolations(report)[0], JSON.stringify(report)).toMatchObject({ file: coreFile, line: 2 });
  });

  it("rosso: un import dinamico con template che esce dal package, fuori dal nucleo", () => {
    const report = check({ "src/server/x.ts": "const x = \"y\";\nexport const m = await import(`../../../ui/${x}`);\n" });
    const found = report.violations.find((violation) => violation.specifier === "../../../ui/${x}");
    expect(found, JSON.stringify(report)).toMatchObject({ file: join("src", "server", "x.ts"), line: 2 });
    expect(found?.reason).toMatch(/fuori dalla radice del package/);
  });

  it("verde: JSX in `.tsx` e `.jsx` si legge senza errori", () => {
    const report = check({
      "src/shared/view.tsx": 'import { z } from "zod";\nexport const V = () => <div>{String(z)}</div>;\n',
      "src/shared/plain.jsx": 'import { z } from "zod";\nexport const P = () => <span>{String(z)}</span>;\n',
    });
    expect(report.violations, JSON.stringify(report)).toEqual([]);
    expect(report.scanErrors, JSON.stringify(report)).toEqual([]);
  });

  it("verde: il literal `apps` fuori dal nucleo non è un accesso alle app", () => {
    const report = check({ "src/server/roots.ts": 'export const roots = ["packages", "apps"] as const;\n' });
    expect(report.violations, JSON.stringify(report)).toEqual([]);
  });

  it("rosso: un import vero di `apps` resta rosso", () => {
    const report = check({ "src/server/x.ts": 'import x from "apps";\nexport { x };\n' });
    expect(report.violations.some((violation) => violation.specifier === "apps" && violation.line === 1), JSON.stringify(report)).toBe(true);
  });

  it("rosso: `apps/` e `@app/domain` dentro una stringa, via backstop raw", () => {
    for (const source of ['export const hint = "usa apps/web";\n', 'export const target = "@app/domain";\n']) {
      const report = check({ "src/shared/x.ts": source });
      expect(report.violations.some((violation) => violation.line === "?" && violation.text?.includes("backstop raw")), JSON.stringify(report)).toBe(true);
    }
  });

  it("rosso: un sorgente che il parser non legge è uno scanError con il file", () => {
    const report = check({ "src/shared/broken.ts": "export const = ;\n" });
    expect(report.scanErrors.some((error) => error.path.endsWith(join("src", "shared", "broken.ts"))), JSON.stringify(report)).toBe(true);
  });

  it("il CLI esce 1 su un sorgente che il parser non legge", () => {
    const root = fakePackage({ "src/index.ts": "export const = ;\n" });
    mkdirSync(join(root, "scripts"));
    copyFileSync(join(REAL_PACKAGE_ROOT, "scripts", "check-boundaries.mjs"), join(root, "scripts", "check-boundaries.mjs"));
    mkdirSync(join(root, "node_modules"));
    symlinkSync(join(REAL_PACKAGE_ROOT, "node_modules", "typescript"), join(root, "node_modules", "typescript"), "dir");
    let status: number | null = 0;
    let stderr = "";
    try {
      execFileSync("node", ["./scripts/check-boundaries.mjs"], { cwd: root, encoding: "utf8", stdio: "pipe" });
    } catch (error) {
      status = (error as { status: number | null }).status;
      stderr = String((error as { stderr: unknown }).stderr);
    }
    expect(status).toBe(1);
    expect(stderr).toContain(join("src", "index.ts"));
  });

  it("il CLI nomina `node:crypto` nella regola core", () => {
    const stdout = execFileSync("node", ["./scripts/check-boundaries.mjs"], { cwd: REAL_PACKAGE_ROOT, encoding: "utf8" });
    expect(stdout).toContain(BOUNDARY_RULES.core);
    expect(BOUNDARY_RULES.core).toContain("node:crypto");
  });
});

/**
 * Regole delle cartelle v3 (Story 2.19): `src/core` puro, solo `src/penpot`
 * parla con Penpot, `src/server` non importa `src/penpot` tranne che da
 * `src/server/main.ts` (punto di iniezione), nessuna cartella `v3`. Le
 * cartelle vere non esistono ancora (2.20+): i casi girano su package finti.
 */
describe("checkBoundaries: regole v3 (Story 2.19)", () => {
  /** Package finto con un `src/index.ts` neutro più i file indicati. */
  function check(files: Record<string, string>): BoundaryReport {
    return checkBoundaries({ packageRoot: fakePackage({ "src/index.ts": "export const ok = 1;\n", ...files }) });
  }

  function ruleViolations(report: BoundaryReport, rule: string) {
    return report.violations.filter((violation) => violation.rule === rule);
  }

  function expectRule(report: BoundaryReport, rule: string, expected: { file: string; line?: number | "?" }): void {
    const found = ruleViolations(report, rule);
    expect(found.length, JSON.stringify(report)).toBeGreaterThan(0);
    expect(found[0], JSON.stringify(report)).toMatchObject({ file: expected.file, ...(expected.line !== undefined ? { line: expected.line } : {}) });
    expect(found[0]!.reason).toContain(rule);
  }

  describe("isMcpClientSpecifier", () => {
    it("riconosce il client MCP in ogni forma, non il resto dell'SDK", () => {
      expect(isMcpClientSpecifier("@modelcontextprotocol/sdk/client")).toBe(true);
      expect(isMcpClientSpecifier("@modelcontextprotocol/sdk/client/index.js")).toBe(true);
      expect(isMcpClientSpecifier("@modelcontextprotocol/sdk/client/streamableHttp.js")).toBe(true);
      expect(isMcpClientSpecifier("@modelcontextprotocol/sdk/dist/esm/client/index.js")).toBe(true);
      expect(isMcpClientSpecifier("@modelcontextprotocol/sdk/server/mcp.js")).toBe(false);
      expect(isMcpClientSpecifier("@modelcontextprotocol/sdkx/client")).toBe(false);
      expect(isMcpClientSpecifier("./client")).toBe(false);
    });
  });

  describe("nucleo (src/core)", () => {
    it("verde: relativi interni, @app/contracts e zod", () => {
      const report = check({
        "src/core/a.ts":
          'import { b } from "./b";\nimport type { ComponentContract } from "@app/contracts";\nimport { z } from "zod";\nexport const a = z.string().parse(b);\nexport type C = ComponentContract;\n',
        "src/core/b.ts": 'export { c as b } from "./sub/c";\n',
        "src/core/sub/c.ts": 'import { d } from "../d";\nexport const c = d;\n',
        "src/core/d.ts": "// process.exit e console.log nei commenti non contano\nexport const d = \"x\";\n",
      });
      expect(report).toEqual({ violations: [], scanErrors: [], scannedFileCount: 5 });
    });

    it("rosso: `node:fs`", () => {
      expectRule(check({ "src/core/a.ts": 'export const a = 1;\nimport { readFileSync } from "node:fs";\n' }), "core", {
        file: join("src", "core", "a.ts"),
        line: 2,
      });
    });

    it("rosso: builtin senza prefisso `node:` e pacchetti qualunque", () => {
      expectRule(check({ "src/core/a.ts": 'import { join } from "path";\n' }), "core", { file: join("src", "core", "a.ts"), line: 1 });
      expectRule(check({ "src/core/a.ts": 'import { readFile } from "fs/promises";\n' }), "core", { file: join("src", "core", "a.ts") });
      expectRule(check({ "src/core/a.ts": 'import { x } from "@penpot-ds/tokens";\n' }), "core", { file: join("src", "core", "a.ts") });
    });

    it("rosso: l'SDK MCP, client o server", () => {
      expectRule(check({ "src/core/a.ts": 'import { Client } from "@modelcontextprotocol/sdk/client/index.js";\n' }), "core", {
        file: join("src", "core", "a.ts"),
        line: 1,
      });
      expectRule(check({ "src/core/a.ts": 'import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";\n' }), "core", {
        file: join("src", "core", "a.ts"),
      });
    });

    it("rosso: un relativo che esce da src/core (`../shared/x`)", () => {
      const report = check({ "src/shared/x.ts": "export const x = 1;\n", "src/core/a.ts": 'import { x } from "../shared/x";\nexport { x };\n' });
      expectRule(report, "core", { file: join("src", "core", "a.ts"), line: 1 });
    });

    it("rosso: re-export, import dinamico, require e import side-effect fuori dalle ammesse", () => {
      expectRule(check({ "src/core/a.ts": 'export { x } from "../shared/x";\n' }), "core", { file: join("src", "core", "a.ts") });
      expectRule(check({ "src/core/a.ts": 'export const m = await import("node:fs");\n' }), "core", { file: join("src", "core", "a.ts") });
      expectRule(check({ "src/core/a.ts": 'const fs = require("fs");\nexport { fs };\n' }), "core", { file: join("src", "core", "a.ts") });
      expectRule(check({ "src/core/a.ts": 'import "node:fs";\n' }), "core", { file: join("src", "core", "a.ts") });
    });

    it("rosso: import dinamico o require con argomento non letterale (non verificabile)", () => {
      expectRule(check({ "src/core/a.ts": 'const name = "node:fs";\nexport const m = await import(name);\n' }), "core", {
        file: join("src", "core", "a.ts"),
        line: 2,
      });
      expectRule(check({ "src/core/a.ts": "export const m = require(process.env.X);\n" }), "core", { file: join("src", "core", "a.ts") });
    });

    it("rosso: `process.`, `console.` e `fetch(` nel testo senza commenti", () => {
      expectRule(check({ "src/core/a.ts": "export const a = 1;\nexport const env = process.env.HOME;\n" }), "core", {
        file: join("src", "core", "a.ts"),
        line: 2,
      });
      expectRule(check({ "src/core/a.ts": 'console.log("x");\n' }), "core", { file: join("src", "core", "a.ts"), line: 1 });
      expectRule(check({ "src/core/a.ts": 'export const r = fetch("https://example.com");\n' }), "core", {
        file: join("src", "core", "a.ts"),
        line: 1,
      });
      expectRule(check({ "src/core/a.ts": 'export const c = globalThis["console"];\n' }), "core", { file: join("src", "core", "a.ts") });
    });

    it("rosso: import dinamico relativo con interpolazione (`./${n}`)", () => {
      expectRule(check({ "src/core/a.ts": "const n = \"b\";\nexport const m = await import(`./${n}`);\n" }), "core", {
        file: join("src", "core", "a.ts"),
        line: 2,
      });
    });

    it("rosso: traversata dentro zod (`zod/../../shared/x`)", () => {
      expectRule(check({ "src/core/a.ts": 'import { z } from "zod/../../shared/x";\nexport { z };\n' }), "core", {
        file: join("src", "core", "a.ts"),
        line: 1,
      });
    });

    it("rosso: `import.meta.url` ed `eval(` nel nucleo", () => {
      expectRule(check({ "src/core/a.ts": "export const u = import.meta.url;\n" }), "core", { file: join("src", "core", "a.ts"), line: 1 });
      expectRule(check({ "src/core/a.ts": 'export const v = eval("1");\n' }), "core", { file: join("src", "core", "a.ts"), line: 1 });
    });

    it("verde: un accesso a membro (`job.process()`) non è il globale", () => {
      const report = check({ "src/core/a.ts": "export const run = (job: Job) => job.process();\n" });
      expect(report.violations).toEqual([]);
    });

    it("le stesse cose fuori da src/core non riguardano la regola del nucleo", () => {
      const report = check({ "src/shared/a.ts": 'import { readFileSync } from "node:fs";\nconsole.log(process.cwd(), readFileSync);\n' });
      expect(ruleViolations(report, "core")).toEqual([]);
      expect(report.violations).toEqual([]);
    });
  });

  describe("solo src/penpot parla con Penpot", () => {
    it("verde: il client MCP dentro src/penpot", () => {
      const report = check({
        "src/penpot/client.ts": 'import { Client } from "@modelcontextprotocol/sdk/client/index.js";\nexport { Client };\n',
      });
      expect(report.violations).toEqual([]);
    });

    it("rosso: il client MCP in src/server", () => {
      expectRule(check({ "src/server/x.ts": 'import { Client } from "@modelcontextprotocol/sdk/client/index.js";\nexport { Client };\n' }), "penpot", {
        file: join("src", "server", "x.ts"),
        line: 1,
      });
    });

    it("rosso: il client MCP in src/shared, anche come import dinamico", () => {
      expectRule(check({ "src/shared/x.ts": 'import { Client } from "@modelcontextprotocol/sdk/client/index.js";\nexport { Client };\n' }), "penpot", {
        file: join("src", "shared", "x.ts"),
        line: 1,
      });
      expectRule(check({ "src/shared/x.ts": 'export const m = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");\n' }), "penpot", {
        file: join("src", "shared", "x.ts"),
      });
    });

    it("rosso: il client MCP fuori da qualunque literal scannerizzato (backstop raw)", () => {
      const report = check({ "src/shared/x.ts": "const a = \"it's\"; import { Client } from '@modelcontextprotocol/sdk/client/index.js';\n" });
      expect(ruleViolations(report, "penpot").length, JSON.stringify(report)).toBeGreaterThan(0);
    });

    it("rosso: src/shared re-esporta src/penpot (`src/shared/proxy.ts` → `../penpot/read`)", () => {
      expectRule(
        check({ "src/penpot/read.ts": "export const read = 1;\n", "src/shared/proxy.ts": 'export { read } from "../penpot/read";\n' }),
        "penpot",
        { file: join("src", "shared", "proxy.ts"), line: 1 },
      );
    });

    it("verde: src/theme importa src/penpot (fino alla 2.26)", () => {
      const report = check({ "src/penpot/read.ts": "export const read = 1;\n", "src/theme/cmd.ts": 'import { read } from "../penpot/read";\nexport { read };\n' });
      expect(report.violations).toEqual([]);
    });

    it("verde: l'SDK lato server in src/server", () => {
      const report = check({ "src/server/x.ts": 'import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";\nexport { McpServer };\n' });
      expect(report.violations).toEqual([]);
    });
  });

  describe("src/server non importa src/penpot, salvo il punto di iniezione", () => {
    const penpot = { "src/penpot/read.ts": "export const read = 1;\n" };

    it("rosso: `src/server/tools.ts` importa `../penpot/read`", () => {
      expectRule(check({ ...penpot, "src/server/tools.ts": 'import { read } from "../penpot/read";\nexport { read };\n' }), "server", {
        file: join("src", "server", "tools.ts"),
        line: 1,
      });
    });

    it("rosso: anche da una sottocartella, con re-export o import dinamico", () => {
      expectRule(check({ ...penpot, "src/server/tools/a.ts": 'export { read } from "../../penpot/read";\n' }), "server", {
        file: join("src", "server", "tools", "a.ts"),
      });
      expectRule(check({ ...penpot, "src/server/tools.ts": 'export const m = await import("../penpot");\n' }), "server", {
        file: join("src", "server", "tools.ts"),
      });
    });

    it("verde: `src/server/main.ts` importa `../penpot/read`", () => {
      const report = check({ ...penpot, "src/server/main.ts": 'import { read } from "../penpot/read";\nexport { read };\n' });
      expect(report.violations).toEqual([]);
    });

    it("rosso: `src/server/x/main.ts` in una sottocartella non è il punto di iniezione", () => {
      expectRule(check({ ...penpot, "src/server/x/main.ts": 'import { read } from "../../penpot/read";\nexport { read };\n' }), "server", {
        file: join("src", "server", "x", "main.ts"),
      });
    });

    it("verde: src/server importa src/core e src/shared", () => {
      const report = check({
        "src/core/a.ts": "export const a = 1;\n",
        "src/shared/b.ts": "export const b = 1;\n",
        "src/server/tools.ts": 'import { a } from "../core/a";\nimport { b } from "../shared/b";\nexport { a, b };\n',
      });
      expect(report.violations).toEqual([]);
    });
  });

  describe("nessuna cartella v3", () => {
    it("rosso: `src/v3/cli.ts`", () => {
      expectRule(check({ "src/v3/cli.ts": "export const x = 1;\n" }), "v3", { file: join("src", "v3", "cli.ts") });
    });

    it("rosso: `src/V3/cli.ts` (maiuscola)", () => {
      expectRule(check({ "src/V3/cli.ts": "export const x = 1;\n" }), "v3", { file: join("src", "V3", "cli.ts") });
    });

    it("rosso: una cartella v3 annidata, anche vuota", () => {
      expectRule(check({ "src/shared/v3/x.ts": "export const x = 1;\n" }), "v3", { file: join("src", "shared", "v3", "x.ts") });
      const root = fakePackage({ "src/index.ts": "export const ok = 1;\n" });
      mkdirSync(join(root, "src", "core", "v3"), { recursive: true });
      expectRule(checkBoundaries({ packageRoot: root }), "v3", { file: join("src", "core", "v3") });
    });

    it("rosso: un import relativo verso una cartella v3 del package", () => {
      expectRule(check({ "src/shared/x.ts": 'import { y } from "../../v3/y";\nexport { y };\n' }), "v3", { file: join("src", "shared", "x.ts"), line: 1 });
    });

    it("verde: `v3` come parte di un nome (`v3x`, `tailwind-v3.ts`) non è una cartella v3", () => {
      const report = check({ "src/v3x/a.ts": "export const a = 1;\n", "src/shared/tailwind-v3.ts": "export const b = 1;\n" });
      expect(report.violations).toEqual([]);
    });
  });

  it("il CLI nomina le regole nuove nel messaggio di successo", () => {
    const stdout = execFileSync("node", ["./scripts/check-boundaries.mjs"], { cwd: REAL_PACKAGE_ROOT, encoding: "utf8" });
    for (const rule of Object.values(BOUNDARY_RULES)) expect(stdout).toContain(rule);
  });

  it("il package reale: il client MCP compare solo sotto src/penpot", () => {
    const offenders = (readdirSync(join(REAL_PACKAGE_ROOT, "src"), { recursive: true }) as string[])
      .filter((entry) => /\.tsx?$/.test(entry))
      .filter((entry) => readFileSync(join(REAL_PACKAGE_ROOT, "src", entry), "utf8").includes("@modelcontextprotocol/sdk/client"))
      .filter((entry) => !entry.startsWith(`penpot${sep}`));
    expect(offenders).toEqual([]);
  });
});
