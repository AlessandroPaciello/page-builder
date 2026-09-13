---
title: 'Story 2.8 parte A — registro unico delle proprietà Penpot, niente più skip silenziosi'
type: 'refactor'
created: '2026-09-13'
status: 'done'
baseline_commit: 'b22a9e6bbdfd487421789e7e7da096d891dc2dd8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** l'elenco delle proprietà di stile Penpot è sparso in cinque punti (`styleOf` del reader, `StyleProperty`, `PROPERTY_TOKEN_TYPE`, `utilityPrefixFor`, `RADIUS_PROPS`). L'emitter salta con un solo log `SKIP` le proprietà che non sa esprimere (`strokeWidth`, `opacity`), e `strokeStyle`/`strokeAlignment` non vengono nemmeno letti: fedeltà persa in silenzio.

**Approach:** un registro unico in `packages/scripts` dice, per ogni proprietà, come si legge, il tipo (token con il suo tipo di token, oppure parola chiave di una lista chiusa), lo stato (supportata o bloccata) e la mappatura dell'emitter. Reader, estrazione, `verify:library` ed emitter lo usano tutti. Una proprietà assente dal registro, o bloccata, fa fallire il componente con un errore nominativo; il log `SKIP` sparisce.

## Boundaries & Constraints

**Always:** l'output generato di Badge, Input e AccordionItem resta identico byte per byte, e così ricette e fixture committate. Errori nominativi con componente, parte, cella, proprietà e valore/token. Ogni controllo nuovo ha una prova rosso/verde. `strokeStyle` è una parola chiave della lista `solid`/`dashed`/`dotted`. La geometria delle icone (`strokeWidth` sui layer path/vector/ellipse/line) si ignora per regola dichiarata nel registro, non per omissione.

**Decisione (Alessandro, 2026-09-13) — `strokeWidth` e `opacity` "coperte dalla base":** sono supportate con verifica. L'emitter non emette classi, ma controlla che il valore del token coincida con quello che la base shadcn già esprime per quella parte (`border`/`border-b`/`border-t` = 1px, `disabled:opacity-50` = 0.5). Se non coincide (es. `border-width.thick`) o la base non esprime nulla per quella parte, il componente si blocca. La spec resta intera anche se supera i 1600 token (scelta di Alessandro).

**Never:** nessuna valutazione per componente dei gate né report di PR/CI (parte B). Nessuna classe per variante per le proprietà assenti dal default (parte C). Nessuna scrittura su Penpot. Nessuna nuova mappatura di emitter oltre a quella decisa sopra per `strokeWidth`/`opacity`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Committati | Badge, Input, AccordionItem | `render:check` a diff zero; nessun log `SKIP` | N/A |
| Tratteggio | layer con `strokeStyle: dashed` | il reader lo registra; `verify:library` e l'estrazione bloccano il componente | errore "proprietà bloccata" |
| Fuori lista | `strokeStyle: mixed` | blocca | errore: valore fuori lista (`solid`/`dashed`/`dotted`) |
| Allineamento | stroke con allineamento `center`/`outer` | blocca | errore "proprietà bloccata" |
| Non registrata | proprietà in `layer.tokens` o in una cella che il registro non ha | blocca estrazione e render | errore "proprietà non registrata" |
| Icona | `strokeWidth` su un layer path | ignorato per regola del registro | N/A |

</frozen-after-approval>

## Code Map

Tutti i percorsi sotto `packages/scripts/src/`.

- `library/library-reader.ts:45-88` -- `styleOf(shape)` nella stringa `READ_LIBRARY_CODE` (gira in Penpot): liste inline delle proprietà e registra solo i valori non di default (`opacity` ≠ 1, misure > 0). `strokeStyle`/`strokeAlignment` mai letti. Validazione del risultato `:129-251`.
- `library/library-plan.ts:19-38` -- union `StyleProperty` (19 nomi, include `fontFamilies`), usata da `penpot-writer.ts:91-102` (`applyToken`): va derivata dal registro.
- `emitter/render-component.ts` -- `PROPERTY_TOKEN_TYPE` `:53-72`, `RADIUS_PROPS`/`RADIUS_CORNER` `:74-86`, `utilityPrefixFor` `:88-119` (`fill`→`text`/`bg` e `strokeColor`→`stroke`/`border` in base a `TEXT_KINDS`/`STROKE_KINDS` `:41-44`), `deriveClass` `:238-283` (skip `:262-266`), `deriveFor` `:356-391` (push `skippedProperties` `:383-391`). `fail()` `:152`.
- `emitter/render-cli.ts:144-148`, `emitter/gates-cli.ts:102-106` -- stampano `SKIP proprietà …`: da rimuovere insieme a `skippedProperties`.
- `emitter/token-vocabulary.ts:20-36` -- `TYPE_UTILITY_PREFIXES` (`borderWidth`/`opacity` → `[]`): resta la fonte del vocabolario dei token; il registro la usa, non la duplica.
- `extract-component.ts:156` (`buildRecipe` → `partBindings`), `recipe-schema.ts:121-184` (celle `z.record` aperte) -- punto in cui una proprietà non registrata o bloccata deve fermare l'estrazione.
- `library/verify-library.ts:231-252` -- regola 7 (literal): va estesa con le parole chiave del registro (ammesse senza token se in lista) e lo stato bloccato.
- `emitter/bases/{input,accordion}/*.tsx` -- `border`, `border-b`, `disabled:opacity-50`: il valore che la base già esprime.
- `emitter/gates.test.ts:102-104` -- Gate 2, vero pin byte-identico sui file in `packages/ui/src/domains/`.

