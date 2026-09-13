import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fingerprintPayload } from "../src/fingerprint";
import { COMPONENT_CONTRACTS, SECTION_DEFINITIONS } from "../src/registry";
import { SCHEMA_VERSION } from "../src/schema-version";

/**
 * Guardia meccanica del bump (AD-6: "un cambio di contratto è un bump esplicito").
 *
 * `contracts.fingerprint.json` è APPEND-ONLY: una voce per ogni SCHEMA_VERSION
 * mai rilasciata. Per cambiare un contratto o una sezione: incrementa
 * SCHEMA_VERSION e AGGIUNGI la voce della nuova versione con l'hash calcolato.
 * Riscrivere l'hash di una versione esistente per far tornare verde il test è
 * esattamente ciò che la review deve rifiutare: vorrebbe dire cambiare il
 * vocabolario sotto pagine già salvate con quella versione.
 *
 * Il payload sta in `src/fingerprint.ts` (lo usa anche `adopt:variant`); l'hash
 * si calcola qui e non in `src/` perché `node:crypto` non deve entrare nei
 * contratti, che girano anche nel browser.
 */

function fingerprint(): string {
  const payload = fingerprintPayload(Object.values(COMPONENT_CONTRACTS), Object.values(SECTION_DEFINITIONS));
  return createHash("sha256").update(payload).digest("hex");
}

const recorded = JSON.parse(
  readFileSync(new URL("./contracts.fingerprint.json", import.meta.url), "utf8"),
) as Record<string, string>;

describe("SCHEMA_VERSION", () => {
  it("è un intero ≥1", () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("le voci del fingerprint sono versioni intere, fino a quella corrente", () => {
    for (const key of Object.keys(recorded)) {
      expect(key).toMatch(/^[1-9]\d*$/);
      expect(Number(key)).toBeLessThanOrEqual(SCHEMA_VERSION);
    }
  });

  it("il fingerprint dei contratti corrisponde alla voce della SCHEMA_VERSION corrente", () => {
    const current = fingerprint();
    const entry = recorded[String(SCHEMA_VERSION)];
    expect(
      entry,
      `Manca la voce "${SCHEMA_VERSION}" in contracts.fingerprint.json (hash attuale: ${current})`,
    ).toBeDefined();
    expect(
      current,
      `Contratti cambiati senza bump: incrementa SCHEMA_VERSION e aggiungi la voce con hash ${current}. Non riscrivere una voce esistente.`,
    ).toBe(entry);
  });

  it("il fingerprint è deterministico", () => {
    expect(fingerprint()).toBe(fingerprint());
  });
});
