import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  COMPONENT_CONTRACTS,
  defineContract,
  fingerprintPayload,
  PART_ROLES,
  SECTION_DEFINITIONS,
  type ComponentContract,
  type PartRole,
} from "@app/contracts";
import ts from "typescript";

import { PATHS } from "../shared/paths";
import { pascalCase } from "../shared/naming";
import { formatDiff } from "./adopt-command";
import { sha256, writeAdoption, type AdoptionFile, type AdoptionRegistry, type SourceFile } from "./adopt-variant";
import { resolveContract } from "./bump-command";

/**
 * `role:part` (Story 2.10, A): terzo adattamento di una proprietà fuori ruolo
 * — la parte è d'altro tipo, e il suo ruolo nel contratto cambia. Per la
 * regola A è un cambio COMPATIBILE: si alza solo `SCHEMA_VERSION` (+ voce
 * del fingerprint, calcolata con `fingerprintPayload`), mai
 * `contract.version` né il plugin data. I tre file (contratto,
 * `SCHEMA_VERSION`, fingerprint) si calcolano in memoria (`planRolePart`,
 * funzione pura); senza `--yes` si stampa il diff e non si scrive nulla,
 * con `--yes` si scrive con tmp + rename (`writeAdoption`). Mai Penpot.
 *
 *   role:part -- <Comp> <parte> <ruolo> [--yes]
 */

export interface RolePartSources {
  /** `packages/contracts/src/components/<nome>.ts`. */
  readonly contract: SourceFile;
  /** `packages/contracts/src/schema-version.ts`. */
  readonly schemaVersion: SourceFile;
  /** `packages/contracts/tests/contracts.fingerprint.json` (append-only). */
  readonly fingerprint: SourceFile;
}

export type RolePartPlan =
  | { readonly kind: "nothing"; readonly message: string }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "change";
      readonly contract: string;
      readonly part: string;
      readonly from: PartRole;
      readonly to: PartRole;
      readonly schemaVersion: { readonly from: number; readonly to: number };
      readonly hash: string;
      readonly changed: ComponentContract;
      readonly files: readonly AdoptionFile[];
    };

const SCHEMA_VERSION_DECLARATION = /export const SCHEMA_VERSION = ([1-9]\d*);/g;

function isPartRole(value: string): value is PartRole {
  return (PART_ROLES as readonly string[]).includes(value);
}

function propertyNamed(object: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  return object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name,
  );
}

/**
 * Il literal del ruolo di `part` nell'UNICA chiamata `defineContract({ name:
 * "<contratto>", partRoles: { … } })` del sorgente. Qualunque altra forma
 * (ruoli calcolati, spread, due chiamate) è un errore nominativo: il comando
 * non indovina dove scrivere.
 */
function roleLiteral(text: string, path: string, contractName: string, part: string): { node: ts.StringLiteral; source: ts.SourceFile } {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const calls: ts.ObjectLiteralExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineContract" &&
      node.arguments[0] !== undefined &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const name = propertyNamed(node.arguments[0], "name")?.initializer;
      if (name !== undefined && ts.isStringLiteral(name) && name.text === contractName) calls.push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (calls.length !== 1) {
    throw new Error(`Contratto "${contractName}": in ${path} attesa UNA chiamata defineContract({ name: "${contractName}", … }), trovate ${calls.length}.`);
  }
  const roles = propertyNamed(calls[0]!, "partRoles")?.initializer;
  if (roles === undefined || !ts.isObjectLiteralExpression(roles)) {
    throw new Error(`Contratto "${contractName}": in ${path} "partRoles" non è un oggetto letterale.`);
  }
  const role = propertyNamed(roles, part)?.initializer;
  if (role === undefined || !ts.isStringLiteral(role)) {
    throw new Error(`Contratto "${contractName}", parte "${part}": in ${path} il ruolo in "partRoles" non è una stringa letterale.`);
  }
  return { node: role, source };
}

/** Il ruolo della parte letto dal sorgente: è la rilettura dopo la modifica. */
export function readPartRole(text: string, path: string, contractName: string, part: string): string {
  return roleLiteral(text, path, contractName, part).node.text;
}

