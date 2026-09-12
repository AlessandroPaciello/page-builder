# Epic 2 Context: Design system — token e componenti da Penpot

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Costruire il design system del page builder come output riproducibile della pipeline Penpot→codice: i token (colori/tipografia/spacing/radii/ombre) e i componenti React accessibili (`ui/domains`) non si scrivono a mano ma si generano dal catalogo Penpot attraverso il regime **contratto → fixture → ricetta → emitter**. Questo elimina il drift design↔codice (che nel legacy era il dolore principale), rende i valori di design data-driven da Penpot e fornisce all'editor e alle composizioni successive (Epic 3+) una libreria unica, accessibile e testata in Storybook. Nota: il progetto non ha un PRD tradizionale — i requisiti derivano dallo SPEC-kernel e dalle sue companion; il presente file compila solo ciò che serve a questa epic.

## Stories

- Story 2.1: Pipeline token Penpot→codice
- Story 2.2: Estrazione componenti e schema delle ricette
- Story 2.3: Package dei contratti (Badge, Input, Accordion)
- Story 2.4: Bootstrap della library Penpot sui contratti
- Story 2.5: Estrazione adeguata — ricette per parti e token, validate contro il contratto
- Story 2.6: Emitter shadcn deterministico e gate CI
- Story 2.7: Libreria componenti accessibile
- Story 2.8: Storybook del design system

## Requirements & Constraints

- **Pipeline Penpot→token:** la generazione dei token è data-driven dal **tipo** del token (namespace stabile: color, text, font-weight, tracking, font, space, radius, border-width, opacity, shadow), mai dal nome del set: un nuovo set Penpot produce una nuova sezione senza modifiche al codice. Output: CSS custom properties (Tailwind v4 `@theme`) + scala TS/opzioni per i controlli dell'editor. La funzione di derivazione del nome è unica e condivisa con l'emitter (variabile CSS e classe non possono divergere).
- **Variabili non disegnate:** le variabili senza corrispondenza Penpot (font utility, line-height) vivono in un file separato e non generato, mai toccato dalla rigenerazione.
- **Regime contratto→fixture→ricetta→emitter:** il contratto (assi, valori ammessi, tipo di asse, parti) è del page builder e vive in `@app/contracts`; la fixture è tutto ciò che si legge da Penpot senza sapere cosa sia React; la ricetta è l'unico passo di giudizio (fattorizzazione per parti + requisiti a11y, senza sapere quale libreria la renderà); emitter+binding è tutto ciò che dipende dalla libreria. La composizione (Accordion Root, sezioni) **non** è una ricetta: è una definizione di sezione (dati) in `@app/contracts`.
- **Ricette:** mappa di parti a profondità 1, celle `proprietà → token`; ogni token referenziato deve esistere nel catalogo Stadio 1 — un valore literal (`bg-[#3b82f6]`) fa fallire la validazione; una parte annidata con assi propri fa fallire lo schema; la geometria delle icone è ignorata.
- **Emitted code:** `.tsx` + test + story + barrel per componente, marcati `@generated` con provenienza (`penpotComponentId` + `fixtureHash`); rigenerazione a **diff zero**; i file senza marker non vengono mai sovrascritti (skip protettivo).
- **Gate CI bloccanti:** completezza artefatti, rigenerazione diff-zero, a11y (vitest-axe + a11y baseline), conformità al contratto (fixture e ricetta coprono *esattamente* assi e valori), drift fixture vs Penpot live (bloccante solo se il runner raggiunge il server MCP; altrimenti manuale/nightly con decisione documentata). Ogni gate ha una prova rosso/verde propria; il pass/fail sta negli script e negli schemi, mai nel prompt delle skill.
- **Skill di scrittura su Penpot:** bootstrap una tantum (rifiuta se la library esiste; crea token semantici **inclusi shadow/ring** e VariantContainer per contratto, con plugin data `pagebuilder/contract = nome@versione`), poi solo additiva (crea ciò che manca, segnala le differenze senza correggerle). Nessuna sincronizzazione ricorrente codice→Penpot.
- **Aderenza ai valori:** usare esattamente i valori del design; non inventare valori mancanti (default neutri, mai colori casuali). Token semantici con nomi alla shadcn.
- **Componenti custom:** i componenti senza headless disponibile e con logica propria (Table con sorting, Carousel) e i complessi (3D, mappe) hanno contratto completo e segnaposto in Penpot; l'adapter è scritto a mano, senza marker `@generated`, e la pipeline li ignora.

## Technical Decisions

