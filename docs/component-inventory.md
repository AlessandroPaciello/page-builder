# Component Inventory — penpot-design-system

> Aggiornato: 2026-07-10 (deep scan document-project). Tre livelli: **primitives** (componenti React headless riusabili), **puck-components** (blocchi Puck che wrappano le primitives per l'editor page-builder) e **ui** (composizioni di prodotto ad alto livello, package nuovo).

---

## `@penpot-ds/primitives` (28 componenti)

Stack: React 19 (peer `^18 || ^19`), `class-variance-authority` per le varianti, `cn()` (clsx + tailwind-merge) per il merge classi, `React.forwardRef`, gran parte basata su Radix UI. Co-location con `.stories.tsx` e `.test.tsx`. Organizzati per dominio in `src/domains/<categoria>/<componente>/`.

**Nessun file contiene un header `@generated`**: tutte le 28 primitive risultano attualmente scritte a mano (i file `@generated` nel monorepo sono solo in `packages/tokens/src/tokens.generated.ts` e negli script della pipeline token, non nelle primitive React). La nota di memoria "alcune primitive sono generate dalla pipeline" si riferisce quindi alla generazione dei *token* consumati dalle primitive, non ai componenti stessi — nessun componente va escluso da modifiche manuali per questo motivo, allo stato attuale.

### Data Display
| Componente | Export | Base | Varianti (CVA) |
|-----------|--------|------|-----------------|
| Badge | `Badge`, `badgeVariants`, `BadgeProps` | CVA | `color`: indigo/gray/red/green × `variant`: solid/soft/outline (compound variants) |
| Card | `Card`, `CardImage`, `CardContent`, `CardTitle`, `CardDescription`, `cardVariants`, `CardProps` | CVA | `variant`: default (composito, radius/surface da token) |
| Carousel | `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`, `CarouselDots`, `useCarousel`, `CarouselApi`, tipi | `embla-carousel-react` | n/a (no CVA) |
| Table | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`, `TableHeadProps`, `SortDirection` | Custom headless (`<table>` nativo) | n/a (no CVA) — pattern sorting via `SortDirection` |
| Typography | `Typography`, `typographyVariants`, `TypographyProps` | CVA | `variant` con `defaultElementMap` (mappa variante → tag HTML) |

### Inputs
| Componente | Export | Base | Varianti (CVA) |
|-----------|--------|------|-----------------|
| Button | `Button`, `buttonVariants`, `ButtonProps` | CVA | `variant`: primary/warm/ghost/outline/surface; `size`: sm/md/lg/xl. Reso come `div role="button"` con gestione `Enter`/`Space`/`aria-disabled` |
| Input | `Input`, `inputVariants`, `InputProps` | CVA (doppio: wrapper + field) | `variant`: default/error |
| Select | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, tipi | `@radix-ui/react-select` | n/a |
| Checkbox | `Checkbox`, `CheckboxProps` | `@radix-ui/react-checkbox` | n/a |
| Switch | `Switch`, `SwitchProps` | `@radix-ui/react-switch` | n/a |

### Feedback
| Componente | Export | Base | Varianti (CVA) |
|-----------|--------|------|-----------------|
| Alert | `Alert`, `AlertIcon`, `AlertContent`, `AlertTitle`, `AlertDescription`, `alertVariants`, `AlertProps`, `AlertStatus` | CVA | `status`: info/success/warning/error — documenta esplicitamente il binding ai token `color.feedback.*` in un commento sorgente |

### Layout
| Componente | Export | Base | Note |
|-----------|--------|------|------|
| Accordion | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `AccordionProps` | `@radix-ui/react-accordion` | |
| Collapsible | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | `@radix-ui/react-collapsible` | |
| ScrollArea | `ScrollArea`, `ScrollBar` | `@radix-ui/react-scroll-area` | |
| Separator | `Separator` | `@radix-ui/react-separator` | |
| AspectRatio | `AspectRatio` | `@radix-ui/react-aspect-ratio` | |
| Flex | `Flex`, `FlexProps` | Custom | prop `gap`/`align`/direction |
| Row | `Row`, `RowProps` | Custom (= `Flex` con `direction` omesso) | |
| Col | `Col`, `ColProps` | Custom (= `Flex` con `direction` omesso) | |
| Column | — (`index.ts` = `// Removed`) | Custom | file component presente ma **non esportato**; commento sorgente: "not Radix-backed, usare direttamente negli adapter Puck" |
| Section | — (`index.ts` = `// Removed`) | Custom | idem: non esportato dal barrel |
| Stack | — (`index.ts` = `// Removed`) | Custom | idem: non esportato dal barrel |

> **Correzione rispetto alla versione precedente del documento**: Column/Section/Stack non sono semplicemente "senza story" — i rispettivi `index.ts` sono stati svuotati (`// Removed`) e i tre componenti sono stati **deliberatamente rimossi dalle esportazioni pubbliche** del package. Restano usabili solo internamente (import diretto del file) dagli adapter Puck.

### Navigation *(dominio nuovo rispetto all'ultimo censimento)*
| Componente | Export | Base | Note |
|-----------|--------|------|------|
| Breadcrumb | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis` | Custom headless (`<nav aria-label>` + `<ol>`, `aria-current="page"`) | nessuna dipendenza Radix |
| Tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@radix-ui/react-tabs` | |

### Overlays *(dominio nuovo rispetto all'ultimo censimento)*
| Componente | Export | Base | Varianti (CVA) |
|-----------|--------|------|-----------------|
| Dialog | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogClose`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` | `@radix-ui/react-dialog` | usa internamente `Alert` (composizione tra primitive) |
| Drawer | `Drawer`, `DrawerTrigger`, `DrawerPortal`, `DrawerOverlay`, `DrawerContent`, `DrawerClose`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription` | `@radix-ui/react-dialog` (riuso non-modale) | usa `usePortalContainer` hook condiviso |
| Dropdown | `Dropdown`, `DropdownTrigger`, `DropdownContent`, `DropdownGroup`, `DropdownPortal`, `DropdownItem`, `DropdownCheckboxItem`, `DropdownRadioGroup`, `DropdownRadioItem`, `DropdownLabel`, `DropdownSeparator` | `@radix-ui/react-dropdown-menu` | |
| Toast | `ToastProvider`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`, `ToastClose`, `ToastAction`, `toastVariants`, `useToast`, `ToastProps`, `ToastStatus` | `@radix-ui/react-toast` | `status`: success/info/warning/error; commento sorgente impone prefisso testuale oltre al colore per a11y |
| Tooltip | `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent` | `@radix-ui/react-tooltip` | |

**Riepilogo per dominio**: Data Display 5, Inputs 5, Feedback 1, Layout 11 (8 esportate + 3 rimosse dal barrel), Navigation 2, Overlays 5 → **28 directory componente**, **25 esportate pubblicamente**.

> Rispetto a `component-audit-epic3.md` (che elencava 7 primitive "da modellare ex-novo": Dialog, Toast, Breadcrumb, Drawer, Table, Tabs, Dropdown/Menu) — **tutte e 7 risultano ora implementate**. Il gap Epic 3.2/3.4 è chiuso.

---

## `@penpot-ds/puck-components` (20 blocchi)

Stack: `@measured/puck ^0.20.0` + `@penpot-ds/primitives` (workspace) + `@penpot-ds/tokens` (workspace) + `zod`. Ogni file `*Component.tsx` esporta un `ComponentConfig` di Puck con `label`, `fields`, `defaultProps`, `render`. Schemi validati con Zod; campi spacing/radius derivati dai token via `puck-tokens.ts`. Tutti aggregati in `puckConfig` (`src/index.ts`).

### Categorie (`puckConfig.categories`)
| Categoria | Blocchi |
|-----------|---------|
| Data Display | Badge, Card, Carousel, Image, RichText, Typography |
| Inputs | Button, Checkbox, Input, Switch |
| Feedback | Alert |
| Layout | Accordion, Box, Collapsible, Columns, Hero, Separator, Spacer, Grid, Flex, Section |

> Rispetto alla versione precedente del documento, **Carousel** è un blocco Puck aggiuntivo non ancora censito (categoria Data Display).

### Slot (container annidabili)
| Blocco | Slot |
|--------|------|
| Box, Grid, Flex, Section, Hero | `content` |
| Columns | `col1`, `col2`, `col3` |

### Confine di classificazione structure/content — `field-classifier.json`

Il file `packages/puck-components/src/field-classifier.json` è **la single source of truth** dichiarata esplicitamente sia nel proprio header (`"$schema": "source: packages/puck-components/src/field-classifier.json"`) sia nel Javadoc del consumer backend. Per ogni componente Puck definisce due array di nomi campo:
- `content`: campi testo/contenuto editabili dall'utente (rischio XSS, soggetti a sanitizzazione)
- `structure`: campi di layout/configurazione (variant, size, padding, colori, ecc.)

**Consumo backend** (JHipster, Java, `apps/pagebuilder`):
- `apps/pagebuilder/src/main/resources/puck/field-classifier.json` — copia derivata (verificata **identica byte-per-byte** al file sorgente in questo scan, nessun drift)
- `apps/pagebuilder/src/main/java/com/penpot/pagebuilder/service/puck/FieldClassifier.java` — carica il JSON da classpath (`@PostConstruct`), espone `isContentField(componentType, fieldName)` e `isStructureField(...)`. Per componenti/campi sconosciuti il default è "tratta come content" (fail-safe lato sanitizzazione/XSS)
- Consumato da `PuckPayloadValidator.java`, `PuckSanitizer.java` e `PageService.java` — presumibilmente per RBAC (chi può editare "structure" vs "content") e per la sanitizzazione HTML lato publish

Il file frontend (`puck-components/src/field-classifier.json`) è quindi tanto un artefatto per l'editor Puck (quali campi mostrare come "structure fields" nell'UI, verosimilmente per permessi ruolo) quanto lo schema che pilota la sicurezza lato backend. Essendo una copia manuale e non generata a build-time, **c'è rischio di drift futuro** se uno dei due file viene modificato senza l'altro — nessun meccanismo di sync automatico rilevato nello scan (nessuno script che copia/valida l'allineamento tra le due copie).

### Relazione primitives ↔ blocchi Puck
Ogni blocco Puck **wrappa** la primitive corrispondente esponendone le varianti come `fields` editabili. I blocchi `Box/Grid/Columns/Spacer/Hero` sono specifici del page-building e non hanno una primitive 1:1 in `@penpot-ds/primitives`.

### `puck-tokens.ts` — ponte token → controlli Puck
Deriva da `@penpot-ds/tokens`: `gapOptions`, `paddingOptions` (= spacing + opzione "None"), enum Zod (`spacingEnum`, `spacingOrNoneEnum`, `radiiEnum`), class-map Tailwind (`gapClass`, ecc.). Una modifica ai token spacing/radii propaga automaticamente sia agli stili sia ai menu a tendina dei blocchi.

### Altro nella cartella
`src/__poc__/` — proof-of-concept per round-trip payload Puck (fixture JSON, script `.mjs`, storia dedicata), non parte della libreria pubblica.

---

## `@penpot-ds/ui` (6 composizioni) — package NUOVO, non documentato in precedenza

Introdotto dopo il censimento di inizio giugno 2026 (`component-audit-epic3.md`, sezione C, lo prevedeva come lavoro delle story 3.3/3.5). Stack: React 19, dipende **solo** da `@penpot-ds/primitives` + `@penpot-ds/tokens` (workspace) — nessuna dipendenza Radix diretta, nessuna logica applicativa/store. Stesso setup di test/build di `primitives` (vitest, storybook, tsup). Tutte le composizioni sono in `src/compositions/<nome>/` con `Component.tsx` + `.stories.tsx` + `.test.tsx` + `index.ts`, riesportate dal barrel `src/index.ts`.

| Composizione | Props principali | Primitive/composizioni usate | Scopo |
|-------------|-------------------|-------------------------------|-------|
| `LifecycleBadge` | `status: 'DRAFT'\|'PUBLISHED'\|'ARCHIVED'` | `cn` (styling diretto, no primitive di data-display) | Badge di stato pagina con etichette IT ("Bozza"/"Pubblicata"/"Archiviata") mappate a `feedback.*` token |
| `SaveStateIndicator` | `state: 'saved'\|'unsaved'` | `cn` + icone SVG inline | Indicatore autosave con `aria-live="polite"`, testo "Salvato"/"Modifiche non salvate" |
| `TopBar` | `items: NavItem[]`, `status`, `onSave`, `onPreview`, `onPublish`, `isSaving` | `Breadcrumb*`, `Button`, `LifecycleBadge` | Barra editor con breadcrumb, stato lifecycle e azioni Salva/Anteprima/Pubblica |
| `EmptyState` | `heading`, `description?`, `actionLabel?`, `onAction?` | `Button` | Stato vuoto generico riusato da `PageList`/`VersionList` |
| `PageList` | `pages: PageListItem[]`, `onEdit?`, `onArchive?`, `onCreatePage?` | `Table*`, `Dropdown*`, `Button`, `LifecycleBadge`, `EmptyState` | Tabella pagine con menu azioni (Modifica/Archivia) e stato vuoto |
| `VersionList` | `versions: VersionListItem[]`, `onRestore?` | `Card`, `CardContent`, `Separator`, `Button`, `LifecycleBadge`, `EmptyState` | Elenco versioni/revisioni pagina con ripristino |

Queste composizioni corrispondono 1:1 alle previsioni della sezione C di `component-audit-epic3.md` (story 3.3 → LifecycleBadge/TopBar/SaveStateIndicator; story 3.5 → PageList/VersionList/EmptyState), coerenti anche con i nomi dei commit recenti ("implement PageList and PageEditor components... story 4.2/4.3").

### Consumo da parte di `apps/pagebuilder` — **non ancora integrato**
Verifica nello scan: **nessun file sotto `apps/`** importa `@penpot-ds/ui`. In particolare `apps/pagebuilder/src/main/webapp/app/pagebuilder/pages/PageListPage.tsx` (la pagina che per nome/scopo dovrebbe usare `PageList`) importa invece componenti `react-bootstrap` (`Alert, Button, Dropdown, Form, Modal, Spinner, Table`) e non referenzia affatto `@penpot-ds/ui`. Il frontend `pagebuilder` (JHipster/React-Bootstrap) e il design system (`@penpot-ds/*`) risultano al momento **due stack UI paralleli non ancora convergenti** — la libreria compositions esiste ed è testata/documentata via Storybook ma non è ancora cablata nell'app reale.

---

## Riepilogo conteggi

| Package | Componenti/blocchi | Stato |
|---------|---------------------|-------|
| `@penpot-ds/primitives` | 28 directory (25 esportate pubblicamente) | Copertura Epic 3.2/3.4 completata (Dialog, Toast, Breadcrumb, Drawer, Table, Tabs, Dropdown tutti presenti) |
| `@penpot-ds/puck-components` | 20 blocchi Puck | invariato nel conteggio ma con Carousel aggiunto e non censito prima |
| `@penpot-ds/ui` | 6 composizioni | package nuovo, mai documentato; non ancora consumato da `apps/pagebuilder` |
