# Ricetta — Carousel (shadcn `base`, v4)

Fonte: `shadcn-ui/ui` → `apps/v4/registry/bases/base/ui/carousel.tsx` (main, letto il 2026-10-11). Raccolta da `pds-design` [CN] per la simulazione del carousel.

## Parti

| Parte (`data-slot`) | Elemento | Classi della ricetta | Ruolo / a11y |
|---|---|---|---|
| `carousel` | `div` | `relative` | `role="region"`, `aria-roledescription="carousel"`, frecce da tastiera (`ArrowLeft`/`ArrowRight`, `onKeyDownCapture`) |
| `carousel-content` | `div` (finestra) + `div` (striscia) | finestra `overflow-hidden`; striscia `flex -ml-4` (orizzontale) / `-mt-4 flex-col` (verticale) | — |
| `carousel-item` | `div` | `min-w-0 shrink-0 grow-0 basis-full` + `pl-4` / `pt-4` | `role="group"`, `aria-roledescription="slide"` |
| `carousel-previous` | `Button` | `variant="outline" size="icon-sm"`, `absolute inset-y-0 -left-12 my-auto` | `disabled` al bordo, icona `ChevronLeft` + `<span class="sr-only">Previous slide</span>` |
| `carousel-next` | `Button` | come sopra, `-right-12` | icona `ChevronRight` + `sr-only` |

## Assi

| Asse | Valori | Effetto |
|---|---|---|
| `orientation` | `horizontal` \| `vertical` | asse di scorrimento, direzione della striscia, posizione delle frecce |

Quante slide si vedono non è un asse: lo decide `basis-*` sull'item (`basis-full`, `md:basis-1/2`, `lg:basis-1/3`) nel punto d'uso.

## Comportamento

`embla-carousel-react` (`useEmblaCarousel`, plugin opzionali), contesto React (`useCarousel`) con `scrollPrev`/`scrollNext`/`canScrollPrev`/`canScrollNext`, `setApi` per controllo esterno.

## Non traducibile in Penpot

- Lo scorrimento, il trascinamento, il loop e lo stato disabilitato ai bordi (si può disegnare solo un fotogramma: frecce attive o disattivate).
- Il numero di slide: in Penpot le slide disegnate sono **esempi**.
- `-ml-4`/`pl-4` (margine negativo che compensa lo spazio tra le slide): in Penpot diventa `gap` della striscia.
- Le frecce fuori dal contenitore (`-left-12`): in Penpot vanno dentro il board della cella, ai lati.

## Differenze dal progetto

- `embla-carousel-react` non è tra le dipendenze di `packages/ui`.
- Non esiste un componente `Button`: le frecce sono `Button` nella ricetta.
- `lucide-react` c'è (icone `ChevronLeft`/`ChevronRight`).
