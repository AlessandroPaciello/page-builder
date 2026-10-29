---
name: "Accessibility Review — DESIGN.md + EXPERIENCE.md"
description: "Audit WCAG 2.1 AA di EXPERIENCE.md e DESIGN.md rispetto a a11y-baseline.md, con findings per severità."
status: draft
updated: 2026-07-26
reviewer: "revisore accessibilità (agente)"
scope:
  - "_bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/DESIGN.md"
baseline: "_bmad-output/specs/spec-page-builder/a11y-baseline.md"
---

# Accessibility Review — Page Builder UX (DESIGN.md + EXPERIENCE.md)

## Verdetto generale

**CONDIZIONATO — non pronto per l'implementazione così com'è.**

L'eredità testuale della baseline è corretta e ben referenziata in entrambi i documenti (§Accessibility Floor di EXPERIENCE.md cita puntualmente ognuna delle 5 regole della baseline; DESIGN.md rispetta "stato = testo + colore" nel design dei token e degli stati lifecycle). Il problema non è l'assenza di intenzione, ma la **profondità insufficiente su esattamente i due punti più difficili di questo prodotto**: (1) l'operabilità da tastiera del canvas drag-and-drop, marcata `[ASSUMPTION]` e lasciata a un livello di specificità troppo basso per essere implementabile senza reinterpretazione in fase di build, e (2) il contrasto colore, lasciato come placeholder puro senza nemmeno un vincolo numerico minimo dichiarato — il che rende impossibile validare in fase di design review se una palette proposta rispetta AA prima che arrivi il codice.

Ci sono inoltre lacune non discusse per niente: supporto screen reader per il canvas (oltre alla tastiera — sono due problemi distinti e il documento tratta solo il primo), l'esperienza in screen reader dell'errore RBAC per il Cliente (il flusso di Giulia lo ignora del tutto, e il "State Patterns" lo tratta solo a livello di "messaggio comprensibile" senza annunciarlo), e mobile a11y specifica (touch target size, zoom/pinch, orientamento) nel render pubblico responsive nonostante Luca sia uno dei quattro Key Flow.

Nessuno di questi è un difetto strutturale del design — sono tutti colmabili senza riscrivere l'architettura dei documenti — ma vanno chiusi prima che Epic/Story derivate da questi documenti (in particolare quelle sull'editor drag-and-drop e sul render pubblico) vengano stimate e implementate, altrimenti il team di sviluppo inventerà la soluzione ad-hoc in corsa, con alto rischio di dover rifare il lavoro su NFR1/WCAG a valle.

---

## Findings

### CRITICAL

**C1 — Drag-and-drop keyboard equivalent: specificato come esigenza, non come meccanismo**
- **Locazione:** EXPERIENCE.md, §Interaction Primitives, riga "Drag-and-drop editor" (`[ASSUMPTION: ... Da validare con team a11y]`); ripreso in §Accessibility Floor come `[ASSUMPTION aggiuntiva]`.
- **Problema:** il documento dice correttamente *che* serve un percorso non-mouse per riordinare/comporre blocchi, ma non dice *come*. Manca completamente: (a) quale meta-modello di interazione si usa — "grab mode" stile WAI-ARIA APG drag-and-drop pattern (Spazio per afferrare, frecce per spostare, Spazio per rilasciare, Escape per annullare) vs. un menu contestuale "Sposta qui" vs. un pannello ad albero riordinabile via tastiera; (b) come questo interagisce col canvas Puck (che è una libreria specifica — Puck ha già un proprio modello di drag interno, quindi la keyboard-parity deve essere progettata *contro* quel modello, non in astratto); (c) come si comunica lo stato "sto trascinando/spostando" a un utente da tastiera (serve una live region dedicata, non coperta dalla baseline generica); (d) se l'equivalente vale anche per resize/nesting di blocchi contenitore (Grid/Columns/Section), non solo per riordino lineare.
- **Perché è critical:** questo è il flusso primario dell'editor (Key Flow di Marco, passo 3) ed è l'unica primitiva del documento marcata sia `[ASSUMPTION]` sia esplicitamente "da validare con team a11y" — cioè gli stessi autori segnalano incertezza sulla propria soluzione. Senza un meccanismo concreto, uno Story/Epic derivato da questo documento non ha criteri di accettazione testabili per NFR1, e rischia di essere implementato come "aggiungiamo dopo" — pattern che nella pratica UX/dev spesso significa "non lo facciamo mai".
- **Fix suggerito:** aggiungere una sotto-sezione dedicata (in EXPERIENCE.md, non solo una riga) che specifichi il meta-modello (raccomandazione: WAI-ARIA APG "Reorder" pattern con grab-mode esplicito), lo stato annunciato via `aria-live`, i tasti (Spazio/Invio per afferrare, frecce per muovere tra slot/posizioni valide, Escape per annullare tornando alla posizione originale, Tab per uscire dal blocco senza spostarlo), e il comportamento per drop-target invalidi (es. non si può droppare un blocco Hero dentro un AddToCart). Marcare esplicitamente come requisito di Story, non solo di design doc, prima che l'Epic sull'editor venga stimata.

