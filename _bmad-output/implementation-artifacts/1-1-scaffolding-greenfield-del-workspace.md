# Story 1.1: Scaffolding greenfield del workspace

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a sviluppatore,
I want inizializzare il workspace con create-better-t-stack e la struttura monorepo,
so that esiste una base full-TypeScript avviabile su cui costruire tutto il resto.

## Acceptance Criteria

1. **Given** un workspace vuoto (solo `docs/` legacy di riferimento) **When** eseguo lo scaffolding con create-better-t-stack (Next.js App Router, Node LTS, Prisma, Better Auth, oRPC) e configuro pnpm + Turborepo **Then** l'app Next parte in dev senza errori e il monorepo espone `apps/web` e la cartella `packages/`.
2. Le versioni sono pinnate come da architecture spine (Next 16.x, React 19, Prisma 7.9+, @puckeditor/core 0.22.x, Tailwind 4) e nessun residuo legacy (JHipster/Strapi) è presente nel codice scaffoldato.

## Tasks / Subtasks

- [ ] Task 1: Eseguire lo scaffold con create-better-t-stack (AC: #1, #2)
  - [ ] Eseguire, dalla root del repo (che oggi contiene solo `docs/` legacy da NON toccare):
    ```
    npx create-better-t-stack@3.37.0 . \
      --frontend next \
      --backend self \
      --database postgres \
      --orm prisma \
      --api orpc \
      --auth better-auth \
      --addons turborepo \
      --package-manager pnpm \
      --db-setup docker \
      --git \
      --install
    ```
    Se il CLI non accetta `.` come nome progetto in una directory non vuota, scaffoldare in una cartella temporanea e spostare il contenuto nella root, preservando `docs/`, `.git/`, `_bmad*/`, `.claude/`, `.github/`, `.gitignore` esistenti (non sovrascriverli).
  - [ ] Verificare che il CLI abbia prodotto un monorepo pnpm+Turborepo con `apps/web` (Next.js App Router) e la cartella `packages/` (anche se inizialmente vuota o con solo i package generati dal template — i package del design system veri e propri arrivano in Epic 2+).
  - [ ] Confermare che `--backend self` abbia montato oRPC dentro le API routes di `apps/web` (nessun servizio backend separato, coerente con AD-2 monolite fullstack).
- [ ] Task 2: Pinning versioni secondo l'Architecture Spine (AC: #2)
  - [ ] Verificare/forzare in `package.json` (root e `apps/web`) le versioni: Next.js `16.x`, React `19`, Prisma `7.9+`, Tailwind CSS `4`, TypeScript `~5.7+`, Node engine `LTS`, pnpm `10`, Turborepo `2`.
  - [ ] `@puckeditor/core` (0.22.x) NON va installato in questa story — non è nello scope di Epic 1 (arriva con l'editor in Epic 3/4). Non aggiungere dipendenze fuori scope.
  - [ ] Se create-better-t-stack installa versioni diverse da quelle pinnate, allineare manualmente via `pnpm add <pkg>@<versione>` e ri-eseguire `pnpm install`.
- [ ] Task 3: Pulizia residui legacy e verifica avvio (AC: #1, #2)
  - [ ] Verificare che nessun file/dipendenza scaffoldato faccia riferimento a JHipster o Strapi (questi esistono solo come riferimento storico in `docs/`, che resta intatto e non viene incluso nel nuovo workspace applicativo).
  - [ ] Avviare `pnpm dev` (o equivalente Turborepo) dalla root e confermare che `apps/web` risponde senza errori in dev.
  - [ ] Eseguire `pnpm build` almeno una volta per confermare che la build di produzione passa senza errori di configurazione.
- [ ] Task 4: Igiene repo (AC: #1)
  - [ ] Verificare/aggiornare `.gitignore` esistente per coprire gli artefatti tipici del nuovo stack (`.next/`, `node_modules/`, `.turbo/`, file env locali) senza duplicare regole già presenti.
  - [ ] Non modificare `.github/`, `.claude/`, `_bmad/`, `_bmad-output/` — sono infrastruttura del progetto BMAD, fuori scope di questa story.

## Dev Notes

- Questa è la **story fondativa (Epic 1, Story 1)**: non esiste ancora codice applicativo. Il workspace oggi contiene solo `docs/` (riferimento legacy Strapi/JHipster, da NON copiare né reintrodurre) più l'infrastruttura BMAD (`_bmad/`, `_bmad-output/`, `.claude/`, `.github/`). Nessuna story precedente da cui ereditare pattern.
- **Paradigma target (non ancora costruito in questa story, ma la struttura deve prepararlo):** core di dominio esagonale in `packages/domain`, layering `tokens → primitives → {puck-components, ui}`, `apps/web` come unico adapter inbound. Questa story crea solo lo scheletro monorepo (`apps/web` + `packages/`); il contenuto di `packages/domain` arriva in Story 1.2. Non anticipare la creazione di package applicativi non richiesti da questa story.
- **Non introdurre `@puckeditor/core`, Puck, o qualsiasi dipendenza dell'editor in questa story** — fuori scope, arriva in Epic 3/4. Evitare di installare pacchetti "per sicurezza" non richiesti dagli AC.
- Il comando CLI esatto e i flag sono verificati da fonti aggiornate luglio 2026 (vedi References). Se il CLI stampa un configuratore interattivo invece di rispettare i flag non-interattivi, usare `--yes` insieme ai flag espliciti, oppure rispondere al prompt selezionando le stesse opzioni.

### Project Structure Notes

- Struttura attesa dopo lo scaffold (da Architecture Spine, Structural Seed):
  ```
  page-builder/
    apps/
      web/                     # Next.js App Router — editor + render pubblico
    packages/
                                 # popolato nelle story successive (domain, tokens, primitives, puck-components, ui, commerce-provider, scripts, storybook)
  ```
- `packages/` può risultare vuota o con solo package boilerplate del template subito dopo lo scaffold: è atteso, i package del dominio/design-system sono costruiti nelle story successive (1.2 per `packages/domain`, Epic 2 per il design system).
- Nessuna variazione nota rispetto alla struttura unificata; se create-better-t-stack genera nomi di cartella diversi da `apps/web`, rinominare per allinearsi allo spine prima di procedere.

### Testing Requirements

- Nessun framework di test applicativo è richiesto da questa story (il primo caso d'uso testato arriva in Story 1.2, `packages/domain`). La verifica di questa story è operativa: `pnpm dev` e `pnpm build` devono completare senza errori — questo è il criterio di accettazione, non un test automatizzato da scrivere.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Scaffolding greenfield del workspace] — user story e acceptance criteria originali.
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — `[STARTER] Scaffolding greenfield`: versioni pinnate (create-better-t-stack 3.37.0, Next 16.x, React 19, PostgreSQL 18, Prisma 7.9+, Better Auth, oRPC, @puckeditor/core 0.22.x, Tailwind 4, Node LTS, pnpm 10, Turborepo 2).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Stack] — tabella versioni definitiva.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Structural Seed] — albero cartelle target (`apps/web`, `packages/*`).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-2] — topologia monolite fullstack, core estraibile in `packages/domain` (non ancora creato in questa story).
- Web research (luglio 2026): flag CLI `create-better-t-stack` verificati su npm/GitHub — `--frontend next --backend self --database postgres --orm prisma --api orpc --auth better-auth --addons turborepo --package-manager pnpm --db-setup docker`. Fonti: [npm](https://www.npmjs.com/package/create-better-t-stack), [GitHub AmanVarshney01/create-better-t-stack](https://github.com/AmanVarshney01/create-better-t-stack), [Quickstart](https://mintlify.wiki/amanvarshney01/create-better-t-stack/quickstart).

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