## Tasks & Acceptance

**Execution:**
- [x] `style-properties.ts` (+ test) -- registro: per proprietà `read`, `kind` (`token` + tipo di token | `keyword` + lista), `state` (`supported` | `blocked` con motivo), mappatura emitter (prefisso per tipo di layer, angoli del radius, regola icona). Esporta i tipi derivati e `lookupProperty()` che dà errori nominativi. Test: ogni riga della matrice e completezza rispetto a `TYPE_UTILITY_PREFIXES`.
- [x] `library/library-reader.ts` (+ test) -- le liste di `styleOf` vengono iniettate dal registro nella stringa; si leggono `strokeStyle` (se ≠ `solid`) e `strokeAlignment` (se ≠ `inner`).
- [x] `library/library-plan.ts` -- `StyleProperty` derivata dal registro.
- [x] `extract-component.ts` (+ test) -- blocca proprietà non registrate o bloccate nel `style`/`tokens` delle celle.
- [x] `library/verify-library.ts` (+ test) -- la regola 7 usa il registro.
- [x] `emitter/render-component.ts`, `render-cli.ts`, `gates-cli.ts` (+ test) -- via le tabelle locali, la mappatura letta dal registro, `skippedProperties`/`SKIP` rimossi, trattamento di `strokeWidth`/`opacity` secondo la decisione.
- [x] `_bmad-output/specs/spec-page-builder/penpot-pipeline.md` -- paragrafo sul registro: stati, come si sblocca una proprietà (riga + mappatura + test rosso/verde).

**Acceptance Criteria:**
- Given i tre componenti committati, when eseguo `render:check`, `gates:render` e l'estrazione dagli snapshot committati, then l'output e le ricette sono identici byte per byte e non compare nessun `SKIP`.
- Given `pnpm check-types && pnpm lint && pnpm test`, when girano, then sono verdi e il numero di test di scripts non scende sotto quello misurato prima di iniziare.

## Implementation Notes

- Registro in `packages/scripts/src/style-properties.ts`. Oltre alle quattro proprietà della matrice c'è anche `fontFamilies`, **bloccata**: stava in `StyleProperty` ma non era letta né mappata. `StyleProperty` diventa le righe con `kind: "token"`.
- "Coperta dalla base" usa le classi `structural` del binding della parte con lo stesso prefisso di stato della cella (`""` per la base, `disabled:` ecc.). Un valore di un asse `option` diverso dal default non è mai coperto, perché la base non ha classi per variante.
- Senza snapshot committati, l'"estrazione dagli snapshot committati" si prova ricostruendo le ricette dalle fixture committate (`buildRecipe`), confrontate byte per byte con i file.
- Test di scripts: da 416 (baseline) a 452.

## Spec Change Log

## Review Triage Log

Review 1 (2026-09-13): Blind Hunter (12), Edge Case Hunter (8), Verification Gap (1).

