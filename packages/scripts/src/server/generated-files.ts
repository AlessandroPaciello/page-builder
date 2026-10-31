import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { componentPaths, DOMAINS_DIR, GENERATOR_VERSION, isGenerated, readGeneratedHeader, type Finding } from "../core";

/**
 * File `@generated` del repo (Story 2.24, livello 3 della CI): un file con il
 * marker di pds il cui hash non torna è stato modificato a mano (blocco); un
 * file con l'hash giusto ma una `GENERATOR_VERSION` diversa è da rigenerare
 * (avviso). I file senza marker non si guardano.
 */

/** Le radici scansionate. */
const SCANNED_ROOTS = ["packages", "apps"] as const;

/** Cartelle mai scansionate: dipendenze e output di build. */
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".next", "storybook-static"]);

const SOURCE = /\.(ts|tsx|css)$/;

/** Una prima riga che comincia come il marker di pds (anche se poi non si legge). */
const DAMAGED_MARKER = /^\uFEFF?(\/\/|\/\*)\s*@generated\s+pds\b/;

/** Il comando che rigenera un file: i file del tema (sotto `packages/tokens/src/`) con `extract_theme`, gli altri con `generate_component`. */
function regenCommandOf(relPath: string): string {
  return relPath.startsWith("packages/tokens/src/") ? "extract_theme" : "generate_component";
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // I symlink non si seguono: una cartella collegata è già scansionata dov'è davvero.
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else if (entry.isFile() && SOURCE.test(entry.name)) out.push(join(dir, entry.name));
  }
}

/** I `.ts`/`.tsx`/`.css` di `packages/` e `apps/` sotto `root`, in ordine. */
export function sourceFilesOf(root: string): string[] {
  const out: string[] = [];
  for (const name of SCANNED_ROOTS) {
    const dir = join(root, name);
    if (existsSync(dir)) walk(dir, out);
  }
  return out.sort();
}

const slash = (path: string): string => path.split(sep).join("/");

/** Blocchi (hash che non torna) e avvisi (versione diversa) dei file `@generated` di `root`. */
export function checkGeneratedFiles(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const file of sourceFilesOf(root)) {
    const text = readFileSync(file, "utf8");
    const header = readGeneratedHeader(text);
    const where = slash(relative(root, file));
    if (header === undefined) {
      // Un marker di pds rovinato (hash troncato, refuso) non deve far sparire il file dal controllo.
      if (DAMAGED_MARKER.test(text)) {
        findings.push({ level: "blocco", where, message: `La prima riga sembra il marker @generated di pds ma non si legge (hash o formato rovinati): rigenera il file con ${regenCommandOf(where)} o togli il marker se è diventato codice tuo.` });
      }
      continue;
    }
    if (!header.ok) {
      findings.push({ level: "blocco", where, message: `Il file @generated è stato modificato a mano (hash sha256:${header.hash} diverso dal corpo): rigeneralo con ${regenCommandOf(where)} o togli il marker se è diventato codice tuo.` });
    } else if (header.version !== GENERATOR_VERSION) {
      findings.push({ level: "avviso", where, message: `Il file è stato generato da pds ${header.version}, il generatore è alla versione ${GENERATOR_VERSION}: rigeneralo con ${regenCommandOf(where)}.` });
    }
  }
  return findings;
}

/** I componenti già generati: le cartelle di `DOMAINS_DIR` con un `<Comp>.styles.ts` che ha il marker. */
export function generatedComponents(root: string): string[] {
  const domains = join(root, DOMAINS_DIR);
  if (!existsSync(domains)) return [];
  return readdirSync(domains, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const styles = join(root, componentPaths(name).styles);
      return existsSync(styles) && isGenerated(readFileSync(styles, "utf8"));
    })
    .sort();
}
