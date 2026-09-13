---
title: 'Story 2.8 parte B — valutazione per componente e attriti del file Penpot'
type: 'feature'
created: '2026-09-13'
status: 'done'
baseline_commit: '289e6ac6e27c0fa1f790c2f23f548b077ff9492c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `verify:library` e `gates:render` hanno un solo esito: un componente fuori regola fa cadere il run per tutti (in `gates:render` un artefatto rotto lancia prima ancora di stampare i gate), e i componenti in attesa non si vedono fuori dal terminale. In più gli attriti normali di un file fatto da un designer non tecnico (maiuscole, spazi, ordine degli assi, un layer con un nome diverso dalla parte) fanno fallire la pipeline, e una cella mancante è un'affermazione, non una domanda al designer.

**Approach:** un esito per componente (`ok` / `rosso` / `in attesa`, con i problemi nominativi) prodotto da `verify:library` e `gates:render`, stampato nel terminale e reso come report di PR/CI. Una normalizzazione unica di assi e valori verso il contratto, un alias dei layer nel binding, e la cella mancante che mette il componente in attesa con una domanda al designer.

## Boundaries & Constraints

**Always:** l'output di Badge, Input e AccordionItem resta identico byte per byte (`render:check` a diff zero), e così ricette e fixture committate. Ogni controllo nuovo ha una prova rosso/verde. Pass/fail sta negli script, mai nel prompt. Le regole globali di `verify:library` (8 copertura spec, 9 tema, 10 contrasto) restano globali, fuori dalle voci per componente. "In attesa" = valore d'asse in Penpot non adottato, proprietà bloccata dal registro, cella mancante.

**Decisioni (Alessandro, 2026-09-13):**
1. **Exit code:** 1 solo se almeno una voce è rossa; con voci `ok`/`in attesa` l'exit è 0 e gli in attesa stanno nel report.
2. **Report:** Markdown in `$GITHUB_STEP_SUMMARY` quando la variabile esiste (pagina di riepilogo del job), nessun permesso nuovo nel workflow; nel terminale la stessa tabella in testo.
3. **In attesa in CI:** snapshot della library committato, scritto da `verify:library --write-snapshot` (live, lo lancia lo sviluppatore); in CI `verify:library --snapshot` offline alimenta il report. Un componente committato assente dallo snapshot è una voce rossa ("snapshot da aggiornare").
4. La spec resta intera anche oltre i 1600 token (scelta di Alessandro, insieme a B1+B2).

**Never:** nessuna scrittura su Penpot né sui contratti. Nessuna classe per variante (parte C). Nessuna correzione automatica di un componente in attesa, nessuna cella inventata. Nessuna rinomina di layer in Penpot: l'alias vive solo nel binding.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tutti verdi | tre componenti committati | tre voci `ok`, exit 0, report con tre righe verdi | N/A |
| Un rosso | Badge con artefatto non conforme | solo la voce Badge è rossa, Input e AccordionItem valutati e `ok` | problemi nominativi sotto Badge |
| Variante non adottata | `variant=info` in Penpot, assente dal contratto | Badge `in attesa`, rimando a `adopt:variant -- Badge` | N/A |
| Maiuscole/spazi | asse `Size`, valore ` SM ` | normalizzati a `size`/`sm`, nessun errore | N/A |
| Ordine assi | assi del container in ordine diverso dal contratto | nessun errore di regola 4 | N/A |
| Collisione | due valori che normalizzati coincidono (`SM` e `sm`) | voce rossa | errore nominativo con i due valori |
| Alias | layer `Label Text` + alias `label` nel binding | si lega alla parte `label`, ricetta invariata | alias verso una parte inesistente → voce rossa |
| Cella mancante | combinazione del contratto senza variante in Penpot | componente `in attesa` con domanda al designer; se il design la prevede, rimando a `add:library` | nessuna cella inventata |

</frozen-after-approval>

## Code Map

Percorsi sotto `packages/scripts/src/` salvo diverso avviso.

