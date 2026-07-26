---
stepsCompleted: ["step-01"]
inputDocuments:
  prd_equivalent:
    - "_bmad-output/specs/spec-page-builder/SPEC.md"
    - "_bmad-output/specs/spec-page-builder/design-system.md"
    - "_bmad-output/specs/spec-page-builder/penpot-pipeline.md"
    - "_bmad-output/specs/spec-page-builder/rbac-matrix.md"
    - "_bmad-output/specs/spec-page-builder/a11y-baseline.md"
    - "_bmad-output/specs/spec-page-builder/glossary.md"
  architecture:
    - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md"
  epics:
    - "_bmad-output/planning-artifacts/epics.md"
  ux: []
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-26
**Project:** page-builder

## Document Discovery

### PRD (sostituito da SPEC canonico)
- `_bmad-output/specs/spec-page-builder/SPEC.md` + companion (design-system.md, penpot-pipeline.md, rbac-matrix.md, a11y-baseline.md, glossary.md)
- Nota: questo progetto usa il workflow `bmad-spec` al posto del PRD tradizionale; SPEC.md è trattato come equivalente PRD per questa assessment.

### Architecture
- `_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md`
- Review pregresse disponibili in `.../reviews/` (review-adversarial.md, review-rubric.md, review-version-check.md)

### Epics & Stories
- `_bmad-output/planning-artifacts/epics.md` — 6 epic, 26 story, generato da SPEC + Architecture Spine

### UX Design
- **Non trovato.** Nessun documento UX dedicato esiste nel repository.

## Issues Found

- ⚠️ WARNING: Nessun documento UX presente — gap da colmare prima dell'implementazione (vedi step successivi per impatto).
- Nessun duplicato whole/sharded da risolvere.

## User Confirmation

Confermato dall'utente il 2026-07-26: procedere con i documenti sopra elencati per l'assessment.

## PRD Analysis (SPEC.md + companion, in sostituzione del PRD)

### Functional Requirements

FR1 (CAP-1): Il sistema estrae i design token da Penpot e genera lo strato token (colori/tipografia/spacing/radii/ombre) consumato dalla UI, data-driven dal catalogo Penpot; un nuovo set Penpot produce automaticamente una nuova sezione di output senza modifiche al codice; artefatti marcati `@generated`, non editabili a mano.

FR2 (CAP-2): Il sistema genera primitive React accessibili dai componenti Penpot, mappando la matrice di varianti Penpot in un modello di varianti; la pipeline emette componente + test + story + barrel; i file scritti a mano sono preservati (skip salvo forzatura); un gate di completezza artefatti passa in CI.

FR3 (CAP-3): Il sistema offre una libreria di primitive UI headless/accessibili organizzate per dominio (data-display, inputs, feedback, layout, navigation, overlays), ciascuna conforme alla a11y-baseline.

FR4 (CAP-4): Il sistema incapsula le primitive come blocchi del page-builder (puck-components), con campi validati da schema e controlli guidati dai token, aggregati in un'unica config con slot annidabili; una modifica ai token spacing/radii si propaga sia agli stili sia alle opzioni dei campi dei blocchi.

FR5 (CAP-5): Il sistema fornisce composizioni di prodotto per l'editor (LifecycleBadge, SaveStateIndicator, TopBar, PageList, VersionList, EmptyState), costruite solo su primitive+token, senza che la shell dell'editor introduca dipendenze dirette dal dominio page-builder nelle primitive.

FR6 (CAP-6): Un utente autorizzato costruisce/modifica una pagina in drag-and-drop con l'editor a blocchi; il layout è persistito come payload strutturato (forma Puck `{content, root, zones}`, `schemaVersion`, block-id stabili); una pagina reale fa round-trip lossless (salva→ricarica identico) e viene renderizzata correttamente.

FR7 (CAP-7): Il sistema salva il layout corrente come nuova versione DRAFT (autosave); lo stato salvato/non-salvato è comunicato all'utente tramite regione `aria-live`.

FR8 (CAP-8): Il sistema mantiene una cronologia versioni per pagina e permette di promuovere una versione a PUBLISHED; pubblicare una seconda versione retrocede atomicamente la precedente a DRAFT; invariante autoritativo: al più 1 PUBLISHED per pagina.

