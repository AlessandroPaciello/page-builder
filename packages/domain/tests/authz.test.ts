import { describe, expect, it } from "vitest";

import { principal } from "./factories";
import { ForbiddenError, UnauthorizedError, assertRole } from "../src/authz";

describe("assertRole (policy deny-by-default del core, AD-4)", () => {
  it("consente i ruoli esplicitamente ammessi (ADMIN/EDITOR per la creazione)", () => {
    expect(() => assertRole(principal("user-1", "ADMIN"), ["ADMIN", "EDITOR"])).not.toThrow();
    expect(() => assertRole(principal("user-2", "EDITOR"), ["ADMIN", "EDITOR"])).not.toThrow();
  });

  it("nega un ruolo non incluso nella lista consentita (CLIENTE)", () => {
    expect(() => assertRole(principal("user-3", "CLIENTE"), ["ADMIN", "EDITOR"])).toThrow(
      ForbiddenError,
    );
  });

  it("nega un principal assente con UnauthorizedError (non Forbidden)", () => {
    expect(() => assertRole(null, ["ADMIN", "EDITOR"])).toThrow(UnauthorizedError);
  });

  it("nega qualunque ruolo fuori tassonomia arrivato come valore grezzo", () => {
    // Nota: il deny fuori-tassonomia NON è una guardia runtime di assertRole
    // (che non chiama isRole): a compile-time un ruolo fuori tassonomia non
    // può stare in una lista `Role[]`. Il cast simula l'unico modo in cui un
    // valore grezzo corrotto può arrivare qui: aggirando i tipi.
    const corrupted = principal("user-4", "ROOT" as never);
    expect(() => assertRole(corrupted, ["ADMIN", "EDITOR", "CLIENTE"])).toThrow(ForbiddenError);
  });

  it("nega con lista permessi vuota, per qualunque ruolo: deny-by-default per omissione", () => {
    for (const role of ["ADMIN", "EDITOR", "CLIENTE"] as const) {
      expect(() => assertRole(principal("user-5", role), [])).toThrow(ForbiddenError);
    }
  });

  it("gli errori tipizzati portano il ruolo e i ruoli consentiti come dato di dominio", () => {
    try {
      assertRole(principal("user-6", "CLIENTE"), ["ADMIN"]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      const forbidden = error as ForbiddenError;
      expect(forbidden.role).toBe("CLIENTE");
      expect(forbidden.allowedRoles).toEqual(["ADMIN"]);
    }
  });
});
