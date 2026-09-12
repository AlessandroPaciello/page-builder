#!/usr/bin/env node
/**
 * Check di confine bloccante per @app/contracts.
 *
 * Spine (AD-5, AD-6, AD-11): i contratti sono la porta dell'esagono, condivisi
 * FE/BE, e hanno zero dipendenze UI. Questo gate lo impone con una ALLOWLIST,
 * non una denylist: la retro di Epic 1 ha mostrato che ogni denylist scritta a
 * mano era aggirabile alla prima stesura.
 *
 * Regole:
 *   - import in `src/`: ammessi solo `zod` (e `zod/…`) e import relativi che,
 *     risolti, restano dentro `src/`. Tutto il resto è rosso, compresi i
 *     builtin `node:*` (i contratti girano anche nel browser);
 *   - forme coperte: `import … from`, `export … from`, `import "x"`,
 *     `import("x")`, `require("x")`. Un `import(`/`require(` con argomento non
 *     letterale è rosso: uno specifier costruito a runtime non si verifica;
 *   - `package.json`: `dependencies` ⊆ {zod}; `devDependencies` ⊆
 *     {@app/config, typescript, vitest, @types/node}; `peerDependencies`,
 *     `optionalDependencies`, `bundle(d)Dependencies` assenti o vuote;
 *   - fail-closed sullo scan: zero file, errori di lettura/stat, symlink che
 *     escono da `src/`, commento di blocco non chiuso → rosso.
 *
 * Limiti dichiarati (gate regex, non un lexer JS), tutti in direzione chiusa:
 *   - gli specifier sono cercati nel sorgente senza commenti ma con i literal
 *     intatti, così un import non si perde se una regex literal desincronizza
 *     il parser dei literal. Conseguenza (falsi positivi voluti, ognuno con
 *     il suo test "rosso atteso"): una STRINGA che contiene `from "react"` o
 *     `require("x")`; una chiave computed `{ ["from"]: "x" }` (l'apice segue
 *     subito `from`); un metodo chiamato `require`, es. `obj.require("x")`;
 *     `import("x", { with: … })` con attributi di import. Un literal
 *     qualunque (`const label = "react"`) invece passa, perché non è
 *     preceduto da `from`/`import`/`require`;
 *   - un template literal con interpolazione in clausola `from`/`import` è
 *     rosso: uno specifier costruito a runtime non si può verificare;
 *   - un regex literal con apici (es. `/['"]/`) desincronizza il tracker dei
 *     literal: la vista `out` resta affidabile per gli specifier, ma la vista
 *     `code` può produrre falsi rossi (es. `\u` dentro un regex). In `src/`
 *     dei contratti non esistono regex literal;
 *   - `require` usato come valore, identificatori con escape `\u`, `eval`,
 *     `Function(` e `process.getBuiltinModule(...)` sono rossi: sono i modi
 *     di caricare un modulo senza scriverne lo specifier. Il contenuto delle
 *     interpolazioni `${…}` dei template è ispezionato come codice.
 *
 * La funzione `checkBoundaries` è pura rispetto al processo (niente exit, niente
 * console) ed è testata in `tests/check-boundaries.test.ts`; il CLI gira solo
 * se lo script è invocato direttamente. `stripComments` è copiato da
 * `packages/domain/scripts/check-boundaries.mjs`, esteso con una seconda vista.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

const ALLOWED_DEPENDENCIES = {
  dependencies: new Set(["zod"]),
  devDependencies: new Set(["@app/config", "typescript", "vitest", "@types/node"]),
};
const MUST_BE_EMPTY = ["peerDependencies", "optionalDependencies", "bundleDependencies", "bundledDependencies"];

/** `from "x"`, `import "x"`, `import("x")`, `require("x")`, anche su più righe. */
const SPECIFIER = /\b(from|import|require)\s*(\(\s*)?(["'`])([^"'`\n]*)\3/g;
/** Ogni chiamata `import(`/`require(`: l'argomento deve essere un solo literal. */
const DYNAMIC_CALL = /\b(import|require)\s*\(/g;
const LITERAL_ARGUMENT = /^\s*(?:"[^"\n]*"|'[^'\n]*'|`[^`$\n]*`)\s*\)/;
/** Cercati nel codice con i literal svuotati. */
const FORBIDDEN_CODE = [
  { pattern: /\brequire\b(?!\s*\()/g, reason: "`require` usato come valore: specifier non verificabile" },
  { pattern: /\\u/g, reason: "escape unicode fuori da un literal: un identificatore può nascondere `require`" },
  { pattern: /\beval\s*\(/g, reason: "`eval`: può caricare moduli senza specifier verificabile" },
  { pattern: /\bFunction\s*\(/g, reason: "`Function(`: può caricare moduli senza specifier verificabile" },
  {
    pattern: /\bprocess\s*\.\s*getBuiltinModule\s*\(/g,
    reason: "`process.getBuiltinModule(`: carica un builtin senza scrivere lo specifier",
  },
];

/**
 * Rimuove i commenti sostituendoli con spazi (newline preservate). Restituisce
 * due viste della stessa lunghezza, così un indice vale in entrambe:
 *   - `out`: literal intatti (lì vivono gli specifier);
 *   - `code`: contenuto dei literal sostituito da spazi (solo codice).
 */
function stripComments(source) {
  let out = "";
  let code = "";
  let i = 0;
  const n = source.length;
  let unterminatedBlockComment = false;
  const blank = (ch) => (ch === "\n" ? "\n" : " ");
  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      while (i < n && source[i] !== "\n") {
        out += " ";
        code += " ";
        i++;
      }
      continue;
    }
    if (two === "/*") {
      out += "  ";
      code += "  ";
      i += 2;
      while (i < n && source.slice(i, i + 2) !== "*/") {
        out += blank(source[i]);
        code += blank(source[i]);
        i++;
      }
      if (i >= n) {
        unterminatedBlockComment = true;
        break;
      }
      out += "  ";
      code += "  ";
      i += 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      out += ch;
      code += ch;
      i++;
      while (i < n && source[i] !== ch) {
        out += source[i];
        code += blank(source[i]);
        if (source[i] === "\\" && i + 1 < n) {
          i++;
          out += source[i];
          code += blank(source[i]);
        }
        i++;
      }
      if (i < n) {
        out += source[i];
        code += source[i];
        i++;
      }
      continue;
    }
    if (ch === "`") {
      // Template literal: il testo è literal, ma il contenuto delle
      // interpolazioni `${…}` è codice e resta visibile nella vista `code`.
      out += ch;
      code += ch;
      i++;
      let braceDepth = 0;
      while (i < n) {
        const c = source[i];
        if (c === "\\" && i + 1 < n) {
          out += c + source[i + 1];
          code += c + blank(source[i + 1]);
          i += 2;
          continue;
        }
        if (braceDepth === 0 && c === "$" && source[i + 1] === "{") {
          out += "${";
          code += "${";
          i += 2;
          braceDepth = 1;
          continue;
        }
        if (braceDepth > 0) {
          if (c === "{") braceDepth++;
          else if (c === "}") braceDepth--;
          out += c;
          code += c;
          i++;
          continue;
        }
        if (c === "`") break;
        out += c;
        code += blank(c);
        i++;
      }
      if (i < n) {
        out += "`";
        code += "`";
        i++;
      }
      continue;
    }
    out += ch;
    code += ch;
    i++;
  }
  return { out, code, unterminatedBlockComment };
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
    } else {
      // Allowlist anche sui file: un file in src/ che non sappiamo
      // scannerizzare non può passare in silenzio.
      errors.push({ path: full, reason: "file in src/ con estensione non riconosciuta: non scannerizzato" });
    }
  }
  return out;
}

function isInside(base, target) {
  const rel = relative(base, target);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === "\n") line++;
  return line;
}

function isAllowedSpecifier(specifier, filePath, srcDir) {
  if (specifier === "zod") return true;
  if (specifier.startsWith("zod/")) {
    // "zod/../react" risolverebbe fuori dal package zod: nessun segmento
    // di traversata è ammesso sotto il prefisso.
    return specifier.split("/").every((segment) => segment !== ".." && segment !== "." && segment.length > 0);
  }
  if (specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../")) {
    return isInside(srcDir, resolve(dirname(filePath), specifier));
  }
  return false;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Valori che sostituiscono o redirigono il pacchetto: la chiave in allowlist non basta. */
const ALIAS_PATTERN = /npm:|:\/\//;
const ALIAS_PREFIXES = ["git@", "git+", "file:", "link:"];

function isSuspiciousDependencyValue(value) {
  if (typeof value !== "string") return false;
  return ALIAS_PATTERN.test(value) || ALIAS_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** Sezioni che sostituiscono dipendenze a install-time: l'allowlist delle chiavi non le copre. */
const FORBIDDEN_SECTIONS = ["overrides", "resolutions", "imports"];

function checkPackageJson(packageRoot, violations, scanErrors) {
  const path = join(packageRoot, "package.json");
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    scanErrors.push({ path, reason: `package.json assente o non valido (${error instanceof Error ? error.message : error})` });
    return;
  }
  if (!isPlainObject(pkg)) {
    scanErrors.push({ path, reason: "package.json non è un oggetto" });
    return;
  }

  for (const [key, allowed] of Object.entries(ALLOWED_DEPENDENCIES)) {
    const deps = pkg[key];
    if (deps === undefined) continue;
    if (!isPlainObject(deps)) {
      violations.push({ file: "package.json", reason: `"${key}" deve essere un oggetto` });
      continue;
    }
    for (const name of Object.keys(deps)) {
      if (!allowed.has(name)) {
        violations.push({
          file: "package.json",
          specifier: name,
          reason: `"${name}" in ${key} fuori allowlist (${[...allowed].join(", ")})`,
        });
      } else if (isSuspiciousDependencyValue(deps[name])) {
        violations.push({
          file: "package.json",
          specifier: name,
          reason: `"${name}" usa un alias o un URL (${deps[name]}): il valore deve venire dal registry/catalog`,
        });
      }
    }
  }

  for (const key of FORBIDDEN_SECTIONS) {
    const section = pkg[key];
    if (section === undefined) continue;
    const nonEmpty = (isPlainObject(section) || Array.isArray(section)) && Object.keys(section).length > 0;
    if (nonEmpty || (typeof section === "string" && section.length > 0)) {
      violations.push({ file: "package.json", reason: `sezione "${key}" non prevista: può sostituire dipendenze a install-time` });
    }
  }
  const pnpm = pkg.pnpm;
  if (isPlainObject(pnpm) && (pnpm.overrides !== undefined || pnpm.patchedDependencies !== undefined)) {
    violations.push({ file: "package.json", reason: `sezione "pnpm" con overrides/patchedDependencies non prevista: può sostituire dipendenze a install-time` });
  }

  for (const key of MUST_BE_EMPTY) {
    const deps = pkg[key];
    if (deps === undefined || deps === false) continue;
    const empty = (isPlainObject(deps) || Array.isArray(deps)) && Object.keys(deps).length === 0;
    if (!empty) violations.push({ file: "package.json", reason: `"${key}" deve essere assente o vuoto` });
  }
}

function checkSourceFile(filePath, packageRoot, srcDir, realSrcDir, violations, scanErrors) {
  const file = relative(packageRoot, filePath);

  let realFile;
  try {
    realFile = realpathSync(filePath);
  } catch {
    scanErrors.push({ path: filePath, reason: "realpath fallito" });
    return;
  }
  if (!isInside(realSrcDir, realFile)) {
    scanErrors.push({ path: filePath, reason: "symlink che punta fuori da src/" });
    return;
  }

  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    scanErrors.push({ path: filePath, reason: "lettura fallita" });
    return;
  }

  const { out, code, unterminatedBlockComment } = stripComments(raw);
  if (unterminatedBlockComment) {
    scanErrors.push({ path: filePath, reason: "commento di blocco non chiuso: scannerizzazione inaffidabile" });
    return;
  }

  const rawLines = raw.split("\n");
  const push = (index, reason, specifier) => {
    const line = lineAt(out, index);
    violations.push({ file, line, specifier, reason, text: rawLines[line - 1]?.trim() ?? "" });
  };

  for (const match of out.matchAll(SPECIFIER)) {
    const specifier = match[4];
    if (match[3] === "`" && specifier.includes("${")) {
      // Template interpolato: lo specifier si costruisce a runtime, non si
      // può verificare (stessa ragione degli import()/require() non letterali).
      push(match.index, "specifier da template interpolato: non verificabile", specifier);
      continue;
    }
    if (!isAllowedSpecifier(specifier, filePath, srcDir)) {
      const quoteIndex = match.index + match[0].length - specifier.length - 2;
      push(quoteIndex, `import di "${specifier}" fuori allowlist (zod, relativi dentro src/)`, specifier);
    }
  }

  for (const match of out.matchAll(DYNAMIC_CALL)) {
    const argument = out.slice(match.index + match[0].length);
    if (!LITERAL_ARGUMENT.test(argument)) {
      push(match.index, `\`${match[1]}(\` con argomento non letterale: specifier non verificabile`);
    }
  }

  for (const { pattern, reason } of FORBIDDEN_CODE) {
    for (const match of code.matchAll(pattern)) push(match.index, reason);
  }
}

/** @param {{ packageRoot: string }} options */
export function checkBoundaries({ packageRoot }) {
  const violations = [];
  const scanErrors = [];
  const srcDir = join(packageRoot, "src");

  checkPackageJson(packageRoot, violations, scanErrors);

  const files = sourceFiles(srcDir, new Set(), scanErrors);
  let realSrcDir = srcDir;
  try {
    realSrcDir = realpathSync(srcDir);
  } catch {
    // già segnalato da sourceFiles
  }
  for (const filePath of files) checkSourceFile(filePath, packageRoot, srcDir, realSrcDir, violations, scanErrors);

  // Un gate che non ha guardato nulla non può dire verde.
  if (files.length === 0 && scanErrors.length === 0) {
    scanErrors.push({ path: srcDir, reason: "nessun sorgente trovato: src/ è vuota" });
  }

  return { violations, scanErrors, scannedFileCount: files.length };
}

function fail(packageRoot, header, items) {
  console.error(`\n✖ ${header} (${items.length}):\n`);
  for (const { path, file, line, text, reason } of items) {
    const loc = file ?? relative(packageRoot, path);
    console.error(`  ${loc}${line !== undefined ? `:${line}` : ""}${reason ? ` — ${reason}` : ""}`);
    if (text) console.error(`    ${text}`);
    console.error();
  }
  process.exit(1);
}

function main() {
  const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const { violations, scanErrors, scannedFileCount } = checkBoundaries({ packageRoot });
  if (scanErrors.length > 0) fail(packageRoot, "Impossibile scannerizzare il confine in modo affidabile", scanErrors);
  if (violations.length > 0) fail(packageRoot, "Violazione del confine contracts (solo zod e import relativi in src/)", violations);
  console.log(`✔ Confine contracts rispettato (${scannedFileCount} file: solo zod e import relativi; package.json in allowlist)`);
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
