---
title: 'Badge e ShopCard con le due strade'
type: 'feature'
ticket: '40'
created: '2026-11-03'
status: 'built'
baseline_revision: '7cd7aa6503ea5196e250095cf36430a14d2d5b57'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - skills/pds/pds-code/SKILL.md
  - skills/pds/pds-design/references/contract-from-design.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Badge e la ShopCard disegnata in Penpot non hanno codice, e il registro porta ancora `product-card@1`: il Carousel punta a un componente che non esiste in nessuna delle due strade.

**Approach:** scrivere `shop-card@1` dalla forma disegnata (CD), con le tre istanze Badge annidate (`Price`, `Tag`, `Stock`); togliere `product-card@1`; `SCHEMA_VERSION` a 7 con la voce nuova nel fingerprint; riportare lo slot `slides` sui field di `shop-card`; generare Badge → ShopCard con `build_order` e `generate_component`; chiudere con TSX e test dello sviluppatore, axe verde e giudizio in Storybook.

## Boundaries & Constraints

**Always:** `*.styles.ts` e `*.stories.tsx` li scrive `generate_component`, mai a mano; ogni scrittura su Penpot mostra layer, chiave e valore e passa da un sì; `product-card` sparisce ovunque; il fingerprint aggiunge `"7"` e lascia intatte `"1"`–`"6"`.

