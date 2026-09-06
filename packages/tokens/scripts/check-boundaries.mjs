#!/usr/bin/env node
/**
 * Check di confine bloccante per @penpot-ds/tokens.
 *
 * `tokens` è un package FOGLIA: espone i design token generati a tutto il
 * monorepo e non deve dipendere da nessun altro workspace (`@app/*`,
 * `@penpot-ds/*`) né importare in modo relativo fuori da sé. Il CSS/TS
 * generato è l'output di `@penpot-ds/scripts`: l'unica freccia ammessa è
 * scripts → tokens, mai il contrario.
 *
 * Limiti dichiarati (gate regex, non un lexer JS), stessi principi del
 * check di `packages/api` e `packages/ui`: pattern replicato in forma
 * compatta. Zero dipendenze.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scannedDirs = ["src"].map((d) => join(packageRoot, d));

const SOURCE_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

const FORBIDDEN_SPECIFIER = [
  // Package workspace: il foglio non importa nessuno.
  /["'`]@app\/[^"'`]*["'`]/,
  /["'`]@penpot-ds\/[^"'`]*["'`]/,
  // Import relativi che escono dal package (qualsiasi specifier che inizia con `..`).
  /["'`]\.\.(?:\/[^"'`]*)+["'`]/,
];

const FORBIDDEN_RAW = [/\/?@app\//, /\/?@penpot-ds\//];

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

const violations = [];
const scanErrors = [];
let scannedFileCount = 0;

for (const dir of scannedDirs) {
  const files = sourceFiles(dir, new Set(), scanErrors);
  scannedFileCount += files.length;
  for (const path of files) {
    let raw;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      scanErrors.push({ path, reason: "lettura fallita" });
      continue;
    }
    const scanned = stripComments(raw);
    const rawLines = raw.split("\n");
    scanned.split("\n").forEach((line, index) => {
      if (FORBIDDEN_SPECIFIER.some((pattern) => pattern.test(line))) {
        violations.push({ file: relative(packageRoot, path), line: index + 1, text: rawLines[index]?.trim() ?? "" });
      }
    });
    if (FORBIDDEN_RAW.some((pattern) => pattern.test(scanned))) {
      violations.push({
        file: relative(packageRoot, path),
        line: "?",
        text: "contiene uno specifier workspace fuori da qualunque literal scannerizzato (possibile scanner desincronizzato)",
      });
    }
  }
}

function fail(header, items) {
  console.error(`\n✖ ${header} (${items.length}):\n`);
  for (const { path, file, line, text, reason } of items) {
    const loc = file ?? relative(packageRoot, path);
    console.error(`  ${loc}${line !== undefined ? `:${line}` : ""}${reason ? ` — ${reason}` : ""}`);
    if (text) console.error(`    ${text}`);
    console.error();
  }
  process.exit(1);
}

if (scannedFileCount === 0 && scanErrors.length === 0) {
  fail("Nessun file scannerizzato: la directory `src/` non esiste o è vuota", [
    { path: join(packageRoot, "src"), reason: "nessun sorgente trovato" },
  ]);
}

if (scanErrors.length > 0) {
  fail("Impossibile scannerizzare alcuni elementi del confine", scanErrors);
}

if (violations.length > 0) {
  fail("Violazione del confine tokens ↛ workspace (package foglia: nessuna dipendenza runtime)", violations);
}

console.log("✔ Confine tokens ↛ workspace rispettato (package foglia)");
