---
name: "Page Builder Design System"
description: "Design system enterprise/e-commerce generato da Penpot: token → primitive accessibili → blocchi editor → composizioni di prodotto."
status: final
updated: 2026-07-26
sources:
  - "_bmad-output/specs/spec-page-builder/SPEC.md"
  - "_bmad-output/specs/spec-page-builder/design-system.md"
  - "_bmad-output/specs/spec-page-builder/a11y-baseline.md"
  - "_bmad-output/specs/spec-page-builder/penpot-pipeline.md"
  - "_bmad-output/specs/spec-page-builder/rbac-matrix.md"
  - "_bmad-output/specs/spec-page-builder/glossary.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md"
colors:
  # Estratti dal vivo dalla library Penpot reale (mis.color / feedback.color, set radix.color)
  # il 2026-09-06. Nomi Penpot tra parentesi dove il ruolo non è 1:1 col nome.
  primary: "#006C49" # color.mis.primary ({accent.9})
  surface: "#F3F3F4" # color.mis.background
  surface-raised: "#FFFFFF" # color.mis.surface_raised ({gray.surface})
  border: "#7A8F85" # color.mis.border ({gray.8}) — corretto in Penpot il 2026-09-06: {gray.6} (#BDCAC0) falliva ≥3:1 contro ogni superficie (1.5-1.7:1); {gray.8} passa (3.1-3.5:1)
  text-primary: "#1A1C1C" # color.mis.text ({gray.12})
  text-secondary: "#3E4942" # color.mis.text_muted ({gray.11})
  feedback-success: "#2e7d32" # color.feedback.success
  feedback-error: "#ba1a1a" # color.feedback.error
  feedback-warning: "#8f6c00" # color.feedback.warning
  feedback-info: "#0a4fa0" # color.feedback.info
typography:
  # font.mis.sans (Manrope) / font.mis.serif (Noto Serif) — mis.typography, estratto 2026-09-06.
  heading:
    fontFamily: "Manrope"
    fontWeight: 600 # fontWeight.mis.semibold
  body:
    fontFamily: "Manrope"
    fontWeight: 400 # fontWeight.mis.regular
  mono:
    note: "DEFERRED — nessun font.mis.mono nella library Penpot al 2026-09-06. Non blocca Story 2.1 (l'AC non richiede il ruolo mono); da aggiungere quando arriva la story che costruisce la UI Admin che lo usa (block-id, versionNumber)."
rounded:
  # mis.radius, estratto 2026-09-06.
  sm: "4px" # radius.mis.sm ({radix.radius.2})
  md: "8px" # radius.mis.md ({radix.radius.4})
  lg: "12px" # radius.mis.lg ({radix.radius.5})
  full: "9999px" # radius.mis.full ({radix.radius.full})
spacing:
  # radix.space, estratto 2026-09-06 — confermato 4px-based end-to-end.
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px" # space.5
  "8": "32px" # space.6
shadow:
  # mis.shadow, estratto 2026-09-06 — soddisfa AC#1 Story 2.1, nessuna estensione necessaria.
  raised: "0 1px 3px 0 rgba(26,28,28,0.12)" # shadow.mis.raised — pannelli/card
  overlay: "0 4px 12px 0 rgba(26,28,28,0.16), 0 1px 2px 0 rgba(26,28,28,0.10)" # shadow.mis.overlay — dialog/drawer
  toast: "0 8px 24px 0 rgba(26,28,28,0.20), 0 2px 4px 0 rgba(26,28,28,0.12)" # shadow.mis.toast — massimo, temporaneo
components: {}
---

> **Nota di stato.** Colori/tipografia/radii/spacing/ombre sono stati **validati contro la library Penpot reale il 2026-09-06** (sessione UX, via MCP `execute_code` su `penpot.library.local.tokens`), non più placeholder. Un difetto di contrasto (`border` sotto ≥3:1, NFR non negoziabile) è stato trovato e corretto direttamente in Penpot in quella sessione — vedi nota sul token `border` sopra. Restano extra non ancora ruoli documentati qui: `color.mis.text_subtle` (terzo livello di testo, sotto text-secondary — usare quando serve un livello "muted" più tenue, es. metadata/placeholder) e `color.mis.surface_soft`/`surface_tint`/`surface_warm` (varianti superficie oltre ai due ruoli base). Il ruolo `mono` resta deferred (vedi `typography.mono.note`).

## Brand & Style

Sistema enterprise/e-commerce **denso e professionale**, orientato a un utente power-user (Admin/Editor) che lavora su schermo largo per lunghe sessioni di composizione pagine — non un tool consumer-friendly minimalista. La densità informativa è una scelta deliberata: molte opzioni visibili contemporaneamente (pannelli struttura/proprietà/token), poche interazioni nascoste dietro menu.

Al tempo stesso il prodotto finale (le pagine pubblicate) è **consumer-facing e commerciale** (vetrina e-commerce): il tono editoriale delle pagine renderizzate non eredita la densità dello strumento di authoring — sono due registri distinti, condivisi solo a livello di token/primitive, non di layout.

[ASSUMPTION] Nessun riferimento di brand esterno (naming, tono verbale, moodboard) è stato fornito: la direzione "enterprise denso + vetrina commerciale pulita" è dedotta dalla scelta esplicita "Editor da desktop, denso e professionale" + stakes "consumer/commerciale". Da confermare/affinare quando la palette Penpot sarà disponibile.

## Colors

