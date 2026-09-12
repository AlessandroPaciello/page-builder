---
date: 2026-09-12
workflow: bmad-correct-course
mode: incrementale
trigger: "Forge HARDENED 'Library Penpot shadcn + esagono Puck' (commit 933935d)"
scope: Major
status: approved
approved_by: Alessandro
approved_on: 2026-09-12
---

# Sprint Change Proposal — Contratti del page builder, library Penpot nuova, sezioni

## 1. Sintesi del problema

**Trigger.** Il forge `_bmad-output/forge/penpot-shadcn-e-esagono-puck/` (chiuso HARDENED il 2026-09-12) ha messo alla prova, prima di iniziare la Story 2.3, l'idea di una nuova library Penpot costruita sui componenti shadcn e di un esagono sul confine page builder ↔ libreria componenti. La Story 2.3 è `ready-for-dev` ma non è mai partita.

**Tipo.** Pivot strategico sull'ownership. Non è un limite tecnico emerso durante l'implementazione.

**Problema.**
1. **Ownership invertita.** AD-11 dà a Penpot la *matrice varianti*. Il vocabolario delle props, e quindi i valori salvati nelle pagine (jsonb Puck, AD-6), dipende così dalla libreria generata: cambiare libreria vorrebbe dire rompere o migrare tutte le pagine.
2. **Ricetta legata a un solo target.** `RecipeSchema` (Story 2.2) salva le celle come classi Tailwind (`bg-mis-primary-light…`): la stessa ricetta non può alimentare un emitter diverso da shadcn.
3. **Criterio di stop mal posto.** Il criterio "Accordion diventa albero annidato → stop" della 2.3 si basava su un'ipotesi che le prove hanno smentito. AccordionItem è una mappa piatta di parti (profondità 1) più un asse di comportamento; la composizione di più item è un albero di *dati*, non una ricetta annidata.
4. **Sezioni non previste dal regime.** Hero e sezioni disegnate in Penpot devono essere estraibili e rigide in editor. `design-system.md` le prevede invece come blocchi scritti a mano con colori liberi.

**Evidenze.**
- MCP Penpot su "Nuovo File 4": bootstrap Badge (12 token semantici, 6 varianti, 0 `variantError`, token legati, SharedPluginData `badge@1`); Input con asse `state` (gli stati diventano pseudo-classi, non varianti); AccordionItem con asse `state` (le differenze sono comportamentali, chevron escluso); `switchVariant` con i token che seguono la variante.
- Puck 0.22.4: slot con `allow`/`disallow` ma senza `max`; permissions per componente e `resolvePermissions`; `readOnly` per singola prop; nessun template nativo.
- Input da buttare nella library attuale: asse `colorStyle` a 12 chiavi composte, varianti Indigo e Green identiche.

## 2. Analisi d'impatto

### Epic
| Epic | Impatto |
|---|---|
| 1 | Nessuno. |
| 2 | **Ristrutturata**: tre story nuove (2.3 contratti, 2.4 bootstrap library Penpot, 2.5 estrazione adeguata); renderer → 2.6 (emitter shadcn), libreria → 2.7, Storybook → 2.8. 2.1 e 2.2 restano `done` (il codice viene adeguato in avanti, non annullato). |
| 3 | 3.2 diventa adapter dei contratti; 3.3 classifier esteso in `contracts`; **nuova 3.4 Definizioni di sezione da Penpot**; composizioni → 3.5. |
| 4 | 4.3 valida contro i contratti, compresi `allow`/`max` degli slot (autoritativo nel core). |
| 5 | Nessuno. |
| 6 | Header: il render pubblico è un adapter di `@app/contracts`. AC invariati. |

Nessuna epic diventa obsoleta e non serve un'epic nuova. L'ordine tra le epic resta invariato.

