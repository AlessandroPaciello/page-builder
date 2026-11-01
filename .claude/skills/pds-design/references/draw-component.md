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
6. **Raggruppa** solo dopo che il designer ha **duplicato il file** (non la pagina: una pagina duplicata raddoppia i componenti e la lettura risponde «Più componenti rispondono a …») e confermato che i salvataggi persistono. Un componente **senza celle** — una board fuori da un container di varianti, col nome senza `Component / Axis=Value` — non richiede un container: `group_variants` risponde `singolo` e non scrive. `Multiselect Panel` non è quel caso: è già un container di varianti, con quattro celle (`content` × `search`), e il Multiselect ne annida una variante — l'asse `content` di `rendering.ts` non fa del pannello una famiglia di celle del contratto. Una cella sola che invece porta già le proprietà nel nome non è un set: il rifiuto la nomina.

   Le celle hanno già tutte le proprietà nel nome, completo e coerente (vedi passo 3): sono la traccia da cui parte il raggruppamento. Mostra le celle e i valori e chiedi conferma, poi fai **una chiamata** per componente, col nome del contratto:

   ```
   group_variants { "component": "<contratto>" }
   ```

   Lo strumento legge le celle sciolte `Component / Axis=Value` e le raggruppa in un container di varianti: nomi completi, nessuna variante automatica da eliminare, assi impostati, istanze annidate ancora collegate. La matrice attesa viene dal contratto e dagli assi di rendering dichiarati per quel contratto in `packages/scripts/src/core/rendering.ts`, più `state` quando il disegno lo usa.

   - Un **nome senza tutte le proprietà**, un valore fuori contratto, una cella doppia o l'assenza della cella di partenza sono un rifiuto che nomina la cella: nessuna scrittura parte. Correggi il disegno e richiama. Le combinazioni che il disegno non ha tornano in `notDrawn`: sono una nota, non un rifiuto. Se le celle si sovrappongono, lo strumento le dispone in griglia (una colonna per valore dell'ultimo asse) e adatta il container; se sono già distanziate non le sposta. Il container nasce senza layout flex.
   - Un componente già raggruppato risponde `già raggruppato` e non cambia niente: la chiamata è idempotente.
   - L'esito elenca container, assi e celle. `library.local.components` elenca **un** componente per container: è così che si controlla che il raggruppamento sia riuscito. Se la chiamata non torna entro ~30 s, fermati e riportalo: è un errore, non un motivo per tornare ai componenti separati.
7. **Verifica finale**, in una chiamata **separata** (non dentro `group_variants`): `verify_component` sul contratto, poi l'elenco delle celle con i valori di variante, il conteggio dei token legati e le combinazioni della matrice non disegnate (sono una nota, non un finding). Esporta una cella con `export_shape` e mostrala: è il giudizio visivo del designer.

## Aggiungere un asse a un container esistente

Un componente già raggruppato risponde `già raggruppato` a `group_variants`: per aggiungere una proprietà — `search` alla Multiselect — non si richiama lo strumento, si esegue la sequenza con `execute_code`, con una conferma per ogni scrittura mostrata. Si lavora su un **file duplicato** (vedi `references/kit-wrappers.md`) e si legge prima di scrivere.

