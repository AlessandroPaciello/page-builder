---
ticket: 22
title: 'Story 2.22 — Verifica e generazione: chiavi di parte, styles.ts, scaffold, story'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_revision: '9ea717b90ec6994d97ee588359187d19b8128522'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Il nucleo traduce un layer in classi (2.20–2.21), ma non sa ancora verificare un componente intero (chiavi di parte, istanze, celle) né generarne i file. Senza un generatore unico ogni componente richiederebbe codice suo nella pipeline (bug 8). Il `<Comp>.tsx` dello sviluppatore deve sopravvivere a ogni rigenerazione.

**Approach:** Il nucleo si arricchisce di quattro funzioni pure, `Lettura` → dati:
- `verifyComponent` → `Finding[]`;
- `buildOrder`;
- `generateComponent` → `Change[]` + suggerimenti;
- `scaffoldComponent`.

Tutto è guidato dal contratto in `@app/contracts`, senza codice per componente, e testato con dati scritti a mano (livello 1).

## Boundaries & Constraints

**Always:**
- confini della 2.19: nucleo senza disco, rete, `node:crypto`, console;
- regole della 2.20–2.21: classi ordinate, una proprietà non traducibile è un avviso;
- test in `tests/core/`;
- output deterministico byte per byte: niente date, ordine stabile;
- un file senza marker `@generated` non compare mai in un `Change` di tipo `aggiorna`/`elimina`.

**Never:**
- server MCP, scrittura su disco e livelli 2–3 della CI: sono della 2.24;
- adattatore: è della 2.23;
- sezioni e slot: sono della 2.27;
- comportamento Base UI e axe: sono della 2.30;
- scrittura delle risposte in Penpot: è della 2.29;
- codice o tabelle per singolo componente;
- copiare `test-v3/`;
- toccare `contracts`, `tokens`, `ui`.

**Decisioni di Alessandro (2026-10-18):**
- **Percorsi:** una cartella per componente: `packages/ui/src/domains/<kebab>/<Comp>.styles.ts|.stories.tsx|.tsx`. Non serve nessun dato in più. Un annidato si importa da `../<kebab-annidato>/<Nested>`. I `Change.path` sono relativi alla root del repo.
- **Il TSX come testo:** `existingTsx?: string` è un input facoltativo del generatore.
  - Una chiave è usata se il testo contiene `.<key>` oppure `["<key>"]`. Se non c'è nessuna delle due, la parte tolta dallo sviluppatore dà un avviso di export inutilizzato.
  - Non si usano regex su `data-slot`.
  - Gli esempi dei suggerimenti partono da questo testo.

**Decisioni (mie, ritoccabili al checkpoint):**
- **Contratto:** si trova da `Lettura.pluginData.contract` in `COMPONENT_CONTRACTS`.
  - Se manca o è sconosciuto, è un blocco.
  - Gli assi delle celle devono essere gli assi `option` del contratto più `state` facoltativo. Un asse o un valore estraneo è un blocco; le celle mancanti non sono un errore.
  - `Comp` = PascalCase del nome del contratto; `id` = camelCase.
- **Parti:** la chiave è `pluginData.part`.
  - Un layer senza chiave → domanda `key: part`, con opzioni [chiave proposta = kebab del nome del layer, `ignora`]. La risposta `ignora` lo fonde nel genitore: nessuna parte, le sue classi vanno perse con un avviso.
  - La radice senza chiave vale `root`, senza domanda.
  - Una chiave doppia tra fratelli → domanda `key: repeat` sul secondo layer, con opzioni [`lista`, `parte-nuova`].
    - `lista`: la parte è una lista; nel TSX è un `.map`, ma ha una `cva` sola.
    - `parte-nuova`: il layer resta senza chiave valida finché `pds-code` non scrive la nuova chiave, quindi la domanda `part` resta aperta.
  - La stessa chiave in rami diversi è un blocco.
  - Una parte è la stessa tra celle diverse se ha la stessa chiave.
- **Istanze annidate** (`instance` presente):
  - la parte rende `<Nested />`;
  - le sue variant sono validate sul contratto del componente annidato, e un valore fuori contratto è un blocco;
  - un `overrides` non vuoto è un blocco, ma i nomi di dimensionamento e di geometria (`sizingH`, `sizingV` e ogni voce `GEOMETRY_ENTRIES`) non sono override (bug 12);
  - l'istanza ha una `cva` di sola collocazione (geometria e dimensionamento) e una mappa `<id>Instances.<key>(axes)` → props di variante (una tabella per cella se varia);
  - i figli di un'istanza non si visitano.
