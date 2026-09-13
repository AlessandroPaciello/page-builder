---
title: 'Story 2.7 parte C — adopt:variant, adozione di una variante nata in Penpot'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '3fadf59c4768cffc87c6e943bcd4b4b321b58e05'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** quando il designer aggiunge in Penpot un valore d'asse che il contratto non ha, `verify:library` diventa rosso ("in più") e l'estrazione si ferma. Dopo la decisione umana restano quattro passi meccanici fatti a mano (valore nel contratto, `SCHEMA_VERSION` + fingerprint, valore nel binding, cella nel design), con il rischio di sbagliarli (register Alert, `deferred-work.md`).

**Approach:** nuovo comando `adopt:variant -- <Comp>` (`--dry-run` / `--yes`, `--snapshot` solo in lettura, sul modello di `bump:contract`). Rileva i valori in più sugli assi `option` del container, stampa il diff dei cinque file e con `--yes` li scrive. Per la regola A l'adozione è un cambio compatibile: si alza solo `SCHEMA_VERSION`, mai `contract.version` né il plugin data. Se la variante non è esprimibile fallisce con un errore nominativo senza scrivere nulla.

## Boundaries & Constraints

**Always:** tutti i contenuti nuovi calcolati e validati prima della prima scrittura. Scrittura atomica per file (tmp + rename). Senza `--yes` nessuna scrittura (exit 0). Errori nominativi (contratto, asse, valore, cella, layer). Ogni controllo nuovo ha una prova rosso/verde. Test senza rete (seam `callTool`/`--snapshot`) e su directory temporanee, mai sui file del repo. L'hash del fingerprint della versione 1 resta identico.

