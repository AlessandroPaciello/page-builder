---
title: 'Prerequisiti della prova con la v3'
type: 'bugfix'
ticket: '31'
created: '2026-11-03'
status: 'done'
baseline_revision: '6a0d504e2e8e5f08283b7c4cc15c926affa4110d'
route: 'full'
route_source: 'auto'
risk: low
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `buildOrder` e `letturaName` risolvono solo i contratti di componente: una lettura `carousel@1` risponde «contratto sconosciuto» con ordine vuoto, e un layer che non si chiama come la sezione fa scrivere il generatore nella cartella sbagliata. Inoltre nessun test compila gli output del generatore (`styles.ts`, `stories.tsx`, scaffold) con `tsc` né li passa allo smoke delle story: il controllo della 2.22 è stato fatto una volta a mano.

**Approach:** la risoluzione `pluginData.contract` → definizione diventa unica nel nucleo e conosce componenti e sezioni; `buildOrder`, `letturaName` e il server la usano, e l'ordine non conta gli esempi degli slot come dipendenze. Si aggiunge un test che genera un componente e la sezione Carousel, ne compila l'output con `tsc` e lo passa allo smoke delle story.

## Boundaries & Constraints

**Always:** una sola funzione risolve il contratto per tutti; per le letture di componente i blocchi restano identici a oggi; un nome presente in entrambi i registri è un blocco; il nucleo resta puro; il test pulisce in `finally` e non scrive sotto `src/`.

