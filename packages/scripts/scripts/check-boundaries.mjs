#!/usr/bin/env node
/**
 * Check di confine bloccante per @penpot-ds/scripts (Story 2.4, Task 9).
 *
 * `scripts` è la pipeline di generazione: legge Penpot via MCP e SCRIVE i
 * file generati di @penpot-ds/tokens. In `src/` sono vietati gli import di
 * `@app/*` — ECCEZIONE UNICA `@app/contracts` (la pipeline ne è un consumer:
 * i contratti sono una foglia senza dipendenze UI, penpot-pipeline.md
 * Stadio 2) — di `@penpot-ds/ui` e qualunque accesso ad `apps/*`. Le uniche
 * frecce workspace ammesse sono verso `@penpot-ds/tokens` e `@app/contracts`.
 *
 * Lo schema è quello del gate di `@app/contracts` (action item retro Epic 1:
 * prova rosso/verde automatica, test su tmpdir in
 * `tests/check-boundaries.test.ts`): `checkBoundaries` è pura rispetto al
 * processo (niente exit, niente console) e il CLI gira solo se lo script è
 * invocato direttamente. Gli altri quattro check dell'Epic 1 restano senza
 * test proprio: l'action item resta open per quelli.
 *
 * Limiti dichiarati (gate regex, non un lexer JS), tutti in direzione
 * chiusa: gli specifier sono cercati nei literal riga per riga; la vista
 * `raw` (commenti stripping, literal intatti) è un backstop anti-desync che
 * segnala qualunque `@app/` fuori dai casi ammessi. Un `@app/contracts/..`
 * (traversata fuori dal package) è rosso sia come specifier sia in raw.
 *
 * Import relativi (riordino di packages/scripts): uno specifier relativo in
 * posizione di import si risolve rispetto al file ed è rosso se esce dalla
 * radice del package — `../../ui/src/y` raggiungerebbe `@penpot-ds/ui` senza
 * nominarlo. Gli import relativi interni fra cartelle di `src/` restano verdi.
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/** `@app/*` è vietato tranne `@app/contracts` (senza traversate `..`). */
export function isForbiddenSpecifier(specifier) {
  if (specifier === "@app/contracts") return false;
  if (specifier.startsWith("@app/contracts/")) {
    return specifier.split("/").some((segment) => segment === ".." || segment === ".");
  }
  if (specifier.startsWith("@app/")) return true;
  if (specifier.startsWith("@penpot-ds/ui")) return true;
  if (specifier === "apps" || specifier.startsWith("apps/")) return true;
  return false;
}

