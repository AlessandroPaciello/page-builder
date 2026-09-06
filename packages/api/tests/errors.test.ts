import { call, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";

import type { Context } from "../src/context";
import { ForbiddenError, UnauthorizedError } from "@app/domain";
import { mapDomainErrors, toORPCError } from "../src/errors";
import { appRouter } from "../src/routers/index";

function context(principal: Context["principal"], role: string = "ADMIN"): Context {
  if (principal === null) {
    return { session: null, principal: null };
  }
  return {
    session: { user: { id: principal.userId, role }, session: { token: "t" } } as Context["session"],
    principal,
  };
}

describe("notes.create (flusso Principal → core → authz, AC#1)", () => {
  it("ADMIN crea la nota: il Principal fluisce fino al caso d'uso del core", async () => {
    const note = await call(
      appRouter.notes.create,
      { id: "n1", content: "ciao" },
      { context: context({ userId: "u1", role: "ADMIN" }) },
    );
    expect(note).toEqual({ id: "n1", content: "ciao" });
  });

  it("CLIENTE: il deny del core si manifesta come errore di dominio tipizzato (il mapping AD-13 avviene a livello handler, non in call())", async () => {
    await expect(
      call(
        appRouter.notes.create,
        { id: "n2", content: "x" },
        { context: context({ userId: "u2", role: "CLIENTE" }, "CLIENTE") },
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("principal null (sessione assente o ruolo corrotto): UNAUTHORIZED dal middleware", async () => {
    await expect(
      call(appRouter.notes.create, { id: "n3", content: "x" }, { context: context(null) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("toORPCError (mapping AD-13 dominio → set oRPC fisso)", () => {
  it("UnauthorizedError → ORPCError UNAUTHORIZED", () => {
    const mapped = toORPCError(new UnauthorizedError());
    expect(mapped).toBeInstanceOf(ORPCError);
    expect(mapped.code).toBe("UNAUTHORIZED");
  });

  it("ForbiddenError → ORPCError FORBIDDEN, il messaggio di dominio sopravvive al mapping", () => {
    const mapped = toORPCError(new ForbiddenError("CLIENTE", ["ADMIN", "EDITOR"]));
    expect(mapped).toBeInstanceOf(ORPCError);
    expect(mapped.code).toBe("FORBIDDEN");
    expect(mapped.message).toContain("CLIENTE");
  });

  it("ORPCError già mappato passa indennò (idempotente)", () => {
    const original = new ORPCError("UNAUTHORIZED");
    expect(toORPCError(original)).toBe(original);
  });

  it("errore ignoto è rethrown (mapparlo nasconderebbe i bug: lo copre onError)", () => {
    const unknown = new Error("boom");
    expect(() => toORPCError(unknown)).toThrow(unknown);
  });
});

describe("mapDomainErrors (interceptor handler-level che APPLICA il mapping AD-13)", () => {
  it("un errore di dominio lanciato dentro next() esce come ORPCError mappato", async () => {
    await expect(
      mapDomainErrors({
        next: () => Promise.reject(new ForbiddenError("CLIENTE", ["ADMIN", "EDITOR"])),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("CLIENTE") });
  });

  it("un errore di dominio lanciato dentro next() esce come UnauthorizedError mappato", async () => {
    await expect(
      mapDomainErrors({ next: () => Promise.reject(new UnauthorizedError()) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("nessun errore: il valore di next() passa indennò", async () => {
    await expect(mapDomainErrors({ next: () => Promise.resolve("ok") })).resolves.toBe("ok");
  });

  it("un errore ignoto è rethrown invariato", async () => {
    const unknown = new Error("boom");
    await expect(mapDomainErrors({ next: () => Promise.reject(unknown) })).rejects.toBe(unknown);
  });
});
