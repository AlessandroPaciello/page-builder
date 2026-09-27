---
title: 'Story 2.13 — library e propose — Penpot dal contratto di estrazione'
type: 'feature'
created: '2026-09-17'
status: 'done'
route: 'dispatch'
baseline_commit: '552c6928af27569f60d74617b71a2cac13c267cd'
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

**Problem:** le fondamenta v2 (Story 2.12) descrivono la ProductCard in due contratti ma nessun comando sa crearne il container in Penpot né leggere Penpot quando è avanti ai contratti. I comandi v1 (`adopt:variant`, `bump:contract`, `role:part`) lavorano su giudizio e binding e scrivono sui contratti: in v2 sono fuori modello.

**Approach:** due comandi v2 sul guscio (`library`, `propose`, CAP-6/CAP-7). `library add ProductCard` crea il VariantContainer dal contratto di estrazione con assi, 6 board e layer delle parti; rilanciato è idempotente e `--dry-run` non scrive. `propose <Comp>` legge Penpot e stampa il diff sui due contratti senza mai scrivere.

## Boundaries & Constraints

**Always:**
- Pass/fail negli script con prova rosso/verde per ogni controllo nuovo; esito solo da exit code.
- Guscio unico (`runShell`, `parseArgs`) e `ScriptError` con le quattro categorie: `input` 1, `penpot` 2, `contract` 3, `gate` 4. `process.exit*` solo in `src/v2/cli.ts`.
- Celle = cartesiano assi page builder (`promo` 3 valori) × assi di rendering (`hover` 2 valori) = 6 board; `when` governa la presenza (`badge`/`badgeLabel` solo in 4 celle), mai l'assenza come errore.
- Layer dal contratto di estrazione: default PascalCase della parte, override `layer` per gli alias (`Badge/Label`, `Tag/Label`); token legati su ogni proprietà di stile secondo il registro e il ruolo della parte.
- Plugin data `pagebuilder/contract = nome@versione` sul container, nome container come controllo incrociato.
- `propose` sola lettura: mai scritture su Penpot né sui contratti; diff nomina file e riga dei due contratti.
- v1 intatta e verde: nessun import v1→v2, nessun cambio di comportamento v1, `render:check` a diff zero.

**Never:**
- Scritture su Penpot fuori da `library`; scritture su file dei contratti o snapshot da `propose`.
- Comandi live in CI; `--snapshot` in scrittura live (vale solo come seam di lettura/test).
- Classi Tailwind scritte a mano nei comandi; token inventati o celle mancanti riempite in silenzio.
- Modifiche a `src/library`, `src/extract`, `src/emitter`, comandi v1, skill `pds-*` (riscritte alla 2.17).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add su library senza card | `library add ProductCard`, container assente | container `ProductCard` con plugin data, assi `promo`+`hover`, 6 board, layer delle 11 parti, token legati | N/A |
| Add idempotente | container già conforme | nessuna scrittura, esito 0, differenze segnalate se presenti | N/A |
| Dry-run | `library add ProductCard --dry-run` | stampa il piano, nessuna chiamata di scrittura | N/A |
| Bootstrap su library esistente | `library bootstrap`, set o container presenti | rifiuto con motivo, exit 1, nessuna scrittura | `ScriptError input` |
| Propose con asse avanti | Penpot ha valore d'asse assente dai contratti | diff stampato sui due contratti con file e riga, nessuna scrittura | N/A |
| Propose con parte/ruolo avanti | layer o parte in Penpot senza voce nei contratti | diff con parte, ruolo e file coinvolti, nessuna scrittura | N/A |
| Container assente | `propose ProductCard` senza container | nessun diff, errore nominativo | `ScriptError penpot`, exit 2 |
| Nome ignoto | `library add Foo` / `propose Foo` | errore che nomina il componente e i contratti v2 noti | `ScriptError input`, exit 1 |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/v2/extraction.ts` -- `defineExtraction`, `ExtractionContract`, `pluginData`, celle come cartesiano assi; unica fonte del piano library e del confronto propose.
- `packages/scripts/src/v2/contracts/product-card.extract.ts` -- i due contratti della card: `container ProductCard`, asse `hover`, 11 parti con `when`/`repeat`/alias; prima prova e fixture dei test.
- `packages/contracts/src/components/product-card.ts` -- contratto page builder: asse `promo`, 6 field; il diff propose lo cita per file e riga.
- `packages/scripts/src/v2/errors.ts`, `src/v2/shell.ts`, `src/v2/cli.ts` -- guscio e `ScriptError`; i due comandi si registrano in `COMMANDS`, pattern da `src/v2/commands/theme.ts`.
- `packages/scripts/src/shared/style-properties.ts` -- registro unico: `PART_ROLES`, `ROLE_PROPERTIES`, `roleAdmits`, regole di lettura/emissione per token, layout e position; decide quali token legare per parte.
- `packages/scripts/src/shared/mcp-client.ts` -- `resolveMcpEndpoint`, `callPenpotTool(execute_code)`, `parseExecuteCodeEnvelope`, URL mascherato; seam di scrittura per library.
- `packages/scripts/src/library/library-reader.ts` -- `readLibrarySnapshot({callTool})` con seam `callTool` per test offline; riuso per la lettura di propose e per la guardia di idempotenza di library.
- `packages/scripts/src/library/library-plan.ts`, `src/library/penpot-writer.ts`, `src/cli/library.ts` -- riferimento v1 del piano puro, writer e guardie `--dry-run`/`--snapshot`; da non toccare, solo da imitare il disegno (piano puro + writer + comando).
- `packages/scripts/src/v2/commands/theme.ts` -- modello di comando v2 con factory `*With(deps)` e seam DI; stessa forma per library e propose.
- `packages/scripts/package.json` -- script `library` e `propose` verso `src/v2/cli.ts`; `tests/v2-boundary.test.ts` fissa i confini.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/v2/commands/library.ts` (+ test) -- `library bootstrap|add <Comp> [--dry-run]` dal contratto di estrazione: piano puro (container, assi inclusi `state`, 6 celle, layer con alias, token da registro), scrittura solo via `callPenpotTool`, idempotenza con differenze segnalate, `bootstrap` rifiuta su library esistente e crea anche i set/token shadow-ring dal seed, `--dry-run` stampa senza scrivere -- CAP-6
- [x] `packages/scripts/src/v2/commands/propose.ts` (+ test) -- `propose <Comp>` sola lettura via `readLibrarySnapshot`: confronta assi, parti, ruoli e layer con i due contratti, stampa il diff con file e riga, mai scritture; sostituisce `adopt:variant`, `bump:contract`, `role:part` -- CAP-7
- [x] `packages/scripts/src/v2/cli.ts`, `packages/scripts/package.json` -- registra `library` e `propose` in `COMMANDS` con usage, aggiunge gli script pnpm -- guscio CAP-8
- [x] `packages/scripts/src/v2/commands/library.test.ts`, `propose.test.ts` -- prove rosso/verde per ogni riga della matrice usando il seam `callTool`/snapshot, categorie d'errore per scenario -- disciplina della story
- [x] `packages/scripts/README.md` -- sezione breve sui due comandi con esempi, vincoli live e mai in CI -- documentazione

