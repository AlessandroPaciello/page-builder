# Design System — catalogo e layering

Companion di [SPEC.md](./SPEC.md). Contenuto stack-agnostico: descrive **cosa** compone il design system e i suoi confini, non la toolchain. I conteggi provengono dalla codebase di riferimento e sono indicativi del target, non un vincolo esatto.

## Layering e confini

```
tokens  ◄── primitives  ◄── puck-components
                     ◄── ui
scripts (pipeline Penpot) ── genera ──► tokens, primitives
```

- `tokens` — foglia del grafo, nessuna dipendenza interna.
- `primitives` — dipende solo da `tokens`.
- `puck-components` — dipende da `primitives` + `tokens`.
- `ui` (composizioni di prodotto) — dipende solo da `primitives` + `tokens`.
- **Regola di confine assoluta:** una primitiva non conosce il dominio page-builder e non importa mai da `ui`. La semantica dell'editor vive in `ui`, mai in `primitives`.

## tokens — fonte di verità stilistica

Colori, tipografia, spacing, radii, ombre, estratti da Penpot. Due forme di output generate:
- variabili CSS custom (per lo styling, raggruppate per SET Penpot);
- una scala tipizzata (spacing/radii) + opzioni/mappe per i controlli dell'editor.

Il nome della variabile deriva dal **tipo** del token (namespace stabile: color, text, font-weight, tracking, font, space, radius, border-width, opacity, shadow), mai dal nome del set → un nuovo set Penpot produce automaticamente una nuova sezione senza modifiche al codice. Le variabili non presenti in Penpot (es. font utility, line-height) sono l'unica parte scritta a mano e non vengono mai sovrascritte dalla rigenerazione.

## primitives — libreria accessibile per dominio

Componenti UI headless/riusabili, organizzati per dominio, con varianti guidate dai token e ref forwarding. Ogni componente rispetta la [a11y-baseline](./a11y-baseline.md). Domini e componenti di riferimento:

| Dominio | Componenti |
|---|---|
| Data Display | Badge, Card, Carousel, Table, Typography |
| Inputs | Button, Input, Select, Checkbox, Switch |
| Feedback | Alert |
| Layout | Accordion, Collapsible, ScrollArea, Separator, AspectRatio, Flex, Row, Col (+ Column/Section/Stack a uso interno degli adapter, non esportati) |
| Navigation | Breadcrumb, Tabs |
| Overlays | Dialog, Drawer, Dropdown, Toast, Tooltip |

## puck-components — blocchi del page-builder

Blocchi che **incapsulano** le primitive esponendone le varianti come campi editabili. Ogni blocco = schema validato + campi editor + render che wrappa una primitiva. I campi spacing/radius derivano dai token (una modifica ai token propaga sia agli stili sia ai menu dei blocchi). Aggregati in un'unica config con categorie. Blocchi di riferimento:

| Categoria | Blocchi |
|---|---|
| Data Display | Badge, Card, Carousel, Image, RichText, Typography |
| Inputs | Button, Checkbox, Input, Switch |
| Feedback | Alert |
| Layout | Accordion, Box, Collapsible, Columns, Hero, Separator, Spacer, Grid, Flex, Section |

I blocchi `Box/Grid/Columns/Spacer/Hero/Section` sono specifici del page-building e non hanno una primitiva 1:1. **Slot** (container annidabili): `content` su Box/Grid/Flex/Section/Hero; `col1/col2/col3` su Columns.

Ogni blocco dichiara la classificazione **structure vs content** dei propri campi in una single source of truth (vedi CAP-13 in SPEC.md): `content` = campi testo/contenuto editabili (soggetti a sanitizzazione), `structure` = layout/configurazione (variant, size, padding, colori). Default per campi/componenti ignoti: content (fail-safe).

## ui — composizioni di prodotto (editor)

Componenti composti con semantica dell'editor page-builder, costruiti solo su primitive+token:

| Composizione | Scopo |
|---|---|
| LifecycleBadge | Badge di stato pagina (Bozza/Pubblicata/Archiviata) mappato ai token feedback |
| SaveStateIndicator | Indicatore autosave (Salvato/Modifiche non salvate) con `aria-live="polite"` |
| TopBar | Barra editor: breadcrumb + stato lifecycle + azioni Salva/Anteprima/Pubblica |
| EmptyState | Stato vuoto generico riusato da liste |
| PageList | Tabella pagine con menu azioni (Modifica/Archivia) e stato vuoto |
| VersionList | Elenco versioni/revisioni con ripristino |
