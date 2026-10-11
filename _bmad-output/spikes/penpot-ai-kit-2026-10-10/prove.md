# Spike penpot-ai-kit — dettaglio delle prove

Prove svolte il 2026-10-10, in ordine. Sintesi, decisioni e punti aperti stanno nel [README](README.md).

Ambiente: worktree temporaneo su `develop` (`999ba13`), perso il 2026-10-11 e conservato in [`test-v3/`](test-v3/README.md), kit penpot-ai-kit v0.5.1 letto da un clone e seguito a mano (non installato), Penpot 2.17.2 fino alla prova C e 2.18.3 dopo.

---

## Prova A — il kit da un file vuoto fino a `render` (Badge)

**Domanda:** un designer che parte da un file Penpot vuoto e usa solo il kit arriva a qualcosa che la pipeline (`theme` → `extract` → `render`) trasforma in codice?

**Svolgimento:** workflow del kit `design-system-bootstrap` sul file "Nuovo File 5", con Alessandro come designer ai checkpoint: `penpot-foundations` (primitive → semantici, default del kit) e `penpot-component-factory` con il brief "un Badge con varianti default, secondary, destructive e due taglie". Poi `theme --live`, `extract Badge`, `render Badge` nel worktree. Run **A1** alla cieca (convenzioni del kit), run **A2** informata (convenzioni del progetto).

| # | Passo | Cosa succede | Chi adatta |
|---|---|---|---|
| A-1 | foundations | 46 primitive + 9 `modes/light` + 14 `semantic`, tutte risolte | — |
| A-2 | foundations (default) | nessun colore danger nei default: il ruolo `color.feedback.danger.*` non si crea finché qualcuno non propone una scala rossa | designer o default del kit |
| A-3 | `theme --live` | funziona; i nomi DTCG danno classi poco leggibili (`bg-action-primary-bg`, `text-text-default`, `--text-font-size-300`) | convenzione di naming |
| A-4 | factory, `createVariants.js` | `base.clone()` dell'istanza principale dà una **copia**, che `createComponent` avvolge in una board esterna (la cella annidata che il kit stesso vieta). Aggirato costruendo le celle da zero | script del kit (rotto) |
| A-5 | factory, nomi | assi e valori PascalCase (`Variant=Default`, `Size=Small`); layer in kebab-case (`label`) | — (misurato in A-9/A-10) |
| A-6 | factory, font | nessun token di famiglia o peso: testo in Source Sans Pro non legato | foundations |
| A-7 | factory, container | `createVariantContainer` al primo colpo, 6 celle, legami intatti, file salvabile | — |
| A-8 | `extract` A1 | si ferma su **plugin data `badge@1` assente**: lo scrive solo `library` | regola AD-11 |
| A-9 | `extract` A1 | "prop d'asse extra `Size`": PascalCase del kit contro `size=sm` del contratto. Fine della run alla cieca | contratti o convenzioni pds |
| A-10 | `extract` A2 | parte `label` cercata come layer `Label` | contratto o convenzioni |
| A-11 | `extract` A2 | `fontWeight` e `letterSpacing` con valori di default ma senza token: il registro esige un token anche per il default | registro o foundations |
| A-12 | `theme --live` | token `letterSpacing` `"0"` rifiutato: serve l'unità (`0px`) | designer o kit |
| A-13 | `extract` → `render` | **bug:** il reader live non legge mai il layout flex; il Badge esce senza `flex flex-row items-center`. Non si vedeva perché le istantanee committate vengono da un seed | pipeline |
| A-14 | `render`, test | 2 test su 5 rossi: il flex (A-13) e `bg-destructive` cablato nel template del test | pipeline |
| A-15 | `extract`, log | stampa sempre la chiave della ProductCard (`promo=<v>\|hover=<v>`) | pipeline |

**Esito:** con 5 adattamenti di naming o di completezza dei token (A-8…A-12) la catena arriva a `Badge.tsx`. Nessuno è strutturale; l'unico punto di principio è il plugin data (A-8, regola AD-11).

