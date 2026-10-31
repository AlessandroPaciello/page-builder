---
id: 8
type: story
title: "Registro delle proprietà e blocco per componente"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "97"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/97"
tracker_status: done
---

# Registro delle proprietà e blocco per componente

## Description

Le proprietà di stile Penpot vivono in un registro unico letto da reader, `verify:library` ed emitter: nessuna fedeltà è persa in silenzio, ciò che la pipeline non sa esprimere blocca solo il componente interessato, e l'emitter è esteso una volta per tutte per le proprietà assenti in una variante.

## Requirements

Verify: Una proprietà non espressibile rende rossa solo la sua voce nel report, `strokeStyle` è una lista chiusa letta dal reader, l'output dei componenti committati resta byte-identico e una variante senza il fill del default emette la classe di rimozione dichiarata nel registro.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
