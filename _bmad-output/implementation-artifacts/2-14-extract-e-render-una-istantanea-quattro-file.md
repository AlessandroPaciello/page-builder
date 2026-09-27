---
title: 'Story 2.14 — extract e render — una istantanea, quattro file'
type: 'feature'
created: '2026-09-27'
status: 'done'
route: 'dispatch'
baseline_commit: '4ecf94a77673a446cacdc167a4f3c07686467cbb'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-refactor-packages-scripts/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-refactor-packages-scripts/commands.md'
  - '{project-root}/_bmad-output/specs/spec-refactor-packages-scripts/extraction-contract.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-17.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** le fondamenta v2 (2.12) e i comandi `library`/`propose` (2.13) sanno creare il container ProductCard e confrontarlo coi contratti, ma nessun comando sa leggerlo in un'istantanea validata né generare i quattro file; `judgments/`, `bindings/`, `designs/`, `bases/` e la coppia fixture+ricetta sono ancora l'unica strada.

**Approach:** due comandi v2 sul guscio (`extract`, `render`, CAP-4/CAP-5). `extract ProductCard` legge Penpot (live o `--snapshot <file>`), valida nei cinque stadi `penpot → contract → parts → properties → write` e scrive (tmp + rename) `data/components/product-card.json`; `render ProductCard` genera da istantanea + contratto di estrazione + registro i quattro file `@generated` senza basi.

## Boundaries & Constraints

**Always:**
- Pass/fail negli script con prova rosso/verde per ogni controllo nuovo; esito solo da exit code.
- Guscio unico (`runShell`, `parseArgs`) e `ScriptError` con le quattro categorie: `input` 1, `penpot` 2, `contract` 3, `gate` 4. `process.exit*` solo in `src/v2/cli.ts`.
- Celle = cartesiano assi page builder (`promo` 3 valori) × assi di rendering (`hover` 2 valori) = 6 board; chiave cella `promo=<v>|hover=<v>` come in `library-plan`.
- Istantanea scritta solo da `extract` (tmp + rename in `data/components/<kebab>.json` con `contract`, `provenance`, `cells`); `--check` confronta senza scrivere. `extract` e `render` non girano mai in CI né in build; solo `library` scrive su Penpot.
- `render` emette `<Comp>.tsx`, `.test.tsx`, `.stories.tsx` e barrel in `packages/ui/src/domains/<domain>/` marcati `@generated` con provenienza; rigenerazione a diff zero; file senza marker mai sovrascritto (skip, non errore); `--all` accumula i fallimenti e li elenca alla fine.
- Mappatura fissa: `when`→condizionale, `repeat`→`map` (primo layer modello), `attribute`→attributo, `state`→prefissi, headless→elemento (card: `null`), layout/posizione dal registro, `content`→testo, `focusVisible`→`focus-visible:`.
- Errori nominativi (componente, cella, parte) con adattamenti designer → registro → contratto; una categoria per stadio nel log.
- v1 intatta: nessun import v1↔v2, nessun cambio v1, `render:check` a diff zero.

