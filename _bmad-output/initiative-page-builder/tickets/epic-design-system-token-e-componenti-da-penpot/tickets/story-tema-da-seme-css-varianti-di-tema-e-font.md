---
id: 26
type: story
title: "Tema da seme CSS, varianti di tema e font"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R1]
after: []
hitl: false
risk: low
tracker_id: "107"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/107"
tracker_status: in-progress
---

# Tema da seme CSS, varianti di tema e font

## Description

Il seme `theme.css` Tailwind diventa tema Penpot e ritorna in codice con le sue varianti e i suoi font: `tokens_from_css` produce set e temi, `extract_theme` legge tutti i set e i temi e scrive `theme.css`, un file per variante e `fonts.css` `@generated`.

## Requirements

Verify: Il giro seme → Penpot → CSS chiude senza perdite sullo seme dello spike, le varianti dichiarate come `[data-<gruppo>="<nome>"]` sono lette, e Next e Storybook caricano lo stesso `fonts.css`.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
