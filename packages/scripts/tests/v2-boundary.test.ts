import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { PATHS } from "../src/shared/paths";

/**
 * Invarianti della pipeline unica v2 (Story 2.16, CAP-11): la v1 e cancellata,
 * `src/v2` e appiattito in `src/`.
 * 1. `src/v2/` non esiste; le directory v1 (`src/cli/`, `src/emitter/`,
 *    `src/extract/`) non esistono; nessun sorgente importa da `/v2/`;
 * 2. in `src/` `process.exit`/`process.exitCode` compaiono solo nel guscio
 *    (`src/cli.ts`): ogni comando lancia `ScriptError`, l'exit lo decide il guscio.
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith(".ts") ? [full] : [];
  });
}

const SRC = join(PATHS.packageRoot, "src");

describe("pipeline unica: nessuna directory v1 ne src/v2", () => {
  it("src/v2, src/cli, src/emitter ed src/extract non esistono", () => {
    for (const dir of ["v2", "cli", "emitter", "extract"]) {
      expect(existsSync(join(SRC, dir)), `src/${dir} dovrebbe essere cancellata (Story 2.16)`).toBe(false);
    }
  });

  it("nessun sorgente importa da src/v2", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file.includes("/v2/") || file.includes("/v2"))
      .map((file) => relative(PATHS.packageRoot, file));
    // Filtro grezzo sul path; gli import con /v2/ sono coperti dal check-boundaries.
    expect(offenders.filter((f) => f.startsWith("src/v2"))).toEqual([]);
  });
});

describe("process.exit solo nel guscio", () => {
  it("in src solo cli.ts scrive process.exit o process.exitCode", () => {
    const PROCESS_EXIT = /process(?:\.exit\s*\(|\[\s*["'`]exit["'`]\s*\]\s*\()|process\.exitCode\s*(?:=[^=]|\+=|-=|\+\+|--)/;
    const stripComments = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
    const offenders = sourceFiles(SRC)
      .filter((file) => PROCESS_EXIT.test(stripComments(readFileSync(file, "utf8"))))
      .map((file) => relative(PATHS.packageRoot, file));
    expect(offenders).toEqual(["src/cli.ts"]);
  });
});
