---
name: "Page Builder — Experience"
description: "Comportamento, IA e flussi dell'editor drag-and-drop, del render pubblico e della vetrina commerce."
status: final
updated: 2026-07-26
sources:
  - "_bmad-output/specs/spec-page-builder/SPEC.md"
  - "_bmad-output/specs/spec-page-builder/design-system.md"
  - "_bmad-output/specs/spec-page-builder/a11y-baseline.md"
  - "_bmad-output/specs/spec-page-builder/penpot-pipeline.md"
  - "_bmad-output/specs/spec-page-builder/rbac-matrix.md"
  - "_bmad-output/specs/spec-page-builder/glossary.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md"
---

> Su conflitto con mock, wireframe o import, questo file e [DESIGN.md](./DESIGN.md) vincono sempre.

## Foundation

- **Form-factor:** multi-surface con due registri distinti.
  - **Authoring (Admin/Editor):** desktop-first, denso, professionale. Nessun supporto mobile/tablet previsto in questa fase [ASSUMPTION — da confermare se mai serve authoring da tablet].
  - **Authoring semplificato (Cliente):** desktop-first, ma UI ridotta ai soli campi `content` editabili sulla pagina assegnata — vista distinta dall'editor denso, non la stessa UI con campi disabilitati.
  - **Render pubblico (Visitatore):** responsive multi-device (mobile/tablet/desktop) — vetrina e-commerce e pagine di contenuto.
- **UI system:** design system proprietario generato da Penpot (vedi [DESIGN.md](./DESIGN.md)) — nessun UI kit di terze parti nel frontend applicativo (vincolo SPEC esplicito).
- **Ruoli che guidano ogni schermata:** Admin (superset + audit), Editor (crea/pubblica/rollback/archivia), Cliente (content-only su pagina assegnata), Visitatore anonimo (solo lettura pubblicata).

## Information Architecture

```
/login                              — accesso (Admin/Editor/Cliente)
/pages                              — PageList (Admin, Editor) → [mock](./mockups/key-pagelist.html)
  /pages/[id]/editor                — editor denso drag-and-drop (Admin, Editor) → [mock](./mockups/key-editor-canvas.html)
  /pages/[id]/editor?version=draft  — anteprima bozza dinamica, non cachata (Admin, Editor)
  /pages/[id]/versions              — VersionList / storico versioni (Admin, Editor)
/my-pages                           — vista Cliente: sole pagine assegnate
  /my-pages/[id]/editor             — editor semplificato content-only (Cliente)
/audit                              — audit trail (solo Admin)
/[slug]                             — render pubblico by-slug (chiunque, anonimo incluso) → [mock](./mockups/key-storefront.html)
```

Spine-only (nessun mock visivo, per scelta esplicita — sufficientemente descritte dalle tabelle sopra): `/login`, `/pages/[id]/versions`, `/my-pages` + `/my-pages/[id]/editor` (vista Cliente semplificata), `/audit`.

- **PageList vs /my-pages:** stessa capability sottostante (elenco pagine), due composizioni UI diverse per via del confine RBAC — un Cliente non vede mai pagine non assegnate, nemmeno in lista (non solo azioni disabilitate: la query stessa è scoperta per assegnazione).
- **`/pages/[id]/editor` vs `/[slug]`:** l'editor lavora sempre sull'ultima bozza/versione selezionata; il render pubblico mostra di default la PUBLISHED e la draft solo su richiesta esplicita e autorizzata (CAP-11).
- **`/audit`:** unica rotta ad accesso esclusivo Admin; un non-Admin che ci arriva riceve 404 (non 403) — non si rivela nemmeno l'esistenza della funzionalità (da Story 5.4 in epics.md).
- Surface closure: ogni capability dello SPEC (CAP-1…15) ha una superficie che la eroga sopra; le capability di generazione (CAP-1,2) non hanno superficie UI diretta — sono pipeline build-time, non schermate.

## Voice and Tone

[ASSUMPTION — nessun brief di tono ricevuto; dedotto dallo stakes "consumer/commerciale" + registro "professionale"]