### Artefatti
- **SPEC (in sostituzione del PRD):** CAP-2 (success, 5 gate), CAP-4 (contratti + sezioni rigide), constraint di ownership e di layering, assumption "una libreria per installazione". Obiettivi, CAP e non-goals invariati: **l'MVP non cambia**.
- **Architecture Spine:** AD-11 riscritta, AD-5 riscritta (package `contracts`), AD-3 (layering), AD-6 (proprietario di `schemaVersion`), convenzioni, Structural Seed, Capability Map, Deferred. Proiezione HTML riallineata.
- **Companion:** `penpot-pipeline.md` (Stadio 0, ricetta per parti × token, emitter + binding, sezioni, 5° gate), `design-system.md` (contracts, puck-components come adapter, Hero/Section → sezioni, Box a soli token).
- **UX:** `EXPERIENCE.md` (sezioni rigide, slot con contatore, rifiuto annunciato, key flow), `DESIGN.md:98`.
- **Implementazione:** `epics.md`, `sprint-status.yaml`, `deferred-work.md`, story file 2.3 → 2.6, nota nella retro Epic 1.

### Impatto tecnico
- Nuovo package `packages/contracts` (`@app/contracts`), foglia senza dipendenze UI.
- `packages/scripts`: `RecipeSchema` passa da classi a `proprietà → token` per parti; lettura del plugin data; validazione contro il contratto; emitter shadcn. **Rischio:** 88 test esistenti da adeguare (Story 2.5).
- `badge.fixture.json` e `badge.recipe.json` saranno sostituiti dall'estrazione sulla nuova library (Story 2.5), non modificati a mano.
- `packages/tokens` rigenerato dalla nuova library con nomi semantici (Story 2.4). Verificato oggi: **nessun uso di classi `mis-*`** in `packages/ui/src` e `apps/web/src`.
- Tooling: BMad Builder e il modulo BMad `penpot-ds` (skill di bootstrap/additiva) sono prerequisiti della 2.4.
- CI: 5 gate invece di 4 (+ conformità al contratto).

## 3. Approccio raccomandato

**Aggiustamento diretto** (opzione 1), con sostituzione in avanti di schema e ricetta Badge.

| Opzione | Esito | Sforzo | Rischio |
|---|---|---|---|
| 1 — Aggiustamento diretto | **Praticabile, scelta** | Medio | Medio |
| 2 — Rollback | Non praticabile come revert: 2.1/2.2 reggono, si adeguano | — | — |
| 3 — Revisione MVP | Non necessaria: lo scope cresce dentro le stesse CAP | — | — |

**Motivazione.** La 2.3 non è iniziata, quindi il cambio arriva al costo minimo possibile. Partire con la 2.3 sulla library attuale (opzione scartata nel forge) avrebbe prodotto input da buttare e avrebbe fatto rifare due volte il test critico su Accordion. La premessa del 2026-07-26 ("il design system itererà") resta valida e continua a giustificare il renderer.

**Rischi.**
- Adeguamento di `RecipeSchema` su codice in main con 88 test (mitigazione: Story 2.5 dedicata, copertura che non scende).
- Emitter MUI non provato (mitigazione: nel Deferred, nessun impegno ora).
- Persistenza di `applyToken` via MCP in contrasto con la nota della Story 2.2 (mitigazione: riverifica in 2.4/2.5).

**Impatto sulla timeline.** Epic 2 passa da 5 a 8 story ed Epic 3 da 4 a 5.

## 4. Proposte di modifica dettagliate (approvate in modalità incrementale)