Struttura attesa (valori reali da Penpot):
- `primary` — azione principale (Salva/Pubblica in TopBar, CTA vetrina).
- `surface` / `surface-raised` — sfondo canvas vs pannelli/card sollevati (Elevation).
- `border` — separatori pannelli, contorni campo.
- `text-primary` / `text-secondary` — testo principale vs metadati (es. timestamp versione, autore).
- `feedback-{success,error,warning,info}` — usati anche per il badge lifecycle (DRAFT→info/neutro, PUBLISHED→success, ARCHIVED→secondary/muted); regola "mai solo colore" canonica in EXPERIENCE.md § Accessibility Floor.

**Vincolo di contrasto (non negoziabile, indipendente dai valori esatti):** ogni coppia foreground/background usata per testo deve rispettare **≥4.5:1** (testo normale) / **≥3:1** (testo ≥18pt o ≥14pt bold) — WCAG 1.4.3. Ogni indicatore di stato UI (bordi, icone di stato, focus ring) deve rispettare **≥3:1** contro lo sfondo adiacente — WCAG 1.4.11. Questo vincolo va verificato sui valori Penpot reali **prima del merge**, non dopo — i placeholder `#000000` uniformi qui sopra nascondono momentaneamente violazioni ovvie (es. `text-primary` su `surface` entrambi neri sarebbe 1:1) e non vanno letti come "provvisoriamente validi".

## Typography

[ASSUMPTION] Ramp a 2 famiglie: una per UI/editor (leggibilità a densità alta, pesi 400/500/600), una eventualmente distinta per il contenuto editoriale delle pagine pubblicate (blocco RichText/Typography) — da Penpot. Un ruolo `mono` è riservato a identificatori tecnici visibili solo all'Admin (block-id, version number) — mai esposto a Editor/Cliente in produzione normale.

## Layout & Spacing

Scala 4px-based (`spacing`) che pilota sia lo stile sia le opzioni dei campi Puck (spacing/radius) — vincolo esplicito da CAP-4: una modifica ai token si propaga sia agli stili sia ai menu dei blocchi. L'editor usa una griglia a 3 colonne fisse (struttura pagine / canvas / proprietà blocco) — [ASSUMPTION], da validare con un wireframe. Il render pubblico segue invece un layout fluido responsive (mobile/tablet/desktop), scollegato dalla griglia fissa dell'editor.

## Elevation & Depth

Gli overlay (Dialog, Toast, Drawer/SidePanel) si montano su un **portale root DOM condiviso** sopra il canvas (a11y-baseline.md #5), quindi la loro elevazione visiva deve leggersi chiaramente sopra qualunque contenuto del canvas stesso — ombra più pronunciata rispetto a card/pannelli in-canvas. [ASSUMPTION] 3 livelli: `raised` (pannelli/card), `overlay` (dialog/drawer), `toast` (massimo, temporaneo).

## Shapes

[ASSUMPTION] Radii contenuti (`sm`/`md` per controlli e input, `lg` per card/pannelli, `full` per badge/avatar) — coerente con un registro professionale/enterprise piuttosto che giocoso. Da confermare via Penpot.

## Components

Catalogo ereditato 1:1 da [design-system.md](../../../specs/spec-page-builder/design-system.md) (primitives + puck-components + ui). Valori numerici (colore/spacing esatti) restano pending su Penpot; le righe sotto fissano intanto anatomia/struttura visiva dei 5 componenti-chiave, da rifinire con valori reali ai mock di Finalize.

| Componente | Anatomia | Sizing/densità | Stati visivi |
|---|---|---|---|
| TopBar | breadcrumb + LifecycleBadge + gruppo azioni (Salva/Anteprima/Pubblica) su riga singola | altezza fissa, denso (coerente col registro editor) | azione disabilitata (non nascosta) quando fuori-permesso — stile "disabled" standard, mai rimossa dal DOM |
| LifecycleBadge | pill con icona/testo | `rounded.full`, padding compatto | 3 varianti: DRAFT→feedback-info, PUBLISHED→feedback-success, ARCHIVED→muted/secondary — sempre testo+colore, mai solo colore |
| SaveStateIndicator | icona di stato + testo breve | inline, accanto a TopBar | idle "Salvato" / in-corso "Salvataggio…" / errore "Non salvato" (feedback-error) |
| PageList | tabella densa con colonna azioni a menu | righe compatte, molte righe visibili senza scroll eccessivo | default / empty (illustrazione+CTA per Editor, messaggio neutro per Cliente) / riga in azione (es. archiviazione in corso) |
| VersionList | lista verticale con versione corrente evidenziata | badge posizione + timestamp + autore per riga | corrente (PUBLISHED, evidenziata) / storiche (DRAFT, azione rollback) / vuota (una sola versione, rollback disabilitato) |

Riferimenti visivi (mockup HTML, struttura/densità reali — colori ancora placeholder): [PageList](./mockups/key-pagelist.html), [Editor canvas con TopBar/blocchi Puck](./mockups/key-editor-canvas.html), [dialog di conferma](./mockups/key-publish-dialog.html), [storefront pubblico](./mockups/key-storefront.html). Su conflitto tra mock e questo file, questo file vince sempre.

## Do's and Don'ts

- **Do** derivare sempre le opzioni spacing/radius dei blocchi Puck dai token — mai valori hardcoded nel blocco.
- **Do** rispettare sempre "stato = testo + colore" (regola canonica in EXPERIENCE.md § Accessibility Floor) — nessuna eccezione per badge lifecycle o feedback.
- **Don't** introdurre una libreria UI parallela nel frontend applicativo — il vincolo SPEC è esplicito: il frontend consuma solo il design system generato (anti-pattern legacy da non ripetere).
- **Don't** editare a mano file marcati `@generated` — si rigenerano da Penpot.
