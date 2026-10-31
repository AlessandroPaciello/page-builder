---
id: 2
type: story
title: "Estrazione componenti e schema delle ricette"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "83"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/83"
tracker_status: done
---

# Estrazione componenti e schema delle ricette

## Description

Un singolo componente si estrae da Penpot su richiesta (mai in CI né in build) producendo `<comp>.fixture.json` e `<comp>.recipe.json` committati, con il giudizio su varianti, headless e a11y congelato in un artefatto rivedibile.

## Requirements

Verify: La ricetta è validata contro lo schema e contro il vocabolario dei token — una classe con valore literal fallisce — e fixture e ricetta rispettano il confine fra ciò che si legge da Penpot e ciò che richiede React.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
