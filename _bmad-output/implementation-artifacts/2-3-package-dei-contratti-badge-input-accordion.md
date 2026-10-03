---
baseline_commit: b41c951
---

# Story 2.3: Package dei contratti (Badge, Input, Accordion)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a sviluppatore,
I want un package `@app/contracts` con i contratti dei primi tre componenti,
so that il vocabolario delle props appartenga al page builder e non alla libreria generata (AD-5, AD-11).

## Acceptance Criteria

1. **Given** il monorepo **When** creo `packages/contracts` con schemi Zod delle props, tipi di asse (`option`/`state`/`behavior`), parti e classifier structure/content per **Badge**, **Input** e **AccordionItem**, e il tipo "definizione di sezione" (con cui si modella **Accordion Root**, albero di AccordionItem) **Then** il package compila e i test passano.
2. **And** il package non ha dipendenze da React/Puck/UI, e lo verifica un **lint bloccante** (`pnpm lint`, quindi CI) che ha una **prova rosso/verde propria**: test automatici, non un canary manuale.
3. **And** `schemaVersion` è esportata, ogni campo di ogni contratto è classificato `structure` o `content`, e un campo (o componente) ignoto risulta `content` (fail-safe).

## Tasks / Subtasks

- [x] Task 1: Scaffolding del package (AC: #1, #2)
  - [x] `packages/contracts/package.json`: `"name": "@app/contracts"`, `"private": true`, `"version": "0.0.0"`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }` (export da sorgente, niente build: stesso schema di `@app/domain`). Script: `"check-types": "tsc --noEmit"`, `"lint": "node ./scripts/check-boundaries.mjs"`, `"test": "vitest run"`. `dependencies`: **solo** `"zod": "catalog:"`. `devDependencies`: `"@app/config": "workspace:*"`, `"typescript": "catalog:"`, `"vitest": "catalog:"` (aggiungi `"@types/node": "catalog:"` solo se i test lo richiedono, per `node:fs`/`node:crypto`). Nessuna versione ad-hoc: tutto dal catalog di `pnpm-workspace.yaml`.
  - [x] `packages/contracts/tsconfig.json`: `extends "@app/config/tsconfig.base.json"`, `include: ["src/**/*.ts", "tests/**/*.ts"]`. **Non** copiare `composite`/`outDir`/`declaration*` da `packages/domain/tsconfig.json`: è il cargo-cult segnalato in `deferred-work.md` (nessuno emette nulla). Il modello da seguire è `packages/scripts/tsconfig.json`.
  - [x] Test in `packages/contracts/tests/` (come `packages/domain/tests/`), **non** in `src/`. Così `src/` resta codice di contratto puro e il lint può essere rigido senza eccezioni per `vitest`. Niente `vitest.config.ts`: i default di vitest trovano `tests/**/*.test.ts` (lo fa già `packages/domain`).
  - [x] `pnpm install` per aggiornare `pnpm-lock.yaml`. Il glob `packages/*` di `pnpm-workspace.yaml` include già il nuovo package, e `turbo.json` non va toccato: i task `lint`/`test`/`check-types` sono scoperti dagli script del package, e la CI (`.github/workflows/ci.yml`) esegue già `pnpm check-types`, `pnpm lint` e `pnpm test`.
- [x] Task 2: Modello del contratto (AC: #1, #3)
  - [x] `src/contract.ts`: tipi e helper **agnostici** (nessun componente nominato qui).
    - `AxisType = "option" | "state" | "behavior"`; `FieldKind = "structure" | "content"`.
    - `Axis = { name; type: AxisType; values: readonly [string, ...string[]]; default: <uno dei values> }`.
    - `FieldDef = { schema: z.ZodType; kind: FieldKind }`.
    - `ComponentContract = { name /* kebab-case, es. "accordion-item" */; version: number /* intero ≥1 */; axes: readonly Axis[]; parts: readonly [string, ...string[]]; fields: Record<string, FieldDef> }`.
  - [x] `defineContract(def)`: restituisce il contratto tipizzato (con `as const`/generics per preservare i literal) e **fallisce a module load**, con messaggio che nomina contratto e campo, se: `name` non è kebab-case (`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`, lo stesso formato del plugin data `pagebuilder/contract = nome@versione`); `version` non è un intero ≥1; ci sono nomi d'asse duplicati; ci sono valori duplicati in un asse; `default` non è tra i `values`; ci sono parti duplicate; un campo in `fields` ha lo stesso nome di un asse `option`. **Le parti sono una lista piatta di nomi**, senza annidamento, per costruzione del tipo: è il lato contratto del criterio di stop meccanico che la Story 2.5 imporrà su `RecipeSchema`.
  - [x] `propsSchema(contract)`: deriva lo schema Zod delle props. Ogni asse **`option`** diventa una prop `z.enum(values)` con `.default(axis.default)` ed è **`structure` d'ufficio**. Gli assi **`state`** e **`behavior`** **non producono props** (AD-11: il browser o l'headless li gestiscono). Ogni voce di `fields` diventa una prop con il suo `schema`. Usa **`z.looseObject`** (Zod 4), non uno schema strict né uno che scarta i campi: Puck mette `id` dentro `props`, il payload deve fare round-trip lossless (AD-6/CAP-6), e un campo ignoto deve arrivare al classifier come `content` (fail-safe) invece di sparire o di far fallire la validazione. Decidere se rifiutare i campi ignoti spetta al core (Story 4.3), non a questa story.
  - [x] `contractId(contract)` → `"badge@1"`: lo stesso formato del plugin data Penpot, usato dalla Story 2.4 (bootstrap) e dalla 2.5 (lettura del legame).
- [x] Task 3: I tre contratti (AC: #1, #3)
  - [x] Un file per contratto in `src/components/` (`badge.ts`, `input.ts`, `accordion-item.ts`). Valori **allineati al prototipo del forge**, verificato via MCP Penpot il 2026-09-12 sul file "Nuovo File 4" (lettura, nessuna scrittura), che ha già il plugin data `badge@1`/`input@1`/`accordion-item@1`:

    | Contratto | Assi | Parti | Fields |
    |---|---|---|---|
    | `badge@1` | `variant` **option**: `default`/`secondary`/`destructive`, default `default`; `size` **option**: `sm`/`md`, default `md` | `root`, `label` | `label`: `z.string()`, **content** |
    | `input@1` | `state` **state**: `default`/`focus`/`error`/`disabled`, default `default` | `root`, `placeholder` | `placeholder`: `z.string()`, **content** |
    | `accordion-item@1` | `state` **behavior**: `closed`/`open`, default `closed` | `root`, `trigger`, `label`, `chevron`, `content`, `body`, `divider` | `label`: `z.string()`, **content**; `body`: `z.string()`, **content** |

  - [x] **Nessun asse o campo in più** rispetto alla tabella (niente `type` di Input, niente `disabled` come prop, niente `outline` di Badge). Il vocabolario è del page builder, e ogni aggiunta futura è un cambio esplicito di contratto con bump di `schemaVersion` (AD-6/AD-11). Se durante lo sviluppo un'aggiunta ti sembra necessaria, fermati e segnalala come decision-needed invece di aggiungerla.
  - [x] In Penpot, `chevron`/`label` di AccordionItem stanno dentro la board `trigger`, e `body` dentro `content`. Nel contratto le parti restano **piatte**: l'annidamento geometrico di Penpot è layout, non "parte con assi propri". La geometria del `chevron` (path) sarà ignorata dalla ricetta (Story 2.5).
  - [x] `src/registry.ts`: `COMPONENT_CONTRACTS`, un record `name → contract` con i tre contratti. È l'unico punto che li elenca: classifier, fingerprint e test lo leggono da qui.
- [x] Task 4: Definizioni di sezione e Accordion Root (AC: #1)
  - [x] `src/section.ts`: `SectionDefinitionSchema` (Zod) più il tipo. Forma minima:
    - `SectionDefinition = { name (kebab-case); version; fields: Record<string, FieldDef>; root: SectionNode; slots: SlotDef[] }`
    - `SectionNode = { id: string (stabile, non posizionale); component: string /* nome contratto */; props: Record<string, unknown>; slot?: string /* id di uno SlotDef: qui il nodo accetta figli */; children?: SectionNode[] }`
    - `SlotDef = { id: string; allow: [string, ...string[]] /* nomi contratto */; max?: number /* intero ≥1 */ }`

    `fields` sono le props proprie della sezione (Accordion Root: `type`). La forma è un **punto di partenza**: la Story 3.4 la estenderà (ad esempio id Penpot per gli slot). Tienila minima, ma senza campi che la 3.4 dovrebbe rinominare.
  - [x] `validateSectionDefinition(def, contracts = COMPONENT_CONTRACTS)`: funzione pura che restituisce `{ valid: true } | { valid: false; errors: string[] }`, dove ogni errore nomina sezione, nodo o slot. Controlla che: ogni `component` esista nel registry; le `props` di ogni nodo passino `propsSchema` del suo contratto; gli id dei nodi siano unici; gli id degli slot siano unici; ogni `allow` punti a contratti esistenti; ogni `slot` di un nodo punti a uno `SlotDef` dichiarato; i `children` di default di uno slot siano componenti dell'`allow` e non più di `max`. Nessun `throw` per errori di dati: il fail-loud qui è l'elenco degli errori.
  - [x] `src/sections/accordion.ts`: **Accordion Root** come `SectionDefinition` (`name: "accordion"`, `version: 1`). Field `type`: `z.enum(["single", "multiple"])` con default `single`, **structure**. Il root node ha uno slot `items` con `allow: ["accordion-item"]`, senza `max`, e due AccordionItem di default con `label`/`body` segnaposto. Accordion Root **non è un contratto di componente né una ricetta** (AD-11: "Composizione ≠ ricetta"): è un albero di dati. Il root node usa un contratto contenitore? **No**: in questa story non esiste Box/Flex (arriva con la 3.2). Decidi e documenta nel codice uno di questi due approcci: (a) `root` è il nodo sezione stesso, con `component: "accordion"` riservato alla sezione; (b) `SectionDefinition` ha direttamente `slots` e `children` al primo livello, senza un nodo root. Scegli quello che fa passare la validazione **senza** un contratto finto nel registry, e indica la scelta nelle Completion Notes. Un test dimostra che la definizione è valida.
  - [x] `SECTION_DEFINITIONS`: record `name → definition` accanto a `COMPONENT_CONTRACTS`.
- [x] Task 5: Classifier structure/content e `schemaVersion` (AC: #3)
  - [x] `src/classifier.ts`: `classifyField(blockName: string, fieldName: string): FieldKind`. Cerca prima in `COMPONENT_CONTRACTS` e poi in `SECTION_DEFINITIONS`. Asse `option` → `structure`; voce di `fields` → il suo `kind`; **componente ignoto, campo ignoto o nome d'asse `state`/`behavior` usato come prop → `content`** (fail-safe, AD-5/NFR3). Nessuna tabella di classificazione separata dai contratti: il `kind` vive dentro `FieldDef`, così un campo non può esistere senza classificazione (AC #3 garantito dal tipo, non dalla disciplina).
  - [x] `src/schema-version.ts`: `export const SCHEMA_VERSION = 1`, un intero posseduto da `contracts` (AD-6). Va esportato anche da `index.ts`.
  - [x] Guardia meccanica del bump (AD-6: "un cambio di contratto è un bump esplicito"). `tests/schema-version.test.ts` calcola un fingerprint canonico di `COMPONENT_CONTRACTS` + `SECTION_DEFINITIONS`: sha256 di un JSON con chiavi ordinate che contiene nome, versione, assi (tipo/valori/default), parti e fields (nome, kind, e `z.toJSONSchema(schema)` di Zod 4 per la forma). Lo confronta con `tests/contracts.fingerprint.json` (`{ "1": "<hash>" }`), che deve avere una voce per `SCHEMA_VERSION` corrente. Cambiare un contratto senza aggiungere la voce del nuovo `SCHEMA_VERSION` fa fallire il test. Scrivi nel file di test che le voci sono **append-only** e che riscrivere l'hash di una versione esistente è proprio ciò che la review deve rifiutare. Il calcolo sta in `tests/` perché `node:crypto` non deve entrare in `src/` (vedi Task 6).
  - [x] `src/index.ts`: barrel che esporta tipi, `defineContract`, `propsSchema`, `contractId`, i tre contratti, `COMPONENT_CONTRACTS`, `SectionDefinitionSchema`, `validateSectionDefinition`, `SECTION_DEFINITIONS`, `classifyField` e `SCHEMA_VERSION`.
- [x] Task 6: Lint bloccante di confine, con test propri (AC: #2)
  - [x] `scripts/check-boundaries.mjs`. **Allowlist, non denylist**: la retro di Epic 1 mostra che ogni check a denylist scritto a mano era aggirabile alla prima stesura (`packages/domain|api|ui/scripts/check-boundaries.mjs`). Regole:
    - **Import in `src/`**: ammessi solo `zod` (e `zod/…`) e import relativi (`./`, `../`) che, risolti, restano dentro `src/`. Tutto il resto fallisce: `react`, `@puckeditor/*`, `@radix-ui/*`, `class-variance-authority`, `tailwind*`, `shadcn`, `@penpot-ds/*`, `@app/*`, **anche i builtin `node:*`**, perché i contratti girano sia nel browser sia nel server (AD-5 "condivisi FE/BE").
    - **Forme di import coperte**: `import … from "x"` (anche multi-riga e `import type`), `export … from "x"`, `import "x"`, `import("x")`, `require("x")`. Un `import(`/`require(` con argomento **non letterale** fallisce comunque (fail-closed: uno specifier costruito a runtime non si può verificare).
    - **`package.json`**: le chiavi di `dependencies` devono essere un sottoinsieme di `{ "zod" }`; `peerDependencies`/`optionalDependencies` assenti o vuote; `devDependencies` un sottoinsieme di `{ "@app/config", "typescript", "vitest", "@types/node" }`. Il controllo sul `package.json` è la differenza principale dagli altri check del repo, che guardano solo gli specifier.
    - **Fail-closed sullo scan**, come `packages/domain/scripts/check-boundaries.mjs`: zero file scansionati → rosso; errori di lettura/stat → rosso; commento di blocco non chiuso → rosso. Riusa lo `stripComments` di quel file (commenti rimossi, righe preservate, literal intatti) copiandolo: non esiste un package condiviso per i gate, e crearne uno è fuori scope.
  - [x] **Struttura testabile** (lezione dal Round 4 della Story 2.2: `extract-component.ts` eseguiva `main()` all'import). Esporta una funzione pura `checkBoundaries({ packageRoot }) → { violations, scanErrors, scannedFileCount }` e chiama il CLI solo quando lo script è invocato direttamente (`import.meta.url === pathToFileURL(process.argv[1]).href`). Il CLI esce con 1 alla prima categoria di problemi, con messaggi che nominano file:riga e specifier (stesso stile di `fail()` negli altri check). Aggiungi `scripts/check-boundaries.d.mts` con i tipi della funzione esportata, così il test TS la importa senza `allowJs` e senza errori `TS7016` in `check-types`.
  - [x] `tests/check-boundaries.test.ts`: la **prova rosso/verde** richiesta da AC #2 e dall'action item della retro Epic 1. Ogni caso crea un package finto in una directory temporanea (`fs.mkdtempSync(os.tmpdir())`, rimossa in `afterEach`) con un `package.json` e una `src/` minimali, poi chiama `checkBoundaries`. Casi minimi:
    - verde: package pulito (`import { z } from "zod"` + import relativo); il package **reale** `packages/contracts` è verde (evita un gate che passa solo sui fixture);
    - rosso: `import React from "react"`; `import type { Config } from "@puckeditor/core"`; import multi-riga di `@radix-ui/react-accordion`; `export * from "@penpot-ds/ui"`; `import("react")`; `import("re" + "act")` (non letterale); `require("react")`; `import { readFileSync } from "node:fs"`; import relativo che esce da `src/` (`../../ui/src/x`); `"react"` in `dependencies`; `peerDependencies` non vuote; `src/` vuota o assente;
    - non-violazione: la stringa `react` dentro un commento, e un literal non di import (`const label = "react"`). Se lo scanner a regex non riesce a distinguere il secondo caso, documentalo come limite fail-closed nel commento dello script e trasforma il caso in un test "rosso atteso". Non indebolire la regola.
  - [x] Verifica end-to-end del CLI reale, una volta e a mano: aggiungi `import "react"` in un file di `src/`, lancia `pnpm --filter @app/contracts lint` (deve uscire con 1), poi rimuovi l'import. Scrivi l'esito nelle Completion Notes. Questo è un complemento dei test automatici, non un sostituto.
- [x] Task 7: Test dei contratti (AC: #1, #3)
  - [x] `tests/contract.test.ts`: `defineContract` rifiuta ognuno dei casi del Task 2 (nome non kebab, versione 0, asse duplicato, valore duplicato, default fuori valori, parte duplicata, field che collide con un asse `option`), e l'errore nomina contratto e campo.
  - [x] `tests/components.test.ts`: per ciascuno dei tre contratti verifica assi, tipi d'asse, valori, default e parti esattamente come nella tabella del Task 3 (asserzioni esplicite, non snapshot). Poi, sulle props: `propsSchema(badge)` accetta `{ variant: "destructive", size: "sm", label: "Nuovo" }`, applica i default (`{ label: "x" }` → `variant: "default"`, `size: "md"`), rifiuta `variant: "outline"` e preserva un campo ignoto e `id`. `propsSchema(input)`/`propsSchema(accordionItem)` **non** contengono una chiave `state`. `contractId` restituisce `badge@1`/`input@1`/`accordion-item@1`.
  - [x] `tests/classifier.test.ts`: **ogni** campo di ogni contratto e sezione ha un `kind` (iterazione sul registry, così un contratto nuovo è coperto senza toccare il test); `classifyField("badge", "variant") === "structure"`; `classifyField("badge", "label") === "content"`; campo ignoto → `content`; componente ignoto → `content`; `classifyField("input", "state") === "content"` (asse non-option, non è una prop strutturale); `classifyField("accordion", "type") === "structure"`.
  - [x] `tests/section.test.ts`: Accordion Root valida; errori nominati per componente ignoto nel registry, props non valide su un nodo (es. AccordionItem senza `label`), id di nodo duplicato, `allow` verso un contratto inesistente, figlio fuori `allow`, figli oltre `max` (su una definizione di test con `max: 1`), `slot` che punta a uno SlotDef inesistente.
  - [x] Tutti i test offline e deterministici: niente rete, niente Penpot, niente orologio.
- [x] Task 8: Documentazione e chiusura (AC: #1, #2, #3)
  - [x] `packages/contracts/README.md`, breve come `packages/tokens/README.md`: cosa possiede il package (AD-5), la regola "zero dipendenze UI" col comando di lint, i tipi d'asse con l'instradamento previsto a valle, come si aggiunge un contratto (file in `components/`, voce nel registry, bump di `SCHEMA_VERSION` e nuova voce nel fingerprint), e il formato `nome@versione` del plugin data Penpot.
  - [x] `pnpm install`, `pnpm check-types`, `pnpm lint`, `pnpm test` e `pnpm build` verdi **a livello repo**.
  - [x] `deferred-work.md`: aggiungi una sezione "Deferred from: dev-story of 2-3-package-dei-contratti" solo se rimandi qualcosa di reale. Candidato già noto: il `check-boundaries.mjs` di questo package ha test propri, gli altri cinque (`domain`, `api`, `ui`, `scripts`, `tokens`) no. L'action item Epic 1 resta **open**: questa story fornisce il modello (funzione esportata + test su tmpdir), ma non va esteso agli altri package qui (scope).

### Review Findings

- [x] [Review][Decision] Field omonimo di un asse `state`/`behavior` con `kind: "structure"` violerebbe il fail-safe di AC#3 — `defineContract` blocca solo la collisione con assi `option`; un field `state` con kind `structure` farebbe restituire `structure` a `classifyField`, contro la regola "nome d'asse state/behavior usato come prop → content". Oggi latente (nessun contratto coinvolto), ma il test `consente un field con lo stesso nome di un asse non-option` codifica la lacuna come comportamento atteso. Decidere: vietare la collisione con qualsiasi asse, o forzare `content` nel classifier. [src/contract.ts:82-86, src/classifier.ts:23-24, tests/contract.test.ts:54]
- [x] [Review][Decision] `defineContract` non valida nomi di parti/assi né le istanze degli schemi — parti vuote o con spazi passano (nutriranno i nomi classe dell'emitter 2.6), uno `schema` non-Zod non fa fallire il load contraddicendo "fallisce a module load se incoerente", e un field `"__proto__"` viene perso dall'assegnazione in `propsSchema`. Decidere quanto inasprire. [src/contract.ts:64-106]
- [x] [Review][Decision] Tripla versioning senza procedura nel README — coesistono `contract.version` (in `contractId` → plugin data Penpot), `SectionDefinition.version` e `SCHEMA_VERSION`; il README dice solo di bumpare `SCHEMA_VERSION`. Si può cambiare il vocabolario di badge lasciando `badge@1` invariato. Decidere la regola di bump di `contract.version` e documentarla. [packages/contracts/README.md]
- [x] [Review][Decision] Il fingerprint include `root` e `slots` delle sezioni — lo spec enumera solo nome/versione/fields; così un cambio di solo segnaposto content nei children di default forza un bump di `SCHEMA_VERSION` con voce append-only. Deviazione più restrittiva dello spec, non dichiarata nelle Completion Notes. Decidere: allineare allo spec o dichiarare la scelta più rigida. [tests/schema-version.test.ts:57-63]
- [x] [Review][Patch] Template literal interpolato in clausola `from` elude la scansione specifier (fail-open) — `` export * from `./x${n}` `` matcha `SPECIFIER` come percorso relativo e `isAllowedSpecifier` lo risolve letteralmente dentro `src/`: verde, mentre l'intent documentato è rosso per specifier costruiti a runtime. [packages/contracts/scripts/check-boundaries.mjs:54,184-190]
- [x] [Review][Patch] `"zod/../react"` attraversa l'allowlist del prefisso — `startsWith("zod/")` non controlla i segmenti `..`: risoluzione fuori dal package zod con gate verde. [packages/contracts/scripts/check-boundaries.mjs:185]
- [x] [Review][Patch] `process.getBuiltinModule("node:fs")` elude il gate — carica un builtin senza specifier, `require`, `eval` o `Function(`; non è tra i modi di caricamento enumerati nel commento né in `FORBIDDEN_CODE`. [packages/contracts/scripts/check-boundaries.mjs:59-64]
- [x] [Review][Patch] `package.json`: alias npm e sezioni non enumerate aggirano l'allowlist — `zod: "npm:react@19"` è verde (controllo sui nomi, non sui valori); `overrides`/`resolutions`/`pnpm.overrides` non sono in `MUST_BE_EMPTY`. [packages/contracts/scripts/check-boundaries.mjs:47-51,210-233]
- [x] [Review][Patch] File in `src/` con estensione sconosciuta o maiuscola ignorati silenziosamente — un `evil.TS` o `data.json` non matcha `SOURCE_EXTENSION` e non genera scan error: fail-open contro la filosofia allowlist del gate. [packages/contracts/scripts/check-boundaries.mjs:45,164-168]
- [x] [Review][Patch] `eval`/`Function`/`require`-as-value dentro interpolazioni `${…}` invisibili alla vista code — il contenuto dei template literal è blankato in `code`, quindi `FORBIDDEN_CODE` non li vede (gli specifier `import(`/`require(` con literal restano coperti via vista `out`). [packages/contracts/scripts/check-boundaries.mjs:108-127]
- [x] [Review][Patch] Regex literal desincronizza `stripComments` — un regex con apici (es. `/['"]/`) rompe il tracker dei literal e un regex con `\u` scatta il falso rosso della regola `\\u`; limite fail-closed reale ma non documentato tra i "Limiti dichiarati" e privo di test. [packages/contracts/scripts/check-boundaries.mjs:72-134]
- [x] [Review][Patch] Altri falsi positivi fail-closed non documentati né testati — `meta.from = "penpot"`, chiave computed `{ ["from"]: "x" }`, `obj.require("x")`, `import("x", { with: … })` (attributi di import) risultano rossi; è documentato solo il caso della stringa con `from "react"`. [packages/contracts/scripts/check-boundaries.mjs:54-57,279-284]
- [x] [Review][Patch] Assertion debole sul messaggio fail-loud del nome non kebab-case — `/demo|DemoChip.*name/i` è vera per qualunque messaggio che contenga "demo" (sempre presente): non verifica che il messaggio nomini il problema. [packages/contracts/tests/contract.test.ts:25]
- [x] [Review][Patch] Nessun test che valida tutte le `SECTION_DEFINITIONS` del registry — come fa il classifier test per i `kind`; oggi vale solo il test specifico dell'accordion, e il pin `toEqual({ accordion })` non impone la validazione di una sezione nuova. [packages/contracts/tests/section.test.ts]
- [x] [Review][Patch] `visit()` senza cap di profondità — un albero `children` patologicamente annidato lancia `RangeError`, violando la promessa "nessun throw per errori di dati". [packages/contracts/src/section.ts:117-159]
- [x] [Review][Patch] `z.object` non strict negli schemi di sezione — un typo in una chiave (`maxx`, `alow`) viene strip-to silenziosamente e la validazione resta verde. [packages/contracts/src/section.ts:55-77]
- [x] [Review][Defer] Fingerprint fragile per costruzione — `z.toJSONSchema` lancia su schemi legittimi futuri (transform, refinement) e l'output non è garantito stabile tra minor di zod: il test crasherebbe o forzerebbe bump di `SCHEMA_VERSION` senza cambio di contratto. [packages/contracts/tests/schema-version.test.ts:37-41] — deferred, pre-existing

## Dev Notes

### Contesto: perché esiste questa story

Il correct-course del 2026-09-12 (`sprint-change-proposal-2026-09-12.md`, scope Major, approvato) ha invertito l'ownership: **il contratto (assi, valori, tipo d'asse, parti) è del page builder**, Penpot possiede solo valori e aspetto. Il motivo concreto: le pagine salvate (jsonb Puck, AD-6) memorizzano i valori delle props, quindi se il vocabolario seguisse la libreria generata, cambiare libreria romperebbe tutte le pagine. Questa story crea la **porta** dell'esagono. Tutto il resto di Epic 2 e 3 dipende da qui:

- **2.4** bootstrap Penpot: legge i contratti per creare un VariantContainer per contratto, con plugin data `contractId()`;
- **2.5** estrazione: valida fixture e ricetta contro gli assi e le parti di questi contratti;
- **2.6** emitter: instrada per `AxisType` (`option` → `cva`; `state` → `focus-visible:`/`aria-invalid:`/`disabled:`; `behavior` → `data-[state=…]:`);
- **3.2/3.3/3.4** Puck: campi dagli assi `option`, `readOnly` dal classifier, sezioni da `SectionDefinition`;
- **4.3** core: valida con `propsSchema`, poi classifica e sanitizza i `content`.

Progetta le API pensando a questi consumer, **ma non implementarne nessuno**.

### Guardrail (cosa NON fare)

- **Non toccare** `packages/scripts` (`recipe-schema.ts`, `badge.fixture.json`, `badge.recipe.json`: li sostituisce la Story 2.5), `packages/ui`, `packages/tokens`, `packages/domain`, `packages/api`, `packages/auth`, `packages/db`, `packages/env`, `apps/web`, `turbo.json`, `.github/workflows/ci.yml`. Nessun package esistente deve dipendere da `@app/contracts` in questa story.
- **Non creare** `packages/puck-components` e non installare `@puckeditor/core` (arriva in Epic 3/4).
- **Non leggere né scrivere Penpot**: i valori del Task 3 sono già verificati. La scrittura su Penpot è della skill `penpot-ds` (Story 2.4).
- **Nessuna classe Tailwind, nome di token o nome di componente shadcn/Radix** in `src/`: il contratto non sa quale libreria lo renderà. Un nome come `destructive` è un **valore d'asse** del vocabolario, non un token.
- **Nessun contratto per Box/Flex/Grid/Columns** (Story 3.2) né per altri componenti del catalogo (Story 2.7).
- `@app/*` e non `@penpot-ds/*`: lo scope riflette l'ownership (convenzione dello spine: "`@app/contracts` = contratti dei componenti, classifier, definizioni di sezione (no React/Puck/UI)").

### Decisioni già prese (non riaprirle)

- Tipi d'asse dichiarati **nel contratto**, mai in Penpot (forge: "Tipo dell'asse dichiarato in Penpot" scartato perché rimetterebbe l'ownership a Penpot).
- Gli stati di Input (`focus`/`error`/`disabled`) cambiano lo **stile** in Penpot ma in codice sono pseudo-classi/attributi: nessuna prop. Gli stati di AccordionItem (`closed`/`open`) sono **comportamento** Radix (`data-state`): nessuna prop. Memlog del forge, verificato via MCP.
- Il vecchio criterio di stop "ricetta Accordion come albero annidato" è **superato**. La composizione di più item è una definizione di sezione (dati). Il criterio di stop meccanico (parte annidata con assi → lo schema fallisce) è della Story 2.5, con test rosso/verde propri.
- Sezioni rigide per default: struttura bloccata, contenuto modificabile, aperte solo negli slot (`allow` + `max`). `max` è **autoritativo nel core** (Puck 0.22 non ha `max` nativo; in editor si usa `resolvePermissions`). Questa story fornisce solo la forma dei dati e la validazione statica della definizione.

### Pattern da riusare

- **Check di confine**: struttura, `stripComments`, fail-closed sullo scan e stile dei messaggi da `packages/domain/scripts/check-boundaries.mjs` (il più completo dei cinque). Differenze volute: allowlist invece di denylist, controllo del `package.json`, funzione esportata e testata.
- **Invocazione diretta**: guardia `isDirectInvocation` introdotta nel Round 4 della Story 2.2 (`packages/scripts/src/extract-component.ts`).
- **Fail-loud che nomina il campo**: stile di `theme-generator.ts` e `validate-recipe.ts`.
- **Zod 4** (`zod@4.4.3` installato, catalog `^4.4.3`): `z.looseObject`/`z.strictObject` al posto dei vecchi `.passthrough()`/`.strict()`; `z.enum([...] as const)` vuole una tupla non vuota; `z.toJSONSchema(schema)` è nativo; il messaggio d'errore personalizzato si passa con `{ error: "..." }` (`message` è deprecato). Non usare `z.nativeEnum` (deprecato in v4).

### Intelligence dalle story precedenti

- **2.2 / Round 1-4**: quattro giri di review, perché le verifiche erano manuali (`validate:recipe -- Badge`) e mai via `import` da test. Il bug `main()` all'import è emerso solo scrivendo il primo test. Qui ogni funzione, gate compreso, nasce con i suoi test.
- **Retro Epic 1**: tutti i `check-boundaries.mjs` scritti a mano erano aggirabili alla prima stesura, e nessuno ha test propri. È il rischio numero uno dichiarato da Alessandro. AC #2 lo chiude per questo package: se un caso rosso del Task 6 passa, il gate è rotto, non il test.
- **2.1**: `tsup` + TS 6 richiede `ignoreDeprecations`. Qui non serve perché non c'è build (export da sorgente).
- Il ritmo delle PR è una story per branch (`story/2.3-package-dei-contratti`, già creato), con commit `feat(contracts)[bmad:2.3]: …` (vedi `git log`).

### Project Structure Notes

```
packages/contracts/                  # NUOVO — @app/contracts
  package.json
  tsconfig.json
  README.md
  scripts/
    check-boundaries.mjs             # gate allowlist (src + package.json), funzione esportata
    check-boundaries.d.mts           # tipi per il test
  src/
    index.ts                         # barrel
    contract.ts                      # AxisType, FieldKind, Axis, FieldDef, ComponentContract, defineContract, propsSchema, contractId
    section.ts                       # SectionDefinitionSchema, validateSectionDefinition
    classifier.ts                    # classifyField (fail-safe content)
    schema-version.ts                # SCHEMA_VERSION = 1
    registry.ts                      # COMPONENT_CONTRACTS, SECTION_DEFINITIONS
    components/
      badge.ts
      input.ts
      accordion-item.ts
    sections/
      accordion.ts                   # Accordion Root
  tests/
    contract.test.ts
    components.test.ts
    classifier.test.ts
    section.test.ts
    schema-version.test.ts
    contracts.fingerprint.json       # { "1": "<sha256>" } append-only
    check-boundaries.test.ts
```

- Coerente con la Structural Seed dello spine (`packages/contracts/`, "zero dipendenze UI (AD-5, AD-6, AD-11)"). L'unica deviazione dal layout di `packages/domain` è il tsconfig senza `composite`, voluta (cargo-cult nel deferred).
- Modifiche fuori dal package: solo `pnpm-lock.yaml` (install), `deferred-work.md` (se serve), `sprint-status.yaml` e questo file.
- Se preferisci far vivere `COMPONENT_CONTRACTS`/`SECTION_DEFINITIONS` in `index.ts` invece che in `registry.ts`, fallo pure. Resta però vincolante che un solo punto elenchi i contratti.

### Testing Requirements

- Vitest (`catalog:` `^5.0.0`), test in `tests/`, offline e deterministici.
- AC #2 si dimostra con `tests/check-boundaries.test.ts` (rosso/verde su tmpdir, più il package reale verde), non solo con `pnpm lint` verde.
- AC #3 si dimostra con l'iterazione del classifier sul registry e con i casi fail-safe espliciti.
- Non-regressione: i test esistenti (88 in `packages/scripts`, più domain/api/auth/db) restano verdi; `pnpm check-types`/`lint`/`test`/`build` verdi a livello repo.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Package dei contratti (Badge, Input, Accordion)] — user story e AC.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, #Story 2.4, #Story 2.5, #Story 2.6, #Story 3.2, #Story 3.3, #Story 3.4, #Story 4.3] — consumer a valle delle API.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-5, #AD-6, #AD-11, #AD-3, #Consistency Conventions, #Structural Seed] — ownership, zero dipendenze UI, `schemaVersion` di `contracts`, tipi d'asse, composizione ≠ ricetta, layering `contracts` foglia.
- [Source: _bmad-output/specs/spec-page-builder/penpot-pipeline.md#Stadio 0, #Confine contratto / fixture / ricetta / emitter, #Sezioni] — cosa vive nel contratto e cosa no.
- [Source: _bmad-output/specs/spec-page-builder/design-system.md#Layering e confini, #puck-components] — `contracts` foglia; structure/content in `@app/contracts`; sezioni rigide con `allow` + `max`.
- [Source: _bmad-output/specs/spec-page-builder/SPEC.md#CAP-4, #CAP-13, #Constraints] — rifiuto server fuori `allow`/`max`; fail-safe `content`.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-12.md#4.2, #4.6] — riscrittura di AD-5, contenuto della nuova 2.3.
- [Source: _bmad-output/forge/penpot-shadcn-e-esagono-puck/.memlog.md] — tipi d'asse per Input/AccordionItem, parti di AccordionItem, criterio di stop riformulato, verifiche Puck 0.22.4 (`allow` senza `max`, `readOnly` per prop).
- [Source: MCP Penpot, file "Nuovo File 4", lettura del 2026-09-12] — `Badge` (`badge@1`) `variant` default/secondary/destructive × `size` sm/md con figlio `label`; `Input` (`input@1`) `state` default/focus/error/disabled con figlio `placeholder`; `AccordionItem` (`accordion-item@1`) `state` closed/open con `trigger`(`label`, `chevron`), `content`(`body`), `divider`.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-page-builder-2026-07-26/EXPERIENCE.md:65] — sezioni: struttura bloccata, pannello con soli campi content, slot con contatore `max` (consumer in Epic 3/4).
- [Source: packages/domain/scripts/check-boundaries.mjs] — modello del gate (stripComments, fail-closed).
- [Source: packages/domain/package.json, packages/scripts/tsconfig.json, pnpm-workspace.yaml] — forma del package, tsconfig pulito, catalog versioni.
- [Source: _bmad-output/implementation-artifacts/2-2-estrazione-componenti-e-schema-delle-ricette.md#Review Findings — Round 4] — guardia `isDirectInvocation`, costo delle verifiche solo manuali.
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml#action_items] — test rosso/verde per i gate (Epic 1), criterio di stop in 2.5.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`), workflow bmad-dev-story.

### Debug Log References

- La shell di default usa Node 20.18.2, e il postinstall di `packages/db` fallisce (`ERR_REQUIRE_ESM`). Tutti i comandi sono stati rilanciati con Node 22.23.1 (`.node-version`), con cui `pnpm install` è pulito.
- In Zod 4 `z.array(...).nonempty()` è tipato `string[]`, non `[string, ...string[]]`. `SlotDef.allow` usa `z.tuple([z.string()], z.string())`.
- `SECTION_DEFINITIONS` ha una chiave calcolata di tipo `string`, quindi con `noUncheckedIndexedAccess` l'accesso può essere `undefined`. Il classifier legge il registry tramite record tipizzati e un helper `own()` che usa solo `Object.hasOwn`, quindi senza cast.
- Nel primo run del test del gate, il caso "package.json assente" usava `undefined` come argomento, e questo faceva scattare il parametro di default. L'helper ora usa `null`: il bug era nel test, non nel gate.

### Completion Notes List

- **Accordion Root, approccio (a)**: `root` è il nodo sezione stesso, con `component` uguale al `name` della sezione (`"accordion"`). Le sue props sono validate contro i `fields` della sezione, non contro un contratto, quindi nel registry non c'è nessun contratto finto. Ne segue un vincolo, verificato da `validateSectionDefinition`: il nome di una sezione non può coincidere con quello di un contratto. Scelta documentata in `src/section.ts`.
- Oltre ai controlli chiesti, `validateSectionDefinition` segnala anche due casi che l'approccio (a) rende necessari: nodo radice con `component` diverso dal nome della sezione, e figli di default su un nodo senza `slot`. Ogni errore nomina sezione, nodo o slot, e non c'è nessun `throw`.
- Contratti allineati alla tabella del Task 3, senza assi né campi aggiuntivi: nessuna aggiunta mi è sembrata necessaria, quindi nessun decision-needed.
- `propsSchema` usa `z.looseObject`: gli assi `option` diventano `z.enum(...).default(...)`, `state`/`behavior` non producono props, e `id` e i campi ignoti passano intatti.
- `classifyField` è fail-safe: componente ignoto, campo ignoto, asse `state`/`behavior` e chiavi di `Object.prototype` (`constructor`, `__proto__`) restituiscono tutti `content`.
- `SCHEMA_VERSION = 1`, con fingerprint `{"1": "fa4b4dda…"}`. Il test ha mostrato il rosso sul segnaposto prima che registrassi l'hash, e dichiara le voci append-only.
- **Gate di confine** (`scripts/check-boundaries.mjs`): allowlist su specifier (`zod`, `zod/…`, relativi dentro `src/`) e su `package.json`; funzione pura `checkBoundaries` con tipi `.d.mts`; CLI dietro la guardia di invocazione diretta. Rispetto al modello di `domain`, `stripComments` produce una seconda vista con i literal svuotati, che serve a trovare `require` usato come valore, escape `\u` negli identificatori, `eval` e `Function(`. Il caso `const label = "react"` è **verde**. C'è un limite fail-closed, documentato nello script e coperto da un test "rosso atteso": una *stringa* che contiene `from 'react'` risulta rossa, perché gli specifier si cercano con i literal intatti per non perdere import quando il parser si desincronizza.
- **Verifica end-to-end manuale del CLI**: ho aggiunto `import "react";` in fondo a `src/schema-version.ts` e lanciato `pnpm --filter @app/contracts lint`. Il comando esce con **1** e segnala `src/schema-version.ts:7 — import di "react" fuori allowlist`. Dopo aver ripristinato il file, il lint torna verde (10 file).
- Test: 86 in `@app/contracts`, in 6 file: contract, components, classifier, section, schema-version, check-boundaries. Sono offline e deterministici.
- Nessun package esistente dipende da `@app/contracts`. `turbo.json`, la CI e gli altri package non sono stati toccati.

- Test di non-regressione a livello repo: `check-types`, `lint` e `build` sono verdi. `pnpm test` è verde con il Postgres di sviluppo avviato (`pnpm db:start`, poi fermato con `db:stop`). Senza DB, le suite di integrazione di `@app/db` e `@app/auth` falliscono con "Can't reach database server at 127.0.0.1:5432": è un problema d'ambiente preesistente, e quei package non sono toccati da questa story.

### File List

- `packages/contracts/package.json` (nuovo)
- `packages/contracts/tsconfig.json` (nuovo)
- `packages/contracts/README.md` (nuovo)
- `packages/contracts/scripts/check-boundaries.mjs` (nuovo)
- `packages/contracts/scripts/check-boundaries.d.mts` (nuovo)
- `packages/contracts/src/index.ts` (nuovo)
- `packages/contracts/src/contract.ts` (nuovo)
- `packages/contracts/src/section.ts` (nuovo)
- `packages/contracts/src/classifier.ts` (nuovo)
- `packages/contracts/src/schema-version.ts` (nuovo)
- `packages/contracts/src/registry.ts` (nuovo)
- `packages/contracts/src/components/badge.ts` (nuovo)
- `packages/contracts/src/components/input.ts` (nuovo)
- `packages/contracts/src/components/accordion-item.ts` (nuovo)
- `packages/contracts/src/sections/accordion.ts` (nuovo)
- `packages/contracts/tests/contract.test.ts` (nuovo)
- `packages/contracts/tests/components.test.ts` (nuovo)
- `packages/contracts/tests/classifier.test.ts` (nuovo)
- `packages/contracts/tests/section.test.ts` (nuovo)
- `packages/contracts/tests/schema-version.test.ts` (nuovo)
- `packages/contracts/tests/contracts.fingerprint.json` (nuovo)
- `packages/contracts/tests/check-boundaries.test.ts` (nuovo)
- `pnpm-lock.yaml` (modificato)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modificato)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificato)
- `_bmad-output/implementation-artifacts/2-3-package-dei-contratti.md` (modificato)

## Change Log

- 2026-09-12 — Story creata via create-story dopo il correct-course 2026-09-12. Analizzati epics (Epic 2-4), spine (AD-3/5/6/11), companion (pipeline, design-system, SPEC), forge e memlog, story 2.2 (review Round 1-4), file 2.6 superato, deferred-work, retro Epic 1 e check di confine esistenti. Valori degli assi e parti verificati in sola lettura via MCP Penpot sul file del forge. Status → ready-for-dev.
- 2026-09-12 — dev-story: creato `@app/contracts` con contratti `badge@1`/`input@1`/`accordion-item@1`, sezione Accordion Root (approccio a), classifier fail-safe, `SCHEMA_VERSION` con fingerprint append-only e gate di confine ad allowlist con prova rosso/verde automatica (86 test). Status → review.
- 2026-09-12 — code-review (bmad-code-review, 3 layer paralleli): 4 decision-needed risolti da Alessandro, 12 patch applicate, 1 defer, 10 scartati. Gate allowlist blindato: template interpolati in `from` rossi, traversata `zod/../…` bloccata, `process.getBuiltinModule` in `FORBIDDEN_CODE`, alias npm/URL e sezioni `overrides`/`resolutions`/`pnpm.overrides` rifiutati, file in `src/` con estensione non riconosciuta = scan error, interpolazioni `${…}` ispezionate come codice, falsi positivi fail-closed documentati e testati. `defineContract` inasprito: collisione field/asse vietata per qualsiasi tipo d'asse, nomi di assi/parti/field validati (e `__proto__` rifiutato), `schema` deve essere `z.ZodType`. Sezioni: schemi `strictObject`, cap di profondità 100, test che valida tutto il registry. Fingerprint allineato allo spec (senza `root`/`slots`; hash della voce "1" riscritto: la SCHEMA_VERSION 1 non è mai stata rilasciata). README: regola di bump delle due versioni. 110 test verdi; `check-types`/`lint`/`test` verdi a livello repo (Node 22). Status → done.
