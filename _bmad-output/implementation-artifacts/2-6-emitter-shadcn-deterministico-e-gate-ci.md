---
title: 'Emitter shadcn deterministico e gate CI'
type: 'feature'
created: '2026-09-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
  - '{project-root}/_bmad-output/specs/spec-page-builder/design-system.md'
baseline_commit: 'e7a3b5ef5309a3503dce882570f5ab4d41c1125f'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** le ricette committate (Badge, Input, AccordionItem, Story 2.5) non producono alcun componente React: manca l'emitter shadcn che traduca fixture+ricetta+binding in codice deterministico, e non esistono i gate CI del regime (completezza, rigenerazione, a11y, conformità al contratto, drift) — il drift design↔codice oggi si scopre a mano, non è un test rosso (FR2, AD-11).

**Approach:** emitter puro che instrada gli assi per tipo (`option` → `cva`; `state` → prefissi `focus-visible:`/`aria-invalid:`/`disabled:`; `behavior` → `data-[state=…]:`), parte da una base shadcn (`shadcn add`) e deriva le classi dalla stessa funzione di nome dello Stadio 1; emette `.tsx` + test + story + barrel marcati `@generated` con provenienza (`penpotComponentId` + `fixtureHash`), rigenerazione a diff zero, skip protettivo sui file senza marker. I 5 gate diventano bloccanti in CI (drift condizionale alla raggiungibilità di Penpot), ognuno con prova rosso/verde. Validazione su Badge, Input, AccordionItem prima di generalizzare; Accordion Root non è una ricetta (è una definizione di sezione).

## Boundaries & Constraints

**Always:** stesso input (fixture+ricetta+binding+base committate, stessa versione della base) → stesso output **byte per byte**, nessun timestamp né ordine non deterministico. Il marker `@generated` con provenienza e comando di rigenerazione su ogni file emesso; file senza marker mai sovrascritto (skip con log, non errore). Classi derivate da `varSuffix`/`varName` di `theme-generator.ts` (variabile CSS e classe non possono divergere) e validate contro `buildTokenVocabulary`; literal sempre rifiutato. Ogni gate con prova rosso/verde propria (un input che lo viola lo fa fallire, testato). Dominio di destinazione letto da `recipe.judgment.domain`. Copertura test di `packages/scripts` non scende.

**Never:** l'emitter non genera componenti React da zero (la struttura, le parti Radix e il comportamento a11y vengono dalla base shadcn); non decide dominio/a11y/headless (già congelati in ricetta e binding — legge, non giudica); non tocca `packages/contracts`, `packages/tokens`, `theme-generator.ts`, `penpot-reader.ts`, `generate-theme.ts`, `mcp-client.ts`, `packages/ui/src/editor/**`, `packages/domain`, `packages/api`, `apps/web`; niente estrazioni Penpot in CI/build (drift solo via gate con seam offline); nessuna estensione silenziosa di `RecipeSchema`/`FixtureSchema` (eventuali estensioni = decisione esplicita).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rendering Badge/Input/AccordionItem | fixture+ricetta+binding+base committate | 4 file `@generated` in `packages/ui/src/domains/<domain>/`, assi instradati per tipo | N/A |
| Rigenerazione diff zero | stesso input, secondo run | output byte-identico (gate `--check`) | exit ≠ 0 nominando componente e file divergente |
| File senza marker modificato | target esiste senza `@generated`, contenuto divergerebbe | skip protettivo, log, zero scrittura | non è un errore |
| Binding per assi tipizzati | asse `option`/`state`/`behavior` del contratto | cva varianti / pseudo-classi+aria / `data-[state=…]:` | asse senza tipo nel binding → fail-loud nominativo |
| Drift fixture vs Penpot live | hash fixture committata vs hash live | gate segnala quale componente riestrarre | Penpot irraggiungibile → skip documentato, mai finto verde |

</frozen-after-approval>

## Decisioni (2026-09-12, Alessandro — fuori frozen)

- **Base shadcn:** basi committate -- `shadcn add` eseguito una tantum per i 3 componenti, le basi sono input dell'emitter; il CLI non gira a runtime.
- **Alias shadcn:** opzione (a) -- `components.json` riallineato verso una directory in `domains/`; l'emitter riposiziona il file e aggiunge l'header `@generated`. Prima della prima invocazione si verificano i flag reali di `shadcn@4.15.0` (nessun assunto da versioni precedenti).
- **Gate drift in CI:** opzione (a) -- bloccante se e solo se il runner raggiunge il server MCP Penpot; altrimenti manuale/nightly con decisione e motivo documentati. Lo script esiste comunque, con seam offline e prova rosso/verde.

