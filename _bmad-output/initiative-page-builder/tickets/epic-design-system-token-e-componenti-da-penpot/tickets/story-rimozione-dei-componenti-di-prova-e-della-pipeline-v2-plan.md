---
ticket: 18
title: 'Story 2.18 — Rimozione dei componenti di prova e della pipeline v2'
type: 'chore'
created: '2026-10-17'
status: 'done'
route: 'dispatch'
baseline_revision: '011d581400d7560c1d516098127cd1ae15f06d86'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-page-builder/archive-v6/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Dopo il correct-course v3 restano nel repo la pipeline v2 di `packages/scripts` (comandi `library`/`propose`/`extract`/`render`/`gates`, guscio CLI, contratti di estrazione, istantanee) e i cinque componenti di prova che ha generato (Badge, Input, Alert, AccordionItem, ProductCard), più le tre skill `pds-*` che li pilotano: artefatti senza proprietario che la v3 non usa.

**Approach:** Cancellare codice, dati, componenti, skill e il job `gates` in CI; tenere vivi `theme` (con un entrypoint minimo al posto del guscio), il registro delle proprietà, i contratti dell'editor, Storybook col suo smoke gate e l'editor; riallineare i test che presuppongono i componenti; chiudere le voci di registro legate alla v2.

## Boundaries & Constraints

**Always:** `packages/contracts` resta byte per byte (fingerprint e `SCHEMA_VERSION` invariati); `src/shared/style-properties.ts` (registro), `naming.ts`, `theme-generator.ts`, `mcp-client.ts`, `src/theme/*`, `data/penpot-catalog.json` restano; `pnpm --filter @penpot-ds/scripts theme [--live]` funziona come oggi (stesse uscite: 1 input, 2 penpot); `@penpot-ds/ui` `"."` continua a risolvere; `apps/web` e `ui/editor` compilano; CI verde.

**Never:** toccare il tema generato, `globals.css`, l'editor (`ui/src/editor/*`) oltre a quanto deciso sotto; introdurre codice v3 (nucleo, server MCP: Story 2.20+); riscrivere `check-boundaries.mjs` (Story 2.19); rimuovere `pds-setup`.

**Decisioni:**
- Entrypoint `theme`: `src/theme/main.ts` legge `--live` da `process.argv`, rifiuta argomenti ignoti, chiama `loadThemeCatalog` e poi `writeTheme` (così distingue exit 2 da exit 1), esce con il codice; via `commands/theme.ts` e `runTheme`, rimasto senza chiamanti (risposta del 2026-10-17 in review: in origine "chiama `runTheme`").
- `generated-classes.test.ts` si cancella: verificava gli `@generated` v2; il tema è coperto da `theme-in-css`/`tracer-tokens`, le classi del registro dal livello 4 della 2.20.
- Le voci di `deferred-work.md` ambigue (v1/v2 miste, `writeTheme`, `slots` nel fingerprint, storyName) restano aperte; si chiudono solo quelle che citano artefatti rimossi.
- Storybook (risposta A, 2026-10-17): story scritta a mano del dropdown dell'editor (Base UI) in `ui/src/editor/dropdown-menu.stories.tsx`, CSF3 con `args`; glob di Storybook e dello smoke gate estesi a `editor/**` e tenuti in parità; `main.test.ts` pinna ≥1 story invece di ≥4.
- Branch `story/2-17-skill-pds-sui-sei-comandi` (risposta A, 2026-10-17): cancellato con `git branch -D`, annotando lo SHA `6e9083c` nelle note.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| theme offline | `pnpm --filter @penpot-ds/scripts theme` | rigenera dalla fixture, exit 0, file identici a oggi | N/A |
| theme argomento ignoto | `theme --foo` | messaggio d'uso su stderr | exit 1 |
| theme live senza Penpot | `theme --live`, MCP irraggiungibile | messaggio d'errore | exit 2 |
| barrel vuoto | `import "@penpot-ds/ui"` | risolve, nessun export | N/A |

</frozen-after-approval>

## Code Map

