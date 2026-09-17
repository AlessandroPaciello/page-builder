import { describe, expect, it } from "vitest";

import { ERROR_KINDS, EXIT_CODES, ScriptError, exitCodeOf, formatScriptError } from "./errors";
import { parseArgs, runShell, usageOf, type Command, type ShellIo } from "./shell";

/**
 * Guscio ed errore (CAP-8, Story 2.12): un test per categoria di
 * `ScriptError` (input 1 · penpot 2 · contract 3 · gate 4), comando ignoto o
 * assente, errore non tipizzato, successo. `runShell` non tocca mai il
 * processo: qui si osservano solo il codice restituito e l'output.
 */

function io(): ShellIo & { readonly lines: { out: string[]; err: string[] } } {
  const lines = { out: [] as string[], err: [] as string[] };
  return { lines, out: (text) => lines.out.push(text), err: (text) => lines.err.push(text) };
}

const ok: Command = { name: "ok", usage: "ok", run: () => 0 };
const silent: Command = { name: "silent", usage: "silent", run: () => undefined };
const failing = (kind: ScriptError["kind"]): Command => ({
  name: kind,
  usage: `${kind} <Comp>`,
  run: () => {
    throw new ScriptError({ kind, component: "ProductCard", cell: "promo=none|hover=off", part: "badge", detail: `dettaglio di ${kind}` });
  },
});
const untyped: Command = {
  name: "untyped",
  usage: "untyped",
  run: () => {
    throw new TypeError("boom");
  },
};
const COMMANDS: readonly Command[] = [ok, silent, ...ERROR_KINDS.map(failing), untyped];

describe("ScriptError", () => {
  it("porta categoria, componente, cella, parte e dettaglio; il messaggio li nomina", () => {
    const error = new ScriptError({ kind: "contract", component: "ProductCard", cell: "promo=none|hover=off", part: "badge", detail: "presente ma vietata" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ScriptError");
    expect(error.kind).toBe("contract");
    expect(error.message).toBe('contract: ProductCard · cella promo=none|hover=off · parte "badge" — presente ma vietata');
    expect(formatScriptError(error)).toBe('✖ contract  ProductCard · cella promo=none|hover=off · parte "badge"\n  presente ma vietata');
  });

  it("senza posizione il messaggio è solo categoria e dettaglio", () => {
    const error = new ScriptError({ kind: "input", detail: "argomento mancante" });
    expect(error.message).toBe("input: argomento mancante");
    expect(formatScriptError(error)).toBe("✖ input\n  argomento mancante");
    expect("component" in error && error.component !== undefined).toBe(false);
  });

  it("exit code per categoria: 1 input · 2 penpot · 3 contract · 4 gate; non tipizzato = 1", () => {
    expect(EXIT_CODES).toEqual({ input: 1, penpot: 2, contract: 3, gate: 4 });
    for (const kind of ERROR_KINDS) expect(exitCodeOf(new ScriptError({ kind, detail: "x" }))).toBe(EXIT_CODES[kind]);
    expect(exitCodeOf(new Error("x"))).toBe(1);
    expect(exitCodeOf("stringa")).toBe(1);
  });
});

describe("runShell — una categoria, un exit code", () => {
  it.each(ERROR_KINDS.map((kind) => [kind, EXIT_CODES[kind]] as const))("%s → exit %i, messaggio nominativo su stderr", async (kind, code) => {
    const shell = io();
    expect(await runShell([kind, "ProductCard"], COMMANDS, shell)).toBe(code);
    expect(shell.lines.out).toEqual([]);
    expect(shell.lines.err).toEqual([`✖ ${kind}  ProductCard · cella promo=none|hover=off · parte "badge"\n  dettaglio di ${kind}`]);
  });

  it("comando assente → input, exit 1, usage con i comandi registrati", async () => {
    const shell = io();
    expect(await runShell([], COMMANDS, shell)).toBe(1);
    expect(shell.lines.err[0]).toContain("✖ input");
    expect(shell.lines.err[0]).toContain("comando mancante");
    expect(shell.lines.err[0]).toContain(usageOf(COMMANDS));
    expect(shell.lines.err[0]).toContain("  contract <Comp>");
  });

  it("comando ignoto → input, exit 1, nomina il comando", async () => {
    const shell = io();
    expect(await runShell(["nope", "--x"], COMMANDS, shell)).toBe(1);
    expect(shell.lines.err[0]).toMatch(/✖ input[\s\S]*comando "nope" non riconosciuto/);
  });

  it("il separatore -- di pnpm è ignorato ovunque", async () => {
    expect(await runShell(["--", "ok", "--"], COMMANDS, io())).toBe(0);
  });

  it("errore non tipizzato → exit 1 col messaggio", async () => {
    const shell = io();
    expect(await runShell(["untyped"], COMMANDS, shell)).toBe(1);
    expect(shell.lines.err).toEqual(["✖ boom"]);
  });

  it("successo: 0 esplicito o void → exit 0, nessun output d'errore", async () => {
    const shell = io();
    expect(await runShell(["ok"], COMMANDS, shell)).toBe(0);
    expect(await runShell(["silent"], COMMANDS, shell)).toBe(0);
    expect(shell.lines.err).toEqual([]);
  });
});

describe("parseArgs — il parser condiviso dei comandi", () => {
  const spec = { usage: "extract <Comp> [--check] [--snapshot <file>]", flags: ["--check"], options: ["--snapshot"], positional: { min: 1, max: 1 } };

  it("verde: posizionale, flag e opzione con valore", () => {
    const parsed = parseArgs(["ProductCard", "--check", "--snapshot", "s.json"], spec);
    expect(parsed.positional).toEqual(["ProductCard"]);
    expect(parsed.flags.has("--check")).toBe(true);
    expect(parsed.options.get("--snapshot")).toBe("s.json");
  });

  it.each([
    ["argomento sconosciuto", ["ProductCard", "--bogus"], /argomento "--bogus" non riconosciuto/],
    ["flag duplicato", ["ProductCard", "--check", "--check"], /opzione --check duplicata/],
    ["opzione duplicata", ["ProductCard", "--snapshot", "a", "--snapshot", "b"], /opzione --snapshot duplicata/],
    ["opzione senza valore", ["ProductCard", "--snapshot"], /opzione --snapshot richiede un valore/],
    ["opzione con un flag al posto del valore", ["ProductCard", "--snapshot", "--check"], /opzione --snapshot richiede un valore/],
    ["posizionale mancante", ["--check"], /argomento mancante/],
    ["troppi posizionali", ["A", "B"], /troppi argomenti/],
  ])("rosso (input): %s", (_label, argv, message) => {
    expect(() => parseArgs(argv, spec)).toThrow(ScriptError);
    expect(() => parseArgs(argv, spec)).toThrow(message);
    try {
      parseArgs(argv, spec);
    } catch (error) {
      expect((error as ScriptError).kind).toBe("input");
      expect((error as ScriptError).detail).toContain(`uso: ${spec.usage}`);
    }
  });

  it("senza posizionali ammessi, un posizionale è un errore che lo nomina", () => {
    expect(() => parseArgs(["extra"], { usage: "theme [--live]", flags: ["--live"] })).toThrow(/argomento "extra" non atteso — uso: theme \[--live\]/);
  });
});
