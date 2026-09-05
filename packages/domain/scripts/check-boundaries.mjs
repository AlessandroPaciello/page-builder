#!/usr/bin/env node
/**
 * Check di confine bloccante per @app/domain.
 *
 * Spine (AD-1/AD-2): il core esagonale non conosce React/HTTP/Next e non
 * dipende mai da `apps/web`. La direzione consentita è `web --> core`, mai il
 * contrario. Questo è quel gate lato `domain`: esce con codice 1 alla prima
 * violazione, così `turbo run lint` fallisce la build in CI.
 *
 * Cosa blocca:
 *   - specifier per path: qualunque path che contenga il segmento `apps/web`
 *     ("../../apps/web/lib/x", "apps/web", ...)
 *   - specifier per nome pacchetto: `apps/web` si chiama `web` nel workspace
 *     (apps/web/package.json), quindi anche `import x from "web"` è vietato
 *   - i moduli vietati dal core: `react`, `next`, `@orpc/*`, `@app/db`,
 *     `@app/auth`, `@app/api` (AC#1 Story 1.2 — enforceato, non affidato alla
 *     casualità dei node_modules isolati)
 *
 * Limiti dichiarati (gate regex, non un lexer JS): uno specifier costruito
 * dinamicamente ("../../apps/" + "web", escape unicode) può passare, e una
 * regex literal in codice può desincronizzare il parser dei literal. Il gate
 * sbaglia volentieri chiudendo: una stringa che *contiene* uno di questi
 * pattern viene segnalata comunque, perché in `src/` del core non c'è nessun
 * uso legittimo. I commenti sono rimossi prima dello scan, così il check non
 * trova nel codice i pattern di cui parla in commentary.
 *
 * Pattern ispirato a `packages/ui/scripts/check-boundaries.mjs`. Zero
 * dipendenze: non c'è ancora un linter nel repo e lo Spine non ne ratifica uno.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scannedDirs = ["src"].map((d) => join(packageRoot, d));

const SOURCE_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/**
 * Specifier tra virgolette (doppie, singole o backtick — copre anche i
 * template literal). Il confine "segmento" è imposto dal prefisso: `apps/web`
 * deve stare subito dopo la virgoletta di apertura o dopo uno slash, così
 * "myapps/webhook" NON matcha mentre "../../apps/web/lib/x" sì.
 *
 * Nota: NON richiede che `import`/`export`/`require` compaia sulla stessa
 * riga dello specifier — un import multi-riga formattato da Prettier/Biome
 * mette la keyword su una riga e lo specifier su un'altra. Il confine dev'
 * essere cieco alla formattazione.
 */
