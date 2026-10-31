---
id: 19
type: story
title: "Fixture sul catalogo Tailwind e codice nuovo dentro i confini"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "86"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/86"
tracker_status: done
---

# Fixture sul catalogo Tailwind e codice nuovo dentro i confini

## Description

I test di `scripts` leggono il catalogo token derivato dal seme Tailwind dello spike, e `check-boundaries.mjs` copre `src/core`, `src/penpot` e `src/server` con regole testate in automatico.

## Requirements

Verify: La suite di `scripts` è verde sul catalogo nuovo, il nucleo non importa disco, rete né MCP e solo `src/penpot` parla con Penpot, e ogni regola di confine ha un test rosso/verde.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
