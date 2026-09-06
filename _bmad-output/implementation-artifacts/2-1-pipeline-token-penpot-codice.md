---
baseline_commit: ea4d3d9
---

# Story 2.1: Pipeline token Penpot→codice

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a designer/sviluppatore,
I want generare i token (colori/tipografia/spacing/radii/ombre) dal catalogo Penpot,
so that i valori di design abbiano un'unica fonte generata, non scritta a mano (FR1, AD-11).

## Acceptance Criteria

1. **Given** un catalogo token Penpot (live o fixture) **When** eseguo la generazione token **Then** vengono prodotti `@generated` CSS custom properties (Tailwind v4 `@theme`) + scala TS, raggruppati per set Penpot.
2. **And** un nuovo set Penpot produce una nuova sezione senza modifiche al codice, e i file generati portano il marker `@generated`.
3. **And** il catalogo token letto da Penpot è serializzato in una **fixture committata**, così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design.
4. **And** le variabili senza corrispondenza Penpot (font utility, line-height) vivono in un file separato e non generato, che la rigenerazione non tocca.

## Tasks / Subtasks

- [x] Task 1: Scaffold `packages/tokens` (`@penpot-ds/tokens`) (AC: #1, #4)
  - [x] `package.json`: nome `@penpot-ds/tokens`, `private: true`, `type: module`, build `tsup` (aggiungi `tsup` al catalog pnpm se assente), `check-types`/`lint` come negli altri package. Export map: `.` → `./dist/index.js` (build tsup di `src/index.ts`), `./tailwind-theme.css` → `./src/tailwind-theme.css` (CSS diretto, non passa da tsup), `./tailwind-extras.css` → `./src/tailwind-extras.css`. Nessun export `./css`/`./tailwind-preset`.
  - [x] `src/index.ts`: barrel non generato che ri-esporta da `tokens.generated.ts` (creato dal Task 3).
  - [x] `src/tailwind-extras.css` scritto a mano: variabili senza corrispondenza Penpot (`--font-utility`, `--leading-1..5` o equivalenti decisi in fase di generazione reale — vedi Dev Notes su "non inventare valori"). Nessun header `@generated`.
  - [x] `tsconfig.json` che estende la config condivisa (`@app/config`, come fa `packages/ui`).
- [x] Task 2: Scaffold `packages/scripts` (`@penpot-ds/scripts`) — solo Stage 1 (token), non Stage 2/componenti (AC: #1, #3)
  - [x] `package.json`: nome `@penpot-ds/scripts`, runtime `node --import tsx` (aggiungi `tsx` al catalog pnpm), dipendenza `@modelcontextprotocol/sdk` (aggiungi al catalog pnpm — client MCP: `Client` + `StreamableHTTPClientTransport`), dipendenza workspace `@penpot-ds/tokens`. Script: `generate:theme` (`node --import tsx src/generate-theme.ts`), `test` (`vitest run`), `check-types`, `lint`.
  - [x] `src/penpot-reader.ts`: client MCP minimale per **solo il catalogo token** — connessione a `http://127.0.0.1:4401/mcp` via `StreamableHTTPClientTransport`, tool `execute_code` per leggere `penpot.library.local.tokens` (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`). Non implementare qui la lettura componenti (`penpot-reader` per componenti/varianti è Story 2.2/2.3).
  - [x] `src/theme-generator.ts`: **funzione pura e testabile** `TokenCatalog → { css, ts }`. Nome variabile derivato dal **tipo** del token (namespace Tailwind v4 stabile: `color`, `text`, `font-weight`, `tracking`, `font`, `space`, `radius`, `border-width`, `opacity`, `shadow`), MAI dal nome del set. Esporta la funzione di derivazione nome (es. `varSuffix()`) separatamente: verrà riusata in Story 2.2/2.3 da `token-resolver.ts` per le classi dei componenti — devono produrre lo stesso suffisso (`color.mis.primary` → sempre sia `--color-mis-primary` sia, in futuro, `bg-mis-primary`).
  - [x] `src/generate-theme.ts`: entry point. Default: legge la fixture cache committata (offline). Flag `--live`: si connette al server MCP live, legge il catalogo reale, **aggiorna anche la fixture cache**. Scrive sempre (sovrascrive incondizionatamente) `packages/tokens/src/tailwind-theme.css` e `packages/tokens/src/tokens.generated.ts`.
  - [x] `src/__fixtures__/penpot-catalog.json`: fixture committata (AC #3). Vedi **Dev Notes → Fixture iniziale: blocco critico** prima di popolarla.
- [x] Task 3: Output generati (AC: #1, #2, #4)
  - [x] `packages/tokens/src/tokens.generated.ts`: header `// @generated from Penpot design tokens — DO NOT EDIT BY HAND. Regenerate with pnpm --filter @penpot-ds/scripts generate:theme.`. Contiene la scala TS (spacing/radii minimo, estendibile ad altri tipi numerici) + opzioni/mappe per i field select Puck (`spacingOptions`/`spacingMap`/`radiiOptions`/`radiiMap` o equivalenti pei tipi effettivamente presenti nel catalogo).
  - [x] `packages/tokens/src/tailwind-theme.css`: stesso header `@generated`. Contiene le custom properties Tailwind v4 dentro `@theme { ... }`, **raggruppate per SET Penpot** (ordine di catalogo — l'AC #2 richiede che un nuovo set produca una nuova sezione senza toccare il codice: verificalo aggiungendo un secondo set alla fixture di test). `@import "./tailwind-extras.css";` in testa al file generato.
  - [x] Verifica manuale AC #2: aggiungi un set fittizio alla fixture di test (non a quella "reale" committata, se distinte), rigenera, conferma che compare una nuova sezione senza modifiche a `theme-generator.ts`.
- [x] Task 4: Test (AC: #1, #3)
  - [x] `theme-generator.test.ts` (vitest): test unitari puri sulla funzione di mapping, offline, contro la fixture committata — nessuna connessione di rete nei test. Copri: derivazione nome per tipo (non per set), un nuovo set → nuova sezione, un token senza `value` risolvibile → comportamento esplicito (mai un valore inventato, vedi Dev Notes).
  - [x] Verifica marker `@generated` presente in entrambi i file generati e provenienza tracciabile (almeno un commento con riferimento al comando di rigenerazione, come da convenzione — la provenienza `penpotComponentId`/`fixtureHash` puntuale è introdotta in Story 2.2/2.3 per i componenti; per i token basta comando di rigenerazione + timestamp/hash della fixture usata, decidi e documenta il formato).
- [x] Task 5: Wiring repo e non-regressione (AC: #1)
  - [x] Aggiungi `tsup`, `tsx`, `@modelcontextprotocol/sdk` al `catalog` di `pnpm-workspace.yaml` (pattern esistente: ogni dipendenza è pinnata via catalog, mai ad-hoc — vedi Story 1.4/1.5 lezioni in `1-6-*.md` Dev Notes).
  - [x] Nessuna modifica a `turbo.json` necessaria per `lint`/`check-types` (i nuovi package ereditano i task esistenti via `^lint`/`^check-types` sul glob `packages/*`); NON aggiungere `generate:theme` come task Turbo cacheable — è un trigger manuale, non parte della build graph (AC lo descrive come "eseguo la generazione", non un passo automatico di `build`).
  - [x] `pnpm install` + `pnpm check-types` + `pnpm lint` + `pnpm test` verdi a livello repo dopo l'aggiunta dei due package. (`pnpm build` verificato anche verde end-to-end, incl. `apps/web`.)
- [x] Task 6: Documentazione (AC: #1, #3, #4)
  - [x] Aggiungi ai due `package.json` una nota `description` e, se utile, un breve `README.md` di package con: come rigenerare (`pnpm --filter @penpot-ds/scripts generate:theme` / `-- --live`), dove vive la fixture, e il fatto che `tailwind-extras.css` non va mai toccato dalla generazione.
  - [x] Aggiorna `deferred-work.md` se emergono elementi rimandati (es. tipi di token non ancora coperti, live MCP non configurato in questo ambiente — vedi Dev Notes).

## Dev Notes

- **Blocco critico da risolvere con Alessandro prima/durante l'implementazione — server MCP Penpot non configurato in questo ambiente.** Non esiste `.mcp.json` nel repo (verificato) e nessun server Penpot risulta connesso in questa sessione. L'AC #1 accetta esplicitamente "catalogo Penpot (**live o fixture**)", e l'AC #3 richiede che la fixture sia una **serializzazione reale** del catalogo Penpot, non un placeholder — coerente con la decisione già presa con l'utente e registrata in [ux-designs/.../DESIGN.md:53](../planning-artifacts/ux-designs/ux-page-builder-2026-07-26/DESIGN.md): *"i token concreti... sono placeholder in attesa dell'estrazione reale da Penpot... non vengono inventati valori qui"*. Stesso principio ribadito in `penpot-pipeline.md` ("mai colori casuali") e `docs/legacy/penpot-conventions.md` ("non inventare valori mancanti"). **Implicazione pratica:** il dev agent NON deve inventare una fixture con valori a caso per soddisfare l'AC. Se un server MCP Penpot reale è raggiungibile nell'ambiente di sviluppo (porta di riferimento storica `http://127.0.0.1:4401/mcp`, da confermare/riconfigurare con Alessandro — es. un file `.mcp.json` alla root con `mcpServers.penpot.url`), usalo per popolare la fixture reale con `--live`. Se non è raggiungibile, **fermarsi e chiedere** come procedere (accesso al progetto Penpot, screenshot/export del catalogo, o rimando esplicito a task successivo) invece di produrre una fixture con valori inventati che looks-done ma viola l'AC nella sostanza.
- **Scope di questa story = SOLO Stage 1 (token) del regime AD-11.** Fixture/ricetta/renderer di **componenti** (Stage 2) sono Story 2.2 (estrazione + ricetta) e 2.3 (renderer + gate CI) — non anticiparli qui. `penpot-reader.ts` in questa story legge **solo** `penpot.library.local.tokens`, non componenti/varianti.
- **Riferimento di implementazione dettagliato (storico, stessa architettura di pipeline, stack diverso — JHipster/Strapi legacy, NON il monorepo attuale):** [docs/legacy/design-token-pipeline.md](../../docs/legacy/design-token-pipeline.md) descrive `theme-generator.ts`/`generate-theme.ts`/`penpot-reader.ts` con lo stesso contratto data-driven-per-tipo richiesto qui. Utile come riferimento di design della pipeline (nomi funzione, struttura file, gotcha), **non** da copiare 1:1 (stack Node/tsx/Handlebars/tsup era per un altro scaffold). Gotcha rilevanti riportati lì: font-size senza token binding → mai indovinare (fail loud, non un fallback silenzioso); radius con angoli disomogenei → non forzare un `rounded-*` unico; `generate:theme` sovrascrive sempre i file generati (a differenza della pipeline componenti che rispetta i file hand-written).
- **Convenzioni MCP Penpot** (se/quando la connessione live è disponibile): [docs/legacy/penpot-conventions.md](../../docs/legacy/penpot-conventions.md) — tool `execute_code`, non loggare+return duplicato, batch delle operazioni, solo i set Penpot `active` hanno effetto sui token.
- **Naming 1:1 design↔codice (NFR5):** i nomi dei set/token in Penpot restano allineati 1:1 al nome generato in codice — non rinominare/abbreviare durante la generazione.
- **Non toccare:** `packages/domain`, `packages/api`, `packages/auth`, `packages/db`, `packages/env`, `apps/web` — questa story è isolata ai due nuovi package `tokens`/`scripts`. Nessuna dipendenza di `apps/web` da `@penpot-ds/tokens` in questa story (il consumo dai layer superiori — `ui/domains`, blocchi Puck — è Epic 2 successive/Epic 3).
- **Pattern di stile per script vanilla senza dipendenze pesanti:** se serve un gate/verifica minimale in questa story, segui lo stile di [packages/ui/scripts/check-boundaries.mjs](../../packages/ui/scripts/check-boundaries.mjs) (Node puro, `process.exit` esplicito, messaggi d'errore parlanti) — non è direttamente riusabile qui (dominio diverso) ma è il precedente di stile del repo per script di gate.
- **Retro Epic 1 (azione aperta, rilevante per i gate CI introdotti a partire da Story 2.3, non ancora questa):** disciplina "testare il gate, non solo verificarlo a canary manuale" va estesa ai gate di Epic 2 fin dalla loro introduzione — tienilo presente quando in Story 2.3 arriveranno i 4 gate CI; in questa story il gate è solo "i test theme-generator passano offline", già coperto da vitest.

### Project Structure Notes

- Nuovi package (nessuno esiste ancora — verificato: `ls packages/` = `api, auth, config, db, domain, env, ui`):
  ```
  packages/
    tokens/                  # NUOVO — @penpot-ds/tokens
      package.json
      tsconfig.json
      src/
        index.ts             # barrel, non generato
        tokens.generated.ts  # @generated — scala TS + opzioni editor
        tailwind-theme.css   # @generated — CSS vars Tailwind v4 @theme
        tailwind-extras.css  # scritto a mano — vars senza corrispondenza Penpot
    scripts/                 # NUOVO — @penpot-ds/scripts (solo Stage 1 in questa story)
      package.json
      tsconfig.json
      src/
        penpot-reader.ts     # client MCP — solo penpot.library.local.tokens
        theme-generator.ts   # mapping puro TokenCatalog → CSS/TS (testabile)
        generate-theme.ts    # entry "generate:theme" (default fixture, --live per MCP)
        theme-generator.test.ts
        __fixtures__/
          penpot-catalog.json  # fixture committata (AC #3)
  ```
- Layering dallo Spine: `tokens` è **foglia** del grafo (`tokens → ui/domains → {puck-components, ui/editor}`) — nessuna dipendenza interna oltre eventuali util condivise. `scripts` dipende da `tokens` (workspace) per generare contro i tipi esistenti, ma non viceversa.
- `pnpm-workspace.yaml` non richiede modifiche allo `packages` glob (`packages/*` già copre i nuovi package); richiede solo le nuove voci di `catalog` (Task 5).
- Conflitti rilevati: nessuno con le story di Epic 1 (package disgiunti). Nessuna migrazione DB, nessun cambiamento a `apps/web`.

### Testing Requirements

- Test **offline e deterministici**: `theme-generator.test.ts` gira contro la fixture committata, zero rete, zero dipendenza da un server MCP raggiungibile (il server MCP live è eventualmente usato solo per popolare/aggiornare la fixture con `--live`, mai nei test).
- Rigenerazione idempotente: eseguire `generate:theme` due volte di seguito sulla stessa fixture produce output identico byte-per-byte (nessuna sorgente di non-determinismo come `Date.now()` nel corpo del file generato — se serve un timestamp di provenienza, verificane la stabilità o omettilo).
- AC #2 verificato concretamente: aggiungere un set alla fixture di test → rigenerare → nuova sezione appare senza modifiche a `theme-generator.ts`.
- Non-regressione repo: `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` verdi dopo l'aggiunta dei due package (pattern osservato in tutte le story di Epic 1).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Pipeline token Penpot→codice] — user story e AC originali.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-11] — regime fixture→ricetta→renderer, Penpot come single source of truth dei valori, mai valori inventati.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Structural Seed] — collocazione `packages/tokens` (GENERATO) e `packages/scripts/penpot/` nel layout target.
- [Source: _bmad-output/specs/spec-page-builder/penpot-pipeline.md#Stadio 1] — contratto dettagliato di generazione token: mapping data-driven per tipo, stessa funzione di derivazione nome riusata da CSS e classi componenti, output sempre sovrascritto con header `@generated`.
- [Source: _bmad-output/specs/spec-page-builder/design-system.md#tokens] — namespace stabile dei tipi token, `tailwind-extras.css` come unica parte scritta a mano.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/DESIGN.md:53] — decisione con l'utente: token concreti sono placeholder finché non allineati a Penpot reale; non inventare valori.
- [Source: docs/legacy/design-token-pipeline.md] — riferimento implementativo dettagliato (stack legacy diverso, stessa architettura di pipeline) per `theme-generator.ts`/`generate-theme.ts`/`penpot-reader.ts`, gotcha noti.
- [Source: docs/legacy/penpot-conventions.md] — regole operative MCP Penpot (tool `execute_code`, set `active`, naming 1:1).
- [Source: packages/ui/scripts/check-boundaries.mjs] — precedente di stile repo per script di gate Node vanilla.
- [Source: pnpm-workspace.yaml] — pattern catalog esistente (ogni dipendenza pinnata via catalog, mai ad-hoc — lezione da Story 1.4/1.5, vedi `1-6-envelope-docker-e-migration-in-release.md#Dev Notes`).
- [Source: turbo.json] — task `lint`/`check-types` già ereditati da tutti i package via `^`; nessuna modifica necessaria per i nuovi package.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Blocco critico Dev Notes (server MCP Penpot non configurato) risultava già superato prima dell'avvio: sessione UX del 2026-09-06 aveva validato la library token Penpot dal vivo (vedi memoria `penpot-token-library-validated-story-2-1`). Verificato che il server MCP Penpot fosse comunque raggiungibile anche in questa sessione (container Docker `penpot-penpot-mcp-1` su `127.0.0.1:4401`) e letto il catalogo reale via `execute_code` prima di scrivere la fixture — nessun valore inventato.
- pnpm non era nel PATH di default della shell (solo `node` via nvm symlink in `/usr/local/bin`); risolto abilitando `corepack` dalla stessa install nvm (`/home/alessandro/.nvm/versions/node/v22.23.1/bin`) e aggiungendola al PATH per i comandi pnpm di questa sessione.
- `tsup@8.5.1` (dts build) inietta sempre `compilerOptions.baseUrl` per il bundler dts; con TypeScript `~6.0` questo produce l'errore TS5101 (baseUrl deprecato). Risolto con `"ignoreDeprecations": "6.0"` in `packages/tokens/tsconfig.json` (mitigazione suggerita direttamente dal messaggio d'errore del compilatore). Dettagli in `deferred-work.md`.
- Import relativi con estensione `.ts` esplicita (`./theme-generator.ts`) fanno fallire `tsc --noEmit` (TS5097) con la config condivisa del repo; corretto a import estensionless, coerente con il pattern già in uso in `packages/domain`.
- Eseguito `pnpm --filter @penpot-ds/scripts generate:theme -- --live` per validare l'intero percorso MCP end-to-end (non solo offline contro la fixture): il catalogo letto dal vivo coincide byte-per-byte (a meno della formattazione JSON) con quello trascritto manualmente durante l'analisi iniziale.

### Completion Notes List

- Scaffolded `@penpot-ds/tokens` e `@penpot-ds/scripts` come da Task 1-2. `tokens` resta foglia (nessuna dipendenza interna oltre `@app/config` in dev); `scripts` dipende da `@penpot-ds/tokens` via workspace (dichiarata, non ancora importata: sarà usata da Story 2.2/2.3 per i tipi condivisi).
- `theme-generator.ts` è puro e data-driven per **tipo** di token, mai per set: `varSuffix()`/`varName()` derivano il nome CSS/TS deduplicando il segmento iniziale del nome token solo quando ripete il namespace del tipo (es. `color.mis.primary` → `color-mis-primary`), altrimenti preservano il nome intero (es. `gray.1` → `color-gray-1`, `accent.1` → `color-accent-1`) — scelta deliberata per evitare collisioni tra token con lo stesso indice in set diversi, verificata con test dedicato.
- Riferimenti `{token.name}` risolti in `var(--...)` nel CSS (indirection preservata, non appiattita) e ricorsivamente in valore numerico letterale per la scala TS. Nessun uso di `resolvedValue` di Penpot: durante l'analisi del catalogo reale è emerso che `resolvedValue` perde il canale alpha delle shadow (rgba → hex), quindi tutta la risoluzione passa dal `value` grezzo con logica propria — anche perché il contratto della fixture (Task 2) esclude esplicitamente `resolvedValue`.
- Collisioni sul nome di variabile CSS generato da due token diversi sono un errore esplicito e bloccante (mai un override silenzioso) — stesso principio "mai un valore inventato" applicato al naming.
- Fixture reale popolata leggendo `penpot.library.local.tokens` dal server MCP Penpot live (10 set, tutti `active`, filtrati a monte dal reader) e poi rigenerata anche via `--live` per validare l'intero percorso end-to-end all'interno di questa sessione.
- `tailwind-extras.css` contiene `--font-utility` (stack di sistema, per chrome UI non di brand) e `--leading-1..5` (scala convenzionale Tailwind: 1/1.25/1.5/1.75/2) — nessun valore Penpot-adiacente inventato, motivato nel commento del file.
- Suite `theme-generator.test.ts`: 14 test, tutti offline contro la fixture committata o cataloghi in-memory ad-hoc per i casi limite (nuovo set, riferimento rotto, valore non numerico, collisione). Nessuna chiamata di rete nei test.
- Non-regressione repo verificata: `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` tutti verdi (incl. `apps/web`), oltre ai comandi mirati sui due nuovi package.

### File List

- `pnpm-workspace.yaml` (modificato — catalog: `tsup`, `tsx`, `@modelcontextprotocol/sdk`)
- `packages/tokens/package.json`
- `packages/tokens/tsconfig.json`
- `packages/tokens/README.md`
- `packages/tokens/src/index.ts`
- `packages/tokens/src/tailwind-extras.css`
- `packages/tokens/src/tailwind-theme.css` (@generated)
- `packages/tokens/src/tokens.generated.ts` (@generated)
- `packages/scripts/package.json`
- `packages/scripts/tsconfig.json`
- `packages/scripts/README.md`
- `packages/scripts/src/penpot-reader.ts`
- `packages/scripts/src/theme-generator.ts`
- `packages/scripts/src/theme-generator.test.ts`
- `packages/scripts/src/generate-theme.ts`
- `packages/scripts/src/__fixtures__/penpot-catalog.json`
- `packages/tokens/scripts/check-boundaries.mjs` (nuovo — dalla code review)
- `packages/scripts/scripts/check-boundaries.mjs` (nuovo — dalla code review)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modificato)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificato)

## Change Log

- 2026-09-06 — Code review adversariale (bmad-code-review, 3 layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Base diff: delta non committato (`packages/tokens/` + `packages/scripts/` untracked + `pnpm-workspace.yaml`; esclusi lockfile e artifact sprint/story). Auditor: **PASS** su tutti gli AC e Task 1–6. Triage: 3 decision-needed (tutti risolti da Alessandro: opzione 2 estesa sui namespace, compatibilità per gruppo sui cross-type, rifiuto bare number sul tracking), 19 patch applicate e verificate, 2 defer, 1 dismiss. Esecuzione patch: `@theme static` (anti tree-shaking), `spacing → --spacing-*`, compatibilità cross-type (numerici liberi tra loro, resto stesso-tipo, shadow color solo→color), guard bare number tracking, errore esplicito su riferimenti circolari, drift guard byte-per-byte fixture↔generati, `--live` genera-prima-scrive-dopo con write atomici, timeout MCP 15s + errore close non mascherante + validazione inner shape envelope, guard tipo sconosciuto/non-array/scalar non-string/inset non booleano/layer senza color/nomi fuori charset/liste vuote, CLI stretta, exports con condizione `types`, script `lint` + boundary-check minimi per entrambi i package. Correzione dei 5 token tracking: via MCP impossibile (API read-only, verificata empiricamente), fixture corretta a `px` per intento esplicito di Alessandro; la correzione nell'UI Penpot resta registrata in deferred-work. Verifiche: `check-types` verdi, `lint` verdi (canary rosso/verde su entrambi i gate nuovi), `test` 92/92 (26 in @penpot-ds/scripts), `build` 14/14. Status → done.
- 2026-09-06 — Implementazione completa (dev-story): scaffolded `packages/tokens` e `packages/scripts`, pipeline `generate-theme.ts`/`theme-generator.ts`/`penpot-reader.ts`, fixture reale popolata leggendo Penpot live (server MCP raggiungibile in questa sessione — il blocco critico dei Dev Notes era già superato dalla validazione UX del 2026-09-06), 14 test unitari offline in `theme-generator.test.ts`, README di package, voce `deferred-work.md`. Non-regressione repo verde (`check-types`/`lint`/`test`/`build`). Status → review.
- 2026-09-06 — Story creata via create-story (context engine): analisi di epics (Epic 2 completo), Architecture Spine (AD-11, Structural Seed), companion penpot-pipeline.md e design-system.md, DESIGN.md (decisione su placeholder token), riferimento legacy dettagliato (design-token-pipeline.md, penpot-conventions.md), stato repo (nessun `.mcp.json`, nessun package tokens/scripts esistente), pattern di stile esistenti (check-boundaries.mjs, catalog pnpm). Flag critico: server MCP Penpot non configurato in questo ambiente — la fixture reale richiede risoluzione con Alessandro prima di poter chiudere l'AC in sostanza. Status → ready-for-dev.

## Review Findings

_Code review adversariale del 2026-09-06 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Base diff: delta non committato (`packages/tokens/` + `packages/scripts/` untracked + `pnpm-workspace.yaml`; esclusi lockfile e artifact sprint/story). Auditor: **PASS** su tutti gli AC e Task 1–6 (unica deviazione: script `lint` mancanti, vedi patch sotto)._

### Review Findings — Decision Needed

- [x] [Review][Decision] Namespace Tailwind v4 non validi per 3 tipi su 10 [packages/scripts/src/theme-generator.ts:56-67] — `--space-*`, `--border-width-*` e `--opacity-*` NON sono namespace `@theme` di Tailwind v4 (quello spacing è `--spacing-*`; border-width e opacity non esistono come namespace): per questi tipi non verrà mai generata alcuna utility (`p-mis-1`, `border-hairline`, `opacity-1` non esisteranno), e le var restano "non usate" agli occhi di Tailwind. Opzioni: (1) rimappare `spacing → spacing` e documentare/eliminare i tipi senza namespace, accettando che il nome CSS devii dal nome Penpot (NFR5 1:1); (2) mantenere `--space-*` ecc. come sole CSS var consumate via `var()` (coerente con NFR5 e con l'uso previsto dai field Puck), documentandolo esplicitamente nel contratto del generatore; (3) rimuovere dal `@theme` i tipi senza namespace. Nota: indipendentemente dalla scelta, la patch "static" sotto resta necessaria. **Risolta (opzione 2 estesa, scelta Alessandro)**: rimappati i 7 tipi con namespace reale v4 — in pratica `spacing → "spacing"` (le altre 6 erano già corrette); il suffisso `varSuffix` resta il contratto 1:1 con Penpot (per `space.1` il nome non si deduplica più col prefisso, quindi `--spacing-space-1` e chiave scala `space-1`); `borderWidth`/`opacity` restano CSS-only vars documentate nel contratto del generatore (2a). Test aggiornati.
- [x] [Review][Decision] Riferimenti cross-type accettati in silenzio [packages/scripts/src/theme-generator.ts:152-161] — `resolveCssScalar` risolve QUALSIASI riferimento `{ref}` a `var(--target)` senza check di compatibilità di tipo: un token `color` che referenzia `{space.1}` emette `--color-x: var(--space-1);` (colore rotto in silenzio), un `fontSizes` che referenzia `{space.1}` entra nella scala TS come `4`. Contraddice la filosofia fail-loud del file. Serve una policy: quali accoppiate tipo→tipo sono legali (es. solo stesso tipo? numerici tra loro?). Verificare come il plugin Penpot serializza i riferimenti reali prima di scegliere. **Risolta (opzione 2, scelta Alessandro)**: compatibilità per gruppo — i tipi numerici (`spacing`, `borderRadius`, `borderWidth`, `fontSizes`) si referenziano liberamente tra loro; gli altri solo stesso tipo. Caso dedicato: il `color` di un layer shadow può referenziare solo token di tipo `color`. Fuori gruppo → errore esplicito che nomina i due token. Fixture reale verificata: tutti i riferimenti esistenti sono same-type, nessuna regressione.
- [x] [Review][Decision] letterSpacing: bare number assunti come px [packages/scripts/src/theme-generator.ts:169-170] — `0.5` → `0.5px` mentre coesistono valori `em` (`0.0025em`) nello stesso tipo; se un bare number in Penpot significasse em, l'errore visivo è ~16×. L'Auditor conferma che i valori `mis` della fixture sono coerenti con px, ma l'assunzione è lockata da un test senza conferma esplicita del lato design. Confermare con Alessandro/design che i bare number di tracking in Penpot siano px, e documentarlo in `penpot-conventions.md`. **Risolta (opzione 2, scelta Alessandro)**: rifiuto fail-loud dei bare number per tracking — solo unità esplicita (px/em). I 5 token tracking bare in Penpot (`0`, `0.5`, `2`, `3`, `1.5`) confermati px da Alessandro; la scrittura via MCP è impossibile (API plugin read-only, verificata: oggetti token sono istantanee piatte, nessun metodo di scrittura), quindi la fixture è stata corretta con `px` per intento esplicito di Alessandro; la **correzione dei medesimi valori nell'UI di Penpot** (plugin Tokens) resta a carico di Alessandro ed è registrata in `deferred-work.md` — finché non avviene, `--live` fallirà loud sul tracking bare (by design, la scrittura della fixture è post-successo e non corrompe nulla).

### Review Findings — Patch

- [x] [Review][Patch] `@theme` plain → tree-shaking: le var spariscono dai build di produzione [packages/scripts/src/theme-generator.ts:326] — Tailwind v4 di default emette solo le var usate; i valori `var(--space-1)` letterali nelle mappe Puck (inline style) non sono candidati Tailwind, quindi al primo build reale la maggior parte delle `--color-*`/`--space-*`/`--shadow-*` verrà droppata da `:root`. Fix: emettere `@theme static` (+ test che asserisce il marker/la sopravvivenza delle var).
- [x] [Review][Patch] Cicli `{ref}` → RangeError opaco invece dell'errore esplicito promesso [packages/scripts/src/theme-generator.ts:220-240] — `resolveNumericValue` ricorre senza visited-set: `{space.1} → {space.1}` e `{radius.a} ⇄ {radius.b}` producono `Maximum call stack size exceeded` (verificato empiricamente), senza indicazione del token colpevole. Fix: visited-set con errore parlante che nomina il token.
- [x] [Review][Patch] Nessun guard di drift fixture ↔ file generati committati [packages/scripts/src/theme-generator.test.ts] — nessun test asserisce che `generateTheme(loadFixture())` coincide byte-per-byte con `packages/tokens/src/tailwind-theme.css` e `tokens.generated.ts`: un merge che tocchi un solo lato, o un edit a mano, resta verde in silenzio. Fix: un test di byte-equality deterministico.
- [x] [Review][Patch] `--live` scrive la fixture PRIMA di generare: un fallimento corrompe la fixture committata [packages/scripts/src/generate-theme.ts:17-19] — su catalogo con ref rotto/duplicato/type sconosciuto, `writeFileSync(fixturePath)` è già avvenuto e ogni run offline successivo (e la fixture committata) resta corrotto; scritture inoltre non atomiche. Fix: genera prima, scrivi la fixture solo dopo successo; write temporaneo + rename.
- [x] [Review][Patch] MCP: `connect` senza timeout; `close()` in `finally` può mascherare l'errore originale [packages/scripts/src/penpot-reader.ts:72-82] — server su `127.0.0.1:4401` che accetta TCP ma non completa l'handshake → hang indefinito; se `callTool` e `close()` falliscono entrambi, l'errore di close sostituisce quello originale. Fix: timeout sul connect + preservazione dell'errore primario.
- [x] [Review][Patch] `exports["."]` senza condizione `types` [packages/tokens/package.json:7-11] — tsup emette `dist/index.d.ts` ma sotto `moduleResolution: nodenext` il consumatore non risolve i tipi finché qualcuno non ricorda di buildare (dist è gitignored). Fix: aggiungere `"types": "./dist/index.d.ts"` (e valutare un fallback sorgente per il dev).
- [x] [Review][Patch] Token `type` sconosciuto → TypeError grezzo [packages/scripts/src/theme-generator.ts:100-101] — `TYPE_NAMESPACE[type]` è `undefined` per tipi fuori dai 10 (Penpot emette anche `typography`, `dimension`, …): crash `Cannot read properties of undefined` invece dell'errore "type non gestito" previsto. Fix: guard esplicito che elenca i tipi supportati.
- [x] [Review][Patch] `fontFamilies`/`shadow` value non-array → `.map is not a function` [packages/scripts/src/theme-generator.ts:208-214] — cast senza `Array.isArray` mentre il contratto ammette `string` per fontFamilies: un family singolo serializzato come stringa crasha. Fix: guard fail-loud.
- [x] [Review][Patch] Shadow layer senza `color` → `undefined` nel CSS generato [packages/scripts/src/theme-generator.ts:195-205] — `matchReference(undefined)` non matcha, `layer.color` viene usato raw: `--shadow-x: 0px 1px 3px 0px undefined;` senza alcun errore. Fix: validare il campo color fail-loud.
- [x] [Review][Patch] `inset` truthiness: stringa `"false"` rende l'ombra inset [packages/scripts/src/theme-generator.ts:204] — qualsiasi valore truthy non-booleano prende il ramo inset. Fix: accettare solo `boolean` e fallire loud altrimenti.
- [x] [Review][Patch] Scalar non-string per color/fontWeights/opacity emessi verbatim [packages/scripts/src/theme-generator.ts:164-168] — `value: null` (campo droppato nella serializzazione Penpot) produce `--color-x: null;` in silenzio. Fix: validare `typeof raw === "string"` per i tipi scalar.
- [x] [Review][Patch] Nessuna validazione/escaping di nomi e family [packages/scripts/src/theme-generator.ts:82-89,265-277] — caratteri `"`, `\`, newline o spazi nel nome token o nel family passano dritti nei letterali TS/CSS generati rompendoli sintatticamente. Fix: validare il charset dei nomi fail-loud.
- [x] [Review][Patch] Array vuoti → dichiarazione CSS vuota [packages/scripts/src/theme-generator.ts:208-214] — `fontFamilies: []` o shadow senza layer producono `--font-x: ;` in silenzio. Fix: errore esplicito su array vuoto.
- [x] [Review][Patch] Envelope MCP: validato solo `result.sets`, inner shape non controllata [packages/scripts/src/penpot-reader.ts:61-66] — un set senza `tokens` o un token senza `name`/`type`/`value` passa e crasha dopo con TypeError generici. Fix: validare la forma interna con errore che nomina il set/token malformato.
- [x] [Review][Patch] Flag CLI sconosciuti ignorati in silenzio [packages/scripts/src/generate-theme.ts:24] — `--live=true` o `--Live` vengono ignorati e la generazione procede dalla fixture stantecchia senza warning (drift silenzioso). Fix: parsing stretto che rigetta argomenti non riconosciuti.
- [x] [Review][Patch] Manca lo script `lint` in entrambi i package [packages/tokens/package.json:12-15, packages/scripts/package.json:7-11] — Task 1 e Task 2 dello spec richiedono `check-types`/`lint` "come negli altri package"; Turbo salta i package senza lo script (verde ma per omissione). Fix: aggiungere `lint` come negli altri package.


_Tutte le 16 patch applicate il 2026-09-06 e verificate: i 3 decision-needed sopra hanno prodotto 3 patch aggiuntive (rimappa namespace, compatibilità cross-type, guard tracking) per un totale di 19; suite `theme-generator.test.ts` portata a 26 test (17 → 26), drift guard byte-per-byte inclusa; canary rosso/verde verificato su entrambi i boundary-check nuovi; gate repo verdi (`check-types`, `lint`, `test` 92/92, `build` 14/14). Regenerazione output eseguita offline dalla fixture corretta (`generate:theme`)._

### Review Findings — Deferred

- [x] [Review][Defer] Struttura mode/theme (es. dark mode) non modellata [packages/scripts/src/theme-generator.ts:122-150] — nomi identici in set "mode" diversi (convenzione light/dark standard) vengono rifiutati come duplicati e il `TokenCatalog` non ha dimensione mode; funziona per l'attuale catalogo flat ma il primo dark mode richiede di ridisegnare il contratto di serializzazione. Deferred: decisione da prendere con l'evoluzione della library Penpot (Story 2.2+).
- [x] [Review][Defer] `penpot-reader.ts` privo di copertura test [packages/scripts/src/penpot-reader.ts] — lo spec Task 4 richiede test solo sul mapper puro; il parsing envelope/timeout verrà coperto con transport mock quando il reader crescerà in Story 2.2/2.3.