**Provenienza dei token:** la struttura (tre livelli, set `primitives`/`semantic`/`modes/light`, nomi DTCG, scale di spaziatura, raggi e testo, nomi dei ruoli) è il default del kit; i valori concreti (tonalità delle scale, mappature semantico → primitiva, token per il Badge e per il registro) sono scelte dello spike, perché il kit dà regole ed esempi, non una palette. Gli attriti con `extract` riguardano la forma, non i valori.

**Esperienza del designer con il kit:** sei checkpoint utili, con proposte concrete e immagini esportate (il punto più forte); la regola "nessun token inventato senza checkpoint" ha fatto emergere il buco del rosso; gli script vanno usati come dottrina, non incollati (A-4); foundations non crea token tipografici completi.

---

## Prova B — tema Tailwind da CSS a Penpot

**Idea di Alessandro:** il tema si definisce in un CSS Tailwind (`@theme`) e un comando della skill lo traduce in token Penpot. Alla base, la regola dei namespace: il generatore del tema toglie dal nome del token il prefisso quando coincide con il namespace Tailwind del tipo, quindi `text.sm` → `text-sm`, `font-weight.medium` → `font-medium`, `color.primary` → `bg-primary` (la library attuale "Page Builder DS" segue già questa regola).

**Prototipo** in [`tailwind-to-penpot/`](tailwind-to-penpot/): [`theme.css`](tailwind-to-penpot/theme.css) (solo le scelte proprie: font, `--radius-full`, `--border-width-default`, 17 ruoli shadcn come `var()`, varianti `[data-gruppo="nome"]`; il resto da `tailwindcss/theme.css` v4.3.3) e [`css-to-tokens.mjs`](tailwind-to-penpot/css-to-tokens.mjs) (letterali → set `tailwind`, `var()` → set `semantic`; oklch → hex, rem → px, `--spacing` → scala discreta). Applicato al file Penpot "tailwind", poi Badge con le convenzioni del progetto → `theme` → `extract` → `render`.

| # | Punto | Risultato |
|---|---|---|
| B-1 | conversione | 365 primitive, 17 semantici, riferimenti validi; hex identici agli ufficiali v4 (`neutral-900 #171717`, `red-600 #E7000B`) |
| B-2 | colori P3 | 95 colori v4 fuori sRGB, ridotti al più vicino |
| B-3 | variabili saltate | 89: line-height, breakpoint, container, blur, ease, perspective, passi frazionari di spaziatura, font di sistema `serif`/`mono` |
| B-4 | `oklch(… none)` | i neutri v4 usano `none` come tonalità; il primo parser li scartava (corretto) |
| B-5 | ombre | Penpot rifiuta lo `spread` negativo: entrano solo `2xs`, `xs`, `inner` |
| B-6 | `rounded-full` | in v4 è un'utility fissa: va dichiarata nel seme (`--radius-full`) |
| B-7 | prestazioni | con ~380 token le chiamate grandi vanno in timeout (su 2.17.2) |
| B-8 | `theme` + `extract` | al primo colpo, nessun adattamento: la regola dei namespace elimina A-9…A-12 |
| B-9 | `render` | classi identiche al Badge di `develop` (`bg-primary pb-1 pl-3 pr-3 pt-1 rounded-full`, `font-medium text-sm`), salvo il flex mancante (A-13) e `tracking-none` → `tracking-normal` |

---

## Verifica dopo l'aggiornamento a Penpot 2.18.3

Penpot e MCP da 2.17.2 a 2.18.3 (le immagini `penpotapp/mcp` seguono il numero di versione di Penpot). Il changelog 2.18 restringe solo gli strumenti di sviluppo dell'MCP (`import_penpot_file`, REPL dietro `PENPOT_MCP_DEVENV`), non `execute_code`.

