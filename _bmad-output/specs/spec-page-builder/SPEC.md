---
id: SPEC-page-builder
companions:
  - ./design-system.md
  - ./penpot-pipeline.md
  - ./rbac-matrix.md
  - ./a11y-baseline.md
  - ./glossary.md
  - ../../planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md
sources: []
---

> **Canonical contract.** Questo SPEC e i file in `companions:` sono il contratto completo e validato per cosa costruire, testare e verificare. La cartella `docs/` del progetto è materiale di **riferimento ereditato** da un'altra codebase: consultarla solo per colore narrativo, mai come descrizione del target — questo SPEC prevale.

# Page Builder — design system end-to-end (riscrittura stack-agnostica)

## Why

Esiste già un prodotto end-to-end che va dal design al codice fino alla pubblicazione di pagine: i design token e i componenti vivono in **Penpot** e vengono generati in un design system (token → primitive accessibili → blocchi per l'editor → composizioni di prodotto), e su questo un editor drag-and-drop consente di comporre pagine, versionarle, pubblicarle con ruoli e audit. L'implementazione di riferimento è però legata a uno stack legacy (JHipster/Spring Boot, Strapi CMS, Keycloak, Postgres/Envers) che si sta **rimuovendo per riscrivere il workspace da zero** su Better-T-Stack. Questo SPEC cattura il **WHAT** — intento di prodotto, feature, UX, design system — in forma **agnostica rispetto allo stack**, così che sopravviva allo swap tecnologico: il "come costruirlo" è deliberatamente rimandato alla fase architecture. Il fine di prodotto è costruire pagine — e **vetrine e-commerce** — agganciando i blocchi a una sorgente commerce esterna (Shopify e/o backend proprio), mantenendo la sorgente intercambiabile. È insieme una **vision da realizzare** (il flusso design→pagina/vetrina pubblicata) e un **mandato** (il cutover tecnologico) che rende necessario fissare ora, in modo stabile, cosa deve continuare a esistere.

## Capabilities

- **CAP-1 — Pipeline token design→codice**
  - **intent:** estrarre i design token da Penpot e generare lo strato token (colori/tipografia/spacing/radii/ombre) consumato dalla UI.
  - **success:** la rigenerazione produce artefatti token (variabili CSS + scala tipizzata) raggruppati per set Penpot; un nuovo set produce una nuova sezione senza modifiche al codice (data-driven); i file generati sono marcati `@generated` e non editabili a mano. Dettaglio → [penpot-pipeline.md](./penpot-pipeline.md).

- **CAP-2 — Generazione componenti design→codice**
  - **intent:** generare primitive accessibili dai componenti Penpot, mappando la matrice di varianti Penpot in un modello di varianti.
  - **success:** la pipeline emette componente + test + story + barrel; i file scritti a mano sono preservati (skip salvo forzatura); un gate di completezza artefatti passa in CI.

- **CAP-3 — Libreria di primitive accessibili**
  - **intent:** offrire una libreria di componenti UI headless/accessibili organizzati per dominio (data-display, inputs, feedback, layout, navigation, overlays).
  - **success:** ogni componente interattivo rispetta la [a11y-baseline](./a11y-baseline.md) (focus visibile, stato=testo+colore, ARIA corretto), verificato da test di accessibilità automatici. Catalogo → [design-system.md](./design-system.md).

- **CAP-4 — Blocchi del page-builder**
  - **intent:** incapsulare le primitive come blocchi dell'editor, con campi validati da schema e controlli guidati dai token, aggregati in un'unica config con slot annidabili.
  - **success:** l'editor renderizza i blocchi; una modifica ai token spacing/radii si propaga sia agli stili sia alle opzioni dei campi dei blocchi.

- **CAP-5 — Composizioni di prodotto per l'editor**
  - **intent:** fornire componenti composti con la semantica dell'editor page-builder (LifecycleBadge, SaveStateIndicator, TopBar, PageList, VersionList, EmptyState), costruiti solo su primitive+token.
  - **success:** la shell dell'editor usa queste composizioni; la regola di confine regge: una primitiva non conosce il dominio page-builder.

- **CAP-6 — Authoring drag-and-drop delle pagine**
  - **intent:** un utente autorizzato costruisce/modifica una pagina visivamente con l'editor a blocchi; il layout è persistito come payload strutturato (forma Puck `{content, root, zones}`, con `schemaVersion` e id di blocco stabili).
  - **success:** una pagina reale fa round-trip **lossless** (salva→ricarica identico) e viene renderizzata correttamente.

- **CAP-7 — Salvataggio bozza / autosave**
  - **intent:** salvare il layout corrente come nuova versione DRAFT.
  - **success:** il salvataggio crea una nuova versione DRAFT; lo stato salvato/non-salvato è comunicato all'utente (regione `aria-live`).

- **CAP-8 — Versioning e pubblicazione**
  - **intent:** mantenere una cronologia versioni per pagina e promuovere una versione a PUBLISHED.
  - **success:** pubblicare una seconda versione retrocede atomicamente la precedente a DRAFT; l'invariante **≤1 PUBLISHED per pagina** regge in modo autoritativo.

- **CAP-9 — Rollback**
  - **intent:** ripristinare una pagina a una versione precedente promuovendola a PUBLISHED e retrocedendo l'attuale.
  - **success:** dopo il rollback la versione scelta è quella pubblicata.

- **CAP-10 — Lifecycle pagina (archive/restore)**
  - **intent:** gestire gli stati DRAFT/PUBLISHED/ARCHIVED, con archiviazione che preserva le versioni e restore che riporta a DRAFT.
  - **success:** le versioni di una pagina archiviata restano preservate; il restore riporta la pagina a DRAFT.

- **CAP-11 — Render pubblico per slug (anche vetrina e-commerce)**
  - **intent:** rendere una pagina tramite slug: versione pubblicata di default, ultima bozza su richiesta. La pagina pubblicata è anche il render della vetrina e-commerce, dove i blocchi commerce (CAP-15) risolvono i dati a render-time.
  - **success:** la lettura by-slug restituisce il payload pubblicato di default e la variante draft su richiesta; una pagina con blocchi commerce mostra dati commerce reali risolti a render-time.

- **CAP-12 — Authoring basato sui ruoli (RBAC)**
  - **intent:** governare le operazioni tramite i ruoli Admin/Editor/Cliente, deny-by-default, con enforcement server-side su ogni via di modifica.
  - **success:** il server rifiuta le operazioni fuori-ruolo a prescindere dalla UI; un Cliente salva solo-contenuto su una pagina assegnata ma non può pubblicare. Matrice → [rbac-matrix.md](./rbac-matrix.md).

- **CAP-13 — Classificazione campi structure vs content**
  - **intent:** mantenere una single source of truth che classifica i campi di ogni blocco come structure o content, pilotando sia i permessi dell'editor sia la sanitizzazione lato server.
  - **success:** i campi content sono sanitizzati al salvataggio/publish; campi o componenti sconosciuti sono trattati come content di default (fail-safe).

- **CAP-14 — Audit trail**
  - **intent:** conservare uno storico immutabile di chi ha cambiato cosa e quando su pagine/versioni, consultabile dall'Admin.
  - **success:** un admin recupera la cronologia revisioni per una pagina e per utente.

- **CAP-15 — Integrazione commerce pluggable**
  - **intent:** un autore compone pagine con blocchi data-driven commerce (es. ProductCard/ProductGrid/AddToCart) che agganciano dati di catalogo/carrello da una sorgente commerce esterna, senza vincolare i blocchi a una sorgente specifica (astrazione di provider intercambiabile).
  - **success:** uno stesso blocco commerce rende dati da sorgenti diverse cambiando solo l'adapter del provider (nessuna modifica ai blocchi); il render della pagina mostra dati commerce reali risolti a render-time.

## Constraints

- **Penpot è la single source of truth dei valori di design.** Token e componenti sono *generati*, non scritti a mano; la pipeline token resta data-driven dal catalogo Penpot (nuovo set ⇒ nuova sezione di output senza toccare il codice). Aderenza stretta: usare esattamente i valori del design, mai inventare valori mancanti (solo default neutri).
- **Gli artefatti generati portano il marker `@generated` e non si editano a mano**; la rigenerazione deve preservare i file scritti a mano (skip salvo forzatura).
- **Il payload di layout è la forma Puck `{content, root, zones}` accettata 1:1**, senza riscrittura della struttura; ogni blocco porta un id stabile indipendente dalla posizione (abilita diff/audit a livello di blocco).
- **Lo storico dei contenuti è modellato tramite versioni di pagina esplicite**; l'audit copre solo metadati immutabili — non duplicare l'intero blob di contenuto nello store di audit.
- **Autorizzazione deny-by-default ed enforced lato server**, non tramite semplice nascondimento della UI. **Copertura totale:** nessuna via di modifica di pagine/versioni può restare fuori dall'enforcement (l'anti-pattern legacy degli endpoint CRUD generici scoperti non va riprodotto).
- **Invariante autoritativo:** al più una versione PUBLISHED per pagina (garantito in modo autoritativo, non solo nella logica applicativa).
- **A11y baseline obbligatoria — target WCAG 2.1 AA** — per ogni primitiva/composizione (focus visibile, stato=testo+colore, ARIA corretto, overlay su portale root condiviso sopra il canvas). Dettaglio → [a11y-baseline.md](./a11y-baseline.md).
- **Il frontend del page-builder DEVE consumare il design system** (composizioni `ui` + primitive), non uno stack UI parallelo. Il drift legacy (l'app che usava una UI toolkit generica invece delle composizioni del design system) è un anti-pattern esplicito da non ripetere.
- **Confine di layering del design system:** tokens ← primitives ← {puck-components, ui}; le primitive non importano mai da `ui` né conoscono il dominio page-builder.

## Non-goals

- **Scelte di stack/tecnologia** (framework backend, database, auth provider, ORM, transport API): rimandate alla fase architecture. Lo SPEC è stack-agnostico. L'implementazione precedente (JHipster/Spring Boot, Strapi, Keycloak, Postgres/Envers) è **solo riferimento** ed è esplicitamente scartata.
- **Il page-builder legacy su Strapi CMS** e il suo content model.
- **La migrazione dati** dallo store legacy al nuovo backend (era rimandata a un'epica futura): fuori scope in questo SPEC salvo re-ingaggio esplicito.
- **La UI di gestione fine-grained dell'assegnazione Cliente↔pagina** oltre al concetto: l'assegnazione esiste come capability, la sua gestione avanzata è fuori scope qui.
- **La scelta della sorgente commerce concreta** (Shopify vs backend proprio vs entrambi) e la sua implementazione: decise a valle. Lo SPEC fissa solo il requisito di intercambiabilità (CAP-15), restando agnostico anche verso la sorgente commerce.
- **La logica commerce vera e propria** (catalogo, pricing, carrello, checkout, ordini): vive nella sorgente esterna, non nel page-builder, che si limita ad agganciarne i dati.

## Success signal

Un workspace riscritto in cui i token e i componenti di un designer in Penpot fluiscono, per rigenerazione, in primitive e blocchi; un Editor costruisce una pagina in drag-and-drop da quei blocchi, salva bozze e pubblica con ruoli enforced e con l'invariante "una sola versione pubblicata"; un visitatore vede la pagina pubblicata via slug — il tutto sull'UI del design system stesso e **indipendente dallo stack backend** che lo alimenta. Dimostrabile end-to-end: Penpot→token→blocco→pagina pubblicata→render by-slug, con RBAC e audit verificati da test.

## Assumptions

- Penpot resta il tool di design sorgente e la pipeline di generazione è preservata come parte del target (richiesta esplicita "preservare la pipeline Penpot"); solo il backend applicativo cambia.
- I ruoli di dominio (Admin/Editor/Cliente) e il modello Page/PageVersion sono concetti di prodotto, non artefatti dello stack scartato, e vengono preservati stack-agnosticamente; l'identità utente sarà fornita dallo stack scelto in fase architecture.
- Le pagine mescolano contenuto statico del design system e blocchi commerce data-driven; la vetrina e-commerce è servita dal page-builder stesso, con i dati commerce risolti server-side a render-time via il provider (CAP-15).
