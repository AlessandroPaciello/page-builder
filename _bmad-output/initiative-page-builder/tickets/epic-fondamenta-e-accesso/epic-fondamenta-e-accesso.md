---
type: epic
title: "Fondamenta e accesso"
parent: initiative-page-builder
covers: [R12]
sources: [_bmad-output/initiative-page-builder/archive-v6/epics.md]
companions: [_bmad-output/initiative-page-builder/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md]
status: done
risk: low
---

# Fondamenta e accesso

## Description

Un utente si autentica, il sistema riconosce il suo ruolo e la shell dell'app gira, sopra un core di dominio e un modello dati che rispettano gli invarianti architetturali: scaffolding greenfield del workspace (create-better-t-stack → Next.js App Router, monorepo pnpm + Turborepo), skeleton del core di dominio esagonale (`packages/domain`), modello dati (Page/PageVersion/PageAssignment/AuditLog + indice univoco parziale ≤1 pubblicata), autenticazione Better Auth con ruoli Admin/Editor/Cliente e envelope Docker.

## Outcome

Un utente si autentica, il sistema riconosce il suo ruolo e la shell dell'app gira, deployabile in container con lo schema sempre applicato prima dell'avvio.

## Requirements

1. **R1 (parent R12):** Il sistema governa le operazioni tramite i ruoli Admin/Editor/Cliente, deny-by-default, con enforcement server-side su ogni via di lettura/scrittura del dominio.

## Constraints

- AD-1/AD-2: core di dominio esagonale in `packages/domain` (no HTTP, no React), unico punto di accesso al dominio, con adapter attorno e core estraibile.
- AD-4/AD-13: Better Auth (adapter Prisma) fornisce Principal + ruolo nel context oRPC; l'authz fine sta nel core; errori di dominio tipizzati, con semantica 404 vs 403.
- AD-7: indice univoco parziale Postgres via migration SQL esplicita, eseguita in release prima dell'avvio dell'app.
- NFR2: autorizzazione deny-by-default enforced server-side a copertura totale, su lettura e scrittura; nessuna via di modifica fuori dal core.
- NFR4: invariante ≤1 PUBLISHED per pagina a livello DB; ogni salvataggio crea una nuova versione DRAFT immutabile; `versionNumber` allocato dal core con `UNIQUE(page_id, version_number)`.
- [STARTER]: workspace inizializzato con `create-better-t-stack` 3.37.0, monorepo pnpm + Turborepo, stack pinnato (Next 16.x, React 19, PostgreSQL 18, Prisma 7.9+, Better Auth, oRPC, Tailwind 4); `@puckeditor/core` non è installato qui.

## Done when

- Il monorepo scaffoldato avvia `apps/web` in dev senza errori, senza residui legacy, e `packages/domain` compila e si testa senza importare React né moduli HTTP/Next (con regola di lint che fallisce su un import verso `apps/web`).
- `prisma migrate deploy` applica schema e indice parziale, e il DB rifiuta una seconda PageVersion PUBLISHED per la stessa Page.
- Dopo il login il ruolo è disponibile nel context oRPC, il core applica deny-by-default e una procedura che aggira il core è impedita da una convenzione verificabile.
- L'app risponde in ambiente containerizzato con `prisma migrate deploy` eseguito prima dell'avvio, dev/staging/prod sullo stesso artefatto.

## Boundaries

- Appartengono alle sorelle: il design system e la pipeline Penpot→codice (epic-design-system-token-e-componenti-da-penpot), blocchi, sezioni e composizioni (epic-blocchi-ed-elementi-dell-editor), editor e bozze (epic-editor-e-bozze), ciclo di vita e audit (epic-ciclo-di-vita-e-pubblicazione), render pubblico e commerce (epic-render-pubblico-e-vetrina-commerce).
- Qui non rientrano: `@puckeditor/core` (arriva in Epic 3/4), il deploy reale in staging/produzione (deferred) e la logica di business delle pagine.
- Must not change: nessuna mutazione del dominio che non passi dal core.

## References

- parent — `_bmad-output/initiative-page-builder/initiative-page-builder.md`, sezione Requirements
- architecture — `_bmad-output/initiative-page-builder/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md` (AD-1, AD-2, AD-4, AD-7, AD-13, [STARTER])
- prd — `_bmad-output/initiative-page-builder/spec-page-builder/SPEC.md` (CAP-12 RBAC, constraints authz e invariante)
- companion — `_bmad-output/initiative-page-builder/spec-page-builder/rbac-matrix.md`
- tracking v6 (archiviato) — `_bmad-output/initiative-page-builder/archive-v6/epics.md`, `_bmad-output/initiative-page-builder/archive-v6/sprint-status.yaml`

## Notes

- Retrospective: epic-1-retrospective (done)
- Decision: 2026-10-29 — stato dell'epic normalizzato a `done` (tutte le story e la retrospettiva sono done in v6), confermato dall'utente in sede di migrazione v6→v7.
