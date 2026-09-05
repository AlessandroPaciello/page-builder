# ⚠️ Documentazione legacy — NON descrive il progetto attuale

> **Questa cartella è materiale di riferimento storico, congelato.**
> Descrive `penpot-design-system`, la codebase **precedente**, non il page-builder che stai costruendo.

## Cosa c'è qui dentro

Il deep-scan del 2026-07-10 di un monorepo con un'architettura che **non esiste più**:

- `apps/strapi` — CMS Strapi 5 con plugin custom `puck-builder` (legacy, era la produzione)
- `apps/pagebuilder` — backend JHipster 9.1 / Spring Boot 4 / Java 21 / Keycloak (era la migrazione in corso)

Nessuna delle due app esiste nel repo attuale. Oggi il progetto è una **riscrittura greenfield full-TypeScript**: monolite Next.js fullstack con core di dominio esagonale, Prisma/Postgres, Better Auth, oRPC.

## Dove sta la documentazione valida

| Cosa cerchi | Documento |
|---|---|
| Architettura attuale (paradigma, invarianti, dipendenze consentite) | [`ARCHITECTURE-SPINE.md`](../../_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md) |
| Contratto del "cosa" (CAP-1..CAP-14) | [`SPEC.md`](../../_bmad-output/specs/spec-page-builder/SPEC.md) + companions |
| Piano di costruzione | [`epics.md`](../../_bmad-output/planning-artifacts/epics.md) |
| Stack e setup | [`README.md`](../../README.md) di root |

Lo SPEC è esplicito in merito: *"La cartella `docs/` del progetto è materiale di riferimento ereditato da un'altra codebase: consultarla solo per colore narrativo, mai come descrizione del target — questo SPEC prevale."*

## Quando ha ancora senso consultarla

Serve per capire **cosa faceva** il sistema che stai sostituendo, quando devi replicarne il comportamento di dominio — soprattutto in Epic 4-5:

- `data-models-strapi.md` / `data-models-pagebuilder.md` — come erano modellati `template.config`, `Page`, `PageVersion`
- `api-contracts-*.md` — i contratti che il vecchio editor usava
- `integration-architecture.md` — il classifier `structure`/`content` e come veniva sincronizzato
- `design-token-pipeline.md` — la pipeline Penpot→codice via MCP
- `poc-fase-0-go-no-go-report.md` — il gate FR-17 e la decisione sulla linea versione

`rbac-matrix.md` e `a11y-baseline.md` hanno già una versione **aggiornata e autorevole** nei companion dello SPEC: usa quelle, non queste.

## Regola pratica

Leggila come si legge il codice di un sistema che stai rimpiazzando: per capire i requisiti impliciti, mai per copiare struttura, naming o scelte tecniche.
