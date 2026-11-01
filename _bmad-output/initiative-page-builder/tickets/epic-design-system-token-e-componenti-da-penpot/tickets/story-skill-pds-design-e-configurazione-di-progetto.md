---
id: 28
type: story
title: "Skill `pds-design` e configurazione di progetto"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R1, R2]
after: []
hitl: false
risk: low
tracker_id: "105"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/105"
tracker_status: in-progress
---

# Skill `pds-design` e configurazione di progetto

## Description

La skill `pds-design` porta tema e componenti in Penpot attraverso il kit ufficiale, con le voci TB, TV, CN, DC, CD e MS, facendo da wrapper alle skill del kit dove ha senso e senza scrivere metadati in Penpot. La sequenza di raggruppamento che DC mette per iscritto è la base dell'operazione `pds` della Story 2.33.

## Requirements

Verify: Le sei voci sono costruite con `bmad-workflow-builder` e verificate sulle due strade su un componente reale. Un componente con due assi e istanze annidate, seguendo solo la voce DC, arriva a `verify_component` senza altri blocchi che la mancanza di `pagebuilder/contract`, e la skill non descrive più «componenti separati» come ripiego valido. `pds-setup` accetta solo i valori fissati e rifiuta gli altri, e ogni scrittura passa da una conferma.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md

## Notes

- Decision (2026-11-01): il test live DC→CD sulla Multiselect ha eseguito la Verify e l'ha fatta fallire: DC lasciava le celle separate e `describe_component` non trovava il componente per nome; il ripiego «componenti separati» è illeggibile da CD. La correzione è lavoro di questa story ed è fatta (`bed456b`). La skill descrive la sequenza di raggruppamento verificata (nomi completi, `state=default` dove lo stato è disegnato su una sola taglia, eliminazione della variante automatica, `appendChild` delle altre celle, assi con `renameProperty`/`setVariantProperty`/`addProperty`), gli effetti collaterali (`Value 2`, `library.local.components` con un solo componente per container, pagine duplicate che raddoppiano i componenti, duplicare il file e non la pagina) e non presenta più il ripiego. CD si ferma su una cella non raggruppata invece di proporre un contratto senza assi.
- Decision (2026-11-01): la prova della Verify è un componente con due assi e istanze annidate; il test del 2026-11-01 l'ha fatta sulla Multiselect. Carousel e Alert restano la prova delle voci CN→DC e DC→CD, ma la regola di raggruppamento si dimostra sul componente a due assi.
- Decision (2026-11-01): la prova DC→CD sulla Multiselect produce sei contratti, uno per componente letto (`multiselect`, `multiselect-trigger`, `multiselect-panel`, `chip`, `option`, `checkbox`), e `verify_component` restituisce il solo blocco `pagebuilder/contract`. Nell'editor la Multiselect è **un blocco solo**: i cinque contratti annidati restano componenti della pipeline e non entrano nel catalogo dei blocchi; i field di contenuto (`placeholder`, `selected`, `options`, `searchPlaceholder`, `emptyLabel`) si ripetono sul contratto `multiselect` e il passaggio ai figli resta nel TSX dello sviluppatore (AD-5). La ricerca non entra qui: senza celle `search=true` non c'è asse, e la sua storia è la 2.35.
- Decision (2026-11-01): `selected` e `options` restano obbligatori anche dove il disegno non li mostra (`display=placeholder`, `content=empty`): lo stato vuoto è un valore (`[]`), non un field mancante. `removable` del chip resta una proprietà del contenitore, non un asse. La regola dei field obbligatori è scritta in `contract-from-design.md`.
- Decision (2026-11-01, REPLAN): il test DC→CD sulla Multiselect lascia quattro correzioni di testo, tutte in questa storia — la Verify non cambia, cambia ciò che la skill deve dire. **P2** composizioni con istanze: un contratto per ogni componente annidato, ordine figli-prima, field letti dalla parte omonima e ripetuti sul contratto del blocco, passaggio ai figli nel TSX, contratti annidati non blocchi. **P3** criterio degli assi: scelta dell'editor = `option`, `state` = rendering, valore che cambia senza che chi compone tocchi la pagina (`open`, `checked`, `value`, `content`, `display`, `removable`) = fuori. **P4** nomi riservati: DC confronta proprietà e parti con gli elenchi di `contract.ts` prima di scrivere le celle, si ferma e propone il sostituto (`value` → `display`), la rinomina si fa in Penpot. **P7** approvazione non aggirabile: elenca ogni file che sarà scritto, un file non elencato non si scrive, un file cambiato dopo il sì richiede un nuovo sì, e il fingerprint distingue una versione rilasciata (append) da una non rilasciata (riscrittura: è il caso della 6 su questo branch). **P5** test di regressione: due contratti in cui uno è prefisso dell'altro passano, perché il confronto dei nomi è senza estensione.
- Decision (2026-11-01): CD non ha una verifica propria prima del plugin data. `verify_component` si ferma al contratto mancante perché le parti e il `pagebuilder/contract` li scrive `pds-code` (2.29); la verifica di CD resta `describe_component` più i test del contratto, e uno strumento `verify_contract` non aggiungerebbe nulla prima della 2.29.
- Decision (2026-11-01): il REPLAN è chiuso quando (a) un componente con istanze, seguito solo da CD, produce un contratto per ogni figlio, il blocco unico e il passaggio nel TSX, e le copie `.claude/`/`.agents/` sono identiche (`diff -r`); (b) ogni asse proposto ha la sua riga nel criterio scritto, con un esempio e un controesempio; (c) un nome riservato ferma DC con il sostituto proposto, e CD ripete il controllo su un disegno fatto prima della regola; (d) un'approvazione parziale non scrive nulla e il fingerprint distingue una versione rilasciata da una non rilasciata; (e) `components.test.ts` ha il test del prefisso e `contracts` è verde.
