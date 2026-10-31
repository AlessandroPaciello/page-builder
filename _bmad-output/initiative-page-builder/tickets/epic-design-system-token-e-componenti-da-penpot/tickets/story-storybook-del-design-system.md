---
id: 11
type: story
title: "Storybook del design system"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R3]
after: []
hitl: false
risk: low
tracker_id: "106"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/106"
tracker_status: done
---

# Storybook del design system

## Description

Uno Storybook aggrega le storie dei componenti `ui/domains` con i token applicati e l'addon a11y attivo, e un gate esegue le story generate come smoke test, con build statico come job di CI.

## Requirements

Verify: Le story sono CSF3 valido con le props in `args`, una story che rende il componente senza props è un test rosso, e il build statico di Storybook è prodotto senza errori in CI.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