- **UI di authoring (Admin/Editor/Cliente):** diretta, funzionale, mai giocosa. Messaggi di stato brevi e specifici ("Bozza salvata alle 14:32", non "Fatto!"). Errori sempre azionabili: cosa è andato storto + cosa fare.
- **Contenuto delle pagine pubblicate:** il tono qui appartiene a chi scrive il contenuto (Editor/Cliente), non al prodotto — il page-builder non impone una voce editoriale al contenuto delle pagine.
- **Etichette lifecycle obbligatorie** (da a11y-baseline.md, non negoziabili): "Bozza" (DRAFT), "Pubblicata" (PUBLISHED), "Archiviata" (ARCHIVED) — usare sempre questi tre termini, mai sinonimi, per coerenza cross-superficie.

## Component Patterns

Specifica comportamentale (i visual spec vivono in DESIGN.md.components):

- **TopBar** — breadcrumb (Pagine > [titolo pagina]) + `LifecycleBadge` + azioni Salva/Anteprima/Pubblica. Pubblica è disabilitato (non nascosto) quando l'utente non ha permesso — coerente col principio "deny-by-default enforced server-side, non solo nascondimento UI": la UI comunica lo stato ma il server resta l'autorità.
- **PageList** — tabella con menu azioni (Modifica/Archivia) + stato vuoto (`EmptyState`) quando non esistono pagine. Righe filtrabili per lifecycle [ASSUMPTION — non specificato nello SPEC, dedotto da "storico versioni" e utilità pratica di liste con molte pagine].
- **VersionList** — elenco versioni con azione di ripristino (rollback); la versione PUBLISHED corrente è visivamente distinta dalle DRAFT storiche (badge + posizione, non solo colore).
- **SaveStateIndicator** — 3 stati: "Salvato" / "Salvataggio…" / "Modifiche non salvate", annunciati via `aria-live="polite"` (mai un solo stato "Salvato" statico che nasconde il salvataggio in corso).
- **Blocchi Puck (Box/Grid/Columns/Spacer/Hero/Section + blocchi su primitiva)** — ogni blocco in editing mostra un affordance di selezione/hover chiara (outline) distinta dal focus-visible da tastiera (due segnali visivi diversi, stesso principio "mai solo colore").
- **Blocchi commerce (ProductCard/ProductGrid/AddToCart)** — in editor mostrano dati di anteprima/placeholder quando il provider non è raggiungibile o il prodotto referenziato non esiste più; in pagina pubblicata un prodotto rimosso dal catalogo non deve rompere il render (stato vuoto/fallback, non errore fatale) — [ASSUMPTION, gap non coperto esplicitamente da SPEC CAP-15, da confermare].

## State Patterns

- **Lifecycle pagina:** DRAFT ⇄ PUBLISHED ⇄ ARCHIVED. Le transizioni non sono tutte simmetriche: Archiviata → solo Restore (torna a DRAFT, mai direttamente a PUBLISHED — coerente con Story 5.3).
- **Salvataggio:** idle → salvataggio in corso → salvato | errore. Un errore di salvataggio è `assertive` (interrompe), mai silenzioso — rischio di perdita lavoro.
- **Empty states:** PageList senza pagine (Editor: CTA "Crea la prima pagina"; Cliente: messaggio neutro, nessuna pagina assegnata — nessuna CTA di creazione, coerente con RBAC), VersionList con una sola versione (nessun rollback disponibile, azione disabilitata con motivo).
- **Errori di permesso:** un Cliente che tenta un'azione fuori dal proprio scope (es. pubblicare) non deve nemmeno vedere l'azione abilitata nell'editor semplificato — ma se raggiunta via URL diretto, l'errore server-side deve tradursi in un messaggio comprensibile, non in una schermata rotta. Accessibilità dell'errore (non opzionale, coerente con a11y-baseline §4 assertive): `role="alert"`/`aria-live="assertive"`, e il focus va portato esplicitamente sul messaggio d'errore (mai lasciato al default del browser) — un utente da tastiera/screen reader non deve perdere il contesto se il layout cambia.
- **Provider commerce irraggiungibile / prodotto rimosso dal catalogo:** stato di errore esplicito nel blocco, sia in editor sia in pagina pubblicata — mai un layout silenziosamente vuoto che sembra un bug. In pagina pubblicata il fallback porta anche un `aria-label` descrittivo (es. "Prodotto non più disponibile"), non solo un'indicazione visiva, per un visitatore che usa screen reader.
- **Render pubblico `/[slug]` — non trovato:** uno slug senza versione pubblicata, o corrispondente a una pagina ARCHIVED, risponde con uno stato not-found esplicito (coerente con CAP-11 "nessuna lettura anonima espone dati non pubblicati") — non un errore generico né una pagina vuota indistinguibile da un bug.

