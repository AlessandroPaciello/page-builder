---
stepsCompleted: ["step-01", "step-02", "step-03"]
inputDocuments:
  - "_bmad-output/specs/spec-page-builder/SPEC.md"
  - "_bmad-output/specs/spec-page-builder/design-system.md"
  - "_bmad-output/specs/spec-page-builder/penpot-pipeline.md"
  - "_bmad-output/specs/spec-page-builder/rbac-matrix.md"
  - "_bmad-output/specs/spec-page-builder/a11y-baseline.md"
  - "_bmad-output/specs/spec-page-builder/glossary.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md"
---

# page-builder - Epic Breakdown

## Overview

Questo documento decompone i requisiti dello SPEC (spec-kernel, in sostituzione del PRD), delle sue companion e della Architecture Spine in story implementabili. Il progetto è una **riscrittura greenfield full-TypeScript**: le prime epic coprono scaffolding e ricostruzione del design system, poi le feature del page builder e l'integrazione commerce.

> **Nota di percorso:** i Functional Requirements derivano 1:1 dalle capability dello SPEC (CAP-1…15); i vincoli tecnici (NFR/Additional) derivano dai constraint dello SPEC e dai 13 Architecture Decision (AD-1…13). Ogni story eredita gli AD pertinenti come vincolo.

## Requirements Inventory

### Functional Requirements

FR1 (CAP-1): Il sistema estrae i design token da Penpot e genera lo strato token (colori/tipografia/spacing/radii/ombre) consumato dalla UI, data-driven dal catalogo Penpot.
FR2 (CAP-2): Il sistema genera primitive React accessibili dai componenti Penpot (assi del contratto disegnati come varianti in Penpot → ricetta per parti → emitter della libreria), con componente+test+story+barrel, preservando i file scritti a mano.
FR3 (CAP-3): Il sistema offre una libreria di primitive UI headless/accessibili organizzate per dominio (data-display, inputs, feedback, layout, navigation, overlays).
FR4 (CAP-4): Il sistema espone le primitive come blocchi del page-builder con campi validati da schema e controlli guidati dai token, aggregati in un'unica config con slot annidabili.
FR5 (CAP-5): Il sistema fornisce composizioni di prodotto per l'editor (LifecycleBadge, SaveStateIndicator, TopBar, PageList, VersionList, EmptyState) costruite solo su primitive+token.
FR6 (CAP-6): Un utente autorizzato costruisce/modifica una pagina in drag-and-drop con l'editor a blocchi; il layout è persistito come payload strutturato (forma Puck {content,root,zones}, schemaVersion, block-id stabili) con round-trip lossless.
FR7 (CAP-7): Il sistema salva il layout corrente come nuova versione DRAFT (autosave), comunicando lo stato salvato/non-salvato all'utente.
FR8 (CAP-8): Il sistema mantiene una cronologia versioni per pagina e promuove una versione a PUBLISHED, retrocedendo atomicamente la precedente (≤1 PUBLISHED per pagina).
FR9 (CAP-9): Il sistema ripristina una pagina a una versione precedente (rollback), promuovendola a PUBLISHED e retrocedendo l'attuale.
FR10 (CAP-10): Il sistema gestisce il lifecycle DRAFT/PUBLISHED/ARCHIVED con archiviazione che preserva le versioni e restore che riporta a DRAFT.
FR11 (CAP-11): Il sistema rende una pagina pubblica tramite slug (versione pubblicata di default, bozza su richiesta); la pagina pubblicata è anche il render della vetrina e-commerce con dati commerce risolti a render-time.
FR12 (CAP-12): Il sistema governa le operazioni tramite i ruoli Admin/Editor/Cliente, deny-by-default, con enforcement server-side su ogni via di lettura/scrittura del dominio.
FR13 (CAP-13): Il sistema mantiene una single source of truth che classifica i campi di ogni blocco come structure o content, pilotando permessi editor e sanitizzazione server-side.
FR14 (CAP-14): Il sistema conserva uno storico immutabile (audit trail) di chi ha cambiato cosa e quando su pagine/versioni, consultabile dall'Admin.
FR15 (CAP-15): Un autore compone pagine con blocchi data-driven commerce (ProductCard/ProductGrid/AddToCart) che agganciano dati da una sorgente commerce esterna intercambiabile, senza vincolare i blocchi alla sorgente.

### NonFunctional Requirements

