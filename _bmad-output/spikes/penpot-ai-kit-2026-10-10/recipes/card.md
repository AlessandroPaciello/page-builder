# Ricetta: Card

- **Fonte:** registry shadcn, stile `base-nova` (Base UI) — `https://ui.shadcn.com/r/styles/base-nova/card.json`, file `registry/base-nova/ui/card.tsx`, scaricato il 2026-10-10. Confrontato con `new-york-v4` (stessa struttura, classi diverse).
- **Uso:** ricetta di partenza per componenti a scheda (es. ShopCard). Non è codice da copiare: è struttura + token da tradurre nei due contratti e nello scheletro Penpot.

## Asse dal sorgente

| Asse | Valori | Effetto nel sorgente |
|---|---|---|
| `size` | `default` · `sm` | `--card-spacing` 4 → 3; titolo `text-base` → `text-sm` |

## Parti

| Parte | `data-slot` | Elemento | Ruolo (nostro) | Classi sorgente rilevanti | Token / proprietà nostre |
|---|---|---|---|---|---|
| `root` | `card` | `div` | surface | `flex flex-col gap-(--card-spacing) py-(--card-spacing) rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 overflow-hidden` | `layoutDir: column`, gap e padding verticale `spacing.4` (sm: `spacing.3`), `radius.xl`, fill `color.card` |
| `header` | `card-header` | `div` | surface | `grid auto-rows-min items-start gap-1 px-(--card-spacing)` | colonna, gap `spacing.1`, padding orizzontale `spacing.4` (sm: `spacing.3`) |
| `title` | `card-title` | `div` | text | `text-base leading-snug font-medium` (sm: `text-sm`), `cn-font-heading` | `text.base` (sm: `text.sm`), `font-weight.medium`, fill `color.card-foreground` |
| `description` | `card-description` | `div` | text | `text-sm text-muted-foreground` | `text.sm`, fill `color.muted-foreground` |
| `action` | `card-action` | `div` | surface | posizionamento in griglia accanto a titolo/descrizione | — (vedi limiti) |
| `content` | `card-content` | `div` | surface | `px-(--card-spacing)` | padding orizzontale `spacing.4` (sm: `spacing.3`) |
| `footer` | `card-footer` | `div` | surface | `flex items-center p-(--card-spacing) border-t bg-muted/50 rounded-b-xl` | riga, `items-center`, padding `spacing.4` (sm: `spacing.3`), bordo superiore `color.border`, fill `color.muted` al 50% |

## Cosa non si traduce 1:1 (decisioni per chi specializza)

| Sorgente | Problema nel nostro modello |
|---|---|
| `ring-1 ring-foreground/10` | Colore con trasparenza: nessun token semantico equivalente nel seme (il più vicino è `color.border`) |
| `bg-muted/50` sul footer | Idem: serve un token con alpha o un'opacità di livello |
| `grid` nell'header e `card-action` | Il registro conosce solo il layout flex: l'azione in alto a destra va resa con flex + allineamento, o il registro deve imparare la griglia |
| `has-[>img:first-child]:pt-0`, `*:[img:first-child]:rounded-t-xl` | Stili condizionali sul contenuto: in Penpot si disegnano come celle diverse o come parte immagine esplicita |
| `overflow-hidden` | "Clip content" della board: non è nel registro |
| `leading-snug`, `cn-font-heading` | Interlinea e font del titolo: non ci sono token di line-height; il font di intestazione non è nel seme |
| `border-t` (solo lato superiore) | Il registro legge lo stroke della board intera, non un lato solo |
