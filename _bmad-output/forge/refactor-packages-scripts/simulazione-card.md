# Simulazione v2: ProductCard da Penpot a `packages/ui`

Schizzo prodotto durante la forge del 2026-09-16. Non è codice: è il comportamento atteso, per giudicare se il modello regge.

## 1. Contratto del page builder — `packages/contracts/src/components/product-card.ts`

```ts
export const productCard = defineContract({
  name: "product-card",
  version: 1,
  axes: [{ name: "promo", type: "option", values: ["none", "offer", "discount"], default: "none" }],
  fields: {
    image:       { schema: z.string().url(),    kind: "content" },
    price:       { schema: z.string(),          kind: "content" },
    description: { schema: z.string(),          kind: "content" },
    tags:        { schema: z.array(z.string()), kind: "content" },
    href:        { schema: z.string().url(),    kind: "content" },
  },
});
```

Entra nel fingerprint. Puck mostra all'editor: un select `promo`, un campo immagine, tre testi, una lista.

## 2. Contratto di estrazione — `packages/scripts/src/contracts/product-card.extract.ts`

```ts
export default defineExtraction(productCard, {
  penpot: { container: "ProductCard" },
  render: { domain: "commerce", headless: null },
  axes: { hover: { type: "state", values: ["off", "on"], default: "off" } },
  parts: {
    root:        { role: "surface", element: "a",    attribute: { href: "href" } },
    image:       { role: "image",   element: "img",  parent: "root", attribute: { src: "image" } },
    badge:       { role: "surface", element: "span", parent: "image", when: { promo: ["offer", "discount"] } },
    badgeLabel:  { role: "text",    element: "span", parent: "badge", layer: "Badge/Label",
                   content: { static: { offer: "Offerta", discount: "Sconto" } } },
    body:        { role: "surface", element: "div",  parent: "root" },
    price:       { role: "text",    element: "span", parent: "body", content: "price" },
    description: { role: "text",    element: "p",    parent: "body", content: "description" },
    tags:        { role: "surface", element: "ul",   parent: "body" },
    tag:         { role: "surface", element: "li",   parent: "tags", repeat: "tags", content: "$item" },
  },
  a11y: { role: { none: null, offer: null, discount: null }, focusVisible: true },
});
```

Controlli a module load (fallisce prima di qualsiasi comando):

- `attribute.href` → field `href` esiste ed è stringa. `attribute.src` → idem.
- `repeat: "tags"` → field array. `content: "$item"` ammesso solo dentro `repeat`.
- `when.promo` → asse `option` del page builder, valori esistenti. `when.hover` sarebbe rifiutato: asse di rendering.
- `parent` forma un albero con radice `root`; `badge` sotto `image` è legittimo (posizionamento assoluto letto da Penpot).
- Ruolo `image`: ammette solo `borderRadius*`, `opacity`, layout. Nessun `fill`: il contenuto arriva da `src`, la regola "token su ogni stile" non si applica al bitmap.
- Celle attese = `promo × hover` = 6. `badge` e `badgeLabel` obbligatorie in 4 celle, vietate in 2.

## 3. Penpot — cosa deve disegnare Dafne

`library add ProductCard` crea il VariantContainer con plugin data `product-card@1`, assi `promo` e `hover`, 6 board. Dentro ogni board i layer con il nome della parte: `Root`, `Image`, `Body`, `Price`, `Description`, `Tags`, `Tag`; nelle 4 board promo `Badge` e `Badge/Label`.

Vincoli che lo script verifica, non la skill:

- ogni stile ha un token (tranne `Image`);
- `Tag` compare 1..n volte dentro `Tags`: si legge il primo come modello, i successivi devono essere identici (stessi token), altrimenti errore "tag ripetuti con stili diversi";
- `Badge` assente in `promo=none`, presente altrove; il contrario è errore nominativo.

## 4. `pnpm scripts extract ProductCard` — stadi

```
[1/5] penpot      legge il container "ProductCard" (live, o --snapshot <file>)
[2/5] contract    6 celle attese, 6 trovate; assi nell'ordine [promo, hover]
[3/5] parts       per cella: layer ↔ parte (alias applicati), when rispettato, repeat collassato
[4/5] properties  ruolo → proprietà ammesse; token nel catalogo; layout letto (dir, align, gap)
[5/5] write       data/components/product-card.json (tmp + rename)
```

Esempio di fallimento, stadio 3, cella `promo=none|hover=off`:

```
✖ contract  ProductCard · cella promo=none|hover=off · parte "badge"
  presente in Penpot ma il contratto la ammette solo con promo ∈ {offer, discount}.
  Adattamenti, nell'ordine: (1) il designer toglie il layer "Badge" dalla board;
  (2) il contratto di estrazione cambia `when`.
exit 3   # categoria: contract
```

