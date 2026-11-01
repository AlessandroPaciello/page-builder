---
type: epic
title: Design System: Token e Componenti da Penpot
parent: initiative-page-builder
covers: [R1, R2, R3]
sources: [_bmad-output/initiative-page-builder/archive-v6/epics.md]
companions: [_bmad-output/initiative-page-builder/spec-page-builder/design-system.md, _bmad-output/initiative-page-builder/spec-page-builder/penpot-pipeline.md, _bmad-output/initiative-page-builder/archive-v6/spec-penpot-mcp-token.md, _bmad-output/initiative-page-builder/archive-v6/spec-refactor-core-analyze-component.md, _bmad-output/initiative-page-builder/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/DESIGN.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/EXPERIENCE.md]
status: in-progress
risk: low
tracker_id: "76"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/76"
---

# Epic: Design System: Token e Componenti da Penpot

## Description
Accoppiamento biunivoco con Penpot come fonte di verità per il design system: il design token estratto da Penpot diventa l'unico canale tra design e sviluppo. I componenti React shadcn/ui generati dall'infrastruttura mappano 1:1 ai componenti Penpot (`file/sync-components`), con proprietà, varianti, layout auto, slot, breakpoint e asset exportati dal Design File Penpot. L'identità visiva del sito gestito deriva interamente dal file Penpot, senza styling hardcoded.

## Outcome
- I token (colori, spaziature, tipografia, raggi) sono importati/esportati con il Design File Penpot come fonte di verità, non un file locale statico.
- I componenti React copiano struttura, naming, proprietà e breakpoint dei componenti Penpot.
- I file generati da `file/sync-components` sono sorgenti veritiere: le modifiche fatte solo in React vengono perse.
- Le immagini passano dall'Export Penpot senza compressione o conversioni.

## Requirements

### R1 (parent R12): Sincronizzazione componenti da Penpot
Il tool deve poter sincronizzare la libreria di componenti React shadcn/ui da un Design File Penpot, copiando struttura, naming e proprietà dei componenti Penpot, generando componenti React che mappano 1:1 e preservando la mappatura proprietà/varianti, il layout auto, gli slot e i breakpoint.

#### Scenario: File sorgente importato
- **WHEN** il Tool riceve un Design File Penpot come sorgente di componenti
- **THEN** legge la libreria di componenti, mappa ogni componente Penpot al suo componente React equivalente e produce file generati allineati al design

#### Scenario: Modifica React scartata
- **WHEN** un componente generato viene modificato direttamente in React senza aggiornare Penpot
- **THEN** la modifica viene persa al prossimo sync perché il file generato da `file/sync-components` è sorgente di verità

### R2 (parent R2): Sincronizzazione token da Penpot
Il design token deve essere estratto dal Design File Penpot, e l'importazione ed esportazione dei token deve tenere Penpot come fonte di verità, non un file locale statico; il Tool deve mappare token e componenti tra Penpot e Tailwind per mantenere sincronizzati design e codice.

#### Scenario: Token aggiornato in Penpot
- **WHEN** un token viene modificato nel Design File Penpot
- **THEN** il Tool lo estrae e lo propaga a Tailwind e ai componenti generati, mantenendo design e codice sincronizzati

#### Scenario: Tentativo di modifica locale
- **WHEN** il design token locale viene modificato senza aggiornamento in Penpot
- **THEN** l'esportazione/riimportazione con Penpot come fonte di verità riporta il valore originale

### R3 (parent R3): Importazione asset da Penpot
Le immagini statiche (icone e grafiche) usate nel sito devono essere importate dal Design File Penpot senza compressione, conversioni o alterazioni che degradino la qualità visiva.

#### Scenario: Icona esportata
- **WHEN** il Tool esporta un'immagine statica dal Design File Penpot
- **THEN** l'asset viene importato senza compressione o conversione e resta visivamente identico al design

