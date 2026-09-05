---
baseline_commit: 821afa227d73ee674b4f004c2414b6d10226ecb0
---

# Story 1.3: Modello dati e invariante di pubblicazione a livello DB

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a sviluppatore,
I want le entità Page, PageVersion, PageAssignment, AuditLog con le relative migration,
so that il dominio ha persistenza e l'invariante ≤1 pubblicata è garantito dal DB (AD-7).

## Acceptance Criteria

1. **Given** Prisma configurato su PostgreSQL **When** definisco lo schema (Page/PageVersion/PageAssignment/AuditLog, payload jsonb, status enum) e aggiungo una migration SQL esplicita con indice univoco parziale `UNIQUE(page_id) WHERE status='PUBLISHED'` **Then** `prisma migrate deploy` applica lo schema e l'indice parziale.
2. Un tentativo di inserire una seconda PageVersion PUBLISHED per la stessa Page è rifiutato dal DB.

## Tasks / Subtasks

- [x] Task 1: Definire il modello dati in `packages/db/prisma/schema/schema.prisma` (AC: #1)
  - [x] Modelli `Page`, `PageVersion`, `PageAssignment`, `AuditLog` + enum `PageStatus` (DRAFT/PUBLISHED/ARCHIVED) e `PageVersionStatus` (DRAFT/PUBLISHED), con `@@map` snake_case coerente con `auth.prisma` (`page`, `page_version`, `page_assignment`, `audit_log`, `page_status`, `page_version_status`) — vedi Dev Notes "Forma del modello" per i campi minimi.
  - [x] `Page.slug` unico (`@@unique`); `PageVersion.versionNumber` con `@@unique([pageId, versionNumber])` (AD-6: allocato dal core, vincolo a livello DB).
  - [x] `PageVersion.payload` colonna `Json` (jsonb) — forma Puck `{content, root, zones}` con `schemaVersion` persistita 1:1, nessuna normalizzazione (AD-6).
  - [x] `AuditLog` in forma canonica AD-8: `actor` (string, userId), `action`, `entityType`, `entityId`, `timestamp`, `metadataDiff Json` — **senza** FK al payload né blob di contenuto.
  - [x] `PageAssignment` collega `Page` e `User` (l'esistente modello `User` di `auth.prisma`, non duplicarlo): `@@unique([pageId, userId])`, onDelete Cascade lato `page`, `SetNull` (o Cascade, decisione documentata) lato `user`.
  - [x] Non toccare i modelli `User`/`Session`/`Account`/`Verification` di `auth.prisma` (appartengono a Better Auth, Story 1.4 li estenderà per i ruoli).
- [x] Task 2: Migration con indice univoco parziale via SQL esplicito (AC: #1)
  - [x] Avviare il Postgres di dev (`pnpm db:start` da `packages/db`) e creare la migration: `prisma migrate dev --create-only --name page_data_model`, poi **editare il SQL a mano** per sostituire l'indice parziale: `CREATE UNIQUE INDEX "page_version_published_unique" ON "page_version" ("page_id") WHERE status='PUBLISHED';`
  - [x] **NON usare il preview feature `partialIndexes` di Prisma** (`@@unique([...], where: ...)`): AD-7 richiede una garanzia autoritativa **indipendente dallo stato preview del DSL ORM** — l'indice parziale vive nel SQL della migration, non nello schema DSL (vedi Dev Notes "Perché SQL esplicito e non il preview feature").
  - [x] Applicare con `prisma migrate dev` (in dev) e verificare che `prisma migrate deploy` su un DB pulito produca lo stesso stato (il percorso di release, Story 1.6).
  - [x] Verificare che `prisma migrate dev` successivo non cerchi di "driftare" l'indice: l'indice creato via SQL esplicito non compare nello schema DSL — se Migrate segnala drift, gestirlo con la convenzione documentata (es. `migrate dev` su basi da zero non rigenera l'indice → verificare che la migration iniziale sia l'unica fonte; vedi Dev Notes "Pitfall drift").
- [x] Task 3: Test di integrazione che dimostra il rifiuto DB (AC: #2)
  - [x] Aggiungere `vitest` a `packages/db` (via `catalog:` in `pnpm-workspace.yaml`, stesso pattern di `@app/domain` — non pinnare ad-hoc) e script `"test": "vitest run"`.
  - [x] Un test di integrazione (richiede Postgres reale via docker compose, non in-memory) che: crea una Page, due PageVersion DRAFT; promuove la prima a PUBLISHED (UPDATE); tenta di promuovere anche la seconda → **attende un errore DB** (violazione unique `P2002` da Prisma) e asserisce che la prima resta l'unica PUBLISHED. Uso di `prisma.$executeRaw`/client: indifferente, purché il conflitto arrivi dal DB.
  - [x] Test aggiuntivo minimale per `versionNumber`: seconda versione con lo stesso `versionNumber` per la stessa pagina → rifiutata (UNIQUE(page_id, version_number), AD-6).
  - [x] Collegare il test a `turbo run test` (già esistente, `dependsOn: ["^test"]`) e al workflow CI (vedi Task 5).
- [x] Task 4: Chiusura deferred work registrata a questa story (da `deferred-work.md`)
  - [x] **`check-types`/`build` senza dipendenza da `db:generate`** — dopo questa story lo schema evolve e il client generato (committato in `packages/db/prisma/generated/`) può essere stale. Fix minimale: rendere reale la dipendenza, es. `"check-types": "prisma generate && tsc --noEmit"` in `packages/db` e/o `@app/db#db:generate` come dependency turbo di `check-types`/`build` per i consumer. Scegliere l'opzione più semplice che rende impossibile il client stale.
  - [x] **Atomicità save-then-audit** (`create-note.ts`) e **semantica id duplicato** — decisione richiesta: con lo schema ora esistente, documentare in `deferred-work.md` la strategia scelta (es. transazione DB del repository concreto in Story 4.2 + audit nella stessa transazione) oppure risolvere qui se emerga un repository concreto. Almeno un aggiornamento esplicito di `deferred-work.md` che ri-miri le due voci (non lasciarle puntate vagamente a "Story 1.3" se qui non vengono risolte).
- [x] Task 5: CI e verifica finale (AC: #1, #2)
  - [x] Estendere `.github/workflows/ci.yml` con un job (o service container `postgres:18`) che applichi le migration (`prisma migrate deploy`) e esegua il test di integrazione dell'invariante — AD-7 chiede gate in CI. NB: `SKIP_ENV_VALIDATION` è già in uso; `DATABASE_URL` per il job deve puntare al service container.
  - [x] `pnpm install`, `pnpm check-types`, `pnpm test`, `pnpm lint`, `pnpm build` verdi in locale (comandi già scriptati in root).

## Dev Notes

- **Cosa esiste già (Story 1.1/1.2 done):** `packages/db` (`@app/db`) con Prisma 7.9 (generator `prisma-client`, output `../generated`, `moduleFormat esm`, adapter `@prisma/adapter-pg` + `pg`), schema **split in due file** (`schema/schema.prisma` per il generatore, `schema/auth.prisma` per Better Auth), `prisma.config.ts` che legge `DATABASE_URL` da `apps/web/.env` (env già esportata vince), client generato **committato**, docker compose dev con `postgres:18` (porta host `5432` hardcoded — limite noto, non toccare salvo necessità). `packages/domain` (`@app/domain`) ha i port `Repository` (generico, `findById`/`save`), `AuditWriter` (forma AD-8), `CacheInvalidator`, `CommerceProvider` come **interfacce pure**; nessuna implementazione concreta (volutamente, Story 1.2).
- **Perché SQL esplicito e non il preview feature:** Prisma 7 supporta gli indici parziali (`@@unique([...], where: raw(...))`) ma **solo dietro il flag `partialIndexes` preview**. AD-7 fissa che l'invariante sia garantito da "migration SQL esplicita — garanzia autoritativa a livello DB indipendente dallo stato preview del DSL ORM". Quindi: indice **fuori** dallo schema DSL, dentro il SQL della migration. Nota tecnica: un filtered unique index in Postgres si crea come `CREATE UNIQUE INDEX ... WHERE` (non come constraint di tabella) — coerente con quanto Prisma stesso emette. Fonte: [prisma.io/docs/orm/prisma-schema/data-model/indexes#configuring-partial-indexes-with-where].
- **Pitfall drift:** l'indice parziale creato via SQL esplicito non è rappresentato nello schema DSL, quindi `prisma migrate dev` può segnalarlo come drift o tentarne la rimozione in migration successive. Mitigazioni accettabili: tenere l'indice in una migration dedicata e verificare con `prisma migrate dev` che nessun nuovo step lo tocchi; se il differ lo elimina, è il segnale che il preview feature è attivo o che il differ rigenera — rimuovere la causa, non accontentarsi. Verificare esplicitamente questo punto in Task 2 (non è opzionale).
- **Forma del modello (campi minimi, estendibili in Epic 4/5):**
  - `Page`: `id String @id` (default Prisma/cuid, come `auth.prisma`), `slug String @unique`, `title String`, `status PageStatus @default(DRAFT)`, `createdAt/updatedAt` come da convenzione `auth.prisma`. Metadati SEO ulteriori: solo se gratuiti — la Story 6.1 li consumerà; non progettare oltre il necessario.
  - `PageVersion`: `pageId` + relazione verso `Page` (Cascade), `versionNumber Int`, `status PageVersionStatus @default(DRAFT)`, `payload Json`, `createdAt`. Nessuna mutazione in-place prevista a livello dominio (AD-12) ma il DB non la impedisce — è il core che lo garantisce.
  - `PageAssignment`: `pageId` + `userId` → `User` (relazione cross-file nello stesso schema dir: referenziare il modello `User` definito in `auth.prisma`), `@@unique([pageId, userId])`.
  - `AuditLog`: nessuna relazione (actor è `String` = userId, forma canonica AD-8); `@@index` su `entityType/entityId` e/o `timestamp` per la consultazione Admin (Story 5.4).
- **Nomenclatura:** le convenzioni dello Spine (Consistency Conventions) chiamano le entità `Page`/`PageVersion`/`PageAssignment`/`AuditLog` e gli enum `PageStatus`/`PageVersionStatus`. Mappe snake_case in DB per coerenza con `auth.prisma` (`@@map`).
- **Nessun repository concreto in questa story.** L'AC è schema+migration+invariante DB. Il primo repository concreto (adapter Prisma che implementa il port `Repository` del core) e i casi d'uso di mutazione arrivano con le story che ne hanno bisogno (4.2 save, 5.1 publish). Non anticipare: un repository scritto prima dei casi d'uso invariabilmente indovina male i metodi (lezione esplicita della Story 1.2, Task 2).
- **Test DB richiede Postgres reale:** l'invariante è del DB, non simulabile in-memory. Docker compose di `packages/db` è il riferimento locale. In CI usare un service container (non un DB in-memory). Se `DATABASE_URL` manca, il test deve fallire chiaramente (no skip silenzioso che farebbe passare verdi gate vacui — stesso principio del guard "nessun file scannerizzato" della Story 1.2).
- **Pattern test da replicare:** `packages/domain/src/use-cases/create-note.test.ts` (vitest, doppi in-memory) è l'unico precedente; qui il test è di integrazione (DB reale), quindi diverso per natura — ma mantenere le convenzioni (file `.test.ts` accanto al codice o in una cartella di test del package).
- **Non toccare:** `packages/domain` (nessuna modifica richiesta dagli AC — Task 4 è solo aggiornamento di `deferred-work.md`), `apps/web` (nessun consumer), `packages/auth` (i ruoli arrivano in Story 1.4), le versioni pinnate dello Spine.

### Project Structure Notes

- File interessati:
  ```
  packages/db/
    prisma/schema/schema.prisma        # MODIFICATO — modelli dominio
    prisma/migrations/                  # NUOVO — prima migration (creata da prisma, SQL editato a mano)
    package.json                        # MODIFICATO — devDep vitest, script test, eventuale check-types con generate
    (tests di integrazione)             # NUOVO
  pnpm-workspace.yaml                   # MODIFICATO solo se vitest non è già in catalog (lo è: ^5.0.0)
  turbo.json                            # MODIFICATO solo se si sceglie la variante turbo per la dipendenza db:generate
  .github/workflows/ci.yml              # MODIFICATO — service postgres + gate migration/invariante
  _bmad-output/implementation-artifacts/deferred-work.md  # MODIFICATO — aggiornamento voci mirate
  ```
- Allineamento allo Structural Seed: tutto vive in `packages/db` (adapter persistenza) — nessun file nuovo fuori dal package salvo CI e deferred-work. Nessun conflitto rilevato con lo Spine.

### Testing Requirements

- Test di integrazione DB: il rifiuto del secondo PUBLISHED (AC#2) e il rifiuto del `versionNumber` duplicato sono **obbligatori e verificati contro il DB reale** (postgres:18 via docker in dev, service container in CI).
- Verifica di non-regressione: `check-types`/`build`/`lint` verdi su tutti i package (il client generato cambia → rigenerare e committare; `pnpm build` di `web` deve restare verde).
- Il gate dell'invariante in CI deve essere **rosso per assenza di DB/migration** se l'infrastruttura manca — mai verde vacuo.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Modello dati e invariante di pubblicazione a livello DB] — user story e AC originali.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-6] — forma payload `{content,root,zones}` + `schemaVersion` in colonna `Json`; block-id client-owned; `versionNumber` core-owned con `UNIQUE(page_id, version_number)`.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-7] — indice univoco parziale via migration SQL esplicita; transazioni publish/rollback/archive che accoppiano `Page.status`↔`PageVersion.status`.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-8] — forma canonica `AuditLog` (actor/action/entityType/entityId/timestamp/metadataDiff, non il blob).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-12] — ogni salvataggio = nuova PageVersion DRAFT, mai mutazione in-place (vincolo di dominio, non DB).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Consistency Conventions] — naming entità/enum e regola "id/date default Prisma/Postgres".
- [Source: _bmad-output/specs/spec-page-builder/glossary.md] — definizioni Page (slug univoco, metadati SEO, lifecycle), PageVersion (numero progressivo, stato, payload), Payload, Audit trail.
- [Source: _bmad-output/implementation-artifacts/1-2-skeleton-del-core-di-dominio-esagonale.md#Dev Agent Record] — pattern vitest via catalog, CI esistente, lezioni (gate rosso/verde, metadataDiff senza blob).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — voci da chiudere/ri-mirare in questa story: `db:generate` non nei gate turbo; atomicità save-then-audit; semantica id duplicato; docker compose porta 5432 hardcoded (non in scope).
- [Source: prisma.io/docs/orm/prisma-schema/data-model/indexes#configuring-partial-indexes-with-where] — Prisma 7: indici parziali supportati solo con preview feature `partialIndexes`; su PostgreSQL filtered unique = `CREATE UNIQUE INDEX ... WHERE`.

## Dev Agent Record

### Agent Model Used

GLM (opencode-go/glm-5.3-flash), 2026-09-05

### Debug Log References

- Migration creata con `prisma migrate dev --create-only --name page_data_model` ed editata a mano (indice parziale in coda al SQL), poi applicata con `prisma migrate dev`: "Your database is now in sync".
- **Pitfall drift verificato**: secondo `prisma migrate dev` consecutivo → "Already in sync, no schema change or pending migration was found"; l'indice sopravvive. Verifica anche con `prisma db pull --print`: l'introspezione di Prisma 7 rappresenta l'indice come `@unique(map: "page_version_published_unique", where: raw("status = 'PUBLISHED'"))`, ma il differ di Migrate non genera DROP (nessun preview feature attivo).
- **Percorso release verificato**: DB vuoto dedicato (`page_builder_deploy_test`, poi droppato) + `prisma migrate deploy` → tutte le migration applicate, indice parziale presente in `pg_indexes`.
- **Validazione rosso/verde del test**: con `DROP INDEX "page_version_published_unique"` il test dell'invariante fallisce (il secondo PUBLISH passa, atteso P2002); ricreato l'indice, torna verde. Nessun gate vacuo.
- DB di dev resettato (consenso utente esplicito: Prisma 7 richiede `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`): lo storico migration parte da zero, la `page_data_model` è la migration iniziale.
- `apps/web/next-env.d.ts` modificato come side-effect di `next build` → ripristinato (`git checkout`), fuori scope.

### Completion Notes List

- **AC#1**: schema con `Page`/`PageVersion`/`PageAssignment`/`AuditLog` + enum `PageStatus`/`PageVersionStatus`, tabelle mappate snake_case (`@@map`) coerenti con `auth.prisma`; colonne restano camelCase come in `auth.prisma`. Migration iniziale `20260905162824_page_data_model` con l'indice univoco parziale in SQL esplicito (fuori dal DSL, no preview feature): `CREATE UNIQUE INDEX "page_version_published_unique" ON "page_version"("pageId") WHERE status = 'PUBLISHED'`.
- **AC#2**: test di integrazione `packages/db/tests/invariants.integration.test.ts` (vitest via `catalog:`, Postgres reale docker): promozione di una seconda PageVersion a PUBLISHED → `P2002`, la prima resta unica PUBLISHED. Test aggiuntivo: `versionNumber` duplicato per la stessa pagina → `P2002` (AD-6). Guard esplicito: senza `DATABASE_URL` il test fallisce, non salta.
- **Decisione documentata onDelete su `PageAssignment.user`**: scelto **Cascade** (non SetNull) — un assegnamento verso un utente inesistente è privo di significato e l'audit storico compete ad `AuditLog` (AD-8), non alle righe di assegnamento vive.
- **Modifica minimale a `auth.prisma`**: aggiunto solo il back-relation `assignments PageAssignment[]` su `User` (richiesto dal DSL Prisma per la relazione cross-file; nessuna colonna nuova, comportamento Better Auth invariato). Gli altri modelli Better Auth non toccati.
- **Payload**: test usano la forma Puck `{schemaVersion: 1, content: [], root: {}, zones: {}}` (AD-6, persistito 1:1).
- **Task 4**: `deferred-work.md` aggiornato — voce `db:generate` marcata RISOLTA (`check-types` di `@app/db` ora esegue `prisma generate && tsc --noEmit`, quindi i gate turbo `check-types`/`build` dei consumer girano sempre su client fresco); le due voci save-then-audit e semantica id duplicato ri-mirate esplicitamente a **Story 4.2** (primo repository concreto con transazione DB; i vincoli univoci di schema ora forniscono la base per i P2002 mappati).
- **Task 5 CI**: service container `postgres:18` nel job `ci` (credenziali allineate al placeholder `DATABASE_URL` esistente), step `prisma migrate deploy` prima di `pnpm test`; task turbo `test` con `cache: false` + `env: [DATABASE_URL]` (il test dipende dallo stato reale del DB, la cache di turbo potrebbe mascherarlo).
- Client Prisma rigenerato e committato (nuovi modelli in `prisma/generated/models/`).

### File List

- packages/db/prisma/schema/schema.prisma (modificato — modelli dominio + enum)
- packages/db/prisma/schema/auth.prisma (modificato — solo back-relation `assignments` su `User`)
- packages/db/prisma/migrations/20260905162824_page_data_model/migration.sql (nuovo — migration iniziale con indice parziale esplicito)
- packages/db/package.json (modificato — vitest catalog, script test, check-types con prisma generate)
- packages/db/tests/invariants.integration.test.ts (nuovo — test integrazione AD-6/AD-7; esteso in code review con 3 test nuovi e hardening)
- packages/db/prisma/generated/** (rigenerato e committato)
- pnpm-lock.yaml (modificato — vitest in @app/db)
- turbo.json (modificato — task test: cache false, env DATABASE_URL; build: ^check-types; db:push task invariato)
- packages/db/package.json (modificato anche in review — guard esplicito su db:push)
- README.md (modificato in review — db:migrate al posto di db:push, voce script annotata)
- .github/workflows/ci.yml (modificato — service postgres:18 + migrate deploy)
- _bmad-output/implementation-artifacts/deferred-work.md (modificato — 3 voci aggiornate)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modificato — stato story)

### Change Log

- 2026-09-05: Story 1.3 implementata — modello dati Page/PageVersion/PageAssignment/AuditLog, migration iniziale con indice univoco parziale esplicito (AD-7), test di integrazione rosso/verde dell'invariante e di `versionNumber` (AD-6), vitest in `@app/db`, gate migration+invariante in CI, `check-types` con `prisma generate`, deferred-work ri-mirato a Story 4.2.
- 2026-09-05: Code review adversariale (bmad-code-review, 3 layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor): 1 decision-needed, 5 patch, 3 defer, 16 dismiss. Decision risolta (db:push neutro, scelta Alessandro), tutte le 5 patch applicate e verificate: guard su `db:push` (eliminerebbe l'indice parziale AD-7), test sull'esistenza dell'indice con predicate parziale su `pg_indexes`, test dei percorsi legali (due Page con una PUBLISHED ciascuna + rotazione published), pin del constraint DB nelle asserzioni P2002 (via `meta.driverAdapterError.cause.originalMessage`, `meta.target` è vuoto con i driver adapter), hardening del test (costante prefisso, cleanup `beforeAll`, try/finally `afterAll`, timeout 30s), `turbo.json` `build.dependsOn` += `^check-types`. README aggiornato (`db:migrate` al posto di `db:push`, voce script annotata). Verifiche: `pnpm run db:push` fallisce con messaggio esplicito AD-7; `check-types`/`lint`/`build`/`test` tutti verdi (5 test @app/db passati). Status → done.
- 2026-09-05: Re-run code review (seconda passata su diff con patch): Auditor **PASS** con verifica empirica indipendente (db:push guard eseguito, indice parziale via psql, `migrate deploy` su DB pulito, drift `migrate dev` assente, tutti i gate verdi). Seconda passata: 0 decision-needed, 3 patch applicate (timeout sugli hook beforeAll/afterAll, assert per-pageId invece di prefix-wide nel test due-Page, test di concorrenza `Promise.allSettled` su doppio PUBLISHED — esattamente uno vince), 16 finding smontati (già deferred nella prima passata / falsi positivi — dotenv e PrismaPg sono dipendenze esistenti di @app/db / fuori scope spec — cascade e forma minimale / cosmetic). 6 test @app/db verdi su 3 run consecutivi; `check-types`/`lint`/`build`/`test` verdi. Status resta done.

### Review Findings

_Code review adversariale del 2026-09-05 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Base diff: delta non committato (`git diff HEAD` + file nuovi), esclusi i file generati e il lockfile. 1 decision-needed, 5 patch, 3 defer, 16 finding smontati come falsi positivi/vincoli di spec._

- [x] [Review][Decision] **RISOLTO (scelta Alessandro: rimuovere/neutro)** — `db:push` può droppare l'indice parziale esplicito — `packages/db/package.json` mantiene lo script `db:push` (`prisma db push`), che sincronizza il DB con lo schema DSL: l'indice `page_version_published_unique` non esiste nel DSL, quindi un `db:push` lo considererebbe drift e lo eliminerebbe, disattivando AD-7 senza alcun errore visibile. Lo stesso vale per `db:push` lanciato per errore in ambienti non-dev. Serve una decisione: rimuovere/aggiungere guard allo script, oppure lasciare e documentare il divieto.
- [x] [Review][Patch] Test: asserire l'esistenza dell'indice parziale con il suo predicate [packages/db/tests/invariants.integration.test.ts] — nessuna asserzione verifica che `page_version_published_unique` sia *parziale*: un indice globale `UNIQUE(pageId)` passerebbe tutti i test rendendo impossibile pubblicare una seconda pagina in tutto il sistema. Aggiungere un check su `pg_indexes`/`pg_get_indexdef` che verifichi la presenza del `WHERE status = 'PUBLISHED'`.
- [x] [Review][Patch] Test: coprire i percorsi legali dell'indice [packages/db/tests/invariants.integration.test.ts] — mancano i casi che l'indice deve *consentire*: due Page diverse con una PUBLISHED ciascuna (deve passare) e rotazione published→unpublish→publish della seconda versione della stessa Page (deve passare). Senza il primo, un indice globale non viene smascherato; senza il secondo, il core non potrebbe mai ruotare la versione live.
- [x] [Review][Patch] Pin del target nelle asserzioni P2002 [packages/db/tests/invariants.integration.test.ts] — `rejects.toMatchObject({ code: "P2002" })` matcha *qualsiasi* violazione unique (anche `page_slug_key`): asserire `meta.target` (`page_version_published_unique` per AD-7, `page_version_pageId_versionNumber_key` per AD-6) così il test non può passare vacuamente contro il vincolo sbagliato.
- [x] [Review][Patch] Hardening del test: prefisso slug come costante, cleanup in `beforeAll`, try/finally in `afterAll`, timeout espliciti [packages/db/tests/invariants.integration.test.ts] — il prefisso `"test-invariant-"` è duplicato in due punti; manca il cleanup in `beforeAll` (righe orfane se il run precedente è stato killato); in `afterAll` se il `deleteMany` lancia, `$disconnect` non viene mai chiamata; senza timeout esplicito (default vitest 5s) un DB freddo in CI produce flake.
- [x] [Review][Patch] `turbo build` non dipende da `^check-types`: la voce deferred-work chiusa è sovrastimata [turbo.json:13-14] — il deferred-work dichiara "ogni `turbo run check-types`/`build` (che dipendono da `^check-types`) rigenera il client", ma `build` dipende solo da `["^build", "lint"]`: `turbo run build` da solo NON rigenera mai il client di `@app/db` (che non ha script `build`). Task 4 chiedeva di rendere impossibile il client stale anche per build. Fix: aggiungere `"^check-types"` a `build.dependsOn`.
- [x] [Review][Defer] Check di drift schema↔migrations in CI [.github/workflows/ci.yml] — deferred, pre-existing: un passo `prisma migrate diff --from-migrations ... --exitcode` fermerebbe lo schema che evolve senza migration committata; oggi il drift viene scoperto solo al deploy.
- [x] [Review][Defer] Nessun CHECK su `versionNumber` [packages/db/prisma/schema/schema.prisma] — deferred, pre-existing: `versionNumber Int` accetta 0/negativi; `CHECK (versionNumber >= 1)` costerebbe una riga ma non è richiesto dalla forma minimale di spec (l'allocazione è del core, AD-6).
- [x] [Review][Defer] Nessuna verifica di lockstep del client generato committato [packages/db/prisma/generated/] — deferred, pre-existing: `check-types` rigenera in place, quindi un client committato stale non viene mai smascherato (la rigenerazione lo ripara silenziosamente); un `prisma generate && git diff --exit-code packages/db/prisma/generated` in CI renderebbe la convenzione "client committato" verificata.

#### Seconda passata (2026-09-05, re-run su diff con patch applicate)

_Auditor: **PASS** — tutte le 6 patch della prima passata verificate empiricamente (db:push guard eseguito, indice parziale confermato via psql, test percorsi legali verdi, pin P2002 confermato, hardening presente, build.dependsOn corretto; AC#1/AC#2 verificati su DB pulito con `migrate deploy`, drift `migrate dev` confermato assente). 0 decision-needed, 3 patch applicate, 16 finding smontati (già deferred / falsi positivi / fuori scope spec)._

- [x] [Review][Patch] Hook `beforeAll`/`afterAll` senza timeout esplicito [packages/db/tests/invariants.integration.test.ts] — il default hook (5-10s) ha la stessa motivazione "DB freddo" dei test; passato `DB_TIMEOUT`.
- [x] [Review][Patch] Assert prefix-wide nel test due-Page [packages/db/tests/invariants.integration.test.ts] — `findMany` con `slug startsWith` conterebbe le fixture di un run parallelo sullo stesso DB; scope ai `pageId` creati dal test.
- [x] [Review][Patch] Test di concorrenza assente (il cuore di AD-7) [packages/db/tests/invariants.integration.test.ts] — due `PUBLISHED` concorrenti sulla stessa Page: `Promise.allSettled`, esattamente uno vince, il perdente con P2002 sull'indice giusto, la Page resta con una sola PUBLISHED.
