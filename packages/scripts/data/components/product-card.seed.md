# ProductCard — seed MCP rieseguibile (Story 2-15, CAP-10)

Container `ProductCard` creato dalla 2.13 (`library add ProductCard`):
plugin data `product-card@1`, assi `promo` (none, offer, discount) × `hover`
(off, on) = 6 board, layer delle 11 parti (`root` = board, alias `Badge/Label`
e `Tag/Label`). Solo `library` scrive su Penpot; solo `extract` scrive
l'istantanea; `render`/`gates` leggono gli artefatti committati.

## 1. Prerequisiti

- Library con il container 2.13 (`library add ProductCard --dry-run` verde,
  rilancio idempotente con zero scritture).
- Penpot locale con server MCP raggiungibile (`PENPOT_MCP_URL`,
  `PENPOT_MCP_TOKEN` come in `packages/scripts/README.md`).
- Nessun passo di questa guida gira in CI né in build.

## 2. Riempimento via `execute_code` (live)

I passi sotto sono gli stessi che `library add ProductCard` traduce in
`execute_code` (`src/v2/library-writer.ts`, una operazione per chiamata).
Rieseguirli in Penpot equivale a ricreare il disegno da zero; un errore live
nomina l'operazione fallita.

1. `library add ProductCard --dry-run` — stampa il piano (1 container,
   6 celle, layer attesi) senza scrivere.
2. `library add ProductCard` — crea le 6 board
   (`ProductCard promo=none|hover=off`, …, `promo=discount|hover=on`) con le
   parti e i token del registro (`PRODUCT_CARD_TOKENS` in
   `src/v2/library-plan.ts`): `surface` con fill/radius/padding/gap, `text`
   con fill/tipografia, `image` solo raggio (nessun `fill`: il contenuto
   arriva dal field `image`).
3. Verifica in Penpot, cella per cella:
   - `promo=none` (2 celle): nessun layer `Badge` né `Badge/Label`
     (`when: promo ∈ {offer, discount}`); `Tags` con un layer modello `Tag`
     + `Tag/Label` (il primo è il modello, gli altri devono avere gli stessi
     token); `Image` senza `fill`.
   - `promo=offer|discount` (4 celle): `Badge` + `Badge/Label` presenti con
     testo campione `Offerta`; `Price` = `19,99 €`, `Description` =
     `Descrizione prodotto`, `Tag/Label` = `Tag`.
   - Ogni proprietà di stile valorizzata ha un binding (`shape.tokens`):
     nessuno stile senza token (regola 7).
4. `propose -- ProductCard` — deve stampare nessun diff (Penpot allineato ai
   due contratti). Un valore d'asse, una parte o un ruolo in più stampa il
   diff sui due contratti con file e riga e non scrive nulla.

Passi `execute_code` singoli (uno per operazione, come li emette il writer):

- `createSet "palette"`, `createSet "semantic"`, `createToken …` dal seed
  (solo al bootstrap; `add` li presuppone esistenti).
- Per ogni cella: `createContainer "product-card", cella "<asse=valore>"`
  (board + parti figlie secondo `parent`, token legati con `applyToken`).
- `createVariantContainer "ProductCard" + plugin data product-card@1`
  (assi nell'ordine `promo`, `hover`; plugin data `pagebuilder/contract`).

## 3. Riesecuzione offline (senza Penpot live)

Il file `product-card.seed-library.json` in questa cartella è lo snapshot di
library corrispondente al disegno sopra (6 celle conformi, id seed
`seed-productcard-2-15`). È il seam di lettura/test, mai una scrittura live:

- `pnpm --filter @penpot-ds/scripts extract -- ProductCard --snapshot data/components/product-card.seed-library.json`
  scrive (tmp + rename) `data/components/product-card.json` con `contract`,
  `provenance` e `cells` per 6 celle (`when` badge 4/6, `repeat` tags).
- `pnpm --filter @penpot-ds/scripts extract -- ProductCard --check --snapshot data/components/product-card.seed-library.json`
  confronta senza scrivere (exit 0 se identica, exit 4 `gate` se diff).
- Il diff dell'istantanea in PR è la review del design (qui: sola
  provenienza, celle identiche, hash `c5ce5b3bb421` invariato).

Senza MCP raggiungibile (come in CI e in questo ambiente) il passo live non
è eseguibile: la via `--snapshot` è quella riproducibile e committata.

## 4. Render, gate e Storybook

- `pnpm --filter @penpot-ds/scripts render -- ProductCard` rigenera i 4 file
  `@generated` in `packages/ui/src/domains/commerce/` (`when`→condizionale,
  `repeat`→`map`, `attribute`→attributo, `state`→prefissi `hover:`,
  `focusVisible`→`focus-visible:`, `alt=""` decorativo per `img`
  — decisione ALT-IMMAGINE, nessun cambio al contratto).
- `pnpm --filter @penpot-ds/scripts render -- --check --all` deve essere a
  diff zero; `pnpm --filter @penpot-ds/scripts gates` aggiunge suite `ui` +
  axe con report per componente (exit 0 verde, exit 4 `gate` nominativo).
- Storybook: `Commerce/ProductCard` (None, Offer, Discount, EmptyTags) con
  addon a11y; la nota `Giudizio visivo — Alessandro` è emessa dal render
  nella `.stories.tsx` (decisione GIUDIZIO-VISIVO) ed è parte del diff.
