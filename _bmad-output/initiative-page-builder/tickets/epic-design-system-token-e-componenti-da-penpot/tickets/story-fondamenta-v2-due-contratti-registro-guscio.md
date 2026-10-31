---
id: 12
type: story
title: "Fondamenta v2 — due contratti, registro, guscio"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "87"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/87"
tracker_status: done
---

# Fondamenta v2 — due contratti, registro, guscio

## Description

Il modello v2 vive in `packages/scripts/src/v2`: contratto del page builder ridotto a `name`, `version`, assi `option`, `fields` e slot, `defineExtraction` che fallisce a module load, registro con `layout`/`position`/ruolo `image`, e un unico guscio CLI con `ScriptError` tipizzato.

## Requirements

Verify: Il fingerprint copre solo i campi ridotti, ogni controllo di `defineExtraction` ha la sua prova rosso/verde, i due contratti della ProductCard esistono, e la v1 resta intatta con `gates:render` a diff zero.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