**C2 — Contrasto colore: nessun vincolo numerico dichiarato, solo placeholder**
- **Locazione:** DESIGN.md, frontmatter `colors:` (tutti i valori `#000000` con nota `[ASSUMPTION] Valori placeholder`) e §Colors.
- **Problema:** è ragionevole rimandare i valori esadecimali reali a Penpot (decisione già presa e documentata correttamente). Il problema è un altro: il documento non dichiara **il vincolo che quei valori dovranno rispettare**, cioè non c'è una riga tipo "testo normale ≥4.5:1, testo large-scale ≥3:1, componenti UI/stati di focus ≥3:1 (WCAG 1.4.3 e 1.4.11)". Senza questo vincolo esplicito nel documento di design, quando Penpot fornirà i valori reali non c'è un criterio scritto contro cui validarli — la baseline (a11y-baseline.md §1) lo cita solo per il focus indicator, non per testo/UI in generale.
- **Perché è critical:** è un gate strutturale. Se questo vincolo non è scritto ora, la palette Penpot può arrivare e essere adottata "as-is" senza check di contrasto, e lo si scopre solo in QA o — peggio — in produzione su un prodotto e-commerce pubblico. È anche l'unico modo per rendere falsificabile il claim "WCAG 2.1 AA" del documento prima che esista codice.
- **Fix suggerito:** aggiungere in DESIGN.md §Colors una riga esplicita di vincolo (non di valore): "Ogni coppia foreground/background usata per testo deve rispettare ≥4.5:1 (testo normale) / ≥3:1 (testo ≥18pt o 14pt bold); ogni indicatore di stato UI (bordi, icone di stato, focus ring) ≥3:1 contro il background adiacente — vincolo WCAG 1.4.3/1.4.11, da verificare sui valori Penpot reali prima del merge, non dopo." Idealmente aggiungere anche una nota che i placeholder `#000000` uniformi nascondono momentaneamente violazioni ovvie (es. `text-primary` su `surface` entrambi neri sarebbe 1:1) — irrilevante ora ma va marcato per non essere scambiato per un valore "provvisoriamente valido".

### HIGH

**H1 — Nessuna menzione di screen reader per il canvas drag-and-drop (oltre alla tastiera)**
- **Locazione:** EXPERIENCE.md, §Interaction Primitives + §Accessibility Floor — l'unico riferimento è "equivalente da tastiera", che copre operabilità motoria ma non l'esposizione semantica per screen reader.
- **Problema:** un canvas drag-and-drop denso (pannello blocchi + canvas + proprietà, la griglia a 3 colonne di DESIGN.md §Layout & Spacing) è notoriamente uno dei pattern più difficili da rendere leggibile con screen reader: struttura ad albero annidata (Section > Columns > blocchi), stato di selezione, posizione corrente nell'ordine, quali drop-target sono validi. "Un percorso da tastiera" risolve l'operabilità motoria (mouse-free) ma non garantisce che uno screen reader annunci correttamente cosa sta succedendo — sono due assi ortogonali della stessa area a rischio, e il documento ne tratta esplicitamente solo uno.
- **Perché è high (non critical):** è un'estensione dello stesso problema di C1, quindi parzialmente mitigato se C1 viene risolto bene (un buon meta-modello ARIA APG include già annunci screen-reader), ma va reso esplicito perché altrimenti un'implementazione potrebbe soddisfare "tab-navigabile" senza soddisfare "leggibile da NVDA/VoiceOver".
- **Fix suggerito:** nella stessa sotto-sezione richiesta in C1, aggiungere esplicitamente: struttura del canvas esposta come `role="tree"`/`treeitem` o `application` con `aria-label` di posizione ("Hero, blocco 1 di 3, dentro Section"), live region che annuncia afferra/sposta/rilascia, e un test esplicito con almeno uno screen reader reale (non solo axe automatico) come criterio di accettazione per l'Epic editor.

