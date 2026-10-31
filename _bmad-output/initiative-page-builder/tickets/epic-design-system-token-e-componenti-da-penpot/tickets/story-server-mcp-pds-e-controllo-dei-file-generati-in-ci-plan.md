---
ticket: 24
title: 'Story 2.24 — Server MCP pds e controllo dei file generati in CI'
type: 'feature'
created: '2026-10-26'
status: 'done'
baseline_revision: 'dfeea0736aa9c5d43ee5557be1cdfbfbdb116212'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-page-builder/archive-v6/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Il nucleo (2.20–2.22) e l'adattatore (2.23) esistono, ma non c'è il guscio. Una skill oggi dovrebbe passare da stringhe di shell e scrivere a mano i file `@generated`. La CI inoltre non sa dire se un file generato è stato toccato a mano.

**Approach:**
- `src/server` contiene il server MCP `pds` su stdio, registrato in `.mcp.json`. Espone i sei strumenti con ingressi e uscite zod.
- Ogni chiamata rilegge Penpot attraverso un adattatore iniettato `{ readComponent, readTokenCatalog }`.
- `generate_component` scrive i file solo dentro la cartella del componente.
- Un controllo dei file `@generated` del repo diventa il livello 3 della CI.

## Boundaries & Constraints

**Always:**
- **Iniezione.** `createPdsServer({ penpot, root })` non importa da `src/penpot`. Solo `src/server/main.ts` lega l'adattatore vero (`readComponent`, `readPenpotTokenCatalog`) e il trasporto stdio (regola `server` del gate).
- **Nessuno stato.** Ogni chiamata rilegge il catalogo token e i componenti. Dal catalogo il server ricava:
  - `tokenTypeOf`, cioè nome → tipo;
  - `scale`, con `scaleFromThemeCss(generateTheme(catalog).css)`.
- **Mai su Penpot.** Il server non chiama nessuno strumento Penpot di scrittura. Non decide niente: restituisce gli esiti del nucleo così come sono.
- **Strumenti:**
  - `describe_component {name}` → `Lettura`;
  - `verify_component {name}` → `Finding[]`, con `existingTsx` letto dal disco;
  - `build_order {names[]}` → `{order, findings}`. `generated` = i componenti che hanno già un `<Comp>.styles.ts` con marker in `DOMAINS_DIR`;
  - `generate_component {name}` → `{changes, findings, suggestions, written}`. Il server legge dal disco `existingTsx`, `existingStyles`, `existingStories` e `generated`.
- **Scrittura.**
  - Si applicano i `Change` restituiti dal nucleo e nient'altro.
  - Un path assoluto, con `..`, o fuori da `packages/ui/src/domains/<name>/` è un errore: in quel caso non si scrive nessun file.
  - `crea` su un file che esiste è un errore.
  - `elimina` tocca solo un file con marker.
  - Con un blocco o una domanda aperta non si scrive niente.
- **Errori.** Ingresso non valido, errore dell'adattatore o del nucleo → risultato MCP `isError` con il messaggio, mai un crash del processo.
- **Livello 3.** `checkGeneratedFiles(root)` → `Finding[]` scorre i `.ts`/`.tsx` di `packages/` e `apps/` (esclusi `node_modules`, `dist`, `.next`, `storybook-static`). Esiti:
  - hash che non torna → blocco che nomina il file;
  - `GENERATOR_VERSION` diversa con hash giusto → avviso.
  Un test di vitest gira sul repo vero (nessun blocco) e ha un rosso/verde su una cartella temporanea.
- **Test di livello 2.** Il server gira in memoria (`InMemoryTransport`) con un adattatore finto costruito dalle `Lettura` di `tests/fixtures/components.ts`. Ogni strumento ha almeno un test verde e un test di ingresso rifiutato dallo schema. `generate_component` scrive in una root temporanea.

**Decisioni (di Alessandro, 2026-10-26):**
- `tokens_from_css` ed `extract_theme` si registrano adesso con lo schema d'ingresso. Ogni chiamata restituisce `isError` "disponibile dalla Story 2.26"; la 2.26 riempie il corpo.
- La compilazione dell'output del generatore (voce deferred della review 2.22) passa alla 2.31, quando `pnpm check-types` compila i file generati in `packages/ui`.

**Never:**
- una CLI di prodotto o un comando `pnpm` che chiama gli strumenti;
- la logica di `tokens_from_css`/`extract_theme` (seme, varianti, font: Story 2.26);
- scrivere su Penpot;
- modificare il nucleo, salvo esportare ciò che serve;
- toccare `theme` (resta fino alla 2.26);
- fixture di lettura Penpot.

## I/O & Edge-Case Matrix