const FORBIDDEN_SPECIFIER = [
  /["'`](?:[^"'`]*\/)?apps\/web(?:\/[^"'`]*)?["'`]/,
  // Nome pacchetto del workspace: `apps/web` si chiama `web`.
  /["'`]web(?:\/[^"'`]*)?["'`]/,
  // Moduli vietati dal core esagonale (AC#1): React, HTTP/Next, oRPC, adapter infra.
  /["'`]react(?:\/[^"'`]*)?["'`]/,
  /["'`]next(?:\/[^"'`]*)?["'`]/,
  /["'`]@orpc\/[^"'`]*["'`]/,
  /["'`]@app\/(?:db|auth|api)(?:\/[^"'`]*)?["'`]/,
];

/**
 * Rete secondaria, indipendente dalle virgolette: cerca il path `apps/web`
 * come segmento direttamente nel sorgente senza commenti. Serve perché
 * `stripComments` non è un lexer: una regex literal con dentro una virgoletta
 * (es. `/["']/`) può far "mangiare" al parser dei literal la virgoletta di
 * apertura di un import reale, che resta nudo nel testo scannerizzato.
 * Un path `/apps/web` in codice del core non ha alcun uso legittimo.
 */
const FORBIDDEN_RAW = [/\/apps\/web(?:\/[^\s"'`]*)?/];

/**
 * Rimuove commenti di riga e di blocco (sostituendoli con spazi, newline
 * preservate per mantenere i numeri di riga corretti nei messaggi). Le
 * virgolette dei literal di stringa restano intatte: sono il segnale che usa
 * `FORBIDDEN_SPECIFIER` per riconoscere uno specifier. Senza questo passo,
 * la stringa "apps/web" dentro un commento (come questo file) farebbe fallire
 * il check su se stesso.
 *
 * Se un commento di blocco non si chiude mai, il file non è scannerizzabile
 * in modo affidabile (e comunque sarebbe un errore di sintassi): viene
 * segnalato, non ignorato.
 */
function stripComments(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  let unterminatedBlockComment = false;
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
      if (i >= n) {
        unterminatedBlockComment = true;
        break;
      }
      out += "  ";
      i += 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      // Salta il contenuto del literal di stringa/template senza toccarlo:
      // è lì che vive lo specifier, non va alterato. Gestisce l'escape `\`
      // così una virgoletta escaped non chiude prematuramente il literal.
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
  return { out, unterminatedBlockComment };
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
  // Evita loop infiniti su symlink circolari (una dir che punta a un proprio antenato).
  if (visitedRealDirs.has(realDir)) return out;
  visitedRealDirs.add(realDir);

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    // Permessi negati o errore I/O: non è "niente da controllare", è
    // "non sono riuscito a guardare". Va segnalato, non ignorato in silenzio.
    errors.push({ path: dir, reason: "lettura fallita (permessi o I/O)" });
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      // Symlink rotto o permessi negati: stesso principio di cui sopra.
      errors.push({ path: full, reason: "stat fallito (symlink rotto o permessi)" });
      continue;
    }
    if (st.isDirectory()) {
      out = out.concat(sourceFiles(full, visitedRealDirs, errors));
    } else if (SOURCE_EXTENSION.test(entry)) {
      out.push({ path: full, unreadable: false });
    }
  }
  return out;
}

const violations = [];
const scanErrors = [];

let scannedFileCount = 0;

for (const dir of scannedDirs) {
  const entries = sourceFiles(dir, new Set(), scanErrors);
  scannedFileCount += entries.length;
  for (const entry of entries) {
    let raw;
    try {
      raw = readFileSync(entry.path, "utf8");
    } catch {
      scanErrors.push({ path: entry.path, reason: "lettura fallita" });
      continue;
    }

    const { out: scanned, unterminatedBlockComment } = stripComments(raw);
    if (unterminatedBlockComment) {
      scanErrors.push({ path: entry.path, reason: "commento di blocco non chiuso: scannerizzazione inaffidabile" });
      continue;
    }

    const rawLines = raw.split("\n");
    scanned.split("\n").forEach((line, index) => {
      if (FORBIDDEN_SPECIFIER.some((pattern) => pattern.test(line))) {
        violations.push({
          file: relative(packageRoot, entry.path),
          line: index + 1,
          text: rawLines[index]?.trim() ?? "",
        });
      }
    });
    // Rete secondaria senza virgolette: un solo match per file basta, il
    // messaggio per riga è già coperto dal passaggio qui sopra.
    if (FORBIDDEN_RAW.some((pattern) => pattern.test(scanned))) {
      violations.push({
        file: relative(packageRoot, entry.path),
        line: "?",
        text: "contiene un path `apps/web` fuori da qualunque literal scannerizzato (possibile specifier nudo o scanner desincronizzato)",
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

// Un gate che non ha guardato nulla non può dire "verde": una `src/` rinominata
// o spostata non deve spegnere il confine in silenzio.
if (scannedFileCount === 0 && scanErrors.length === 0) {
  fail("Nessun file scannerizzato: la directory `src/` non esiste o è vuota", [
    { path: join(packageRoot, "src"), reason: "nessun sorgente trovato" },
  ]);
}

if (scanErrors.length > 0) {
  fail("Impossibile scannerizzare alcuni elementi del confine", scanErrors);
}

if (violations.length > 0) {
  fail("Violazione del confine domain ↛ apps|web|react|next|@orpc|@app(db,auth,api)", violations);
}

console.log("✔ Confine domain ↛ apps/web (e react/next/@orpc/@app infra) rispettato");
