import type { Axis, ComponentContract, FieldDef, SectionDefinition, SlotDef } from "@app/contracts";
import { z } from "zod";

import { kebabOf } from "./naming";
import type { Finding, LetturaLayer } from "./schemas";

/**
 * Regole delle sezioni (Story 2.27): stanno qui, non in `verify.ts`, così la
 * verifica dei componenti non cresce di casi. Una sezione deriva tutto dalla
 * sua definizione (`@app/contracts`) e dalla `Lettura`: niente assi, parti o
 * chiavi scritte a mano.
 */

export interface SectionContract {
  /** Il contratto effettivo (assi derivati + field content); assente se c'è un blocco o una domanda. */
  readonly contract?: ComponentContract;
  readonly findings: Finding[];
}

/** Le risposte alla domanda `asse`: una chiave per field (`asse.<field>` = `content`). */
export const ASSE_KEY = "asse";

/** Prefisso della chiave di risposta: una per field, come `contract` sta nel container. */
const ASSE_ANSWER_PREFIX = `${ASSE_KEY}.`;

const ASSE_ANSWERS = ["asse", "content"] as const;

interface EnumShape {
  readonly values: [string, ...string[]];
  readonly default: string;
}

/** I valori e il default di uno schema enum, passando dal JSON schema (supporta `default`/`optional`). */
function enumOf(schema: z.ZodType): EnumShape | undefined {
  let json: unknown;
  try {
    json = z.toJSONSchema(schema);
  } catch {
    return undefined;
  }
  if (typeof json !== "object" || json === null) return undefined;
  const shape = json as { readonly enum?: unknown; readonly default?: unknown };
  if (!Array.isArray(shape.enum) || shape.enum.length === 0) return undefined;
  const values = shape.enum.filter((value): value is string => typeof value === "string");
  if (values.length !== shape.enum.length) return undefined;
  const first = values[0]!;
  const chosen = typeof shape.default === "string" && values.includes(shape.default) ? shape.default : first;
  return { values: [first, ...values.slice(1)], default: chosen };
}

/**
 * Il contratto effettivo di una sezione: ogni field `structure` disegnato come
 * nome di variante e con uno schema enum diventa un asse (valori e default
 * dallo schema) e non resta anche field. Disegnato ma non enum è un blocco;
 * non disegnato è la domanda `asse` [`asse`, `content`], senza `Change`.
 *
 * `answers` sono i plugin data del container: `asse.<field>=content` chiude la
 * domanda e lascia il field tra i `content` (non guida il disegno). Una risposta
 * su un field non `structure`, su un field inesistente o con un valore fuori
 * dalle opzioni è un blocco; se il field è disegnato vince il disegno (asse) con
 * un avviso.
 */
