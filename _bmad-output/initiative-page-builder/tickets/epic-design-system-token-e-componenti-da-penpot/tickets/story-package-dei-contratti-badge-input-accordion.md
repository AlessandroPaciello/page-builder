---
id: 3
type: story
title: "Package dei contratti (Badge, Input, Accordion)"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "93"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/93"
tracker_status: done
---

# Package dei contratti (Badge, Input, Accordion)

## Description

`@app/contracts` esporta gli schemi Zod delle props, gli assi (`option`/`state`/`behavior`), le parti, il classifier structure/content per Badge, Input e AccordionItem e il tipo «definizione di sezione», senza dipendenze da React/Puck/UI.

## Requirements

Verify: Il package compila e i test passano con lint bloccante che vieta dipendenze UI (prova rosso/verde), `schemaVersion` è esportata e un campo ignoto risulta `content`.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
