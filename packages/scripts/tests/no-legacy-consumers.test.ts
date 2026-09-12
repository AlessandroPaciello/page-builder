import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

/**
 * "Nessun consumer vecchio" (Story 2.4, Task 8, AC #4): scansiona
 * `packages/ui/src` e `apps/web/src` (NON `packages/tokens`, eccezione
 * ammessa da AC #4) e fallisce se trova `mis-` o `mis.` in classi o
 * variabili. Ha un caso rosso (file tmp con `bg-mis-primary`) e uno verde:
 * oggi le occorrenze sono zero (correct-course 2026-09-12) e il test impedisce
 * che ricompaiano.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const SCANNED_DIRS = [join(repoRoot, "packages/ui/src"), join(repoRoot, "apps/web/src")];
const LEGACY_TOKEN_PATTERN = /\bmis[-.]/;

const SOURCE_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|css)$/;

function findLegacyOccurrences(dir: string, acc: Array<{ file: string; line: number; text: string }>): void {
  // Gate fail-closed (lezione retro Epic 1, review 2.4): se la directory
  // scansionata manca, il test deve fallire loud, non passare a scansione zero.
  if (!existsSync(dir)) throw new Error(`Directory consumer assente: ${dir} — il gate non può dirsi verde senza scansionare nulla.`);
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      findLegacyOccurrences(full, acc);
    } else if (SOURCE_EXTENSION.test(entry)) {
      const raw = readFileSync(full, "utf8");
      raw.split("\n").forEach((line, index) => {
        if (LEGACY_TOKEN_PATTERN.test(line)) {
          acc.push({ file: full, line: index + 1, text: line.trim() });
        }
      });
    }
  }
}

let tmpRoots: string[] = [];

afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots = [];
});

describe("nessun consumer dei vecchi nomi token mis-*", () => {
  it("packages/ui/src e apps/web/src non contengono mis- o mis.", () => {
    const occurrences: Array<{ file: string; line: number; text: string }> = [];
    for (const dir of SCANNED_DIRS) findLegacyOccurrences(dir, occurrences);
    expect(
      occurrences,
      `Occorrenze di nomi token legacy "mis-*" nei consumer (solo packages/tokens è l'eccezione ammessa da AC #4): ${occurrences
        .slice(0, 10)
        .map((o) => `${o.file}:${o.line}`)
        .join(", ")}`,
    ).toEqual([]);
  });

  it("caso rosso: un file tmp con bg-mis-primary fa fallire lo scanner", () => {
    const tmp = mkdtempSync(join(tmpdir(), "mis-consumers-"));
    tmpRoots.push(tmp);
    const src = join(tmp, "src");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "component.tsx"), "const cls = 'bg-mis-primary';\n");
    const occurrences: Array<{ file: string; line: number; text: string }> = [];
    findLegacyOccurrences(src, occurrences);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]!.text).toContain("bg-mis-primary");
  });

  it("caso verde: un file tmp senza nomi legacy passa", () => {
    const tmp = mkdtempSync(join(tmpdir(), "mis-consumers-"));
    tmpRoots.push(tmp);
    const src = join(tmp, "src");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "component.tsx"), "const cls = 'bg-primary ring shadow-ring';\n");
    const occurrences: Array<{ file: string; line: number; text: string }> = [];
    findLegacyOccurrences(src, occurrences);
    expect(occurrences).toEqual([]);
  });
});
