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

/**
 * Ruolo di parte (AD-11, Story 2.10): che cosa la parte È, dichiarato nel
 * contratto e mai in Penpot. Vocabolario chiuso, indipendente da Penpot e
 * dalle librerie: quali proprietà Penpot ammette ogni ruolo lo dice la
 * tabella ruolo → proprietà di `packages/scripts`, non il contratto.
 * - `surface` → contenitore (sfondo, bordo, raggio, spaziatura);
 * - `text`    → testo;
 * - `icon`    → icona vettoriale;
 * - `divider` → separatore (solo tratto).
 */
export const PART_ROLES = ["surface", "text", "icon", "divider"] as const;

export type PartRole = (typeof PART_ROLES)[number];

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
  /** Il ruolo di ogni parte (esattamente le `parts`, una voce ciascuna). */
  readonly partRoles: Readonly<Record<string, PartRole>>;
  readonly fields: Readonly<Record<string, FieldDef>>;
}

/** Stesso formato del `nome` nel plugin data Penpot `pagebuilder/contract = nome@versione`. */
export const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Nomi di assi, parti e field: identificatori minuscoli, senza spazi né separatori. */
const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Attributi HTML globali (lista WHATWG) più `classname`: un field o un asse
 * `option` con uno di questi nomi ombreggia l'attributo sull'elemento
 * generato (`title` diventa tooltip, `id` rompe le label, `tabIndex` sposta
 * il focus). Confronto case-insensitive: `tabIndex` e `tabindex` sono lo
 * stesso attributo.
 */
const HTML_GLOBAL_ATTRIBUTES: ReadonlySet<string> = new Set([
  "accesskey",
  "autocapitalize",
  "autocorrect",
  "autofocus",
  "class",
  "classname",
  "contenteditable",
  "dir",
  "draggable",
  "enterkeyhint",
  "exportparts",
  "hidden",
  "id",
  "inert",
  "inputmode",
  "is",
  "itemid",
  "itemprop",
  "itemref",
  "itemscope",
  "itemtype",
  "lang",
  "nonce",
  "part",
  "popover",
  "slot",
  "spellcheck",
  "style",
  "tabindex",
  "title",
  "translate",
  "writingsuggestions",
]);

/**
 * Prop riservate di React e `role` (emesso dall'emitter sulla radice prima di
 * `{...props}`): un field o un asse `option` con questo nome collide. Gli
 * ultimi quattro trasformano l'elemento in un controlled component o ne
 * alterano l'idratazione in silenzio. Confronto case-insensitive; gli event
 * handler `on[A-Z]…` si rifiutano sul nome originale (`online` resta valido).
 */
const REACT_RESERVED_PROPS: ReadonlySet<string> = new Set([
  "role",
  "children",
  "key",
  "ref",
  "dangerouslysetinnerhtml",
  "value",
  "defaultvalue",
  "defaultchecked",
  "suppresshydrationwarning",
]);

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
    // Solo gli assi `option` diventano prop (`propsSchema`): `state` e
    // `behavior` non toccano l'elemento, ma un asse option riservato
    // ombreggia l'attributo/la prop sull'elemento generato, come un field.
    if (axis.type === "option") {
      if (REACT_RESERVED_PROPS.has(axis.name.toLowerCase()) || /^on[A-Z]/.test(axis.name)) {
        fail(
          `asse "${axis.name}" collide con una prop riservata di React o con il role emesso sulla radice (role, children, key, ref, dangerouslySetInnerHTML, value, on…): rinominalo`,
        );
      }
      if (HTML_GLOBAL_ATTRIBUTES.has(axis.name.toLowerCase())) {
        fail(
          `asse "${axis.name}" coincide con l'attributo HTML globale "${axis.name.toLowerCase()}" — ombreggerebbe l'attributo sull'elemento generato: rinominalo`,
        );
      }
    }
    for (const value of duplicates(axis.values)) fail(`asse "${axis.name}", valore "${value}" duplicato`);
    if (!axis.values.includes(axis.default)) {
      fail(`asse "${axis.name}", default "${axis.default}" non è tra i values (${axis.values.join(", ")})`);
    }
  }

  for (const part of def.parts) {
    if (!IDENTIFIER.test(part)) fail(`parte "${part}" ha un nome non valido (identificatore minuscolo)`);
  }
  for (const part of duplicates(def.parts)) fail(`parte "${part}" duplicata`);

  // Ruolo di parte (AD-11): ogni parte ne ha uno, del vocabolario chiuso, e
  // `partRoles` non nomina parti che il contratto non ha.
  const roles: Readonly<Record<string, unknown>> = def.partRoles ?? {};
  for (const part of def.parts) {
    if (!Object.hasOwn(roles, part)) {
      fail(`parte "${part}" senza ruolo in partRoles (ruoli: ${PART_ROLES.join(", ")})`);
    }
    const role = roles[part];
    if (!(PART_ROLES as readonly unknown[]).includes(role)) {
      fail(`parte "${part}", ruolo ${JSON.stringify(role)} non è nel vocabolario (${PART_ROLES.join(", ")})`);
    }
  }
  for (const part of Object.keys(roles)) {
    if (!def.parts.includes(part)) fail(`partRoles nomina la parte "${part}", che il contratto non ha`);
  }

  for (const [field, def_] of Object.entries(def.fields)) {
    if (!IDENTIFIER.test(field) || field === "__proto__") {
      fail(`field "${field}" ha un nome non valido (identificatore minuscolo)`);
    }
    if (REACT_RESERVED_PROPS.has(field.toLowerCase()) || /^on[A-Z]/.test(field)) {
      fail(
        `field "${field}" collide con una prop riservata di React o con il role emesso sulla radice (role, children, key, ref, dangerouslySetInnerHTML, on…): rinominalo`,
      );
    }
    if (HTML_GLOBAL_ATTRIBUTES.has(field.toLowerCase())) {
      fail(
        `field "${field}" coincide con l'attributo HTML globale "${field.toLowerCase()}" — ombreggerebbe l'attributo sull'elemento generato: rinominalo`,
      );
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
