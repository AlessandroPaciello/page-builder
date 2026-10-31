---
id: 10
type: story
title: "Fedeltà live ed estrazione guidata dal contratto"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "85"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/85"
tracker_status: done
---

# Fedeltà live ed estrazione guidata dal contratto

## Description

L'estrazione prende il contratto come riferimento, misura il contrasto sullo snapshot live e supporta l'a11y per variante; quando Penpot si allontana dal contratto il solo componente va «in attesa» con gli adattamenti proposti in ordine.

## Requirements

Verify: Un token fuori ruolo mette in attesa il solo componente con messaggio nominativo, un contrasto sotto soglia rende rossa la sua voce (prova Alert `status=warning` a 1.82:1) e `sync:design` riallinea il design committato.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
