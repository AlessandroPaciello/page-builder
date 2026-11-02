# CD — Contratto dal design

Il designer ha già disegnato. Leggi Penpot, ricava la bozza del contratto dell'editor e falla approvare. Il contratto descrive **ciò che l'editor usa**: assi `option`, field, slot. Non descrive la forma del disegno — parti, albero, celle restano in Penpot e li legge `pds-code`.

## Lettura

`describe_component { name }` (server `pds`) con il nome del contratto (`alert`, `alert@1`) o il nome del layer/container in Penpot (`Alert`, `Carousel`). Restituisce la `Lettura`: `component`, `pluginData`, `cells[]`; ogni cella ha `variant` (le proprietà di variante con i valori) e `root`, l'albero dei layer (`name`, `kind`, `pluginData`, `tokens`, `style`, `instance`, `children`).

Se il componente non si trova o la lettura dà errore, fermati e riporta il messaggio: non indovinare il nome. Se l'elenco dei componenti del file contiene nomi con `/` (es. `Chip / size=md`), sono celle non raggruppate: fermati e chiedi a DC di completare il raggruppamento, invece di cercare il nome giusto.

Se la lettura trova una cella sciolta — nome con `/` e `variant` vuoto — il componente non è raggruppato: fermati e chiedi a DC di completarlo. Non proporre un contratto senza assi: gli assi stanno nel container, non nella cella. Un componente senza assi ha invece una cella sola e un nome senza `/`: quella è una lettura buona.

## Ricava

**Assi.** Le chiavi di `variant` sono le proprietà di variante che il designer ha disegnato. Se `variant` è vuoto (componente senza assi) non ci sono assi `option`. Un criterio solo, per ogni proprietà (P3):

| Nel disegno | È | Dove sta |
|---|---|---|
| un valore che chi compone la pagina sceglie, e cambiarlo cambia il disegno (`size`, `variant`, `status`, `perView`) | scelta dell'editor | asse `option` del contratto |
| `state` (`default`, `hover`, `active`, `focus`, `disabled`, `error`) | resa | asse di rendering in Penpot, **mai** una prop |
| `open`, `checked`, `content`, `display`, `removable` (e `value`, quando il disegno lo usa) — cambiano senza che chi compone tocchi la pagina: li decide lo stato del componente o i dati | resa | **fuori dal contratto**: la tabella degli assi di rendering è `packages/scripts/src/core/rendering.ts` |

`value` è resa come gli altri, ma la tabella di `rendering.ts` **non lo dichiara** (il disegno vivo non lo usa): una cella `value=…` resta un **blocco «asse estraneo»**, il segnale giusto finché il disegno non ha quelle celle. Si aggiunge alla tabella quando il disegno ha davvero quelle celle, mai al contratto.

Esempi: `Multiselect / open=false, size=md` → asse `size`, nessun asse `open`; `Alert / status=warning` → asse `status`; `Chip / removable=true` → nessun asse (lo decide il contenitore). Controesempio: `state=hover` non è un asse `option` solo perché ha un valore di default: è resa.

Il `default` di un asse `option` è il valore della cella che il designer indica come base — chiedilo, proponendo il primo valore o quello che si chiama `default`. Un asse che non si può esprimere come scelta dell'editor (una proprietà che varia con due assi, valori che sono solo stati) non entra: dillo.

**Field.** Guarda solo ciò che chi compone la pagina scrive, e leggi il field dalla parte con lo stesso nome:

| Nel disegno | Proposta |
|---|---|
| testo che cambia per pagina | `z.string()`, `content` |
| link, immagine, href | `z.url()`, `content` |
| una parte che si ripete (una lista di voci) | `z.array(z.string())`, `content` — chiedi conferma: la ripetizione è una domanda che `pds-code` pone sulle chiavi |
| numero o booleano che l'editor imposta | `z.number()` / `z.boolean()` con i limiti che il designer dichiara |
| testo fisso del disegno | **non è un field**: resta una parte del design |

Un field è **obbligatorio anche dove il disegno non lo mostra**: lo stato vuoto è un valore (`[]` per una lista, `""` per un testo), non un field mancante. `selected` e `options` restano obbligatori con `[]`. `.optional()` si usa solo per un'etichetta che il componente può non avere affatto (un layer che compare come variante di resa: `helper`, `placeholder`, `searchPlaceholder`, `emptyLabel`) e va chiesto. Il nome del field non può essere un attributo HTML globale né una prop riservata: per un titolo usa `heading`.

**Composizioni con istanze (P2).** Una composizione non è un contratto solo:

