import { z } from "zod";

import { ROLES, type Role } from "@app/domain";

/**
 * Tassonomia dei ruoli di dominio (AD-4). La definizione canonica vive in
 * `@app/domain` (`Principal` è un contratto condiviso core-attraversante):
 * qui è solo re-export — un'altra definizione creerebbe due tassonomie che
 * divergono. La direzione adapter→core (`auth → domain`) è lecita; quella
 * contraria è vietata dal boundary check di domain.
 */
export { ROLES } from "@app/domain";
export type { Role } from "@app/domain";

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
