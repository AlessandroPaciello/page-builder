# Epic 2 Context: Design system — token e componenti da Penpot

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Costruire il design system come output riproducibile della pipeline Penpot→codice: token e componenti React accessibili non si scrivono a mano, si generano dal catalogo Penpot in modo conforme ai contratti del page builder, visibile e testato in Storybook. Il regime arriva in due tempi: la v1 (Story 2.1–2.10, già mergiata) porta la pipeline fino a quattro componenti reali e ne scopre il limite sul primo caso composito; la v2 (Story 2.12–2.17) lo risolve nel vocabolario del contratto con due contratti, una sola istantanea e render headless, poi cancella la v1. Storybook è anticipato alla 2.11 per ospitare il giudizio visivo, la ProductCard dimostra la v2 senza una riga di codice a mano, la libreria dei sei domini (2.18) si costruisce solo dopo, interamente sulla v2.

## Stories

- Story 2.1: Pipeline token Penpot→codice
- Story 2.2: Estrazione componenti e schema delle ricette
- Story 2.3: Package dei contratti (Badge, Input, Accordion)
- Story 2.4: Bootstrap della library Penpot sui contratti
- Story 2.5: Estrazione adeguata — ricette per parti e token
- Story 2.6: Emitter shadcn deterministico e gate CI
- Story 2.7: Pipeline pronta per più componenti
- Story 2.8: Registro delle proprietà e blocco per componente
- Story 2.9: Skill pds-component — creare e sincronizzare
- Story 2.10: Fedeltà live ed estrazione guidata dal contratto
- Story 2.11: Storybook del design system
- Story 2.12: Fondamenta v2 — due contratti, registro, guscio
- Story 2.13: library e propose — Penpot dal contratto di estrazione
- Story 2.14: extract e render — una istantanea, quattro file
- Story 2.15: ProductCard end-to-end e gate in CI
- Story 2.16: Rimozione della v1 e rigenerazione dei quattro componenti
- Story 2.17: Skill pds-* sui sei comandi
- Story 2.18: Libreria componenti accessibile

## Requirements & Constraints

- **Storie v1 congelate:** le Story 2.1–2.10 descrivono un regime in servizio fino alla 2.16. Non vanno riscritte né estese; vanno solo tenute verdi finché la rimozione non le cancella.
- **Token data-driven:** la generazione dipende dal tipo di token, mai dal nome del set; un nuovo set Penpot produce una nuova sezione senza toccare il codice. Output: CSS custom properties (Tailwind v4 `@theme`) + scala TS, da catalogo committato così la generazione gira offline. Le variabili senza corrispondenza Penpot vivono in un file separato non generato.
- **Contratto ridotto:** nel fingerprint contano solo nome, versione, assi `option`, field e slot. La versione di schema sale una sola volta; fino alla rimozione i vecchi campi restano tollerati come estensione deprecata fuori dal fingerprint e poi spariscono senza nuovo bump.
- **Una sola istantanea:** scritta solo dal comando di estrazione (scrittura atomica), validata contro entrambi i contratti, con provenienza Penpot e celle per combinazione di varianti. Il suo diff in PR è la review del design; la modalità di controllo confronta senza scrivere.
- **Render senza basi:** genera componente, test, story e barrel marcati come generati con provenienza. La rigenerazione dà diff zero, i file senza marker non si sovrascrivono mai, i fallimenti su più componenti si accumulano e si elencano alla fine.
- **Disciplina dei comandi:** solo il comando di library scrive su Penpot, solo l'estrazione scrive l'istantanea, estrazione e render non girano mai in CI né in build, il comando di proposta stampa solo diff e non scrive mai. Errori tipizzati con quattro exit code (input, Penpot, contratto, gate) e un solo guscio CLI.
- **Mai infedele in silenzio:** ciò che la pipeline non sa esprimere blocca il solo componente con messaggio nominativo (componente, cella, parte, proprietà). Nessuno skip silenzioso, nessuna invenzione di valori o celle mancanti.
- **Registro unico:** ogni proprietà Penpot entra con una riga (lettura, tipo token o lista chiusa, mappatura) più prova rosso/verde; include anche layout e posizione letti dal layer, così nessuna classe entra a mano. Una proprietà fuori ruolo o fuori registro blocca con adattamento in ordine: designer, registro, contratto di estrazione.
- **CI per componente:** gate di rigenerazione a diff zero + suite + test di accessibilità con report per componente; un componente divergente nomina solo sé stesso. Nella finestra di convivenza girano entrambi i gate (v1 e v2). Nessun comando live in CI.
- **ProductCard senza codice a mano:** varianti con e senza sconto, tag ripetuti e immagine arrivano in libreria solo via estrazione e render, con giudizio visivo registrato nella story di Storybook.
- **Rimozione pulita:** con la v1 escono dati v1, comandi v1, quattro componenti generati e le vecchie dipendenze di comportamento; entra il nuovo headless. I quattro componenti rinascono uno alla volta dalla v2, con controllo dei consumatori e rivalutazione del menu scritto a mano.
- **Skill riscritte:** nessun riferimento ai comandi v1; creazione guidata (assi e field, poi parti e rendering), sincronizzazione per stato (drift, Penpot avanti, errore di contratto), esito sempre dall'exit code.
- **Libreria finale:** sei domini costruiti via procedura guidata, comportamento headless dichiarato per parte, test di accessibilità verdi ovunque, divieto di import dal livello editor verificato da lint. I componenti senza headless o con logica propria hanno contratto completo, segnaposto in Penpot e adapter scritto a mano senza marker, ignorato dalla pipeline.