**H2 — Errore RBAC per il Cliente: nessuna considerazione screen reader / focus da tastiera**
- **Locazione:** EXPERIENCE.md, §State Patterns → "Errori di permesso"; Key Flow di Giulia (nessun passo tratta un tentativo fuori-scope).
- **Problema:** il testo dice "l'errore server-side deve tradursi in un messaggio comprensibile, non in una schermata rotta" — corretto ma generico. Non specifica: se l'azione tentata via URL diretto produce un redirect, un messaggio inline, o un toast; se è annunciato via `aria-live` (dovrebbe essere `assertive`, coerente con baseline §4, ma non è collegato esplicitamente); dove va il focus dopo l'errore (se la pagina cambia layout, un utente da tastiera/screen reader può perdere completamente il contesto). Questo è esattamente il tipo di caso limite RBAC che un audit reale segnala perché normalmente viene implementato come afterthought.
- **Perché è high:** impatta un utente reale (Cliente, non tecnico — quindi meno probabile che riesca a recuperare da un errore ambiguo) e tocca sia RBAC sia a11y contemporaneamente, area a rischio doppio.
- **Fix suggerito:** specificare in §State Patterns che l'errore RBAC via URL diretto usa `role="alert"`/`aria-live="assertive"` (coerente con baseline §4), e che il focus gestito è portato esplicitamente sul messaggio d'errore (non lasciato al default del browser). Aggiungere un passo esplicito al Key Flow di Giulia o una nota a margine che copra questo caso, dato che è l'unico Key Flow con un utente non tecnico.

**H3 — Nessuna considerazione di accessibilità mobile nel render pubblico responsive**
- **Locazione:** EXPERIENCE.md, §Responsive & Platform — copre solo breakpoint di layout/collasso dei blocchi Puck; Key Flow di Luca non menziona nulla di specifico.
- **Problema:** WCAG 2.1 AA include criteri mobile-rilevanti che il documento non tocca affatto: 2.5.5 Target Size (AAA in 2.1, ma diventa AA in 2.2 — comunque best practice consumer/commerce raccomandata ora, touch target ≥44×44px specialmente per "Aggiungi al carrello"), 1.4.10 Reflow (nessun scroll orizzontale a 320px width / zoom 400%), 1.4.4 Resize text (zoom testo fino al 200% senza rottura layout), e l'assenza di blocco orientamento (portrait-only lock) non è vietata esplicitamente. Dato che il prodotto è "consumer/e-commerce" e Luca è un Key Flow ufficiale, questa è un'area che un audit reale marcherebbe.
- **Perché è high:** il render pubblico è la superficie con più traffico reale (visitatori anonimi, non utenti interni formati) e l'unica a target multi-device — è dove il rischio commerciale/legale di non conformità è più concreto.
- **Fix suggerito:** aggiungere in §Responsive & Platform un sotto-paragrafo esplicito per il render pubblico: touch target minimo 44×44px per CTA commerce (AddToCart, filtri, navigazione), reflow senza scroll orizzontale fino a 320px, supporto zoom fino al 400% senza perdita di contenuto/funzionalità, nessun blocco di orientamento imposto salvo necessità essenziale.

### MEDIUM

**M1 — SaveStateIndicator: aria-live corretto ma manca gestione di annunci ripetuti/rumorosi**
- **Locazione:** EXPERIENCE.md, §Component Patterns — "SaveStateIndicator".
- **Problema:** la baseline richiede `aria-live="polite"`, e il documento lo eredita correttamente. Ma durante una sessione di 20 minuti con autosave su debounce (Key Flow Marco, passo 4), il pattern "Modifiche non salvate → Salvataggio… → Salvato" ripetuto molte volte può generare un flusso di annunci screen reader eccessivamente rumoroso ("chatty"), un problema di usabilità a11y reale e ben noto per gli editor con autosave.
- **Fix suggerito:** specificare che l'annuncio live è debounced/throttled indipendentemente dal debounce del salvataggio stesso (es. non annunciare "Salvataggio…" se dura <1s), o che solo le transizioni verso "Salvato" e verso "errore" sono annunciate, non lo stato intermedio a ogni battitura.

