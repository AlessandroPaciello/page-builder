---
id: 33
type: story
title: "Rendering condizionale e field structure come content"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "115"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/115"
tracker_status: backlog
---

# Rendering condizionale e field structure come content

## Description

Una parte con `when=<field>` si rende solo se il field c'è, e la risposta `content` alla domanda `asse` sposta il field `structure` tra i content: la domanda si chiude.

## Requirements

Verify: Una parte con `when` genera `{field && (…)}` nello scaffold con un test rosso/verde, un `when` su un field sconosciuto è un blocco, e rispondere `content` a `asse` chiude la domanda e genera senza asse.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
- plan — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/tickets/story-sezioni-plan.md, Design Notes (la regola `asse` e i field `structure` della 2.27)

## Notes

- Decision: 2026-10-31 — nata dallo split della 2.27: `when` e la risposta `content` alla domanda `asse` sono qui. Dove si registra la risposta `content` (plugin data o altro) va deciso nel plan di questa story.
- Open question: la risposta `content` si legge dai plugin data della radice, come le altre risposte del nucleo?
