# Design Token & Penpot Pipeline

Documento di approfondimento su due pacchetti collegati: **`packages/tokens`** (`@penpot-ds/tokens`, i design token generati da Penpot) e **`packages/scripts`** (`@penpot-ds/scripts`, la pipeline MCP che legge Penpot e genera token + codice componente).

> Aggiornato dopo una nuova ricognizione del codice sorgente (non solo dei nomi file). Rispetto alla versione precedente di questo documento la pipeline è cambiata in modo sostanziale: `token-extractor.ts`, `extract-tokens.ts`, `tailwind-preset.ts` e i moduli token scritti a mano (`colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`, `shadows.ts`) **non esistono più** nel codice attuale — sono stati sostituiti da una generazione data-driven dal catalogo token di Penpot.

---

## Tech stack (le due pacchetti)

| Categoria | Tecnologia | Versione | Motivazione |
|---|---|---|---|
| Runtime script | Node.js + `tsx` (`node --import tsx`) | tsx `^4` | esegue TypeScript diretto senza build step per gli script della pipeline |
| Linguaggio | TypeScript | `^5.7` | tipizzazione condivisa tra scripts e tokens |
| Client MCP | `@modelcontextprotocol/sdk` (`Client` + `StreamableHTTPClientTransport`) | `^1` | comunica con il server MCP di Penpot via HTTP streaming |
| Templating codice | Handlebars | `^4` | genera `.tsx`/test/story dei componenti primitive |
| Build librerie | `tsup` | `^8` | bundle di `packages/tokens` e `packages/scripts` |
| CSS target | Tailwind CSS v4 (`@theme`) | `^4` | i token generano custom properties nel layer `@theme` |
| Test | Vitest | `^3` | `token-resolver.test.ts`, `component-analyzer.test.ts` |
| Dipendenza interna | `@penpot-ds/tokens` (workspace:*) | — | `packages/scripts` dipende dai token generati (es. `spacing` in `css-to-tailwind.ts`) |

---

## A. `packages/tokens` — pacchetto token generato

```
packages/tokens/
├── package.json          # nome @penpot-ds/tokens, build "tsup", lint eslint
└── src/
    ├── index.ts           # barrel: ri-esporta da tokens.generated.ts (spacing/radii)
    ├── tokens.generated.ts   # @generated — spacing/radii + opzioni/mappe per Puck (NON editare a mano)
    ├── tailwind-theme.css    # @generated — CSS custom properties Tailwind v4 @theme (NON editare a mano)
    └── tailwind-extras.css   # scritto a mano — vars NON presenti in Penpot (font utility, line-height)
```

Export del `package.json`:
- `.` → `./dist/index.js` (build tsup di `index.ts`)
- `./tailwind-theme.css` → `./src/tailwind-theme.css` (importato direttamente come CSS, non passa da tsup)
- `./tailwind-extras.css` → `./src/tailwind-extras.css`

Nessun export `./css` o `./tailwind-preset` (non esistono più).

### File generati vs scritti a mano
- **`tokens.generated.ts`** (~1.5 KB) — header `// @generated from Penpot design tokens — DO NOT EDIT BY HAND.` Contiene solo `spacing` e `radii` (scale Radix-style, es. `spacing['1'] = '4'`), più `spacingOptions`/`spacingMap`/`radiiOptions`/`radiiMap` per i field select dell'editor Puck.
- **`tailwind-theme.css`** (~4.8 KB) — header identico `@generated ... DO NOT EDIT BY HAND`. Contiene tutte le custom properties Tailwind v4 (`@theme { ... }`), raggruppate per **SET Penpot** (in ordine di catalogo), con `@import "./tailwind-extras.css";` in testa.
- **`tailwind-extras.css`** (scritto a mano, ~635 B) — variabili che non hanno un token Penpot corrispondente: `--font-utility` (Source Sans Pro) e `--leading-1..5`. Il file generato lo importa così la rigenerazione non lo sovrascrive mai.
- **`index.ts`** (287 B) — non generato, ma è un semplice barrel che ri-esporta da `tokens.generated.ts`.

---

## B. `packages/scripts` — pipeline MCP → token + codice