### 4.1 Architecture Spine — AD-11 (proposta 1, approvata)
**OLD:** "Penpot è single source of truth di valori, aspetto e matrice varianti … (c) renderer puro che applica il blocco `cva` a una base shadcn … Penpot possiede soltanto lo strato di stile: quel blocco `cva`."
**NEW:** *AD-11 — Il contratto è del page builder, Penpot disegna valori e aspetto; il giudizio si congela in ricette, il codice è funzione pura [ADOPTED, rivisto 2026-09-12].* Binds CAP-1..4. Contenuto:
- ownership del contratto in `packages/contracts`;
- tipi di asse `option`/`state`/`behavior` dichiarati nel contratto;
- legame via SharedPluginData `pagebuilder/contract = nome@versione`, con i tre casi di fallimento;
- fixture validata contro il contratto;
- ricetta come mappa di parti a profondità 1 con celle `proprietà → token`, geometria delle icone ignorata, parte annidata con assi → lo schema fallisce;
- emitter per libreria + tabella di binding, una libreria per installazione;
- composizione come definizione di sezione;
- componenti complessi con contratto completo, segnaposto Penpot e adapter a mano;
- scrittura su Penpot solo via skill (bootstrap + additiva), nessuna sync ricorrente;
- pass/fail negli script e negli schemi, mai nel prompt.

### 4.2 Architecture Spine — AD-5 e ricadute (proposta 2, approvata)
- **AD-5 riscritta:** *Contratti dei componenti: una sola fonte di verità in `packages/contracts` (`@app/contracts`)*. Contiene schemi Zod delle props, tipi di asse, classifier e definizioni di sezione; zero dipendenze UI. Adapter: `ui/domains`, `puck-components`, render, `domain`. Pipeline del core: valida (compresi `allow`/`max`, autoritativo) → classifica → sanitizza. Fail-safe `content`. Sezioni rigide per default. Box/Flex/Grid/Columns a soli token.
- **AD-3:** layering `contracts ← { ui/domains, puck-components, domain, render }`; diagramma con il nodo `contracts`.
- **AD-6:** `schemaVersion` di proprietà di `packages/contracts`.
- **Convenzioni:** `@app/contracts` nella riga dei confini package; "schemi Zod dei **contratti**".
- **Seed:** riga `contracts/`; `puck-components` = adapter Puck; `scripts` = emitter per libreria.
- **Capability Map:** CAP-4 → contracts + puck-components; CAP-13 → contracts + core.
- **Deferred:** rimossa "Estensione della pipeline ai blocchi Puck"; aggiunta "Emitter per una seconda libreria (MUI)"; "Migrazione `schemaVersion`" con proprietario `contracts`.

### 4.3 `penpot-pipeline.md` (proposta 3, approvata)
- Intro: contratto del page builder, Penpot sorgente di valori e aspetto.
- Principio guida: token semantici alla shadcn (supera la decisione del 2026-09-05 "contratto CSS Penpot-native"); plugin data sul VariantContainer.
- Nuovo **Stadio 0 — Contratto e library Penpot**: skill bootstrap una tantum, compresi shadow/ring; poi solo additiva.
- Diagramma Stadio 2 con contratto → fixture validata → ricetta per parti → emitter + binding.
- Ricetta: parti a profondità 1, celle `proprietà → token`, literal rifiutati, parte annidata → schema fallisce, icone ignorate.
- Renderer → **Emitter per libreria e binding**: instradamento `option` → cva, `state` → pseudo-classi/attributi, `behavior` → `data-[state]`.
- Tabella del confine a cinque livelli: contratto, fixture, ricetta, emitter, binding.
- Nuova sezione **Sezioni**: solo istanze della library, mapping meccanico Box/Flex, slot per id Penpot con `allow`/`max`, testi del mockup come default content, output = definizione in `contracts`.
- `custom`: contratto completo e segnaposto Penpot.
- **Gate: 5**, con il nuovo *Conformità al contratto*; il drift è bloccante se e solo se Penpot è raggiungibile da CI.

### 4.4 `design-system.md` (proposta 4, approvata)
- Layering con `contracts` come foglia.
- `ui/domains` implementa i contratti; libreria sostituibile, una per installazione.
- `puck-components` = adapter Puck dei contratti (campi dagli assi `option`, permissions, render), senza schemi né classifier.
- Riga Layout senza Hero/Section; Box/Flex/Grid/Columns con compiti separati e soli token; **sezioni** come definizioni estratte da Penpot, rigide, con slot `allow` + `max`.
- `structure`: colori solo da token semantici; classificazione in `@app/contracts`.

