import { isDirectInvocation } from "../shared/direct-invocation";
import { runTheme } from "../theme/theme-command";

/**
 * Entry CLI v1 di `generate:theme` (Stadio 1): parsing e `main`. Il corpo è
 * `src/theme/theme-command.ts`, condiviso col comando v2 `theme` (Story 2.12).
 * Resta in servizio, invariato nel comportamento, fino alla Story 2.16.
 */

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

async function main(): Promise<void> {
  await runTheme(parseArgs(process.argv.slice(2)));
}

if (isDirectInvocation(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