## Constraints
- Non inserire componenti React custom nel progetto: la libreria di UI deve essere generata dall'infrastruttura, mantenendo le modifiche nel Design File Penpot come sorgente di verità.
- L'interfaccia React deve essere costruita esclusivamente con componenti generati mappati 1:1 ai componenti Penpot.
- Il design token non deve essere hardcoded o duplicato: Penpot resta la fonte di verità.
- Le immagini statiche devono essere importate senza compressione, conversioni o alterazioni che ne degradino la qualità.
- La sincronizzazione dei componenti deve preservare proprietà, varianti, layout auto, slot, breakpoint e asset senza perdita di informazioni.

## Done when
- `file/sync-components` importa la libreria Penpot e genera componenti React mappati 1:1.
- Il token è estratto dal Design File Penpot e propagato a Tailwind.
- Le modifiche React senza sync Penpot risultano perse al prossimo import.
- Gli asset importati sono privi di compressioni o conversioni.

## Boundaries
- **IN**: importazione di token e componenti dal Design File Penpot, generazione dei componenti React e degli asset, mappatura proprietà/varianti/breakpoint.
- **OUT**: implementazione dell'editor (Epic 4), logica delle bozze, gestione degli ordini (Epic 5), layout vetrina dinamica basato sui dati del negozio (Epic 6).

## References
- FR1, FR2, FR3 in `SPEC.md`
- Fonte dei requisiti: `_bmad-output/initiative-page-builder/archive-v6/epics.md`
- `spec-page-builder/design-system.md`, `spec-page-builder/penpot-pipeline.md`, `archive-v6/spec-penpot-mcp-token.md`

## Notes
- I build record storici (story 2.1–2.8) e lo stato v6 sono preservati in `archive-v6/` di questa iniziativa; 2.7 e 2.8 sono state ricomposte nei loro plan unificati (`story-pipeline-pronta-piu-componenti-plan.md`, `story-registro-delle-proprieta-plan.md`) con la sezione `## Prior builds`.
- Decision (2026-11-01): la correzione del raggruppamento in varianti resta nella Story 2.28 — la sua Verify non era ancora stata eseguita e il test live DC→CD sulla Multiselect l'ha fatta fallire. La skill descrive la sequenza verificata e i nomi completi con `state=default`, e non offre più il ripiego «componenti separati».
- Decision (2026-11-01): l'operazione `pds` che raggruppa le celle in una chiamata è aperta come Story 2.33, dopo la 2.28. Estende il confine della 2.24: il server `pds` acquisisce una scrittura su Penpot, con la conferma nella skill; gli altri strumenti restano di sola lettura.
- Decision (2026-11-01): il lettore non aggrega componenti separati con prefisso comune: il ripiego sparisce con la 2.28 e il prefisso nasconderebbe i set parziali che la regola dei nomi impedisce. Un componente senza assi non richiede un container di varianti: si legge come una cella sola.
- Decision (2026-11-01): il tracer bullet dell'epica resta la Story 2.1 (pipeline token Penpot→codice). La 2.33 viene subito dopo la 2.28 perché ne usa la sequenza e si prova sui set già disegnati; la 2.31 e la 2.32 la usano per non dipendere dalla sequenza manuale.
- Decision (2026-11-01): la Refactor sweep di chiusura è aperta come Story 2.34, dopo ogni altra entry aperta; il suo scope si fissa all'inizio del lavoro dai plan e dai deferred di review dell'epica, e resta solo pulizia.
- Decision (2026-11-01): la ricerca della Multiselect è una scelta dell'editor, ma il disegno non la mostra (tutte le celle della composizione usano il pannello con `search=false`). Entra come Story 2.35, dopo la 2.33: prima le celle — `search` sulle celle esistenti e le due celle aperte `md`/`sm` con la ricerca — e poi l'asse `search` sul contratto. Senza celle non si aggiunge l'asse: Penpot resta la fonte di verità.
- Decision (2026-11-01): la 2.28 resta aperta dopo il test DC→CD sulla Multiselect per quattro correzioni di testo alla skill (composizioni con istanze, criterio degli assi, nomi riservati in DC, approvazione non aggirabile) e per il test di regressione del registry; P1 è chiuso in `bed456b`, P6 resta a `pds-code`, e la decisione di prodotto è già registrata (un blocco solo, 2.35 per la ricerca). Nessuna entry nuova: il plan lo aggiorna la build.
