import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { type BoundaryReport, checkBoundaries } from "../scripts/check-boundaries.mjs";

/**
 * Prova rosso/verde del gate (AC #2, action item retro Epic 1): se un caso
 * rosso passa, il gate è rotto, non il test.
 */

const CLEAN_PACKAGE = {
  name: "@app/fake",
  dependencies: { zod: "catalog:" },
  devDependencies: { "@app/config": "workspace:*", typescript: "catalog:", vitest: "catalog:", "@types/node": "catalog:" },
};

let roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

/** Crea un package finto: `files` sono path relativi alla root del package; `pkg: null` = niente package.json. */
function fakePackage(files: Record<string, string>, pkg: unknown = CLEAN_PACKAGE): string {
  const root = mkdtempSync(join(tmpdir(), "contracts-boundaries-"));
  roots.push(root);
  if (pkg !== null) writeFileSync(join(root, "package.json"), typeof pkg === "string" ? pkg : JSON.stringify(pkg));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function isGreen(report: BoundaryReport): boolean {
  return report.violations.length === 0 && report.scanErrors.length === 0 && report.scannedFileCount > 0;
}

function checkSource(source: string): BoundaryReport {
  return checkBoundaries({ packageRoot: fakePackage({ "src/index.ts": source, "src/local.ts": "export const x = 1;\n" }) });
}

describe("checkBoundaries: verde", () => {
  it("package pulito: zod e import relativi dentro src/", () => {
    const report = checkBoundaries({
      packageRoot: fakePackage({
        "src/index.ts": 'import { z } from "zod";\nimport { x } from "./local";\nexport * from "./nested/deep";\n',
        "src/local.ts": 'import type { ZodType } from "zod/v4";\nexport const x: ZodType | 1 = 1;\n',
        "src/nested/deep.ts": 'export { x } from "../local";\n',
      }),
    });
    expect(report).toEqual({ violations: [], scanErrors: [], scannedFileCount: 3 });
  });

  it("il package reale packages/contracts è verde", () => {
    const report = checkBoundaries({ packageRoot: fileURLToPath(new URL("..", import.meta.url)) });
    expect(report.violations).toEqual([]);
    expect(report.scanErrors).toEqual([]);
    expect(report.scannedFileCount).toBeGreaterThan(5);
  });

  it("la stringa react dentro un commento non è una violazione", () => {
    expect(isGreen(checkSource('// import React from "react";\n/* require("react") */\nexport const a = 1;\n'))).toBe(true);
  });

  it("un literal non di import non è una violazione", () => {
    expect(isGreen(checkSource('export const label = "react";\nexport const other = `from ${label}`;\n'))).toBe(true);
  });

  it("import.meta non è una violazione", () => {
    expect(isGreen(checkSource("export const u = import.meta.url;\n"))).toBe(true);
  });

  it("un template literal senza interpolazione in clausola from è verificabile e verde", () => {
    expect(isGreen(checkSource("export * from `./local`;\n"))).toBe(true);
  });

  it("rosso atteso (limite fail-closed documentato): una stringa che contiene `from 'react'`", () => {
    // Lo scanner cerca gli specifier con i literal intatti per non perdere un
    // import se il parser dei literal si desincronizza: il prezzo è questo falso positivo.
    const report = checkSource('export const s = "import x from \'react\'";\n');
    expect(report.violations.map((v) => v.specifier)).toContain("react");
  });

  it.each([
    ["chiave computed con nome from", 'export const o = { ["from"]: "react" };\n'],
    ["metodo chiamato require", 'const obj = { require: () => {} };\nobj.require("react");\n'],
    ["import() con attributi di import", 'export const m = import("react", { with: { type: "json" } });\n'],
  ])("rosso atteso (limite fail-closed documentato): %s", (_label, source) => {
    expect(checkSource(source).violations.length).toBeGreaterThan(0);
  });
});

describe("checkBoundaries: rosso sugli import", () => {
  it.each([
    ["import default di react", 'import React from "react";\n', "react"],
    ["import type da @puckeditor/core", 'import type { Config } from "@puckeditor/core";\n', "@puckeditor/core"],
    [
      "import multi-riga di @radix-ui/react-accordion",
      'import {\n  Root,\n  Item,\n} from\n  "@radix-ui/react-accordion";\n',
      "@radix-ui/react-accordion",
    ],
    ["export * da @penpot-ds/ui", 'export * from "@penpot-ds/ui";\n', "@penpot-ds/ui"],
    ["import side-effect", 'import "react";\n', "react"],
    ["import() letterale", 'export const m = import("react");\n', "react"],
    ["require() letterale", 'const r = require("react");\n', "react"],
    ["builtin node:*", 'import { readFileSync } from "node:fs";\n', "node:fs"],
    ["builtin senza prefisso", 'import { readFileSync } from "fs";\n', "fs"],
    ["import relativo che esce da src/", 'import { x } from "../../ui/src/x";\n', "../../ui/src/x"],
    ["pacchetto @app/*", 'import { x } from "@app/domain";\n', "@app/domain"],
    ["traversata sotto il prefisso zod", 'import { x } from "zod/../react";\n', "zod/../react"],
    ["template interpolato in clausola from", "const n = 'act';\nexport * from `re${n}`;\n", "re${n}"],
    ["nome che inizia per zod ma non è zod", 'import { x } from "zodiac";\n', "zodiac"],
    ["import con apici singoli", "import cva from 'class-variance-authority';\n", "class-variance-authority"],
  ])("%s", (_label, source, specifier) => {
    const report = checkSource(source);
    expect(report.violations.map((v) => v.specifier)).toContain(specifier);
    expect(report.violations.find((v) => v.specifier === specifier)?.line).toBeGreaterThanOrEqual(1);
  });

  it("riporta la riga corretta dello specifier", () => {
    const report = checkSource('import { z } from "zod";\n\nimport React from "react";\n');
    expect(report.violations).toEqual([
      expect.objectContaining({ file: join("src", "index.ts"), line: 3, specifier: "react" }),
    ]);
  });

  it.each([
    ["import() non letterale", 'export const m = import("re" + "act");\n'],
    ["import() da variabile", 'const name = "react";\nexport const m = import(name);\n'],
    ["import() con template interpolato", "const n = 'act';\nexport const m = import(`re${n}`);\n"],
    ["require() non letterale", 'const r = require(["re", "act"].join(""));\n'],
    ["require passato come valore", "const r = require;\nexport default r;\n"],
    ["identificatore con escape unicode", 'const r = req\\u0075ire("react");\n'],
    ["eval", 'eval("require(\'react\')");\n'],
    ["eval dentro interpolazione di template", "const x = `${eval('1+1')}`;\n"],
    ["Function dentro interpolazione di template", "const F = `${Function('return 1')()}`;\n"],
    ["process.getBuiltinModule", 'const fs = process.getBuiltinModule("node:fs");\n'],
  ])("fail-closed: %s", (_label, source) => {
    expect(checkSource(source).violations.length).toBeGreaterThan(0);
  });

  it("rosso atteso (limite fail-closed documentato): un regex con escape unicode", () => {
    // La vista `code` preserva i regex literal (non sono riconosciuti come
    // literal): un `\u` dentro un regex scatta il falso rosso della regola
    // escape-unicode. In src/ dei contratti non esistono regex literal.
    expect(checkSource("const RE = /[\\u0041-\\u005a]/;\n").violations.length).toBeGreaterThan(0);
  });
});

describe("checkBoundaries: rosso sul package.json", () => {
  it.each([
    ["react in dependencies", { ...CLEAN_PACKAGE, dependencies: { zod: "catalog:", react: "catalog:" } }, "react"],
    ["alias npm su una dipendenza ammessa", { ...CLEAN_PACKAGE, dependencies: { zod: "npm:react@19" } }, "alias"],
    ["URL su una dipendenza ammessa", { ...CLEAN_PACKAGE, dependencies: { zod: "https://evil.example/zod.tgz" } }, "alias"],
    ["sezione overrides", { ...CLEAN_PACKAGE, overrides: { zod: "npm:react@19" } }, "overrides"],
    ["sezione resolutions", { ...CLEAN_PACKAGE, resolutions: { zod: "npm:react@19" } }, "resolutions"],
    ["pnpm.overrides", { ...CLEAN_PACKAGE, pnpm: { overrides: { zod: "npm:react@19" } } }, "pnpm"],
    ["peerDependencies non vuote", { ...CLEAN_PACKAGE, peerDependencies: { react: "*" } }, "peerDependencies"],
    ["optionalDependencies non vuote", { ...CLEAN_PACKAGE, optionalDependencies: { tailwindcss: "*" } }, "optionalDependencies"],
    ["devDependency fuori allowlist", { ...CLEAN_PACKAGE, devDependencies: { "@puckeditor/core": "*" } }, "@puckeditor/core"],
    ["dependencies non oggetto", { ...CLEAN_PACKAGE, dependencies: ["react"] }, "dependencies"],
  ])("%s", (_label, pkg, needle) => {
    const report = checkBoundaries({ packageRoot: fakePackage({ "src/index.ts": "export const a = 1;\n" }, pkg) });
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.violations.map((v) => `${v.file} ${v.reason} ${v.specifier ?? ""}`).join("\n")).toContain(needle);
  });

  it("peerDependencies vuote sono ammesse", () => {
    const pkg = { ...CLEAN_PACKAGE, peerDependencies: {} };
    expect(isGreen(checkBoundaries({ packageRoot: fakePackage({ "src/index.ts": "export const a = 1;\n" }, pkg) }))).toBe(true);
  });

  it("package.json assente o illeggibile è un errore di scan", () => {
    expect(checkBoundaries({ packageRoot: fakePackage({ "src/index.ts": "export const a = 1;\n" }, null) }).scanErrors).not.toEqual([]);
    expect(checkBoundaries({ packageRoot: fakePackage({ "src/index.ts": "export const a = 1;\n" }, "{ non json") }).scanErrors).not.toEqual([]);
  });
});

