---
id: 21
type: story
title: "Geometria e larghezza nel registro"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "88"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/88"
tracker_status: done
---

# Geometria e larghezza nel registro

## Description

Dimensioni, posizioni, dimensionamento e ritaglio disegnati in Penpot arrivano nel codice con regole fisse del nucleo: la misura fissa uguale in tutte le celle si ignora, un valore fuori scala diventa un valore arbitrario con avviso, e il ritaglio segue tre regole dichiarate.

## Requirements

Verify: Ogni regola di geometria e ritaglio ha un test rosso/verde nel livello 1 della CI, `left+right` e `top+bottom` si traducono, e il ritaglio non taglia l'anello di focus.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
