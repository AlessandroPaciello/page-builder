# Epic 2 Context: Design system — token e componenti da Penpot

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Costruire il design system del page builder come output riproducibile della pipeline Penpot→codice: i token (colori/tipografia/spacing/radii/ombre) e i componenti React accessibili (`ui/domains`) non si scrivono a mano, si generano dal catalogo Penpot con il regime **contratto → fixture → ricetta → emitter**. Così sparisce il drift design↔codice, i valori di design arrivano da Penpot e l'editor e le composizioni delle epic successive hanno una libreria unica, accessibile e testata in Storybook. Prima della libreria dei sei domini la pipeline va resa capace di reggere un catalogo che cresce e un design che evolve (varianti nuove, token cambiati), senza verdi finti e senza passaggi a mano fuori dai comandi CLI. Il progetto non ha un PRD tradizionale: i requisiti vengono dallo SPEC e dalle sue companion.

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

- **Token data-driven:** la generazione dipende dal **tipo** del token (color, text, font-weight, tracking, font, space, radius, border-width, opacity, shadow), mai dal nome del set; un set Penpot nuovo produce una sezione nuova senza toccare il codice. Output: CSS custom properties (Tailwind v4 `@theme`) + scala TS per i controlli dell'editor. Catalogo serializzato in una fixture committata, così la generazione gira offline. Le variabili senza corrispondenza Penpot (font utility, line-height) vivono in un file separato non generato.
- **Ricette:** mappa di parti a profondità 1 con celle `proprietà → token`; ogni token deve esistere nel catalogo. Un literal (`bg-[#3b82f6]`) fa fallire la validazione, una parte annidata con assi propri fa fallire lo schema, la geometria delle icone è ignorata.
- **Codice emesso:** `.tsx` + test + story + barrel per componente, marcati `@generated` con provenienza (`penpotComponentId` + `fixtureHash`). La rigenerazione dà diff zero e i file senza marker non vengono mai sovrascritti.
- **Gate CI bloccanti:** completezza, rigenerazione diff-zero, a11y (vitest-axe + a11y baseline), conformità al contratto (fixture e ricetta coprono *esattamente* assi e valori). Il drift fixture vs Penpot live è bloccante se il runner raggiunge Penpot, altrimenti manuale/nightly con decisione documentata. Ogni gate e ogni controllo nuovo ha una propria prova rosso/verde; pass/fail sta negli script e negli schemi, mai nel prompt.
- **A11y che non mente:** `role`/`aria-*` dichiarati nel giudizio devono arrivare nel `.tsx`, e il gate a11y fallisce se mancano: è una riparazione del gate a11y esistente, non un sesto gate.
- **Crescita del catalogo:** aggiungere un contratto col suo design non deve richiedere di modificare liste scritte a mano nei test o nel CLI. Design e liste si ricavano da `designs/*.design.json` e dal registry dei contratti, con un test di copertura design↔registry.
- **Validazioni del contratto:** un field che si chiama come un attributo HTML globale (es. `title`) è rifiutato. `verify:library` segnala i container che dichiarano un contratto inesistente e ricava le coppie di contrasto testo/sfondo dai design, non da una lista.
- **Scritture su Penpot:** bootstrap una tantum (rifiuta se la library esiste; crea token semantici inclusi shadow/ring e un VariantContainer per contratto, con plugin data `pagebuilder/contract = nome@versione`). Poi solo additiva: crea ciò che manca (contratti nuovi e **celle** mancanti di un container esistente, con guardia anti-duplicato) e segnala le differenze indicando dove si risolvono. Mai scritture su Penpot o sui contratti fuori dai comandi CLI; nessuna sincronizzazione ricorrente codice→Penpot.
- **Varianti nate in Penpot:** la pipeline le **rileva** (verify rosso, estrazione ferma senza scrivere) ma non le adotta da sola. Adottarle è una decisione esplicita di chi sviluppa, perché aggiunge un valore di prop e alza `schemaVersion`. I passi che seguono (contratto, `SCHEMA_VERSION` + fingerprint, binding, design) li fa un comando e non il prompt. Una variante non esprimibile (una proprietà che varia su due assi, assi `state`/`behavior` senza mapping 1:1) fallisce con un errore che la nomina.
- **Versione del contratto in Penpot:** regola A, decisa da Alessandro il 2026-09-13 (opzione A): il bump del plugin data `nome@versione` avviene solo dopo l'aggiornamento del contratto, con `bump:contract`; il plugin data non canonico è un errore di downgrade fuorviante, non una versione da accettare.
- **Aderenza ai valori:** si usano esattamente i valori del design, senza inventare quelli mancanti; i token semantici hanno nomi alla shadcn.
- **Componenti custom:** quelli senza headless e con logica propria (Table con sorting, Carousel) e quelli complessi hanno contratto completo e un segnaposto in Penpot; l'adapter è scritto a mano, senza `@generated`, e la pipeline lo ignora.
- **Storybook:** story in CSF3 valido con le props in `args`, più un gate smoke che esegue le story generate (una story che rende il componente senza props dà test rosso).

