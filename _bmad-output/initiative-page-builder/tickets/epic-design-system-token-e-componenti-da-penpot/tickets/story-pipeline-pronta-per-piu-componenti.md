---
id: 7
type: story
title: "Pipeline pronta per più componenti"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "94"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/94"
tracker_status: done
---

# Pipeline pronta per più componenti

## Description

La pipeline regge un catalogo di componenti che cresce e un design che evolve: a11y dichiarata emessa e verificata, liste derivate dai design, e comandi CLI per far evolvere contratti e container Penpot, ogni controllo con la sua prova rosso/verde.

## Requirements

Verify: Aggiungere un contratto con il suo design non richiede liste a mano, `adopt:variant -- <Comp>` aggiorna i cinque file con `--yes` e rifiuta con errore nominativo la variante non esprimibile, e `render:check` resta a diff zero.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
