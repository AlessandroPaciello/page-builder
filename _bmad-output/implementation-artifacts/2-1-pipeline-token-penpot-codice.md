---
baseline_commit: ea4d3d9
---

# Story 2.1: Pipeline token Penpot→codice

Status: ready-for-dev

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

- [ ] Task 1: Scaffold `packages/tokens` (`@penpot-ds/tokens`) (AC: #1, #4)
  - [ ] `package.json`: nome `@penpot-ds/tokens`, `private: true`, `type: module`, build `tsup` (aggiungi `tsup` al catalog pnpm se assente), `check-types`/`lint` come negli altri package. Export map: `.` → `./dist/index.js` (build tsup di `src/index.ts`), `./tailwind-theme.css` → `./src/tailwind-theme.css` (CSS diretto, non passa da tsup), `./tailwind-extras.css` → `./src/tailwind-extras.css`. Nessun export `./css`/`./tailwind-preset`.
  - [ ] `src/index.ts`: barrel non generato che ri-esporta da `tokens.generated.ts` (creato dal Task 3).
  - [ ] `src/tailwind-extras.css` scritto a mano: variabili senza corrispondenza Penpot (`--font-utility`, `--leading-1..5` o equivalenti decisi in fase di generazione reale — vedi Dev Notes su "non inventare valori"). Nessun header `@generated`.
  - [ ] `tsconfig.json` che estende la config condivisa (`@app/config`, come fa `packages/ui`).
- [ ] Task 2: Scaffold `packages/scripts` (`@penpot-ds/scripts`) — solo Stage 1 (token), non Stage 2/componenti (AC: #1, #3)
  - [ ] `package.json`: nome `@penpot-ds/scripts`, runtime `node --import tsx` (aggiungi `tsx` al catalog pnpm), dipendenza `@modelcontextprotocol/sdk` (aggiungi al catalog pnpm — client MCP: `Client` + `StreamableHTTPClientTransport`), dipendenza workspace `@penpot-ds/tokens`. Script: `generate:theme` (`node --import tsx src/generate-theme.ts`), `test` (`vitest run`), `check-types`, `lint`.
  - [ ] `src/penpot-reader.ts`: client MCP minimale per **solo il catalogo token** — connessione a `http://127.0.0.1:4401/mcp` via `StreamableHTTPClientTransport`, tool `execute_code` per leggere `penpot.library.local.tokens` (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`). Non implementare qui la lettura componenti (`penpot-reader` per componenti/varianti è Story 2.2/2.3).
  - [ ] `src/theme-generator.ts`: **funzione pura e testabile** `TokenCatalog → { css, ts }`. Nome variabile derivato dal **tipo** del token (namespace Tailwind v4 stabile: `color`, `text`, `font-weight`, `tracking`, `font`, `space`, `radius`, `border-width`, `opacity`, `shadow`), MAI dal nome del set. Esporta la funzione di derivazione nome (es. `varSuffix()`) separatamente: verrà riusata in Story 2.2/2.3 da `token-resolver.ts` per le classi dei componenti — devono produrre lo stesso suffisso (`color.mis.primary` → sempre sia `--color-mis-primary` sia, in futuro, `bg-mis-primary`).
  - [ ] `src/generate-theme.ts`: entry point. Default: legge la fixture cache committata (offline). Flag `--live`: si connette al server MCP live, legge il catalogo reale, **aggiorna anche la fixture cache**. Scrive sempre (sovrascrive incondizionatamente) `packages/tokens/src/tailwind-theme.css` e `packages/tokens/src/tokens.generated.ts`.
  - [ ] `src/__fixtures__/penpot-catalog.json`: fixture committata (AC #3). Vedi **Dev Notes → Fixture iniziale: blocco critico** prima di popolarla.
- [ ] Task 3: Output generati (AC: #1, #2, #4)
  - [ ] `packages/tokens/src/tokens.generated.ts`: header `// @generated from Penpot design tokens — DO NOT EDIT BY HAND. Regenerate with pnpm --filter @penpot-ds/scripts generate:theme.`. Contiene la scala TS (spacing/radii minimo, estendibile ad altri tipi numerici) + opzioni/mappe per i field select Puck (`spacingOptions`/`spacingMap`/`radiiOptions`/`radiiMap` o equivalenti pei tipi effettivamente presenti nel catalogo).
  - [ ] `packages/tokens/src/tailwind-theme.css`: stesso header `@generated`. Contiene le custom properties Tailwind v4 dentro `@theme { ... }`, **raggruppate per SET Penpot** (ordine di catalogo — l'AC #2 richiede che un nuovo set produca una nuova sezione senza toccare il codice: verificalo aggiungendo un secondo set alla fixture di test). `@import "./tailwind-extras.css";` in testa al file generato.
  - [ ] Verifica manuale AC #2: aggiungi un set fittizio alla fixture di test (non a quella "reale" committata, se distinte), rigenera, conferma che compare una nuova sezione senza modifiche a `theme-generator.ts`.
- [ ] Task 4: Test (AC: #1, #3)
  - [ ] `theme-generator.test.ts` (vitest): test unitari puri sulla funzione di mapping, offline, contro la fixture committata — nessuna connessione di rete nei test. Copri: derivazione nome per tipo (non per set), un nuovo set → nuova sezione, un token senza `value` risolvibile → comportamento esplicito (mai un valore inventato, vedi Dev Notes).
  - [ ] Verifica marker `@generated` presente in entrambi i file generati e provenienza tracciabile (almeno un commento con riferimento al comando di rigenerazione, come da convenzione — la provenienza `penpotComponentId`/`fixtureHash` puntuale è introdotta in Story 2.2/2.3 per i componenti; per i token basta comando di rigenerazione + timestamp/hash della fixture usata, decidi e documenta il formato).
- [ ] Task 5: Wiring repo e non-regressione (AC: #1)
  - [ ] Aggiungi `tsup`, `tsx`, `@modelcontextprotocol/sdk` al `catalog` di `pnpm-workspace.yaml` (pattern esistente: ogni dipendenza è pinnata via catalog, mai ad-hoc — vedi Story 1.4/1.5 lezioni in `1-6-*.md` Dev Notes).
  - [ ] Nessuna modifica a `turbo.json` necessaria per `lint`/`check-types` (i nuovi package ereditano i task esistenti via `^lint`/`^check-types` sul glob `packages/*`); NON aggiungere `generate:theme` come task Turbo cacheable — è un trigger manuale, non parte della build graph (AC lo descrive come "eseguo la generazione", non un passo automatico di `build`).
  - [ ] `pnpm install` + `pnpm check-types` + `pnpm lint` + `pnpm test` verdi a livello repo dopo l'aggiunta dei due package.
- [ ] Task 6: Documentazione (AC: #1, #3, #4)
  - [ ] Aggiungi ai due `package.json` una nota `description` e, se utile, un breve `README.md` di package con: come rigenerare (`pnpm --filter @penpot-ds/scripts generate:theme` / `-- --live`), dove vive la fixture, e il fatto che `tailwind-extras.css` non va mai toccato dalla generazione.
  - [ ] Aggiorna `deferred-work.md` se emergono elementi rimandati (es. tipi di token non ancora coperti, live MCP non configurato in questo ambiente — vedi Dev Notes).

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-09-06 — Story creata via create-story (context engine): analisi di epics (Epic 2 completo), Architecture Spine (AD-11, Structural Seed), companion penpot-pipeline.md e design-system.md, DESIGN.md (decisione su placeholder token), riferimento legacy dettagliato (design-token-pipeline.md, penpot-conventions.md), stato repo (nessun `.mcp.json`, nessun package tokens/scripts esistente), pattern di stile esistenti (check-boundaries.mjs, catalog pnpm). Flag critico: server MCP Penpot non configurato in questo ambiente — la fixture reale richiede risoluzione con Alessandro prima di poter chiudere l'AC in sostanza. Status → ready-for-dev.