export function sectionContract(
  section: SectionDefinition,
  cells: readonly { readonly variant: Readonly<Record<string, string>> }[],
  answers: Readonly<Record<string, string>> = {},
): SectionContract {
  const drawn = new Set<string>();
  for (const cell of cells) for (const name of Object.keys(cell.variant)) drawn.add(name);

  const findings: Finding[] = [];
  const axes: Axis[] = [];
  const fields: Record<string, FieldDef> = {};
  const where = (name: string): string => `sezione "${section.name}" › field "${name}"`;
  const answerOf = (name: string): string | undefined => answers[`${ASSE_ANSWER_PREFIX}${name}`];

  for (const [name, field] of Object.entries(section.fields)) {
    const answer = answerOf(name);
    if (field.kind !== "structure") {
      fields[name] = field;
      if (answer !== undefined) {
        findings.push({
          level: "blocco",
          where: where(name),
          message: `Il field "${name}" è "${field.kind}", non "structure": la risposta "${ASSE_ANSWER_PREFIX}${name}" non si applica. Togli il plugin data.`,
        });
      }
      continue;
    }
    if (drawn.has(name)) {
      if (answer !== undefined && !(ASSE_ANSWERS as readonly string[]).includes(answer)) {
        findings.push({
          level: "blocco",
          where: where(name),
          message: `La risposta "${ASSE_ANSWER_PREFIX}${name}"="${answer}" non è valida: le opzioni della domanda "asse" sono [${ASSE_ANSWERS.join(", ")}].`,
        });
        continue;
      }
      if (answer === "content") {
        findings.push({
          level: "avviso",
          where: where(name),
          message: `Il field structure "${name}" è disegnato come variante: vince il disegno e il field resta un asse, la risposta "content" si ignora. Togli il plugin data "${ASSE_ANSWER_PREFIX}${name}" o quella variante.`,
        });
      }
      const shape = enumOf(field.schema);
      if (shape === undefined) {
        findings.push({
          level: "blocco",
          where: where(name),
          message: `Il field structure "${name}" è disegnato come variante ma il suo schema non è un enum: un asse ha bisogno di valori chiusi. Trasforma lo schema in z.enum([...]) o togli il field dal disegno.`,
        });
        continue;
      }
      axes.push({ name, type: "option", values: shape.values, default: shape.default });
      continue;
    }
    if (answer === "content") {
      fields[name] = { ...field, kind: "content" };
      continue;
    }
    if (answer !== undefined && answer !== "asse") {
      findings.push({
        level: "blocco",
        where: where(name),
        message: `La risposta "${ASSE_ANSWER_PREFIX}${name}"="${answer}" non è valida: le opzioni della domanda "asse" sono [${ASSE_ANSWERS.join(", ")}].`,
      });
      fields[name] = field;
      continue;
    }
    findings.push({
      level: "domanda",
      where: where(name),
      key: ASSE_KEY,
      message: `Il field structure "${name}" non ha una variante disegnata: "asse" = disegna le celle con questo nome e diventa l'asse delle varianti, "content" = il field non guida il disegno e passa a content.`,
      options: [...ASSE_ANSWERS],
    });
    fields[name] = field;
  }

  // Una risposta che nomina un field inesistente resta un blocco: il plugin data
  // è di un'altra versione della sezione o è un refuso.
  const names = Object.keys(section.fields);
  for (const key of Object.keys(answers).sort()) {
    if (!key.startsWith(ASSE_ANSWER_PREFIX)) continue;
    const name = key.slice(ASSE_ANSWER_PREFIX.length);
    if (Object.hasOwn(section.fields, name)) continue;
    findings.push({
      level: "blocco",
      where: `sezione "${section.name}" › risposta "${key}"`,
      message: `Il plugin data "${key}"="${answers[key]}" nomina un field che la sezione "${section.name}" non ha: i field sono [${names.join(", ")}].`,
    });
  }

  if (findings.some((finding) => finding.level !== "avviso")) return { findings };
  return { contract: { name: section.name, version: section.version, axes, fields }, findings };
}

export interface SlotResolution {
  readonly slot?: SlotDef;
  readonly findings: Finding[];
}

/** Il nome kebab del contratto di un'istanza (`ProductCard` → `product-card`). */
function instanceNameOf(instance: { readonly component: string; readonly contract?: string }): string {
  return instance.contract === undefined ? kebabOf(instance.component) : instance.contract.split("@")[0]!;
}

/**
 * Lo slot di un layer. `pluginData.slot` vince; altrimenti il layer è uno slot
 * se tutti i figli sono istanze e uno solo slot le ammette. Più candidati sono
 * una domanda `slot` con gli id; un id dichiarato ma sconosciuto è un blocco.
 * I figli di uno slot sono esempi: chi chiama non li visita.
 */
export function slotOf(layer: LetturaLayer, section: SectionDefinition): SlotResolution {
  const where = `sezione "${section.name}" › layer "${layer.name}"`;
  const declared = layer.pluginData?.slot;
  if (declared !== undefined) {
    const slot = section.slots.find((candidate) => candidate.id === declared);
    if (slot === undefined) {
      return {
        findings: [
          {
            level: "blocco",
            where,
            message: `Il plugin data slot="${declared}" non è uno slot della sezione "${section.name}" (slot: [${section.slots.map((candidate) => candidate.id).join(", ")}]).`,
          },
        ],
      };
    }
    return { slot, findings: [] };
  }

  if (layer.instance !== undefined || layer.children.length === 0) return { findings: [] };
  if (!layer.children.every((child) => child.instance !== undefined)) return { findings: [] };

  const names = layer.children.map((child) => instanceNameOf(child.instance!));
  const candidates = section.slots.filter((candidate) => names.every((name) => candidate.allow.includes(name)));
  if (candidates.length === 0) return { findings: [] };
  if (candidates.length === 1) return { slot: candidates[0]!, findings: [] };

  return {
    findings: [
      {
        level: "domanda",
        where,
        key: "slot",
        message: `I figli del layer sono tutti istanze e più slot li ammettono ([${candidates.map((candidate) => candidate.id).join(", ")}]): scegli lo slot.`,
        options: candidates.map((candidate) => candidate.id) as [string, ...string[]],
      },
    ],
  };
}
