# Deployment Guide — penpot-design-system

> Stato: il progetto **non è in produzione**. Non esiste pipeline CI/CD versionata (`.github/workflows/` assente; `.github/` contiene solo definizioni di agent BMad). Questa guida documenta gli strumenti di deploy disponibili e l'infrastruttura locale.

## Infrastruttura locale — `docker-compose.yaml`

Lo stack docker serve principalmente a far girare **Penpot** (sorgente del design) e i database.

| Servizio | Immagine | Porte (host) | Volume | Ruolo |
|----------|----------|--------------|--------|-------|
| `penpot-frontend` | `penpotapp/frontend` | 9001→8080 | `penpot_assets` | UI Penpot |
| `penpot-backend` | `penpotapp/backend` | — | `penpot_assets` | API Penpot |
| `penpot-exporter` | `penpotapp/exporter` | — | — | export |
| `penpot-postgres` | `postgres:15` | 5432 | `penpot_postgres_v15` | DB Penpot |
| `penpot-valkey` | `valkey/valkey:8.1` | — | — | cache/ws |
| `penpot-mailcatch` | `sj26/mailcatcher` | 1080 / 1025 | — | SMTP di test |
| `strapi-postgres` | `postgres:16` | 5433→5432 | `strapi_postgres` | DB Strapi (opzionale) |

Comandi:
```bash
docker compose up -d
docker compose logs -f penpot-backend
docker compose down            # (aggiungi -v per cancellare i volumi)
```

> ⚠️ Le chiavi di esempio (`PENPOT_SECRET_KEY: change-this-insecure-key`) e i flag `disable-secure-session-cookies` / `disable-email-verification` sono **solo per uso locale**. Vanno cambiati/rimossi prima di esporre Penpot a internet (vedi note Traefik commentate nel compose).

## Build delle librerie

```bash
pnpm build                 # tsup → dist/ per ogni package
pnpm storybook:build       # storybook-static/ (deployabile come sito statico)
```
I package sono `private: true` (non pubblicati su npm): la distribuzione è interna al monorepo via `workspace:*`.

> ⚠️ `pnpm-workspace.yaml` include `apps/*` senza eccezioni (l'esclusione `!apps/pagebuilder` è stata rimossa in un
> commit recente): `apps/pagebuilder`, essendo ora parte del workspace pnpm e avendo un proprio script `build` nel
> suo `package.json`, può essere raccolto anche da `turbo run build`/`pnpm build`. In pratica il build di produzione
> del JAR va comunque lanciato con l'alias dedicato `pnpm build:pagebuilder` (Maven), non con `pnpm build`. Dettagli
> sulle implicazioni dell'inclusione nel workspace in [`architecture-pagebuilder.md`](./architecture-pagebuilder.md).

## Deploy Strapi

Script disponibili in `apps/strapi`:
```bash
pnpm build:strapi          # build admin
strapi start               # avvio produzione (autoReload off)
strapi deploy              # deploy su Strapi Cloud (plugin @strapi/plugin-cloud presente)
```

### Configurazione produzione (env)
Valorizzare in `apps/strapi/.env`:
- Secret: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`
- DB: impostare `DATABASE_CLIENT=postgres` + `DATABASE_HOST/PORT/NAME/USERNAME/PASSWORD` (es. il `strapi-postgres` del compose su :5433) anziché SQLite.
- `HOST`, `PORT` (default 1337).

## Deploy pagebuilder (JHipster / Spring Boot)

Script disponibili in `apps/pagebuilder` (Maven via `./mvnw`, orchestrati anche dagli alias root
`pnpm dev:pagebuilder` / `pnpm build:pagebuilder`):
```bash
pnpm build:pagebuilder            # = pnpm --dir apps/pagebuilder run java:jar:prod → JAR di produzione (Maven, -Pprod)
pnpm --dir apps/pagebuilder run java:war:prod    # variante WAR
pnpm --dir apps/pagebuilder run java:docker:prod # build immagine Docker (jib, -Pprod)
```
Dipendenze runtime: **Postgres** e **Keycloak** (OIDC, realm `jhipster`), avviabili in locale con
`docker compose -f src/main/docker/postgresql.yml up -d` / `.../keycloak.yml up -d`. In produzione i tre parametri
OIDC (`issuer-uri`/`client-id`/`client-secret`) vanno forniti tramite un profilo equivalente a
`application-secret-samples.yml` (non usare i valori di esempio in produzione).

## Stato della migrazione Strapi → JHipster/pagebuilder

Il backend page-builder è **in migrazione attiva** da Strapi (storage JSON dei layout Puck) verso
**`apps/pagebuilder`** (Spring Boot/JHipster con Postgres + Keycloak/OIDC + audit Envers), come documentato nei
report in `_bmad-output/planning-artifacts/research/` e nelle story implementate (vedi ADR in
`development-guide.md`). Non è ancora stata definita una pipeline CI/CD né una data di dismissione di Strapi;
per l'architettura tecnica dettagliata di `apps/pagebuilder` vedi
[`architecture-pagebuilder.md`](./architecture-pagebuilder.md).
