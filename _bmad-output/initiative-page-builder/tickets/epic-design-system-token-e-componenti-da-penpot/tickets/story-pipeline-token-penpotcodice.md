---
id: 1
type: story
title: "Pipeline token Penpot→codice"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R1]
after: []
hitl: false
risk: low
tracker_id: "95"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/95"
tracker_status: done
---

# Pipeline token Penpot→codice

## Description

Lo strato token è generato dal catalogo Penpot: CSS custom properties `@generated` (Tailwind v4 `@theme`) e scala TS raggruppati per set, con il catalogo serializzato in fixture committata e le variabili non-Penpot in un file hand-owned.

## Requirements

Verify: Un nuovo set Penpot produce una nuova sezione senza modifiche al codice, i file generati portano il marker `@generated`, e la rigenerazione dalla fixture gira offline.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
