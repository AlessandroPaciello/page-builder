import type { Principal, Role } from "../src/principal";

/** Helper di test: costruisce un Principal senza passare da adapter (Task 7: "Principal costruiti a mano"). */
export function principal(userId: string, role: Role): Principal {
  return { userId, role };
}
