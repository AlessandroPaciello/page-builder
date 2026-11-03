---
id: 43
type: spike
title: "Il server `pds` deve ricaricare i contratti cambiati, o basta riavviarlo?"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
assignee: ""
refined: false
hitl: true
risk: low
tracker_id: "132"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/132"
tracker_status: backlog
---

# Il server `pds` deve ricaricare i contratti cambiati, o basta riavviarlo?

## Description

Dopo una modifica di `packages/contracts` il server MCP `pds` continua a usare i contratti che ha letto all'avvio. Il 2026-11-03, durante la story 2.40, il processo era partito il 2026-11-02 alle 22:26. Dopo la riscrittura di `shop-card@1`, `group_variants` elencava ancora `product-card`, già cancellato, e il primo tentativo di riavvio non ha fatto ripartire il processo; il secondo, dal pannello MCP di OpenCode/OpenChamber, sì. In più le skill `pds-design` e `pds-code` indicano come riavvio `/mcp` → `pds` → reconnect, che è un comando di Claude Code.

La domanda: il server deve accorgersi da solo dei contratti cambiati (ricaricandoli o rifiutando la chiamata), o basta un riavvio documentato per ogni client? Aspettano la risposta la 2.41 (Carousel), che rifarà il percorso MS → raggruppamento, e ogni uso di CN e MS.

## Approach

1. Confermare la causa: il server parte con `node --import tsx` e importa `@app/contracts` (`COMPONENT_CONTRACTS`, `SECTION_DEFINITIONS`) una volta sola, all'avvio. Riprodurre con una modifica a un contratto e una chiamata a `group_variants` o `verify_component`.
2. Capire perché il primo riavvio non ha avuto effetto, e scrivere la procedura di riavvio per ogni client usato nel progetto (Claude Code, OpenCode/OpenChamber): quale comando, e come verificare che il processo sia davvero ripartito.
3. Confrontare tre strade su correttezza, costo per chiamata, complessità e rischio di dati vecchi:
   - ricaricare i contratti a ogni chiamata, per esempio leggendoli in un processo figlio;
   - confrontare a ogni chiamata la firma dei contratti su disco con quella caricata, e rispondere con un blocco «contratti cambiati: riavvia `pds`»;
   - solo documentazione: la procedura per client nelle skill, dopo ogni scrittura di CN e MS.
4. Prototipo della strada scelta, se non è solo documentazione.
5. L'utente (Alessandro) approva la scelta. Durata massima: mezza giornata. È sufficiente quando una modifica di un contratto non arriva mai in silenzio a una chiamata `pds` con i contratti vecchi.

Passaggio che richiede una persona: riavviare il server dal client (pannello MCP) durante le prove del passo 2.

## Acceptance Criteria

1. **Le tre strade sono confrontate sui criteri che decidono**
   Verify: tabella nelle Notes di questo file
2. **La causa è confermata e la procedura di riavvio è provata per ogni client**
   Verify: riproduzione e procedura nelle Notes, con la verifica che il processo è ripartito (data di avvio del processo o elenco dei contratti)
3. **La risposta è registrata con le conseguenze, dove i ticket in attesa la trovano**
   Verify: una riga `Decision:` datata nelle Notes e il ticket della correzione nell'epica, con le skill `pds-design` e `pds-code` fra i file da toccare se cambia la procedura
4. **L'utente ha accettato la scelta**
   Verify: la `Decision:` nomina Alessandro e la data

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
- story — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/tickets/story-server-mcp-pds-e-controllo-dei-file-generati-in-ci.md (il server `pds`)
- skill — .agents/skills/pds-design/SKILL.md, On activation (passo 2, il reconnect)
- config — .mcp.json e scripts/mcp-pds.sh (avvio del server)

## Notes

- Open question: perché il primo riavvio del 2026-11-03 non ha fatto ripartire il processo (riavvio fatto da un altro client, o reconnect che riusa il processo).
