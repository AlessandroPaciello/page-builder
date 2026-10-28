#!/usr/bin/env node
/**
 * Check di confine bloccante per @penpot-ds/scripts (Story 2.4, esteso nella
 * Story 2.19).
 *
 * `scripts` legge Penpot via MCP e SCRIVE i file generati di
 * @penpot-ds/tokens. Regole di package, su tutto `src/`:
 * - vietati gli import di `@app/*`, con l'ECCEZIONE UNICA di `@app/contracts`
 *   (senza traversate `..`/`.`): i contratti sono una foglia senza dipendenze
 *   UI e la pipeline ne è un consumer;
 * - vietati `@penpot-ds/ui` e qualunque accesso ad `apps/*`;
 * - vietati gli import relativi che escono dalla radice del package
 *   (`../../ui/src/y` raggiungerebbe `@penpot-ds/ui` senza nominarlo); i
 *   relativi interni fra cartelle di `src/` restano verdi.
 *
 * Regole delle cartelle v3 (Story 2.19, `BOUNDARY_RULES`), ognuna con il suo
 * caso rosso/verde in `tests/check-boundaries.test.ts`:
 * - `core`: `src/core` importa solo relativi interni a `src/core`,
 *   `@app/contracts`, `zod` e `node:crypto` (esatto: un hash è deterministico,
 *   non rompe la purezza); import dinamici e `require` hanno un argomento
 *   letterale; il testo senza commenti non nomina `process`, `console`,
 *   `fetch`, `globalThis`, `global`, `eval`, `Buffer`, `__dirname`,
 *   `__filename` né `import.meta` (gli accessi a membro come `job.process()`
 *   restano verdi): niente disco, rete, console, exit code né MCP;
 * - `penpot`: solo `src/penpot/**` importa il client MCP
 *   (`@modelcontextprotocol/sdk/…/client…`), e `src/shared/**` non importa da
 *   `src/penpot` (un re-export lì aggirerebbe la regola `server`). Il gate
 *   controlla il client MCP, non ogni accesso di rete;
 * - `server`: `src/server/**` non importa da `src/penpot`, tranne il punto di
 *   iniezione dell'adattatore `src/server/main.ts`;
 * - `v3`: nessuna cartella `v3` (segmento di path) in `src/`, né import
 *   relativi verso una cartella `v3`: il codice nuovo vive nelle cartelle del
 *   seed, non in una copia dello spike.
 *
 * Le basi shadcn della v1 (`data/bases/`) non esistono più (Story 2.16):
 * se ricomparissero, verrebbero scansionate con le stesse regole di `src/`.
 *
 * Lo schema è quello del gate di `@app/contracts` (action item retro Epic 1,
 * chiuso per `scripts` nella Story 2.19): `checkBoundaries` è pura rispetto
 * al processo (niente exit, niente console) e il CLI gira solo se lo script
 * è invocato direttamente.
 *
 * Come legge gli import: con il parser del compilatore TypeScript
 * (`ts.createSourceFile`, la stessa grammatica di `tsc`), non con regex sul
 * testo. Sono import le dichiarazioni `import`/`export … from`,
 * `import x = require()`, `import()`, `require()` e gli `import("x")` di
 * tipo: un testo che sembra un import dentro una stringa o un template
 * (`"copia from 'x'"`) non lo è. Un sorgente che il parser non legge è uno
 * `scanError` (il CLI esce 1).
 *
 * Limiti dichiarati, tutti in direzione chiusa: la vista `raw` (commenti
 * tolti, literal intatti) resta un backstop sul testo, e segnala qualunque
 * `@app/` fuori dai casi ammessi, `@penpot-ds/ui` e `apps/` anche dentro una
 * stringa, e il client MCP fuori da `src/penpot` (cercato in ogni literal).
 * Un path composto a runtime fuori dal nucleo sfugge a un gate statico; nel
 * nucleo `import()`/`require()` con argomento non letterale sono rossi.
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

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

/** Tutte le stringhe literal di una riga: servono solo al client MCP (regola `penpot`, fail-closed). */
const STRING_LITERAL = /["'`]([^"'`\n]+)["'`]/g;

/** Backstop sul testo: `@app/` fuori dai casi ammessi, `@penpot-ds/ui` e `apps/`, anche non in forma di import. */
const FORBIDDEN_RAW = [
  /@app\/(?!contracts(?![a-zA-Z0-9_-]))/,
  /@app\/contracts\/\.\./,
  /@penpot-ds\/ui/,
  /(^|[^\w@./-])apps\//,
];

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

/** Le regole delle cartelle v3 (Story 2.19): la chiave compare in ogni `reason`. */
export const BOUNDARY_RULES = Object.freeze({
  core: "core: src/core puro (solo relativi interni, @app/contracts, zod e node:crypto; niente process, console, fetch, globalThis, global, eval, Buffer, __dirname, __filename, import.meta)",
  penpot: "penpot: solo src/penpot importa il client MCP, e src/shared non importa src/penpot",
  server: "server: src/server non importa src/penpot (tranne src/server/main.ts)",
  v3: "v3: nessuna cartella v3",
});

/** Il client MCP in ogni forma: `@modelcontextprotocol/sdk/client`, `…/client/index.js`, `…/dist/esm/client/…`. */
export function isMcpClientSpecifier(specifier) {
  if (!specifier.startsWith("@modelcontextprotocol/sdk/")) return false;
  return specifier
    .split("/")
    .slice(2)
    .some((segment) => segment === "client" || segment.startsWith("client."));
}

/** Specifier non relativi ammessi nel nucleo: `@app/contracts` e `zod` (senza traversate), `node:crypto` esatto. */
function isCoreAllowedPackage(specifier) {
  if (specifier === "node:crypto") return true;
  const traverses = specifier.split("/").some((segment) => segment === ".." || segment === ".");
  if (specifier === "@app/contracts" || specifier.startsWith("@app/contracts/")) return !traverses;
  if (specifier === "zod" || specifier.startsWith("zod/")) return !traverses;
  return false;
}

/** Nel nucleo il testo senza commenti non nomina il processo, la console, la rete né il globale. */
const CORE_FORBIDDEN_GLOBAL =
  /(?<![.\w$])(?:\b(process|console|fetch|globalThis|global|eval|Buffer|__dirname|__filename)\b|\b(import)\s*\.\s*meta\b)/;
/** Backstop raw del client MCP: anche fuori da qualunque literal scannerizzato. */
const MCP_CLIENT_RAW = /@modelcontextprotocol\/sdk\/(?:[^"'`\s]*\/)?client(?![\w-])/;

