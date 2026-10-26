import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { pathProblem } from "../../src/server/write-changes";

/** I limiti dei path dei `Change` (Story 2.24, voce `Change.path` della review 2.20). */

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "pds-paths-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const DIR = "packages/ui/src/domains/badge";

describe("pathProblem", () => {
  it.each([`${DIR}/Badge.styles.ts`, `${DIR}/parts/Icon.tsx`])("verde: %s", (path) => {
    expect(pathProblem(tempRoot(), "badge", path)).toBeUndefined();
  });

  it.each([
    ["assoluto", "/etc/passwd"],
    ["con ..", `${DIR}/../shop-card/ShopCard.tsx`],
    ["con .", `${DIR}/./Badge.tsx`],
    ["con segmento vuoto", `${DIR}//Badge.tsx`],
    ["con backslash e ..", `${DIR}\\..\\x.ts`],
    ["con backslash dentro la cartella", `${DIR}/sub\\x.ts`],
    ["la cartella stessa", DIR],
    ["un altro componente", "packages/ui/src/domains/badge-x/BadgeX.tsx"],
    ["fuori da domains", "packages/ui/src/index.ts"],
    ["unità Windows", "C:/x.ts"],
  ])("rosso: %s", (_label, path) => {
    expect(pathProblem(tempRoot(), "badge", path)).toBeDefined();
  });

  it("rosso: un nome di componente con / o ..", () => {
    expect(pathProblem(tempRoot(), "../x", `${DIR}/Badge.tsx`)).toBeDefined();
    expect(pathProblem(tempRoot(), "a/b", "packages/ui/src/domains/a/b/X.tsx")).toBeDefined();
  });

  it("rosso: la cartella del componente è un symlink fuori da domains", () => {
    const root = tempRoot();
    const outside = tempRoot();
    mkdirSync(join(root, "packages/ui/src/domains"), { recursive: true });
    symlinkSync(outside, join(root, DIR));
    expect(pathProblem(root, "badge", `${DIR}/Badge.tsx`)).toMatch(/symlink/);
  });

  it("rosso: il file è un symlink (aggiorna scriverebbe fuori dal repo)", () => {
    const root = tempRoot();
    const outside = join(tempRoot(), "fuori.ts");
    writeFileSync(outside, "x\n");
    mkdirSync(join(root, DIR), { recursive: true });
    symlinkSync(outside, join(root, DIR, "Badge.styles.ts"));
    expect(pathProblem(root, "badge", `${DIR}/Badge.styles.ts`)).toMatch(/symlink/);
  });

  it("rosso: la cartella del componente è un symlink verso un componente vicino", () => {
    const root = tempRoot();
    mkdirSync(join(root, "packages/ui/src/domains/shop-card"), { recursive: true });
    symlinkSync(join(root, "packages/ui/src/domains/shop-card"), join(root, DIR));
    expect(pathProblem(root, "badge", `${DIR}/Badge.tsx`)).toMatch(/symlink/);
  });

  it("verde: la cartella del componente esiste davvero", () => {
    const root = tempRoot();
    mkdirSync(join(root, DIR, "parts"), { recursive: true });
    expect(pathProblem(root, "badge", `${DIR}/parts/Icon.tsx`)).toBeUndefined();
  });
});
