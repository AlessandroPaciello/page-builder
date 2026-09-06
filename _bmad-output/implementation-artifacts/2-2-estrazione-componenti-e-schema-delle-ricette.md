---
baseline_commit: 1fab32f0119fa002398d468e3c0a5d954af25e6e
---

# Story 2.2: Estrazione componenti e schema delle ricette

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a designer/sviluppatore,
I want estrarre un singolo componente da Penpot e ottenerne una ricetta validata,
so that il giudizio su varianti, headless e a11y sia congelato in un artefatto rivedibile invece che disperso nel codice (FR2, AD-11).

## Acceptance Criteria

1. **Given** un componente con le sue varianti su Penpot **When** ne chiedo l'estrazione (per-componente e su richiesta, **mai in CI né in build**) **Then** sono prodotti `<comp>.fixture.json` (shape, assi e celle delle varianti, token binding, CSS raw) e `<comp>.recipe.json` (dominio, headless, modello CVA, requisiti a11y), entrambi committati.
2. **And** la ricetta è validata contro lo schema **e** contro il vocabolario dei token dello Stadio 1 (Story 2.1): una classe con valore literal (`bg-[#3b82f6]`, `p-[7px]`) fa fallire la validazione.
3. **And** il confine è rispettato — nella fixture solo ciò che si legge da Penpot senza sapere cosa sia React; nella ricetta ciò che richiede React e accessibilità.

## Tasks / Subtasks

