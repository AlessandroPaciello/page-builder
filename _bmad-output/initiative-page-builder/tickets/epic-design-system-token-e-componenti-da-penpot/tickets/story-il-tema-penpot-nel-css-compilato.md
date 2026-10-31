---
id: 17
type: story
title: "Il tema Penpot nel CSS compilato"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R1]
after: []
hitl: false
risk: low
tracker_id: "89"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/89"
tracker_status: done
---

# Il tema Penpot nel CSS compilato

## Description

I valori del tema Penpot sono quelli che arrivano nel CSS che il browser riceve: `@import` del tema in testa, niente blocchi che ridefiniscono colori, raggi e font posseduti dal tema.

## Requirements

Verify: Un test compila il CSS con la Tailwind installata e verifica che `bg-primary`, `rounded-lg` e `font-sans` usino i valori del tema Penpot, e Storybook e `apps/web` caricano lo stesso CSS globale.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
