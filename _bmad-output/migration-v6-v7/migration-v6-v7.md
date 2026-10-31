---
type: migration
title: "Migrazione v6 → v7 — ticket tree page-builder"
status: done
created: 2026-10-29
module: method
from: "6"
to: "7"
---

# Piano di migrazione v6 → v7 (page-builder)

> **Stato: ESEGUITO.** Applicato il 2026-10-29 (commit `ab1ecd2`). Il passo di
> riscrittura dei link previsto da `migration-1.toml:177` **non era stato eseguito**:
> è stato completato e verificato il 2026-10-31 — vedi §10.

## 1. Risposte confermate

| Domanda | Risposta |
|---|---|
| Cartella planning | `_bmad-output/planning-artifacts` ✅ |
| Cartella implementation | `_bmad-output/implementation-artifacts` ✅ |
| Altrove da considerare | No — le companion (`specs/`, `forge/`, `spikes/`, `brainstorming/`) restano dove sono, la migrazione tira dentro solo quelle collegate |
| Store (workspace) | **Default `{project-root}/_bmad-output`** — nessun repo separato, nessuna cartella dedicata. `workspace = No` |
| `epics-penpot-estrazione-costruzione.md` (superseded) | Archiviato come storico (`archive-v6/`) |

Backup già creato e verificato: **`.v6-v7-migration-backup-20261029-2255/`** (`_bmad/` 64 file, `_bmad-output/` 173 file — identici alle origini, `.gitignore` = `*`, non committato).

## 2. Albero target

`<root>` = `{project-root}/_bmad-output`

```
_bmad-output/
  initiative-page-builder/
    initiative-page-builder.md              # envelope (da spec-page-builder/SPEC.md, lo spec-kernel = PRD)
    spec-page-builder/                      # doc folder: SPEC.md + companions (design-system, penpot-pipeline, rbac-matrix, a11y-baseline, glossary)
    architecture-page-builder-2026-07-25/   # doc folder: ARCHITECTURE-SPINE.md
    architecture-page-builder-2026-10-03/   # doc folder: ARCHITECTURE-SPINE.md
    ux-page-builder-2026-07-26/             # doc folder: DESIGN.md + EXPERIENCE.md + mockups/
    deferred-work.md                        # mosso invariato
    tickets/
      tickets.toml                          # 1 [[epic]] per epic (6), in ordine di build
      epic-fondamenta-e-accesso/            # Epic 1
        epic-fondamenta-e-accesso.md
        epic-fondamenta-e-accesso-retrospective.md
        tickets/
          tickets.toml                      # [[entry]] per story, in ordine
          story-<slug>-plan.md              # i build record done diventano plan
      epic-design-system-token-e-componenti-da-penpot/   # Epic 2  (id 2)
      epic-blocchi-ed-elementi-dell-editor/              # Epic 3  (id 3)
      epic-editor-e-bozze/                               # Epic 4  (id 4)
      epic-ciclo-di-vita-e-pubblicazione/                # Epic 5  (id 5)
      epic-render-pubblico-e-vetrina-commerce/           # Epic 6  (id 6)
    archive-v6/                             # sprint-status.yaml, epics.md, epic-*-context.md, build record non plan, doc superseded
    migration-v6-v7/migration-v6-v7.md      # questo piano
  backlog/                                  # (vuoto: nessuna story orfana senza epic)
  archive/                                  # (vuoto per ora)
  # restano al posto loro: brainstorming/, forge/, spikes/, specs/spec-penpot-* , party-mode/
```

## 3. Mappa epic → story → stato (v6 → v7)

Stato v7 da `sprint-status.yaml`. Mapping: `done`→`done`, `backlog`→entry senza plan, retro `done`→riga `Retrospective:`.

### Epic 1 — "Fondamenta e accesso" (`epic-1`)
Stato epica v6 `in-progress` → **propongo normalizzare a `done`** (tutte le story + retro sono `done`; vedi §5).
| id v7 | v6 | Titolo | Stato |
|---|---|---|---|
| 1 | 1.1 | Scaffolding greenfield del workspace | done |
| 2 | 1.2 | Skeleton del core di dominio esagonale | done |
| 3 | 1.3 | Modello dati e invariante di pubblicazione a livello DB | done |
| 4 | 1.4 | Autenticazione con ruoli Admin/Editor/Cliente | done |
| 5 | 1.5 | Context oRPC con Principal e policy deny-by-default | done |
| 6 | 1.6 | Envelope Docker e migration in release | done |
| 7* | 1-1 | Prima lettura live con disciplina (slice, no `### Story`) | done |
| 8* | 1-2 | Diff token e proposta in un colpo (slice) | done |
| 9* | 1-3 | Canarino del primo gate H1 (slice) | done |
| 10*| 1-4 | Tracciante verticale su un token (slice) | done |

