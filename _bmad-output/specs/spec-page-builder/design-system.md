# Design System — catalogo e layering

Companion di [SPEC.md](./SPEC.md). Contenuto stack-agnostico: descrive **cosa** compone il design system e i suoi confini, non la toolchain. I conteggi provengono dalla codebase di riferimento e sono indicativi del target, non un vincolo esatto.

## Layering e confini

```
tokens  ◄── ui/domains  ◄── puck-components
                        ◄── ui/editor
scripts (pipeline Penpot) ── genera ──► tokens, ui/domains
```

- `tokens` — foglia del grafo, nessuna dipendenza interna.
- `ui/domains` — dipende solo da `tokens` (+ headless Radix). Export `.`.
- `ui/editor` — dipende solo da `ui/domains` + `tokens`. Export `./editor`.
- `puck-components` — dipende da `ui/domains` + `tokens`. **Non** vede `ui/editor`.
- **Regola di confine assoluta:** un componente in `domains/` non conosce il dominio page-builder e non importa mai da `editor/`. La semantica dell'editor vive in `editor/`, mai in `domains/`. Persa la barriera di package, il confine è tenuto da una regola di **lint bloccante in CI** e dai due export separati.

## tokens — fonte di verità stilistica

Colori, tipografia, spacing, radii, ombre, estratti da Penpot. Due forme di output generate:
- variabili CSS custom (per lo styling, raggruppate per SET Penpot);
- una scala tipizzata (spacing/radii) + opzioni/mappe per i controlli dell'editor.

Il nome della variabile deriva dal **tipo** del token (namespace stabile: color, text, font-weight, tracking, font, space, radius, border-width, opacity, shadow), mai dal nome del set → un nuovo set Penpot produce automaticamente una nuova sezione senza modifiche al codice. Le variabili non presenti in Penpot (es. font utility, line-height) sono l'unica parte scritta a mano: vivono in un file **separato e non generato**, importato da quello generato, così la rigenerazione non può sovrascriverle.

## ui/domains — componenti generati da Penpot

Componenti UI riusabili, organizzati per dominio, con varianti guidate dai token e ref forwarding. Sono **generati** dalla pipeline fixture → ricetta → renderer (AD-11) e compongono primitive **headless** (Radix) per il comportamento, che il design non esprime. Ogni componente rispetta la [a11y-baseline](./a11y-baseline.md). I pochi componenti senza headless disponibile e con logica propria (Table con sorting, Carousel) sono scritti a mano, senza marker `@generated`, e ignorati dalla pipeline. Domini e componenti di riferimento:

| Dominio | Componenti |
|---|---|
| Data Display | Badge, Card, Carousel, Table, Typography |
| Inputs | Button, Input, Select, Checkbox, Switch |
| Feedback | Alert |
| Layout | Accordion, Collapsible, ScrollArea, Separator, AspectRatio, Flex, Row, Col (+ Column/Section/Stack a uso interno degli adapter, non esportati) |
| Navigation | Breadcrumb, Tabs |
| Overlays | Dialog, Drawer, Dropdown, Toast, Tooltip |

## puck-components — blocchi del page-builder

Blocchi che **incapsulano** i componenti di `ui/domains` esponendone le varianti come campi editabili. Ogni blocco = schema validato + campi editor + render che wrappa un componente `domains`. I campi spacing/radius derivano dai token (una modifica ai token propaga sia agli stili sia ai menu dei blocchi). Aggregati in un'unica config con categorie. Blocchi di riferimento:

| Categoria | Blocchi |
|---|---|
| Data Display | Badge, Card, Carousel, Image, RichText, Typography |
| Inputs | Button, Checkbox, Input, Switch |
| Feedback | Alert |
| Layout | Accordion, Box, Collapsible, Columns, Hero, Separator, Spacer, Grid, Flex, Section |

I blocchi `Box/Grid/Columns/Spacer/Hero/Section` sono specifici del page-building e non hanno un componente `domains` 1:1. **Slot** (container annidabili): `content` su Box/Grid/Flex/Section/Hero; `col1/col2/col3` su Columns.

Ogni blocco dichiara la classificazione **structure vs content** dei propri campi in una single source of truth (vedi CAP-13 in SPEC.md): `content` = campi testo/contenuto editabili (soggetti a sanitizzazione), `structure` = layout/configurazione (variant, size, padding, colori). Default per campi/componenti ignoti: content (fail-safe).

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
