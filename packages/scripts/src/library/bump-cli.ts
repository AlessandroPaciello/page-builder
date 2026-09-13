import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { COMPONENT_CONTRACTS, type ComponentContract } from "@app/contracts";

import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint, type McpCallToolResult } from "../mcp-client";
import { bumpStep, planBump } from "./bump-contract";
import { pascalCase } from "./library-plan";
import { readLibrarySnapshot, type CallToolFn } from "./library-reader";
import type { LibrarySnapshot } from "./library-snapshot";

/**
 * Entry CLI di `bump:contract` (Story 2.7 parte B):
 *
 *   bump:contract -- <Comp> [--dry-run]            stampa atteso vs trovato, nessuna scrittura
 *   bump:contract -- <Comp> --yes                  aggiorna il plugin data e rilegge
 *   bump:contract -- <Comp> --snapshot <path>      piano su uno snapshot da file (sola lettura)
 *
 * `<Comp>` è il nome del contratto (`badge`) o del container (`Badge`).
 * Senza `--yes` non scrive mai (exit 0). Dopo la scrittura rilegge Penpot:
 * se il plugin data non è il `contractId` corrente l'esito è exit 1.
 */

const WRITE_TIMEOUT_MS = 60_000;

export interface BumpArgs {
  component: string;
  yes: boolean;
  snapshotPath?: string;
}

const USAGE = "uso: pnpm bump:contract -- <Comp> [--dry-run | --yes] [--snapshot <path>]";

export function parseBumpArgs(args: readonly string[]): BumpArgs {
  return parseComponentArgs(args, USAGE);
}

/** Parsing condiviso da `bump:contract` e `adopt:variant`: `<Comp> [--dry-run | --yes] [--snapshot <path>]`. */
export function parseComponentArgs(args: readonly string[], usage: string): BumpArgs {
  const rest = args.filter((arg) => arg !== "--");
  let component: string | undefined;
  let yes = false;
  let dryRun = false;
  let snapshotPath: string | undefined;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index]!;
    if (arg === "--yes") yes = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--snapshot") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Opzione --snapshot richiede un percorso file.");
      snapshotPath = value;
      index++;
    } else if (arg.startsWith("--")) {
      throw new Error(`Argomento non riconosciuto: ${arg} — ${usage}.`);
    } else if (component === undefined) {
      component = arg;
    } else {
      throw new Error(`Un solo componente per volta: ricevuti "${component}" e "${arg}" — ${usage}.`);
    }
  }
  if (component === undefined) throw new Error(`Componente mancante — ${usage}.`);
  if (yes && dryRun) throw new Error("--yes e --dry-run sono alternativi: senza --yes non si scrive comunque.");
  // `--snapshot` è il seam offline della SOLA lettura: pianificare su un file
  // e scrivere sul Penpot live disallineerebbe piano e scrittura.
  if (yes && snapshotPath !== undefined) throw new Error("--snapshot è valido solo senza --yes (sola lettura).");
  return { component, yes, snapshotPath };
}

export function resolveContract(name: string, contracts: readonly ComponentContract[]): ComponentContract {
  const contract = contracts.find((c) => c.name === name || pascalCase(c.name) === name);
  if (!contract) {
    throw new Error(`Contratto "${name}" non trovato nel registry — contratti: ${contracts.map((c) => c.name).join(", ")}.`);
  }
  return contract;
}

export interface BumpDeps {
  /** Default: il registry `COMPONENT_CONTRACTS`. */
  contracts?: readonly ComponentContract[];
  /** Seam per i test: transport mockato, zero rete. In produzione è assente. */
  callTool?: CallToolFn;
}

export async function main(args: BumpArgs = parseBumpArgs(process.argv.slice(2)), deps: BumpDeps = {}): Promise<number> {
  const contract = resolveContract(args.component, deps.contracts ?? Object.values(COMPONENT_CONTRACTS));
  const read = (): Promise<LibrarySnapshot> => readLibrarySnapshot(deps.callTool ? { callTool: deps.callTool } : {});
  const snapshot: LibrarySnapshot = args.snapshotPath
    ? (JSON.parse(readFileSync(args.snapshotPath, "utf8")) as LibrarySnapshot)
    : await read();

  const plan = planBump(contract, snapshot);
  if (plan.kind === "error") {
    console.error(`✖ ${plan.message}`);
    return 1;
  }
  if (plan.kind === "nothing") {
    console.log(plan.message);
    return 0;
  }

  console.log(
    `Contratto "${plan.contract}", container "${plan.containerName}": plugin data atteso "${plan.to}", trovato "${plan.from}" (${plan.from} → ${plan.to}).`,
  );
  if (!args.yes) {
    console.log("Nessuna scrittura: rilancia con --yes per aggiornare il plugin data.");
    return 0;
  }

  const step = bumpStep(plan);
  const callArgs = { name: "execute_code", arguments: { code: step.code } };
  const raw = deps.callTool
    ? ((await deps.callTool(callArgs)) as McpCallToolResult)
    : await callPenpotTool(resolveMcpEndpoint(), callArgs, `operazione "${step.description}"`, WRITE_TIMEOUT_MS);
  parseExecuteCodeEnvelope(raw, `operazione "${step.description}"`);

  // L'esito lo decide la rilettura, non la risposta dello step.
  const after = planBump(contract, await read());
  if (after.kind !== "nothing") {
    const found = after.kind === "update" ? `"${after.from}"` : after.message;
    console.error(`✖ Dopo la scrittura il plugin data del contratto "${contract.name}" non è "${plan.to}": trovato ${found}.`);
    return 1;
  }
  console.log(`✔ ${after.message}`);
  return 0;
}

const isDirectInvocation = (() => {
  if (process.argv[1] === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();

if (isDirectInvocation) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
