# syntax=docker/dockerfile:1

# Envelope operativo dello Spine (Story 1.6): immagine Docker standalone con
# migration eseguite in release da un CONTAINER SEPARATO (stage `migrator`),
# mai dentro il runner: l'output standalone di Next contiene solo ciò che il
# file-tracing traccia — niente prisma.config.ts, niente prisma/migrations,
# niente CLI Prisma. Vedi docker-compose.release.yml per l'ordinamento
# postgres(healthy) → migrate(completed) → app(running).
#
# ENV: build-time vs runtime.
# - NEXT_PUBLIC_SERVER_URL è l'unica variabile BAKE-A-BUILD-TIME (sostituita
#   nel bundle client): si passa come build-arg. È per-build, non per-deploy.
# - DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, CORS_ORIGIN sono
#   runtime-only: lo stesso artefatto gira in dev/staging/prod cambiando solo
#   le `environment` del compose. Nessun .env viene copiato nell'immagine.

# Node LTS di .nvmrc (22.23.1), pinnato a patch, Debian slim (glibc, non musl:
# @prisma/engines e il toolchain Prisma preferiscono Debian ad Alpine).
FROM node:22.23.1-slim AS base
WORKDIR /app
# Corepack risolve pnpm dalla chiave `packageManager` del package.json
# (pnpm@10.33.0): la versione vive in un solo posto, come in CI.
RUN corepack enable

# ---------------------------------------------------------------------------
# deps: solo manifest + lockfile → install deterministico con lockfile frozen.
# ---------------------------------------------------------------------------
FROM base AS deps
# Manifest dei workspace PRIMA della source: questo layer si invalida solo
# quando cambiano le dipendenze, il resto della source resta in cache.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/api/package.json packages/api/
COPY packages/domain/package.json packages/domain/
COPY packages/env/package.json packages/env/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/
# Il postinstall di @app/db esegue `prisma generate`: serve prisma.config.ts e
# lo schema, altrimenti il generate fallisce ("schema.prisma: file not found").
# Le migration NON servono qui: arrivano solo nello stage migrator.
COPY packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma/schema packages/db/prisma/schema/
# Il postinstall di @app/db esegue `prisma generate`, che carica
# prisma.config.ts e risolve DATABASE_URL anche se non si connette mai al DB:
# placeholder (stesso pattern della CI). SKIP_ENV_VALIDATION esclude la
# validazione t3-env a install-time.
ENV SKIP_ENV_VALIDATION=1 \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder: source completa → build turbo (stesso comando della CI).
# L'output di interesse è apps/web/.next/standalone (Next file-tracing).
# ---------------------------------------------------------------------------
FROM base AS builder
# node_modules dall'install deterministico; COPY . . non li sovrascrive perché
# .dockerignore li esclude dal context.
COPY --from=deps /app ./
COPY . .
# HEADER CI replicato (stesso pattern di .github/workflows/ci.yml):
# - SKIP_ENV_VALIDATION: `next build` importa @app/env/web, che altrimenti
#   lancia se NEXT_PUBLIC_SERVER_URL manca — ma in build l'env NON è un input:
#   la validazione serve a chi deploya.
# - DATABASE_URL placeholder: il postinstall/check-types di @app/db esegue
#   `prisma generate`, che carica prisma.config.ts anche senza connettersi.
# - NEXT_PUBLIC_SERVER_URL (ARG): unica variabile BAKE-A-BUILD-TIME nel bundle
#   client. L'immagine costruita senza build-arg produce un client Better Auth
#   senza baseURL — passarla SEMPRE alla build.
ENV SKIP_ENV_VALIDATION=1 \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SERVER_URL="http://localhost:3000"
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
RUN ./node_modules/.bin/turbo run build --filter=web

# ---------------------------------------------------------------------------
# runner: SOLO l'output standalone + .next/static. Nessun node_modules del
# workspace, nessun CLI Prisma, nessun file di migration.
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # 0.0.0.0 è richiesto perché il server sia raggiungibile dal port mapping.
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
# --chown rende l'utente non-root proprietario dell'albero: la dir .next
# dell'app deve essere scrivibile (il cache ISR lo richiede, altrimenti EACCES).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# L'app non usa next/image né public/ (verificato in Story 1.6): nessuna copia
# di public/, niente sharp. Non aggiungerli "per sicurezza".
USER nextjs
EXPOSE 3000
# Entry point del container app: SOLO il server standalone. Nessuno script di
# wait-and-migrate: l'ordinamento è responsabilità del compose.
CMD ["node", "apps/web/server.js"]

# ---------------------------------------------------------------------------
# migrator: `prisma migrate deploy` dal workspace completo (stage builder con
# i node_modules reali). Il container termina a exit 0; se le migration
# falliscono, exit ≠ 0 e il compose non avvia l'app (fail-closed).
# ---------------------------------------------------------------------------
FROM base AS migrator
ENV NEXT_TELEMETRY_DISABLED=1
# Workspace completo dal builder: prisma.config.ts + prisma/schema +
# prisma/migrations + CLI (node_modules reali). Prisma 7 è rust-free lato
# runtime client, ma `migrate deploy` usa il CLI con lo schema engine
# (@prisma/engines): serve l'albero completo, non il runner standalone.
COPY --from=builder /app ./
# DATABASE_URL arriva dall'environment del compose: prisma.config.ts risolve
# la variabile d'ambiente in priority sul .env di dev (dotenv override:false,
# e in container non c'è alcun .env).
WORKDIR /app
CMD ["pnpm", "--filter", "@app/db", "exec", "prisma", "migrate", "deploy"]
