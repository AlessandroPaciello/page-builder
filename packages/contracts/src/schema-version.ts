/**
 * Versione dello schema delle props, posseduta da `contracts` (AD-6): i payload
 * salvati la portano con sé. Ogni cambio di contratto o di sezione è un bump
 * esplicito, con una nuova voce in `tests/contracts.fingerprint.json`.
 *
 * 4 (Story 2.12): il fingerprint copre solo il contratto del page builder
 * (assi `option`, field, slot) ed entra `product-card`. L'estensione v1
 * (`parts`, `partRoles`, assi `state`/`behavior`) è fuori dal fingerprint:
 * la sua cancellazione (Story 2.16) NON è un nuovo bump.
 *
 * 5 (Story 2.27): entra la sezione `carousel` (`perView` structure enum, slot
 * `slides` su `product-card`, tre figli di default).
 */
export const SCHEMA_VERSION = 5;
