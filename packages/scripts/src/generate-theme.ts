import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readPenpotTokenCatalog } from "./penpot-reader";
import { generateTheme, type TokenCatalog } from "./theme-generator";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "__fixtures__/penpot-catalog.json");
const tokensSrcDir = resolve(here, "../../tokens/src");

/**
 * Scrittura atomica (temp + rename): un crash a metà write non lascia mai un
 * file troncato né nella fixture né nei file generati committati.
 */
function writeAtomic(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, filePath);
}

/** Parsing stretto: qualunque argomento non riconosciuto è un errore, non un silenzioso fallback alla fixture stantecchia. */
function parseArgs(args: readonly string[]): { live: boolean } {
  const unknown = args.filter((arg) => arg !== "--live");
  if (unknown.length > 0) {
    throw new Error(
      `Argomenti non riconosciuti: ${unknown.join(", ")} — l'unico flag supportato è "--live" (connessione al server MCP Penpot e aggiornamento della fixture).`,
    );
  }
  return { live: args.includes("--live") };
}

/**
 * Lettura del catalogo. In modalità live la fixture NON viene scritta qui:
 * viene aggiornata solo DOPO che la generazione è riuscita (vedi main) — un
 * catalogo con riferimenti rotti o tipi sconosciuti non deve mai corrompere
 * la fixture committata.
 */
async function loadCatalog(live: boolean): Promise<TokenCatalog> {
  if (!live) {
    return JSON.parse(readFileSync(fixturePath, "utf8")) as TokenCatalog;
  }

  const catalog = await readPenpotTokenCatalog();
  console.log("Catalogo letto dal server MCP Penpot (live)");
  return catalog;
}

async function main(): Promise<void> {
  const { live } = parseArgs(process.argv.slice(2));
  const catalog = await loadCatalog(live);
  const { css, ts } = generateTheme(catalog);

  writeAtomic(resolve(tokensSrcDir, "tailwind-theme.css"), css);
  writeAtomic(resolve(tokensSrcDir, "tokens.generated.ts"), ts);

  if (live) {
    writeAtomic(fixturePath, `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(`Fixture cache aggiornata: ${fixturePath}`);
  }

  console.log("Generati packages/tokens/src/tailwind-theme.css e tokens.generated.ts");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