NFR1 (Accessibilità): Ogni primitiva/composizione rispetta WCAG 2.1 AA — focus visibile (≥3:1), stato=testo+colore (mai solo colore), ARIA corretto per tipo, overlay su portale root condiviso.
NFR2 (Sicurezza/Authz): Autorizzazione deny-by-default enforced server-side a copertura totale, su lettura **e** scrittura; nessuna via di modifica/lettura non-pubblica fuori dal core di dominio (no CRUD auto-generato).
NFR3 (Sicurezza/XSS): I campi content del payload sono sanitizzati lato server prima di persist/publish; campi/blocchi ignoti trattati come content (fail-safe).
NFR4 (Integrità dati): Invariante ≤1 PUBLISHED per pagina garantito a livello DB (indice univoco parziale); ogni salvataggio crea una nuova versione DRAFT immutabile (no mutazione in-place); versionNumber allocato dal core con UNIQUE(page_id, version_number).
NFR5 (Coerenza design↔codice): Penpot è single source of truth di valori e aspetto; il contratto dei componenti è del page builder; artefatti generati marcati @generated e mai editati a mano; la rigenerazione preserva i file scritti a mano.
NFR6 (Confine UI): Il frontend consuma esclusivamente il design system (@penpot-ds/ui), non uno stack UI stilistico parallelo; layering contracts ← {ui/domains, puck-components, domain, render}; tokens ← ui/domains ← {puck-components, ui/editor}. Le primitive headless (Radix) non sono una libreria concorrente: importabili solo da ui/src/domains.
NFR7 (Intercambiabilità commerce): I blocchi commerce e il render parlano solo al port CommerceProvider; cambiare/affiancare sorgente = cambiare un adapter, non riscrivere i blocchi.
NFR8 (Deferred — Perf): Budget di latenza render/save deliberatamente deferiti (da misurare in implementazione, non vincolati qui).

### Additional Requirements

_Da Architecture Spine (AD-1…13) e Stack — vincoli tecnici che impattano l'implementazione._

