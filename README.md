# page-builder

Page builder end-to-end: design system generato dal catalogo Penpot, editor
pagine a blocchi (authoring drag-and-drop, versioning/publish/rollback) e render
pubblico by-slug, con RBAC, audit e integrazione commerce pluggable.

Il contratto vincolante dell'architettura è
[`ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md).

Lo scaffold è stato generato con [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack).

## Stack

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **`@penpot-ds/ui`** - libreria componenti unica: `domains/` (generato da Penpot) + `editor/` (a mano)
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, set up your environment variables:

```bash
cp apps/web/.env.example apps/web/.env
```

Then fill in `BETTER_AUTH_SECRET` (at least 32 characters — generate one with
`openssl rand -base64 32`). The other defaults work out of the box for local
development. These variables are validated at runtime, so the app will refuse to
start if any of them is missing or malformed.

Then install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses PostgreSQL with Prisma.

1. Start the local PostgreSQL container (or point `DATABASE_URL` at your own instance):

```bash
pnpm run db:start
```

2. Apply the migrations to your database:

```bash
pnpm run db:migrate
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## Penpot locale e server MCP

Il design system viene letto da un'istanza Penpot self-hosted tramite il suo server MCP. Serve solo per i comandi live di `packages/scripts` e per usare Penpot da Claude Code o OpenCode: build, test e CI non ne dipendono.

**Setup (una volta sola):**

1. Avvia lo stack: `cd docker/penpot && docker compose up -d`. Penpot risponde su [http://localhost:9001](http://localhost:9001).
2. In Penpot vai su *Settings → Integrations → MCP server*, attivalo e copia il token personale. Se la voce non compare, ricarica con Ctrl+Shift+R.
3. Aggiungi il token al `.env` alla root (il file è ignorato da git):
   ```
   PENPOT_MCP_TOKEN=<token>
   ```
4. Installa [direnv](https://direnv.net) e fagli caricare il `.env` nelle shell aperte nel repo:
   ```bash
   sudo apt install direnv
   echo 'eval "$(direnv hook bash)"' >> ~/.bashrc && source ~/.bashrc
   echo dotenv > .envrc   # dalla root del repo; .envrc è ignorato da git
   direnv allow
   ```
   Entrando nel repo compare `direnv: loading .envrc … +PENPOT_MCP_TOKEN`.
5. Chiudi VS Code del tutto e riaprilo da quel terminale con `code .`. Claude Code non legge il `.env`: prende il token solo dall'ambiente in cui parte.
6. Nel file Penpot da leggere: *File → Plugins → MCP Server → Connect*.

`.mcp.json` (Claude Code) e `opencode.json` (OpenCode) sono già nel repo e contengono il token solo come variabile. Gli script leggono la stessa variabile. **Il token non va mai scritto in un file tracciato.**

**Dopo aver rigenerato il token:** quello vecchio smette di funzionare e il plugin si scollega. Aggiorna il `.env`, riconnetti il plugin (passo 6), poi chiudi VS Code e riaprilo da un terminale nuovo con `direnv reload && code .`.

Direnv carica tutto il `.env`. Per isolare il token, mettilo in `.env.penpot` (anche questo ignorato) e scrivi `dotenv .env.penpot` nel `.envrc`. Senza direnv basta `export PENPOT_MCP_TOKEN=...` nella shell o in `~/.bashrc`.

Variabili ed errori degli script: [packages/scripts/README.md](packages/scripts/README.md#connessione-a-penpot).

## Il package UI: `domains/` e `editor/`

`@penpot-ds/ui` è la **libreria componenti unica** del progetto (AD-3/AD-11) ed
espone due entry point distinti:

| Export | Cartella | Chi ci scrive | Cosa contiene |
| --- | --- | --- | --- |
| `@penpot-ds/ui` | `src/domains/` | il **generatore** | componenti derivati dal catalogo Penpot (dalla Story 2.4) |
| `@penpot-ds/ui/editor` | `src/editor/` | **a mano** | il chrome dell'editor page-builder |

**Regola di confine assoluta:** `domains/` non conosce il dominio page-builder e
non importa mai da `editor/`. La dipendenza va solo nel verso opposto. Persa la
barriera di package con la fusione, il confine è difeso da un check bloccante:

```bash
pnpm run lint    # packages/ui/scripts/check-boundaries.mjs
```

Token e stili globali stanno in `packages/ui/src/styles/globals.css`; gli alias
shadcn in `packages/ui/components.json` e `apps/web/components.json`.

```tsx
import { Button } from "@penpot-ds/ui/editor";
```

## Struttura

```
page-builder/
├── apps/
│   └── web/         # unico adapter inbound (Next.js App Router)
├── packages/
│   ├── ui/          # @penpot-ds/ui — design system (domains/ + editor/)
│   ├── api/         # router oRPC
│   ├── auth/        # configurazione Better Auth
│   ├── config/      # tsconfig condivisi
│   ├── db/          # schema Prisma e client
│   └── env/         # validazione env (server + client)
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run lint`: Run the blocking checks (incl. the `domains/` → `editor/` boundary)
- `pnpm run db:push`: **disabilitato** — `prisma db push` eliminerebbe l'indice parziale AD-7 (`page_version_published_unique`), che vive solo nel SQL della migration; usa `db:migrate`
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI

## Deploy (release)

L'app è deployabile come **immagine Docker standalone** (Next `output: standalone`,
Story 1.6): l'ordinamento `postgres → migrate → app` è garantito dal compose di
release, non da script nell'app.

### Build dell'immagine

```bash
docker build --target runner \
  --build-arg NEXT_PUBLIC_SERVER_URL=https://app.example.com \
  -t page-builder-app:latest .
```

Due target nello stesso `Dockerfile`:

- **`runner`** — solo l'output standalone (`apps/web/.next/standalone` + `.next/static`),
  utente non-root. Entrypoint: `node apps/web/server.js`. **Non contiene** CLI
  Prisma né file di migration (il file-tracing di Next non li include).
- **`migrator`** — workspace completo con i `node_modules` reali; esegue
  `prisma migrate deploy` e termina a exit 0.

### Avvio con compose di release

```bash
docker build --target migrator --build-arg NEXT_PUBLIC_SERVER_URL=... -t page-builder-migrate:latest .
docker compose -f docker-compose.release.yml up -d --wait app
```

Ordinamento fail-closed: `postgres` (healthcheck `pg_isready`) → `migrate`
(`service_completed_successfully`, `restart: "no"`) → `app`. Se le migration
falliscono, **l'app non parte mai**. Il secondo `migrate deploy` su DB già
applicato è un no-op (idempotente).

> ⚠️ **Mai `docker compose down -v` contro un ambiente di release reale**: cancella
> il volume `release_postgres_data`, cioè il database di produzione. Il `-v` è
> usato solo nel teardown della CI (Postgres effimero su un DB di test).

Le variabili di release si definiscono in un file `.env` alla root del repo
(leggibile da compose, **non committato**) — vedi `apps/web/.env.example`:

| Variabile | Tempo | Note |
| --- | --- | --- |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | runtime | credenziali del DB di release (mai credenziali di dev) |
| `DATABASE_URL` | runtime | derivata da `POSTGRES_*` nel compose |
| `BETTER_AUTH_SECRET` | runtime | min 32 caratteri (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL`, `CORS_ORIGIN` | runtime | URL pubblici dell'app |
| `NEXT_PUBLIC_SERVER_URL` | **build** | sostituita nel bundle client a build time: cambia per-**build** — ricostruire l'immagine per cambiarla (build-arg) |
| `TRUSTED_PROXIES` | runtime | CIDR dei proxy fidati per Better Auth; default del compose: `172.28.0.0/16` (subnet dichiarata della rete compose). Override per topologie con reverse proxy esterno |
| `REQUIRE_EMAIL_VERIFICATION` | runtime | default `false`; se `true`, utenti con email non verificata non autenticano e il link di verifica va su stdout (provider stub) |

Nessun `.env` viene committato o copiato nell'immagine: in container le
variabili arrivano solo da `environment` (la validazione t3-env a runtime passa
con il solo env).

### Limitazioni documentate (decisioni, non omissioni)

- **Rate limit Better Auth in-memory** (window 60s / max 10): per il compose
  release **single-instance** è accettabile; i contatori si azzerano a ogni
  restart e sono per-processo: diventano un problema solo alla prima topology
  **multi-istanza** — lì serve storage condiviso (DB/Redis), non prima.
- **Verifica email disattivata di default** (`REQUIRE_EMAIL_VERIFICATION=false`):
  l'attivazione è una decisione di rilascio (flag env, mai hard-coded); con lo
  stub il link di verifica finisce su stdout, un provider email reale è
  rimandato alla prima topologia che lo richiede.
- **Logging**: log su stdout (default di Next/Prisma), nessun catch-all
  silenzioso; lo stack di osservabilità è Deferred.
