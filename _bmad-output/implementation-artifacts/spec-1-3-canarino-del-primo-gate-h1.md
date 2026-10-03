---
title: '1.3 Canarino del primo gate H1'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Senza osservare il primo loop di conferma H1 sul piano-diff della Story 1.2, non si sa se il gate convenzionale (AD-2) regge o viene saltato in silenzio con effetti senza sì esplicito.

**Approach:** Chiedere H1 sul piano-diff numerato P1–P4 della Story 1.2 con le due opzioni registrate (a: Penpot sorgente, b: proceed esplicito con codice esistente), osservare tenuta/frizioni/tentativi di skip senza applicare nulla senza sì, e registrare l'esito nel memlog SPEC come osservazione canarino; il sì esecutivo non persiste oltre la sessione.

</frozen-after-approval>

## Implementation Notes

- H1 chiesto in conversazione sul piano P1–P4 della 1.2 con 3 opzioni esplicite (sì-a / sì-b / no); risposta umana: sì via (a) Penpot sorgente — si disegna lì il primo token L0, apply in 1.4. Sì esecutivo valido solo per questo piano in questa sessione, non persistente (AD-2).
- Tenuta: nessun effetto del piano partito prima del sì (P1-P3 nessuna scrittura rispettata, P4 rinviato a 1.4); scritti solo artefatti di workflow (branch, spec, sprint-status, memlog). Frizioni: nessuna sul formato H1; notata collisione tracking 1-3 (vecchio slice page-builder done + nuovo slice backlog), story_key lasciato vuoto come in 1.1/1.2. Skip: nessun tentativo di skip osservato.
- File toccati: creato questo spec; `sprint-status.yaml` (`1-3-canarino-del-primo-gate-h1` backlog → in-progress); `_bmad-output/specs/spec-penpot-estrazione-costruzione/.memlog.md` (append osservazione canarino). Nessun runtime, nessun `@generated`, nessun profilo, nessuna scrittura su Penpot.
- Evidenza tenuta (verifica): `git status --short` + `git diff --stat` mostrano solo 2 file modificati (sprint-status, memlog SPEC) + 1 spec nuovo (1862 B); nessuna chiamata MCP di scrittura in sessione; `packages/scripts/profiles/` resta assente come in 1.2. La base live resta quella congelata in 1.2 per AD-3 fino alla 1.4.
- Scope sì e handoff 1.4 (AD-2): il sì vale per il piano P1–P4 in questa sessione; una rilettura tra le scritture lo invaliderebbe. La 1.4 attende il disegno umano del primo token L0 in Penpot (live oggi vuoto: 0 token per base 1.1/1.2) via (a), poi applica e verifica la chiusura con rilettura; senza disegno o con cambio idea serve un nuovo H1.

## Review Triage Log

- Intent 2-vs-3 opzioni / no-path → false: no-path coperto da "senza applicare nulla senza sì" (AD-2); a/b sono le varianti del sì; H1 reale a 3 opzioni con sì-a scelto, nessun danno.
- Verbatim H1 mancante → false: la conversazione è il log operativo (spine, riga Log di run); esito in memlog + Notes, verbatim sarebbe duplicato.
- Prova tenuta senza comandi → low, patched: aggiunta riga evidenza (git status/diff + nessuna chiamata MCP di scrittura + profiles assente).
- Ambito "nessun effetto" indefinito → false: ambito distinto esplicitamente in Notes e memlog (effetti del piano vs artefatti di workflow).
- Sì non persistente senza scope operativo + handoff 1.4 → low, patched: aggiunta nota scope AD-2 + handoff (live vuoto, 1.4 attende disegno umano primo token L0).
- Review Triage Log mancante nel draft → false: assenza attesa pre-finalize; aggiunto qui per workflow.
- context [] vuoto → false: precedente 1-1/1-2 (oneshot minimale ammesso, dipendenze distillate in Intent/Notes).
- Memlog header/accenti/riga lunga → low, patched (header → 2026-10-03T17:13, accenti sì); formato single-line confermato come voci precedenti, split rifiutato.
- Collisione tracking senza piano → già-deferred: voce esistente in deferred-work.md (source review 1.1); nessuna nuova voce per non duplicare (precedente 1-2).
- Framework frizioni/skip + osservatore indipendente → false: fuori scope single-goal; AD-2 dichiara garanzia convenzionale non eseguibile.
- No-rilettura live a supporto no-scrittura Penpot → low, patched con evidenza tenuta (nessuna chiamata MCP di scrittura in sessione; live alla base 1.2 per AD-3).
- Dettaglio token L0 per 1.4 → low, patched con handoff (stessa causa dello scope sì).