- **[STARTER] Scaffolding greenfield (Epic 1, Story 1):** workspace inizializzato con `create-better-t-stack` (3.37.0) → Next.js App Router + TypeScript; monorepo pnpm (10) + Turborepo (2); rimozione di ogni residuo legacy. Stack pinnato allo scaffold: Next 16.x, React 19, PostgreSQL 18, Prisma 7.9+, Better Auth, oRPC, Tailwind 4, Node LTS. `@puckeditor/core` 0.22.x (NB: `@measured/puck` è deprecato) è ratificato nello spine ma **installato in Epic 3/4**, non allo scaffold.
- **AD-1/AD-2 (paradigma):** core di dominio esagonale in `packages/domain` (no HTTP, no React), unico punto di accesso al dominio (mutazioni + letture non-pubbliche); adapter attorno; core estraibile.
- **AD-3/AD-11 (design system):** ricostruzione dei `packages/*` (tokens/ui/puck-components/scripts/storybook; nessun package `primitives`); token e componenti `ui/domains` generati via pipeline Penpot→codice con regime contratto → fixture → ricetta → emitter per libreria (una libreria per installazione).
- **AD-4/AD-13 (auth/authz/errori):** Better Auth (adapter Prisma) fornisce Principal+ruolo nel context oRPC; authz fine nel core; errori di dominio tipizzati → set oRPC fisso; semantica 404 (non rivelare esistenza) vs 403.
- **AD-5/AD-6 (contratti/payload):** schemi Zod + classifier structure/content + definizioni di sezione condivisi FE/BE in `packages/contracts` (`@app/contracts`, zero dipendenze UI); payload jsonb {content,root,zones}; block-id client-owned immutabili; schemaVersion di `contracts`.
- **AD-7 (integrità publish):** indice univoco parziale Postgres via migration SQL esplicita (eseguita in release, prima dell'avvio app, gate CI); publish/rollback/archive in transazione che accoppia Page.status↔PageVersion.status.
- **AD-8 (audit):** audit applicativo via unico AuditWriter → AuditLog (metadati, non il blob), consultabile solo ADMIN.
- **AD-9 (render/cache):** SSG + ISR; invalidazione via port CacheInvalidator invocato post-commit; cache draft/published disgiunte; anteprima draft dinamica non cachata e protetta.
- **AD-10 (commerce):** `packages/commerce-provider` con port canonico (DTO ProductRef, Price{amount,currency}) + adapter Shopify (Storefront API) e custom; risoluzione dati server-side a render-time (resolveData Puck).
- **Envelope operativo:** deploy container Docker self-host (Next `output: standalone`), Postgres containerizzato/gestito; ambienti dev/staging/prod; secret via env/secret manager; migration via `prisma migrate deploy`.

### UX Design Requirements

_Da a11y-baseline.md e design-system.md — trattati come requisiti di prima classe._

UX-DR1: Focus visibile WCAG AA su ogni componente interattivo (ring, contrasto ≥3:1); mai `outline:none` senza sostituto visibile.
UX-DR2: Stato comunicato da testo + colore usando i token feedback (error/success/warning/info) e le etichette lifecycle ("Bozza"/"Pubblicata"/"Archiviata").
UX-DR3: Semantica ARIA corretta per tipo di componente: Dialog (modal+labelledby+focus trap), Toast (status/alert + aria-live), Table (caption+scope), Tabs, Dropdown/Menu, Breadcrumb (aria-current).
UX-DR4: Regioni aria-live: `polite` per save/cambio lifecycle/toast informativi; `assertive` per errori bloccanti.
UX-DR5: Portale root DOM condiviso per gli overlay (Dialog/Toast/Drawer) sopra il canvas dell'editor (tooltip escluso).
UX-DR6: Composizioni editor: LifecycleBadge, SaveStateIndicator (aria-live), TopBar (breadcrumb+stato+azioni Salva/Anteprima/Pubblica), EmptyState, PageList, VersionList.
UX-DR7: Catalogo primitive per dominio (Data Display, Inputs, Feedback, Layout, Navigation, Overlays) — vedi design-system.md.
UX-DR8: Blocchi Puck con campi guidati dai token (spacing/radius) e slot annidabili (content; col1/col2/col3); sezioni rigide con slot dichiarati (allow + max).

### FR Coverage Map

FR1: Epic 2 — pipeline Penpot→token
FR2: Epic 2 — generazione componenti da Penpot
FR3: Epic 2 — libreria componenti accessibile (ui/domains)
FR4: Epic 3 — blocchi Puck token-driven
FR5: Epic 3 — composizioni editor
FR6: Epic 4 — authoring drag-and-drop
FR7: Epic 4 — autosave/bozza
FR8: Epic 5 — versioning/publish (≤1 pubblicata)
FR9: Epic 5 — rollback
FR10: Epic 5 — lifecycle archive/restore
FR11: Epic 6 — render pubblico by-slug + vetrina
FR12: Epic 1 — RBAC (fondamenta identità/ruoli); enforcement esercitato in Epic 4/5/6
FR13: Epic 3 — classificazione structure/content (definizione); enforcement in Epic 4
FR14: Epic 5 — audit trail
FR15: Epic 6 — integrazione commerce pluggable

## Epic List

### Epic 1: Fondamenta e accesso
Scaffolding greenfield del workspace (create-better-t-stack → Next.js App Router, monorepo pnpm+Turborepo), skeleton del core di dominio esagonale (packages/domain), modello dati (Page/PageVersion/PageAssignment/AuditLog + indice univoco parziale ≤1 pubblicata), autenticazione Better Auth con ruoli Admin/Editor/Cliente, envelope Docker. Outcome: un utente si autentica, il sistema riconosce il suo ruolo e la shell dell'app gira.
**FRs covered:** FR12 (fondamenta); abilita tutti gli altri. Vincoli: AD-1, AD-2, AD-4, AD-7 (schema indice), NFR2, NFR4, [STARTER].

### Epic 2: Design system — token e componenti da Penpot
Pipeline Penpot→codice (packages/scripts) che genera token (packages/tokens) e componenti React accessibili (packages/ui/src/domains) attraverso il regime contratto → fixture → ricetta → emitter (AD-11), con Storybook. Outcome: si generano token e componenti accessibili dal catalogo Penpot in modo riproducibile, conformi ai contratti del page builder, visibili e testati in Storybook.
**FRs covered:** FR1, FR2, FR3. Vincoli: AD-3, AD-5, AD-11, NFR1, NFR5, UX-DR1-5,7.

### Epic 3: Blocchi ed elementi dell'editor
Blocchi Puck come adapter dei contratti (packages/puck-components), blocchi di layout a soli token, definizioni di sezione estratte da Penpot e rigide nell'editor, classifier structure/content esteso a tutti i contratti, e composizioni di prodotto dell'editor (packages/ui/src/editor: TopBar, PageList, VersionList, LifecycleBadge, SaveStateIndicator, EmptyState). Outcome: esistono i blocchi, le sezioni e le composizioni; la config Puck è pronta per l'editor.
**FRs covered:** FR4, FR5, FR13 (definizione). Vincoli: AD-3, AD-5, AD-6, AD-11, UX-DR6,8.

### Epic 4: Editor e bozze
Editor drag-and-drop montato sui blocchi, autosave come nuova versione DRAFT, pipeline payload server-side nel core (validazione con i contratti di `@app/contracts`, inclusi allow/max degli slot, enforcement structure/content, sanitizzazione XSS), snapshot immutabili. Outcome: un Editor costruisce una pagina in drag-and-drop e la salva come bozza, con round-trip lossless.
**FRs covered:** FR6, FR7; enforcement FR13, NFR3. Vincoli: AD-1, AD-5, AD-6, AD-12, NFR2.

### Epic 5: Ciclo di vita e pubblicazione
Publish (promozione a PUBLISHED con demozione atomica, invariante ≤1 pubblicata), rollback, archive/restore con accoppiamento Page.status↔PageVersion.status in transazione, e audit trail applicativo (AuditWriter→AuditLog) consultabile da Admin. Outcome: un Editor pubblica, fa rollback e archivia pagine con l'invariante garantito e l'audit tracciato.
**FRs covered:** FR8, FR9, FR10, FR14; enforcement NFR4, FR12. Vincoli: AD-1, AD-7, AD-8, AD-13.

### Epic 6: Render pubblico e vetrina commerce
Render pubblico by-slug in SSG+ISR (proiezione pubblicata, invalidazione via CacheInvalidator post-publish, anteprima draft dinamica protetta), astrazione CommerceProvider (port + adapter di riferimento) e blocchi commerce data-driven che risolvono dati a render-time. Il render pubblico è un adapter di `@app/contracts` e usa la libreria dell'installazione (AD-5). Outcome: un visitatore vede la pagina pubblicata by-slug, inclusi dati commerce reali risolti a render-time.
**FRs covered:** FR11, FR15; NFR7. Vincoli: AD-9, AD-10, AD-4 (read pubblica).

## Epic 1: Fondamenta e accesso

Un utente si autentica, il sistema riconosce il suo ruolo e la shell dell'app gira, sopra un core di dominio e un modello dati che rispettano gli invarianti architetturali.

### Story 1.1: Scaffolding greenfield del workspace

As a sviluppatore,
I want inizializzare il workspace con create-better-t-stack e la struttura monorepo,
So that esiste una base full-TypeScript avviabile su cui costruire tutto il resto.

**Acceptance Criteria:**

**Given** un workspace vuoto (solo `docs/` legacy di riferimento)
**When** eseguo lo scaffolding con create-better-t-stack (Next.js App Router, Node LTS, Prisma, Better Auth, oRPC) e configuro pnpm + Turborepo
**Then** l'app Next parte in dev senza errori e il monorepo espone `apps/web` e la cartella `packages/`
**And** le versioni sono pinnate come da spine (Next 16.x, React 19, Prisma 7.9+, Tailwind 4) e nessun residuo legacy (JHipster/Strapi) è presente; `@puckeditor/core` non è installato in questa story.

### Story 1.2: Skeleton del core di dominio esagonale

As a sviluppatore,
I want uno scheletro di `packages/domain` con port e casi d'uso privo di dipendenze da React/HTTP,
So that la logica di dominio ha una casa unica e resta estraibile (AD-1, AD-2).

**Acceptance Criteria:**

**Given** il monorepo scaffoldato
**When** creo `packages/domain` con la struttura casi d'uso + port outbound (Repository, AuditWriter, CacheInvalidator, CommerceProvider) e un caso d'uso di prova
**Then** il package compila e i suoi test girano senza importare React né moduli HTTP/Next
**And** una regola di lint/dipendenze fallisce se `packages/domain` importa da `apps/web`.

### Story 1.3: Modello dati e invariante di pubblicazione a livello DB

As a sviluppatore,
I want le entità Page, PageVersion, PageAssignment, AuditLog con le relative migration,
So that il dominio ha persistenza e l'invariante ≤1 pubblicata è garantito dal DB (AD-7).

**Acceptance Criteria:**

**Given** Prisma configurato su PostgreSQL
**When** definisco lo schema (Page/PageVersion/PageAssignment/AuditLog, payload jsonb, status enum) e aggiungo una migration SQL esplicita con indice univoco parziale `UNIQUE(page_id) WHERE status='PUBLISHED'`
**Then** `prisma migrate deploy` applica lo schema e l'indice parziale
**And** un tentativo di inserire una seconda PageVersion PUBLISHED per la stessa Page è rifiutato dal DB.

### Story 1.4: Autenticazione con ruoli Admin/Editor/Cliente

As a utente,
I want autenticarmi e avere un ruolo riconosciuto dal sistema,
So that le operazioni successive possano essere autorizzate per ruolo (FR12 fondamenta).

**Acceptance Criteria:**

**Given** Better Auth configurato con adapter Prisma
**When** effettuo il login
**Then** ottengo una sessione valida e il mio ruolo (Admin/Editor/Cliente) è disponibile
**And** una richiesta senza sessione valida verso una risorsa protetta è respinta (deny-by-default).

### Story 1.5: Context oRPC con Principal e policy deny-by-default

As a sviluppatore,
I want che ogni procedura oRPC riceva un Principal (userId+ruolo) e passi dal core per l'autorizzazione,
So that l'RBAC sia enforced in un solo punto su ogni via di accesso (AD-4).

**Acceptance Criteria:**

**Given** una sessione autenticata
**When** invoco una procedura oRPC di prova che delega a un caso d'uso del core
**Then** il Principal è presente nel context e il core applica deny-by-default (autorizza solo se il ruolo lo consente)
**And** una procedura che tenta di accedere al dominio senza passare dal core è impedita da una convenzione/lint verificabile.

### Story 1.6: Envelope Docker e migration in release

As a operatore,
I want un'immagine Docker standalone e l'esecuzione delle migration in fase di release,
So that l'app sia deployabile in modo portabile con lo schema sempre applicato prima dell'avvio.

**Acceptance Criteria:**

**Given** l'app e le migration definite
**When** costruisco l'immagine (`output: standalone`) e avvio con docker compose (app + Postgres)
**Then** `prisma migrate deploy` gira prima dell'avvio dell'app e l'app risponde in ambiente containerizzato
**And** dev/staging/prod usano lo stesso artefatto con configurazione via env.

## Epic 2: Design system — token e componenti da Penpot

Si generano token e componenti React accessibili dal catalogo Penpot in modo riproducibile, visibili e testati in Storybook. Il regime è `contratto → fixture → ricetta → emitter` (AD-11, rivisto 2026-09-12): il contratto è del page builder (`@app/contracts`), Penpot disegna valori e aspetto; l'unico passo di giudizio è la ricetta, committata e rivedibile; il codice è funzione pura di fixture+ricetta+binding.

**Prerequisito (non è una story):** BMad Builder installato e modulo BMad `penpot-ds` creato prima della Story 2.4 (action item in `sprint-status.yaml`).

### Story 2.1: Pipeline token Penpot→codice

As a designer/sviluppatore,
I want generare i token (colori/tipografia/spacing/radii/ombre) dal catalogo Penpot,
So that i valori di design abbiano un'unica fonte generata, non scritta a mano (FR1, AD-11).

**Acceptance Criteria:**

**Given** un catalogo token Penpot (live o fixture)
**When** eseguo la generazione token
**Then** vengono prodotti `@generated` CSS custom properties (Tailwind v4 @theme) + scala TS, raggruppati per set Penpot
**And** un nuovo set Penpot produce una nuova sezione senza modifiche al codice, e i file generati portano il marker `@generated`
**And** il catalogo token letto da Penpot è serializzato in una **fixture committata**, così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design
**And** le variabili senza corrispondenza Penpot (font utility, line-height) vivono in un file separato e non generato, che la rigenerazione non tocca.

### Story 2.2: Estrazione componenti e schema delle ricette

As a designer/sviluppatore,
I want estrarre un singolo componente da Penpot e ottenerne una ricetta validata,
So that il giudizio su varianti, headless e a11y sia congelato in un artefatto rivedibile invece che disperso nel codice (FR2, AD-11).

**Acceptance Criteria:**

**Given** un componente con le sue varianti su Penpot
**When** ne chiedo l'estrazione (per-componente e su richiesta, mai in CI né in build)
**Then** sono prodotti `<comp>.fixture.json` (shape, assi e celle delle varianti, token binding, CSS raw) e `<comp>.recipe.json` (dominio, headless, modello CVA, requisiti a11y), entrambi committati
**And** la ricetta è validata contro lo schema **e** contro il vocabolario dei token dello Stadio 1: una classe con valore literal (`bg-[#3b82f6]`, `p-[7px]`) fa fallire la validazione
**And** il confine è rispettato — nella fixture solo ciò che si legge da Penpot senza sapere cosa sia React; nella ricetta ciò che richiede React e accessibilità.

### Story 2.3: Package dei contratti (Badge, Input, Accordion)

As a sviluppatore,
I want un package `@app/contracts` con i contratti dei primi tre componenti,
So that il vocabolario delle props appartenga al page builder e non alla libreria generata (AD-5, AD-11).

**Acceptance Criteria:**

**Given** il monorepo
**When** creo `packages/contracts` con schemi Zod delle props, tipi di asse (`option`/`state`/`behavior`), parti e classifier structure/content per Badge, Input e AccordionItem, e il tipo "definizione di sezione" (con cui si modella Accordion Root, albero di AccordionItem)
**Then** il package compila e i test passano senza dipendenze da React/Puck/UI, verificato da **lint bloccante** con una prova rosso/verde propria
**And** `schemaVersion` è esportata, ogni campo è classificato e un campo ignoto risulta `content`.

### Story 2.4: Bootstrap della library Penpot sui contratti

As a designer/sviluppatore,
I want una skill che crei la nuova library Penpot a partire dai contratti,
So that i componenti disegnati seguano già la linea del contratto invece di essere interpretati a posteriori (AD-11).

**Acceptance Criteria:**

**Given** i contratti della Story 2.3, il modulo BMad `penpot-ds` e un file Penpot senza library
**When** eseguo la skill di bootstrap
**Then** sono creati i token semantici (inclusi shadow/ring) e un VariantContainer per contratto con gli assi del contratto, 0 `variantError`, token legati su ogni proprietà di stile e plugin data `pagebuilder/contract = nome@versione`
**And** su una library esistente il bootstrap rifiuta; la modalità additiva crea solo ciò che manca e segnala le differenze senza correggerle
**And** l'esito è deciso da uno script di verifica (un container per contratto, assi e valori coincidenti), non dal prompt della skill
**And** la pipeline token (Story 2.1) rigira sulla nuova library senza modifiche al codice, e nessun consumer fuori da `packages/tokens` e dalla ricetta Badge usa i vecchi nomi token (verificato il 2026-09-12: zero occorrenze di `mis-` in `ui/editor` e `apps/web`).

### Story 2.5: Estrazione adeguata — ricette per parti e token, validate contro il contratto

As a designer/sviluppatore,
I want che l'estrazione legga il legame al contratto e produca ricette per parti con celle proprietà→token,
So that una ricetta alimenti qualunque emitter e sia verificata contro il contratto (AD-11).

**Acceptance Criteria:**

**Given** la library della Story 2.4 e i contratti
**When** estraggo Badge, Input e AccordionItem
**Then** l'estrazione legge il plugin data e fallisce su contratto duplicato, nome incoerente o contratto senza container; fixture e ricetta coprono esattamente assi e valori del contratto
**And** `RecipeSchema` è una mappa di parti a profondità 1 con celle `proprietà → token` esistenti nello Stadio 1: un literal fallisce, una parte annidata con assi propri fa **fallire lo schema** (criterio di stop meccanico, con test rosso/verde), la geometria delle icone è ignorata
**And** fixture e ricetta Badge attuali sono sostituite (sparisce `colorStyle`) e la copertura di test su reader, `mcp-client` e CLI non scende.

### Story 2.6: Emitter shadcn deterministico e gate CI

As a sviluppatore,
I want un emitter puro che traduca ricetta e binding in componenti shadcn,
So that il codice sia riproducibile e il drift design↔codice sia un test rosso invece di una scoperta tardiva (FR2, AD-11).

**Acceptance Criteria:**

**Given** fixture, ricetta e binding shadcn committati e la base shadcn del componente
**When** eseguo il rendering
**Then** gli assi sono instradati per tipo (`option` → `cva`; `state` → `focus-visible:`/`aria-invalid:`/`disabled:`; `behavior` → `data-[state=…]:`) e sono prodotti `.tsx` + test + story + barrel, marcati `@generated` con la provenienza (`penpotComponentId` + `fixtureHash`)
**And** rigenerare produce **diff zero**, un file senza marker non viene mai sovrascritto, e i gate completezza, rigenerazione, a11y (vitest-axe) e conformità al contratto sono bloccanti in CI; il drift fixture vs Penpot live è bloccante se il runner raggiunge Penpot, altrimenti manuale/nightly con decisione documentata; ogni gate ha una propria prova rosso/verde
**And** il tutto è validato su Badge, Input e AccordionItem prima di generalizzare; Accordion Root non è una ricetta (è una definizione di sezione).

### Story 2.7: Libreria componenti accessibile

As a sviluppatore,
I want una libreria di componenti organizzata per dominio e conforme alla a11y baseline,
So that l'editor e le composizioni possano costruirci sopra (FR3, NFR1).

**Acceptance Criteria:**

**Given** i token generati, i contratti e l'emitter della Story 2.6
**When** genero i componenti per i sei domini (data-display, inputs, feedback, layout, navigation, overlays) in `packages/ui/src/domains`, ciascuno con prima il proprio contratto e il proprio container Penpot (skill additiva)
**Then** ogni componente interattivo ha focus visibile WCAG AA, stato comunicato da testo+colore e ARIA corretto, con il comportamento fornito dall'headless Radix dichiarato nel binding
**And** i test axe passano su tutti i componenti e i componenti in `domains/` non importano da `editor/`, verificato da **lint bloccante**
**And** i componenti senza headless disponibile e con logica propria (Table con sorting, Carousel) e i componenti complessi hanno un contratto completo e un segnaposto in Penpot; l'adapter è scritto a mano, senza marker `@generated`, e la pipeline li ignora.

### Story 2.8: Storybook del design system

As a sviluppatore,
I want uno Storybook che aggrega le storie dei componenti con addon di accessibilità,
So that il design system sia esplorabile e verificabile visivamente.

**Acceptance Criteria:**

**Given** i componenti `ui/domains` con le loro story
**When** avvio Storybook
**Then** le storie dei componenti sono navigabili con i token applicati e l'addon a11y attivo
**And** il build statico di Storybook è prodotto senza errori.


## Epic 3: Blocchi ed elementi dell'editor

Esistono i blocchi Puck token-driven e le composizioni dell'editor; la config Puck è pronta per il montaggio nell'editor.

### Story 3.1: Ponte token→controlli Puck

As a sviluppatore,
I want derivare le opzioni dei campi Puck (spacing/radius) dai token,
So that una modifica ai token propaghi sia agli stili sia ai menu dei blocchi (FR4 base).

**Acceptance Criteria:**

**Given** i token generati (spacing/radii)
**When** implemento il ponte token→controlli (opzioni gap/padding, enum Zod, class-map)
**Then** i controlli dei blocchi espongono le opzioni derivate dai token
**And** cambiare un token spacing/radius aggiorna sia le classi sia le opzioni disponibili nei campi.

### Story 3.2: Blocchi Puck come adapter dei contratti

As a autore,
I want blocchi Puck con campi validati e slot annidabili che espongono i contratti tramite la libreria del design system,
So that possa comporre pagine con elementi del design system (FR4, AD-5).

**Acceptance Criteria:**

**Given** i contratti, i componenti `ui/domains` e il ponte token
**When** implemento per ogni contratto i campi (dagli assi `option`), le `permissions` e il render tramite la libreria dell'installazione, aggregati in `puckConfig`
**Then** gli assi `state`/`behavior` non diventano campi; Box, Flex, Grid e Columns hanno slot (content; col1/col2/col3) e soli assi a valori token (Box: background/padding/radius/border; Flex: direction/align/justify/gap/wrap)
**And** ogni blocco valida con lo schema di `@app/contracts`, senza alcuna copia in `puck-components`.

### Story 3.3: Classifier structure/content esteso a tutti i contratti

As a sviluppatore,
I want una classificazione structure/content dei campi di ogni blocco definita una sola volta,
So that permessi editor e sanitizzazione server condividano la stessa fonte (FR13, AD-5).

**Acceptance Criteria:**

**Given** i contratti (Badge, Input, Accordion già classificati in Story 2.3)
**When** estendo il classifier in `packages/contracts` a ogni contratto e blocco e lo collego all'editor (`readOnly` per singola prop sui campi structure)
**Then** ogni campo di ogni blocco è classificato come `structure` o `content`
**And** un campo o blocco sconosciuto è trattato come `content` (fail-safe), e `puck-components` deriva i permessi dal classifier senza una seconda copia della classificazione.

### Story 3.4: Definizioni di sezione da Penpot

As a sviluppatore/autore,
I want estrarre una sezione disegnata in Penpot come definizione di dati con slot dichiarati,
So that hero e sezioni siano fedeli al disegno e rigide nell'editor (FR4, AD-5, AD-11).

**Acceptance Criteria:**

**Given** una sezione in Penpot composta solo da istanze di componenti della library + layout
**When** la estraggo e scrivo la ricetta di sezione (slot riferiti per id Penpot, `allow`, `max`)
**Then** la definizione (albero di Box/Flex/componenti + props + slot) vive in `@app/contracts` ed è esposta in Puck per nome; una forma sciolta fa fallire l'estrazione nominando l'elemento; uno slot che punta a un nodo sparito fa fallire la validazione
**And** in editor la struttura è bloccata e il contenuto modificabile; gli slot accettano solo i blocchi dell'`allow` fino a `max` (`resolvePermissions`); i testi del mockup diventano default dei campi content.

### Story 3.5: Composizioni dell'editor

As a sviluppatore,
I want le composizioni di prodotto dell'editor costruite su componenti `ui/domains` + token,
So that l'editor abbia gli elementi di alto livello di cui ha bisogno (FR5, UX-DR6).

**Acceptance Criteria:**

**Given** i componenti `ui/domains`
**When** implemento LifecycleBadge, SaveStateIndicator, TopBar, PageList, VersionList, EmptyState in `packages/ui/src/editor`
**Then** le composizioni usano solo `ui/domains` + token (nessuna dipendenza applicativa/store) e rispettano la a11y baseline (es. SaveStateIndicator con aria-live)
**And** `editor/` non è importato da `domains/` (lint bloccante) e le sue story sono in Storybook.

## Epic 4: Editor e bozze

Un Editor costruisce una pagina in drag-and-drop e la salva come bozza, con round-trip lossless e payload validato/sanitizzato.

### Story 4.1: Shell editor con canvas Puck

As a Editor,
I want aprire una pagina in un editor drag-and-drop montato sui blocchi,
So that possa comporne il layout visivamente (FR6).

**Acceptance Criteria:**

**Given** `puckConfig` e una pagina esistente
**When** apro la rotta editor autenticata (isola `use client`)
**Then** il canvas Puck si monta con i blocchi disponibili e carica il payload della pagina
**And** la rotta è accessibile solo a un utente autenticato con ruolo abilitato (Admin/Editor, o Cliente su pagina assegnata).

### Story 4.2: Salvataggio bozza con snapshot immutabile

As a Editor,
I want salvare il layout come nuova versione DRAFT,
So that ogni salvataggio sia uno snapshot immutabile versionato (FR7, AD-6, AD-12).

**Acceptance Criteria:**

**Given** una pagina aperta nell'editor
**When** salvo il layout corrente
**Then** viene creata una nuova PageVersion DRAFT con payload jsonb `{content,root,zones}` e `versionNumber` allocato dal core (UNIQUE per pagina)
**And** i block-id coniati dal client sono preservati invariati e nessuna versione esistente viene mutata in-place.

### Story 4.3: Pipeline payload server — validazione, structure/content, sanitizzazione XSS

As a sistema,
I want validare e sanificare il payload lato server prima di persistere,
So that solo payload validi e sicuri vengano salvati (FR13 enforcement, NFR3, AD-5).

**Acceptance Criteria:**

**Given** un payload in arrivo dal salvataggio
**When** il core esegue la pipeline (validazione con i contratti di `@app/contracts`, inclusi `allow`/`max` degli slot di sezione + classificazione structure/content + sanitizzazione dei campi content)
**Then** un payload non conforme agli schemi è rifiutato con errore tipizzato e i campi content sono sanitizzati (XSS) prima del persist
**And** un Cliente che tenta di modificare un campo `structure` viene rifiutato dal core
**And** un payload che inserisce in uno slot di sezione un blocco fuori dall'allow-list o oltre il `max` è rifiutato dal core con errore tipizzato (il limite in editor non è l'unico controllo).

