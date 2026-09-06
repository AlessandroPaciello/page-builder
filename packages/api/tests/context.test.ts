import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());

// Il modulo `@app/auth` (index) trascina Better Auth + Prisma + validazione
// env: qui serve solo l'istanza `auth` (finta) e i parser di ruolo REALI
// (`@app/auth/roles` non dipende da nulla di pesante). È un test di unità del
// context, non di integrazione Better Auth (quelle esistono già in
// packages/auth/tests/).
vi.mock("@app/auth", async () => {
  const roles = await vi.importActual<typeof import("@app/auth/roles")>("@app/auth/roles");
  return { ...roles, auth: { api: { getSession } } };
});

import { createContext } from "../src/context";

function request(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

describe("createContext (Principal nel context oRPC, AC#1)", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("con sessione valida costruisce il Principal da session.user (id + ruolo)", async () => {
    const session = {
      user: { id: "u1", role: "ADMIN" },
      session: { token: "t1" },
    };
    getSession.mockResolvedValue(session);

    const context = await createContext(request());

    expect(context.session).toEqual(session);
    expect(context.principal).toEqual({ userId: "u1", role: "ADMIN" });
  });

  it("con ruolo fuori tassonomia mette principal a null e NON fa best-effort (deny-by-default sulla forma del dato)", async () => {
    getSession.mockResolvedValue({ user: { id: "u2", role: "ROOT" }, session: { token: "t2" } });

    const context = await createContext(request());

    expect(context.session).not.toBeNull();
    expect(context.principal).toBeNull();
  });

  it("con ruolo mancante mette principal a null", async () => {
    getSession.mockResolvedValue({ user: { id: "u3" }, session: { token: "t3" } });

    const context = await createContext(request());

    expect(context.principal).toBeNull();
  });

  it("senza sessione restituisce session e principal null", async () => {
    getSession.mockResolvedValue(null);

    const context = await createContext(request());

    expect(context.session).toBeNull();
    expect(context.principal).toBeNull();
  });
});
