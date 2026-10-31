---
title: 'Confini di packages/scripts: node:crypto nel nucleo e gate sugli import veri'
type: 'refactor'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
baseline_commit: 'a937a4fb1e17b0990e0eb36be880b473b9a09464'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-19-fixture-sul-catalogo-tailwind-e-codice-nuovo-dentro-i-confini.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Il gate dei confini di `packages/scripts` (Story 2.19) cerca gli import con regex sui literal: ogni testo `from "<path>"`, anche in una stringa o un template, nel nucleo è un import, e ogni literal uguale a `apps` è un accesso vietato. Il codice si piega con trucchi (`FROM = ["fr","om"].join("")` in `generate.ts`, `["ap","ps"].join("")` in `generated-files.ts`) e il nucleo si porta uno SHA-256 scritto a mano perché `node:crypto` non è nella lista bianca.

**Approach:** Il gate estrae gli import veri con l'API del compilatore TypeScript; `node:crypto` entra nella lista bianca del nucleo e `hash.ts` usa `createHash`. I trucchi spariscono; il backstop sul testo grezzo resta.

## Boundaries & Constraints

**Always:**
- Regole delle cartelle invariate (`penpot`, `server`, `v3`, nomi vietati nel nucleo). Ogni regola nuova o cambiata ha un caso rosso/verde in `tests/check-boundaries.test.ts`.
- `FORBIDDEN_RAW` e `MCP_CLIENT_RAW` restano, sul testo senza commenti.
- `sha256Hex` esportata con la stessa firma e lo stesso output; niente `Buffer`.
- Output del generatore identico byte per byte: `tests/core/generate.test.ts` non si tocca.
- `pnpm turbo run check-types lint test --force` verde (con `pnpm db:start`).

