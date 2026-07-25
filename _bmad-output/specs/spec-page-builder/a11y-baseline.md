# A11y baseline

Companion di [SPEC.md](./SPEC.md). Regole di accessibilità obbligatorie per ogni primitiva e composizione. Target: **WCAG 2.1 AA** (da confermare, vedi Open Question in SPEC.md).

## 1. Focus visibile

Ogni componente interattivo mostra un indicatore di focus visibile con contrasto ≥ 3:1 rispetto al background. **Regola assoluta:** mai rimuovere l'outline nativo senza un sostituto visibile equivalente (`focus-visible` ring o simile).

## 2. Stato = testo + colore

Ogni stato comunicato con il colore **deve** esserlo anche con testo (label, icona con `aria-label`, o testo `sr-only`). Mai colore da solo. Vale per i token di feedback (error/success/warning/info, ciascuno con la coppia colore + testo) e per lo stato lifecycle della pagina:

| Lifecycle | Etichetta obbligatoria |
|---|---|
| DRAFT | "Bozza" |
| PUBLISHED | "Pubblicata" |
| ARCHIVED | "Archiviata" |

## 3. ARIA per tipo di componente

Usare la semantica nativa corretta per ciascun tipo:
- **Dialog:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; focus trap mentre aperto; al close restituire il focus al trigger.
- **Toast:** `role="status"` + `aria-live="polite"` (info/success); `role="alert"` + `assertive` per errori bloccanti.
- **Table:** `<table>` nativo con `<caption>` (anche `sr-only`), `scope="col"`/`scope="row"`.
- **Tabs:** `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, navigazione con frecce.
- **Dropdown/Menu:** `aria-haspopup` + `aria-expanded` sul trigger, `role="menu"/"menuitem"`, `Escape` chiude e restituisce focus.
- **Breadcrumb:** `<nav aria-label>` + `<ol>`, `aria-current="page"` sull'elemento corrente.

## 4. Regioni aria-live

- **polite** (default): salvataggio riuscito, cambio stato lifecycle, operazioni di background, toast informativi.
- **assertive**: errori bloccanti (validazione form, errore API critico, azione non consentita) — l'utente deve essere interrotto per prevenire perdita di dati.

## 5. Portale condiviso per gli overlay

Dialog, Toast e Drawer/SidePanel si montano su un **nodo root DOM condiviso** aggiunto in cima al documento, così lo z-index resta sopra il canvas dell'editor senza conflitti di stacking context. Eccezione: il Tooltip usa il proprio portale senza conflitti rilevanti.
