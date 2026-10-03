# Badge — seed MCP rieseguibile (Story 2-16, CAP-11, primo dei quattro)

Container `Badge` creato dalla v2 (`library add Badge`): plugin data
`badge@1`, assi `variant` (default, secondary, destructive) × `size` (sm, md)
= 6 board, layer delle 2 parti (`root` = board, `Label`). Solo `library`
scrive su Penpot; solo `extract` scrive l'istantanea; `render`/`gates`
leggono gli artefatti committati. Dai file v1 cancellati (judgment +
binding letti dalla storia git: dominio `data-display`, headless null).

## 1. Prerequisiti

- Library con i token Stadio 1 (`theme` verde).
- Penpot locale con server MCP raggiungibile (`PENPOT_MCP_URL`,
  `PENPOT_MCP_TOKEN` come in `packages/scripts/README.md`).
- Nessun passo di questa guida gira in CI né in build.

## 2. Riempimento via `execute_code` (live)

I passi sono gli stessi che `library add Badge` traduce in `execute_code`
(`src/library-writer.ts`, una operazione per chiamata). Rieseguirli in Penpot
equivale a ricreare il disegno da zero; un errore live nomina l'operazione
fallita.

1. `library add Badge --dry-run` — stampa il piano (1 container, 6 celle,
   layer attesi) senza scrivere.
2. `library add Badge` — crea le 6 board
   (`Badge variant=default|size=sm`, …, `variant=destructive|size=md`) con le
   parti e i token del registro (`COMPONENT_TOKENS["badge"]` in
   `src/library-plan.ts`): `root` (`surface`) con fill/radius/padding,
   `Label` (`text`) con fill/tipografia.
3. Verifica in Penpot, cella per cella (designer, dai design v1):
   - `variant=default` (2 celle): `root` fill `color.primary`, radius `full`,
     padding `spacing.1` + `spacing.2` (sm) / `spacing.3` (md);
     `Label` fill `color.primary-foreground`, `fontSize` `text.xs` (sm) /
     `text.sm` (md).
   - `variant=secondary` (2 celle): come sopra con `color.secondary` e
     `color.secondary-foreground`.
   - `variant=destructive` (2 celle): come sopra con `color.destructive` e
     `color.destructive-foreground`.
   - Layout dal layer (decisione BADGE-LAYOUT): `root` flex `row`, align
     `center` (`layoutDir: row`, `layoutAlign: center` nello snapshot) —
     mai classi scritte a mano, mai campo `structural`.
   - Ogni proprietà di stile valorizzata ha un binding (`shape.tokens`):
     nessuno stile senza token.
4. `propose -- Badge` — deve stampare nessun diff (Penpot allineato ai due
   contratti).

Passi `execute_code` singoli (uno per operazione, come li emette il writer):

- Per ogni cella: `createContainer "badge", cella "<asse=valore>"`
  (board + parti figlie secondo `parent`, token legati con `applyToken`).
- `createVariantContainer "Badge" + plugin data badge@1`
  (assi nell'ordine `variant`, `size`; plugin data `pagebuilder/contract`).

## 3. Riesecuzione offline (senza Penpot live)

Il file `badge.seed-library.json` in questa cartella è lo snapshot di library
corrispondente al disegno sopra (6 celle conformi, id seed `seed-badge-2-16`).
È il seam di lettura/test, mai una scrittura live:

- `pnpm --filter @penpot-ds/scripts extract -- Badge --snapshot data/components/badge.seed-library.json`
  scrive (tmp + rename) `data/components/badge.json` con `contract`,
  `provenance` e `cells` per 6 celle.
- `pnpm --filter @penpot-ds/scripts extract -- Badge --check --snapshot data/components/badge.seed-library.json`
  confronta senza scrivere (exit 0 se identica, exit 4 `gate` se diff).

Senza MCP raggiungibile (come in CI e in questo ambiente) il passo live non è
eseguibile: la via `--snapshot` è quella riproducibile e committata.

## 4. Render, gate e Storybook

- `pnpm --filter @penpot-ds/scripts render -- Badge` rigenera i 4 file
  `@generated` in `packages/ui/src/domains/data-display/` (lookup per
  `variant|size` senza cva, layout `flex flex-row items-center` dal layer).
- `pnpm --filter @penpot-ds/scripts render -- --check --all` deve essere a
  diff zero; `pnpm --filter @penpot-ds/scripts gates` aggiunge suite `ui` +
  axe con report per componente (exit 0 verde, exit 4 `gate` nominativo).
- Storybook: `DataDisplay/Badge` (VariantDefault/Secondary/Destructive,
  SizeSm/Md) con addon a11y; la nota `Giudizio visivo — Alessandro` è emessa
  dal render nella `.stories.tsx` ed è parte del diff.
