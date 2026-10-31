---
type: initiative
title: "page-builder"
sources: [_bmad-output/initiative-page-builder/spec-page-builder/SPEC.md]
companions: [_bmad-output/initiative-page-builder/spec-page-builder/design-system.md, _bmad-output/initiative-page-builder/spec-page-builder/penpot-pipeline.md, _bmad-output/initiative-page-builder/spec-page-builder/rbac-matrix.md, _bmad-output/initiative-page-builder/spec-page-builder/a11y-baseline.md, _bmad-output/initiative-page-builder/spec-page-builder/glossary.md, _bmad-output/initiative-page-builder/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/DESIGN.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/EXPERIENCE.md]
status: in-progress
risk: low
---

# page-builder

## Description

Una riscrittura greenfield full-TypeScript del page-builder: dal catalogo Penpot i design token e i componenti fluiscono, per rigenerazione, in primitive accessibili e blocchi dell'editor; un Editor compone pagine in drag-and-drop, salva bozze e pubblica con ruoli enforced e audit; un visitatore vede la pagina pubblicata via slug, inclusi i dati commerce risolti a render-time. Il **WHAT** è fissato dallo SPEC-kernel (`spec-page-builder/SPEC.md`, in sostituzione del PRD) e dalle sue companion; il **come** è fissato dall'Architecture Spine (AD-1…13) e dallo stack pinnato Better-T-Stack. L'implementazione legacy (JHipster/Strapi/Keycloak) è solo riferimento ed è esplicitamente scartata.

## Outcome

Un workspace riscritto in cui il flusso Penpot → token → blocco → pagina pubblicata → render by-slug è dimostrabile end-to-end, con RBAC e audit verificati da test e sull'UI del design system stesso, indipendente dallo stack backend che lo alimenta.

## Requirements

