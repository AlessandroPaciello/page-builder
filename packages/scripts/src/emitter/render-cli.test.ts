import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseArgs, runRender } from "./render-cli";

/**
 * Test del CLI render:component (Story 2.6, AC #1): parsing fail-loud,
 * rigenerazione a diff zero con --check (exit ≠ 0 nominando componente e
 * file), skip protettivo senza errori, gate conformità prima del rendering.
 * I test girano su directory temporanee: nessuna scrittura nel repo.
 */

describe("parseArgs", () => {
  it("rimuove il separatore -- di pnpm e riconosce --check", () => {
    expect(parseArgs(["--", "Badge", "--check"])).toEqual({ componentName: "Badge", check: true, baseDir: undefined });
  });

  it("accetta --base <dir>", () => {
    expect(parseArgs(["Input", "--base", "/tmp/bases"])).toEqual({
      componentName: "Input",
      check: false,
      baseDir: "/tmp/bases",
    });
  });

  it("fallisce loud su nome mancante, argomenti ignoti e opzioni duplicate", () => {
    expect(() => parseArgs(["--check"])).toThrow(/Nome componente mancante/);
    expect(() => parseArgs(["Badge", "--altro"])).toThrow(/non riconosciuto/);
    expect(() => parseArgs(["Badge", "--check", "--check"])).toThrow(/duplicata/);
    expect(() => parseArgs(["Badge", "--base"])).toThrow(/richiede una directory/);
  });
});

describe("runRender", () => {
  const outRoot = join(tmpdir(), "render-cli-test");

  beforeEach(() => {
    rmSync(outRoot, { recursive: true, force: true });
    process.exitCode = 0;
  });

  afterAll(() => {
    rmSync(outRoot, { recursive: true, force: true });
  });

  it("scrive i 4 file @generated e un secondo run con --check è a diff zero", async () => {
    await runRender({ componentName: "Badge", check: false }, { domainsDir: outRoot });
    const tsxPath = join(outRoot, "data-display", "Badge.tsx");
    const first = readFileSync(tsxPath, "utf8");
    expect(first).toContain("@generated");

    await runRender({ componentName: "Badge", check: true }, { domainsDir: outRoot });
    expect(process.exitCode).toBe(0);
  });

  it("--check con file con marker manomesso: exit ≠ 0 nominando componente e file, senza scrivere", async () => {
    await runRender({ componentName: "Badge", check: false }, { domainsDir: outRoot });
    const tsxPath = join(outRoot, "data-display", "Badge.tsx");
    writeFileSync(tsxPath, "// @generated — manomesso\n", "utf8");
    process.exitCode = 0;

    await runRender({ componentName: "Badge", check: true }, { domainsDir: outRoot });
    expect(process.exitCode).toBe(1);
    expect(readFileSync(tsxPath, "utf8")).toBe("// @generated — manomesso\n");
  });

  it("file senza marker @generated: skip protettivo, contenuto preservato", async () => {
    const tsxPath = join(outRoot, "data-display", "Badge.tsx");
    mkdirSync(join(outRoot, "data-display"), { recursive: true });
    writeFileSync(tsxPath, "export const HandMade = true;\n", "utf8");
    await runRender({ componentName: "Badge", check: false }, { domainsDir: outRoot });
    expect(readFileSync(tsxPath, "utf8")).toBe("export const HandMade = true;\n");
  });

  it("ricetta non conforme → fail-loud prima di qualsiasi scrittura", async () => {
    // Input ha ricetta conforme; una base inesistente fa fallire il caricamento
    // PRIMA delle write: nessun file lasciato a metà.
    await expect(
      runRender({ componentName: "Badge", check: false, baseDir: "/tmp/inesistente" }, { domainsDir: outRoot }),
    ).rejects.toThrow(/Base shadcn "badge" non trovata/);
    expect(readdirSafe(outRoot)).toHaveLength(0);
  });
});

function readdirSafe(dir: string): string[] {
  try {
    return readdirRecursive(dir);
  } catch {
    return [];
  }
}

function readdirRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...readdirRecursive(full));
    else out.push(full);
  }
  return out;
}
