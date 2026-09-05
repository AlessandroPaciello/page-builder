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