- `packages/scripts/src` — REMOVE: `cli.ts`, `shell.ts`, `errors.ts`, `library-writer.ts`, `library-plan.ts`, `propose-diff.ts`, `registry.ts` (registro dei contratti di estrazione), `extraction.ts`, `components.ts`, `contracts/*.extract.ts`, `library/*`, `commands/*` (tutti, `theme.ts` incluso) e i rispettivi test, `shared/component-report.ts`(+test), `shared/direct-invocation.ts`. KEEP: `theme/*`, `shared/{style-properties,naming,theme-generator,mcp-client,paths}.ts`.
- `packages/scripts/src/shared/paths.ts` — togliere `componentsDir`, `semanticSeedPath` e i percorsi rimasti senza usi (`domainsRoot`, `fingerprintPath`, `uiPackageRoot`, `contractsSrcDir` se nessuno li legge); `tests/paths.test.ts` di conseguenza.
- `packages/scripts/tests/v2-boundary.test.ts` — oggi "solo `src/cli.ts` scrive `process.exit`": diventa `src/theme/main.ts` (o il file si rinomina se tratta solo la v2).
- `packages/scripts/data/components/*` (15 file), `data/semantic-tokens.seed.json` — REMOVE.
- `packages/scripts/package.json` — via script `library|propose|extract|render|gates`, `theme` → `src/theme/main.ts`; via dipendenze `@app/contracts`, `zod`, `@penpot-ds/tokens` se `tsc`/test confermano zero import; `description` aggiornata. Lockfile con `pnpm install`.
- `packages/scripts/README.md` — tenere tema, fixture catalogo, connessione Penpot; via righe 13–20 e 22–179 (v1/v2).
- `packages/ui/src/domains/{commerce,data-display,feedback,inputs,layout}/` — REMOVE tutto; `domains/index.ts` resta con `export {};` e commento.
- `packages/ui/src/styles/generated-classes.test.ts` — REMOVE (Decisioni).
- `packages/ui/src/stories.smoke.test.tsx`, `apps/storybook/.storybook/main.ts`, `main.test.ts`, `apps/storybook/tsconfig.json:8` — glob esteso a `editor/**` (Decisioni); i commenti "4 componenti generati" aggiornati. `ui/src/editor/dropdown-menu.tsx` e il suo test esistente sono la fonte per la story (props, uso di `Menu`).
- `.github/workflows/ci.yml:86-92` — step "Gates v2" via. `turbo.json:47-51` — task `gates:render`, `gates` via.
- Skill: `skills/`, `.claude/skills/`, `.agents/skills/` → via `pds-{bootstrap,additive,component}`; `.opencode/commands/pds-{bootstrap,additive,component}.md` via; righe PB/PA/PC/PS in `_bmad/module-help.csv`, `_bmad/pds/module-help.csv`, `{skills,.claude/skills,.agents/skills}/pds-setup/assets/module-help.csv`; `_bmad/_config/bmad-help.csv:39-42`, `skill-manifest.csv:57-59`, `files-manifest.csv:390-392` via e hash di riga 388 ricalcolato; `pds-setup/assets/module.yaml:3,7` (tre copie) senza i quattro codici.
- `_bmad-output/initiative-page-builder/deferred-work.md` — formato di chiusura come riga 259 ("Voci senza oggetto alla 2.16"); voci v2: 227, 261, 263–265, 270–274, 280–282, 286, 290–310, 342–347, 351–353.
- `_bmad-output/initiative-page-builder/archive-v6/sprint-change-proposal-2026-10-17.md:169-172` e `_bmad-output/spikes/penpot-ai-kit-2026-10-10/README.md:124-127` — bug 7–10: esito "sparito con la v2 (Story 2.18)" (bug 8: la parte 2.22 resta).
- Fuori perimetro: `packages/pds-engine` (non tracciato, solo `node_modules`): non si tocca, si annota.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/theme/main.ts` + test — entrypoint e casi della matrice (deps iniettate, niente Penpot) — sostituisce il guscio.
- [x] `packages/scripts/**` — rimozioni, `paths.ts`, test di confine, `package.json`, README — come da Code Map.
- [x] `packages/ui/src/domains/**`, `generated-classes.test.ts` — rimozioni, barrel vuoto.
- [x] `ui/src/editor/dropdown-menu.stories.tsx`, smoke gate, `main.ts`, `main.test.ts`, `tsconfig.json` — story del dropdown e glob estesi in parità.
- [x] `ci.yml`, `turbo.json` — via gates.
- [x] Skill, `module-help.csv`, manifest `_bmad/_config`, `.opencode` — rimozioni.
- [x] `deferred-work.md`, proposta 2026-10-17, README dello spike — chiusure; `sprint-status.yaml` — 2.18.
- [x] Branch `story/2-17-skill-pds-sui-sei-comandi` — `git branch -D`, SHA nelle note.

**Acceptance Criteria:**
- Given il branch, when cerco `ScriptError`, `runGatesV2`, `EXTRACTION_CONTRACTS`, `library-plan`, `Badge`/`ProductCard` in `packages/` e `apps/` (escluso `packages/contracts`), then zero risultati.
- Given il branch, when `git diff develop -- packages/contracts`, then vuoto.
- Given `pnpm turbo run check-types lint test --force` e `pnpm --filter storybook build`, then tutto verde.
- Given `ls .claude/skills .agents/skills skills`, then nessuna `pds-` tranne `pds-setup`, e nessun `module-help.csv` cita PB/PA/PC/PS.

## Implementation Notes

- Branch `story/2-17-skill-pds-sui-sei-comandi` cancellato con `git branch -D` (era `6e9083c`, solo locale).
- `src/theme/main.ts` chiama `loadThemeCatalog` + `writeTheme` (i due passi di `runTheme`) invece di `runTheme`: serve a distinguere la lettura live fallita (exit 2) dal catalogo che non genera (exit 1), come faceva il comando v2. `runTheme`, rimasto senza chiamanti, è cancellato (decisione confermata). L'invocazione diretta chiama `process.exit(code)` (un transport MCP appeso dopo un timeout terrebbe vivo il processo); smoke del processo vero in `main.test.ts`. Guardia d'invocazione diretta scritta inline, perché `direct-invocation.ts` è cancellato.
- `tests/v2-boundary.test.ts` rinominato `tests/pipeline-boundary.test.ts`: copre v1 e v2 (directory e guscio assenti) e pinna `process.exitCode` al solo `src/theme/main.ts`.
- `paths.ts`: restano `packageRoot`, `repoRoot`, `dataDir`, `catalogPath`, `tokensSrcDir`.
- `package.json`: via `@app/contracts`, `@penpot-ds/tokens`, `zod` (zero import dopo le rimozioni; `tsc` e test verdi); lockfile aggiornato.
- AC "zero `Badge`/`ProductCard`": rinominati anche i nomi d'esempio nei test vivi (`style-properties.test.ts` → `MediaCard`, `main.test.ts`), nei commenti di `naming.ts` e in `domains/index.ts`; `check-boundaries.test.ts` usa `./shared/paths` al posto di `./library-plan` come specifier estraneo (il `.mjs` non è toccato).
- `files-manifest.csv`: ricalcolato l'hash sia di riga 388 (`pds/pds-setup/assets/module-help.csv`) sia di 389 (`pds/module-help.csv`): avevano lo stesso hash e i due file restano identici dopo la rimozione delle righe PB/PA/PC/PS.
- `module.yaml` (tre copie): description e greeting riscritti senza i codici rimossi.
- `deferred-work.md`: le voci v2 elencate in Code Map sono sostituite da un'unica voce "Voci senza oggetto alla 2.18 — CHIUSE" nel register v2; le sezioni rimaste vuote (build/CR 2.13, CR 2.16, live-track 2.16) sono cancellate. La voce del manifest (CR 2.9) è chiusa annotando che il path di `pds-setup` si rivede con la 2.28.
- `packages/pds-engine` (non tracciato, solo `node_modules`): non toccato.
- Audit della matrice: la riga "barrel vuoto" non aveva test; aggiunto `packages/ui/src/domains/index.test.ts` (`import("@penpot-ds/ui")` risolve via `exports` e non esporta nulla). Le altre righe sono coperte da `src/theme/main.test.ts`.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|
| 1 | Entrypoint `theme` senza smoke di processo (cancellato con `cli.test.ts`) | medium | gap verificato: `main.test.ts` chiama solo `themeMain`; guardia, codice d'uscita e path dello script non sono eseguiti da nessun test | patch |
| 2 | `process.exitCode` invece di `process.exit`: `theme --live` può restare appeso dopo il timeout MCP | medium | `mcp-client.ts` `withTimeout` lascia `operation` pendente e il commento conta sull'uscita forzata; il guscio v2 chiamava `process.exit(code)` | patch |
| 3 | `main.ts` non chiama `runTheme`, che resta senza chiamanti | low | deviazione dalla decisione frozen; l'umano ha accettato i due passi e chiesto di togliere `runTheme` | decisione aggiornata; patch (cancellare `runTheme`) |
| 4 | Caso posizionale `["Extra"]` senza asserzione sul messaggio | low | solo `errors[1]` è controllato | patch |
| 5 | `--live` con catalogo che non genera non testato (exit 1, fixture intatta) | low | il README lo promette; nessun test | patch |
| 6 | Blocklist di `pipeline-boundary.test.ts` incompleta | low | moduli cancellati (`library-writer.ts`, `registry.ts`, `extraction.ts`, …, `data/components`) non controllati | patch |
| 7 | Voci chiuse ma ancora vive: `positionAbsolute`/`relative` al render, default `layoutAlign`/`zIndex` | medium | il registro resta; il bisogno passa al generatore v3 (2.22) e al collaudo (2.25), ma la chiusura lo perde | patch: tornano aperte con la story di destinazione |
| 8 | Voce manifest chiusa con il path di `pds-setup` ancora sbagliato | low | `skill-manifest.csv` punta a `_bmad/pds/pds-setup/SKILL.md`, inesistente | patch: voce aperta solo per `pds-setup` |
| 9 | "Voci che restano valide in v2" cita `src/cli.ts`/`cli.test.ts` cancellati | low | riga ~257 di `deferred-work.md` | patch |
| 10 | Commenti di `style-properties.ts` citano consumatori rimossi | low | righe 10, 124, 552, 577 | patch |
| 11 | Commento CI "oggi il dropdown dell'editor" invecchia | low | correzione diretta | patch |
| 12 | Chiavi duplicate nella story del dropdown | low | `key={item}` con etichette uguali dai controlli | patch |
| 13 | `generate:theme` ancora in `REGEN_COMMAND`, README e descrizione di `@penpot-ds/tokens` | low | pre-esistente (2.12/2.16); il tema generato è fuori perimetro | defer |
| 14 | Allowlist `@app/contracts` in `check-boundaries.mjs` dopo la rimozione della dipendenza | low | frozen Never: `check-boundaries.mjs` è della 2.19 | scartato (fuori perimetro per intento) |
| 15 | Test del barrel non tracciato, lockfile fuori dal diff | false | nessun commit ancora; il lockfile è escluso solo dal diff di review | scartato |
| 16 | Stato spec `in-review` vs sprint `in-progress` | false | la sincronizzazione avviene a fine workflow | scartato |
| 17 | `themeMain` scarta ogni `--` | low | innocuo; nessun uso reale | scartato |
| 18 | Log reali nei test rossi | low | solo rumore | scartato |
| 19 | Story `Chiuso` ridondante, niente `component` nel meta | low | render composito, `component` non è unico | scartato |
| 20 | Spec frozen in contraddizione col codice su `runTheme` (correggerla) | — | la correzione è un edit della spec | scartato (gestito come #3) |

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force` — verde (con `pnpm db:start` per i test db/auth).
- `pnpm --filter @penpot-ds/scripts theme && git status --porcelain packages/tokens` — exit 0, nessun file cambiato.
- `pnpm --filter storybook build` — verde.
- `pnpm --filter web build` — verde.
- `grep -rn "pds-bootstrap\|pds-additive\|pds-component" --exclude-dir=node_modules --exclude-dir=_bmad-output .` — solo riferimenti storici accettati.
