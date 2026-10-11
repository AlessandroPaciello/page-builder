# Test v3 — ShopCard (spike 2026-10-10)

Tutto il codice dello spike, in un'unica copia aggiornata. Il worktree in cui è nato è stato perso con il riavvio del 2026-10-11 e non si usa più: dal 2026-10-11 le prove girano sul branch `spike/penpot-ai-kit` (codice applicato nel working tree, non committato) e questa cartella ne è la copia.

| Cartella | Contenuto |
|---|---|
| `codice/` | **file nuovi**, negli stessi percorsi del repository (vedi sotto) |
| `patch/1-codice-e-contratti.patch` | modifiche ai file esistenti: pipeline, contratti, CSS |
| `patch/2-file-generati.patch` | artefatti rigenerati durante le prove (catalogo token, tema CSS/TS, Badge) |
| `lettura-penpot-shop-card.json` | lettura di Penpot usata per T2–T4 (solo per la demo; vedi punto aperto 5 del README) |
| `lettura-penpot-shop-card-t6.json` | lettura dopo T5 (raggio `2xl`) e T6 (categoria) |
| `storybook/` | foto delle 4 story dopo le correzioni (`sc3-*`, T4) e dopo la categoria (`t6-*`, T6) |

La variante di brand (`packages/tokens/src/themes/brand-ocean.css`) è identica a [`../tailwind-to-penpot/out/themes/brand-ocean.css`](../tailwind-to-penpot/out/themes/brand-ocean.css) e non è ripetuta qui.

## Riportare il codice nel repository

Dalla root, sul branch dello spike:

```sh
D=_bmad-output/spikes/penpot-ai-kit-2026-10-10/test-v3
git apply $D/patch/1-codice-e-contratti.patch $D/patch/2-file-generati.patch
cp -r $D/codice/packages .
cp _bmad-output/spikes/penpot-ai-kit-2026-10-10/tailwind-to-penpot/out/themes/brand-ocean.css packages/tokens/src/themes/
```

## File nuovi — `codice/`

| File | Cosa |
|---|---|
| `packages/contracts/src/components/shop-card.ts` | contratto dell'editor |
| `packages/scripts/src/contracts/shop-card.binding.ts` | collegamento (modello v3) |
| `packages/scripts/src/v3/binding.ts` | `defineBinding` e controlli locali |
| `packages/scripts/src/v3/generate.ts` | verifica (VC) e generazione (GC) generiche |
| `packages/scripts/src/v3/styles.ts` | modello "stili generati, componente tuo": `generateStyles` (una `cva` per parte), `scaffold` (prima versione del componente), `checkSlots` (parti Penpot ↔ `data-slot`) |
| `packages/scripts/src/v3/cli.ts` | `verify\|generate\|styles <Comp> [--snapshot f] [--save-snapshot f]` |
| `packages/ui/src/domains/commerce/ShopCard.styles.ts` | `@generated`: aspetto letto da Penpot |
| `packages/ui/src/domains/commerce/ShopCard.tsx` | **dello sviluppatore**: scaffold di GC poi modificato a mano (immagine lazy con segnaposto, `aria-hidden` sulla CTA) |
| `packages/ui/src/domains/commerce/ShopCard.stories.tsx` | `@generated` |
| `packages/scripts/src/contracts/shop-card.extract.ts` | contratto di estrazione v2 (prova D; superato dal collegamento, tolto dal registro) |
| `packages/scripts/data/components/shop-card.json` | istantanea della prova D (`extract` v2 con composizione) |

## Modifiche ai file esistenti — `patch/1-codice-e-contratti.patch`

| File | Modifica | Perché |
|---|---|---|
| `packages/scripts/src/library/library-reader.ts` | lettura del layout flex, del dimensionamento nel layout (`sizingH/V`) e delle istanze (contratto d'origine, variante, override) | A-13; composizione; "fill" |
| `packages/scripts/src/library/library-snapshot.ts` | campo `instance` sul layer | composizione |
| `packages/scripts/src/extraction.ts`, `commands/extract.ts` | parte `component`/`fields`; controlli istanza (D1–D2); istantanea con `$component` | composizione (prototipo su `extract`) |
| `packages/scripts/src/library-plan.ts` | la struttura non dipende più da `COMPONENT_TOKENS` | D-4 |
| `packages/scripts/src/shared/style-properties.ts` | riga `fontFamily` | V-2 |
| `packages/contracts/src/{index,registry,schema-version}.ts`, `tests/contracts.fingerprint.json` | registrazione `shop-card`, `SCHEMA_VERSION` 5 | componente nuovo |
| `packages/tokens/package.json` | export `./themes/brand-ocean.css` | prova C |
| `packages/ui/src/styles/globals.css` | import del tema in cima; via le mappature `--color-*`, `--radius-*`, `--font-*` dal `@theme inline` shadcn | C-6 |
