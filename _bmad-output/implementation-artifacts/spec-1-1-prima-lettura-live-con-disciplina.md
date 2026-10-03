---
title: '1.1 Prima lettura live con disciplina'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Senza una lettura live verificabile di Penpot via MCP + repo, ogni passo successivo (diff, proposta, gate) avrebbe una base mista e le violazioni di regola potrebbero passare mute.

**Approach:** Eseguire lo step check live via MCP + repo, congelare struttura/token/screenshot/stato repo come unica base citabile, applicare la disciplina rules-as-fixes (ogni violazione proposta come fix, mai blocco muto), verificare `git grep` metadati manuale vuoto e linkare i decision record (memlog SPEC e spine) dal file epic, senza generare nulla per AD-1/AD-3.

</frozen-after-approval>

## Implementation Notes

- Base congelata live (2026-10-03, branch `story/1-1-prima-lettura-live-con-disciplina`): Penpot raggiungibile via MCP (`http://localhost:9001/mcp/stream`, token presente 344 char); pagine: 1 (`Page 1`, id `fc8b08ee-95fa-810f-8008-bbcc18aa1c06`); root `Root Frame` board 0 figli; `tokenOverview {}`; library locale 0 colori/0 typo/0 componenti. Repo: `packages/tokens/src/tailwind-theme.css` generato 86 righe con marker `@generated`, `packages/tokens/src/tailwind-extras.css` hand-owned 20 righe (cita marker solo per dire che non lo porta), `packages/scripts/profiles/` assente (corretto: primo profilo a L1), riferimento card in `_bmad-output/specs/spec-penpot-estrazione-costruzione/assets/card-reference/` con solo `penpot-link.md` TODO + README (screenshot assente, non bloccante per AD-7).
- Screenshot page fallito come atteso su board vuota (export 500 via `penpot_export_shape shapeId=page format=png`, locator `screenshot-00000000-0000-0000-0000-000000000000` hidden 0.01x0.01): registrato come fotografia (nessuno screenshot), non come blocco; sarà Story 1.2/4.1 a gestirlo con segnalazione.
- Rules-as-fixes: nessuna violazione bloccante muta; diff live-vs-codice (0 token live vs ~70 variabili `@theme` in codice) rimandato a Story 1.2 come proposta, mai errore secco.
- Comandi verifica: `git grep -n "profiles/" -- packages/scripts` vuoto; `ls packages/scripts/profiles` assente; `data/components/product-card.*` restano artefatti del vecchio regime v1/v2 (fuori slice per vita propria in epics, riga Nota di percorso), non metadati manuali del nuovo slice.
- File toccati: `sprint-status.yaml` (1-1-prima… → in-progress), `epics-penpot-estrazione-costruzione.md` (aggiunti 2 memlog in inputDocuments + anchor body), creato `epic-1-context.md` + questo spec. Nessun runtime, nessun `@generated`, nessun profilo.
- Nota tracking: `sprint-status.yaml` riusa `1-1…1-4` per due slice diverse (page-builder done + nuovo slice backlog) nella stessa mappa `epic-1`; la chiave piena `1-1-prima-lettura-live-con-disciplina` disambigua qui, ma la collisione resta da sciogliere a parte (vedi deferred).

## Review Triage Log

- sprint-status senza voci nuovo slice Epic 2-4 → false: voci presenti (2-1-primo-profilo…, 3-1-checklist…, 4-1-precondizione…), solo condivise con vecchi epic.
- collisione `1-1…1-4` doppia slice in mappa `epic-1` → medium, deferred: ristrutturazione tracking non semplice, richiede decisione chiavi con prefisso.
- header comment `last_updated` non sincronizzato → low, rejected: storia dei commenti, rumore senza valore.
- memlog solo in frontmatter senza anchor body → low, patched: aggiunta anchor body in Nota di percorso.
- AD-9 mai definito nel file epic → false: coperto via riferimento spine (9 AD citati, dettaglio in SPINE).
- AC `git grep` senza pattern riproducibile → low, deferred: canonizzazione pattern come regola riusabile pre-Epic 2.
- `epic-1-context.md` senza timestamp/hash → false: formato compile-epic-context non li prevede.
- spec `context: []` vuoto → false: oneshot minimale ammesso, vincoli già distillati in Intent.
- path `assets/card-reference/` ambiguo → low, patched: qualificato a `_bmad-output/specs/…/assets/card-reference/`.
- base congelata senza SHA/hashes/trascritto completo → low, patched (id pagina intero, comando export, `git grep` esatto); persistenza file oltre conversazione non richiesta da AD-3.
