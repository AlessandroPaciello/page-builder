import { contractId, type ComponentContract, type FieldDef } from "@app/contracts";
import { z } from "zod";

import { pascalCase } from "./shared/naming";
import { PART_ROLES, type PartRole } from "./shared/style-properties";
import { ScriptError } from "./errors";

/**
 * Contratto di estrazione (CAP-2, AD-11 v2, Story 2.12): per ogni componente
 * dichiara come si legge da Penpot e come si rende. IMPORTA il contratto del
 * page builder e mai il contrario: il page builder non conosce Penpot.
 * Vocabolario: `specs/spec-refactor-packages-scripts/extraction-contract.md`.
 *
 * Contraddire il contratto del page builder è un errore A MODULE LOAD
 * (`ScriptError` di categoria `contract`, che nomina parte e campo), prima
 * di qualsiasi comando: field inesistente o di tipo sbagliato, `when` su un
 * asse non `option`, albero senza radice o con cicli, parte senza ruolo,
 * plugin data incoerente col container.
 */

/** Domini del design system in `packages/ui/src/domains/<dominio>/`: quelli della v1 più `commerce` (card). */
export const RENDER_DOMAINS = ["data-display", "inputs", "feedback", "layout", "navigation", "overlays", "commerce"] as const;

export type RenderDomain = (typeof RENDER_DOMAINS)[number];

/**
 * Assi di RENDERING, senza prop: `state` → prefissi del browser (`hover:`,
 * `focus-visible:`, `aria-invalid:`, `disabled:`); `behavior` →
 * `data-[state=…]:` dell'headless. Penpot li disegna come celle.
 */
export type RenderAxisType = "state" | "behavior";

export interface RenderAxis {
  readonly type: RenderAxisType;
  readonly values: readonly [string, ...string[]];
  readonly default: string;
}

/** Il primitivo headless per parte (Base UI): sostituisce la base shadcn. */
export interface Headless {
  readonly package: string;
  /** parte → nome del primitivo, es. `{ root: "Item", trigger: "Trigger" }`. */
  readonly parts: Readonly<Record<string, string>>;
}

export interface PartDefinition {
  /** Decide le proprietà ammesse (registro). `image`: nessun `fill`. */
  readonly role: PartRole;
  /** Elemento HTML emesso. `root` con `attribute.href` → `a`. */
  readonly element: string;
  /** Parte contenitrice; tutte tranne `root`. Albero con radice `root`, senza cicli. */
  readonly parent?: string;
  /** Nome del layer Penpot, alias inclusi. Default: nome della parte in PascalCase. */
  readonly layer?: string;
  /** Field del page builder reso come testo della parte (stringa); `"$item"` solo dentro `repeat`. */
  readonly content?: string;
  /** `{ attributoHtml: field }`; `src`/`href` vogliono un field url, gli altri testo. */
  readonly attribute?: Readonly<Record<string, string>>;
  /** `{ asse: [valori] }`: la parte esiste solo in quelle celle. Solo assi `option` del page builder. */
  readonly when?: Readonly<Record<string, readonly [string, ...string[]]>>;
  /** Field array: la parte si ripete per elemento (primo layer come modello). */
  readonly repeat?: string;
}

/** Una parte risolta: `layer` sempre presente. */
export interface Part extends PartDefinition {
  readonly layer: string;
}

/**
 * `role` ARIA della radice: uguale per tutte le varianti (`string | null`)
 * oppure per valore di UN asse `option` (`{ [valore]: string | null }`, con
 * esattamente i valori di quell'asse).
 */
export type A11yRole = string | null | Readonly<Record<string, string | null>>;

export interface A11y {
  readonly role: A11yRole;
  readonly focusVisible: boolean;
  readonly ariaAttributes?: readonly string[];
}

export interface ExtractionDefinition {
  readonly penpot: { readonly container: string };
  readonly render: { readonly domain: RenderDomain; readonly headless: Headless | null };
  readonly axes?: Readonly<Record<string, RenderAxis>>;
  readonly parts: Readonly<Record<string, PartDefinition>>;
  readonly a11y: A11y;
}

