---
id: 23
type: story
title: "Adattatore Penpot `readComponent`"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "77"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/77"
tracker_status: done
---

# Adattatore Penpot `readComponent`

## Description

Un unico punto legge un componente da Penpot e lo restituisce come `Lettura` validata dallo schema zod del nucleo: celle, token, layout flex, dimensionamento, ritaglio, dimensioni, posizione, vincoli, istanze e shared plugin data `pagebuilder`.

## Requirements

Verify: La `Lettura` porta ogni proprietà del registro (una mancante è un errore che la nomina), le istanze si riconoscono dal componente d'origine, e l'adattatore non ha fixture di lettura: i suoi test girano solo nel collaudo.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