### Story 4.4: Autosave con indicatore di stato

As a Editor,
I want che le modifiche siano salvate automaticamente con un indicatore salvato/non-salvato,
So that non perda lavoro e sappia sempre lo stato (FR7, UX-DR4).

**Acceptance Criteria:**

**Given** una pagina in editing
**When** modifico il layout e mi fermo
**Then** l'autosave crea/aggiorna la bozza e il SaveStateIndicator mostra lo stato con `aria-live="polite"`
**And** ricaricando la pagina la bozza salvata è ripristinata identica (round-trip lossless).

## Epic 5: Ciclo di vita e pubblicazione

Un Editor pubblica, fa rollback e archivia pagine con l'invariante ≤1 pubblicata garantito e l'audit tracciato.

### Story 5.1: Pubblicazione con invariante atomico

As a Editor,
I want pubblicare una versione promuovendola a PUBLISHED,
So that la pagina abbia una e una sola versione pubblicata (FR8, AD-7).

**Acceptance Criteria:**

**Given** una pagina con una o più versioni DRAFT (ed eventualmente una PUBLISHED)
**When** pubblico una versione
**Then** in un'unica transazione la versione scelta diventa PUBLISHED e l'eventuale precedente PUBLISHED è retrocessa a DRAFT
**And** l'indice parziale DB impedisce qualsiasi stato con due versioni PUBLISHED, e Page.status riflette PUBLISHED.

