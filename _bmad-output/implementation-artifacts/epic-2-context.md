# Epic 2 Context: Design system — token e componenti da Penpot

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Costruire il design system del page builder come output riproducibile della pipeline Penpot→codice. I token (colori/tipografia/spacing/radii/ombre) e i componenti React accessibili (`ui/domains`) non si scrivono a mano: si generano dal catalogo Penpot con il regime **contratto → fixture → ricetta → emitter**. Così sparisce il drift design↔codice, i valori di design arrivano da Penpot e l'editor e le composizioni delle epic successive hanno una libreria unica, accessibile e testata in Storybook. Prima della libreria dei sei domini la pipeline deve reggere un catalogo che cresce e un design che evolve, senza verdi finti, senza fedeltà persa in silenzio e senza CI tutto-o-niente. Deve anche usare il **contratto come riferimento dell'estrazione**, così quando il design se ne allontana la pipeline lo segnala e aiuta ad adattarlo. Il designer di riferimento non è tecnico e consegna il file Penpot finito o quasi: far passare la pipeline tocca allo sviluppatore. Il progetto non ha un PRD tradizionale: i requisiti vengono dallo SPEC e dalle sue companion.

## Stories

- Story 2.1: Pipeline token Penpot→codice
- Story 2.2: Estrazione componenti e schema delle ricette
- Story 2.3: Package dei contratti (Badge, Input, Accordion)
- Story 2.4: Bootstrap della library Penpot sui contratti
- Story 2.5: Estrazione adeguata — ricette per parti e token, validate contro il contratto
- Story 2.6: Emitter shadcn deterministico e gate CI
- Story 2.7: Pipeline pronta per più componenti
- Story 2.8: Registro delle proprietà e blocco per componente
- Story 2.9: Skill `pds-component` — creare e sincronizzare i componenti
- Story 2.10: Fedeltà live ed estrazione guidata dal contratto
- Story 2.11: Libreria componenti accessibile
- Story 2.12: Storybook del design system

## Requirements & Constraints