| # | Limite su 2.17.2 | Su 2.18.3 |
|---|---|---|
| V-1 | clone di `createVariants.js` (A-4) | **invariato** |
| V-2 | token di famiglia del font non legabili (Story 2.4) | **legabili**, ma con la proprietà `fontFamily` (singolare); con `fontFamilies` (nome della panoramica API e del registro) fallisce |
| V-3 | — | in un primo test il legame `fontFamily` sembrava scartato in silenzio da `extract`; nella prova D invece il registro lo blocca correttamente ("proprietà non registrata"): il primo caso era probabilmente un effetto di tempi (`applyToken` è asincrono) |
| V-4 | ombre con `spread` negativo (B-5) | **invariato**, messaggio ora esplicito ("la diffusione non può essere negativa"): è una regola di Penpot |
| V-5 | `theme.addSet()` non persiste (secondo il kit) | **funziona** passando l'oggetto `TokenSet`, non il nome; `addTheme({ group, name })` ok |
| V-6 | timeout con ~380 token | 300 token in 10,7 s, nessun timeout |

---

## Prova C — variante di tema (brand)

Il seme dichiara `[data-brand="ocean"] { --color-primary: var(--color-blue-600); … }`. Il convertitore la trasforma nel set `brand/ocean` (solo le 3 sovrascritture) e nei temi Penpot `brand/default` (nessun set) e `brand/ocean`. Il prototipo [`extract-themes.ts`](tailwind-to-penpot/extract-themes.ts) fa il giro inverso.

| # | Punto | Risultato |
|---|---|---|
| C-1 | cambio di tema in Penpot | con `brand/ocean` i Badge `default` passano da `#171717` a `#155DFC`; nessun componente toccato |
| C-2 | `theme --live` di oggi | si ferma su "nome token duplicato `color.primary`"; legge solo i set attivi, quindi il CSS dipende dal tema lasciato acceso e la variante spenta sparisce in silenzio |
| C-3 | estrazione per tema (prototipo) | `theme.css` (base, 377 variabili, con il `generateTheme` esistente) + `themes/brand-ocean.css` con le sole 3 variabili sotto `[data-brand="ocean"]`: **identico al blocco del seme**, il giro CSS → Penpot → CSS si chiude |
| C-4 | regola usata | un gruppo con più temi è un asse di varianti; il tema `default` non aggiunge set; i set presenti solo nei temi non-default sono di variante; la base si legge anche dai set spenti |
| C-5 | runtime in Storybook | funziona (Badge blu dentro `data-brand="ocean"`), ma solo dopo aver corretto C-6 |
| C-6 | **bug su `develop`** | il tema Penpot **non entra nel CSS compilato**: l'`@import` di `tailwind-theme.css` sta a metà di `globals.css` e la build PostCSS lo scarta; `bg-primary` usa la variabile shadcn `--primary`, `pl-3` la spaziatura di default, `rounded-full` il valore fisso. `generated-classes.test.ts` non se ne accorge (compila in un altro modo e controlla solo che la classe produca CSS) |

---

## Prova D — componente nuovo (ShopCard) e composizione

Componente "nuovo" `ShopCard` (`shop-card`), per non collidere con la ProductCard esistente.