**Never:**
- Scritture su Penpot da `extract`/`render`; scritture su contratti o snapshot da `render`; `--snapshot` in scrittura live (vale solo come seam di lettura/test).
- Classi Tailwind scritte a mano nei comandi o nei template di render; token inventati o celle mancanti riempite in silenzio.
- Basi shadcn, `cva`, `data/bases/`, fixture/ricette/design separati nel percorso v2.
- `process.exitCode` fuori dal guscio; comandi live in CI.
- Modifiche a `src/library`, comandi v1, skill `pds-*` (riscritte alla 2.17), token/Stadio 1.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Extract happy | `extract ProductCard` live o `--snapshot` valido | `data/components/product-card.json` con `contract`, `provenance`, `cells` per 6 celle; log dei 5 stadi | N/A |
| Extract check | `extract ProductCard --check` | confronto senza scrittura, exit 0 se identico | `ScriptError gate`, exit 4 se diff |
| Badge fuori when | layer `Badge` presente in cella `promo=none` | nessuna scrittura, messaggio con componente, cella, parte + adattamenti ordinati | `ScriptError contract`, exit 3 |
| Cella mancante | snapshot con 5 celle su 6 | nessuna scrittura, nomina la cella assente | `ScriptError contract`, exit 3 |
| Token fuori ruolo | proprietà non ammessa dal ruolo o fuori registro | nessuna scrittura, nomina proprietà, ruolo, parte + adattamento | `ScriptError contract`, exit 3 |
| Repeat difforme | layer ripetuti con token diversi dal modello | nessuna scrittura, nomina parte e divergenza | `ScriptError contract`, exit 3 |
| Container assente | nessun container ProductCard nello snapshot/live | nessuna scrittura | `ScriptError penpot`, exit 2 |
| Render happy | `render ProductCard` con istantanea committata | 4 file `@generated` con provenienza in `domains/commerce/` | N/A |
| Render check all | `render --check --all` | diff zero su tutti; fallimenti accumulati ed elencati | `ScriptError gate`, exit 4 |
| Skip protettivo | target esistente senza marker | mai sovrascritto, skip con log, non errore | N/A |
| Nome ignoto | `extract Foo` / `render Foo` | errore che nomina il componente e i contratti v2 noti | `ScriptError input`, exit 1 |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/v2/contracts/product-card.extract.ts` -- verità per extract/render: container, asse `hover`, 11 parti con `when`/`repeat`/alias.
- `packages/scripts/src/v2/extraction.ts`, `registry.ts` -- `defineExtraction`, controlli a load; `resolveExtraction` nome → contratti.
- `packages/scripts/src/v2/library-plan.ts` -- riuso celle/cartesiano/`when` (`expectedCells`, `cellKey`, `partsForCell`, `findContainers`); non duplicare.
- `packages/scripts/src/library/library-reader.ts` -- `readLibrarySnapshot({callTool})`; unica lettura Penpot, seam `--snapshot` per test.
- `packages/scripts/src/shared/style-properties.ts` -- `roleAdmits`, `propertyProblem`, emit layout/posizione; token ammessi e classi render.
- `packages/scripts/src/shared/paths.ts` -- aggiungere `componentsDir` (`data/components`); riusare `domainsRoot`.
- `packages/scripts/src/v2/errors.ts`, `shell.ts`, `cli.ts`, `commands/library.ts` -- guscio, `ScriptError`, pattern factory `*With(deps)`; registrare in `COMMANDS`.
- `packages/scripts/src/emitter/render-component.ts`, `artifacts.ts` -- riferimento v1 per marker/skip/diff-zero; imitare, mai importare.
- `packages/scripts/package.json`, `tests/v2-boundary.test.ts` -- script `extract`/`render`; confini v1/v2.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/shared/paths.ts` (+ test) -- aggiunge `componentsDir`; riusa `domainsRoot` -- fondazione path
- [x] `packages/scripts/src/v2/components.ts` (+ test) -- formato istantanea (`contract`, `provenance`, `cells`), tmp+rename, `--check` -- CAP-4
- [x] `packages/scripts/src/v2/commands/extract.ts` (+ test) -- 5 stadi con seam DI: 6 celle, `when`, `repeat`-modello, `roleAdmits`, log stadi -- CAP-4
- [x] `packages/scripts/src/v2/commands/render.ts` (+ test) -- da istantanea: 4 file `@generated`, skip senza marker, `--all` accumula -- CAP-5
- [x] `packages/scripts/src/v2/cli.ts`, `package.json` -- registra `extract`/`render` in `COMMANDS` + script pnpm -- CAP-8
- [x] `packages/scripts/src/v2/commands/extract.test.ts`, `render.test.ts` -- rosso/verde per ogni riga della matrice -- disciplina
- [x] `packages/scripts/README.md` -- esempi `--check`/`--snapshot`/`--all`, vincoli mai-in-CI -- docs