### Story 5.2: Rollback a una versione precedente

As a Editor,
I want ripristinare una versione precedente come pubblicata,
So that possa tornare rapidamente a uno stato noto (FR9, AD-7).

**Acceptance Criteria:**

**Given** una pagina con una PUBLISHED e versioni precedenti
**When** eseguo il rollback verso una versione precedente
**Then** in transazione quella versione diventa PUBLISHED e l'attuale è retrocessa a DRAFT
**And** l'invariante ≤1 pubblicata resta rispettato e l'operazione è registrata nell'audit.

### Story 5.3: Archiviazione e ripristino

As a Editor,
I want archiviare una pagina e poterla ripristinare,
So that possa ritirarla dalla pubblicazione preservandone le versioni (FR10, AD-7).

**Acceptance Criteria:**

**Given** una pagina PUBLISHED o DRAFT
**When** la archivio
**Then** Page.status diventa ARCHIVED, l'eventuale versione PUBLISHED è demota (nessuna pagina archiviata resta pubblicata) e tutte le versioni sono preservate
**And** il restore riporta la pagina a DRAFT con le versioni intatte.

### Story 5.4: Audit trail delle operazioni

As a Admin,
I want consultare lo storico immutabile di chi ha cambiato cosa e quando,
So that possa tracciare le operazioni sulle pagine (FR14, AD-8, AD-13).

