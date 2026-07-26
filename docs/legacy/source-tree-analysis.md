# Source Tree Analysis

_Rigenerato: 2026-07-10 (full rescan, deep scan). Sostituisce la versione del 2026-06-03, che copriva solo `strapi` + le librerie design-system._

```
penpot-design-system/                  # monorepo (pnpm workspace + Turborepo)
├── packages/                          # 6 librerie design-system (pnpm+turbo, TS/React)
│   ├── tokens/                        # @penpot-ds/tokens — foglia del grafo, token generati da Penpot
│   │   └── src/
│   │       ├── tailwind-theme.css     # @generated — NON editare a mano
│   │       ├── tailwind-extras.css    # hand-maintained (var non-Penpot: --font-utility, --leading-*)
│   │       └── tokens.generated.ts    # @generated — spacing/radii per Puck
│   ├── primitives/                    # @penpot-ds/primitives — 28 componenti Radix+CVA, dipende da tokens
│   │   └── src/domains/
│   │       ├── data-display/ inputs/ feedback/ layout/ navigation/ overlays/
│   │       └── <componente>/{Comp.tsx, Comp.test.tsx, Comp.stories.tsx, index.ts}
│   ├── puck-components/               # @penpot-ds/puck-components — 20 blocchi Puck, dipende da primitives+tokens
│   │   └── src/                       # ogni blocco: schema Zod + fields Puck + render
│   ├── ui/                            # @penpot-ds/ui — NUOVO (dopo inizio giugno), composizioni page-builder
│   │   └── src/compositions/          # save-state-indicator/ lifecycle-badge/ top-bar/ version-list/
│   │       └── ...                    # empty-state/ page-list/ — dipende da primitives+tokens
│   │                                  # ⚠️ non ancora consumato da nessuna app (vedi architecture-design-system.md)
│   ├── scripts/                       # @penpot-ds/scripts — pipeline Penpot→codice (MCP client)
│   │   └── src/                       # theme-generator.ts, generate-theme.ts, code-generator.ts, radix-mapper.ts,
│   │                                  # token-resolver.ts, css-to-tailwind.ts, check-artifacts.ts
│   └── storybook/                     # @penpot-ds/storybook — playground, aggrega primitives+puck-components
│
├── apps/
│   ├── strapi/                        # @penpot-ds/strapi — LEGACY, sorgente di migrazione, solo lettura
│   │   └── src/
│   │       ├── api/                   # content-type "template" (name, slug, config JSON)
│   │       ├── plugins/puck-builder/  # plugin custom: server/ (API) + admin/ (UI editor)
│   │       └── extensions/
│   │
│   └── pagebuilder/                   # JHipster (Spring Boot 4 + React 19) — nuovo backend, in migrazione attiva
│       ├── pom.xml                    # Java 21, Maven wrapper (./mvnw)
│       ├── src/main/java/.../
│       │   ├── domain/                # Page, PageVersion (entrambe @Audited/Envers)
│       │   ├── repository/
│       │   └── web/rest/              # PageResource, PageVersionResource, PageAuditResource, ...
│       ├── src/main/resources/
│       │   ├── config/liquibase/      # schema via JDL→Liquibase; changelog envers revinfo (⚠️ non committato)
│       │   └── puck/field-classifier.json  # copia del classifier structure/content (sync manuale con puck-components)
│       └── src/main/webapp/app/
│           ├── entities/page(-version)/    # CRUD JHipster-generato
│           ├── pagebuilder/                # codice custom: puck/, pages/, api/, store/
│           └── shared/auth/                # OIDC/Keycloak
│
├── docker-compose.yaml                # stack dev condiviso
├── pnpm-workspace.yaml                # ⚠️ include apps/pagebuilder senza esclusioni (vedi discrepanza sotto)
├── turbo.json                         # orchestrazione build/test/lint/generate per packages/*
└── .github/                           # solo agenti BMad (.github/agents/); NESSUNA pipeline CI/CD reale
```

## Nota architetturale: due toolchain nello stesso repo

- **Design system** (`packages/*`): pnpm + Turborepo, TS/React, build `tsup`.
- **`apps/pagebuilder`**: JHipster/Maven per il backend, npm/webpack per il frontend embedded (`./mvnw` orchestrazione unica). Storicamente pensato come **escluso** dal grafo pnpm (per non far colare l'override `@types/react ^18` sul suo React 19).
- **`apps/strapi`**: legacy Node/Strapi 5, incluso nel workspace pnpm, sola lettura.

## ⚠️ Discrepanza rilevata: `apps/pagebuilder` ora DENTRO il workspace pnpm

Il commit `ae6327a` ("chore: exclude pagebuilder app from pnpm workspace to prevent dependency conflicts") ha in realtà **rimosso** la riga `- "!apps/pagebuilder"` da `pnpm-workspace.yaml`, cioè l'opposto di quanto dice il messaggio di commit. `pnpm-workspace.yaml` attuale non esclude più nulla: `apps/pagebuilder` è oggi dentro il workspace pnpm.

Rischio concreto: il root `pnpm.overrides` pinna `@types/react: ^18` a tutto il workspace, ma `apps/pagebuilder` dichiara React `19.2.6` — possibile leak dell'override sui tipi del frontend pagebuilder. Dettaglio completo → [architecture-pagebuilder.md](./architecture-pagebuilder.md).

## Cartelle critiche per parte

| Parte | Cartelle critiche | Note |
|---|---|---|
| `tokens` | `src/` | genera CSS/TS, mai editati a mano |
| `primitives` | `src/domains/<categoria>/<componente>/` | co-location comp+test+story |
| `puck-components` | `src/` | blocchi Puck, classifier structure/content |
| `ui` | `src/compositions/<nome>/` | non ancora consumato da app reali |
| `scripts` | `src/` | pipeline CLI, MCP client |
| `pagebuilder` | `src/main/java/.../domain,repository,web/rest`, `src/main/webapp/app/pagebuilder/`, `src/main/resources/config/liquibase/` | generato JHipster + codice custom misto |
| `strapi` | `src/api/`, `src/plugins/puck-builder/` | legacy, sola lettura |
