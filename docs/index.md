# Project Documentation Index — penpot-design-system

> Documentazione rigenerata il **2026-07-10** · Full Rescan (Deep Scan) · Punto d'ingresso primario per lo sviluppo assistito da AI.
> Sostituisce la versione del 2026-06-03 (copriva solo `strapi` + le 5 librerie design-system originarie).

## Project Overview

- **Tipo:** monorepo con **8 parti** — 6 librerie design-system (pnpm+Turborepo, TS/React) + 2 app (`apps/pagebuilder` nuovo backend JHipster, `apps/strapi` legacy CMS)
- **Linguaggio primario:** TypeScript (~5.7) ESM per il design system; Java 21/Spring Boot per `pagebuilder`
- **Architettura:** design system end-to-end — Penpot → token/codice → primitives → blocchi Puck → **due page-builder in parallelo**: quello legacy in Strapi (produzione) e quello nuovo in JHipster (Epic 4, in migrazione attiva)
- **Stato:** migrazione Strapi → JHipster in corso (Epic 4 quasi completa: OIDC, PageList/PageEditor fatti; Story 4.3 "canvas Puck" pronta per dev)

## ⚠️ Rischi/discrepanze rilevati in questo rescan

1. **`apps/pagebuilder` è ora dentro il workspace pnpm** senza esclusione (il commit `ae6327a`, nonostante il messaggio "exclude", ha rimosso la riga `!apps/pagebuilder`) — possibile leak dell'override `@types/react ^18` sul React 19 di pagebuilder. → [source-tree-analysis.md](./source-tree-analysis.md)
2. **`@penpot-ds/ui` non è consumato da nessuna app** — il frontend reale di `apps/pagebuilder` usa `react-bootstrap`, non le composizioni del design system. → [architecture-design-system.md](./architecture-design-system.md)
3. **RBAC incompleto**: gli endpoint CRUD JHipster-generati su `Page`/`PageVersion` non hanno `@PreAuthorize`, protetti solo da `authenticated()` globale. → [api-contracts-pagebuilder.md](./api-contracts-pagebuilder.md)
4. **Migrazione dati Strapi → pagebuilder non scriptata** — nessun automatismo converte `template.config` in `PageVersion.payload`; gap da chiudere prima di Epic 5. → [data-models-pagebuilder.md](./data-models-pagebuilder.md)
5. **`field-classifier.json` duplicato manualmente** tra `puck-components` e `apps/pagebuilder` (identico oggi, nessun sync automatico). → [integration-architecture.md](./integration-architecture.md)
6. **Possibile refuso endpoint**: frontend chiama `GET /api/pages/{id}/versions`, backend espone `GET /api/pages/{id}/versions/history`. → [api-contracts-pagebuilder.md](./api-contracts-pagebuilder.md)
7. **WIP non committato in `apps/pagebuilder`**: changelog Liquibase per la tabella Envers `revinfo` — senza questo, l'audit trail (`PageAuditResource`, ADMIN-only) rischia di non funzionare.
8. **Nessuna pipeline CI/CD reale** — `.github/workflows/` è assente; `.github/` contiene solo agenti BMad.

## Quick Reference (per parte)

| Parte | Pacchetto | Tipo | Stack chiave | Root |
|-------|-----------|------|--------------|------|
| tokens | `@penpot-ds/tokens` | Libreria | TS, Tailwind v4 `@theme` | `packages/tokens` |
| primitives | `@penpot-ds/primitives` | Libreria | React 19, Radix, CVA, Vitest — 28 componenti | `packages/primitives` |
| puck-components | `@penpot-ds/puck-components` | Libreria | Puck, Zod — 20 blocchi | `packages/puck-components` |
| ui | `@penpot-ds/ui` | Libreria | React 19 — 6 composizioni, **non ancora consumata** | `packages/ui` |
| scripts | `@penpot-ds/scripts` | CLI/tooling | MCP, Handlebars | `packages/scripts` |
| storybook | `@penpot-ds/storybook` | Docs | Storybook 8, Vite | `packages/storybook` |
| pagebuilder | `pagebuilder` | App fullstack | JHipster 9.1, Spring Boot 4, Java 21, React 19, Postgres, Keycloak | `apps/pagebuilder` |
| strapi | `@penpot-ds/strapi` | App/Backend, **legacy** | Strapi 5, React 18, Puck | `apps/strapi` |

