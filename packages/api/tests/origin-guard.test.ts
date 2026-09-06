import { describe, expect, it } from "vitest";

import { isMutationMethod, verifyTrustedOrigin } from "../src/origin-guard";

const TRUSTED = ["http://localhost:3000"];

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("isMutationMethod", () => {
  it("classifica POST/PUT/PATCH/DELETE come mutation", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(isMutationMethod(method)).toBe(true);
    }
  });

  it("GET (e altri metodi safe) non sono mutation: nessun guard atteso", () => {
    expect(isMutationMethod("GET")).toBe(false);
    expect(isMutationMethod("HEAD")).toBe(false);
    expect(isMutationMethod("OPTIONS")).toBe(false);
  });
});

describe("verifyTrustedOrigin (guard Origin/CSRF sulle rotte RPC)", () => {
  it("GET senza Origin passa: le procedure di lettura oggi non mutano", () => {
    expect(verifyTrustedOrigin("GET", headers({}), TRUSTED)).toBe(true);
  });

  it("mutation senza Origin (né Referer) è negata: fail-closed", () => {
    expect(verifyTrustedOrigin("POST", headers({}), TRUSTED)).toBe(false);
  });

  it("mutation con Origin nella allow-list passa", () => {
    expect(
      verifyTrustedOrigin("POST", headers({ Origin: "http://localhost:3000" }), TRUSTED),
    ).toBe(true);
  });

  it("mutation con Origin estraneo è negata (CSRF cross-site)", () => {
    expect(verifyTrustedOrigin("POST", headers({ Origin: "https://evil.example" }), TRUSTED)).toBe(
      false,
    );
  });

  it("Origin letterale `null` (iframe sandboxed / contesto opaco) è negato", () => {
    expect(verifyTrustedOrigin("POST", headers({ Origin: "null" }), TRUSTED)).toBe(false);
  });

  it("senza Origin, il fallback Referer nella allow-list passa", () => {
    expect(
      verifyTrustedOrigin(
        "PUT",
        headers({ Referer: "http://localhost:3000/dashboard" }),
        TRUSTED,
      ),
    ).toBe(true);
  });

  it("senza Origin, un Referer estraneo è negato", () => {
    expect(verifyTrustedOrigin("PATCH", headers({ Referer: "https://evil.example/x" }), TRUSTED)).toBe(
      false,
    );
  });

  it("la comparazione è per ORIGIN, non per URL completo: un path non può plaudire al trusted", () => {
    expect(verifyTrustedOrigin("DELETE", headers({ Origin: "http://localhost:3000.evil.com" }), TRUSTED)).toBe(
      false,
    );
  });

  it("normalizza lo slash finale del trusted configurato", () => {
    expect(
      verifyTrustedOrigin("POST", headers({ Origin: "http://localhost:3000" }), [
        "http://localhost:3000/",
      ]),
    ).toBe(true);
  });

  it("CORS_ORIGIN assente (lista vuota) → mutation negata anche con Origin valido: fail-closed sulla config", () => {
    expect(
      verifyTrustedOrigin("POST", headers({ Origin: "http://localhost:3000" }), []),
    ).toBe(false);
  });

  it("con config mancante i metodi safe restano aperti", () => {
    expect(verifyTrustedOrigin("GET", headers({}), [])).toBe(true);
  });
});
