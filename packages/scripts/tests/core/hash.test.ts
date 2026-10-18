import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { GENERATOR_VERSION, isGenerated, readGeneratedHeader, sha256Hex, withGeneratedHeader } from "../../src/core";

/** Livello 1 della CI (Story 2.22): SHA-256 puro contro `node:crypto`, intestazione `@generated`. */

const reference = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

describe("sha256Hex — uguale a node:crypto", () => {
  const samples = [
    "",
    "abc",
    "a".repeat(55),
    "a".repeat(56),
    "a".repeat(63),
    "a".repeat(64),
    "a".repeat(65),
    "x".repeat(1000),
    "àèìòù — non modificare a mano",
    "emoji 🎨 e CJK 漢字",
    'export const badgeParts = ["root", "label"] as const;\n',
  ];
  for (const sample of samples) {
    it(`${JSON.stringify(sample.slice(0, 24))} (${sample.length} caratteri)`, () => {
      expect(sha256Hex(sample)).toBe(reference(sample));
    });
  }

  it("rosso: un carattere diverso cambia l'hash", () => {
    expect(sha256Hex("abc")).not.toBe(sha256Hex("abd"));
  });
});

describe("intestazione @generated", () => {
  const body = 'import { cva } from "class-variance-authority";\n\nexport const x = 1;\n';

  it("prima riga con versione e hash del corpo dopo la prima riga", () => {
    const file = withGeneratedHeader(body);
    const [first, ...rest] = file.split("\n");
    expect(first).toBe(`// @generated pds ${GENERATOR_VERSION} sha256:${reference(body)} — non modificare a mano`);
    expect(rest.join("\n")).toBe(body);
    expect(readGeneratedHeader(file)).toEqual({ version: GENERATOR_VERSION, hash: reference(body), ok: true });
    expect(isGenerated(file)).toBe(true);
  });

  it("rosso: il corpo modificato di un carattere dà ok: false", () => {
    const file = withGeneratedHeader(body);
    const edited = file.replace("x = 1", "x = 2");
    expect(readGeneratedHeader(edited)).toMatchObject({ ok: false });
    expect(isGenerated(edited)).toBe(true);
  });

  it("l'hash si calcola con LF: un file passato a CRLF resta valido", () => {
    const file = withGeneratedHeader(body);
    expect(readGeneratedHeader(file.replace(/\n/g, "\r\n"))?.ok).toBe(true);
    expect(withGeneratedHeader(body.replace(/\n/g, "\r\n"))).toBe(file);
  });

  it("senza marker: undefined", () => {
    expect(readGeneratedHeader(body)).toBeUndefined();
    expect(readGeneratedHeader("// @generated da qualcun altro\nx")).toBeUndefined();
    expect(readGeneratedHeader("")).toBeUndefined();
    expect(isGenerated(`\n${withGeneratedHeader(body)}`)).toBe(false);
  });
});
