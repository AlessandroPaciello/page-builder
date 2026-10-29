# Design System — catalogo e layering

Companion di [SPEC.md](./SPEC.md). Contenuto stack-agnostico: descrive **cosa** compone il design system e i suoi confini, non la toolchain. I conteggi provengono dalla codebase di riferimento e sono indicativi del target, non un vincolo esatto. *(Rivisto dai correct-course 2026-09-12, 2026-09-13 e 2026-10-17.)*

## Layering e confini

```
contracts  ◄── ui/domains · puck-components · core · render      (foglia, zero dipendenze UI)
tokens     ◄── ui/domains  ◄── puck-components
                           ◄── ui/editor
scripts (pipeline Penpot v3) ── genera ──► tokens (tema, varianti, font), ui/domains (styles.ts + story)
```

- `contracts` — foglia, nessuna dipendenza da React/Puck/UI. Possiede props, assi `option`, field, slot, classifier structure/content e definizioni di sezione (AD-5).
- `tokens` — foglia del grafo, nessuna dipendenza interna.
- `ui/domains` — dipende solo da `tokens` + `contracts` (+ headless Base UI, fissato in `pds-setup`). Export `.`.
- `ui/editor` — dipende solo da `ui/domains` + `tokens`. Export `./editor`.
- `puck-components` — dipende da `contracts` + `ui/domains` + `tokens`. **Non** vede `ui/editor`.
- **Regola di confine assoluta:** un componente in `domains/` non conosce il dominio page-builder e non importa mai da `editor/`. La semantica dell'editor vive in `editor/`, mai in `domains/`. Persa la barriera di package, il confine è tenuto da una regola di **lint bloccante in CI** e dai due export separati.

## tokens — fonte di verità stilistica

Colori, tipografia, spacing, radii, ombre, estratti da Penpot. Due forme di output generate:
- variabili CSS custom (per lo styling, raggruppate per SET Penpot);
- una scala tipizzata (spacing/radii) + opzioni/mappe per i controlli dell'editor.

Il nome della variabile deriva dal **tipo** del token (namespace stabile: color, text, font-weight, tracking, font, space, radius, border-width, opacity, shadow), mai dal nome del set → un nuovo set Penpot produce automaticamente una nuova sezione senza modifiche al codice. Le variabili non presenti in Penpot (es. font utility, line-height) sono l'unica parte scritta a mano: vivono in un file **separato e non generato**, importato da quello generato, così la rigenerazione non può sovrascriverle.

## ui/domains — stili generati da Penpot, componenti dello sviluppatore

Componenti UI riusabili, organizzati per dominio, con varianti guidate dai token e ref forwarding. **Implementano i contratti** di `@app/contracts`. Per ogni componente la pipeline v3 (AD-11) **genera** `<Comp>.styles.ts` (una `cva` per parte) e le story; `<Comp>.tsx` lo crea lo scaffold una volta ed è poi **dello sviluppatore**, come con shadcn. Il comportamento viene dal primitivo **headless** Base UI se esiste, altrimenti da una ricetta shadcn con il pattern APG. Una sola libreria per installazione, fissata in `pds-setup`. Ogni componente rispetta la [a11y-baseline](./a11y-baseline.md). Table, Carousel e gli altri componenti con logica propria si disegnano in Penpot come tutti gli altri (stili generati, logica nel componente); solo un componente senza container in Penpot (3D, mappe, configuratori) è scritto a mano: contratto sì, niente di generato, solo il gate. Domini e componenti di riferimento:

| Dominio | Componenti |
|---|---|
| Data Display | Badge, Card, Table, Typography |
| Inputs | Button, Input, Select, Checkbox, Switch |
| Feedback | Alert |
| Layout | Accordion, Carousel (sezione con slot), Collapsible, ScrollArea, Separator, AspectRatio, Flex, Row, Col (+ Column/Section/Stack a uso interno degli adapter, non esportati) |
| Navigation | Breadcrumb, Tabs |
| Overlays | Dialog, Drawer, Dropdown, Toast, Tooltip |
| Commerce | ShopCard (ex ProductCard), Filtro attivo |

## puck-components — blocchi del page-builder