FR9 (CAP-9): Il sistema permette il rollback di una pagina a una versione precedente, promuovendola a PUBLISHED e retrocedendo l'attuale; dopo il rollback la versione scelta è quella pubblicata.

FR10 (CAP-10): Il sistema gestisce il lifecycle pagina DRAFT/PUBLISHED/ARCHIVED; l'archiviazione preserva le versioni; il restore riporta la pagina a DRAFT.

FR11 (CAP-11): Il sistema rende una pagina pubblicamente tramite slug (versione pubblicata di default, ultima bozza su richiesta); la pagina pubblicata è anche il render della vetrina e-commerce, con blocchi commerce che risolvono i dati a render-time.

FR12 (CAP-12): Il sistema governa le operazioni tramite i ruoli Admin/Editor/Cliente, deny-by-default, con enforcement server-side su ogni via di modifica (matrice completa in rbac-matrix.md); il server rifiuta le operazioni fuori-ruolo a prescindere dalla UI.

FR13 (CAP-13): Il sistema mantiene una single source of truth che classifica i campi di ogni blocco come `structure` o `content`, pilotando permessi editor e sanitizzazione lato server; i campi content sono sanitizzati al salvataggio/publish; campi/componenti sconosciuti sono trattati come content di default (fail-safe).

FR14 (CAP-14): Il sistema conserva uno storico immutabile (audit trail) di chi ha cambiato cosa e quando su pagine/versioni, consultabile solo dall'Admin, per pagina e per utente.

FR15 (CAP-15): Il sistema permette di comporre pagine con blocchi data-driven commerce (es. ProductCard/ProductGrid/AddToCart) che agganciano dati di catalogo/carrello da una sorgente commerce esterna intercambiabile (astrazione di provider); cambiare sorgente richiede solo un cambio adapter, non modifiche ai blocchi.

**Total FRs: 15** (numerate 1:1 sulle capability CAP-1…CAP-15 dello SPEC)

### Non-Functional Requirements

NFR1 (Accessibilità — a11y-baseline.md): Target **WCAG 2.1 AA** per ogni primitiva/composizione: focus visibile (contrasto ≥3:1), mai rimuovere outline senza sostituto equivalente; stato comunicato sempre con testo+colore (mai colore da solo); ARIA corretta per tipo componente (Dialog, Toast, Table, Tabs, Dropdown, Breadcrumb); regioni `aria-live` (polite/assertive) per feedback asincroni; overlay montati su portale root DOM condiviso sopra il canvas editor.

NFR2 (Sicurezza/Autorizzazione — rbac-matrix.md, Constraints SPEC): Deny-by-default, enforcement server-side su ogni via di modifica (copertura totale, nessun endpoint CRUD generico scoperto); confine content-vs-structure enforced lato server, non solo UI.

NFR3 (Integrità dati — Constraints SPEC): Invariante autoritativo "al più 1 PUBLISHED per pagina" garantito a livello autoritativo (non solo logica applicativa) — richiede probabilmente vincolo a livello di storage/transazione.

NFR4 (Fedeltà design — Constraints SPEC, penpot-pipeline.md): Aderenza stretta ai valori Penpot, mai inventare valori mancanti (solo default neutri); nomi token/componenti allineati 1:1 Penpot↔codice.

NFR5 (Manutenibilità pipeline generativa — Constraints SPEC): Artefatti generati marcati `@generated`, mai editati a mano; rigenerazione preserva file scritti a mano (skip salvo forzatura); gate di completezza artefatti (componente+test+story+barrel) verificato in CI.

NFR6 (Integrità del payload — Constraints SPEC): Payload di layout Puck `{content, root, zones}` accettato 1:1 senza riscrittura strutturale; ogni blocco con id stabile indipendente dalla posizione (abilita diff/audit a livello di blocco).

NFR7 (Auditabilità leggera — Constraints SPEC): Storico contenuti modellato tramite versioni di pagina esplicite; l'audit copre solo metadati immutabili, non duplica l'intero blob di contenuto.

