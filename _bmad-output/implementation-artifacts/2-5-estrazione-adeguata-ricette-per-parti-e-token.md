---
baseline_commit: 37e956ec58471840362af2a82460e92c22865071
title: 'Estrazione adeguata — ricette per parti e token, validate contro il contratto'
type: 'feature'
created: '2026-09-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** l'estrazione attuale (Story 2.2) deriva i binding per hex e la ricetta Badge usa la pseudo-asse `colorStyle` con classi Tailwind: non legge il legame al contratto della library "Page Builder DS" (Story 2.4), quindi la ricetta non è verificabile contro il contratto né riutilizzabile da qualunque emitter (AD-11).

**Approach:** l'estrazione legge plugin data `pagebuilder/contract` e `shape.tokens` dallo snapshot di library e produce per Badge, Input, AccordionItem fixture e ricette che coprono esattamente assi e valori del contratto; `RecipeSchema` diventa mappa di parti a profondità 1 con celle `proprietà → token` dello Stadio 1, con criterio di stop meccanico (parte annidata con assi propri → schema fallisce, prova rosso/verde).

**Decisioni (2026-09-12):** i campi di giudizio (`domain`, `headless`, `a11y`) stanno in un file di giudizio per contratto committato, fuso con le celle dallo snapshot; `legacy-mis-catalog.json` viene cancellato e i test di `theme-generator` ripuntati alla nuova fixture, non rimossi.

## Boundaries & Constraints

**Always:** estrazione per-componente, CLI live, mai in CI/build; sola lettura su Penpot; `--snapshot <path>` seam offline. Plugin data `pagebuilder/contract = nome@versione` letto dal VariantContainer: fallire loud (exit ≠ 0, zero artefatti) su contratto duplicato, nome incoerente, contratto senza container. Conformance meccanica: assi, valori, parti = esattamente quelli del contratto; celle con token esistenti nel catalogo Stadio 1, literal rifiutato. Geometria delle icone ignorata, le proprietà di stile legate a token restano. Copertura di test su reader, `mcp-client`, CLI, generatore non scende.