| Step | Esito |
|---|---|
| D-1 Ricetta | dal sorgente shadcn `base-nova` scaricato ([`recipes/card.md`](recipes/card.md)): 7 parti, asse `size`, token `bg-card`, `text-card-foreground`, `rounded-xl`. Sette punti non traducibili 1:1 (alpha, griglia, stili condizionali sul contenuto, clip, interlinea, bordo su un lato) |
| D-2 Domande | contenuto: immagine, prezzo, badge di sconto facoltativo; asse `size` tenuto; la card porta al prodotto; tutte le parti della ricetta |
| D-3 Contratti (v2) | `shop-card.ts` (`size` × `promo` = 4 celle, 8 field) + `shop-card.extract.ts` (11 parti); `SCHEMA_VERSION` 5; 137/137 test verdi |
| D-4 Blocco | `library add` **e anche `extract`/`propose`** si fermano: la struttura (`expectedCells` → `partsForCell`) cerca i token di partenza nella tabella `COMPONENT_TOKENS` scritta a mano in `library-plan.ts`. Rossi anche 3 test di `library bootstrap` che contano container e scritture |
| D-5 Creazione con il kit | Fase 0 approvata (aspetto dalla ricetta, `--border-width-default` aggiunto al seme); celle costruite da zero; **istanza del Badge** `destructive/sm` (layer `Action`, testo "-20%") nelle celle `discount`; container `ShopCard` + plugin data scritto dal wrapper; file salvabile |
| D-6 Attriti in Penpot | `applyToken` ~0,8 s a legame con ~380 token nel file: ~38 s per cella, tre celle in una chiamata superano i 120 s e la chiamata si annulla → una cella per chiamata; il plugin perde lo `storage` a ogni ricollegamento; scheda sospesa più volte |
| D-7 `extract` (v2) | si ferma sull'istanza: il reader perde l'informazione "questo layer è un'istanza di Badge"; `extract` vuole un albero chiuso di parti disegnate |
| D-8 Prototipo della composizione | reader che riconosce le istanze (contratto d'origine, variante, override per confronto con l'istanza principale; non scende nei figli), parte `component`/`fields`, quattro controlli in `extract`, istantanea `{ $component: "badge@1", $prop.variant, $prop.size }`: ~95 righe. `extract ShopCard` passa |
| D-9 Casi negativi | cambio di variante (`secondary`) → passa e la registra; override di colore → **bloccato** (messaggio da accorciare alla sola differenza); `switchVariant` su un'istanza con override **rinomina il layer** col nome del componente (`Action` → `Badge`) |

---

## Prova E — test v3: collegamento, verifica e generatore generici

Modello nuovo provato sulla ShopCard già disegnata. File in [`test-v3/`](test-v3/README.md).

| Passo | Esito |
|---|---|
| Correzioni al contratto dell'editor | `href` accetta link relativi; `image` e `badgeLabel` facoltativi |
| T1 Contratti | editor (12 righe) + **collegamento** `shop-card.binding.ts` (9 righe: elementi, field, `action` = Badge con `when` e `fields`, a11y, dominio). Spariti nomi di layer, ruoli, contenitori, `penpot.container` |
| T2 Verifica | 0 blocchi, 0 avvisi; la lettura contiene layout flex (reader corretto) e l'istanza `badge@1` solo nelle celle `discount` |
| T3 Generazione | `ShopCard.tsx` + 4 story **senza una riga specifica per la card**: prop da assi e field, elementi e field dal collegamento, `{image && <img>}`, `{promo === "discount" && <Badge variant="destructive" size="sm" label={badgeLabel ?? ""} />}` con import, classi per cella. Da migliorare: tabelle ripetute sugli assi che non cambiano, `pl-4 pr-4` non compattato, test non generati |
| T4 Storybook, primo giro | struttura, badge-istanza, colori, testi, spaziature fedeli; mancano font (token con solo `"Inter"`), bordo (spessore senza classe: `strokeWidth` è `coveredByBase` nel registro, residuo v1), dimensionamento "fill" (non letto: footer stretto) |
| T4 Storybook, dopo le correzioni | lista completa dei font nel seme, `border-(length:--border-width-…)`, lettura di `layoutChild` → `self-stretch`/`flex-1`, tolto l'override del font nel `@theme inline` di shadcn (stesso bug C-6): **molto vicino a Penpot** (foto in [`test-v3/storybook/`](test-v3/storybook/)) |
| Vincolo tra script | la correzione di `href` ha fatto fallire `theme`, che non c'entra con le card: la CLI carica all'avvio tutti i contratti di estrazione e quello vecchio della ShopCard pretendeva `z.url()` |

