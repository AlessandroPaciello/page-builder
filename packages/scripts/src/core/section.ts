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
 */
export function sectionContract(
  section: SectionDefinition,
  cells: readonly { readonly variant: Readonly<Record<string, string>> }[],
): SectionContract {
  const drawn = new Set<string>();
  for (const cell of cells) for (const name of Object.keys(cell.variant)) drawn.add(name);

  const findings: Finding[] = [];
  const axes: Axis[] = [];
  const fields: Record<string, FieldDef> = {};

  for (const [name, field] of Object.entries(section.fields)) {
    if (field.kind !== "structure") {
      fields[name] = field;
      continue;
    }
    if (drawn.has(name)) {
      const shape = enumOf(field.schema);
      if (shape === undefined) {
        findings.push({
          level: "blocco",
          where: `sezione "${section.name}" › field "${name}"`,
          message: `Il field structure "${name}" è disegnato come variante ma il suo schema non è un enum: un asse ha bisogno di valori chiusi. Trasforma lo schema in z.enum([...]) o togli il field dal disegno.`,
        });
        continue;
      }
      axes.push({ name, type: "option", values: shape.values, default: shape.default });
      continue;
    }
    findings.push({
      level: "domanda",
      where: `sezione "${section.name}" › field "${name}"`,
      key: "asse",
      message: `Il field structure "${name}" non ha una variante disegnata: "asse" = disegna le celle con questo nome e diventa l'asse delle varianti, "content" = il field non guida il disegno e passa a content.`,
      options: ["asse", "content"],
    });
    fields[name] = field;
  }

  if (findings.length > 0) return { findings };
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
