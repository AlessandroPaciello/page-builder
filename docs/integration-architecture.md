# Integration Architecture — penpot-design-system

_Rigenerato: 2026-07-10 (full rescan). La versione precedente (2026-06-03) copriva solo Penpot→scripts→primitives→puck-components→strapi. Questa versione aggiunge `apps/pagebuilder` (nuovo backend JHipster) e `packages/ui`, e documenta i gap di integrazione emersi._

## Grafo delle dipendenze (workspace pnpm)

```
tokens  ◄──────────────── primitives ◄──────────── puck-components ◄─────┐
   ▲  ▲                       ▲         ▲                 ▲              │
   │  │                       │         │                 │              │
   │  └──── scripts           │         └── ui             └── storybook │
   │        (genera primitives)         (NON consumato     (aggrega     │
   │                                      da nessuna app)    storie)    │
   │                                                                     │
   └──────────────────────────── strapi (devDeps, legacy) ──────────────┘
                                   └─ plugin puck-builder (deps: primitives, puck-components, tokens)

apps/pagebuilder  ── ora DENTRO il workspace pnpm (⚠️ vedi source-tree-analysis.md) ──
                     ma NON dipende da nessun package interno via workspace:* —
                     il suo frontend (React 19, webpack) è isolato, gestito da npm/Maven,
                     e importa react-bootstrap invece delle composizioni @penpot-ds/ui.
```

| Parte | Dipende da (interne, `workspace:*`) |
|-------|----------------------|
| `tokens` | — (foglia) |
| `primitives` | `tokens` |
| `puck-components` | `primitives`, `tokens` |
| `ui` | `primitives`, `tokens` — ⚠️ nessun consumer reale ad oggi |
| `scripts` | `tokens` (legge, e **genera** file in `primitives`) |
| `storybook` | `primitives`, `puck-components`, `tokens` |
| `strapi` (devDeps, legacy) | `primitives`, `puck-components`, `tokens` |
| `apps/pagebuilder` | **nessuna** — toolchain npm/Maven separata, non consuma pacchetti workspace |

## Punti di integrazione

| # | Da | A | Tipo | Dettaglio |
|---|----|----|------|-----------|
| 1 | `scripts` | **Penpot** (esterno) | MCP (StreamableHTTP, `.mcp.json` → `localhost:4401/mcp`) | legge componenti/token dal design tool |
| 2 | `scripts` | `primitives` | Code generation (filesystem) | scrive `.tsx/.test/.stories` in `primitives/src/domains/**`, rispetta file editati a mano (skip se manca `@generated`) |
| 3 | `scripts` | `tokens` | Code generation (filesystem) | scrive `tailwind-theme.css` + `tokens.generated.ts`, **sempre sovrascritti** a ogni run |
| 4 | `tokens` | `primitives`, `puck-components`, `ui` | Import CSS vars + `tokens.generated.ts` | spacing/radii/colori |
| 5 | `puck-components` | `primitives` | Import React | ogni blocco Puck wrappa una primitive |
| 6 | `strapi` plugin admin | `puck-components` | Import `puckConfig` | editor legacy `<Puck config={puckConfig}>` |
| 7 | `strapi` admin client | `strapi` server | REST (admin) | `useTemplateApi` ↔ rotte `/puck-builder/...templates` |
| 8 | `strapi` server | DB | Documents API | content-type `template` (name, slug, config JSON) |
| 9 | `apps/pagebuilder` frontend | `apps/pagebuilder` backend | REST | `pagebuilderApi.ts` → `/api/pages`, `/api/page-versions` (~20 endpoint, vedi api-contracts-pagebuilder.md); ⚠️ possibile refuso: frontend chiama `GET /api/pages/{id}/versions`, backend espone `GET /api/pages/{id}/versions/history` |
| 10 | `apps/pagebuilder` frontend | Keycloak | OIDC | login via dev-server `:9000` (non `:8080` diretto — rompe redirect) |
| 11 | `apps/pagebuilder` backend | Postgres | JPA/Hibernate + Liquibase | entità `Page`/`PageVersion`, entrambe `@Audited` (Envers) |
| 12 | `puck-components` ↔ `apps/pagebuilder` | — | **Duplicazione manuale** | `field-classifier.json` (confine structure/content) esiste identico in entrambi i posti, nessun sync automatico → rischio drift futuro |
| 13 | `apps/strapi` ↔ `apps/pagebuilder` | — | **Migrazione dati, non ancora scriptata** | nessuno script converte `template.config` (Strapi) → `PageVersion.payload` (pagebuilder); da pianificare prima di Epic 5 |
| 14 | `storybook` | `primitives` + `puck-components` | Glob storie | `ui` non ancora integrato in Storybook (rimandato a Story 3.3) |

