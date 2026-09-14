---
title: 'Story 2.9 — skill pds-component: creare e sincronizzare i componenti'
type: 'feature'
created: '2026-09-13'
status: 'in-review'
route: 'dispatch'
baseline_commit: '32ddba3c00b5db1f5aae5cbc3445daa9f7e406ab'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-page-builder/penpot-pipeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** le skill `pds` coprono solo il lato Penpot (container per contratti esistenti). Il resto del ciclo di vita di un componente (contratto, design, giudizio, binding, base shadcn, estrazione, render, barrel, gate) e il riallineamento con Penpot oggi richiedono di sapere a memoria ordine dei comandi, file e decisioni. Il passo 3 di `pds-additive` è un vicolo cieco.

**Approach:** nuova skill `pds-component` nel modulo `pds`, sul modello di `pds-additive`, con due voci: **[PC] Crea componente** e **[PS] Sincronizza componente**. [PS] instrada in base a un **tipo di problema** per componente, esposto dagli script (`--json` su `verify:library` e `gates:render`), mai in base al testo interpretato dal prompt.

## Boundaries & Constraints

**Always:**
- Pass/fail e percorso li danno gli script: exit code e `kind` del problema nel JSON. La skill si ferma solo sulle decisioni umane.
- Le scritture su Penpot passano solo da `add:library` e `bump:contract`. Contratti e design si scrivono in [PC], a partire dalle risposte dello sviluppatore, oppure con `adopt:variant`, mai con codice improvvisato.
- Il JSON è additivo: l'output da terminale, il Markdown in `$GITHUB_STEP_SUMMARY` e gli exit code restano identici.
- Ogni `kind` nuovo ha la sua prova rosso/verde. Un problema senza `kind` noto vale `other`: la skill lo riporta e si ferma.

**Never:**
- Nessun `execute_code` di scrittura su Penpot dalla skill. Nessuna cella inventata. Nessuna correzione di un componente in attesa.
- Nessuna ristrutturazione della suite: `pds-bootstrap` resta invariata, `pds-additive` cambia solo al passo 3.
- Nessuna modifica a mano sui file generati.

## I/O & Edge-Case Matrix

| Scenario | Stato del componente (`kind`) | Percorso di [PS] | Errore |
|----------|------------------|------------------|--------|
| Token cambiati | `drift` (gate 5) | `extract:component` → `render:component` → mostra il diff → `gates:render` | N/A |
| Variante in più da Penpot | `variant-not-adopted` | decisione umana → `adopt:variant --dry-run` → `--yes` → estrazione/render/gate | asse state/behavior: si ferma e va dal designer |
| Cella del contratto assente in Penpot | `missing-cell` | `pds-additive` (`addCell` in `add:library`) | cella bloccata (ordine assi/bump): riporta il blocco nominativo |
| Cella che il design usa ma il contratto non ha | `cell-not-in-contract` | blocco + domanda al designer | mai inventata |
| Proprietà bloccata | `blocked-property` | indica lo sblocco (riga di registro + mappatura + test rosso/verde) e chiede la decisione | nessuna modifica automatica |
| In attesa di altro | `pending` generico | lo riporta, nessuna correzione | N/A |
| Tutto verde | nessun problema | "allineato", exit 0 | N/A |

## Decisioni (Alessandro, 2026-09-13)

- **Spec intera:** skill e `--json` con `kind` restano in una sola story, oltre la soglia di token.
- **Componente di verifica: Alert committato.** [PC] crea Alert per davvero (contratto, design, container nella library Penpot via `add:library`, codice generato) e Alert resta in libreria come primo componente della 2.10. Restano valide le trappole note dal register: il field `title` è vietato (nome HTML globale), serve `role="alert"`, e il contrasto di warning e info su card va misurato.
- **[PS] dal vivo su tutti i casi riproducibili:** drift, variante aggiunta in Penpot e cella mancante, provocati in Penpot su Alert durante la sessione. Le modifiche in Penpot le fa Alessandro: la skill non scrive fuori dai comandi CLI.

</frozen-after-approval>

## Code Map