\* Le 4 story "slice" hanno build record ma **nessun `### Story` in epics.md** → la migrazione crea delle entry scritte dal file, con id successivi (7–10). **Da confermare**: entry oppure archiviare come artefatti di tracking (vedi §5).

### Epic 2 — "Design system — token e componenti da Penpot" (`epic-2`)
Stato epica v6 `in-progress` → **resta `in-progress`** (ha story in backlog).
| id v7 | v6 | Titolo | Stato |
|---|---|---|---|
| 1–25 | 2.1–2.25 | (pipeline token, contratti, library, extract/render, ProductCard, v1→v3, tema, a11y, MCP, collaudo Penpot…) | **done** |
| 26 | 2.26 | Tema da seme CSS, varianti di tema e font | backlog |
| 27 | 2.27 | Sezioni | backlog |
| 28 | 2.28 | Skill `pds-design` e configurazione di progetto | backlog |
| 29 | 2.29 | Skill `pds-code` | backlog |
| 30 | 2.30 | Comportamento accessibile | backlog |
| 31 | 2.31 | Rigenerazione dei componenti di prova con la v3 | backlog |
| 32 | 2.32 | Libreria componenti accessibile | backlog |

*Storie 2.7 e 2.8*: i build record a/b/c (`2-7a/b/c`, `2-8a/b/c`) fondonsi in **un plan ciascuna** (il più recente è il plan, gli altri in `## Prior builds`).

### Epic 3 — "Blocchi ed elementi dell'editor" (`epic-3`) — epica `backlog`
| id v7 | v6 | Titolo | Stato |
|---|---|---|---|
| 1–5 | 3.1–3.5 | Ponte token→Puck, blocchi adapter, classifier, sezioni, composizioni | backlog (entry senza plan) |

### Epic 4 — "Editor e bozze" (`epic-4`) — epica `backlog`
| id v7 | v6 | Titolo | Stato |
|---|---|---|---|
| 1–4 | 4.1–4.4 | Shell editor, salvataggio bozza, pipeline payload, autosave | backlog |

### Epic 5 — "Ciclo di vita e pubblicazione" (`epic-5`) — epica `backlog`
| id v7 | v6 | Titolo | Stato |
|---|---|---|---|
| 1–4 | 5.1–5.4 | Pubblicazione atomica, rollback, archiviazione, audit trail | backlog |

### Epic 6 — "Render pubblico e vetrina commerce" (`epic-6`) — epica `backlog`
| id v7 | v6 | Titolo | Stato |
|---|---|---|---|
| 1–4 | 6.1–6.4 | Render SSG, invalidazione ISR, CommerceProvider, blocchi commerce | backlog |

**Totali**: 6 epic · 55 story da epics.md (+4 slice = 59 entry) · done: 31 (6 epic1 classiche + 25 epic2) + 4 slice = 39 · backlog: 28.

## 4. Cosa si sposta dove (a cartella)

**Da `planning-artifacts/` → dentro `initiative-page-builder/`:**
- `epics.md` → si legge e genera tickets; poi → `archive-v6/` (fonte di tracking).
- `architecture/architecture-page-builder-2026-07-25/` → doc folder (intatto).
- `architecture/architecture-page-builder-2026-10-03/` → doc folder (intatto).
- `ux-designs/ux-page-builder-2026-07-26/` → doc folder (intatto).
- `epics-penpot-estrazione-costruzione.md` (superseded) → `archive-v6/` (storico).
- readiness report e sprint-change-proposal (datati) → `archive-v6/` come versioni storiche.

**Da `implementation-artifacts/`:**
- build record delle story `done` → `tickets/epic-*/tickets/story-<slug>-plan.md` (status `done`, con baseline_commit quando presente).
- `epic-1-context.md`, `epic-2-context.md` (cache) → `archive-v6/`.
- `sprint-status.yaml` → `archive-v6/`.
- `deferred-work.md` → `initiative-page-builder/` (invariato).

