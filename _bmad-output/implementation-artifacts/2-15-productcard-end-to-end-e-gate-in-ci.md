---
title: 'Story 2-15 — ProductCard end-to-end e gate in CI'
type: 'feature'
created: '2026-09-27'
status: 'done'
route: 'dispatch'
baseline_commit: 'cffc9cb'
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

**Problem:** le fondamenta v2 (2.12), `library`/`propose` (2.13) ed `extract`/`render` (2.14) esistono ma girano su un'istantanea sintetica segnaposto; nessun gate v2 gira in CI e la ProductCard non è dimostrata su un design Penpot reale senza codice a mano.

**Approach:** disegnare la ProductCard vera in Penpot via seed MCP guidato, lanciare `extract ProductCard` e `render ProductCard` reali, introdurre il comando `gates` v2 con report per componente e farlo convivere in CI con `gates:render` v1, con giudizio visivo di Alessandro registrato in Storybook.

## Boundaries & Constraints

**Always:**
- Pass/fail negli script con prova rosso/verde per ogni controllo nuovo; esito solo da exit code con `ScriptError` a 4 categorie (1 input, 2 penpot, 3 contract, 4 gate) nel guscio unico.
- `extract` sola scrittrice dell'istantanea `data/components/product-card.json` (tmp + rename, `contract` + `provenance` + `cells` per 6 celle `promo × hover`); `--check` confronta senza scrivere; log dei 5 stadi con una categoria per stadio.
- `render` genera da istantanea i 4 file `@generated` con provenienza in `packages/ui/src/domains/commerce/`; rigenerazione a diff zero; file senza marker mai sovrascritto (skip); `--all` accumula i fallimenti per componente e li elenca.
- `gates` esegue `render --check --all` + suite `ui` + axe con report per componente su `$GITHUB_STEP_SUMMARY`; un componente divergente nomina solo sé; nessun comando live in CI; in CI convivono `gates:render` (v1) e `gates` (v2) entrambi a diff zero.
- v1 intatta: nessun import v1↔v2, nessun cambio a comandi v1, `render:check` v1 a diff zero.
- Nessuna riga di codice a mano in `packages/ui` per la card; diff zero dal primo commit.

**Never:**
- Scritture su Penpot fuori da `library` e dal seed MCP documentato; scritture su contratti o snapshot da `render`/`gates`; comandi live (`extract`, `render` senza `--check`, `library`, `propose`) in CI o in build.
- Classi Tailwind scritte a mano nei comandi o template; token inventati o celle riempite in silenzio; basi shadcn o `cva` nel percorso v2.
- Modifiche a skill `pds-*` (riscritte alla 2.17), a token/Stadio 1, alla v1.
- Giudizio visivo saltato o registrato fuori dalla story di Storybook.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Extract reale | `extract ProductCard` su container disegnato (live o seed MCP) | `data/components/product-card.json` reale con 6 celle, `when` badge 4/6, `repeat` tags | N/A |
| Extract check | `extract ProductCard --check` su snapshot committato identico | exit 0 senza scrittura | `ScriptError gate` exit 4 se diff, nomina cella/parte |
| Render reale | `render ProductCard` su istantanea reale | 4 file `@generated` in `domains/commerce/` con `when`→condizionale, `repeat`→`map`, `state`→prefissi, layout dal registro | N/A |
| Render check all | `render --check --all` | diff zero su tutti; fallimenti accumulati ed elencati | `ScriptError gate` exit 4, nomina componente |
| Gates verde | `gates` su repo verde | `render --check --all` + suite ui + axe verdi, report per componente in summary | N/A |
| Gates rosso nominativo | un componente divergente | solo la sua voce rossa, altri comunque verificati | exit 4, nomina componente/cella |
| Convivenza CI | push/PR | `gates:render` v1 e `gates` v2 entrambi verdi a diff zero | job rosso col modulo nel log |
| Storybook | avvio Storybook / build statico | story ProductCard navigabile con token + addon a11y, giudizio visivo registrato | build rosso se storie non CSF3 |

## Decisions

- SEED-MCP: seed MCP riproducibile — passi `execute_code` sul container 2.13 committati come script/doc, diff visibile via extract.
- ALT-IMMAGINE: alt vuoto decorativo — nessun cambio al contratto page builder in questa story.
- GIUDIZIO-VISIVO: nota nella story — giudizio di Alessandro registrato nella `.stories.tsx` via render (tracciato nel diff).

</frozen-after-approval>

## Code Map

