---
id: 5
type: story
title: "Estrazione adeguata — ricette per parti e token, validate contro il contratto"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "82"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/82"
tracker_status: done
---

# Estrazione adeguata — ricette per parti e token, validate contro il contratto

## Description

L'estrazione legge il legame al contratto dal plugin data e produce ricette per parti con celle proprietà→token, coprendo esattamente assi e valori del contratto e alimentando qualunque emitter.

## Requirements

Verify: Contratto duplicato, nome incoerente o contratto senza container falliscono, e `RecipeSchema` rifiuta i literal e le parti annidate con assi propri (criterio di stop meccanico con test rosso/verde).

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
