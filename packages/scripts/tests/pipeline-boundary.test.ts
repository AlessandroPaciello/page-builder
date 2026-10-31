import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { PATHS } from "../src/shared/paths";

/**
 * Invarianti dopo la rimozione della v1 (Story 2.16), della v2 (Story 2.18) e
 * del comando `theme` (Story 2.26):
 * 1. le directory v1 (`src/cli/`, `src/emitter/`, `src/extract/`), `src/v2/`
 *    e quelle della v2 (`src/commands/`, `src/library/`, `src/contracts/`)
 *    non esistono, né il guscio `src/cli.ts`, i moduli v2 sciolti in `src/`,
 *    le istantanee `data/components/` né `src/theme/`;
 * 2. in `src/` nessun modulo scrive `process.exit`/`process.exitCode` (il
 *    server MCP e il collaudo non sono CLI; gli unici entrypoint chiudono il
 *    processo rilanciando un errore, senza `process.exit`).
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith(".ts") ? [full] : [];
  });
}

const SRC = join(PATHS.packageRoot, "src");

describe("nessuna directory né guscio della v1 o della v2", () => {
  it("directory, moduli e dati della v1 e della v2 non esistono", () => {
    const removed = [
      ...["v2", "cli", "emitter", "extract", "commands", "library", "contracts"].map((dir) => `src/${dir}`),
      ...["cli.ts", "shell.ts", "errors.ts", "library-writer.ts", "library-plan.ts", "propose-diff.ts", "registry.ts", "extraction.ts", "components.ts"].map((file) => `src/${file}`),
      "src/shared/component-report.ts",
      "src/shared/direct-invocation.ts",
      "data/components",
    ];
    for (const path of removed) {
      expect(existsSync(join(PATHS.packageRoot, path)), `${path} dovrebbe essere cancellato (Story 2.16/2.18)`).toBe(false);
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

describe("nessun process.exit in src", () => {
  it("in src nessun modulo scrive process.exit o process.exitCode", () => {
    const PROCESS_EXIT = /process(?:\.exit\s*\(|\[\s*["'`]exit["'`]\s*\]\s*\()|process\.exitCode\s*(?:=[^=]|\+=|-=|\+\+|--)/;
    const stripComments = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
    const offenders = sourceFiles(SRC)
      .filter((file) => PROCESS_EXIT.test(stripComments(readFileSync(file, "utf8"))))
      .map((file) => relative(PATHS.packageRoot, file));
    expect(offenders).toEqual([]);
  });
});
