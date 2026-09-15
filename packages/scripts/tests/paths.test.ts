import { existsSync } from "node:fs";
import { join, sep } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { PATHS } from "../src/shared/paths";

/**
 * Ogni chiave di `src/shared/paths.ts` punta a un file o una cartella
 * esistente: uno spostamento dei dati o dei package vicini che dimentica il
 * modulo unico fallisce qui, nominando la chiave e il path — non più tardi,
 * in un comando vero con un ENOENT.
 */

/** Le chiavi il cui path non esiste, come `chiave → path`. */
function missingPaths(paths: Readonly<Record<string, string>>): string[] {
  return Object.entries(paths)
    .filter(([, path]) => !existsSync(path))
    .map(([key, path]) => `${key} → ${path}`);
}

describe("PATHS", () => {
  it.each(Object.entries(PATHS))("%s punta a un path esistente", (key, path) => {
    expect(existsSync(path), `PATHS.${key} → ${path} non esiste`).toBe(true);
  });

  it("nessuna chiave punta a un path inesistente", () => {
    expect(missingPaths(PATHS)).toEqual([]);
  });

  it("caso rosso: un path inesistente è segnalato con la chiave e il path", () => {
    const ghost = join(tmpdir(), "scripts-paths-test-inesistente", "penpot-catalog.json");
    expect(missingPaths({ catalogPath: ghost, packageRoot: PATHS.packageRoot })).toEqual([`catalogPath → ${ghost}`]);
  });

  it("i dati committati stanno fuori da src/", () => {
    for (const key of ["catalogPath", "recipesDir", "judgmentsDir", "bindingsDir", "basesDir", "designsDir", "librarySnapshotPath", "semanticSeedPath"] as const) {
      expect(PATHS[key].startsWith(`${PATHS.dataDir}${sep}`), `PATHS.${key} → ${PATHS[key]}`).toBe(true);
    }
  });
});