NFR8 (Architettura/Layering — design-system.md, Constraints SPEC): Confine di layering rigido `tokens ← primitives ← {puck-components, ui}`; le primitive non importano mai da `ui` né conoscono il dominio page-builder; il frontend DEVE consumare il design system stesso, non uno stack UI parallelo (anti-pattern legacy da non ripetere).

**Total NFRs: 8**

### Additional Requirements / Constraints

- **Stack-agnosticismo esplicito**: lo SPEC non fissa framework backend/DB/auth/ORM/transport — decisioni rimandate alla fase architecture (già svolta, vedi ARCHITECTURE-SPINE.md).
- **Riscrittura greenfield full-TypeScript**: sostituisce uno stack legacy (JHipster/Spring Boot, Strapi, Keycloak, Postgres/Envers) esplicitamente scartato come riferimento, non target.
- **Preservazione pipeline Penpot** come parte esplicita del target (assumption SPEC).
- Ruoli di dominio (Admin/Editor/Cliente) e modello Page/PageVersion sono concetti di prodotto stack-agnostici da preservare; l'identità utente arriva dallo stack scelto in architecture.
- Le pagine mescolano contenuto statico del design system e blocchi commerce data-driven; la vetrina e-commerce è servita dal page-builder stesso.

### Non-goals (fuori scope, dichiarati nello SPEC)

- Scelte di stack/tecnologia (rimandate ad architecture, già decise).
- Page-builder legacy su Strapi e il suo content model.
- Migrazione dati dallo store legacy (rimandata a epica futura).
- UI di gestione fine-grained assegnazione Cliente↔pagina (solo il concetto è in scope).
- Scelta della sorgente commerce concreta (Shopify vs backend proprio) e sua implementazione.
- Logica commerce vera e propria (catalogo, pricing, carrello, checkout, ordini) — vive nella sorgente esterna.

### PRD (SPEC) Completeness Assessment

Lo SPEC è insolitamente completo per un documento "PRD-equivalente": ogni capability ha intent+success esplicito, i constraint sono precisi e testabili (es. invariante ≤1 PUBLISHED, WCAG 2.1 AA, layering tokens←primitives), e i non-goals sono dichiarati esplicitamente evitando scope creep. Punti di attenzione:
- Il target WCAG 2.1 AA è marcato "da confermare" nel file a11y-baseline.md stesso (open question ereditata) — non bloccante ma da chiudere formalmente.
- Nessun requisito di performance/scalabilità esplicito (es. tempi di risposta editor, concorrenza autori sulla stessa pagina) — assente sia nello SPEC sia nei companion; possibile gap NFR.
- Nessun documento UX dedicato: gli screen/flow dell'editor (TopBar, PageList, VersionList, drag-and-drop) sono descritti solo a livello di componente/composizione, non di flusso utente end-to-end o wireframe — coerente con l'obiettivo dichiarato dall'utente di "iniziare a definire PR/UX" ora.

## Epic Coverage Validation

epics.md contiene già una propria "Requirements Inventory" (FR1-15, NFR1-8, Additional Requirements da AD-1…13, e persino "UX Design Requirements" UX-DR1-8 derivate da a11y-baseline.md/design-system.md) più una **FR Coverage Map** esplicita — traccia rara e di alta qualità in questa fase.

### Coverage Matrix