**Acceptance Criteria:**
- Given una library senza la card, when lancio `library add ProductCard`, then esiste il container con plugin data, assi, 6 board e layer attesi con token legati.
- Given il container conforme, when rilancio `library add ProductCard`, then exit 0 senza scritture e con eventuali differenze segnalate.
- Given qualunque stato, when lancio con `--dry-run`, then nessuna scrittura su Penpot.
- Given `propose ProductCard` con Penpot avanti ai contratti, when gira, then stampa il diff sui due contratti nominando file e riga e non scrive nulla.
- Given `pnpm --filter @penpot-ds/scripts render:check` e suite `scripts`/`contracts`/`ui`, when girano, then verdi a diff zero come prima della story.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Review 2026-09-17 su `/tmp/bmad-2-13-review-1789680416.patch` (96.531 byte): `blind-hunter` 13 righe, `edge-case-hunter` 15 righe, `verification-gap` 5 righe pre-verificate. Nessun `intent_gap`/`bad_spec`: nessuna loopback, solo `patch` + un `defer`.

| Verdetto | Finding | Evidenza / esito |
|---|---|---|
| low | [Blind] commento `cli.ts` ancora elenca `library`/`propose` 2.13 come futuri | Verificato su `src/v2/cli.ts:7-12`: `COMMANDS` li registra ma il commento dice "entrano una story alla volta (… 2.13, … 2.14)". **Patch**: aggiornare il commento. |
| false | [Blind] nessun asse `state`, solo `promo`×`hover` | Smentito da `src/v2/contracts/product-card.extract.ts:20`: `hover` è `type: "state"`. |
| low | [Blind] `PRODUCT_CARD_TOKENS` hardcodati con fallback `?? {}` | Verificato (`library-plan.ts:76-161,217`): con un solo contratto in registry nessun danno oggi; secondo componente solo da 2.16+. Respinto: si parametrizza quando il registry cresce. |
| false | [Blind] `findContainers` con solo nome blocca `add` per sempre | Smentito da `planAdd` (`library-plan.ts:418-432`): a container trovato seguono le differenze (nome e plugin data compresi); controllo incrociato voluto dalla spec. |
| low | [Blind] niente rollback: errore a metà run lascia celle orfane | Verificato (writer per-operazione, come v1): run live una tantum preceduto da `--dry-run`; pulizia manuale accettabile. Respinto. |
| low | [Blind] `setTimeout(150)` senza commento | Verificato (`library-writer.ts:174`); identico nella v1 (`penpot-writer.ts:190`). **Patch**: commento che lo dichiara. |
| low | [Blind] `PAGE_BUILDER_REL`/`EXTRACTION_REL` hardcodati | Verificato (`propose-diff.ts:17-26`): scope di story a un componente; si parametrizza alla 2.16. Respinto. |
| medium | [Blind] `contractLines` con `includes("promo"/"hover")` cita righe fragili | Verificato (`propose-diff.ts:47-48`): un commento con quelle parole sposta la riga citata; la spec richiede file e riga. **Patch**: ancorare alle definizioni. |
| low | [Blind] `propose` fonde i container senza etichetta | Verificato (`propose.ts:72`): caso raro (`planAdd` segnala già i duplicati). **Patch**: prefisso col nome. |
| low | [Blind] helper di test duplicati, buchi (`variantProps` null e altri) | Verificato in parte: lo skip del null è voluto (istanza "Default", come v1). **Patch**: un test sul null, resto igiene rinviata. |
| false | [Blind] sezioni della spec vuote in `in-review` | Smentito: vuote per disegno (`Implementation Notes`, `Change Log`); `Verification` ha i comandi. |
| false | [Blind] nessun environment guard anti-CI | Smentito: l'enforcement è non avere job CI che li chiama (come v1); il comando non può conoscere il chiamante. |
| low | [Blind] seed castato senza validazione | Verificato (`commands/library.ts:50-57`): file committato, solo dev. **Patch**: controllo array con `ScriptError input`. |
| medium | [Edge] token della `root` mai confrontati | Verificato (`library-plan.ts:281,397-400`): la `root` esce dai layer e dal confronto token. **Patch**: includerla. |
| medium | [Edge] stili senza binding passano | Verificato: il diff confronta solo token legati; uno stile valorizzato senza token è invisibile. **Patch**: segnalarlo dove `style` è disponibile. |
| medium | [Edge] parentela errata non rilevata | Verificato: confronto per nomi, mai per catena `parent`. **Patch**: verificarla. |
| low | [Edge] layer duplicati collassano nel `Set` | Verificato (`library-plan.ts:270-274,288-296`). **Patch**: segnalare i duplicati. |
| medium | [Edge] `propose` non confronta i valori dei token | Verificato (`propose-diff.ts:176-188`): solo `roleAdmits`, mai uguaglianza coi token attesi. **Patch**: confrontarli. |
| low | [Edge] prop d'asse extra ignorate nella chiave | Verificato (`library-plan.ts:190-192,363-366`): `set` sovrascrive in silenzio. **Patch**: segnalarle. |
| medium | [Edge] `variantError` ignorato | Verificato: nessun controllo in `diffContainer` né in `diffPropose`; concetto v1 esistente. **Patch**: differenza nominativa. |
| low | [Edge] ordine parti figlio-prima-padre | Verificato: writer assume genitori primi; il contratto 2.13 è ordinato. Respinto: nessun danno corrente. |
| medium | [Edge] `c.isVariantContainer()` senza guardia | Verificato (`library-writer.ts:202`) contro v1 (`bump-contract.ts:87`, `library-reader.ts:100` con `typeof` guard). **Patch**: stessa guardia. |
| maybe-false | [Edge] delay 150ms insufficiente | Non decidibile senza run live; speculare contro il precedente v1. **Defer**: si osserva il live `add`; se flakya si passa a poll. |
| low | [Edge] seed senza array | Come riga Blind sul seed. **Patch**. |
| low | [Edge] parti ignote senza token | Come riga sui token hardcodati. Respinto. |
| false | [Edge] nome senza plugin data | Come riga `findContainers`. |
| medium | [Edge] righe fragili | Come riga `contractLines`. **Patch**. |
| low | [Edge] retry bloccato a metà run | Come riga rollback. Respinto. |
| medium | [Gap] scrittura `library` senza test sul `penpot` exit 2 | Pre-verificato: `safeWrite` mai esercitato in rifiuto. **Patch**: test con `writeCode` che rifiuta (add e bootstrap). |
| medium | [Gap] codice `execute_code` mai compilato nei test | Pre-verificato, con precedente v1 (`penpot-writer.test.ts:86-90`). **Patch**: test `AsyncFunction` sugli step. |
| medium | [Gap] entry reale mai coperta | Pre-verificato: `cli.test.ts` ignora `COMMANDS` reali. **Patch**: smoke `library --help` / `propose --help` sull'entry. |
| medium | [Gap] direzione Penpot-indietro senza test | Pre-verificato: solo rami avanti coperti. **Patch**: caso con layer/valore mancante. |
| medium | [Gap] `bootstrap` live mai eseguito nei test | Pre-verificato: solo rifiuti e dry-run. **Patch**: caso live su snapshot vuoto con conteggio scritture. |

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde, nessun test in meno
- `pnpm --filter @penpot-ds/scripts check-types && pnpm --filter @penpot-ds/scripts lint` -- expected: verdi
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: 4/4 diff zero (v1 intatta)
- `pnpm --filter @penpot-ds/scripts verify:library -- --snapshot data/library.snapshot.json` -- expected: exit 0 invariato
- `node --import tsx packages/scripts/src/v2/cli.ts library --help` -- expected: uso con `bootstrap|add`, senza scritture