- `skills/pds-additive/SKILL.md` -- modello (guida + domande + guardrail + metadati `<!-- module-code -->`). Si cambia il passo 3 (riga 25): dopo ogni differenza indica la voce che la risolve ([PS]).
- `skills/pds-setup/assets/module-help.csv` -- sorgente delle voci. Le copie installate (`.claude/skills/`, `.agents/skills/`, `_bmad/pds/module-help.csv`, `_bmad/module-help.csv`, `_bmad/_config/bmad-help.csv`, `_bmad/_config/skill-manifest.csv`, `.opencode/commands/`) vanno allineate identiche. `skills/pds-setup/assets/module.yaml:6-7` elenca i codici nel saluto.
- `packages/scripts/src/component-report.ts` -- `Problem` ottiene `kind`; nuovo `renderJson`; `publishReport` stampa JSON con `--json`.
- `packages/scripts/src/library/verify-library.ts` -- helper `pending`/red (~151): variante non adottata (~234), cella mancante (~285-305), cella di un valore non adottato (~310), proprietà bloccata (348), snapshot da aggiornare (379). Qui si assegna il `kind`.
- `packages/scripts/src/emitter/gates-cli.ts` -- prefissi dei gate e drift (203-209): `drift` e i gate rossi.
- File di un componente nuovo, per [PC]: `packages/contracts/src/components/<kebab>.ts` + `registry.ts:9-13`; `src/library/designs/<kebab>.design.json`; `src/recipes/judgments/<kebab>.json`; `src/emitter/bindings/<kebab>.binding.json`; `src/emitter/bases/<name>/` (`shadcn add`); `packages/ui/src/domains/index.ts` (barrel scritto a mano). Tutti i path `src/…` sono relativi a `packages/scripts`.
- Da non toccare: `pds-bootstrap`, gli emitter e il registro delle proprietà.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/component-report.ts` -- `kind` su `Problem` (unione chiusa + `other`), `renderJson`, flag `--json` -- percorso deciso dagli script
- [x] `packages/scripts/src/library/verify-library.ts`, `src/emitter/gates-cli.ts` -- assegnare il `kind` a ogni problema; `--json` nei due CLI -- stato per componente leggibile dalla macchina
- [x] `packages/scripts/src/**/*.test.ts` -- rosso/verde per ogni `kind` e test del JSON; terminale e exit code invariati -- prova dei controlli nuovi
- [x] `skills/pds-component/SKILL.md` -- skill costruita con `bmad-workflow-builder`: voci [PC] e [PS], domande, percorsi della matrice, guardrail -- ciclo di vita guidato
- [x] `skills/pds-additive/SKILL.md` -- passo 3: dopo ogni differenza, rimanda a [PS] -- niente vicoli ciechi
- [x] `skills/pds-setup/assets/module-help.csv` + `module.yaml` e copie installate -- registrare [PC]/[PS] -- menu del modulo
- [x] verifica live dei due percorsi sul componente scelto, con log nelle Implementation Notes -- AC della story

**Acceptance Criteria:**
- Given un componente assente dal registry e da Penpot, when invoco [PC], then la skill chiede assi, parti, dominio, a11y e l'aspetto delle celle, scrive contratto e design, crea il container via `pds-additive`, e guida giudizio, binding, base, estrazione, render, barrel e gate fino a `gates:render` con exit 0.
- Given `verify:library --json` o `gates:render --json`, when girano, then ogni problema ha un `kind` e l'output da terminale e l'exit code sono identici a quelli senza flag.
- Given `module-help.csv` di `pds-setup`, when lo leggo, then contiene [PC] e [PS] e le copie installate sono identiche alla sorgente.
- Given `pnpm test`, `check-types` e `lint`, when girano, then sono verdi senza skip.

## Implementation Notes

**Fatto (2026-09-13):**
- `component-report.ts`: unione chiusa `PROBLEM_KINDS` (`drift`, `variant-not-adopted`, `variant-not-adoptable`, `missing-cell`, `missing-cell-blocked`, `missing-cell-undesigned`, `cell-not-in-contract`, `blocked-property`, `contract-version`, `snapshot-stale`, `gate-failed`, `pending`, `other`); `kind` obbligatorio su `Problem`; nel collector `red` vale `other` e `pending` vale `pending` se non si passa un tipo; `renderJson` e `writeJsonReport` (tmp + rename); `publishReport(..., jsonPath)`.
- Il matrix row `variant-not-adopted` con asse state/behavior diventa un `kind` a sé (`variant-not-adoptable`), e la cella mancante si divide in tre `kind` (`missing-cell` creabile con addCell, `-blocked`, `-undesigned`): così il percorso lo sceglie lo script, non il testo. Un contratto non corrente (regola 3) è `contract-version` (regola A, `bump:contract`), lo snapshot committato vecchio è `snapshot-stale`.
- `gates.ts`: `details[].diverged` distingue il drift vero (`drift`) dall'estrazione live impossibile (`other`: lo stato vero lo dice `verify:library`). Gate 1–4 e a11y → `gate-failed`.
- **Forma del flag:** `--json <path>`, non `--json` su stdout: è l'unico modo per lasciare l'output del terminale identico byte per byte (AC 2). Il JSON va su file; la skill usa un percorso assoluto. Nei CLI: `verify:library` (solo in modalità verify) e `gates:render` (nuovo `parseGatesArgs`, che rifiuta gli argomenti sconosciuti).
- Test: un caso rosso/verde per ogni `kind` in `verify-library.test.ts` e `gates-cli.test.ts`, il JSON e l'additività (stesso terminale, Markdown ed exit con e senza `jsonPath`) in `component-report.test.ts` e `library-cli.test.ts`.
- `skills/pds-component/SKILL.md` ([PC] con domande e passi, [PS] con la tabella per `kind`, guardrail); `pds-additive` passo 3 rimanda a [PS]; [PC]/[PS] nel `module-help.csv` di `pds-setup` e nel saluto di `module.yaml`; copie in `.claude/skills`, `.agents/skills`, `_bmad/pds/module-help.csv` (identiche), `_bmad/module-help.csv`, `_bmad/_config/bmad-help.csv`, `skill-manifest.csv`, `files-manifest.csv` (hash), `.opencode/commands/pds-component.md`.

**Verifica:** scripts `test` 540/540, `check-types`, `render:check` a diff zero, `pnpm lint` verdi. `verify:library --snapshot …` con e senza `--json`: stdout identico, exit 0 in entrambi. `gates:render` con e senza `--json`: stesso report ed exit 0; differisce solo la posizione di due righe stderr di jsdom nella suite ui. `diff -r` sorgente↔copie installate: nessuna differenza.

**Sorpresa trovata da [PC] (Alert, 2026-09-13): test accoppiati allo stato del catalogo.** Aggiungere `alert` al registry (con `SCHEMA_VERSION` 2) ha rotto 10 test di `packages/scripts` che non dipendevano da Alert. Alcuni usavano "alert"/"Alert" come contratto o design inesistente: `verify-library.test.ts` (regola 11 e copertura), `designs-loader.test.ts` e `bump-contract.test.ts` ora usano "ghost"/"Ghost", e la copertura legge i nomi dal registry. Altri avevano `SCHEMA_VERSION` 1→2 scritta a mano: `adopt-variant.test.ts` e `adopt-cli.test.ts` ora ricavano la versione da `SCHEMA_VERSION` e dalle voci del fingerprint. Resta rosso di proposito solo "lo snapshot committato, come in CI", finché il container Alert non è in Penpot e lo snapshot non viene riscritto.

**Non fatto:**
- **Verifica live** ([PC] su Alert, [PS] su drift, variante aggiunta in Penpot, cella mancante): servono Alessandro e il token Penpot, che in questa sessione non era caricato (gate drift skippato: "No userToken found"). [PC] richiede le sue risposte (assi, parti, aspetto delle celle) e scrive nella library live; i casi [PS] richiedono modifiche in Penpot che fa lui. Gli AC 1 e i log dei percorsi restano aperti.
- **`bmad-workflow-builder`:** non eseguita. È conversazionale e questa sessione non era interattiva: la skill è scritta a mano sul modello di `pds-additive`. L'analisi di qualità della workflow-builder va lanciata sulla skill.

- 2026-09-13 — `_bmad/module-help.csv`: il file installato era CRLF e la riscrittura l'aveva portato a LF (diff su tutte le righe). Ripristinato CRLF: il diff contiene solo le due righe nuove.
- 2026-09-13 — Analisi di qualità `bmad-workflow-builder` (modalità analyze, senza scritture), voto "good", 7 finding tutti applicati alla skill: "allineato" solo con `exitCode` 0 in entrambi i JSON e lettura live (le righe globali rosse bloccano; con drift SKIPPED o `--snapshot` l'esito è "non verificato live"); prerequisiti live allineati (`adopt:variant`, `bump:contract`); conferma e `git diff` prima di `--write-snapshot`; regola di risoluzione `<tmp>` (`mktemp -d`); `missing-cell-blocked` senza lettura del testo; stop se lo stesso `kind` si ripresenta. Copie `.claude`/`.agents` e hash in `files-manifest.csv` riallineati. La skill è scritta sul modello di `pds-additive` e passata dall'analisi della builder, non generata dalla sua modalità build conversazionale.

**Verifica live [PC] su Alert (2026-09-13):**
- Domande: risposte confermate da Alessandro (asse `status` option info/success/warning/error, parti root/heading/description, field `heading`/`description`, dominio `feedback`, `role="alert"`, celle con soli token del catalogo).
- Passo 1: `alert.ts` + registry, `SCHEMA_VERSION` 1→2, voce "2" nel fingerprint → `@app/contracts` test 133/133. Sorpresa: 10 test di `scripts` accoppiati allo stato del catalogo (Alert usato come nome inesistente, SCHEMA_VERSION scritta a mano) → corretti (nome "ghost", versioni derivate).
- Passo 2: `alert.design.json`. Passo 3: `pds-additive` → dry-run 1 operazione (`createContainer "Alert"`, 4 celle), nessuna differenza; `add:library` exit 0; `verify:library --json` live exit 0, Alert `ok`, regola 10 contrasto `ok`.
- Passi 4–6: giudizio (`feedback`, `role: alert`, `stateConveyedByTextAndColor`), base shadcn new-york-v4 dal registry (import `cn` riscritto in `@/lib/utils` come le basi esistenti), binding (strutturali della base meno le classi da token; `border` tolto perché il design non ha stroke).
- Passi 7–10: `extract:component` exit 0 (4 celle), `render:component` 4 file in `feedback/`, export nel barrel, `gates:render --json` live: Alert `ok`.
- Sorpresa: il gate drift live segnava rossi Badge/Input/AccordionItem per il solo **ordine delle celle** (Penpot ha invertito i figli dopo la creazione del container Alert; l'estrattore seguiva l'ordine di Penpot). Decisione di Alessandro: correggere ora. `component-reader.ts` ordina le celle secondo il prodotto cartesiano del contratto (`compareCells`, valori ignoti in coda), test rosso/verde in `component-reader.test.ts` (rosso senza l'ordinamento, verde con). Riestratti i 4 componenti: fixture diverse solo per ordine, ricette uguali a meno dell'ordine delle chiavi, `render:check` diff zero.
- Esito finale [PC]: `gates:render --json` live 4/4 ok, exit 0, drift "fixture committate allineate a Penpot live".

**Verifica live [PS] su Alert (2026-09-13):**
- Snapshot committato riscattato dal vivo con la conferma di Alessandro: diff solo additivo (container Alert, 4 celle; `componentCount` 3→4).
- Giro 1, prima della modifica in Penpot: `verify:library --json` e `gates:render --json` exit 0, Alert `ok`, drift "allineate a Penpot live" → esito **allineato** (riga "tutto verde"). La lettura live ha mostrato che il file non aveva ancora la modifica: [PS] non ha inventato nulla.
- Giro 2, dopo la modifica di Alessandro: `verify` exit 0, `gates` exit 1 con Alert `red`, `kind: drift` (gli altri tre `ok`) → percorso `drift`: `extract:component -- Alert` exit 0, `render:component -- Alert` exit 0, diff mirato (ricetta `status=warning` root `fill: color.card → color.muted-foreground`; fixture `#ffffff → #3e4942`; `Alert.tsx`: `bg-card` spostato dalla base alle varianti, `warning: "bg-muted-foreground"`), `gates:render --json` live exit 0, 4/4 ok.
- Sorpresa 1: il token è stato applicato alla board root della cella, non al layer `description` concordato. La pipeline ha propagato fedelmente ciò che c'è in Penpot; se il design è quello voluto lo decide Alessandro.
- Sorpresa 2 (finding per la review): la regola 10 di `verify:library` misura il contrasto sulle coppie di `alert.design.json` (design committato), non sui valori live; dopo un drift il design committato resta indietro e un contrasto peggiorato in Penpot non viene intercettato.

