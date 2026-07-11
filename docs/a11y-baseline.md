# A11y Baseline — Design System Epic 3

> Regole di accessibilità comuni per tutti i componenti introdotti da Epic 3.
> Ogni nuova primitiva (`@penpot-ds/primitives`) e composizione (`@penpot-ds/ui`) deve rispettare questa baseline.
> Tema attivo: **Blu mare**.

---

## 1. Focus visibile

Ogni componente interattivo deve mostrare un indicatore di focus visibile che soddisfi WCAG 2.1 AA (rapporto contrasto ≥ 3:1 rispetto al background).

**Pattern standard** (ring utility — allineato al Button esistente):

```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-offset-2
focus-visible:ring-mis-primary
```

- `ring-2` corrisponde a `box-shadow` di 2px — allineato al token `border.width.thin` (`--border-width-thin: 2px`).
- `ring-mis-primary` usa il token `mis.primary` (`--color-mis-primary: var(--color-accent-9)`).
- `ring-offset-2` garantisce separazione visiva dal bordo del componente.

**Regola assoluta**: nessun `outline: none` o `focus:outline-none` senza sostituto visibile equivalente. Se si rimuove l'outline nativo del browser, aggiungere sempre `focus-visible:ring-*`.

---

## 2. Stato = testo + colore

Ogni stato comunicato visivamente tramite colore **deve** essere comunicato anche tramite testo (label, icona con aria-label, o testo nascosto con `sr-only`). Mai colore da solo.

### Token feedback — tabella stato → coppia colore + testo

| Stato | Token colore | Token "on" (testo sopra) | Token container | Token "on-container" |
|-------|-------------|--------------------------|-----------------|----------------------|
| Error | `feedback.error` → `--color-feedback-error: #ba1a1a` | `feedback.error-on` → `#ffffff` | `feedback.error-container` → `#ffdad6` | `feedback.error-on-container` → `#690005` |
| Success | `feedback.success` → `--color-feedback-success: #2e7d32` | `feedback.success-on` → `#ffffff` | `feedback.success-container` → `#b6f2bb` | `feedback.success-on-container` → `#002106` |
| Warning | `feedback.warning` → `--color-feedback-warning: #8f6c00` | `feedback.warning-on` → `#ffffff` | `feedback.warning-container` → `#ffdf9e` | `feedback.warning-on-container` → `#2a1800` |
| Info | `feedback.info` → `--color-feedback-info: #0a4fa0` | `feedback.info-on` → `#ffffff` | `feedback.info-container` → `#d4e3ff` | `feedback.info-on-container` → `#001b3d` |

### Lifecycle page-builder (lifecycle-Badge — Story 3.3)

| Stato lifecycle | Colore suggerito | Testo etichetta obbligatorio |
|----------------|-----------------|------------------------------|
| DRAFT | `feedback.warning-container` | "Bozza" |
| PUBLISHED | `feedback.success-container` | "Pubblicata" |
| ARCHIVED | `feedback.info-container` | "Archiviata" |

---

## 3. ARIA semantics per tipo di componente

### Dialog

```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Titolo del dialog</h2>
  <!-- contenuto -->
</div>
```

- `role="dialog"` + `aria-modal="true"` (indica che il contenuto esterno è inert).
- `aria-labelledby` punta all'`id` dell'heading visibile.
- Focus trap: il focus deve rimanere all'interno del dialog finché è aperto.
- Alla chiusura: restituire il focus all'elemento che ha aperto il dialog.

### Toast

```html
<div role="status" aria-live="polite" aria-atomic="true">
  <!-- messaggio del toast -->
</div>
```

- `role="status"` implica `aria-live="polite"` — usare `@radix-ui/react-toast` che lo gestisce nativamente.
- Per errori bloccanti usare `aria-live="assertive"` (vedi §4).

### Table

```html
<table>
  <caption>Descrizione della tabella (visibile o sr-only)</caption>
  <thead>
    <tr><th scope="col">Colonna</th></tr>
  </thead>
  <tbody>
    <tr><td>Dato</td></tr>
  </tbody>
</table>
```