/** Sostituisce il ruolo della parte nel sorgente, rispettando le virgolette esistenti. */
export function setPartRoleInSource(text: string, path: string, contractName: string, part: string, role: PartRole): string {
  const { node, source } = roleLiteral(text, path, contractName, part);
  const quote = node.getText(source).startsWith("'") ? "'" : '"';
  return `${text.slice(0, node.getStart(source))}${quote}${role}${quote}${text.slice(node.getEnd())}`;
}

/** Il piano: funzione pura sui sorgenti come testo. */
export function planRolePart(
  contract: ComponentContract,
  part: string,
  role: string,
  sources: RolePartSources,
  registry: AdoptionRegistry = { components: Object.values(COMPONENT_CONTRACTS), sections: Object.values(SECTION_DEFINITIONS) },
): RolePartPlan {
  const error = (message: string): RolePartPlan => ({ kind: "error", message });
  const name = contract.name;
  if (!contract.parts.includes(part)) {
    return error(`Contratto "${name}": la parte "${part}" non esiste (parti: [${contract.parts.join(", ")}]).`);
  }
  if (!isPartRole(role)) {
    return error(`Ruolo "${role}" non è nel vocabolario dei ruoli (${PART_ROLES.join(", ")}).`);
  }
  const from = contract.partRoles[part]!;
  if (from === role) {
    return { kind: "nothing", message: `Contratto "${name}": la parte "${part}" ha già il ruolo "${role}" — nessun cambio.` };
  }
  let changed: ComponentContract;
  try {
    changed = defineContract({ ...contract, partRoles: { ...contract.partRoles, [part]: role } });
  } catch (cause) {
    return error((cause as Error).message);
  }

  // --- SCHEMA_VERSION + fingerprint (regola A: cambio compatibile) -----------
  const matches = [...sources.schemaVersion.text.matchAll(SCHEMA_VERSION_DECLARATION)];
  if (matches.length !== 1) {
    return error(`${sources.schemaVersion.path}: attesa UNA dichiarazione "export const SCHEMA_VERSION = <intero>;", trovate ${matches.length}.`);
  }
  const versionFrom = Number(matches[0]![1]);
  const versionTo = versionFrom + 1;
  const schemaVersionAfter = sources.schemaVersion.text.replace(SCHEMA_VERSION_DECLARATION, `export const SCHEMA_VERSION = ${versionTo};`);
  let recorded: Record<string, unknown>;
  try {
    recorded = JSON.parse(sources.fingerprint.text) as Record<string, unknown>;
  } catch (cause) {
    return error(`Il fingerprint ${sources.fingerprint.path} non è JSON leggibile: ${(cause as Error).message}`);
  }
  if (typeof recorded[String(versionFrom)] !== "string") {
    return error(`${sources.fingerprint.path}: manca la voce "${versionFrom}" della SCHEMA_VERSION corrente — sistema il fingerprint prima di cambiare ruolo.`);
  }
  if (Object.keys(recorded).some((key) => Number(key) > versionFrom)) {
    return error(`${sources.fingerprint.path}: ha voci oltre la SCHEMA_VERSION corrente ${versionFrom} — non si riscrive una voce esistente.`);
  }
  if (!registry.components.some((candidate) => candidate.name === name)) {
    return error(`Contratto "${name}": assente dal registry su cui si calcola il fingerprint.`);
  }
  const currentHash = sha256(fingerprintPayload(registry.components, registry.sections));
  if (currentHash !== recorded[String(versionFrom)]) {
    return error(
      `${sources.fingerprint.path}: l'hash dei contratti attuali (${currentHash}) ≠ voce "${versionFrom}" — contratti già cambiati senza bump: sistemali prima.`,
    );
  }
  const hash = sha256(
    fingerprintPayload(
      registry.components.map((candidate) => (candidate.name === name ? changed : candidate)),
      registry.sections,
    ),
  );
  const fingerprintAfter = `${JSON.stringify({ ...recorded, [String(versionTo)]: hash }, null, 2)}\n`;

  // --- Sorgente del contratto (AST) + rilettura ------------------------------
  let contractAfter: string;
  try {
    contractAfter = setPartRoleInSource(sources.contract.text, sources.contract.path, name, part, role);
    const reread = readPartRole(contractAfter, sources.contract.path, name, part);
    if (reread !== role) throw new Error(`Contratto "${name}", parte "${part}": il sorgente riletto ha il ruolo "${reread}", atteso "${role}".`);
  } catch (cause) {
    return error((cause as Error).message);
  }

  return {
    kind: "change",
    contract: name,
    part,
    from,
    to: role,
    schemaVersion: { from: versionFrom, to: versionTo },
    hash,
    changed,
    files: [
      { label: "contratto", path: sources.contract.path, before: sources.contract.text, after: contractAfter },
      { label: "SCHEMA_VERSION", path: sources.schemaVersion.path, before: sources.schemaVersion.text, after: schemaVersionAfter },
      { label: "fingerprint", path: sources.fingerprint.path, before: sources.fingerprint.text, after: fingerprintAfter },
    ],
  };
}