- Giro 3, dopo la correzione di Alessandro in Penpot (root di `warning` di nuovo `color.card`, token sulla `description`): `gates` `kind: drift` solo su Alert → estrazione e render exit 0; diff mirato (ricetta: root `warning` torna a `color.card`, `description` `warning` → `color.muted-foreground`; `Alert.tsx`: `bg-card` torna in base, `description` con classi per variante, `warning: "text-muted-foreground"`); `gates:render --json` live exit 0, 4/4 ok. Contrasti misurati sulla fixture: minimo 4.87:1 (heading `warning` su `card`), description `warning` 9.39:1.
- Nota: dopo un drift `alert.design.json` resta al valore di prima (`description` `warning` = `color.card-foreground`): nessun comando aggiorna il design committato — stessa radice della Sorpresa 2.

- Giro 4, caso variante aggiunta in Penpot: **saltato** per scelta di Alessandro (2026-09-14, "2 no"); la lettura live ha confermato Alert allineato, senza valore `neutral`. Il percorso `variant-not-adopted` resta coperto dai test rosso/verde del `kind` e di `adopt:variant`, non da una prova live.
- Giro 5, caso cella mancante: Alessandro ha eliminato la cella `status=success` in Penpot. `verify` exit 0 con Alert `pending`, `kind: missing-cell` (asse + cella); `gates` exit 1 con `kind: drift`. La prima riga della tabella è `missing-cell` → `pds-additive`: dry-run (1 differenza segnalata, piano `addCell "Alert" cella "status=success"`), `add:library` exit 0, `verify` 4/4 ok. Rilettura: resta `drift` (nuovo `kind`, non lo stesso) → estrazione e render exit 0, ricetta e file generati identici, `gates:render --json` live exit 0, 4/4 ok.
- Sorpresa 3: dopo l'`addCell` la fixture aveva i valori d'asse nell'ordine di Penpot (`success` per primo): stessa radice del drift finto sulle celle, coperta a metà dalla prima correzione. `component-reader.ts`: helper `compareValues` unico, `canonicalValues` sui valori d'asse della fixture; test rosso/verde "ordine canonico dei valori d'asse". Riestratti i 4 componenti: Alert torna a `info, success, warning, error`, `render:check` diff zero, gate live exit 0.
- Verifica finale (turbo `--force`, niente cache): `test` 7/7, `check-types` 10/10, `lint` 6/6, nessuno skip.

