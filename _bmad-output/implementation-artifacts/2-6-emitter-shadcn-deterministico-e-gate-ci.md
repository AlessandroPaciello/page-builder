---
baseline_commit: 73402efc43f39731ce6b512faa03c0f8273a416b
---

# Story 2.6: Emitter shadcn deterministico e gate CI (ex 2.3)

Status: backlog

> ⚠️ **Superata dal correct-course del 2026-09-12** (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-12.md`). Il renderer diventa l'emitter shadcn (Story 2.6) e dipende dalle Story 2.3 (contratti), 2.4 (bootstrap library Penpot) e 2.5 (estrazione adeguata). **Va rigenerata con `bmad-create-story` prima dello sviluppo**: gli AC qui sotto sono quelli pre-correct-course (ricetta con classi `cva`, 4 gate, criterio di stop "albero annidato") e non valgono più. Restano validi e riusabili: Task 0 (alias shadcn in `components.json`), Task 5 (infrastruttura di test di `packages/ui`), la decisione sul Gate 4 (drift condizionale alla raggiungibilità di Penpot da CI) e la disciplina rosso/verde per ogni gate.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a sviluppatore,
I want un renderer puro che applichi la ricetta a una base shadcn,
so that il codice sia riproducibile e il drift design↔codice sia un test rosso invece di una scoperta tardiva (FR2, AD-11).

## Acceptance Criteria

1. **Given** fixture e ricetta committate e la base shadcn del componente **When** eseguo il rendering **Then** il blocco `cva` della ricetta è applicato alla base shadcn e sono prodotti `.tsx` + `.test.tsx` + `.stories.tsx` + `index.ts`, marcati `@generated` con la provenienza (`penpotComponentId` + `fixtureHash`).
2. **And** rigenerare produce **diff zero**, un file senza marker `@generated` non viene mai sovrascritto, e i gate completezza artefatti/rigenerazione (diff zero)/a11y (`vitest-axe`) sono **bloccanti in CI**; il gate drift fixture↔Penpot live è bloccante in CI **se e solo se** il runner CI può raggiungere il server MCP Penpot — se non lo è, resta un gate manuale/nightly con la decisione e il motivo documentati esplicitamente (Task 4, Gate 4), non silenziosamente omesso né finto verde.
3. **And** lo schema è validato su tre componenti di complessità crescente — **Badge** (presentazionale, già estratto in Story 2.2), **Input** (varianti), **Accordion** (composto con headless) — prima di generalizzare; se la ricetta di Accordion smette di essere una tabella piatta e diventa un albero annidato, la story si **ferma** e il regime AD-11 si rivaluta (criterio di stop esplicito, azione retro Epic 1 aperta).

## Tasks / Subtasks

- [ ] Task 0: Prerequisito — disallineamento alias shadcn (AC: #1)
  - [ ] `packages/ui/components.json` ha `aliases.components`/`aliases.ui` che puntano a `@penpot-ds/ui/editor` (il barrel dell'editor, per componenti scritti a mano) — sbagliato per questa story: il renderer deve scrivere in `src/domains/<dominio>/`, mai in `editor/` (Spine#AD-3, confine assoluto verificato da `check-boundaries.mjs`). Questo è il deferred item aperto dalla retro Epic 1 ("Correggere gli alias shadcn in components.json... quando Story 2.4 inizia a usare il CLI shadcn") — **si materializza qui**, non in 2.4, perché AC #1 richiede esplicitamente `npx shadcn add <comp>` per ottenere la base.
  - [ ] Prima di invocare il CLI shadcn per la prima volta, decidi e documenta: (a) correggere `components.json` (`aliases.ui`/`aliases.components` → una destinazione dentro `domains/`, es. una sotto-cartella neutra di staging) e lasciare che il renderer sposti/rinomini il file prodotto nella cartella di dominio corretta (`src/domains/<dominio>/<Comp>.tsx`) con l'header `@generated` aggiunto in un passo separato dal CLI; oppure (b) invocare il CLI con un working-directory/alias temporaneo e spostare il risultato via codice. Verifica le opzioni reali del CLI installato (`pnpm --filter @penpot-ds/ui exec shadcn add --help`, versione `^4.12.0` — **non assumere flag da versioni precedenti**) prima di scegliere. Qualunque sia la scelta, il barrel `editor/index.ts` e i file esistenti in `src/editor/` **non vanno toccati** da questo processo.
  - [ ] `packages/ui/package.json` non ha ancora uno script `test`: nessuna suite gira oggi su questo package (`turbo run test` lo salta silenziosamente, comportamento verificato — non un bug, semplicemente lo script manca). Va aggiunto in questa story (Task 5) insieme a vitest+jsdom+testing-library+vitest-axe.
- [ ] Task 1: Renderer puro (AC: #1, #2)
  - [ ] Nuovo modulo in `packages/scripts/src/` (stesso pattern piatto di Story 2.1/2.2, nessuna sottocartella `render/` di codice — solo se decidi di introdurla, documenta la deviazione dallo Structural Seed come ha fatto Story 2.2 Dev Notes): funzione pura `renderComponent(fixture: ComponentFixture, recipe: ComponentRecipe, shadcnBaseSource: string): GeneratedFiles` — o firma equivalente — che: (a) applica il blocco `cva` della ricetta (base + varianti + defaultVariants) alla base shadcn esistente (parsing/trasformazione del sorgente `.tsx` prodotto da `shadcn add`, non generazione da zero — AC #1 e Dev Notes companion penpot-pipeline.md sono espliciti: "non genera componenti React da zero"); (b) emette `.tsx` (componente con `cva`+`forwardRef`+`cn()`), `.test.tsx` (render + assert varianti, più il gate a11y del Task 4), `.stories.tsx` (una story per asse di variante), `index.ts` (barrel del componente).
  - [ ] Header `@generated` su ogni file emesso, con `penpotComponentId` e `fixtureHash` della ricetta sorgente (stesso valore committato in `<comp>.recipe.json`, Story 2.2) e il comando di rigenerazione (companion penpot-pipeline.md#Convenzione @generated). Stesso input (fixture+ricetta committate, stessa versione della base shadcn) → stesso output **byte per byte** (AC #2): niente timestamp, niente ordine non deterministico negli oggetti serializzati (stesso principio del `fixtureHash`/output Stage 1, Story 2.1).
  - [ ] **Skip protettivo** (companion penpot-pipeline.md#Skip protettivo): un file `@generated` esistente viene sovrascritto; un file **senza** marker (editato a mano, "sganciato" dalla pipeline) non viene **mai** toccato — verifica il marker prima di scrivere, fail-loud se il file esiste senza marker e il contenuto differirebbe (non sovrascrivere in silenzio, ma non è nemmeno un errore: è la modalità "sganciato" prevista dal contratto — semplicemente non scrivere e log dell'skip).
  - [ ] Nessuna decisione di dominio/a11y/headless qui: quella è già congelata nella ricetta (Story 2.2). Il renderer legge, non giudica.
- [ ] Task 2: CLI del renderer (AC: #1)
  - [ ] Entry point `render:component -- <ComponentName>` (stesso stile CLI di `extract-component.ts`, Story 2.2: `node --import tsx src/...`, fail-loud su nome mancante/non trovato). Carica `<comp>.fixture.json`+`<comp>.recipe.json` committati da `packages/scripts/src/recipes/`, invoca il renderer, scrive i 4 file generati nella destinazione di dominio corretta (`packages/ui/src/domains/<dominio>/`, dominio letto dal campo `recipe.domain`).
  - [ ] Comando separato o flag `--check` che rigenera in memoria/tmp e confronta byte-per-byte con i file committati **senza scriverli** — è il gate "Rigenerazione" del Task 4, va costruito qui come funzione pura riusabile, non duplicato nel gate CI.
  - [ ] Come Story 2.2 Task 3: **non** in `turbo.json` come task cacheable per `render:component` (è on-demand, invocato dal developer dopo aver scritto la ricetta); il gate `--check` invece **entra** in CI in questa story (diverso da Story 2.2 dove `validate:recipe` restava manuale — qui il regime cambia: la story esplicitamente introduce i 4 gate CI).
- [ ] Task 3: Estrazione Input e Accordion (AC: #3)
  - [ ] Ripeti il pattern Task 4/5 di Story 2.2 (`component-reader.ts` già generico, riusalo senza modificarne il contratto pubblico) per **Input** (`Input / Legacy`, verificato presente in Penpot in Story 2.2) e **Accordion** (`Accordion / Item`/`Accordion / Default`, verificato presente). Estrai fixture live, scrivi le ricette a mano, valida con `validate:recipe`.
  - [ ] **Input** — complessità "varianti": verifica se introduce assi/pattern non coperti dal Badge (es. stati `error`/`disabled` che nello Stage 1 sono `feedback`/opacity, campo con headless `null` o con parti Radix se il componente Penpot lo giustifica). Se lo schema `RecipeSchema`/`FixtureSchema` di Story 2.2 risulta insufficiente per Input, è una decisione che richiede **conferma esplicita** (non estendere lo schema in silenzio) — stessa disciplina "decision needed" delle code review precedenti.
  - [ ] **Accordion** — complessità "composto con headless" (`@radix-ui/react-accordion` verosimile, da confermare contro quanto Penpot espone): **criterio di stop esplicito di questa story** — se la struttura della ricetta Accordion smette di essere rappresentabile come tabella piatta (assi × celle → cva) e richiede un albero annidato (item→trigger→content con stati propri per livello), **fermati** e non forzare lo schema esistente: è il segnale che il regime fixture/ricetta/renderer di AD-11 va rivalutato per componenti compound, non un problema di implementazione da risolvere con un workaround. Riporta la scoperta come decision-needed nella code review invece di procedere. Azione tracciata nella retro Epic 1 (owner Amelia/Dev) — questa story è il punto di verifica.
- [ ] Task 4: I quattro gate CI (AC: #2)
  - [ ] **Gate 1 — Completezza artefatti**: per ogni recipe committata in `packages/scripts/src/recipes/*.recipe.json`, verifica che esistano i 4 file generati corrispondenti (`.tsx`, `.test.tsx`, `.stories.tsx`, `index.ts`) nella destinazione di dominio attesa.
  - [ ] **Gate 2 — Rigenerazione (diff zero)**: usa la funzione `--check` del Task 2; fallisce nominando il componente e il file che diverge.
  - [ ] **Gate 3 — A11y (`vitest-axe`)**: nuova dipendenza `vitest-axe` (o `jest-axe` se `vitest-axe` risultasse incompatibile con la versione vitest del monorepo — verifica compatibilità prima di installare, non assumere) in `packages/ui`; ogni `.test.tsx` generato include un assert axe (`expect(await axe(container)).toHaveNoViolations()` o equivalente). Verifica conformità a `a11y-baseline.md` (focus visibile, stato testo+colore, ARIA per tipo) per i componenti che li richiedono — Badge minimale/onesto (Story 2.2, nessun ARIA inventato) non ha molto da testare oltre no-violations; Input/Accordion sì.
  - [ ] **Gate 4 — Drift fixture vs Penpot live**: `hash(fixture committata) == hash(Penpot live)` — richiede una lettura live via MCP in CI, il che contraddice "mai in CI" per `extract:component` grezzo (Story 2.2 Dev Notes): il gate NON deve rieseguire l'estrazione completa, solo un hash leggero di verifica. Se il server MCP Penpot non è raggiungibile da CI (verosimile: CI GitHub-hosted non ha accesso alla rete locale/VPN dove gira Penpot), questo gate potrebbe dover restare **manuale/nightly** invece che bloccante su ogni PR — è una decisione architetturale che questa story deve prendere esplicitamente e documentare (non silenziosamente saltare il gate). Se il gate resta bloccante in CI, serve un modo di raggiungere il server Penpot dal runner (tunnel, self-hosted runner, o servizio esposto) — verifica cosa è disponibile prima di assumere che "basti aggiungere uno step".
  - [ ] Wiring: nuovi task `turbo.json` (es. `render:check`, `test:a11y` o integrati nei task esistenti `test`/`lint`) + nuovi step in `.github/workflows/ci.yml`. Segui la disciplina esplicitata nella retro Epic 1 (owner Charlie/Dev, azione aperta): "estendere la disciplina 'test del gate, non solo canary' ai 4 nuovi gate CI di Story 2.3 fin dalla loro introduzione" — ogni gate nuovo deve avere una prova rosso/verde propria (un fixture che viola il gate deve farlo fallire, verificato), non solo il canary manuale "ho provato e sembra funzionare".
- [ ] Task 5: Setup test infra per `packages/ui` (AC: #2)
  - [ ] `packages/ui/package.json`: aggiungi script `test` (`vitest run`), dipendenze `vitest`, `vitest-axe` (o alternativa scelta al Task 4), `@testing-library/react`, `jsdom` — verifica versioni compatibili con React 19/Vitest già pinnate nel `pnpm-workspace.yaml` catalog prima di introdurre versioni ad-hoc (stessa disciplina "riuso, non pin ad-hoc" di Story 2.2 Task 7 su `zod`).
  - [ ] `packages/ui/vitest.config.ts` nuovo, `environment: "jsdom"`, pattern minimale come `packages/api/vitest.config.ts` (Story 1.x) salvo l'aggiunta necessaria per jsdom/setup testing-library.
- [ ] Task 6: Test del renderer (AC: #1, #2)
  - [ ] Test **offline e deterministici** in `packages/scripts/src/` (stesso principio Story 2.1/2.2: nessuna chiamata di rete, fixture Badge/Input/Accordion committate come input): applicazione cva corretta, header `@generated` con provenienza corretta, skip protettivo su file senza marker (test dedicato: un file "sganciato" con contenuto diverso non viene sovrascritto), diff-zero rigenerando due volte di fila la stessa fixture+ricetta.
  - [ ] Test che l'estrazione Input/Accordion non abbia introdotto regressioni sul contratto pubblico di `component-reader.ts`/`recipe-schema.ts` verificato in Story 2.2 (74+ test esistenti restano verdi).
- [ ] Task 7: Wiring repo e documentazione (AC: #1, #2, #3)
  - [ ] `pnpm install` + `pnpm check-types` + `pnpm lint` + `pnpm test` + `pnpm build` verdi a livello repo, inclusi i nuovi gate.
  - [ ] Aggiorna `packages/scripts/README.md` (comando `render:component`, distinzione da `extract:component`/`validate:recipe`) e `deferred-work.md` (chiudi l'item "Input/Accordion restano da estrarre in Story 2.3"; chiudi o aggiorna l'item retro Epic 1 sull'alias shadcn; se il Gate 4 resta manuale/nightly, registra la decisione e il perché).
  - [ ] Aggiorna `_bmad-output/implementation-artifacts/deferred-work.md` con l'esito del criterio di stop su Accordion (superato senza problemi, o innescato — in tal caso la story potrebbe chiudersi parzialmente, vedi Dev Notes).

## Dev Notes

- **Il criterio di stop su Accordion non è opzionale.** L'AC #3 e la retro Epic 1 (azione aperta, owner Amelia/Dev) lo rendono un requisito hard di questa story: se la matrice varianti di Accordion smette di essere una tabella piatta, la risposta corretta è **fermarsi e riportare la scoperta**, non forzare uno schema che non calza. Non anticipare la soluzione nello schema `RecipeSchema`/`FixtureSchema` prima di aver verificato empiricamente la struttura reale di Accordion su Penpot.
- **L'alias shadcn è il primo vero blocco pratico di questa story** (Task 0): `components.json` (`packages/ui/components.json`) ha `aliases.ui`/`aliases.components` → `@penpot-ds/ui/editor`, il barrel dei componenti **scritti a mano**. Se il renderer/CLI scrivesse lì, violerebbe il confine assoluto Spine#AD-3 (`domains/` non importa da `editor/`, ma soprattutto: un componente **generato** finirebbe nella cartella dei componenti **scritti a mano**, invertendo il contratto). Il fix va deciso e documentato prima di invocare il CLI la prima volta, non scoperto a posteriori.
- **Il Gate 4 (drift vs Penpot live) è l'unico dei quattro che richiede raggiungibilità di rete verso il server MCP Penpot dal runner CI.** Gli altri tre (completezza, rigenerazione, a11y) sono puramente offline sui file committati. Non assumere che "aggiungere uno step CI" risolva il problema di rete: verificalo, e se non è risolvibile in questa story, documenta esplicitamente il gate come manuale/nightly con una issue di follow-up, invece di lasciarlo silenziosamente non implementato o fintamente verde.
- **Riuso obbligato da Story 2.2, non reimplementazione:** `component-reader.ts` (lettura Penpot per Input/Accordion), `validate-recipe.ts`/`token-vocabulary.ts` (nessuna modifica prevista: il gate di validazione ricetta è già completo), `recipe-schema.ts` (`FixtureSchema`/`RecipeSchema` — estendere SOLO se Input/Accordion lo richiedono davvero, e documentare la modifica come Story 2.2 ha fatto per gli export di `theme-generator.ts`), `mcp-client.ts` (`withTimeout`/envelope). Il renderer è l'unico modulo davvero nuovo di questa story oltre alle due estrazioni.
- **`@generated` e provenienza:** stesso principio hash di Stage 1 (`fixtureHash` in `theme-generator.ts`, riusato in Story 2.2). Il renderer non inventa un proprio schema di provenienza: usa `penpotComponentId`+`fixtureHash` già presenti nella ricetta committata (Story 2.2, `RecipeSchema`).
- **Non toccare** `packages/domain`, `packages/api`, `packages/auth`, `packages/db`, `packages/env`, `apps/web`, `packages/tokens/` (Stage 1, invariato dal 2.1). Questa story tocca `packages/scripts/src/` (nuovo renderer + estrazioni Input/Accordion), `packages/ui/src/domains/**` (output generato) e, minimamente, `packages/ui/components.json`/`package.json` (Task 0/5), `turbo.json`, `.github/workflows/ci.yml`.
- **`packages/ui` non ha oggi alcuna suite di test** (verificato: `package.json` ha solo `check-types`/`lint`). Introdurla è esplicitamente parte di questa story (Task 5), non un prerequisito mancante da un'altra story.
- **Naming file generati**: segui la stessa convenzione kebab-case già stabilita in `extract-component.ts` (`toKebab`) per i nomi file `<comp>.fixture.json`/`<comp>.recipe.json`; per i componenti React generati usa PascalCase (`Badge.tsx`, non `badge.tsx`) coerente con le convenzioni React/shadcn esistenti in `packages/ui/src/editor/` (es. `button.tsx` è minuscolo lì per scelta di quel barrel — verifica quale convenzione shadcn CLI applica di default ai file scritti in `domains/` e non introdurre un'incoerenza tra le due cartelle senza motivo).

### Project Structure Notes

- File nuovi previsti in `packages/scripts/src/` (piatti, stesso pattern Story 2.1/2.2 — deviazione già accettata dallo Structural Seed):
  ```
  packages/scripts/src/
    render-component.ts       # NUOVO — renderer puro: fixture+ricetta+base shadcn → 4 file @generated
    render-component.test.ts  # NUOVO
    render-cli.ts (o esteso extract-component.ts con un terzo mode "render") # NUOVO/scelta da documentare
    recipes/
      input.fixture.json      # NUOVO — Task 3
      input.recipe.json       # NUOVO — Task 3
      accordion.fixture.json  # NUOVO — Task 3 (se il criterio di stop non si attiva)
      accordion.recipe.json   # NUOVO — Task 3 (idem)
    # invariati da Story 2.1/2.2, non toccare il contratto pubblico:
    recipe-schema.ts, token-vocabulary.ts, validate-recipe.ts,
    component-reader.ts, mcp-client.ts, extract-component.ts
  ```
- Output generato in `packages/ui/src/domains/<dominio>/` (dominio da `recipe.domain`: Badge → `data-display/`, Input → `inputs/`, Accordion → `layout/` per design-system.md#ui/domains). `packages/ui/src/domains/index.ts` è oggi `export {}` vuoto — **attenzione a un disallineamento tra due fonti**: il commento nel file dice esplicitamente "volutamente vuota fino alla Story 2.4", ma l'AC #1 di **questa** story (2.3) richiede che il renderer produca file `.tsx` reali per Badge/Input/Accordion, e l'epics.md di Story 2.4 descrive quella story come "genero i componenti per **i sei domini**" (la generalizzazione), non come "il primo popolamento". Lettura più coerente con gli AC: **2.3 popola `domains/` per i 3 componenti di validazione**, 2.4 generalizza al catalogo completo — ma verificalo esplicitamente prima di scrivere codice (non assumere), e se questa lettura è corretta il commento in `domains/index.ts` è stale e va aggiornato come parte del Task 1 (non lasciarlo a dire "fino alla Story 2.4" se la story 2.3 lo popola già).
- `packages/ui/components.json` e `package.json` modificati per Task 0/5 (alias + script test + dipendenze). Nessuna migrazione DB, nessun cambiamento a `packages/tokens/`, `apps/web`.

### Testing Requirements

- Renderer: test **offline e deterministici** (nessuna chiamata Penpot/rete), fixture+ricette committate come input — stesso principio Story 2.1/2.2.
- Estrazione Input/Accordion: il server MCP Penpot live è invocato **una sola volta per componente**, manualmente, per popolare le fixture — mai da un test (stesso principio Story 2.2).
- Nuova suite `packages/ui` (Task 5/Gate 3): `vitest` + `jsdom` + `@testing-library/react` + assert axe su ogni componente generato.
- Non-regressione repo: `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` verdi dopo l'aggiunta dei nuovi file e gate (pattern osservato in tutte le story precedenti).
- Ogni nuovo gate CI deve avere una prova rosso/verde propria (retro Epic 1, azione aperta) — non solo un canary manuale.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Renderer deterministico e gate CI] — user story e AC originali.
- [Source: _bmad-output/specs/spec-page-builder/penpot-pipeline.md#Stadio 2, #Renderer, #Skip protettivo, #Gate di verifica, #Convenzione @generated] — contratto dettagliato del renderer, i 4 gate, la convenzione di provenienza.
- [Source: _bmad-output/specs/spec-page-builder/design-system.md#ui/domains, #Layering e confini] — tabella domini/componenti, regola di confine assoluta domains↔editor.
- [Source: _bmad-output/specs/spec-page-builder/a11y-baseline.md] — requisiti ARIA/focus/stato per il Gate 3 (a11y).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-11, #AD-3, #Structural Seed] — regime fixture→ricetta→renderer, confine domains/editor, layout target.
- [Source: packages/ui/components.json] — alias shadcn attuali (`aliases.ui`/`aliases.components` → `@penpot-ds/ui/editor`), disallineamento da correggere (Task 0).
- [Source: packages/ui/package.json, packages/ui/src/domains/index.ts] — stato attuale: nessun test script; barrel domains vuoto, ma il suo commento ("fino alla Story 2.4") va riconciliato con l'AC #1 di questa story prima di procedere (vedi Project Structure Notes).
- [Source: .github/workflows/ci.yml, turbo.json] — pipeline CI/build attuale, punto di innesto dei 4 nuovi gate.
- [Source: _bmad-output/implementation-artifacts/2-2-estrazione-componenti-e-schema-delle-ricette.md#Dev Notes, #Review Findings] — pattern component-reader/CLI/schema da riusare; deferred item su verifica incrociata ricetta↔fixture (rilevante per il Gate 2/rigenerazione: se la ricetta diverge dalla fixture, il renderer emetterebbe codice sbagliato in silenzio — valutare se questa story deve chiudere anche quel deferred item o lasciarlo per dopo).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 1-1..., #Register: note di pipeline (Story 2.2)] — alias shadcn (retro Epic 1), pattern hex-match, mappa cella↔board, Input/Accordion presenti in Penpot ma non ancora estratti.
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-09-06.md (action_items in sprint-status.yaml)] — le due azioni esplicitamente mirate a questa story: disciplina "test del gate" estesa ai 4 gate CI (owner Charlie/Dev), sorveglianza del criterio di stop su Accordion (owner Amelia/Dev).
- [Source: pnpm-workspace.yaml] — catalog versioni da riusare per eventuali nuove dipendenze (`vitest-axe`/`@testing-library/react`/`jsdom`), verificare compatibilità prima di pinnare versioni ad-hoc.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
