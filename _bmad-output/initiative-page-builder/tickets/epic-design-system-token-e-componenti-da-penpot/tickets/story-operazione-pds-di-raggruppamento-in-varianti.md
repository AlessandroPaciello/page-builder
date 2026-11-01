---
id: 36
type: story
title: "Operazione `pds` di raggruppamento in varianti"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: ["105"]
hitl: false
risk: medium
tracker_id: "119"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/119"
tracker_status: done
---

# Operazione `pds` di raggruppamento in varianti

## Description

Il server `pds` espone un'operazione che, dato un componente e le proprietà delle sue celle, le raggruppa in un container di varianti con una sola chiamata: nomi completi, eliminazione della variante automatica, assi impostati, istanze annidate ancora collegate. Esegue dal server la sequenza che DC mette per iscritto nella 2.28 e la voce DC la chiama dopo la conferma, al posto della sequenza manuale. Estende il confine della 2.24: è l'unico strumento del server che scrive su Penpot.

## Requirements

Verify: Su un file Penpot duplicato con i cinque set della Multiselect (Chip, Checkbox, Option, Multiselect Trigger, Multiselect), seguendo la voce DC il raggruppamento è una chiamata sola per componente, dopo la conferma, e dà un container senza `variantError` con varianti distinte, `verify_component` che trova il componente e istanze annidate collegate; una seconda chiamata non cambia nulla, mentre un set parziale o un nome senza tutte le proprietà è rifiutato nominando la cella, senza scrivere. Multiselect Panel, senza assi, resta un componente singolo.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
