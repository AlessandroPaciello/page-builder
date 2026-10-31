---
id: 18
type: story
title: "Rimozione dei componenti di prova e della pipeline v2"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "99"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/99"
tracker_status: done
---

# Rimozione dei componenti di prova e della pipeline v2

## Description

I componenti generati per prova e il codice della v2 sono rimossi: la v3 parte da un terreno pulito, conservando contratti dell'editor, registro delle proprietà, Storybook e il dropdown dell'editor su Base UI.

## Requirements

Verify: Non restano né componenti di prova né comandi v2, `tsc` e build verificano che `apps/web` e `ui/editor` non importino nulla di rimosso, le skill obsolete sono tolte e la CI è verde.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
