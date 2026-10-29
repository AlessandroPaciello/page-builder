<!-- bmad:context -->
<!-- Verified 2026-10-29 against 1a4a6ea. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## page-builder

Riscrittura greenfield full-TypeScript del page builder (Next.js + Turborepo, workspace `apps/*` + `packages/*`). Planning e ticket vivono nell'albero v7 in `_bmad-output/initiative-page-builder/`; documentazione in `docs/`. Lingua di comunicazione: Italiano.

## Policy

- Non usare `docs/legacy/` come grounding per story o decisioni tecniche: descrive la codebase precedente (penpot-design-system, Strapi+JHipster) ed è riferimento storico.
- Non committare mai il backup `.v6-v7-migration-backup-*/`.

## Where things are

- Iniziativa attiva: `initiative-page-builder` (in `_bmad/custom/config.user.toml` → `[core].active_initiative`).
- Albero ticket: `_bmad-output/initiative-page-builder/` — `tickets/tickets.toml` (6 epic), cartelle `epic-*/` con envelope + `tickets/` (entry e plan), `archive-v6/` (fonti v6).
- Interroga l'albero: `uv run _bmad/method/scripts/tickets.py --project-root . status` (senza argomento = iniziativa attiva).
- Store ticket: GitHub Issues via `gh` CLI, repo `AlessandroPaciello/page-builder`; config in `_bmad/custom/ticketing-store-config.toml`.
- Contratto "cosa" (spec-kernel, fa da PRD): `_bmad-output/initiative-page-builder/spec-page-builder/SPEC.md` (+ companions).
- Project knowledge: `docs/`.

## Running and verifying

- Script via Turborepo + pnpm: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm check-types`.
- Comandi DB (`pnpm db:push|migrate|generate`) presuppongono il DB avviato con `pnpm db:start` (stop: `pnpm db:stop`).
- CI: `.github/workflows/ci.yml`.

## Conventions that differ from defaults

- Stato di una story (v7): nel frontmatter del plan `story-*-plan.md` (`status`, `baseline_revision`), non in un campo `Status` di uno story file — lo story file v6 non esiste più.
- Tracking con Sofia (`bmad-agent-po`) e l'albero ticket; `epics.md` + `sprint-status.yaml` sono archiviati in `archive-v6/` (fonti, non vive).

## Known pitfalls

- I percorsi v6 (`_bmad-output/planning-artifacts/`, `_bmad-output/implementation-artifacts/`) non esistono più: il contenuto è in `initiative-page-builder/`.

<!-- /bmad:context -->