```
packages/scripts/
├── package.json
└── src/
    ├── pipeline.ts            # entry point "pnpm generate" — genera CODICE componenti
    ├── generate-theme.ts      # entry point "pnpm generate:theme" — genera TOKEN css/ts
    ├── theme-generator.ts     # mapping puro (testabile): TokenCatalog → CSS/TS
    ├── penpot-reader.ts       # client MCP: legge componenti dalla pagina Penpot
    ├── component-analyzer.ts  # shape Penpot → ComponentAnalysis (+ modello cva)
    ├── radix-mapper.ts        # ComponentAnalysis → strategia (radix-primitive/alternative/custom)
    ├── code-generator.ts      # Handlebars → .tsx/.test.tsx/.stories.tsx/index.ts
    ├── css-to-tailwind.ts     # CSS raw Penpot → classi layout/spacing/sizing
    ├── token-resolver.ts      # token binding di uno shape → classi Tailwind (colore/radius/font)
    ├── check-artifacts.ts     # entry point "pnpm check:artifacts" — gate CI
    ├── discover-mcp.ts        # diagnostica: elenca i tool esposti dal server MCP
    ├── analyze-all.ts / analyze-badge.ts / explore-penpot*.ts  # script di ispezione manuale
    ├── component-analyzer.test.ts / token-resolver.test.ts     # test vitest
    └── __fixtures__/
        ├── penpot-catalog.json   # catalogo token cache (usato offline da generate-theme.ts)
        └── button-variants.ts
```

### npm/pnpm script disponibili (da `package.json`)

| Script | Comando | Cosa fa |
|---|---|---|
| `generate` | `node --import tsx src/pipeline.ts` | genera i componenti primitive (skip se già `@generated` esistenti, salvo hand-written) |
| `generate:force` | `... src/pipeline.ts --force` | rigenera sovrascrivendo anche i componenti già generati |
| `generate:theme` | `node --import tsx src/generate-theme.ts` | rigenera `tailwind-theme.css` + `tokens.generated.ts` **dalla fixture cache** |
| `generate:theme -- --live` | idem + `--live` | legge il catalogo **live** da Penpot via MCP e **aggiorna anche la fixture** |
| `check:artifacts` | `node --import tsx src/check-artifacts.ts` | gate: verifica che ogni componente in `primitives/src/domains/**` abbia `.tsx` + `.test.tsx` + `.stories.tsx` + `index.ts` |
| `test` | `vitest run` | test unitari (theme-generator, component-analyzer, token-resolver) |

Tutti questi comandi vanno lanciati con `pnpm --filter @penpot-ds/scripts <script>` dalla root del monorepo (o `pnpm <script>` dentro `packages/scripts`).

### Stadio 1 — Generazione TOKEN (`generate-theme.ts` + `theme-generator.ts`)

```
Penpot (penpot.library.local.tokens) ──MCP execute_code──► TokenCatalog (JSON)
                                                              │
                                             theme-generator.ts (mapping puro)
                                                              │
                          ┌───────────────────────────────────┴───────────────────────────────┐
                          ▼                                                                     ▼
        packages/tokens/src/tailwind-theme.css                          packages/tokens/src/tokens.generated.ts
        (@theme CSS vars, Tailwind v4, raggruppate per SET Penpot)       (spacing/radii + option/map per Puck)
```

- **Trigger manuale**: `pnpm --filter @penpot-ds/scripts generate:theme` (usa la fixture cache `__fixtures__/penpot-catalog.json`) oppure `-- --live` per leggere dal server MCP live (`http://127.0.0.1:4401/mcp`, tool `execute_code`) e aggiornare anche la fixture.
- **Sonda eseguita dentro Penpot**: `penpot.library.local.tokens` → serializzata come `{ sets: [{ name, tokens: [{ name, type, value }] }] }`.
- **Mapping data-driven** (`theme-generator.ts`): il nome della variabile CSS (`varName`) è derivato dal **tipo** del token (namespace Tailwind v4 stabile: `color`, `text`←fontSizes, `font-weight`, `tracking`←letterSpacing, `font`←fontFamilies, `space`←spacing, `radius`, `border-width`, `opacity`, `shadow`), MAI dal nome del set — quindi un nuovo set Penpot produce automaticamente una nuova sezione senza modifiche al codice. Riferimenti `{token.name}` sono risolti in `var(--...)`.
- Le classi generate dai componenti (`token-resolver.ts`) riusano la **stessa** funzione `varSuffix()` di `theme-generator.ts`, così `color.mis.primary` → sempre sia `--color-mis-primary` (CSS) sia `bg-mis-primary` (classe) — non possono divergere.
- Output: sovrascrive **sempre** `tailwind-theme.css` e `tokens.generated.ts` con header `@generated ... DO NOT EDIT BY HAND. Regenerate with pnpm --filter @penpot-ds/scripts generate:theme.`

