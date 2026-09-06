/**
 * Guard Origin/CSRF per le rotte RPC (Story 1.5, chiusura deferred-work 1-1):
 * le richieste state-changing (mutation) devono portare un Origin (fallback
 * Referer) nella allow-list del deploy (`CORS_ORIGIN`). I client browser
 * same-origin (`apps/web/src/utils/orpc.ts`, `credentials: "include"`)
 * trasmettono sempre Origin; i client RPC programmatici senza browser no —
 * accettabile: la via autenticata è il browser.
 *
 * Fail-closed su entrambi i lati: richiesta senza Origin valido → deny; config
 * assente (lista vuota) → deny, non open. GET resta senza guard: le procedure
 * di lettura oggi non mutano (se un domani mutassero, è il design a essere
 * sbagliato, non il guard).
 */

const MUTATION_METHODS: readonly string[] = ["POST", "PUT", "PATCH", "DELETE"];

export function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.includes(method.toUpperCase());
}

function stripTrailingSlashes(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/**
 * `true` = richiesta ammessa. `headers` è la surface `Headers` (Request) ma
 * basta qualunque oggetto con `get(name)`: il guard è puro e testabile senza
 * Request.
 */
export function verifyTrustedOrigin(
  method: string,
  headers: { get(name: string): string | null },
  trustedOrigins: readonly string[],
): boolean {
  if (!isMutationMethod(method)) {
    return true;
  }

  // Fail-closed sulla config: senza allow-list non c'è modo di distinguere un
  // legittimo da un cross-site, quindi si nega.
  const allowed = trustedOrigins.map(stripTrailingSlashes);
  if (allowed.length === 0) {
    return false;
  }

  // `||` (non `??`): un Origin vuoto ("", certi proxy/redirect) è assenza
  // d'informazione, non un valore — il fallback Referer copre anche quel
  // ramo. Fail-closed comunque: senza alcun header → deny.
  const raw = headers.get("Origin") || headers.get("Referer");
  if (raw === null) {
    return false;
  }

  let origin: string;
  try {
    // Per il Referer (URL completo) prende solo l'origine: il confronto è per
    // origin, un path non può plaudire al trusted ("...:3000.evil.com" non
    // matcha "...:3000").
    origin = new URL(raw).origin;
  } catch {
    // Non è un URL (es. Origin letterale "null" di contesti opachi): deny.
    return false;
  }

  return allowed.includes(origin);
}