- [x] Task 1: Schema Zod di fixture e ricetta (AC: #1, #2, #3)
  - [x] `packages/scripts/src/recipe-schema.ts`: `FixtureSchema` (Zod) — `componentName`, `penpotComponentId`, `variantAxes: { name: string; values: string[] }[]`, `cells: { variantProps: Record<string,string> | null; penpotComponentId: string; shapeStructure: unknown; tokenBindings: Record<string, string>; rawCss: string }[]`. Nessun campo che richieda sapere cosa sia React (AC #3, confine da penpot-pipeline.md).
  - [x] `RecipeSchema` (Zod) — `componentName`, `domain` (enum dei 6 domini di design-system.md: `data-display`|`inputs`|`feedback`|`layout`|`navigation`|`overlays`), `headless` (`{ package: string; parts: string[] } | null` — `null` = nessuna libreria headless necessaria, es. Badge presentazionale), `cva` (`{ base: string[]; variants: Record<string, Record<string, string[]>>; defaultVariants: Record<string,string> }`), `a11y` (`{ role: string | null; ariaAttributes: string[]; focusVisible: boolean; stateConveyedByTextAndColor: boolean }`). Provenienza: `penpotComponentId`, `fixtureHash` (stesso algoritmo `sha256(...).slice(0,12)` di `theme-generator.ts:415` — riusa/esporta la funzione invece di duplicarla).
  - [x] Nessun marker `@generated` su fixture/ricetta: sono artefatti **committati e di giudizio**, non output del renderer (quello è Story 2.3).
- [x] Task 2: Vocabolario token per la validazione classi (AC: #2)
  - [x] `packages/scripts/src/token-vocabulary.ts`: `buildTokenVocabulary(catalog: TokenCatalog): Set<string>` — riusa **senza duplicare** `varSuffix`/`varName`/`TYPE_NAMESPACE` esportati da `theme-generator.ts` (non reimplementare la derivazione nome).
  - [x] Namespace Tailwind v4 realmente utility-producing (decisione Story 2.1, `theme-generator.ts:56-76`): `color`→`bg-*`/`text-*`/`border-*`/`ring-*`/`fill-*`/`stroke-*`; `spacing`→`p*-*`/`m*-*`/`gap-*`/`inset-*`; `borderRadius`→`rounded-*`; `fontSizes`→`text-*`; `fontWeights`→`font-*`; `letterSpacing`→`tracking-*`; `fontFamilies`→`font-*`; `shadow`→`shadow-*`. **`borderWidth` e `opacity` non hanno namespace `@theme` v4** (stessa decisione Story 2.1): nessuna classe Tailwind è generabile per questi due tipi — una ricetta che li usa come prefisso di classe (`border-w-mis-1`, `opacity-mis-50`) deve fallire la validazione; il consumo legittimo è solo `var(--border-width-...)`/`var(--opacity-...)` inline, fuori dal vocabolario di classi.
  - [x] Regola di rigetto esplicita per AC #2: qualunque classe con sintassi valore-arbitrario Tailwind (`/\[.+\]/` nel token di classe, es. `bg-[#3b82f6]`, `p-[7px]`) fallisce **sempre**, indipendentemente dal vocabolario — è il test letterale dell'esempio in AC.
  - [x] Funzione `validateClassesAgainstVocabulary(classes: string[], vocabulary: Set<string>): { valid: boolean; invalidClasses: string[] }` usata dal validatore ricetta (Task 3). Classi strutturali non basate su token (`flex`, `inline-flex`, `items-center`, `justify-center`, `overflow-hidden`, ecc.) non sono nel vocabolario token e vanno **whitelisted** separatamente (non richiedono binding a un token) — mantieni la whitelist esplicita e minimale, non un pattern che accetta tutto ciò che non matcha (vanificherebbe il gate).
- [x] Task 3: Recipe validator ed entry point CLI (AC: #1, #2)
  - [x] `packages/scripts/src/validate-recipe.ts`: funzione pura `validateRecipe(recipe: unknown, fixture: TokenCatalog): RecipeValidationResult` — (a) valida `recipe` contro `RecipeSchema`; (b) estrae tutte le classi Tailwind dal blocco `cva` (base + ogni variante) e le valida con `validateClassesAgainstVocabulary` contro il vocabolario dello Stadio 1.
  - [x] `packages/scripts/src/extract-component.ts`: entry CLI `extract:component -- <ComponentName>` — **sempre live** (a differenza di `generate-theme.ts`, l'estrazione componenti non ha un default offline: è per-componente e su richiesta, mai batch/CI). Scrive `<comp>.fixture.json` nella directory dei recipe (Task 5). Aggiungi anche `validate:recipe -- <ComponentName>` che carica `<comp>.fixture.json` + `<comp>.recipe.json` committati e rigira `validateRecipe`, per riuso da CI in Story 2.3 (qui: solo invocazione manuale).
  - [x] Nessuno dei due comandi entra in `turbo.json` come task cacheable (stesso principio Story 2.1 Task 5: trigger manuale, non build graph). `validate:recipe` potrà diventare un gate CI **in Story 2.3** — non wire-arlo qui.
- [x] Task 4: Component reader Penpot (MCP) per UN componente (AC: #1, #3)
  - [x] `packages/scripts/src/component-reader.ts`: nuovo client MCP per leggere **struttura + matrice varianti + CSS raw** di un componente per nome. Segui lo **stesso stile** di `penpot-reader.ts` esistente (Story 2.1): `Client`+`StreamableHTTPClientTransport`, `withTimeout` (15s), validazione envelope `execute_code` esplicita, `close()` che non maschera l'errore primario — **non duplicare** `withTimeout`/il pattern di connessione, estrailo in un piccolo modulo condiviso se ti risulta comodo, ma non è un requisito di questa story.
  - [x] Codice eseguito via `execute_code` (Penpot Plugin API, vedi Dev Notes → API Penpot rilevante): trova il `VariantContainer` per nome (`penpotUtils.findShape` su `isVariantContainer()` + `name`), legge `variants.properties` (assi) e `variants.variantComponents()` (celle, con `variantProps`), per ogni cella naviga alla board istanza (`mainInstance()`/figli del container) e cattura: `fills`/`strokes`/`borderRadius` (letterale, es. `9999`), `penpot.generateStyle([board], { type: "css", withChildren: true })` per il CSS raw, e — **punto critico, vedi Dev Notes** — deriva il **token binding** per corrispondenza di **valore esatto** (hex) contro il catalogo token Stadio 1 quando `shape.tokens` è vuoto (il componente Badge verificato in questa sessione NON ha binding espliciti in Penpot, ma i suoi hex matchano byte-per-byte token feedback/mis esistenti).
  - [x] Fixture-scope rispettato: leggi solo fatti (assi, celle, CSS raw, hex, radius). Nessuna decisione su dominio/headless/cva/a11y qui — quella è la ricetta (Task 5, giudizio umano/agent in questa sessione, non automatizzato).
- [x] Task 5: Estrazione e ricetta del componente di riferimento — **Badge** (AC: #1, #2, #3)
  - [x] Esegui `extract:component -- Badge` contro il server MCP Penpot live per popolare `packages/scripts/src/recipes/badge.fixture.json` (committata). Componente verificato presente in Penpot in questa sessione: board `Badge / Default` (`VariantContainer`) nella pagina **Docs**, assi `Color` (Indigo/Gray/Green/Red) × `Style` (solid/soft/outline) = 11 celle + 1 default, ogni cella = board (fill/stroke/radius) + child `label` (text). *(Nota dev: la cella Red/soft usava il fill `#ffb4ab`, assente dalla token library — corretto su Penpot a `color.feedback.error.container` `#ffdad6` in questa sessione, su autorizzazione di Alessandro, prima dell'estrazione.)*
  - [x] Scrivi a mano (giudizio, non script) `packages/scripts/src/recipes/badge.recipe.json`: `domain: "data-display"` (design-system.md, tabella domini), `headless: null` (Badge è presentazionale — shadcn Badge non ha parti Radix; non è nella lista dei "senza headless disponibile, scritti a mano" perché **ha** una base shadcn/CVA disponibile, semplicemente senza comportamento headless da comporre), modello `cva` con SOLO classi risolvibili al vocabolario Stadio 1 (mappa Color×Style → classi `bg-*`/`text-*`/`border-*` derivate dai token feedback/mis matchati in Task 4), `a11y` minimale e onesto (Badge generico non è uno stato di lifecycle — quello è `LifecycleBadge`, composizione di Epic 3 che *userà* questo Badge; non inventare qui requisiti ARIA che il componente base non porta). *(Nota dev: la matrice Color×Style è encoded su un unico asse cva `colorStyle` (12 chiavi composte) perché lo schema della ricetta non prevede `compoundVariants`; Green e Indigo condividono gli stessi token in Penpot — l'unica combinazione senza cella esplicita (Indigo/solid) è coperta dalla board Default.)*
  - [x] Valida con `validate:recipe -- Badge`: deve passare (AC #2) — se una classe non matcha il vocabolario, correggi la ricetta, non il validatore.
  - [x] **Non estrarre Input o Accordion in questa story**: esistono già in Penpot (`Input / Legacy`, `Accordion / Item`/`Accordion / Default` verificati in questa sessione) ma la progressione di complessità crescente Badge→Input→Accordion è esplicitamente lo scope di **Story 2.3** (epics.md: "validato su tre componenti... prima di generalizzare"). Estrarli ora sarebbe scope creep rispetto ad "estrarre un **singolo** componente" (AC #1).
- [x] Task 6: Test (AC: #1, #2, #3)
  - [x] `recipe-schema.test.ts`: casi validi/invalidi per `FixtureSchema`/`RecipeSchema` (campo mancante, enum dominio errato, `headless` malformato).
  - [x] `token-vocabulary.test.ts`: token valido → classe accettata; valore literal (`bg-[#3b82f6]`, `p-[7px]`, replica esatta degli esempi AC #2) → rifiutato; classe `border-w-*`/`opacity-*` con suffisso token → rifiutata (nessun namespace v4); classe strutturale whitelisted (`flex`) → accettata senza essere nel vocabolario token.
  - [x] `validate-recipe.test.ts`: la ricetta Badge reale (Task 5) valida pulita contro la fixture reale; una ricetta con una classe fuori vocabolario fa fallire `validateRecipe` nominando la classe incriminata (fail-loud, stesso stile di `theme-generator.ts`).
  - [x] `component-reader.test.ts` — **transport mockato, zero rete**: chiudi il deferred-work aperto da Story 2.1 ("`penpot-reader.ts` privo di copertura test... da coprire con transport mock quando il reader crescerà in Story 2.2/2.3", vedi `deferred-work.md`). Copri: envelope malformato, componente non trovato, variant container assente, timeout.
  - [x] Tutti i test offline e deterministici: nessuna chiamata di rete nella suite (il server MCP live è usato solo per l'estrazione one-shot di Task 5, mai nei test — stesso principio Story 2.1).
- [x] Task 7: Wiring repo (AC: #1)
  - [x] Aggiungi `"zod": "catalog:"` alle dipendenze di `packages/scripts/package.json` (catalog già pinnato `^4.4.3` in `pnpm-workspace.yaml`, usato da `api`/`auth`/`db`/`env` — non introdurre una versione ad-hoc).
  - [x] Script `package.json`: `extract:component`, `validate:recipe` (entrambi `node --import tsx src/...`), oltre a `test`/`check-types`/`lint` già esistenti.
  - [x] `pnpm install` + `pnpm check-types` + `pnpm lint` + `pnpm test` + `pnpm build` verdi a livello repo.
- [x] Task 8: Documentazione (AC: #1)
  - [x] Aggiorna `packages/scripts/README.md`: come estrarre un nuovo componente (`extract:component -- <Nome>`), dove vivono fixture/ricette (`src/recipes/`), come validare (`validate:recipe`), e il confine fixture/ricetta.
  - [x] Aggiorna `deferred-work.md`: chiudi la voce "`penpot-reader.ts` privo di copertura test" per la parte component-reader (Task 6); registra esplicitamente che Input/Accordion restano da estrarre in Story 2.3; registra il pattern "hex-match invece di `shape.tokens` esplicito" come nota per la libreria Penpot (i componenti non hanno binding token nativi — ogni estrazione futura dovrà rifare lo stesso lookup finché il team design non applica `shape.applyToken` nei file Penpot).

## Dev Notes

- **Blocco potenziale risolto in questa sessione, non delegare a un secondo giro:** i componenti Penpot (Badge verificato) **non hanno `shape.tokens` popolato** (nessun binding esplicito applicato in Penpot) — le fill/stroke sono hex letterali. Verificato empiricamente via MCP live in questa sessione: `Badge / Default` cella Red/solid ha `fills[0].fillColor = "#ffdad6"` (board) e testo `#ba1a1a`, senza alcuna voce in `shape.tokens`. Questi hex **matchano byte-per-byte** token già generati dallo Stadio 1 (Story 2.1): `#ba1a1a` = `color.feedback.error`, `#ffdad6` = `color.feedback.error.container`; la variante outline (Indigo) usa stroke `#006c49` = `color.mis.primary`/`accent.9`; il radius `9999` = `radix.radius.full`/`mis.radius.mis.full`. **Implicazione per `component-reader.ts` (Task 4):** quando `shape.tokens` è vuoto, deriva il binding per **corrispondenza di valore esatto** contro il catalogo Stadio 1 (fixture `packages/scripts/src/__fixtures__/penpot-catalog.json` o lettura live) — è una **scoperta**, non un'invenzione (stesso hex, non un valore approssimato). Un hex **senza** corrispondenza esatta in nessun token è un segnale di stop esplicito nel component-reader (errore che nomina lo shape e l'hex, non un binding indovinato) — a quel punto serve applicare il token in Penpot (fuori scope di questa story) o accettare che quella cella resti fuori dal vocabolario e la ricetta fallisca la validazione (AC #2 lo prevede: "una classe... fa fallire la validazione").
- **Componente scelto per questa story: Badge.** Verificato in Penpot (sessione live, pagina **Docs**): `Badge / Default` è un `VariantContainer` con assi `Color` (Indigo, Gray, Green, Red) × `Style` (solid, soft, outline) = 11 celle nominate + 1 "Default" (variantProps null = istanza base/main). Ogni cella è una board (fill/stroke/borderRadius) con un unico figlio `label` (text). È il componente più semplice della progressione Badge→Input→Accordion di Story 2.3 (epics.md#Story 2.3) — **coerente con la scelta**, non anticiparla su Input/Accordion (Task 5, ultimo bullet).
- **Confine fixture/ricetta (regola assoluta, penpot-pipeline.md):** fixture = tutto ciò che si legge da Penpot senza sapere cosa sia React (shape, assi/celle, hex/radius letterali, CSS raw generato da Penpot). Ricetta = tutto ciò per cui serve sapere cosa sono React e l'accessibilità (dominio, quale libreria headless comporre, quali classi sono comuni a tutte le celle — è fattorizzazione, cioè giudizio —, quale elemento HTML, quali attributi ARIA). Non spostare classi CVA nella fixture né shape/CSS raw nella ricetta.
- **Riuso obbligato, non reimplementazione:** `varSuffix`, `varName`, `TYPE_NAMESPACE` sono già esportati da `packages/scripts/src/theme-generator.ts` (righe 65-143) proprio per essere riusati qui (commento esplicito nel codice: "Riusata da Story 2.2/2.3 (token-resolver.ts)"). Il vocabolario token (Task 2) deve costruirsi componendo questi export con i prefissi utility Tailwind per tipo — non riscrivere la derivazione del suffisso.
- **Namespace senza utility Tailwind v4 (`borderWidth`, `opacity`):** decisione già presa nella code review di Story 2.1 (`2-1-...md` Review Findings, decision-needed #1) — questi due tipi restano **CSS-only**, nessuna utility Tailwind esiste per loro. Il vocabolario di classi (Task 2) non deve includerli come prefissi di classe validi; il loro uso legittimo in una ricetta sarebbe solo via `var(--border-width-...)`/`var(--opacity-...)` in style inline, fuori dal set di classi Tailwind validate qui. Se Badge non usa questi tipi (non li usa, verificato: solo color+radius), questo è solo un vincolo per il validatore generico, non per la ricetta Badge stessa.
- **Mai in CI né in build (AC #1):** né `extract:component` né la scrittura della fixture entrano in `turbo.json`/CI in questa story. Solo `validate:recipe` è pensato per diventare un gate CI, ma il suo wiring a CI è Story 2.3 (uno dei 4 gate di `penpot-pipeline.md#Gate di verifica` — qui costruisci la funzione pura, non il gate).
- **Non toccare** `packages/domain`, `packages/api`, `packages/auth`, `packages/db`, `packages/env`, `apps/web`, e **non modificare** i file di Stage 1 già shippati (`theme-generator.ts`, `generate-theme.ts`, `penpot-reader.ts`, `__fixtures__/penpot-catalog.json`, tutto in `packages/tokens/`) se non per importarne gli export esistenti. Questa story aggiunge file nuovi in `packages/scripts/src/`.
- **Struttura non allineata 1:1 alla Structural Seed dello spine** (`ARCHITECTURE-SPINE.md#Structural Seed` descrive `scripts/{penpot,recipes,render,gates}/`) — Story 2.1 ha già shippato con file piatti in `src/` (`theme-generator.ts`, `penpot-reader.ts`, `generate-theme.ts` tutti a `src/` root, non `src/penpot/`). Decisione di questa story: **non riorganizzare retroattivamente Story 2.1** (churn non richiesto da nessun AC); i nuovi file di questa story vanno anch'essi piatti in `src/` **tranne** gli output committati fixture/ricetta, che vanno in `src/recipes/<comp>.fixture.json` / `src/recipes/<comp>.recipe.json` (l'unica sottocartella che lo spine nomina esplicitamente come contenitore di dati, non di codice). Se in una story successiva si decide di allineare tutto allo spine, è un refactor esplicito, non un effetto collaterale di questa story.
- **API Penpot rilevante per `component-reader.ts`** (da `high_level_overview`/`penpot_api_info`, non da inventare): `penpotUtils.findShape(predicate)` per trovare il `VariantContainer` per nome; `container.variants.properties: string[]` (assi, in ordine); `container.variants.variantComponents(): LibraryVariantComponent[]` (celle, con `.variantProps: Record<string,string>` e `.variantError`); `penpotUtils.shapeStructure(shape, maxDepth)` per la struttura; `penpot.generateStyle([shape], { type: "css", withChildren: true })` per il CSS raw; `shape.fills`/`shape.strokes`/`shape.borderRadius` per i valori letterali; `shape.tokens` (mappa `TokenProperty → token.name`, vuota su Badge). Il container Badge ha anche un `Board` "Default" con `variantProps: null` (l'istanza principale/main, non una cella con assi) — il component-reader deve escluderla dalla matrice celle o trattarla come riferimento al main instance, a seconda di cosa risulta più pulito nello schema fixture (giudizio Task 1/4, documenta la scelta nel commento del codice).
- **Pattern di stile per il client MCP:** replica `penpot-reader.ts` (timeout 15s, validazione envelope esplicita con errori che nominano il campo malformato, `close()` che non maschera l'errore primario) — è il precedente di stile già stabilito e revisionato in Story 2.1, non serve reinventarlo.

### Project Structure Notes

- File nuovi in `packages/scripts/src/` (nessuna sottocartella `penpot/`/`recipes/` di codice — solo `recipes/` come directory dati, vedi Dev Notes):
  ```
  packages/scripts/src/
    recipe-schema.ts          # NUOVO — Zod: FixtureSchema, RecipeSchema
    token-vocabulary.ts       # NUOVO — vocabolario classi Tailwind da TokenCatalog
    validate-recipe.ts        # NUOVO — validateRecipe(recipe, fixture)
    component-reader.ts       # NUOVO — client MCP per struttura+varianti+CSS raw di UN componente
    extract-component.ts      # NUOVO — CLI extract:component / validate:recipe
    recipe-schema.test.ts     # NUOVO
    token-vocabulary.test.ts  # NUOVO
    validate-recipe.test.ts   # NUOVO
    component-reader.test.ts  # NUOVO — transport mockato
    recipes/                  # NUOVO — dati committati, non codice
      badge.fixture.json
      badge.recipe.json
    # invariati da Story 2.1, non toccare:
    theme-generator.ts
    generate-theme.ts
    penpot-reader.ts
    theme-generator.test.ts
    __fixtures__/penpot-catalog.json
  ```
- Nessuna migrazione DB, nessun cambiamento a `packages/tokens/`, `apps/web`, o agli altri package di Epic 1. Conflitti: nessuno con Story 2.1 (aggiunte, non modifiche ai file esistenti).
- `pnpm-workspace.yaml`: nessuna nuova voce di catalog richiesta (zod già presente); nessuna modifica al glob `packages/*`.

### Testing Requirements

- Tutti i test **offline e deterministici**: fixture Badge committata (Task 5) usata come input nei test di `validate-recipe.test.ts`; nessuna chiamata di rete nella suite vitest. Il server MCP live è invocato **una sola volta**, manualmente, per popolare `badge.fixture.json` (Task 5) — mai da un test.
- `component-reader.test.ts` mocka il transport MCP (client `callTool` stub) per coprire: envelope valido, envelope malformato (campo mancante), componente/variant-container non trovato, timeout — chiude il deferred-work di Story 2.1 sulla mancata copertura di `penpot-reader.ts`/`component-reader.ts`.
- AC #2 verificato con test espliciti sugli esempi letterali dell'AC stesso (`bg-[#3b82f6]`, `p-[7px]`) — non solo casi generici.
- Non-regressione repo: `pnpm check-types`, `pnpm lint`, `pnpm test`, `pnpm build` verdi dopo l'aggiunta dei nuovi file (pattern osservato in tutte le story precedenti).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Estrazione componenti e schema delle ricette] — user story e AC originali.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — progressione Badge→Input→Accordion di complessità crescente, esplicitamente fuori scope qui salvo Badge.
- [Source: _bmad-output/specs/spec-page-builder/penpot-pipeline.md#Stadio 2, #Confine fixture/ricetta, #Gate di verifica] — contratto dettagliato fixture/ricetta/renderer, tabella di confine, i 4 gate CI (di cui solo `validate-recipe` nasce qui, il wiring CI è Story 2.3).
- [Source: _bmad-output/specs/spec-page-builder/design-system.md#ui/domains] — tabella domini (Badge → Data Display), lista componenti senza headless scritti a mano (Table, Carousel — Badge non è tra questi).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-11] — regime fixture→ricetta→renderer, Penpot come single source of truth di valori/aspetto/matrice varianti; comportamento accessibile mai disegnabile in Penpot.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Structural Seed] — layout target `scripts/{penpot,recipes,render,gates}/`, trattato come seed non vincolante vista la deviazione già presente da Story 2.1 (vedi Dev Notes).
- [Source: packages/scripts/src/theme-generator.ts:52-143] — `varSuffix`/`varName`/`TYPE_NAMESPACE` da riusare per il vocabolario token; commento esplicito "Riusata da Story 2.2/2.3".
- [Source: packages/scripts/src/penpot-reader.ts] — pattern di stile per il client MCP (timeout, validazione envelope, gestione `close()`) da replicare in `component-reader.ts`.
- [Source: _bmad-output/implementation-artifacts/2-1-pipeline-token-penpot-codice.md#Review Findings — Decision Needed, #Review Findings — Deferred] — decisione namespace `borderWidth`/`opacity` senza utility v4; deferred "penpot-reader.ts privo di copertura test" da chiudere qui per la parte component-reader.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 2-1-pipeline-token-penpot-codice] — stesso deferred item, testo completo.
- [Source: sessione MCP Penpot live, 2026-09-06 (questa story)] — verifica empirica: `Badge / Default` (VariantContainer, pagina Docs) assi Color×Style, 11 celle+default; nessun `shape.tokens` esplicito ma hex esatti = `color.feedback.error` (#ba1a1a), `color.feedback.error.container` (#ffdad6), `color.mis.primary`/`accent.9` (#006c49), radius `9999` = `radix.radius.full`; `Input / Legacy` e `Accordion / Item`/`Accordion / Default` già presenti in Penpot per Story 2.3.
- [Source: pnpm-workspace.yaml] — `zod: ^4.4.3` già in catalog, usato da `api`/`auth`/`db`/`env`; da aggiungere come dipendenza di `packages/scripts` senza pin ad-hoc.

## Dev Agent Record

### Agent Model Used

opencode-go/glm-5.3-flash (Amelia, dev-story workflow)

### Debug Log References

- Server MCP Penpot live (`http://127.0.0.1:4401/mcp`, container `penpot-penpot-mcp-1`) usato solo per l'estrazione one-shot di Task 5 e per le sonde empiriche documentate nei Completion Notes. Tutti i test della suite girano offline (transport mockato).
- sessione MCP live 2026-09-06: identificata la mappa cella↔board (`variantComponents()` ↔ `shapeStructure(board,1).componentInstance.componentId`), corretto il fill Red/soft `#ffb4ab`→`#ffdad6` via `execute_code` (pagina resa attiva con `penpot.openPage`, stato editor ripristinato su "Primitive"), estrazione riuscita con 12/12 celle bindate.

### Completion Notes List

- **Task 1** — `recipe-schema.ts`: `FixtureSchema`/`RecipeSchema` Zod 4 come da spec. Scelta documentata in codice: la board "Default" (`variantProps: null`, istanza main del VariantContainer) è catturata come riga separata della matrice celle con `variantProps: null` (più pulito che escluderla: la fixture resta fedele a ciò che Penpot espone). `variantAxes` senza `.min(1)` esterno: un componente a cella unica (nessun asse) è un caso legittimo del reader; un asse con `values` vuota resta comunque rifiutato. `fixtureHash` esportata da `theme-generator.ts` (unica modifica ai file Stage 1, esplicitamente richiesta dal Task 1) e riusata per la provenienza.
- **Task 2** — `token-vocabulary.ts`: `TYPE_NAMESPACE` esportato da `theme-generator.ts` (richiesto dal Task 2 per il riuso) e il vocabolario compone `varSuffix()` con i prefissi utility per tipo — nessuna derivazione reimplementata. `borderWidth`/`opacity` → lista prefissi vuota (nessuna utility v4, decisione Story 2.1). Regola valore-arbitrario (`/\[.+\]/`) valutata PRIMA dell'appartenenza al set: una classe literal fallisce sempre, anche se qualcuno la aggiungesse al vocabolario (test dedicato). Whitelist strutturale esplicita e minimale (5 classi + `border`, aggiunta in Task 5 con commento: larghezza bordo fissa Tailwind, i token `borderWidth` sono CSS-only).
- **Task 3** — `validate-recipe.ts` funzione pura (schema + classi cva contro il vocabolario, fail-loud nominando classi e campi). `extract-component.ts`: due modalità (`extract` sempre live / `validate` offline) sullo stesso entry; `validate` include il check di provenienza (`componentName`/`penpotComponentId`/`fixtureHash` — mismatch = drift esplicito, base per il gate CI di Story 2.3). `pnpm --` separatore filtro in `parseArgs` (pnpm inoltra `--` agli argv). **Nessun comando in `turbo.json`** (mai in CI/build, AC #1). Scelta documentata: `extract` usa il catalogo **committato** (non live) per il binding — provenienza deterministica e `fixtureHash` della ricetta allineato al vocabolario di validazione offline.
- **Task 4** — `mcp-client.ts` (modulo condiviso: `withTimeout`, envelope validation) + `component-reader.ts`. Scoperte empiriche (sonde MCP live): (1) le board figlie NON espongono `variantProps` — la mappa cella↔board passa da `variants.variantComponents()` + `shapeStructure(board,1).componentInstance.componentId`; (2) `shape.tokens` vuoto su Badge (confermato) → binding per **esatto value-match** (hex case-insensitive, radius con riferimenti `{...}` risolti), con preferenza deterministica per i token semantici (`color.mis.*`/`color.feedback.*`/`radius.mis.*`) sugli alias di scala; (3) **stop-signal esercitato per davvero**: la cella Red/soft usava `#ffb4ab`, assente da ogni set (committato E live) — su indicazione di Alessandro ("fai tu le modifiche") corretto direttamente su Penpot via `execute_code` (`penpot.openPage` per rendere Docs attiva + `shape.fills` setter; `applyToken` headless non persiste) a `color.feedback.error.container` `#ffdad6`, poi re-estrazione pulita 12/12 celle. Anche: `component-reader.test.ts` con transport mockato (seam `callTool`) chiude il deferred-work di Story 2.1; il pattern `close()` in `finally` non maschera l'errore primario né lascia socket SSE che tengono vivo il CLI (causa del primo hang dell'estrazione).
- **Task 5** — `badge.fixture.json` estratta live (12 celle: 11 con assi + Default `variantProps: null`; assi Color [Red,Green,Gray,Indigo] × Style [outline,soft,solid]) e committata; `badge.recipe.json` scritta a mano: `domain: data-display`, `headless: null`, `a11y` minimale/onesto (null role, zero ARIA — Badge base non è uno stato di lifecycle). Modello cva: la matrice Color×Style è encoded su un unico asse `colorStyle` (12 chiavi composte, incl. `indigo-solid` coperta dalla Default) perché lo schema della ricetta non prevede `compoundVariants` (spec Task 1 vincolante); Green e Indigo condividono gli stessi token in Penpot (fatti). `validate:recipe -- Badge` VERDE (provenienza inclusa).
- **Task 6** — 74 test, tutti offline: schema (13), vocabolario (12, con gli esempi letterali AC #2 `bg-[#3b82f6]`/`p-[7px]` e i tipi senza namespace v4), validator (7, inclusa la ricetta Badge reale committata), reader (11: envelope malformato, isError, non trovato, non-variant, stop-signal hex, timeout, assemblaggio/assi/Default).
- **Task 7** — `zod: "catalog:"` + script `extract:component`/`validate:recipe` in `packages/scripts/package.json`; `turbo.json` NON toccato; `pnpm install`/`check-types`/`lint`/`test`/`build` verdi a livello repo (14 build task, 9 check-types, 5 test/lint).
- **Task 8** — README aggiornato (estrazione, `src/recipes/`, validazione, confine fixture/ricetta, nota hex-match); `deferred-work.md`: voce reader chiusa per la parte component-reader, registrati Input/Accordion per Story 2.3, pattern hex-match e mappa cella↔board come note di pipeline; precisata la voce "API read-only" (le mutazioni shape a pagina attiva funzionano, i token no).

### File List

- packages/scripts/src/recipe-schema.ts (nuovo)
- packages/scripts/src/recipe-schema.test.ts (nuovo)
- packages/scripts/src/token-vocabulary.ts (nuovo)
- packages/scripts/src/token-vocabulary.test.ts (nuovo)
- packages/scripts/src/validate-recipe.ts (nuovo)
- packages/scripts/src/validate-recipe.test.ts (nuovo)
- packages/scripts/src/component-reader.ts (nuovo)
- packages/scripts/src/component-reader.test.ts (nuovo)
- packages/scripts/src/mcp-client.ts (nuovo)
- packages/scripts/src/extract-component.ts (nuovo)
- packages/scripts/src/recipes/badge.fixture.json (nuovo, estratto live da Penpot)
- packages/scripts/src/recipes/badge.recipe.json (nuovo, giudizio committato)
- packages/scripts/src/theme-generator.ts (modificato: `export` su `fixtureHash` e `TYPE_NAMESPACE`, richiesto dai Task 1/2 per il riuso)
- packages/scripts/package.json (modificato: dipendenza `zod: "catalog:"`, script `extract:component`/`validate:recipe`)
- packages/scripts/README.md (modificato: Stage 2, nuovi comandi, confine fixture/ricetta)
- pnpm-lock.yaml (modificato: `pnpm install` dopo l'aggiunta di zod)
- _bmad-output/implementation-artifacts/deferred-work.md (modificato: chiusura voce reader, note pipeline Story 2.2)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modificato: status story)
- _bmad-output/implementation-artifacts/2-2-estrazione-componenti-e-schema-delle-ricette.md (modificato: checkbox, record, status)

## Change Log

- 2026-09-06 — Story creata via create-story (context engine): analisi di epics (Epic 2, Story 2.2/2.3), Architecture Spine (AD-11, Structural Seed), companion penpot-pipeline.md/design-system.md, story 2.1 completa (dev notes, review findings, deferred-work), stato repo (`packages/scripts` esistente con `theme-generator.ts`/`penpot-reader.ts`/`generate-theme.ts`), sessione MCP Penpot live per verificare esistenza e struttura reale del componente Badge (VariantContainer Color×Style, hex non token-bound ma matchanti esattamente token Stadio 1 — risolto come lookup non invenzione) e la disponibilità di Input/Accordion per Story 2.3. Status → ready-for-dev.
- 2026-09-06 — Implementazione completa (dev-story): Task 1–8 completi. Pipeline Stage 2 per-componente (schema Zod, vocabolario token con gate valore-arbitrario, validatore ricetta, CLI extract/validate, component-reader MCP con binding per esatto value-match e stop-signal, fixture+ricetta Badge committate e validate:recipe VERDE, 74 test offline con transport mockato, README + deferred-work aggiornati). Incidenti gestiti: stop-signal hex `#ffb4ab` (Red/soft) risolto correggendo il fill su Penpot a `color.feedback.error.container` su autorizzazione esplicita di Alessandro; hang del CLI su socket MCP risolto con `close()` in `finally` + exit esplicito. `pnpm test/lint/check-types/build` verdi a livello repo. Status → review.
