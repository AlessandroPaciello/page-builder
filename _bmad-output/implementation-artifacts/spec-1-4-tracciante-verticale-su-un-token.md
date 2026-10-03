---
title: '1.4 Tracciante verticale su un token'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: df8547c1bfcd4acfdb1b2b7109680dd9e6e89905
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Senza la chiusura verificata su un singolo token, il loop check→diff→proposta→conferma→apply non è provato e la Epic 2 resta bloccata su L0 rosso.

**Approach:** Su H1 sì-a del 2026-10-03 (piano P1–P4 della 1.2, via (a) Penpot sorgente confermata) e rinegoziazione umana 2026-10-03 ("fallo tu tramite mcp": disegno via MCP eseguito da AI, resta via (a) Penpot sorgente). Tracciare un solo token `tracer.primary #0E5A3C` (set `tracer`): apply additivo su extras (mai edit del generato, mai rigenerazione distruttiva dal live a 1 token), poi rilettura con diff vuoto e L0 soddisfatto per quel token.

## Boundaries & Constraints

**Always:** AD-5 (mai edit di `tailwind-theme.css` generato; extras solo additivo; un token un solo proprietario); AD-2 (nessun apply senza H1 valido per questo piano nella sessione; il sì del 2026-10-03 vale solo per P1–P4, una rilettura tra le scritture lo invalida, la rilettura di chiusura dopo l'ultima scrittura non è invalidante); AD-3 (ogni stadio cita la fotografia congelata, mai basi miste); FR4 zero metadati manuali per componente; NFR1 nessun runtime, solo step skill via MCP + repo.

**Never:** nessun profilo in `packages/scripts/profiles/` (L1, fuori story); nessun tocco a `packages/contracts`, headless o payload Puck; nessuna rigenerazione distruttiva dal live a 1 token (wiperebbe 76 variabili senza decisione designer — per questo apply solo additivo su extras); unica scrittura Penpot ammessa: set `tracer` + token `tracer.primary` via MCP già eseguita su autorizzazione umana esplicita 2026-10-03; nessuna apertura Epic 2 senza L0 verde su quel token.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | token `tracer.primary #0E5A3C` in set `tracer` via (a) MCP, H1 sì-a valida | una sola var additiva `--color-tracer-primary` in extras, rilettura con diff vuoto sulla voce, L0 soddisfatto | N/A |
| Live ancora vuoto | nessun token (stato pre-1.4) | nessun apply — superato: live ora a 1 token via MCP autorizzato | mai rigenerare dal vuoto |
| Live cambiato | più token o token diverso dalla base 1.2 | nuovo H1 prima di applicare, base ricongelata | mai apply su base mista |
| Drift metadati | rename pagina o metadati senza tocchi ai token | registrato come non-invalidante, si procede | nuovo H1 solo se cambiano i token |
| Cambio idea via (b) | proceed esplicito con codice esistente | apply solo additivo su extras, nessuna rigenerazione distruttiva | nuovo H1 per via (b) |
| Parziale silenzioso | apply tocca più voci o ne salta una | vietato: una sola voce cambia, resto identico e dichiarato | diff di chiusura lo prova |

</frozen-after-approval>

## Code Map

- `packages/tokens/src/tailwind-theme.css` -- generato `@generated`, 86 righe, 76 variabili; MAI edit a mano, solo `generate:theme`
- `packages/tokens/src/tailwind-extras.css` -- hand-owned 28 righe, 7 vars dopo apply; unico punto di scrittura lecita (apply additivo via (a) su autorizzazione umana)
- `packages/scripts/src/cli/generate-theme.ts` -- entry v1, solo flag `--live`, parsing stretto (argomenti ignoti = errore)
- `packages/scripts/src/theme/theme-command.ts` -- corpo `runTheme`: `loadThemeCatalog(live)` poi `writeTheme` atomica (temp + rename); con `live` aggiorna anche la fixture committata solo dopo generazione riuscita
- `packages/scripts/src/theme/penpot-reader.ts` -- lettura live via MCP (usata per la chiusura, mai toccata)
- `_bmad-output/specs/spec-penpot-estrazione-costruzione/.memlog.md` -- append osservazione chiusura 1.4 (punta, non duplica)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chiave `1-4-tracciante-verticale-su-un-token` backlog → in-progress → review
- `_bmad-output/implementation-artifacts/epic-1-context.md` -- contesto Epic 1 valido, fonte primaria (non ricompilare: scarto timestamp <1ms con epics file)
- `_bmad-output/implementation-artifacts/spec-1-2-diff-token-e-proposta-in-un-colpo.md` -- piano P1–P4 e base congelata (pagina `fc8b08ee-95fa-810f-8008-bbcc18aa1c06`, 0 token live, 76 + 6 variabili codice)
- `_bmad-output/implementation-artifacts/spec-1-3-canarino-del-primo-gate-h1.md` -- verdetto H1 (sì-a via Penpot, handoff 1.4, regole invalidazione)

## Tasks & Acceptance

**Execution:**
- [x] `packages/tokens/src/tailwind-theme.css` + fixture -- nessun tocco (rigenerazione dal live a 1 token wiperebbe 76 vars: vietata) -- il generato resta intatto
- [x] `packages/tokens/src/tailwind-extras.css` -- apply additivo di una sola var `--color-tracer-primary: #0E5A3C` per `tracer.primary` -- unico punto di scrittura lecita
- [x] Rilettura MCP + repo -- fotografia di chiusura che cita la base 1.2, diff vuoto sulla voce `tracer.primary` -- prova senza basi miste
- [x] `_bmad-output/specs/spec-penpot-estrazione-costruzione/.memlog.md` -- append esito chiusura (tenuta, token, via, L0) -- traccia canarino completa
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- avanzare `1-4-tracciante-verticale-su-un-token` -- tracking senza duplicare voci deferred

**Acceptance Criteria:**
- Given H1 concessa sul piano della Story 1.2, when applico, then un solo token cambia per la via decisa senza parziali silenziosi
- Given l'apply eseguito, when rileggo, then il diff sulla voce è vuoto (chiusura verificata)
- Given la chiusura verificata, when controllo L0, then il criterio per quel token è soddisfatto e la Epic 2 può aprirsi

## Implementation Notes

- Base di partenza (branch `story/1-4-tracciante-verticale-su-un-token`, da `develop` pulito e allineato): live vuoto 0 set / 0 token contro base 1.2 (pagina `fc8b08ee-...`, 76 vars generato + 6 extras); H1 sì-a via (a) valida nella sessione 2026-10-03.
- Rinegoziazione umana 2026-10-03 ("fallo tu tramite mcp"): disegno via MCP eseguito da AI invece che da umano; resta via (a) Penpot sorgente. Unica scrittura Penpot: set `tracer` (attivo) + token color `tracer.primary #0E5A3C` via `penpot.library.local.tokens.addSet/addToken`; `tokenOverview` = `{tracer: {color: [tracer.primary]}}`.
- Apply additivo (AD-5): una sola var `--color-tracer-primary: #0E5A3C` in `tailwind-extras.css` (6→7 vars) + commento di eccezione; `tailwind-theme.css` intatto a 76 vars; nessuna rigenerazione `--live` (wiperebbe 76 vars a 1); nessun profilo; nessun tocco a contracts/headless/Puck.
- Chiusura: live `tracer.primary #0E5A3C` == codice `--color-tracer-primary #0E5A3C` → diff vuoto sulla voce; L0 soddisfatto per quel token, Epic 2 sbloccabile.
- File: modificato `packages/tokens/src/tailwind-extras.css`; creato questo spec; avanzati `sprint-status.yaml` (→ review) + memlog SPEC (voce tracciante 1.4).
- Chiusura D1–D4 (formato 1.2): D1 `tailwind-theme.css` invariato (76 vars, nessun token live assorbito); D2 `tailwind-extras.css` +1 var (`--color-tracer-primary`); D3 `profiles/` ancora assente; D4 card-reference invariato (screenshot ancora assente, non bloccante).
- Drift live registrato: pagina rinominata `Page 1` → `Components` (stesso id `fc8b08ee-...`), giudicata non invalidante (solo metadati, zero token toccati); fixture `penpot-catalog.json` volutamente non aggiornata (live 1 token vs catalogo pieno) — assorbimento o ritiro del tracer entro Epic 2.
- Nota API (sessione): `penpotUtils.getTokenSet(token)` rende `null` per il token creato via MCP (verificato due volte); `tokenOverview` + `findTokensByName` funzionano — niente in repo usa `getTokenSet`, nessun impatto.
- Post-review: `pnpm --filter ./apps/web build` verde (Next compila `@theme` con la nuova var senza errori); lint tokens verde.

## Spec Change Log

## Review Triage Log

- [Review][Patch] Code Map stale su extras (20 righe/6 vars, via (b)) dopo apply [spec-1-4 Code Map] — riga aggiornata a 28 righe/7 vars con via (a) autorizzata.
- [Review][Patch] Comando diff in Verification su `develop...HEAD` invece che su baseline_commit [spec-1-4 Verification] — puntato a `df8547c` esplicito.
- [Review][Patch] Implementation Notes con "da avanzare" dopo avanzamento già eseguito [spec-1-4 Notes] — riformulato a compiuto.
- [Review][Patch] Header extras "senza corrispondenza" assoluto dopo eccezione tracer [tailwind-extras.css:1-2] — attenuato a "di norma" con rimando all'eccezione registrata.
- [Review][False] Case hex live vs codice — verificato identico (`#0E5A3C` in `tokenOverview`/`findTokensByName` e in extras riga 27): nessun mismatch.
- [Review][False] Doppia proprietà del token — `grep tracer` su `tailwind-theme.css` vuoto: un solo proprietario (extras), AD-5 tenuto.
- [Review][Defer] Nessun test automatico per mapping live→extras (solo verifica manuale MCP+grep, come in 1-1/1-2/1-3) [verifica] — deferred: copertura live in CI richiede Penpot raggiungibile in pipeline, da disegnare prima della Epic 2.
- [Review][Low→Reject] Token live cancellato prima del merge → var extras orfana [extras] — danno trascurabile (una var hand-owned inutilizzata) e fix (guard/rilettura pre-merge) sproporzionato: rifiutato con nota.

## Verification

**Commands:**
- `penpot_execute_code (tokenOverview + findTokenByName tracer.primary)` -- expected: set `tracer` attivo con `tracer.primary #0E5A3C`
- `grep -c "^[[:space:]]*--" packages/tokens/src/tailwind-theme.css` -- expected: 76 invariato (nessun tocco al generato)
- `grep -n "tracer-primary" packages/tokens/src/tailwind-extras.css` -- expected: 2 occorrenze (1 var + 1 commento di eccezione)
- `git diff --stat df8547c1bfcd4acfdb1b2b7109680dd9e6e89905` (baseline_commit) -- expected: solo file attesi, nessuna scrittura su `@generated` a mano né su `profiles/`
- `git grep -n "profiles/" -- packages/scripts` -- expected: vuoto (nessun profilo a L0)