**M2 — Blocchi Puck in editing: outline di selezione/hover vs focus-visible — differenziazione dichiarata ma non specificata su come**
- **Locazione:** EXPERIENCE.md, §Component Patterns — "Blocchi Puck".
- **Problema:** il documento dice correttamente che devono essere "due segnali visivi diversi", ma non specifica come si distinguono (spessore, colore, stile tratteggiato/continuo) né come coesistono quando un blocco è sia selezionato sia a fuoco da tastiera contemporaneamente (caso comune nell'editor). Senza indicazione minima, il rischio è che in implementazione i due stati collassino visivamente nello stesso outline, violando l'intento della regola.
- **Fix suggerito:** aggiungere in DESIGN.md (non solo EXPERIENCE.md) una nota visiva minima: es. selezione = bordo continuo colore primary; focus-visible da tastiera = ring esterno offset, sempre visibile anche quando il blocco è già selezionato (i due stati si sommano, non si sostituiscono).

**M3 — Provider commerce irraggiungibile / prodotto rimosso: stato di errore non specificato per screen reader**
- **Locazione:** EXPERIENCE.md, §Component Patterns "Blocchi commerce" e §State Patterns "Provider commerce irraggiungibile".
- **Problema:** si specifica correttamente che deve esserci "uno stato di errore esplicito" (non un vuoto silenzioso) sia in editor sia in pubblicazione, coerente col principio testo+colore. Ma non è chiaro se questo stato in pagina pubblicata (non solo in editor) è annunciato in qualche modo per un visitatore che usa screen reader — un blocco ProductGrid con un prodotto silenziosamente sostituito da un placeholder è un caso limite plausibile per Luca.
- **Fix suggerito:** chiarire che anche nel render pubblico il fallback del blocco commerce ha testo alternativo/aria-label descrittivo (es. "Prodotto non più disponibile"), non solo un'indicazione visiva.

### LOW

**L1 — Griglia editor a 3 colonne fisse: nessuna menzione di come naviga da tastiera tra le tre regioni**
- **Locazione:** DESIGN.md, §Layout & Spacing ("griglia a 3 colonne fisse... [ASSUMPTION], da validare con un wireframe").
- **Problema:** un layout denso a tre pannelli (blocchi/canvas/proprietà) beneficia tipicamente di landmark ARIA (`role="region"` con `aria-label`) e/o skip-link per saltare tra pannelli via tastiera, altrimenti un utente da tastiera deve tabbare attraverso l'intero pannello blocchi prima di raggiungere il canvas ogni volta. Non è nella baseline e non è menzionato.
- **Fix suggerito:** aggiungere una nota che i tre pannelli sono landmark ARIA distinti con possibilità di salto rapido (skip-link o scorciatoia), da specificare quando il wireframe sarà disponibile.

**L2 — Target WCAG 2.1 AA trattato come "fermo" mentre la fonte lo marca "da confermare" — rischio di scope creep silenzioso**
- **Locazione:** EXPERIENCE.md §Accessibility Floor: "qui trattato come requisito fermo salvo diversa indicazione"; a11y-baseline.md riga 3: "(da confermare, vedi Open Question in SPEC.md)".
- **Problema:** non è un errore di per sé — è ragionevole trattare AA come baseline di lavoro per non bloccare il progetto — ma la open question a monte non è ancora chiusa formalmente, e EXPERIENCE.md la upgrada silenziosamente a requisito fermo senza segnalare che questo introduce lavoro concreto (C1, C2, H1-H3 sopra) che potrebbe non essere stato budgetato se l'open question in SPEC.md si risolvesse diversamente (es. AA parziale o solo linee guida interne).
- **Fix suggerito:** nessun cambio di contenuto necessario, ma raccomandare che la Open Question in SPEC.md venga chiusa esplicitamente (conferma AA) prima che gli Epic/Story sull'editor e sul render pubblico vengano stimati, dato che C1/C2/H1/H3 rappresentano lavoro di implementazione non banale che dipende proprio da questa conferma.

---

## Riepilogo copertura baseline (punto 1 della richiesta)

| Regola baseline | Ereditata in EXPERIENCE.md? | Ereditata in DESIGN.md? | Note |
|---|---|---|---|
| 1. Focus visibile | Sì (§Accessibility Floor) | Implicito (nessun valore contrasto concreto — vedi C2) | Il vincolo ≥3:1 del focus ring non ha un valore verificabile finché i colori sono placeholder |
| 2. Stato = testo + colore | Sì, esteso a lifecycle e blocchi Puck | Sì (§Colors, §Do's and Don'ts) | Ben coperto, coerente su entrambi i documenti |
| 3. ARIA per tipo componente | Sì (citata come lista) | N/A (non nel dominio di DESIGN.md) | Corretto per riferimento, ma nessun componente concreto del catalogo (TopBar, SaveStateIndicator, ecc.) è mappato esplicitamente al tipo ARIA giusto — è lasciato implicito |
| 4. aria-live regions | Sì, con esempio concreto (SaveStateIndicator) | N/A | Buona applicazione concreta, vedi M1 per raffinamento |
| 5. Portale condiviso overlay | Sì (Focus management overlay) | Sì (§Elevation & Depth, esplicito) | Ben coperto su entrambi |

Nessun buco di eredità testuale della baseline stessa: i 5 punti sono tutti citati e generalmente applicati bene alle aree che la baseline già copriva (dialog, toast, lifecycle badge). I problemi reali stanno tutti **fuori dal perimetro della baseline** — nelle aree che la baseline non tratta perché troppo generiche (drag-and-drop, contrasto numerico, mobile, screen reader per widget custom) — che è esattamente il punto 2-3 della richiesta di review.

---

## Conteggio finding

- Critical: 2
- High: 3
- Medium: 3
- Low: 2
- **Totale: 10**