/** Path relativo al package, a segmenti. */
function segmentsOf(packageRoot, path) {
  return relative(packageRoot, path).split(sep);
}

function hasV3Segment(segments) {
  return segments.some((segment) => segment.toLowerCase() === "v3");
}

/** True se `target` (assoluto) è `dir` o sta sotto `dir`. */
function isInside(dir, target) {
  const rel = relative(dir, target);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
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

const SCRIPT_KIND = {
  ".ts": ts.ScriptKind.TS,
  ".mts": ts.ScriptKind.TS,
  ".cts": ts.ScriptKind.TS,
  ".tsx": ts.ScriptKind.TSX,
  ".js": ts.ScriptKind.JS,
  ".mjs": ts.ScriptKind.JS,
  ".cjs": ts.ScriptKind.JS,
  ".jsx": ts.ScriptKind.JSX,
};

/** Un argomento letterale: stringa o template senza interpolazioni. */
function literalText(node) {
  return node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
}

/**
 * Gli import veri di un sorgente, letti dal parser TypeScript: `imports` con
 * specifier e riga, `nonLiteralLoads` con la riga di ogni `import()`/`require()`
 * (o `import x = require()`) il cui argomento non è un literal, `parseErrors`
 * con i messaggi del parser.
 */
function extractImports(path, raw) {
  const extension = path.slice(path.lastIndexOf("."));
  const sourceFile = ts.createSourceFile(path, raw, ts.ScriptTarget.Latest, true, SCRIPT_KIND[extension] ?? ts.ScriptKind.TS);
  const lineOf = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const imports = [];
  const nonLiteralLoads = [];
  const load = (node, argument) => {
    const specifier = literalText(argument);
    if (specifier !== undefined) {
      imports.push({ specifier, line: lineOf(argument) });
      return;
    }
    nonLiteralLoads.push({ line: lineOf(node) });
    // Un template con interpolazioni passa anche come testo (`../../ui/${x}`):
    // le regole di package e di cartella lo giudicano dal prefisso.
    if (argument !== undefined && ts.isTemplateExpression(argument)) {
      imports.push({ specifier: argument.getText(sourceFile).slice(1, -1), line: lineOf(argument) });
    }
  };
  /** Il callee senza parentesi: `(require)` vale `require`. */
  const unwrap = (node) => (ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node);
  /** `import(…)`, `require(…)`, `(require)(…)` e `x.require(…)` (es. `module.require`). */
  const isLoadCallee = (node) =>
    node.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(node) && node.text === "require") ||
    (ts.isPropertyAccessExpression(node) && node.name.text === "require");

  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) {
      load(node, node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      load(node, node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      if (isLoadCallee(unwrap(node.expression))) load(node, node.arguments[0]);
    } else if (ts.isImportTypeNode(node)) {
      const argument = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
      load(node, argument);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // `parseDiagnostics` non è nell'API pubblica: se sparisse, il gate non saprebbe
  // se ha letto tutto, e lo dice (fail-closed).
  const diagnostics = sourceFile.parseDiagnostics;
  const parseErrors = Array.isArray(diagnostics)
    ? diagnostics.map((diagnostic) => {
        const line = diagnostic.start !== undefined ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : "?";
        return `riga ${line}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
      })
    : ["il parser TypeScript non espone parseDiagnostics: impossibile sapere se il sorgente è stato letto"];
  return { imports, nonLiteralLoads, parseErrors };
}

function sourceFiles(dir, visitedRealDirs, errors, dirs = []) {
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
  dirs.push(dir);

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
      out = out.concat(sourceFiles(full, visitedRealDirs, errors, dirs));
    } else if (SOURCE_EXTENSION.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Violazioni delle regole v3 per un file. `parsed` sono gli import veri
 * (`extractImports`), `scanned` è il sorgente senza commenti; `rawLines` serve
 * solo a citare la riga originale.
 */
function v3RuleViolations(packageRoot, path, parsed, scanned, rawLines) {
  const out = [];
  const file = relative(packageRoot, path);
  const segments = segmentsOf(packageRoot, path);
  const inSrc = segments[0] === "src";
  const area = inSrc ? segments[1] : undefined;
  const inCore = area === "core" && segments.length > 2;
  const inPenpot = area === "penpot" && segments.length > 2;
  const inServer = area === "server" && segments.length > 2;
  const isInjectionPoint = inServer && segments.length === 3 && segments[2] === "main.ts";
  const coreDir = resolve(packageRoot, "src", "core");
  const penpotDir = resolve(packageRoot, "src", "penpot");
  const push = (rule, line, detail, specifier) =>
    out.push({
      file,
      ...(line !== undefined ? { line } : {}),
      ...(specifier !== undefined ? { specifier } : {}),
      rule,
      reason: `${BOUNDARY_RULES[rule]} — ${detail}`,
      text: typeof line === "number" ? (rawLines[line - 1]?.trim() ?? "") : "",
    });

  if (hasV3Segment(segments)) push("v3", undefined, "il file sta in una cartella v3");

  let penpotSeen = false;
  scanned.split("\n").forEach((lineText, index) => {
    const line = index + 1;
    for (const match of lineText.matchAll(STRING_LITERAL)) {
      if (!inPenpot && isMcpClientSpecifier(match[1])) {
        penpotSeen = true;
        push("penpot", line, "il client MCP si importa solo da src/penpot", match[1]);
      }
    }
    if (inCore) {
      const global = CORE_FORBIDDEN_GLOBAL.exec(lineText);
      if (global) push("core", line, `\`${global[1] ?? "import.meta"}\` nel nucleo (niente processo, console né rete)`);
    }
  });

  for (const { specifier, line } of parsed.imports) {
    const relativeSpecifier = specifier.startsWith("./") || specifier.startsWith("../");
    const target = relativeSpecifier ? resolve(dirname(path), specifier) : undefined;
    if (target !== undefined && hasV3Segment(segmentsOf(packageRoot, target))) {
      push("v3", line, `import relativo verso una cartella v3 (${relative(packageRoot, target)})`, specifier);
    }
    if (inCore) {
      const allowed = target !== undefined ? isInside(coreDir, target) && !specifier.includes("${") : isCoreAllowedPackage(specifier);
      if (!allowed) push("core", line, `import di "${specifier}" non ammesso nel nucleo`, specifier);
    }
    if (area === "shared" && target !== undefined && isInside(penpotDir, target)) {
      push("penpot", line, `src/shared non importa src/penpot (${relative(packageRoot, target)})`, specifier);
    }
    if (inServer && !isInjectionPoint && target !== undefined && isInside(penpotDir, target)) {
      push("server", line, `import di src/penpot fuori dal punto di iniezione (${relative(packageRoot, target)})`, specifier);
    }
  }
  if (inCore) {
    for (const { line } of parsed.nonLiteralLoads) push("core", line, "import dinamico o require con argomento non letterale");
  }

  if (!inPenpot && !penpotSeen && MCP_CLIENT_RAW.test(scanned)) {
    push("penpot", "?", "il client MCP compare fuori da qualunque literal scannerizzato (possibile scanner desincronizzato)");
  }
  return out;
}

