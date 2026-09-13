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

function fieldsShape(fields: Readonly<Record<string, FieldDef>>) {
  return Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, { kind: field.kind, schema: z.toJSONSchema(field.schema) }]),
  );
}

/** La stringa JSON canonica su cui si calcola lo sha256 del fingerprint. */
export function fingerprintPayload(
  components: readonly ComponentContract[],
  sections: readonly SectionDefinition[],
): string {
  const payload = {
    components: components.map((contract) => ({
      name: contract.name,
      version: contract.version,
      axes: contract.axes.map((axis) => ({
        name: axis.name,
        type: axis.type,
        values: axis.values,
        default: axis.default,
      })),
      parts: contract.parts,
      fields: fieldsShape(contract.fields),
    })),
    sections: sections.map((section) => ({
      name: section.name,
      version: section.version,
      fields: fieldsShape(section.fields),
    })),
  };
  return JSON.stringify(canonical(payload));
}
