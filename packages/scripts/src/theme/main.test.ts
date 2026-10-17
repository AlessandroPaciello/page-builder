import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PATHS } from "../shared/paths";
import { themeMain } from "./main";

/**
 * `theme [--live]` (Story 2.18): l'entrypoint che sostituisce il guscio v2.
 * Dipendenze iniettate, niente Penpot: la lettura live è un seam. Uscite:
 * 0 ok, 1 input (argomento ignoto, fixture illeggibile, catalogo che non
 * genera), 2 penpot (lettura live fallita).
 */

const dirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "theme-main-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function sink(): { err: (text: string) => void; errors: string[] } {
  const errors: string[] = [];
  return { errors, err: (text) => errors.push(text) };
}

describe("theme (entrypoint)", () => {
  it("offline: genera dalla fixture committata gli stessi file di oggi, exit 0", async () => {
    const out = tmp();
    const logs: string[] = [];
    expect(await themeMain([], { tokensSrcDir: out, log: (text) => logs.push(text) })).toBe(0);
    expect(readFileSync(join(out, "tailwind-theme.css"), "utf8")).toBe(readFileSync(join(PATHS.tokensSrcDir, "tailwind-theme.css"), "utf8"));
    expect(readFileSync(join(out, "tokens.generated.ts"), "utf8")).toBe(readFileSync(join(PATHS.tokensSrcDir, "tokens.generated.ts"), "utf8"));
    expect(logs.at(-1)).toContain("Generati");
  });

  it("il separatore `--` di pnpm è ignorato", async () => {
    expect(await themeMain(["--"], { tokensSrcDir: tmp(), log: () => undefined })).toBe(0);
  });

  it("--live: legge dal seam e aggiorna anche la fixture, exit 0", async () => {
    const out = tmp();
    const catalogPath = join(out, "penpot-catalog.json");
    const committed = JSON.parse(readFileSync(PATHS.catalogPath, "utf8")) as unknown;
    const code = await themeMain(["--", "--live"], {
      tokensSrcDir: out,
      catalogPath,
      readLive: async () => committed as never,
      log: () => undefined,
    });
    expect(code).toBe(0);
    expect(JSON.parse(readFileSync(catalogPath, "utf8"))).toEqual(committed);
  });

  it("rosso (exit 1): argomento ignoto, messaggio d'uso su stderr, nessun file scritto", async () => {
    const out = tmp();
    const io = sink();
    expect(await themeMain(["--foo"], { tokensSrcDir: out, err: io.err })).toBe(1);
    expect(io.errors[0]).toMatch(/argomento "--foo" non riconosciuto[\s\S]*uso: pnpm --filter @penpot-ds\/scripts theme/);
    expect(() => readFileSync(join(out, "tailwind-theme.css"))).toThrow();
  });

  it("rosso (exit 1): posizionale o --live duplicato", async () => {
    const io = sink();
    expect(await themeMain(["Extra"], { tokensSrcDir: tmp(), err: io.err })).toBe(1);
    expect(io.errors[0]).toMatch(/argomento "Extra" non riconosciuto/);
    expect(await themeMain(["--live", "--live"], { tokensSrcDir: tmp(), err: io.err })).toBe(1);
    expect(io.errors[1]).toMatch(/--live duplicata/);
  });

  it("rosso (penpot, exit 2): la lettura live fallisce", async () => {
    const io = sink();
    const code = await themeMain(["--live"], {
      tokensSrcDir: tmp(),
      err: io.err,
      readLive: async () => {
        throw new Error("MCP irraggiungibile: PENPOT_MCP_TOKEN mancante");
      },
    });
    expect(code).toBe(2);
    expect(io.errors[0]).toMatch(/✖ penpot[\s\S]*MCP irraggiungibile: PENPOT_MCP_TOKEN mancante/);
  });

  it("rosso (input, exit 1): fixture illeggibile", async () => {
    const io = sink();
    expect(await themeMain([], { tokensSrcDir: tmp(), catalogPath: join(tmp(), "assente.json"), err: io.err })).toBe(1);
    expect(io.errors[0]).toMatch(/✖ input[\s\S]*ENOENT/);
  });

  it("rosso (input, exit 1): catalogo che non genera, nessun file scritto", async () => {
    const io = sink();
    const out = tmp();
    const catalogPath = join(out, "rotto.json");
    writeFileSync(catalogPath, JSON.stringify({ sets: [{ name: "x", tokens: [{ name: "a", type: "tipo-ignoto", value: "1" }] }] }));
    expect(await themeMain([], { tokensSrcDir: out, catalogPath, err: io.err })).toBe(1);
    expect(io.errors[0]).toMatch(/✖ input/);
    expect(() => readFileSync(join(out, "tailwind-theme.css"))).toThrow();
  });

  it("rosso (input, exit 1, non 2): --live con un catalogo che non genera, fixture e tema intatti", async () => {
    const io = sink();
    const out = tmp();
    const catalogPath = join(out, "penpot-catalog.json");
    writeFileSync(catalogPath, "fixture originale\n");
    const broken = { sets: [{ name: "x", tokens: [{ name: "a", type: "tipo-ignoto", value: "1" }] }] };
    const code = await themeMain(["--live"], { tokensSrcDir: out, catalogPath, readLive: async () => broken as never, err: io.err, log: () => undefined });
    expect(code).toBe(1);
    expect(io.errors[0]).toMatch(/✖ input/);
    expect(readFileSync(catalogPath, "utf8")).toBe("fixture originale\n");
    expect(existsSync(join(out, "tailwind-theme.css"))).toBe(false);
    expect(existsSync(join(out, "tokens.generated.ts"))).toBe(false);
  });
});

