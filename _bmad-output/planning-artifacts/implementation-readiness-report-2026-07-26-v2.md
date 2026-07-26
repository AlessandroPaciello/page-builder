---
stepsCompleted: ["step-01", "step-02", "step-03", "step-04", "step-05", "step-06"]
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
  ux:
    - "_bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/DESIGN.md"
    - "_bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/EXPERIENCE.md"
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-26
**Project:** page-builder

## Document Discovery

### PRD (sostituito da SPEC canonico)
- `_bmad-output/specs/spec-page-builder/SPEC.md` + companion (design-system.md, penpot-pipeline.md, rbac-matrix.md, a11y-baseline.md, glossary.md)
- Nota: questo progetto usa il workflow `bmad-spec` al posto del PRD tradizionale; SPEC.md è trattato come equivalente PRD per questa assessment (invariato rispetto alla run precedente).

### Architecture
- `_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md`
- Review pregresse disponibili in `.../reviews/` (review-adversarial.md, review-rubric.md, review-version-check.md)

### Epics & Stories
- `_bmad-output/planning-artifacts/epics.md` — 6 epic, 26 story, generato da SPEC + Architecture Spine (invariato)

### UX Design
- **Trovato** (novità rispetto alla run precedente del 26/07 mattina): `_bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/DESIGN.md` + `EXPERIENCE.md`
- Reviewer gate già passato (review-rubric.md, review-accessibility.md; 2 critical + 7 high risolti, 7 medium/low aperti in `.memlog.md`)
- 4 mockup chiave in `mockups/` (PageList, Editor canvas, dialog pubblicazione, storefront pubblico)

## Issues Found

- Nessun duplicato whole/sharded da risolvere per nessuna categoria di documento.
- Nessun documento mancante: PRD-equivalente, Architecture, Epics, UX tutti presenti (a differenza della run precedente, dove UX era assente).

## User Confirmation

Questa è una **ri-validazione** richiesta esplicitamente dall'utente il 2026-07-26, dopo che il gap UX segnalato nel report precedente (`implementation-readiness-report-2026-07-26.md`, run mattutina) è stato colmato con il completamento di `bmad-ux`. Si procede con i documenti sopra elencati, inclusi ora DESIGN.md/EXPERIENCE.md.

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

**Total FRs: 15** (numerate 1:1 sulle capability CAP-1…CAP-15 dello SPEC — invariato rispetto alla run precedente)

### Non-Functional Requirements

NFR1 (Accessibilità — a11y-baseline.md): Target **WCAG 2.1 AA** per ogni primitiva/composizione: focus visibile (contrasto ≥3:1), mai rimuovere outline senza sostituto equivalente; stato comunicato sempre con testo+colore (mai colore da solo); ARIA corretta per tipo componente (Dialog, Toast, Table, Tabs, Dropdown, Breadcrumb); regioni `aria-live` (polite/assertive) per feedback asincroni; overlay montati su portale root DOM condiviso sopra il canvas editor.

NFR2 (Sicurezza/Autorizzazione — rbac-matrix.md, Constraints SPEC): Deny-by-default, enforcement server-side su ogni via di modifica (copertura totale, nessun endpoint CRUD generico scoperto); confine content-vs-structure enforced lato server, non solo UI.

NFR3 (Integrità dati — Constraints SPEC): Invariante autoritativo "al più 1 PUBLISHED per pagina" garantito a livello autoritativo (non solo logica applicativa) — richiede probabilmente vincolo a livello di storage/transazione.

NFR4 (Fedeltà design — Constraints SPEC, penpot-pipeline.md): Aderenza stretta ai valori Penpot, mai inventare valori mancanti (solo default neutri); nomi token/componenti allineati 1:1 Penpot↔codice.

NFR5 (Manutenibilità pipeline generativa — Constraints SPEC): Artefatti generati marcati `@generated`, mai editati a mano; rigenerazione preserva file scritti a mano (skip salvo forzatura); gate di completezza artefatti (componente+test+story+barrel) verificato in CI.

NFR6 (Integrità del payload — Constraints SPEC): Payload di layout Puck `{content, root, zones}` accettato 1:1 senza riscrittura strutturale; ogni blocco con id stabile indipendente dalla posizione (abilita diff/audit a livello di blocco).

NFR7 (Auditabilità leggera — Constraints SPEC): Storico contenuti modellato tramite versioni di pagina esplicite; l'audit copre solo metadati immutabili, non duplica l'intero blob di contenuto.

NFR8 (Architettura/Layering — design-system.md, Constraints SPEC): Confine di layering rigido `tokens ← primitives ← {puck-components, ui}`; le primitive non importano mai da `ui` né conoscono il dominio page-builder; il frontend DEVE consumare il design system stesso, non uno stack UI parallelo (anti-pattern legacy da non ripetere).

**Total NFRs: 8** (invariato)

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

