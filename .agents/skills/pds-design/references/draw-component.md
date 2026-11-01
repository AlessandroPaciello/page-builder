# DC — Disegna componente

Disegna in Penpot il container e le celle, **dal contratto** (dopo CN, o da un contratto che esiste già) oppure **libero**, quando il designer parte dal disegno e il contratto arriverà con CD. Il risultato è un disegno fedele e leggibile: `pds-code` ne ricaverà gli stili.

## Prima di disegnare

1. **Quale contratto.** Dal contratto: leggi `packages/contracts/src/components/<nome>.ts` (o `sections/<nome>.ts`) e ricava la matrice: una cella per ogni combinazione degli assi `option` **e degli assi di rendering dichiarati per quel contratto in `packages/scripts/src/core/rendering.ts`** (Multiselect: `open` × `display`; Trigger: `display`; Chip: `removable`; Option e Checkbox: `checked`; Panel: `content`, ma il pannello resta un componente singolo, senza celle `content`: vedi il passo 6), più l'asse `state` solo se il designer disegna gli stati (`hover`, `active`, `focus`, `disabled`, `error`), con una variante per stato su una sola taglia. Mostra la matrice e chiedi se qualche combinazione non serve: una combinazione `option` che non disegni non dà errore, ma non finirà in `styles.ts` (nessuna classe per quella variante), quindi se serve va disegnata; una cella `state` mancante non è un errore.
2. **Libero.** Chiedi nome, parti, assi e valori (anche nessun asse) e cosa cambierà chi compone la pagina. Dillo chiaro: senza contratto il disegno non è ancora leggibile come componente; il contratto si scrive dopo, con CD.
3. **Token.** Leggi i token esistenti (`tokenOverview()`) e proponi, proprietà per proprietà, quali token userai. Non si disegna con valori grezzi e non si inventa un token: se manca, si propone e si approva (governance di `penpot-foundations`).
4. **Nomi dei layer e nomi riservati (P4).** Concorda i nomi delle parti (`label`, `icon`, `content`, …) e le istanze annidate. Da questi nomi `pds-code` proporrà le chiavi `part`: scriverle tocca a lui, non a te. Prima di scrivere una cella, confronta i nomi con gli elenchi di `packages/contracts/src/contract.ts` — e con l'elenco giusto, perché **parti e assi non seguono la stessa regola**:
   - **parti**: diventano le chiavi `part` in kebab-case (`PART_KEY` di `packages/scripts/src/core/naming.ts`, es. `icon-left`), quindi si confronta il **kebab** del nome del layer con `HTML_GLOBAL_ATTRIBUTES` e `REACT_RESERVED_PROPS`: `content`, `description`, `icon-left` vanno bene;
   - **assi e field**: seguono `IDENTIFIER` (`/^[a-z][a-zA-Z0-9]*$/`: minuscola iniziale, **camelCase ammesso**) e gli stessi due elenchi: `searchPlaceholder` va bene, `value` no.
   Un nome riservato **ferma** il disegno: proponi il sostituto (`value` → `display`, `title` → `heading`), la rinomina si fa in Penpot e poi si riparte. Non aggirarlo cambiando il contratto: il controllo vale anche per un disegno fatto prima di questa regola.

## Disegno

Segui `penpot-component-factory` con le divergenze di `references/kit-wrappers.md`. Mostra base e matrice e chiedi «Procedo?» prima della prima scrittura:

