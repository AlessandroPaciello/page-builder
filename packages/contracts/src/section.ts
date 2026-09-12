import { z } from "zod";

import { type ComponentContract, type FieldDef, KEBAB_CASE, propsSchema } from "./contract";
import { COMPONENT_CONTRACTS } from "./registry";

/**
 * Definizione di sezione: un albero di dati che compone contratti di
 * componente, non un contratto né una ricetta (AD-11 "Composizione ≠ ricetta").
 * Sezioni rigide per default: struttura bloccata, aperte solo negli slot
 * (`allow` + `max`). `max` è autoritativo nel core; qui c'è solo la forma dei
 * dati e la validazione statica della definizione. Forma minima di partenza,
 * che la Story 3.4 estenderà.
 *
 * Scelta del nodo radice (approccio "a"): `root` è il nodo della sezione stessa,
 * con `component` uguale al `name` della sezione. Le sue `props` sono validate
 * contro i `fields` della sezione, non contro un contratto: così non serve un
 * contratto contenitore finto nel registry (Box/Flex arrivano con la 3.2).
 * Il nome di una sezione non può quindi coincidere con quello di un contratto.
 */

export interface SectionNode {
  /** Stabile, non posizionale. */
  id: string;
  /** Nome di un contratto di componente; nel nodo radice, il nome della sezione. */
  component: string;
  props: Record<string, unknown>;
  /** Id di uno `SlotDef`: qui il nodo accetta figli. */
  slot?: string;
  /** Figli di default. */
  children?: SectionNode[];
}

export interface SlotDef {
  id: string;
  /** Nomi di contratto ammessi. */
  allow: [string, ...string[]];
  /** Intero ≥1; assente = illimitato. */
  max?: number;
}

export interface SectionDefinition {
  name: string;
  version: number;
  /** Props proprie della sezione (es. `type` di Accordion Root). */
  fields: Record<string, FieldDef>;
  root: SectionNode;
  slots: SlotDef[];
}

const FieldDefSchema = z.strictObject({
  schema: z.custom<z.ZodType>((value) => value instanceof z.ZodType, { error: "deve essere uno schema Zod" }),
  kind: z.enum(["structure", "content"]),
});

const SectionNodeSchema: z.ZodType<SectionNode> = z.lazy(() =>
  z.strictObject({
    id: z.string().min(1),
    component: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
    slot: z.string().min(1).optional(),
    children: z.array(SectionNodeSchema).optional(),
  }),
);

const SlotDefSchema = z.strictObject({
  id: z.string().min(1),
  allow: z.tuple([z.string().min(1)], z.string().min(1)),
  max: z.number().int().min(1).optional(),
});

export const SectionDefinitionSchema = z.strictObject({
  name: z.string().regex(KEBAB_CASE, { error: "deve essere kebab-case" }),
  version: z.number().int().min(1),
  fields: z.record(z.string(), FieldDefSchema),
  root: SectionNodeSchema,
  slots: z.array(SlotDefSchema),
});

export type SectionValidation = { valid: true } | { valid: false; errors: string[] };

/** Limite di profondità dell'albero: la validazione non lancia mai, nemmeno su dati patologici. */
const MAX_DEPTH = 100;

function issuesOf(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "(radice)"}: ${issue.message}`).join("; ");
}

/**
 * Validazione statica, pura: nessun `throw` per errori di dati. Il fail-loud è
 * l'elenco degli errori, ognuno dei quali nomina sezione, nodo o slot.
 */
export function validateSectionDefinition(
  def: unknown,
  contracts: Readonly<Record<string, ComponentContract>> = COMPONENT_CONTRACTS,
): SectionValidation {
  const parsed = SectionDefinitionSchema.safeParse(def);
  if (!parsed.success) {
    const name = typeof (def as { name?: unknown })?.name === "string" ? (def as { name: string }).name : "?";
    return { valid: false, errors: parsed.error.issues.map((i) => `Sezione "${name}": ${i.path.join(".") || "(radice)"}: ${i.message}`) };
  }

  const section = parsed.data;
  const errors: string[] = [];
  const err = (detail: string) => errors.push(`Sezione "${section.name}": ${detail}`);

  if (Object.hasOwn(contracts, section.name)) err(`il nome "${section.name}" collide con il contratto di componente omonimo`);

  const slots = new Map<string, SlotDef>();
  for (const slot of section.slots) {
    if (slots.has(slot.id)) err(`slot "${slot.id}" duplicato`);
    slots.set(slot.id, slot);
    for (const allowed of slot.allow) {
      if (!Object.hasOwn(contracts, allowed)) err(`slot "${slot.id}": allow nomina "${allowed}", contratto inesistente`);
    }
  }

  const sectionProps = z.looseObject(Object.fromEntries(Object.entries(section.fields).map(([k, f]) => [k, f.schema])));
  const seenIds = new Set<string>();

  const visit = (node: SectionNode, isRoot: boolean, depth = 0) => {
    if (depth > MAX_DEPTH) {
      err(`albero più profondo di ${MAX_DEPTH} livelli (incontrato il nodo "${node.id}")`);
      return;
    }
    if (seenIds.has(node.id)) err(`id di nodo "${node.id}" duplicato`);
    seenIds.add(node.id);

    if (isRoot) {
      if (node.component !== section.name) {
        err(`nodo "${node.id}": il nodo sezione deve avere component "${section.name}", non "${node.component}"`);
      }
      const props = sectionProps.safeParse(node.props);
      if (!props.success) err(`nodo "${node.id}": props non valide (${issuesOf(props.error)})`);
    } else {
      const contract = Object.hasOwn(contracts, node.component) ? contracts[node.component] : undefined;
      if (!contract) {
        err(`nodo "${node.id}": componente "${node.component}" non esiste nel registry dei contratti`);
      } else {
        const props = propsSchema(contract).safeParse(node.props);
        if (!props.success) err(`nodo "${node.id}": props non valide per "${node.component}" (${issuesOf(props.error)})`);
      }
    }

    const children = node.children ?? [];
    if (node.slot === undefined) {
      if (children.length > 0) err(`nodo "${node.id}": ha figli di default ma è senza slot`);
    } else {
      const slot = slots.get(node.slot);
      if (!slot) {
        err(`nodo "${node.id}": slot "${node.slot}" non dichiarato in slots`);
      } else {
        for (const child of children) {
          if (!slot.allow.includes(child.component)) {
            err(`nodo "${child.id}": componente "${child.component}" non è in allow dello slot "${slot.id}" (${slot.allow.join(", ")})`);
          }
        }
        if (slot.max !== undefined && children.length > slot.max) {
          err(`slot "${slot.id}": ${children.length} figli di default, oltre max ${slot.max}`);
        }
      }
    }

    for (const child of children) visit(child, false, depth + 1);
  };

  visit(section.root, true);

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
