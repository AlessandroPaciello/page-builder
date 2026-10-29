---
type: epic
title: Ciclo di Vita e Pubblicazione
parent: initiative-page-builder
covers: [R8, R9, R10, R14]
sources: [_bmad-output/initiative-page-builder/archive-v6/epics.md]
companions: [_bmad-output/initiative-page-builder/archive-v6/spec-confini-core-crypto-e-gate-import.md, _bmad-output/initiative-page-builder/spec-page-builder/rbac-matrix.md, _bmad-output/initiative-page-builder/architecture-page-builder-2026-10-03/ARCHITECTURE-SPINE.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/DESIGN.md, _bmad-output/initiative-page-builder/ux-page-builder-2026-07-26/EXPERIENCE.md]
risk: low
---

# Epic: Ciclo di Vita e Pubblicazione

## Description
Pipeline deterministica e verificabile dal design source fino al deploy: validazione strutturale, compilazione Tailwind con rilevamento dei token mancanti, export asset, firma dei manifest e deploy statico con verifica post-deploy e diff report. Il Tool include un comando `verify` che valida l'intero sito generato senza eseguire il deploy, ed esporta report di verifica leggibili da umano e da agente.

## Outcome
- Il deploy è ripetibile, verificabile e senza sorprese.
- Ogni artefatto pubblicato è tracciabile fino al design source.
- Un rilascio non conforme viene bloccato prima del deploy.

## Requirements

### R8 (parent R8): Validazione strutturale e token
Prima del deploy il Tool deve validare la struttura della pagina, l'allineamento con il Design File Penpot e la compilazione Tailwind con rilevamento dei token mancanti.

#### Scenario: Pubblicazione riuscita
- **WHEN** il Tool pubblica una pagina con struttura valida e token completi
- **THEN** genera il deploy e produce un report di verifica con stato e dettagli

#### Scenario: Pubblicazione bloccata
- **WHEN** il Tool rileva una struttura non valida o un token mancante
- **THEN** blocca il deploy e segnala l'errore nel report di verifica

### R9 (parent R9): Firma dei manifest generati
Il Tool deve poter firmare i manifest generati per dimostrare l'integrità degli artefatti e la loro tracciabilità fino al design source.

#### Scenario: Manifest firmato
- **WHEN** il Tool genera un artefatto di deploy
- **THEN** firma il manifest e include l'informazione di integrità nel report di verifica

### R10 (parent R10): Verifica post-deploy
Dopo il deploy il Tool deve poter verificare che il deploy pubblicato sia coerente con lo stato locale, producendo un report di diff verificabile.

#### Scenario: Coerenza verificata
- **WHEN** il Tool confronta il sito pubblicato con lo stato locale
- **THEN** produce un report di diff con stato e dettagli verificabili

### R14 (parent R14): Verifica senza deploy
Il Tool deve poter eseguire una verifica completa del sito generato senza eseguire il deploy, con report leggibile da umano e da agente.

#### Scenario: Verifica anticipata
- **WHEN** il Tool esegue `verify` su un sito generato
- **THEN** produce un report di stato con errori, avvisi e dettagli leggibile sia da umano sia da agente

## Constraints
- Il deploy deve essere deterministico: lo stesso design source deve produrre lo stesso output statico.
- La verifica deve essere separabile dal deploy, così da poter essere eseguita in anticipo.
- Nessun artefatto firmato può essere pubblicato senza report di verifica.
- Il report di diff post-deploy deve essere archiviato insieme agli artefatti.

## Done when
- Il Tool valida struttura, allineamento Penpot e token prima del deploy.
- I manifest generati sono firmati e tracciabili fino al design source.
- Il Tool produce un report di diff post-deploy verificabile.
- `verify` esegue la verifica completa senza deploy, con report leggibile da umano e da agente.

## Boundaries
- **IN**: validazione, firma dei manifest, deploy statico, verifica post-deploy e report.
- **OUT**: gestione delle bozze (Epic 4), rendering pubblico dei dati negozio (Epic 6), sincronizzazione Penpot (Epic 2).

## References
- FR8, FR9, FR10, FR14 in `SPEC.md`
- Fonte dei requisiti: `_bmad-output/initiative-page-builder/archive-v6/epics.md`
- `archive-v6/spec-confini-core-crypto-e-gate-import.md`, `spec-page-builder/rbac-matrix.md`

## Notes
- I build record storici di questo epic non erano presenti nel workspace v6: lo stato di avanzamento va tracciato in sprint planning, senza record da migrare.
