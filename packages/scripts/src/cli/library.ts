import { runLibrary, type CliArgs } from "../library/library-command";
import { isDirectInvocation } from "../shared/direct-invocation";

/**
 * Entry CLI della library (Story 2.4, Task 5): parsing, guardia e `main`.
 * La logica è in `src/library/library-command.ts`.
 *
 *   bootstrap:library [--dry-run]
 *   add:library      [--dry-run]
 *   verify:library   [--snapshot <path> | --write-snapshot <path>] [--json <path>]
 */

export function parseArgs(args: readonly string[]): CliArgs {
  const filtered = args.filter((arg) => arg !== "--");
  const [mode, ...rest] = filtered;
  if (mode !== "bootstrap" && mode !== "add" && mode !== "verify") {
    throw new Error(
      `Modalità "${mode ?? "<mancante>"}" non riconosciuta — usare "bootstrap", "add" o "verify": pnpm bootstrap:library | pnpm add:library | pnpm verify:library.`,
    );
  }
  let dryRun = false;
  let snapshotPath: string | undefined;
  let writeSnapshotPath: string | undefined;
  let jsonPath: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--snapshot") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Opzione --snapshot richiede un percorso file.");
      }
      snapshotPath = value;
      index++;
    } else if (arg === "--write-snapshot") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Opzione --write-snapshot richiede un percorso file.");
      }
      writeSnapshotPath = value;
      index++;
    } else if (arg === "--json") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Opzione --json richiede un percorso file.");
      }
      jsonPath = value;
      index++;
    } else {
      throw new Error(
        `Argomento non riconosciuto: ${arg} — usare [--dry-run] [--snapshot <path>] [--write-snapshot <path>] [--json <path>].`,
      );
    }
  }
  if (dryRun && mode === "verify") {
    throw new Error("--dry-run non ha senso su verify (è già sola lettura).");
  }
  // `--snapshot` è il seam offline della SOLA lettura (review 2.4): pianificare
  // su un file ma scrivere sul Penpot live aggira il rifiuto del bootstrap
  // (basta uno snapshot vuoto) e disallinea piano e scritture.
  if (snapshotPath !== undefined && mode !== "verify" && !dryRun) {
    throw new Error("--snapshot è valido solo su verify:library oppure insieme a --dry-run.");
  }
  // `--write-snapshot` salva una lettura LIVE: con `--snapshot` salverebbe
  // una copia di un file, non Penpot (decisione 3: lo scrive lo sviluppatore dal vivo).
  if (writeSnapshotPath !== undefined && mode !== "verify") {
    throw new Error("--write-snapshot è valido solo su verify:library.");
  }
  if (writeSnapshotPath !== undefined && snapshotPath !== undefined) {
    throw new Error("--write-snapshot e --snapshot sono alternativi: --write-snapshot salva una lettura live di Penpot.");
  }
  if (jsonPath !== undefined && mode !== "verify") {
    throw new Error("--json è valido solo su verify:library.");
  }
  return {
    mode,
    dryRun,
    snapshotPath,
    ...(writeSnapshotPath === undefined ? {} : { writeSnapshotPath }),
    ...(jsonPath === undefined ? {} : { jsonPath }),
  };
}

async function main(): Promise<number> {
  return runLibrary(parseArgs(process.argv.slice(2)));
}

// Esegui `main()` solo da invocazione diretta, mai a un semplice `import`:
// senza, ogni import del modulo chiamerebbe main() con l'argv del processo
// ospite. Il realpathSync della guardia gestisce l'invocazione via symlink.
if (isDirectInvocation(import.meta.url)) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