1. **Base**, una chiamata `execute_code`: board con layout flex, token legati (a blocchi di ~25–40 forme; niente valori grezzi), figli nell'ordine di append.
2. **Verifica della base**, in una chiamata **separata**: `shape.tokens` di ogni layer, token attesi presenti, nessuno strano. Ritenta i legami mancanti; `applyToken` è asincrono e lega per nome.
3. **Celle, una per chiamata, costruite da zero.** Mai il clone di `createVariants.js` (annida una copia): si ricostruisce la base con i token della cella. Nome `Component / Axis=Value` con **tutte** le proprietà — anche quelle di rendering — per esteso e coerenti (es. `Carousel / perView=3`, `Multiselect / open=true, size=md, state=default, display=chips`); dove uno stato esiste solo su una taglia, le altre celle prendono `state=default`. Cella dopo cella, con la sua verifica in una chiamata separata.
4. **Istanze.** La variante la sceglie il designer ed è quella che il codice userà; niente override di stile, il dimensionamento (`fill`) non è un override; il testo dell'istanza è solo d'esempio.
5. **Sezioni.** Lo slot è il layer i cui figli sono tutti istanze dei contratti ammessi; le istanze sono esempi. Se lo slot è ambiguo, chiedi quale layer è (la risposta `slot=<id>` la scriverà `pds-code`).
6. **Raggruppa** solo dopo che il designer ha **duplicato il file** (non la pagina: una pagina duplicata raddoppia i componenti e la lettura risponde «Più componenti rispondono a …») e confermato che i salvataggi persistono. Un componente **senza celle** — una board fuori da un container di varianti, col nome senza `Component / Axis=Value` — non richiede un container: `group_variants` risponde `singolo` e non scrive. È il caso di `Multiselect Panel`: resta un componente singolo, anche se `rendering.ts` gli dichiara l'asse `content` che il disegno non usa più come famiglia di celle. Una cella sola che invece porta già le proprietà nel nome non è un set: il rifiuto la nomina.

   Le celle hanno già tutte le proprietà nel nome, completo e coerente (vedi passo 3): sono la traccia da cui parte il raggruppamento. Mostra le celle e i valori e chiedi conferma, poi fai **una chiamata** per componente, col nome del contratto:

   ```
   group_variants { "component": "<contratto>" }
   ```

   Lo strumento legge le celle sciolte `Component / Axis=Value` e le raggruppa in un container di varianti: nomi completi, nessuna variante automatica da eliminare, assi impostati, istanze annidate ancora collegate. La matrice attesa viene dal contratto e dagli assi di rendering dichiarati per quel contratto in `packages/scripts/src/core/rendering.ts`, più `state` quando il disegno lo usa.

   - Un **nome senza tutte le proprietà**, un valore fuori contratto, una cella doppia o l'assenza della cella di partenza sono un rifiuto che nomina la cella: nessuna scrittura parte. Correggi il disegno e richiama. Le combinazioni che il disegno non ha tornano in `notDrawn`: sono una nota, non un rifiuto.
   - Un componente già raggruppato risponde `già raggruppato` e non cambia niente: la chiamata è idempotente.
   - L'esito elenca container, assi e celle. `library.local.components` elenca **un** componente per container: è così che si controlla che il raggruppamento sia riuscito. Se la chiamata non torna entro ~30 s, fermati e riportalo: è un errore, non un motivo per tornare ai componenti separati.
7. **Verifica finale**, in una chiamata **separata** (non dentro `group_variants`): `verify_component` sul contratto, poi l'elenco delle celle con i valori di variante, il conteggio dei token legati e le combinazioni della matrice non disegnate (sono una nota, non un finding). Esporta una cella con `export_shape` e mostrala: è il giudizio visivo del designer.

## Esito

Riporta: container e celle, combinazioni della matrice non disegnate, differenze di token, e la lista di ciò che resta a `pds-code` — plugin data `contract` sul container, chiavi `part` sui layer, `slot`, risposte alle domande. Finché quei dati non ci sono, la lettura per contratto non trova il componente: è atteso.

## Non fai

- Non scrivi plugin data `pagebuilder`.
- Non crei token, non cambi valori esistenti, non «aggiusti» il disegno del designer.
- Non tocchi il codice: né contratti (CN/CD/MS), né file `@generated`, né CSS.
- Non prometti fedeltà: il giudizio è del designer, davanti all'export.