/** @param {{ packageRoot: string }} options */
export function checkBoundaries({ packageRoot }) {
  const violations = [];
  const scanErrors = [];
  const srcDir = join(packageRoot, "src");
  const srcDirs = [];
  const srcFiles = sourceFiles(srcDir, new Set(), scanErrors, srcDirs);
  // Le basi shadcn della v1 (`data/bases/`) non esistono più (Story 2.16):
  // se ricomparissero sarebbero codice, con le stesse regole.
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
    const parsed = extractImports(path, raw);
    for (const message of parsed.parseErrors) scanErrors.push({ path, reason: `sintassi non leggibile dal parser TypeScript (${message})` });
    for (const { specifier, line } of parsed.imports) {
      const text = rawLines[line - 1]?.trim() ?? "";
      if (isForbiddenSpecifier(specifier)) violations.push({ file, line, specifier, text });
      const relativeSpecifier = specifier.startsWith("./") || specifier.startsWith("../");
      if (relativeSpecifier && escapesPackageRoot(packageRoot, path, specifier)) {
        violations.push({
          file,
          line,
          specifier,
          reason: `import relativo fuori dalla radice del package (${relative(packageRoot, resolve(dirname(path), specifier))})`,
          text,
        });
      }
    }
    if (FORBIDDEN_RAW.some((pattern) => pattern.test(scanned))) {
      violations.push({
        file,
        line: "?",
        text: "contiene uno specifier vietato nel testo, anche fuori dagli import (backstop raw)",
      });
    }
    violations.push(...v3RuleViolations(packageRoot, path, parsed, scanned, rawLines));
  }

  // Una cartella v3 senza sorgenti (anche vuota) è rossa lo stesso; se
  // contiene file, sono già rossi loro.
  const v3Files = violations.filter((violation) => violation.rule === "v3").map((violation) => violation.file);
  for (const dir of srcDirs) {
    const rel = relative(packageRoot, dir);
    if (rel.split(sep).at(-1)?.toLowerCase() !== "v3") continue;
    if (v3Files.some((file) => file.startsWith(`${rel}${sep}`))) continue;
    violations.push({ file: rel, rule: "v3", reason: `${BOUNDARY_RULES.v3} — cartella v3 in src/` });
  }

  // Un gate che non ha guardato nulla non può dire verde.
  if (srcFiles.length === 0 && scanErrors.length === 0) {
    scanErrors.push({ path: srcDir, reason: "nessun sorgente trovato: src/ è vuota" });
  }

  return { violations, scanErrors, scannedFileCount: files.length };
}

function fail(header, items) {
  console.error(`\n✖ ${header} (${items.length}):\n`);
  // Le violazioni hanno `file`, gli errori di scansione `path`.
  for (const { file, path, line, text, reason, specifier } of items) {
    console.error(`  ${file ?? path}${line !== undefined ? `:${line}` : ""}${specifier ? ` (${specifier})` : ""}${reason ? ` — ${reason}` : ""}`);
    if (text) console.error(`    ${text}`);
    console.error();
  }
  process.exit(1);
}

function main() {
  const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const { violations, scanErrors, scannedFileCount } = checkBoundaries({ packageRoot });
  if (scanErrors.length > 0) fail("Impossibile scannerizzare alcuni elementi del confine", scanErrors);
  if (violations.length > 0) fail("Violazione dei confini di scripts", violations);
  console.log(
    [
      `✔ Confine scripts rispettato (${scannedFileCount} file)`,
      "  package: @app/contracts ammesso, resto di @app/*, @penpot-ds/ui, apps/* e relativi fuori dal package vietati (import letti dal parser TypeScript)",
      ...Object.values(BOUNDARY_RULES).map((rule) => `  ${rule}`),
    ].join("\n"),
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
