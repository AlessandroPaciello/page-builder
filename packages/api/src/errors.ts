import { ForbiddenError, UnauthorizedError } from "@app/domain";
import { ORPCError } from "@orpc/server";

/**
 * Mapping fisso errori-di-dominio → set oRPC (AD-13), in UNICO punto
 * dell'adapter: la traduzione è questa funzione, l'**applicazione** è l'
 * interceptor `mapDomainErrors` cablato una volta sola a livello handler
 * (`route.ts` — RPCHandler e OpenAPIHandler) — le procedure NON fanno
 * try/catch con traduzioni sparse, la semantica resta identica su ogni via
 * di accesso e nessuna procedura futura può dimenticarla.
 *
 * - `UnauthorizedError` → UNAUTHORIZED: identità assente.
 * - `ForbiddenError`    → FORBIDDEN: azione nota ma vietata (la risorsa di
 *   prova esiste per definizione). La regola 404-per-non-rivelazione delle
 *   risorse reali (Epic 4/5) si esprimerà con NOT_FOUND nella stessa funzione.
 * - Errori ignoti: rethrow — gli interceptor `onError` li loggano e oRPC li
 *   copre come 500/INTERNAL_SERVER_ERROR; mapparli qui nasconderebbe i bug.
 */
export function toORPCError(error: unknown): ORPCError<string, unknown> {
  if (error instanceof ORPCError) {
    return error;
  }
  if (error instanceof UnauthorizedError) {
    return new ORPCError("UNAUTHORIZED", { message: error.message });
  }
  if (error instanceof ForbiddenError) {
    return new ORPCError("FORBIDDEN", { message: error.message });
  }
  throw error;
}

/**
 * Interceptor handler-level che APPLICA il mapping AD-13 a ogni procedura
 * servita dall'handler, senza che nessuna la ricordi. Nota: `call()` (i test
 * e2e) esegue la procedura direttamente e NON passa dagli handler — lì il
 * deny si manifesta come errore di dominio tipizzato, ed è il mapping qui a
 * essere testato unitariamente.
 */
export async function mapDomainErrors<T>({ next }: { next: () => Promise<T> }): Promise<T> {
  try {
    return await next();
  } catch (error) {
    throw toORPCError(error);
  }
}