describe("checkBoundaries: fail-closed sullo scan", () => {
  it("src/ assente", () => {
    const report = checkBoundaries({ packageRoot: fakePackage({}) });
    expect(isGreen(report)).toBe(false);
    expect(report.scanErrors.length).toBeGreaterThan(0);
  });

  it("src/ vuota", () => {
    const root = fakePackage({});
    mkdirSync(join(root, "src"));
    const report = checkBoundaries({ packageRoot: root });
    expect(report.scannedFileCount).toBe(0);
    expect(report.scanErrors.length).toBeGreaterThan(0);
  });

  it("commento di blocco non chiuso", () => {
    const report = checkSource('/* aperto\nimport React from "react";\n');
    expect(report.scanErrors.map((e) => e.reason).join("\n")).toMatch(/commento di blocco non chiuso/);
  });

  it("file in src/ con estensione non riconosciuta è un errore di scan (fail-closed)", () => {
    const report = checkBoundaries({
      packageRoot: fakePackage({ "src/index.ts": "export const a = 1;\n", "src/evil.TS": 'import React from "react";\n' }),
    });
    expect(report.scannedFileCount).toBe(1);
    expect(report.scanErrors.map((e) => e.path).join("\n")).toMatch(/evil\.TS/);
    expect(isGreen(report)).toBe(false);
  });
});
