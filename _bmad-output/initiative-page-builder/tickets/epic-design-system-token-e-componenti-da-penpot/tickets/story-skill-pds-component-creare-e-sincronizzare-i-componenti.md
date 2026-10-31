---
id: 9
type: story
title: "Skill `pds-component` — creare e sincronizzare i componenti"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "104"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/104"
tracker_status: done
---

# Skill `pds-component` — creare e sincronizzare i componenti

## Description

La skill `pds-component` guida il ciclo di vita di un componente: la voce [PC] crea contratto, design e container e guida giudizio, binding, estrazione, render e gate; la voce [PS] legge lo stato per componente e instrada ogni stato verso il comando giusto.

## Requirements

Verify: Eseguendo i due percorsi su un componente reale la skill si ferma solo sulle decisioni umane, non scrive mai su Penpot né sui contratti fuori dai comandi CLI, e l'esito è sempre l'exit code degli script.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
