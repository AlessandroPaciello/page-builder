---
baseline_commit: e8391fb068b633e024ecd8bebddf579dcad7af4d
---

# Story 1.2: Skeleton del core di dominio esagonale

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a sviluppatore,
I want uno scheletro di `packages/domain` con port e casi d'uso privo di dipendenze da React/HTTP,
so that la logica di dominio ha una casa unica e resta estraibile (AD-1, AD-2).

## Acceptance Criteria

1. **Given** il monorepo scaffoldato (Story 1.1) **When** creo `packages/domain` con la struttura casi d'uso + port outbound (Repository, AuditWriter, CacheInvalidator, CommerceProvider) e un caso d'uso di prova **Then** il package compila e i suoi test girano senza importare React né moduli HTTP/Next.
2. Una regola di lint/dipendenze fallisce se `packages/domain` importa da `apps/web`.

## Tasks / Subtasks

- [x] Task 1: Creare il package `packages/domain` (AC: #1)
  - [x] `packages/domain/package.json`: `"name": "@app/domain"` (namespace `@app/*`, coerente con `api`/`auth`/`db`/`env` — lo Spine riserva `@penpot-ds/*` al solo design system, vedi Story 1.1 Decision risolta). `"type": "module"`, `exports` a barrel `.`/`./*` come `packages/api` — nessuna dipendenza da React/Next/oRPC/Prisma.
  - [x] `packages/domain/tsconfig.json`: `extends: "@app/config/tsconfig.base.json"`, stesso pattern di `packages/api/tsconfig.json` (`composite`, `declaration`, `declarationMap`, `sourceMap`, `outDir: "dist"` — deferred come "cargo-cult" ma è la convenzione esistente, non introdurre una seconda convenzione).
  - [x] Struttura cartelle sotto `packages/domain/src/`:
    ```
    src/
      ports/          # interfacce outbound: Repository, AuditWriter, CacheInvalidator, CommerceProvider
      use-cases/       # casi d'uso; il primo è quello di prova richiesto dall'AC1
      index.ts         # barrel: esporta ports + use-cases pubblici
    ```
  - [x] Aggiungere `@app/domain` a `pnpm-workspace.yaml` non serve (già coperto dal glob `packages/*`); verificare che compaia in `pnpm install` come workspace package.
- [x] Task 2: Definire i port outbound come interfacce/tipi puri (AC: #1)
  - [x] `Repository`: nessuna entità concreta esiste ancora (Page/PageVersion arrivano in Story 1.3) — definire un port **generico minimo** sufficiente al caso d'uso di prova (es. `Repository<T, Id>` con `findById`/`save`), non anticipare i metodi specifici di Page/PageVersion che non hanno ancora uno schema.
  - [x] `AuditWriter`: firma allineata alla forma canonica dello Spine (AD-8) — `write(entry: { actor, action, entityType, entityId, timestamp, metadataDiff })`, **non** il blob di contenuto.
  - [x] `CacheInvalidator`: firma minima coerente con AD-9 — un metodo tipo `invalidate(key: string)` (la Story 6.2 lo specializzerà su `revalidateTag`/`revalidatePath` per slug; qui basta il contratto).
  - [x] `CommerceProvider`: firma minima coerente con AD-10 — un metodo tipo `getProduct(id: string): Promise<ProductRef>` con DTO `ProductRef`/`Price { amount, currency }` come da Spine (la Story 6.3 lo completerà; qui è il contratto segnaposto).
  - [x] Nessuna implementazione concreta di questi port in questo package (niente Prisma, niente Next `revalidateTag`, niente Shopify): sono **interfacce**, le implementazioni sono adapter outbound che arrivano nelle story successive (1.3, 5.4, 6.2/6.3). Non anticipare adapter concreti.
- [x] Task 3: Implementare il caso d'uso di prova (AC: #1)
  - [x] Un solo caso d'uso, minimo ma reale — non un placeholder vuoto: deve dipendere da almeno un port (constructor injection, no import diretto di un adapter) ed essere testabile con un doppio in-memory dei port che consuma.
  - [x] Suggerito (ma la scelta implementativa è libera purché rispetti AD-1/AD-2): un caso d'uso che scrive un record tramite `Repository` e poi una riga via `AuditWriter`, per dimostrare in un colpo solo la forma "caso d'uso + port + audit" che tutte le story successive replicheranno.
  - [x] Il caso d'uso e i suoi test **non** importano `react`, `next`, `@orpc/*`, `@app/db`/Prisma, `@app/auth`, `@app/api` — verificare con un check delle dipendenze del package (Task 4) più che a occhio.
- [x] Task 4: Introdurre il framework di test e collegarlo a Turborepo (AC: #1) — deferred da Story 1.1
  - [x] Aggiungere `vitest` come devDependency di `packages/domain` (prima introduzione di un test runner nel repo: verificare l'ultima versione stabile compatibile con TS `~6.0`/Node 22 al momento dell'implementazione, non fissare a occhio una versione).
  - [x] Script `"test": "vitest run"` in `packages/domain/package.json`.
  - [x] Aggiungere il task `test` in `turbo.json` (`dependsOn: ["^test"]`, cache abilitata di default su `test`/`vitest`) — mancava ed è esplicitamente segnalato come deferred a questa story in `_bmad-output/implementation-artifacts/deferred-work.md`.
  - [x] Aggiungere `"test": "turbo run test"` allo script `package.json` root, accanto a `lint`/`check-types`/`build`.
  - [x] Introdurre un workflow CI in `.github/workflows/` (oggi `.github/` ha solo `CODEOWNERS` e `PULL_REQUEST_TEMPLATE.md`, nessun workflow — anch'esso deferred a questa story) che esegua almeno `pnpm install`, `pnpm check-types`, `pnpm lint`, `pnpm build`, `pnpm test` su push/PR. Non introdurre step non richiesti (deploy, coverage upload, matrix multi-OS): il gate minimo è questi cinque comandi verdi.
- [x] Task 5: Regola di lint/dipendenze `packages/domain` ↛ `apps/web` (AC: #2)
  - [x] `packages/ui` ha già un precedente diretto: `packages/ui/scripts/check-boundaries.mjs`, uno script Node zero-dipendenze wired su `"lint": "node ./scripts/check-boundaries.mjs"` nel package e collegato a `turbo run lint` (già dipendenza di `build` in `turbo.json`). Riusa lo stesso pattern (scansione contenuto file con commenti rimossi, non riga-per-riga — vedi la nota nel file sorgente sul perché una scansione riga-per-riga è aggirabile da un import multi-riga) invece di introdurre un nuovo linter/dipendenza per un solo check.
  - [x] Lo script per `packages/domain` deve bloccare un import (statico o `import()` dinamico, incluso `.mts`/`.cts`) che risolve verso `apps/web` da qualunque punto di `packages/domain/src/**`, coprendo sia lo specifier per path relativo (`../../apps/web/...`) sia — se mai comparisse — uno per nome pacchetto. **Non serve** un check simmetrico "apps/web puó importare da domain": quella direzione è consentita e prevista dallo Spine (`web --> core` nel diagramma delle dipendenze).
  - [x] `"lint": "node ./scripts/check-boundaries.mjs"` in `packages/domain/package.json`, così `turbo run lint` lo esegue automaticamente su tutti i package (nessuna modifica a `turbo.json` necessaria oltre quanto già presente).
  - [x] Verificare il gate in rosso prima che in verde: aggiungere temporaneamente un import verso `apps/web` in un file di `packages/domain/src`, confermare `pnpm lint` EXIT 1, poi rimuoverlo e confermare EXIT 0.
- [x] Task 6: Verifica finale (AC: #1, #2)
  - [x] `pnpm install` dalla root non introduce errori di risoluzione workspace.
  - [x] `pnpm check-types` verde su tutti i package (ora 7, incluso `@app/domain`).
  - [x] `pnpm test` verde: i test del caso d'uso di prova passano.
  - [x] `pnpm lint` verde, incluso il nuovo check di `packages/domain`.
  - [x] `pnpm build` verde (nessuna regressione sugli altri package).

## Dev Notes

- **Cosa esiste già (Story 1.1, done):** monorepo pnpm 10 + Turborepo 2, `apps/web` (Next 16/React 19) + `packages/{api,auth,config,db,env,ui}`. Namespace **misto per design**: `@penpot-ds/*` solo per il design system (`ui`, e in futuro `tokens`/`puck-components`), `@app/*` per tutto il resto (`api`, `auth`, `config`, `db`, `env`). `packages/domain` è **infrastruttura di dominio**, non design system → usa `@app/domain`, non `@penpot-ds/*`.
- **Nessun test runner esiste ancora nel repo.** `vitest` compare nel lockfile solo come peer-dependency transitiva di un altro pacchetto, non è installato/usato da nessun package. Questa story lo introduce per la prima volta — è una decisione di stack minima (quale test runner) che lo Spine non fissa esplicitamente ma che è implicita nell'ecosistema Vite/Next/Vitest corrente; non serve nuova validazione architetturale, ma verificarne la versione corrente invece di indovinarla.
- **Pattern di package da replicare:** `packages/api` è il riferimento più vicino per struttura package TS pura in questo monorepo (`package.json` con `exports` a barrel, `tsconfig.json` che estende `@app/config/tsconfig.base.json`, script `check-types`). `packages/domain` segue lo stesso schema, aggiungendo `test`/`lint`.
- **Pattern di lint di confine da replicare, non reinventare:** `packages/ui/scripts/check-boundaries.mjs` (letto integralmente per questa story) è già la soluzione zero-dipendenze per un "questo import non deve esistere" bloccante su `turbo run lint`. È già passato per due round di code review adversariale che hanno chiuso i bypass ovvi (scansione riga-per-riga elusa da import multi-riga, mancata copertura `.mts`/`.cts`, path traversal). Copiare l'approccio (scan con commenti rimossi, non regex ingenua sulla singola riga) per il check `domain ↛ apps/web`, adattando solo il pattern del path proibito.
- **Niente Prisma/DB in questa story.** Il modello dati (Page/PageVersion/PageAssignment/AuditLog) arriva in Story 1.3. Qui i port sono interfacce pure e il caso d'uso di prova usa un doppio in-memory nei test — non collegarsi a `@app/db` né a un Postgres reale.
- **Niente oRPC/HTTP in questa story.** L'esposizione del caso d'uso tramite una procedura oRPC (con `Principal` nel context) arriva in Story 1.5. `packages/domain` non deve importare `@orpc/*`, `next`, `@app/api`.
- **Non anticipare le firme definitive dei port.** `Repository`/`CacheInvalidator`/`CommerceProvider` qui sono contratti minimi e verranno probabilmente ampliati man mano che Story 1.3 (schema dati), 6.2 (invalidazione ISR) e 6.3 (adapter commerce) concretizzano i rispettivi domini. Lo scopo di questa story è la **forma** (core esagonale, dependency inversion via port, test senza framework) non la copertura completa dei metodi.
- **Deferred work da chiudere in questa story** (da `_bmad-output/implementation-artifacts/deferred-work.md`, registrato durante la review di Story 1.1): assenza di test runner/task `test`/CI — questa story introduce entrambi (Task 4). Se, implementando, risultasse che introdurre CI in questa story è troppo ampio, discuterne esplicitamente nel Completion Note piuttosto che ometterlo silenziosamente: il deferred-work lo attribuisce esplicitamente a questa story.
- **Non toccare:** `apps/web/**` non ha bisogno di modifiche per questa story (nessun consumer del caso d'uso di prova nell'app — quello arriva con l'esposizione oRPC in Story 1.5). Se emergesse la tentazione di "collegare" il caso d'uso a una rotta per "vederlo funzionare", è fuori scope: l'AC chiede che il package compili e i test girino, non un endpoint.

### Project Structure Notes

- Struttura attesa dopo questa story (aggiunta a quanto scaffoldato in Story 1.1):
  ```
  page-builder/
    apps/web/                 # invariato in questa story
    packages/
      api/ auth/ config/ db/ env/ ui/   # esistenti (Story 1.1)
      domain/                 # NUOVO — core esagonale
        src/
          ports/              # Repository, AuditWriter, CacheInvalidator, CommerceProvider
          use-cases/          # caso d'uso di prova + suoi test
          index.ts
        scripts/
          check-boundaries.mjs  # lint bloccante: domain ↛ apps/web
        package.json           # "@app/domain"
        tsconfig.json           # extends @app/config/tsconfig.base.json
  .github/workflows/            # NUOVO — CI minima (install, check-types, lint, build, test)
  turbo.json                    # MODIFICATO — task "test" aggiunto
  package.json                  # MODIFICATO — script "test" aggiunto (root)
  ```
- Nessuna variazione nota rispetto allo Structural Seed dello Spine: `packages/domain` è esattamente il path che lo Spine assegna al core (`packages/domain/ # CORE esagonale...`).

### Testing Requirements

- Questa story introduce il **primo test automatizzato** del repo: usa `vitest` (da installare, Task 4).
- Il caso d'uso di prova deve avere almeno un test che lo esercita end-to-end con doppi in-memory dei port (niente mock di framework esterni: il punto della story è dimostrare che il core è testabile in isolamento, senza DB/HTTP/React).
- Verifica di non-regressione su `check-types`/`build`/`lint` per tutti i package esistenti, non solo `domain` — la struttura di CI introdotta in Task 4 li esegue tutti.
- Non è richiesta copertura oltre al caso d'uso di prova: niente test-suite esaustiva per port che sono ancora interfacce vuote/minime.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Skeleton del core di dominio esagonale] — user story e acceptance criteria originali.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-1] — core esagonale, unico punto di accesso al dominio, niente React/HTTP nel core.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-2] — topologia monolite fullstack, core estraibile in `packages/domain`.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-8] — forma canonica `AuditWriter`/`AuditLog` (actor/action/entityType/entityId/timestamp/metadataDiff, non il blob).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-9] — port `CacheInvalidator`, invocato post-commit.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-10] — port `CommerceProvider`, DTO `ProductRef`/`Price{amount,currency}`.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Structural Seed] — albero cartelle target, `packages/domain` come CORE.
- [Source: _bmad-output/implementation-artifacts/1-1-scaffolding-greenfield-del-workspace.md#Dev Agent Record] — pattern package (`packages/api`), pattern lint di confine (`packages/ui/scripts/check-boundaries.mjs`), namespace `@app/*` vs `@penpot-ds/*`, versioni correnti (Node 22.23.1 via nvm, pnpm 10.33.0, TypeScript ~6.0).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 1-1-scaffolding-greenfield-del-workspace (2026-07-26)] — assenza di test/CI esplicitamente rimandata a questa story.
- [Source: _bmad-output/specs/spec-page-builder/glossary.md] — vocabolario di dominio (Page, PageVersion, Payload, Audit trail) per coerenza nominale, anche se le entità concrete arrivano in Story 1.3.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-dev-story)

### Debug Log References

- `pnpm test` (turbo): 1 file, 1 test, verde — `packages/domain/src/use-cases/create-note.test.ts`.
- `pnpm check-types` (turbo): verde su 7 package incluso `@app/domain` (fix necessario: rimossi suffissi `.ts` dagli import relativi, non consentiti da `verbatimModuleSyntax`/`moduleResolution: bundler` senza `allowImportingTsExtensions` — coerente con la convenzione già in uso in `packages/api`).
- `pnpm lint` (turbo): verde, incluso `packages/domain/scripts/check-boundaries.mjs`. Verificato anche il gate in rosso: aggiunto temporaneamente `import { x } from "../../apps/web/lib/foo"` in `src/ports/repository.ts` → `node ./scripts/check-boundaries.mjs` EXIT 1; rimosso → EXIT 0.
- `pnpm build` (turbo): verde, nessuna regressione su `web`/`@penpot-ds/ui`.
- Versioni installate al momento dell'implementazione: `vitest@5.0.0`, `vite@8.2.2` (peer non-opzionale di vitest, non menzionato esplicitamente nella story ma richiesto per l'installazione).

### Completion Notes List

- Creato `packages/domain` (`@app/domain`) come core esagonale: `ports/` (Repository generico, AuditWriter in forma AD-8, CacheInvalidator AD-9, CommerceProvider AD-10) + `use-cases/create-note.ts` (caso d'uso di prova che dimostra "caso d'uso + port + audit" con dependency injection via costruttore) + barrel `index.ts`.
- Test del caso d'uso con doppi in-memory di `Repository` e `AuditWriter`, nessun import di `react`/`next`/`@orpc/*`/`@app/db`/`@app/auth`/`@app/api` (AC#1 verificato sia dal test che dal check-boundaries).
- Introdotto per la prima volta nel repo un test runner: `vitest` (deferred da Story 1.1). Aggiunto task `test` a `turbo.json` (`dependsOn: ["^test"]`) e script `test` al `package.json` root.
- Copiato il pattern zero-dipendenze di `packages/ui/scripts/check-boundaries.mjs` in `packages/domain/scripts/check-boundaries.mjs`, adattato per bloccare qualunque import verso `apps/web` da `packages/domain/src/**` (AC#2). Gate verificato sia in rosso che in verde.
- Introdotto `.github/workflows/ci.yml` (deferred da Story 1.1): esegue `pnpm install --frozen-lockfile`, `pnpm check-types`, `pnpm lint`, `pnpm build`, `pnpm test` su push a `main` e su ogni PR.
- Nessuna implementazione concreta dei port aggiunta (niente Prisma/Next/Shopify): sono interfacce pure, come richiesto — le implementazioni arrivano nelle story successive (1.3, 5.4, 6.2/6.3).
- `apps/web` non è stato toccato: nessun consumer del caso d'uso di prova, come da Dev Notes ("Non toccare").

### File List

- `packages/domain/package.json` (nuovo)
- `packages/domain/tsconfig.json` (nuovo)
- `packages/domain/src/index.ts` (nuovo)
- `packages/domain/src/ports/repository.ts` (nuovo)
- `packages/domain/src/ports/audit-writer.ts` (nuovo)
- `packages/domain/src/ports/cache-invalidator.ts` (nuovo)
- `packages/domain/src/ports/commerce-provider.ts` (nuovo)
- `packages/domain/src/use-cases/create-note.ts` (nuovo)
- `packages/domain/src/use-cases/create-note.test.ts` (nuovo)
- `packages/domain/scripts/check-boundaries.mjs` (nuovo)
- `.github/workflows/ci.yml` (nuovo)
- `turbo.json` (modificato — aggiunto task `test`)
- `package.json` (modificato — aggiunto script `test` root)
- `pnpm-lock.yaml` (modificato — nuove dipendenze `vitest`/`vite` per `@app/domain`, nuovo workspace package)

## Change Log

- 2026-09-05 — Story creata da bmad-create-story a partire da epics.md, Architecture Spine, Story 1.1 (dev record + deferred-work.md).
- 2026-09-05 — Implementazione completa (bmad-dev-story): `packages/domain` con port + caso d'uso di prova, `vitest` introdotto, boundary check `domain ↛ apps/web`, CI GitHub Actions. Tutti i task completati, `pnpm install`/`check-types`/`test`/`lint`/`build` verdi. Status → review.
- 2026-09-05 — Code review adversariale (bmad-code-review, 3 layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor): 1 decision-needed, 11 patch, 2 defer, 6 dismiss.
- 2026-09-05 — Fix da code review: FORBIDDEN esteso a `web`/`react`/`next`/`@orpc/*`/`@app(db,auth,api)` + backtick + confine di segmento; rete secondaria quote-independent e guard "nessun file scannerizzato" in check-boundaries.mjs; CI con SKIP_ENV_VALIDATION, permissions, concurrency, pnpm da packageManager; metadataDiff senza blob (AD-8); vite/vitest nel catalog. Verifiche: gate rosso/verde (path, `web`, `react`, desync regex, commento non chiuso, src assente), test/check-types/lint/build tutti verdi. Status → done.

### Review Findings

- [x] [Review][Decision] Estendere il gate di confine oltre `apps/web` (react/next/@orpc/@app/db|auth|api) — Risolto 2026-09-05 (scelta utente): `FORBIDDEN` esteso a `web` (nome pacchetto di apps/web), `react`, `next`, `@orpc/*`, `@app/db|auth|api` in `check-boundaries.mjs`.
- [x] [Review][Patch] CI: `pnpm build` fallirà al primo run — env validation senza SKIP_ENV_VALIDATION [.github/workflows/ci.yml:32] — Risolto: `SKIP_ENV_VALIDATION: "1"` a livello job nel workflow (l'env di build non è un input della pipeline).
- [x] [Review][Patch] Gate di confine non copre l'import per nome pacchetto `from "web"` [packages/domain/scripts/check-boundaries.mjs:37] — Risolto: pattern `/["'`]web(?:\/...)?["'`]` aggiunto; gate verificato in rosso su `from "web"`.
- [x] [Review][Patch] Regex literal desincronizza lo scanner e può nascondere import reali [packages/domain/scripts/check-boundaries.mjs:71] — Risolto: rete secondaria quote-independent (`/\/apps\/web(?:\/...)?/`) + rilevamento commento di blocco non chiuso → exit 1. PoC desincronizzato ora bloccato; limiti residui documentati nell'header.
- [x] [Review][Patch] `readdirSync` fallito salta silenziosamente una directory [packages/domain/scripts/check-boundaries.mjs:110] — Risolto: ogni fallimento di readdirSync/realpathSync/statSync/readFile finisce in `scanErrors` → exit 1.
- [x] [Review][Patch] `metadataDiff` porta il blob di contenuto, contro AD-8 e il proprio doc comment [packages/domain/src/use-cases/create-note.ts:36] — Risolto: `metadataDiff: { contentLength }` + test che asserisce l'assenza del blob dall'entry.
- [x] [Review][Patch] Falsi positivi: substring `apps/web` senza confine di segmento [packages/domain/scripts/check-boundaries.mjs:37] — Risolto: il match richiede che `apps/web` stia subito dopo la virgoletta o dopo uno slash; PoC "myapps/webhook" verde.
- [x] [Review][Patch] Gate verde vacuo se `src/` è assente [packages/domain/scripts/check-boundaries.mjs:22] — Risolto: guard `scannedFileCount === 0` → exit 1 ("nessun file scannerizzato"); verificato rinominando `src/`.
- [x] [Review][Patch] Specifier tra backtick non coperto [packages/domain/scripts/check-boundaries.mjs:37] — Risolto: classe `["'`]` (con backtick) in tutti i pattern specifier.
- [x] [Review][Patch] Versione pnpm duplicata tra CI e `packageManager` [.github/workflows/ci.yml:16] — Risolto: `version:` rimosso da pnpm/action-setup (l'action legge `packageManager`).
- [x] [Review][Patch] CI senza `permissions` hardening né `concurrency` group [.github/workflows/ci.yml] — Risolto: `permissions: contents: read` + `concurrency` con cancel-in-progress.
- [x] [Review][Patch] vitest/vite pinned ad-hoc invece che nel catalog [packages/domain/package.json:20] — Risolto: voci `vite`/`vitest` aggiunte al catalog di `pnpm-workspace.yaml`, riferite via `catalog:`.
- [x] [Review][Defer] save-then-audit senza atomicità [packages/domain/src/use-cases/create-note.ts:29-36] — deferred, pre-existing: se `auditWriter.write` fallisce resta una mutazione persistita non tracciata (e il retry duplica la nota). Problema architetturale reale per le story con mutazioni vere (1.3+/5.4), non per il caso d'uso di prova.
- [x] [Review][Defer] Create senza check di id duplicato [packages/domain/src/use-cases/create-note.ts:29] — deferred, pre-existing: un `input.id` già presente sovrascrive in silenzio (upsert) con audit `note.created`. Serve una semantica di entità reale che arriva con lo schema dati (Story 1.3).