| # | Fonte | Finding | Verdetto | Evidenza | Esito |
|---|-------|---------|----------|----------|-------|
| 1 | VG | Il ramo `prefix === null` (valore option non default) di `assertCoveredByBase` non ha test: una regressione passerebbe su Badge | medium | Pre-verificato dal layer: nessun test tocca `prefixFor`/"per un valore d'asse"; tutti i casi usano `setEverywhere` (prefisso `""`) | patch |
| 2 | BH | Rami di `assertCoveredByBase` senza rosso/verde: mismatch con prefisso di stato, token non numerico | medium | Letto `render-component.test.ts`: l'unico caso opacity è il rosso a prefisso `""`; nessun test per 0.4 in `state=disabled` né per il valore non numerico, contro "ogni controllo nuovo ha una prova rosso/verde" | patch (con #1) |
| 3 | BH | `penpot-pipeline.md` (paragrafo sopra "Il registro in pratica") ed `epic-2-context.md` dicono ancora che spessore e opacità "bloccano" | low | Riga di contesto nel diff: contraddice il paragrafo nuovo e la decisione di Alessandro del 2026-09-13; correzione di testo diretta | patch |
| 4 | BH | `layerTreeProblems` usa `in` e non `Object.hasOwn`: una chiave di stile `toString` attacca una funzione come token nel messaggio | low | Vero: `"toString" in layer.tokens` è true per un oggetto qualunque; l'errore resta ma il messaggio è sbagliato; correzione diretta | patch |
| 5 | EC, EC, EC, BH, BH | Regola icona solo nell'emitter: `strokeAlignment`/`strokeStyle` sui layer path non sono esenti, e il chevron (path, di solito `center` in Penpot) bloccherebbe AccordionItem alla prossima rilettura | maybe-false | `layerTreeProblems` non guarda il tipo di layer (verificato), ma il danno dipende dall'allineamento reale del chevron: `penpot-writer.ts` non imposta `strokeAlignment` e l'MCP Penpot ha rifiutato la lettura (niente token nella sessione). Serve una rilettura live | defer (high, non verificato) |
| 6 | BH | La base può esprimere una proprietà che il design non ha (`border` in base, nessuno stroke nel design): codice infedele senza errore | maybe-false | Comportamento delle classi strutturali precedente alla story; non introdotto dal registro | defer (medium, non verificato) |
| 7 | EC, BH | `strokeWidth` a 1px su quattro lati coperto da `border-b` (un solo lato): geometria diversa | low | Reale ma escluso dall'intento: la decisione congelata dichiara `border-b` = 1px come copertura | respinto (fuori intento) |
| 8 | EC, BH | `numericTokenValue` rifiuta `"1px"`/`"50%"` | false | I token `borderWidth`/`opacity` nel catalogo e nel seed sono senza unità (`"1"`, `"2"`, `"0.5"`) | respinto |
| 9 | EC, BH | `baseValue` non riconosce `border-2`, `border-[3px]`, `opacity-[.35]` | low | Nessuna base attuale le usa (grep di `emitter/bases`); fallirebbe in modo rumoroso; correggerlo richiede parsing nuovo | respinto |
| 10 | EC | Parola chiave al valore di default (`solid`/`inner`) viene segnalata come bloccata | low | Il reader non registra mai i default, quindi si arriva solo con fixture scritte a mano; correggerlo aggiunge un ramo | respinto |
| 11 | BH | Il test di estrazione "icona" passerebbe anche su un layer text | low | Vero, ma la riga Icona della matrice è coperta dal test di render sul chevron, che discrimina (thick non coincide con la base) | respinto |
| 12 | BH | Voci B/C di `deferred-work.md` sotto l'intestazione 2.7, e rinvio "Da fissare nella spec di Story 2.8" | false | Il formato è quello del workflow (append in coda); la parte B è ancora Story 2.8, quindi il rinvio è corretto | respinto |
| 13 | BH | Rami morti in `deriveClass` e `switch` senza controllo di esaustività | false | Codice difensivo innocuo; il tipo di ritorno `string \| null` fa già segnalare a TypeScript una variante nuova non gestita | respinto |
| 14 | BH | Stato `in-review` con triage log vuoto: artefatti ambigui | false | È lo stato normale del workflow durante la review | respinto |

## Design Notes

`strokeAlignment` registrato solo se ≠ `inner`, e `strokeStyle` solo se ≠ `solid`, come già succede per `opacity` ≠ 1: `inner` corrisponde al bordo CSS (`box-sizing: border-box`) e le fixture committate restano invariate, quindi niente drift finto. Se la library reale usa `center`, dopo la prima rilettura il componente risulterà bloccato: è un'informazione vera, non un errore della pipeline.

## Verification

**Commands** (Node 22: `PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH`):
- `pnpm --filter @penpot-ds/scripts exec vitest run` -- expected: verde, test ≥ baseline.
- `pnpm check-types && pnpm lint && pnpm build && pnpm --filter @penpot-ds/scripts render:check` -- expected: verdi, diff zero.

**Manual checks:**
- `git diff --stat packages/ui packages/scripts/src/recipes packages/scripts/fixtures` vuoto.
