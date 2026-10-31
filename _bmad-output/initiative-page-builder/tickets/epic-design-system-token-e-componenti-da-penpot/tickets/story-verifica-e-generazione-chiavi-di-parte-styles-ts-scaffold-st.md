---
id: 22
type: story
title: "Verifica e generazione — chiavi di parte, `styles.ts`, scaffold, story"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2, R3]
after: []
hitl: false
risk: low
tracker_id: "108"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/108"
tracker_status: done
---

# Verifica e generazione — chiavi di parte, `styles.ts`, scaffold, story

## Description

Un generatore unico verifica la `Lettura`, ordina le parti e genera `<Comp>.styles.ts` (una `cva` per chiave, intestazione `@generated` con versione del generatore e hash) e una story per cella, creando lo scaffold una sola volta.

## Requirements

Verify: Le parti senza chiave e le chiavi doppie diventano domande che bloccano la generazione, un `<Comp>.tsx` esistente resta identico byte per byte dopo ogni rigenerazione, e `build_order` rifiuta un componente che contiene uno non ancora generato.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
