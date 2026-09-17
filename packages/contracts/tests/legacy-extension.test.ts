import { describe, expect, it } from "vitest";
import { z } from "zod";

import { accordionItem } from "../src/components/accordion-item";
import { alert } from "../src/components/alert";
import { badge } from "../src/components/badge";
import { input } from "../src/components/input";
import { productCard } from "../src/components/product-card";
import { defineContract, hasLegacyExtension, propsSchema } from "../src/contract";
import { fingerprintPayload } from "../src/fingerprint";

/**
 * Estensione deprecata della v1 (Story 2.12, CAP-1 in due tempi — correct-course
 * 2026-09-17): `parts`, `partRoles` e gli assi `state`/`behavior` restano
 * accettati da `defineContract` ma FUORI dal fingerprint, letti solo dalla
 * pipeline v1 tramite `hasLegacyExtension`.
 *
 * DA CANCELLARE NELLA STORY 2.16 insieme ai campi `parts`/`partRoles`, al tipo
 * `LegacyComponentContract`, a `hasLegacyExtension` e a `PART_ROLES` di questo
 * package: la loro cancellazione NON è un bump di `SCHEMA_VERSION`, perché
 * questo file prova che non entrano nel fingerprint. Se questo test è ancora
 * qui dopo la 2.16, la rimozione della v1 non è completa.
 */

const reduced = {
  name: "demo-chip",
  version: 1,
  axes: [{ name: "tone", type: "option", values: ["neutral", "loud"], default: "neutral" }],
  fields: { label: { schema: z.string(), kind: "content" } },
} as const;

const legacy = {
  ...reduced,
  axes: [
    ...reduced.axes,
    { name: "state", type: "state", values: ["default", "focus"], default: "default" },
    { name: "open", type: "behavior", values: ["closed", "open"], default: "closed" },
  ],
  parts: ["root", "label"],
  partRoles: { root: "surface", label: "text" },
} as const;

describe("estensione v1 deprecata (da cancellare nella Story 2.16)", () => {
  it("verde: un contratto ridotto (senza parts/partRoles) è accettato", () => {
    expect(() => defineContract(reduced)).not.toThrow();
    expect(hasLegacyExtension(defineContract(reduced))).toBe(false);
  });

  it("verde: un contratto con l'estensione v1 è ancora accettato e riconosciuto", () => {
    expect(() => defineContract(legacy)).not.toThrow();
    expect(hasLegacyExtension(defineContract(legacy))).toBe(true);
  });

  it.each([
    ["parts senza partRoles", { ...reduced, parts: ["root"] }],
    ["partRoles senza parts", { ...reduced, partRoles: { root: "surface" } }],
  ])("rosso: %s → estensione incoerente, nominando il contratto", (_label, def) => {
    expect(() => defineContract(def as never)).toThrow(/demo-chip.*estensione v1 incoerente.*"parts" e "partRoles" vanno insieme/);
  });

  it("rosso: un contratto ridotto con un asse state o behavior (gli assi di rendering stanno nell'estrazione)", () => {
    for (const type of ["state", "behavior"] as const) {
      expect(() => defineContract({ ...reduced, axes: [...reduced.axes, { name: "extra", type, values: ["a", "b"], default: "a" }] })).toThrow(
        new RegExp(`demo-chip.*asse "extra" di tipo "${type}".*solo assi "option"`),
      );
    }
    // Con l'estensione v1 restano tollerati fino alla Story 2.16.
    expect(() => defineContract(legacy)).not.toThrow();
  });

  it("l'estensione è FUORI dal fingerprint: payload identico con o senza parts, partRoles e assi state/behavior", () => {
    const withExtension = fingerprintPayload([defineContract(legacy)], []);
    const without = fingerprintPayload([defineContract(reduced)], []);
    expect(withExtension).toBe(without);
    expect(without).not.toContain("parts");
    expect(without).not.toContain("state");
    expect(without).not.toContain("behavior");
    // Gli assi option restano, senza il campo `type` (nel page builder esiste solo option).
    expect(without).toContain(`"axes":[{"default":"neutral","name":"tone","values":["neutral","loud"]}]`);
  });

  it("gli assi state/behavior deprecati non producono props", () => {
    expect(Object.keys(propsSchema(defineContract(legacy)).shape)).toEqual(["tone", "label"]);
  });

  it("i quattro contratti v1 portano l'estensione, product-card no", () => {
    for (const contract of [badge, input, accordionItem, alert]) {
      expect(hasLegacyExtension(contract), contract.name).toBe(true);
    }
    expect(hasLegacyExtension(productCard)).toBe(false);
  });
});
