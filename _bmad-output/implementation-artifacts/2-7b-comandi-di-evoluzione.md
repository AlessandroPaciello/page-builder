---
title: 'Story 2.7 parte B — addCell e versione del contratto in Penpot'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: '71b0d308e685382ea3d67784b31ee89c56659152'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** una variante aggiunta al contratto non ha una via CLI per diventare una cella nel container Penpot esistente (register Alert, problema 4: nel test si è usato codice scritto a mano), e non esiste una regola né un comando per alzare `nome@versione` di un contratto già in Penpot (problema 5: il plugin data non è modificabile dall'UI).

**Approach:** `add:library` crea le celle mancanti di un container esistente (operazione `addCell`, additiva, guardia anti-duplicato). Regola di versionamento **decisa da Alessandro (2026-09-13, opzione A):** i cambi compatibili (valori, parti, field aggiunti) alzano solo `SCHEMA_VERSION`; `contract.version` si alza solo per cambi incompatibili (rimozioni, rinomine), e il nuovo comando `bump:contract -- <Comp>` (`--dry-run` / `--yes`) aggiorna il plugin data del container al `contractId` corrente. Regola documentata in `penpot-pipeline.md`. `adopt:variant` è una spec successiva (`deferred-work.md`).

## Boundaries & Constraints

**Always:** scritture su Penpot solo da step del writer, con guardia e `--dry-run`; `bump:contract` senza `--yes` non scrive (stampa `atteso` vs `trovato`, exit 0); errori nominativi (componente, container, cella); ogni controllo nuovo con prova rosso/verde; test senza rete (seam `callTool`/`--snapshot`).

**Never:** `addCell` non modifica celle esistenti né il plugin data; `bump:contract` non tocca contratti, `SCHEMA_VERSION` o fingerprint (li cambia chi sviluppa); `verify:library` resta in sola lettura; messaggi della regola 3 e di `component-reader` invariati; nessuna scrittura su Penpot nei test.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cella mancante | contratto con valore nuovo, container senza quella combinazione | `add:library` pianifica `addCell` con parti e token del design; secondo run: nessuna operazione | variante con gli stessi `variantProps` già in Penpot → lo step salta (guardia) |
| Design senza la cella | combinazione mancante e assente da `design.cells` | nessuna operazione per quel contratto | errore che nomina contratto e cella |
| Bump dopo cambio incompatibile | `badge` a `version: 2`, container con `badge@1` | `bump:contract -- Badge` stampa `badge@1 → badge@2`; con `--yes` scrive; `verify:library` regola 3 verde | contratto senza container o container duplicato → errore nominativo |
| Nulla da fare | plugin data già = `contractId` | messaggio, exit 0, nessuna scrittura | N/A |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/library/library-plan.ts` -- `Operation` (86-96), `Difference` (98), `planLibrary` additivo (248-350: contratto coperto → solo differenze, 301-346, che già segnalano plugin data e assi diversi); `cartesian` (136), `cellKey` (131); costruzione celle in `containerOperation` (164-195) da estrarre in `cellPlan` e riusare.
- `packages/scripts/src/library/penpot-writer.ts` -- `CELL_RUNTIME` (`makeShape`, `applyPartTokens`), `cellStep` (105-178: board costruita DA ZERO dalla parte `root` del design — size/dir/align/token —, nome `"<Container> axis=v|…"`, posizione da `index`/`yOffset`, `createComponent`, guardia per nome board a 150), `containerStep` (180-209: guardia `isVariantContainer`, `setSharedPluginData` a 205), `operationsToSteps` (212-231).
- API Penpot: `VariantContainer.appendChild(shape)`, `LibraryVariantComponent.setVariantProperty(pos, value)`/`variantProps`, `Variants.properties`/`variantComponents()`. **Meccanismo provato nel test Alert** (register in `deferred-work.md`, problema 4): cella costruita come `cellStep` → `createComponent` → `container.appendChild(board)` → `setVariantProperty` per asse. NON usare `addVariant()`: duplica una variante esistente e ne eredita geometria, stili e binding token, che l'API non permette di rimuovere.
- `packages/scripts/src/library/library-cli.ts` -- modi/argomenti (18-77), stampa del piano in `--dry-run` (~158-163), `executeSteps` (172-174, oggi stampa "ok" per ogni step): modello per `bump-cli.ts`.
- `packages/scripts/src/library/library-snapshot.ts` (`SnapshotCell.variantProps` 39, `SnapshotComponent.pluginData`/`cells` 47), `library-reader.ts` (`readLibrarySnapshot`, `getSharedPluginData` 118).
- `packages/scripts/src/library/verify-library.ts:131-136` -- regola 3 (plugin data ≠ `contractId`), stesso confronto per `bump:contract`; la regola 7 NON confronta i binding con il design.
- `packages/contracts/src/contract.ts` -- `version` (39, intero ≥1 a 124), `contractId()` (180).
- `_bmad-output/specs/spec-page-builder/penpot-pipeline.md` -- `## Stadio 0 — Contratto e library Penpot` (12) per la regola; rimando in `## Gate di verifica` (102).

## Tasks & Acceptance

**Execution:**
- [x] `library-plan.ts` (+ test) -- nel ramo del contratto coperto, solo se esattamente un container dichiara il contratto via plugin data e ha gli assi del contratto in ordine: un'operazione `addCell { contract, containerName, cellKey, variantProps, parts, index }` per ogni combinazione del prodotto cartesiano assente da `component.cells` (`index` = numero di celle esistenti + progressivo, per la posizione), con la costruzione cella estratta in `cellPlan`; le differenze esistenti restano.
- [x] `penpot-writer.ts` (+ test) -- `addCellStep`: trova l'unico container per plugin data (errore nominativo se 0 o più), salta (`skipped: true`) se una variante ha già gli stessi `variantProps`, poi costruisce la board ESATTAMENTE come `cellStep` (riusarne il codice, stesso nome e posizione da `index`), `createComponent`, `container.appendChild(board)`, `setVariantProperty` per asse con l'indice da `variants.properties`; test che ESEGUONO il codice generato (`new AsyncFunction("penpotUtils", "penpot", code)`) con un container finto in memoria: skip senza scrivere, 0/2 container → errore, indici di `setVariantProperty` corretti anche con assi in ordine diverso.
- [x] `library-cli.ts` -- `addCell` nel `--dry-run`; `executeSteps` stampa "saltato (motivo)" quando lo step restituisce `skipped: true`.
- [x] `packages/scripts/src/library/bump-contract.ts` + `bump-cli.ts` (+ test, script `bump:contract` in `package.json`) -- `planBump(contract, snapshot)`: nulla / aggiorna / errore; errore nominativo se la versione trovata è ≥ di quella del contratto con valore diverso (niente downgrade); se nessun container dichiara il contratto, il messaggio dice che una rinomina del contratto non è un bump (contratto nuovo: il container vecchio diventa orfano, regola 11) e non suggerisce `add:library`. Step writer con guardia sul valore letto; test che eseguono lo step con un container finto (valore live cambiato → errore senza scrittura) e `main --yes` con un transport che ignora la scrittura → exit 1.
- [x] `penpot-pipeline.md` -- regola A in Stadio 0 (compatibile → `SCHEMA_VERSION`; incompatibile → `contract.version` + `bump:contract`; rinomina = contratto nuovo), meccanismo di `addCell`, rimando in Gate di verifica.

**Acceptance Criteria:**
- Given un valore aggiunto al contratto e al design, when eseguo `add:library --dry-run` e poi `add:library`, then la cella nasce nel container esistente con geometria, stili e token del solo design, `verify:library` è verde e un secondo run non pianifica nulla (prova live solo dopo OK di Alessandro).
- Given `contract.version` alzata dopo un cambio incompatibile, when eseguo `bump:contract -- <Comp>` e poi con `--yes`, then il primo run non scrive e il secondo porta la regola 3 a verde; una versione più bassa di quella in Penpot è rifiutata.
- Given `pnpm check-types && pnpm lint && pnpm test`, when girano, then verdi, test di `scripts` ≥315.

## Implementation Notes

*(2026-09-13, reimplementazione dopo il loop 1 — nessuna modifica al frozen.)*

- **`addCell` = stessa costruzione del bootstrap:** `cellSpec` + `BUILD_CELL_RUNTIME` condivisi con `cellStep` (nome `"<Container> axis=v|…"`, board da zero, token del solo design, `createComponent`), poi `container.appendChild(board)` e `setVariantProperty(pos, value)` con `pos` da `container.variants.properties`. Nessun `addVariant()`.
- **Guardie eseguite nei test:** container finto in memoria (`new AsyncFunction("penpotUtils", "penpot", code)`) per skip, 0/2 container, proprietà d'asse mancante, indici con assi in ordine diverso; `bumpStep` eseguito con valore live cambiato; `main --yes` con transport che ignora la scrittura → exit 1.
- **`bump:contract`:** rifiuta downgrade (versione in Penpot ≥ contratto) e plugin data malformato; il messaggio "nessun container" spiega che una rinomina è un contratto nuovo (regola 11) senza suggerire `add:library`.
- **`executeSteps`:** `stepOutcome` stampa "saltato (motivo)" per `skipped: true`.
- **Rischi aperti (prova live non eseguita, serve OK di Alessandro):** il bersaglio di `setVariantProperty` dopo `appendChild` (variante del container o componente stesso) segue il register Alert ma non è confermato live; la cella nuova ha `y = 0` come nel bootstrap, non posizionata rispetto al container.
- **Verifica:** scripts 341 (22 file), contracts 118; `check-types`/`lint`/`build` verdi; `render:check` diff zero.

## Spec Change Log

- **Loop 1 (2026-09-13) — `bad_spec`.** Trigger: BH#1/BH#2/BH#3/BH#4 + ECH#1/ECH#2/ECH#9 — `addCellStep` duplicava una variante con `addVariant()` e la "correggeva": restavano geometria/layout della root, stroke e altri stili, binding token (non rimovibili via API), nome e posizione della board sorgente; la nota "verify:library lo segnala" era falsa (la regola 7 non confronta col design). Emendato: Code Map (meccanismo provato `cellStep` + `appendChild` + `setVariantProperty`, divieto di `addVariant()`), task writer (board da zero, `index` per la posizione, test che eseguono il codice generato), task CLI (skip visibile), task bump (no downgrade, messaggio sulla rinomina, test su guardia e post-scrittura), AC su `bump:contract`. Stato evitato: celle nuove con aspetto della sorgente e `verify:library` verde. **KEEP:** `cellPlan` estratto da `containerOperation`; condizione "un solo container dichiarante + assi in ordine" nel piano; `planBump` puro con i tre esiti e i messaggi nominativi; `bumpStep` con guardia `current !== spec.from` e rilettura in `main`; parsing di `bump-cli` (`--yes`/`--dry-run` alternativi, `--snapshot` solo in lettura, `Badge` o `badge`); i test del piano (`addCell` per le sole celle mancanti, secondo run vuoto, design senza cella → errore) e del bump; la sezione "regola A" in `penpot-pipeline.md` con il rimando in Gate di verifica.

## Review Triage Log

**Loop 1 — 2026-09-13, 3 layer (blind-hunter, edge-case-hunter, verification-gap):**

- BH#1 (claim "verify:library segnala i token rimasti" falso) — verificato: la regola 7 controlla solo che il binding esista e punti a un token del catalogo. — `high` → `bad_spec` (con BH#2–4, ECH#1/2/9).
- BH#2 (`addCellStep` azzera solo i fill: stroke, radius, padding della sorgente restano) — verificato nel codice generato. — `high` → `bad_spec`.
- BH#3 (cella nuova senza posizione, sovrapposta alla sorgente) — verificato: nessun `x`/`y` impostato dopo `addVariant()`. — `medium` → `bad_spec`.
- BH#4 (la spec dice che `addVariant()` duplica la principale, il codice assume la più vicina) — verificato: contraddizione della Code Map, non provata live. — `medium` → `bad_spec`.
- BH#5 + ECH#6 (`bump:contract` accetta un downgrade `badge@3 → badge@2`) — verificato in `planBump`. — `medium` → `bad_spec` (task emendato).
- BH#6 (rinomina: il messaggio suggerisce `add:library`, che creerebbe un secondo container) — verificato. — `medium` → `bad_spec` (task emendato).
- BH#7 (ramo `from: null` irraggiungibile) — verificato: un container senza plugin data non è "dichiarante". Codice morto innocuo. — `low`, rifiutato.
- BH#8 + ECH#10 (design senza la cella blocca tutto il run) — `false` sul danno: `createContainer` si comportava già così (errore nominativo che ferma il piano); la matrice chiede l'errore nominativo. 
- BH#9 (skip del piano senza differenza verificata nel test) — le differenze su plugin data (`library-plan.ts:308`) e assi (`:315`) esistono già; manca solo l'assert. — `low`, rifiutato.
- BH#10 + VG#1 + VG#2 (guardie del writer e del bump verificate solo come testo; ramo post-scrittura mai eseguito) — pre-verificato dal VG. — `medium` → `bad_spec` (test che eseguono il codice nei task).
- BH#11 (AC senza `bump:contract`; AC live non eseguibile) — verificato. — `low` → `bad_spec` (AC emendati).
- BH#12 (`--dry-run` scartato dal parsing; nessuna via di ripristino dopo scrittura fallita) — il comportamento senza `--yes` è già non-scrivente; il messaggio d'errore nomina atteso e trovato. — `low`, rifiutato.
- BH#13 (helper di lookup del container copiati tre volte) — verificato; nessuna divergenza oggi. — `low`, rifiutato.
- ECH#1/ECH#2/ECH#9 (geometria root, nome della board, fedeltà a `cellStep`) — stessa causa di BH#1–4. — `high` → `bad_spec`.
- ECH#3 (`mainInstance()` nullo → TypeError generico) — irrilevante col meccanismo emendato. — `low`, rifiutato.
- ECH#4 (contratto senza assi: la guardia salta sempre) — nessun contratto senza assi; `defineContract` e il piano non lo producono. — `low`, rifiutato.
- ECH#5 (`executeSteps` stampa "ok" anche su skip) — verificato. — `low` → `bad_spec` (task CLI emendato).
- ECH#7 (`--snapshot` malformato → TypeError) — loud, input di sviluppo. — `low`, rifiutato.
- ECH#8 (flag `-y` preso come nome componente) — errore comunque nominativo. — `low`, rifiutato.

**Loop 2 — 2026-09-13, 3 layer (blind-hunter, edge-case-hunter, verification-gap: nessun gap):**

- BH#1 (cella di `addCell` posizionata dall'origine pagina: `y = 0`, fuori dai container successivi al primo) — verificato: `cellSpec(..., index, 0, 0)` e i container del bootstrap stanno a `yOffset` crescente. — `medium` → `patch` (offset dalla posizione del container).
- BH#2 + BH#3 + ECH#1 + ECH#2 + ECH#6 + ECH#7 (nessuna rilettura dopo `setVariantProperty`; ripiego `|| component` mai eseguito, TypeError a scrittura già fatta; `setCalls` del test senza bersaglio) — verificato: il rischio è quello che la spec stessa lascia aperto per la prova live. — `medium` → `patch` (errore nominativo al posto del ripiego, rilettura dei `variantProps`, test rosso/verde con fake che aggiorna la variante).
- BH#4 (il test del writer usa le parti della cella `default/sm` per `variant=outline`) — verificato: non prova che la cella porti i token del proprio design. — `low` → `patch` (correzione diretta del test).
- BH#5 (valori rimossi/rinominati lasciano le celle vecchie; regole 4/5 restano rosse dopo il bump; non documentato) — verificato: l'additiva non cancella mai. — `medium` → `patch` (documentazione) + `defer` (comando di rimozione).
- BH#6 + ECH#5 (ordine fra `add:library` e `bump:contract` indefinito; `addCell` su un container ancora alla versione vecchia) — verificato: il target è scelto per prefisso di nome. — `medium` → `patch` (`addCell` solo se plugin data = `contractId`, ordine documentato).
- BH#7 + ECH#4 (versione non canonica `badge@01`/`@1.0`/`@0x2` → errore di downgrade fuorviante o accettata) — verificato: `Number(...)`. — `low` → `patch` (`/^[1-9]\d*$/`).
- BH#8 (piano più severo del writer sull'ordine degli assi) — `false`: il piano è volutamente severo sullo snapshot; il remap nel writer protegge da una divergenza live fra snapshot e scrittura.
- BH#9 (righe del CLI non testate oltre `stepOutcome`) — `low`, rifiutato: la formattazione è una riga di `console.log`.
- BH#10 (righe vuote finali, directory temporanea del test non rimossa, numeri di riga della Code Map superati, tracciamento dell'OK live) — `low`, rifiutato; l'OK live è nel riepilogo finale.
- ECH#3 (`container.variants` nullo → TypeError generico) — il container è filtrato con `isVariantContainer()`; `low`, rifiutato.

Routing loop 2: nessun `intent_gap`/`bad_spec`. `patch` → **applicate e verificate**: offset della cella dalla posizione del container; errore nominativo se il componente non diventa variante e rilettura dei `variantProps` dopo `setVariantProperty` (test rosso/verde con fake che aggiorna la variante); test del writer con i token della cella `outline`; `addCell` solo su container con plugin data = `contractId`; versione del plugin data canonica (`/^[1-9]\d*$/`); ordine `bump:contract` → `add:library` e rimozione manuale delle celle vecchie in `penpot-pipeline.md`. `defer` (BH#5, comando di rimozione celle) → `deferred-work.md`. Verifica post-patch: scripts 351 (22 file), contracts 118, `check-types`/`lint`/`build`/`test` verdi, `render:check` diff zero.

## Verification

**Commands** (Node 22: `PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH`):
- `pnpm --filter @penpot-ds/scripts exec vitest run` -- expected: verde, ≥315 test.
- `pnpm check-types && pnpm lint && pnpm build` -- expected: verdi.

**Manual checks:**
- Prova live su "Page Builder DS" SOLO dopo OK esplicito di Alessandro, su un container di prova poi rimosso: `addCell` crea la cella (aspetto del solo design) e il secondo run non duplica; `bump:contract --yes` porta la regola 3 a verde.

**Prova live — 2026-09-13 (OK di Alessandro).** Contratto sintetico `probe` (assi e design di Badge), container "Probe" creato con `probe@1` a 2 valori di `variant`, poi rimosso; piano, step e transport sono quelli dei CLI.
- ✔ `addCell` con `destructive`: 2 celle scritte, `variantProps` riletti corretti (il rischio aperto su `setVariantProperty` dopo `appendChild` è chiuso), token del solo design, nessuno stroke ereditato; `verify:library` verde; secondo run vuoto.
- ✔ `bump:contract` `probe@1 → probe@2`: regola 3 rossa prima, verde dopo; downgrade a `probe@1` rifiutato con messaggio nominativo.
- ✖ → **fix** — posizione: con il container a (0, 1500), largo 890 e celle a y 1530 (margine 30, passo 240), le celle nuove finivano a x 960/1200, y 1500, fuori dal container, che non si allargava; `verify:library` non controlla la geometria. Causa: `addCellStep` posizionava da `container.x + passo × index`. Fix: cella dopo la più a destra, sulla stessa riga, col passo del bootstrap; il container si allarga fino alla cella più il margine. Test rosso/verde con la geometria letta live (senza fix: `expected 1440 to be 990`); prova live ripetuta dopo il fix: celle a x 990/1230, y 1530, container largo 1370 (= 1230 + 110 + 30), `verify:library` verde, secondo run vuoto. Verifica post-fix: scripts 352 (22 file), `check-types`/`lint` verdi.
- Pulizia: nessuno shape né componente "Probe" rimasto; `verify:library` sulla library reale verde (3 container, 0 errori) prima e dopo.