## Flusso dati end-to-end — stato di transizione

Il sistema oggi vive in uno stato **ibrido**: il vecchio flusso Strapi è ancora la produzione, il nuovo flusso pagebuilder è in costruzione ma non ancora convergente sul design system.

```
                    ── FLUSSO LEGACY (produzione) ──
[Designer in Penpot] ──(1,2,3)──► [scripts] ──► [primitives/tokens] ──► [puck-components]
                                                                              │ import
                                                                              ▼
                                              [strapi admin: TemplateEditor <Puck>]
                                                          │ REST (6,7)
                                                          ▼
                                              [strapi server] ──► DB: template.config (JSON)

                    ── FLUSSO NUOVO (in migrazione, Epic 4) ──
[apps/pagebuilder frontend: react-bootstrap + puck/*] ──REST (9)──► [apps/pagebuilder backend]
      │ OIDC (10)                                                          │ JPA/Envers (11)
      ▼                                                                    ▼
  [Keycloak]                                                     [Postgres: Page, PageVersion]

  ⚠️ @penpot-ds/ui (composizioni pronte: PageList, VersionList, EmptyState, TopBar, ...)
     NON è collegato a questo flusso — il frontend usa react-bootstrap in sua vece.
  ⚠️ Nessun ponte automatico tra i due flussi: la migrazione dati Strapi→Postgres è manuale/da definire.
```

## Confini di runtime React

- **Librerie design-system** (`primitives`, `puck-components`, `ui`, `storybook`): React **19** in devDeps, peer `^18 || ^19`.
- **Strapi admin (legacy)**: React **18** — root `pnpm.overrides` pinna `@types/react: ^18` per compatibilità.
- **`apps/pagebuilder`**: React **19.2.6** dichiarato, ma ora dentro il workspace pnpm (vedi discrepanza in source-tree-analysis.md) → possibile leak dell'override `@types/react ^18` sui suoi tipi, da verificare.
- Le primitive sono pubblicate con peerDeps compatibili con entrambe le major, così funzionano sia in Storybook (19) sia nell'admin Strapi (18) — ma `apps/pagebuilder` oggi non le importa affatto.

## Rischi di integrazione aperti (riepilogo)

1. **`apps/pagebuilder` nel workspace pnpm** senza esclusione esplicita — rischio override tipi React.
2. **`@penpot-ds/ui` non consumato** — design system e frontend pagebuilder sono due stack UI paralleli.
3. **`field-classifier.json` duplicato manualmente** tra `puck-components` e `apps/pagebuilder` — nessun sync automatico.
4. **Migrazione dati Strapi → pagebuilder non scriptata** — gap noto prima del cutover Epic 5.
5. **Possibile refuso endpoint**: `/api/pages/{id}/versions` (frontend) vs `/api/pages/{id}/versions/history` (backend).
6. **RBAC**: endpoint CRUD JHipster-generati su Page/PageVersion privi di `@PreAuthorize` — solo `authenticated()` globale (vedi api-contracts-pagebuilder.md).
