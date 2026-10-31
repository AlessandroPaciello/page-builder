---
id: 24
type: story
title: "Server MCP `pds` e controllo dei file generati in CI"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "101"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/101"
tracker_status: done
---

# Server MCP `pds` e controllo dei file generati in CI

## Description

Il server MCP `pds` espone il nucleo come strumenti validati (`tokens_from_css`, `describe_component`, `verify_component`, `build_order`, `generate_component`, `extract_theme`), senza stato e senza scrivere su Penpot, e scrive lui i file `@generated`.

## Requirements

Verify: Un test per strumento gira in memoria con adattatore finto, `generate_component` non scrive con domande aperte e restituisce `Change[]`, e ogni file `@generated` con hash che non torna è un blocco che nomina il file.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