**Never:** nessuna scrittura su Penpot. `contract.version`, il plugin data, il giudizio, la ricetta e la fixture non si toccano (poi girano `extract:component`/`render:component`). Nessuna voce esistente del fingerprint viene riscritta. I messaggi di `computePartClasses` restano invariati. Non si rimuovono valori mancanti in Penpot (se ne occupa `addCell`, nell'altro senso).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Adozione | container `Badge` (`badge@1`) con `variant=outline` in più, celle `outline×{sm,md}` con token | diff: `values` + `"outline"`, `SCHEMA_VERSION` N→N+1, voce fingerprint N+1, binding `outline: "outline"`, 2 celle di design dai token Penpot; con `--yes` scrive; poi verify regole 4/5 verdi | N/A |
| Nulla da adottare | nessun valore in più | messaggio, exit 0 | N/A |
| Asse non `option` | valore in più su `state`/`behavior` (Input, AccordionItem) | nessuna scrittura, exit 1 | errore: l'asse non ha mapping 1:1 con una prop |
| Due assi | la proprietà di una parte varia con `variant` e `size` dopo l'adozione | nessuna scrittura, exit 1 | errore con proprietà, parte e assi (funzione estratta da `computePartClasses`) |
| Literal | una cella nuova ha una proprietà di stile senza binding | nessuna scrittura, exit 1 | errore con cella, layer e proprietà |
| Cella mancante | `variant=outline|size=sm` assente in Penpot | nessuna scrittura, exit 1 | errore con la cella |
| Container | 0 o più container dichiaranti, plugin data ≠ `contractId`, assi in ordine diverso | nessuna scrittura, exit 1 | errore nominativo |
| Valore non valido | valore `Outline` o `out line` | nessuna scrittura, exit 1 | errore: atteso `/^[a-z][a-z0-9-]*$/` |

</frozen-after-approval>

## Code Map

- `packages/contracts/tests/schema-version.test.ts:25-63` -- `canonical`/`fingerprint()`, oggi dentro il test. Il payload va spostato in `src/`, dove non si importa `node:crypto` (i contratti girano nel browser; confine in `packages/contracts/scripts/check-boundaries.mjs`).
- `packages/contracts/src/components/<nome>.ts` -- `defineContract({ axes: [{ name, values: [...] }] })`: è il letterale da modificare via AST (`typescript` è già tra le devDependencies di scripts). `src/schema-version.ts`: `export const SCHEMA_VERSION = 1;`. `tests/contracts.fingerprint.json`: append-only.
- `packages/scripts/src/library/verify-library.ts:147-163` -- regola 4, stessa differenza per insieme dei valori (`extra`). `:216-235`: regola 7, stesso criterio per i literal (chiave di `style` senza `tokens`).
- `packages/scripts/src/recipe-schema.ts:169` -- `partBindings(root)` restituisce parte → {proprietà → token}, con le stesse chiavi del design (verificato sulla fixture di Badge). `cellKeyOf`.
- `packages/scripts/src/emitter/render-component.ts:356-377` -- ciclo che calcola gli assi che influenzano una proprietà (`influencing`): va estratto in una funzione pura esportata e riusato.
- `packages/scripts/src/emitter/bindings/<nome>.binding.json` -- `axes.<asse>.values` (valore → API). `render-component.ts:1141` rifiuta un valore senza API.
- `packages/scripts/src/library/designs/<nome>.design.json` (`ComponentDesign`, `library-plan.ts:62`) e `designs-loader.ts` (`designsDir`).
- `packages/scripts/src/library/bump-cli.ts` -- modello per parsing, `resolveContract`, lettura dello snapshot e seam `callTool`. `bump-contract.ts`: lookup del container dichiarante.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/fingerprint.ts` (+ export in `index.ts`) -- `canonical` e `fingerprintPayload(components, sections)` puri, e `schema-version.test.ts` li usa. Motivo: un payload unico fra il test e il comando, così un hash calcolato dal comando non può divergere da quello verificato dal test.
- [x] `packages/scripts/src/emitter/axis-influence.ts` (+ test) -- `influencingAxes(axes, partCells, property)` estratta da `computePartClasses`, che la chiama con messaggi invariati (`render:check` a diff zero).
- [x] `packages/scripts/src/library/adopt-variant.ts` (+ test) -- `planAdoption(contract, snapshot, design, binding, sources)` è puro e restituisce `nothing | error | adopt{files}`. Controlla gli errori della matrice, costruisce il contratto in memoria con i valori aggiunti in coda (default invariato), aggiunge le celle di design da `partBindings` e prende l'hash da `fingerprintPayload` + sha256. Il sorgente del contratto si modifica con l'AST TS, inserendo il valore nell'array `values` dell'asse, e il risultato si rilegge con l'AST. `SCHEMA_VERSION` si sostituisce con un match unico. I test coprono ogni riga della matrice e il fatto che la prima scrittura consuma tutti i file già calcolati.
- [x] `packages/scripts/src/library/adopt-cli.ts` (+ test, script `adopt:variant` in `package.json`) -- parsing come in `bump-cli`, diff stampato per file, `--yes` scrive e poi stampa i passi successivi (`extract:component`, `render:component`, `gates:render`, `verify:library`). Il seam delle directory è configurabile per i test.
- [x] `_bmad-output/specs/spec-page-builder/penpot-pipeline.md` -- nel paragrafo "Adozione di una variante nata in Penpot" va il comando, cosa scrive e i casi rifiutati.

**Acceptance Criteria:**
- Given il flusso Adozione su una copia temporanea dei file, when eseguo `adopt:variant --yes`, then il test del fingerprint dei contratti e la validazione del binding passano sui file generati, e un secondo run restituisce "nulla da adottare".
- Given `pnpm check-types && pnpm lint && pnpm test`, when girano, then sono verdi, i test di scripts sono ≥352 e `render:check` è a diff zero.

## Spec Change Log

Nessun cambiamento di spec: il documento è quello approvata.

## Review Triage Log

**Loop 1 — 2026-09-13, 3 layer (blind-hunter, edge-case-hunter, verification-gap):**

- BH#1 + ECH#3 + ECH#10 + VG-altro#2 (`writeAdoption`: un `renameSync` che fallisce a metà lascia contratto/`SCHEMA_VERSION` nuovi con fingerprint/binding/design vecchi e tmp orfani, errore grezzo) — verificato: il catch copre solo la fase dei tmp. — `medium` → `patch`.
- BH#2 + ECH#9 + VG#1 + VG#2 (rifiuti senza prova rosso/verde: "senza bump", voce corrente mancante, cella duplicata, `variantError`, parte ambigua, layer non-parte, parte assente dal design, valore già nel binding, asse assente dal binding) — VG pre-verificato (nessun hit nei test). Deviazione dall'Always della spec, che era chiara. — `medium` → `patch`.
- BH#3 + ECH#4 (cella nuova senza il layer di una parte o senza una proprietà presente nella cella default: `influencingAxes` la conta come `<assente>`, l'adozione passa, poi l'emitter fallisce con "rimozione di una classe", `render-component.ts:385-392`) — verificato. — `medium` → `patch`.
- BH#4 (controllo di espressività su matrice parziale: celle preesistenti duplicate o con `variantError` saltate) — reale, ma `verify:library` è già rosso in quel caso e `render` fallisce forte a valle; il fix aggiunge una guardia. — `low`, rifiutato.
- BH#5 (espressività calcolata su Penpot invece che sul design) — `false`: l'emitter lavora sulla ricetta estratta da Penpot (`buildRecipe` ← `partBindings`), non sul design.
- BH#6 + ECH#2 + ECH#8 (snapshot `--snapshot` e design solo castati → TypeError) — input di sviluppo, stesso comportamento di `bump-cli` (precedente: ECH#7 della 2.7b rifiutato). — `low`, rifiutato.
- BH#7 (design e binding passati due volte a `planAdoption`) — il CLI li ricava dallo stesso testo; nessun chiamante divergente. — `low`, rifiutato.
- BH#8 + ECH#6 + VG-altro#1 (`parseCellKey` di `axis-influence.ts` più severo di quello dell'emitter su `variant=a=b`: `Error` senza `fail()`, contro "messaggi invariati") — verificato (`render-component.ts:156-164` accetta la chiave). — `low` → `patch` (correzione diretta).
- BH#9 (test che fissa l'hash della voce 1) — `false`: la voce 1 è append-only e non deve cambiare mai; il valore fisso è la prova.
- BH#10 (test dei tmp residui solo in `bindingsDir`) — verificato. — `low` → `patch` (correzione diretta del test).
- BH#11 + VG-altro#3 (`const USAGE = usage` fa shadow in `parseComponentArgs`) — verificato. — `low` → `patch`.
- BH#12 (`formatDiff` a hunk unico) — il diff resta corretto, solo verboso su cambi lontani; il fix aggiunge logica. — `low`, rifiutato.
- BH#13 (binding identità `valore: "valore"` non segnalato) — decisione del frozen (matrice, riga Adozione): il fix è modificare la spec. Rifiutato.
- BH#14 (tmp con pid orfani dopo un crash) — `low`, rifiutato: caso di kill del processo, fix con guardie.
- BH#15 (`canonical` nell'API pubblica di `@app/contracts`) — nessun danno nominabile. — `false`.
- BH#16 (regex rigida su `SCHEMA_VERSION`) — errore già nominativo. — `low`, rifiutato.
- BH#17 (chiavi non numeriche del fingerprint ignorate) — `false`: `schema-version.test.ts` esige chiavi `/^[1-9]\d*$/`.
- ECH#1 (`value in bound.values` vero per `constructor`: valore valido rifiutato) — verificato (oggetto da `JSON.parse`, con prototipo). — `low` → `patch` (`Object.hasOwn`).
- ECH#5 (board non mappate saltate in silenzio) — `verify:library` le segnala (regola 5); le celle nuove mancanti sono già un errore. — `low`, rifiutato.
- ECH#7 (fingerprint `null` → TypeError) — file committato e testato. — `low`, rifiutato.
- VG#3 (test CLI "asse non adottabile" che in realtà prova un valore non valido) — verificato. — `low` → `patch` (rinomina).

Routing loop 1: nessun `intent_gap`/`bad_spec`, nessun `defer`. `patch` → **applicate e verificate**: rename fallito con errore che nomina file sostituiti e invariati e pulizia dei tmp; rifiuto della cella nuova senza layer di una parte o senza una proprietà della cella default; nove prove rosso/verde dei rifiuti; `Object.hasOwn` nel binding; `parseCellKey` di `axis-influence` allineato all'emitter; niente shadow di `USAGE`; tmp controllati in tutte le directory; test CLI rinominato. Verifica post-patch: scripts 402 (25 file), contracts 118, `check-types`/`lint`/`build` verdi, `render:check` diff zero.

## Verification

**Commands** (Node 22: `PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH`):
- `pnpm --filter @penpot-ds/scripts exec vitest run` -- expected: verde, ≥352 test.
- `pnpm --filter @app/contracts exec vitest run` -- expected: verde, fingerprint v1 invariato.
- `pnpm check-types && pnpm lint && pnpm build && pnpm --filter @penpot-ds/scripts render:check` -- expected: verdi, diff zero.

**Manual checks:**
- Nessuna prova live necessaria: il comando legge Penpot e non lo scrive. Un `--dry-run` sulla library reale deve rispondere "nulla da adottare".

## Review Findings (code review extra — gruppo 1 library/*, 2026-09-13)

Review a 4 layer (blind-hunter, edge-case-hunter, verification-gap, acceptance-auditor) sul diff `ceb07ad...HEAD` limitato a `packages/scripts/src/library/`. Verdetto per ogni finding dopo verifica su codice reale.

- [x] [Review][Patch] `defaultBindings` silenziosamente vuoto se la cella default manca o è duplicata — `adopt-variant.ts:359`: con `defaultCells.length !== 1` la mappa default è vuota senza alcun errore, e il controllo "proprietà presente nella cella default e assente qui" (la guardia contro la rimozione di classe) viene saltato in silenzio. Fix: errore nominativo sul modello di quelli esistenti.
- [x] [Review][Patch] `designCoverage` mai invocata fuori dai test — `designs-loader.ts:66`: il doc comment (riga 13) dichiara che "la copertura design↔registry la verifica designCoverage", ma nessun entry point di produzione la chiama: un design senza contratto passa in silenzio in `DESIGNS`. Fix: invocarla in `verify:library`.
- [x] [Review][Patch] Errori grezzi sui file di input del CLI — `bump-cli.ts:89`, `adopt-cli.ts:97/107/112`: `JSON.parse`/`readFileSync` su snapshot, binding e design non protetti — un file malformato o assente produce SyntaxError/ENOENT senza il nome del file, invece dell'errore nominativo `✖ ...` usato altrove.
- [x] [Review][Patch] Pulizia tmp senza try/catch in `writeAdoption` — `adopt-variant.ts:614/622`: se `rmSync` fallisce durante la pulizia, l'errore della pulizia maschera l'errore originale e il messaggio nominativo "Scrittura interrotta..." non viene mai emesso.
- [x] [Review][Patch] Duplicazione `cartesian` e `isDirectInvocation` — `adopt-variant.ts` e `library-plan.ts` reimplementano `cartesian`; `bump-cli.ts:128` e `adopt-cli.ts:147` duplicano la stessa IIFE: due sorgenti di verità che possono divergere.
- [x] [Review][Patch] adopt-cli legge Penpot prima di verificare i cinque file — `adopt-cli.ts:96-106`: lo snapshot viene letto (chiamata di rete, read-only) prima dei cinque file sorgente; un file mancante produce l'errore solo dopo la chiamata. Fix: leggere i file prima.

### Rejected (appendice)

- [blind-hunter] Script `adopt:variant`/`bump:contract` mancanti dal `package.json` — **false**: presenti in `packages/scripts/package.json:8-11`.
- [blind-hunter+edge-case-hunter] `--dry-run` accettato e ignorato — **false**: la semantica documentata (sola stampa, zero scrittura) è esattamente il percorso senza `--yes` (bump-cli.ts:105-107); la combo `--yes --dry-run` è rifiutata con messaggio nominativo (bump-cli.ts:63).
- [blind-hunter+edge-case-hunter] `addCellStep` non allarga l'altezza del container — **false**: la cella nuova va sulla stessa riga dell'ultima cella, stesso design → stessa altezza; solo un container ridotto a mano in Penpot può traboccare, stato non dimostrato.
- [edge-case-hunter] `rmSync` maschera l'errore — il finding è reale ma sul codice attuale (senza try/catch), non sulla guardia citata; riclassificato come patch.
- [edge-case-hunter] Regola 11 con pluginData stringa vuota — **false**: il codice salta solo `=== null` (verify-library.ts:243); un pluginData vuoto produce l'errore orfano, che è loud e corretto per un container senza dichiarazione valida.
- [edge-case-hunter] `designs-loader` lancia ENOENT grezzo all'import — **false**: il catch rilancia `Nessun design committato in ${dir}`, nominativo.
- [edge-case-hunter] Errore `setVariantProperty` a metà scrittura senza guida — **false**: entrambi i messaggi contengono già "cella scritta a metà, rimuovila a mano in Penpot".
- [edge-case-hunter] Varianti con proprietà extra oltre gli assi trattate come esistenti — **false**: stato raggiungibile solo con edit manuali in Penpot e comunque loud a valle (regola 4 di `verify:library`).
- [blind-hunter] Espressività calcolata saltando celle rotte (duplicati/variantError) — rifiutato già nel loop 1 della review 2.7c (BH#4): `verify:library` è rosso in quel caso e il render fallisce forte a valle; la guardia aggiunge complessità.
- [blind-hunter] Test che fissa l'hash della voce 1 fragile — adjudicato nella review 2.7c (BH#9): la voce 1 è append-only, il valore fisso è la prova.
- [blind-hunter] Test `contrastPairs` tautologico — intenzionalità documentata nelle Design Notes 2.7a: l'invariante pinna la derivazione contro edit manuali di `LIBRARY_SPEC`.
- [blind-hunter] `formatDiff` a hunk unico — rifiutato nella review 2.7c (BH#12): il diff resta corretto, solo verboso.
- [blind-hunter] Tmp orfani dopo crash del processo — rifiutato nella review 2.7c (BH#14).
- [blind-hunter] Identificatori incoerenti nei messaggi `addCellStep` (board name vs cell key) — low cosmetico.
- [blind-hunter] Dead code `?? ""` in regola 11 (`split` non ritorna mai array vuoto) — low cosmetico.
- [blind-hunter] `addCell.index` quasi senza significato — low: usato solo come posizione di fallback, nessun danno mostrato.
- [blind-hunter] Import `readFileSync` inutilizzato in `library-cli.ts` — **false**: usato a riga 81 per il seed semantico.
- [blind-hunter] Nessuna documentazione del nuovo flusso adopt → extract → render → gates → verify — **false**: `penpot-pipeline.md` è aggiornato nel diff completo della storia (gruppo 3, +45 righe); il finding nasce dal chunking.
- [acceptance-auditor] File richiesti dalle task assenti dal diff (`fingerprint.ts`, `axis-influence.ts`, `penpot-pipeline.md`, script `package.json`) — **false**: effetto del chunking; tutti presenti nei gruppi 2-3 del diff completo della storia.
- [acceptance-auditor] Test di `planAdoption` leggono file committati invece di directory temporanee — low: sola lettura, mai scritture; il fix ristruttura l'harness dei test per zero guadagno comportamentale.
- [acceptance-auditor] Il piano abortisce l'intero run invece del solo contratto quando manca una cella — adjudicato nel loop 1 della review 2.7b (BH#8+ECH#10).

## Review Findings (code review extra — gruppo 3 artifact BMAD, 2026-09-13)

Review a 4 layer sul diff `ceb07ad...HEAD` limitato a `_bmad-output` (spec epiche, sprint-status, epics, correct-course, penpot-pipeline). Verificato sui file reali.

- [x] [Review][Decision] Regola A contraddice il principio guida — `penpot-pipeline.md:28` affida al **designer** la rimozione a mano delle celle di valori rimossi/rinominati; la stessa doc (riga 9) stabilisce che "il designer torna in Penpot solo per scelte di design vere, mai per esigenze della pipeline", e la pulizia post-bump è un'esigenza di pipeline. Serve la decisione: chi rimuove (designer avvisato, sviluppatore, o il comando `remove:cells` rinviato in deferred-work).
- [x] [Review][Patch] `epic-2-context.md` è un correct-course indietro — righe 18-20 hanno ancora la numerazione 2026-09-12 (2.8 skill / 2.9 libreria / 2.10 Storybook) e la riga 33 dice regola A "ancora da decidere", mentre `epics.md` (2.8 registro / 2.9 skill / 2.10 libreria / 2.11 Storybook) e la regola A "decisa, opzione A" fanno autorità; le righe 59-60 citano i numeri vecchi ("voce [PC] di 2.8", "skill a 2.8", "story senza args a 2.10", "gate CSF3 a 2.10").
- [x] [Review][Patch] Overlap nel routing [PS] di Story 2.9 (`epics.md:340`) — "cella richiesta dal contratto ma assente dal container → `addCell`" e "cella che il design usa e il contratto non ha, **o mancante dal container** → blocco e domanda al designer": lo stesso stato ha due esiti opposti. Fix: togliere "o mancante dal container" dal secondo ramo.
- [x] [Review][Patch] Nome della sessione forge incoerente — `design-system.md:57` cita il forge "pipeline **meno** vincolante"; ogni altro artefatto (directory, memlog, proposta, deferred-work) lo chiama "pipeline **troppo** vincolante".
- [x] [Review][Patch] `sprint-status.yaml` commento sotto-statistico — "6 patch applicate" conta solo il gruppo 1; la review completa ne ha applicate 16 (6 gruppo 1 + 10 gruppo 2).
- [x] [Review][Patch] `Spec Change Log` vuoto in `2-7c-adopt-variant.md` — heading senza contenuto; una riga esplicita ("nessun cambiamento: spec approvata così") evita l'ambiguità di una sezione dimenticata.
- [x] [Review][Patch] Doppio register dello split 2.7 senza nota di supersessione — `deferred-work.md:158/179`: la prima voce definisce parte B = `addCell` + `adopt:variant` + regola versioni, la seconda la ridefinisce senza dire che corregge la prima. Fix: una riga di nota sulla seconda voce.

### Rejected (appendice)

- [blind-hunter] CAP-5 (memlog) vs CAP-15 (design-system, epics) per l'href dai dati commerce — low: il memlog è log di sessione; i documenti normativi concordano su CAP-15.
- [blind-hunter+acceptance-auditor] `penpot-pipeline.md` descrive in presente lo stato target (registro, gate per componente) mentre il codice è ancora globale — low: la doc è normativa (la "legge" che la 2.8 implementa); lo stato as-built è nello sprint-status (2.8 backlog) e il divario è registrato nel memlog.
- [blind-hunter] Premessa "due parti" nella proposta di cambio non corrispondente alla realtà a tre parti — low: la proposta è un atto storico del correct-course, non normativa; l'adeguamento è avvenuto nella parte C a valle.
- [blind-hunter] Riferimenti di riga divergenti per lo stesso limite dell'emitter (376-383 / 356-377 / 385-392) — low: le ancore sono storiche e destinate a driftare per natura; rincorrerle è churn.
- [blind-hunter] Deviazione AC frozen (test su file committati) chiusa come "low, rifiutato" senza emendamento — adjudicata due volte (loop 2-7b e review gruppo 1): sola lettura, fix = ristrutturare l'harness per zero guadagno.
- [blind-hunter] Baseline "quarto/quinto/tre" incoerente in 2-7a — low: la matrice dice "Quinto design aggiunto" dove Alert sarebbe il quarto; cosmetico in una story done.
- [edge-case-hunter] Footer di `forge-report.html` auto-riferito — low: artifact di sessione, nessun consumatore indicizzato.
- [edge-case-hunter] Matrice 2-7b "Design senza la cella" in tensione con la colonna Error Handling — adjudicato nel loop 1 della 2.7b (BH#8+ECH#10): il comportamento implementato (errore globale nominativo) è quello registrato nel triage log; l'eventuale emendamento della matrice spetta ad Alessandro.
- [edge-case-hunter] Sovrapposizione/wording tra righe delle matrici 2-7c (Adozione, Literal) e `penpot-pipeline.md` — low cosmetico.