### Stadio 2 — Generazione COMPONENTI (`pipeline.ts`)

```
Penpot pagina "Primitive" ──MCP execute_code──► PenpotComponent[] (penpot-reader.ts)
        │ (shape, variant matrix, token bindings shape.tokens)
        ▼
ComponentAnalyzer.analyze() ──► ComponentAnalysis (+ modello cva se il componente è una Penpot variant)
        ▼
RadixMapper.map() ──► strategia: 'radix-primitive' | 'alternative' | 'custom'
        ▼
CodeGenerator.generate() (Handlebars, skip se 'custom')
        ▼
packages/primitives/src/domains/<domain>/<kebab-name>/
   ├── <Name>.tsx          (@generated)
   ├── <Name>.test.tsx     (@generated)
   ├── <Name>.stories.tsx  (@generated)
   └── index.ts            (@generated)
```

Dettagli chiave per stadio:

1. **Lettura (`penpot-reader.ts`)** — `PenpotReader.readComponents(pageName)`, invocato con `'Primitive'` (**non** `'Radix Components'` come in versioni precedenti del progetto). Si connette via `StreamableHTTPClientTransport` a `http://127.0.0.1:4401/mcp` e usa il tool MCP `execute_code` per eseguire uno script JS dentro Penpot. Il filtro è esplicito: legge da `penpot.library.local.components`, **deduplica per `comp.path`**, e include solo i componenti la cui `mainInstance()` vive sulla pagina target (`pageShapeIds`) — quindi componenti composti definiti su altre pagine non vengono ingeriti. Cattura anche l'intera **matrice di varianti** Penpot (`comp.variants` → `axes` + `cells`), ciascuna con il proprio shape radice (bindings token inclusi) e il CSS via `penpot.generateStyle()`.
2. **Analisi (`component-analyzer.ts`)** — deriva `domain` da un prefisso esplicito nel nome (`"Inputs / Button"`) o da un fallback a keyword (`DOMAIN_MAPPING`); se il componente Penpot è una variant matrix, costruisce un **modello cva reale** (`CvaModel`: `base` + `axes` + `defaults`) fattorizzando le classi comuni a tutte le celle vs. quelle specifiche di un valore d'asse. Le classi vengono risolte da due fonti complementari: `token-resolver.ts` (colore/radius/font — dai `shape.tokens` bindings) e `css-to-tailwind.ts` (layout/spacing/sizing/border-width — dal CSS raw), che si dividono deliberatamente le responsabilità per non emettere classi in conflitto.
3. **Mapping (`radix-mapper.ts`)** — tabella statica `RADIX_PRIMITIVES` (~27 componenti Radix mappati con pacchetto npm + subComponents) e `ALTERNATIVE_MAPPINGS` (Button/Input/Textarea → `react-aria-components`); tutto il resto è `strategy: 'custom'` e **viene saltato** dalla pipeline (componenti di alto livello senza primitive 1:1).
4. **Generazione (`code-generator.ts`)** — due template Handlebars: `CVA_COMPONENT_TEMPLATE` (quando `analysis.cva` esiste, cioè il componente è una vera variant matrix Penpot — emette un `cva()` reale con assi/valori) e `COMPONENT_TEMPLATE` (scaffold minimo Root-only altrimenti). Header identico su tutti i file generati: `// @generated — do not edit manually, run \`pnpm generate:force\` to update`. Genera anche `.test.tsx` (render + className + ref + `vitest-axe`) e `.stories.tsx` (Storybook CSF, tag `autodocs`).
   - **Logica di skip**: se `index.ts` esiste già e inizia con `// @generated` → skip salvo `--force`; se esiste ma **non** ha quel marker (cioè è stato editato a mano) → skip salvo `--force` (protegge le modifiche manuali); se non esiste → genera.

### Verifica: `check-artifacts.ts` (gate)

