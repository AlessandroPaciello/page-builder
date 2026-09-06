import { auth, safeParseRole } from "@app/auth";
import type { Principal } from "@app/domain";
import type { NextRequest } from "next/server";

/**
 * Il Principal è il contratto AD-4 tra adapter oRPC e core: l'autorizzazione
 * fine è del dominio, ma è il context a consegnare identità + ruolo
 * grossolano. `role` mancante o fuori tassonomia → `principal: null` →
 * trattato come non autenticato (deny-by-default anche sulla forma del dato:
 * una sessione con ruolo corrotto non degrada mai a CLIENTE).
 *
 * Il context continua a esporre anche `session`: il guard `/dashboard` la usa.
 */
export async function createContext(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  let principal: Principal | null = null;
  // `user?.id` con truthy check (non solo `!= null`): una sessione con `user`
  // assente o `id` vuoto non è un'identità — è una forma corrotta, e
  // corrotta → principal null → deny-by-default anche sulla forma del dato.
  const userId = session?.user?.id;
  if (userId) {
    const role = safeParseRole(session.user.role);
    if (role !== null) {
      principal = { userId, role };
    }
  }

  return { session, principal };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