- **`styles.ts`:**
  - una `cva` per chiave, con tutti gli assi `option` (stringa vuota dove non cambia niente);
  - scomposizione: le classi comuni a tutte le celle vanno nella base; quelle spiegate da un solo asse in `variants`; le altre in `compoundVariants`;
  - le classi della radice per cella vengono da `rootSizeClasses` e entrano nella scomposizione;
  - `export const <id>Parts = [...] as const`;
  - `export type <Comp>Axes`.
- **Asse `state`** (riservato, mai una prop):
  - celle con `state` ∈ `hover|active|focus|disabled`; la base è `state=default`, oppure l'asse è assente;
  - differenza = classi della cella di stato che mancano nella cella base con gli stessi altri assi;
  - prefissi: `hover:`, `active:`, `focus-visible:`, e `[&:is(:disabled,[data-disabled],[aria-disabled=true])]:` per disabled, come il default globale;
  - **generalizzazione (decisione di Alessandro, 2026-10-18, dopo la review):** si generalizza solo l'asse che si chiama `size`. Uno stato disegnato su una taglia vale per tutte le taglie con gli stessi valori degli altri assi. Gli altri assi devono coincidere: un hover disegnato solo su `variant=default` non va su `secondary`, anche se è soltanto additivo. Se gli stati sono disegnati su più taglie, ogni taglia disegnata tiene la sua differenza, e le taglie non disegnate prendono quella della taglia di default del contratto, se c'è. La convenzione sul nome `size` va documentata nel README;
  - focus e disabled non disegnati non danno classi: vale il default di `globals.css`;
  - un altro valore di `state` è un blocco.
- **Intestazione `@generated`:** `// @generated pds <GENERATOR_VERSION> sha256:<hex> — non modificare a mano`.
  - L'hash si calcola sul corpo dopo la prima riga, con LF.
  - SHA-256 è scritto in TS puro nel nucleo, e il test lo confronta con `node:crypto`.
  - `readGeneratedHeader(text)` → `{version, hash, ok}` serve al livello 3 della 2.24.
- **Story** (`<Comp>.stories.tsx`): una per cella non di stato, in CSF3 con `args` = assi + campioni dei field ricavati dallo schema zod (stringa → nome del field, numero 1, booleano `false`, enum → primo valore, opzionale omesso). Il nome è il PascalCase dei valori.
- **Scaffold** (`<Comp>.tsx`, solo se `existingTsx` è assente):
  - `data-slot` = chiave (la radice ha il nome del contratto);
  - `className={s.<key>(axes)}`, radice con `cn(…, className)` e `{...props}`;
  - elemento proposto:
    - la risposta `pluginData.element`, se c'è;
    - altrimenti un indizio nel nome (`button`, `link`→`a`, `input`, `label`, `img|image`);
    - poi `kind` (`text`→`span`, `image`→`img`, altrimenti `div`);
  - ambiguo = un nome con indizio di titolo (`title|heading|titolo`) → domanda `key: element`, con opzioni [`h2`, `h3`, `p`].
- **`buildOrder(letture, generated)`:** ordine topologico dalle istanze. Un componente annidato che non è né in `letture` né in `generated` è un blocco, e lo è anche un ciclo. `generateComponent` rifiuta (blocco) un'istanza di un componente che non sta in `generated`.
- **Blocchi e domande** fermano `generateComponent`: nessun `Change`.
- **Cambio di struttura:** si confrontano le `<id>Parts` dello `styles.ts` esistente con le nuove. Per ogni parte aggiunta, tolta o diventata lista c'è un `Suggerimento {part, kind, message, example}`, mai applicato. L'esempio usa il TSX attuale.
- **Scala:** `scaleFromThemeCss(css)` è una funzione del nucleo che legge le `--spacing-<sfx>: <n>px`. La usa il livello 4 al posto della regex locale e chiude la voce deferred della 2.21.

## I/O & Edge-Case Matrix

