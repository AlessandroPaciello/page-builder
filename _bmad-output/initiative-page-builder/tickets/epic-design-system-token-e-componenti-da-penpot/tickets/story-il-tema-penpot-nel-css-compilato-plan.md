---
ticket: 17
title: 'Story 2.17 — Il tema Penpot nel CSS compilato'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'dispatch'
baseline_revision: '40fbb40cf2f3044e3944fd42ff8ed878b9b2dc05'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nel CSS che il browser riceve da Storybook (Vite) il tema Penpot non c'è: l'`@import` di `tailwind-theme.css` sta a metà di `globals.css` e la pipeline CSS di Vite lo scarta, così `bg-primary` usa `var(--primary)` shadcn, `rounded-lg` `var(--radius)` e `font-sans` lo stack Geist (verificato in `storybook-static` del 2026-10-03 e con `preprocessCSS` di Vite). I test di oggi non se ne accorgono perché compilano con `@tailwindcss/node`, che accetta l'import ovunque.

**Approach:** Riordinare `globals.css` (import del tema in testa, via `@theme inline` e le variabili shadcn in `:root`/`.dark`), riallineare i pochi consumatori delle variabili shadcn grezze, e aggiungere un test che compila con la stessa pipeline di Vite: rosso sul CSS di oggi, verde dopo.

## Boundaries & Constraints

**Always:** il tema Penpot (`@penpot-ds/tokens/tailwind-theme.css`, `@generated`) è l'unico proprietario di colori, raggi e font che definisce; i valori attesi dal test si leggono da quel file, non si scrivono nel test; il default di focus (anello `ring`) e di disabled (opacità del token `--opacity-disabled`) vive in `@layer base`, così una cella disegnata (utility) vince; Storybook e `apps/web` importano lo stesso `@penpot-ds/ui/globals.css`.

**Never:** editare `tailwind-theme.css` o il generatore del tema (`extract_theme`, varianti di tema e font sono Story 2.26); toccare `src/domains` generati, i contratti o la pipeline v2 (Story 2.18); introdurre `next/font` o nuove dipendenze runtime oltre a quanto deciso sotto per i font.