**Never:** rinominare `product-card` in `shop-card` (2.40); cambiare la definizione Carousel o il suo disegno (2.41); dipendere dagli esempi dello slot; toccare i file generati committati; aggiungere dipendenze MCP al test.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| sezione da sola | `buildOrder([carouselLettura()], [], CONTRACTS, SECTIONS)` | `order: ["carousel"]`, `findings: []` | nessuno |
| nome dal contratto | layer `Prodotti`, `contract: carousel@1` | `letturaName` → `carousel`, cartella `domains/carousel/` | nessuno |
| conflitto di nomi | nome in entrambi i registri | blocco «è sia un contratto … sia una sezione» | blocco, ordine vuoto |
| sconosciuto | `contract: "widget@1"` | blocco che elenca contratti **e** sezioni | blocco |
| generati compilano | badge + carousel generati | `tsc --noEmit` esce 0, le story rendono | rosso se un file non compila |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/core/verify.ts` — `contractOf` (r.137), `resolveDefinition` (r.906, già sa delle sezioni), `CoreInput.sections` (r.29).
- `packages/scripts/src/core/build-order.ts` — `letturaName` (r.23), `instancesOf` (r.33), `buildOrder` (r.50).
- `packages/scripts/src/core/section.ts` — `sectionContract` (r.63), `slotOf` (r.175).
- `packages/scripts/src/server/server.ts` — `PdsServerOptions` (r.61), `coreContext` (r.109), `letturaName` (r.150, r.172), `buildOrder` (r.161).
- `packages/scripts/tests/core/build-order.test.ts`, `…/server/server.test.ts` — prove; fixture `adapter()`, `LETTURE`, `tempRoot()`.
- `packages/scripts/tests/fixtures/{components,sections}.ts` — `CONTRACTS`, `badgeLettura()`, `SECTIONS`, `carouselLettura()`.
- `packages/ui/src/stories.smoke.test.tsx` — `hasArgs` e `composeStories`, le asserzioni da replicare.
- `packages/ui/src/generated-output.test.tsx`, `packages/ui/package.json` — test nuovo e devDependency `@penpot-ds/scripts`.

## Tasks & Acceptance

**Execution:**
- [x] `verify.ts` — estrae `definitionOf(value, contracts, sections)` → `{component?, section?, problem?}` con i messaggi di oggi, usata da `resolveDefinition` — un solo punto di risoluzione.
- [x] `section.ts` — estrae `slotCandidatesOf(layer, section)` da `slotOf` ed espone `isSlotLayer(layer, section)` — la regola degli esempi resta una.
- [x] `build-order.ts` — `buildOrder` e `letturaName` accettano `sections = SECTION_DEFINITIONS`, usano `definitionOf` e saltano i layer slot; le istanze annidate restano sui soli contratti.
- [x] `server.ts` — `PdsServerOptions.sections` (default `SECTION_DEFINITIONS`) passato a `coreContext`, `letturaName` e `buildOrder`.
- [x] `build-order.test.ts` — rossi: sezione da sola, nome dal contratto, slot che non conta, sconosciuto che elenca anche le sezioni.
- [x] `server.test.ts` — `LETTURE.carousel` + `build_order` sulla sezione; `generate_component` con un layer rinominato scrive in `domains/<contratto>/`.
- [x] `packages/ui/src/generated-output.test.tsx` — genera badge e carousel in `packages/ui/tmp/generated-<rand>/` (stub `lib/utils.ts` e `product-card/ProductCard.tsx`), `tsc --noEmit -p` sul tsconfig che estende `packages/ui/tsconfig.json`, importa le story e ripete le asserzioni dello smoke, `finally` rimuove la cartella.
- [x] `packages/ui/package.json` — `@penpot-ds/scripts: workspace:*` nei devDependencies.

**Acceptance Criteria:**
- Given `pnpm check-types`, when la build gira, then resta verde e il test nuovo compila nell'ambito di `packages/ui`.
- Given i test nuovi, when girano prima della correzione, then falliscono per la ragione giusta (sezione sconosciuta, nome del layer); l'esito va in Implementation Notes.
- Given `pnpm check-types && pnpm lint && pnpm test`, when tutto è applicato, then sono verdi.

## Implementation Notes

- `definitionOf` in `verify.ts` è l'unico punto: `resolveDefinition` gli antepone `Contratto: `, quindi i blocchi di una lettura di componente restano identici a oggi tranne l'elenco delle sezioni («i contratti sono […], le sezioni sono […]»), che è il cambiamento voluto. `letturaName` e `buildOrder` usano la stessa funzione: il nome viene da `component.name` o `section.name`, mai dal nome del layer.
- `slotCandidatesOf`/`isSlotLayer` sono la sola regola degli esempi: `slotOf` costruisce i `Finding` sui candidati (blocco per id dichiarato sconosciuto, domanda per più candidati) e `buildOrder` salta i figli di un layer slot. `isSlotLayer` è vero solo con un candidato vero: uno `pluginData.slot` che non esiste nella sezione non nasconde i figli (il blocco lo dà `slotOf`, le dipendenze restano visibili a `buildOrder`).
- In `buildOrder` le dipendenze annidate continuano a risolversi sui soli contratti (`contractOf`); il salto degli slot si applica solo quando la lettura è una sezione (`found.section`), così le letture di componente non cambiano comportamento.
- `PdsServerOptions.sections` (default `SECTION_DEFINITIONS`) va a `coreContext` (quindi a `verify_component` e `generate_component`), a `letturaName` e a `buildOrder`. Con un layer `Prodotti` e `contract: carousel@1`, `generate_component` scrive in `domains/carousel/` e non rifiuta più i `Change` come «fuori dalla cartella del componente».
- Rosso prima della correzione, provato con `git stash push -- packages/scripts/src` e i soli due file di test: 6 fallimenti, per la ragione giusta.
  - `build-order.test.ts`: la sezione da sola dava `order: []` con «contratto "carousel@1" sconosciuto»; `letturaName` dava `prodotti` invece di `carousel`; il nome in entrambi i registri veniva risolto sul contratto e poi bloccato da `Istanza annidata "product-card@1"`; il messaggio dello sconosciuto non conteneva «le sezioni sono [carousel]».
  - `server.test.ts`: `build_order` su Carousel era «sconosciuto» con ordine vuoto; `generate_component` sul layer rinominato falliva con `Change non validi per "prodotti" — … fuori dalla cartella del componente packages/ui/src/domains/prodotti/`.
- `packages/scripts/tests/generated-output.test.tsx` (spostato qui dopo il rosso della CI: vedi sotto) genera con il nucleo (niente MCP), scrive in `packages/scripts/tmp/generated-*` mappando i `Change` da `DOMAINS_DIR`, aggiunge gli stub `lib/utils.ts` e `domains/product-card/ProductCard.tsx` e un `tsconfig.json` che estende `../../tsconfig.json` con `include` sui soli file della prova; gira in `jsdom` (`// @vitest-environment`). `tsc` si esegue con `process.execPath` + `require.resolve("typescript/bin/tsc")` (niente PATH). Le story si importano a runtime (Vitest le trasforma) e si ripetono le asserzioni dello smoke (`hasArgs`, `composeStories`, render). Entrambi i test rimuovono la cartella in `finally`; non si scrive sotto `src/`.
- Il test rosso permanente del secondo pezzo è una copia mutata di `Badge.styles.ts` (`const mutato: number = "non un numero";`): `tsc` esce diverso da 0 e nomina il file, come il red-proof dello smoke.
- Il test è rimasto in `packages/ui` solo per un commit: la CI docker è diventata rossa (`@app/contracts#check-types`, `Cannot find module 'vitest'`). `@penpot-ds/scripts` è una devDependency di `@penpot-ds/ui`, quindi `turbo run build --filter=web` includeva `@app/contracts` nel grafo, che nel `deps` stage del Dockerfile non ha né manifest né `node_modules`. La correzione è togliere quel legame: il test sta nel package del generatore (`tests/generated-output.test.tsx`, con `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@storybook/react`, `@testing-library/react`, `jsdom`, `class-variance-authority` come devDependencies di `@penpot-ds/scripts`, e `jsx`/`DOM` nel suo `tsconfig`). `turbo run build --filter=web --dry=json` ora non contiene `contracts` né `scripts`.
- `pnpm test` alla root richiede il DB avviato con `pnpm db:start`: `@app/db` ha due test di integrazione che senza Postgres falliscono (comportamento preesistente, non della story). Con il DB avviato il gate è verde.