| T4b-1 Agganci per le modifiche a mano | **A comportamento:** `behavior: ["image"]` nel collegamento; `ShopCard.behavior.ts` scritto a mano (immagine lazy, nascosta se rotta); il generato importa `useShopCardBehavior`, esporta i tipi `ShopCardState`/`ShopCardBehavior` e aggiunge `{...behavior.image}` prima di `className` (l'aspetto resta di Penpot). **B a11y:** campo `aria` per parte (solo `aria-*`/`role`): `aria-hidden` sulla CTA. **E eject:** GC salta il file senza `@generated`, VC avvisa "staccato"; VC blocca se manca il file di comportamento o la parte non esiste. Typecheck di `ui` e `scripts` e confini di `ui` verdi; diff del generato limitato ai quattro punti attesi |

Il worktree è andato perso con il riavvio del 2026-10-11 (stava in `/tmp`): lo step T4b-1 è stato ricostruito in `test-v3/codice/` dal codice della sessione, senza rieseguire il typecheck.

| T4b-2 Stili generati, componente tuo | Alessandro: gli agganci (`behavior`, `aria`, eject) danno poca elasticità sul codice. Nuovo taglio: il generatore possiede solo l'aspetto (`ShopCard.styles.ts`, una `cva` per parte con tutti gli assi, più le varianti delle istanze); `ShopCard.tsx` lo crea GC una volta (scaffold) e poi è dello sviluppatore. Modificato a mano (stato React, segnaposto per l'immagine rotta, `aria-hidden`), rilanciato `styles`: `ShopCard.tsx` **identico byte per byte**, VC 0 blocchi e 1 avviso (`shop-card-image-fallback` solo nel codice). Typecheck e confini verdi. Tolti `behavior.ts`, `aria` ed eject dal collegamento |

| T5 Cambio di aspetto in Penpot | `radius.xl` → `radius.2xl` sui quattro angoli delle 4 celle (via MCP). `styles` dalla lettura dal vivo: VC 0 blocchi; diff di **una riga** in `ShopCard.styles.ts` (`rounded-xl` → `rounded-2xl` nella base di `root`); `ShopCard.tsx` modificato a mano **intatto**; typecheck verde |

| T6 Cambio di struttura in Penpot | Il designer (via MCP) aggiunge `Category` ("Scarpe", `text.xs`, `color.muted-foreground`, `font-weight.medium`, larghezza fill) in `Header` prima di `Title`, nelle 4 celle. **VC** dal vivo: 2 blocchi (testo senza field — alzato da avviso a blocco — e `data-slot` mancante nel file dello sviluppatore); niente generato. **MS:** proposta `category` nel contratto e nel collegamento; Alessandro: obbligatoria, `span`. Il gate dei contratti rifiuta di riscrivere la voce 5 → `SCHEMA_VERSION` 6 (nessuna migrazione registrata). **AC:** `styles.ts` rigenerato con la voce `category` (corretta la CLI: i blocchi sui `data-slot` li risolve AC, non fermano gli stili); diff proposto per `ShopCard.tsx` (prop, default, `<span data-slot="shop-card-category" className={s.category(axes)}>`), approvato e applicato: le modifiche a mano restano. VC 0 blocchi, typecheck e confini verdi, test dei contratti 137/137, Storybook corretto (`storybook/t6-*.png`) |

Prove concluse. Note: MS e il diff di AC li ha fatti l'agente come li farebbe la skill (non sono script); la story generata ha esempi cablati per nome di field (`category: "Scarpe"`), da rendere generici.

---

## Prova F — Carousel: simulazione completa della skill (2026-10-11)

Componente nuovo dal contratto, guidato dai prompt di Alessandro come con le skill vere; operazioni reali su Penpot e sul codice. Ricetta in [`recipes/carousel.md`](recipes/carousel.md), codice in [`test-v3/codice/`](test-v3/README.md), lettura in `test-v3/lettura-penpot-carousel.json`.