## Generated Documentation

- [Project Overview](./project-overview.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Integration Architecture](./integration-architecture.md)
- [Architecture — Design System Libraries](./architecture-design-system.md)
- [Architecture — pagebuilder (JHipster)](./architecture-pagebuilder.md)
- [Architecture — Strapi & puck-builder (legacy)](./architecture-strapi.md)
- [Design Token & Penpot Pipeline](./design-token-pipeline.md) — *approfondimento*
- [Component Inventory](./component-inventory.md) — primitives + puck-components + ui
- [Data Models — pagebuilder](./data-models-pagebuilder.md)
- [Data Models — Strapi (legacy)](./data-models-strapi.md)
- [API Contracts — pagebuilder](./api-contracts-pagebuilder.md)
- [API Contracts — Strapi (legacy)](./api-contracts-strapi.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [a11y Baseline](./a11y-baseline.md)
- [RBAC Matrix](./rbac-matrix.md)
- [Component Audit Epic 3](./component-audit-epic3.md) — _snapshot storico, gap ora chiuso (vedi Component Inventory)_
- [PoC Fase-0: Report Go/No-Go](./poc-fase-0-go-no-go-report.md) — _gate FR-17; decisione Go/No-Go linea versione_
- [project-parts.json](./project-parts.json) — metadati parti + punti d'integrazione (machine-readable)

## Existing Documentation

- `apps/strapi/README.md` — README template di default di Strapi (CLI/deploy generici)
- `apps/pagebuilder/docs/` — README/dettagli JHipster-generati
- `_bmad-output/planning-artifacts/` — PRD, brief, ricerca migrazione Strapi→JHipster
- `_bmad-output/implementation-artifacts/` — sprint-status.yaml, story, deferred-work.md

## Getting Started

```bash
pnpm install
pnpm build
pnpm storybook            # esplora i componenti (:6006)
pnpm dev:strapi           # editor Puck legacy nell'admin Strapi (:1337/admin → "Layout Builder")
pnpm dev:pagebuilder      # backend+frontend pagebuilder insieme (concurrently); login da :9000, NON :8080 diretto
docker compose up -d      # Penpot + DB (Penpot UI :9001)
```

Vedi [Development Guide](./development-guide.md) per i dettagli (prerequisiti, comandi per parte, stack Postgres+Keycloak).

## Mappa di lettura consigliata

- **Capire il flusso complessivo** → [Project Overview](./project-overview.md) + [Integration Architecture](./integration-architecture.md)
- **Lavorare su UI/componenti design system** → [Component Inventory](./component-inventory.md) + [Architecture — Design System](./architecture-design-system.md)
- **Lavorare su token/generazione** → [Design Token & Penpot Pipeline](./design-token-pipeline.md)
- **Lavorare sul nuovo backend/editor (pagebuilder)** → [Architecture — pagebuilder](./architecture-pagebuilder.md) + [API](./api-contracts-pagebuilder.md) + [Data Models](./data-models-pagebuilder.md)
- **Lavorare sul backend legacy (strapi)** → [Architecture — Strapi](./architecture-strapi.md) + [API](./api-contracts-strapi.md) + [Data Models](./data-models-strapi.md)
- **Migrazione backend / gap da colmare** → sezione "Rischi/discrepanze" sopra + [Data Models — pagebuilder](./data-models-pagebuilder.md) + report di ricerca in `_bmad-output`
