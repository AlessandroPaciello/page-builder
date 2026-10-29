---
ticket: 19
title: 'Story 2.19 — Fixture sul catalogo Tailwind e codice nuovo dentro i confini'
type: 'chore'
created: '2026-10-17'
status: 'done'
route: 'dispatch'
baseline_revision: 'ddb81c2a8208f1d59c930bea7d90736397c29052'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Riportando lo spike, 45 test di `scripts` diventavano rossi (bug 14): le fixture erano sul catalogo token vecchio e `src/v3/` stava fuori dai confini. Oggi `check-boundaries.mjs` conosce solo `src/` come blocco unico e non distingue nucleo, adattatore Penpot e server, le cartelle in cui la 2.20+ scriverà il codice nuovo.

**Approach:** Committare un catalogo token Tailwind scritto come dati, derivato dal seme dello spike e non letto da Penpot, e farlo leggere ai test di `scripts`. Estendere `check-boundaries.mjs` con le regole di `src/core`, `src/penpot` e `src/server` e con il divieto di `v3/`, ognuna con un test rosso/verde.

## Boundaries & Constraints

**Always:** CI verde; `pnpm --filter @penpot-ds/scripts theme` produce gli stessi file di oggi; le regole esistenti del gate (`@app/*`, `@penpot-ds/ui`, `apps/*`, relativi fuori dal package) restano invariate e verdi; il gate resta puro (`checkBoundaries` senza exit né console) e fail-closed.

**Never:** scrivere codice del nucleo, dell'adattatore o del server (2.20, 2.23, 2.24); copiare codice da `test-v3/`; salvare una lettura di Penpot; toccare `packages/contracts`, `packages/tokens`, `packages/ui`.

**Decisioni (mie, da confermare se riemergono):**
- `src/core` importa solo relativi interni a `src/core`, `@app/contracts` e `zod`. Il testo senza commenti non contiene `process`, `console` né `fetch`. Il registro entrerà in `core` con la 2.20.
- "Parlare con Penpot" vuol dire importare `@modelcontextprotocol/sdk/client*`: è ammesso solo in `src/penpot/**`. `shared/mcp-client.ts` (con il suo test) e `theme/penpot-reader.ts` si spostano in `src/penpot/`; `src/theme` li importa da lì fino alla 2.26.
- Il punto di iniezione è `src/server/main.ts`: è l'unico file di `src/server` che può importare da `src/penpot`.
- Nessuna cartella `v3` in `src/` (segmento di path): rosso.
- Le cartelle vuote non si creano: le regole si provano su package finti in tmpdir.
- Catalogo (risposta A, 2026-10-17): fixture nuova solo per i test, `tests/fixtures/tailwind-catalog.json`, con i set `tailwind` e `semantic` di `tailwind-to-penpot/tokens.json` nella forma `TokenCatalog`; `brand/ocean` resta fuori perché collide fino alla 2.26. `data/penpot-catalog.json` e il tema generato non cambiano fino alla 2.26.
- Altri gate (risposta A, 2026-10-17): `ui`, `domain`, `api` e `tokens` restano senza test propri, con una voce in `deferred-work.md`; l'azione della retro si chiude solo per `scripts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| nucleo pulito | `src/core/a.ts` importa `./b`, `@app/contracts`, `zod` | nessuna violazione | N/A |
| nucleo impuro | `src/core` importa `node:fs`, `@modelcontextprotocol/sdk/…`, `../shared/x`, oppure usa `process.`/`console.`/`fetch(` | violazione con file, riga e regola | exit 1 |
| client MCP fuori posto | `src/server/x.ts` o `src/shared/x.ts` importa `@modelcontextprotocol/sdk/client/index.js` | violazione | exit 1 |
| server → penpot | `src/server/tools.ts` importa `../penpot/read` | violazione | exit 1 |
| iniezione | `src/server/main.ts` importa `../penpot/read` | nessuna violazione | N/A |
| cartella v3 | `src/v3/cli.ts` | violazione | exit 1 |

</frozen-after-approval>

## Code Map