**Never:** non toccare `packages/contracts`, `theme-generator.ts`, `penpot-reader.ts`, `generate-theme.ts`, `mcp-client.ts`, `library-plan/verify/writer`, `packages/ui`, `apps/web`, CI. Niente `cva`/`colorStyle` nella ricetta (è della Story 2.6); niente scrittura di design su Penpot: se le celle estratte sono ambigue si segnala, non si corregge.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Estrazione Badge/Input/AccordionItem | library live o `--snapshot` | `<comp>.fixture.json` + `<comp>.recipe.json` committati, assi/parti = contratto, celle `proprietà → token` | N/A |
| Fallimenti plugin data | contratto duplicato / nome incoerente / contratto senza container | fallisce senza scrivere, errore nominativo, exit ≠ 0 | come a sinistra |
| Parte annidata con assi propri | ricetta con parte annidata che ha assi propri | **schema fallisce** (criterio di stop) | test rosso/verde dedicato |
| Literal / token assente | cella con literal o token fuori catalogo Stadio 1 | validazione fallisce | errore che nomina parte/proprietà |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/recipe-schema.ts` (+ `.test.ts`) -- `FixtureSchema`/`RecipeSchema` Zod: la riscrittura vive qui.
- `packages/scripts/src/component-reader.ts` -- oggi deriva i binding per hex via `execute_code`: da adeguare a plugin data + `shape.tokens`; `parseArgs`/`isDirectInvocation` restano lo schema CLI.
- `packages/scripts/src/extract-component.ts` -- entry CLI `extract|validate`, `writeAtomic` in `src/recipes/<kebab>.fixture.json`, provenienza (`fixtureHash`, `penpotComponentId`).
- `packages/scripts/src/validate-recipe.ts` (+ `.test.ts`) -- gate pura su classi cva → da riscrivere su conformance + token Stadio 1 (vocabolario in `token-vocabulary.ts`).
- `packages/scripts/src/library/library-snapshot.ts` / `library-reader.ts` -- tipi `SnapshotComponent/Cell/Layer` e `readLibrarySnapshot({endpoint?, callTool?})`: già pronti per la 2.5; `verify-library.ts` regole 2/3/4 = riferimento, non duplicarle.
- `packages/contracts` -- `COMPONENT_CONTRACTS` (badge@1, input@1, accordion-item@1), `contractId(c)`, `Axis` (option/state/behavior), `parts` piatta (annidamento in trigger = layout, non parti); `library/designs/*.design.json` = ruolo→token per parte × cella.
- Artefatti: `src/recipes/badge.fixture.json`/`badge.recipe.json` da sostituire; Input/AccordionItem non esistono; `src/__fixtures__/legacy-mis-catalog.json` da cancellare.

## Tasks & Acceptance

**Execution:**
- [x] `recipe-schema.ts` + `recipe-schema.test.ts` -- riscrivi `RecipeSchema` (mappa parti → cella `Record<proprietà, token>`, `FixtureSchema` su plugin data + `shape.tokens`, elimina `cva`); test rosso/verde: parte annidata con assi propri, literal, tre contratti verdi -- AC #2. *(KEEP loop 1: schema e test rossi/verdi restano; riportare com'era.)*
- [x] `component-reader.ts` -- estrazione da `readLibrarySnapshot` (live o `--snapshot`), fallisce sui tre casi del plugin data, produce fixture per i tre componenti -- AC #1. *(KEEP loop 1: restano; esportare `PLUGIN_DATA_PATTERN` per il riuso del validatore.)*
- [x] `extract-component.ts` -- ricetta: celle dai binding, giudizio dal file per contratto, provenienza riregistrata -- AC #1. *(KEEP loop 1 + patch review: validare il file `--snapshot` alla fonte (fail-loud nominativo), write della coppia fixture+ricetta atomico (rollback della fixture se la ricetta fallisce), rifiuto `--snapshot` duplicato, errore nominativo su asse mancante in `cellKeyOf`, chiavi cella senza separatori `|`/`=` nei valori.)*
- [x] `validate-recipe.ts` -- conformance (assi/valori/parti esatti), token Stadio 1, rifiuto literal; **conformance ricetta↔fixture (change log loop 1): ogni cella `proprietà → token` = binding `shape.tokens` della fixture per la stessa parte×cella, e `recipe.judgment` = contenuto di `judgments/<contratto>.json` (validato con `JudgmentSchema`)**; retarget `validate-recipe.test.ts` -- AC #1. *(PATCH loop 1: riusare `PLUGIN_DATA_PATTERN` esportato, non copia inline.)*
- [x] `recipes/` -- sostituisci Badge (sparisce `colorStyle`); estrai e committa Input e AccordionItem dalla library live -- AC #1/#3. *(KEEP loop 1: riestrarre o ripristinare gli artefatti; i commenti nei judgments chiariscono che `headless.parts` sono componenti Radix, non parti del contratto.)*
- [x] `component-reader.test.ts` -- retarget alla nuova library con i tre fallimenti; `theme-generator.test.ts` ripuntato alla fixture corrente; cancella `legacy-mis-catalog.json` -- AC #3. *(KEEP loop 1: restano.)*
- [x] `extract-component.test.ts` -- **test end-to-end `extract()` (patch review loop 1)**: gate-before-write osservato (snapshot malformato → throw, directory recipes intatta) e seam `--snapshot` esercitato come percorso, non solo parseArgs.
- [x] `packages/scripts/README.md` -- aggiorna nota "fixture legacy" e workflow di estrazione -- coerenza. *(KEEP loop 1: resta.)*

**Acceptance Criteria:**
- Data la library della Story 2.4 e i contratti, quando estraggo Badge, Input e AccordionItem, allora l'estrazione legge il plugin data e fallisce sui tre casi malformati; fixture e ricetta coprono esattamente assi e valori del contratto.
- Dato `RecipeSchema` riscritto, quando una parte annidata ha assi propri, allora lo schema fallisce (test rosso/verde); con literal o token fuori catalogo la validazione fallisce.
- Dati gli artefatti Badge attuali, quando li sostituisco, allora `colorStyle` sparisce e la copertura di test non scende.

## Implementation Notes

## Spec Change Log

- **2026-09-12 (loop 1 review, bad_spec):** il gruppo di findings BH#2+ECH#6+BH#3 ha rivelato che `validate-recipe.ts` come pianificato nel Code Map/Task valida conformance al contratto ma NON la coerenza ricetta↔fixture: una ricetta committata può nominare token validi ma mai estratti dalla fixture (celle editate a mano senza che nulla fallisca), e il judgment della ricetta può divergere dal file `judgments/<contratto>.json` senza gate. Known-bad stato evitato: ricetta e fixture che driftano silenziosamente (rompe "celle derivate dai binding" dell'Approach frozen). Amend (fuori frozen): Task `validate-recipe.ts` e relativa test — aggiungere conformance ricetta↔fixture: (a) ogni cella `proprietà → token` di ogni parte deve coincidere con i binding `shape.tokens` della fixture per la stessa parte e cella; (b) `recipe.judgment` deve coincidere col contenuto di `judgments/<contratto>.json` (validato con `JudgmentSchema`). KEEP instructions: mantenere intatti schema/reader/estrattore e i tre contratti verdi; i test rosso/verde su parte annidata, literal e fallimenti plugin data devono restare; gli artefatti committati Badge/Input/AccordionItem restano la base (verranno riestratti dopo l'amend).

## Review Triage Log

**Loop 1 — 2026-09-12, 3 layer (blind-hunter, edge-case-hunter, verification-gap):**

- `carried` BH#1 (task checkbox non spuntate) — artefatto di processo, non codice: le task sono spuntate in fase di presentazione. — `patch` (documentale).
- BH#2 + ECH#6 (validateRecipe non verifica che i token della ricetta corrispondano ai binding della fixture) — verificato: `validate-recipe.ts` controlla struttura, prodotto cartesiano e membership catalogo, ma una ricetta editata a mano con token validi-mai-estratti passa. Violazione del confine "ricetta = fatti + giudizio" del frozen (Approach: "celle derivate dai binding"). — `bad_spec` (fuori frozen: manca nel Code Map/Task validate-recipe una regola di conformance ricetta↔fixture).
- BH#3 (nessun gate che la ricetta committata porti lo stesso judgment del file per contratto) — verificato: `validateRecipe` non riceve i judgments; drift silenzioso possibile. Stessa radice del precedente: conformance incompleta. — `bad_spec` (stesso gruppo).
- BH#4 + ECH#3 (`loadSnapshotFile` fa `JSON.parse as LibrarySnapshot` senza validazione; snapshot JSON valido ma non-snapshot → TypeError grezzo su `.filter` di `componentFixtureFromSnapshot`) — verificato in `extract-component.ts:45-47`: il fail-loud nominativo è la convenzione Everywhere else. — `patch`.
- BH#5 + ECH#5 (due `writeAtomic` indipendenti: fallimento del secondo lascia la fixture orfana, rompendo "zero artefatti") — verificato in `extract-component.ts:236-237`. — `patch`.
- BH#6 + ECH#8 (`CELL_KEY`/`cellKeyOf` accettano valori con `|` o `=`; `variant=a=b` è una chiave valida, valori con `|` collidono) — verificato: regex `\S+` non esclude separatori. I nomi asse/valore del contratto sono identificatori Zod (`^[a-z][a-zA-Z0-9]*$`), quindi oggi non raggiungibile dai contratti reali; ma il contratto della ricetta non deve dipendere dalla disciplina a monte. — `patch` (rigenerare `cellKeyOf`/regex per escludere `|`/`=`).
- BH#7 + ECH#2 (regex plugin data duplicata: `PLUGIN_DATA_PATTERN` in `component-reader.ts` vs inline in `validate-recipe.ts`) — verificato: due copie della stessa definizione; drift possibile. — `patch` (esportare e riusare).
- BH#8 + ECH#7 (layer parte con zero binding → cella `{}` silenziosa; `variantProps` con chiavi extra silently droppate) — verificato: `collectPartBindings` valida solo layer con tokens; `cellKeyOf` itera solo gli assi del contratto. La regola 6/7 di `verifyLibrary` copre la library, non il CLI. Ma è un caso non raggiungibile nella library verificata (regola 6 esige la parte presente; regola 7 esige binding su ogni proprietà valorizzata) e il CLI gira solo dopo `verify:library` nel workflow documentato. — `defer` (pre-existing/by-design: dipendenza documentata dal gate library; segnalarlo qui duplicherebbe verifyLibrary).
- BH#9 (test envelope/timeout rimossi) — false: la copertura non scende; envelope malformato/isError/timeout sono coperti da `library-reader.test.ts` (11 test) e `mcp-client.test.ts` (24 test), entrambi presenti prima e intatti; i test rimossi coprivano il vecchio codice `execute_code` eliminato. Conteggio file 16→17, test 216→236. — `false`.
- BH#10 + VG-main (nessun test esegue `extract()` end-to-end: gate-before-write e seam `--snapshot` non osservati) — verificato dal VG con dimostrazione (spostare le write sopra il gate: suite verde). Il frozen esige "fallisce loud (exit ≠ 0, zero artefatti)". — `patch` (test: extract() con snapshot malformato → throw e directory recipes intatta).
- BH#11 (nessun test per loadJudgment mancante/malformato) — coperto parzialmente da BH#10 patch; errore nominativo già verificabile a lettura. Assorbito nel patch BH#10. — `patch` (stesso gruppo).
- BH#12 (vocabulary headless PascalCase vs parti lowercase senza mapping documentato) — verificato: `judgments/accordion-item.json` parts `["Item","Trigger","Content"]` sono componenti Radix, non parti del contratto; campi diversi per costruzione. Ambiguo ma non difettoso; un commento chiarirebbe. — `patch` (commento nel file di giudizio).
- BH#13 (fixture Input embedda internals Penpot volatili: shadow `id`, `style`, `hidden`) — verificato in `input.fixture.json`: la re-estrazione churnerà. Non rompe nulla oggi (validate non legge `style`), ma mina la riproducibilità. — `defer` (normalizzazione `style` è una scelta di design per la 2.6, non una correzione diretta).
- BH#14 (baseline validate-recipe.test semanticamente stramba: label con color.primary-foreground su tutte le celle, fixture senza label layers) — verificato: il test è sintetico e verifica solo conformance, non verità; non è un difetto del codice ma rende il test meno leggibile. — `low`, rifiutato: i test sintetici con parti fittizzie sono accettabili per conformance pura; la correzione non è diretta (richiede riscrivere il baseline).
- BH#15 (sezioni spec vuote) — artefatto di processo; Implementation Notes resta volutamente vuoto. — `false`.
- ECH#1 (chiave cella con `?` per asse mancante, due celle malformate collassano in un duplicato) — verificato in `validate-recipe.ts:97`: il `?? "?"` produce una chiave che comunque fallisce il prodotto cartesiano ("in più"), quindi la validazione fallisce; ma il messaggio nomina "?" invece dell'asse mancante e due celle malformate diverse collassano nella stessa chiave. Caso raggiungibile solo con fixture corrotte post-fatto. — `patch` (errore nominativo sull'asse mancante).
- ECH#4 (`--snapshot` doppio: ultimo silenziosamente vince) — verificato in `parseArgs`: nessun guard. Minore, ma la correzione è diretta. — `patch`.
- VG-main (già coperto: = BH#10, vedi sopra).
- VG-other-1 (`token-vocabulary` non più consumato da codice di produzione) — verificato: solo il suo test lo importa. README lo dichiara "consumato dall'emitter (Story 2.6)". Codice morto pianificato, non difetto. — `false` (volontario e documentato).
- VG-other-2 (= BH#8, vedi sopra — `defer`).

2. `patch` — hardening CLI/extract (BH#4+ECH#3, BH#5+ECH#5, ECH#4, BH#10+BH#11+VG-main, BH#12, ECH#1): snapshot file validato alla fonte, write coppia atomico, `--snapshot` duplicato rifiutato, test end-to-end extract() (gate-before-write + seam), commento sui campi headless, errore nominativo su asse mancante. → **applicate nel loop 1, verificate.**
3. `patch` — dedup regex plugin data (BH#7+ECH#2) + rigenerazione `cellKeyOf`/CELL_KEY per escludere separatori (BH#6+ECH#8). → **applicate nel loop 1, verificate.**
4. `defer` — BH#8+ECH#7+VG-other-2 (parti senza binding / assi extra: coperte da verify:library, duplicarle nel CLI è ridondanza), BH#13 (normalizzazione `style` nella fixture: scelta di design rimandata alla 2.6). → **registrate in deferred-work.md.**

Nota: i verdict `low`/`false` (BH#9, BH#14, BH#15, VG-other-1) sono rifiutati e non generano righe di routing.
1. `bad_spec` — conformance ricetta↔fixture incompleta (BH#2 + ECH#6 + BH#3): la validazione non verifica che le celle della ricetta derivino dai binding della fixture né che il judgment coincida col file per contratto. Root cause fuori frozen (sezioni Code Map/Tasks di `validate-recipe`). → **loopback bad_spec eseguito (loop 1): spec emendata, codice ri-derivato dal subagent, tutte le patch applicate e verificate (248 test verdi, tre ricette valide da CLI).**

## Design Notes

- **Profondità 1 = parti piatte del contratto:** chiavi di primo livello = nomi `parts`; l'annidamento geometrico è fixture/layout. Il criterio di stop protegge le parti annidate con assi propri.
- **Celle da `shape.tokens`, non da hex:** le proprietà di stile senza binding non esistono nella library verificata (regola 7 di `verifyLibrary`).

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts run test` -- expected: verde, nessun test file in meno (oggi 16). → **osservato: 17 file, 236 test verdi** (un file in più: `new-catalog.test.ts`).
- `pnpm check-types && pnpm lint && pnpm test` (root) -- expected: verdi a livello repo. → **osservato: verdi** (10 task check-types, 6 lint, 6 test).
- `extract:component -- extract Badge` (plugin su "Page Builder DS"; poi Input, AccordionItem) -- expected: fixture+ricetta senza `colorStyle`; poi `validate:recipe` -- expected: le tre ricette passano. → **osservato 2026-09-12: estrazione live riuscita per tutti e tre** (badge@1: 6 celle; input@1: 4; accordion-item@1: 2 — prodotto cartesiano completo); `colorStyle`/`cva` assenti dalle ricette; i file riscritti sono byte-identici agli artefatti committati (estrazione deterministica); `validate:recipe` passa su Badge, Input e AccordionItem.
