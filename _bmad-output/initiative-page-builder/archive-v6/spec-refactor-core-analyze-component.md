---
title: 'Refactor del nucleo: analyzeComponent in fasi pure, senza cambi di comportamento'
type: 'refactor'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
baseline_commit: '7b6eccc3b14e70167fbab8c2be0a13129ff77b1f'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-riordino-packages-scripts.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `analyzeComponent` (`packages/scripts/src/core/verify.ts`) è una funzione di ~350 righe con closure (`block`, `classesOf`, `register`, `visit`, `visitInstance`) che mutano mappe condivise e i campi di `ModelPart` durante la visita: è difficile leggerla e cambiarla. Nel nucleo ci sono poi copie dello stesso codice (suffisso "La risposta X non è valida", comparatore di stringhe, etichetta della cella, valori di dimensionamento).

**Approach:** spezzare `analyzeComponent` in fasi pure con input e output espliciti, costruire `ModelPart` una volta sola alla fine e raccogliere le copie in helper interni al nucleo. Refactor fuori story, sul modello di `spec-riordino-packages-scripts.md` (PR #41): stesso output, stessi messaggi, stesso ordine.

## Boundaries & Constraints

**Always:**
- `analyzeComponent` resta l'unico punto d'ingresso, con firma e output identici: stessi `Finding` nello stesso ordine e con lo stesso testo, stesso `ComponentModel`, stesso output di `generateComponent` byte per byte.
- I test in `packages/scripts/tests/` non si modificano e restano tutti verdi, senza skip; il numero di test non scende.
- API pubblica di `src/core/index.ts` invariata: nessun export nuovo nei moduli riesportati. Fasi e helper restano interni.
- Confini della 2.19: nel nucleo solo import relativi interni a `src/core`.
- Bookkeeping nello stesso branch: in `sprint-status.yaml` `2-24-server-mcp-pds-e-controllo-dei-file-generati-in-ci` passa a `done` (PR #65, `7b6eccc`).

**Never:**
- Cambiare un test. Se un test sembra da cambiare, fermarsi e chiedere ad Alessandro.
- Toccare `scripts/check-boundaries.mjs`, `node:crypto` in `hash.ts` o il trucco `FROM` (refactor B, a parte).
- Cambiare il testo di un messaggio, l'ordine dei `Finding` o la deduplica finale.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Contratto mancante o sconosciuto | `pluginData.contract` assente | un solo blocco, nessun modello, nessuna deduplica (come oggi) | N/A |
| Copie di una lista | fratelli con la stessa chiave e `repeat=lista` | `list: true`, `copies` = massimo per cella | N/A |
| Chiave in rami diversi | stessa chiave sotto genitori diversi | blocco, l'occorrenza non si registra | N/A |
| Parte layer in una cella, istanza in un'altra | entrambi gli ordini | lo stesso blocco di oggi, nello stesso punto | N/A |
| Golden prima/dopo | ogni chiamata ad `analyzeComponent` e `generateComponent` durante la suite | JSON (chiavi ordinate, `Map` come voci) identico al baseline | il confronto nomina l'input che diverge |

</frozen-after-approval>

## Code Map

- `src/core/verify.ts:242-597` -- `analyzeComponent`. Ordine attuale dei `Finding`, da tenere: contratto → celle (per cella, assi in ordine alfabetico) → celle di stato senza base → `rootSizeClasses` → visita (per cella, in profondità; dentro ogni layer prima le classi di `layerClasses`, poi blocchi e domande) → stati (per stato, per chiave in ordine d'inserimento) → elementi (parti in ordine d'albero) → parti inutilizzate → `dedupe`.
- `verify.ts:75-94` -- `ModelPart`: `list`, `copies`, `element`, `instance`, `plainLayer` mutati; `classes` e `instanceProps` sono `Map` riempite dopo la creazione.
- `src/core/generate.ts` -- unico consumatore di `ModelPart` (legge soltanto). Nessun test costruisce un `ModelPart`.
- Suffisso "La risposta X non è valida": `registry.ts:120`, `geometry.ts:345`, `verify.ts:430`, `verify.ts:563`. Il suffisso della chiave (`verify.ts:395`, "La chiave … non è valida (kebab-case…)") ha un testo diverso: resta com'è.
- Comparatore copiato: `verify.ts:265,355`, `geometry.ts:132`, `build-order.ts:69,74`. I `.sort()` senza argomento restano come sono.
- Etichette: `labelOf` (`verify.ts:158`, "cella senza varianti" / "cella k=v, …") e `cellLabel` (`geometry.ts:360`, "senza varianti" / "k=v, …", usata in "(cella …)").
- Dimensionamento: `SIZINGS` (`geometry.ts:95`, default "fix" in `sizingOf`) e `values`/`default` di `sizingH`/`sizingV` (`registry.ts:187-188`).
- `src/core/index.ts` -- `export *` di ogni modulo: un helper esportato da `geometry.ts` o `verify.ts` diventerebbe pubblico.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/internal.ts` (nuovo, non riesportato da `index.ts`) -- `withInvalidAnswer(message, answer)`, `byString(a, b)`, `variantLabel(variant)` ("senza varianti" / "k=v, …"), `SIZING_VALUES` e `SIZING_DEFAULT` -- un posto solo per le copie, fuori dall'API pubblica.
- [x] `src/core/registry.ts`, `geometry.ts`, `build-order.ts` -- usare gli helper; `cellLabel` sparisce -- niente copie.
- [x] `src/core/verify.ts` -- `analyzeComponent` diventa una sequenza di fasi interne: `normalizeCells` → `collectParts` (visita, restituisce bozze di parte, occorrenze e `Finding`) → `applyStates` → `proposeElements` → `findUnusedParts`, poi costruzione di `ModelPart` e `dedupe`. Ogni fase riceve e restituisce dati; l'eventuale stato di lavoro resta locale alla fase. `labelOf` usa `variantLabel` -- leggibilità senza cambi di output.
- [x] `verify.ts` -- `ModelPart` con tutti i campi `readonly` (`children: readonly string[]`, `classes` e `instanceProps` come `ReadonlyMap`), costruito una volta sola -- nessun campo mutato.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- 2.24 a `done` -- bookkeeping.

**Acceptance Criteria:**
- Given il branch, when lancio `pnpm turbo run check-types lint test --force`, then è tutto verde e `git diff 7b6eccc -- packages/scripts/tests` è vuoto.
- Given il golden registrato sul baseline, when lo registro sul branch, then i due file coincidono.
- Given `grep -rn "a < b ? -1\|non è valida\." packages/scripts/src/core`, when lo lancio, then trova solo `internal.ts`.
- Given `src/core/index.ts`, when confronto gli export del modulo prima e dopo, then sono gli stessi nomi.

## Implementation Notes

- **Chi ha implementato.** Il subagent è stato fermato da Alessandro dopo `internal.ts` e le sostituzioni in `registry.ts`, `geometry.ts` e `build-order.ts`. La riscrittura di `verify.ts` l'ha fatta l'orchestratore, nella stessa sessione.
- **Fasi in `verify.ts`.** Tutte interne, nessun export nuovo: `normalizeCells`, `collectParts` (con `visitLayer`, `visitInstance`, `register` e `classesOf` che ricevono lo stato di lavoro `Visit` come argomento), `applyStates`, `treeOrder`, `proposeElements` e `findUnusedParts`. `analyzeComponent` concatena i `Finding` delle fasi nell'ordine di prima e chiama `dedupe` una volta sola.
- **Dati al posto dei campi mutati.** `collectParts` restituisce mappe per chiave: `copies` (solo le liste: `list` = la chiave c'è), `instances`, `plainLayers`, `instanceProps` ed `elementAnswers`. `ModelPart` si costruisce alla fine; i campi facoltativi compaiono solo se valorizzati, come prima.
- **Tipo locale.** `ComponentReading` (non esportato) dà un nome al parametro `lettura`. Non si chiama `Lettura` per non confondersi con lo schema omonimo.
- **Golden.** Il primo file di baseline in scratchpad era stato sovrascritto (formato diverso, probabilmente dal subagent interrotto). Registrato di nuovo sul baseline `7b6eccc`: 131 chiamate (88 `analyzeComponent`, 43 `generateComponent`), identiche riga per riga a quelle del branch. Con il wrapper attivo 3 test di `check-boundaries` falliscono, sia sul baseline sia sul branch: il wrapper usa `process` nel nucleo, e il gate lo segnala come deve.
- **Export.** Le chiavi a runtime di `src/core/index.ts` sono le stesse 82 sul baseline (worktree) e sul branch.
- **Verifica.** `pnpm turbo run check-types lint test --force`: 26/26 task verdi; scripts 471 passati e 8 saltati (i test live di Penpot), come sul baseline. `git diff 7b6eccc -- packages/scripts/tests packages/scripts/scripts` è vuoto. Il grep dell'AC trova solo `internal.ts`.
- **Bookkeeping assorbito da develop (rebase, 2026-10-28).** La PR #66 (`b4b7b97`) ha già portato la 2.24 a `done` con lo stesso commento (`# PR #65, 7b6eccc`). Nel rebase il conflitto su `last_updated` è stato risolto tenendo `develop`: questo branch non tocca più `sprint-status.yaml`.
- **Matrice.** Ogni riga è coperta da un test che c'era già: `verify.test.ts:45` (lista), `:118` (contratto), `:154` (rami diversi), `:184` (layer/istanza nei due ordini), `generate.test.ts:76`. Il golden copre la riga "prima/dopo".

## Spec Change Log

## Review Triage Log

- [edge-case-hunter] `collectParts` restituisce le mappe di lavoro per riferimento e `PartDraft.children` è lo stesso array in cui la visita fa `push`: un consumatore che mutasse il risultato corromperebbe `ModelPart` — **low**: vero, anche se oggi nessuno muta. La correzione è diretta: i figli si copiano quando la bozza esce dalla fase. → patch
- [blind-hunter] i figli sono ancora mutati, solo dietro un tipo `readonly` (alias `{ draft, children }`) — **low**: stessa causa della voce sopra. → patch (raggruppata)
- [verification-gap] `copies` come massimo tra le celle non è fissato da nessun test: tutte le fixture hanno 2 copie in ogni cella — **medium** (evidenza riportata): una regressione da `Math.max` a `count + 1` resterebbe verde. Il golden ha confermato il comportamento identico sul branch, ma la correzione è un test nuovo, che il vincolo di questo refactor esclude. → defer
- [blind-hunter] la prova "nessun cambio di comportamento" (il golden) non è committata; mancano test diretti degli helper e un test di caratterizzazione — **low**: aggiungere test è escluso dal vincolo `tests/` invariato. → defer (insieme alla voce sopra)
- [blind-hunter] niente impedisce che altre cartelle importino `core/internal` — **low**: oggi nessun import fuori da `src/core` (verificato con grep). La correzione tocca `check-boundaries.mjs`, che l'intento esclude. → scartata
- [blind-hunter] il grep dell'AC non trova il comparatore con altri nomi di variabile (`a.suffix < b.suffix`) — **false**: la copia in `geometry.ts:132` è sostituita da `byString(a.suffix, b.suffix)` (vedi diff). La correzione proposta modifica la spec. → scartata
- [blind-hunter] `SIZING_DEFAULT` non è legato a `SIZING_VALUES` — **low**: correzione di una riga con `satisfies`, senza cambiare il tipo letterale. → patch
- [blind-hunter] `sizingOf` restituisce `string` e i chiamanti confrontano ancora i letterali `"fix"`/`"fill"` — **low**: preesistente, e la correzione cambia firme pubbliche (`sizingOf` è esportata). → scartata
- [blind-hunter] `Visit` tiene sia `input` (con `contracts` facoltativo) sia `contracts` risolto: un `visit.input.contracts` perderebbe il default — **low**: vero, correzione diretta: `Visit.input` è ridotto a `tokenTypeOf` e `scale`. → patch
- [blind-hunter] i tipi dei risultati di fase usano `readonly` in modo incoerente — **low**: correzione diretta sui tipi di `NormalizedCells`, `CollectedParts.instanceProps` e `StatedClasses`. → patch
- [blind-hunter] `collectParts` ricalcola `lettura.cells[cell.index]` e dipende dall'allineamento con `rootSizes` — **low**: vero, correzione diretta: `analyzeComponent` risolve le celle una volta (`drawn`) e le passa a `rootSizeClasses` e a `collectParts`. → patch
- [blind-hunter] l'ordine dei `Finding` dipende solo dalla concatenazione, e il JSDoc non cita le celle di stato senza base — **low**: un commento sulla riga della concatenazione più il JSDoc completato. → patch
- [blind-hunter] import di `./internal` fuori ordine in `build-order.ts` — **false**: il file non era in ordine alfabetico neanche prima (`./verify` prima di `./naming`).
- [blind-hunter] la nota sull'ordine delle chiavi di `ModelPart` non è verificata — **false**: grep su `generate.ts`, `src/server` e `src/penpot`: nessun `Object.keys`/`entries`/`values` né spread o `JSON.stringify` di una parte o del modello.
- [blind-hunter] la spec è ancora `in-review` con il triage vuoto — **false**: è lo stato atteso durante la review; si aggiorna adesso.

**Review — esito (2026-10-28):** nessun intent_gap né bad_spec, quindi nessun loopback. L'orchestratore ha applicato le 7 patch, perché il subagent di implementazione era stato fermato. Dopo le patch: `check-types` e `lint` verdi; turbo `check-types lint test --force` 26/26 (scripts 471 passati, 8 saltati); golden di nuovo identico, 131 righe; `tests/` e `scripts/` invariati. 1 defer in `deferred-work.md`.

## Design Notes

**Readonly su `ModelPart`:** è un restringimento del tipo, non un nome nuovo; l'unico consumatore legge soltanto. Lo considero dentro "API invariata".

**Golden (solo verifica, mai committato):** un wrapper temporaneo attorno ad `analyzeComponent` e `generateComponent` aggiunge a un file in scratchpad una riga JSON per chiamata (`input` → `output`, chiavi ordinate, `Map` serializzate come voci) con `process.getBuiltinModule("node:fs")`. Si registra sul baseline e sul branch, si ordinano le righe e si confrontano. L'ordine delle chiavi di `ModelPart` può cambiare: nessun output dipende da quell'ordine.

## Verification

**Commands:**
- `pnpm db:start && pnpm turbo run check-types lint test --force` (Node 22 via nvm, dalla root) -- expected: tutto verde, numero di test di scripts uguale al baseline.
- confronto del golden baseline/branch -- expected: identico.
- `git diff 7b6eccc --stat -- packages/scripts/tests packages/scripts/scripts` -- expected: vuoto.