- **un contratto per ogni componente annidato** che la lettura mostra (un'istanza, o un layer che è una copia di un altro componente), in ordine **figli-prima**: prima i contratti dei figli, poi quello del blocco;
- un contratto annidato **non è un blocco** dell'editor: entra in `packages/contracts` come componente della pipeline, non nel catalogo dei blocchi;
- un field si legge dalla **parte con lo stesso nome** nel figlio (il layer `label` del Chip → `label` di `chip`). La lettura di un'istanza **non porta i figli** (`read-component.ts` li salta: vedi `packages/scripts/src/penpot/README.md`): per ogni componente annidato chiama `describe_component { name: "<Componente annidato>" }`, **una volta per figlio**, e leggi i field da **quella** lettura, non dall'istanza dentro il blocco. I field si **ripetono sul contratto del blocco** quando chi compone la pagina li edita lì: la Multiselect ripete `placeholder`, `selected`, `options`, `searchPlaceholder` ed `emptyLabel`;
- il **passaggio** dal blocco ai figli è nel **TSX dello sviluppatore**, non nel contratto (AD-5): mostralo nella proposta come una riga di codice, non come un campo.

La **ricerca** della Multiselect è un asse dell'editor (Story 2.37): `search` (`false`/`true`, default `false`) entra nel contratto della composizione **e** in quello del pannello, perché il pannello ha le sue quattro celle (`content` × `search`) e la ricerca si accende lì; la composizione lo ripete come scelta di chi compone la pagina. Un asse che il disegno non mostra resta fuori: `verify_component` segnala «asse estraneo» finché non c'è la cella, ed è il segnale giusto.

**Sezioni.** Se il disegno ha un layer i cui figli sono tutti istanze di contratti, è uno slot: proponi `slots: [{ id, allow, max? }]` (`allow` = i contratti di quelle istanze, `max` solo se il designer lo dichiara), il nodo `root` con `component` uguale al nome della sezione, i `props` di default presi dalla cella base e i figli di esempio presi dalle istanze. Nome della sezione diverso da ogni contratto di componente. Un layer con figli-istanza non è uno slot se il componente non è una sezione: una composizione di componenti chiusa resta un componente.

**Parti e nomi.** Non entrano nel contratto, ma servono a `pds-code`: elenca le chiavi proposte (kebab del nome del layer) e quali layer sembrano ripetersi. Il controllo dei nomi riservati usa l'elenco giusto per ogni cosa: le **parti** sono chiavi kebab (`PART_KEY` di `packages/scripts/src/core/naming.ts`), quindi si confronta il kebab con `HTML_GLOBAL_ATTRIBUTES` e `REACT_RESERVED_PROPS` (`content`, `description`, `icon-left` vanno bene); **assi e field** seguono `IDENTIFIER` (`/^[a-z][a-zA-Z0-9]*$/`, camelCase ammesso) e poi gli stessi due elenchi (`searchPlaceholder` va bene, `value` no). Un nome riservato (`value`, `title`, `children`, …) **ferma** la proposta, e il sostituto si propone (`value` → `display`); la rinomina si fa in Penpot, non nel contratto. Vale anche per un disegno fatto prima di questa regola: CD ripete il controllo.

## Proposta e scrittura

Mostra: la tabella di assi/field/slot, i contratti annidati, il file completo di ognuno, il diff degli altri file (registry, `index.ts`, `SCHEMA_VERSION`, fingerprint, `packages/contracts/tests/components.test.ts`; per una sezione anche l'elenco in `packages/contracts/tests/section.test.ts`), la riga del TSX che passa i field ai figli e ciò che resta fuori (parti, comportamento, a11y). Una domanda sola: approvi questi file?

Dopo il sì, scrivi **solo i file elencati** con `references/contract-rules.md`: un primo contratto parte da `version: 1`; per un contratto che esiste già vale la regola A (compatibile = solo `SCHEMA_VERSION`, incompatibile = anche `version`). Un file che non era nell'elenco non si scrive; un file che cambia dopo il sì richiede un nuovo sì.

## Non fai

- Non scrivi su Penpot e non scrivi plugin data: la bozza si ricava dal disegno, non lo modifica.
- Non «completi» il disegno: se manca una cella o un asse, lo dice a DC o al designer, non lo inventa.
- Non aggiungi un asse per far passare un contratto più stretto del disegno: se il disegno usa una resa che il contratto non ha, ti fermi e chiedi.
- Non prometti che il codice verrà identico: il giudizio è di `pds-code` GC e del designer in Storybook.