**Never:**
- Altri `node:*` nel nucleo oltre a `node:crypto`.
- Nuove dipendenze npm.
- Toccare story file chiusi o `sprint-status.yaml` (la 2.24 è già `done`, il refactor A è mergiato in #67).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| crypto nel nucleo | `src/core/a.ts`: `import { createHash } from "node:crypto"` | verde | N/A |
| altro builtin | `src/core/a.ts`: `import … from "node:fs"`, `"crypto"`, `"node:crypto/x"` | rosso `core`, con riga | N/A |
| import nel testo | nel nucleo `` `import x from "node:fs"` `` o `"copia from 'x'"` | verde | N/A |
| import vero fuori lista | nel nucleo `import x from "lodash"`, `export * from`, `import("x")`, `require("x")`, `typeof import("x")`, `import x = require("x")` | rosso `core` | N/A |
| `apps` letterale | `const r = ["packages", "apps"]` fuori dal nucleo | verde | N/A |
| `apps/` nel testo | `"usa apps/web"`, `"@app/domain"` in una stringa | rosso via backstop raw | N/A |
| sintassi illeggibile | un sorgente che il parser non legge | `scanErrors` con il file | il CLI esce 1 |

**Decisioni (Alessandro, 2026-10-28):**
- **`node:crypto` nel nucleo.** Un hash è deterministico e non rompe la purezza; era escluso solo perché il gate è una lista bianca. Cambia la regola `core` della 2.19.
- **Il gate legge gli import veri.** Cambia il modo in cui la 2.19 riconosce un import: dichiarazioni, non testo. Chiude la voce di `deferred-work.md` (review 2.22) sul gate `core` e `from`.

</frozen-after-approval>

## Code Map

- `packages/scripts/scripts/check-boundaries.mjs` -- `IMPORT_SPECIFIER`, `RELATIVE_IMPORT`, `NON_LITERAL_LOAD` (regex, da sostituire con l'AST); `isCoreAllowedPackage` (lista bianca); `BOUNDARY_RULES.core` (testo nel CLI e nei `reason`); loop `STRING_LITERAL` + `isForbiddenSpecifier` in `checkBoundaries` (regola di package sui literal: è lui, non `FORBIDDEN_RAW`, a fare rosso il literal `"apps"`); commento di testa "Limiti dichiarati". Da tenere: `stripComments`, `FORBIDDEN_RAW`, `MCP_CLIENT_RAW`, il loop `STRING_LITERAL` + `isMcpClientSpecifier` della regola `penpot`, `CORE_FORBIDDEN_GLOBAL`.
- `packages/scripts/scripts/check-boundaries.d.mts` -- tipi dell'export; da aggiornare solo se cambia l'API pubblica.
- `packages/scripts/src/core/hash.ts:1-94` -- `K`, `utf8`, `rotr`, `sha256Hex` scritti a mano; doc di testa.
- `packages/scripts/src/core/generate.ts:47-50` -- `FROM` e `importLine`. Nota: con l'`importLine` attuale (`from ${JSON.stringify(…)}`) anche il vecchio gate era verde; `FROM` era rimasto da una forma precedente.
- `packages/scripts/src/server/generated-files.ts:14-18` -- `SCANNED_ROOTS` con `["ap","ps"].join("")` e il commento che lo motiva.
- `packages/scripts/tests/check-boundaries.test.ts` -- casi rossi/verdi. Il caso "lo specifier vietato in una stringa non-import è comunque rosso (fail-closed)" cerca `specifier === "@app/domain"`: dopo il cambio è rosso via backstop raw, senza `specifier`.
- `packages/scripts/tests/core/hash.test.ts` -- confronto con `node:crypto` (diventa tautologico); i test `@generated` usano `reference` e restano.
- `packages/scripts/README.md:90,94-103` -- "SHA-256 in TS puro" e tabella "Confini".
- `_bmad-output/implementation-artifacts/deferred-work.md:353-354` -- voce da chiudere.
- `typescript` è già devDependency di `@penpot-ds/scripts`; il CLI gira in `packages/scripts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/scripts/check-boundaries.mjs` -- estrarre con `ts.createSourceFile` (ScriptKind per estensione) gli specifier di import/export dichiarativi, `import x = require()`, `import()`, `require()` e `import("x")` di tipo, con la riga; argomento non letterale di `import()`/`require()` = rosso `core`. Usarli per regola di package (`isForbiddenSpecifier`, relativi fuori dal package) e per `core`, `v3`, `shared→penpot`, `server`. Errori di parse → `scanErrors`. Ammettere `node:crypto` esatto in `isCoreAllowedPackage` e `BOUNDARY_RULES.core`. Riscrivere il commento dei limiti -- il gate legge le dichiarazioni, il raw resta backstop.
- [x] `packages/scripts/tests/check-boundaries.test.ts` -- casi della matrice I/O; adattare il caso fail-closed `@app/domain` al backstop raw.
- [x] `packages/scripts/src/core/hash.ts` -- `createHash("sha256").update(text, "utf8").digest("hex")`; doc aggiornata.
- [x] `packages/scripts/tests/core/hash.test.ts` -- vettori noti: `""`, `"abc"`, un testo non ASCII (con emoji); test `@generated` invariati.
- [x] `packages/scripts/src/core/generate.ts` -- togliere `FROM` e il commento; `importLine` con `from` letterale.
- [x] `packages/scripts/src/server/generated-files.ts` -- `SCANNED_ROOTS = ["packages", "apps"]`, commento tolto.
- [x] `packages/scripts/README.md` -- hash con `node:crypto`; tabella "Confini" con `node:crypto` e la lettura degli import veri.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- chiudere la voce della review 2.22 con il riferimento a questa spec.

**Acceptance Criteria:**
- Given il package reale, when gira `node scripts/check-boundaries.mjs`, then esce 0 e il messaggio nomina `node:crypto` nella regola `core`.
- Given il generatore, when girano i test di `generate.test.ts` senza modifiche, then sono verdi.
- Given `src/` dopo il refactor, when si cerca `join("")` usato per comporre `from` o `apps`, then non c'è.

## Design Notes

**Parser.** API del compilatore TypeScript: è già nel repo, legge TS/TSX e JS con la stessa grammatica di `tsc`, e dà `require`, `import()` e gli import di tipo. Scartati `es-module-lexer` (dipendenza nuova, niente `require` né sintassi TS) e `acorn` (niente TS).

**Trucco `apps`.** Si toglie senza indebolire il gate: il literal `"apps"` era rosso per il loop su ogni literal, non per `FORBIDDEN_RAW`, che vuole `apps/`. Dopo il cambio un import vero di `apps` resta rosso, `apps/` in qualunque testo resta rosso via raw; un path composto a runtime era già fuori dalla portata di un gate statico (è ciò che il trucco dimostrava), e nel nucleo `import()`/`require()` non letterali restano rossi.

## Verification

**Commands:**
- `pnpm db:start && pnpm turbo run check-types lint test --force` (dalla root, Node 22) -- expected: tutto verde, numero di test di scripts non in calo oltre ai campioni tolti da `hash.test.ts`.
- `node packages/scripts/scripts/check-boundaries.mjs` -- expected: exit 0.

## Implementation Notes

- `extractImports` usa `sourceFile.parseDiagnostics` (non nell'API pubblica di TypeScript 6.0.3): se sparisse, ogni file diventa uno `scanError` (fail-closed).
- La regola `penpot` resta sui literal (`STRING_LITERAL` + `MCP_CLIENT_RAW`), come chiesto; il testo del backstop raw di package ora dice "backstop raw" invece di "scanner desincronizzato" (test adattato).
- Bug preesistente corretto nel CLI: `fail()` stampava `undefined` per gli `scanErrors` (hanno `path`, non `file`); emerso dal test "il CLI esce 1".
- Dopo la review: `x.require(…)` e `(require)(…)` contano come load; un template con interpolazioni va sia in `nonLiteralLoads` sia negli `imports` come testo (`../../ui/${x}`), così le regole di package e di cartella lo giudicano come faceva la regex.
- Prova rossa: i 12 casi nuovi/adattati falliscono con il gate del baseline.
- `@penpot-ds/scripts`: 474 test verdi (8 campioni tolti da `hash.test.ts`, 12 casi aggiunti al gate).

## Spec Change Log

## Review Triage Log

Review 1 (Blind, Edge Case, Verification Gap) — 2026-10-28.

| # | Fonte | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|---|
| 1 | Edge, Blind | `module.require("x")` / `(require)("x")` nel nucleo verde | medium | il vecchio `\brequire\s*\(` matchava `module.require(` (provato); `extractImports` guarda solo l'identificatore nudo | patch |
| 2 | Blind | `` import(`../../ui/${x}`) `` fuori dal nucleo verde | medium | il vecchio `RELATIVE_IMPORT` estraeva `../../ui/${x}` (provato) e `escapesPackageRoot` lo faceva rosso; ora va solo in `nonLiteralLoads`, letto solo nel nucleo | patch |
| 3 | Blind | `!specifier.includes("${")` è codice morto | low | vero con il diff attuale; torna vivo con la patch del #2 (stessa radice) | patch (#2) |
| 4 | VG, Blind | `SCRIPT_KIND` senza test: un `.tsx` con JSX non è mai parsato | low | nessun fixture `.tsx`/`.jsx` con JSX; il generatore scrive `.tsx` | patch (test) |
| 5 | Blind | `import type`, `export type … from`, `export { x } from` non testati come rossi | low | solo `export *` tra i rossi; `import type` solo nel caso verde | patch (test) |
| 6 | Edge | import assoluto o `file:` (`"/repo/apps/web/x"`) fuori dal package verde | medium | preesistente: il vecchio gate controllava solo `./`/`../` e `FORBIDDEN_RAW` esclude `apps/` dopo `/`; nel nucleo è già rosso | defer |
| 7 | Edge | `"@app/contracts/./x"` in una stringa non-import ora verde | false | non è un import; come import resta rosso (`isForbiddenSpecifier` sugli import veri) | rifiutato |
| 8 | Blind | `parseDiagnostics` è API privata | low | fallisce chiuso e il test sul package reale (`scanErrors: []`) lo vedrebbe all'upgrade; già nelle Implementation Notes | rifiutato |
| 9 | Blind | le violazioni del backstop raw hanno `line: "?"`, senza riga | low | vero, ma il backstop aveva già `"?"`; la correzione aggiunge codice per un caso raro (stringa con `@app/…` non import) | rifiutato |
| 10 | Blind | messaggio "scanner desincronizzato" della regola `penpot` incoerente con "backstop raw" | false | la regola `penpot` resta sui literal: lì il desync è ancora il caso descritto | rifiutato |
| 11 | Blind | `scanErrors` con path assoluto e riga nel `reason` | low | formato preesistente degli `scanErrors`; cosmetico | rifiutato |
| 12 | Blind | `CORE_FORBIDDEN_GLOBAL` ancora sul testo: `"console"` in una stringa del nucleo è rosso | false | regola invariata per intento; README e header la descrivono "nel testo senza commenti" | rifiutato |
| 13 | Blind | il nucleo non è più indipendente dall'ambiente (`node:crypto`) | false | decisione nel blocco frozen; nessun consumer impacchetta `src/core` fuori da Node (grep su `apps/` e `packages/`) | rifiutato |
| 14 | Blind | AC3 (niente `join("")`) senza guardia automatica; symlink nel test CLI | low / false | la guardia sarebbe un test ad hoc per un trucco tolto; il fixture è in `roots` e viene pulito, CI è Linux | rifiutato |
