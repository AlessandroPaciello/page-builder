---
type: epic
title: Editor e Bozze
parent: initiative-page-builder
covers: [R6, R7]
sources: [_bmad-output/initiative-page-builder/archive-v6/epics.md]
companions: [_bmad-output/initiative-page-builder/spec-page-builder/design-system.md, _bmad-output/initiative-page-builder/spec-page-builder/a11y-baseline.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/DESIGN.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/EXPERIENCE.md]
risk: low
---

# Epic: Editor e Bozze

## Description
Editor di pagine che compone blocchi in strutture serializzabili allineate al Design File Penpot. L'interazione con i blocchi segue il modello di interazione di Penpot: manipolazione diretta, proprietà nel pannello destro, shortcut da tastiera e snap. Le bozze vengono salvate automaticamente con debounce e possono essere duplicate, rinominate, eliminate e riportate in stato bozza dopo la pubblicazione.

## Outcome
- L'utente costruisce una pagina trascinando blocchi, modificando proprietà e vedendo aggiornamenti immediati.
- Le strutture delle pagine sono serializzate, deterministiche e recuperabili.
- Le bozze sono gestite senza rischio di perdita di lavoro.

## Requirements

### R6 (parent R6): Composizione pagine con blocchi
Il Tool deve poter comporre una pagina trascinando blocchi da un catalogo, modificandone le proprietà attraverso un pannello dedicato e ottenendo aggiornamenti immediati in anteprima; l'interazione deve seguire il modello di Penpot con manipolazione diretta, proprietà nel pannello destro, selezione multipla, shortcut da tastiera, snap e allineamento.

#### Scenario: Composizione pagina
- **WHEN** l'utente compone una pagina trascinando blocchi e modificando proprietà
- **THEN** l'anteprima si aggiorna immediatamente e le interazioni seguono il modello di interazione di Penpot

#### Scenario: Struttura serializzata
- **WHEN** l'utente modifica la struttura della pagina
- **THEN** la modifica viene serializzata in una struttura recuperabile e deterministica

### R7 (parent R7): Persistenza automatica delle bozze
Il Tool deve poter salvare automaticamente le bozze senza richiedere un'azione esplicita dell'utente, con persistenza di ogni modifica e possibilità di recuperare una bozza.

#### Scenario: Modifica salvata
- **WHEN** l'utente modifica una pagina
- **THEN** la modifica viene salvata automaticamente come bozza senza un'azione esplicita di salvataggio

#### Scenario: Recupero bozza
- **WHEN** l'utente riapre una bozza
- **THEN** la struttura persistita viene recuperata e mostrata nello stato precedente

## Constraints
- L'editing deve usare i componenti sincronizzati e i wrapper dei blocchi, senza duplicare markup o stili.
- La struttura persistita deve essere deterministica e ordinata.
- Il modello di interazione deve essere coerente con il Design File Penpot (manipolazione diretta, pannello destro, shortcut, snap).
- Il salvataggio delle bozze deve essere automatico e non richiedere azione esplicita dell'utente.

## Done when
- L'utente compone una pagina trascinando blocchi e modificando proprietà con anteprima immediata.
- La struttura della pagina viene serializzata e recuperata in modo deterministico.
- Le modifiche vengono salvate automaticamente come bozza.
- Le bozze possono essere duplicate, rinominate, eliminate e riportate in stato bozza dopo la pubblicazione.

## Boundaries
- **IN**: composizione della pagina nel Tool, pannello proprietà, persistenza delle bozze, gestione del ciclo di vita delle bozze.
- **OUT**: catalogo e API dei blocchi (Epic 3), pipeline di pubblicazione e deploy (Epic 5), rendering pubblico (Epic 6).

## References
- FR6, FR7 in `SPEC.md`
- Fonte dei requisiti: `_bmad-output/initiative-page-builder/archive-v6/epics.md`
- `spec-page-builder/SPEC.md`, `spec-page-builder/design-system.md`, `spec-page-builder/a11y-baseline.md`

## Notes
- I build record storici di questo epic non erano presenti nel workspace v6: lo stato di avanzamento va tracciato in sprint planning, senza record da migrare.
