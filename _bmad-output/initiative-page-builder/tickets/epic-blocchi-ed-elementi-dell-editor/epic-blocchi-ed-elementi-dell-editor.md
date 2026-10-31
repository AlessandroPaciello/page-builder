---
type: epic
title: Blocchi ed Elementi dell'Editor
parent: initiative-page-builder
covers: [R4, R5, R13]
sources: [_bmad-output/initiative-page-builder/archive-v6/epics.md]
companions: [_bmad-output/initiative-page-builder/spec-page-builder/design-system.md, _bmad-output/initiative-page-builder/spec-page-builder/glossary.md, _bmad-output/initiative-page-builder/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/DESIGN.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/EXPERIENCE.md]
risk: low
---

# Epic: Blocchi ed Elementi dell'Editor

## Description
Il catalogo editoriale è una mappa di blocchi dichiarativi e serializzabili derivati dai componenti Penpot sincronizzati. Ogni blocco è un wrapper React con layout auto e proprietà Penpot esposte come controlli tipizzati. Il Tool offre `block/sync-components` per estrarre un nuovo blocco da un componente Penpot senza toccare i componenti generati.

## Outcome
- Ogni blocco si comporta in modo identico al suo componente Penpot in termini di layout e proprietà esposte.
- Un designer può aggiungere un blocco senza intervento manuale dello sviluppatore.
- Le modifiche ai componenti base sono assorbite automaticamente senza toccare i blocchi.

## Requirements

### R4 (parent R4): Creazione di un blocco da componente Penpot
Il Tool deve poter creare un nuovo blocco editoriale mappando direttamente un componente Penpot esistente in un wrapper React con layout auto e proprietà esposte come controlli tipizzati.

#### Scenario: Creazione del blocco
- **WHEN** lo sviluppatore invoca `block/sync-components` con un componente Penpot
- **THEN** il Tool genera un wrapper React con layout auto e controlli tipizzati per le proprietà del componente

### R5 (parent R5): Catalogo editoriale dei blocchi
Il Tool deve poter leggere una libreria di blocchi registrata in un catalogo locale, mappando ogni blocco al relativo componente Penpot e alle sue proprietà, in modo che editor e renderer possano utilizzarli in modo uniforme.

#### Scenario: Ricerca del blocco nell'editor
- **WHEN** l'utente apre il catalogo dei blocchi
- **THEN** elenca i blocchi disponibili con nome, anteprima e mappatura al componente Penpot

### R13 (parent R13): Interazione editor-Tool
L'editor deve chiamare il Tool solo tramite un'API di collaborazione chiaramente definita e tipizzata, non condividendo codice applicativo o componenti UI interni.

#### Scenario: Chiamata sincronizzazione
- **WHEN** l'editor richiede una sincronizzazione o un'azione del Tool
- **THEN** la richiesta passa esclusivamente attraverso l'API di collaborazione definita, senza importare componenti UI o moduli applicativi interni del Tool

## Constraints
- L'infrastruttura non deve toccare i componenti generati dalla sincronizzazione Penpot: i blocchi sono wrapper sopra i componenti sincronizzati.
- Ogni blocco deve mappare 1:1 a un componente Penpot registrato nel catalogo.
- Le proprietà Penpot esposte nel blocco devono essere quelle del componente Penpot, senza logica applicativa aggiuntiva.
- Il catalogo dei blocchi è l'unica sorgente della lista blocchi per editor e renderer.

## Done when
- `block/sync-components` genera un nuovo blocco da un componente Penpot.
- Il catalogo registra blocchi, componenti Penpot e proprietà in modo uniforme.
- Le modifiche ai componenti base vengono assorbite senza intervento manuale sui blocchi.
- L'editor interagisce col Tool solo via API tipizzata.

## Boundaries
- **IN**: mappatura componenti Penpot → wrapper blocco, catalogo locale dei blocchi, API di collaborazione editor–Tool.
- **OUT**: sincronizzazione del design system e dei token (Epic 2), comportamento dell'editor e gestione delle bozze (Epic 4).

## References
- FR4, FR5, FR13 in `SPEC.md`
- Fonte dei requisiti: `_bmad-output/initiative-page-builder/archive-v6/epics.md`
- `spec-page-builder/design-system.md`, `spec-page-builder/glossary.md`

## Notes
- I build record storici di questo epic non erano presenti nel workspace v6: lo stato di avanzamento va tracciato in sprint planning, senza record da migrare.
