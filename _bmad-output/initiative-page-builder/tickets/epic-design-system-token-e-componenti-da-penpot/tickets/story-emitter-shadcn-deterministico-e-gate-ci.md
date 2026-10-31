---
id: 6
type: story
title: "Emitter shadcn deterministico e gate CI"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "81"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/81"
tracker_status: done
---

# Emitter shadcn deterministico e gate CI

## Description

Un emitter puro traduce ricetta e binding in componenti shadcn riproducibili: `.tsx` + test + story + barrel `@generated` con provenienza (`penpotComponentId` + `fixtureHash`), assi instradati per tipo.

## Requirements

Verify: Rigenerare produce diff zero, un file senza marker non viene mai sovrascritto, e i gate completezza, rigenerazione, a11y (vitest-axe) e conformità al contratto sono bloccanti in CI ciascuno con la sua prova rosso/verde.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