- **Token data-driven:** la generazione dipende dal **tipo** del token, mai dal nome del set, e un set Penpot nuovo produce una sezione nuova senza toccare il codice. Output: CSS custom properties (Tailwind v4 `@theme`) + scala TS per i controlli dell'editor, da una fixture committata (generazione offline). Le variabili senza corrispondenza Penpot vivono in un file separato non generato.
- **Ricette:** mappa di parti a profondità 1 con celle `proprietà → token` esistenti nel catalogo. Ogni **valore** (colore, misura, spessore, opacità, ombra) ha un token. Gli stili a **parola chiave** di una lista chiusa (es. tratteggio `solid`/`dashed`/`dotted`) sono ammessi senza token. Un literal fa fallire la validazione, una parte annidata con assi propri fa fallire lo schema e la geometria delle icone è ignorata.
- **Codice emesso:** `.tsx` + test + story + barrel per componente, marcati `@generated` con provenienza (`penpotComponentId` + `fixtureHash`). La rigenerazione dà diff zero e i file senza marker non si sovrascrivono mai. Ogni refactor della pipeline lascia l'output dei componenti esistenti byte-identico (`render:check` a diff zero).
- **Gate CI bloccanti:** completezza, rigenerazione diff-zero, a11y (vitest-axe + a11y baseline) e conformità al contratto. Il drift fixture vs Penpot live è bloccante se il runner raggiunge Penpot, altrimenti è manuale/nightly con il motivo nel log. `verify:library` e `gates:render` valutano **per componente**: un componente fuori regola rende rossa solo la sua voce, e i componenti **in attesa** sono visibili nel report di PR/CI. Ogni controllo nuovo ha una propria prova rosso/verde, e pass/fail sta negli script, mai nel prompt.
- **Mai una versione infedele in silenzio:** una proprietà o genera codice fedele o blocca il componente con un messaggio nominativo. Nessuno skip con solo log.
- **Contratto come riferimento (ruolo di parte):** una cella con un token su una proprietà che il ruolo della parte non ammette (es. `strokeColor` su un testo, anche al posto del `fill`) mette in attesa il solo componente. Il messaggio nomina componente, cella, parte, ruolo, proprietà e token, e propone l'adattamento in quest'ordine: il designer sposta il token; lo sviluppatore insegna la proprietà al ruolo (riga della tabella + mappatura + test rosso/verde, una volta per tutte); lo sviluppatore cambia il ruolo nel contratto (comando con diff e `--yes`, solo `SCHEMA_VERSION`).
- **Contrasto sui token live:** la regola del contrasto di `verify:library` misura **per componente** le coppie testo/icona × superficie che la contiene, cella per cella, sullo snapshot live di Penpot e non sui design committati. Le coppie di catalogo restano globali. Un design committato diverso da Penpot è un problema `design-drift` della voce: `pnpm sync:design -- <Comp>` stampa il diff e con `--yes` riscrive il design (tmp + rename), senza scrivere mai su Penpot.
- **A11y che non mente:** `role`/`aria-*` dichiarati nel giudizio arrivano nel `.tsx`, e il gate a11y fallisce se mancano. `a11y.role` può essere una mappa per un asse `option` (es. Alert: `status` per info/success, `alert` per warning/error). L'emitter lo emette per variante e il gate lo verifica su ogni variante. Una mappa su un asse `state`/`behavior`, o incompleta, è rifiutata dallo schema.
- **Attriti del file Penpot:** maiuscole, spazi e ordine degli assi li normalizza la pipeline. Un layer con un nome diverso dalla parte si lega tramite alias nel binding. Una cella mancante blocca il componente e si chiede al designer, mai inventata.
- **Crescita del catalogo:** design e liste si ricavano da `designs/*.design.json` e dal registry dei contratti, con un test di copertura design↔registry. Un field che si chiama come un attributo HTML globale è rifiutato.
- **Scritture su Penpot:** bootstrap una tantum (rifiuta se la library esiste), poi solo additivo con `addCell` e guardia anti-duplicato. Non cancella mai e segnala le differenze. Mai scritture su Penpot o sui contratti fuori dai comandi CLI.
- **Varianti nate in Penpot:** la pipeline le rileva e blocca solo quel componente, che resta all'ultima versione buona. Si adottano solo esplicitamente con `adopt:variant -- <Comp>`. Una variante non esprimibile fallisce con un errore nominativo.
- **Regola A (versioni):** un cambio compatibile (valori d'asse, parti, field o ruoli) alza solo `SCHEMA_VERSION` + fingerprint. Un cambio incompatibile alza `contract.version`, poi `bump:contract -- <Comp>` porta il plugin data al contratto corrente (dry-run senza `--yes`, rifiuta i downgrade) e solo dopo gira `add:library`. Il plugin data non si modifica mai a mano.
- **Aderenza ai valori:** si usano esattamente i valori del design, senza inventare quelli mancanti. I token semantici hanno nomi alla shadcn.
- **Componenti custom** (Table con sorting, Carousel, complessi): contratto completo e segnaposto in Penpot. L'adapter è scritto a mano senza `@generated` e la pipeline lo ignora.
- **Storybook:** story in CSF3 valido con le props in `args`, più un gate smoke sulle story generate.

## Technical Decisions

- **AD-11:** il contratto (assi, valori, tipo di asse, parti con il loro **ruolo**) è del page builder, Penpot disegna valori e aspetto. Il giudizio è congelato in ricette committate e il codice è funzione pura di fixture+ricetta+binding. Tipi di asse: `option` (→ `cva`), `state` (`focus-visible:`/`aria-invalid:`/`disabled:`), `behavior` (`data-[state=…]:`). Il legame componente→contratto passa per SharedPluginData sul VariantContainer. La composizione (Accordion Root, sezioni) è una definizione di sezione, non una ricetta.
- **Ruolo di parte:** vocabolario chiuso nel contratto (`surface`, `text`, `icon`, `divider`), indipendente da Penpot e dalle librerie, mai dichiarato in Penpot. La **tabella ruolo → proprietà ammesse** vive in `packages/scripts` accanto al registro. Il ruolo sostituisce il `kind` del design committato come fonte, e `designs/*.design.json` lo eredita dal contratto. Scartata l'opzione di elencare le proprietà nel contratto, perché porterebbe il vocabolario Penpot in `@app/contracts`.
- **Registro unico delle proprietà Penpot** (`packages/scripts`), letto da reader, `verify:library` ed emitter: per ogni proprietà indica lettura, tipo, stato (supportata/bloccata) e mappatura. Una proprietà assente dal registro blocca. Per sbloccarla servono una riga, la mappatura e un test rosso/verde.
- **Estendere l'emitter una volta per tutte**, mai per componente né a mano sul generato (es. variante senza fill → classi per variante fuori dalla base `cva`).
- **AD-5/AD-6:** `@app/contracts` ha **zero dipendenze** UI (lint bloccante), esporta `schemaVersion` e un campo ignoto vale `content`.
- **AD-3 e layering:** il frontend consuma solo il design system. Radix è una dipendenza di comportamento dichiarata nel binding e si importa solo da `ui/src/domains`. `contracts` e `tokens` sono foglie, `domains/` non importa mai da `editor/` (lint bloccante).
- **Emitter shadcn:** parte dalla base `npx shadcn add <comp>`, è deterministico byte per byte, con una sola libreria per installazione.
- **Tooling:** modulo BMad `penpot-ds` (`pds-*`). Le skill guidano, si fermano sulle decisioni umane e l'esito è l'exit code degli script. `pds-component` [PC] crea, [PS] instrada per stato del componente: drift, `adopt:variant`, `addCell`, domanda al designer, sblocco nel registro, proprietà fuori ruolo (i tre adattamenti), `design-drift` (`sync:design`).

## UX & Interaction Patterns

- Focus visibile WCAG 2.1 AA (contrasto ≥3:1) su ogni componente interattivo, mai `outline:none` senza un sostituto equivalente. Lo stato si comunica con testo + colore, mai solo col colore.
- ARIA per tipo: Dialog (modal, labelledby, focus trap, ritorno del focus), Toast (status/alert + aria-live), Table (caption + scope), Tabs (tablist/tab/tabpanel, frecce), Dropdown/Menu (haspopup/expanded, Escape), Breadcrumb (nav + aria-current). aria-live `polite` per le informazioni, `assertive` per gli errori bloccanti.
- Overlay (Dialog/Toast/Drawer) su un portale root condiviso sopra il canvas dell'editor. Tooltip escluso.
- **Primitive rigide, composizioni elastiche:** niente parti opzionali né comportamento disegnato in Penpot. Un tag cliccabile è un link e la X di un filtro attivo è una composizione (l'asse `removable` sul Badge è stato scartato).
- Catalogo per dominio: Data Display (Badge, Card, Carousel, Table, Typography), Inputs (Button, Input, Select, Checkbox, Switch), Feedback (Alert), Layout (Accordion, Collapsible, ScrollArea, Separator, AspectRatio, Flex, Row, Col), Navigation (Breadcrumb, Tabs), Overlays (Dialog, Drawer, Dropdown, Toast, Tooltip).

## Cross-Story Dependencies

- **Sequenza:** 2.1 viene prima di tutto; 2.3 prima di 2.4 e 2.5; 2.2 → schema usato da 2.5; 2.6 validata su Badge, Input e AccordionItem. 2.7 ripara ed estende la pipeline, 2.8 (registro e blocco per componente) è il prerequisito anti-rework, 2.9 (`pds-component`) dipende da 2.7 e 2.8.
- **2.10** dipende dalla story, in corso in un'altra sessione, che porta le regole 2, 3, 6 e 7 della library in un modulo condiviso fra estrazione e `verify:library`, e resta backlog finché quella non è chiusa. Porta i ruoli su Badge, Input, AccordionItem e Alert, e riallinea `alert.design.json` con `sync:design`.
- **2.11** (libreria) usa pipeline, registro, skill ([PC] per ogni componente) ed estrazione guidata dal contratto. Il primo primitivo reale via Radix arriva qui. **2.12** è Storybook.
- **Temi aperti** (decisione umana): vocabolario esatto dei ruoli e proprietà ammesse per ruolo (da fissare nella spec della 2.10); se una `surface` con solo `strokeColor` (outline) resta ammessa senza `fill`; `applyToken` sulle ombre non verificato dal vivo; `compoundVariants`; il caso di una variante esistente modificata.
- **Da Epic 1:** monorepo pnpm+Turborepo e infrastruttura di build/test.
- **Verso Epic 3:** consuma `@app/contracts`, la scala TS dei token e `ui/domains`. Le sezioni (3.4) potranno riusare il ruolo di parte, e la Story 3.4 usa il blocco "Filtro attivo" come caso di prova delle composizioni elastiche.
