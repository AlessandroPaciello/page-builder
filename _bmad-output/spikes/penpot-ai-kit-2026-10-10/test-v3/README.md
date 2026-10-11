# Test v3 — il modello nuovo, provato su due casi d'uso

Prove del modello v3 (contratto dell'editor, verifica e generazione generiche, **stili generati e componente dello sviluppatore**) e tutto il codice dello spike, in un'unica copia. Il codice **non è sul branch**: `packages/` di `spike/penpot-ai-kit` è pulito; per rieseguire le prove va riapplicato (sotto).

## Casi d'uso

| Caso | Cosa mostra | |
|---|---|---|
| **[Carousel](carousel/README.md)** | **simulazione completa delle skill** su un componente nuovo: prompt → ricetta → contratti → disegno in Penpot → codice; sezione con slot, comportamento dello sviluppatore | da presentare |
| [ShopCard](shop-card/README.md) | il modello su un componente esistente: generatore generico, decisione 11, cambio di aspetto (T5) e di struttura (T6) | |

## Cartelle

| Cartella | Contenuto |
|---|---|
| [`carousel/`](carousel/README.md) | caso d'uso, lettura di Penpot, immagini di Penpot e di Storybook |
| [`shop-card/`](shop-card/README.md) | caso d'uso, letture di Penpot, immagini di Storybook |
| `codice/` | **file nuovi** di entrambi i casi, negli stessi percorsi del repository |
| `patch/1-codice-e-contratti.patch` | modifiche ai file esistenti: pipeline, contratti, CSS |
| `patch/2-file-generati.patch` | artefatti rigenerati durante le prove (catalogo token, tema CSS/TS, Badge) |

La variante di brand (`packages/tokens/src/themes/brand-ocean.css`) è identica a [`../tailwind-to-penpot/out/themes/brand-ocean.css`](../tailwind-to-penpot/out/themes/brand-ocean.css) e non è ripetuta qui.

## Riportare il codice nel repository

Dalla root, sul branch dello spike (le patch si applicano al branch pulito):

```sh
D=_bmad-output/spikes/penpot-ai-kit-2026-10-10/test-v3
git apply $D/patch/1-codice-e-contratti.patch $D/patch/2-file-generati.patch
cp -r $D/codice/packages .
cp _bmad-output/spikes/penpot-ai-kit-2026-10-10/tailwind-to-penpot/out/themes/brand-ocean.css packages/tokens/src/themes/
```

Poi, da `packages/scripts`: `node --import tsx src/v3/cli.ts styles <ShopCard|Carousel> --snapshot <lettura>`. Attenzione: 45 test di `scripts` sono rossi per effetto dello spike (catalogo Tailwind al posto delle fixture, `v3/` fuori dai confini): punto aperto 13 del README.

## File nuovi — `codice/`

| File | Cosa | Caso |
|---|---|---|
| `packages/scripts/src/v3/binding.ts` | veicolo del prototipo per le informazioni non lette da Penpot (elementi, field, slot, icone); `sectionContract` legge gli `enum` di una sezione come assi. **Superato** dalla decisione 8 rivista (AD-1): nel modello queste informazioni vengono da Penpot o dal codice dello sviluppatore | prototipo |
| `packages/scripts/src/v3/generate.ts` | verifica (VC), classi da token e geometria (`classesOf`), generatore "tutto generato" della prima versione (T3) | entrambi |
| `packages/scripts/src/v3/styles.ts` | modello "stili generati, componente tuo": `generateStyles` (una `cva` per parte), `scaffold`, `checkSlots` (parti Penpot ↔ `data-slot`), story delle sezioni | entrambi |
| `packages/scripts/src/v3/cli.ts` | `verify\|generate\|styles <Comp> [--snapshot f] [--save-snapshot f]` | entrambi |
| `packages/contracts/src/components/shop-card.ts` | contratto dell'editor | ShopCard |
| `packages/scripts/src/contracts/shop-card.binding.ts` | file per componente del prototipo, **superato** (AD-1) | prototipo |
| `packages/ui/src/domains/commerce/ShopCard.styles.ts`, `.stories.tsx` | `@generated` | ShopCard |
| `packages/ui/src/domains/commerce/ShopCard.tsx` | **dello sviluppatore** | ShopCard |
| `packages/contracts/src/sections/carousel.ts` | sezione (contratto dell'editor) | Carousel |
| `packages/scripts/src/contracts/carousel.binding.ts` | file per componente del prototipo, **superato** (AD-1) | prototipo |
| `packages/ui/src/domains/layout/Carousel.styles.ts`, `.stories.tsx` | `@generated` | Carousel |
| `packages/ui/src/domains/layout/Carousel.tsx` | **dello sviluppatore**: scaffold + comportamento approvato | Carousel |
| `packages/scripts/src/contracts/shop-card.extract.ts` | contratto di estrazione v2 (prova D; superato dal collegamento, tolto dal registro) | storico |
| `packages/scripts/data/components/shop-card.json` | istantanea della prova D (`extract` v2 con composizione) | storico |

## Modifiche ai file esistenti — `patch/1-codice-e-contratti.patch`

| File | Modifica | Prova |
|---|---|---|
| `packages/scripts/src/library/library-reader.ts` | layout flex, dimensionamento nel layout (`sizingH/V`), istanze (contratto d'origine, variante, override); ritaglio, dimensioni, posizione e vincoli degli assoluti; D2 senza dimensionamento e geometria | A-13, D, F-8 |
| `packages/scripts/src/library/library-snapshot.ts` | campo `instance` sul layer | D |
| `packages/scripts/src/extraction.ts`, `commands/extract.ts` | parte `component`/`fields`; controlli istanza (D1–D2); istantanea con `$component` | D (prototipo su `extract` v2) |
| `packages/scripts/src/library-plan.ts` | la struttura non dipende più da `COMPONENT_TOKENS` | D-4 |
| `packages/scripts/src/shared/style-properties.ts` | riga `fontFamily` | V-2 |
| `packages/contracts/src/{index,registry,schema-version}.ts`, `tests/contracts.fingerprint.json`, `tests/section.test.ts` | registrazione di `shop-card` e della sezione `carousel`; `SCHEMA_VERSION` 5 → 6 (`category`, T6) → 7 (`carousel`, F) | D, T6, F |
| `packages/tokens/package.json` | export `./themes/brand-ocean.css` | C |
| `packages/ui/src/styles/globals.css` | import del tema in cima; via le mappature `--color-*`, `--radius-*`, `--font-*` dal `@theme inline` shadcn | C-6 |
