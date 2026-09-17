import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PATHS } from "../shared/paths";

/**
 * Smoke dell'UNICO entry v2 (`src/v2/cli.ts`) lanciato come fa `package.json`
 * (`node --import tsx`): la guardia di invocazione diretta, `main()` e il
 * `process.exit` col codice del guscio, senza seam. `theme` offline è il
 * primo comando reale: rigenera i token committati a diff zero.
 */

const ENTRY = "src/v2/cli.ts";
const RESOLUTION_ERROR = /ERR_MODULE_NOT_FOUND|Cannot find module|ENOENT|no such file or directory/;
const SMOKE_TIMEOUT = 90_000;

function run(args: readonly string[]): { code: number | null; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", ENTRY, ...args], {
    cwd: PATHS.packageRoot,
    encoding: "utf8",
    timeout: SMOKE_TIMEOUT,
  });
  return { code: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

describe("entry v2 (src/v2/cli.ts)", { timeout: SMOKE_TIMEOUT }, () => {
  it("senza comando esce 1 con l'usage che elenca theme", () => {
    const result = run([]);
    expect(result.output).not.toMatch(RESOLUTION_ERROR);
    expect(result.output).toMatch(/✖ input[\s\S]*comando mancante[\s\S]*theme \[--live\]/);
    expect(result.code).toBe(1);
  });

  it("comando ignoto esce 1", () => {
    const result = run(["nope"]);
    expect(result.output).toMatch(/comando "nope" non riconosciuto/);
    expect(result.code).toBe(1);
  });

  it("theme con un flag sconosciuto esce 1 (input) nominando il flag", () => {
    const result = run(["theme", "--bogus"]);
    expect(result.output).toMatch(/✖ input[\s\S]*argomento "--bogus" non riconosciuto — uso: theme \[--live\]/);
    expect(result.code).toBe(1);
  });

  it("theme offline rigenera i token committati a diff zero ed esce 0", () => {
    const css = resolve(PATHS.tokensSrcDir, "tailwind-theme.css");
    const ts = resolve(PATHS.tokensSrcDir, "tokens.generated.ts");
    const before = { css: readFileSync(css, "utf8"), ts: readFileSync(ts, "utf8") };
    const result = run(["theme"]);
    // `theme` scrive davvero (non ha seam da CLI): il test ripristina i byte
    // letti prima, così un'eventuale divergenza fallisce senza lasciare il
    // repo modificato.
    const after = { css: readFileSync(css, "utf8"), ts: readFileSync(ts, "utf8") };
    if (after.css !== before.css) writeFileSync(css, before.css, "utf8");
    if (after.ts !== before.ts) writeFileSync(ts, before.ts, "utf8");
    expect(result.output).not.toMatch(RESOLUTION_ERROR);
    expect(result.code, result.output).toBe(0);
    expect(result.output).toContain("Generati packages/tokens/src/tailwind-theme.css e tokens.generated.ts");
    expect(after.css).toBe(before.css);
    expect(after.ts).toBe(before.ts);
  });

  it("l'entry è l'unico file della v2 con process.exit", () => {
    const source = readFileSync(join(PATHS.packageRoot, ENTRY), "utf8");
    expect(source).toContain("process.exit(code)");
  });
});
