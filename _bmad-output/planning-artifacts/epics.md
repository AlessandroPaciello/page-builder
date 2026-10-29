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
  - "_bmad-output/spikes/penpot-ai-kit-2026-10-10/README.md"
  - "_bmad-output/forge/pds-v3-penpot-ai-kit/forged-idea.md"
  - "_bmad-output/forge/pds-v3-scripts/forged-idea.md"
  - "_bmad-output/forge/pds-v3-punti-aperti/forged-idea.md"
---

# page-builder - Epic Breakdown

## Overview

Questo documento decompone i requisiti dello SPEC (spec-kernel, in sostituzione del PRD), delle sue companion e della Architecture Spine in story implementabili. Il progetto è una **riscrittura greenfield full-TypeScript**: le prime epic coprono scaffolding e ricostruzione del design system, poi le feature del page builder e l'integrazione commerce.

> **Nota di percorso:** i Functional Requirements derivano 1:1 dalle capability dello SPEC (CAP-1…15); i vincoli tecnici (NFR/Additional) derivano dai constraint dello SPEC e dai 13 Architecture Decision (AD-1…13). Ogni story eredita gli AD pertinenti come vincolo.

## Requirements Inventory

### Functional Requirements

FR1 (CAP-1): Il sistema porta in Penpot un tema nato da un seme CSS Tailwind, poi estrae i design token da Penpot e genera lo strato token (colori/tipografia/spacing/radii/ombre), le varianti di tema e i font consumati dalla UI, data-driven dal catalogo Penpot.
FR2 (CAP-2): Il sistema genera dai componenti Penpot gli stili e le story di primitive React accessibili (contratto dell'editor + Penpot letto dal vivo → `styles.ts` e story generati sul registro delle proprietà; componente dello sviluppatore creato una volta dallo scaffold), preservando i file scritti a mano.
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
NFR5 (Coerenza design↔codice): Penpot è single source of truth di valori e aspetto; il contratto dei componenti è del page builder; artefatti generati marcati @generated con versione del generatore e hash, mai editati a mano (controllato in CI); il componente React è dello sviluppatore e la rigenerazione non lo tocca.
NFR6 (Confine UI): Il frontend consuma esclusivamente il design system (@penpot-ds/ui), non uno stack UI stilistico parallelo; layering contracts ← {ui/domains, puck-components, domain, render}; tokens ← ui/domains ← {puck-components, ui/editor}. Le primitive headless (Base UI, fissato in pds-setup con headless=base-ui) non sono una libreria concorrente: importabili solo da ui/src/domains.
NFR7 (Intercambiabilità commerce): I blocchi commerce e il render parlano solo al port CommerceProvider; cambiare/affiancare sorgente = cambiare un adapter, non riscrivere i blocchi.
NFR8 (Deferred — Perf): Budget di latenza render/save deliberatamente deferiti (da misurare in implementazione, non vincolati qui).

### Additional Requirements

_Da Architecture Spine (AD-1…13) e Stack — vincoli tecnici che impattano l'implementazione._

- **[STARTER] Scaffolding greenfield (Epic 1, Story 1):** workspace inizializzato con `create-better-t-stack` (3.37.0) → Next.js App Router + TypeScript; monorepo pnpm (10) + Turborepo (2); rimozione di ogni residuo legacy. Stack pinnato allo scaffold: Next 16.x, React 19, PostgreSQL 18, Prisma 7.9+, Better Auth, oRPC, Tailwind 4, Node LTS. `@puckeditor/core` 0.22.x (NB: `@measured/puck` è deprecato) è ratificato nello spine ma **installato in Epic 3/4**, non allo scaffold.
- **AD-1/AD-2 (paradigma):** core di dominio esagonale in `packages/domain` (no HTTP, no React), unico punto di accesso al dominio (mutazioni + letture non-pubbliche); adapter attorno; core estraibile.
- **AD-3/AD-11 (design system):** ricostruzione dei `packages/*` (tokens/ui/puck-components/scripts/storybook; nessun package `primitives`); token, tema, font e stili dei componenti `ui/domains` generati via pipeline v3 (AD-11 v3, correct-course 2026-10-17): un contratto dell'editor, Penpot letto dal vivo, server MCP `pds` su nucleo puro, skill `pds-design`/`pds-code`; il componente React è dello sviluppatore. Una libreria per installazione, fissata in `pds-setup`.
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
Pipeline Penpot→codice (packages/scripts) che genera token, tema e font (packages/tokens) e gli stili dei componenti (packages/ui/src/domains), con componenti React accessibili scritti dallo sviluppatore sopra gli stili. Il regime arriva in tre tempi: v1 (contratto → fixture → ricetta → emitter shadcn, Story 2.1–2.10), v2 (due contratti → istantanea → render headless, Story 2.12–2.16) e v3 (un contratto, Penpot letto dal vivo, stili generati e componente dello sviluppatore, Story 2.17–2.31, correct-course 2026-10-17). Outcome: dal catalogo Penpot si generano in modo riproducibile tema e stili; i componenti dei domini sono accessibili, visibili e testati in Storybook, e la CI li verifica senza Penpot.
**FRs covered:** FR1, FR2, FR3. Vincoli: AD-3, AD-5, AD-11, NFR1, NFR5, UX-DR1-5,7.

### Epic 3: Blocchi ed elementi dell'editor
Blocchi Puck come adapter dei contratti (packages/puck-components), blocchi di layout a soli token, sezioni disegnate in Penpot (contratti con almeno uno slot) e rigide nell'editor, classifier structure/content esteso a tutti i contratti, e composizioni di prodotto dell'editor (packages/ui/src/editor: TopBar, PageList, VersionList, LifecycleBadge, SaveStateIndicator, EmptyState). Outcome: esistono i blocchi, le sezioni e le composizioni; la config Puck è pronta per l'editor.
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

Si generano token e stili dei componenti dal catalogo Penpot in modo riproducibile, con componenti React accessibili scritti dallo sviluppatore sopra gli stili generati, visibili e testati in Storybook. Il regime è la **v3** (AD-11 v3, correct-course 2026-10-17): un contratto dell'editor per componente; Penpot letto dal vivo per parti, celle, token e geometria; `styles.ts` e story generati, componente dello sviluppatore; un server MCP `pds` sopra un nucleo puro; due skill `pds-design` e `pds-code`. Fonti: [spike penpot-ai-kit](../spikes/penpot-ai-kit-2026-10-10/README.md) e le tre forgie pds v3; proposta in `sprint-change-proposal-2026-10-17.md`.

> **Story 2.1–2.16 (v1 e v2).** Restano **come storia**: non vanno riscritte. Il codice v2 e i componenti di prova generati si rimuovono nella Story 2.18. La Story 2.17 "Skill `pds-*` sui sei comandi" è cancellata (branch mai mergiato); la libreria dei sei domini è ora la Story 2.32 (ex 2.18).

**Tooling:** BMad Builder installato il 2026-09-12 (`bmb` v2.2.2). Il modulo BMad `penpot-ds` (codice `pds`) è nato nella Story 2.4; con la v3 contiene `pds-setup`, `pds-design` (Story 2.28) e `pds-code` (Story 2.29).

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

### Story 2.7: Pipeline pronta per più componenti

As a sviluppatore,
I want che la pipeline regga un catalogo di componenti che cresce e un design che evolve,
So that la libreria dei sei domini (2.11) si generi senza verdi finti né passaggi a mano fuori dai comandi (FR2, NFR1, AD-11).

**Acceptance Criteria:**

**Given** un giudizio che dichiara `role` e/o `ariaAttributes`
**When** genero il componente
**Then** l'emitter li emette nel `.tsx` e il gate a11y fallisce se un attributo dichiarato manca dal componente generato (prova rosso/verde)
**And** aggiungere un contratto con il suo design non richiede di modificare liste scritte a mano nei test né nel CLI: design e liste sono derivati da `designs/*.design.json` e da `COMPONENT_CONTRACTS`, con un test di copertura design↔registry
**And** `add:library` crea le celle mancanti di un container esistente (`addCell`, additiva, con guardia anti-duplicato), e `adopt:variant -- <Comp>` rileva i valori d'asse presenti in Penpot e assenti dal contratto, propone il diff e, su conferma, aggiorna contratto, `SCHEMA_VERSION` + fingerprint, binding e design; fallisce con errore nominativo quando la variante non è esprimibile (proprietà che varia con due assi, assi `state`/`behavior` senza mapping 1:1)
**And** `verify:library` segnala i container il cui plugin data dichiara un contratto inesistente e ricava le coppie di contrasto testo/sfondo dai design invece che da una lista
**And** un field di contratto con il nome di un attributo HTML globale (es. `title`) è rifiutato
**And** la regola per alzare la versione di un contratto già presente in Penpot (`nome@versione`) è decisa e documentata in `penpot-pipeline.md`, con il comando o il vincolo che la applica
**And** ogni controllo nuovo ha una propria prova rosso/verde.

### Story 2.8: Registro delle proprietà e blocco per componente

As a designer/sviluppatore,
I want le proprietà di stile Penpot in un registro unico e che ciò che la pipeline non sa esprimere blocchi solo il componente interessato,
So that nessuna fedeltà vada persa in silenzio e un componente fuori regola non renda rossa la CI per tutti (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il registro unico delle proprietà Penpot (lettura, tipo token o lista di parole chiave, stato supportata/bloccata, mappatura emitter) letto da reader, `verify:library` ed emitter
**When** estraggo e rendo i componenti committati
**Then** nessuna proprietà viene saltata in silenzio: una proprietà non espressibile blocca il solo componente con messaggio nominativo, e le proprietà oggi "silenziose" (spessore, opacità, tratteggio, allineamento dello stroke) bloccano; il reader legge `strokeStyle` come parola chiave di lista chiusa (`solid`/`dashed`/`dotted`) e i valori fuori lista bloccano
**And** il refactor lascia l'output attuale identico byte per byte (Badge/Input/AccordionItem byte-identici, `render:check` a diff zero) e la copertura di test di `scripts` non scende
**And** una variante senza una proprietà che il default ha (es. outline senza fill) è esprimibile: la proprietà assente produce classi per variante, non nella base `cva` — l'emitter è stato esteso **una volta per tutte**, non per componente
**And** maiuscole, spazi e ordine degli assi sono normalizzati dalla pipeline; un layer con nome diverso dalla parte si lega via alias nel binding; una cella mancante blocca il componente con una domanda al designer, mai inventata
**And** `verify:library` e `gates:render` valutano **per componente**: un componente fuori regola rende rossa solo la sua voce, e i componenti in attesa (variante non adottata, proprietà bloccata) sono visibili nel report di PR/CI, non solo nel terminale
**And** ogni controllo nuovo ha una propria prova rosso/verde.

### Story 2.9: Skill `pds-component` — creare e sincronizzare i componenti

As a sviluppatore,
I want una skill che mi guidi nel ciclo di vita di un componente, dalla creazione all'allineamento con Penpot,
So that aggiungere o aggiornare un componente non richieda di conoscere a memoria l'ordine dei comandi, i file da scrivere e le decisioni che spettano a me (FR2, AD-11).

**Acceptance Criteria:**

**Given** la pipeline della Story 2.7
**When** invoco la voce **[PC] Crea componente** per un componente assente dal registry e da Penpot
**Then** la skill chiede assi, parti, dominio, a11y e l'aspetto delle celle, scrive contratto e design, crea il container richiamando `pds-additive`, poi guida giudizio, binding, base shadcn, estrazione, render, barrel e gate
**And** la voce **[PS] Sincronizza componente** legge lo stato **per componente** con `verify:library` e `gates:render` e sceglie il percorso: drift → riestrazione e render con diff; valore d'asse in più da Penpot → `adopt:variant`; cella richiesta dal contratto ma assente dal container → `addCell`; cella che il design usa e il contratto non ha → blocco del componente e domanda al designer (mai inventata); proprietà bloccata dal registro → indicazione dello sblocco (una riga del registro + mappatura + test rosso/verde) e decisione umana; componente in attesa → visibile nel report, nessuna correzione da parte della skill
**And** la skill si ferma solo sulle decisioni umane, non scrive mai su Penpot né sui contratti fuori dai comandi CLI, e l'esito è sempre l'exit code degli script, mai il prompt
**And** `pds-additive` al passo 3, dopo aver riportato una differenza, indica la voce che la risolve; le due voci sono registrate nel `module-help.csv` di `pds-setup`
**And** la skill è costruita con `bmad-workflow-builder` e verificata eseguendo i due percorsi su un componente reale.

### Story 2.10: Fedeltà live ed estrazione guidata dal contratto

As a designer/sviluppatore,
I want che l'estrazione prenda il contratto come riferimento, misuri il contrasto su Penpot live e che l'a11y possa variare per variante,
So that la libreria dei sei domini (2.11) nasca senza verdi finti, e quando il design si allontana dal contratto la pipeline lo segnali e aiuti ad adattarlo invece di perderlo in silenzio (FR2, NFR1, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il modulo condiviso delle regole della library fra estrazione e `verify:library` (regole 2, 3, 6, 7), il registro delle proprietà della Story 2.8 e ogni parte di contratto con un ruolo (`surface`/`text`/`icon`/`divider`, AD-11)
**When** estraggo o verifico un componente in cui una cella porta un token su una proprietà che il ruolo della parte non ammette (es. `strokeColor` su una parte `text`, anche al posto del `fill`)
**Then** il solo componente è **in attesa**, con un messaggio che nomina componente, cella, parte, ruolo, proprietà e token, e propone l'adattamento nell'ordine designer → ruolo che impara la proprietà (riga della tabella ruolo → proprietà + mappatura + test rosso/verde) → cambio di ruolo nel contratto (comando con diff e `--yes`, solo `SCHEMA_VERSION`)
**And** i contratti esistenti (Badge, Input, AccordionItem, Alert) dichiarano il ruolo delle parti, `designs/*.design.json` lo eredita dal contratto invece di dichiarare `kind`, e l'output generato resta byte-identico (`render:check` a diff zero)
**And** la regola 10 di `verify:library` misura le coppie testo/sfondo **per componente** sui token dello snapshot live (parte `text`/`icon` × `surface` che la contiene, per cella), e un contrasto sotto soglia rende rossa la voce del componente (prova rosso/verde con il caso Alert `status=warning` a 1.82:1)
**And** un design committato diverso da Penpot è un problema `design-drift` della voce, e `pnpm sync:design -- <Comp>` stampa il diff e con `--yes` riscrive `designs/<comp>.design.json` (tmp + rename, mai scritture su Penpot); `alert.design.json` è riallineato con il comando
**And** `a11y.role` del giudizio accetta una mappa per un asse `option`; l'emitter emette il role per variante e il gate a11y lo verifica per ogni variante; Alert emette `role="status"` per `info`/`success` e `role="alert"` per `warning`/`error`
**And** la skill `pds-component` [PS] instrada i nuovi stati (proprietà fuori ruolo → i tre adattamenti; `design-drift` → `sync:design`)
**And** ogni controllo nuovo ha una propria prova rosso/verde.

### Story 2.11: Storybook del design system

*(ex 2.12, anticipata dal correct-course 2026-09-17: CAP-10 richiede il giudizio visivo della ProductCard in Storybook.)*

As a sviluppatore,
I want uno Storybook che aggrega le storie dei componenti con addon di accessibilità,
So that il design system sia esplorabile e il giudizio visivo della ProductCard (Story 2.15) abbia un posto dove avvenire.

**Acceptance Criteria:**

**Given** i componenti `ui/domains` con le loro story generate
**When** avvio Storybook
**Then** le storie dei componenti sono navigabili con i token applicati e l'addon a11y attivo
**And** le story sono CSF3 valido con le props in `args`, e un gate esegue le story generate (smoke test), così una story che rende il componente senza props è un test rosso — il gate vale per le story della v1 oggi e per quelle di `render` v2 domani, senza modifiche
**And** il build statico di Storybook è prodotto senza errori ed è un job di CI.

### Story 2.12: Fondamenta v2 — due contratti, registro, guscio

*(CAP-1, CAP-2, CAP-3, CAP-8 di [SPEC-refactor-packages-scripts](../specs/spec-refactor-packages-scripts/SPEC.md).)*

As a sviluppatore,
I want il modello v2 in `packages/scripts/src/v2` e il contratto del page builder ridotto a ciò che le pagine usano,
So that il vocabolario della ProductCard esista prima di qualunque comando e la v1 resti verde nel frattempo (FR2, AD-5, AD-11).

**Acceptance Criteria:**

**Given** lo SPEC v2 e `extraction-contract.md`
**When** riduco `@app/contracts`
**Then** il fingerprint copre solo `name`, `version`, assi `option`, `fields` (testo, attributo, url, array), slot; `SCHEMA_VERSION` sale **una volta**; `parts`, `partRoles` e gli assi `state`/`behavior` restano accettati come **estensione deprecata fuori dal fingerprint**, letta solo dalla v1, con un test che ne fissa la cancellazione alla Story 2.16
**And** `defineExtraction` importa il contratto del page builder e fallisce **a module load** — nominando parte e campo — su field inesistente o di tipo sbagliato, `when` su asse non `option`, albero senza radice o con cicli, parte senza ruolo, plugin data incoerente (prova rosso/verde per ciascun controllo)
**And** i **due contratti della ProductCard** (page builder + estrazione, dalla simulazione) sono scritti e sono la prima prova del modello: `badgeLabel` è un field del page builder
**And** il registro unico impara `layout` (`dir`, `align`, `justify`, `gap`, `wrap`) e `position` letti dal layer Penpot, e il ruolo `image` (raggio, opacità, layout, posizione, **nessun `fill`**); una proprietà nuova entra con una riga + test rosso/verde
**And** esiste un solo guscio CLI (parser, guardia di invocazione diretta, `main()` che restituisce il codice) e una sola `ScriptError { kind, component?, cell?, part?, detail }` con exit `1` input · `2` penpot · `3` contract · `4` gate; nessun `process.exitCode` fuori dal guscio; un test per categoria
**And** la v1 è intatta: `gates:render` a diff zero, suite `scripts` e `ui` verdi, copertura che non scende.

### Story 2.13: `library` e `propose` — Penpot dal contratto di estrazione

*(CAP-6, CAP-7.)*

As a designer/sviluppatore,
I want che il container Penpot nasca dal contratto di estrazione e che Penpot possa proporre modifiche ai contratti senza scriverle,
So that il designer disegni già dentro le celle e i layer giusti e ogni cambio di contratto passi da un diff letto da un umano (AD-11).

**Acceptance Criteria:**

**Given** i due contratti della ProductCard (Story 2.12) e una library senza la card
**When** lancio `library add ProductCard`
**Then** in Penpot esiste il VariantContainer con plugin data, gli assi (inclusi `state`), 6 board e i layer con i nomi delle parti (alias inclusi), token legati su ogni proprietà di stile
**And** rilanciato non modifica né cancella nulla e segnala le differenze; `--dry-run` stampa senza scrivere; `library bootstrap` rifiuta su library esistente e crea anche i token shadow/ring
**And** `propose <Comp>` legge Penpot e stampa il diff proposto sui **due** contratti (valore d'asse, parte o ruolo assenti), nominando file e riga; non scrive mai né su Penpot né sui contratti; sostituisce `adopt:variant`, `bump:contract` e `role:part`
**And** ogni controllo nuovo ha una propria prova rosso/verde; la v1 resta intatta.

### Story 2.14: `extract` e `render` — una istantanea, quattro file

*(CAP-4, CAP-5.)*

As a sviluppatore,
I want leggere un componente da Penpot in una sola istantanea validata e generare da lì i quattro file,
So that `judgments/`, `bindings/`, `designs/`, `bases/` e la coppia fixture+ricetta non servano più (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** i due contratti della ProductCard e un'istantanea Penpot (live o `--snapshot <file>`)
**When** lancio `extract ProductCard`
**Then** viene scritta (tmp + rename) `data/components/product-card.json` con `contract`, `provenance` e `cells[cella][parte]` per 6 celle; `--check` confronta senza scrivere
**And** con il layer `Badge` presente nella cella `promo=none` fallisce con `kind: contract` nominando componente, cella e parte, propone gli adattamenti in ordine (designer → registro → contratto di estrazione) e non scrive nulla; gli stadi `penpot → contract → parts → properties → write` compaiono nel log con una sola categoria di errore ciascuno
**And** `render ProductCard` produce `<Comp>.tsx`, `.test.tsx`, `.stories.tsx` e barrel marcati `@generated` con provenienza: `when` → render condizionale, `repeat` → `map`, `attribute` → attributo, assi `state` → prefissi, primitivo headless (Base UI) → elemento della parte, layout e posizione → classi dal registro, **nessuna base**
**And** `render --check --all` rigenera a diff zero; un file senza marker non viene mai sovrascritto; `--all` accumula i fallimenti per componente e li elenca alla fine
**And** ogni controllo nuovo ha una propria prova rosso/verde; la v1 resta intatta.

### Story 2.15: ProductCard end-to-end e gate in CI

*(CAP-10, CAP-9.)*

As a designer/sviluppatore,
I want la ProductCard disegnata in Penpot e arrivata in `packages/ui` senza codice a mano, con la CI che la rigenera,
So that il modello v2 sia dimostrato sul caso più difficile prima di cancellare la v1 (FR2, NFR1, NFR5).

**Acceptance Criteria:**

**Given** il container creato nella Story 2.13 e disegnato da Alessandro in Penpot (varianti con e senza sconto, tag ripetuti, immagine)
**When** lancio `extract ProductCard` e `render ProductCard`
**Then** entrambi sono verdi, test generati e axe verdi, la story compare in Storybook (Story 2.11) e il **giudizio visivo di Alessandro** è registrato nella story
**And** `gates` esegue `render --check --all` + suite ui + axe con report per componente (`$GITHUB_STEP_SUMMARY`); un componente divergente rende rossa la CI nominandolo e gli altri sono comunque verificati; nessun comando live gira in CI
**And** in CI convivono `gates:render` (v1) e `gates` (v2) fino alla Story 2.16, con i diff zero di entrambi
**And** nessuna riga di codice a mano in `packages/ui` per la card; diff zero dal primo commit.

### Story 2.16: Rimozione della v1 e rigenerazione dei quattro componenti

*(CAP-11, piano in [migration.md](../specs/spec-refactor-packages-scripts/migration.md).)*

As a sviluppatore,
I want cancellare la v1 e far rinascere Badge, Input, Alert e AccordionItem dalla v2,
So that esista una sola pipeline e un solo modo di descrivere un componente (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** la card passata (Story 2.15)
**When** rimuovo la v1
**Then** `data/judgments`, `data/bindings`, `data/designs`, `data/bases`, `data/recipes`, gli otto comandi v1, il codice v1, i quattro componenti generati, `shadcn`, `radix-ui` e `@radix-ui/react-accordion` non esistono più; `@base-ui/react` entra; `src/v2` si appiattisce in `src`; i campi deprecati di `@app/contracts` sono cancellati **senza** nuovo bump di `SCHEMA_VERSION`; la sezione "Stadio 2 (v1)" di `penpot-pipeline.md` è cancellata
**And** i quattro componenti rinascono **uno alla volta** (Badge, Input, Alert, AccordionItem per ultimo) ciascuno con contratto ridotto + contratto di estrazione scritto dai file v1 (storia git), `extract`, `render`, diff zero, test e axe verdi; nessun confronto con la v1
**And** il Badge esce con `flex`/`items-center`/`gap-*` derivati dal layer Penpot e non da un campo scritto a mano; l'Alert emette `role` per variante; l'AccordionItem usa Base UI ed è la verifica pratica dell'headless
**And** `apps/web` è ricontrollata per consumatori dei quattro componenti nella finestra tra rimozione e rigenerazione; l'action item della retro Epic 1 sul dropdown-menu scritto a mano è rivalutato qui
**And** le voci di `deferred-work.md` legate ad artefatti v1 (register del correct-course 2026-09-17) sono chiuse come "senza oggetto" con riferimento a questa story.

### Story 2.17: Il tema Penpot nel CSS compilato

As a designer/sviluppatore,
I want che i valori del tema Penpot arrivino davvero nel CSS che il browser riceve,
So that un cambio del designer si veda nei componenti e non resti coperto dai default shadcn e Tailwind (FR1, NFR5, AD-11).

**Acceptance Criteria:**

**Given** `packages/ui/src/styles/globals.css` con `@import` del tema a metà file e il blocco `@theme inline` shadcn che ridefinisce colori, raggi e font
**When** riordino il CSS globale
**Then** l'`@import` del tema Penpot è in testa con gli altri e nessun blocco ridefinisce i nomi che il tema possiede (colori, raggi, font); le variabili shadcn in `:root`/`.dark` che oscurano il tema non esistono più
**And** un test compila il CSS con la Tailwind installata e verifica che `bg-primary`, `rounded-lg` e `font-sans` usino i valori del tema Penpot, rosso sul CSS di oggi e verde dopo la correzione
**And** il default globale di focus (anello `ring`) e di disabled (opacità 50%) resta nel livello `base`
**And** Storybook e `apps/web` caricano lo stesso CSS globale, e il build statico di Storybook resta verde.

### Story 2.18: Rimozione dei componenti di prova e della pipeline v2

As a sviluppatore,
I want togliere i componenti generati per prova e il codice della v2,
So that la v3 parta da un terreno pulito e nessuno usi più artefatti che non hanno un proprietario (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** `develop` dopo la Story 2.17
**When** rimuovo la v2
**Then** non esistono più Badge, Input, Alert, AccordionItem e ProductCard in `packages/ui/src/domains` (componente, test, story, barrel), `packages/scripts/data/components/*`, i contratti di estrazione, i comandi `library`, `propose`, `extract`, `render`, `gates`, `library-writer.ts`, `library-plan.ts`, `render.ts`, il guscio CLI e `ScriptError`, né il job `gates` in CI
**And** restano i contratti dell'editor in `@app/contracts` con fingerprint e `SCHEMA_VERSION` invariati, il registro delle proprietà, il comando `theme` (fino alla Story 2.26), Storybook con il suo smoke gate e il dropdown dell'editor su Base UI
**And** le skill `pds-bootstrap`, `pds-additive` e `pds-component` sono rimosse (da `.claude/skills`, `.agents/skills` e `module-help.csv`); `pds-setup` resta; il branch `story/2-17-skill-pds-sui-sei-comandi` si chiude senza merge
**And** `apps/web` e `ui/editor` non importano nulla di rimosso (verificato con `tsc` e la build), e la CI è verde
**And** i bug 7–10 dello spike (`COMPONENT_TOKENS`, render per componente, contratti caricati all'avvio, template e log) sono chiusi come "spariti con la v2" con rimando a questa story; le voci di `deferred-work.md` legate ad artefatti v2 sono chiuse come "senza oggetto".

### Story 2.19: Fixture sul catalogo Tailwind e codice nuovo dentro i confini

*(Punto 13 dello spike.)*

As a sviluppatore,
I want che i test di `scripts` usino il catalogo nato dal seme Tailwind e che i confini coprano le cartelle del nuovo codice,
So that riportare il modello v3 non renda rossa la suite (i 45 test dello spike) e nessun modulo nuovo sfugga alle regole di dipendenza (FR2, NFR6, AD-11).

**Acceptance Criteria:**

**Given** il seme `theme.css` dello spike (`tailwind-to-penpot/`) e i test di `scripts` scritti sul catalogo vecchio
**When** riallineo le fixture
**Then** i test di `scripts` leggono il catalogo token derivato dal seme Tailwind (catalogo dati a mano, non una lettura di Penpot), e la suite è verde con il codice di [`test-v3/`](../spikes/penpot-ai-kit-2026-10-10/test-v3/README.md) usato come riferimento
**And** `check-boundaries.mjs` di `packages/scripts` copre `src/core`, `src/penpot` e `src/server`: il nucleo non importa né disco né rete né MCP, solo `src/penpot` parla con Penpot, `src/server` non importa da `src/penpot` fuori dal punto di iniezione dell'adattatore
**And** ogni regola di confine ha un test rosso/verde automatico (chiude per `packages/scripts` l'azione aperta della retro Epic 1 sui `check-boundaries.mjs`; `ui`, `domain` e `api` si aggiungono qui o restano aperte, a scelta della story)
**And** nessuna cartella `v3/` entra nel repo: il codice nuovo vive nelle cartelle del seed.

### Story 2.20: Nucleo puro e registro delle proprietà

As a sviluppatore,
I want un nucleo di funzioni dati → dati con i tipi della pipeline e un registro unico delle proprietà Penpot,
So that ogni proprietà si insegni in un solo posto e tutta la logica sia testabile senza Penpot (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** `packages/scripts/src/core` vuoto e il registro attuale
**When** scrivo il nucleo
**Then** esistono gli schemi zod `Lettura`, `Finding` (`avviso` · `blocco` · `domanda` con opzioni) e `Change`, con un nome e senza versione, e nessuna funzione del nucleo tocca disco, rete, console o codice di uscita (verificato dai confini della Story 2.19)
**And** il registro ha una voce per proprietà con la sua traduzione in classe Tailwind (token, layout flex, dimensionamento), senza tabella ruolo → proprietà; `strokeWidth` produce classi (bug 4), `fontFamily` al singolare è registrato (bug 5), "fill" orizzontale e verticale produce classi (bug 3)
**And** livello 1 della CI: il nucleo è testato con dati minimi scritti a mano, un test rosso/verde per voce del registro
**And** livello 4 della CI: ogni classe del registro, espansa sui token del tema generato, produce CSS con la Tailwind installata.

### Story 2.21: Geometria e larghezza nel registro

As a designer/sviluppatore,
I want che dimensioni, posizioni e ritaglio disegnati in Penpot arrivino nel codice con regole fisse,
So that nessuna misura si perda in silenzio e il ritaglio non tagli l'anello di focus (FR2, NFR1, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il nucleo della Story 2.20
**When** aggiungo le voci di geometria e le regole di contesto come funzioni del nucleo
**Then** la misura fissa della radice uguale in tutte le celle si ignora, e se cambia tra le celle entra nella `cva` sotto l'asse (a′)
**And** un valore fuori scala diventa un valore arbitrario (`w-[37px]`) con un `Finding` di tipo avviso che riporta il valore in scala più vicino, per misure e posizioni
**And** il ritaglio segue le tre regole: `overflow-hidden` se un figlio esce o il genitore ha raggio e un figlio tocca un bordo; nessuna classe se niente esce e non c'è contenuto variabile; domanda se niente esce ma c'è contenuto variabile (testo da field, immagine, slot)
**And** `left+right` e `top+bottom` si traducono; un vincolo `scale` dà un avviso e nessuna classe; "fill" dentro hug dà una domanda; con tutti i figli in fill la misura fissa del genitore si ignora (limite di Penpot dello spike)
**And** ogni regola ha un test rosso/verde nel livello 1 della CI (bug 11, lato nucleo).

### Story 2.22: Verifica e generazione — chiavi di parte, `styles.ts`, scaffold, story

As a sviluppatore,
I want verificare un componente letto da Penpot e generarne stili, scaffold e story con un generatore unico,
So that un componente nuovo non richieda una riga di codice nella pipeline e il mio componente non venga mai riscritto (FR2, FR3, NFR5, AD-11).

**Acceptance Criteria:**

**Given** una `Lettura` scritta a mano (componente con istanza annidata, parti con e senza chiave, chiavi doppie)
**When** chiamo verifica, ordine e generazione del nucleo
**Then** la verifica restituisce: parte senza chiave → domanda con la chiave proposta dal nome del layer; chiavi doppie → domanda *lista* (`repeat`) o *parte nuova*; aspetto → avvisi; e la generazione rifiuta finché resta una domanda aperta
**And** il generatore produce `<Comp>.styles.ts` con una `cva` per chiave (tutti gli assi `option`, varianti delle istanze annidate), intestazione `@generated` con versione del generatore e hash, e `<Comp>.stories.tsx` con una story per cella
**And** lo scaffold crea `<Comp>.tsx` solo se non esiste, con `data-slot` = chiave di parte e l'elemento HTML proposto (domanda se il layer è ambiguo); un `<Comp>.tsx` esistente resta identico byte per byte dopo ogni rigenerazione (prova T4b-2 dello spike come test)
**And** un'istanza annidata diventa `<Comp />` con la variante scelta in Penpot e validata; un override di stile su un'istanza è un blocco; il dimensionamento dell'istanza non è un override (bug 12, lato nucleo)
**And** asse riservato `state`: hover/active disegnati diventano prefissi su tutte le taglie, mai una prop; celle mancanti non sono un errore; focus e disabled non disegnati usano il default globale
**And** `build_order` restituisce l'ordine di generazione dalle istanze e rifiuta un componente che contiene un componente non ancora generato
**And** una parte tolta dal TSX dallo sviluppatore è un avviso (export inutilizzato); un cambio di struttura restituisce `Change[]` per `styles.ts` e, per ogni parte aggiunta, tolta o diventata lista, un suggerimento con esempio sul TSX attuale, mai applicato
**And** tutto è testato nel livello 1 della CI (bug 8 chiuso: nessun codice per componente).

### Story 2.23: Adattatore Penpot `readComponent`

As a sviluppatore,
I want un unico punto che legge un componente da Penpot e lo restituisce come `Lettura`,
So that tutte le proprietà del registro arrivino dal file vero e nessun altro modulo parli con Penpot (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** Penpot 2.18.3 locale con il file "tailwind" dello spike (Badge, ShopCard, Carousel)
**When** chiamo `readComponent` via `execute_code`
**Then** la `Lettura` contiene celle, token, layout flex (bug 2), dimensionamento "fill" e "hug" (bug 3), ritaglio, dimensioni fisse, posizione e vincoli degli assoluti, "fill" verticale (bug 11), istanze con componente d'origine, variante e override confrontati con l'istanza principale (bug 12), e lo shared plugin data `pagebuilder` di container e layer
**And** le istanze si riconoscono dal componente d'origine, non solo dal nome (limite `switchVariant` dello spike); gli elementi si ritrovano da nomi e plugin data, mai dallo `storage` del plugin
**And** la `Lettura` è validata dallo schema zod del nucleo, e una proprietà nel registro che la lettura non porta è un errore che la nomina
**And** l'adattatore non ha fixture di lettura Penpot (regola 5): i suoi test girano solo nel collaudo (Story 2.25); in CI l'adattatore è sostituito da quello finto della Story 2.24
**And** il README dell'adattatore documenta la scheda Penpot sospesa dal browser (finestra visibile o i flag `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows`).

### Story 2.24: Server MCP `pds` e controllo dei file generati in CI

As a sviluppatore,
I want un server MCP `pds` che esponga il nucleo come strumenti e scriva i file generati,
So that la skill non passi da stringhe di shell né scriva a mano un file `@generated`, e la CI sappia se un file generato è stato toccato (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il nucleo (Story 2.20) e l'adattatore (Story 2.23)
**When** avvio il server `pds` registrato nella configurazione MCP del progetto
**Then** espone `tokens_from_css`, `describe_component`, `verify_component`, `build_order`, `generate_component` e `extract_theme`, con ingressi e uscite validati dagli schemi del nucleo; non tiene stato, rilegge Penpot a ogni chiamata e non scrive mai su Penpot
**And** `generate_component` scrive lui i file `@generated` e restituisce `Change[]`; non scrive se ci sono chiavi doppie, parti senza chiave o domande aperte
**And** livello 2 della CI: il server gira in memoria con un adattatore Penpot finto, un test per strumento e per schema
**And** livello 3 della CI: per ogni file `@generated` del repo, hash che non torna = blocco che nomina il file; versione del generatore vecchia con hash giusto = avviso
**And** non esiste una CLI di prodotto; il README dice come riavviare il server dopo una modifica del nucleo.

### Story 2.25: Collaudo degli aggiornamenti di Penpot

As a sviluppatore,
I want un componente campione e una procedura che dicano se una versione nuova di Penpot rompe la lettura,
So that il Penpot vero si aggiorni solo quando la pipeline lo legge ancora tutto (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il registro completo (Story 2.20–2.21) e l'adattatore (Story 2.23)
**When** costruisco il campione e lancio il collaudo a mano su un'istanza Penpot nuova
**Then** esiste un componente campione salvato come `.penpot` nel repo che usa **ogni** voce del registro (geometria compresa) e ogni chiave di plugin data (`contract`, `part`, `when`, `slot`)
**And** la procedura (istanza nuova → import del campione → collaudo) verifica che ogni proprietà del registro compaia nella lettura e che il campione le usi tutte; un'esclusione è un errore che nomina la proprietà
**And** il collaudo dice se "fill" dentro hug è leggibile; l'esito è registrato nel README del collaudo e nel `penpot-pipeline.md` (quali operazioni cancellano i plugin data si misura nella Story 2.29)
**And** la procedura dice che il Penpot vero (oggi 2.18.3, backup prima della migrazione) si aggiorna solo se il collaudo passa, e come distinguere una migrazione dell'import `.penpot` da un guasto dell'adattatore.

### Story 2.26: Tema da seme CSS, varianti di tema e font

As a designer/sviluppatore,
I want portare un tema Tailwind in Penpot e riportarlo in codice con le sue varianti e i suoi font,
So that il designer parta da un tema idiomatico e il codice torni idiomatico (`bg-primary`, `text-sm`) senza perdite (FR1, NFR5, AD-6, AD-11).

**Acceptance Criteria:**

**Given** il seme `theme.css` (Tailwind v4 + ruoli shadcn) e il server `pds`
**When** chiamo `tokens_from_css` e poi `extract_theme`
**Then** `tokens_from_css` restituisce set e temi Penpot dal seme, comprese le varianti dichiarate come `[data-<gruppo>="<nome>"]`; un'ombra con `spread` negativo diventa 0 e un colore fuori sRGB il più vicino, entrambi con un avviso
**And** `extract_theme` legge **tutti** i set e i temi, non solo quelli attivi, accetta nomi uguali in set diversi (bug 6) e scrive `theme.css` e `themes/<gruppo>-<nome>.css` `@generated`; il giro seme → Penpot → CSS chiude senza perdite sul seme dello spike (test di livello 4)
**And** con `fonts=fontsource` in `pds-setup`, `extract_theme` scrive `fonts.css` `@generated` dalle famiglie del tema; Next e Storybook caricano lo stesso file; `next/font`, Geist e l'override dei font in `globals.css` non esistono più
**And** il comando `theme` e il suo codice sono rimossi: non resta nessuna CLI di prodotto.

### Story 2.27: Sezioni

As a designer/sviluppatore,
I want leggere e generare una sezione con slot come un componente,
So that hero, carousel e sezioni prodotto si disegnino in Penpot con la stessa libertà dei componenti (FR2, FR4, AD-5, AD-11).

**Acceptance Criteria:**

**Given** un contratto `sections/<nome>.ts` con almeno uno slot e un container Penpot (Carousel dello spike: `perView` 1–3, slot di `shop-card`)
**When** verifico e genero la sezione
**Then** un field `structure` è un asse se Penpot ha una variante con lo stesso nome, altrimenti un rendering condizionale con `when=<field>` su una parte; senza asse né `when` è una domanda (quale parte, asse da disegnare, o field in `content` con MS)
**And** uno slot è il layer i cui figli sono tutti istanze dei componenti ammessi dallo slot; se è ambiguo è una domanda e la risposta è `slot=<id>`; le istanze nello slot sono esempi
**And** una forma disegnata nella sezione è una parte con la sua chiave, non un errore; un'icona è una parte con chiave e quale icona la propone lo scaffold
**And** una sezione con parti proprie ha container, `styles.ts` e scaffold; una sezione di sola disposizione non ne ha
**And** la story della sezione usa i figli di default del contratto, una per cella (bug 13 chiuso)
**And** ogni regola ha un test rosso/verde nel livello 1 della CI.

### Story 2.28: Skill `pds-design` e configurazione di progetto

As a designer/sviluppatore,
I want una skill che porti tema e componenti in Penpot attraverso il kit ufficiale,
So that il designer lavori con gli strumenti di Penpot e io approvi i contratti senza scrivere codice di pipeline (FR1, FR2, AD-11).

**Acceptance Criteria:**

**Given** il server `pds` e penpot-ai-kit 0.5.1
**When** costruisco `pds-design` con `bmad-workflow-builder`
**Then** le voci sono **TB** (tema base dal seme, via `tokens_from_css` e `penpot-foundations`), **TV** (variante di tema), **CN** (ricetta → domande → proposta dei contratti → approvazione), **DC** (disegna il componente, dal contratto o libero, via `penpot-component-factory`), **CD** (bozza del contratto dal design, via `describe_component` → approvazione), **MS** (diff sui contratti → approvazione)
**And** la skill fa da wrapper alle skill del kit dove ha senso; le celle si costruiscono da zero (il clone di `createVariants.js` annida una copia); una cella per chiamata e la verifica in una chiamata separata (`applyToken` lento); i trigger non entrano in conflitto con quelli del kit
**And** `pds-design` non scrive metadati in Penpot; offre un controllo di stato che chiama `verify_component` e mostra chiavi mancanti o doppie al designer
**And** `pds-setup` scrive `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource` e rifiuta in modo esplicito ogni altro valore
**And** ogni scrittura (contratti, Penpot) passa da una conferma; un contratto dell'editor cambiato alza `SCHEMA_VERSION` e il fingerprint; `module-help.csv` è aggiornato; la skill è verificata eseguendo le due strade (dal contratto, dal design) su un componente reale.

### Story 2.29: Skill `pds-code`

As a sviluppatore,
I want una skill che porti un componente da Penpot al codice, risponda alle domande e aggiorni gli stili,
So that generare e riallineare un componente sia una sequenza di conferme e non di comandi (FR2, FR3, NFR1, AD-11).

**Acceptance Criteria:**

**Given** una copia del campione del collaudo (Story 2.25) sull'istanza di collaudo
**When**, prima che la skill scriva plugin data, misuro a mano raggruppa, booleane, copia tra file, ripristino di versione, stacco dell'istanza e duplica
**Then** per ogni operazione l'esito sugli shared plugin data `pagebuilder` (resta / si perde / si perde in parte) è registrato nel README del collaudo e in `penpot-pipeline.md` § CI e collaudo
**And** la procedura del collaudo ripete queste operazioni come checklist a ogni aggiornamento di Penpot.

**Given** il server `pds`, il collaudo (Story 2.25) e `pds-design`
**When** costruisco `pds-code` con `bmad-workflow-builder`
**Then** le voci sono **ET** (estrai tema), **VC** (verifica), **GC** (genera `styles.ts` e story, scaffold se manca il TSX, giudizio in Storybook), **AC** (rigenera `styles.ts`, riassume i cambi, suggerimenti per i cambi di struttura), **GA** (gate: `tsc`, test, tema nel CSS, contrasto, axe, un pacchetto font per famiglia)
**And** a ogni `Finding` di tipo domanda la skill mostra le opzioni, scrive la risposta in Penpot come shared plugin data `pagebuilder` (`part`, `when`, `slot`, risposta) via MCP Penpot **solo dopo conferma**, e non la richiede più; mai stile, geometria, layer o token
**And** GC rispetta `build_order`; il giudizio in Storybook ha "testo + colore" come voce fissa; AC suggerisce le modifiche del TSX con un esempio e le applica solo su richiesta
**And** la skill non scrive mai un file `@generated` (li scrive il server) e si ferma solo sulle decisioni umane; `module-help.csv` è aggiornato; verificata su un componente reale per GC e per un AC con cambio di struttura.

### Story 2.30: Comportamento accessibile

As a sviluppatore,
I want che la skill mi proponga il comportamento del componente da Base UI o da una ricetta, un pezzo alla volta e con un test per pezzo,
So that il comportamento accessibile entri nel mio componente senza diff in blocco e senza dipendenze scelte da altri (FR3, NFR1, AD-3, AD-11).

**Acceptance Criteria:**

**Given** un componente generato da `pds-code` GC (Carousel dello spike come caso)
**When** chiedo il comportamento
**Then** se Base UI ha il primitivo lo scaffold lo usa e la skill propone solo il collegamento; altrimenti la skill legge dal vivo la ricetta shadcn `base` e il pattern APG, senza salvarli
**And** la skill propone prima l'elenco dei comportamenti da scegliere, poi un diff piccolo per comportamento con conferma, e un test per ogni comportamento (file dello sviluppatore, eseguito da GA); una dipendenza nuova la sceglie lo sviluppatore, con l'alternativa senza dipendenze
**And** la riproposta avviene solo su richiesta o quando un cambio di struttura tocca una parte usata da un comportamento
**And** axe in GA è bloccante su ogni story `@generated`, con una prova rosso/verde; la tastiera è coperta dai test di comportamento
**And** `a11y-baseline.md` riceve la §6 (stati, axe, giudizio "testo + colore").

### Story 2.31: Rigenerazione dei componenti di prova con la v3

As a designer/sviluppatore,
I want rifare Badge, ShopCard e Carousel con le due skill, dal disegno al componente,
So that il modello v3 sia dimostrato su un atomo, una card con istanze e una sezione prima della libreria (FR1, FR2, FR3, NFR1).

**Acceptance Criteria:**

**Given** le Story 2.17–2.30 e il file Penpot "tailwind"
**When** genero nell'ordine di `build_order` Badge, ShopCard (con istanze di Badge, contratto dell'editor corretto dello spike: link relativi, immagine e testo del badge facoltativi, `category` obbligatoria) e la sezione Carousel
**Then** ciascuno ha `styles.ts` e story `@generated`, il componente dello sviluppatore, test e axe verdi, e il giudizio visivo di Alessandro in Storybook
**And** Badge passa dalla strada *dal contratto* e ShopCard dalla strada *dal design*; un cambio di aspetto in Penpot diventa una riga di `styles.ts` e un cambio di struttura un suggerimento sul TSX (T5 e T6 dello spike)
**And** i cambi del contratto dell'editor passano da un aumento di `SCHEMA_VERSION` (decisione 13 dello spike)
**And** la CI a quattro livelli è verde e non legge Penpot.

### Story 2.32: Libreria componenti accessibile

*(ex 2.18, riscritta dal correct-course 2026-10-17.)*

As a sviluppatore,
I want una libreria di componenti organizzata per dominio e conforme alla a11y baseline,
So that l'editor e le composizioni possano costruirci sopra (FR3, NFR1).

**Acceptance Criteria:**

**Given** la v3 dimostrata (Story 2.31)
**When** creo i componenti dei domini (data-display, inputs, feedback, layout, navigation, overlays, commerce) in `packages/ui/src/domains`, ciascuno con `pds-design` e `pds-code` nell'ordine di `build_order`
**Then** ogni componente ha un contratto dell'editor, `styles.ts` e story `@generated` e un componente dello sviluppatore; il comportamento viene dal primitivo Base UI se esiste, altrimenti dalla ricetta shadcn `base` + APG proposta per comportamento (Story 2.30)
**And** ogni componente interattivo ha focus visibile WCAG AA (default globale o cella disegnata), stato comunicato da testo + colore (voce del giudizio in Storybook) e ARIA corretto; axe è verde su ogni story generata e la tastiera è coperta dai test di comportamento
**And** Table e Carousel si disegnano in Penpot come gli altri: niente segnaposto; gli stili sono generati e la logica propria sta nel componente dello sviluppatore
**And** un componente senza container in Penpot (3D, mappe, configuratori) è scritto a mano: contratto sì, niente di generato, solo GA
**And** il "Filtro attivo" (Badge + icona-link) è un componente con un'istanza di Badge, non una parte opzionale del Badge
**And** i componenti in `domains/` non importano da `editor/`, verificato da lint bloccante.


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
**Then** solo gli assi `option` diventano campi (l'asse riservato `state` vive solo in Penpot); Box, Flex, Grid e Columns hanno slot (content; col1/col2/col3) e soli assi a valori token (Box: background/padding/radius/border; Flex: direction/align/justify/gap/wrap)
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

### Story 3.4: Sezioni nell'editor

*(Riscritta dal correct-course 2026-10-17: una forma disegnata in una sezione non è più un errore.)*

As a sviluppatore/autore,
I want esporre in Puck le sezioni disegnate in Penpot, rigide e aperte solo negli slot dichiarati,
So that hero e sezioni siano fedeli al disegno e l'autore cambi solo il contenuto (FR4, AD-5, AD-11).

**Acceptance Criteria:**

**Given** una sezione generata con la v3 (contratto `sections/<nome>.ts` con almeno uno slot, `styles.ts` e componente dello sviluppatore, Story 2.27)
**When** la registro in `puckConfig`
**Then** è esposta in Puck per nome; la struttura è bloccata e i campi `content` sono modificabili; gli slot accettano solo i blocchi dell'`allow` fino a `max` (`resolvePermissions`) e il core lo impone comunque (Story 4.3)
**And** una forma disegnata nella sezione **non è un errore**: è una parte della sezione con la sua chiave, con stili generati come in un componente
**And** uno slot si riconosce in Penpot (layer i cui figli sono istanze dei componenti ammessi, o `slot=<id>` scritto da `pds-code`); uno slot del contratto che in Penpot non si trova più è un blocco di `verify_component` che nomina slot e sezione
**And** i valori iniziali in editor sono i figli e i default del contratto; i testi delle istanze in Penpot restano esempi
**And** una sezione di sola disposizione (nessuna parte propria) è esposta senza `styles.ts`.

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