1. **Lettura, di sola lettura**, in una chiamata: il container che risponde al nome — se sono più di uno la chiamata è un errore che li nomina e non si scrive — e, per ogni voce di `container.variants.variantComponents()`, i `variantProps` e il nome dell'istanza principale. La posizione di una proprietà è il suo indice nell'ordine delle chiavi di `variantProps` (come `propsOf` e `variantMap` in `packages/scripts/src/penpot/group-variants.ts`), **non** in `variants.properties`, che non è ordinato. Per ogni cella registra anche **nomi dei layer e `shape.tokens`**: è la baseline del confronto finale. Registra lo stesso ordine di chiavi per i componenti annidati: l'indice di `switchVariant` è quello della variante annidata, non del container.
2. **Accordo.** Mostra la matrice e concorda nome, valori e default dell'asse, e quali celle mostrano il valore nuovo; poi chiedi «Procedo?». Rifiuta senza scrivere l'asse che c'è già, il nome fuori `IDENTIFIER` o riservato (`references/contract-rules.md`), il valore non concordato: il rifiuto nomina la proprietà o la cella. Un valore concordato che nessuna cella disegna non è un rifiuto: la cella si costruisce da zero (passo 4).
3. **La proprietà.** `container.variants.addProperty()`, attendi che la proprietà compaia in coda alle chiavi di `variantProps` e prendi `pos` come il suo indice lì (`chiavi.length - 1`, non in `variants.properties`), **poi** `container.variants.renameProperty(pos, nome)` e attendi che abbia quel nome. Sono mutazioni asincrone che passano dal file: senza attesa la rinomina colpisce la proprietà sbagliata. Poi `setVariantProperty(pos, default)` sullo stesso `pos`, su **ogni** voce di `container.variants.variantComponents()`, e attendi la rilettura dei `variantProps`: le altre celle non cambiano nome né token.
4. **Le celle del valore nuovo.** Il designer sceglie la via:
   - una cella che esiste e mostra il valore nuovo: sull'istanza annidata — riconoscila dal componente d'origine, il pannello, non dal nome del layer — `switchVariant(posAnnidato, valore)`, con `posAnnidato` l'indice della proprietà **della variante annidata**; poi `setVariantProperty(pos, valore)` sull'asse nuovo e rileggi — cambiare l'istanza annidata riporta l'asse nuovo al valore iniziale;
   - una cella che il disegno non ha: costruiscila da zero come al passo 3 di `## Disegno` (una chiamata), rendila componente e prendine l'istanza principale con `penpot.library.local.createComponent([board]).mainInstance()`; appendi quella con `container.appendChild(...)`, poi rileggi `container.variants.variantComponents()` e imposta `setVariantProperty` per ogni asse, asse nuovo compreso, sulla voce la cui `mainInstance().id` è la board, con la rilettura dopo.

   Le celle che l'asse non riguarda non si spostano: la disposizione resta al designer anche quando una cella cresce e tocca la riga sotto.
5. **Verifica**, in una chiamata **separata**: nessun `variantError`; per ogni variante gli assi nell'ordine contratto → rendering → `state` → asse nuovo, ai valori attesi; nomi delle celle e `shape.tokens` uguali alla baseline per le celle che esistevano già al passo 1 (la cella nuova non ne ha una). Poi `describe_component` e `verify_component`: leggono il valore nuovo su ogni cella, e il solo blocco è «manca il contratto» **finché il container non ha `pagebuilder/contract`** — con il dato, un asse che il contratto non dichiara è un blocco «asse estraneo», e lo chiude 2.37 o MS.
6. **Esito.** Mostra assi, celle e l'export di una cella adattata. Dì cosa resta a MS o 2.37 (dichiarare l'asse nel contratto) e a `pds-code` (plugin data `contract`). Una seconda esecuzione dichiara l'asse già presente e non scrive.

## Esito

Riporta: container e celle, combinazioni della matrice non disegnate, differenze di token, e la lista di ciò che resta a `pds-code` — plugin data `contract` sul container, chiavi `part` sui layer, `slot`, risposte alle domande. Finché quei dati non ci sono, la lettura per contratto non trova il componente: è atteso.

## Non fai

- Non scrivi plugin data `pagebuilder`.
- Non crei token, non cambi valori esistenti, non «aggiusti» il disegno del designer. La sola eccezione è aggiungere un asse al container esistente, con la procedura qui sopra e la conferma su ogni scrittura mostrata.
- Non tocchi il codice: né contratti (CN/CD/MS), né file `@generated`, né CSS.
- Non prometti fedeltà: il giudizio è del designer, davanti all'export.