export interface ExtractionContract<C extends ComponentContract = ComponentContract> {
  readonly contract: C;
  /** `nome@versione`: il plugin data atteso sul container, derivato dal contratto. */
  readonly pluginData: string;
  readonly penpot: { readonly container: string };
  readonly render: { readonly domain: RenderDomain; readonly headless: Headless | null };
  readonly axes: Readonly<Record<string, RenderAxis>>;
  readonly parts: Readonly<Record<string, Part>>;
  readonly a11y: A11y;
}

export type FieldType = "text" | "url" | "array" | "other";

/** Il tipo di un field del page builder come lo vede l'estrazione, dal JSON schema del suo Zod. */
export function fieldType(field: FieldDef): FieldType {
  let schema: Record<string, unknown>;
  try {
    schema = z.toJSONSchema(field.schema) as Record<string, unknown>;
  } catch {
    return "other";
  }
  if (schema.type === "string") return schema.format === "uri" ? "url" : "text";
  if (schema.type === "array") return "array";
  return "other";
}

/** `true` se il field è un array di stringhe (l'unico che `repeat` + `content: "$item"` sa rendere). */
function isArrayOfText(field: FieldDef): boolean {
  try {
    const schema = z.toJSONSchema(field.schema) as { type?: unknown; items?: { type?: unknown } };
    return schema.type === "array" && schema.items?.type === "string";
  } catch {
    return false;
  }
}

const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;
const HTML_TAG = /^[a-z][a-z0-9-]*$/;
/** Elementi HTML void: non possono avere figli, quindi nessuna parte può averli come `parent`. */
const VOID_ELEMENTS: ReadonlySet<string> = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
/** Attributi il cui field deve essere un url. */
const URL_ATTRIBUTES: ReadonlySet<string> = new Set(["src", "href"]);

export const ITEM_CONTENT = "$item";

/**
 * Restituisce il contratto di estrazione risolto (layer di default applicati)
 * e fallisce a module load se contraddice il contratto del page builder o è
 * incoerente in sé. I controlli seguono `extraction-contract.md` §Controlli.
 */
