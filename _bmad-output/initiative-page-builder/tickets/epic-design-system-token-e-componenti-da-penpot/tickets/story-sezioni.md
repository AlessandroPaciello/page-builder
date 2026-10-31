---
id: 27
type: story
title: "Sezioni"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: medium
tracker_id: "102"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/102"
tracker_status: done
---

# Sezioni

## Description

Una sezione con slot si legge e si genera come un componente: un field `structure` diventa un asse, uno slot è riconosciuto dai figli istanza dei componenti ammessi, e una forma disegnata è una parte con la sua chiave.

## Requirements

Verify: Verificando e generando la sezione dello spike (Carousel) ogni regola ha un test rosso/verde nel livello 1 della CI, e la story della sezione usa i figli di default del contratto.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md

## Notes

- Decision: 2026-10-31 — il rendering condizionale `when` e la risposta `content` alla domanda `asse` sono usciti dalla 2.27 e vivono nella 2.33; la 2.27 chiude con asse, slot, forma disegnata e figli di default.
