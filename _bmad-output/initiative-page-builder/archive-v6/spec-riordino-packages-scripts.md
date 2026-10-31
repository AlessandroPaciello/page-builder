---
title: 'Riordino di packages/scripts senza cambi di comportamento'
type: 'refactor'
created: '2026-09-14'
status: 'done'
route: 'dispatch'
baseline_commit: '616299232a71153827d325e9ac2911644bd3a110'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `packages/scripts/src` mescola alla radice i moduli dei token, dell'estrazione e il client MCP, e tiene i dati committati (designs, recipes, judgments, bindings, bases, snapshot, catalogo) dentro le cartelle del codice. I path dei dati sono calcolati da `import.meta.url` in almeno 8 file. Le funzioni di libreria sono esportate da file CLI (l'emitter importa da `extract-component.ts`). Uno spostamento può quindi rompere i comandi veri mentre i test, che passano le cartelle come seam, restano verdi.

**Approach:** spostare il codice in cartelle per area e i dati fuori da `src/` con `git mv`, calcolare tutti i path in un modulo unico, lasciare nei file CLI solo gli entrypoint e aggiungere uno smoke test che lancia i comandi veri. Il comportamento resta identico: stesso output, stessi messaggi, stessi exit code.

## Boundaries & Constraints

**Always:**
- `git mv` per ogni spostamento: la storia dei file deve seguire.
- `render:check` a diff zero, `gates:render` verde, `test`, `check-types` e `lint` verdi senza skip. Il numero di test non scende (baseline: scripts 549).
- Aggiornare ogni riferimento vivo ai path:
  - `packages/scripts/package.json`, `tsconfig.json`, `README.md`;
  - `.github/workflows/ci.yml:95`;
  - `penpot-pipeline.md` (righe 103, 164, 176, 180);
  - le skill `pds-component` e `pds-bootstrap` nelle 3 copie, che devono restare identiche;
  - `_bmad/_config/files-manifest.csv` (hash delle skill toccate).
- La guardia di invocazione diretta è una sola, quella di `library/direct-invocation.ts`, con `realpathSync`.

**Never:**
- Toccare gli story file chiusi (`1-*`, `2-*`) o cambiare il testo dei messaggi d'errore. Unica eccezione: un path citato in un messaggio, che si aggiorna al nuovo path.
- Portare le regole di estrazione e di `verify:library` in un modulo condiviso: è rimandato (`deferred-work.md`, 2026-09-14).
- Rinominare comandi pnpm o flag, o toccare `packages/ui`, `tokens` e `contracts` oltre ai path che scripts legge o scrive.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Comando vero dopo il riordino | `pnpm --filter @penpot-ds/scripts verify:library --snapshot <nuovo path snapshot>` | exit 0, stdout identico a prima | N/A |
| Smoke test | ogni entrypoint in `src/cli/` lanciato con `--help` o con argomenti non validi | esce con l'errore d'uso atteso, non `ERR_MODULE_NOT_FOUND` o `ENOENT` | il test fallisce e nomina il comando |
| Path di un dato sbagliato | un path del modulo unico punta a un file inesistente | il test sui path fallisce e nomina la chiave e il path | N/A |
| Import relativo fuori dal package | un file in `src/` importa `../../apps/web/src/x` o `../../ui/src/y` | il gate dei confini è rosso e nomina file, riga e specifier | N/A |
| Import relativo interno | `../shared/paths` fra cartelle di `src/` | il gate resta verde | N/A |

**Decisioni (Alessandro, 2026-09-14):**
- **Gate dei confini (1a).** Il canary esiste già (Story 2.4). Questa spec chiude il buco degli import relativi che escono dalla radice del package: rosso se il path risolto è fuori da `packages/scripts`, con un test rosso/verde nello stesso file di test. La nota stantia `deferred-work.md:90` si aggiorna per `scripts`.
- **Cartelle (2a).** `shared/ theme/ extract/ library/ emitter/ cli/` come chiesto. Lo spine (`ARCHITECTURE-SPINE.md:241-245`) si aggiorna in una PR `chore/` separata, dopo il merge di questa: i planning-artifacts non si toccano da questo branch.
- **Dimensione.** Spec tenuta intera (circa 2.500 token): dividerla vorrebbe dire due passate sugli stessi import.