## Interaction Primitives

- **Drag-and-drop editor — equivalente da tastiera e screen reader (non negoziabile, WCAG 2.1 AA/NFR1):** meta-modello **WAI-ARIA APG "Reorder" (grab-mode)**, applicato sopra il modello di drag interno di Puck (non in astratto — la keyboard-parity va progettata contro quel modello specifico):
  - **Afferra:** `Spazio`/`Invio` su un blocco selezionato entra in modalità "sposta" (stato annunciato via live region dedicata, distinta dal `SaveStateIndicator`: "Hero afferrato, usa le frecce per spostare").
  - **Sposta:** frecce direzionali spostano il blocco tra posizioni/slot validi; uno spostamento su un drop-target non valido (es. Hero dentro AddToCart) non si applica e lo screen reader annuncia il rifiuto.
  - **Rilascia:** `Spazio`/`Invio` conferma la nuova posizione; `Escape` annulla e riporta il blocco alla posizione originale.
  - **Uscita senza spostare:** `Tab` esce dal blocco lasciandolo dov'era.
  - **Esposizione struttura:** il canvas è esposto come albero (`role="tree"`/`role="treeitem"`, o in alternativa `role="application"`) con `aria-label` di posizione, es. "Hero, blocco 1 di 3, dentro Section" — la tastiera risolve l'operabilità motoria, questo risolve la leggibilità screen reader (sono due assi distinti, entrambi richiesti).
  - **Vale anche per resize/nesting** di blocchi contenitore (Grid/Columns/Section), non solo per riordino lineare.
  - **Criterio di accettazione:** non solo axe automatico — richiede un test manuale con almeno uno screen reader reale (NVDA/VoiceOver) prima di considerare l'Epic editor completa.
  - Riferimento visivo: [mock editor canvas](./mockups/key-editor-canvas.html) (nota tastiera inclusa nel mock).
- **Autosave:** trigger su pausa di input (debounce) — non richiede un'azione esplicita "Salva" per la bozza, ma "Salva" resta disponibile come azione esplicita/rassicurante in TopBar [ASSUMPTION sul meccanismo di trigger, CAP-7 specifica solo il risultato non il trigger].
- **Pubblica/Rollback/Archivia:** azioni distruttive/di stato — richiedono conferma esplicita (dialog modale con focus trap, focus iniziale sull'azione meno distruttiva "Annulla", messaggio d'impatto esplicito) prima dell'esecuzione, dato l'impatto (retrocessione automatica della versione precedente). Riferimento visivo: [mock dialog pubblicazione](./mockups/key-publish-dialog.html).
- **Focus management overlay:** Dialog aperto → focus trap + focus iniziale sul primo elemento interattivo; alla chiusura, focus torna al trigger (da a11y-baseline.md, non negoziabile).

## Accessibility Floor

Eredita integralmente [a11y-baseline.md](../../../specs/spec-page-builder/a11y-baseline.md) come pavimento comportamentale (i contrasti visivi concreti vivono in DESIGN.md):
- Focus visibile su ogni interattivo, mai `outline:none` senza sostituto.
- Ogni stato = testo + colore, mai solo colore (lifecycle, feedback, validazione form).
- ARIA corretta per tipo (Dialog/Toast/Table/Tabs/Dropdown/Breadcrumb) come da baseline.
- `aria-live="polite"` per operazioni di background (save, cambio lifecycle); `assertive` per errori bloccanti.
- Target **WCAG 2.1 AA** — nota ereditata come "da confermare" nella fonte; qui trattato come requisito fermo salvo diversa indicazione.
- Percorso da tastiera **e** esposizione screen reader per il drag-and-drop (vedi Interaction Primitives) — estensione non esplicita nello SPEC ma necessaria per coerenza col target dichiarato; non più solo assumption, ora specificata come meccanismo concreto.