export function defineExtraction<const C extends ComponentContract>(contract: C, def: ExtractionDefinition): ExtractionContract<C> {
  const component = pascalCase(contract.name);
  // Tipo esplicito: solo così una chiamata a `fail` restringe il flusso (never).
  const fail: (detail: string, part?: string) => never = (detail, part) => {
    throw new ScriptError({ kind: "contract", component, ...(part === undefined ? {} : { part }), detail });
  };
  const fields: Readonly<Record<string, FieldDef>> = contract.fields;
  const fieldOf = (name: string): FieldDef | undefined => (Object.hasOwn(fields, name) ? fields[name] : undefined);
  const optionAxes = contract.axes.filter((axis) => axis.type === "option");
  const renderAxes: Readonly<Record<string, RenderAxis>> = def.axes ?? {};

  // 5. Plugin data: nome e versione del contratto sono il plugin data del
  // container; il nome del container è il controllo incrociato.
  const pluginData = contractId(contract);
  const expectedContainer = pascalCase(contract.name);
  if (def.penpot.container !== expectedContainer) {
    fail(
      `plugin data incoerente: il container "${def.penpot.container}" non corrisponde al contratto "${contract.name}" — atteso il container "${expectedContainer}" (plugin data derivato "${pluginData}").`,
    );
  }

  if (!(RENDER_DOMAINS as readonly string[]).includes(def.render.domain)) {
    fail(`dominio "${def.render.domain}" non è nel vocabolario (${RENDER_DOMAINS.join(", ")}).`);
  }

  // Assi di rendering: solo state/behavior, nomi che non collidono col page builder.
  for (const [name, axis] of Object.entries(renderAxes)) {
    if (!IDENTIFIER.test(name)) fail(`asse di rendering "${name}" ha un nome non valido (identificatore minuscolo).`);
    if (axis.type !== "state" && axis.type !== "behavior") {
      fail(`asse di rendering "${name}" ha tipo "${String(axis.type)}": nel contratto di estrazione esistono solo "state" e "behavior" (gli assi "option" stanno nel page builder).`);
    }
    if (contract.axes.some((candidate) => candidate.name === name)) {
      fail(`asse di rendering "${name}" collide con l'asse "${name}" del contratto del page builder.`);
    }
    if (fieldOf(name) !== undefined) fail(`asse di rendering "${name}" collide con il field "${name}" del page builder.`);
    if (new Set(axis.values).size !== axis.values.length) fail(`asse di rendering "${name}" ha valori duplicati.`);
    if (!axis.values.includes(axis.default)) {
      fail(`asse di rendering "${name}": default "${axis.default}" non è tra i values (${axis.values.join(", ")}).`);
    }
  }

  // 3 + 4. Parti: ruolo, elemento, albero con radice `root` e senza cicli.
  const partNames = Object.keys(def.parts);
  if (partNames.length === 0) fail("nessuna parte dichiarata: serve almeno la radice \"root\".");
  if (!Object.hasOwn(def.parts, "root")) fail(`albero senza radice: manca la parte "root" (parti: [${partNames.join(", ")}]).`);
  const layersSeen = new Map<string, string>();
  const resolved: Record<string, Part> = {};
  for (const [name, part] of Object.entries(def.parts)) {
    if (!IDENTIFIER.test(name)) fail(`parte "${name}" ha un nome non valido (identificatore minuscolo).`, name);
    if (!(PART_ROLES as readonly unknown[]).includes(part.role)) {
      fail(
        part.role === undefined
          ? `parte senza ruolo: ogni parte ne dichiara uno del vocabolario (${PART_ROLES.join(", ")}).`
          : `ruolo ${JSON.stringify(part.role)} non è nel vocabolario (${PART_ROLES.join(", ")}).`,
        name,
      );
    }
    if (typeof part.element !== "string" || !HTML_TAG.test(part.element)) {
      fail(`elemento ${JSON.stringify(part.element)} non è un tag HTML valido (minuscolo, es. "span").`, name);
    }
    if (part.layer !== undefined && part.layer.length === 0) fail(`"layer" vuoto: togli il campo per usare il nome di default, o scrivi il nome del layer Penpot.`, name);
    if (name === "root") {
      if (part.parent !== undefined) fail(`la radice "root" non ha un genitore (dichiarato "${part.parent}").`, name);
      // `when`/`repeat` sulla radice farebbero sparire o duplicare il componente intero.
      if (part.when !== undefined) fail(`"when" sulla radice: il componente esiste in tutte le celle — la presenza condizionale vale sulle parti interne.`, name);
      if (part.repeat !== undefined) fail(`"repeat" sulla radice: il componente non si ripete su un field — la ripetizione vale sulle parti interne.`, name);
    } else {
      if (part.parent === undefined) fail(`parte senza "parent": tutte le parti tranne "root" dichiarano la parte contenitrice.`, name);
      if (part.parent === name) fail(`la parte è genitore di sé stessa: ciclo.`, name);
      if (!Object.hasOwn(def.parts, part.parent)) {
        fail(`"parent" nomina la parte "${part.parent}", che il contratto di estrazione non ha (parti: [${partNames.join(", ")}]).`, name);
      }
      const parentElement = def.parts[part.parent]!.element;
      if (VOID_ELEMENTS.has(parentElement)) {
        fail(`"parent" è la parte "${part.parent}", il cui elemento "${parentElement}" è void e non può avere figli: interponi una parte contenitrice.`, name);
      }
    }
    const layer = part.layer ?? pascalCase(name);
    const owner = layersSeen.get(layer);
    if (owner !== undefined) fail(`il layer "${layer}" è già della parte "${owner}": due parti non possono leggere lo stesso layer Penpot.`, name);
    layersSeen.set(layer, name);
    resolved[name] = { ...part, layer };
  }
  // Raggiungibilità dalla radice: una parte non raggiunta sta in un ciclo o sotto un ciclo.
  const children = new Map<string, string[]>();
  for (const [name, part] of Object.entries(def.parts)) {
    if (part.parent !== undefined) children.set(part.parent, [...(children.get(part.parent) ?? []), name]);
  }
  const reached = new Set<string>();
  const stack = ["root"];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (reached.has(current)) continue;
    reached.add(current);
    stack.push(...(children.get(current) ?? []));
  }
  const unreachable = partNames.filter((name) => !reached.has(name));
  if (unreachable.length > 0) {
    fail(`albero con cicli: le parti [${unreachable.join(", ")}] non discendono da "root" (i loro "parent" si chiudono su sé stessi).`, unreachable[0]!);
  }
  const ancestors = (name: string): string[] => {
    const out: string[] = [];
    let current = def.parts[name]?.parent;
    while (current !== undefined) {
      out.push(current);
      current = def.parts[current]?.parent;
    }
    return out;
  };

  // 1. content / attribute / repeat: field esistente col tipo giusto.
  for (const [name, part] of Object.entries(def.parts)) {
    if (part.repeat !== undefined) {
      const repeatedAncestor = ancestors(name).find((ancestor) => def.parts[ancestor]?.repeat !== undefined);
      if (repeatedAncestor !== undefined) {
        fail(`"repeat" annidato sotto la parte ripetuta "${repeatedAncestor}": una sola ripetizione per ramo.`, name);
      }
      const field = fieldOf(part.repeat);
      if (field === undefined) fail(`"repeat" nomina il field "${part.repeat}", che il contratto "${contract.name}" non ha (field: [${Object.keys(fields).join(", ")}]).`, name);
      if (!isArrayOfText(field)) {
        fail(`"repeat" vuole un field array di stringhe: il field "${part.repeat}" è di tipo "${fieldType(field)}".`, name);
      }
    }
    if (part.content !== undefined) {
      if (part.content === ITEM_CONTENT) {
        const repeated = part.repeat !== undefined || ancestors(name).some((ancestor) => def.parts[ancestor]?.repeat !== undefined);
        if (!repeated) fail(`"content: \\"$item\\"" è ammesso solo dentro una parte con "repeat" (o sotto di essa).`, name);
      } else {
        const field = fieldOf(part.content);
        if (field === undefined) fail(`"content" nomina il field "${part.content}", che il contratto "${contract.name}" non ha (field: [${Object.keys(fields).join(", ")}]).`, name);
        const type = fieldType(field);
        if (type !== "text" && type !== "url") fail(`"content" vuole un field di testo: il field "${part.content}" è di tipo "${type}".`, name);
      }
      if (part.role === "image") fail(`una parte "image" non ha "content": il contenuto arriva da "attribute.src".`, name);
      // Il testo si stila con la tipografia del registro, che il registro ammette solo al ruolo `text`.
      if (part.role !== "text") fail(`"content" su una parte di ruolo "${part.role}": il testo appartiene a una parte "text" (il registro ammette la tipografia solo a quel ruolo).`, name);
    }
    for (const [attribute, fieldName] of Object.entries(part.attribute ?? {})) {
      if (!/^[a-z][a-z0-9-]*$/.test(attribute)) {
        fail(`"attribute.${attribute}" non è un nome di attributo HTML valido (minuscolo, es. "href", "src", "alt").`, name);
      }
      const field = fieldOf(fieldName);
      if (field === undefined) fail(`"attribute.${attribute}" nomina il field "${fieldName}", che il contratto "${contract.name}" non ha (field: [${Object.keys(fields).join(", ")}]).`, name);
      const type = fieldType(field);
      if (URL_ATTRIBUTES.has(attribute)) {
        if (type !== "url") fail(`"attribute.${attribute}" vuole un field url: il field "${fieldName}" è di tipo "${type}" (usa z.url()).`, name);
      } else if (type !== "text") {
        fail(`"attribute.${attribute}" vuole un field di testo: il field "${fieldName}" è di tipo "${type}".`, name);
      }
    }
    if (part.role === "image" && part.attribute?.src === undefined) {
      fail(`una parte "image" senza "attribute.src": il contenuto arriva da "src" (field url del page builder).`, name);
    }
    if (name === "root" && part.attribute?.href !== undefined && part.element !== "a") {
      fail(`la radice con "attribute.href" è un link: l'elemento deve essere "a", non "${part.element}".`, name);
    }
    // 2. when: solo assi option del page builder, con valori esistenti.
    for (const [axisName, values] of Object.entries(part.when ?? {})) {
      if (!Array.isArray(values)) fail(`"when.${axisName}" deve elencare valori (array), non ${JSON.stringify(values)}.`, name);
      const axis = contract.axes.find((candidate) => candidate.name === axisName);
      if (axis === undefined) {
        const render = Object.hasOwn(renderAxes, axisName) ? ` — "${axisName}" è un asse di rendering (${renderAxes[axisName]!.type}), non decide la presenza di una parte` : "";
        fail(`"when" nomina l'asse "${axisName}", che il contratto "${contract.name}" non ha tra gli assi option (${optionAxes.map((a) => a.name).join(", ") || "nessuno"})${render}.`, name);
      }
      if (axis.type !== "option") fail(`"when" sull'asse "${axisName}" di tipo "${axis.type}": solo gli assi option del page builder.`, name);
      if (values.length === 0) fail(`"when.${axisName}" è vuoto: elenca i valori in cui la parte esiste.`, name);
      for (const value of values) {
        if (!axis.values.includes(value)) fail(`"when.${axisName}" nomina il valore "${value}", che l'asse non ha (valori: ${axis.values.join(", ")}).`, name);
      }
      if (new Set(values).size !== values.length) fail(`"when.${axisName}" ha valori duplicati.`, name);
    }
  }

  // Headless: le parti nominate esistono.
  if (def.render.headless !== null) {
    if (typeof def.render.headless.package !== "string" || def.render.headless.package.length === 0) fail(`headless senza "package".`);
    const headlessParts: unknown = (def.render.headless as { parts?: unknown }).parts;
    if (headlessParts === null || typeof headlessParts !== "object" || Array.isArray(headlessParts)) {
      fail(`headless con "parts" mancanti: dichiara parte → primitivo, es. { root: "Item" }.`);
    }
    for (const name of Object.keys(headlessParts as Record<string, unknown>)) {
      if (!Object.hasOwn(def.parts, name)) fail(`headless nomina la parte "${name}", che il contratto di estrazione non ha.`, name);
    }
  }

  // a11y.role per variante: esattamente i valori di un asse option.
  const role = def.a11y.role;
  if (role === undefined) fail(`a11y.role mancante: null, una stringa o un record per variante.`);
  if (role === "") fail(`a11y.role vuoto: null per nessun ruolo o un ruolo ARIA valido.`);
  if (role !== null && typeof role === "object") {
    const keys = Object.keys(role).sort();
    const matching = optionAxes.filter((axis) => [...axis.values].sort().join("|") === keys.join("|"));
    if (matching.length !== 1) {
      const axes = optionAxes.map((axis) => `${axis.name} [${axis.values.join(", ")}]`).join("; ") || "nessuno";
      fail(`a11y.role per variante ha le chiavi [${keys.join(", ")}], che non coincidono con i valori di un asse option del page builder (${axes}).`);
    }
  }
  if (typeof def.a11y.focusVisible !== "boolean") fail(`a11y.focusVisible deve essere true o false.`);

  return Object.freeze({
    contract,
    pluginData,
    penpot: def.penpot,
    render: def.render,
    axes: renderAxes,
    parts: resolved,
    a11y: def.a11y,
  });
}
