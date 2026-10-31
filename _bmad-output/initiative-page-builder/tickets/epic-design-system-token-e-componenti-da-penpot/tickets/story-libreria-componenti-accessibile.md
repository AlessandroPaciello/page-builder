---
id: 32
type: story
title: "Libreria componenti accessibile"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R3]
after: []
hitl: false
risk: low
tracker_id: "91"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/91"
tracker_status: backlog
---

# Libreria componenti accessibile

## Description

La libreria dei domini (data-display, inputs, feedback, layout, navigation, overlays, commerce) vive in `packages/ui/src/domains`, ciascun componente con contratto dell'editor, `styles.ts` e story `@generated` e componente dello sviluppatore, conforme alla a11y baseline.

## Requirements

Verify: Ogni componente interattivo ha focus visibile WCAG AA, stato comunicato da testo + colore e ARIA corretto, axe è verde su ogni story generata, e `domains/` non importa da `editor/` (lint bloccante).

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
