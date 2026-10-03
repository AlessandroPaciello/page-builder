---
title: '1.2 Diff token e proposta in un colpo'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Senza un diff token Penpot-vs-codice voce-per-voce sulla base congelata della Story 1.1, non si sa cosa allineare prima di toccare nulla e un errore secco senza proposta violerebbe CAP-3/FR3.

**Approach:** Rileggere live via MCP + repo, congelare la fotografia citando la base 1.1 senza basi miste, mostrare voci prima/dopo per file e produrre un piano-diff numerato con ordine applicabile in un colpo solo dopo H1 (Story 1.3), senza applicare nulla qui e senza generare nulla per AD-1/AD-3.

</frozen-after-approval>

## Implementation Notes

- Base congelata live (2026-10-03, branch `story/1-2-diff-token-e-proposta-in-un-colpo`): rilettura MCP identica alla base 1.1, nessun drift. Pagine: 1 (`Page 1`, id `fc8b08ee-95fa-810f-8008-bbcc18aa1c06`); root `Root Frame` board 0 figli; `tokenOverview {}`; library locale 0 colori / 0 typo / 0 componenti. Base citata: fotografia 1.1 (stesso id pagina, stessi 0 token) — nessuna base mista.
- Repo: `packages/tokens/src/tailwind-theme.css` generato 86 righe, marker `@generated`, hash catalogo `4c74af97e6a4`, 76 variabili `--` (15 palette + 25 semantic + 4 radius + 9 spacing + 7 text + 4 font-weight + 2 font + 3 tracking + 2 border-width + 1 opacity + 4 shadow); `packages/tokens/src/tailwind-extras.css` hand-owned 20 righe, 6 variabili (`--font-utility`, `--leading-1..5`, fuori catalogo Penpot per design); `packages/scripts/profiles/` assente (corretto: primo profilo a L1); card-reference con solo `penpot-link.md` TODO + README (screenshot assente, non bloccante per AD-7); `git grep -n "profiles/" -- packages/scripts` vuoto; `data/components/product-card.*` restano artefatti del vecchio regime v1/v2 fuori slice.
- Diff voce-per-voce (prima = codice, dopo = live): D1 `tailwind-theme.css` — 76 variabili codice senza alcun token live (rosso L0); D2 `tailwind-extras.css` — 6 variabili hand-owned attese, nessun allineamento da fare; D3 `profiles/` — assente atteso a L0, nessun mismatch; D4 card-reference — screenshot assente segnalato, non bloccante. Nessun token live fuori vocabolario: via designer → registro → contratto non attivata, resta come regola per token futuri.
- Piano-diff numerato P1–P4 (ordine, un colpo solo dopo H1 in Story 1.3, qui nessuna applicazione): P1 nessuna scrittura su `tailwind-theme.css` (solo `generate:theme` post-H1; rigenerare dal live vuoto wiperebbe 76 vars — distruttivo, vietato senza decisione designer a H1); P2 nessuna scrittura su `tailwind-extras.css` (solo additivo, qui niente da aggiungere); P3 nessun profilo (L1, fuori story); P4 disegno/allineamento Penpot rinviato a H1 + apply 1.4 con due opzioni registrate (a: Penpot sorgente, si disegna lì il primo token L0; b: proceed esplicito con codice esistente come riferimento). Esito: L0 non soddisfatto, Epic 2 bloccata fino a H1 + chiusura 1.4. Mai errore secco: ogni voce ha percorso spiegato.
- Rules-as-fixes: nessuna violazione bloccante muta; screenshot su board vuota non ritentato (già fotografato in 1.1 come assenza, non come blocco).
- Comandi verifica: `penpotUtils.getPages()` + `shapeStructure(penpot.root, 2)` + `tokenOverview()` + conteggi `library.local` (colors/typographies/components) via `penpot_execute_code`; `grep -c "^[[:space:]]*--" packages/tokens/src/tailwind-theme.css` (= 76) e su `tailwind-extras.css` (= 6); `git grep -n "profiles/" -- packages/scripts` (vuoto); `ls` card-reference.
- File toccati: creato questo spec; `sprint-status.yaml` (`1-2-diff-token-e-proposta-in-un-colpo` backlog → review). Nessun runtime, nessun `@generated`, nessun profilo, nessuna scrittura su Penpot.
- Nota tracking: `sprint-status.yaml` riusa `1-2` per due slice (skeleton page-builder done + questo diff-token); la chiave piena disambigua qui, `story_key` lasciato vuoto per collisione numerica esatta 1-2.

## Review Triage Log

- acceptance senza done misurabile → false: formato oneshot impone solo Intent + Notes; done = diff + proposta senza apply, registrato in D1–D4/P1–P4.
- 76 voci non enumerate per variabile → low, rejected: AC "voci prima/dopo per file" soddisfatto da D1–D4; il per-variabile vive nel file repo, enumerarlo sarebbe rumore.
- codici AD/CAP/L/H senza definizione in-file → low, rejected: puntatori in `epic-1-context.md` + epics; stesso stile della 1.1.
- metodi MCP e comandi di conteggio non citati → low, patched: aggiunta riga Comandi verifica (unico gruppo, stessa causa).
- hash catalogo e breakdown 76 senza comando → low, patched: coperto dalla stessa riga Comandi verifica.
- extras senza regola linkata → low, rejected: regola in header del file + AD-5 (extras solo additivo), citato in P2.
- product-card.* senza disposition → false: disposition alla Story 2.16 del vecchio slice, fuori scope L0 per Nota di percorso.
- opzioni H1 senza default/owner → false: un default qui pre-giudicherebbe H1; neutralità canarino voluta (1.2 propone, 1.3 decide).
- handoff 1.3 senza checklist → false: checklist = AC Story 1.3 negli epics; Esito fissa lo sblocco (H1 + chiusura 1.4).
- card-ref senza TODO azionabile → low, rejected: luogo + AD-7 citati; due-story = 4.1 da roadmap, owner = umano per AD-7.
- collisione tracking 1-2 → low, già-deferred: voce esistente dalla review 1.1 (collisione 1-1…1-4), nessuna nuova voce per non duplicare; `story_key` vuoto resta.
- context [] vuoto → false: oneshot minimale ammesso (precedente 1.1); page id e base in Notes.