| Step | Prompt | Esito |
|---|---|---|
| F-1 Apertura | `/pds-design` | menu TB TV CN DC CD MS, stato del file Penpot |
| F-2 CN ricetta | `CN, vorrei un carousel` | ricetta dal Carousel shadcn `base` (embla, Button, `orientation`); 7 domande con proposta |
| F-3 CN risposte | slide = shop-card, solo shop-card, max 3 visibili, autoplay impostabile, Button dopo, solo orizzontale, "vedi tu" | **sezione** `carousel` (come l'Accordion): field `perView` (`structure`), `autoplay`/`interval`/`label` (`content`), slot `slides` di `shop-card`, 3 figli di default; collegamento con tre concetti nuovi: `slot`, `repeat`, `icon`, e `sectionContract` (gli `enum` della sezione come assi delle celle). Approvato |
| F-4 CN scrittura | — | `sections/carousel.ts` registrata, test della sezione, `SCHEMA_VERSION` 7, `carousel.binding.ts`; test dei contratti 138/138 |
| F-5 DC | `DC` | container `Carousel` (`perView` 1/2/3, plugin data `carousel@1`) via MCP: `Previous`/`Next` assoluti con chevron lucide (tracciato), `Viewport` > `Slides` con 1–3 istanze di ShopCard, `Dots` (`DotActive` + `Dot`); solo token esistenti; verifica di salvataggio |
| F-6 Prova del designer | (Alessandro in Penpot) | con una card scontata le card non restano allineate. Correzione di design: istanze in `Slides` ad altezza **fill**, `Content` della ShopCard ad altezza **fill** (il footer resta in fondo) |
| F-7 GC primo giro | `/pds-code GC Carousel` | VC 0 blocchi; `styles.ts`, scaffold, story (6 ShopCard dai figli di default). **Giudizio negativo** in Storybook: il reader non legge ritaglio, dimensioni fisse, posizione degli assoluti |
| F-8 A: pipeline | `A poi B` | reader: `clipContent` → `overflow-hidden`, dimensioni fisse in scala (`size-8`, `size-2`, `h-40`), posizione degli assoluti dai **vincoli** del designer (`left-2 top-1/2 -translate-y-1/2`), genitore `relative`, "fill" verticale (`flex-1`/`self-stretch`); D2 ignora dimensionamento e geometria dell'istanza. Vincoli delle frecce impostati in Penpot |
| F-9 B: comportamento | approvato | diff proposto e applicato al `Carousel.tsx` dello sviluppatore: scroll-snap, `basis` per `perView` (responsive), frecce disabilitate ai bordi, pallini cliccabili, tastiera, autoplay con pause (mouse, focus, `prefers-reduced-motion`), a11y della ricetta. Verificato con Chrome via DevTools: next → slide 2, pallino 6 → fine (next disabilitata), ← → indietro. Foto in `test-v3/storybook/carousel-*.png` |

**Emerso dalla prova**

- **Penpot non esprime "alte come la più alta"** senza fissare il genitore: con tutti i figli in fill la striscia passa a "fix"; l'allineamento Stretch dà altezze incoerenti. Regola nel generatore: se tutti i figli riempiono un asse, la misura fissa del genitore su quell'asse non va nel codice.
- **Il dimensionamento di un'istanza non è un override (D2)**: fill/auto, `ownSizing` e geometria dicono come l'istanza occupa il posto, non come appare. Un override vero (creato per errore durante una prova) è stato bloccato correttamente.
- **Ritaglio di default**: in Penpot i board ritagliano per default, quindi `overflow-hidden` compare quasi ovunque (anche sulla ShopCard). Da decidere: leggerlo solo se attivato dal designer o se qualcosa esce davvero.
- **GC = aspetto + scaffold statico; il comportamento lo propone la skill** come diff sul file dello sviluppatore: il modello della decisione 11 regge anche su un componente con molto comportamento.
- **Pallini uno per slide**: con `perView` > 1 gli ultimi portano tutti alla fine; "uno per pagina" sarebbe un altro disegno.
- **Tipi dei field delle sezioni** (booleani, numeri): lo scaffold li ricava dallo schema (prima `interval` era uscito `string`).
- **Test di `scripts` rotti dallo spike** (45, preesistenti alla prova F): il catalogo Tailwind sostituisce quello delle fixture (generatore del tema, `extract`, `render`, `gates`, nome duplicato `font-weight.black`) e i prototipi `v3/` violano i confini (`process.exit` fuori dal `cli.ts` principale, `@penpot-ds/ui` nel testo generato).
- **Scheda Penpot sospesa** di continuo (anche dopo pochi secondi): una lettura completa salvata subito (`--save-snapshot`) rende gli step successivi indipendenti dalla scheda.