## Technical Decisions

- **AD-11 (rivisto 2026-09-12):** il contratto è del page builder, Penpot disegna valori e aspetto; il giudizio è congelato in ricette committate; il codice è funzione pura di fixture+ricetta+binding. I tipi di asse si dichiarano solo nel contratto: `option` (prop Puck → `cva`), `state` (browser → `focus-visible:`/`aria-invalid:`/`disabled:`), `behavior` (headless → `data-[state=…]:`). Il componente si lega al contratto tramite SharedPluginData sul VariantContainer; l'estrazione fallisce su contratto duplicato, nome incoerente o contratto senza container. La composizione (Accordion Root, sezioni) non è una ricetta: è una definizione di sezione in `@app/contracts`.
- **AD-5/AD-6:** `packages/contracts` (`@app/contracts`) contiene schemi Zod delle props, tipi di asse, classifier structure/content e definizioni di sezione, con **zero dipendenze** UI (lint bloccante). Esporta `schemaVersion`, che si alza a ogni cambio di contratto; un campo ignoto vale `content`.
- **AD-3:** il frontend consuma solo il design system. Le primitive headless (Radix) sono dipendenze di comportamento dichiarate nel binding e si importano **solo** da `ui/src/domains`; il comportamento accessibile entra dalla base headless ed è un input del rendering, non un output.
- **Emitter shadcn:** parte dalla base `npx shadcn add <comp>`, non genera da zero; deterministico byte per byte; una sola libreria per installazione, scelta a build time.
- **Layering:** `contracts` e `tokens` sono foglie; `ui/domains` dipende da entrambi; `ui/editor` e `puck-components` dipendono da `ui/domains`. `domains/` non importa mai da `editor/` (lint bloccante + export separati `.` e `./editor`).
- **Package:** `packages/contracts`, `packages/tokens` (`@penpot-ds/tokens`), `packages/ui` (`@penpot-ds/ui`, `src/domains` generato), `packages/scripts` (pipeline), `packages/storybook`. Nessun package `primitives`.
- **Tooling:** modulo BMad `penpot-ds` (codice `pds`, suite `pds-*`); le skill si aggiungono, la suite non si ristruttura. Le skill guidano e si fermano sulle decisioni umane; l'esito è l'exit code degli script. Regola: prima i comandi, poi la skill. `pds-component` si costruisce con `bmad-workflow-builder` e le sue voci [PC]/[PS] si registrano nel `module-help.csv` di `pds-setup`.

## UX & Interaction Patterns

- Focus visibile WCAG 2.1 AA (contrasto ≥3:1) su ogni componente interattivo; mai `outline:none` senza un sostituto equivalente.
- Lo stato si comunica con testo + colore, mai solo col colore (token feedback error/success/warning/info).
- ARIA per tipo: Dialog (modal + labelledby + focus trap + ritorno del focus al trigger), Toast (status/alert + aria-live), Table (caption + scope), Tabs (tablist/tab/tabpanel, frecce), Dropdown/Menu (haspopup/expanded, Escape), Breadcrumb (nav + aria-current).
- aria-live `polite` per save, cambio di lifecycle e toast informativi; `assertive` per errori bloccanti.
- Overlay (Dialog/Toast/Drawer) su un portale root condiviso sopra il canvas dell'editor; Tooltip escluso.
- Catalogo per dominio: Data Display (Badge, Card, Carousel, Table, Typography), Inputs (Button, Input, Select, Checkbox, Switch), Feedback (Alert), Layout (Accordion, Collapsible, ScrollArea, Separator, AspectRatio, Flex, Row, Col), Navigation (Breadcrumb, Tabs), Overlays (Dialog, Drawer, Dropdown, Toast, Tooltip).

## Cross-Story Dependencies

- **Sequenza interna:** 2.1 viene prima di tutto (le ricette si validano sul vocabolario token). 2.3 viene prima di 2.4 e 2.5; 2.2 definisce lo schema ricette usato da 2.5. 2.6 si valida su Badge, Input e AccordionItem. 2.7 ripara ed estende la pipeline di 2.4–2.6 (emitter, `verify:library`, `add:library`, nuovi comandi `addCell`/`adopt:variant`). 2.8 (registro delle proprietà e blocco per componente) dipende da 2.7. 2.9 (skill `pds-component`) dipende da 2.7 e 2.8 e richiama `pds-additive`: crea ogni componente con la voce [PC] (prima contratto e container Penpot, poi estrazione e render). 2.10 aggrega le story di 2.9 e aggiunge all'emitter il gate CSF3; Storybook è 2.11.
- **Test di riferimento:** i problemi emersi dal test end-to-end su Alert (register in `deferred-work.md`) sono assegnati: quasi tutti a 2.7, la skill a 2.9, le story senza `args` a 2.11.
- **Da Epic 1:** monorepo pnpm+Turborepo e infrastruttura di build/test; dominio e dati non vengono toccati.
- **Verso Epic 3:** consuma `@app/contracts` (schemi, classifier, definizioni di sezione), la scala TS dei token (per il ponte token→controlli Puck) e `ui/domains`.
