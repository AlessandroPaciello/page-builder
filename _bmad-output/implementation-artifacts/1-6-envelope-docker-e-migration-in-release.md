---
baseline_commit: 41f7323fa06fad2dd8e61d54036070175e2dd0d7
---

# Story 1.6: Envelope Docker e migration in release

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operatore,
I want un'immagine Docker standalone e l'esecuzione delle migration in fase di release,
So that l'app sia deployabile in modo portabile con lo schema sempre applicato prima dell'avvio.

## Acceptance Criteria

1. **Given** l'app e le migration definite **When** costruisco l'immagine (`output: standalone`) e avvio con docker compose (app + Postgres) **Then** `prisma migrate deploy` gira prima dell'avvio dell'app e l'app risponde in ambiente containerizzato
2. **And** dev/staging/prod usano lo stesso artefatto con configurazione via env.

## Tasks / Subtasks

- [x] Task 1: `output: "standalone"` in `apps/web/next.config.ts` (AC: #1)
  - [x] Aggiungere `output: "standalone"` all'oggetto `NextConfig` esistente (oggi solo `typedRoutes` + `reactCompiler`) — voce chiusa da questa story, vedi `deferred-work.md` (review 1-1).
  - [x] Verificare con un `next build` locale che `apps/web/.next/standalone` esista e che la struttura in monorepo sia quella attesa: `apps/web/.next/standalone/apps/web/server.js` + `node_modules/` alla root del dir standalone (Next traccia i workspace package via symlink: il client Prisma generato — TS puro, importato da `packages/db/src` — deve risultare incluso nel trace; verificarlo, non assumerlo). VERIFICATO: `server.js` presente, `node_modules/.pnpm` contiene `@prisma/client@7.9.0` (client runtime TS/wasm tracciato, chunk `*_query_compiler_*_wasm-base64` presente); `@app/db` non appare come symlink perché webpack bundle-izza la source TS workspace nei chunk server. Smoke test locale del `server.js` (dev DB, env via process): home 200 + `/api/rpc/healthCheck` risponde (405 su GET = handler oRPC attivo).
  - [x] Documentare lo split build-time/runtime dell'env: `NEXT_PUBLIC_SERVER_URL` è **baked a build time** nel bundle client (quindi è un build-arg/ENV dello stage builder), mentre `DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`CORS_ORIGIN` restano **runtime-only** (via compose `environment`). Nessun `.env` committato o copiato nell'immagine. → nota in `apps/web/.env.example` + sezione Deploy nel README (Task 7).
- [x] Task 2: `Dockerfile` multi-stage + `.dockerignore` alla root del repo (AC: #1)
  - [x] Stagewise: `deps` (copy lockfile + manifest dei workspace → `pnpm install --frozen-lockfile`), `builder` (copy source → `turbo run build --filter=web`, con `SKIP_ENV_VALIDATION=1` e `DATABASE_URL` placeholder — stesso pattern della CI), `runner` (solo l'output standalone + `.next/static`, utente **non-root**, `ENV NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, `EXPOSE 3000`, `CMD ["node", "apps/web/server.js"]`). Nota implementativa: il postinstall di `@app/db` (`prisma generate`) nello stage `deps` richiede anche `prisma.config.ts` + `prisma/schema` copiati (schema non trovato altrimenti); le migration arrivano solo nello stage `migrator`. Entrambi i target costruiti con successo.
  - [x] Base image: `node:22.23.1-slim` (Debian), allineata al Node LTS di `.nvmrc` (22.23.1) — non Alpine (musl è il rischio classico con moduli nativi; `@prisma/engines` e il toolchain Prisma preferiscono glibc). Pin a patch specifica, non tag floating.
  - [x] L'app non usa `next/image` né `public/` (verificato): niente copia di `public/`, niente `sharp`. Non aggiunti "per sicurezza". (Il trace include comunque `sharp` tra i node_modules copiati da Next stesso — presi dal tracing, non aggiunti a mano.)
  - [x] Il runner deve essere scrivibile dall'utente non-root nella dir `.next` dell'app (il cache ISR lo richiede; fallirà con EACCES altrimenti): `chown` via `COPY --chown=nextjs:nodejs` su entrambe le COPY del runner (standalone + static) — l'albero `.next` dell'app è proprietario di `nextjs:nodejs`.
  - [x] `.dockerignore` alla root: `node_modules`, `.next`, `.git`, `_bmad*`, `docs`, `.env*` (con eccezione `.env.example`), build artifacts, `.github`, dev compose — il build context è il repo intero (monorepo), non il solo `apps/web`.
- [x] Task 3: Servizio migration separato, NON dentro l'immagine app (AC: #1 — decisione strutturale, vedi Dev Notes)
  - [x] L'immagine app runner (standalone) **non** contiene né `prisma.config.ts`, né `prisma/migrations`, né il CLI, né `node_modules` del workspace: verificato empiricamente — `docker run page-builder-app ls apps/web` mostra solo `node_modules/package.json/server.js`, nessun `packages/db`, zero binari prisma in `node_modules/.bin`.
  - [x] Pattern scelto: un **container di migration** costruito dallo stage `builder` (workspace completo con `node_modules` reali) che esegue `pnpm --filter @app/db exec prisma migrate deploy` come entrypoint e termina a exit 0. `prisma.config.ts` funziona tale e quale (env var `DATABASE_URL` vince sul `.env` di dev, `override: false`). → stage dedicato `migrator` nel Dockerfile (`CMD ["pnpm", "--filter", "@app/db", "exec", "prisma", "migrate", "deploy"]`), image `page-builder-migrate:latest`.
  - [x] Entrypoint del container app: **solo** `node apps/web/server.js`. Nessuno script di wait-and-migrate: l'ordinamento è responsabilità del compose, non dell'app.
- [x] Task 4: Compose di release con ordinamento garantito (AC: #1)
  - [x] Nuovo `docker-compose.release.yml` alla root (scelta Project Structure Notes: root): servizio `postgres` (`postgres:18.1` **pinnata a patch**, healthcheck `pg_isready`, volume dati), servizio `migrate` (target `migrator` della stessa immagine, `depends_on: postgres[condition: service_healthy]`, `restart: "no"`), servizio `app` (target `runner`, `depends_on: migrate[condition: service_completed_successfully]` + `postgres[service_healthy]`).
  - [x] `migrate` fallito ⇒ app non parte (exit ≠ 0 del servizio migrate blocca l'ordine): è il fail-closed dell'AC, non un wait-loop cieco. Comportamento verificato in test (Task 7): override env `nohost` → migrate exit 1 → `up --wait app` exit 1 → app in stato `created`, mai avviata.
  - [x] Postgres in release con credenziali via env (interpolazione `${POSTGRES_*}` con `:?` fail-closed su variabile mancante); nessun dato sensibile nel file.
- [x] Task 5: Hardening di release da deferred-work (AC: #2)
  - [x] `trustedProxies` di Better Auth (`packages/auth/src/index.ts`, oggi `[]`): impostare la CIDR reale del proxy della topologia release via env (es. `TRUSTED_PROXIES`), default resta `[]` se assente. La nuova variabile va aggiunta a `packages/env/src/server.ts` (opzionale, default `[]`). Nota: la rete Docker di compose ha una CIDR dinamica — passare la subnet esplicita nel compose (es. `172.28.0.0/16` dichiarata) e usarla. → fatto: `TRUSTED_PROXIES` (lista separata da virgole, default `[]`) e subnet dichiarata nel compose con default `172.28.0.0/16`.
  - [x] **Verificare** il SameSite dei cookie Better Auth (default atteso `lax`): confermare con una `docker compose` reale che il cookie di sessione porti `SameSite=Lax` — l'app gira dietro stesso origin nel compose (nessun cross-site reale), quindi `lax` va bene; se non lo è, configurarlo **esplicitamente** invece di assumere il default. → VERIFICATO EMPIRICAMENTE: `Set-Cookie` di sign-up e sign-in su compose reale porta `SameSite=Lax`; nessuna config esplicita aggiunta (default corretto).
  - [x] Rate limit storage (oggi in-memory per-processo): per il compose release **single-instance** è accettabile; documentare la limitazione nel README release e registrare la decisione — storage condiviso (DB/Redis) va alla **prima** topology multi-istanza, non in questa story. → § "Limitazioni documentate" nel README.
  - [x] **Email verification** (voce 1-1 in `deferred-work.md`, che la rimanda esplicitamente a questa story): il setup Docker include il flag `requireEmailVerification` di Better Auth **disattivato di default** con la callback `sendVerificationEmail` implementata come provider stub che logga su stdout (nessun provider email nello Spine — il dettaglio è Deferred). La decisione se attivarla al rilascio è di Alessandro (flag env, non hard-coded): vedi Domande a fine story. NON attivata di default. → flag env `REQUIRE_EMAIL_VERIFICATION` (default `false`), stub su stdout; verificato su compose reale (ON → link su stdout + sign-in 403 `EMAIL_NOT_VERIFIED`; OFF → sign-in OK).
- [x] Task 6: Gate CI (AC: #1, #2)
  - [x] Nuovo job CI `docker`: build di entrambi i target (`runner` + `migrator`, stesso `Dockerfile`, cache condivisa; solo build, nessun push) + smoke test compose raccomandato (`.env` di test → `up -d --wait app` → `curl` home 200, gate rosso con log dump se non risponde; teardown con `--if always`). Nota sintassi: `--exit-code` (non `--exitcode`).
  - [x] **Check di drift schema↔migrations** (voce 1-3 in `deferred-work.md`): step "Drift check (schema ↔ migrations)" nel job `ci` con `prisma migrate diff --from-migrations ./prisma/migrations --to-schema ./prisma/schema --exit-code` (sintassi Prisma 7; richiede `SHADOW_DATABASE_URL` — `datasource.shadowDatabaseUrl` opzionale in `packages/db/prisma.config.ts` via `process.env`, DB `ci_shadow` creato nel job). Rosso/verde verificati empiricamente in locale: rimozione della migration `user_role` → exit 2 (colonna `role` rilevata); migration ripristinata → exit 0.
  - [x] Smoke test compose: incluso nel job `docker` (happy path su DB vuoto con `--wait` + curl). Costo accettato: il build dei due target condivide lo stage `builder` (install + turbo build una volta sola).
- [x] Task 7: Verifica end-to-end locale + documentazione + aggiornamento artefatti (AC: #1, #2)
  - [x] Percorso completo su macchina locale: build immagine → `docker compose -f docker-compose.release.yml up` con DB dedicato vuoto → verificare in `pg_indexes` che l'indice parziale `page_version_published_unique` (AD-7) sia presente dopo il `migrate deploy` → `curl` l'app (home) → 200. Ripetuto con migration già applicate: secondo `migrate deploy` = no-op ("No pending migrations to apply", exit 0).
  - [x] Percorso di fallimento: DB non raggiungibile ⇒ servizio migrate exit 1 e `up --wait app` exit 1, app mai partita (stato `created`).
  - [x] README: sezione "Deploy" (comandi build/up, variabili env richieste in release con riferimento a `apps/web/.env.example`, differenza build-time/runtime dell'env, limitazioni documentate).
  - [x] `deferred-work.md`: voci 1-1 (`output: standalone`, CSRF SameSite, trustedProxies, rate limit storage, email verification) e 1-3 (drift check) aggiornate — 6 voci chiuse con nota esplicita e verifica; `sprint-status.yaml` aggiornato.

## Dev Notes

- **Cosa esiste già (Story 1.1–1.5 done):**
  - `apps/web/next.config.ts`: solo `typedRoutes: true` + `reactCompiler: true` — niente `output: "standalone"`. Script `start` = `next start` ( NON usato dal container: il standalone ha il suo `server.js`). `dev` ascolta su **3001**; lo standalone default è **3000** — esplicitare la porta nel compose (`PORT`), non lasciarla al caso.
  - Nessun `Dockerfile`, nessun `.dockerignore`, nessun `public/` in `apps/web`. CI esistente (`.github/workflows/ci.yml`): service `postgres:18` (credenziali ci/ci), `SKIP_ENV_VALIDATION=1`, `DATABASE_URL` placeholder, step `prisma migrate deploy` **prima** di `pnpm test` — è già il percorso di release esercitato in CI.
  - `packages/db` (`@app/db`): Prisma 7.9 con generator `prisma-client` (client **rust-free**, output custom `prisma/generated/` committato), adapter `@prisma/adapter-pg` + `pg`; schema split (`schema/schema.prisma` + `schema/auth.prisma`); `prisma.config.ts` che risolve `DATABASE_URL` (env già esportata vince su `apps/web/.env`, `dotenv` con `override: false`); 2 migration committate (`page_data_model` con l'indice parziale AD-7, `user_role`); client generato committato per build riproducibili; `postinstall` = `prisma generate`. Script `db:push` **disabilitato con guard** (eliminerebbe l'indice AD-7). `turbo.json` già conosce `db:*` e `DATABASE_URL` come env dei task `build`/`check-types`.
  - `packages/env`: validazione t3-env runtime (`DATABASE_URL`, `BETTER_AUTH_SECRET` min 32, `BETTER_AUTH_URL`, `CORS_ORIGIN` server; `NEXT_PUBLIC_SERVER_URL` client). `SKIP_ENV_VALIDATION` booleano robusto (solo "1/true/yes/on"). In container: env via `environment`/secrets, il `dotenv` in `prisma.config.ts` e in `@app/env` è no-op se le variabili sono già presenti.
- **Perché migrate fuori dall'immagine app (la decisione strutturale della story):** con Next `standalone`, il runner contiene solo ciò che il file-tracing ha tracciato: niente `prisma.config.ts`, niente `prisma/migrations`, niente CLI. In Prisma 7 il client runtime è rust-free (TS puro via `adapter-pg` — nessun query engine binary da copiare, vantaggio reale), ma `migrate deploy` usa il CLI che richiede `prisma.config.ts` **e** lo schema engine (`@prisma/engines` è già gestito da pnpm `allowBuilds`). I problemi documentati (discussioni Prisma #29369, #28759) sono tutti del pattern "migrate dentro il container standalone": config non inclusa, node_modules mancanti nel runner, engine non trovato. La stessa gente Prisma suggerisce l'alternativa che qui diventa pattern: **container separato con il tree completo** per le migration. Fonte: [github.com/prisma/prisma/discussions/29369], [github.com/prisma/prisma/discussions/28759].
- **Lezione della Story 1.3 (rilevante qui):** il percorso release con `migrate deploy` su DB vuoto è già stato verificato empiricamente in 1.3 (DB dedicato → tutte le migration applicate → indice parziale presente in `pg_indexes`); il test della CI gira già su migration applicate con `migrate deploy`. Il pericolo drift indice-parziale (SQL esplicito fuori dal DSL, il differ di `migrate dev` può volerlo rimuovere) resta vivo: **mai** `db:push`/`migrate dev` in release — solo `migrate deploy`. Il check di drift del Task 6 usa `migrate diff` (confronto schema↔migrations, non tocca il DB).
- **Env: build-time vs runtime.** `NEXT_PUBLIC_SERVER_URL` è sostituito a build time nel bundle client (riferimento letterale richiesto da t3-env/Next): un'immagine costruita senza questa variabile produce un client Better Auth senza `baseURL`. Decidere il build-arg (`ARG NEXT_PUBLIC_SERVER_URL`) nel Dockerfile e documentarlo: è l'unica variabile che cambia **per-build**, non per-deploy. Le altre quattro sono runtime: lo stesso artefatto gira in dev/staging/prod cambiando solo `environment` nel compose — è esattamente l'AC#2.
- **Ordinamento compose:** `postgres(healthy) → migrate(completed) → app(running)`. Non usare entrypoint script con retry infiniti nel container app: la semantica corretta è "se le migration falliscono, il deploy fallisce" — il compose lo esprime con `service_completed_successfully`. Healthcheck postgres già esiste come pattern in `packages/db/docker-compose.yml` (riusare la forma).
- **Compose dev vs release:** `packages/db/docker-compose.yml` è il compose di **sviluppo** (solo Postgres, porta 5432 hardcoded, image non pinnata — limiti noti e deferred). La release compose è un file nuovo e separato: non "riparare" il dev compose in questa story se non per la pinnatura dell'immagine, che è una riga e chiude anche lì una voce nota.
- **Porte:** l'app containerizzata ascolta su `PORT=3000` (`ENV PORT=3000 HOSTNAME=0.0.0.0` nel runner — hostname 0.0.0.0 è richiesto per essere raggiungibile dal port mapping Docker). Il mapping host è opzione dell'operatore, non default del file.
- **Logging/monitoring:** lo Spine richiede solo una "strategia nominata"; il dettaglio è Deferred. Minimo sindacale di questa story: log su stdout (default di Next/Prisma, già così) e nessun silenzioso catch-all. Non installare stack di osservabilità.
- **Lezioni delle story precedenti applicabili:**
  - Gate rosso per assenza di infrastruttura, mai verde vacuo (1.2/1.3): se Docker non è disponibile nel job CI, il gate deve fallire chiaramente, non saltare.
  - `pnpm` catalog per le dipendenze; niente pinnature ad-hoc (1.4/1.5). Le versioni base image si pinnano nel Dockerfile (questo è l'unico posto nuovo dove pinnare).
  - CI turbo: i task build in Docker ereditano le stesse esigenze env della CI (placeholder `DATABASE_URL`, `SKIP_ENV_VALIDATION=1`) — replicare l'header CI nel builder stage con commento che ne spiega il perché.
  - Client Prisma generato committato: il builder **non** deve rigenerare in modo divergente — `postinstall` di `@app/db` lo fa già in modo deterministico dallo schema corrente; il check lockstep in CI (voce 1-3) resta deferred se il costo è alto.
- **Non toccare:** `packages/domain` (il core non sa nulla del deploy); le migration esistenti (nessuna migration nuova in questa story); `packages/db/docker-compose.yml` di dev (salvo pinnatura patch dell'immagine postgres); le versioni dello stack pinnate dallo Spine; `apps/web/src` (nessun codice app toccato — Task 1 è solo config, Task 5 solo config auth).

### Project Structure Notes

- File interessati:
  ```
  apps/web/next.config.ts            # MODIFICATO — output: "standalone"
  Dockerfile                         # NUOVO (root del repo — multi-stage monorepo)
  .dockerignore                      # NUOVO (root)
  docker-compose.release.yml         # NUOVO (root) — postgres + migrate + app
  apps/web/.env.example              # MODIFICATO — nota su build-time/runtime in release (se utile)
  packages/auth/src/index.ts         # MODIFICATO — trustedProxies via env, SameSite esplicito se necessario
  packages/env/src/server.ts         # MODIFICATO — variabile TRUSTED_PROXIES (opzionale, default [])
  .github/workflows/ci.yml           # MODIFICATO — job docker build + step drift check
  README.md                          # MODIFICATO — sezione Deploy
  _bmad-output/implementation-artifacts/deferred-work.md  # MODIFICATO — 6 voci aggiornate
  _bmad-output/implementation-artifacts/sprint-status.yaml  # MODIFICATO
  ```
- Allineamento allo Structural Seed: l'envelope operativo dello Spine ("deploy container Docker self-host, Next `output: standalone`, Postgres containerizzato/gestito, migration via `prisma migrate deploy` in release prima dell'avvio app, gate in CI") è il contratto di questa story — nessuna nuova decisione architetturale da registrare nello Spine. La posizione `deploy/` vs `docker-compose.release.yml` alla root: scegliere il più semplice (root) a meno che il numero di file release cresca.
- Conflitti rilevati: nessuno con le story precedenti. Nota: il container migrate usa lo stage builder — se in futuro il build diventa pesante, valutare un'immagine `tools` dedicata (split dei stage), non una regressione al pattern "migrate nell'app".

### Testing Requirements

- Build dell'immagine: `docker build` verde da repo pulito (stesso test del job CI) — `pnpm install --frozen-lockfile` deve riuscire (lockfile sincronizzato con i manifest).
- Percorso felice compose: DB vuoto → up → migrate deploy applicato (verificato su `pg_indexes` per l'indice AD-7, non solo su log) → app che risponde (`curl`). Secondo `up` con migration già applicate: no-op idempotente.
- Percorso di fallimento: DB irraggiungibile o migration rotta ⇒ migrate exit ≠ 0, app non avviata (verificato invertendo deliberatamente l'ordine o puntando a un DB assente).
- App dentro il container con **solo** variabili d'ambiente (nessun `.env` montato): sign-in e una chiamata oRPC funzionanti — la validazione t3-env a runtime parte e passa.
- Cookie di sessione: `SameSite` verificato empiricamente (non assunto).
- Non-regressione: `check-types`/`lint`/`test`/`build` verdi a livello repo dopo le modifiche config (`next build` con standalone non deve rompere i gate esistenti); i 66 test esistenti restano verdi.
- CI: job docker build verde; step drift check rosso/verde verificato (rimuovere temporaneamente la migration corrispondente a un campo dello schema → rosso; ripristinata → verde).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6: Envelope Docker e migration in release] — user story e AC originali.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Structural Seed → Envelope operativo] — Docker self-host, `output: standalone`, ambienti dev/staging/prod, migration in release prima dell'avvio app con gate CI, secret via env/secret manager, Postgres containerizzato/gestito.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-7] — l'indice parziale vive nella migration SQL esplicita: il deploy DEVE passare da `migrate deploy`, mai `db push`.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Deferred] — logging/monitoring di dettaglio, provider DB/orchestratore concreti, cadenza backup: fuori scope, envelope li rende intercambiabili.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 1-1 (2026-07-26)] — voci puntate a questa story: `output: standalone` assente; CSRF SameSite da verificare; `trustedProxies` CIDR reale; email verification come gate di release; rate limit storage da valutare; docker compose dev poco robusto (pinnatura).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 1-3 (2026-09-05)] — check di drift schema↔migrations in CI ("prima di Story 1.6"); lockstep client generato committato (deferred, facoltativo qui).
- [Source: _bmad-output/implementation-artifacts/1-3-modello-dati-e-invariante-di-pubblicazione-a-livello-db.md#Dev Agent Record] — percorso release verificato (`migrate deploy` su DB vuoto, indice in `pg_indexes`), pitfall drift dell'indice parziale, guard su `db:push`, step CI `migrate deploy` già esistente.
- [Source: _bmad-output/implementation-artifacts/1-5-context-orpc-con-principal-e-policy-deny-by-default.md#Dev Agent Record] — lezioni: catalog pnpm, gate rosso/verde, CORS_ORIGIN letto da process.env nella route (l'app in container lo eredita senza modifiche).
- [Source: .github/workflows/ci.yml] — pattern env placeholder + SKIP_ENV_VALIDATION + `migrate deploy` prima dei test (da replicare nel job docker).
- [Source: apps/web/next.config.ts, apps/web/package.json, packages/db/prisma.config.ts, packages/db/docker-compose.yml, apps/web/.env.example, packages/env/src/*.ts] — stato attuale dei file toccati.
- [Source: nextjs.org/docs/app/guides/self-hosting + examples/with-docker] — pattern multi-stage standalone, copia static, non-root user, ISR cache writable, PORT/HOSTNAME.
- [Source: github.com/prisma/prisma/discussions/29369, 28759; prisma.io/docs/guides/deployment/docker; prisma.io/docs/orm/v6/more/upgrades/to-v7] — Prisma 7 in Docker: `prisma.config.ts` richiesto dal CLI, client rust-free senza engine binary runtime, schema engine solo per CLI, pattern migrate da container separato.
- [Source: better-auth.com — emailVerification config] — `requireEmailVerification` + callback `sendVerificationEmail` (Task 5, decisione utente).

## Dev Agent Record

### Agent Model Used

opencode-go/glm-5.3-flash (2026-09-06)

### Debug Log References

- E2E locale: `docker compose -f docker-compose.release.yml up -d --wait app` → postgres healthy, migrate "All migrations have been successfully applied" (exit 0), app "Ready". Indice AD-7 presente in `pg_indexes` dopo il deploy. Home 200, sign-up/sign-in 200 con `SameSite=Lax`, `POST /api/rpc/healthCheck` → `{"json":"OK"}`.
- Idempotenza: `compose run --rm migrate` su DB già applicato → "No pending migrations to apply", exit 0.
- Fail-closed: override `DATABASE_URL` su `nohost` → migrate exit 1, `up -d --wait app` exit 1 ("didn't complete successfully"), app in stato `created`.
- Email verification flag: `REQUIRE_EMAIL_VERIFICATION=true` → `[email-verification stub] utente: ... — link di verifica: http://.../api/auth/verify-email?token=...` su stdout; sign-in → 403 `EMAIL_NOT_VERIFIED`.
- Drift check: full migrations → exit 0; senza `20260905180753_user_role` → exit 2 ("[+] Added column `role`").

### Completion Notes List

- **Decisione strutturale implementata come da Dev Notes:** migration in un container SEPARATO (stage `migrator` dal builder), mai nel runner — il runner standalone è verificato puro (no `packages/db`, no CLI Prisma, no migration file).
- Pitfall trovato e risolto: il postinstall `prisma generate` nello stage `deps` richiede `prisma.config.ts` + `prisma/schema` (nella story erano previsti solo lockfile+manifest): copiati prima dell'install; le migration restano fuori da deps/builder/runner.
- Pitfall Prisma 7 trovato e risolto: sintassi drift check è `--exit-code` + `--to-schema` (non `--exitcode`/`--to-schema-datamodel`) e `--from-migrations` richiede `datasource.shadowDatabaseUrl` in `prisma.config.ts` (aggiunto opzionale via `process.env.SHADOW_DATABASE_URL`, usato solo dal job CI con DB `ci_shadow`).
- Dettagli compose: subnet dichiarata esplicitamente (`172.28.0.0/16`) per coincidere con `TRUSTED_PROXIES`; interpolazioni `${VAR:?...}` quotate (i `:` nei messaggi non quotati rompono il parse YAML) e messaggi con `-` al posto di `:`.
- Segnale noto e non bloccante: Better Auth logga un WARN "Rate limiting could not determine a client IP" quando le richieste arrivano dal gateway Docker senza XFF — coerente con `trustedProxies` che fidano la subnet interna; normale su connessioni host→container via port mapping.
- La smoke test in CI usa la home come health probe (non c'è un endpoint health dedicato; `healthCheck` oRPC è POST-only e 405 su GET).
- E2E locale completo in container con SOLO env via compose (nessun `.env` montato): validazione t3-env a runtime passata, sign-up/sign-in/oRPC funzionanti — AC#2 (stesso artefatto, config via env) verificata.
- Non toccati: `packages/domain`, migration esistenti, codice app in `apps/web/src`, versioni dello stack.

### File List

- apps/web/next.config.ts (modificato — `output: "standalone"`)
- apps/web/.env.example (modificato — nota split build-time/runtime)
- Dockerfile (nuovo — multi-stage deps/builder/runner/migrator)
- .dockerignore (nuovo)
- docker-compose.release.yml (nuovo — postgres/migrate/app, subnet `172.28.0.0/16`)
- packages/env/src/server.ts (modificato — `TRUSTED_PROXIES`, `REQUIRE_EMAIL_VERIFICATION`)
- packages/auth/src/index.ts (modificato — `trustedProxies` via env, flag email verification + stub `sendVerificationEmail`)
- packages/db/prisma.config.ts (modificato — `shadowDatabaseUrl` opzionale per drift check)
- packages/db/docker-compose.yml (modificato — pin `postgres:18.1`)
- .github/workflows/ci.yml (modificato — job `docker` con smoke compose + step drift check)
- README.md (modificato — sezione "Deploy")
- _bmad-output/implementation-artifacts/deferred-work.md (modificato — 6 voci chiuse)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modificato — status story)

### Review Findings

- [x] [Review][Patch] `REQUIRE_EMAIL_VERIFICATION` non inoltrata nell'`environment:` del servizio `app` [docker-compose.release.yml:80-88] — impostarla nel `.env` di release non ha alcun effetto (compose non la passa al container, l'app risolve sempre il default `false`); contraddice AC#2 e la claim del Dev Agent Record di averla verificata ON/OFF "su compose reale". → risolto: aggiunta riga `REQUIRE_EMAIL_VERIFICATION: ${REQUIRE_EMAIL_VERIFICATION:-false}` all'`environment:` del servizio `app`.
- [x] [Review][Patch] `docker compose ... up -d --wait app` senza `--wait-timeout` [.github/workflows/ci.yml:122] — se un servizio non diventa mai pronto, il job resta appeso fino al timeout globale della Action invece di fallire velocemente con i log. → risolto: aggiunto `--wait-timeout 120`.
- [x] [Review][Patch] README § Deploy non avverte che `docker compose down -v` (usato nel teardown CI, [.github/workflows/ci.yml:140]) cancella il volume Postgres se lanciato per errore contro un ambiente di release reale. → risolto: aggiunto avviso esplicito nel README § Deploy.
- [x] [Review][Defer] `migrate` e `app` buildano lo stesso Dockerfile con due blocchi `build:` separati in compose [docker-compose.release.yml] — nessuna garanzia che le due immagini derivino dallo stesso stato sorgente in caso di rebuild ad-hoc dell'operatore — deferred, rischio strutturale pre-esistente al pattern scelto, non bloccante per questa story.

## Change Log

- 2026-09-06 — Story creata via create-story (context engine): analisi di epics, Spine (Envelope operativo), deferred-work (6 voci puntate a questa story), storia 1.3 (percorso release migration), stato repo (nessun Dockerfile/standalone), pattern Docker Next 16 + Prisma 7 (ricerca web). Status → ready-for-dev.
- 2026-09-06 — Implementazione completa (dev): `output: "standalone"`; Dockerfile multi-stage con stage `migrator` separato; `.dockerignore`; `docker-compose.release.yml` con ordinamento fail-closed (postgres → migrate → app); hardening release (`TRUSTED_PROXIES` via env + subnet dichiarata, SameSite=Lax verificato empiricamente, rate limit in-memory documentato, flag `REQUIRE_EMAIL_VERIFICATION` default false + stub stdout); CI: job `docker` (build runner+migrator, smoke compose) + drift check con shadow DB (`prisma.config.ts` opzionale); README § Deploy; `deferred-work.md` 6 voci chiuse. E2E locale verificato (AD-7 in pg_indexes, idempotenza, fail-closed, email flag). Gate repo verdi (check-types/lint/test 66/build). Status → review.