Categorie di uscita, una sola classe `ScriptError { kind, component, cell?, part?, detail }`:
`1 input`, `2 penpot`, `3 contract`, `4 gate`. Ogni comando le usa allo stesso modo.

## 5. `data/components/product-card.json` — l'istantanea (estratto)

```json
{
  "contract": "product-card@1",
  "provenance": { "penpotComponentId": "…", "readAt": "2026-09-16T…", "hash": "…" },
  "cells": {
    "promo=offer|hover=off": {
      "root":  { "layout": { "dir": "col", "gap": "spacing.3" },
                 "fill": "color.card", "strokeColor": "color.border",
                 "borderRadiusTopLeft": "radius.lg", "…": "…", "shadow": "shadow.sm" },
      "image": { "borderRadiusTopLeft": "radius.lg", "borderRadiusTopRight": "radius.lg" },
      "badge": { "fill": "color.primary", "paddingLeft": "spacing.2", "…": "…" },
      "badgeLabel": { "fill": "color.primary-foreground", "fontSize": "text.xs" },
      "tags":  { "layout": { "dir": "row", "gap": "spacing.1", "wrap": true } },
      "tag":   { "fill": "color.muted", "borderRadiusTopLeft": "radius.full", "…": "…" }
    },
    "promo=none|hover=off": { "root": "…", "image": "…", "body": "…" }
  }
}
```

Solo `extract` lo scrive. `extract --check` confronta Penpot live con questo file senza scrivere.

## 6. `pnpm scripts render ProductCard` — output (estratto di `ProductCard.tsx`)

```tsx
// @generated da product-card@1 · istantanea hash … · non modificare a mano
const rootVariants = cva("flex flex-col gap-3 rounded-lg border border-border bg-card shadow-sm", {
  variants: { promo: { none: "", offer: "", discount: "" } },
  defaultVariants: { promo: "none" },
});
const badgeVariants = cva("absolute top-2 left-2 rounded-full px-2 py-0.5", {
  variants: { promo: { offer: "bg-primary", discount: "bg-destructive" } },
});

export function ProductCard({ promo = "none", image, price, description, tags, href, className, ...props }: ProductCardProps) {
  return (
    <a href={href} className={cn(rootVariants({ promo }), "hover:shadow-md focus-visible:ring-[3px]", className)} {...props}>
      <div className="relative">
        <img src={image} alt="" className="rounded-t-lg" />
        {promo !== "none" && (
          <span className={badgeVariants({ promo })}>
            <span className="text-xs text-primary-foreground">{promo === "offer" ? "Offerta" : "Sconto"}</span>
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <span className="text-lg font-semibold">{price}</span>
        <p className="text-sm text-muted-foreground">{description}</p>
        <ul className="flex flex-row flex-wrap gap-1">
          {tags.map((tag) => <li key={tag} className="rounded-full bg-muted px-2 text-xs">{tag}</li>)}
        </ul>
      </div>
    </a>
  );
}
```

Da dove viene ogni riga: `flex flex-col gap-3` dal layout letto in Penpot (decisione: registro `layout/align/gap`); `bg-card`, `rounded-lg` dai token dell'istantanea; `absolute top-2` dalla posizione del layer `Badge` dentro `Image` (proprietà `position` da insegnare al registro per le parti con `parent` posizionato); `hover:` dall'asse `state` con le differenze tra celle `hover=off/on`; `{promo !== "none" && …}` da `when`; `tags.map` da `repeat`; `<a href>` da `attribute`.

Con il file vengono generati `ProductCard.test.tsx` (una cella per test: classi attese, `href` presente, badge assente con `promo=none`, axe verde) e `ProductCard.stories.tsx`.

## 7. Cosa la simulazione ha fatto emergere

- **Ruolo `image`** richiede un'eccezione esplicita alla regola "token su ogni stile". Decisione: il ruolo `image` non ha `fill`; tutto il resto resta obbligatorio.
- **Posizione assoluta** (badge sopra l'immagine) è una proprietà di layout che il registro oggi non ha. Va aggiunta insieme a `layout/align/gap`.
- **Testo statico per variante** (`Offerta` / `Sconto`) non è un field dell'editor. Serve `content.static` per asse, oppure diventa un field `badgeLabel` del page builder. Da decidere nella spec: la simulazione usa `static`.
- **`repeat`** legge il primo layer come modello e pretende che gli altri siano identici. Va detto al designer nella skill.
- **Diff zero** come criterio di regressione non regge per i 4 componenti esistenti: le classi strutturali cambiano origine. Criterio: suite ui + axe verdi e confronto visivo in Storybook (2.12 diventa utile prima, non dopo).
