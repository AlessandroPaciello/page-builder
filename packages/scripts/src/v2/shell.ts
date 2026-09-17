import { EXIT_CODES, ScriptError, formatScriptError } from "./errors";

/**
 * Il guscio CLI della v2 (CAP-8, Story 2.12): un parser, un dispatch, una
 * cattura. Ogni comando dichiara nome e usage e riceve i suoi argomenti già
 * privati del separatore `--` di pnpm; per i suoi flag usa `parseArgs`, che
 * lancia `ScriptError` di categoria `input`. `runShell` restituisce SEMPRE un
 * numero e non tocca mai il processo: chi lo chiama (`cli.ts`) fa
 * `process.exit(code)`, e nessun altro file della v2 scrive `process.exit*`.
 */

export interface Command {
  readonly name: string;
  /** Riga di uso, es. `theme [--live]`. */
  readonly usage: string;
  /** Esegue il comando; `void` vale 0. Fallisce lanciando `ScriptError`. */
  readonly run: (argv: readonly string[]) => Promise<number | void> | number | void;
}

export interface ShellIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

const CONSOLE_IO: ShellIo = {
  out: (text) => {
    console.log(text);
  },
  err: (text) => {
    console.error(text);
  },
};

export interface ArgSpec {
  /** Riga di uso del comando, ripetuta in ogni errore d'uso. */
  readonly usage: string;
  /** Flag booleani ammessi (`--live`), ciascuno al più una volta. */
  readonly flags?: readonly string[];
  /** Opzioni con valore (`--snapshot <file>`), ciascuna al più una volta. */
  readonly options?: readonly string[];
  /** Quanti argomenti posizionali sono ammessi (default: nessuno). */
  readonly positional?: { readonly min: number; readonly max: number };
}

export interface ParsedArgs {
  readonly positional: readonly string[];
  readonly flags: ReadonlySet<string>;
  readonly options: ReadonlyMap<string, string>;
}

/** Errore d'uso: categoria `input`, exit 1. */
function usageError(detail: string, usage: string): ScriptError {
  return new ScriptError({ kind: "input", detail: `${detail} — uso: ${usage}` });
}

/** Parsing stretto e condiviso: argomento sconosciuto, flag duplicato o valore mancante sono errori `input`. */
export function parseArgs(argv: readonly string[], spec: ArgSpec): ParsedArgs {
  const flags = new Set<string>();
  const options = new Map<string, string>();
  const positional: string[] = [];
  const known = { flags: new Set(spec.flags ?? []), options: new Set(spec.options ?? []) };
  const limits = spec.positional ?? { min: 0, max: 0 };
  const args = argv.filter((arg) => arg !== "--");
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (known.flags.has(arg)) {
      if (flags.has(arg)) throw usageError(`opzione ${arg} duplicata`, spec.usage);
      flags.add(arg);
    } else if (known.options.has(arg)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) throw usageError(`opzione ${arg} richiede un valore`, spec.usage);
      if (options.has(arg)) throw usageError(`opzione ${arg} duplicata`, spec.usage);
      options.set(arg, value);
      index++;
    } else if (arg.startsWith("--")) {
      throw usageError(`argomento "${arg}" non riconosciuto`, spec.usage);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length < limits.min) throw usageError(`argomento mancante (attesi almeno ${limits.min})`, spec.usage);
  if (positional.length > limits.max) {
    throw usageError(limits.max === 0 ? `argomento "${positional[0]}" non atteso` : `troppi argomenti (ammessi al più ${limits.max})`, spec.usage);
  }
  return { positional, flags, options };
}

/** La riga di uso del guscio: tutti i comandi registrati, nell'ordine dato. */
export function usageOf(commands: readonly Command[]): string {
  return `pnpm --filter @penpot-ds/scripts <comando> [-- <opzioni>]\n${commands.map((command) => `  ${command.usage}`).join("\n")}`;
}

/**
 * Dispatch e uscita. Un `ScriptError` è stampato nella forma nominativa e
 * vale l'exit code della sua categoria; qualunque altro errore vale 1 col suo
 * messaggio. Non lancia mai.
 */
export async function runShell(argv: readonly string[], commands: readonly Command[], io: ShellIo = CONSOLE_IO): Promise<number> {
  const [name, ...rest] = argv.filter((arg) => arg !== "--");
  try {
    if (name === undefined) throw new ScriptError({ kind: "input", detail: `comando mancante.\n${usageOf(commands)}` });
    const command = commands.find((candidate) => candidate.name === name);
    if (command === undefined) throw new ScriptError({ kind: "input", detail: `comando "${name}" non riconosciuto.\n${usageOf(commands)}` });
    const code = await command.run(rest);
    return code ?? 0;
  } catch (error: unknown) {
    if (error instanceof ScriptError) {
      io.err(formatScriptError(error));
      return EXIT_CODES[error.kind];
    }
    io.err(`✖ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