**Never:** non toccare `packages/ui/src/domains/index.ts` né riorganizzare `domains/` (è la 2.32); non cambiare il disegno Penpot (è `pds-design`); nessun `version` bump su altri contratti; niente editor o pagine (è l'epica 4).

**Decision (2026-11-03):** `imageAlt` è un field `content` obbligatorio scritto dall'editor; `href` è `z.url()`, link assoluti come in `product-card`. Il piano resta intero: contratto, Carousel, generazione e giudizio in una story sola.

**Decision (2026-11-03, seconda rinegoziazione):** la ShopCard è stata **ridisegnata** e la story tiene la forma nuova. Un asse solo, `size`; field `href`, `image` (con `sample`), `imageAlt`, `heading`, `description`, `price`, `tags` (lista, parte ripetuta), `ctaLabel`; `Price` e `Tag`/`Stock` sono istanze Badge sempre visibili. Cadono `promo`, `category` e `badgeLabel` e le decisioni che li riguardano. Il generatore e il contratto imparano un `sample` per field, così la story mostra un'immagine vera; da qui nascono il bug 2.42 (il server `pds` non ricarica i contratti cambiati) e lo spike 2.43 (raggruppare celle che non sono componenti).

**Decision (2026-11-03):** il disegno Penpot **è** cambiato dentro la 2.40, su richiesta dell'utente dopo il giudizio negativo in Storybook: i 6 `Label` del Badge passano a sizing auto e legano il token `font.sans`, altrimenti la pillola taglia il testo. Il blocco «non cambiare il disegno» del piano parlava di correzioni silenziose per far sparire i finding; un cambio di aspetto chiesto e giudicato dall'utente resta dentro la story, con `pds-design` come procedura.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `tags` con più voci | `tags: ["Novità", "Ultimi pezzi"]` | una Badge per voce dentro `Tags`, stessa `cva` | nessuno |
| `tags` vuoto | `tags: []` | `Tags` senza Badge, la card resta valida | nessuno |
| Pagina salvata con `product-card@1` | contratto rimosso | la sezione non si valida | nessun dato lo usa: zero riferimenti in `packages/db`, `apps/` |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/registry.ts`, `src/index.ts` — `COMPONENT_CONTRACTS` con chiave uguale a `name`, barrel.
- `packages/contracts/src/components/{badge,product-card}.ts` — `badge@1` resta; `product-card` si elimina.
- `packages/contracts/src/sections/carousel.ts` — `slide(n)` e `slots: [{ id: "slides", allow }]`; `validateSectionDefinition` valida le props dei figli.
- `packages/contracts/src/schema-version.ts:30`, `tests/contracts.fingerprint.json` — il test controlla solo la voce corrente.
- Test che nominano il vecchio nome: `contracts/tests/components.test.ts:16,94`, `section.test.ts:79`; `scripts/tests/fixtures/sections.ts:22`, `core/sections.test.ts:57`, `core/build-order.test.ts:92`, `generated-output.test.tsx:45`.
- `packages/scripts/src/core/generate.ts` — generico; `fieldShape` salta i field `.optional()` e usa il `sample` del field quando c'è; `contract.ts` dichiara `sample` sulla definizione del field.
- `packages/ui/src/domains/chip/` — l'esempio completo (`@generated` + TSX e test dello sviluppatore).
- Penpot (letto 2026-11-03, forma finale): `Badge` 6 celle; `ShopCard` 2 celle (`size=sm|default`) con `Price`, `Tag` e `Stock` come istanze `Badge`; `Carousel` 3 celle con istanze `ShopCard`.
- `_bmad-output/spikes/penpot-ai-kit-2026-10-10/test-v3/codice/` — bozza validata (riferimento, non da copiare alla cieca).

## Tasks & Acceptance

**Execution:**
I task marcati HITL li esegue l'orchestratore con l'utente: l'implementatore si ferma prima del primo di essi.
- [x] `packages/contracts/src/components/shop-card.ts` — asse `size` (`default|sm`); field `href` e `image` (`z.url()`, `sample`), `imageAlt`, `heading`, `description`, `price`, `ctaLabel` (`z.string()`) e `tags` (`z.array(z.string())`, `sample`), tutti `content` e obbligatori.
- [x] `registry.ts`, `src/index.ts`, `src/components/product-card.ts` — registra `shop-card`; togli import, voce, export e file di `product-card`.
- [x] `packages/contracts/src/sections/carousel.ts` — `allow: ["shop-card"]`; i tre `slide(n)` coi field di `shop-card`.
- [x] `packages/contracts/src/schema-version.ts`, `tests/contracts.fingerprint.json` — `SCHEMA_VERSION = 7` più la riga di commento; voce `"7"` con l'hash stampato dal test.
- [x] Test e fixture che nominano il vecchio nome (elenco nel Code Map) — `shop-card@1`, path `../shop-card/ShopCard`, stub `domains/shop-card/ShopCard.tsx`; blocco `shop-card@1` in `components.test.ts`.
- [x] Penpot VC Badge con l'utente (HITL) — `verify_component badge@1`: 12 domande = 2 decisioni (overflow del layer `Badge`; parte `Label` → `label`); una risposta alla volta, anteprima, sì, rilettura.
- [x] `packages/ui/src/domains/badge/` — `build_order [badge, shop-card]` → `generate_component badge`; poi `Badge.tsx` e `Badge.test.tsx` (testo, axe).
- [x] Penpot VC ShopCard con l'utente (HITL), sulla forma nuova — `part`/`repeat`/`element`/`overflow` sui layer `Image`, `Body`, `Header`, `Heading`→`h3`, `Price`/`Tag`/`Stock` (istanze), `Description`, `Tags`, `Cta`, `Label`; `Tag` risposto come parte ripetuta (`tags`).
- [x] `packages/ui/src/domains/shop-card/` — `generate_component shop-card`; `ShopCard.tsx` rende Image, Body (Title + Price come Badge, Description, Tags con una Badge per voce) e Cta; `ShopCard.test.tsx` (link, alt, tre Badge, `tags` vuoto, axe).
- [x] Storybook — `pnpm --filter storybook dev`: giudizio dell'utente sulle **2** celle ShopCard (forma nuova) e sulle 6 Badge, esito in Implementation Notes.

**Acceptance Criteria:**
- Given i due contratti nel registro, when `build_order {names:["badge","shop-card"]}` runs, then `order` è `["badge","shop-card"]` senza finding.
- Given `product-card` rimosso, when `pnpm check-types && pnpm lint && pnpm test` runs, then verde e `grep -r product-card` su `packages/` e `apps/` è vuoto.
- Given `SCHEMA_VERSION = 7`, when `pnpm --filter @app/contracts test` runs, then la voce `"7"` combacia e `"1"`–`"6"` sono invariate.
- Given le story generate, when `pnpm test` su `@penpot-ds/ui` runs, then 2 story ShopCard (una per cella `size`) e 6 Badge, axe senza violazioni.
- Given le celle in Storybook, when l'utente le guarda, then dice che corrispondono a Penpot.

## Implementation Notes

- **Metà codice (2026-11-03).** Contratto `shop-card@1` (assi `size`/`promo`, nove field obbligatori: `href` e `image` `z.url()`), `product-card` eliminato da file, registro, barrel e test; Carousel su `shop-card`; `SCHEMA_VERSION = 7` con voce `"7"` = `3bdcc595…cb0518` e `"1"`–`"6"` intatte. `check-types` 11/11, `lint` 7/7, `test` 8/8, `build` 18/18.
- **Server `pds` e contratti nuovi.** Il server MCP in esecuzione teneva il registro vecchio (`product-card` presente, `shop-card` sconosciuto): le chiamate sono passate da un client in memoria sullo stesso `createPdsServer` (`packages/scripts/tmp/genera-2-40.ts`, in `tmp/` che è ignorata), cioè un `/mcp` → reconnect senza toccare il processo del client.
- **VC Badge, 2 decisioni su 12 domande.** `overflow=visible` sui 6 layer `Badge`, `part=label` sui 6 `Label`. Restavano 18 avvisi: le celle `Label` a misura fissa e `fontFamily` senza token (una cella `Inter`, cinque `Source Sans Pro`).
- **GC Badge.** `build_order [badge, shop-card]` → `["badge","shop-card"]`, nessun finding. `generate_component badge` ha scritto `Badge.styles.ts`, `Badge.stories.tsx` (6 story, una per cella) e lo scaffold. `Badge.tsx` dello sviluppatore: radice `span` con `w-fit` (la radice è hug), `label` come `span` e non `label`.
- **VC ShopCard, 14 decisioni.** 38 domande `part` ridotte a 10 layer: `image`, `header`, `category`, `title`, `description`, `content`, `price`, `footer`, `cta`, `action` (l'istanza Badge). Poi 3 `overflow=visible` (`Header`, `Content`, `Footer`) e `element=h3` sulla parte `title`. Restano 24 avvisi (altezza fissa delle celle e misure dei testi).
- **GC ShopCard + TSX.** Radice `<a>` (tutta la card è il link, la Cta resta testo), `h-auto` contro l'altezza fissa della cella, immagine con `alt` dal field, Badge solo con `promo="discount"` e `label={badgeLabel}`; con `promo="none"` il field resta inerte. `ShopCard.test.tsx`: link e alt, Badge presente/assente, parti con i field, axe.
- **Giudizio in Storybook: negativo al primo giro, positivo dopo la correzione.** Il Badge aveva il testo tagliato (casella `Label` fissa a 33/37/38px). Su indicazione dell'utente il disegno è cambiato: i 6 `Label` passano a sizing auto e legano il token `font.sans` (una cella per chiamata, `applyToken` senza elenco di proprietà come sul Chip). `verify_component badge@1` ora è **a zero finding**; `generate_component badge` ha riscritto solo `Badge.styles.ts` (`font-sans`, nessun `w-[…]`/`h-[…]`) e `generate_component shop-card` non ha riscritto nulla. Il Badge mostra "badgeLabel" intero e la card resta fedele alla forma disegnata.
- **Giudizio finale: positivo** (2026-11-03, «corrisponde, procedi»). Le 6 celle del Badge e le 4 della ShopCard rendono come in Penpot; il rettangolo vuoto in alto nella card è l'`<img src="image">` del campione generato (il generatore usa il nome del field per le stringhe), non un difetto di stile.
- **Istanza Storybook.** La 6006 che l'utente aveva aperta era partita prima che esistessero `domains/badge` e `domains/shop-card`: Tailwind, con `@source "../**/*.{ts,tsx}"`, non compila i file di una cartella nuova nata dopo l'avvio, quindi applicava `display:flex` ma non `flex-col`/`rounded-2xl`/`gap-y-*`. Fermata e riavviata una sola istanza sulla 6006.
- **Ridisegno e allineamento (2026-11-03, tardi).** Mentre la story si chiudeva, il disegno ShopCard è stato rifatto in un'altra sessione per provarlo: 2 celle (`size` `sm`/`default`), un asse solo, `Price`/`Tag`/`Stock` come istanze Badge, field `tags` al posto di `category`/`badgeLabel`. Il contratto è stato aggiornato lì, il codice del componente no: la CI è diventata rossa sullo stub di `generated-output.test.tsx` (le story del Carousel passavano `tagLabel`/`stockLabel` che lo stub non aveva). Su indicazione dell'utente la forma nuova **resta**: contratto a `tags`, generatore con `sample` per field (immagine vera nelle story), `ShopCard.styles.ts`/`.stories.tsx` rigenerati, `ShopCard.tsx` riscritto (Body con Title e Price-Badge, Description, Tags come lista di Badge, Cta con `label`) e test riscritti. Tutto verde: contracts 146, ui 53, scripts 613 (20 saltati), `check-types` 11/11, `lint` 7/7.
- **Giudizio sulla forma nuova: positivo** (2026-11-03, «corrisponde, procedi»). Le due celle (`default` 288px, `sm` 240px) rendono come in Penpot: immagine con `sample` vero, `Heading` con `Price` sulla stessa riga, `Description`, tag come una Badge per voce, Cta piena. Le story hanno un decorator che dà la larghezza della cella disegnata.
- **La review `quick` è precedente al ridisegno:** i suoi quattro rilievi riguardano la forma con `promo`/`category`/`badgeLabel`; la correzione del nome accessibile della Cta resta valida anche nella forma nuova (il `label` del Cta è dentro il link), mentre i rilievi 1, 3 e 4 restano come registrati.
- **Fuori scope, da sapere:** `packages/ui/src/domains/index.ts` resta vuoto e `index.test.ts` invariato (è la 2.32); le altezze fisse dei testi della ShopCard e la misura `h-[350px]` della radice (neutralizzata con `h-auto` nel TSX) sono avvisi noti, non correzioni silenziose.

## Plan Change Log

## Review Triage Log

**Pass 1 (2026-11-03, lens `quick`)** — verdetti: high 0 / medium 1 / low 2 / false 1 / maybe-false 0.

| # | Rilievo | Verdetto | Rotta | Evidenza |
|---|---|---|---|---|
| 1 | Il disegno Penpot è cambiato dentro la 2.40 contro il blocco «Never» e il Plan Change Log è vuoto | low | respinto (la correzione è una modifica del piano) | Il fatto è vero: i 6 `Label` sono passati a sizing auto con `font.sans`. Ma il cambio è una **rinegoziazione dell'utente**, chiesta e approvata in sessione («Sistema il disegno e rigenera»), ora scritta come `Decision` nel blocco congelato; senza, la pillola tagliava il testo e il giudizio non poteva essere positivo. |
| 2 | `aria-hidden="true"` sullo `span[data-slot="cta"]` toglie «Scopri» dal nome accessibile del link (WCAG 2.5.3 Label in Name) e il test non se ne accorge | medium | patch | `ShopCard.tsx:62` aveva l'attributo e lo `span` non è focalizzabile: il testo visibile spariva dall'albero di accessibilità. Corretto togliendo l'attributo e aggiungendo un'asserzione sul nome accessibile del link (`ShopCard.test.tsx`, «il nome accessibile del link contiene il testo visibile della Cta»). |
| 3 | `packages/scripts/tests/penpot/read-component.live.test.ts` usa ancora un `shop-card` finto con `fields: {}` | false | — | Il file dichiara «I contratti dei test» e fa la stessa cosa con `carousel`, che un contratto vero con field ce l'ha già: il test dal vivo copre lettore e verifica, non il contratto spedito, che è coperto dai livelli 1–2 con il registro vero. Non è una staleness introdotta dalla 2.40. |
| 4 | `shopCardParts` dichiara `action` ma nel DOM c'è solo `data-slot="badge"`: nessun elemento con `data-slot="action"` | low | respinto | La parte `action` è un'**istanza annidata**: il generatore la modella come `s.action(axes)` + `shopCardInstances.action(axes)`, e `isPartUsed` accetta `.action` (la rigenerazione non dà finding). Il commento «la chiave è il `data-slot` nel TSX» è il template generico; aggiungere `data-slot="action"` all'istanza sovrascriverebbe il `data-slot="badge"` del Badge, e un wrapper aggiungerebbe un nodo che il disegno non ha. |

## Design Notes

- **Field obbligatori.** `renderStories` e i figli di default saltano i `.optional()`, e un field senza `sample` prende il nome del field: per questo `image` porta un `sample` con un URL vero e `tags` un elenco d'esempio, invece di `<img src="image">`.
- **Il passaggio alle istanze sta nel TSX** (AD-5), e la lista dei tag è un `.map` con una `cva` sola:

  ```tsx
  <Badge {...shopCardInstances.price(axes)} label={price} />
  {tags.map((label) => <Badge key={label} {...shopCardInstances.tag(axes)} label={label} />)}
  ```

## Verification

**Commands:**
- `pnpm check-types` — 11/11 verdi.
- `pnpm lint` — 7/7 verdi.
- `pnpm test` — contracts, scripts e ui verdi, axe incluse (`pnpm db:start` se `api` lo chiede).
- `pnpm build` e `pnpm --filter storybook build-storybook` — verdi, senza leggere Penpot.
