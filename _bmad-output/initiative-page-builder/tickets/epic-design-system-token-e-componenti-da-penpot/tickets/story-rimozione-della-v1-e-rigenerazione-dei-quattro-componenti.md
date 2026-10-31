---
id: 16
type: story
title: "Rimozione della v1 e rigenerazione dei quattro componenti"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "100"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/100"
tracker_status: done
---

# Rimozione della v1 e rigenerazione dei quattro componenti

## Description

La v1 è cancellata (dati, otto comandi, codice, `shadcn`, Radix) e Badge, Input, Alert e AccordionItem rinascono uno alla volta dalla v2 su `@base-ui/react`, con una sola pipeline e un solo modo di descrivere un componente.

## Requirements

Verify: Gli artefatti v1 non esistono più, i quattro componenti sono rigenerati uno alla volta con contratto ridotto, `extract`, `render`, diff zero, test e axe verdi, e le voci di `deferred-work.md` legate alla v1 sono chiuse.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