### 4.5 `SPEC.md` (proposta 5, approvata)
- CAP-2 success: validazione contro il contratto, cinque gate, drift condizionale.
- CAP-4 intent/success: contratti come blocchi più sezioni rigide; rifiuto lato server di un blocco fuori `allow` od oltre `max`.
- Constraint: "Penpot è la single source of truth dei valori e dell'aspetto; il contratto dei componenti (assi, valori, parti) è del page builder".
- Layering con i contratti come foglia. Assumption: una libreria per installazione.

### 4.6 `epics.md` — inventario ed Epic 2 (proposta 6, approvata, con la correzione 4.9-f)
- FR2, NFR5, NFR6 e le righe Additional AD-3/AD-11 e AD-5/AD-6 riallineate.
- Header Epic 2: regime contratto → fixture → ricetta → emitter; vincolo AD-5; prerequisito BMad Builder.
- **2.3 Package dei contratti (Badge, Input, Accordion)**: zod props, tipi di asse, parti, classifier; tipo definizione di sezione (Accordion Root); lint bloccante senza dipendenze UI con prova rosso/verde; `schemaVersion`; fail-safe content.
- **2.4 Bootstrap della library Penpot sui contratti**: skill `penpot-ds`; token semantici compresi shadow/ring; un VariantContainer per contratto con 0 `variantError`, token legati e plugin data; rifiuto su library esistente; modalità additiva; esito deciso da script; pipeline token rigirata senza modifiche al codice, e nessun consumer fuori da `packages/tokens` e dalla ricetta Badge usa i vecchi nomi token.
- **2.5 Estrazione adeguata**: lettura del plugin data con i tre fallimenti; copertura esatta degli assi del contratto; `RecipeSchema` per parti × token, criterio di stop meccanico, icone ignorate; fixture e ricetta Badge sostituite (`colorStyle` sparisce); copertura dei test che non scende.
- **2.6 Emitter shadcn deterministico e gate CI** (ex 2.3): instradamento per tipo di asse; `@generated` con provenienza; diff zero; skip protettivo; 5 gate (drift condizionale), ognuno con prova rosso/verde; validazione su Badge/Input/AccordionItem; Accordion Root non è una ricetta.
- **2.7 Libreria componenti accessibile** (ex 2.4): Given con i contratti e la 2.6; contratto e container Penpot prima della generazione; complessi con segnaposto e adapter a mano.
- **2.8 Storybook** (ex 2.5): invariata.

### 4.7 `epics.md` — Epic 3/4/6 (proposta 7, approvata)
- Header Epic 3 e UX-DR8 (sezioni rigide con slot `allow` + `max`); vincolo AD-11.
- 3.1 invariata.
- **3.2 Blocchi Puck come adapter dei contratti**: assi `state`/`behavior` non diventano campi; Box/Flex/Grid/Columns con slot e soli token; nessuna copia degli schemi in `puck-components`.
- **3.3 Classifier esteso a tutti i contratti**: `readOnly` per prop; fail-safe; nessuna seconda copia.
- **3.4 (nuova) Definizioni di sezione da Penpot**: forma sciolta → fallimento; slot che punta a un nodo sparito → fallimento; struttura bloccata e contenuto modificabile; `allow`/`max` con `resolvePermissions`; testi come default content.
- **3.5 Composizioni dell'editor** (ex 3.4): invariata.
- Epic 4: header "contratti"; 4.3 valida `allow`/`max` e rifiuta con errore tipizzato.
- Epic 6: header, il render è un adapter di `@app/contracts`.

