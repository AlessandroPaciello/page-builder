# Project Overview — penpot-design-system

> Documentazione generata il 2026-06-03 · Modalità: scansione iniziale (Deep Scan) · aggiornata il 2026-07-10 (Deep Scan refresh)

## Cos'è

`penpot-design-system` è un **monorepo che implementa un design system end-to-end**, dal design al codice fino alla composizione di pagine. Il flusso copre tre stadi:

1. **Design → Codice**: i token e i componenti vengono letti da **Penpot** (tool di design open source) tramite un server **MCP** e trasformati in token TypeScript e componenti React (pacchetto `scripts`).
2. **Design System runtime**: i token alimentano un preset Tailwind e una libreria di **primitives** React accessibili (basate su Radix UI + `class-variance-authority`).
3. **Page building**: le primitives sono incapsulate in **blocchi Puck** (`@measured/puck`) e rese disponibili in un editor drag-and-drop dentro l'admin di **Strapi 5** (plugin `puck-builder`), che persiste i layout come JSON.

> **Nota di contesto progetto:** Strapi è usato essenzialmente come *storage JSON* dei layout creati con il page-builder Puck; non è in produzione. È **in corso una migrazione attiva** del backend verso **Spring Boot / JHipster** (`apps/pagebuilder`), avviata a partire da due report di ricerca in `_bmad-output/planning-artifacts/research/` e già a diverse story implementate (Postgres, Keycloak/OIDC, audit Envers, RBAC scaffolding — vedi `development-guide.md` e `architecture-pagebuilder.md`).

## Tipo di repository

**Monorepo** gestito con **pnpm workspaces** + **Turborepo** per le librerie del design system; `apps/pagebuilder`
è un'app poliglotta (Java/Maven + npm/webpack) orchestrata tramite alias dedicati (`pnpm dev:pagebuilder` /
`pnpm build:pagebuilder`) più che tramite le pipeline turbo `build`/`test`/`lint`.

- `packages/*` — librerie del design system (6 pacchetti)
- `apps/*` — applicazioni (`strapi` e `pagebuilder`)

