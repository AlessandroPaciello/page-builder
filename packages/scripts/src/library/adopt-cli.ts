import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { COMPONENT_CONTRACTS, SECTION_DEFINITIONS, type ComponentContract } from "@app/contracts";

import { BindingSchema } from "../emitter/binding-shadcn";
import { bindingsDir } from "../emitter/artifacts";
import { planAdoption, writeAdoption, type AdoptionRegistry, type AdoptionSources, type SourceFile } from "./adopt-variant";
import { parseComponentArgs, resolveContract, type BumpArgs } from "./bump-cli";
import { designsDir } from "./designs-loader";
import { isDirectInvocation as isDirectInvocationModule } from "./direct-invocation";
import type { ComponentDesign } from "./library-plan";
import { readLibrarySnapshot, type CallToolFn } from "./library-reader";
import type { LibrarySnapshot } from "./library-snapshot";

/**
 * Entry CLI di `adopt:variant` (Story 2.7 parte C):
 *
 *   adopt:variant -- <Comp> [--dry-run]            stampa il diff dei cinque file, nessuna scrittura
 *   adopt:variant -- <Comp> --yes                  scrive i cinque file (tmp + rename)
 *   adopt:variant -- <Comp> --snapshot <path>      piano su uno snapshot da file (sola lettura)
 *
 * Legge Penpot, non lo scrive mai. Senza `--yes` exit 0 senza scritture.
 */

const USAGE = "uso: pnpm adopt:variant -- <Comp> [--dry-run | --yes] [--snapshot <path>]";

export function parseAdoptArgs(args: readonly string[]): BumpArgs {
  return parseComponentArgs(args, USAGE);
}

const here = dirname(fileURLToPath(import.meta.url));
const contractsRoot = resolve(here, "../../../contracts");

/** Dove stanno i cinque file: configurabile per i test (directory temporanee). */
export interface AdoptPaths {
  /** `packages/contracts/src`: `components/<nome>.ts` e `schema-version.ts`. */
  readonly contractsSrcDir: string;
  readonly fingerprintPath: string;
  readonly bindingsDir: string;
  readonly designsDir: string;
}

export const DEFAULT_PATHS: AdoptPaths = {
  contractsSrcDir: resolve(contractsRoot, "src"),
  fingerprintPath: resolve(contractsRoot, "tests/contracts.fingerprint.json"),
  bindingsDir,
  designsDir,
};

export interface AdoptDeps {
  /** Default: il registry `COMPONENT_CONTRACTS`. */
  contracts?: readonly ComponentContract[];
  /** Default: contratti e sezioni del registry. */
  registry?: AdoptionRegistry;
  /** Seam per i test: transport mockato, zero rete. */
  callTool?: CallToolFn;
  paths?: AdoptPaths;
}

function readSource(path: string): SourceFile {
  try {
    return { path, text: readFileSync(path, "utf8") };
  } catch (cause) {
    throw new Error(`File non leggibile: ${path} (${(cause as Error).message})`);
  }
}

/** Diff a righe: prefisso e suffisso comuni, il resto come `-`/`+`. */
export function formatDiff(before: string, after: string): string {
  const a = before.split("\n");
  const b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const lines = [`@@ riga ${start + 1}`];
  for (const line of a.slice(start, endA)) lines.push(`- ${line}`);
  for (const line of b.slice(start, endB)) lines.push(`+ ${line}`);
  return lines.join("\n");
}

export async function main(args: BumpArgs = parseAdoptArgs(process.argv.slice(2)), deps: AdoptDeps = {}): Promise<number> {
  const contracts = deps.contracts ?? Object.values(COMPONENT_CONTRACTS);
  const contract = resolveContract(args.component, contracts);
  const paths = deps.paths ?? DEFAULT_PATHS;
  const registry: AdoptionRegistry = deps.registry ?? {
    components: contracts,
    sections: Object.values(SECTION_DEFINITIONS),
  };

  // I cinque file sorgente prima di Penpot: un file mancante deve fallire
  // senza nemmeno una chiamata di rete (read-only, ma inutile).
  const sources: AdoptionSources = {
    contract: readSource(resolve(paths.contractsSrcDir, "components", `${contract.name}.ts`)),
    schemaVersion: readSource(resolve(paths.contractsSrcDir, "schema-version.ts")),
    fingerprint: readSource(paths.fingerprintPath),
    binding: readSource(resolve(paths.bindingsDir, `${contract.name}.binding.json`)),
    design: readSource(resolve(paths.designsDir, `${contract.name}.design.json`)),
  };
  let bindingRaw: unknown;
  try {
    bindingRaw = JSON.parse(sources.binding.text);
  } catch (cause) {
    console.error(`✖ Binding "${sources.binding.path}" non è JSON leggibile: ${(cause as Error).message}`);
    return 1;
  }
  const binding = BindingSchema.safeParse(bindingRaw);
  if (!binding.success) {
    console.error(`✖ Binding malformato (${sources.binding.path}): ${binding.error.issues.map((issue) => issue.message).join("; ")}`);
    return 1;
  }
  let design: ComponentDesign;
  try {
    design = JSON.parse(sources.design.text) as ComponentDesign;
  } catch (cause) {
    console.error(`✖ Design "${sources.design.path}" non è JSON leggibile: ${(cause as Error).message}`);
    return 1;
  }

  let snapshot: LibrarySnapshot;
  if (args.snapshotPath) {
    try {
      snapshot = JSON.parse(readFileSync(args.snapshotPath, "utf8")) as LibrarySnapshot;
    } catch (cause) {
      console.error(`✖ Snapshot "${args.snapshotPath}" non leggibile: ${(cause as Error).message}`);
      return 1;
    }
  } else {
    snapshot = await readLibrarySnapshot(deps.callTool ? { callTool: deps.callTool } : {});
  }

  const plan = planAdoption(contract, snapshot, design, binding.data, sources, registry);
  if (plan.kind === "error") {
    console.error(`✖ ${plan.message}`);
    return 1;
  }
  if (plan.kind === "nothing") {
    console.log(plan.message);
    return 0;
  }

  const added = plan.added.map(({ axis, values }) => `${axis}: ${values.join(", ")}`).join("; ");
  console.log(
    `Contratto "${plan.contract}", container "${plan.containerName}": valori da adottare [${added}], celle di design ${plan.cells.map((key) => `"${key}"`).join(", ")}, SCHEMA_VERSION ${plan.schemaVersion.from} → ${plan.schemaVersion.to}.`,
  );
  for (const file of plan.files) {
    console.log(`\n--- ${file.label}: ${file.path}`);
    console.log(formatDiff(file.before, file.after));
  }
  if (!args.yes) {
    console.log("\nNessuna scrittura: rilancia con --yes per scrivere i cinque file.");
    return 0;
  }

  writeAdoption(plan.files);
  const component = plan.containerName;
  console.log(`\n✔ Adozione scritta (${plan.files.length} file). Passi successivi:`);
  console.log(`  pnpm --filter @penpot-ds/scripts extract:component -- ${component}`);
  console.log(`  pnpm --filter @penpot-ds/scripts render:component -- ${component}`);
  console.log("  pnpm --filter @penpot-ds/scripts gates:render");
  console.log("  pnpm --filter @penpot-ds/scripts verify:library");
  return 0;
}

const isDirectInvocation = isDirectInvocationModule(import.meta.url);

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
