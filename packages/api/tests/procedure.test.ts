import { call, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";

import type { Context } from "../src/context";
import { protectedProcedure } from "../src/index";

const adminContext: Context = {
  session: { user: { id: "u1", role: "ADMIN" }, session: { token: "t1" } } as Context["session"],
  principal: { userId: "u1", role: "ADMIN" },
};

const proc = protectedProcedure.handler(({ context }) => context.principal);

describe("protectedProcedure (requirePrincipal, AC#1)", () => {
  it("con principal presente lo inietta non-null nel context della handler", async () => {
    await expect(call(proc, undefined, { context: adminContext })).resolves.toEqual({
      userId: "u1",
      role: "ADMIN",
    });
  });

  it("senza principal risponde UNAUTHORIZED", async () => {
    await expect(
      call(proc, undefined, { context: { session: null, principal: null } satisfies Context }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("con sessione valida ma ruolo corrotto (principal null) resta UNAUTHORIZED: la sola sessione non basta più", async () => {
    await expect(
      call(proc, undefined, {
        context: {
          session: { user: { id: "u2", role: "ROOT" }, session: { token: "t2" } } as Context["session"],
          principal: null,
        } satisfies Context,
      }),
    ).rejects.toThrow(ORPCError);
  });
});