- `library/verify-library.ts:38-40` -- `VerifyResult {ok, errors}` piatto; regole 1–7 per contratto nel loop `:121-232`, regola 11 orfani `:265`, regole 8–10 globali `:279-327`, check copertura design↔registry con early return `:93-108`. Regola 4 confronta gli assi per posizione `:157-164`, valori con `includes` esatto `:171-172`, regola 5 cella mancante `:183-216`, regola 6 parti per `names.has(part)` `:218-229`.
- `library/library-cli.ts:125-140,148,210-214` -- `runVerify`, stampa `✖ verifyLibrary: N errori`, exit booleano; `--snapshot` offline `:22,57-62,85-86`.
- `emitter/gates-cli.ts:59-65,95-101,157-160,170` -- load/render in loop nudi (un throw ferma tutto), flag `failed` unico. `emitter/gates.ts` -- conformità `:155`, completezza `:20`, rigenerazione `:43` già per componente; a11y `:124` con `errors: string[]` piatti; drift `:185-218`.
- `emitter/artifacts.ts:87` -- `committedComponents()` dalle ricette committate.
- `emitter/render-cli.ts:80-111` -- `runRenderAll` già isola per componente: modello da riusare.
- Chiavi di cella: `recipe-schema.ts:143-158` `cellKeyOf`, `verify-library.ts:68-70`, `library-plan.ts:132-134,366-370,378`, `validate-recipe.ts:54,121-125`, `emitter/axis-influence.ts:13-23`. `library/component-reader.ts:147-148` copia assi e ordine di Penpot nella fixture; `:52,112` match esatto del nome del container.
- `recipe-schema.ts:169-184` `partBindings` (layer → parte per `child.name`), `extract-component.ts:194-199`, `validate-recipe.ts:199-212`.
- `emitter/binding-shadcn.ts:14-83` -- `BindingSchema`/`BindingPartSchema`, dove va l'alias. Binding in `emitter/bindings/*.binding.json`.
- `library/library-plan.ts:373-393` -- `addCell` dal design: resta com'è, è il percorso per le celle che il design prevede.
- `.github/workflows/ci.yml` (~74-83) -- job `ci`: `pnpm test` poi `gates:render`; permessi `contents: read`, nessun summary.
- Test da estendere: `library/verify-library.test.ts` (`greenSnapshot()` `:23`), `extract-component.test.ts` (`badgeSnapshot()` `:263`), `emitter/gates.test.ts`, `emitter/render-cli.test.ts`. Nessun test di `gates-cli`.

## Tasks & Acceptance

**Execution:**
- [x] `component-report.ts` (+ test) -- tipo `ComponentVerdict {component, status: ok|red|pending, problems[]}`, aggregazione da più fonti, render terminale e Markdown, exit code secondo la decisione 1.
- [x] `variant-normalize.ts` (+ test) -- normalizza nomi e valori d'asse verso il contratto (trim, spazi interni compressi, confronto senza maiuscole), mappa per nome e non per posizione; collisioni come errore nominativo; valori senza corrispondenza lasciati intatti (così restano "valori in più"). Applicata in `component-reader.ts` e all'ingresso di `verifyLibrary`.
- [x] `library/verify-library.ts`, `library/library-cli.ts` (+ test) -- risultato per componente più errori globali; regola 4 senza ordine; valore in più → `pending` con rimando ad `adopt:variant`; proprietà bloccata → `pending`; regola 5 → `pending` con domanda al designer (e `add:library` se il design ha la cella); regola 6 con alias.
- [x] `emitter/binding-shadcn.ts`, `recipe-schema.ts`, `extract-component.ts`, `validate-recipe.ts` (+ test) -- campo alias per parte nel binding; `partBindings` risolve l'alias; alias verso parte inesistente o duplicato → errore nominativo.
- [x] `emitter/gates-cli.ts`, `emitter/gates.ts` (+ test nuovo `gates-cli.test.ts`) -- load/render isolati per componente, ogni gate riporta per componente, a11y per componente dove possibile (suite globale resta riga globale), un solo report finale.
- [x] `library/library-cli.ts` (+ test) -- flag `--write-snapshot <path>` che salva la lettura live; snapshot committato in `library/library.snapshot.json`, scritto con una lettura live reale (token Penpot da `.env`).
- [x] `.github/workflows/ci.yml` -- `verify:library --snapshot library/library.snapshot.json` e `gates:render` scrivono il report in `$GITHUB_STEP_SUMMARY`; il job fallisce solo per voci rosse.
- [x] `_bmad-output/specs/spec-page-builder/penpot-pipeline.md` -- stati `ok`/`rosso`/`in attesa`, normalizzazione, alias, formato e posizione del report.

