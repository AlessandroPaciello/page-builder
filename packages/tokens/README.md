# @penpot-ds/tokens

Design token generati dal catalogo Penpot (colori, tipografia, spacing, radii, ombre, font). Fonte di verità stilistica del design system (AD-11): i valori vengono da Penpot, non scritti a mano.

## File

- `src/tokens.generated.ts` — **@generated**, non editare a mano. Scala TS (`spacing`, `radii`) + `spacingOptions`/`spacingMap`/`radiiOptions`/`radiiMap` per i field select dell'editor Puck.
- `src/theme.css` — **@generated**, non editare a mano. Custom properties Tailwind v4 dentro `@theme static { ... }`, raggruppate per set Penpot (la base, senza le varianti). Prima della Story 2.26 si chiamava `tailwind-theme.css`.
- `src/themes/<gruppo>-<nome>.css` — **@generated**, non editare a mano. Una per variante di tema, con le sole variabili che cambiano rispetto alla base, sotto `[data-<gruppo>="<nome>"]`.
- `src/fonts.css` — **@generated**, non editare a mano. Gli `@import` delle famiglie non di sistema del tema da `@fontsource/*`, uno per ogni peso dei `fontWeights`.
- `src/tailwind-extras.css` — scritto a mano. Variabili di norma senza corrispondenza nel catalogo Penpot (font utility, scala line-height); unica eccezione `--color-tracer-primary` (tracciante Story 1.4, live `tracer.primary`). La rigenerazione non lo tocca mai: `theme.css` lo importa in testa.
- `src/index.ts` — barrel non generato, ri-esporta da `tokens.generated.ts`.

## Rigenerare

Il tema non ha più un comando CLI: si rigenera con lo strumento `extract_theme` del server MCP `pds`, che legge Penpot (tutti i set e i temi, anche non attivi) e scrive i file `@generated` qui sopra. Il seme CSS (Tailwind v4 + ruoli shadcn) si importa in Penpot con `tokens_from_css`, che restituisce set e temi senza scrivere su Penpot.

Vedi [`packages/scripts/README.md`](../scripts/README.md) per i dettagli della pipeline.
