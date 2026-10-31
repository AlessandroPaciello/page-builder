---
id: 13
type: story
title: "`library` e `propose` — Penpot dal contratto di estrazione"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "90"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/90"
tracker_status: done
---

# `library` e `propose` — Penpot dal contratto di estrazione

## Description

`library add <Comp>` fa nascere in Penpot il VariantContainer con plugin data, assi, board e layer con i nomi delle parti e token legati su ogni proprietà di stile; `propose <Comp>` legge Penpot e stampa il diff proposto sui due contratti senza scrivere nulla.

## Requirements

Verify: Rilanciato `library add` non modifica né cancella nulla e segnala le differenze, `--dry-run` stampa senza scrivere, e `propose` nomina file e riga senza scrivere né su Penpot né sui contratti.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