- `packages/scripts/scripts/check-boundaries.mjs`: gate a regex. `checkBoundaries({packageRoot})` restituisce `{violations, scanErrors, scannedFileCount}`. Si riusano `stripComments`, `RELATIVE_IMPORT`, `STRING_LITERAL`, `escapesPackageRoot` e la guardia `isDirectInvocation`. Va aggiornato il commento di testa (eccezione `@app/contracts`, basi v1 ormai inesistenti).
- `packages/scripts/scripts/check-boundaries.d.mts`: tipi del gate; `BoundaryViolation.reason` esiste già.
- `packages/scripts/tests/check-boundaries.test.ts`: helper `fakePackage` su tmpdir e `checkSource`. Il test "package reale verde" conta i `.ts` di `src`.
- `packages/scripts/src/shared/mcp-client.ts` e `mcp-client.test.ts` vanno in `src/penpot/`; `src/theme/penpot-reader.ts` va in `src/penpot/`. Gli importatori sono `theme/theme-command.ts`, `theme/main.ts` e i test: cercare `penpot-reader` e `mcp-client`.
- `packages/scripts/src/shared/theme-generator.test.ts`: oggi gira sulla fixture vecchia (`PATHS.catalogPath`), con un drift guard sui file committati che non va toccato. Ci va aggiunto il blocco sul catalogo Tailwind.
- `_bmad-output/spikes/penpot-ai-kit-2026-10-10/tailwind-to-penpot/tokens.json`: fonte dei set. `sets` è un oggetto `{nome: token[]}`, da convertire nella forma `TokenCatalog` (`{sets: [{name, tokens}]}`). Già verificato: `generateTheme` lo accetta (394 righe di CSS, `--color-primary: var(--color-neutral-900)`).
- `packages/scripts/README.md`: va annotato dove sta la fixture e da dove viene.
- `_bmad-output/implementation-artifacts/deferred-work.md`, `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-17.md:176`, `README.md:198` dello spike: bug 14 e punto 13 chiusi con "Story 2.19".

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/tests/check-boundaries.test.ts`: casi rosso/verde della matrice, scritti per primi e visti rossi.
- [x] `packages/scripts/scripts/check-boundaries.mjs` (+ `.d.mts`): regole core/penpot/server/v3, con `reason` che nomina la regola.
- [x] `packages/scripts/src/penpot/*`: spostamento di `mcp-client` (+test) e `penpot-reader`, import aggiornati.
- [x] `packages/scripts/tests/fixtures/tailwind-catalog.json` e il loader `tests/fixtures/catalog.ts`: catalogo dal seme (Decisioni).
- [x] `packages/scripts/src/shared/theme-generator.test.ts`: blocco "catalogo Tailwind", con set `tailwind`/`semantic` in ordine, ruoli shadcn che puntano alla palette, determinismo.
- [x] README, `deferred-work.md` (voce per gli altri gate), proposta e README dello spike: chiusure; `sprint-status.yaml`: 2.19.

**Acceptance Criteria:**
- Given il branch, when lancio `pnpm --filter @penpot-ds/scripts lint`, then il gate passa e il messaggio nomina le regole nuove.
- Given il branch, when faccio `find packages -type d -name v3 -not -path '*/node_modules/*'`, then nessun risultato.
- Given il branch, when cerco `@modelcontextprotocol/sdk/client` in `packages/scripts/src`, then compare solo sotto `src/penpot/`.
- Given `pnpm turbo run check-types lint test --force`, then tutto verde.

## Implementation Notes

- Il gate espone `BOUNDARY_RULES` (`core`, `penpot`, `server`, `v3`) e `isMcpClientSpecifier`; ogni violazione delle regole nuove ha `rule` e un `reason` che comincia con il testo della regola. Il CLI stampa le quattro regole nel messaggio di successo.
- Oltre alla matrice, in direzione chiusa: nel nucleo sono rossi anche `globalThis`, gli import dinamici/`require` con argomento non letterale e i relativi con `${`; il client MCP ha un backstop raw fuori da `src/penpot`; una cartella `v3` vuota e un import relativo verso una cartella `v3` sono rossi. Un literal che sembra un import dentro `src/core` può dare un falso rosso (dichiarato nel commento di testa).
- Il loader `tests/fixtures/catalog.ts` calcola il path della fixture da `import.meta.url`, come già fa `tests/check-boundaries.test.ts`: `PATHS` resta il modulo unico per i path di `src/`, e non conosce file dei test.
- `sprint-status.yaml` era già a `in-progress` per la 2.19; il passaggio a `review` resta al flusso di review.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|
| 1 | Guardia `${` sui relativi del nucleo senza test (VG) | low | gap verificato dal layer: togliendo la guardia nessun test fallisce | patch |
| 2 | Traversata `zod/..` nel nucleo senza test (VG) | low | `isForbiddenSpecifier` non copre `zod`; solo `traverses` la ferma | patch |
| 3 | Globali del nucleo incompleti: `global`, `eval`, `import.meta`, `Buffer`, `__dirname`/`__filename` (Blind, Edge) | medium | `import.meta.url` per calcolare un path è un uso plausibile che porta al disco; oggi è verde | patch |
| 4 | Falsi rossi su accessi a membro (`job.process()`) nel nucleo (Blind) | low | `\b(process…)\b` non distingue `x.process` dal globale; correzione diretta con lookbehind | patch |
| 5 | `src/server` raggiunge `src/penpot` tramite un re-export in `src/shared` (Blind, Edge) | medium | riprodotto dal layer; la 2.24 importerà helper da `shared` | patch: `src/shared` non importa `src/penpot` |
| 6 | Regola `penpot` presentata come garanzia di cartella, ma copre solo il client MCP (Blind) | low | `fetch` a `PENPOT_MCP_URL` fuori da `src/penpot` è verde; correzione della frase nel README | patch |
| 7 | Cartella `V3` maiuscola sfugge (Edge) | low | `segments.includes("v3")` è case-sensitive; correzione diretta | patch |
| 8 | Omissioni del seme (`skipped`, `clampedColors`) non documentate nel loader (Blind) | low | il docblock cita solo `brand/ocean`; correzione del commento | patch |
| 9 | Fixture JSON assente dal diff (Blind) | false | esclusa apposta dal diff di review (44 KB di dati); verificata identica ai set `tailwind`+`semantic` del seme; entra nel commit | scartato |
| 10 | Nessuno script né drift check fixture ↔ seme (Blind) | low | il seme vive in `_bmad-output`; un test lo legherebbe allo spike; il giro seme → CSS è il livello 4 della 2.26 | scartato |
| 11 | Specifier non relativi/self-reference e `v3/` alla radice del package (Blind) | low | improbabile; la fix allarga la scansione fuori da `src/` | scartato |
| 12 | Punto di iniezione solo `main.ts`, filtro `.tsx?` nel test reale (Blind) | low | il package è tutto `.ts`; un `main.mts` sarebbe rosso, cioè in direzione chiusa | scartato |
| 13 | Bug 14 dichiarato chiuso senza prova (Blind) | low | i test v2 rossi sono stati cancellati con la 2.18; il caso `src/v3/cli.ts` rosso è nei test del gate | scartato |
| 14 | `loadTailwindCatalog` valida poco (Blind) | low | la fixture è data committata e i test la usano subito; un token malformato fallirebbe nel generatore con messaggio | scartato |
| 15 | Riferimenti invecchiati in `deferred-work.md` e nel commento di `mcp-client.ts` (Blind) | false | la voce è storica (si annota solo la chiusura); il commento descrive il chiamante reale, `theme --live` | scartato |
| 16 | Directory symlink in `src/` che fa scansionare `server` sotto un alias (Edge) | low | improbabile; la fix aggiunge gestione dei realpath | scartato |
| 17 | Import dinamico/template in `src/server` verso `src/penpot` (Edge) | low | aggiramento deliberato; la fix aggiunge rami | scartato |
| 18 | Specifier del client MCP costruito per concatenazione (Edge) | low | aggiramento deliberato | scartato |
| 19 | `from` e specifier su righe diverse nel nucleo (Edge) | low | Prettier tiene `} from "x";` su una riga; limite già presente nelle regole di package | scartato |
| 20 | Specifier assoluti o `file:` verso `src/penpot`/`v3` (Edge) | low | improbabile; la fix aggiunge rami | scartato |
| 21 | Bypass `eval`/`Function`/`self`/`window` (Blind, Edge) | low | `eval` incluso nel #3; `Function`/`self`/`window` darebbero falsi rossi su tipi e nomi comuni | scartato (parte nel #3) |
| 22 | Stato della fixture non tracciata nel commit (VG, nota) | false | è un promemoria; il commit la include | scartato |

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force`: verde (con `pnpm db:start` per i test db/auth).
- `pnpm --filter @penpot-ds/scripts theme && git status --porcelain packages/tokens`: exit 0, nessun file cambiato.
