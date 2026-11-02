---
id: 31
type: story
title: "Prerequisiti della prova con la v3"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R1]
after: []
hitl: false
risk: low
tracker_id: "98"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/98"
tracker_status: backlog
---

# Prerequisiti della prova con la v3

## Description

Due buchi che la prova sui componenti si porterebbe dietro: `build_order` e `letturaName` conoscono solo i contratti di componente, e una lettura di sezione (`carousel@1`) dà «contratto sconosciuto»; e nessun test compila gli output del generatore (`styles.ts`, `stories.tsx`, scaffold) con `tsc` né li passa allo smoke delle story. Si passa `SECTION_DEFINITIONS` a `contractOf` nel nucleo e nel server, e si aggiunge il test che compila un componente e una sezione generati.

Entrambe le voci vengono dal `deferred-work.md` dell'epica: la prima dalla decisione 5 del piano 2.29, la seconda dalla review 2.22 (decisione di Alessandro del 2026-10-26).

## Requirements

Verify: `buildOrder` su una lettura di `carousel@1` restituisce l'ordine con la sezione e senza blocchi; un output del generatore, per un componente e per una sezione, compila con `tsc` e passa lo smoke delle story; `pnpm check-types`, `pnpm lint` e `pnpm test` sono verdi, con il rosso provato prima del verde.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