- **AD-11 (rivisto 2026-09-12):** il contratto è del page builder, Penpot disegna valori e aspetto; il giudizio si congela in ricette committate; il codice è funzione pura di fixture+ricetta+binding. Tipi di asse dichiarati solo nel contratto: `option` (prop scelta in Puck → stile per variante), `state` (browser → prefissi `focus-visible:`/`aria-invalid:`/`disabled:`), `behavior` (headless → `data-[state=…]:`). Legame componente→contratto via SharedPluginData sul VariantContainer; l'estrazione fallisce su contratto duplicato, nome incoerente o contratto senza container.
- **AD-5:** `packages/contracts` (`@app/contracts`) contiene una sola volta schemi Zod delle props, tipi di asse, classifier structure/content e definizioni di sezione; **zero dipendenze** da React/Puck/shadcn/Tailwind (verificata da lint bloccante con prova rosso/verde); `schemaVersion` esportata; campo ignoto = `content` (fail-safe).
- **AD-3:** il frontend consuma solo il design system; le primitive headless (Radix) sono dipendenza di comportamento dichiarata nel binding e importabili **solo** da `ui/src/domains`. Il comportamento accessibile non è disegnabile in Penpot: entra dalla base headless del binding, input del rendering, mai output.
- **Emitter di riferimento shadcn:** non genera componenti da zero; parte da `npx shadcn add <comp>` e instrada gli assi per tipo; `option` → `cva`; stesso input → stesso output byte per byte. **Una sola libreria per installazione**, scelta a build time.
- **Layering (regola, non vista):** `contracts` e `tokens` sono foglie; `tokens` + `contracts` → `ui/domains`; `ui/domains` → `ui/editor` e `puck-components`. I componenti in `domains/` non importano mai da `editor/` (lint bloccante in CI + due export separati: `.` e `./editor`).
- **Package coinvolti:** `packages/contracts`, `packages/tokens` (`@penpot-ds/tokens`, generato), `packages/ui` (`@penpot-ds/ui`, con `src/domains` generato), `packages/scripts` (pipeline: penpot/lettore MCP, recipes, render, gates), `packages/storybook`. Nessun package `primitives`.
- **Tooling:** modulo BMad `penpot-ds` (codice `pds`) creato dentro la Story 2.4 (Task 6): il dev scrive le proprie skill.

## UX & Interaction Patterns

- **Focus visibile WCAG 2.1 AA** su ogni componente interattivo (contrasto ≥3:1); mai `outline:none` senza sostituto visibile equivalente.
- **Stato = testo + colore**, mai solo colore (token feedback error/success/warning/info con coppia colore+testo).
- **ARIA corretta per tipo:** Dialog (modal + labelledby + focus trap + focus al trigger alla chiusura), Toast (status/alert + aria-live), Table (caption + scope), Tabs (tablist/tab/tabpanel, frecce), Dropdown/Menu (haspopup/expanded, Escape), Breadcrumb (nav + aria-current).
- **Regioni aria-live:** `polite` per save/cambio lifecycle/toast informativi; `assertive` per errori bloccanti.
- **Overlay su portale root DOM condiviso** (Dialog/Toast/Drawer) sopra il canvas dell'editor; Tooltip escluso.
- **Catalogo componenti per dominio:** Data Display (Badge, Card, Carousel, Table, Typography), Inputs (Button, Input, Select, Checkbox, Switch), Feedback (Alert), Layout (Accordion, Collapsible, ScrollArea, Separator, AspectRatio, Flex, Row, Col), Navigation (Breadcrumb, Tabs), Overlays (Dialog, Drawer, Dropdown, Toast, Tooltip).

## Cross-Story Dependencies

- **Sequenza interna:** 2.1 (token) precede tutto — la validazione delle ricette usa il vocabolario token dello Stadio 1. 2.3 (contratti) precede 2.4 (library Penpot sui contratti) e 2.5 (estrazione contro il contratto). 2.2 definisce lo schema delle ricette usato da 2.5. 2.6 (emitter) consuma fixture+ricetta+binding e si valida su Badge, Input, AccordionItem prima di generalizzare. 2.7 (libreria per sei domini) dipende da token, contratti ed emitter; ogni dominio richiede prima il proprio contratto e container Penpot (skill additiva). 2.8 (Storybook) aggrega le story di 2.7.
- **Da Epic 1:** richiede il monorepo scaffoldato (pnpm+Turborepo) e l'infrastruttura di build/test; il core di dominio e i dati non sono toccati da questa epic.
- **Verso le epic successive:** Epic 3 consuma `@app/contracts` (schemi, classifier, definizioni di sezione), il ponte token→controlli e `ui/domains` per i blocchi Puck e le composizioni editor (`ui/editor`); il ponte token→controlli Puck (Story 3.1) dipende dalla scala TS/opzioni prodotta qui.