| FR | Requisito (sintesi) | Epic Coverage | Status |
|---|---|---|---|
| FR1 | Pipeline token Penpot→codice | Epic 2 — Story 2.1 | ✓ Covered |
| FR2 | Generazione componenti Penpot→primitive | Epic 2 — Story 2.2 | ✓ Covered |
| FR3 | Libreria primitive accessibili | Epic 2 — Story 2.3 | ✓ Covered |
| FR4 | Blocchi Puck token-driven | Epic 3 — Story 3.1/3.2 | ✓ Covered |
| FR5 | Composizioni editor | Epic 3 — Story 3.4 | ✓ Covered |
| FR6 | Authoring drag-and-drop, round-trip lossless | Epic 4 — Story 4.1/4.2 | ✓ Covered |
| FR7 | Autosave/bozza + stato salvato | Epic 4 — Story 4.2/4.4 | ✓ Covered |
| FR8 | Publish, ≤1 PUBLISHED atomico | Epic 5 — Story 5.1 | ✓ Covered |
| FR9 | Rollback | Epic 5 — Story 5.2 | ✓ Covered |
| FR10 | Lifecycle archive/restore | Epic 5 — Story 5.3 | ✓ Covered |
| FR11 | Render pubblico by-slug + vetrina | Epic 6 — Story 6.1/6.2 | ✓ Covered |
| FR12 | RBAC deny-by-default server-side | Epic 1 (fondamenta, Story 1.4/1.5) + enforcement in Epic 4/5/6 | ✓ Covered |
| FR13 | Classificazione structure/content | Epic 3 — Story 3.3 (definizione) + Epic 4 — Story 4.3 (enforcement) | ✓ Covered |
| FR14 | Audit trail | Epic 5 — Story 5.4 | ✓ Covered |
| FR15 | Commerce provider pluggable | Epic 6 — Story 6.3/6.4 | ✓ Covered |

Tutti gli NFR1-8 e i vincoli architetturali (AD-1…13) risultano ereditati esplicitamente dalle story (campo "Vincoli" per ogni epic), non solo elencati nell'inventory.

### Missing Requirements

Nessun FR risulta scoperto. Non risultano epic/story che coprano requisiti assenti dallo SPEC (nessun "FR in epics ma non in PRD").

Unica osservazione non bloccante: **FR12 e FR13** sono marcati come "fondamenta/definizione" in un epic e "enforcement" in un altro (pattern dichiarato esplicitamente, non un gap — ma va verificato in fase di story-writing che l'AC di enforcement non venga dato per scontato nell'epic successivo).

### Coverage Statistics

- Total PRD (SPEC) FRs: 15
- FRs covered in epics: 15
- Coverage percentage: **100%**

## UX Alignment Assessment

### UX Document Status

**Not Found.** Nessun `*ux*.md` né cartella sharded in `planning-artifacts/`. Cercati anche riferimenti UI in altri documenti (vedi sotto).

### UX implied? — Sì, fortemente

Lo SPEC descrive esplicitamente un'applicazione **user-facing con editor visuale drag-and-drop** (CAP-6), composizioni UI dedicate (TopBar, PageList, VersionList, EmptyState — CAP-5), stati di lifecycle comunicati visivamente (CAP-10, a11y-baseline.md), overlay (Dialog/Toast/Drawer) e requisiti WCAG 2.1 AA obbligatori. epics.md ha già colmato parzialmente il gap trattando a11y-baseline.md/design-system.md come "UX Design Requirements" di prima classe (UX-DR1-8), ma questi coprono solo requisiti di accessibilità e catalogo componenti — **non** flussi utente end-to-end, wireframe, information architecture dell'editor (es. come naviga un Editor da PageList → editor → publish → preview), o stati di errore/vuoti a livello di schermata.

### Alignment Issues