**Acceptance Criteria:**
- Given i due contratti della ProductCard e un'istantanea Penpot (live o `--snapshot <file>`), when lancio `extract ProductCard`, then viene scritta (tmp + rename) `data/components/product-card.json` con `contract`, `provenance` e `cells` per 6 celle; `--check` confronta senza scrivere.
- Given il layer `Badge` presente nella cella `promo=none`, when lancio `extract`, then fallisce con `kind: contract` nominando componente, cella e parte, propone gli adattamenti in ordine e non scrive nulla; gli stadi compaiono nel log con una sola categoria ciascuno.
- Given l'istantanea committata, when lancio `render ProductCard`, then produce i 4 file `@generated` con provenienza e mappatura (`when`/`repeat`/`attribute`/`state`/layout, nessuna base).
- Given i file committati, when lancio `render --check --all`, then rigenera a diff zero; un file senza marker non viene mai sovrascritto; `--all` accumula i fallimenti e li elenca.
- Given le suite `scripts`/`contracts`/`ui` e `render:check` v1, when girano, then verdi a diff zero come prima della story.

## Implementation Notes

- Decisione utente 2026-09-27: snapshot committato e componente 2.14 restano sintetici (segnaposto di pipeline). Story 2.15: il disegno della ProductCard in Penpot NON sarà manuale di Alessandro ma guidato via server MCP (container di 2.13 riempito/disegnato tramite tool MCP `execute_code`); la 2.15 dovrà definire il seed/i passi MCP e il giudizio visivo resta di Alessandro su Storybook.

## Review Triage Log

Review 2026-09-27 su `/tmp/bmad-2-14-diff.patch` (164 kB, 19 file, +3212/−5): `blind-hunter` 20 righe, `edge-case-hunter` 8 righe, `verification-gap` 2 righe pre-verificate.