/** Tutte le stringhe literal di una riga (le stesse che il gate originale ispezionava). */
const STRING_LITERAL = /["'`]([^"'`\n]+)["'`]/g;

/** Backstop anti-desync: `@app/` fuori dai casi ammessi, anche non in forma di import. */
const FORBIDDEN_RAW = [
  /@app\/(?!contracts(?![a-zA-Z0-9_-]))/,
  /@app\/contracts\/\.\./,
  /@penpot-ds\/ui/,
  /(^|[^\w@./-])apps\//,
];

/**
 * Specifier relativi in posizione di import: `from "…"`, `import "…"`,
 * `import("…")`, `require("…")`. Solo questi si risolvono rispetto al file:
 * un literal qualunque che comincia con `../` (un path in un messaggio) non è
 * un import.
 */
const RELATIVE_IMPORT = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(["'`])(\.{1,2}\/[^"'`\n]*)\1/g;

/**
 * Un import relativo che, risolto rispetto al file, esce dalla radice del
 * package (es. `../../ui/src/y` o `../../apps/web/src/x`): aggira il confine
 * senza nominare `@penpot-ds/ui` né `apps/`. Un import relativo interno fra
 * cartelle di `src/` (`../shared/paths`) resta verde.
 */
export function escapesPackageRoot(packageRoot, file, specifier) {
  const target = relative(resolve(packageRoot), resolve(dirname(file), specifier));
  return target === ".." || target.startsWith(`..${sep}`) || isAbsolute(target);
}

function stripComments(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      while (i < n && source[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (two === "/*") {
      out += "  ";
      i += 2;
      while (i < n && source.slice(i, i + 2) !== "*/") {
        out += source[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      out += ch;
      i++;
      while (i < n && source[i] !== ch) {
        out += source[i];
        if (source[i] === "\\" && i + 1 < n) {
          i++;
          out += source[i];
        }
        i++;
      }
      if (i < n) {
        out += source[i];
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function sourceFiles(dir, visitedRealDirs, errors) {
  let out = [];
  let realDir;
  try {
    realDir = realpathSync(dir);
  } catch {
    errors.push({ path: dir, reason: "assente o irraggiungibile" });
    return out;
  }
  if (visitedRealDirs.has(realDir)) return out;
  visitedRealDirs.add(realDir);

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    errors.push({ path: dir, reason: "lettura fallita (permessi o I/O)" });
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      errors.push({ path: full, reason: "stat fallito (symlink rotto o permessi)" });
      continue;
    }
    if (st.isDirectory()) {
      out = out.concat(sourceFiles(full, visitedRealDirs, errors));
    } else if (SOURCE_EXTENSION.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** @param {{ packageRoot: string }} options */
export function checkBoundaries({ packageRoot }) {
  const violations = [];
  const scanErrors = [];
  const srcDir = join(packageRoot, "src");
  const srcFiles = sourceFiles(srcDir, new Set(), scanErrors);
  // Le basi shadcn committate (`data/bases/`, .tsx) sono codice anche se
  // vivono fuori da `src/`: stesse regole. Assenti in un package senza basi.
  const basesDir = join(packageRoot, "data", "bases");
  const files = existsSync(basesDir) ? srcFiles.concat(sourceFiles(basesDir, new Set(), scanErrors)) : srcFiles;

  for (const path of files) {
    let raw;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      scanErrors.push({ path, reason: "lettura fallita" });
      continue;
    }
    const file = relative(packageRoot, path);
    const rawLines = raw.split("\n");
    const scanned = stripComments(raw);
    scanned.split("\n").forEach((line, index) => {
      for (const match of line.matchAll(STRING_LITERAL)) {
        if (isForbiddenSpecifier(match[1])) {
          violations.push({ file, line: index + 1, specifier: match[1], text: rawLines[index]?.trim() ?? "" });
        }
      }
      for (const match of line.matchAll(RELATIVE_IMPORT)) {
        const specifier = match[2];
        if (escapesPackageRoot(packageRoot, path, specifier)) {
          violations.push({
            file,
            line: index + 1,
            specifier,
            reason: `import relativo fuori dalla radice del package (${relative(packageRoot, resolve(dirname(path), specifier))})`,
            text: rawLines[index]?.trim() ?? "",
          });
        }
      }
    });
    if (FORBIDDEN_RAW.some((pattern) => pattern.test(scanned))) {
      violations.push({
        file,
        line: "?",
        text: "contiene uno specifier vietato fuori da qualunque literal scannerizzato (possibile scanner desincronizzato)",
      });
    }
  }

  // Un gate che non ha guardato nulla non può dire verde.
  if (srcFiles.length === 0 && scanErrors.length === 0) {
    scanErrors.push({ path: srcDir, reason: "nessun sorgente trovato: src/ è vuota" });
  }

  return { violations, scanErrors, scannedFileCount: files.length };
}

function fail(header, items) {
  console.error(`\n✖ ${header} (${items.length}):\n`);
  for (const { file, line, text, reason, specifier } of items) {
    console.error(`  ${file}${line !== undefined ? `:${line}` : ""}${specifier ? ` (${specifier})` : ""}${reason ? ` — ${reason}` : ""}`);
    if (text) console.error(`    ${text}`);
    console.error();
  }
  process.exit(1);
}

function main() {
  const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const { violations, scanErrors, scannedFileCount } = checkBoundaries({ packageRoot });
  if (scanErrors.length > 0) fail("Impossibile scannerizzare alcuni elementi del confine", scanErrors);
  if (violations.length > 0) fail("Violazione del confine scripts ↛ @app/* (tranne @app/contracts)|@penpot-ds/ui|apps/*", violations);
  console.log(
    `✔ Confine scripts rispettato (${scannedFileCount} file: @app/contracts ammesso, resto di @app/*, @penpot-ds/ui e apps/* vietati; l'unica altra freccia è @penpot-ds/tokens)`,
  );
}

// Senza questa guardia, importare il modulo dal test eseguirebbe il CLI e il suo `process.exit()`.
const isDirectInvocation = (() => {
  if (process.argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();

if (isDirectInvocation) main();