**Adapter Puck dei contratti.** Per ogni contratto: campi editor derivati dagli assi `option` (l'asse riservato `state` vive solo in Penpot e non diventa campo), `permissions`/`resolvePermissions` (lock della struttura, `max` degli slot) e render tramite la libreria dell'installazione. Schemi e classifier **non vivono qui** (AD-5). I campi spacing/radius derivano dai token (una modifica ai token propaga sia agli stili sia ai menu dei blocchi). Aggregati in un'unica config con categorie. Blocchi di riferimento:

| Categoria | Blocchi |
|---|---|
| Data Display | Badge, Card, Carousel, Image, RichText, Typography |
| Inputs | Button, Checkbox, Input, Switch |
| Feedback | Alert |
| Layout | Accordion, Box, Collapsible, Columns, Separator, Spacer, Grid, Flex |

I blocchi di layout hanno **compiti separati**, assi tutti `option` a valori token: **Box** = solo riquadro visivo (background, padding, radius, border); **Flex** = disposizione (direction, align, justify, gap, wrap); **Grid/Columns** = griglia. Nessuna prop libera (niente colore o padding arbitrari). `Box/Grid/Columns/Spacer` sono specifici del page-building e non hanno un componente `domains` 1:1. **Slot** (container annidabili): `content` su Box/Grid/Flex; `col1/col2/col3` su Columns.

**Sezioni** (hero, carousel, sezione prodotto…): **non sono blocchi scritti a mano**. Una sezione è un contratto dell'editor con **almeno uno slot** (`sections/<nome>.ts`: field + slot con `allow` e `max`), disegnato in Penpot come un componente: le sue parti proprie hanno `styles.ts` e scaffold, una sezione di sola disposizione no. È esposta in Puck per nome. Rigida per default: struttura bloccata, contenuto modificabile, aperta solo negli slot dichiarati (`allow` + `max`), decisi da sviluppatore/admin.

**Componenti e composizioni.** Un componente ha i pezzi scelti tutti dal designer; una parte può dipendere da un field (`when=<field>`) e nessun comportamento si disegna in Penpot. La flessibilità per chi compone sta negli slot delle sezioni. *(Il vincolo "primitive senza parti opzionali" del 2026-09-13 è superato dal correct-course 2026-10-17.)* Due casi fissati dal correct-course 2026-09-13, ancora validi:

- Un **tag cliccabile su un prodotto è un link**: Penpot disegna solo gli stati (hover/focus, assi `state`); il `<a>` lo decidono contratto e binding, e l'`href` arriva dai dati commerce della ProductCard (CAP-15) — la logica di ricerca resta nella sorgente esterna.
- La **X su un filtro attivo** non è una parte del Badge: è un componente "Filtro attivo" con un'istanza di Badge e un'icona-link. Scartato l'asse `removable` sul Badge: sarebbe l'editor, non i dati, a decidere la presenza della X. Non avendo slot, il Filtro attivo è un componente, non una sezione (correct-course 2026-10-17).

Ogni blocco dichiara la classificazione **structure vs content** dei propri campi in una single source of truth (vedi CAP-13 in SPEC.md), che vive in `@app/contracts`: `content` = campi testo/contenuto editabili (soggetti a sanitizzazione), `structure` = layout/configurazione (variant, size, padding, colori — questi ultimi **solo da token semantici**, mai colori liberi). Default per campi/componenti ignoti: content (fail-safe).

## ui/editor — composizioni di prodotto

Componenti composti con semantica dell'editor page-builder, **scritti a mano**, costruiti solo su `ui/domains` + token:

| Composizione | Scopo |
|---|---|
| LifecycleBadge | Badge di stato pagina (Bozza/Pubblicata/Archiviata) mappato ai token feedback |
| SaveStateIndicator | Indicatore autosave (Salvato/Modifiche non salvate) con `aria-live="polite"` |
| TopBar | Barra editor: breadcrumb + stato lifecycle + azioni Salva/Anteprima/Pubblica |
| EmptyState | Stato vuoto generico riusato da liste |
| PageList | Tabella pagine con menu azioni (Modifica/Archivia) e stato vuoto |
| VersionList | Elenco versioni/revisioni con ripristino |