`pnpm --filter @penpot-ds/scripts check:artifacts` scandisce `packages/primitives/src/domains/**`: ogni directory-componente (contiene un `*.tsx` non-test/non-story) deve avere `index.ts` + `*.test.tsx` + `*.stories.tsx`, altrimenti stampa le violazioni ed esce con codice non-zero (pensato per CI).

---

## Convenzione file `@generated`

Tutti i file generati automaticamente iniziano con un commento che contiene la stringa `@generated` e l'istruzione di rigenerazione. Non vanno mai editati a mano:

| File | Comando di rigenerazione |
|---|---|
| `packages/tokens/src/tailwind-theme.css` | `pnpm --filter @penpot-ds/scripts generate:theme` |
| `packages/tokens/src/tokens.generated.ts` | `pnpm --filter @penpot-ds/scripts generate:theme` |
| `packages/primitives/src/domains/**/*.tsx` (+ test/story/index) | `pnpm --filter @penpot-ds/scripts generate` (o `generate:force` per sovrascrivere) |

---

## Come rigenerare (procedura pratica)

1. Assicurarsi che Penpot esponga il server MCP su `http://127.0.0.1:4401/mcp` (config in `.mcp.json` alla root: `mcpServers.penpot.url = http://localhost:4401/mcp`).
2. Rigenerare i token: `pnpm --filter @penpot-ds/scripts generate:theme -- --live` (aggiorna sia i file in `packages/tokens/src` sia la fixture cache `__fixtures__/penpot-catalog.json`). Senza `--live`, gira offline sulla fixture cache.
3. Rigenerare i componenti: `pnpm --filter @penpot-ds/scripts generate` (nuovi componenti) o `generate:force` (rigenera tutto, sovrascrivendo anche i `@generated` esistenti — **non** tocca file editati a mano senza il marker).
4. Verificare: `pnpm --filter @penpot-ds/scripts check:artifacts` e `pnpm --filter @penpot-ds/scripts test`.

---

## Gotcha noti (dal codice)

- **Nome pagina Penpot**: la pipeline componenti legge dalla pagina `'Primitive'` (`pipeline.ts`), non da `'Radix Components'` — un refactor precedente ha rinominato/spostato la sorgente. Gli script diagnostici (`analyze-all.ts`, `analyze-badge.ts`) usano lo stesso nome pagina.
- **Divisione delle responsabilità colore/radius/font vs layout**: `token-resolver.ts` gestisce SOLO le proprietà con un binding token esplicito (`shape.tokens`); `css-to-tailwind.ts` gestisce SOLO layout/spacing/sizing/border-width dal CSS raw e ignora deliberatamente colore/radius per non generare classi in conflitto (es. `rounded-2` vs `rounded-mis-sm`).
- **Font-size senza token binding**: se un testo non ha un token Penpot per `font-size`, viene emesso un valore arbitrario fedele `text-[Npx]` — la pipeline non tenta di indovinare la scala più vicina ("never assume missing values").
- **Radius con angoli misti**: `token-resolver.ts` emette un solo `rounded-*` solo se tutti e 4 gli angoli (`r1..r4`) hanno lo **stesso** token bindato; angoli disomogenei ricadono nel fallback CSS.
- **`generate:theme` sovrascrive sempre**: a differenza della generazione componenti (che rispetta i file hand-written), `generate-theme.ts` riscrive incondizionatamente `tailwind-theme.css` e `tokens.generated.ts` ad ogni run.
- **Strategia `custom` = componente saltato**: componenti Penpot che non matchano né `RADIX_PRIMITIVES` né `ALTERNATIVE_MAPPINGS` (Button/Input/Textarea → `react-aria-components`) non vengono generati affatto dalla pipeline — vanno implementati a mano.
- **File rimossi rispetto a versioni precedenti della documentazione**: `token-extractor.ts`, `extract-tokens.ts`, `tailwind-preset.ts` e i moduli token scritti a mano (`colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`, `shadows.ts`) non esistono più nel codice attuale — l'intera generazione token è ora concentrata in `theme-generator.ts` + `generate-theme.ts`, data-driven dal catalogo Penpot.
- **`packages/tokens` non esporta più `./css` né `./tailwind-preset`** — solo `.` (JS/d.ts), `./tailwind-theme.css` e `./tailwind-extras.css`.