## Responsive & Platform

- **Authoring (Admin/Editor/Cliente):** desktop-only in questa fase — nessun breakpoint mobile/tablet da progettare per l'editor. Se in futuro servisse authoring da tablet, è una revisione esplicita di questa spina, non un'estensione implicita.
- **Render pubblico:** responsive standard (mobile/tablet/desktop). I blocchi Puck (Grid/Columns/Section/Hero) devono avere un comportamento di collasso/responsive definito per ciascun breakpoint — [ASSUMPTION: breakpoint specifici non forniti, da allineare con DESIGN.md.spacing quando i token reali saranno disponibili].
- **Anteprima draft (`?version=draft`):** eredita il layout responsive del render pubblico (stessa resa, diversa sorgente dati), non un layout separato.
- **Accessibilità mobile del render pubblico (non negoziabile, WCAG 2.1 AA/consumer e-commerce):**
  - **Touch target ≥44×44px** per ogni CTA commerce (AddToCart, filtri, navigazione) — criterio 2.5.5, best practice consumer/commerce indipendentemente dalla versione WCAG target.
  - **Reflow senza scroll orizzontale a 320px** di larghezza (WCAG 1.4.10).
  - **Zoom fino al 400%** senza perdita di contenuto o funzionalità (WCAG 1.4.4 Resize text).
  - **Nessun blocco di orientamento** imposto (portrait-only lock) salvo necessità essenziale — nessuna nel caso di una vetrina e-commerce.

## Key Flows

### Marco, Editor — compone e pubblica una pagina prodotto

Marco lavora nel team marketing di un retailer. Deve pubblicare una landing per il lancio di una nuova collezione entro venerdì.

1. Accede da `/pages`, vede l'elenco delle pagine esistenti con stato lifecycle visibile a colpo d'occhio (badge testo+colore).
2. Clicca "Crea pagina", entra nell'editor denso: pannello blocchi a sinistra, canvas al centro, proprietà a destra.
3. Trascina un blocco Hero, poi una ProductGrid agganciata al catalogo reale (i prodotti risolvono dati live dal provider commerce anche in editing, non solo a render-time).
4. Continua a modificare per 20 minuti: il SaveStateIndicator passa più volte da "Modifiche non salvate" a "Salvato" senza che Marco debba mai premere un pulsante esplicito.
5. Vuole vedere come apparirà pubblicata: clic su "Anteprima" → si apre il render dinamico non cachato della bozza corrente, protetto (solo lui autenticato lo vede).
6. Soddisfatto, clic su "Pubblica" → dialog di conferma ("Questo sostituirà la versione attualmente pubblicata") → conferma.
7. **Climax:** la vecchia versione pubblicata retrocede automaticamente a Bozza nello stesso istante, la nuova appare come "Pubblicata" nel badge, e in pochi secondi `/collezione-estate` mostra il nuovo contenuto ai visitatori reali.

**Failure:** Marco annulla il dialog di conferma pubblicazione all'ultimo momento — nessuna modifica di stato avviene, la bozza resta bozza, nessun messaggio d'errore (non è un errore, è una scelta). Se invece il salvataggio autosave fallisce (errore API), il SaveStateIndicator passa a stato errore (`assertive`) e Marco viene avvisato di non chiudere la scheda finché non riprova.

### Giulia, Cliente — aggiorna il testo di una pagina assegnata

Giulia gestisce i contenuti per un singolo cliente del retailer, senza competenze tecniche. Non ha accesso a `/pages`, solo a `/my-pages`.

1. Accede e vede solo la sua pagina assegnata — nessuna lista di pagine altrui, nessuna opzione "Crea pagina".
2. Apre l'editor semplificato: vede solo i campi di testo/immagine modificabili (content), non i controlli di layout/struttura (spacing, varianti, slot) che restano bloccati.
3. Corregge un prezzo mostrato nel blocco RichText e sostituisce un'immagine.
4. Salva — crea una nuova bozza, esattamente come per Marco, ma **non vede** il pulsante Pubblica: solo Admin/Editor promuovono a pubblicata.
5. **Climax:** Giulia chiude il browser fiduciosa che le modifiche siano al sicuro come bozza, sapendo che serve un Editor per renderle visibili — nessuna ambiguità sul suo potere reale.

