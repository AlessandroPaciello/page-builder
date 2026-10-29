# Validation Report — page-builder

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/EXPERIENCE.md`
- **Run at:** 2026-07-26T00:00:00Z

## Overall verdict

DESIGN.md/EXPERIENCE.md formano una bozza fast-path disciplinata: l'inheritance da SPEC/companion/architecture è pulita, la numerazione delle capability e i termini di glossario sono usati correttamente, e la politica dei token placeholder è tracciata in modo trasparente in frontmatter, prosa e `.memlog.md`. La coppia non è ancora contract-ready: mancano failure path nei Key Flow, un flow dedicato per CAP-10 (archive/restore), lo stato "slug non trovato" per il render pubblico, e DESIGN.md § Components è vuoto mentre EXPERIENCE.md § Component Patterns ha già contenuto comportamentale reale — asimmetria da colmare.

La revisione accessibilità aggiunge un secondo strato di rischio, più specifico: i cinque punti della a11y-baseline sono ereditati correttamente ovunque si applichino, ma sui **due problemi più difficili di questo prodotto** — operabilità da tastiera del canvas drag-and-drop e vincolo di contrasto colore — il documento si ferma a "serve, ma non specifica come" (2 finding critical). A questi si aggiungono lacune del tutto assenti dal documento: supporto screen reader per il canvas oltre alla tastiera, gestione a11y dell'errore RBAC per il Cliente, e accessibilità mobile (touch target, reflow, zoom) nel render pubblico responsive, nonostante Luca sia un Key Flow ufficiale e il prodotto sia dichiaratamente consumer/e-commerce.

Nessuno dei problemi trovati è strutturale — sono tutti colmabili con un giro di Update mirato, non una riscrittura — ma **C1 e C2 (accessibilità) vanno chiusi prima che le Epic 3/4 (blocchi editor, drag-and-drop) vengano stimate**, per non lasciare che il team implementi una soluzione ad-hoc senza criteri di accettazione testabili su NFR1.

## Category verdicts

- Flow coverage — **partial**
- Token completeness — **acceptable con caveat**
- Component coverage — **weak**
- State coverage — **mostly strong**
- Visual reference coverage — **n/a / strong by absence**
- Bloat & overspecification — **strong**
- Inheritance discipline — **strong**
- Shape fit — **mostly correct**

## Findings by severity

### Critical (2)

**Accessibility** — C1: Drag-and-drop keyboard equivalent specificato come esigenza, non come meccanismo (EXPERIENCE.md § Interaction Primitives / § Accessibility Floor)
Manca il meta-modello concreto (es. WAI-ARIA APG "Reorder" pattern con grab-mode), lo stato annunciato via aria-live, e il comportamento per drop-target invalidi. È il flusso primario dell'editor (Key Flow Marco, passo 3) e gli stessi autori lo segnalano come incerto.
Fix: aggiungere una sotto-sezione dedicata con meta-modello, tasti (Spazio/Invio/frecce/Escape/Tab), live region, e comportamento drop-target invalidi; trattarlo come requisito di Story prima di stimare l'Epic editor.

**Accessibility** — C2: Contrasto colore senza vincolo numerico dichiarato, solo placeholder (DESIGN.md § Colors)
È corretto rimandare i valori esadecimali a Penpot, ma manca la riga di vincolo (≥4.5:1 testo normale / ≥3:1 UI e testo large) contro cui validare i valori reali quando arriveranno.
Fix: aggiungere in DESIGN.md § Colors il vincolo esplicito WCAG 1.4.3/1.4.11, da verificare sui valori Penpot reali prima del merge.

### High (7)

**Rubric — Flow coverage** — Nessun Key Flow dramatizza CAP-10 (archive/restore) (EXPERIENCE.md § Key Flows)
Fix: aggiungere un 5° flow o estendere quello di Sara con un passo di archiviazione.

**Rubric — Flow coverage** — Nessun Key Flow include un'annotazione `Failure:`, a differenza degli esempi di riferimento (EXPERIENCE.md § Key Flows)
Fix: aggiungere una riga di fallimento per flow (dialog annullato, azione non autorizzata via URL diretto, rollback con una sola versione, slug non trovato).

**Rubric — Component coverage** — DESIGN.md § Components ha zero righe per-componente, asimmetrico rispetto a EXPERIENCE.md § Component Patterns (DESIGN.md § Components)
Fix: aggiungere righe strutturali placeholder per i 5 componenti-chiave (TopBar, PageList, VersionList, LifecycleBadge, SaveStateIndicator).

**Rubric — State coverage** — `/[slug]` non ha uno stato "non trovato" documentato, né per slug inesistente né per pagina ARCHIVED (EXPERIENCE.md § State Patterns / Key Flow Luca)
Fix: aggiungere uno stato 404/unavailable per il render pubblico.

**Accessibility** — H1: Nessuna menzione di screen reader per il canvas drag-and-drop, oltre alla tastiera (EXPERIENCE.md § Interaction Primitives / § Accessibility Floor)
Fix: specificare struttura ad albero ARIA (`role="tree"/"treeitem"`), live region afferra/sposta/rilascia, e test con screen reader reale come criterio di accettazione.

**Accessibility** — H2: Errore RBAC per il Cliente senza considerazione screen reader/focus da tastiera (EXPERIENCE.md § State Patterns / Key Flow Giulia)
Fix: specificare `role="alert"`/`aria-live="assertive"` e gestione esplicita del focus sul messaggio d'errore.

**Accessibility** — H3: Nessuna considerazione di accessibilità mobile nel render pubblico responsive (EXPERIENCE.md § Responsive & Platform)
Fix: aggiungere touch target ≥44×44px per CTA commerce, reflow senza scroll orizzontale a 320px, supporto zoom 400%, nessun blocco orientamento imposto.

### Medium (7)

**Rubric — Flow coverage** — Fallback commerce (provider irraggiungibile/prodotto rimosso) auto-flaggato come gap ma il flow di Luca mostra solo l'happy path (EXPERIENCE.md, Key Flow Luca)
Fix: aggiungere il ramo di fallback al flow di Luca.

**Rubric — Token completeness** — Disciplina placeholder incoerente tra categorie di token: `colors` usa un sentinel uniforme inequivocabile, `rounded`/`spacing`/`typography` portano valori plausibili segnalati solo da commento YAML (DESIGN.md frontmatter)
Fix: applicare lo stesso sentinel "ovviamente falso" a tutte le categorie di token, o marcare l'assumption per-chiave.

**Rubric — Component coverage** — LifecycleBadge nominato come componente-chiave ma senza riga dedicata in EXPERIENCE.md § Component Patterns (EXPERIENCE.md § Component Patterns)
Fix: promuovere LifecycleBadge a riga propria.

**Rubric — State coverage** — `/login` senza stato di fallimento documentato (EXPERIENCE.md § Information Architecture / § State Patterns)
Fix: aggiungere una riga o una nota esplicita di deferral all'auth provider scelto in architettura.

**Rubric — Shape fit** — In EXPERIENCE.md, "Key Flows" precede "Responsive & Platform" invece del contrario, come negli esempi di riferimento (EXPERIENCE.md, ordine sezioni)
Fix: spostare "Responsive & Platform" subito dopo "Accessibility Floor", prima di "Key Flows".

**Accessibility** — M1: SaveStateIndicator, aria-live corretto ma manca gestione di annunci ripetuti/rumorosi durante autosave (EXPERIENCE.md § Component Patterns)
Fix: throttle degli annunci live indipendente dal debounce di salvataggio.

**Accessibility** — M2: Differenziazione selezione vs focus-visible sui blocchi Puck dichiarata ma non specificata visivamente (EXPERIENCE.md § Component Patterns; DESIGN.md)
Fix: nota visiva minima in DESIGN.md — bordo continuo per selezione, ring esterno offset per focus, sommabili non sostitutivi.

### Low (7)

**Rubric — Flow coverage** — CAP-5 (ui compositions) senza flow proprio, ma coperto strutturalmente e presente negli altri 4 flow — accettabile, solo nota.

**Rubric — Token completeness** — `components: {}` vuoto in frontmatter, coerente con la nota prosa, ma vedi Component coverage per il gap a valle.

**Rubric — Bloat** — La regola "stato = testo + colore" ripetuta quasi verbatim in 4 punti — giustificato per un vincolo a11y trasversale, ma valutare un riferimento incrociato invece della ripetizione.

**Rubric — Shape fit** — "Inspiration & Anti-patterns" omesso, accettabile ma non tracciato esplicitamente in `.memlog.md` come decisione.

**Accessibility** — L1: Griglia editor a 3 colonne senza indicazione di navigazione da tastiera tra le regioni (DESIGN.md § Layout & Spacing)
Fix: nota su landmark ARIA distinti/skip-link tra pannelli, da confermare col wireframe.

**Accessibility** — L2: Target WCAG 2.1 AA trattato come "fermo" in EXPERIENCE.md mentre la fonte lo marca ancora "da confermare" (EXPERIENCE.md § Accessibility Floor vs a11y-baseline.md)
Fix: nessun cambio di contenuto necessario, ma chiudere formalmente la Open Question in SPEC.md prima di stimare le Epic editor/render pubblico.

**Accessibility** — M3 (riclassificato Low per impatto limitato in questa fase): Stato di errore del blocco commerce non specificato per screen reader in pagina pubblicata (EXPERIENCE.md § Component Patterns / § State Patterns)
Fix: aria-label descrittivo anche nel render pubblico ("Prodotto non più disponibile"), non solo indicazione visiva.

## Reviewer files
- `review-rubric.md`
- `review-accessibility.md`
