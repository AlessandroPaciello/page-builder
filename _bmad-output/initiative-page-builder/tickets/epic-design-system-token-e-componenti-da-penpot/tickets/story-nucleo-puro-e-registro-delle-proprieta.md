---
id: 20
type: story
title: "Nucleo puro e registro delle proprietà"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "92"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/92"
tracker_status: done
---

# Nucleo puro e registro delle proprietà

## Description

`packages/scripts/src/core` espone gli schemi zod `Lettura`, `Finding` e `Change` e funzioni dati→ dati che non toccano disco, rete, console né codice di uscita, con il registro unico come fonte della traduzione in classi Tailwind.

## Requirements

Verify: Ogni voce del registro ha un test rosso/verde nel livello 1 della CI, `strokeWidth`, `fontFamily` e i due fill producono classi, e ogni classe del registro espansa sui token del tema produce CSS con la Tailwind installata.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