Lo SPEC resta insolitamente completo per un documento "PRD-equivalente": ogni capability ha intent+success esplicito, i constraint sono precisi e testabili (es. invariante ≤1 PUBLISHED, WCAG 2.1 AA, layering tokens←primitives), e i non-goals sono dichiarati esplicitamente evitando scope creep. Punti di attenzione (aggiornati rispetto alla run precedente):
- Il target WCAG 2.1 AA è **ancora** marcato "da confermare" in a11y-baseline.md — non chiuso nemmeno dal ciclo bmad-ux appena concluso (open question ereditata invariata).
- Nessun requisito di performance/scalabilità esplicito — invariato, resta un gap NFR dichiarato "Deferred" in epics.md (NFR8 epics), non un buco silenzioso.
- **UX ora presente** (DESIGN.md/EXPERIENCE.md, reviewer gate passato): il gap che nella run precedente era l'unico item bloccante-non-bloccante è colmato. Restano aperti 7 item medium/low tracciati nel memlog UX (non bloccanti per l'assessment di readiness).

## Epic Coverage Validation

epics.md è invariato rispetto alla run precedente e contiene già una propria "Requirements Inventory" (FR1-15, NFR1-8, Additional Requirements da AD-1…13, e "UX Design Requirements" UX-DR1-8 derivate da a11y-baseline.md/design-system.md) più una **FR Coverage Map** esplicita.

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

Unica osservazione non bloccante (invariata): FR12 e FR13 sono marcati come "fondamenta/definizione" in un epic e "enforcement" in un altro (pattern dichiarato esplicitamente, non un gap).

### Coverage Statistics

- Total PRD (SPEC) FRs: 15
- FRs covered in epics: 15
- Coverage percentage: **100%**

## UX Alignment Assessment

### UX Document Status

**Trovato.** `DESIGN.md` + `EXPERIENCE.md` (status: final, 2026-07-26), 4 mockup chiave, reviewer gate già passato (rubric + accessibilità, 2 critical/7 high risolti). Questo chiude il gap dell'unica run precedente.

### UX ↔ SPEC/PRD Alignment

- **Surface closure dichiarata esplicitamente:** EXPERIENCE.md § Information Architecture afferma che ogni CAP-1…15 ha una superficie che la eroga (o è pipeline build-time senza UI, per CAP-1/2) — verificato a campione: CAP-6 (drag-and-drop)→`/pages/[id]/editor`, CAP-8/9(publish/rollback)→TopBar+dialog+VersionList, CAP-11(render pubblico)→`/[slug]`, CAP-14(audit)→`/audit`, CAP-15(commerce)→blocchi ProductCard/Grid/AddToCart. Nessuna capability SPEC risulta priva di superficie.
- **RBAC (FR12/rbac-matrix.md) riflesso coerentemente:** editor denso vs editor semplificato Cliente sono due composizioni distinte (non stessa UI con campi disabilitati); `/audit` risponde 404 (non 403) a non-Admin, coerente col principio "deny-by-default, la UI comunica ma il server decide" già in SPEC/architecture.
- **a11y-baseline.md ereditato integralmente** in EXPERIENCE.md § Accessibility Floor, con un'estensione concreta non esplicita nello SPEC: il meccanismo tastiera+screen reader per drag-and-drop (WAI-ARIA APG grab-mode) — coerente col target WCAG 2.1 AA dichiarato, colma un gap che nello SPEC era solo principio generale ("percorso da tastiera") senza meccanismo specificato.
- **Nessun requisito UX non riconducibile allo SPEC** — gli [ASSUMPTION] marcati (griglia editor 3 colonne, meccanismo trigger autosave, filtro lifecycle in PageList, fallback prodotto rimosso, breakpoint responsive specifici) sono tutti estensioni plausibili di FR/NFR esistenti, non requisiti fuori scope.

### UX ↔ Architecture Alignment

- **Render pubblico SSG+ISR:** EXPERIENCE.md (Key Flow Luca) descrive invalidazione automatica post-publish — coerente con AD-9 dell'architettura (`CacheInvalidator` port, `revalidateTag` post-commit, domini cache draft/published disgiunti). Nessun conflitto.
- **Anteprima draft non cachata e protetta:** EXPERIENCE.md IA (`/pages/[id]/editor?version=draft`) coerente con AD-9 ("anteprima draft = render dinamico non cachato e protetto da auth").
- **Invariante ≤1 PUBLISHED:** i Key Flow di publish/archivia (Marco, Priya) descrivono retrocessione atomica coerente con AD-8 (indice univoco parziale Postgres + transazione singola).
- **RBAC via Principal/oRPC:** i flussi di errore-permesso (Giulia) — server rifiuta, messaggio accessibile — coerenti con la regola architetturale "ogni adapter inbound passa il Principal al core; nessun adapter decide da sé".
- **Nessun requisito UX privo di supporto architetturale rilevato.** L'architettura non specifica un budget di performance percepita per l'editor (in linea con NFR8/"Deferred — Perf" già tracciato in epics.md), quindi nessun nuovo gap introdotto dall'UX su questo fronte.

### Warnings