**Acceptance Criteria:**

**Given** operazioni di mutazione eseguite dal core
**When** una mutazione (save/publish/rollback/archive/restore/assign) avviene
**Then** un'unica via (AuditWriter) scrive una riga AuditLog canonica (actor/action/entity/timestamp/metadataDiff, senza il blob)
**And** solo un Admin può consultare l'audit; un non-Admin che tenta di leggerlo riceve 404 (non si rivela l'esistenza).

## Epic 6: Render pubblico e vetrina commerce

Un visitatore vede la pagina pubblicata by-slug, inclusi dati commerce reali risolti a render-time.

### Story 6.1: Render pubblico by-slug (SSG)

As a visitatore,
I want vedere una pagina pubblicata tramite il suo slug,
So that possa consultarne il contenuto pubblicato (FR11, AD-4, AD-9).

**Acceptance Criteria:**

**Given** una pagina con una versione PUBLISHED
**When** apro `/[slug]`
**Then** la pagina è resa come HTML statico (SSG) dalla proiezione pubblicata, senza campi interni/draft
**And** uno slug senza versione pubblicata risponde con not-found; nessuna lettura anonima espone dati non pubblicati.

### Story 6.2: Invalidazione ISR su publish e anteprima draft

As a Editor,
I want che la pagina pubblica si aggiorni al publish e poter vedere l'anteprima della bozza,
So that i visitatori vedano subito il nuovo contenuto e io possa rivedere le bozze in sicurezza (FR11, AD-9).

