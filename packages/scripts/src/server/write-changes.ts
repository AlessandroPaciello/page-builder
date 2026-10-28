import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { DOMAINS_DIR, isGenerated, type Change } from "../core";

/**
 * Scrittura confinata dei `Change` del nucleo (Story 2.24). Prima si
 * controllano tutti i `Change`, poi si scrive: un solo `Change` non valido
 * è un errore e non si scrive nessun file.
 *
 * Regole:
 * - il path è relativo alla root del repo, a barre `/`, senza segmenti `..`
 *   o `.` né barre rovesciate, non è un symlink e sta (anche dopo i symlink) dentro `packages/ui/src/domains/<name>/`;
 * - `crea` su un file che esiste è un errore;
 * - `aggiorna` ed `elimina` toccano solo un file che esiste e ha il marker
 *   `@generated` di pds (il `<Comp>.tsx` dello sviluppatore non si tocca mai).
 */

/** La cartella del componente, relativa alla root del repo. */
export function componentDir(name: string): string {
  return `${DOMAINS_DIR}/${name}`;
}

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

/** Il problema di un path di `Change`, `undefined` se è nella cartella del componente. */
export function pathProblem(root: string, name: string, path: string): string | undefined {
  if (name.length === 0 || name.includes("/") || name.includes("\\") || name === "." || name === "..") return `nome di componente non valido "${name}"`;
  if (isAbsolute(path) || /^[A-Za-z]:/.test(path) || path.startsWith("/")) return `path assoluto "${path}"`;
  if (path.includes("\\")) return `path con una barra rovesciata "${path}": i path dei Change usano solo "/"`;
  const segments = path.split("/");
  if (segments.some((segment) => segment === ".." || segment === "." || segment === "")) return `path con segmenti "..", "." o vuoti "${path}"`;
  const dir = componentDir(name);
  if (!path.startsWith(`${dir}/`)) return `path "${path}" fuori dalla cartella del componente ${dir}/`;
  const absoluteDir = resolve(root, dir);
  const target = resolve(root, path);
  if (!isInside(absoluteDir, target)) return `path "${path}" fuori dalla cartella del componente ${dir}/`;
  // Un file che è un symlink si scriverebbe dove punta il link.
  if (lstatOrUndefined(target)?.isSymbolicLink() === true) return `path "${path}" è un symlink: non si scrive attraverso un link`;
  // Un symlink nella catena non deve portare fuori dalla cartella del componente.
  const realDomains = realAncestor(resolve(root, DOMAINS_DIR));
  const realTarget = realAncestor(dirname(target));
  if (existsSync(absoluteDir)) {
    const realDir = realpathSync(absoluteDir);
    if (realDir !== join(realDomains, name)) return `path "${path}": la cartella del componente ${dir}/ è un symlink verso ${realDir}`;
    if (realTarget !== realDir && !isInside(realDir, realTarget)) return `path "${path}" esce dalla cartella del componente attraverso un symlink`;
  } else if (realTarget !== realDomains && !isInside(realDomains, realTarget)) return `path "${path}" esce dalla cartella dei componenti attraverso un symlink`;
  return undefined;
}

/**
 * Controlla tutti i `Change` e, solo se sono tutti validi, li applica.
 * Restituisce i path scritti o eliminati (relativi alla root), nell'ordine dei
 * `Change`. Lancia un errore che nomina ogni `Change` rifiutato.
 */
export function writeChanges(root: string, name: string, changes: readonly Change[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const change of changes) {
    const problem = pathProblem(root, name, change.path);
    if (problem !== undefined) {
      problems.push(`${change.action} ${change.path}: ${problem}`);
      continue;
    }
    if (seen.has(change.path)) problems.push(`${change.action} ${change.path}: due Change sullo stesso file`);
    seen.add(change.path);
    const target = resolve(root, change.path);
    const exists = existsSync(target);
    if (change.action === "crea" && exists) problems.push(`crea ${change.path}: il file esiste già`);
    if (change.action !== "crea") {
      if (!exists) problems.push(`${change.action} ${change.path}: il file non esiste`);
      else if (!isGenerated(readFileSync(target, "utf8"))) problems.push(`${change.action} ${change.path}: il file non ha il marker @generated di pds`);
    }
  }
  if (problems.length > 0) throw new Error(`Nessun file scritto: Change non validi per "${name}" — ${problems.join("; ")}`);

  const written: string[] = [];
  for (const change of changes) {
    const target = resolve(root, change.path);
    if (change.action === "elimina") unlinkSync(target);
    else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, change.content, { encoding: "utf8", flag: change.action === "crea" ? "wx" : "w" });
    }
    written.push(change.path);
  }
  return written;
}