**Acceptance Criteria:**
- Given i tre componenti committati, when eseguo `render:check`, `gates:render` ed estrazione dalle fixture, then output e ricette sono byte-identici e il report ha tre voci `ok`.
- Given un componente con un artefatto rotto, when eseguo `gates:render`, then gli altri componenti vengono comunque valutati e compaiono nel report.
- Given `pnpm check-types && pnpm lint && pnpm test`, when girano, then sono verdi e i test di scripts non scendono sotto la baseline misurata prima di iniziare.

## Implementation Notes

- Test di scripts: da 456 (baseline) a 505.
- Snapshot committato scritto da una lettura live reale (2 set, 76 token, 3 container), poi riserializzato offline a chiavi ordinate.
- Regressione trovata in verifica dopo la patch #9 della review: con lo snapshot a chiavi ordinate, la regola 8 segnalava rossi i token `shadow.*` perché `sameValue` in `library/library-plan.ts` confrontava i valori con `JSON.stringify`, sensibile all'ordine delle chiavi. Corretto con un confronto a chiavi ordinate locale a `library-plan.ts` (importare `stableStringify` da `validate-recipe.ts` avrebbe creato un ciclo via `component-reader.ts`), più il test "snapshot committato, come in CI: exit 0" in `library/library-cli.test.ts`.
- `addCell` resta com'è: richiede ancora gli assi nell'ordine del contratto. `verify:library` rimanda ad `add:library` solo quando `addCell` può davvero creare la cella.

## Spec Change Log

## Review Triage Log

Review 1 (2026-09-13): Blind Hunter (15), Edge Case Hunter (13), Verification Gap (4 gap + 1).

