import { readFileSync } from "node:fs";

import { COMPONENT_CONTRACTS, type ComponentContract } from "@app/contracts";

import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint, type McpCallToolResult } from "../shared/mcp-client";
import { bumpStep, planBump } from "./bump-contract";
import { pascalCase } from "../shared/naming";
import { readLibrarySnapshot, type CallToolFn } from "./library-reader";
import type { LibrarySnapshot } from "./library-snapshot";

/**
 * Logica di `bump:contract` (Story 2.7 parte B); l'entry CLI è
 * `src/cli/bump-contract.ts`:
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

/** Corpo di `bump:contract`, con argomenti già parsati: ritorna l'exit code. */
export async function runBump(args: BumpArgs, deps: BumpDeps = {}): Promise<number> {
  const contract = resolveContract(args.component, deps.contracts ?? Object.values(COMPONENT_CONTRACTS));
  const read = (): Promise<LibrarySnapshot> => readLibrarySnapshot(deps.callTool ? { callTool: deps.callTool } : {});
  let snapshot: LibrarySnapshot;
  if (args.snapshotPath) {
    try {
      snapshot = JSON.parse(readFileSync(args.snapshotPath, "utf8")) as LibrarySnapshot;
    } catch (cause) {
      console.error(`✖ Snapshot "${args.snapshotPath}" non leggibile: ${(cause as Error).message}`);
      return 1;
    }
  } else {
    snapshot = await read();
  }

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
