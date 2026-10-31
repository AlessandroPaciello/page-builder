---
id: 15
type: story
title: "ProductCard end-to-end e gate in CI"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "96"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/96"
tracker_status: done
---

# ProductCard end-to-end e gate in CI

## Description

La ProductCard disegnata in Penpot arriva in `packages/ui` senza codice a mano, e la CI la rigenera e la valuta per componente con report, senza comandi live.

## Requirements

Verify: Extract e render sono verdi, test generati e axe verdi, la story compare in Storybook con il giudizio visivo registrato, e non c'è nessuna riga di codice a mano per la card (diff zero dal primo commit).

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
