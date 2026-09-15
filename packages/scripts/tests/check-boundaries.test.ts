import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { checkBoundaries, isForbiddenSpecifier, type BoundaryReport } from "../scripts/check-boundaries.mjs";

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
    expect(isForbiddenSpecifier("./library-plan")).toBe(false);
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

  it("il package reale packages/scripts è verde", () => {
    const report = checkBoundaries({ packageRoot: REAL_PACKAGE_ROOT });
    expect(report.violations).toEqual([]);
    expect(report.scanErrors).toEqual([]);
    expect(report.scannedFileCount).toBeGreaterThan(0);
    // Anche le basi in data/bases/ sono scansionate.
    const srcCount = readdirSync(join(REAL_PACKAGE_ROOT, "src"), { recursive: true }).filter((entry) => /\.tsx?$/.test(String(entry))).length;
    expect(report.scannedFileCount).toBeGreaterThan(srcCount);
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

  it("lo specifier vietato in una stringa non-import è comunque rosso (fail-closed)", () => {
    expectRed(checkSource('export const target = "@app/domain";\n'), "@app/domain");
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
    expect(report.violations.some((violation) => violation.text?.includes("desincronizzato"))).toBe(true);
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
