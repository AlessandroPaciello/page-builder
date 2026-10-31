---
title: 'Tema da seme CSS, varianti di tema e font'
type: 'feature'
ticket: '26'
created: '2026-10-31'
status: 'done'
baseline_revision: '3e24807b7f937f2f385b200ba06d8fb38938a559'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-page-builder/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `tokens_from_css` ed `extract_theme` del server `pds` sono stub. Il tema committato nasce ancora dal comando `theme`, che legge solo i set attivi, rifiuta nomi uguali in set diversi (bug 6), non conosce varianti né font, mentre Next carica Geist via `next/font`.

**Approach:** Portare nel codice di produzione i due prototipi dello spike (`css-to-tokens.mjs`, `extract-themes.ts`) come funzioni pure dietro i due strumenti del server. `tokens_from_css` va dal seme a set e temi Penpot (con avvisi); `extract_theme` legge da Penpot tutti i set e i temi e scrive `theme.css`, `themes/<gruppo>-<nome>.css` e `fonts.css` `@generated`. Poi si rimuovono il comando `theme` e `next/font`.

## Decisions (2026-10-31)

- **File:** in `packages/tokens/src/`: `tailwind-theme.css` → `theme.css`, più `themes/<g>-<n>.css` e `fonts.css`; `tokens.generated.ts` resta, anch'esso da `extract_theme`; export di `@penpot-ds/tokens` e import di `globals.css` aggiornati.
- **Rigenerazione:** il tema committato si rigenera in questa story con `extract_theme` dal Penpot vero così com'è (in sessione, Penpot acceso); `data/penpot-catalog.json` si elimina; le famiglie attuali diventano `fonts.css` + pacchetti `@fontsource/*`.
- **`fonts`:** argomento di `extract_theme`, `{ fonts?: "fontsource" }` con default `fontsource`; un altro valore è un rifiuto esplicito. La 2.28 lo passerà dalla configurazione di progetto.
- **Pesi:** un `@import "@fontsource/<famiglia>/<peso>.css";` per ogni peso dei token `fontWeights` del tema, per ogni famiglia non di sistema; lo strumento restituisce anche l'elenco dei pacchetti da installare.
- **Dimensione:** plan tenuto intero (~3.500 token) per scelta dell'utente.

## Boundaries & Constraints

**Always:**
- Le conversioni sono funzioni pure (nessun disco o rete) in `src/core` o `src/shared`, nel rispetto di `check-boundaries.mjs`. Il server legge il file (`tailwindcss/theme.css` installato) e scrive, l'adattatore legge Penpot.
- Il nome della variabile CSS deriva dal tipo del token (`varName`), mai dal nome del set.
- Ogni perdita è esplicita: un `spread` negativo diventa 0, un colore fuori sRGB va al più vicino, una variabile non traducibile è saltata. Tutti e tre producono un avviso che nomina la variabile.
- I CSS generati portano un'intestazione `@generated` con versione + sha256 (forma a commento CSS), e il controllo di livello 3 copre anche i `.css`.
- Il server non scrive mai su Penpot: `tokens_from_css` restituisce set e temi, non li applica.

**Never:**
- Nessuna CLI di prodotto: il comando `theme`, `src/theme/` e lo script `theme` spariscono.
- Niente `next/font` e niente Geist. Nessun blocco CSS scritto a mano ridefinisce colori, raggi o font del tema.
- Non si toccano le skill `pds-design` e `pds-code` né la configurazione `pds-setup` (Story 2.28-2.29). Sezioni e accessibilità restano fuori.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Seme dello spike | `theme.css` dello spike | set `tailwind`, `semantic`, `brand/ocean`; temi `brand/default` (nessun set) e `brand/ocean` | nessun errore; avvisi per quanto saltato o modificato |
| Spread negativo | ombra `0 1px 2px -1px …` | `spread: "0"` + avviso | — |
| Colore fuori sRGB | oklch fuori gamut | hex più vicino + avviso | — |
| Variante con ruolo ignoto | `[data-x="y"] { --color-nuovo: … }` assente dalla base | avviso che nomina il ruolo | — |
| Nomi uguali in set diversi | `color.primary` in `semantic` e in `brand/ocean` | `theme.css` dalla base, `themes/brand-ocean.css` con le sole variabili che cambiano | nessun errore (bug 6 chiuso) |
| Set non attivi | set presenti ma non attivi in Penpot | letti comunque | — |
| Collisione vera | due token della base con la stessa variabile | — | `isError` che nomina i due token, nessun file scritto |
| Font di sistema | `fontFamilies` che inizia con `ui-`/`system-` o generico | nessun import in `fonts.css` | — |