1. **R1 (FR1):** Il sistema porta in Penpot un tema nato da un seme CSS Tailwind, poi estrae i design token da Penpot e genera lo strato token (colori/tipografia/spacing/radii/ombre), le varianti di tema e i font consumati dalla UI, data-driven dal catalogo Penpot.
2. **R2 (FR2):** Il sistema genera dai componenti Penpot gli stili e le story di primitive React accessibili (contratto dell'editor + Penpot letto dal vivo → `styles.ts` e story generati sul registro delle proprietà; componente dello sviluppatore creato una volta dallo scaffold), preservando i file scritti a mano.
3. **R3 (FR3):** Il sistema offre una libreria di primitive UI headless/accessibili organizzate per dominio (data-display, inputs, feedback, layout, navigation, overlays).
4. **R4 (FR4):** Il sistema espone le primitive come blocchi del page-builder con campi validati da schema e controlli guidati dai token, aggregati in un'unica config con slot annidabili.
5. **R5 (FR5):** Il sistema fornisce composizioni di prodotto per l'editor (LifecycleBadge, SaveStateIndicator, TopBar, PageList, VersionList, EmptyState) costruite solo su primitive+token.
6. **R6 (FR6):** Un utente autorizzato costruisce/modifica una pagina in drag-and-drop con l'editor a blocchi; il layout è persistito come payload strutturato (forma Puck {content,root,zones}, schemaVersion, block-id stabili) con round-trip lossless.
7. **R7 (FR7):** Il sistema salva il layout corrente come nuova versione DRAFT (autosave), comunicando lo stato salvato/non-salvato all'utente.
8. **R8 (FR8):** Il sistema mantiene una cronologia versioni per pagina e promuove una versione a PUBLISHED, retrocedendo atomicamente la precedente (≤1 PUBLISHED per pagina).
9. **R9 (FR9):** Il sistema ripristina una pagina a una versione precedente (rollback), promuovendola a PUBLISHED e retrocedendo l'attuale.
10. **R10 (FR10):** Il sistema gestisce il lifecycle DRAFT/PUBLISHED/ARCHIVED con archiviazione che preserva le versioni e restore che riporta a DRAFT.
11. **R11 (FR11):** Il sistema rende una pagina pubblica tramite slug (versione pubblicata di default, bozza su richiesta); la pagina pubblicata è anche il render della vetrina e-commerce con dati commerce risolti a render-time.
12. **R12 (FR12):** Il sistema governa le operazioni tramite i ruoli Admin/Editor/Cliente, deny-by-default, con enforcement server-side su ogni via di lettura/scrittura del dominio.
13. **R13 (FR13):** Il sistema mantiene una single source of truth che classifica i campi di ogni blocco come structure o content, pilotando permessi editor e sanitizzazione server-side.
14. **R14 (FR14):** Il sistema conserva uno storico immutabile (audit trail) di chi ha cambiato cosa e quando su pagine/versioni, consultabile dall'Admin.
15. **R15 (FR15):** Un autore compone pagine con blocchi data-driven commerce (ProductCard/ProductGrid/AddToCart) che agganciano dati da una sorgente commerce esterna intercambiabile, senza vincolare i blocchi alla sorgente.

## Constraints

- Penpot è la single source of truth dei valori e dell'aspetto; il contratto dei componenti è del page builder. Token, tema e stili sono generati, il componente React è dello sviluppatore (SPEC — Constraints).
- Gli artefatti generati portano il marker `@generated`, non si editano a mano e la rigenerazione preserva i file scritti a mano (SPEC — Constraints).
- Il payload di layout è la forma Puck `{content, root, zones}` accettata 1:1, con id di blocco stabili; lo storico è a versioni esplicite e l'audit copre solo metadati (SPEC — Constraints).
- Autorizzazione deny-by-default enforced lato server con copertura totale, senza via di modifica fuori dal core di dominio (SPEC — Constraints; AD-1/AD-2, AD-4).
- Invariante autoritativo al più una versione PUBLISHED per pagina, garantito a livello DB (SPEC — Constraints; AD-7).
- A11y baseline WCAG 2.1 AA per ogni primitiva e composizione (SPEC — Constraints; a11y-baseline.md).
- Il frontend consuma esclusivamente il design system, con confine di layering: contratti ← {generati, blocchi, render, core}; tokens ← generati ← {blocchi, composizioni editor} (SPEC — Constraints; AD-3/AD-6).
- Commerce pluggable: blocchi e render parlano solo al port CommerceProvider, la sorgente si cambia con un adapter (SPEC — Constraints; AD-10, NFR7).

## Done when

- Il seme `theme.css` diventa tema Penpot e ne esce `theme.css`, le varianti e `fonts.css` `@generated`, con i valori del tema nel CSS compilato.
- Un Editor compone una pagina da blocchi, la salva come bozza con round-trip lossless e la pubblica lasciando una sola versione pubblicata, con rollback e archiviazione che reggono l'invariante.
- RBAC e audit sono enforced server-side su ogni via e verificati da test: un fuori-ruolo è rifiutato, l'audit è consultabile solo dall'Admin.
- Un visitatore vede la pagina pubblicata by-slug, con invalidazione post-publish e anteprima draft protetta, e con dati commerce reali risolti a render-time cambiando solo l'adapter.
- L'intero percorso Penpot → token → blocco → pagina pubblicata → render by-slug è dimostrabile end-to-end su un ambiente containerizzato.

## Boundaries

- Fuori scope: le scelte di stack sono dell'architecture (lo SPEC è stack-agnostico); il page-builder legacy su Strapi e il suo content model; la migrazione dati dallo store legacy; la UI di gestione fine-grained dell'assegnazione Cliente↔pagina; la scelta della sorgente commerce concreta e la sua logica (catalogo, pricing, carrello, checkout), che vive nella sorgente esterna.
- Touch point: `packages/tokens`, `packages/ui`, `packages/scripts`, `packages/puck-components` — design system e pipeline Penpot→codice; owner: epic-design-system-token-e-componenti-da-penpot.
- Touch point: `packages/contracts` — assi, field, slot e classifier structure/content; owner: epic-design-system-token-e-componenti-da-penpot (definizione) e epic-blocchi-ed-elementi-dell-editor (estensione).
- Touch point: `packages/domain`, `packages/db`, `packages/auth`, `packages/api` — core esagonale, modello dati, ruoli e enforcement; owner: epic-fondamenta-e-accesso.
- Must not change: nessuna via di modifica del dominio fuori dal core (no CRUD auto-generato); nessuna seconda libreria UI parallela al design system.
- Tracer path: epic-fondamenta-e-accesso → epic-design-system-token-e-componenti-da-penpot → epic-blocchi-ed-elementi-dell-editor → epic-editor-e-bozze → epic-ciclo-di-vita-e-pubblicazione → epic-render-pubblico-e-vetrina-commerce.

## References

- prd — `_bmad-output/initiative-page-builder/spec-page-builder/SPEC.md` (spec-kernel, in sostituzione del PRD: capabilities CAP-1…15, constraints, non-goals, success signal)
- companion — `_bmad-output/initiative-page-builder/spec-page-builder/design-system.md` (catalogo delle primitive per dominio)
- companion — `_bmad-output/initiative-page-builder/spec-page-builder/penpot-pipeline.md` (regime della pipeline Penpot→codice)
- companion — `_bmad-output/initiative-page-builder/spec-page-builder/rbac-matrix.md` (matrice dei ruoli Admin/Editor/Cliente)
- companion — `_bmad-output/initiative-page-builder/spec-page-builder/a11y-baseline.md` (baseline di accessibilità WCAG 2.1 AA)
- companion — `_bmad-output/initiative-page-builder/spec-page-builder/glossary.md` (glossario di dominio)
- architecture — `_bmad-output/initiative-page-builder/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md` (**autorevole**: `status: final`, `updated: 2026-10-17`, AD-1…13 con AD-11 v3 che supera esplicitamente la spine 2026-10-03, stack pinnato)
- architecture (storico, non autoritativo) — `_bmad-output/initiative-page-builder/architecture-page-builder-2026-10-03/ARCHITECTURE-SPINE.md` (spine del sotto-sistema estrazione-costruzione, `status: superseded`; il suo gate H2 con riferimento `card-reference` è ora in `spec-page-builder/penpot-pipeline.md`. Attenzione: la numerazione AD di questa spine non coincide con quella della 2026-07-25 — AD-7 qui è il giudizio umano a H2, AD-7 là è l'invariante di pubblicazione; AD-9 qui impone i livelli L0→L3 che AD-11 v3 della 2026-07-25 abolisce)
- design — `_bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/DESIGN.md`
- design — `_bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/EXPERIENCE.md`
- tracking v6 (archiviato) — `_bmad-output/initiative-page-builder/archive-v6/epics.md`, `_bmad-output/initiative-page-builder/archive-v6/sprint-status.yaml`
- migration — `_bmad-output/migration-v6-v7/migration-v6-v7.md` (piano di migrazione v6→v7 approvato)

## Notes

- Decision: 2026-10-29 — il tracking è migrato da v6 (epics.md + sprint-status.yaml + build record in implementation-artifacts) a v7 (questo ticket tree); le fonti v6 sono archiviate in `_bmad-output/initiative-page-builder/archive-v6/`.
- Decision: 2026-10-31 — spine autorevole unica = `architecture-page-builder-2026-07-25/` (`status: final`, AD-11 v3). La spine `2026-10-03` è `status: superseded` nel suo stesso frontmatter ed è stata rimossa dai `companions:` di questa iniziativa e dei tre epic che la citavano (che non avevano la 07-25 affatto); il suo gate H2 con riferimento `card-reference` — unica copia esistente, assente sia nella 07-25 sia nel suo `superseded_by` — è stato trasferito in `spec-page-builder/penpot-pipeline.md` prima della demozione.
- Action item: Aggiungere test automatici rosso/verde per gli script check-boundaries.mjs (packages/ui, packages/domain, packages/api), oggi verificati solo con canary manuali. Per packages/scripts si chiude nella Story 2.19 (correct-course 2026-10-17) — owner: Charlie (Dev), epic: 1, status: open.