## Technical Decisions

- **Due contratti, dipendenza in un verso solo:** il contratto del page builder descrive solo ciò che editor e pagine salvate usano; il contratto di estrazione lo importa e dichiara come si legge da Penpot e come si rende (assi di rendering, parti con ruolo, presenza condizionale, ripetizioni, albero, alias di layer, headless, accessibilità). Contraddirlo è errore a caricamento modulo che nomina parte e campo. Il page builder non conosce mai Penpot.
- **Tipi di asse:** `option` è prop dell'editor e stile per variante; `state` è prefisso browser senza prop; `behavior` è selettore di stato dell'headless senza prop. Penpot disegna tutti gli assi come celle; una cella mancante è errore di contratto.
- **Ruoli di parte:** vocabolario chiuso (superficie, testo, icona, divisore, immagine) dichiarato nel contratto di estrazione, mai in Penpot. La tabella ruolo→proprietà ammesse vive nel registro. L'immagine ammette raggio, opacità, layout e posizione ma nessun riempimento, perché il contenuto arriva dal campo dati.
- **Legame col design:** plugin data sul container delle varianti scritto solo dalla library; nome container come controllo incrociato; fallimento su duplicati, nomi incoerenti o contratti senza container.
- **Composizione diversa da componente:** accordion root, hero e sezioni sono definizioni di dati con slot dichiarati, non componenti estratti.
- **Confini dei package:** contratti e token sono foglie a zero dipendenze UI; il frontend consuma solo il design system; l'headless si importa solo dal livello domini della libreria; i domini non importano mai dall'editor. Confini tenuti da lint bloccante.

## UX & Interaction Patterns

- Focus visibile con contrasto adeguato su ogni componente interattivo, mai rimosso senza sostituto equivalente; stato comunicato sempre con testo più colore, mai solo col colore.
- Semantica ARIA corretta per tipo (dialoghe modali con focus trap, toast con live region, tabelle con caption, tab, menu, breadcrumb con pagina corrente); live region educata per salvataggi e cambi di stato, assertiva solo per errori bloccanti.
- Overlay su portale root condiviso sopra il canvas dell'editor, tooltip escluso.
- Primitive rigide e composizioni elastiche: nessun comportamento disegnato in Penpot, nessuna parte opzionale nel contratto; gli elementi composti nascono come composizioni di parti semplici.

## Cross-Story Dependencies

- **Sequenza obbligata:** token prima di tutto; contratti prima di bootstrap ed estrazione; Storybook prima del giudizio visivo sulla card; fondamenta v2 prima di library, estrazione e render; card dimostrata prima della rimozione; rimozione prima delle skill riscritte; skill riscritte prima della libreria dei sei domini.
- **Finestra a due pipeline:** dalla card dimostrata alla rimozione la v1 resta intatta e verde accanto alla v2; dopo la rimozione esiste una sola pipeline.
- **Da Epic 1:** monorepo, build, test e infrastruttura di CI.
- **Verso Epic 3:** contratti, scala token e libreria di domini; le sezioni potranno riusare ruoli di parte e definizioni di dati.
