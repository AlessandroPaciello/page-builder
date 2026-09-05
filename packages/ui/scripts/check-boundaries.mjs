#!/usr/bin/env node
/**
 * Check di confine bloccante per @penpot-ds/ui.
 *
 * Spine#AD-3: «i componenti in `domains/` non conoscono il dominio page-builder
 * e non importano mai da `editor/`. Persa la barriera di package con la fusione,
 * il confine è tenuto da una regola di lint bloccante in CI e dai due export
 * separati del package.»
 *
 * Questo è quel gate. Esce con codice 1 alla prima violazione, così `turbo run
 * lint` fallisce la build in CI. Zero dipendenze: non c'è ancora un linter nel
 * repo e lo Spine non ne ratifica uno.
 *
 * Copre anche `src/lib/` e `src/hooks/`, non solo `src/domains/`: sono le due
 * altre cartelle esportate pubblicamente dal pacchetto (`./lib/*`, `./hooks/*`)
 * e raggiungibili da `domains/`. Se una di loro importasse da `editor/`,
 * `domains/` erediterebbe la violazione senza scriverla mai nel proprio
 * codice, e un check che guarda solo `domains/` non la vedrebbe mai.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scannedDirs = ["domains", "lib", "hooks"].map((d) => join(packageRoot, "src", d));

const SOURCE_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/**
 * Qualunque specifier tra virgolette che contenga un segmento di path
 * "editor" — con o senza barra iniziale, con o senza sotto-percorso. Copre:
 *   "@penpot-ds/ui/editor", "@penpot-ds/ui/editor/button"
 *   "../editor", "../editor/button", "./editor/x"
 *   "@penpot-ds/ui/lib/../editor" (risoluzione a runtime del "..")
 *   "editor" bare (raro ma valido come specifier relativo malformato)
 * Nota: NON richiede che `import`/`export`/`require` compaia sulla stessa
 * riga dello specifier — un import multi-riga formattato da Prettier/Biome
 * mette la keyword su una riga e lo specifier su un'altra, ed è la forma più
 * comune per un import con più named export (già presente nel repo in
 * `user-menu.tsx`). Il confine dev'essere cieco alla formattazione.
 */
const FORBIDDEN = [/["'][^"']*\/editor(?:\/[^"']*)?["']/, /["']editor(?:\/[^"']*)?["']/];

/**
 * Rimuove commenti di riga e di blocco (sostituendoli con spazi, newline
 * preservate per mantenere i numeri di riga corretti nei messaggi). Le
 * virgolette dei literal di stringa restano intatte: sono il segnale che usa
 * `FORBIDDEN` per riconoscere uno specifier. Senza questo passo, la parola
 * "editor" dentro un commento (come questo file, o `domains/index.ts`, che
 * documentano la regola in prosa) farebbe fallire il check su se stesso.
 */
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
  return out;
}

function sourceFiles(dir, visitedRealDirs) {
  let out = [];
  let realDir;
  try {
    realDir = realpathSync(dir);
  } catch {
    return out; // directory assente: nulla da controllare (es. src/domains/ non ancora popolata).
  }
  // Evita loop infiniti su symlink circolari (una dir che punta a un proprio antenato).
  if (visitedRealDirs.has(realDir)) return out;
  visitedRealDirs.add(realDir);

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      // Symlink rotto o permessi negati: non è "niente da controllare", è
      // "non sono riuscito a guardare". Va segnalato, non ignorato in silenzio.
      out.push({ path: full, unreadable: true });
      continue;
    }
    if (st.isDirectory()) {
      out = out.concat(sourceFiles(full, visitedRealDirs));
    } else if (SOURCE_EXTENSION.test(entry)) {
      out.push({ path: full, unreadable: false });
    }
  }
  return out;
}

const violations = [];
const unreadable = [];

for (const dir of scannedDirs) {
  for (const entry of sourceFiles(dir, new Set())) {
    if (entry.unreadable) {
      unreadable.push(entry.path);
      continue;
    }

    let raw;
    try {
      raw = readFileSync(entry.path, "utf8");
    } catch {
      unreadable.push(entry.path);
      continue;
    }

    const scanned = stripComments(raw);
    const rawLines = raw.split("\n");
    scanned.split("\n").forEach((line, index) => {
      if (FORBIDDEN.some((pattern) => pattern.test(line))) {
        violations.push({
          file: relative(packageRoot, entry.path),
          line: index + 1,
          text: rawLines[index]?.trim() ?? "",
        });
      }
    });
  }
}

if (unreadable.length > 0) {
  console.error(`\n✖ Impossibile leggere ${unreadable.length} elemento/i (symlink rotto o permessi negati):\n`);
  for (const path of unreadable) {
    console.error(`  ${relative(packageRoot, path)}`);
  }
  console.error("\n  Un check che non riesce a guardare non può garantire il confine: risolvere prima di continuare.\n");
  process.exit(1);
}

if (violations.length > 0) {
  console.error(`\n✖ Violazione del confine domains/(+lib/+hooks/) → editor/ (${violations.length}):\n`);
  for (const { file, line, text } of violations) {
    console.error(`  ${file}:${line}\n    ${text}\n`);
  }
  console.error(
    "  `domains/`, `lib/` e `hooks/` sono raggiungibili dai componenti generati dal\n" +
      "  catalogo Penpot: non conoscono il dominio page-builder e non possono\n" +
      "  dipendere dal chrome dell'editor. Invertire la dipendenza — è `editor/` che\n" +
      "  importa da `domains/`/`lib/`, mai il contrario.\n",
  );
  process.exit(1);
}

console.log("✔ Confine domains/(+lib/+hooks/) → editor/ rispettato");