**Acceptance Criteria:**

**Given** una pagina servita in SSG+ISR
**When** pubblico/rollback/archivio
**Then** il core, post-commit, invoca il port CacheInvalidator (revalidateTag/Path per lo slug) e la richiesta successiva rigenera l'HTML statico
**And** l'anteprima draft (`?version=draft`) è resa dinamicamente, non cachata, ed è accessibile solo agli utenti autorizzati (cache draft/published disgiunte).

### Story 6.3: Port CommerceProvider e adapter di riferimento

As a sviluppatore,
I want un'astrazione CommerceProvider con un adapter di riferimento,
So that i blocchi commerce possano risolvere dati senza vincolarsi a una sorgente specifica (FR15, AD-10, NFR7).

**Acceptance Criteria:**

**Given** `packages/commerce-provider`
**When** definisco il port canonico (metodi es. getProduct/listProducts; DTO ProductRef, Price{amount,currency}) e un adapter di riferimento
**Then** il port è consumabile server-side e l'adapter risolve i dati di prova secondo il contratto
**And** aggiungere un secondo adapter non richiede modifiche ai blocchi che usano il port.

### Story 6.4: Blocchi commerce data-driven

As a autore,
I want blocchi commerce (ProductCard/ProductGrid/AddToCart) che mostrano dati reali,
So that le pagine diventino vetrine e-commerce (FR15, AD-10).

**Acceptance Criteria:**

**Given** il port CommerceProvider con un adapter attivo
**When** aggiungo un blocco commerce a una pagina e la pubblico
**Then** il blocco risolve i dati commerce server-side a render-time via il provider e li mostra nella pagina pubblicata
**And** cambiando l'adapter del provider lo stesso blocco rende dati dalla nuova sorgente senza modifiche al blocco.