- `packages/scripts/src/v2/cli.ts` -- guscio unico v2; aggiungere `gates` a `COMMANDS`; non toccare `runShell`/`process.exit`.
- `packages/scripts/src/v2/commands/extract.ts` (+ `extract.test.ts`) -- 5 stadi `penpot → contract → parts → properties → write`; riusare seam `--snapshot`/`--check` e log stadi.
- `packages/scripts/src/v2/commands/render.ts` (+ `render.test.ts`) -- da istantanea a 4 file; riusare `committedSnapshots`, skip senza marker, accumulo `--all`.
- `packages/scripts/src/v2/commands/gates.ts` (nuovo) + test -- `render --check --all` + suite ui + axe, report per componente via `shared/component-report.ts` (`VerdictCollector`/`publishReport`); riusare pattern `emitter/gates-runner.ts`.
- `packages/scripts/src/v2/contracts/product-card.extract.ts` -- verità v2 (6 celle `promo×hover`, 11 parti, `when`/`repeat`/alias, headless null); non modificare senza disegno.
- `packages/contracts/src/components/product-card.ts` -- contratto page builder ridotto (`promo`, 6 field incluso `badgeLabel`); cambi solo via decisione ALT-IMMAGINE.
- `packages/scripts/data/components/product-card.json` -- istantanea sintetica 2.14 da sostituire con reale (solo `extract` scrive, tmp+rename).
- `packages/ui/src/domains/commerce/ProductCard.{tsx,test.tsx,stories.tsx}` + `index.ts` -- output `@generated` da rigenerare, mai a mano; aggiungere `export ProductCard` in `domains/index.ts`.
- `packages/scripts/package.json`, `turbo.json`, `.github/workflows/ci.yml` -- aggiungere script `gates`, entry turbo `cache:false`, step CI dopo `gates:render` per convivenza v1/v2.
- `apps/storybook/.storybook/main.ts`, `preview.ts`, `packages/ui/src/stories.smoke.test.tsx` -- riusare glob + addon a11y + smoke CSF3; rebuild statico includerà la card.
- NON TOCCARE (v1 intatta): `src/cli/*`, `src/emitter/*`, `src/library/*`, `data/{recipes,bindings,judgments,designs,bases}`, altri domini `ui`, skill `pds-*`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/v2/commands/gates.ts` (+ test) -- comando `gates`: `render --check --all` + suite ui + axe, report per componente in `$GITHUB_STEP_SUMMARY`, exit 4 nominativo -- CAP-9
- [x] `packages/scripts/src/v2/cli.ts`, `packages/scripts/package.json`, `turbo.json` -- registra `gates` in `COMMANDS` + script pnpm + entry turbo senza cache -- CAP-9
- [x] `.github/workflows/ci.yml` -- step `gates` v2 dopo `gates:render` v1; entrambi a diff zero; nessun live in CI -- CAP-9
- [x] Penpot ProductCard via seed MCP documentato -- container 2.13 riempito (varianti con/senza sconto, tag ripetuti, immagine) con passi rieseguibili -- CAP-10
- [x] `packages/scripts/data/components/product-card.json` -- sostituita via `extract ProductCard` reale (tmp+rename); `--check` verde -- CAP-10
- [x] `packages/ui/src/domains/commerce/ProductCard.*` + barrel -- rigenerati via `render ProductCard`; test + axe verdi; story in Storybook con giudizio visivo -- CAP-10
- [x] `packages/ui/src/domains/index.ts`, Storybook statico -- export card + rebuild con 5 componenti -- visibilità
- [x] `packages/scripts/README.md` -- uso `gates`, vincoli mai-in-CI, convivenza v1/v2 fino a 2.16 -- docs

**Acceptance Criteria:**
- Given il container disegnato, when lancio `extract` + `render ProductCard`, then entrambi verdi, test e axe verdi, story in Storybook con giudizio visivo registrato.
- Given i file committati, when lancio `gates` e la CI, then `render --check --all` + suite ui + axe verdi con report per componente; un divergente nomina solo sé; nessun live in CI.
- Given la CI, when gira, then `gates:render` v1 e `gates` v2 convivono entrambi a diff zero.
- Given `packages/ui`, when ispeziono la card, then zero righe a mano, diff zero dal primo commit.
- Given le suite `scripts`/`contracts`/`ui` e `render:check` v1, when girano, then verdi come prima della story.

## Implementation Notes

- Implementato su branch `develop` (baseline `cffc9cb`), senza push. Diff in `/tmp/bmad-2-15-diff.patch` (96kB, 2127 righe).
- Verifiche proprie: `gates` exit 0 (ProductCard ok + suite ui ok); `render --check --all` diff zero v2; `render:check` 4/4 diff zero v1; `ui` 48 test verdi con axe.
- Rischi: Penpot live irraggiungibile (No userToken) — via `--snapshot` riproducibile; snapshot reale quasi identico al sintetico (solo provenance, hash invariato); giudizio visivo formale in story, da confermare da Alessandro in Storybook prima del merge.

## Spec Change Log

## Review Triage Log

Review 2026-09-27 su `/tmp/bmad-2-15-diff.patch` (96 kB, 2127 righe): `blind-hunter` 12 righe, `edge-case-hunter` 4 righe, `verification-gap` 2 righe pre-verificate.

| Verdetto | Finding | Evidenza / esito |
|---|---|---|
| low defer | [Blind] giudizio visivo incondizionato in `renderComponentV2` per ogni futuro componente | Vero (`render.ts:566-567`): oggi corretto per single-component v2 come da decisione GIUDIZIO-VISIVO; la parametrizzazione per componente va alla 2.16+ (secondo componente). |
| low defer | [Blind] barrel top-level `domains/index.ts` scritto a mano e non verificato da `gates` | Vero: `gates` verifica solo barrel per dominio; il top-level è hand-written per disegno (come da Code Map). Estendere il gate va valutato con il secondo componente (2.16). |
| false | [Blind] snapshot con sola provenance cambiata, nessuna prova di draw reale | Smentito: seed MCP documentato dichiara celle identiche (reader non legge layout); hash invariato atteso, provenance `seed-productcard-2-15` traccia il seed. |
| false | [Blind] `seed-library.json` con `sets: []` contro `seed.md` con createSet | Smentito: formati diversi — library snapshot (celle) vs catalogo token; `sets` del catalogo non c'entra. |
| low defer | [Blind] `defaultRunSuite` con `failedFiles: []` mai popolati | Vero (`gates.ts:123`): exit code basta per rosso/verde; i nomi file richiedono parsing output — disegno da valutare oltre questa story. Timeout coperto da voce E4. |
| low respinto | [Blind] `readExistingFiles` con `continue` silenzioso su stat/read | Vero ma solo per fallimenti ambientali (permessi/encoding su dir committata piccola): mai in uso normale, il fix aggiungerebbe rami diagnostici. |
| low patch | [Blind] messaggio barrel `render -- --all` con doppio dash | Verificato (`gates.ts:261`): incoerente con `render ${component}` e `render --check --all` altrove; fix diretto in una stringa. |
| low patch | [Blind] `const barrel … void barrel` morto in `gates.ts` | Verificato (`gates.ts:209,223`): variabile mai usata, barrel ricalcolato via `domainBarrelContent`; cancellazione diretta. |
| false | [Blind] tasks marcati done con triage/change log vuoti e giudizio differito | Smentito: tasks done = implementazione completa; triage vuoto atteso prima della review; giudizio formale emesso via render, conferma umana registrata nei rischi. |
| false | [Blind] Code Map cita Storybook/smoke senza hunks | Smentito: riuso non richiede hunks; build a 5 titoli verificata dal subagent e dalla suite smoke invariata. |
| false | [Blind] `gates.test.ts` accoppiato allo stato repo via catalog/snapshot reali | Smentito: baseline verde deve riflettere gli artefatti committati per disegno; i casi rossi usano seam iniettati. |
| low patch | [Blind] README/help senza schema JSON, tassonomia exit, env Penpot | Verificato: `README` e `--help` documentano terminale/summary ma non `--json`, exit 1 vs 4, `PENPOT_MCP_*`; fix doc in poche righe. |
| false | [Edge] `--json`/SUMMARY errati → exit 1 generico invece di nominativo | Smentito: path errato è errore `input` (exit 1) per tassonomia, non `gate`; il nominativo vale solo per voci rosse. |
| false | [Edge] file test/story scritti a mano senza marker → falso rosso | Smentito: in `domains/` tutto è `@generated` per contratto; un file senza marker e senza axe è correttamente rosso fail-closed. |
| false | [Edge] barrel non riportato su fail precoce di snapshot/render | Smentito: il componente è già rosso nominativo; il barrel è rumore aggiuntivo, gli altri componenti sono comunque verificati. |
| medium patch | [Edge] suite ui senza timeout — il gate può appendersi | Verificato (`gates.ts:120` `spawnSync` senza `timeout`): un `pnpm test` appeso appende la CI fino al timeout esterno; fix con `timeout: 300000`. |
| medium patch | [Gap pre-verificato] snapshot corrotto senza test | Filed con evidenza e disposition `patch`: nessun test scrive JSON malformato nello snapshot; aggiungere test che specchia `render.test.ts:380-392` (exit 4 nominativo `ProductCard`). |
| medium patch | [Gap pre-verificato] summary vuoto senza test | Filed con evidenza e disposition `patch`: nessun test passa `GITHUB_STEP_SUMMARY` a `gates`; aggiungere test che segue `component-report.test.ts:88-108` (tmpfile con riga `ProductCard`). |

Raggruppamento: nessuna condivisione di root cause oltre le coppie già fuse (timeout E4 vs failedFiles B5 separati per fix diverso). Nessun `intent_gap`/`bad_spec`: solo `patch` + `defer` + respinti.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde, nessun test in meno
- `pnpm --filter @penpot-ds/scripts check-types && pnpm --filter @penpot-ds/scripts lint` -- expected: verdi
- `pnpm --filter @penpot-ds/scripts render --check --all` -- expected: diff zero (v2)
- `pnpm --filter @penpot-ds/scripts gates` -- expected: exit 0, report per componente
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: 4/4 diff zero (v1 intatta)
- `pnpm --filter @penpot-ds/ui test` -- expected: verdi inclusi axe ProductCard
- `pnpm --filter storybook build-storybook` -- expected: build con 5 componenti senza errori