- Semantica tabellare nativa HTML — nessun `role="table"` custom se si usa `<table>`.
- `<caption>` obbligatorio (anche con classe `sr-only` se non visibile).
- `scope="col"` sulle intestazioni di colonna; `scope="row"` per intestazioni di riga.

### Tabs

```html
<div role="tablist" aria-label="Sezione tabs">
  <button role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1">Tab 1</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2" id="tab-2">Tab 2</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1"><!-- contenuto --></div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden><!-- contenuto --></div>
```

- `@radix-ui/react-tabs` gestisce tutta questa struttura nativamente.
- Navigazione da tastiera: `ArrowLeft`/`ArrowRight` tra i tab, `Enter`/`Space` per attivare.

### Dropdown / Menu

```html
<button aria-haspopup="menu" aria-expanded="false" aria-controls="menu-id">Apri menu</button>
<ul role="menu" id="menu-id">
  <li role="menuitem">Voce 1</li>
  <li role="menuitem">Voce 2</li>
</ul>
```

- `@radix-ui/react-dropdown-menu` gestisce `role="menu"/"menuitem"` nativamente.
- Trigger: `aria-haspopup="menu"` + `aria-expanded` aggiornato dinamicamente.
- Chiusura: `Escape` chiude il menu e restituisce focus al trigger.

### Breadcrumb

```html
<nav aria-label="Percorso di navigazione">
  <ol>
    <li><a href="/pagine">Pagine</a></li>
    <li><a href="/pagine/123">Nome pagina</a></li>
    <li aria-current="page">Versione corrente</li>
  </ol>
</nav>
```

- `<nav aria-label="...">` come container root.
- `<ol>` per la lista ordinata degli step.
- `aria-current="page"` sull'ultimo elemento (quello corrente).

---

## 4. `aria-live` regions — polite vs assertive

| Tipo di evento | Strategia | Motivazione |
|----------------|-----------|-------------|
| Salvataggio riuscito, cambio stato lifecycle (DRAFT→PUBLISHED), operazioni di background completate | `aria-live="polite"` | Non interrompe il flusso — l'utente riceve la notifica al momento opportuno |
| Errori bloccanti (validazione form, errore API critico, azione non consentita) | `aria-live="assertive"` | L'utente deve essere interrotto immediatamente per prevenire perdita di dati |
| Toast informativi / success | `aria-live="polite"` (via `role="status"`) | Non bloccanti |
| Toast di errore critico | `aria-live="assertive"` (via `role="alert"`) | Bloccante |

**Regola pratica**: preferire sempre `polite` come default; usare `assertive` solo quando l'utente non può procedere senza leggere il messaggio.

---

## 5. Root portal condiviso — `<div id="penpot-ds-portal">`

Dialog, Toast, e Drawer/SidePanel devono montarsi su un nodo DOM condiviso aggiunto alla root del documento. Questo garantisce z-index sopra il canvas Puck senza conflitti con lo stacking context dei componenti.

### Regola di implementazione

```tsx
// Aggiungere alla root dell'app (es. main.tsx o App.tsx) prima del render:
if (!document.getElementById('penpot-ds-portal')) {
  const portal = document.createElement('div');
  portal.id = 'penpot-ds-portal';
  document.body.appendChild(portal);
}
```

### Utilizzo nei componenti

```tsx
import { createPortal } from 'react-dom';

function Dialog({ children, open }: DialogProps) {
  if (!open) return null;
  const portalRoot = document.getElementById('penpot-ds-portal');
  if (!portalRoot) return null;
  return createPortal(
    <div role="dialog" aria-modal="true">
      {children}
    </div>,
    portalRoot
  );
}
```

**Componenti soggetti a questa regola**: Dialog (Story 3.2), Toast (Story 3.2), Drawer/SidePanel (Story 3.4).

**Componenti esclusi**: Tooltip — usa il proprio portale Radix senza conflitti z-index rilevanti.