**Decisioni:**
- Via **tutto** `:root`/`.dark` shadcn (anche `--chart-*`, `--sidebar-*`, `--radius`: nessuno li usa) e tutto il blocco `@theme inline`; `@custom-variant dark` resta (le classi `dark:` dell'editor). Il toggle dark di `apps/web` non cambia più i colori fino alle varianti di tema (2.26): il tema Penpot non ha una variante scura.
- `font-mono` torna al default Tailwind (il tema non ha `--font-mono`, deferred).
- Font: nessun caricamento in questa story (risposta A, 2026-10-17). `font-sans` vale `Manrope` come dice il tema; finché la 2.26 non genera `fonts.css` con fontsource, chi non ha Manrope installato vede il font di default del browser. Nessuna dipendenza nuova.
- Consumatori delle variabili grezze: `editor/sonner.tsx` → `--color-popover`, `--color-popover-foreground`, `--color-border`, `--radius-md`; `editor/button.tsx` → `var(--color-secondary)`, `var(--color-foreground)` nel `color-mix`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CSS corretto | `globals.css` riordinato, compilato con `preprocessCSS` di Vite | `.bg-primary`→`var(--color-primary)`, `.rounded-lg`→`var(--radius-lg)`, `.font-sans`→`var(--font-sans)`; le tre variabili hanno il valore di `tailwind-theme.css`; nessuna `--primary:`/`--radius:` | N/A |
| CSS di oggi | stesso test sul layout vecchio (import a metà, `@theme inline` shadcn) | rosso: `var(--primary)`, `var(--radius)`, stack Geist | il test di sensibilità ricostruisce il layout vecchio e si aspetta il fallimento |
| Focus/disabled | elemento `:focus-visible`, `:disabled`, `[data-disabled]`, `[aria-disabled="true"]` | regole in `@layer base` con `--color-ring` e `--opacity-disabled` | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/styles/globals.css` — righe 1–4 import/`@source`; 8–75 `:root`/`.dark` shadcn; 77–118 `@theme inline` (ridefinisce `--color-*`, `--radius-*`, `--font-sans/mono`); 120–127 commento + `@import` del tema a metà; 129–139 `@layer base` (oggi solo `outline-ring/50`, nessun default disabled).
- `packages/tokens/src/tailwind-theme.css` — `@generated`, `@theme static`, importa `tailwind-extras.css`; fonte dei valori attesi. Non toccare.
- `packages/ui/src/styles/generated-classes.test.ts`, `tracer-tokens.test.ts` — harness `@tailwindcss/node`; il primo cerca la stringa esatta dell'`@import` del tema (resta valida) e cita l'ordine nel commento di `globals.css`.
- `packages/ui/postcss.config.mjs` — `@tailwindcss/postcss`; `vite` 8.2.2 è già devDependency di `@penpot-ds/ui`: `preprocessCSS(code, file, await resolveConfig({ root: packages/ui, configFile: false }, "build"))` riproduce il bug.
- `packages/ui/src/editor/sonner.tsx:29-32`, `packages/ui/src/editor/button.tsx:14` — unici usi di variabili shadcn grezze.
- `apps/storybook/.storybook/preview.ts` e `apps/web/src/index.css` — già importano `@penpot-ds/ui/globals.css`; `apps/web/src/app/layout.tsx` usa ancora `next/font` Geist (diventa inerte; si toglie nella 2.26).

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/src/styles/theme-in-css.test.ts` — nuovo test (ambiente node) con `preprocessCSS` di Vite + `@source inline("bg-primary rounded-lg font-sans")`; asserzioni della matrice, valori letti da `tailwind-theme.css`; caso di sensibilità sul layout vecchio. Scriverlo prima e vederlo rosso.
- [x] `packages/ui/src/styles/globals.css` — import del tema dopo `tw-animate-css`; via `:root`, `.dark`, `@theme inline`; commento aggiornato; `@layer base` con focus-visible (`outline` 2px `--color-ring`, offset 2px) e disabled (`opacity: var(--opacity-disabled)`).
- [x] `packages/ui/src/editor/sonner.tsx`, `packages/ui/src/editor/button.tsx` — variabili Penpot al posto di quelle shadcn.

**Acceptance Criteria:**
- Given `globals.css` riordinato, when gira la suite `@penpot-ds/ui`, then il test nuovo è verde, il caso di sensibilità prova che il layout vecchio è rosso, e `generated-classes`/`tracer-tokens` restano verdi.
- Given il build statico di Storybook, when cerco nel CSS emesso, then `.bg-primary` usa `--color-primary` con il valore Penpot e non esiste `--primary:`.
- Given `apps/web` e Storybook, when ispeziono gli import, then entrambi caricano `@penpot-ds/ui/globals.css` e nient'altro ridefinisce il tema.

## Implementation Notes

- `@layer base` usa CSS con le variabili del tema (`var(--color-border)`, `var(--font-sans)`, …) invece di `@apply border-border font-sans …`: nei casi di sensibilità il tema non c'è (Vite lo scarta, o il test lo toglie) e `@apply` di un'utility sconosciuta rompeva la compilazione invece di dare un CSS sbagliato. Tolto anche `outline-ring/50` su `*`: il default di focus è la regola `:focus-visible`.
- Il caso di sensibilità ricostruisce il layout vecchio da `globals.css` (variabili shadcn minime, `@theme inline`, import del tema dopo `@custom-variant`) e verifica che con Vite i tre valori Penpot non arrivino.
- Il test nuovo era rosso prima del riordino (2 casi su 3; il caso di sensibilità verde).

## Spec Change Log

## Review Triage Log

| # | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|
| 1 | Opacità disabled moltiplicata su elementi annidati (Base UI: Item/Header/Trigger/Panel; fieldset) | high | `AccordionItem.tsx` usa Base UI 1.8, che mette `data-disabled` su tutte le parti: trigger a ~0.125 | patch: regola solo sull'elemento disabilitato più esterno |
| 2 | Default di `body`/`html` (font, sfondo, testo) non verificati | medium | nessuna asserzione nel test su `html`/`body` | patch: asserzioni nel caso focus/disabled |
| 3 | Variabili del tema citate nell'editor (`sonner.tsx`, `button.tsx`) non verificate | medium | i valori arbitrari compilano anche con variabile inesistente | patch: caso che controlla ogni `var(--color-*\|--radius-*\|--font-*)` di `src/editor` |
| 4 | Nessun test su tutte le classi di `src/editor` | low | sonda one-shot: nessuna classe di `src/editor` o `apps/web` perde CSS rispetto al baseline; un test permanente richiede allowlist (`group/button`, `toaster`) | scartato |
| 5 | `[data-disabled="false"]` colpito | low | nessun `data-disabled={bool}` nel repo; Base UI usa l'attributo vuoto | scartato |
| 6 | `group-data-[disabled=true]:opacity-50` di `label.tsx` si somma | low | nessun gruppo nel repo imposta `data-disabled=true` | scartato |
| 7 | Input con outline + `shadow-ring` | false | `focus-visible:outline-2` e `shadow-ring` erano già in `Input.tsx` prima della story | scartato |
| 8 | Colore dell'outline da ring/50 a ring pieno | low | cambio voluto: contrasto più alto, coerente con focus ≥3:1 | scartato |
| 9 | Raggio del toast `md` invece di `lg` | low | scelta registrata nelle Decisioni | scartato (modifica di spec) |
| 10 | Scala raggi senza `xl`–`4xl` Penpot | low | nessun uso nel repo; il tema possiede solo sm/md/lg/full | scartato |
| 11 | Dark mode a metà, `next/font` inerte | false | accettati nelle Decisioni fino alla 2.26 | scartato |
| 12 | Manrope senza fallback | false | decisione A del 2026-10-17 | scartato |
| 13 | AC Storybook/web non automatizzati | low | verificati a mano nel build (vedi Verification) | scartato |
| 14 | Il test verifica l'indirezione, non il valore primitivo | low | primitivo e semantico vivono nello stesso file `@generated` | scartato |
| 15 | `resolveConfig` a ogni test | low | tre chiamate, <1 s ciascuna | scartato |
| 16 | Stato spec `in-review` vs sprint `in-progress` | false | la sincronizzazione avviene a fine workflow | scartato |
| 17 | `type: bugfix` | low | cosmetico | scartato |
| 18 | `epic-2-context.md` ha perso la sezione UX (live region, tooltip, ARIA) | medium | confronto con `40fbb40` | patch: sezione ripristinata |
| 19 | Commento che cita `generate:theme` | false | il comando `theme` resta fino alla 2.26 | scartato |
| 20 | Caso di sensibilità soddisfatto dal blocco iniettato | false | `[false,false,false]` richiede che `--color-primary: var(--color-accent-9)` manchi, quindi che Vite scarti l'import | scartato |
| 21 | `replace` di `THEME_IMPORT` silenzioso | low | se manca, l'import in testa resta e il caso fallisce in modo rumoroso | scartato |
| 22 | Graffe in stringhe dentro `@layer base` | low | nessuna nel CSS di oggi | scartato |
| 23 | Tolto `outline-ring/50` su `*` per outline fuori da `:focus-visible` | low | nessun `focus:outline-*` senza colore nel repo | scartato |
| 24 | Il test usa il config di `packages/ui`, non di `apps/storybook` | medium | i due `postcss.config.mjs` oggi sono identici | defer |

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/ui test` — verde, test nuovo incluso (rosso prima della correzione).
- `pnpm turbo run check-types lint --force` — verde.
- `pnpm --filter storybook build` poi grep in `apps/storybook/storybook-static/assets/*.css` — `.bg-primary{background-color:var(--color-primary)}`, `--color-primary` Penpot, nessun `--primary:`.
- `pnpm --filter web build` — verde (se l'ambiente lo consente; altrimenti annotarlo).