### Review Findings (code review 2026-09-27, full, diff 552c692..9bf74ea, 15 file, 2380 righe)

- [x] [Review][Patch] Seed validation incompleta — loadSeed valida solo array palette/semantic, non shape entries; seed iniettato bypassa [packages/scripts/src/v2/commands/library.ts:50-64]
- [x] [Review][Patch] Error nudo rompe ScriptError — planBootstrap e ramo add lanciano Error invece di ScriptError [packages/scripts/src/v2/library-plan.ts:549-556]
- [x] [Review][Patch] Token hardcoded con fallback silenzioso — PRODUCT_CARD_TOKENS + ?? {} senza registro, parte ignota = zero token [packages/scripts/src/v2/library-plan.ts:76-217]
- [x] [Review][Patch] propose hardcoded a ProductCard — REL/abs/contractLines fissi, secondo componente cita file sbagliati [packages/scripts/src/v2/propose-diff.ts:17-26]
- [x] [Review][Patch] propose sottoinsieme di diffContainer — mancano extra-prop, parentela, style senza binding, duplicati [packages/scripts/src/v2/propose-diff.ts:144-221]
- [x] [Review][Patch] diffContainer rami fini senza test — variantError, extra, duplicati, parent, root, style non fissati [packages/scripts/src/v2/library-plan.ts:297-493]
- [x] [Review][Patch] diffPropose valori token senza test — confronto valori mai mosso in-ruolo [packages/scripts/src/v2/propose-diff.ts:204-221]
- [x] [Review][Patch] execute_code solo sintassi — AsyncFunction non ispeziona markers runtime/dati [packages/scripts/src/v2/library-writer.ts:70-235]
- [x] [Review][Patch] Alias kebab mai esercitato — product-card senza prova [packages/scripts/src/v2/registry.ts:26-30]
- [x] [Review][Patch] Dry-run diverge dal piano — usa expectedCells invece di plan.operations[0].cells [packages/scripts/src/v2/commands/library.ts:189-196]
- [x] [Review][Patch] Ordine parti fragile — Object.entries senza topo-sort, writer assume genitori primi [packages/scripts/src/v2/library-plan.ts:213-228]
- [x] [Review][Patch] findLine fallback :1 silenzioso — file illeggibile/regex miss cita riga fuorviante [packages/scripts/src/v2/propose-diff.ts:28-36]
- [x] [Review][Patch] sameTokens duplicato — due definizioni library-plan/propose-diff possono divergere [packages/scripts/src/v2/library-plan.ts:284-290]
- [x] [Review][Patch] Prefisso multi-container ambiguo — solo [name], duplicati omonimi indistinguibili [packages/scripts/src/v2/commands/propose.ts:72]
- [x] [Review][Patch] README incoerente — -- separator/--help/exit codes non spiegati [packages/scripts/README.md:36-38]
- [x] [Review][Patch] RegExp parti non escapata — partLines senza escapeRegExp [packages/scripts/src/v2/propose-diff.ts:52-55]
- [x] [Review][Patch] Writer senza guardie null — createBoard/mainInstance non controllati (createText sì) [packages/scripts/src/v2/library-writer.ts:78-209]
- [x] [Review][Patch] Celle duplicate collassano — actualByKey.set sovrascrive senza segnale [packages/scripts/src/v2/library-plan.ts:369]
- [x] [Review][Defer] Live runtime incerto — delay 150ms e const top-level senza IIFE [packages/scripts/src/v2/library-writer.ts:174-175] — deferred: non decidibile senza run live; si osserva il live add, se flakya si passa a poll/IIFE

Rejected:
- false: add idempotente senza repair — by design, AC richiede exit 0 + differenze segnalate, additiva non corregge.
- low rejected: rollback mid-run — run una tantum + dry-run, pulizia manuale accettabile, fix complesso.
- low rejected: overlap secondo container (x/step hardcoded) — singolo componente oggi, offset per-container a 2.16+, fix aggiunge params.