| # | Fonte | Finding | Verdetto | Evidenza | Esito |
|---|-------|---------|----------|----------|-------|
| 1 | EC, EC, EC(claim), BH | Caricamenti condivisi fuori dall'isolamento: `committedComponents()` fa il parse di ogni ricetta e lancia su una malformata; `loadCatalog`/`existingFiles` fuori da try; in `verify:library` `loadCommittedBindings` lancia su un binding malformato | medium | `artifacts.ts:87-96` lancia "Ricetta malformata"; chiamato fuori dal try in `runGates` e in `runVerify --snapshot`: una ricetta rotta fa cadere il run senza report, contro "load/render isolati per componente" | patch |
| 2 | VG, BH, EC, VG(other) | Alias nell'emitter senza validazione né `Object.hasOwn`; `render-cli.ts:133` chiama `validateRecipe` senza alias; `findLayerByName` con alias senza test | medium | `bindingAliases` in `render-component.ts:130-137` fa last-wins; `render:component` non passa gli alias: il primo alias reale rompe `render:component` pur con estrazione verde | patch |
| 3 | VG | Ramo "fixture divergente" del drift mai esercitato da `runGates`; `details` mai asserito | medium | Pre-verificato: `gates.test.ts:267-276` asserisce solo `status`/`drifted`; il test di `gates-cli` usa uno snapshot vuoto (solo ramo estrazione fallita), con `expect(base)` inutile | patch |
| 4 | VG | Alias in `runGates` (conformità + errori alias) senza test | medium | Pre-verificato: nessun caso di `gates-cli.test.ts` usa `aliases`, nessun binding committato ne ha | patch |
| 5 | VG | `loadCommittedBindings` senza test | medium | Pre-verificato: nessun test lo chiama; i test della regola 6 passano `bindings` in linea | patch |
| 6 | BH | Il rimando ad `add:library` per una cella mancante vale anche con assi fuori ordine, dove `addCell` non pianifica nulla | medium | `library-plan.ts:368-374` salta in silenzio le celle mancanti se gli assi non sono nell'ordine del contratto o il plugin data non è `contractId` | patch |
| 7 | EC | Cella di un valore non adottato su asse non `option` rimanda comunque ad `adopt:variant` | low | `verify-library.ts` messaggio "in attesa dell'adozione (adopt:variant)" senza il ramo `adoptable` usato dalla regola 4; correzione diretta | patch |
| 8 | BH, EC, EC | Contratto sconosciuto → alias `{}` in silenzio (`loadPartAliases`, `runGates`) | low | Vero: `contract === undefined` restituisce nessun alias; in estrazione produce poi un errore fuorviante; correzione diretta (errore nominativo) | patch |
| 9 | BH | `serializeSnapshot` si dichiara deterministico ma non ordina le chiavi | low | `JSON.stringify(..., 2)` senza ordinamento; lo snapshot committato ha chiavi nell'ordine di Penpot: churn a ogni rilettura; correzione diretta con serializzazione a chiavi ordinate | patch |
| 10 | EC, BH | Codice morto: `checkA11yGate` e `mergeVerdicts` usati solo dai test | low | grep: nessun uso in produzione; cancellazione diretta | patch |
| 11 | BH | Il file della story manca dal diff | false | Escluso di proposito dal diff di review: la spec va solo all'Edge Case Hunter come claims file | respinto |
| 12 | BH | `sprint-status` dice "fatta solo la parte A" | false | La nota registra il ritorno a in-progress; lo stato si aggiorna alla chiusura della story | respinto |
| 13 | BH | Doppio rosso per componente assente dallo snapshot; match per nome del container | low | Due messaggi rossi entrambi veri sulla stessa voce; il caso rinomina è già rosso per la regola 2; correggerlo aggiunge rami | respinto |
| 14 | BH | Uno snapshot vecchio ma completo resta verde in CI | false | Decisione 3 congelata: rosso solo per il componente assente; il confronto con Penpot live è il gate drift | respinto |
| 15 | BH, EC | "Bloccata" decisa dal prefisso del messaggio | low | Fragile, ma i test della regola 7 (strokeStyle/strokeAlignment in attesa) catturano una rinomina; il fix strutturato aggiunge superficie pubblica | respinto |
| 16 | BH | Test mancanti: nome componente con `|` nel Markdown | low | L'escape è testato sui messaggi; nomi di componente PascalCase senza pipe | respinto |
| 17 | BH | `appendFileSync` sul summary senza gestione errori | low | `$GITHUB_STEP_SUMMARY` è sempre scrivibile sul runner; gestirlo aggiunge rami | respinto |
| 18 | BH | Valori in collisione ricompaiono come "valori in più" con rimando ad adopt | low | La voce è già rossa col messaggio di collisione; escluderli aggiunge rami | respinto |
| 19 | BH | `.tmp` residuo; snapshot scritto anche con voci rosse | low | Lo snapshot deve fotografare Penpot anche quando è rosso, e il report lo mostra; il `.tmp` residuo richiede un errore di I/O | respinto |
| 20 | EC | Container senza celle → solo in attesa, exit 0 | false | Per l'intento ogni cella mancante è "in attesa" con domanda al designer; un container vuoto è il caso limite coerente | respinto |
| 21 | EC | `JSON.parse` di un binding senza nome del file | low | Coperto dall'isolamento del #1 (l'errore finisce nella voce del componente); cosmetico | respinto |

## Verification

**Commands** (Node 22: `PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH`):
- `pnpm --filter @penpot-ds/scripts exec vitest run` -- expected: verde, test ≥ baseline.
- `pnpm check-types && pnpm lint && pnpm build && pnpm --filter @penpot-ds/scripts render:check` -- expected: verdi, diff zero.
- `pnpm --filter @penpot-ds/scripts gates:render` -- expected: report per componente, tre voci `ok`, exit 0.
- `pnpm --filter @penpot-ds/scripts verify:library --snapshot src/library/library.snapshot.json` -- expected: report per componente, nessuna voce rossa, exit 0.
- `GITHUB_STEP_SUMMARY=$(mktemp) pnpm --filter @penpot-ds/scripts gates:render` -- expected: il file contiene la tabella Markdown per componente.

**Manual checks:**
- `git diff --stat packages/ui packages/scripts/src/recipes` vuoto.