/**
 * Smoke del processo vero, lanciato come fa `package.json` (`node --import
 * tsx src/theme/main.ts`): guardia d'invocazione diretta, `process.exit` col
 * codice di `themeMain`, path dello script.
 */
const ENTRY = "src/theme/main.ts";
const RESOLUTION_ERROR = /ERR_MODULE_NOT_FOUND|Cannot find module|no such file or directory/;
const SMOKE_TIMEOUT = 90_000;

function run(args: readonly string[]): { code: number | null; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", ENTRY, ...args], {
    cwd: PATHS.packageRoot,
    encoding: "utf8",
    timeout: SMOKE_TIMEOUT,
  });
  return { code: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

describe("theme (processo)", { timeout: SMOKE_TIMEOUT }, () => {
  it("lo script di package.json punta all'entrypoint", () => {
    const pkg = JSON.parse(readFileSync(join(PATHS.packageRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts.theme).toBe(`node --import tsx ${ENTRY}`);
  });

  it("--foo esce 1 con la riga d'uso", () => {
    const result = run(["--foo"]);
    expect(result.output).not.toMatch(RESOLUTION_ERROR);
    expect(result.output).toMatch(/argomento "--foo" non riconosciuto[\s\S]*uso: pnpm --filter @penpot-ds\/scripts theme/);
    expect(result.code).toBe(1);
  });

  it("offline rigenera i token committati a diff zero ed esce 0", () => {
    const css = join(PATHS.tokensSrcDir, "tailwind-theme.css");
    const ts = join(PATHS.tokensSrcDir, "tokens.generated.ts");
    const before = { css: readFileSync(css), ts: readFileSync(ts) };
    let result: { code: number | null; output: string };
    let after: { css: Buffer; ts: Buffer };
    try {
      result = run([]);
      after = { css: readFileSync(css), ts: readFileSync(ts) };
    } finally {
      // `theme` scrive davvero: si ripristinano i byte letti prima, così una
      // divergenza fallisce senza lasciare il working tree sporco.
      writeFileSync(css, before.css);
      writeFileSync(ts, before.ts);
    }
    expect(result.output).not.toMatch(RESOLUTION_ERROR);
    expect(result.output).toContain("Generati");
    expect(result.code).toBe(0);
    expect(after.css.equals(before.css)).toBe(true);
    expect(after.ts.equals(before.ts)).toBe(true);
  });
});
