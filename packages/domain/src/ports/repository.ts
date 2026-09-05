/**
 * Port outbound generico minimo. Nessuna entità concreta (Page/PageVersion,
 * Story 1.3) esiste ancora: qui basta il contratto sufficiente al caso d'uso
 * di prova. Non anticipare metodi specifici prima che le entità abbiano uno
 * schema.
 */
export type Repository<T, Id> = {
  findById(id: Id): Promise<T | null>;
  save(entity: T): Promise<void>;
};
