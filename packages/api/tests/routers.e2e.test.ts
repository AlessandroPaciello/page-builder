import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@app/domain";
import type { Context } from "../src/context";
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