- **UX ↔ SPEC:** nessun conflitto rilevabile (non c'è UX da confrontare), ma copertura parziale: i requisiti UX-DR in epics.md sono derivati bottom-up dai companion tecnici (a11y, design-system), non da un documento UX top-down con user journey e wireframe.
- **UX ↔ Architecture:** l'architettura (ARCHITECTURE-SPINE.md) non menziona requisiti di responsività, performance percepita, o budget di latenza UI — coerente con NFR8 in epics.md ("Deferred — Perf: budget di latenza render/save deliberatamente deferiti"). Nessun blocco architetturale per requisiti UX non ancora definiti, ma nemmeno supporto esplicito.

### Warnings

⚠️ **WARNING: UX implicito ma documento mancante.** Prima di iniziare l'implementazione degli Epic 3-4 (blocchi editor, drag-and-drop), è fortemente raccomandato produrre un documento UX (via `bmad-ux`) che copra almeno:
- User journey principali: Editor crea pagina → drag-and-drop blocchi → salva bozza → pubblica → visitatore vede pagina; Cliente modifica solo content su pagina assegnata; Admin consulta audit.
- Wireframe/flow della shell editor (TopBar, canvas, pannello proprietà blocco, PageList, VersionList).
- Stati di errore e vuoti a livello di schermata (oltre a quelli già coperti a livello di componente in a11y-baseline.md).

Questo è coerente con l'obiettivo dichiarato dall'utente in questa sessione ("devo iniziare a definire PR/UX") — la validazione conferma che è il momento giusto per farlo, idealmente **prima** di iniziare le story di Epic 3/4.

## Epic Quality Review

### Epic Structure Validation

**Epic Independence:** confermata per l'intera catena. Epic 2 (design system da Penpot) non dipende da Epic 1 (nessun vincolo incrociato dichiarato) — può essere sviluppato anche in parallelo. Epic 3 usa solo output di Epic 2. Epic 4 usa Epic 1 (auth/RBAC) + Epic 3 (blocchi). Epic 5 usa Epic 1 (DB) + Epic 4 (versioni esistenti). Epic 6 usa Epic 5 (versioni pubblicate) + Epic 1 (read pubblica). **Nessuna dipendenza in avanti rilevata** (nessun epic richiede output di un epic successivo).

**Starter Template Requirement:** ✅ rispettato. L'architettura specifica `create-better-t-stack`, e Story 1.1 è correttamente "Scaffolding greenfield del workspace" con clone/init, dipendenze, versioni pinnate.

**Greenfield Indicators:** ✅ presenti — setup iniziale (1.1), config ambiente (1.6 envelope Docker/env), nessuna story di migrazione dati legacy (coerente coi Non-goals dello SPEC).

### 🟠 Major Issues

**1. Epic 1 bundla più milestone tecniche senza valore utente diretto.** Story 1.1 (scaffolding), 1.2 (skeleton dominio esagonale), 1.3 (schema DB), 1.6 (envelope Docker) sono infrastruttura pura — nessun utente ne beneficia direttamente presa isolatamente. Solo Story 1.4/1.5 (autenticazione + RBAC) hanno valore utente diretto ("un utente si autentica"), e sono comunque borderline secondo lo standard ("Authentication System" è esplicitamente segnalato come caso limite). Questo è un pattern comune e per certi versi giustificato in un progetto greenfield con vincoli architetturali forti (invariante DB, layering esagonale) da fissare prima di ogni feature utente — ma va segnalato come deviazione dallo standard "ogni epic consegna valore utente", non ignorato.
   - *Raccomandazione:* accettabile così com'è per un Epic "Fondamenta" greenfield (pattern esplicitamente contemplato dal workflow per progetti greenfield), ma tienilo esplicito nella pianificazione: Epic 1 è un'eccezione consapevole alla regola "epic = valore utente", non un precedente da ripetere per gli epic successivi.

**2. Story 1.3 crea tutte e 4 le tabelle (Page, PageVersion, PageAssignment, AuditLog) in un'unica story anticipata**, anche se `PageAssignment` serve solo per l'assegnazione Cliente (usata a partire da Epic 4) e `AuditLog` solo da Epic 5. Questo è l'anti-pattern esplicitamente segnalato dallo standard ("Wrong: Epic 1 Story 1 creates all tables upfront").
   - *Impatto:* basso — l'invariante ≤1 PUBLISHED (AD-7) richiede lo schema Page/PageVersion fissato presto, e definire l'intero schema in una migration coerente riduce il rischio di migration incrementali fragili su un progetto già a schema noto (non è "scoperta iterativa" di un dominio incerto).
   - *Raccomandazione:* non bloccante. Se si vuole aderire strettamente allo standard, si potrebbe spostare la creazione di `PageAssignment` in Epic 4 e `AuditLog` in Epic 5 — ma dato che lo schema relazionale è già interamente noto dallo SPEC/Architecture (non è un dominio in scoperta), il rischio di questa scelta è marginale.

### 🟡 Minor Concerns

- Story 1.2 definisce i port outbound `AuditWriter`, `CacheInvalidator`, `CommerceProvider` in anticipo rispetto al loro uso reale (Epic 5/6). Non è una vera dipendenza in avanti (sono solo interfacce, non implementazioni), ma vale la pena notare che è una scelta di design (contratti hexagonal-architecture fissati presto) più che una necessità.
- Nessuna violazione trovata su formato AC (Given/When/Then rispettato ovunque), testabilità, o copertura degli scenari di errore — la qualità delle Acceptance Criteria è sopra la media per completezza (include quasi sempre uno scenario negativo/di rifiuto oltre all'happy path).

### 🔴 Critical Violations

Nessuna trovata. Non ci sono epic puramente tecnici senza alcun outcome osservabile, non ci sono dipendenze in avanti bloccanti, non ci sono story epic-sized non completabili.

### Best Practices Compliance Checklist (per epic)

| Epic | Valore utente | Indipendenza | Story sizing | No forward deps | DB solo quando serve | AC chiare | Tracciabilità FR |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | ⚠️ parziale | ✅ | ✅ | ✅ | ⚠️ (vedi Major #2) | ✅ | ✅ |
| 2 | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | ✅ |
| 3 | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | ✅ |
| 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK** (una sola area, non strutturale) — SPEC, Architecture ed Epics/Story sono di qualità alta e internamente coerenti (copertura FR 100%, nessuna dipendenza in avanti, nessuna violazione critica). L'unico gap reale è l'**assenza di un documento UX dedicato**, che è esattamente l'attività che l'utente ha dichiarato di voler iniziare in questa sessione.

### Critical Issues Requiring Immediate Action

Nessuna. Non ci sono FR scoperti, non ci sono epic tecnicamente rotti, non ci sono contraddizioni tra SPEC/Architecture/Epics.

### Issues Requiring Attention (non bloccanti)

1. **UX design non documentato** (Step 4) — implicito ma mancante: nessun user journey end-to-end, wireframe, o information architecture dell'editor. I requisiti UX-DR1-8 già presenti in epics.md coprono solo accessibilità/catalogo componenti, non i flussi.
2. **Epic 1 bundla story infrastrutturali senza valore utente diretto** (Step 5, Major #1) — pattern accettabile per un epic "Fondamenta" greenfield, ma da tenere come eccezione consapevole.
3. **Story 1.3 crea tutte le tabelle upfront**, incluse quelle usate solo da Epic 4/5 (Step 5, Major #2) — rischio basso dato che lo schema è già interamente noto da SPEC/Architecture, non in scoperta iterativa.
4. **Nessun requisito di performance/concorrenza esplicito** nello SPEC (Step 2) — coperto da NFR8 "Deferred — Perf" in epics.md, quindi è una scelta consapevole già tracciata, non un buco silenzioso.
5. **Target WCAG 2.1 AA marcato "da confermare"** in a11y-baseline.md stesso (open question ereditata, non chiusa formalmente).

### Recommended Next Steps

1. **Avvia `bmad-ux`** per produrre il documento UX (user journey, wireframe/flow della shell editor, stati vuoti/errore a livello schermata) — è il prossimo passo naturale e coincide con l'obiettivo di sessione dell'utente. Fallo **prima** di iniziare le story di Epic 3/4 (blocchi editor, drag-and-drop), che sono le più UX-sensitive.
2. Chiudi formalmente l'open question WCAG 2.1 AA in a11y-baseline.md (conferma o rivedi il target).
3. Procedi pure con l'implementazione di Epic 1 e Epic 2 nel frattempo — sono indipendenti dall'UX (fondamenta tecniche e design system generato da Penpot) e già pienamente pronti (nessun blocco rilevato).
4. Nessuna azione richiesta su Major #2 (timing tabelle DB) salvo se si vuole aderire strettamente allo standard epic-per-epic — è una scelta difendibile per questo progetto.

### Final Note

Questa assessment ha identificato **5 issue non bloccanti** across 3 categorie (PRD/UX completeness, epic quality, dettagli minori). Nessuna richiede azione prima di iniziare l'implementazione tecnica (Epic 1/2), ma il gap UX va colmato prima di Epic 3/4. Puoi procedere con `bmad-ux` ora, oppure iniziare Epic 1/2 in parallelo.

**Report generato:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-26.md`
**Assessor:** Claude Code (bmad-check-implementation-readiness), 2026-07-26
