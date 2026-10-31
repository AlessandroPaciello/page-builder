---
type: epic
title: Render Pubblico e Vetrina Commerce
parent: initiative-page-builder
covers: [R11, R15]
sources: [_bmad-output/initiative-page-builder/archive-v6/epics.md]
companions: [_bmad-output/initiative-page-builder/spec-page-builder/design-system.md, _bmad-output/initiative-page-builder/spec-page-builder/glossary.md, _bmad-output/initiative-page-builder/archive-v6/spec-confini-core-crypto-e-gate-import.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/DESIGN.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/EXPERIENCE.md]
risk: low
---

# Epic: Render Pubblico e Vetrina Commerce

## Description
Il sito pubblico è un'applicazione di sola lettura che consuma le pagine pubblicate e i dati del negozio, senza alcuna dipendenza dal Tool in runtime. La sezione commerce ha un layout standard: griglia prodotti a 3 colonne, card prodotto, carrello e checkout. I layout delle card prodotto non sono modificabili dall'utente e derivano esclusivamente dalle proprietà Penpot dei componenti strutturali.

## Outcome
- Il sito pubblicato è performante e indipendente dall'infrastruttura di editing.
- La vetrina commerce mantiene l'identità del design system senza customizzazione libera delle card.
- Nessuna dipendenza runtime dal Tool.

## Requirements

### R11 (parent R11): Render indipendente del sito pubblicato
Il sito pubblicato deve essere un'applicazione di sola lettura che renderizza le pagine pubblicate senza dipendere dall'infrastruttura del Tool in runtime.

#### Scenario: Rendering pubblico
- **WHEN** il sito pubblicato viene servito
- **THEN** renderizza le pagine pubblicate senza dipendere dal Tool o dal runtime di editing

#### Scenario: Nessuna dipendenza runtime
- **WHEN** il sito pubblicato viene analizzato in produzione
- **THEN** non richiede connessioni, moduli o servizi del Tool

### R15 (parent R15): Vetrina commerce standardizzata
Il Tool deve poter esporre un layout commerce standard con griglia prodotti a 3 colonne, card prodotto, carrello e checkout, mantenendo il layout delle card derivante esclusivamente dalle proprietà Penpot dei componenti strutturali.

#### Scenario: Pagina prodotti renderizzata
- **WHEN** il sito pubblico renderizza la sezione commerce
- **THEN** mostra la griglia a 3 colonne, la card prodotto, il carrello e il checkout secondo il layout standard

#### Scenario: Card non modificabile
- **WHEN** l'utente tenta di personalizzare il layout della card prodotto
- **THEN** il layout resta derivante esclusivamente dalle proprietà Penpot dei componenti strutturali, senza personalizzazione libera

## Constraints
- Il sito pubblicato non deve includere dipendenze runtime dal Tool.
- La griglia prodotti ha larghezza fissa a 3 colonne.
- Il layout delle card prodotto non è modificabile dall'utente: deriva dalle proprietà Penpot dei componenti strutturali.
- Carrello e checkout seguono lo standard commerce senza personalizzazione del layout.
- Il rendering deve rispettare il design system sincronizzato da Penpot.

## Done when
- Il sito pubblicato renderizza le pagine senza dipendere dal Tool.
- La sezione commerce mostra griglia a 3 colonne, card, carrello e checkout secondo lo standard.
- Il layout delle card resta non modificabile e derivante da Penpot.

## Boundaries
- **IN**: rendering delle pagine pubblicate, layout commerce standard, dati del negozio in sola lettura.
- **OUT**: editor e bozze (Epic 4), pipeline di deploy (Epic 5), sincronizzazione componenti (Epic 2).

## References
- FR11, FR15 in `SPEC.md`
- Fonte dei requisiti: `_bmad-output/initiative-page-builder/archive-v6/epics.md`
- `spec-page-builder/design-system.md`, `archive-v6/spec-confini-core-crypto-e-gate-import.md`

## Notes
- I build record storici di questo epic non erano presenti nel workspace v6: lo stato di avanzamento va tracciato in sprint planning, senza record da migrare.