## Spec Change Log

## Review Triage Log

- [blind-hunter] classi `text-*` in conflitto sulle parti figlie (base + variante senza `cn`/tailwind-merge) — **high**: verificato compilando `globals.css` con `@tailwindcss/node` 4.3.3: le utility `color` escono in ordine alfabetico, quindi `text-destructive` < `text-info` → titolo Alert `error` resta `text-info`; label Badge `destructive` resta `text-primary-foreground`. L'emitter usa `cn` solo sulla root (`render-component.ts:677`). Difetto pre-esistente (2.6/2.8c), esposto da Alert. → decisione umana
- [triage, emerso verificando il precedente] il tema dei token (`packages/tokens/src/tailwind-theme.css`) non è importato da `ui` né da nessun consumer (`ui` non dipende da `@penpot-ds/tokens`): `text-info`, `text-success`, `text-warning`, `text-destructive-foreground`, `font-regular`, `tracking-none` non vengono generate — verificato con e senza `@import` del tema (con l'import compaiono tutte). Tutti i componenti generati perdono colori/pesi/spaziature dei token in silenzio; i gate verificano le classi nel `.tsx`, non nel CSS — **high**, pre-esistente (2.1/2.6). → decisione umana
- [blind-hunter + edge-case-hunter + verification-gap] kind dell'asse "valori del contratto assenti in Penpot" fisso a `missing-cell` anche con celle `-undesigned`/`-blocked`, e nessun test sul kind di quel ramo (`withoutSmCells` non tocca `axesValues`) — **medium**: verificato (`verify-library.ts`, `pending(..., "missing-cell")` sul ramo `missing.length > 0`); la tabella della skill instrada comunque bene per l'ordine delle righe, ma il kind mente. → patch
- [blind-hunter] [PC] non riscatta lo snapshot committato dopo `add:library` — **medium**: verificato nella verifica live (test "snapshot committato" rosso finché non si è riscattato a mano). → patch (passo in SKILL.md)
- [blind-hunter] [PC] passo 1 non dice come ottenere l'hash del fingerprint — **low**: verificato; l'hash lo stampa il test fallito (`schema-version.test.ts:52`). Correzione di una frase. → patch
- [blind-hunter + edge-case-hunter] `alert.design.json` stantio (`description` `warning` = `card-foreground`, Penpot/fixture `muted-foreground`) — **medium**: verificato; misura del contrasto e seed di `addCell` partono da un valore superato. Correzione diretta del design + nota nella riga `drift` della skill; il meccanismo generale è già rimandato (deferred 2026-09-14). → patch
- [blind-hunter] la spec si contraddice (note "Non fatto" superate, snapshot "rosso di proposito", task builder) — **low**: vero ma la correzione è modificare la spec di questa build. → rifiutato (regola: niente fix che editano la spec)
- [blind-hunter] riga [PS] in `module-help.csv` con `preceded-by` = `pds-component:create`, ma [PS] vale anche per componenti mai passati da [PC] — **low**: verificato; correzione diretta del valore in sorgente e copie. → patch
- [blind-hunter + edge-case-hunter ×2] scrittura del JSON fallita (directory inesistente) cambia l'exit code / lascia `.tmp` — **low**: vero solo con un `--json` su percorso non scrivibile, dove fallire forte è il comportamento corretto; la skill usa `mktemp -d`. Il fix aggiunge rami. → rifiutato
- [blind-hunter] manca il test dell'ordinamento con un valore ignoto al contratto (variante non adottata) — **low**: verificato (i due test nuovi usano solo valori del contratto); aggiungere il test è diretto. → patch
- [blind-hunter] `role="alert"` per ogni stato (assertive anche su info/success); il giudizio ammette un solo ruolo fisso — **medium**: limite di espressività pre-esistente del giudizio, non introdotto qui. → defer
- [blind-hunter] testo specifico di Alert nella skill ([PC] passo 3, domanda 2) — **low**: verificato; generalizzazione diretta del testo. → patch
- [blind-hunter] [PS] senza percorso per le righe `global` — **false**: il passo 3 di [PS] le tratta ("riportala come bloccante"), è un percorso di stop come `gate-failed`.
- [blind-hunter] `skill-manifest.csv` punta a `_bmad/pds/pds-component/SKILL.md` inesistente — **low**: vero, ma copia lo schema installer già usato dalle altre tre skill pds (stesso path inesistente). → defer (pre-esistente)
- [blind-hunter] story generate non CSF3 — **low**: pre-esistente e già registrato (register Alert problema 7 → Story 2.11). → rifiutato (già tracciato)
- [edge-case-hunter] `compareCells` a pari merito conserva l'ordine di Penpot — **false**: il pari merito richiede due celle con la stessa chiave sugli assi del contratto, che l'estrazione rifiuta forte (`extract-component.ts:213`, "Cella duplicata") e `normalizeVariants` non ammette assi fuori contratto.
- [edge-case-hunter] `--json` passato due volte: vince l'ultimo — **low**: caso mai prodotto dalla skill; il fix aggiunge una guardia. → rifiutato
- [verification-gap] `main()` di `library-cli` inoltra `jsonPath` senza test — **medium**: verificato (nessun test chiama `main` di `library-cli`); togliere lo spread non rompe nulla. → patch (test su `main` con `--snapshot`)
- [verification-gap] entry point di `gates-cli` (`parseGatesArgs` → `publishReport(..., jsonPath)`) senza test — **medium**: verificato (il blocco `isDirectInvocation` non è eseguito da nessun test). → patch (estrarre la logica in una funzione testabile del modulo)

## Design Notes

**Perché `kind` negli script:** far instradare la skill leggendo il testo dei messaggi metterebbe il giudizio nel prompt (contro AD-11) e si romperebbe a ogni riformulazione. Un'unione chiusa nel report tiene il percorso negli script e il test la protegge. Esempio JSON: `{"component":"Badge","status":"pending","problems":[{"severity":"pending","kind":"variant-not-adopted","message":"…"}]}`.

**`bmad-workflow-builder`:** è una skill conversazionale. La uso in modalità build e rispondo alle sue domande con i contenuti di questa spec, poi eseguo la sua analisi di qualità sul risultato.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde
- `pnpm --filter @penpot-ds/scripts check-types` -- expected: verde
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: diff zero
- `pnpm lint` -- expected: verde
- `diff -r skills/pds-component .claude/skills/pds-component` (e `.agents/skills`) -- expected: nessuna differenza

**Manual checks:**
- I due percorsi eseguiti sul componente di verifica: comandi, exit code e decisioni riportati nelle Implementation Notes.