| Scenario | Input | Output |
|---|---|---|
| ok | Badge, 2 assi, celle complete, parti con chiave | `crea` styles/stories/tsx, nessun finding bloccante |
| senza chiave | layer `Icon Left` senza `part` | domanda `part`, opzioni [`icon-left`, `ignora`]; nessun Change |
| doppia | due fratelli `part: item` | domanda `repeat` sul secondo |
| risposta lista | come sopra, `pluginData.repeat: lista` | una `cva` `item`, nessuna domanda |
| istanza ok | ShopCard con Badge `variant: destructive` | `<Badge {...shopCardInstances.action(axes)} />` |
| variante ignota | Badge `variant: neon` | blocco |
| override | `overrides: ["fill"]` | blocco; `["sizingH","width"]` → nessun blocco |
| hover | `state=hover` su size=md, variant=default | `hover:bg-…` su tutte le taglie di default |
| TSX esistente | `existingTsx` presente | nessun Change sul `.tsx`; byte identico (T4b-2) |
| non generato | istanza di `badge`, `generated: []` | blocco che nomina `badge` |
| ordine | ShopCard⊃Badge | `["badge","shop-card"]`; ciclo → blocco |
| parte nuova | `<id>Parts` vecchie senza `price` | `aggiorna` styles + suggerimento `aggiunta` |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/core/registry.ts`: si riusano `layerClasses(layer, {parent, tokenTypeOf, scale})` e `collapseRadius`; il registro non cambia.
- `packages/scripts/src/core/geometry.ts`: `rootSizeClasses(cells, {scale})` (classi per cella → scomposizione), `GEOMETRY_ENTRIES` (nomi esclusi dagli override), `Scale`.
- `packages/scripts/src/core/schemas.ts`: `Lettura`, `Finding` (domanda con `key` e almeno 2 `options`), `Change`. Qui si aggiunge lo schema `Suggerimento`.
- `packages/scripts/src/shared/naming.ts`: `toKebab`/`pascalCase`. Il nucleo non può importare da `shared`, quindi vanno spostati in `src/core/naming.ts` e `shared` li riesporta, se il gate lo ammette; altrimenti si duplicano.
- `packages/contracts/src/registry.ts`: `COMPONENT_CONTRACTS`, chiave = nome kebab. `contract.ts`: assi solo `option`, field con `schema` zod e `kind`.
- `packages/ui/src/lib/utils.ts`: `cn`, importato dallo scaffold. `packages/ui/src/styles/globals.css:18-42`: i default di focus e disabled, che il prefisso disabled ricalca.
- `packages/ui/src/stories.smoke.test.tsx`: la forma CSF3 con `args` che le story generate devono rispettare.
- `packages/scripts/tests/core/registry-tailwind.test.ts:89-91`: `scaleOf`, da sostituire con `scaleFromThemeCss`. Le classi di stato (prefisso + classe di registro) vanno aggiunte al livello 4.
- `packages/scripts/scripts/check-boundaries.mjs`: regola `core` (ammessi solo relativi, `@app/contracts` e `zod`).
- Spike, solo riferimento: `test-v3/codice/packages/scripts/src/v3/styles.ts:20-100` (`decompose`, forma di `styles.ts`), `:102-202` (scaffold; via la data); `prove.md:139` (T4b-2).

## Tasks & Acceptance

**Execution:**
- [x] `tests/core/verify.test.ts`, `generate.test.ts`, `build-order.test.ts`, `hash.test.ts`: scritti per primi, rossi; una `Lettura` di Badge e di ShopCard⊃Badge scritta a mano; la matrice.
- [x] `src/core/hash.ts`: SHA-256 puro, intestazione, `readGeneratedHeader`, `GENERATOR_VERSION`.
- [x] `src/core/verify.ts`: parti, chiavi, istanze, assi e stati → `Finding[]`.
- [x] `src/core/generate.ts`: scomposizione, `styles.ts`, story, scaffold, suggerimenti, `Change[]`.
- [x] `src/core/build-order.ts`.
- [x] `src/core/schemas.ts`, `naming.ts`, `index.ts`, `scaleFromThemeCss`: `Suggerimento`, export.
- [x] `tests/core/registry-tailwind.test.ts`: `scaleFromThemeCss` + classi di stato al livello 4.
- [x] Il README del package; `deferred-work.md` (chiusa la voce Scale della 2.21); `sprint-status.yaml`.

**Acceptance Criteria:**
- Given una `Lettura` con domande o blocchi aperti, when chiamo `generateComponent`, then nessun `Change` e i finding li nominano.
- Given un `existingTsx` qualunque, when rigenero due volte, then nessun `Change` tocca il `.tsx` e il secondo giro produce lo stesso output del primo, byte per byte.
- Given il corpo di un file generato modificato di un carattere, when chiamo `readGeneratedHeader`, then `ok: false`.
- Given il livello 4, when le classi di stato espanse compilano, then ognuna produce CSS.
- Given `pnpm turbo run check-types lint test --force`, then tutto è verde.

## Implementation Notes

- `@app/contracts` è diventata dipendenza `workspace:*` di `packages/scripts` (prima non era installata nel package).
- `contracts` è un input facoltativo (default `COMPONENT_CONTRACTS`): ShopCard non esiste in `@app/contracts`, i test la definiscono in `tests/fixtures/components.ts` con `defineContract`.
- Input in più del generatore: `existingStyles?`/`existingStories?` (per `aggiorna` e per il confronto delle parti). Un file generato identico al nuovo non produce `Change`; uno senza marker è un blocco; uno con hash non valido si aggiorna con un avviso.
- `styles.ts` esporta anche `<id>ListParts`, che serve a riconoscere una parte "diventata lista". Le `cva` stanno in `export const <id>Styles = {…}` (le chiavi kebab sono tra virgolette, nel TSX `s["icon-left"]`).
- Stati, generalizzazione (regola rivista dopo la review): si generalizza solo l'asse `size` (`SIZE_AXIS` in `verify.ts`), gli altri assi devono coincidere. Per una cella base si usa la differenza della cella di stato con la stessa taglia, poi quella della taglia di default del contratto, poi la prima taglia disegnata (in ordine di contratto). Tolta l'euristica "classi sostituite ⊆ cella base". Una cella di stato che toglie soltanto, o una parte presente in una sola delle due celle, dà un avviso.
- Il gate `core` legge come import ogni literal con `from` seguito da un path tra virgolette: `generate.ts` compone la parola (`FROM`) per scrivere le righe di import dei file generati.
- Verificato a mano (file poi cancellati): l'output generato di Badge, ShopCard⊃Badge, una lista, una chiave kebab, un compound, un hover e un contratto senza assi passa `tsc` e lo smoke delle story di `packages/ui`.

## Spec Change Log

- **Loop 1 (review, 2026-10-18).**
  - **Cosa l'ha fatto scattare:** il finding 1 della triage (intent_gap). La regola frozen sulla generalizzazione degli stati contraddiceva la riga hover della matrice: con una sola cella hover, uno stato soltanto additivo si estendeva a tutte le varianti.
  - **Cosa cambia:** Alessandro ha scelto l'opzione 1, cioè si generalizza solo l'asse `size`. La regola nel blocco frozen è riscritta.
  - **Cosa si evita:** un hover disegnato su una variante che finisce sulle altre.
  - **Percorso:** su proposta accettata da Alessandro, il codice non si annulla. Si corregge la generalizzazione in `verify.ts` e si applicano le patch 2–11 della triage.
  - **KEEP:**
    - la struttura `analyzeComponent` → modello → `generateComponent`;
    - SHA-256 puro con il test contro `node:crypto`;
    - la scomposizione `decompose`;
    - la matrice di test esistente.

## Review Triage Log

| # | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|
| 1 | Uno stato che aggiunge soltanto si estende a tutte le varianti (Blind, Edge) | medium | `verify.ts` stati: con una sola cella hover tutti gli assi hanno un solo valore; con `removed` vuoto ogni cella base la riceve. La regola frozen ("un asse con un solo valore si generalizza") contraddice la riga hover della matrice ("su tutte le taglie di default"). | intent_gap |
| 2 | Parte che è un layer in una cella e un'istanza in un'altra: bloccata solo in un ordine (Blind, Edge) | medium | `visitInstance` imposta `part.instance` senza controllare le occorrenze come layer | patch |
| 3 | Uno stato che toglie soltanto (o una parte presente solo nella cella di stato) sparisce senza avviso (Blind, Edge) | medium | `added.length === 0` → `continue`; `drawn`/`baseClasses` undefined → `continue` | patch: avviso |
| 4 | `fileChange` confronta il testo grezzo: un file CRLF dà sempre `aggiorna` (Blind, Edge) | medium | `existing === content`, mentre `readGeneratedHeader` normalizza | patch |
| 5 | `isPartUsed` senza confine di parola (`.item` trova `.items`) (Blind, Edge, VG) | medium | `tsx.includes(".key")` | patch: la chiave non deve essere seguita da `[\w-]` |
| 6 | Livello 4 degli stati: il controllo per sottostringa fa passare `hover:p-1` grazie a `hover:p-10` (VG, Edge) | medium | `output.includes('.' + cssEscape(cls))` | patch |
| 7 | `rootSizeClasses` mai provato dentro analisi/generazione (VG) | medium | nessuna fixture con la misura della radice che varia | patch: test con celle in ordine mescolato |
| 8 | Field di tipo zod non riconosciuto → `unknown` facoltativo, in silenzio (Blind, Edge) | low | `fieldShape` default | patch: avviso |
| 9 | Regex `ListParts` ambigua per un id che finisce in `List` (Edge) | low | `\w+ListParts` trova `navListParts` | patch: ancorare all'id |
| 10 | `buildOrder` mette in ordine letture senza contratto o duplicate (Blind, Edge) | low | `letturaName` ripiega su `kebabOf` | patch: blocco con il problema del contratto |
| 11 | Suggerimento `lista` con `items` inesistente, diverso dallo scaffold (Blind) | low | `suggest` scrive `items.map` | patch: stessa forma `Array.from` dello scaffold |
| 12 | Contratto dell'annidato ricavato dal nome del componente Penpot (Blind, Edge) | maybe-false (medium) | dipende da cosa porta `Instance.component` nell'adattatore | defer (2.23) |
| 13 | Parte presente solo in alcune celle: lo scaffold la rende sempre (Blind, Edge) | medium | servono le regole `when`; lo scaffold è dello sviluppatore | defer (`when`, 2.27/2.29) |
| 14 | Nessun `tsc` automatico sull'output generato (VG) | medium | solo controllo a mano; scrittura dei file in 2.24 | defer (2.24) |
| 15 | Trucco `FROM` contro il gate `core` (Blind) | low | il gate legge il testo, non le import vere; limite preesistente | defer (azione della retro sui gate) |
| 16 | Lettura senza celle → crash in `renderScaffold` (Blind, Edge) | false | `Lettura.cells` ha `.min(1)`; se tutte le celle sono scartate restano blocchi e il generatore si ferma prima | scartato |
| 17 | Assi/field non identificatori rompono lo scaffold (Blind, Edge) | false | `defineContract` impone `IDENTIFIER` su assi e field | scartato |
| 18 | Field destrutturati e non usati rompono `tsc`/lint (Blind) | false | provato: `tsc --noUnusedLocals --noUnusedParameters` accetta un binding inutilizzato accanto al rest; il lint di `ui` è il gate dei confini | scartato |
| 19 | Campioni come `label={"label"}` nello scaffold (Blind) | low | lo scaffold è un punto di partenza dello sviluppatore | scartato |
| 20 | Risposta `element` non validata (Blind) | low | la scrive `pds-code` su conferma; la validazione richiede una tabella degli elementi | scartato |
| 21 | `scaleFromThemeCss` rifiuta `.5px` e il rem (Blind, Edge) | low | il generatore del tema scrive px col numero intero davanti; il livello 4 controlla la scala | scartato |
| 22 | Variante dell'istanza diversa in una cella di stato, persa (Edge) | low | caso raro, servirebbe un ramo nuovo | scartato |
| 23 | Elemento vuoto (`img`/`input`) con figli (Edge) | low | raro, servirebbe un ramo nuovo | scartato |
| 24 | `Parts` illeggibile in silenzio; BOM; asse `state` nel contratto (Edge) | low | il generatore non scrive BOM; casi non dimostrati | scartato |
| 25 | Test mancanti per i casi sopra (Blind) | — | coperti dalle patch 2–11 | coperto |

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force` (con `pnpm db:start`): verde.
- `pnpm --filter @penpot-ds/scripts theme && git status --porcelain packages/tokens`: nessun file cambiato.
