import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { PATHS } from "../src/shared/paths";

/**
 * Invarianti della convivenza v1/v2 (Story 2.12, fino alla Story 2.16):
 * 1. nessun file della v1 (tutto `src/` fuori da `src/v2/`, TEST COMPRESI) importa da `src/v2`
 *    — la v1 resta intatta e la v2 le si affianca, mai il contrario;
 * 2. in `src/v2/` `process.exit`/`process.exitCode` compaiono solo nel guscio
 *    (`src/v2/cli.ts`): ogni comando lancia `ScriptError`, l'exit lo decide il guscio.
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith(".ts") ? [full] : [];
  });
}

const SRC = join(PATHS.packageRoot, "src");
const V2 = join(SRC, "v2");
/** Import statico, dinamico, `vi.mock` o `require` che punta a `src/v2`. */
const IMPORT_FROM_V2 = /(?:\bfrom|\bimport|\brequire|\bvi\.mock|\bvi\.doMock)\s*\(?\s*["'][^"']*\/v2(\/|["'])/;
/** Uso reale, non una citazione in un commento: chiamata a `process.exit(` o assegnazione a `process.exitCode`. */
const PROCESS_EXIT = /process\.exit(\(|Code\s*=[^=])/;

/** Via i commenti (di riga e di blocco): la regola vale sul codice, non sulla documentazione che la cita. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
}

describe("confine v1 ↛ v2", () => {
  it("nessun sorgente v1 importa da src/v2", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !file.startsWith(`${V2}/`))
      .filter((file) => IMPORT_FROM_V2.test(readFileSync(file, "utf8")))
      .map((file) => relative(PATHS.packageRoot, file));
    expect(offenders).toEqual([]);
  });

  it("caso rosso: statico, dinamico, vi.mock e require sono tutti segnalati", () => {
    expect(IMPORT_FROM_V2.test('import { ScriptError } from "../v2/errors";')).toBe(true);
    expect(IMPORT_FROM_V2.test('const m = await import("../v2/shell");')).toBe(true);
    expect(IMPORT_FROM_V2.test('vi.mock("../v2/errors", () => ({}));')).toBe(true);
    expect(IMPORT_FROM_V2.test('require("../../src/v2/cli");')).toBe(true);
    expect(IMPORT_FROM_V2.test('import { PATHS } from "../shared/paths";')).toBe(false);
  });
});

describe("process.exit solo nel guscio v2", () => {
  it("caso rosso: una chiamata o un'assegnazione nel codice è segnalata, una citazione in un commento no", () => {
    expect(PROCESS_EXIT.test(stripComments("// mai process.exit(1) qui\nconst a = 1;"))).toBe(false);
    expect(PROCESS_EXIT.test(stripComments("/* process.exitCode = 1 */ const a = 1;"))).toBe(false);
    expect(PROCESS_EXIT.test(stripComments("process.exit(code);"))).toBe(true);
    expect(PROCESS_EXIT.test(stripComments("process.exitCode = 1;"))).toBe(true);
  });

  it("in src/v2 solo cli.ts scrive process.exit o process.exitCode", () => {
    const offenders = sourceFiles(V2)
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => PROCESS_EXIT.test(stripComments(readFileSync(file, "utf8"))))
      .map((file) => relative(PATHS.packageRoot, file));
    expect(offenders).toEqual(["src/v2/cli.ts"]);
  });
});