> ⚠️ **Nota sul workspace pnpm:** `pnpm-workspace.yaml` include attualmente `apps/*` **senza eccezioni** — un commit
> recente ha rimosso l'esclusione `!apps/pagebuilder` che teneva quell'app fuori dal workspace pnpm (per evitare
> conflitti fra l'override `@types/react ^18` e la sua toolchain React 19/npm-Maven). Le implicazioni pratiche
> (rischio che `turbo run build` raccolga anche lo script `build` di `pagebuilder`, gestione lockfile doppia
> npm+pnpm, ecc.) sono documentate in dettaglio in [`architecture-pagebuilder.md`](./architecture-pagebuilder.md).

## Le parti (8)

| Parte | Pacchetto | Tipo | Ruolo |
|-------|-----------|------|-------|
| **tokens** | `@penpot-ds/tokens` | Libreria | Token di design (colori, tipografia, spacing, ombre, raggi) + preset Tailwind, estratti da Penpot |
| **primitives** | `@penpot-ds/primitives` | Libreria | Componenti UI React accessibili (Radix + CVA) |
| **ui** | `@penpot-ds/ui` | Libreria | Pacchetto UI composto su `primitives` + `tokens` (nuovo dall'ultima scansione) |
| **puck-components** | `@penpot-ds/puck-components` | Libreria | Blocchi Puck che wrappano le primitives per il page-builder |
| **scripts** | `@penpot-ds/scripts` | Tooling/CLI | Pipeline Penpot→codice via MCP (estrazione token, analisi componenti, code-gen Handlebars, `check:artifacts`) |
| **storybook** | `@penpot-ds/storybook` | Docs | Storybook che aggrega le storie di `primitives`, `puck-components` e `ui` |
| **strapi** | `apps/strapi` (`@penpot-ds/strapi`) | Backend/App | Strapi 5 con plugin custom `puck-builder` (editor + content-type `template` + API CRUD) — in fase di sostituzione |
| **pagebuilder** | `apps/pagebuilder` | Backend/App | Spring Boot/JHipster (Java 21, Postgres, Keycloak/OIDC, audit Envers) — nuovo backend page-builder in migrazione attiva da Strapi. Dettagli in [`architecture-pagebuilder.md`](./architecture-pagebuilder.md) |

## Stack tecnologico (sintesi)

| Categoria | Tecnologia | Versione | Note |
|-----------|-----------|----------|------|
| Linguaggio | TypeScript | ~5.7 | Tutto il monorepo |
| Package manager | pnpm | 10.33.0 | Workspaces |
| Task runner | Turborepo | ^2 | Build/test/lint con cache e dipendenze tra parti |
| UI runtime | React | 18 (strapi) / 19 (librerie) | peerDeps `^18 || ^19` |
| Primitives | Radix UI | varie | accordion, checkbox, select, switch, scroll-area, ecc. |
| Styling | Tailwind CSS | ^4 | Preset generato dai token |
| Varianti | class-variance-authority | ^0.7 | `buttonVariants`, `cardVariants`, ecc. |
| Page builder | @measured/puck | ^0.20 | Editor drag-and-drop |
| CMS / Backend | Strapi | 5.41.1 | SQLite (dev) / Postgres (docker) — in fase di sostituzione |
| Backend nuovo | Spring Boot / JHipster | Java 21 | `apps/pagebuilder`; Postgres + Keycloak/OIDC + Hibernate Envers |
| DB (dev) | better-sqlite3 | 12.8.0 | File `.tmp/data.db` (Strapi) |
| Validazione | Zod | 3 (puck) / 4 (strapi) | Schema dei blocchi Puck |
| Codegen | Handlebars | ^4 | Template componenti |
| Design source | Penpot via MCP | `@modelcontextprotocol/sdk` ^1 | Lettura componenti/token |
| Build librerie | tsup | ^8 | ESM + d.ts |
| Test | Vitest + Testing Library + vitest-axe | ^3 | Solo `primitives` |
| Docs UI | Storybook | ^8 | react-vite |

## Architettura ad alto livello

```
        ┌────────────┐   MCP    ┌─────────────────┐
        │   Penpot   │ ───────► │ packages/scripts │  (pipeline di generazione)
        │  (design)  │          │  token-extractor │
        └────────────┘          │  component-analyzer
                                 │  radix-mapper / code-generator (Handlebars)
                                 └────────┬─────────┘
                                          │ genera
                          ┌───────────────┴───────────────┐
                          ▼                                ▼
                 ┌─────────────────┐             ┌──────────────────┐
                 │ packages/tokens │ ──preset──► │ packages/primitives
                 │ (TS + Tailwind) │   token     │ (React + Radix+CVA)
                 └────────┬────────┘             └─────────┬────────┘
                          │                                │ wrap
                          │                                ▼
                          │                     ┌────────────────────────┐
                          └───────────────────► │ packages/puck-components │
                                                │ (blocchi Puck)           │
                                                └───────────┬──────────────┘
                                                            │ puckConfig
                          ┌─────────────────────────────────┘
                          ▼
                 ┌────────────────────────────────┐
                 │ apps/strapi · plugin puck-builder│
                 │ editor Puck → content-type       │
                 │ `template` (config JSON) → DB     │
                 └────────────────────────────────┘
```

## Link alla documentazione di dettaglio

Vedi [index.md](./index.md) per la navigazione completa. Documenti principali:

- [Source Tree Analysis](./source-tree-analysis.md)
- [Integration Architecture](./integration-architecture.md)
- [Design Token & Penpot Pipeline](./design-token-pipeline.md)
- [Component Inventory](./component-inventory.md)
- [Architecture — Strapi / puck-builder](./architecture-strapi.md)
- [Architecture — pagebuilder (JHipster/Spring Boot)](./architecture-pagebuilder.md)
- [Data Models — Strapi](./data-models-strapi.md)
- [API Contracts — Strapi](./api-contracts-strapi.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
