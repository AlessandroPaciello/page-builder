# @penpot-ds/tokens

Design token generati dal catalogo Penpot (colori, tipografia, spacing, radii, ombre). Fonte di verità stilistica del design system (AD-11): i valori vengono da Penpot, non scritti a mano.

## File

- `src/tokens.generated.ts` — **@generated**, non editare a mano. Scala TS (`spacing`, `radii`) + `spacingOptions`/`spacingMap`/`radiiOptions`/`radiiMap` per i field select dell'editor Puck.
- `src/tailwind-theme.css` — **@generated**, non editare a mano. Custom properties Tailwind v4 dentro `@theme { ... }`, raggruppate per set Penpot.
- `src/tailwind-extras.css` — scritto a mano. Variabili senza corrispondenza nel catalogo Penpot (font utility, scala line-height). La rigenerazione non lo tocca mai: `tailwind-theme.css` lo importa in testa.
- `src/index.ts` — barrel non generato, ri-esporta da `tokens.generated.ts`.

## Rigenerare

Dalla root del monorepo:

```sh
pnpm --filter @penpot-ds/scripts generate:theme          # offline, dalla fixture committata
pnpm --filter @penpot-ds/scripts generate:theme -- --live # legge Penpot via MCP e aggiorna anche la fixture
```

Vedi [`packages/scripts/README.md`](../scripts/README.md) per i dettagli della pipeline.
