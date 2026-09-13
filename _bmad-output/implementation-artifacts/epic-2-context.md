# Epic 2 Context: Design system — token e componenti da Penpot

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Costruire il design system del page builder come output riproducibile della pipeline Penpot→codice: i token (colori/tipografia/spacing/radii/ombre) e i componenti React accessibili (`ui/domains`) non si scrivono a mano, si generano dal catalogo Penpot con il regime **contratto → fixture → ricetta → emitter**. Così sparisce il drift design↔codice, i valori di design arrivano da Penpot e l'editor e le composizioni delle epic successive hanno una libreria unica, accessibile e testata in Storybook. Prima della libreria dei sei domini la pipeline deve reggere un catalogo che cresce e un design che evolve (varianti nuove, token cambiati), senza verdi finti, senza fedeltà persa in silenzio e senza CI tutto-o-niente: ciò che non si sa esprimere blocca solo il componente interessato. Il designer di riferimento non è tecnico e consegna il file Penpot finito o quasi: far passare la pipeline tocca allo sviluppatore. Il progetto non ha un PRD tradizionale: i requisiti vengono dallo SPEC e dalle sue companion.

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
- Story 2.10: Libreria componenti accessibile
- Story 2.11: Storybook del design system

## Requirements & Constraints

- **Token data-driven:** la generazione dipende dal **tipo** del token, mai dal nome del set; un set Penpot nuovo produce una sezione nuova senza toccare il codice. Output: CSS custom properties (Tailwind v4 `@theme`) + scala TS per i controlli dell'editor, da una fixture committata (generazione offline). Le variabili senza corrispondenza Penpot vivono in un file separato non generato.
- **Ricette:** mappa di parti a profondità 1 con celle `proprietà → token` esistenti nel catalogo. Ogni **valore** (colore, misura, spessore, opacità, ombra) ha un token; gli stili a **parola chiave** di una lista chiusa (es. tratteggio `solid`/`dashed`/`dotted`) sono ammessi senza token. Un literal fa fallire la validazione, una parte annidata con assi propri fa fallire lo schema, la geometria delle icone è ignorata.
- **Codice emesso:** `.tsx` + test + story + barrel per componente, marcati `@generated` con provenienza (`penpotComponentId` + `fixtureHash`); rigenerazione a diff zero, i file senza marker non si sovrascrivono mai.
- **Gate CI bloccanti:** completezza, rigenerazione diff-zero, a11y (vitest-axe + a11y baseline), conformità al contratto; drift fixture vs Penpot live bloccante se il runner raggiunge Penpot, altrimenti manuale/nightly con motivo nel log. I gate valutano **per componente**: un componente fuori regola rende rossa solo la sua voce, e i componenti in attesa (variante non adottata, proprietà bloccata) sono visibili nel report di PR/CI, non solo nel terminale. Ogni controllo nuovo ha una propria prova rosso/verde; pass/fail sta negli script, mai nel prompt.
- **Mai generare in silenzio una versione infedele:** una proprietà o genera codice fedele o blocca il componente con un messaggio nominativo; nessuno skip con solo log (tratteggio e allineamento dello stroke bloccano finché un componente reale non li richiede; spessore e opacità sono coperte dalla base, cioè verificate contro la base shadcn senza emettere classi).
- **Attriti del file Penpot:** maiuscole, spazi e ordine degli assi li normalizza la pipeline; un layer con un nome diverso dalla parte si lega tramite alias nel binding; una cella mancante blocca il componente e chiede al designer, mai inventata. Il designer torna in Penpot solo per scelte di design vere.
- **A11y che non mente:** `role`/`aria-*` dichiarati nel giudizio arrivano nel `.tsx`, e il gate a11y fallisce se mancano.
- **Crescita del catalogo:** design e liste si ricavano da `designs/*.design.json` e dal registry dei contratti (niente liste scritte a mano nei test o nel CLI), con un test di copertura design↔registry. Un field che si chiama come un attributo HTML globale (es. `title`) è rifiutato; `verify:library` segnala i container con un contratto inesistente e ricava le coppie di contrasto dai design.
- **Scritture su Penpot:** bootstrap una tantum (rifiuta se la library esiste), poi solo additiva: crea ciò che manca (contratti nuovi, celle mancanti con `addCell` e guardia anti-duplicato), non cancella mai e segnala le differenze. Mai scritture su Penpot o sui contratti fuori dai comandi CLI; nessuna sincronizzazione ricorrente codice→Penpot.
- **Varianti nate in Penpot:** la pipeline le rileva (blocca solo quel componente, che resta all'ultima versione buona) ma non le adotta da sola; adottarle è una decisione esplicita dello sviluppatore con `adopt:variant -- <Comp>`, che aggiorna in modo meccanico contratto, `SCHEMA_VERSION` + fingerprint, binding e design. Una variante non esprimibile (assi `state`/`behavior`, proprietà che varia con due assi, finché non ci sono le `compoundVariants`) fallisce con un errore nominativo.
- **Regola A (decisa da Alessandro il 2026-09-13):** un cambio compatibile del contratto (valori d'asse, parti o field aggiunti) alza solo `SCHEMA_VERSION` + la voce del fingerprint, mentre `contract.version` e il plugin data restano invariati. Un cambio incompatibile (rimozioni, rinomine) alza `contract.version`, poi `bump:contract -- <Comp>` porta il plugin data `nome@versione` al contratto corrente (dry-run senza `--yes`, rifiuta i downgrade), e solo dopo gira `add:library`. Il plugin data non si modifica mai a mano, e le celle dei valori rimossi le toglie a mano lo sviluppatore.
- **Aderenza ai valori:** si usano esattamente i valori del design, senza inventare quelli mancanti; i token semantici hanno nomi alla shadcn.
- **Componenti custom:** quelli senza headless e con logica propria (Table con sorting, Carousel) e quelli complessi hanno contratto completo e segnaposto in Penpot; l'adapter è scritto a mano, senza `@generated`, e la pipeline lo ignora.
- **Storybook:** story in CSF3 valido con le props in `args`, più un gate smoke sulle story generate.

## Technical Decisions

- **AD-11 (rivisto 2026-09-12):** il contratto è del page builder, Penpot disegna valori e aspetto; il giudizio è congelato in ricette committate; il codice è funzione pura di fixture+ricetta+binding. Tipi di asse solo nel contratto: `option` (prop → `cva`), `state` (`focus-visible:`/`aria-invalid:`/`disabled:`), `behavior` (`data-[state=…]:`). Legame componente→contratto tramite SharedPluginData sul VariantContainer; l'estrazione fallisce su contratto duplicato, nome incoerente o contratto senza container. La composizione (Accordion Root, sezioni) è una definizione di sezione in `@app/contracts`, non una ricetta.
- **Registro unico delle proprietà Penpot** (in `packages/scripts`), letto da reader, `verify:library` ed emitter: per ogni proprietà indica la lettura, il tipo (token o lista di parole chiave), lo stato (**supportata** o **bloccata**) e la mappatura dell'emitter. Una proprietà assente dal registro blocca. Sbloccarne una richiede una riga del registro, la mappatura e un test rosso/verde. Il refactor che lo introduce lascia l'output attuale identico byte per byte (`render:check` a diff zero).
- **Estendere l'emitter una volta per tutte**, mai per componente né a mano sul generato, quando non sa esprimere un design valido fatto coi token. Primo caso: una variante senza una proprietà che il default ha (outline senza fill) produce classi per variante invece di stare nella base `cva`. Stesso principio per le `compoundVariants` (tema ancora aperto).
- **AD-5/AD-6:** `@app/contracts` contiene schemi Zod delle props, tipi di asse, classifier structure/content e definizioni di sezione, con **zero dipendenze** UI (lint bloccante); esporta `schemaVersion`, che si alza a ogni cambio di contratto; un campo ignoto vale `content`.
- **AD-3:** il frontend consuma solo il design system; le primitive headless (Radix) sono dipendenze di comportamento dichiarate nel binding e si importano solo da `ui/src/domains`.
- **Emitter shadcn:** parte dalla base `npx shadcn add <comp>`, è deterministico byte per byte, una sola libreria per installazione.
- **Layering:** `contracts` e `tokens` sono foglie; `ui/domains` dipende da entrambi; `ui/editor` e `puck-components` dipendono da `ui/domains`; `domains/` non importa mai da `editor/` (lint bloccante).
- **Tooling:** modulo BMad `penpot-ds` (`pds-*`); le skill si aggiungono, la suite non si ristruttura. Le skill guidano e si fermano sulle decisioni umane, l'esito è l'exit code degli script (prima i comandi, poi la skill). `pds-component` si costruisce con `bmad-workflow-builder` e le sue voci [PC]/[PS] si registrano nel `module-help.csv` di `pds-setup`. La voce [PS] instrada in base allo stato del singolo componente: drift, `adopt:variant`, `addCell`, domanda al designer, sblocco nel registro (con decisione umana) oppure componente in attesa.

## UX & Interaction Patterns

- Focus visibile WCAG 2.1 AA (contrasto ≥3:1) su ogni componente interattivo; mai `outline:none` senza sostituto equivalente.
- Lo stato si comunica con testo + colore, mai solo col colore.
- ARIA per tipo: Dialog (modal + labelledby + focus trap + ritorno del focus), Toast (status/alert + aria-live), Table (caption + scope), Tabs (tablist/tab/tabpanel, frecce), Dropdown/Menu (haspopup/expanded, Escape), Breadcrumb (nav + aria-current). aria-live `polite` per le informazioni, `assertive` per gli errori bloccanti.
- Overlay (Dialog/Toast/Drawer) su un portale root condiviso sopra il canvas dell'editor; Tooltip escluso.
- **Primitive rigide, composizioni elastiche:** i componenti della library non hanno parti opzionali né comportamento disegnato in Penpot, e la flessibilità sta nelle composizioni e nelle sezioni. Un tag cliccabile è un link: Penpot disegna solo gli stati, l'`href` arriva dai dati commerce. La X di un filtro attivo è una composizione (Badge + icona-link); l'asse `removable` sul Badge è stato scartato.
- Catalogo per dominio: Data Display (Badge, Card, Carousel, Table, Typography), Inputs (Button, Input, Select, Checkbox, Switch), Feedback (Alert), Layout (Accordion, Collapsible, ScrollArea, Separator, AspectRatio, Flex, Row, Col), Navigation (Breadcrumb, Tabs), Overlays (Dialog, Drawer, Dropdown, Toast, Tooltip).

## Cross-Story Dependencies

- **Sequenza interna:** 2.1 viene prima di tutto; 2.3 prima di 2.4 e 2.5; 2.2 definisce lo schema delle ricette usato da 2.5; 2.6 si valida su Badge, Input e AccordionItem. 2.7 ripara ed estende la pipeline di 2.4–2.6 (parti A: niente verdi finti, B: `addCell` + regola A, C: `adopt:variant`). 2.8 (registro e blocco per componente) viene dopo 2.7 e prima della skill e della libreria: è il prerequisito anti-rework. 2.9 (`pds-component`) dipende da 2.7 e 2.8 e richiama `pds-additive`. 2.10 (libreria) usa pipeline, registro e skill ([PC] per ogni componente). 2.11 è Storybook.
- **Test di riferimento su Alert** (register in `deferred-work.md`): quasi tutti i problemi vanno alla 2.7, la skill alla 2.9, le story senza `args` alla 2.11.
- **Temi aperti** (decisione umana): `applyToken` sulle ombre non ancora verificato dal vivo; `compoundVariants`; il caso di una variante esistente modificata.
- **Da Epic 1:** monorepo pnpm+Turborepo e infrastruttura di build/test.
- **Verso Epic 3:** consuma `@app/contracts`, la scala TS dei token e `ui/domains`. La Story 3.4 usa il blocco "Filtro attivo" come caso di prova per il principio delle composizioni elastiche.
