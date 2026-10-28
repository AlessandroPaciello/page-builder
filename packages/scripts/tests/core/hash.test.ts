import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { GENERATOR_VERSION, isGenerated, readGeneratedHeader, sha256Hex, withGeneratedHeader } from "../../src/core";

/** Livello 1 della CI (Story 2.22): SHA-256 su vettori noti, intestazione `@generated`. */

const reference = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

describe("sha256Hex — vettori noti", () => {
  // Calcolati fuori da Node (`printf '%s' … | sha256sum`).
  const vectors: [string, string][] = [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["emoji 🎨 e CJK 漢字", "6d8c935809f9ed99192718b58c2fc3a42eb482f01041eb2e735d0c11c1dca967"],
  ];
  for (const [text, hex] of vectors) {
    it(`${JSON.stringify(text)} (${text.length} caratteri)`, () => {
      expect(sha256Hex(text)).toBe(hex);
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
