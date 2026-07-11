# Component Audit — Epic 3

> Censimento componenti per la pianificazione di Epic 3.
> Tema attivo: **Blu mare** — tutti i token fanno riferimento a questo tema.

---

## Sezione A — Primitive esistenti in `@penpot-ds/primitives`

19 componenti (inclusi 3 utility layout custom senza story).

| Componente | Dominio | Export pubblici | Base | Naming Penpot ↔ codice | Token usati |
|-----------|---------|-----------------|------|------------------------|-------------|
| Badge | `data-display` | `Badge`, `badgeVariants`, `BadgeProps` | CVA | ✅ 1:1 | `feedback.color.*`, `mis.color.*`, `mis.radius.*` |
| Card | `data-display` | `Card`, `CardImage`, `CardContent`, `CardTitle`, `CardDescription`, `cardVariants`, `CardProps` | CVA | ✅ 1:1 | `mis.color.*`, `mis.radius.*` |
| Typography | `data-display` | `Typography`, `typographyVariants`, `TypographyProps` | CVA | ✅ 1:1 | `mis.typography.*` |
| Carousel | `data-display` | `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`, `CarouselDots`, `useCarousel`, `CarouselApi`, `CarouselProps` | embla-carousel-react | ✅ 1:1 | `mis.color.*` |
| Button | `inputs` | `Button`, `buttonVariants`, `ButtonProps` | CVA | ✅ 1:1 | `mis.color.*`, `mis.typography.*`, `mis.radius.*` |
| Input | `inputs` | `Input`, `inputVariants`, `InputProps` | CVA | ✅ 1:1 | `mis.color.*`, `border.width.*` |
| Select | `inputs` | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, `SelectProps`, `SelectOption`, `SelectTriggerProps` | `@radix-ui/react-select` | ✅ 1:1 | `mis.color.*` |
| Checkbox | `inputs` | `Checkbox`, `CheckboxProps` | `@radix-ui/react-checkbox` | ✅ 1:1 | `mis.color.*` |
| Switch | `inputs` | `Switch`, `SwitchProps` | `@radix-ui/react-switch` | ✅ 1:1 | `mis.color.*` |
| Accordion | `layout` | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `AccordionProps` | `@radix-ui/react-accordion` | ✅ 1:1 | `mis.color.*` |
| Collapsible | `layout` | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | `@radix-ui/react-collapsible` | ✅ 1:1 | `mis.color.*` |
| ScrollArea | `layout` | `ScrollArea`, `ScrollBar` | `@radix-ui/react-scroll-area` | ✅ 1:1 | `mis.color.*` |
| Separator | `layout` | `Separator` | `@radix-ui/react-separator` | ✅ 1:1 | `mis.color.*` |
| AspectRatio | `layout` | `AspectRatio` | `@radix-ui/react-aspect-ratio` | ✅ 1:1 | — |
| Flex | `layout` | `Flex`, `FlexProps` | custom | ✅ 1:1 | — |
| Row | `layout` | `Row`, `RowProps` | custom | ✅ 1:1 | — |
| Col | `layout` | `Col`, `ColProps` | custom | ✅ 1:1 | — |
| Alert | `feedback` | `Alert`, `AlertIcon`, `AlertContent`, `AlertTitle`, `AlertDescription`, `alertVariants`, `AlertProps`, `AlertStatus` | CVA | ✅ 1:1 | `feedback.color.*` |
| Tooltip | `overlays` | `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent` | `@radix-ui/react-tooltip` | ✅ 1:1 | `mis.color.*` |

> **Nota**: `Column`, `Section`, `Stack` esistono in `layout` ma non hanno story né export pubblico dedicato — non censiti come primitives complete.

---

## Sezione B — Primitive da modellare ex-novo (Epic 3.2 e 3.4)

7 primitive mancanti. **Non** aggiungere le dipendenze Radix in questa story (3.1) — lo fa la story di competenza.

| Primitiva | Strategia di implementazione | Package Radix da aggiungere a `primitives/package.json` | Story |
|-----------|-----------------------------|---------------------------------------------------------|-------|
| Dialog | Radix headless — `@radix-ui/react-dialog` come root, wrapper CVA per varianti overlay/modal | `@radix-ui/react-dialog` | 3.2 |
| Toast | Radix headless — `@radix-ui/react-toast` con `aria-live` implicito in Radix | `@radix-ui/react-toast` | 3.2 |
| Breadcrumb | Custom headless — `<nav aria-label>` + `<ol>` con `aria-current="page"` sull'ultimo item; nessuna dep Radix aggiuntiva | — (no Radix) | 3.2 |
| Drawer/SidePanel | `@radix-ui/react-dialog` riutilizzato in modalità non-modale (side panel), oppure custom headless se serve scroll indipendente | `@radix-ui/react-dialog` (già in 3.2) | 3.4 |
| Table | Custom headless — semantica tabellare nativa `<table>/<thead>/<tbody>/<tr>/<th>/<td>`; pattern TanStack-style per sorting/pagination | — (no Radix) | 3.4 |
| Tabs | Radix headless — `@radix-ui/react-tabs` con `role="tablist"/"tab"/"tabpanel"` ARIA nativi | `@radix-ui/react-tabs` | 3.4 |
| Dropdown/Menu | Radix headless — `@radix-ui/react-dropdown-menu` con `role="menu"/"menuitem"` ARIA nativi | `@radix-ui/react-dropdown-menu` | 3.4 |

---

## Sezione C — Composizioni `@penpot-ds/ui` da costruire in 3.3 e 3.5

6 composizioni con semantica specifica dell'editor page-builder.

| Composizione | Primitive `@penpot-ds/primitives` che usa | Story |
|-------------|------------------------------------------|-------|
| lifecycle-Badge | Badge | 3.3 |
| TopBar/Toolbar | Breadcrumb + lifecycle-Badge + Button | 3.3 |
| SaveStateIndicator | Typography | 3.3 |
| PageList | Table + lifecycle-Badge + Dropdown | 3.5 |
| VersionList | Card + Separator + lifecycle-Badge | 3.5 |
| EmptyState | Typography + Button | 3.5 |

---

## Sezione D — Verifica conformità componenti esistenti

- [x] **Naming 1:1 rispettato**: tutti i 19 componenti censiti in Sezione A hanno un corrispondente naming 1:1 tra Penpot design e codice `@penpot-ds/primitives`. Nessuna discrepanza rilevata.
- [x] **Zero valori hardcoded**: tutti i componenti usano esclusivamente token semantici (`radix.*`, `mis.*`, `feedback.*`, `border.width.*`) via classi Tailwind generate da `@penpot-ds/tokens`. Confermato ispezionando i file sorgente — tema "Blu mare".
