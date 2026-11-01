---
id: 37
type: story
title: "Ricerca nella Multiselect: celle `search` e asse sul contratto"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: ["119"]
hitl: true
risk: low
tracker_id: "121"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/121"
tracker_status: backlog
---

# Ricerca nella Multiselect: celle `search` e asse sul contratto

## Description

La Multiselect composta non mostra mai la ricerca: tutte le celle usano il pannello con `search=false`, quindi dal blocco `multiselect` la ricerca non si può accendere. Il designer aggiunge la proprietà `search` alla composizione (valore `false` sulle celle esistenti) e disegna le due celle aperte `md` e `sm` con la ricerca; poi il contratto `multiselect` riceve l'asse `search` (`false`, `true`, default `false`) e il blocco lo espone come campo. Senza celle non si aggiunge l'asse: Penpot resta la fonte di verità.

## Requirements

Verify: `verify_component { name: "Multiselect" }` dà un solo blocco, la mancanza di `pagebuilder/contract`, con ogni cella che porta `search`; `describe_component` legge le due celle con `search=true`; il contratto `multiselect` espone l'asse `search` con default `false` e il fingerprint ne ha la voce — la 6 si riscrive se non è ancora rilasciata, altrimenti si aggiunge la 7.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
