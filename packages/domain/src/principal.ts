/**
 * Contratto canonico AD-4: `identità + ruolo grossolano` che il core consuma
 * per l'autorizzazione fine. Vive in `@app/domain` perché l'authz fine è dato
 * di dominio (Consistency Conventions dello Spine): definirselo in un adapter
 * (auth/api) invertirebbe la direzione delle dipendenze.
 *
 * Zero dipendenze runtime: il confine di `packages/domain` lo impone già. La
 * validazione dell'insieme valido è una guardia TS piana (`isRole`); il
 * parsing robusto del valore grezzo (DB/sessione) resta negli adapter
 * (`packages/auth` — zod).
 */
export const ROLES = ["ADMIN", "EDITOR", "CLIENTE"] as const;

export type Role = (typeof ROLES)[number];

export type Principal = {
  userId: string;
  role: Role;
};

/**
 * Guardia piana per il valore grezzo: `false` significa "ruolo fuori
 * tassonomia o assente" e chi chiama deve negare l'accesso, mai fare
 * best-effort.
 */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
