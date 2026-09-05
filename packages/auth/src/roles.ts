import { z } from "zod";

/**
 * Tassonomia dei ruoli di dominio (AD-4): Better Auth fornisce
 * `identità + ruolo grossolano` (`Principal { userId, role }`); l'autorizzazione
 * fine è del core (Story 1.5). La colonna `user.role` è una stringa: la
 * validazione dell'insieme valido avviene alla lettura, fail-fast.
 */
export const ROLES = ["ADMIN", "EDITOR", "CLIENTE"] as const;

export type Role = (typeof ROLES)[number];

/**
 * Il minor privilegio della matrice RBAC: nessun percorso di sign-up può
 * produrre un utente ADMIN/EDITOR (deny-by-default fin dall'ingresso).
 */
export const DEFAULT_ROLE: Role = "CLIENTE";

const roleSchema = z.enum(ROLES);

/**
 * Normalizza il valore DB grezzo nel tipo `Role`, rifiutando valori
 * sconosciuti: un ruolo non riconosciuto non è mai trattato come ammesso.
 * Lancia (fail-fast) invece di degradare silenziosamente.
 */
export function parseRole(raw: string): Role {
  return roleSchema.parse(raw);
}

/**
 * Variante non-lanciante per i guard dell'app: `null` significa "ruolo fuori
 * tassonomia o assente" e chi chiama deve negare l'accesso.
 */
export function safeParseRole(raw: string): Role | null {
  const parsed = roleSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