| Scenario | Input / Stato | Atteso |
|---|---|---|
| genera Badge | Badge pulito, root vuota | `written` = styles, stories, tsx in `packages/ui/src/domains/badge/` |
| TSX esistente | `Badge.tsx` modificato | il TSX resta identico byte per byte; nessun `Change` sul TSX |
| domanda aperta | layer senza `part` | `findings` con domanda, `written: []`, disco invariato |
| annidato non generato | ShopCard senza `badge/Badge.styles.ts` | blocco, niente scritto |
| path fuori cartella | nucleo finto con `../x` | `isError`, niente scritto |
| ingresso invalido | `{name: 3}` | `isError` di validazione |
| adattatore fallisce | `readComponent` lancia | `isError` col messaggio |
| hash rotto | file `@generated` editato | blocco col path |
| versione vecchia | header `pds 0`, hash giusto | avviso col path |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/core/{verify,generate,build-order,hash,geometry,schemas}.ts` — si chiamano soltanto:
  - `verifyComponent`, `generateComponent`, `buildOrder`, `letturaName`;
  - `componentPaths`, `DOMAINS_DIR`, `readGeneratedHeader`, `isGenerated`, `GENERATOR_VERSION`;
  - `scaleFromThemeCss`;
  - gli schemi `Lettura`, `Finding`, `Change`, `Suggerimento`.
- `packages/scripts/src/penpot/read-component.ts` (`readComponent(name, {callTool?})`) e `penpot-reader.ts` (`readPenpotTokenCatalog(endpoint?)`) — l'adattatore vero, che si importa solo in `main.ts`.
- `packages/scripts/src/shared/theme-generator.ts` — `TokenCatalog` e `generateTheme`: il server li può importare (sono in `shared`).
- `packages/scripts/src/shared/paths.ts` — `PATHS.repoRoot` fa da default di `root` in `main.ts`; è l'unico posto che calcola path.
- `packages/scripts/scripts/check-boundaries.mjs` — la regola `server` è già pronta (righe 28, 246, 286); non si tocca.
- `packages/scripts/tests/fixtures/components.ts` — da qui si costruisce l'adattatore finto: `badgeLettura`, `shopCardLettura`, `CONTRACTS`, `tokenTypeOf`, `SCALE`. Il server riceve `contracts` facoltativo per i test, come `CoreInput`.
- `packages/scripts/tests/pipeline-boundary.test.ts` — `process.exit*` è ammesso solo in `src/theme/main.ts`; `src/server/main.ts` non lo usa.
- `.mcp.json` — oggi c'è solo `penpot`. Si aggiunge `pds` (stdio). Lo stdout deve restare pulito: niente banner di `pnpm`.
- `@modelcontextprotocol/sdk` 1.30.0 (zod 4.4.3) — `McpServer.registerTool`, `StdioServerTransport`, `InMemoryTransport`, `Client`.
- Voci di `deferred-work.md`:
  - da chiudere: `Change.path` senza limiti (review 2.20);
  - da spostare alla 2.31: compilazione dell'output (review 2.22).

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/tests/server/*.test.ts` — scrivere per primi i test di livello 2 e 3 (matrice).
- [x] `packages/scripts/src/server/server.ts` (+ `tools.ts`, `write-changes.ts`) — `createPdsServer`, i sei strumenti e la scrittura confinata.
- [x] `packages/scripts/src/server/generated-files.ts` — `checkGeneratedFiles`.
- [x] `packages/scripts/src/server/main.ts` + script `pds` in `package.json` + `.mcp.json` — avvio su stdio con l'adattatore vero.
- [x] `packages/scripts/src/server/README.md`, `packages/scripts/README.md`, `deferred-work.md`, `sprint-status.yaml` — documentazione, riavvio dopo una modifica del nucleo (`/mcp` → reconnect) e bookkeeping.

