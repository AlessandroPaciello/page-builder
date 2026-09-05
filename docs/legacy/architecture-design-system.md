# Architecture — Design System Libraries

> Parti: `tokens`, `primitives`, `puck-components`, `scripts`, `storybook`.
> Approfondimenti correlati: [design-token-pipeline.md](./design-token-pipeline.md), [component-inventory.md](./component-inventory.md).

## Pattern comune (tutte le librerie)

- **Linguaggio**: TypeScript ~5.7, ESM (`"type": "module"`).
- **Build**: `tsup` → `dist/index.js` + `dist/index.d.ts` (eccetto `storybook`).
- **React**: 19 in devDeps, peer `^18 || ^19`.
- **Export map** in `package.json` (entry `.` + entry extra per tokens).
- **Lint**: `eslint src/`.

---

## `@penpot-ds/tokens`
- **Ruolo**: fonte di verità stilistica (colori/tipografia/spacing/radii/shadows), estratti da Penpot.
- **Pattern**: `tailwind-theme.css` (@generated, Tailwind v4 `@theme`) + `tokens.generated.ts` (@generated, spacing/radii per Puck) + `tailwind-extras.css` (hand-maintained, non-Penpot vars).
- **Export**: `.`, `./tailwind-theme.css`, `./tailwind-extras.css` — **`./css` e `./tailwind-preset` sono stati rimossi** (v3 preset dead code, nessun consumer: repo su Tailwind v4).
- **Nessuna dipendenza interna** (foglia del grafo).
- Dettaglio completo → [design-token-pipeline.md](./design-token-pipeline.md#b-sistema-token--tailwind-packagestokens).

## `@penpot-ds/primitives`
- **Ruolo**: 28 directory componente (25 esportate nel barrel pubblico — Column/Section/Stack rimosse) su 6 domini (data-display, inputs, feedback, layout, navigation, overlays). Le 7 primitive che a giugno risultavano mancanti (Dialog, Toast, Breadcrumb, Drawer, Table, Tabs, Dropdown) sono ora tutte implementate — vedi [component-inventory.md](./component-inventory.md).
- **Pattern**: `cva` per varianti, `cn()` (tailwind-merge esteso) per il merge classi, `forwardRef`, Radix UI per i componenti interattivi.
- **Struttura per dominio**: `data-display` / `inputs` / `feedback` / `layout` / `navigation` / `overlays`, co-location con story+test.
- **Test**: Vitest + Testing Library + `vitest-axe` (a11y), jsdom. Setup: `src/test-setup.ts`, config `vitest.config.ts`. Anche `ui` ora ha la stessa suite (non più solo `primitives`).
- **Dipende da**: `tokens`. Nessun file `@generated` nei componenti stessi (il marker `@generated` vive solo nella pipeline token: `tokens.generated.ts` e negli script).

## `@penpot-ds/puck-components`
- **Ruolo**: 20 blocchi Puck (`ComponentConfig`) aggregati in `puckConfig`.
- **Pattern**: ogni blocco = schema **Zod** + `fields` Puck + `render` che wrappa una primitive. Token applicati via `puck-tokens.ts`.
- **Slot**: container annidabili (`content`; `Columns` con `col1/col2/col3`).
- **Dipende da**: `primitives`, `tokens`. Entry: `src/index.ts → puckConfig`.

## `@penpot-ds/scripts`
- **Ruolo**: pipeline di generazione Penpot → codice (CLI).
- **Pattern**: stadi disaccoppiati (reader/extractor/analyzer/mapper/generator), MCP client, template Handlebars.
- **Entry**: `pnpm generate` (`src/pipeline.ts`), `pnpm generate:force` (sovrascrive).
- **Dipende da**: `tokens` (legge), **scrive** in `primitives`.
- Dettaglio → [design-token-pipeline.md](./design-token-pipeline.md#a-pipeline-penpot--codice-packagesscripts).

## `@penpot-ds/ui`
- **Ruolo**: composizioni React con semantica specifica dell'editor page-builder (lifecycle-Badge, TopBar, SaveStateIndicator, PageList, VersionList, EmptyState).
- **Regola di confine**: una primitiva non conosce il dominio page-builder. `@penpot-ds/ui` dipende da `@penpot-ds/primitives` (non viceversa). Nessun componente di `primitives` può importare da `ui`.
- **Struttura directory**: `src/compositions/<nome>/{Comp.tsx, Comp.test.tsx, Comp.stories.tsx, index.ts}` — co-location analoga a `primitives/domains/<categoria>/<componente>/`.
- **Dipende da**: `@penpot-ds/primitives`, `@penpot-ds/tokens`.
- **Consumer futuri**: Epic 4 (editor React shell), portale Cliente.
- ⚠️ **Drift osservato (2026-07-10)**: nonostante il nome, nessuna composizione di `ui` risulta ancora importata da `apps/pagebuilder`. Es. `PageListPage.tsx` usa componenti `react-bootstrap` invece della composizione `PageList`. Oggi design-system e frontend reale del page-builder sono due stack UI paralleli non convergenti — da riconciliare prima che il divario cresca ulteriormente.
- **Storybook**: integrazione rimandata a Story 3.3 (quando esistono le prime composizioni reali).
- **Test**: Vitest + Testing Library + `vitest-axe`, jsdom — identico a `primitives`.

## `@penpot-ds/storybook`
- **Ruolo**: documentazione/playground; aggrega le storie di `primitives` e `puck-components`.
- **Pattern**: Storybook 8 + `@storybook/react-vite`, plugin Tailwind via `viteFinal`, addon `essentials/a11y/interactions`, `autodocs`.
- **Config**: `.storybook/main.ts` (glob storie), `.storybook/preview.ts` (import `styles.css`).
- **Comandi**: `pnpm storybook` (dev, porta 6006), `pnpm storybook:build` (output `storybook-static/`).
- **Dipende da**: `primitives`, `puck-components`, `tokens`.

---

## Build & orchestrazione (Turborepo)

`turbo.json` task principali:

| Task | dependsOn | outputs | note |
|------|-----------|---------|------|
| `build` | `^build` | `dist/**` | cache |
| `test` | `build` | — | (solo primitives ha test) |
| `lint` | — | — | |
| `storybook:dev` | `^build` | — | persistent, no cache |
| `storybook:build` | `^build` | `storybook-static/**` | |
| `generate` | `^build` | — | no cache (pipeline scripts) |
| `develop` | `^build` | — | persistent (Strapi) |

L'ordine di build rispetta il grafo: `tokens → primitives → {puck-components, ui} → storybook`.
