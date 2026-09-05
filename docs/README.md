# Documentazione — page-builder

Questa cartella è il `project_knowledge` del progetto (vedi `_bmad/config.toml`): è qui che gli skill BMad cercano il contesto sulla codebase, ed è qui che atterra la documentazione generata da `bmad-document-project` (`[DP]`) o `bmad-generate-project-context` (`[GPC]`).

**Al momento è vuota** — il progetto è agli inizi (Epic 1). Ha senso popolarla quando ci sarà abbastanza codice da documentare, indicativamente a Epic 1 completata.

## Nel frattempo, la documentazione autorevole vive negli artefatti BMad

| Cosa cerchi | Documento |
|---|---|
| Architettura: paradigma esagonale, invarianti, dipendenze consentite | [`ARCHITECTURE-SPINE.md`](../_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md) |
| Contratto del "cosa" (CAP-1..CAP-14) | [`SPEC.md`](../_bmad-output/specs/spec-page-builder/SPEC.md) |
| Design system, pipeline Penpot, RBAC, a11y, glossario | [companions dello SPEC](../_bmad-output/specs/spec-page-builder/) |
| Piano di costruzione epic per epic | [`epics.md`](../_bmad-output/planning-artifacts/epics.md) |
| UX e mockup | [`DESIGN.md`](../_bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/DESIGN.md) |
| Stack, setup, comandi | [`README.md`](../README.md) di root |

## `legacy/`

Documentazione del progetto **precedente** (`penpot-design-system`: Strapi + JHipster), conservata come riferimento storico. Non descrive il codice attuale — vedi [`legacy/README.md`](./legacy/README.md) per quando ha senso consultarla.
