/**
 * Versione dello schema delle props, posseduta da `contracts` (AD-6): i payload
 * salvati la portano con sé. Ogni cambio di contratto o di sezione è un bump
 * esplicito, con una nuova voce in `tests/contracts.fingerprint.json`.
 *
 * 4 (Story 2.12): il fingerprint copre solo il contratto del page builder
 * (assi `option`, field, slot) ed entra il contratto della card, poi sostituito
 * da `shop-card` nella Story 2.40. L'estensione v1
 * (`parts`, `partRoles`, assi `state`/`behavior`) è fuori dal fingerprint:
 * la sua cancellazione (Story 2.16) NON è un nuovo bump.
 *
 * 5 (Story 2.27): entra la sezione `carousel` (`perView` structure enum, slot
 * `slides` sulle card, tre figli di default).
 *
 * 6 (Story 2.28): entrano i contratti della Multiselect e dei componenti che
 * contiene, uno per componente annidato: `multiselect` (assi `size` e, dalla
 * Story 2.37, `search` con default `false`; field `helper`, `placeholder`,
 * `searchPlaceholder` ed `emptyLabel` facoltativi, `selected` e `options`
 * obbligatori), `multiselect-trigger` (asse `size`,
 * field `placeholder` facoltativo e `selected`), `multiselect-panel` (asse
 * `search`, Story 2.37; `content` è un asse di rendering, non una scelta
 * dell'editor — field `options` obbligatorio, `searchPlaceholder` ed
 * `emptyLabel` facoltativi),
 * `chip` (asse `size`, field `label`), `option` (field `label`) e `checkbox`
 * (nessun asse né field). I field di contenuto sono ripetuti su `multiselect`
 * perché nell'editor la Multiselect è un blocco solo: i figli restano
 * componenti della pipeline e il passaggio dei valori è nel TSX. Gli assi di
 * rendering (`open`, `display`, `removable`, `checked`, `content`)
 * non entrano nel contratto né nel fingerprint: vivono in `packages/scripts`.
 *
 * 7 (Story 2.40): entra `shop-card@1` — la ShopCard scritta dalla forma
 * disegnata in Penpot (asse `size`, field `href`, `image`, `imageAlt`,
 * `heading`, `description`, `price`, `tagLabel`, `stockLabel`, `ctaLabel`) — ed esce il contratto della card della v2; lo slot `slides` del
 * Carousel ammette `shop-card` e i suoi tre figli di default usano i field
 * nuovi. `badge@1` è invariato.
 *
 * 8 (Story 2.40): i due field `tagLabel` e `stockLabel` di `shop-card` diventano
 * un unico field `tags` (`string[]`): in Penpot i due Badge `Tag` e `Stock` sono
 * una parte ripetuta (`repeat: lista`), quindi la card ha una cva sola e un
 * `.map` per i tag. Una pagina salvata con la versione 7 tiene i due field.
 */
export const SCHEMA_VERSION = 8;