</frozen-after-approval>

## Code Map

- `src/extract-component.ts:41-85` -- path di `recipes`, `judgments`, catalogo e `bindings` calcolati sul file. Esporta `loadCatalogFixture`, `loadJudgment`, `loadPartAliases`, `toKebab`, `fixturePathFor` e `recipePathFor`, usati da `emitter/artifacts.ts`, `render-component.ts`, `render-cli.ts`, `gates-cli.ts` e `gates.test.ts`. Da spostare in `extract/` e `shared/`.
- `src/generate-theme.ts:8-10,54-58` -- catalogo e `../../tokens/src`, senza seam. Scrive il tema e riscrive il catalogo.
- `src/emitter/artifacts.ts:18-26` -- `recipes`, `bindings`, `bases`, `ui/src/domains`. Ha i seam `dir`/`root`.
- `src/emitter/gates-cli.ts:74` -- `new URL("../../../ui")`, che è la cwd della suite di ui.
- `src/library/designs-loader.ts:17`, `library-cli.ts:43` (seed), `adopt-cli.ts:33-50` (`contracts/src`, fingerprint, `DEFAULT_PATHS`).
- `src/library/direct-invocation.ts:10` -- guardia unica. Copie inline senza realpath in `extract-component.ts:376`, `render-cli.ts:185`, `gates-cli.ts:240`.
- `src/library/verify-library.ts:396`, `library-cli.ts:29` -- path dello snapshot citato in un messaggio e in un commento.
- Test che leggono i dati reali, dove si aggiornano i path: `validate-recipe.test.ts:10-13,274-282`, `theme-generator.test.ts:14,310`, `extract-component.test.ts:21,240,351,385-401,430`, `library/*.test.ts` (seed via `import.meta.dirname`, snapshot `library-cli.test.ts:125-127,199`), `adopt-*.test.ts`, `new-catalog.test.ts:17`, `tests/no-legacy-consumers.test.ts:19-20`.
- `scripts/check-boundaries.mjs:144` -- scansiona solo `src/`, in modo ricorsivo, e ignora i JSON. Lo spostamento dei dati non lo cambia.
- `tsconfig.json` -- include `src/**/*.ts` e `tests/**/*.ts`. Le basi `.tsx` già oggi non sono controllate dal type-check.
- Nessuna config vitest. `turbo.json` non cita path di scripts.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/data/` -- `git mv` di `designs/`, `recipes/` (con `judgments/`), `bindings/`, `bases/`, `library.snapshot.json`, `semantic-tokens.seed.json` e del catalogo `__fixtures__/penpot-catalog.json` -- i dati fuori dal codice.
- [x] `src/shared/paths.ts` -- unico modulo con i path di tutti i dati, dei package vicini e di `ui/src/domains`. Rimpiazza ogni `resolve(here, ...)` e `new URL(...)` elencato nel Code Map, lasciando intatti i seam -- un solo posto da aggiornare.
- [x] `src/{shared,theme,extract,library,emitter}/` -- `git mv` dei moduli per area. `mcp-client`, `theme-generator`, `style-properties`, `toKebab`/`pascalCase` e `direct-invocation` vanno in `shared/`. Aggiornare gli import -- struttura per area.
- [x] `src/cli/*.ts` -- un file per comando, che fa solo parsing, guardia e `main`. La logica esportata finora dai CLI si sposta nel modulo d'area, e i test la importano da lì -- niente librerie nei file CLI.
- [x] `tests/paths.test.ts` -- ogni chiave di `paths.ts` punta a un file o una cartella esistente -- un path sbagliato fallisce per nome.
- [x] `tests/cli-smoke.test.ts` -- lancia ogni entrypoint con `node --import tsx` e controlla che non ci siano errori di risoluzione dei moduli o dei file. Esegue anche `verify:library --snapshot` sullo snapshot committato con exit 0 -- i path veri, non i seam.
- [x] `packages/scripts/{package.json,tsconfig.json,README.md}`, `.github/workflows/ci.yml`, `penpot-pipeline.md`, le skill (3 copie) e `files-manifest.csv` -- nuovi path.
- [x] `scripts/check-boundaries.mjs` + `check-boundaries.d.mts` + `tests/check-boundaries.test.ts` -- specifier relativi risolti rispetto al file: rosso se escono dalla radice del package. Caso rosso (`../../apps/web/src/x`, `../../ui/src/y`) e caso verde (import relativo interno) su package finti in tmpdir -- chiude il buco del gate proprio mentre il riordino riscrive gli import.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md:90` -- nota aggiornata per `scripts` (canary presente, buco dei relativi chiuso); gli altri package restano come sono.

**Acceptance Criteria:**
- Given il riordino, when lancio `pnpm --filter @penpot-ds/scripts render:check`, then il diff è zero e l'output di `gates:render` è identico a quello di `develop`.
- Given `git log --follow` su un file spostato, when lo leggo, then la storia prima del riordino è visibile.
- Given `grep -rn "packages/scripts/src/\|src/library/\|src/recipes/\|src/emitter/b"` sui file vivi (esclusi gli story file chiusi e `deferred-work.md`), when lo lancio, then non resta nessun path vecchio.
- Given `diff -r` fra `skills/` e le copie in `.claude/skills` e `.agents/skills`, when lo lancio, then non ci sono differenze.

## Implementation Notes

- **Layout.**
  - `data/`: `penpot-catalog.json`, `recipes/` (con `judgments/`), `bindings/`, `bases/`, `designs/`, `library.snapshot.json`, `semantic-tokens.seed.json`.
  - `src/shared/`: `paths`, `naming` (`toKebab`, `pascalCase`), `mcp-client`, `theme-generator`, `style-properties`, `component-report`, `direct-invocation`.
  - `src/theme/`: `penpot-reader`, `token-vocabulary`, `new-catalog.test`.
  - `src/extract/`: `component-reader`, `recipe-schema`, `validate-recipe`, `variant-normalize`, `extract-component`.
  - `src/library/`: le CLI sono diventate moduli d'area, `library-command`, `adopt-command`, `bump-command`.
  - `src/emitter/`: `render-command`, `gates-runner`.
- **CLI.** Un entrypoint in `src/cli/` per ogni vecchio file CLI: `library.ts` (`bootstrap`/`add`/`verify`), `extract-component.ts` (`extract`/`validate`), `render-component.ts` (`render:component`/`render:check`), `gates-render.ts`, `adopt-variant.ts`, `bump-contract.ts`, `generate-theme.ts`. Gli argomenti dei comandi pnpm sono invariati.
  - I parser (`parseArgs`, `parseGatesArgs`, `parseAdoptArgs`, `parseBumpArgs`) restano nei file CLI e i test li importano da lì.
  - I vecchi `main(args, deps)` sono ora `runLibrary`, `runAdopt` e `runBump` nei moduli d'area; `runGatesCli(argv)` è ora `runGatesCommand(args)`.
  - `parseComponentArgs` resta in `library/bump-command.ts`, perché è condiviso da due CLI.
- **Guardia.** `generate-theme` ora ha la guardia (prima eseguiva `main` all'import). Il comportamento da invocazione diretta non cambia.
- **Rinomina in git.** Ogni spostamento è registrato come rinomina rispetto a `HEAD`. Similarità minima 61% (`direct-invocation`); i file CLI svuotati restano sopra il 65%.
- **Grep dell'AC.** `src/library/` resta una cartella di codice viva, quindi il pattern trova ancora riferimenti a `src/library/*.ts`: sono path nuovi, non vecchi. I path vecchi rimasti sono solo in `docs/legacy/` e nella spec chiusa `spec-penpot-mcp-token.md` (storia, non file vivi).
- **Verifica del diff (orchestratore, 2026-09-15).**
  - `tests/cli-smoke.test.ts` falliva per timeout: il primo processo `node --import tsx` parte a freddo (5,6 s contro i 5 s di default di vitest). Ora i due `describe` hanno `timeout: SMOKE_TIMEOUT` (90 s), lo stesso limite già dato al processo in `runCli`.
  - La skill `pds-component` citava ancora `src/style-properties.ts` (riga 76) e `designs/<kebab>.design.json` senza `data/` (riga 77). Corrette nelle 3 copie, con l'hash ricalcolato in `files-manifest.csv`.
  - `tsconfig.json` resta invariato: `src/**/*.ts` e `tests/**/*.ts` coprono ancora tutto il codice, e i dati non sono TypeScript.
  - Confronto col baseline `6162992` in un worktree (node_modules collegate; `contracts` e `tokens` invariati): `verify:library --snapshot` e `render:check` hanno output identico riga per riga, exit 0 in entrambi. `gates:render` exit 0; il suo output include la suite di `ui`, dove l'ordine degli avvisi jsdom "canvas" cambia da un run all'altro anche su `develop`.
  - Esito: scripts 585/585 senza skip, `check-types` e `lint` verdi, smoke 11/11.

## Spec Change Log

## Review Triage Log

- [edge-case-hunter] le basi shadcn `.tsx` spostate in `data/bases/` escono dalla scansione del gate (`check-boundaries.mjs:168` scansiona solo `src/`) — **medium**: nel baseline stavano in `src/emitter/bases/` ed erano scansionate (`SOURCE_EXTENSION` include `tsx`); una base con un import vietato passerebbe il lint e finirebbe copiata in `ui/domains`. La nota di design "il gate non guardava già le basi" è imprecisa (vale solo per il type-check). → patch
- [blind-hunter] `parseComponentArgs` sta in `library/bump-command.ts` e `cli/adopt-variant.ts` lo importa da lì — **low**: verificato (`cli/adopt-variant.ts:2`, `cli/bump-contract.ts:1`); il parsing dei CLI vive in un modulo di library, contro la regola "`src/cli/` fa il parsing". Correzione diretta: spostarlo in `src/cli/`. → patch
- [blind-hunter] preambolo di `pds-component` "Tutti i percorsi `src/…` sono relativi a `packages/scripts`" senza `data/…` — **low**: verificato (riga 31, 3 copie); un agente potrebbe risolvere `data/designs/…` dalla root. → patch
- [blind-hunter] mappa dei file del README incompleta — **low**: mancano `emitter/axis-influence.ts`, `library/designs-loader.ts`, `library-snapshot.ts`, `adopt-variant.ts`, `bump-contract.ts`. Correzione diretta. La riga `verify:library` senza `--json`/`--write-snapshot` è pre-esistente → scartata. → patch
- [blind-hunter + edge-case-hunter] `paths.test.ts` usa `/` fisso invece di `sep` — **low**: vero su Windows; la CI è Linux, correzione diretta di una riga. → patch
- [blind-hunter] voce nuova in `deferred-work.md` con `source_spec: none` — **low**: nasce da questa spec. Corretta dall'orchestratore. → patch
- [blind-hunter] l'aggiornamento di `ARCHITECTURE-SPINE.md` (decisione 2a) non è registrato fuori dalla spec — **low**: vero, si perde a spec chiusa. → defer (voce di promemoria)
- [verification-gap] lo smoke di `generate:theme` fallisce sul parsing prima di toccare `catalogPath`/`tokensSrcDir`: nessun test esegue il comando sui path di default — **medium** (filed evidence): chiuderlo richiede una modalità `--check` o un seam di output, cioè comportamento nuovo. → defer
- [blind-hunter] `generate-theme` non chiama `process.exit`, a differenza degli altri entrypoint — **low**: pre-esistente, identico nel baseline (`main().catch(... process.exitCode = 1)`). → defer
- [blind-hunter + edge-case-hunter] il check dei relativi è per riga: un `import(` con lo specifier a capo passa — **low**: vero, ma nessun file del package usa quella forma e la correzione riscrive il loop di scansione (logica nuova). → scartata
- [edge-case-hunter] falso rosso su un messaggio che contiene `from "../../x"` — **low**: vero ma fail-closed, stessa scelta accettata nel gate dei contratti. → scartata
- [blind-hunter + edge-case-hunter] nessun test impedisce che altri file tornino a calcolare path da `import.meta.url`/`new URL(` — **low**: oggi fuori da `paths.ts` restano solo le guardie `isDirectInvocation(import.meta.url)` e il test del gate; la correzione è un test nuovo. → scartata
- [blind-hunter] mancano casi di test per `export … from`, `require(...)` e `escapesPackageRoot` diretto — **low**: la regex li copre già (`from`, `require`); aggiungere casi è copertura in più, non un difetto. → scartata
- [blind-hunter] l'emitter importa ancora i loader da `extract/extract-component.ts` — **false**: il file non è più un CLI (l'entry è `cli/extract-component.ts`); il task 4 chiedeva le librerie fuori dai file CLI, ed è rispettato.
- [blind-hunter] `SMOKE_TIMEOUT` dichiarata dopo `runCli` — **false**: `runCli` viene chiamata solo dentro i test, dopo l'inizializzazione del modulo; nessuna temporal dead zone raggiungibile.
- [blind-hunter] lo smoke non esegue i path reali di `gates:render`, `bump:contract`, `adopt:variant` — **false**: `gates:render` gira in CI sui path veri, e `DEFAULT_PATHS` è letto da `adopt-command.test.ts` e `adopt-variant.test.ts`; resta solo `generate:theme` (voce sopra).
- [edge-case-hunter] i messaggi con i path cambiano (`src/recipes` → `data/recipes`) — **false**: eccezione ammessa esplicitamente dalla spec (Never, primo punto).
- [edge-case-hunter] la guardia unica fa uscire con 0 senza fare nulla se `argv[1]` non coincide — **low**: comportamento pre-esistente della guardia condivisa, già usata da tre CLI prima del riordino. → scartata
- [blind-hunter] contraddizioni interne della spec (dove stanno i parser, path della guardia, AC di `gates:render`) — **low**: la correzione è modificare questa spec. → scartata (regola: niente fix che editano la spec)
- [edge-case-hunter] il grep dell'AC trova anche i path nuovi validi (`src/library/`) — **low**: la correzione è riscrivere l'AC della spec. → scartata (stessa regola)

**Review — esito (2026-09-15):** nessun intent_gap né bad_spec, quindi nessun loopback. Le 5 patch sono state applicate dal subagent di implementazione:
- il gate scansiona anche `data/bases/` (73 file), con un caso rosso e un controllo sul conteggio del package reale;
- `parseComponentArgs` è in `src/cli/component-args.ts`, escluso dallo smoke come helper;
- il preambolo della skill nomina `data/…`, nelle 3 copie e con l'hash aggiornato;
- il README ha la mappa completa;
- `paths.test.ts` usa `sep`.

La voce `source_spec` è corretta dall'orchestratore; 3 defer in `deferred-work.md`. Verifica finale: turbo `test check-types lint --force` 23/23 (scripts 586 test, nessuno skip), `render:check` diff zero, `gates:render` exit 0 (drift SKIPPED senza token), `docker build --target runner` exit 0.

## Design Notes

**Perché i dati in `data/` e non in `src/data/`:** le skill e il designer puntano ai dati, non al codice. Una radice separata rende stabile quel riferimento anche se il codice si sposta di nuovo. Il gate dei confini e il type-check non guardavano già i JSON né le basi `.tsx`, quindi non si perde copertura.

**Guardia unica:** le tre copie inline senza `realpathSync` diventano quella condivisa. L'unica differenza di comportamento è che un entrypoint lanciato tramite symlink ora esegue `main` invece di non fare nulla. È un caso che nessun comando pnpm produce.

## Verification

**Commands:**
- `pnpm turbo run test check-types lint --force` (Node 22 via nvm, `pnpm db:start` per db e auth) -- expected: verde, scripts ≥ 549 test.
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: diff zero.
- `pnpm --filter @penpot-ds/scripts gates:render` -- expected: exit 0 (drift SKIPPED senza token Penpot).
- `docker build --target runner .` -- expected: exit 0.