**Failure:** Giulia riceve un link diretto a un'azione fuori dal suo scope (es. un URL di pubblicazione condiviso per errore da un collega). Il server rifiuta l'operazione; il messaggio d'errore è annunciato con `role="alert"`/`aria-live="assertive"` e il focus viene portato esplicitamente sul messaggio — Giulia capisce cosa è successo senza perdere il contesto della pagina su cui stava lavorando.

### Sara, Admin — indaga una modifica sospetta

Una pagina pubblicata mostra un prezzo sbagliato. Sara deve capire chi ha cambiato cosa.

1. Accede a `/audit` (rotta invisibile/404 per chiunque non sia Admin).
2. Filtra per pagina, vede lo storico immutabile: actor, azione, timestamp, diff dei metadati (non il blob completo).
3. Identifica la versione e l'autore del cambiamento.
4. Va su `/pages/[id]/versions`, individua la versione precedente corretta.
5. **Climax:** esegue il rollback — la versione corretta torna PUBLISHED, l'attuale (errata) retrocede a Bozza, e l'intera operazione viene essa stessa scritta come nuova riga d'audit, chiudendo il cerchio della tracciabilità.

**Failure:** Sara tenta il rollback su una pagina che ha una sola versione in assoluto (nessuna precedente a cui tornare) — l'azione rollback è disabilitata in VersionList con un motivo esplicito ("Nessuna versione precedente disponibile"), non semplicemente assente.

### Priya, Editor — archivia una pagina stagionale pubblicata

La campagna "Saldi inverno" di Priya è finita. Deve ritirarla dalla vetrina senza perdere lo storico.

1. Apre `/pages`, individua la pagina PUBLISHED della campagna, apre il menu azioni.
2. Seleziona "Archivia" — dialog di conferma che avvisa esplicitamente: "La versione pubblicata sarà ritirata dalla vetrina; tutte le versioni restano preservate."
3. Conferma.
4. **Climax:** in un'unica transazione, Page.status diventa ARCHIVED e la versione PUBLISHED viene demossa — nello stesso istante `/saldi-inverno` smette di rispondere con contenuto pubblicato (stato not-found, non un errore) e l'operazione compare nell'audit trail di Sara.
5. Settimane dopo, un collega chiede di far tornare la pagina per un rilancio: Priya usa "Ripristina" da PageList — la pagina torna DRAFT con tutte le versioni storiche intatte, pronta per essere ripubblicata (non riparte da zero).

**Failure:** Priya prova ad archiviare una pagina che è già ARCHIVED (es. doppio click, tab duplicata) — l'azione è idempotente/disabilitata quando lo stato è già ARCHIVED, nessun errore confuso.

### Luca, Visitatore — acquista da mobile

Luca scopre la vetrina da un link social, sul telefono.

1. Apre `/collezione-estate` — riceve l'HTML statico (SSG) della versione pubblicata, veloce anche su rete mobile.
2. Scorre la ProductGrid, i dati (prezzo, disponibilità) sono risolti server-side al momento della generazione/render — nessuna chiamata client-side visibile che rallenti la pagina.
3. Tocca "Aggiungi al carrello" su un prodotto (blocco AddToCart) — l'azione commerce vera e propria è gestita dalla sorgente esterna, il page-builder si limita ad agganciarla.
4. **Climax:** se nel frattempo Marco pubblica un aggiornamento (es. un prezzo cambiato), la prossima richiesta di Luca alla stessa pagina riceve automaticamente il contenuto rigenerato (invalidazione ISR post-publish) — Luca non vede mai contenuto stantio oltre la finestra di rigenerazione.

**Failure:** Luca apre un link a una pagina che nel frattempo è stata archiviata, o digita male uno slug. Riceve uno stato not-found chiaro (vedi § State Patterns), non una pagina bianca o un errore generico. Se un prodotto mostrato in una ProductGrid è stato nel frattempo rimosso dal catalogo, il blocco mostra un fallback esplicito ("Prodotto non più disponibile", con `aria-label` descrittivo) invece di sparire silenziosamente o rompere il layout.
