import { z } from "zod";

import type { ComponentContract, FieldDef } from "./contract";
import type { SectionDefinition } from "./section";

/**
 * Payload del fingerprint dei contratti (AD-6, guardia del bump in
 * `tests/schema-version.test.ts`). Sta in `src/` perché lo usano sia il test
 * sia `adopt:variant` (packages/scripts): un solo payload, così l'hash che il
 * comando registra non può divergere da quello che il test verifica.
 *
 * Qui NON si calcola l'hash: `node:crypto` non entra nei contratti, che girano
 * anche nel browser. Chi consuma fa `sha256(fingerprintPayload(...))`.
 */

/** Chiavi ordinate ricorsivamente: la serializzazione non dipende dall'ordine di dichiarazione. */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function fieldsShape(fields: Readonly<Record<string, FieldDef>>, owner: string) {
  return Object.fromEntries(
    Object.entries(fields).map(([name, field]) => {
      let schema: unknown;
      try {
        schema = z.toJSONSchema(field.schema);
      } catch (cause) {
        throw new Error(
          `Fingerprint: il field "${name}" di "${owner}" ha uno schema non rappresentabile come JSON schema (${(cause as Error).message}) — usa schemi dati (string, number, boolean, enum, object, array).`,
        );
      }
      return [name, { kind: field.kind, schema }];
    }),
  );
}

/**
 * La stringa JSON canonica su cui si calcola lo sha256 del fingerprint.
 *
 * Copre SOLO il contratto del page builder (AD-11 v2, Story 2.12): nome,
 * versione, assi `option`, field e — per le sezioni — slot. L'estensione
 * deprecata della v1 (`parts`, `partRoles`, assi `state`/`behavior`) è
 * fuori dal fingerprint: cambiarla o cancellarla (Story 2.16) non muove
 * `SCHEMA_VERSION`. Come si legge da Penpot e come si rende non lega le
 * pagine salvate.
 */
export function fingerprintPayload(
  components: readonly ComponentContract[],
  sections: readonly SectionDefinition[],
): string {
  const payload = {
    components: components.map((contract) => ({
      name: contract.name,
      version: contract.version,
      axes: contract.axes
        .filter((axis) => axis.type === "option")
        .map((axis) => ({
          name: axis.name,
          values: axis.values,
          default: axis.default,
        })),
      fields: fieldsShape(contract.fields, contract.name),
    })),
    sections: sections.map((section) => ({
      name: section.name,
      version: section.version,
      fields: fieldsShape(section.fields, section.name),
      slots: section.slots.map((slot) => ({
        id: slot.id,
        allow: slot.allow,
        ...(slot.max === undefined ? {} : { max: slot.max }),
      })),
    })),
  };
  return JSON.stringify(canonical(payload));
}
