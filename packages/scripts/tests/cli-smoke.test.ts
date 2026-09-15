import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { PATHS } from "../src/shared/paths";

/**
 * Smoke test degli entrypoint veri: ogni file di `src/cli/` lanciato come fa
 * `package.json` (`node --import tsx <file>`), senza seam. I test unitari
 * passano le cartelle come argomenti e resterebbero verdi anche con un path
 * di default rotto o un import che non si risolve: qui un
 * `ERR_MODULE_NOT_FOUND` o un `ENOENT` fa fallire il comando per nome.
 */

const CLI_DIR = join(PATHS.packageRoot, "src/cli");
/** Moduli di parsing condivisi fra entrypoint: in `src/cli/` ma non comandi. */
const CLI_HELPERS = new Set(["component-args.ts"]);

/** Diagnostica di risoluzione: moduli o file che non ci sono. */
const RESOLUTION_ERROR = /ERR_MODULE_NOT_FOUND|Cannot find module|ENOENT|no such file or directory/;

interface Run {
  code: number | null;
  output: string;
}

function runCli(file: string, args: readonly string[]): Run {
  // Niente report nel riepilogo del job di CI da un test.
  const env = { ...process.env };
  delete env.GITHUB_STEP_SUMMARY;
  const result = spawnSync(process.execPath, ["--import", "tsx", join("src/cli", file), ...args], {
    cwd: PATHS.packageRoot,
    encoding: "utf8",
    env,
    timeout: SMOKE_TIMEOUT,
  });
  return { code: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

/** Argomenti non validi per ogni entrypoint e l'errore d'uso atteso. */
const USAGE_ERRORS: Record<string, { args: string[]; expected: RegExp }> = {
  "adopt-variant.ts": { args: [], expected: /Componente mancante — uso: pnpm adopt:variant/ },
  "bump-contract.ts": { args: [], expected: /Componente mancante — uso: pnpm bump:contract/ },
  "extract-component.ts": { args: [], expected: /Modalità "<mancante>" non riconosciuta/ },
  "gates-render.ts": { args: ["--bogus"], expected: /Argomento non riconosciuto: --bogus/ },
  "generate-theme.ts": { args: ["--bogus"], expected: /Argomenti non riconosciuti: --bogus/ },
  "library.ts": { args: [], expected: /Modalità "<mancante>" non riconosciuta/ },
  "render-component.ts": { args: [], expected: /Nome componente mancante/ },
};

// Ogni caso lancia un processo `node --import tsx`: il primo parte a freddo
// (transform di tsx) e supera i 5 s di default di vitest. Il limite del test
// coincide con quello già dato al processo in `runCli`.
const SMOKE_TIMEOUT = 90_000;

describe("smoke degli entrypoint in src/cli/", { timeout: SMOKE_TIMEOUT }, () => {
  it("ogni entrypoint ha un caso nello smoke test", () => {
    const entrypoints = readdirSync(CLI_DIR)
      .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !CLI_HELPERS.has(entry))
      .sort();
    expect(entrypoints).toEqual(Object.keys(USAGE_ERRORS).sort());
  });

  it.each(Object.entries(USAGE_ERRORS))("%s con argomenti non validi esce con l'errore d'uso", (file, { args, expected }) => {
    const run = runCli(file, args);
    expect(run.output, `${file}: errore di risoluzione\n${run.output}`).not.toMatch(RESOLUTION_ERROR);
    expect(run.output, `${file}: errore d'uso atteso assente\n${run.output}`).toMatch(expected);
    expect(run.code, `${file}: exit code\n${run.output}`).toBe(1);
  });
});

describe("smoke dei comandi veri sui dati committati", { timeout: SMOKE_TIMEOUT }, () => {
  it("verify:library --snapshot sullo snapshot committato esce 0", () => {
    const run = runCli("library.ts", ["verify", "--snapshot", relative(PATHS.packageRoot, PATHS.librarySnapshotPath)]);
    expect(run.output).not.toMatch(RESOLUTION_ERROR);
    expect(run.code, run.output).toBe(0);
  });

  it("validate:recipe -- Badge sui file committati esce 0", () => {
    const run = runCli("extract-component.ts", ["validate", "Badge"]);
    expect(run.output).not.toMatch(RESOLUTION_ERROR);
    expect(run.code, run.output).toBe(0);
  });

  it("render:check (basi, binding, ricette e ui/domains veri) esce 0", () => {
    const run = runCli("render-component.ts", ["--all", "--check"]);
    expect(run.output).not.toMatch(RESOLUTION_ERROR);
    expect(run.code, run.output).toBe(0);
  });
});
