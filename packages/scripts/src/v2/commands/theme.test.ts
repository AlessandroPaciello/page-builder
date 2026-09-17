import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PATHS } from "../../shared/paths";
import { ScriptError } from "../errors";
import { runShell, type ShellIo } from "../shell";
import { themeCommandWith } from "./theme";

/**
 * `theme [--live]` sul guscio v2: stesso corpo di `generate:theme`
 * (`src/theme/theme-command.ts`), esito dall'exit code. Offline rigenera dalla
 * fixture committata; con `--live` legge da Penpot (qui mockato) e aggiorna
 * la fixture. Categorie: lettura live fallita → penpot (2); fixture
 * illeggibile o catalogo che non genera → input (1).
 */

const dirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "theme-v2-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function io(): ShellIo & { err: (text: string) => void; errors: string[] } {
  const errors: string[] = [];
  return { errors, out: () => undefined, err: (text) => errors.push(text) };
}

describe("theme (comando v2)", () => {
  it("offline: genera dalla fixture committata in una cartella vuota, exit 0", async () => {
    const out = tmp();
    const logs: string[] = [];
    const command = themeCommandWith({ tokensSrcDir: out, log: (text) => logs.push(text) });
    expect(await runShell(["theme"], [command], io())).toBe(0);
    expect(readFileSync(join(out, "tailwind-theme.css"), "utf8")).toBe(readFileSync(join(PATHS.tokensSrcDir, "tailwind-theme.css"), "utf8"));
    expect(readFileSync(join(out, "tokens.generated.ts"), "utf8")).toBe(readFileSync(join(PATHS.tokensSrcDir, "tokens.generated.ts"), "utf8"));
    expect(logs.at(-1)).toContain("Generati");
  });

  it("--live: legge dal seam e aggiorna anche la fixture (tmp + rename), exit 0", async () => {
    const out = tmp();
    const catalogPath = join(out, "penpot-catalog.json");
    const committed = JSON.parse(readFileSync(PATHS.catalogPath, "utf8")) as unknown;
    const command = themeCommandWith({ tokensSrcDir: out, catalogPath, readLive: async () => committed as never, log: () => undefined });
    expect(await runShell(["theme", "--live"], [command], io())).toBe(0);
    expect(JSON.parse(readFileSync(catalogPath, "utf8"))).toEqual(committed);
  });

  it("rosso (penpot, exit 2): la lettura live fallisce", async () => {
    const shell = io();
    const command = themeCommandWith({
      tokensSrcDir: tmp(),
      readLive: async () => {
        throw new Error("MCP irraggiungibile: PENPOT_MCP_TOKEN mancante");
      },
    });
    expect(await runShell(["theme", "--live"], [command], shell)).toBe(2);
    expect(shell.errors[0]).toMatch(/✖ penpot[\s\S]*MCP irraggiungibile: PENPOT_MCP_TOKEN mancante/);
  });

  it("rosso (input, exit 1): fixture illeggibile", async () => {
    const shell = io();
    const command = themeCommandWith({ tokensSrcDir: tmp(), catalogPath: join(tmp(), "assente.json") });
    expect(await runShell(["theme"], [command], shell)).toBe(1);
    expect(shell.errors[0]).toMatch(/✖ input[\s\S]*ENOENT/);
  });

  it("rosso (input, exit 1): catalogo che non genera, nessun file scritto", async () => {
    const shell = io();
    const out = tmp();
    const catalogPath = join(out, "rotto.json");
    writeFileSync(catalogPath, JSON.stringify({ sets: [{ name: "x", tokens: [{ name: "a", type: "tipo-ignoto", value: "1" }] }] }));
    const command = themeCommandWith({ tokensSrcDir: out, catalogPath });
    expect(await runShell(["theme"], [command], shell)).toBe(1);
    expect(shell.errors[0]).toMatch(/✖ input/);
    expect(() => readFileSync(join(out, "tailwind-theme.css"))).toThrow();
  });

  it("rosso (input, exit 1): flag sconosciuto o posizionale", async () => {
    const command = themeCommandWith({ tokensSrcDir: tmp() });
    const shell = io();
    expect(await runShell(["theme", "--bogus"], [command], shell)).toBe(1);
    expect(shell.errors[0]).toMatch(/argomento "--bogus" non riconosciuto — uso: theme \[--live\]/);
    expect(await runShell(["theme", "Badge"], [command], shell)).toBe(1);
    await expect(command.run(["--live", "--live"])).rejects.toBeInstanceOf(ScriptError);
  });
});