**Da `specs/`:**
- `spec-page-builder/` (spec-kernel = PRD, niente stories.yaml) → doc folder dentro l'iniziativa (SPEC.md + companions).
- `spec-refactor-packages-scripts/` (ha stories.yaml ma le sue 4 story = 2.12–2.15, già in epic 2) → **`archive-v6/`** (le story sono già migrate; niente epic duplicata). *Da confermare.*
- `spec-penpot-estrazione-costruzione/` e `spec-penpot-dev-mcp/` (niente stories.yaml, non legate a un'epica attiva) → **restano in `specs/`** (regola "What stays in place").

## 5. Decisioni speciali — DA CONFERMARE

1. **4 story slice (spec-1-1…1-4)** — build record senza `### Story`. Opzioni:
   - **(a, consigliata)** entry in Epic 1 con id 7–10, status `done`, plan = il loro build record → preserva la storia del lavoro vertical-slice.
   - **(b)** archiviare in `archive-v6/` come artefatti di tracking, senza entry.
2. **Stato Epic 1**: v6 `in-progress` ma tutto `done` → propongo **`done`** (normalizzazione). Confermi o mantengo `in-progress`?
3. **`spec-refactor-packages-scripts/`** → `archive-v6/` (§4). Confermi?
4. **Domanda "fold unstarted"**: le story backlog (2.26–2.32, epic 3–6) **non hanno build record**, quindi niente da foldare; la domanda è senza oggetto.

## 6. Cosa resta al posto suo (con motivo)

- `party-mode/` — la v7 ci legge la memoria.
- `forge/`, `spikes/` — sessioni/idee non legate a un'epica attiva (spike penpot-ai-kit è companion di epics.md ma resta uno spike).
- `brainstorming/brainstorm-penpot-estrazione-costruzione-2026-10-03/` — della slice superseded, nessuna iniziativa attiva.
- `docs/` (project_knowledge) — fuori dallo store, non toccato.
- `AGENTS.md` / file del progetto — la migrazione **non li edita**: lista i vecchi riferimenti come promemoria da aggiornare tu.

## 7. Cambi di configurazione

- `_bmad/custom/config.user.toml` → aggiungere sotto `[core]`: `active_initiative = "initiative-page-builder"`.
- `core.output_folder` resta `{project-root}/_bmad-output` (nessun cambio, store di default).
- `planning_artifacts` / `implementation_artifacts` → la guida dice di **lasciarli stare** (`bmad setup` possiede il resto di `_bmad/`).
- Pulizia v6 (`migrate_v6.py --clean`): drop delle chiavi custom lette dalle skill ritirate (`initiative_template`, `epic_template`, `story_template`, …). **Da eseguire solo dopo l'approvazione**, con suo backup.

## 8. Verifiche (checklist post-applicazione)

1. Ogni file delle cartelle sorgente è sotto iniziativa / `backlog/` / `archive/` / `archive-v6/` o elencato come lasciato in posto.
2. Ogni doc folder ha tenuto nome v6 e tutti i file; esistono `initiative-page-builder/`, `backlog/`, `archive/`.
3. `uv run _bmad/method/scripts/tickets.py status <initiative>` esce 0 per ogni iniziativa; conteggi story = fonti v6.
4. Ogni story = una entry; ogni build record done = un plan; niente story file d'epica scritti.
5. Ogni plan ha build type e stato mappato; le baseline mancanti sono disclose (mai inferite da HEAD).
6. `config.user.toml` nomina l'iniziativa attiva; `output_folder` risolve allo store.
7. Store sotto git, nessun file tracciato da due repo, backup non committato.
8. Backup `.v6-v7-migration-backup-20261029-2255/` contiene ogni file originale.
9. Ogni riferimento a un path v6 nei file vivi risolve a un file esistente
   (`migration-1.toml:177` e `:214`) — **eseguita e chiusa il 2026-10-31, vedi §10.3**.

## 9. Dopo l'eseguzione (prossimi passi)

- Sofia (`bmad-agent-po`) **sostituisce** `bmad-sprint-planning`, `bmad-create-epics-and-stories`, `bmad-spec`, `bmad-correct-course` (e `bmad-ticket`).
- Prossimo lavoro: `bmad-build` sulla prossima entry (niente story file pescati).
- `bmad-project-context` per un `AGENTS.md` root che nomini l'iniziativa attiva.

## 10. Report di esecuzione e verifica (2026-10-31)

Applicata il 2026-10-29 (`ab1ecd2`); riferimenti fuori dallo store aggiornati il giorno dopo (`c05cd3a`). Questo §10 chiude il documento, che era rimasto col banner DRAFT.

### 10.1 Cosa la migrazione non aveva fatto

Il passo di `migration-1.toml:177` — *«Search the store for each old path and rewrite live references to it»* — **non era stato eseguito**: sul diff di `ab1ecd2` risultano **0 righe di contenuto rimosse** contenenti un path v6, su tutte e quattro le famiglie (`planning-artifacts`, `implementation-artifacts`, `specs/spec-page-builder`, `specs/spec-refactor-packages-scripts`); 58 file sono stati spostati con contenuto byte-identico (`R100`). Anche `:179` (ricalcolo dei link relativi dei file spostati) non era stato applicato.

Il passo è sfuggito perché **le checklist §8 di questo piano avevano 8 voci e nessuna parlava di risoluzione dei link**: il piano locale ha rimpiazzato la checklist di `migration-1.toml`, che lo contiene a `:214`, senza riprodurlo.

Effetto: **242 occorrenze rotte in 46 file vivi**, più 4 link relativi non ricalcolati che non contenevano alcun token v6 e quindi non erano individuabili con una ricerca di path.

### 10.2 Cosa è stato fatto il 2026-10-31

| Classe | N. | Trattamento |
|---|---|---|
| A — file spostati intatti | 192 prosa + 9 link | swap di prefisso; i target di link markdown ricalcolati relativi alla cartella del file |
| B — build record assorbiti dai plan | 48 | puntano al `story-*-plan.md` che li ha incorporati (match sullo slug) |
| C — caso singolo | 3 | `2-3-renderer-deterministico-e-gate-ci.md` → story 2.6; catena verificata su git: `b41c951` lo ha **rinominato** (R096) in `2-6-emitter-…`, la migrazione l'ha fuso nel plan |
| D — link relativi mai ricalcolati | 4 | corretti a mano: 1 nella spine 10-03, 3 nel plan di story 2.1 |

**Stile**: assoluto da root (`_bmad-output/…`) per prosa, frontmatter e righe `[Source: …]`; relativo alla cartella del file per i target `](…)`. Contesti sintattici diversi, richiedono forme diverse.

**Non toccati, per regola**: `initiative-page-builder/archive-v6/` (fonti storiche, `migration-1:179`), `migration-v6-v7/` (questo documento), `docs/legacy/`.

**Deviazione registrata**: 3 file *"lasciati al posto loro"* (`specs/spec-penpot-estrazione-costruzione/SPEC.md`, `spikes/penpot-ai-kit-2026-10-10/README.md`, `forge/pds-v3-punti-aperti/forged-idea.md`) contenevano 4 riferimenti rotti verso cartelle spostate. Sono stati riscritti comunque, contro la lettera di `migration-1:179`: 4 occorrenze, e lasciarle rotte avrebbe fatto terminare in un punto cieco chi segue `penpot-pipeline.md` → spike → README.

**Residui accettati (2)**: `deferred-work.md:235` e `initiative-page-builder.md:83` nominano il *nome* della cartella v6 in prosa storica, non un path. Riscriverli ne avrebbe alterato il senso.

### 10.3 Verifiche eseguite

1. ✅ 125 target di link markdown nei file vivi → **tutti esistenti, 0 rotti**
2. ✅ 335 path assoluti `_bmad-output/…` → **tutti esistenti, 0 rotti**
3. ✅ token `planning-artifacts` / `implementation-artifacts` nei file vivi → **2**, entrambi menzioni in prosa storica
4. ✅ `uv run _bmad/method/scripts/tickets.py --project-root . status` → **exit 0**, 59 ticket (35 done / 24 planned), 6 epic tutti `refined: true`, nessun `order_conflict` / `unpinned_after` / `undeclared_after`
5. ✅ backup rimosso dopo verifica: `ab1ecd2^` contiene i 173 file originali di `_bmad-output`, stesso conteggio dichiarato al §1
6. ✅ ogni file delle cartelle sorgente è sotto iniziativa / `backlog/` / `archive-v6/` o elencato al §6

### 10.4 Correzioni strutturali fatte in corso

- **Spine autorevole**: `architecture-page-builder-2026-10-03` è `status: superseded` nel suo frontmatter ed è stata rimossa dai `companions:` di iniziativa e dei tre epic che la citavano — **i quali non avevano la spine autorevole `2026-07-25` affatto**. Il gate H2 (`card-reference`), unica copia esistente e assente sia nella 07-25 sia nel suo `superseded_by`, è stato trasferito in `spec-page-builder/penpot-pipeline.md` prima della demozione. Registrato nei `Notes` dell'iniziativa.
- **Pulizia**: rimossi il backup di migrazione (4,1 MB, redundante su git) e `backlog/story-bmad-setup-test.md` (dropped, issue #70).