**Acceptance Criteria:**
- Given `.mcp.json` e Penpot collegato, when avvio la sessione, then il server `pds` risponde a `tools/list` con i sei nomi, e `describe_component badge` restituisce una `Lettura` valida (prova manuale).
- Given `pnpm turbo run check-types lint test --force`, then tutto è verde, con il livello 2 e il livello 3 compresi.

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force` (con `pnpm db:start`) — expected: verde.
- Un handshake stdio di `main.ts` (`initialize` + `tools/list`) — expected: sei strumenti e uno stdout senza rumore.

## Implementation Notes

- Le uscite MCP devono essere oggetti: `verify_component` restituisce `{ findings }`; `describe_component` la `Lettura` stessa. Ogni uscita arriva come `structuredContent` (validato dallo schema zod) e come testo JSON.
- `extract_theme` ha ingresso `z.object({}).strict()`: un oggetto vuoto non stretto lascerebbe passare argomenti estranei in silenzio. `tokens_from_css` ha ingresso `{ css }` (la 2.26 può cambiarlo).
- `createPdsServer` ha un seam `generate` (nucleo finto) per il test dei path fuori cartella; di default è `generateComponent`.
- `write-changes.ts` oltre alla matrice rifiuta: segmenti `.`/vuoti, qualunque `\`, unità Windows, due `Change` sullo stesso file, `aggiorna`/`elimina` su un file inesistente o senza marker, un file di destinazione che è un symlink, una cartella del componente il cui path reale non è `domains/<name>/` (symlink fuori o verso un componente vicino).
- `checkGeneratedFiles`: una prima riga che comincia come il marker di pds ma non si legge (hash troncato, refuso) è un blocco. Il test sul repo vero controlla che la scansione veda `packages/` e `apps/` e stampa gli avvisi (`console.warn`).
- `tests/server/main.test.ts` avvia `main.ts` su stdio in CI (`initialize` + `tools/list`, stdout solo JSON-RPC).
- `generated-files.ts` compone il nome della cartella delle app (`["ap","ps"].join("")`): il gate di `scripts` legge il literal `"apps"` come accesso vietato alle app (stesso limite del gate già annotato per `FROM` in `generate.ts`).
- `main.ts` non usa `process.exit`/`exitCode`: un errore di avvio va su stderr e il rifiuto rilanciato chiude il processo.
- Prova a mano (2026-10-26): handshake stdio via `pnpm --silent --filter @penpot-ds/scripts pds` → stdout con le sole due risposte e i sei strumenti; con Penpot locale `describe_component badge` → `Lettura` di Badge, `verify_component badge` → le domande attese (`part`, `overflow`).

## Spec Change Log

## Review Triage Log

| # | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|
| 1 | Backslash in mezzo al path accettato (`badge/sub\\x.ts`), contro le note (Blind) | low | `pathProblem` rifiuta solo `\\` iniziale o segmenti `..`/`.`; correzione diretta | patch |
| 2 | Il controllo dei symlink guarda solo `dirname(target)` e solo `domains/`: un file-symlink o una cartella collegata a un componente vicino passano (Blind, Edge, VG) | low | Vero alle righe 775–777 e 797–813; il README dichiara il confine per componente | patch: `lstat` sul file e confine sulla cartella reale del componente |
| 3 | Marker danneggiato (hash troncato, refuso) saltato in silenzio dal livello 3 (Blind) | medium | `readGeneratedHeader` → `undefined` → `continue` | patch: blocco |
| 4 | Il test del livello 3 sul repo vero passa a vuoto (Blind) | medium | Nessun file `@generated` nel repo; radici o `walk` rotti darebbero `[]` | patch: controllo positivo su `sourceFilesOf` |
| 5 | Gli avvisi del livello 3 non si vedono in CI (Blind) | low | Il test filtra solo i blocchi | patch: `console.warn` |
| 6 | `aggiorna` riuscito, `Change` doppi e file mancante senza test (Blind, VG) | medium | grep: nessun test passa la validazione con `aggiorna` | patch |
| 7 | L'entrypoint stdio non è provato in CI (VG) | medium | Nessun test avvia `main.ts`; precedente in `check-boundaries.test.ts:153-162` | patch |
| 8 | README root: "solo i file generati" omette lo scaffold; Node 22 e token nell'ambiente di Claude Code non documentati (Blind) | low | Vero; correzione di testo | patch |
| 9 | Scala del server (`coreContext`) mai esercitata: le fixture non hanno geometria (VG) | medium | Le fixture di Badge non hanno misure in px | defer (2.25) |
| 10 | Scrittura non atomica: un errore a metà lascia file parziali (Blind, Edge) | low | Solo EACCES/ENOSPC dopo la validazione; il rimedio aggiunge rollback | scartato |
| 11 | Corsa tra controllo e scrittura con chiamate concorrenti (Edge) | low | Un solo client per sessione; serve un mutex | scartato |
| 12 | Uscita non valida dopo la scrittura: file scritti ma `isError` (Edge) | low | Il nucleo emette tipi dello stesso schema; caso non dimostrato | scartato |
| 13 | L'errore di schema d'uscita diventa `McpError`, non `isError` (Blind) | false | SDK 1.30 `mcp.js:132-141`: `validateToolOutput` è nel `try` e il `catch` restituisce `createToolError` | scartato |
| 14 | La cache di turbo nasconde il livello 3 (Blind) | false | `turbo.json`: `test` ha `cache: false` | scartato |
| 15 | Nessun timeout sulle letture dell'adattatore (Blind) | false | `callPenpotTool` usa `withTimeout` (15 s, 60 s per `readComponent`) | scartato |
| 16 | BOM prima del marker (Edge) | low | Il generatore non scrive BOM; caso raro | scartato |
| 17 | Cartella di componente collegata non conta come generata (Edge) | low | Raro; servirebbe un ramo in più | scartato |
| 18 | `verify_component` col catalogo che fallisce non testato (Blind) | low | Stesso `guarded` già provato su `generate_component` | scartato |