</frozen-after-approval>

## Code Map

Paths relative to `packages/scripts/` unless they start with `packages/` or `apps/`.

- `src/shared/theme-generator.ts`: `generateTheme(catalog)` (pure; `{css, ts}`) and `buildIndex` (`:74-107`, duplicates rejected). Reuse it as is for the base. The variants are diffed against the base, as in the spike. Replace the old header (`cssHeader`/`tsHeader`, `REGEN_COMMAND`, `fixtureHash` used as provenance) with the pds header. `fixtureHash` stays exported for anyone who still imports it.
- `src/core/hash.ts`: `withGeneratedHeader`, `readGeneratedHeader`, and `GENERATOR_VERSION`. Add the CSS-comment form, and make reading accept both forms.
- `src/core/token-names.ts`: `varName` and `TYPE_NAMESPACE`. Do not change.
- `src/server/generated-files.ts`: `SOURCE = /\.(ts|tsx)$/` and `DAMAGED_MARKER`. Extend both to `.css`, with the matching message (`extract_theme` instead of `generate_component`).
- `src/server/server.ts:161,163`: the stubs. `PenpotAdapter` (`:45`) gains `readThemes` (or `readTokenCatalog` gains themes and every set). `coreContext` (`:91`) must use the **base** catalog only, because the variants now repeat token names.
- `src/server/tools.ts:42-50`: the schemas; update the descriptions and remove `NOT_YET` once nothing uses it. Add an `output` for both tools.
- `src/server/main.ts:20-26`: binds the real reader.
- `src/penpot/penpot-reader.ts:20-34`: `READ_TOKEN_CATALOG_CODE` keeps only the active sets. Port the spike's READ_CODE (every `sets` plus `themes` with `activeSets`), keeping the envelope check (`:36-70`).
- `src/server/write-changes.ts`: confined to `packages/ui/src/domains/<name>/`. The theme needs its own confined writer for `packages/tokens/src/` (same rules: no `..`, no symlinks, overwrite only files that carry the pds marker).
- Spike `_bmad-output/spikes/penpot-ai-kit-2026-10-10/tailwind-to-penpot/`: `css-to-tokens.mjs` (`parseTheme`, `oklchToHex` with clamp, `parseShadow`, `classify`, `convert`, `parseVariants`, `convertVariants`) and `extract-themes.ts` (base versus variant, diff). Port them; do not import them.
- To delete: `src/theme/main.ts`, `src/theme/theme-command.ts`, `src/theme/main.test.ts`, and the `theme` script in `package.json:11`. Update `tests/pipeline-boundary.test.ts:52-59`, which lists `main.ts` as the only `process.exit`.
- `src/shared/paths.ts`: `catalogPath` and `tokensSrcDir`. Also `tests/paths.test.ts:33-38`.
- Tests: `tests/server/server.test.ts:44-49` (fake `adapter()`) and `:389-411` (stub assertions to rewrite). `tests/fixtures/catalog.ts` (`loadTailwindCatalog`, leaves out `brand/ocean`). `tests/core/registry-tailwind.test.ts` (level 4).
- `packages/tokens/`: `package.json` (description with `generate:theme`, exports) and `src/tailwind-extras.css` (hand-written, stays).
- `packages/ui/src/styles/globals.css:9` imports the theme. `packages/ui/src/styles/theme-in-css.test.ts:82,108,144-152` uses Geist as a shadcn fixture.
- `apps/web/src/app/layout.tsx:2,8-17,31`: Geist via `next/font`. `apps/storybook/.storybook/preview.ts`: imports `globals.css` only.
- READMEs: `README.md:18,46`, `src/server/README.md:23-24`. Deferred-work: `deferred-work.md:313-314` (`REGEN_COMMAND`) is closed here.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/hash.ts` -- forma `/* @generated pds … */` per i CSS, lettura di entrambe -- livello 3 sui CSS
- [x] `src/shared/tokens-from-css.ts` (+ test) -- port puro di `css-to-tokens` con default Tailwind + seme → `{ sets, themes, warnings }`; spread negativo → 0 e clamp sRGB con avviso -- AC 1
- [x] `src/shared/extract-theme.ts` (+ test) -- set e temi → base + varianti → `theme.css`, `themes/*.css`, `tokens.generated.ts`, `fonts.css` con intestazione pds -- AC 2-3
- [x] `src/shared/theme-generator.ts` -- intestazione pds, via `REGEN_COMMAND` -- un solo meccanismo `@generated`
- [x] `src/penpot/penpot-reader.ts` + `src/server/main.ts` -- lettura di tutti i set e dei temi -- bug 6
- [x] `src/server/{server,tools,generated-files}.ts` + scrittore confinato per `packages/tokens/src/` -- strumenti veri, contesto dalla base, `.css` nel livello 3
- [x] `tests/fixtures/` -- seme dello spike come fixture; test di livello 4 del giro seme → token → CSS -- AC 2
- [x] `src/theme/*`, `package.json`, `src/shared/paths.ts`, `tests/pipeline-boundary.test.ts`, `tests/paths.test.ts` -- rimozione del comando `theme` -- AC 4
- [x] `apps/web/src/app/layout.tsx`, `apps/storybook/.storybook/preview.ts`, `packages/ui/src/styles/*`, `packages/tokens/*` -- `fonts.css` in Next e Storybook, via `next/font`/Geist -- AC 3
- [x] READMEs (`packages/scripts`, `src/server`, `packages/tokens`) e voce di `deferred-work.md` -- documentazione allineata
- [x] `packages/tokens/src/*` (rigenerati), `data/penpot-catalog.json` (eliminato), dipendenze `@fontsource/*` -- ultimo passo, in sessione con Penpot acceso: `extract_theme` sul Penpot vero, installazione dei pacchetti restituiti; se Penpot non risponde, fermarsi e chiedere (Decisions)

**Acceptance Criteria:**
- Given il seme dello spike, when chiamo `tokens_from_css`, then ricevo i set `tailwind`, `semantic` e `brand/ocean`, i temi `brand/default` e `brand/ocean`, e un avviso per ogni spread negativo, colore clampato o variabile saltata.
- Given l'uscita di `tokens_from_css` servita dall'adattatore finto, when chiamo `extract_theme`, then ogni variabile del seme rappresentabile torna in `theme.css` con lo stesso valore (gli oklch come hex) e `themes/brand-ocean.css` contiene solo le tre variabili di `[data-brand="ocean"]` (livello 4, in CI).
- Given un tema con famiglie non di sistema, when chiamo `extract_theme`, then `fonts.css` `@generated` le importa da `@fontsource/*`; Next e Storybook lo caricano entrambi, e nel repo non restano `next/font` né Geist.
- Given il repo dopo la story, when cerco il comando `theme`, then non esistono né `src/theme/` né lo script `theme`, e nessun modulo di `scripts` chiama `process.exit`.
- Given un file CSS `@generated` modificato a mano, when gira il livello 3, then il controllo lo blocca e nomina il file.

## Implementation Notes

- **Rigenerazione dal vivo (2026-10-31).** `extract_theme` è stato eseguito sul Penpot locale (lettore vero → `extractTheme` → `writeThemeFiles`). Il Penpot vero non ha la library "mis" ma il seme Tailwind: set `tailwind` (361), `semantic`, `brand/ocean`; temi `mode/light` (un solo tema, quindi non un asse), `brand/default`, `brand/ocean`. Il tema committato quindi cambia (palette Tailwind, Inter), con `themes/brand-ocean.css`, e `@fontsource/inter` sostituisce Manrope/Noto Serif.
- **Token aggiunti in Penpot (scelta dell'utente).** La UI usava `color.popover`, `color.popover-foreground` (`dropdown-menu.tsx`, `sonner.tsx`) e `opacity.disabled` (`globals.css`), assenti dal seme: aggiunti al set `semantic` (`{white}`, `{neutral.950}`, `0.5`) prima della rigenerazione.
- **Fixture "mis".** `data/penpot-catalog.json` è stato spostato in `tests/fixtures/penpot-catalog.json`, ora solo dati di test per `generateTheme`; il drift guard verso il tema committato è stato tolto (le modifiche a mano le blocca il livello 3).
- `packages/ui/src/lib/utils.test.ts` prende i nomi dalle scale generate invece che dai nomi "mis".

## Plan Change Log

## Review Triage Log

| # | Lens | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | quick | `themes/*.css` non importabili né caricati | low | patch (export) | `exports` senza `./themes/*`: aggiunto. Il caricamento a runtime non è nell'intento né negli AC: prima non esistevano varianti, nessuna regressione. |
| 2 | quick | `baseCatalog` toglie ogni set attivato da una variante | medium | patch | Le Design Notes dicono "usato solo" dalle varianti. Con un tema che attiva tutto lo stack, la base si svuotava. Corretto e coperto da un test. |
| 3 | quick | Variante con ruolo ignoto: `extract_theme` lancia un errore | low | rejected | Fallisce in modo esplicito e nomina i token. La riga della matrice riguarda `tokens_from_css`, che avvisa. Gestirlo richiederebbe nuovi rami. |
| 4 | quick | `tokens.generated.ts` → `generate_component` nel livello 3 | low | patch | `regenCommandOf` guardava solo l'estensione. Ora tutto `packages/tokens/src/` → `extract_theme`, con un test. |
| 5 | quick | Gruppo/nome del tema non validati (path e selettore) | medium | patch | Penpot ammette temi senza gruppo: due temi senza gruppo producevano `[data-="x"]`. Ora c'è un errore chiaro, con un test. |
| 6 | quick | Doppi `@import` in `fonts.css` | low | patch | `imports` non era deduplicato. Correzione diretta, con un test. |
| 7 | quick | I file di variante rimossi da Penpot restano sul disco | low | rejected | Caso raro. Servirebbe una logica di cancellazione nuova. |
| 8 | quick | `tailwindcss` letto a runtime ma in devDependencies | false | rejected | `@penpot-ds/scripts` è privato e il server gira solo dal workspace (`.mcp.json`, `pnpm --filter`), dove le devDependencies ci sono. |
| 9 | quick | `process.exit` in `scripts/check-boundaries.mjs` | low | rejected | È lo script di lint, preesistente. AC 4 e il test di confine riguardano i moduli di `src/`. |
| 10 | quick | Testi rimasti indietro (`package.json`, `mcp-client.ts`, `paths.ts`) | low | patch | Correzioni dirette dei commenti. |
| 11 | quick | `theme-in-css.test.ts`: tolto il controllo `/geist/i` | low | patch | `/next\/font/i` non può comparire nel CSS compilato. Ripristinato `/geist/i`. |

## Design Notes

- **Default di Tailwind:** `tokens_from_css` accetta solo il seme. Il server ci antepone `tailwindcss/theme.css` letto dal pacchetto installato, come faceva lo spike (`node css-to-tokens.mjs <default> <seme>`). Senza, i ruoli `var(--color-neutral-950)` non avrebbero una primitiva. Il nucleo riceve entrambe le stringhe.
- **Base e varianti** (dallo spike): un gruppo con più di un tema è un asse; il tema `default` non aggiunge set; un set usato solo dai temi non-default di un asse è un set di variante, tutti gli altri formano la base. La variante è la base con i token sovrascritti per nome, ridotta alle sole variabili che cambiano.
- **Collisioni:** dentro la base valgono ancora le regole di `buildIndex`. Il bug 6 si chiude perché le varianti non entrano mai nell'indice della base.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test`: verde, compresi il livello 2 (server), il livello 3 (`.css`) e il livello 4 (giro sul seme).
- `pnpm check-types && pnpm lint`: verdi, compreso `check-boundaries.mjs`.
- `pnpm --filter web build && pnpm --filter storybook build`: verdi, con `fonts.css` importato.
- `grep -rn "next/font\|Geist" apps packages --include=*.ts* --include=*.css | grep -v node_modules`: nessun risultato.