### 4.8 UX (proposta 8, approvata)
- `EXPERIENCE.md:64`: blocchi Box/Flex/Grid/Columns/Spacer più blocchi su contratto; nuovo punto **Sezioni** (indicatore testuale "Struttura bloccata", pannello con soli campi content, slot con contatore "2 di 3", rifiuto visibile e annunciato).
- `:79–84`: esempi grab-mode con sezione e slot; nesting su Box/Flex/Grid/Columns e slot di sezione.
- `:104`: responsive di layout e sezioni.
- `:120`: key flow con la sezione "Hero collezione" e il bottone aggiunto nello slot Azioni.
- `DESIGN.md:98`: "(ui/domains + puck-components + ui/editor; sezioni come definizioni di dati)".

### 4.9 Artefatti di implementazione (proposta 9, approvata)
- **a.** `git mv` del file 2-3 → `2-6-emitter-shadcn-deterministico-e-gate-ci.md`, status `backlog`, banner "superata, rigenerare con `bmad-create-story`" che indica le parti riusabili (Task 0, Task 5, Gate 4, disciplina rosso/verde).
- **b.** `sprint-status.yaml`: Epic 2 in 8 story ed Epic 3 in 5 con le nuove chiavi; action item aggiornati (5 gate in 2.6, criterio di stop meccanizzato in 2.5 con test rosso/verde, alias shadcn → 2.6, dropdown → 2.7); nuova azione "BMad Builder + modulo `penpot-ds` prima della 2.4" (owner Alessandro).
- **c.** `deferred-work.md`: riferimenti alle story aggiornati (dropdown 2.7, alias 2.6); voce Input/Accordion superata; hex-match da riverificare (persistenza di `applyToken`); cross-check ricetta↔fixture assorbito dal gate di conformità; nuova sezione del correct-course (MUI, rischio 88 test, dark mode con la nuova library).
- **d.** Retro Epic 1: una nota datata, senza riscrivere lo storico.
- **e.** Proiezione HTML dello spine riallineata (layer, AD-3, AD-5, AD-6, AD-11, mappa CAP).
- **f.** Correzione AC 2.4: rimosso il riallineamento di `ui/editor` (zero occorrenze `mis-`), sostituito dalla verifica.

Il codice (`recipe-schema.ts`, `badge.*.json`) **non** si tocca in questo workflow: lo cambia la Story 2.5.

## 5. Handoff di implementazione

**Classificazione: Major.** Riscrive due Architecture Decision (AD-5, AD-11) e ristruttura il backlog di Epic 2 e 3.

| Ruolo | Responsabilità |
|---|---|
| Correct-course (questa sessione, su approvazione) | Applica le modifiche 4.1–4.9 agli artefatti di pianificazione e implementazione. |
| Architect (Winston) | Rilettura di coerenza dello spine rivisto e della proiezione HTML; nessuna nuova decisione aperta. |
| Alessandro | Installare BMad Builder e creare il modulo `penpot-ds` prima della 2.4; commit e PR del branch. |
| SM / create-story | Creare la Story 2.3 (contratti) per prima; rigenerare la 2.6 dal file superato quando arriva il suo turno. |
| Dev (Amelia) | Sviluppare nella sequenza 2.3 → 2.4 → 2.5 → 2.6; test rosso/verde per il criterio di stop e per ogni gate. |

**Criteri di successo.**
1. Nessun artefatto di pianificazione nomina più `puck-components` come proprietario di schemi, classifier o `schemaVersion`, né Hero/Section come blocchi scritti a mano, né Penpot come proprietario della matrice varianti.
2. `sprint-status.yaml` ha Epic 2 in 8 story ed Epic 3 in 5, e nessuna story di Epic 2 dopo la 2.2 è `ready-for-dev`.
3. La Story 2.3 (contratti) si crea da `epics.md` senza bisogno di consultare il forge.
4. Il criterio di stop è un test dello schema (Story 2.5), non una sorveglianza manuale.
