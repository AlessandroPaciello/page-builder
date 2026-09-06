import type { Principal } from "./principal";

/**
 * Errori di autorizzazione tipizzati (seme di AD-13): classi di dominio, non
 * stringhe libere. È il contratto che gli adapter mappano sul set oRPC fisso
 * (`UNAUTHORIZED`/`FORBIDDEN`) in un unico punto — la funzione di mapping
 * dell'adapter è l'unica che li traduce.
 *
 * La distinzione è semantica AD-13: `UnauthorizedError` = identità assente
 * (chi sei?); `ForbiddenError` = identità nota ma azione vietata (cosa puoi
 * fare?). La regola 404-per-non-rivelazione per le risorse reali arriva in
 * Epic 4/5: qui si fissa il meccanismo.
 */
export class UnauthorizedError extends Error {
  readonly name = "UnauthorizedError" as const;

  constructor(message = "Autenticazione richiesta: principal assente") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  readonly name = "ForbiddenError" as const;
  readonly role: Principal["role"] | undefined;
  readonly allowedRoles: readonly Principal["role"][];

  constructor(role: Principal["role"] | undefined, allowedRoles: readonly Principal["role"][]) {
    super(
      role === undefined
        ? `Ruolo fuori tassonomia: nessuno dei ruoli consentiti [${allowedRoles.join(", ")}]`
        : `Ruolo "${role}" non abilitato: richiedono [${allowedRoles.join(", ")}]`,
    );
    this.role = role;
    this.allowedRoles = allowedRoles;
  }
}

/**
 * Policy deny-by-default del core (AD-4): qualsiasi combinazione non prevista
 * esplicitamente è un deny — principal null, ruolo fuori tassonomia, lista
 * permessi vuota. Nessun adapter decide da sé: i casi d'uso chiamano questo.
 */
export function assertRole(
  principal: Principal | null | undefined,
  allowed: readonly Principal["role"][],
): asserts principal is Principal {
  if (principal == null) {
    throw new UnauthorizedError();
  }
  if (!allowed.includes(principal.role)) {
    throw new ForbiddenError(principal.role, allowed);
  }
}
