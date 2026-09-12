import { z } from "zod";

/**
 * Modello agnostico del contratto di componente (AD-5, AD-11): il vocabolario
 * delle props appartiene al page builder, non alla libreria che lo renderà.
 * Qui non si nomina nessun componente: i contratti concreti vivono in
 * `components/` e sono elencati una volta sola in `registry.ts`.
 */

/**
 * Tipo d'asse, dichiarato nel contratto e mai in Penpot. Instradamento a valle:
 * - `option`   → prop scelta dall'editor (`cva` nell'emitter, field in Puck);
 * - `state`    → stato del browser (`focus-visible:`/`aria-invalid:`/`disabled:`), nessuna prop;
 * - `behavior` → stato dell'headless (`data-[state=…]:`), nessuna prop.
 */
export type AxisType = "option" | "state" | "behavior";

/** Classificazione di un campo: `structure` bloccata nelle sezioni, `content` modificabile e sanitizzato. */
export type FieldKind = "structure" | "content";

export type AxisValues = readonly [string, ...string[]];

export interface Axis<V extends AxisValues = AxisValues> {
  readonly name: string;
  readonly type: AxisType;
  readonly values: V;
  readonly default: V[number];
}

export interface FieldDef {
  readonly schema: z.ZodType;
  readonly kind: FieldKind;
}

export interface ComponentContract {
  /** kebab-case, es. `accordion-item`: è la parte `nome` del plugin data `nome@versione`. */
  readonly name: string;
  /** intero ≥1 */
  readonly version: number;
  readonly axes: readonly Axis[];
  /** Lista piatta per costruzione: una parte è un nome, senza annidamento né assi propri. */
  readonly parts: readonly [string, ...string[]];
  readonly fields: Readonly<Record<string, FieldDef>>;
}

/** Stesso formato del `nome` nel plugin data Penpot `pagebuilder/contract = nome@versione`. */
export const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Nomi di assi, parti e field: identificatori minuscoli, senza spazi né separatori. */
const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;

function duplicates(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const item of items) {
    if (seen.has(item)) dup.add(item);
    seen.add(item);
  }
  return [...dup];
}

/**
 * Restituisce il contratto così com'è (literal preservati dal generic `const`)
 * e fallisce a module load se è incoerente: un contratto rotto non deve
 * arrivare né all'editor né al core.
 */
export function defineContract<const C extends ComponentContract>(def: C): C {
  const fail = (detail: string): never => {
    throw new Error(`Contratto "${def.name}": ${detail}`);
  };

  if (!KEBAB_CASE.test(def.name)) fail(`name "${def.name}" non è kebab-case`);
  if (!Number.isInteger(def.version) || def.version < 1) fail(`version ${def.version} non è un intero ≥1`);

  for (const name of duplicates(def.axes.map((axis) => axis.name))) fail(`asse "${name}" duplicato`);
  for (const axis of def.axes) {
    if (!IDENTIFIER.test(axis.name)) fail(`asse "${axis.name}" ha un nome non valido (identificatore minuscolo)`);
    for (const value of duplicates(axis.values)) fail(`asse "${axis.name}", valore "${value}" duplicato`);
    if (!axis.values.includes(axis.default)) {
      fail(`asse "${axis.name}", default "${axis.default}" non è tra i values (${axis.values.join(", ")})`);
    }
  }

  for (const part of def.parts) {
    if (!IDENTIFIER.test(part)) fail(`parte "${part}" ha un nome non valido (identificatore minuscolo)`);
  }
  for (const part of duplicates(def.parts)) fail(`parte "${part}" duplicata`);

  for (const [field, def_] of Object.entries(def.fields)) {
    if (!IDENTIFIER.test(field) || field === "__proto__") {
      fail(`field "${field}" ha un nome non valido (identificatore minuscolo)`);
    }
    if (!(def_.schema instanceof z.ZodType)) fail(`field "${field}" non ha uno schema Zod`);
    const axis = def.axes.find((a) => a.name === field);
    if (axis) fail(`field "${field}" collide con l'asse "${axis.name}" (${axis.type})`);
  }

  return def;
}

/**
 * Schema Zod delle props. Gli assi `option` diventano enum con default (e sono
 * `structure` d'ufficio, vedi `classifier.ts`); `state` e `behavior` non
 * producono props. L'oggetto è `loose`: i campi ignoti (es. `id` di Puck)
 * passano intatti, così il payload fa round-trip lossless (AD-6) e un campo
 * ignoto arriva al classifier come `content` invece di sparire. Rifiutarli è
 * una decisione del core, non del contratto.
 */
export function propsSchema(contract: ComponentContract) {
  const shape: Record<string, z.ZodType> = {};
  for (const axis of contract.axes) {
    if (axis.type === "option") shape[axis.name] = z.enum(axis.values).default(axis.default);
  }
  for (const [name, field] of Object.entries(contract.fields)) shape[name] = field.schema;
  return z.looseObject(shape);
}

/** `badge@1`: il valore del plugin data Penpot che lega un VariantContainer al contratto. */
export function contractId(contract: Pick<ComponentContract, "name" | "version">): string {
  return `${contract.name}@${contract.version}`;
}