## Plan Change Log

## Review Triage Log

**Pass 1 — quick (2026-11-03)**

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | `tools.ts`: descrizioni di `name` e `build_order` parlano solo di componenti, mentre ora accettano anche le sezioni | low | patch | Confermato: `packages/scripts/src/server/tools.ts:11,31,50` dicono «Il componente» / «I componenti»; `src/server/README.md:29` (nello stesso diff) dice il contrario e rimanda a `tools.ts` come contratto d'ingresso. Nessun test copre le descrizioni. Danno solo per chi legge lo strumento (agente), non per l'output. |
| 2 | `letturaName` ricade sul nome del layer quando `definitionOf` dà un problema; il test del conflitto passa per coincidenza | low | patch | Confermato in `build-order.ts:62-63` e `verify.ts:174-176`: nel conflitto non c'è `component`/`section`, quindi `kebabOf`. Nessun output utente sbagliato (la generazione è bloccata prima di scrivere e `existingTsx` manca), ma il README appena scritto afferma «nome dal contratto, mai dal layer» e il test usa un layer già chiamato `Carousel`. |
| 3 | Il blocco per nome duplicato dice «contratto … un contratto è un componente solo» anche per una sezione | low | patch | Confermato in `build-order.ts:81-83`: `name` viene da `found.section` quando la lettura è una sezione; nessun test con due letture della stessa sezione. Messaggio falso in un caso di blocco. |
| 4 | `isSlotLayer` è vero per un `pluginData.slot` dichiarato ma sconosciuto: `buildOrder` salta i figli senza esito | low | patch | Confermato: `section.ts:199-202` (`declared !== undefined`) e `build-order.ts:50`; `slotOf` è invocato solo da `verifyComponent` (`verify.ts:557`), mai da `buildOrder`. L'ordine risulta pronto per una sezione che la generazione bloccherà, e le dipendenze reali dei figli spariscono. Fix diretto: candidato esistente, più un test. |

**Esito:** 4 patch applicate dall'implementer (tools.ts, messaggio del nome duplicato, `isSlotLayer` sui soli candidati reali, test del conflitto con layer rinominato + frase del README). Rilanciate le verifiche: `pnpm check-types` 11/11, `pnpm lint` 7/7, `pnpm test` 8/8 (con DB), `@penpot-ds/scripts` 609 passati, `@penpot-ds/ui` 41 passati.

## Design Notes

- Il test compila in `packages/ui` perché i generati importano `../../lib/utils` e bare `react`, `class-variance-authority`, `@storybook/react`: solo lì la risoluzione è quella vera. La root temporanea sta in `packages/ui/tmp/` (già in `.gitignore`) con gli stub citati dai generati.
- Rosso del secondo pezzo: se badge e Carousel compilano già, il gate si prova sensibile con una copia mutata di uno `styles.ts`, come il «red-proof» dello smoke.
- Decision: gli esempi di uno slot non sono dipendenze dell'ordine; la Carousel generata importa comunque `../product-card/ProductCard` e quel buco lo chiude la 2.41, dopo la 2.40.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` — nucleo, server, compilazione e smoke dei generati (rossi prima e verdi dopo)
- `pnpm --filter @penpot-ds/ui test` — smoke e axe delle story committate
- `pnpm check-types && pnpm lint && pnpm test` — gate completo
