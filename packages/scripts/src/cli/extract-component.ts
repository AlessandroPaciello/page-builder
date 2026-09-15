import { extract, validate } from "../extract/extract-component";
import { isDirectInvocation } from "../shared/direct-invocation";

/**
 * Entry CLI Stage 2 per componente (Story 2.5): parsing, guardia e `main`.
 * La logica è in `src/extract/extract-component.ts`.
 *
 *   extract:component -- <ComponentName> [--snapshot <path>]
 *   validate:recipe    -- <ComponentName>
 *
 * Entrambi i comandi sono per-componente e su richiesta, MAI in CI né in
 * build (AC #1): nessuno dei due entra in turbo.json come task cacheable.
 */

/** Nome pnpm dello script CLI per la modalità, usato nei messaggi d'errore. */
function scriptNameFor(mode: "extract" | "validate"): string {
  return mode === "extract" ? "extract:component" : "validate:recipe";
}

export function parseArgs(args: readonly string[]): {
  mode: "extract" | "validate";
  componentName: string;
  snapshotPath?: string;
} {
  // pnpm inoltra il separatore "--" fra script e argomenti: va rimosso, non è un flag.
  const [mode, componentName, ...rest] = args.filter((arg) => arg !== "--");
  if (mode !== "extract" && mode !== "validate") {
    throw new Error(
      `Modalità "${mode ?? "<mancante>"}" non riconosciuta — usare "extract" o "validate": pnpm extract:component -- <Nome> | pnpm validate:recipe -- <Nome>.`,
    );
  }
  if (!componentName || componentName.startsWith("--")) {
    throw new Error(`Nome componente mancante — usare: pnpm ${scriptNameFor(mode)} -- <Nome>.`);
  }
  let snapshotPath: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--snapshot") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Opzione --snapshot richiede un percorso file.");
      }
      // Un solo snapshot per run (review loop 1, ECH#4): l'ultimo che vince
      // in silenzio nasconderebbe la sorgente reale dei fatti.
      if (snapshotPath !== undefined) {
        throw new Error(`Opzione --snapshot duplicata ("${snapshotPath}" e "${value}") — un solo snapshot per estrazione.`);
      }
      snapshotPath = value;
      index++;
    } else {
      throw new Error(`Argomenti non riconosciuti: ${rest.join(", ")} — usare: pnpm ${scriptNameFor(mode)} -- <Nome> [--snapshot <path>].`);
    }
  }
  if (snapshotPath !== undefined && mode === "validate") {
    throw new Error("--snapshot è valido solo su extract: validate:recipe è già offline (legge i file committati).");
  }
  return { mode, componentName, snapshotPath };
}

async function main(): Promise<void> {
  const { mode, componentName, snapshotPath } = parseArgs(process.argv.slice(2));
  if (mode === "extract") {
    await extract(componentName, { snapshotPath });
  } else {
    validate(componentName);
  }
}

// Esegui `main()` solo da invocazione diretta, mai a un semplice `import`
// (es. dai test che importano `parseArgs`): senza questa guardia ogni import
// del modulo chiamerebbe `main()` con l'argv del processo ospite (il test
// runner) e potenzialmente un `process.exit()` a valle.
if (isDirectInvocation(import.meta.url)) {
  main()
    .then(() => {
      // Exit esplicito: socket MCP/SSE aperti non devono tenere vivo il CLI.
      process.exit(process.exitCode ?? 0);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