export interface RolePartArgs {
  readonly component: string;
  readonly part: string;
  readonly role: string;
  readonly yes: boolean;
}

export interface RolePartPaths {
  /** `packages/contracts/src`: `components/<nome>.ts` e `schema-version.ts`. */
  readonly contractsSrcDir: string;
  readonly fingerprintPath: string;
}

export interface RolePartDeps {
  contracts?: readonly ComponentContract[];
  registry?: AdoptionRegistry;
  paths?: RolePartPaths;
  print?: (text: string) => void;
}

function readSource(path: string): SourceFile {
  try {
    return { path, text: readFileSync(path, "utf8") };
  } catch (cause) {
    throw new Error(`File non leggibile: ${path} (${(cause as Error).message})`);
  }
}

/** Corpo di `role:part`, con argomenti già parsati: ritorna l'exit code. */
export function runRolePart(args: RolePartArgs, deps: RolePartDeps = {}): number {
  const print = deps.print ?? ((text: string) => console.log(text));
  const contracts = deps.contracts ?? Object.values(COMPONENT_CONTRACTS);
  const contract = resolveContract(args.component, contracts);
  const paths = deps.paths ?? { contractsSrcDir: PATHS.contractsSrcDir, fingerprintPath: PATHS.fingerprintPath };
  const sources: RolePartSources = {
    contract: readSource(resolve(paths.contractsSrcDir, "components", `${contract.name}.ts`)),
    schemaVersion: readSource(resolve(paths.contractsSrcDir, "schema-version.ts")),
    fingerprint: readSource(paths.fingerprintPath),
  };
  const plan = planRolePart(contract, args.part, args.role, sources, deps.registry ?? { components: contracts, sections: Object.values(SECTION_DEFINITIONS) });
  if (plan.kind === "error") {
    console.error(`✖ ${plan.message}`);
    return 1;
  }
  if (plan.kind === "nothing") {
    print(plan.message);
    return 0;
  }
  print(
    `Contratto "${plan.contract}", parte "${plan.part}": ruolo "${plan.from}" → "${plan.to}", SCHEMA_VERSION ${plan.schemaVersion.from} → ${plan.schemaVersion.to} (cambio compatibile, contract.version invariata).`,
  );
  for (const file of plan.files) {
    print(`\n--- ${file.label}: ${file.path}`);
    print(formatDiff(file.before, file.after));
  }
  if (!args.yes) {
    print("\nNessuna scrittura: rilancia con --yes per scrivere i tre file.");
    return 0;
  }
  writeAdoption(plan.files);
  const component = pascalCase(plan.contract);
  print(`\n✔ Ruolo scritto (${plan.files.length} file). Passi successivi:`);
  print(`  pnpm --filter @penpot-ds/scripts verify:library`);
  print(`  pnpm --filter @penpot-ds/scripts extract:component -- ${component}`);
  print(`  pnpm --filter @penpot-ds/scripts render:component -- ${component}`);
  return 0;
}
