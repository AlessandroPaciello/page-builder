import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

/**
 * Guard+inject (pattern oRPC): senza Principal → UNAUTHORIZED; con Principal
 * inietta `principal` (e `session`, che non può essere null se il Principal
 * esiste — deriva da essa — ma il tipo non lo sa) nel context della handler.
 *
 * Il contratto di `protectedProcedure` si è irrobustito da "sessione presente"
 * a "Principal presente": una sessione valida con ruolo corrotto ora è
 * UNAUTHORIZED (principal null), non più una sessione "buona". Le procedure
 * esistenti non cambiano firma.
 */
const requirePrincipal = o.middleware(async ({ context, next }) => {
  // `== null` (non `=== null`): copre anche `principal`/`session` ABSENTI
  // (undefined) — un context costruito a mano senza la chiave (call() nei
  // test, un futuro adapter) è un deny, non un iniettato-undefined-che-menta
  // il tipo.
  if (context.session == null || context.principal == null) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
      principal: context.principal,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requirePrincipal);