## Code Map

- `packages/scripts/src/recipe-schema.ts` -- `FixtureSchema`/`RecipeSchema`/`JudgmentSchema`, `ComponentFixture`/`ComponentRecipe`; le ricette NON portano il tipo di asse: va letto da `COMPONENT_CONTRACTS`.
- `packages/contracts/src/contract.ts` + `registry.ts` + `components/{badge,input,accordion-item}.ts` -- `Axis.type` (`option`/`state`/`behavior`), `Axis.values`, `contractId`, `COMPONENT_CONTRACTS` = badge/input/accordionItem; parti piatte.
- `packages/scripts/src/token-vocabulary.ts` -- `buildTokenVocabulary(catalog)`, `TYPE_UTILITY_PREFIXES`, `STRUCTURAL_CLASSES`, `validateClassesAgainstVocabulary`: vocabolario per validare le classi emesse.
- `packages/scripts/src/theme-generator.ts` -- `varSuffix`/`varName` (contratto 1:1 nome variabile CSS ↔ classe Tailwind, da riusare per derivare le classi dai token), `fixtureHash` (sha256 del catalogo, 12 hex), `TokenCatalog`.
- `packages/scripts/src/validate-recipe.ts` -- gate pura `validateRecipe(fixture, recipe, catalog, judgment)` (conformance assi/valori/parti + ricetta↔fixture + judgment): base del Gate conformità al contratto, da riusare senza duplicare.
- `packages/scripts/src/extract-component.ts` -- pattern CLI (`parseArgs`/`isDirectInvocation`/`main` + `process.exit`), `writeAtomic`, `toKebab`, `loadJudgment`, `buildRecipe` (provenienza `fixtureHash`); `recipes/<kebab>.{fixture,recipe}.json` committati.
- `packages/scripts/src/library/{library-reader,library-snapshot,mcp-client}.ts` -- `readLibrarySnapshot({endpoint?, callTool?})` con seam offline: base del Gate drift (lettura leggera live, hash, confronto con fixture committata; mai estrazione completa).
- `packages/scripts/src/recipes/*.json` + `judgments/*.json` -- i tre artefatti (badge: option×2 assi; input: asse `state` con `aria-invalid`, focus; accordion-item: asse `behavior` open/closed, headless Radix Accordion, 7 parti) — i tre casi di instradamento.
- `packages/ui/` -- nessuna suite test oggi (solo `check-types`/`lint`); `components.json` alias → `@penpot-ds/ui/editor` (da riallineare, Task 0 — decisione frozen: opzione a); `src/domains/index.ts` barrel vuoto con commento stale da aggiornare; `class-variance-authority ^0.7.1` già dipendenza; `shadcn ^4.12.0` (lockfile 4.15.0) devDep; cva pattern di riferimento in `src/editor/button.tsx`.
- `packages/ui/scripts/check-boundaries.mjs` -- confine domains/lib/hooks → editor, già wired su `lint`: i file generati in `domains/` non devono importare da `editor/`.
- `packages/api/vitest.config.ts` -- pattern minimale vitest config (riferimento per la nuova suite `packages/ui` con jsdom).
- `pnpm-workspace.yaml` catalog -- versioni da riusare (vitest ^5, react 19, zod ^4.4.3, tsx); jsdom/@testing-library/vitest-axe NON in catalog: da aggiungere verificando compatibilità React 19/Vitest 5.
- `.github/workflows/ci.yml` + `turbo.json` -- job `ci` (check-types → lint → build → test → drift prisma): punto di wiring dei nuovi gate; `test` turbo è `cache: false`.
- `packages/tokens/src/tailwind-theme.css` + `theme-generator.ts` header -- convenzione `@generated` esistente (`REGEN_COMMAND`) da seguire.

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/components.json` -- Task 0: riallinea gli alias shadcn verso una directory in `domains/` (decisione frozen: opzione a); verifica prima i flag reali di `shadcn@4.15.0`; non toccare `src/editor/**`. -- sblocca ogni uso del CLI; chiude il deferred item retro Epic 1.
- [x] `packages/scripts/src/emitter/binding-shadcn.ts` (+ schema Zod `BindingSchema`) -- Task 1: tabella di binding per componente (committata: `src/emitter/bindings/<kebab>.binding.json`) che dichiara componente base shadcn, parti ricetta → parti libreria, headless, valori d'asse → API. -- AD-11: emitter+binding = tutto ciò che dipende dalla libreria.
- [x] `packages/scripts/src/emitter/render-component.ts` (+ `.test.ts`) -- Task 2: funzione pura `renderComponent(fixture, recipe, binding, shadcnBaseSources)` → file emessi; instrada assi per tipo leggendo `Axis.type` dai contratti, deriva classi con `varSuffix`/`varName`, valida col vocabolario; emette `.tsx`/`.test.tsx`/`.stories.tsx`/`index.ts` con header `@generated` (provenienza + comando rigenerazione); skip protettivo; `renderCheck` = confronto byte-per-byte in memoria. -- cuore della story.
- [x] `packages/scripts/src/emitter/render-cli.ts` (+ `.test.ts`) -- Task 3: CLI `render:component -- <Name> [--check] [--base <dir>]` sul pattern `extract-component.ts` (fail-loud, `isDirectInvocation`, write atomico); `--check` riusa `renderCheck` senza scrivere. -- AC #1.
- [x] basi shadcn `packages/scripts/src/emitter/bases/<kebab>/` -- Task 4: esegui `shadcn add` una tantum per badge/input/accordion, committa le basi come input dell'emitter. -- decisione frozen: basi committate, CLI mai a runtime.
- [x] `packages/ui/src/domains/{data-display,inputs,layout}/` + `src/domains/index.ts` -- Task 5: genera e committa i file di Badge, Input, AccordionItem; aggiorna il commento stale del barrel. -- AC #3.
- [x] `packages/ui/package.json` + `vitest.config.ts` + test generati -- Task 6: script `test` (vitest+jsdom+testing-library+vitest-axe da catalogo o versioni verificate); ogni `.test.tsx` generato include assert axe. -- Gate a11y.
- [x] `packages/scripts/src/emitter/gates.ts` (+ `.test.ts`) -- Task 7: le 5 gate come funzioni pure (completezza, rigenerazione via `renderCheck`, a11y = esito suite ui, conformità = riuso `validateRecipe`, drift = `readLibrarySnapshot` live vs hash fixture, con seam e skip documentato se irraggiungibile). -- AC #2.
- [x] `turbo.json` + `.github/workflows/ci.yml` + `packages/{ui,scripts}/package.json` -- Task 8: wiring `render:check` e suite ui in CI; script `gates:render`; ognuna prova rosso/verde propria. -- AC #2.

**Acceptance Criteria:**
- Data fixture+ricetta+binding+base committate, quando eseguo `render:component -- Badge|Input|AccordionItem`, allora gli assi sono instradati per tipo (option → cva; state → `focus-visible:`/`aria-invalid:`/`disabled:`; behavior → `data-[state=…]:`) e sono prodotti 4 file `@generated` con `penpotComponentId`+`fixtureHash` in `packages/ui/src/domains/<domain>/`.
- Quando rigenero, allora diff zero; un file senza marker non è mai sovrascritto; i gate completezza/rigenerazione/a11y/conformità sono bloccanti in CI e il drift è bloccante se e solo se il runner raggiunge Penpot, altrimenti manuale/nightly con decisione documentata; ogni gate ha prova rosso/verde.
- Quando valido sui tre componenti, allora Badge (presentazionale), Input (varianti/state) e AccordionItem (behavior + headless Radix) passano; Accordion Root non è trattato come ricetta.

## Implementation Notes

*(2026-09-12, implementazione — decisioni e scostamenti documentati, nessuno tocca il frozen.)*

- **Flag reali `shadcn@4.15.0`** (verificati a runtime, nessun assunto): `add [-y] [-o] [-c <cwd>] [-a] [-p <path>] [-s] [--dry-run] [--diff] [--view]`; il CLI chiede interattivamente la **libreria headless** (Base UI / React Aria / Radix UI) e il framework al primo run. Lo style `base-lyra` del `components.json` del repo PINA Base UI (`@base-ui/react/*`), incompatibile col giudizio committato `@radix-ui/react-accordion`: le basi sono state generate con style `new-york` + libreria **Radix UI** in un progetto temporaneo, poi committate.
- **Basi committate con due allineamenti documentati** (il resto è byte-fedele all'output del CLI): (1) import headless → `import * as AccordionPrimitive from "@radix-ui/react-accordion"` — il package unificato `radix-ui` prodotto dal CLI non espone `Accordion.Item` tipizzato e diverge dal giudizio; (2) import `cn` → `@/lib/utils` — il gate di confine di `scripts` vieta il literal `@penpot-ds/ui` in `src/`; l'emitter emette l'import reale dal suo template (specie assemblato in costante, stessa ragione). L'emitter riusa l'import headless dalla base VERBATIM (`extractImport`): la base è input effettivo, non decorazione.
- **Firma `renderComponent`**: il catalogo è un 5° parametro (`fixture, recipe, binding, shadcnBaseSources, catalog, options?`) — la derivazione classi richiede i tipi token per `varSuffix`; la firma della spec era indicativa.
- **`strokeWidth`/`opacity`** (tipi senza namespace utility v4, decisione review 2.1): NON emessi come classi né come inline style — **skip con log** a ogni render (`skippedProperties`), deterministico; il consumo `var()` inline resta del binding/consumatore. Un inline style non esprimerebbe i prefissi di stato (`disabled:`).
- **Fattorizzazione cva**: ogni proprietà è assegnata all'UNICO asse che la influenza (confronto fra celle che differiscono solo per quell'asse); due assi sulla stessa proprietà → fail-loud (interazione non esprimibile in cva). Il default dell'asse va unprefissato nelle classi base, i valori non default nei delta/prefissi. Assenza di una proprietà in una cella non-default è esprimibile (nessuna classe) solo se assente anche dal default (altrimenti sarebbe una rimozione → fail-loud).
- **AccordionItem committato senza classi `data-[state=open]:`**: la ricetta estratta ha open == closed per OGNI parte (il design non differenzia) — fedeltà alla fixture; l'instradamento `behavior` è provato dai test con ricetta sintetica (`data-[state=open]:bg-muted`). Accordion Root non è trattato come ricetta: nessun binding/ricetta, la base lo contiene solo come contesto.
- **`testProps` nel binding**: props API richieste dalla libreria ma non espresse dal contratto (es. `value` di Radix Accordion single-mode) — usate nei render di test/story; è conoscenza libreria → binding.
- **Gate a11y nel CLI**: la suite ui gira per `cwd` sul package ui (non `--filter` col nome package) per non introdurre il literal `@penpot-ds/ui` in `scripts/src` e mantenere integro il confine scripts.
- **Stories**: CSF-shaped senza `@storybook/react` (assente dal repo); l'import si aggiungerà quando storybook entra.
- **Node**: repo richiede ≥22.13 (`.nvmrc` 22.23.1); su Node 20 falliscono postinstall prisma e jsdom 30 (require(esm)) — limitazione ambiente locale, pre-esistente.
- **Drift gate verificato VERDE contro Penpot live reale** durante lo sviluppo (server MCP raggiungibile, fixture allineate); lo skip documentato è provato dai test con seam.

## Spec Change Log

## Review Triage Log

**Loop 1 — 2026-09-12, 3 layer (blind-hunter, edge-case-hunter, verification-gap):**

- BH#1 (numerazione gate autocontraddittoria: header `gates-cli.ts` dice conformità=1, corpo e `gates.ts` dicono completezza=1/conformità=4) — verificato: il commento d'header di `gates-cli.ts` usa un ordine diverso da corpo, `gates.ts`, test e tabella del companion. Solo documentazione, ma fuorviante per il lettore dei gate. — `patch` (allineare l'header all'ordine canonico del companion: completezza, rigenerazione, a11y, conformità, drift).
- BH#2 (decisione drift "manuale/nightly" senza meccanismo: nessun workflow schedulato, timeout 15s bruciato a ogni PR) — verificato: nessun `schedule:` nei workflow. Ma la decisione frozen richiede "decisione e motivo documentati" (fatto: commento CI + skip nominativo), non un cron; aggiungerlo è nuova superficie CI non richiesta. — `low`, rifiutato.
- BH#3 (`checkDrift` qualunque errore di `fetchLive` → skip, anche bug del reader) — verificato in `gates.ts`: catch-all → `skipped`. Il messaggio afferma "Penpot irraggiungibile" per QUALSIASI errore: affermazione non onesta per errori non di connessione. Un skip è comunque etichettato e non un verde finto; non distinguere le classi d'errore al seam è robusto. — `patch` (solo wording: il motivo deve dire "lettura live fallita", non "irraggiungibile", senza fingere una classificazione che il seam non può fare).
- BH#4 + VG-main-1 (lista COMPONENTS hard-coded in `gates-cli.ts`, `gates.test.ts`, script `render:check` e story: un componente nuovo esce dai gate in silenzio) — verificato dal VG con ricerca (nessun test lega la lista alle `*.recipe.json` committate) e dimostrazione (Story 2.7 aggiunge Select → gate tutti verdi senza vederlo). Erode l'invariante centrale della story. — `patch` (derivare la lista da `recipes/*.recipe.json` + test di copertura gate↔recipes).
- BH#5 + VG-main-2 + VG-other-1 (gate a11y valuta solo l'exit code della suite: se l'emitter smette di emettere l'assert axe, tutti i gate restano verdi; `failedFiles` mai popolato dal CLI reale) — verificato dal VG (nessun test asserisce la presenza dell'assert axe nei test committati; dimostrazione con template modificato + rigenerazione = tutto verde). È il failure mode "verde finto" che il regime esiste per prevenire. — `patch` (test che asserisce che ogni `<Comp>.test.tsx` committato contiene import `vitest-axe` + assert `axe(`).
- BH#6 (suite ui girata due volte in CI: turbo `test` + spawn in `gates:render`) — verificato. Costo ~1s a PR; deduplicare richiederebbe wiring extra (seam per disattivare il gate). — `low`, rifiutato.
- BH#7 + ECH#11 (stati senza DOM-prop mappata — `focus`, `open` — non ricevono test axe; coverage gap invisibile) — verificato in `renderTestFile`: solo `aria-invalid`/`disabled` diventano DOM props. Ma axe in jsdom non può verificare focus-visibile visivo né animazioni; coprirli richiederebbe logica d'interazione per stato nel generatore = complessità sproporzionata al guadagno. — `low`, rifiutato.
- BH#8 (stories solo sul primo asse `option`: Badge `size` senza story; il vecchio contratto "una story per asse" sparisce senza decisione documentata) — verificato in `renderStoriesFile`: `firstOptionAxis`. Il fix è diretto e non aggiunge superficie. — `patch` (story per ogni asse `option`, altre assi al default).
- BH#9 (conoscenza libreria nell'emitter: `renderInRoot` hard-coda `<AccordionRoot type="single" collapsible>` invece di legge dal binding, che esiste per questo) — verificato in `renderTestFile`. Erode il confine "l'emitter legge, non giudica" (AD-11): cambiare libreria richiederebbe edit all'emitter oltre al binding. — `patch` (`headless.rootProps` nel binding, emesso da lì).
- BH#10 (barrel radice `domains/index.ts` a mano e senza gate) — verificato: il gate completezza copre solo i barrel di dominio. Ma `check-types` fallisce su export divergenti; l'unico gap (nuovo componente non aggregato) è un one-liner manuale con componente comunque esportato via dominio. — `low`, rifiutato.
- BH#11 (`kebabOf` duplicato in `artifacts.ts` nonostante `toKebab` esportato nello stesso diff) — verificato: due copie identiche della stessa normalizzazione. — `patch` (riusare `toKebab`).
- BH#12 (structural del binding divergono dalla base committata: Input h-8/transition-colors vs base h-9/transition-[color,box-shadow]/shadow-xs, deviazione non documentata) — verificato. Ma è il meccanismo per costruzione: il binding DICHIARA le strutturali ("provenienza libreria"), la base resta input byte-fedele; l'output emesso è coerente con il binding committato. La "deviazione" è la scelta d'autore del binding, non un difetto. — `low`, rifiutato.
- BH#13 (obblighi documentali della vecchia story scomparsi: README senza il comando `render:component`; `deferred-work.md` non aggiornato su alias/decisione drift/consumo fixture) — verificato: README e deferred-work intatti. Documentazione che l'intent implica; il fix è diretto, senza edit di spec. — `patch` (sezione README emitter + aggiornamento deferred-work: chiudere item alias, aggiornare consumo fixture 2.6, registrare decisione drift).
- BH#14 (stati divergenti: sprint-status `in-progress`, spec `in-review`) — verificato: bookkeeping non allineato dopo il cambio di status. — `patch` (sprint-status 2-6 → review).
- BH#15 + ECH#1 (`loadFixture`/`loadRecipe`/`loadBinding`: JSON malformato → SyntaxError grezzo senza path, contraddice la promessa fail-loud nominativa del modulo) — verificato in `artifacts.ts`. — `patch` (try/catch con errore che nomina il file).
- BH#16 + VG-other-2 (typo user-facing "riestraicare") — verificato in `checkDrift`. — `patch`.
- ECH#2 (base con sottodirectory: `loadBaseSources` non ricorsivo → file mancanti silenziosi, poi errore fuorviante di `extractImport`) — verificato. Ma le basi committate sono piatte (un file per componente); il fallimento resta loud (anche se il messaggio può fuorviare); reachability oggi nulla. — `low`, rifiutato.
- ECH#3 (file illeggibile sotto domains root → `readExistingFiles` lancia grezzo, gate crashano) — verificato. Fail-closed loud, scenario irreale (file binari in domains). — `low`, rifiutato.
- ECH#4 (binding part con `attribute` senza `contentField`: attributo silenziosamente droppato in `renderPartJsx`) — verificato: lo schema non valida la co-occorrenza. Configurazione a mano malformata → comportamento silenzioso. — `patch` (refine nello schema: `attribute` richiede `contentField`).
- ECH#5 (write non atomiche fra file: fallimento a metà loop lascia insieme parziale) — verificato: per-file atomico ma non fra file. ENOSPC è un caso estremo e NON silenzioso; il gate completezza/rigenerazione lo rileva al giro dopo. — `low`, rifiutato.
- ECH#6 (valore cella con `=` troncato in `parseCellKey`) — verificato il parsing, MA irraggiungibile: `RecipeSchema`/`CELL_KEY` (fix Story 2.5, BH#6+ECH#8) esclude `|`/`=` dai valori e il CLI valida la ricetta con Zod prima del rendering. — `false`.
- ECH#7 (due layer con lo stesso nome di una parte: `findLayerByName` usa il primo in silenzio) — verificato il primo-match, MA irraggiungibile nel percorso reale: `validateRecipe` segnala le parti duplicate (conformance ricetta↔fixture) e il render CLI esegue la conformance PRIMA del rendering. — `false`.
- ECH#8 (due assi `option` bound alla stessa prop: la seconda sovrascrive varianti/defaults in silenzio) — verificato in `computePartClasses`: nessun controllo di unicità su `prop` nel binding. Configurazione a mano malformata → cva con un asse perso. — `patch` (fail-loud su prop duplicata).
- ECH#9 + ECH#16-claim ("le classi emesse sono tutte validate dal vocabolario" — falso per le emissioni prefissate `focus-visible:`/`data-[state=…]:`/`placeholder:`) — verificato: i prefissi bypassano `validateEmitted`. MA il claim non regge come difetto: le classi derivate dal token SONO validate prima del prefisso; i prefissi sono sintassi del binding, non utility token-derived (il vocabolario non può enumerarli per costruzione); un prefisso errato degrada visibilmente (classe senza effetto), non produce un valore sbagliato in silenzio. — `false`.
- ECH#10 (asse behavior senza parte trigger nel binding: test generato asserisce contenuto smontato → suite rossa criptica) — verificato il percorso. Fallimento LOUD (mai silenzioso) su binding malconfigurato a mano; il binding committato dichiara Trigger. — `low`, rifiutato.
- ECH#12 (valore d'asse con `-`: export story invalido rompe il file stories) — verificato il rischio, MA loud a `check-types` e irraggiungibile coi valori-identificatore dei contratti attuali. — `low`, rifiutato.
- ECH#13 (binding `prop` non identificatore TS: .tsx generato invalido) — verificato il rischio, MA loud a `check-types`. — `low`, rifiutato.
- ECH#14 (file `@generated` orfani dopo rinomina: mai segnalati da alcun gate) — verificato: `renderCheck` confronta solo i file attesi. File inutilizzati e innocui; i consumer sono protetti da check-types sul barrel radice. — `low`, rifiutato.
- ECH#15 (`spawnSync` fallito: `suite.error` ignorato, il gate a11y dice "exit ?" nascondendo la causa) — verificato in `gates-cli.ts`. — `patch` (passare `suite.error` nel dettaglio del gate).
- ECH#17 + VG-other-3 + VG-other-5 (`render:check` non wired in CI sebbene il Task 8 lo nominasse; la catena `&&` si ferma al primo fallimento) — verificato: ci.yml esegue solo `gates:render`. MA la verifica È enforcement: Gate 2 in `gates:render` esegue lo stesso `renderCheck` sui tre componenti; cablare lo script duplicherebbe la suite (il contrario di BH#6). Lo scostamento dal wording del Task 8 è nominale, non comportamentale. — `low`, rifiutato.
- ECH#18-claim ("classi derivate con varSuffix/varName" — varName mai usato dall'emitter) — verificato: solo `varSuffix` è importato. Il contratto 1:1 var↔classe è garantito dal suffisso (`varSuffix`); `varName` non serve all'emitter. Nessun gap comportamentale. — `low`, rifiutato.

2. `patch` — hardening fail-loud e coerenza del binding (BH#15+ECH#1, ECH#4, ECH#8, BH#16, ECH#15): JSON.parse con errore nominativo, refine attribute↔contentField, fail-loud su prop option duplicata, typo, suite.error nel dettaglio. → **applicate nel loop 1, verificate.**
3. `patch` — gate robusti (BH#4+VG-main-1, BH#5+VG-main-2+VG-other-1, BH#1, BH#3): lista componenti derivata da `recipes/*.recipe.json` con test di copertura gate↔recipes, assert di presenza dell'assert axe nei test generati committati, numerazione gate canonica, wording onesto del skip drift. → **applicate nel loop 1, verificate.**
4. `patch` — fedeltà AD-11 dell'emitter (BH#9, BH#8): `headless.rootProps` nel binding per il renderInRoot, story per ogni asse `option` con rigenerazione e commit dei file aggiornati. → **applicate nel loop 1, verificate.**
5. `patch` — documentazione e bookkeeping (BH#13, BH#11, BH#14): sezione README dell'emitter, aggiornamento `deferred-work.md` (item alias chiuso, consumo fixture, decisione drift), `toKebab` riusato in `artifacts.ts`, sprint-status allineato. → **applicate nel loop 1, verificate.**

Nota: i verdict `low` rifiutati (BH#2, BH#6, BH#7+ECH#11, BH#10, BH#12, ECH#2, ECH#3, ECH#5, ECH#10, ECH#12, ECH#13, ECH#14, ECH#17+VG-other-3/5, ECH#18) e i `false` (ECH#6, ECH#7, ECH#9+ECH#16) non generano righe di routing oltre la riga di registro.

## Design Notes

- **Instradamento per tipo, non per nome:** `Axis.type` vive solo in `packages/contracts` — l'emitter risolve il contratto dalla fixture (`fixture.contract` → `contractByName`) e instrada; le ricette non portano il tipo.
- **Determinismo:** nessun `Date.now`/`Math.random`/iterazione di `Map` non ordinata nell'output; serializzazioni con `stableStringify` (pattern già in `validate-recipe.ts`).
- **Skip protettivo ≠ errore:** file senza marker + contenuto divergente → log e skip (modalità "sganciato" prevista dal contratto); file con marker → sovrascritto.
- **Derivazione classi (esempio Badge):** cella `fill: color.destructive` (type color) → `varSuffix` = `destructive` → utility `bg-destructive`; `paddingTop: spacing.1` → `pt-1`; `fontSize: text.sm` → `text-sm`. La stessa funzione genera la CSS var, quindi variabile e classe non possono divergere.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts run test` -- expected: verde, nessun test file in meno (oggi 17).
- `pnpm --filter @penpot-ds/ui run test` -- expected: verde (nuova suite, assert axe inclusi).
- `pnpm check-types && pnpm lint && pnpm test && pnpm build` (root) -- expected: verdi, inclusi i nuovi gate wired.
- `render:component -- Badge|Input|AccordionItem` poi `render:component -- <Comp> --check` -- expected: rigenerazione byte-identica; secondo run → diff zero.
- Prova rosso/verde per ogni gate -- expected: un input che viola il gate lo fa fallire (testato in suite, non canary manuale).