| Verdetto | Finding | Evidenza / esito |
|---|---|---|
| low respinto | [Blind] snapshot sintetico senza marker di provenienza | Vero ma innocuo prima della 2.15: nessun consumer legge `source`, drift coperto da `render --check`, placeholder registrato nelle Implementation Notes; il fix aggiungerebbe superficie al formato per un file che la 2.15 riscrive da MCP. |
| false | [Blind] snapshot committato con hover off/on identici e senza layout | Smentito come difetto: nessun contenuto Penpot reale ancora (placeholder sintetico); il reader non legge flex/layout (rischio noto); la mappatura è coperta da test sintetici (`render.test.ts:161`). |
| low respinto | [Blind] `loadComponentSnapshot` non controlla chiavi cartesiane | Vero ma solo per snapshot editati a mano (extract scrive solo cartesiane; diff in PR è la review); il fix aggiungerebbe guardie per un percorso visibile in review. |
| low patch | [Blind] `committedSnapshots`/`kebabToPascal` senza round-trip garantito | Verificato il rischio per futuri componenti multi-parola; si risolve via lookup nel registry invece di manipolazione stringhe. |
| low respinto | [Blind] errori FS grezzi (write/mkdir/rename) senza `ScriptError` | Vero ma solo per fallimenti ambientali (permessi/disco pieno): lo shell li mappa a exit 1 con messaggio; mai incontrati in uso normale, il fix aggiungerebbe rami. |
| low patch | [Blind] conteggi hardcodati nei log (`attese 6`, `11 parti`) | Verificato (`extract.ts:215,268,280,283,584`): corretti oggi, sbagliati dal secondo componente; fix diretto con `expectedKeys.length`/conteggio parti. |
| medium patch | [Blind+Edge] board con `variantProps === null` saltata in silenzio | Verificato (`extract.ts:239` `continue`): una board spuria nel container passa inosservata, viola `mai infedele`; fix: errore `contract` nominativo + test. |
| false | [Blind] layer ambigui fra sottoalberi diversi | Smentito: `defineExtraction` vieta due parti sullo stesso layer (`layersSeen`, `extraction.ts:219-222`), i nomi sono unici per contratto. |
| low respinto | [Blind] render scarta `role` (`void role`) senza `roleAdmits` | Vero ma extract lo impone in scrittura e il diff committato è la review; ricontrollo in render duplicato per solo percorso edit-a-mano. |
| defer | [Blind] `classesForPart` specifico di hover, non generico | Vero ma fuori scope: un solo asse di rendering oggi; la generalizzazione multi-asse va alla 2.16+ (secondo componente). |
| low patch | [Blind] placeholder `void` morti in `renderPartJsxV2` | Verificato: codice morto da rimuovere (cancellazione diretta). |
| defer | [Blind] nipoti di `repeat` oltre un livello e contorni futuri | Un livello (`tag`→`tagLabel`) coperto; annidamenti più profondi solo con futuri contratti → 2.16+. |
| false | [Blind] attributi `$item` scartati in silenzio | Smentito: `attribute` con field `$item` è rifiutato a module load (`extraction.ts:282` vuole field esistente). |
| defer | [Blind] `sampleArgsFor*` hardcodati su ProductCard | Vero ma solo dal secondo componente; campionamento generico dai field → 2.16+. |
| defer | [Blind] `alt=""` del generato senza field dedicato | `alt` informativo richiede un field nel contratto page builder: decisione di design per la 2.15 (MCP), non patch di questa story. |
| low patch | [Blind] `key={index}` nella `map` dei tag (`render.ts:346`) | Verificato: chiave instabile; fix diretto con valore dell'item. |
| false | [Blind] default `href=""` del generato | Smentito come difetto: default del pattern props, il consumer passa l'href reale; stories/test usano sample. |
| low patch | [Blind] test generato con sole stringhe hardcodate | Verificato (`ProductCard.test.tsx`): mancano asserzioni su `data-slot`/wiring; fix nel template + story `EmptyTags`. |
| low patch | [Blind] barrel di `--all` sovrascritto per dominio | Verificato (`render.ts:571-582`): con un componente ok; dal secondo va fuso — fix ora mentre il codice è fresco (accumulo per dominio). |
| low respinto | [Blind] `readExistingFiles` legge tutto `domainsDir` | Vero ma `domains/` è piccolo e committato; scoping/simlink fuori uso quotidiano, fix aggiungerebbe complessità. |
| low patch | [Blind] README ambiguo sui modi CI-safe | Verificato: `extract`/`render` live mai in CI, solo `render --check --all` via `gates`; fix doc in una frase + exit code. |
| defer | [Blind] nessun job `gates` v2 per i nuovi file | Il gate v2 (`gates`, CAP-9) è la Story 2.15; cablaggio CI lì, non qui. |
| low respinto | [Blind] `--snapshot` + scrittura promuove file a snapshot committato | Uso documentato come seam di test; la provenienza live-vs-file si decide in 2.15 col disegno MCP. |
| false | [Blind] `Spec Change Log` vuoto | Smentito: vuoto per disegno fino al primo loopback `bad_spec` (template). |
| medium patch | [Edge] `catalog` senza array `sets` → `TypeError` | Verificato (`extract.ts:141,174`, `render.ts:92`): catalogo committato, ma il fail è confuso; guardia `input` all'ingresso di entrambi (una riga ciascuna). |
| low respinto | [Edge] `readdir` di `componentsDir` senza guardia permessi | Solo per directory committata illeggibile: mai in uso normale, fix aggiungerebbe rami. |
| low respinto | [Edge] tmp-write/rename senza guardia disco pieno | Come sopra: ambientale, exit 1 con messaggio già oggi. |
| false | [Edge] `when` con array vuoto nel render | Smentito: rifiutato a module load (`extraction.ts:306`). |
| medium patch | [Gap pre-verificato] token con `type` sbagliato senza test | Filed con evidenza e disposition `patch`: rosso/verde `fill: spacing.1` su `Price` → exit 3. |
| medium patch | [Gap pre-verificato] variazione `promo` ignorata senza test | Filed con evidenza e disposition `patch`: snapshot promo-variante → `contract`. |

Raggruppamento: nessuna condivisione di root cause oltre le coppie già fuse nelle righe (null-skip, catalog-guard). Nessun `intent_gap`/`bad_spec`: solo `patch` + `defer` + respinti.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde, nessun test in meno
- `pnpm --filter @penpot-ds/scripts check-types && pnpm --filter @penpot-ds/scripts lint` -- expected: verdi
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: 4/4 diff zero (v1 intatta)
- `pnpm --filter @penpot-ds/scripts verify:library -- --snapshot data/library.snapshot.json` -- expected: exit 0 invariato
- `node --import tsx packages/scripts/src/v2/cli.ts extract --help` -- expected: uso con `<Comp> [--check] [--snapshot]`, senza scritture
- `node --import tsx packages/scripts/src/v2/cli.ts render --help` -- expected: uso con `<Comp>|--all [--check]`, senza scritture
