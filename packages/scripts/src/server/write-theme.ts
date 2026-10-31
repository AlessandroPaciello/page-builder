import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { isGenerated } from "../core";

/**
 * Scrittura confinata dei file del tema (Story 2.26): `extract_theme` produce
 * file con path **relativo a `packages/tokens/src/`** (`theme.css`,
 * `themes/<g>-<n>.css`, `fonts.css`, `tokens.generated.ts`); qui si scrivono
 * sotto `packages/tokens/src/`. Stesse regole di `write-changes.ts`, ma con
 * una cartella fissa al posto della cartella del componente:
 * - path relativo, a barre `/`, senza `..`/`.`/segmenti vuoti né barre
 *   rovesciate, non un symlink, dentro `packages/tokens/src/` (anche dopo i
 *   symlink);
 * - si sovrascrive solo un file che esiste e ha il marker `@generated` di pds;
 *   un file senza marker non si tocca mai (niente file scritti a mano).
 */

/** La cartella del tema, relativa alla root del repo. */
const TOKENS_SRC_DIR = "packages/tokens/src";

function isInside(dir: string, target: string): boolean {
  const rel = relative(dir, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Il primo antenato esistente di `path`, risolto dai symlink. */
function realAncestor(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return realpathSync(current);
}

function lstatOrUndefined(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

/** Il problema di un path del tema (relativo a `packages/tokens/src/`), `undefined` se è dentro la cartella. */
export function themePathProblem(root: string, rel: string): string | undefined {
  if (isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || rel.startsWith("/")) return `path assoluto "${rel}"`;
  if (rel.includes("\\")) return `path con una barra rovesciata "${rel}": i path dei file del tema usano solo "/"`;
  const segments = rel.split("/");
  if (segments.some((segment) => segment === ".." || segment === "." || segment === "")) return `path con segmenti "..", "." o vuoti "${rel}"`;
  const absoluteDir = resolve(root, TOKENS_SRC_DIR);
  const target = resolve(root, TOKENS_SRC_DIR, rel);
  if (!isInside(absoluteDir, target)) return `path "${rel}" fuori dalla cartella del tema ${TOKENS_SRC_DIR}/`;
  if (lstatOrUndefined(target)?.isSymbolicLink() === true) return `path "${rel}" è un symlink: non si scrive attraverso un link`;
  const realTokens = realAncestor(resolve(root, TOKENS_SRC_DIR));
  const realTarget = realAncestor(dirname(target));
  if (realTarget !== realTokens && !isInside(realTokens, realTarget)) return `path "${rel}" esce dalla cartella del tema attraverso un symlink`;
  return undefined;
}

/**
 * Controlla tutti i file e, solo se sono tutti validi, li scrive. I path sono
 * relativi a `packages/tokens/src/`; restituisce i path scritti relativi alla
 * root del repo (`packages/tokens/src/<path>`), nell'ordine dato. Lancia un
 * errore che nomina ogni file rifiutato.
 */
export function writeThemeFiles(root: string, files: readonly { path: string; content: string }[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const problem = themePathProblem(root, file.path);
    if (problem !== undefined) {
      problems.push(`${file.path}: ${problem}`);
      continue;
    }
    if (seen.has(file.path)) problems.push(`${file.path}: due file sullo stesso path`);
    seen.add(file.path);
    const target = resolve(root, TOKENS_SRC_DIR, file.path);
    if (existsSync(target) && !isGenerated(readFileSync(target, "utf8"))) {
      problems.push(`${file.path}: il file esiste senza il marker @generated di pds: non si sovrascrive mai`);
    }
  }
  if (problems.length > 0) throw new Error(`Nessun file scritto: file del tema non validi — ${problems.join("; ")}`);

  const written: string[] = [];
  for (const file of files) {
    const target = resolve(root, TOKENS_SRC_DIR, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content, "utf8");
    written.push(`${TOKENS_SRC_DIR}/${file.path}`);
  }
  return written;
}