- Nessun warning bloccante: il gap "UX implicito ma mancante" della run precedente è chiuso.
- ⚠️ Non bloccante, ereditato: **WCAG 2.1 AA resta "da confermare"** anche dopo il ciclo UX — DESIGN.md/EXPERIENCE.md lo trattano "come requisito fermo salvo diversa indicazione" ma la open question formale in a11y-baseline.md non è mai stata chiusa esplicitamente. Consigliata una conferma formale prima di iniziare le story più a11y-sensitive (Epic 3/4).
- ⚠️ Non bloccante: **7 item medium/low** restano aperti nel memlog UX (LifecycleBadge senza riga propria in Component Patterns, disciplina placeholder incoerente tra categorie token, `/login` senza stato di fallimento, SaveStateIndicator troppo verboso su live region, selezione vs focus-visible blocchi Puck non specificata a livello visivo, sezione Inspiration&Anti-patterns omessa, target WCAG di cui sopra) — nessuno blocca l'inizio implementazione, ma vanno chiusi con un giro di Update di `bmad-ux` prima di Epic 3/4 se si vuole partire senza debito UX residuo.
- ⚠️ Non bloccante: i valori concreti dei token (`colors`, `typography`, `rounded`, `spacing`) restano placeholder in DESIGN.md in attesa dell'estrazione reale Penpot (CAP-1) — decisione esplicita dell'utente, non un gap di processo, ma Epic 3/4 (blocchi UI-facing) dipendono comunque dal completamento di Epic 2 (pipeline token) prima di avere valori reali da verificare per contrasto.

## Epic Quality Review

epics.md è invariato rispetto alla run precedente (nessuna modifica dal completamento dell'UX): la review di qualità è riconfermata identica.

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

**READY** — cambio di stato rispetto alla run precedente (`NEEDS WORK`). L'unico gap reale identificato in quella run era l'assenza del documento UX; è stato colmato con `bmad-ux` (DESIGN.md/EXPERIENCE.md, reviewer gate superato). SPEC, Architecture, Epics/Story e ora anche UX sono coerenti tra loro (copertura FR 100%, nessuna dipendenza in avanti, nessuna violazione critica di epic quality, nessun conflitto UX↔SPEC↔Architecture).

### Critical Issues Requiring Immediate Action

Nessuna. Non ci sono FR scoperti, non ci sono epic tecnicamente rotti, non ci sono contraddizioni tra SPEC/Architecture/Epics/UX.

### Issues Requiring Attention (non bloccanti)

1. **Target WCAG 2.1 AA ancora "da confermare"** in a11y-baseline.md — non chiuso nemmeno dal ciclo UX, che lo tratta come "requisito fermo salvo diversa indicazione". Consigliata una conferma formale (basta una decisione esplicita, non un nuovo documento) prima di Epic 3/4.
2. **7 item medium/low aperti nel memlog UX** (LifecycleBadge senza riga in Component Patterns, disciplina placeholder token incoerente, `/login` senza stato di fallimento, SaveStateIndicator verboso, selezione vs focus-visible blocchi Puck non specificata, sezione Inspiration&Anti-patterns omessa, WCAG di cui sopra) — da chiudere con un giro di Update di `bmad-ux`, non bloccante per iniziare Epic 1/2.
3. **Epic 1 bundla story infrastrutturali senza valore utente diretto** (Major #1, invariato) — pattern accettabile per un epic "Fondamenta" greenfield, da tenere come eccezione consapevole.
4. **Story 1.3 crea tutte le tabelle upfront** (Major #2, invariato) — rischio basso dato lo schema già interamente noto da SPEC/Architecture.
5. **Token Penpot ancora placeholder** in DESIGN.md — decisione esplicita dell'utente, si risolve naturalmente con Epic 2 (pipeline token).

### Recommended Next Steps

1. **Procedi con `bmad-sprint-planning`** — non ci sono più blocchi: SPEC/Architecture/Epics/UX sono allineati. È il prossimo step richiesto per entrare in fase 4-implementation.
2. Chiudi formalmente l'open question WCAG 2.1 AA in a11y-baseline.md prima di iniziare le story di Epic 3/4 (drag-and-drop, blocchi editor — le più a11y-sensitive).
3. Facoltativo: un giro di Update `bmad-ux` per chiudere i 7 item medium/low, se si vuole azzerare il debito UX prima di Epic 3/4 — non blocca l'avvio di Epic 1/2 né la sprint planning.
4. Nessuna azione richiesta sui Major di epic quality (bundling Epic 1, timing tabelle) salvo se si vuole aderire strettamente allo standard — scelte difendibili per questo progetto.

### Final Note

Questa ri-validazione ha confermato la chiusura dell'unico gap bloccante-non-bloccante della run precedente (UX mancante) e ha riconfermato l'assenza di violazioni critiche su SPEC/Architecture/Epics. Restano **5 issue non bloccanti** (in gran parte ereditate, nessuna nuova introdotta dall'UX). Il progetto può procedere a `bmad-sprint-planning` per avviare la fase di implementazione.

**Report generato:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-26-v2.md`
