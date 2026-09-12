---
baseline_commit: ff52ff5
---

# Story 2.4: Bootstrap della library Penpot sui contratti

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ℹ️ **Modulo `penpot-ds`: si crea in questa story** (decisione di Alessandro, 2026-09-12). BMad Builder è installato (`bmb` v2.2.2, commit `ca2055c`). Il modulo **non esiste ancora**: lo crea il dev nel Task 6, prima scrivendo le due skill con `bmad-workflow-builder` e poi impacchettandole con `bmad-module-builder` (create module). Le risposte al builder sono già scritte nel Task 6, quindi il dev non deve chiederle.

## Story

As a designer/sviluppatore,
I want una skill che crei la nuova library Penpot a partire dai contratti,
so that i componenti disegnati seguano già la linea del contratto invece di essere interpretati a posteriori (AD-11).

## Acceptance Criteria

1. **Given** i contratti della Story 2.3 (`@app/contracts`), il modulo BMad `penpot-ds` (creato in questa story, Task 6) e un file Penpot senza library **When** eseguo la skill di bootstrap **Then** vengono creati:
   - i token semantici, compresi `shadow`/`ring`;
   - **un VariantContainer per contratto** con gli assi del contratto;
   - **0 `variantError`**;
   - token legati su ogni proprietà di stile;
   - SharedPluginData `pagebuilder/contract = nome@versione`.
2. **And** su una library esistente il bootstrap **rifiuta** senza scrivere nulla. La **modalità additiva** crea solo ciò che manca e **segnala** le differenze senza correggerle.
3. **And** l'esito è deciso da uno **script di verifica**, non dal prompt della skill. Lo script controlla che ci sia un container per contratto e che assi e valori coincidano, ed è bloccante con exit code ≠ 0. Ha una prova rosso/verde automatica propria.
4. **And** la pipeline token (Story 2.1) rigira sulla nuova library **senza modifiche al codice** della pipeline (`theme-generator.ts`, `penpot-reader.ts`, `generate-theme.ts`). **And** nessun consumer fuori da `packages/tokens` e dalla ricetta Badge usa i vecchi nomi token (`mis-*`).

## Tasks / Subtasks

- [x] **Task 0: Gate dei prerequisiti (AC: tutti). Va fatto prima di scrivere codice.**
  - [x] Verifica che BMad Builder sia installato: `bmb` in `_bmad/_config/manifest.yaml`, skill `bmad-workflow-builder` e `bmad-module-builder` presenti in `.claude/skills/`, cartella di output `bmb.bmad_builder_output_folder = {project-root}/skills` in `_bmad/config.toml`. Se manca, **HALT**. Il modulo `penpot-ds` **non** si crea qui ma nel Task 6, perché il builder impacchetta skill già scritte.
  - [x] Verifica l'ambiente live: stack Penpot attivo (`docker/penpot`, `http://localhost:9001`), `PENPOT_MCP_TOKEN` impostata, plugin MCP connesso. Usa Node 22 (`nvm use 22.23.1`): con Node 20 il postinstall di `packages/db` fallisce.
  - [x] Chiedi ad Alessandro (o crea con il suo ok) un **file Penpot nuovo e vuoto** per la library, ad esempio "Page Builder DS", e connettici il plugin. **Non** usare "Nuovo File 4" (il prototipo del forge, che ha già token e container `badge@1`/`input@1`/`accordion-item@1`) né il file della library `mis`: servono entrambi come casi rossi del rifiuto (Task 7).
- [x] **Task 1: Spike di persistenza del binding (rischio aperto, deferred-work "hex-match")**
  - [x] Sul file nuovo, via `execute_code`: crea un set e un token colore, una board con un fill, e poi `shape.applyToken(token, ["fill"])`. Aspetta circa 100 ms e leggi `shape.tokens`. Poi **ricarica il file** (chiudi e riapri il file, riconnetti il plugin) e rileggi `shape.tokens`.
  - [x] Ci sono due note in contrasto. Quella della Story 2.2 dice "`applyToken` headless non persiste". Il forge, il 2026-09-11 su "Nuovo File 4", ha legato fill/padding/radius/fontSize. **Se dopo il reload il binding non persiste, HALT (decision-needed)**: senza binding persistente AC #1 ("token legati") non è verificabile. Scrivi l'esito nelle Completion Notes e aggiorna la voce "hex-match" in `deferred-work.md`: se il binding persiste, `shape.tokens` diventa la via primaria per la Story 2.5.
  - [x] Pulisci il file dopo lo spike (rimuovi token e board). Il bootstrap rifiuterebbe un file "sporco".
- [x] **Task 2: Specifica della library, come dati (AC: #1, #3)**
  - [x] `packages/scripts/src/library/library-spec.ts` definisce l'**elenco minimo dei token semantici richiesti**, in stile shadcn (principio guida di `penpot-pipeline.md`), con il nome Penpot e il tipo. I nomi sono scelti perché `varSuffix()` (Stadio 1) produca variabili pulite, senza toccare il generatore: `color.primary` → `--color-primary`/`bg-primary`, `text.sm` → `--text-sm`, `font.sans` → `--font-sans`, `shadow.ring` → `--shadow-ring`, `opacity.disabled` → `--opacity-disabled`. Il minimo richiesto è:
    - **color**: `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`, e i feedback `success`, `success-foreground`, `warning`, `warning-foreground`, `info`, `info-foreground` (decisione di Alessandro del 2026-09-12: servono a LifecycleBadge e ai toast, UX-DR2);
    - **radius**: `radius.sm`, `radius.md`, `radius.lg`, `radius.full`;
    - **spacing**: una scala `spacing.*`;
    - **tipografia**: `text.*` (fontSizes), `font-weight.*`, `font.sans`, e `tracking.*` con unità esplicita (`px`/`em`), perché il generatore rifiuta i bare number;
    - **border-width**: `border-width.default`;
    - **opacity**: `opacity.disabled`;
    - **shadow**: `shadow.ring` (l'anello di focus del forge: spread 3 che referenzia `{color.ring}`) più almeno `shadow.sm`.
  - [x] **Coppie di contrasto** dichiarate nella spec: ogni `X` / `X-foreground` e `background`/`foreground` devono avere un rapporto ≥ 4.5:1. `border`, `input` e `ring` devono avere ≥ 3:1 contro `background`. È il vincolo non negoziabile di `design-system.md`, che la memoria della Story 2.1 ha dimostrato violabile (il bug `border` 1.5:1). Qui diventa un controllo meccanico, non una revisione a occhio.
  - [x] `packages/scripts/src/library/semantic-tokens.seed.json` contiene i **valori del bootstrap, già decisi con Alessandro il 2026-09-12**. Sono tutti presi dal catalogo `mis` validato, nessuno è inventato. **Due set attivi**: `palette` contiene le scale e i colori raw, con i nomi sotto; `semantic` contiene i token semantici, che **referenziano** la palette (`color.primary = {accent.9}`), così il designer cambia un colore in un punto solo. Il generatore gestisce già i riferimenti tra token dello stesso tipo. Nomi dei token palette senza collisioni con i semantici dopo `varSuffix` (per esempio `gray.1` → `--color-gray-1`, `color.primary` → `--color-primary`). La collisione la verifica comunque `generateTheme()`.

    **Palette** (`palette`), colori: `gray.1` `#FAF4E8`, `gray.2` `#F9F9F9`, `gray.8` `#7A8F85`, `gray.11` `#3E4942`, `gray.12` `#1A1C1C`, `white` `#FFFFFF`, `accent.1` `#E8F5EF`, `accent.2` `#CCE9DA`, `accent.9` `#006C49`, `accent.11` `#004830`, `accent.12` `#002113`, `red.9` `#BA1A1A`, `green.9` `#2E7D32`, `amber.9` `#8F6C00`, `blue.9` `#0A4FA0`. Aggiungi le altre voci della scala `radix` solo se un semantico le referenzia: niente token orfani.

    **Semantici** (`semantic`) → riferimento:

    | Token | Rif. | Hex | Coppia / contrasto |
    |---|---|---|---|
    | `color.background` / `color.foreground` | `{gray.1}` / `{gray.12}` | `#FAF4E8` / `#1A1C1C` | 15.6:1 |
    | `color.card`, `color.popover` / `-foreground` | `{white}` / `{gray.12}` | `#FFFFFF` / `#1A1C1C` | 17.1:1 |
    | `color.primary` / `color.primary-foreground` | `{accent.9}` / `{white}` | | 6.5:1 (primary su background 5.9:1) |
    | `color.secondary` / `-foreground` | `{accent.1}` / `{accent.11}` | | 9.5:1 |
    | `color.muted` / `-foreground` | `{gray.2}` / `{gray.11}` | | 8.9:1 (muted-fg su background 8.6:1) |
    | `color.accent` / `-foreground` | `{accent.2}` / `{accent.12}` | | 13.2:1 |
    | `color.destructive` / `-foreground` | `{red.9}` / `{white}` | | 6.5:1 (testo su background 5.9:1) |
    | `color.success` / `-foreground` | `{green.9}` / `{white}` | | 5.1:1 (testo su background 4.7:1) |
    | `color.warning` / `-foreground` | `{amber.9}` / `{white}` | | 4.9:1. **Come testo su background 4.44:1, sotto soglia**: coppia ammessa solo come fill+foreground |
    | `color.info` / `-foreground` | `{blue.9}` / `{white}` | | 8.0:1 (testo su background 7.3:1) |
    | `color.border`, `color.input` | `{gray.8}` | `#7A8F85` | 3.15:1 su background, 3.45:1 su card |
    | `color.ring` | `{accent.9}` | | 5.9:1 su background |

    Dimensioni (nel set `semantic`, valori diretti):
    - raggi: `radius.sm` 4, `radius.md` 8, `radius.lg` 12, `radius.full` 9999;
    - spaziature: `spacing.1..9` = 4/8/12/16/24/32/40/48/64;
    - dimensioni testo: `text.xs` 12, `text.sm` 14, `text.base` 16, `text.lg` 18, `text.xl` 20, `text.2xl` 24, `text.3xl` 28;
    - pesi: `font-weight.regular` 400, `medium` 500, `semibold` 600, `bold` 700;
    - font: `font.sans` `["Manrope"]`, `font.serif` `["Noto Serif"]`;
    - spaziatura lettere: `tracking.none` `0px`, `tracking.tight` `0.5px`, `tracking.wide` `2px`;
    - bordi: `border-width.default` 1, `border-width.thick` 2;
    - opacità: `opacity.disabled` 0.5.

    Ombre:
    - `shadow.sm` = 0 1 3 0 `rgba(26,28,28,0.12)`;
    - `shadow.md` = 0 4 12 0 `rgba(26,28,28,0.16)` + 0 1 2 0 `rgba(26,28,28,0.10)`;
    - `shadow.lg` = 0 8 24 0 `rgba(26,28,28,0.20)` + 0 2 4 0 `rgba(26,28,28,0.12)`;
    - `shadow.ring` = 0 0 0 3 `{color.ring}`.

    Le coppie di contrasto della spec (punto precedente) comprendono i tre feedback, ma **per `warning` solo la coppia fill/foreground**. Il testo warning su background resta fuori dalle coppie finché il designer non sceglie un tono più scuro: è una voce da registrare in `deferred-work.md`. La skill mostra comunque il seed e chiede conferma prima di scrivere (Task 5), perché dopo il bootstrap i valori sono del designer in Penpot.
  - [x] Riferimenti tra token ammessi (`{color.ring}` dentro `shadow.ring`), ma solo quelli compatibili con le regole di `theme-generator.ts` (stesso tipo, oppure tipi numerici tra loro). Il verificatore li valida con `generateTheme()` stesso (Task 4), senza reimplementarle.
- [x] **Task 3: Piano di bootstrap/additiva, funzione pura (AC: #1, #2)**
  - [x] `packages/scripts/src/library/library-plan.ts`: `planLibrary({ mode: "bootstrap" | "additive", contracts, spec, seed, snapshot }) → { refused?: string; operations: Operation[]; differences: Difference[] }`. Non fa I/O e non chiama MCP.
    - **bootstrap**: se lo `snapshot` ha **almeno un set di token o almeno un componente** in `library.local`, restituisce `refused` con un motivo che nomina cosa ha trovato, e `operations: []`. Altrimenti produce, in ordine deterministico: set `palette` e `semantic` attivi, poi i token (prima la palette, poi i semantici che la referenziano), poi un container per contratto.
    - **additive**: crea solo i token mancanti e i container dei contratti che non hanno ancora un container legato via plugin data. Per ciò che esiste ma diverge produce `differences` e **nessuna** operazione: valore di un token diverso dal seed, assi o valori di un container diversi dal contratto, plugin data con versione diversa, nome incoerente. Ogni differenza nomina token/contratto, atteso e trovato. Mai operazioni di update o delete: il tipo `Operation` non ha varianti per farle, così l'invariante è garantito dal tipo e non dalla disciplina.
  - [x] **Container per contratto**: il nome è il PascalCase del contratto (`badge` → `Badge`, `accordion-item` → `AccordionItem`). Le proprietà di variante sono gli assi del contratto **nell'ordine del contratto**, con i nomi degli assi del contratto (`variant`, `size`, `state`). Le celle sono il prodotto cartesiano completo dei valori (Badge 3×2 = 6; Input 4; AccordionItem 2). Tutti e tre i tipi d'asse (`option`/`state`/`behavior`) sono disegnati come varianti (AD-11): il tipo **non** va scritto in Penpot.
  - [x] **Parti**: ogni cella contiene layer nominati come le `parts` del contratto (`root` = la board della cella). L'annidamento geometrico è libero, perché è layout: in AccordionItem `label`/`chevron` stanno dentro `trigger` e `body` dentro `content`, come nel prototipo del forge. È ciò che la Story 2.5 leggerà.
  - [x] **Stile per cella**: ogni proprietà di stile di ogni parte è un'applicazione di token (`fill`, `strokeColor`, `strokeWidth`, `borderRadius*`, `padding*`, `rowGap`/`columnGap`, `fontSize`, `fontWeight`, `fontFamilies`, `letterSpacing`, `opacity`, `shadow`), mai un literal senza binding. La mappatura ruolo → token per cella (per esempio Badge `destructive` → `root.fill = color.destructive`, `label.fill = color.destructive-foreground`; Input `focus` → `root.shadow = shadow.ring`; Input `disabled` → `root.opacity = opacity.disabled`; AccordionItem `divider.strokeColor = color.border`) sta in un file dati per contratto, `packages/scripts/src/library/designs/<contratto>.design.json`. È il disegno di partenza: il designer poi lo cambia in Penpot. Il test verifica che ogni cella di ogni contratto sia coperta e che ogni token referenziato esista nella spec.
  - [x] Il chevron di AccordionItem è un path: la sua geometria è libera e non viene tokenizzata (AD-11: "geometria delle icone ignorata"). Lo stroke però è legato a un token.
- [x] **Task 4: Snapshot e verifica, lo script che decide l'esito (AC: #1, #3)**
  - [x] `packages/scripts/src/library/library-reader.ts` legge via MCP (`execute_code`) uno **snapshot serializzabile** della library: set di token (nome, attivo) e token (nome, tipo, valore); per ogni VariantContainer il nome, `variants.properties`, i valori per proprietà (`currentValues`), le celle (`variantProps`, `variantError`), il plugin data `getSharedPluginData("pagebuilder", "contract")` e, per ogni cella, l'albero dei layer con nome, proprietà di stile valorizzate e `shape.tokens`. Riusa `callPenpotTool`/`withTimeout`/`isTextContent` di `mcp-client.ts` e lo stile di validazione dell'envelope di `penpot-reader.ts`: errori che nominano il campo malformato. Il plugin data sta **sul VariantContainer**, non sull'istanza (forge).
  - [x] `packages/scripts/src/library/verify-library.ts`: `verifyLibrary({ contracts, spec, snapshot }) → { ok: boolean; errors: string[] }`, **pura**. Fallisce, e ogni errore nomina contratto/cella/layer/token, se:
    1. un contratto **non ha container**, oppure **due container** dichiarano lo stesso contratto;
    2. il nome del container non coincide con il PascalCase del contratto;
    3. la versione nel plugin data ≠ `contractId(contract)`;
    4. le proprietà di variante ≠ assi del contratto (per nome e numero), oppure i valori di un asse ≠ `values` del contratto (per insieme: né mancanti né in più);
    5. le celle non sono il prodotto cartesiano completo, oppure c'è un `variantError` non nullo;
    6. manca una parte del contratto in una cella;
    7. una proprietà di stile valorizzata **non ha binding** in `shape.tokens`, oppure il binding punta a un token assente dal catalogo (la geometria dei path è esclusa);
    8. manca un token richiesto dalla spec, oppure un token ha un tipo diverso da quello richiesto;
    9. il catalogo non passa `generateTheme()` (riferimenti rotti, tipi incompatibili, tracking senza unità, collisioni di nome variabile): importa e chiama il generatore, non duplicarne le regole;
    10. una coppia di contrasto della spec è sotto soglia. Calcola il contrasto con la formula WCAG della luminanza relativa sui valori **risolti** (segui i `{ref}`) e scrivila come helper puro testato.
  - [x] Un container senza plugin data `pagebuilder` è un **errore solo se il suo nome coincide con quello di un contratto**. Container estranei (i segnaposto della Story 2.7, ad esempio) non sono affar suo.
  - [x] **Struttura testabile**, lezione della Story 2.2 Round 4: funzioni esportate, e CLI dietro la guardia `isDirectInvocation` (vedi `extract-component.ts`).
- [x] **Task 5: Scrittura su Penpot ed entry CLI (AC: #1, #2, #3)**
  - [x] `packages/scripts/src/library/penpot-writer.ts` traduce le `Operation` in codice `execute_code`, **un'operazione per chiamata** oppure a lotti piccoli, così un errore nomina l'operazione fallita. API da usare (verificate con `high_level_overview` il 2026-09-12):
    - `penpot.library.local.tokens.addSet({ name, active: true })`, `set.addToken({ type, name, value })`;
    - board e parti con flex layout (`board.addFlexLayout()`) e `penpot.library.local.createComponent([board])` per ogni cella;
    - `penpotUtils.createVariantContainer([{ shape, properties }...])`, **non** la sequenza a basso livello;
    - `shape.applyToken(token, [prop])`, che è **asincrono**: aspetta circa 100 ms prima di rileggere;
    - `container.setSharedPluginData("pagebuilder", "contract", contractId(c))`.
    
    Scrivi i valori colore hex **in maiuscolo** (convenzione dell'API).
  - [x] `packages/scripts/src/library/library-cli.ts` e script in `package.json`:
    - `bootstrap:library`: legge lo snapshot, poi `planLibrary(bootstrap)`. Se è `refused` esce con 1 senza scrivere nulla. Altrimenti esegue le operazioni, rilegge lo snapshot, lancia `verifyLibrary` ed esce con 1 se fallisce.
    - `add:library`: `planLibrary(additive)`. Stampa le `differences` (**exit 0**: segnalare non è un errore), esegue solo le operazioni di creazione e poi verifica.
    - `verify:library`: sola lettura. Snapshot, poi `verifyLibrary`, poi exit code.
    - Opzione `--dry-run` su bootstrap/additiva: stampa il piano senza scrivere.
    
    **Mai** in CI né in build: sono comandi live come `extract:component`, e vanno documentati così.
  - [x] Offline, `verify:library` può girare su uno snapshot salvato (`--snapshot <path>`). È il seam dei test, e permette alla Story 2.5/2.6 di riusarlo.
- [x] **Task 6: Il modulo `penpot-ds` e le sue skill (AC: #1, #2, #3)**
  - [x] **6a. Scrivi le skill** con `bmad-workflow-builder` (build a workflow) nella cartella di output del builder, `skills/` alla root del repo: `skills/pds-bootstrap/` e `skills/pds-additive/`, ciascuna con `SKILL.md`. Per il prefisso: il builder usa il codice del modulo nel nome delle skill. Sono due workflow sottili: **bootstrap** e **additiva**. Il loro compito è guidare e fare domande: conferma del file Penpot connesso, revisione dei valori del seed e dei `design.json` con il designer, lancio del `--dry-run`, conferma, lancio del comando, lettura dell'esito. **Il pass/fail lo decide l'exit code di `verify:library`**. Il prompt non contiene criteri di successo propri (AD-11: "pass/fail sta negli script e negli schemi, mai nel prompt"). Una skill non chiama mai `execute_code` per scrivere al di fuori dei comandi CLI.
  - [x] La skill additiva, per le differenze, **riporta e basta**. Non propone correzioni automatiche: sistemarle è del designer in Penpot o di un cambio esplicito di contratto.
  - [x] **6b. Impacchetta il modulo** con `bmad-module-builder` in modalità **create module**, sulla cartella `skills/`. Ci sono due skill, quindi il builder genera una **skill di setup dedicata** (`skills/pds-setup/`, tramite `scripts/scaffold-setup-skill.py`) e non l'approccio standalone. Risposte già decise, da dare senza chiedere ad Alessandro:
    - **Nome del modulo**: `Penpot DS`. **Codice**: `pds` (il builder vuole 2-4 lettere: `penpot-ds` è il nome concettuale usato nei documenti). **Versione**: `1.0.0`. **Tipo**: standalone, non un'espansione di `bmm`.
    - **Descrizione**: "Allinea la library Penpot ai contratti del page builder: bootstrap una tantum e aggiunte successive, con esito deciso dagli script di `packages/scripts`."
    - **Capability** (`module-help.csv`): `[PB] Bootstrap library` → `pds-bootstrap`, phase `anytime`, `required: false`. `[PA] Aggiunta additiva` → `pds-additive`, `after: pds-bootstrap:bootstrap`. `[SU] Setup` → `pds-setup`. `outputs`: "library Penpot verificata (`verify:library` verde)".
    - **Variabili di config**: nessuna. Endpoint e token vengono da `PENPOT_MCP_URL`/`PENPOT_MCP_TOKEN`, mai dalla config del modulo.
    - **Dipendenze esterne** (step 5 del builder): server MCP Penpot raggiungibile e plugin connesso. La skill di setup si limita a controllare che siano presenti e rimanda al README (`#penpot-locale-e-server-mcp`), senza installare nulla.
    - **Greeting**: "Modulo Penpot DS pronto. Apri il file Penpot, connetti il plugin MCP e lancia [PB] (bootstrap) oppure [PA] (additiva)."
  - [x] **6c. Valida e registra**: `python3 .claude/skills/bmad-module-builder/scripts/validate-module.py skills/` deve essere verde. Poi esegui `pds-setup` per registrare il modulo (config e voci nell'help di BMad). **Verifica** che `bmad-help` elenchi `[PB]`/`[PA]` e che le skill `pds-*` siano visibili a Claude Code e OpenCode. Se la skill di setup non le copia in `.claude/skills/` e `.agents/skills/`, segui il meccanismo indicato da `assets/setup-skill-template/SKILL.md` o dall'installer (`npx bmad-method install --custom-source ./skills`). Documenta nelle Completion Notes quale meccanismo hai usato. **Non** copiare a mano file nelle cartelle rigenerate dall'installer senza un meccanismo che le reinstalli.
- [x] **Task 7: Esecuzione live e prove di rifiuto (AC: #1, #2, #3)**
  - [x] Sul file nuovo: `bootstrap:library --dry-run`, poi `bootstrap:library`, con `verify:library` verde. Esporta almeno una cella per contratto (`export_shape`) e controlla a occhio che la resa sia sensata. È un controllo cosmetico: non decide l'esito.
  - [x] **Rosso di AC #2**: `bootstrap:library` su "Nuovo File 4" e sul file della library `mis` deve **rifiutare** con exit 1 e zero scritture. Confronta il numero di set e di componenti prima e dopo.
  - [x] **Additiva**: rilanciare `add:library` sul file appena creato non produce operazioni (idempotenza). Poi cambia a mano in Penpot il valore di un token: `add:library` deve riportare la differenza senza correggerla, e lo verifichi rileggendo il valore. **Ripristina il valore** alla fine.
  - [x] Scrivi gli esiti con i numeri (container, celle, token, binding) nelle Completion Notes.
- [x] **Task 8: Rigenerazione token sulla nuova library (AC: #4)**
  - [x] Con il plugin sul file nuovo, lancia `pnpm --filter @penpot-ds/scripts generate:theme -- --live`. **Nessuna modifica** a `theme-generator.ts`, `penpot-reader.ts` e `generate-theme.ts`. Se il generatore rifiuta il catalogo, si correggono i **token** (seed + Penpot), non il generatore. Il risultato è `src/__fixtures__/penpot-catalog.json` sostituita e `packages/tokens/src/tailwind-theme.css`/`tokens.generated.ts` rigenerati con nomi semantici (`--color-primary`…). `tailwind-extras.css` non si tocca.
  - [x] **Conserva il vecchio catalogo per i test**: prima della rigenerazione copia la fixture attuale in `src/__fixtures__/legacy-mis-catalog.json` e ripunta lì i test che dipendono dai nomi `mis`, cioè `theme-generator.test.ts` (asserzioni su set `mis.*` e `--color-mis-border`), `validate-recipe.test.ts` (valida la `badge.recipe.json` con classi `bg-mis-*`) e `component-reader.test.ts`. È un cambio **dei test**, non della pipeline, e tiene verdi gli 88+ test finché la Story 2.5 non sostituisce ricetta e fixture Badge. Aggiungi a `theme-generator.test.ts` un test che genera anche dalla **nuova** fixture e verifica almeno `--color-primary`, `--color-ring` e `--shadow-ring`.
  - [x] Conseguenza da documentare (README di `scripts` e Completion Notes): `validate:recipe -- Badge` da CLI ora fallisce contro il nuovo vocabolario. È atteso, perché la ricetta Badge è l'unica eccezione tollerata da AC #4 e la sostituisce la 2.5. La CI non la lancia.
  - [x] **Verifica "nessun consumer vecchio"**: un test in `packages/scripts` (o un piccolo script) scansiona `packages/ui/src` e `apps/web/src` (non `packages/tokens`, che è l'eccezione ammessa da AC #4) e fallisce se trova `mis-` o `mis.` in classi o variabili. Deve avere un caso rosso (un file tmp con `bg-mis-primary`) e uno verde. Oggi le occorrenze sono zero, come verificato dal correct-course. Il test impedisce che ricompaiano.
- [x] **Task 9: Confine di `packages/scripts` (AC: #3), perché la verifica deve leggere i contratti**
  - [x] `packages/scripts/scripts/check-boundaries.mjs` vieta **tutti** gli `@app/*` in `src/`. Allarga la regola **solo** a `@app/contracts`: `@app/*` diverso da `contracts` resta vietato, così come `@penpot-ds/ui` e `apps/*`. Poi aggiungi `"@app/contracts": "workspace:*"` alle `dependencies` e fai `pnpm install`. Il layering lo ammette: `contracts` è una foglia senza dipendenze UI, e la pipeline ne è un consumer (penpot-pipeline.md, Stadio 2).
  - [x] Poiché cambi la regola di un gate, dagli la **prova rosso/verde automatica** chiesta dall'action item Epic 1. Rifattorizza il check con lo schema del gate di `@app/contracts` (funzione `checkBoundaries({ packageRoot })` esportata, `.d.mts`, guardia di invocazione diretta) e aggiungi `packages/scripts/tests/check-boundaries.test.ts` (su tmpdir). Casi verdi: `@app/contracts` e il package reale. Casi rossi: `@app/domain`, `@app/contracts/../domain`, `@penpot-ds/ui`, `apps/web`. Non estendere il lavoro agli altri quattro check: l'action item resta open per quelli.
  - [x] Nota su vitest: in `packages/scripts` i test stanno in `src/*.test.ts`. Se aggiungi `tests/`, controlla che vitest li trovi (i default includono `**/*.test.ts`) e che `tsconfig.json` li includa per `check-types`.
- [x] **Task 10: Test (AC: #1, #2, #3)**. Tutti offline, deterministici, con il transport MCP mockato (seam `callTool`, come in `component-reader.test.ts`).
  - [x] `library-plan.test.ts`:
    - bootstrap su snapshot vuoto → operazioni complete, in ordine stabile (snapshot del piano o asserzioni esplicite);
    - bootstrap con un set presente → `refused` e 0 operazioni;
    - bootstrap con un componente presente → `refused`;
    - additiva idempotente → 0 operazioni;
    - additiva con un contratto nuovo nel registry (fittizio, iniettato come parametro `contracts`) → crea solo quel container;
    - additiva con un token di valore diverso → 1 differenza e 0 operazioni;
    - container con un asse in più → differenza.
  - [x] `verify-library.test.ts`: uno snapshot **verde** (costruito da un helper) e poi **un caso rosso per ciascuna delle 10 regole** del Task 4, con l'asserzione sul messaggio che nomina l'elemento. È la prova rosso/verde di AC #3: se un caso rosso passa, il gate è rotto, non il test.
  - [x] `contrast.test.ts`: coppie note, per esempio `#000`/`#FFF` = 21:1, e il caso `border` 1.5:1 della memoria 2.1 sotto soglia.
  - [x] `penpot-writer.test.ts` / `library-reader.test.ts`: il codice generato contiene le API attese, l'envelope malformato fallisce loud, il timeout viene propagato e il token non compare nei messaggi (maschera `userToken=***`, stile di `mcp-client`).
  - [x] `pnpm install`, `pnpm check-types`, `pnpm lint`, `pnpm test` e `pnpm build` verdi **a livello repo**. I test di `@app/db`/`@app/auth` richiedono `pnpm db:start`.
- [x] **Task 11: Documentazione e chiusura**
  - [x] `packages/scripts/README.md`: i tre comandi `*:library` (live, mai in CI), la spec/seed/design, il vecchio catalogo tenuto per i test fino alla 2.5, l'aggiornamento della nota "binding hex-match" in base all'esito del Task 1.
  - [x] `deferred-work.md`:
    - [x] aggiorna la voce "hex-match" con l'esito del Task 1;
    - [x] aggiorna la voce "dark mode" (la nuova library ha i set `palette` + `semantic`, niente themes: la voce resta aperta); aggiungi la voce "testo warning su background 4.44:1, serve un tono più scuro dal designer";
    - [x] chiudi la voce "correzione 5 token tracking nell'UI di Penpot" come **superata**, perché la library `mis` non è più la sorgente;
    - [x] aggiungi solo ciò che rimandi davvero.
  - [x] `sprint-status.yaml`: action item "BMad Builder + `penpot-ds`" → `done` quando il Task 6 è verde (modulo validato e skill visibili).

### Review Findings

Code review del 2026-09-12 (Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor). Diff: working tree contro `HEAD`, senza le due fixture JSON rigenerate né i 3 script Python di `pds-setup` generati dal builder.

Secondo pass del 2026-09-12 (stessi 4 layer) sul diff del merge su `develop` (`ff52ff5..a55b2dc`, 31 file, +3599/−267): tutti i finding sotto riesaminati e **confermati** ancora validi sul branch merged; 4 patch nuove aggiunte (le ultime quattro voci [Review][Patch]), 10 nuovi finding respinti con refutazione nell'appendice Rejected.

- [x] [Review][Decision] Recupero da una scrittura live interrotta a metà — `executeSteps` si ferma al primo step fallito e non ha rollback né un segno da cui ripartire. Rilanciare `bootstrap` viene rifiutato, perché i set ormai esistono. `add` non riconosce le celle orfane (nome `Badge variant=…`, non `Badge`), quindi le ricrea come componenti duplicati, e `containerStep` prende il primo componente con quel nome (`components.find`), che può essere quello vecchio. **RISOLTO (2026-09-12, scelta 1a di Alessandro):** guardia nel writer (`cellStep`/`containerStep` falliscono loud se esiste già componente con lo stesso `boardName` o il container) + documentazione della pulizia manuale nel README. [packages/scripts/src/library/library-cli.ts:171, packages/scripts/src/library/penpot-writer.ts:178]
- [x] [Review][Decision] Exit code e verifica di `add:library` — senza operazioni esce 0 *prima* di `runVerify`, quindi una library completa ma rotta (variantError, binding mancanti, contrasto sotto soglia, celle o parti mancanti) passa verde. Il Task 5 dice "esegue solo le operazioni di creazione e poi verifica". Quando invece ci sono operazioni, la verifica boccia (exit 1) proprio le differenze che l'additiva dovrebbe solo segnalare con exit 0. **RISOLTO (2026-09-12, scelta "Opzione 1" di Alessandro):** la verifica gira SEMPRE (anche a 0 operazioni), l'exit code è sempre quello di `verifyLibrary`, le differenze restano avvisi a schermo; README corretto. [packages/scripts/src/library/library-cli.ts:166]
- [x] [Review][Decision] I design di partenza non distinguono gli stati — in `accordion-item.design.json` le celle `state=closed` e `state=open` sono identiche (verificato), e la cella chiusa mostra anche `content`/`body`. In `input.design.json`, `error` cambia solo lo stroke e `disabled` solo l'opacity. La Story 2.5 estrae le ricette da queste celle. **RISOLTO (2026-09-12, Alessandro): si lascia al designer in Penpot** — la differenziazione degli stati non è in questa story; da riaprire alla 2.5 se le celle estratte risultano ambigue. [packages/scripts/src/library/designs/accordion-item.design.json]
- [x] [Review][Decision] Coppie di contrasto usate davvero dai design e non dichiarate nella spec — `muted-foreground` su `background` (placeholder dell'Input) e su `card` (body dell'Accordion), `foreground` su `card`, stroke `destructive` e `ring` su `background`. La regola 10 copre solo le coppie X/X-foreground e border/input/ring su background, come chiedeva il Task 2. **RISOLTO (2026-09-12, scelta "Opzione 1" di Alessandro):** le 5 coppie dei design (più `ring` su `card`) sono entrate in `LIBRARY_SPEC.contrastPairs` (19 coppie); oggi passano tutte (5.9:1–17.1:1), verificate sul seed. [packages/scripts/src/library/library-spec.ts:131]
- [x] [Review][Patch] Gate `scripts`: un import `apps/*` passa inosservato se sulla stessa riga c'è prima una stringa con apici misti (riprodotto: `const a = "it's"; import x from "apps/web";` → 0 violazioni). Il vecchio regex su tutta la riga lo prendeva, `FORBIDDEN_RAW` non copre `apps/`. Serve anche il caso rosso nel test, e c'è da togliere il `startsWith("apps/")` duplicato. [packages/scripts/scripts/check-boundaries.mjs:40,48] — **CORRETTO (2026-09-12):** duplicato rimosso, `FORBIDDEN_RAW` esteso a `apps/`, due casi rossi nuovi nel test.
- [x] [Review][Patch] `--snapshot` accettato con `bootstrap`/`add` senza `--dry-run`: il piano si calcola sul file, ma le scritture vanno sul Penpot connesso, e il rifiuto del bootstrap si aggira con uno snapshot vuoto. Va rifiutato in `parseArgs` fuori da `verify` e `--dry-run`. [packages/scripts/src/library/library-cli.ts:61] — **CORRETTO (2026-09-12)** in `parseArgs`, con test dedicato.
- [x] [Review][Patch] Nessun test per `library-cli` (errori di `parseArgs`, exit code di `main` in verify rosso/verde e sul bootstrap rifiutato via `snapshotPath`, dry-run senza scritture) e nessun test che lanci `check-boundaries.mjs` controllando l'exit code ≠ 0. [packages/scripts/src/library/library-cli.ts:125] — **CORRETTO (2026-09-12):** `library-cli.test.ts` (7 test su `parseArgs`) + test CLI del gate in `check-boundaries.test.ts` (invocazione `node scripts/check-boundaries.mjs` come in CI).
- [x] [Review][Patch] `verifyLibrary` salta in silenzio le celle con `variantProps === null` nelle regole 5, 6 e 7: una board non mappata nel container sfugge al controllo di parti e binding. Deve dare errore e nominare la board. [packages/scripts/src/library/verify-library.ts:161] — **CORRETTO (2026-09-12)**: errore che nomina la board nella regola 5; 6 e 7 la saltano perché già segnalata. Test dedicato.
- [x] [Review][Patch] Token in set inattivi contati come presenti: `buildTokenIndex` indicizza tutti i set, quindi le regole 7, 8 e 10 passano, mentre la regola 9 e `generate:theme` leggono solo i set attivi. Lo stesso buco c'è nel piano additivo, che non segnala token in un set inattivo o nel set sbagliato. [packages/scripts/src/library/verify-library.ts:34, packages/scripts/src/library/library-plan.ts:268] — **CORRETTO (2026-09-12)**: `buildTokenIndex` indicizza solo i set attivi; test dedicato. La parte "set sbagliato" del piano additivo resta coperta dalla nuova regola 8 col seed (stessa condizione).
- [x] [Review][Patch] Contratti diversi disegnati uno sopra l'altro: `cellStep` mette ogni cella a `x = 240*index, y = 0` e l'indice riparte da 0 per ogni contratto. Inoltre le board dell'AccordionItem, larghe 340px, si sovrappongono anche tra loro. Servono uno scarto verticale per contratto e un passo orizzontale basato sulla larghezza. [packages/scripts/src/library/penpot-writer.ts:124] — **CORRETTO (2026-09-12)**: passo orizzontale `max(240, larghezza board + 40)` e scarto verticale per contratto in `operationsToSteps`.
- [x] [Review][Patch] `no-legacy-consumers` resta verde se `packages/ui/src` o `apps/web/src` non esistono (`if (!existsSync(dir)) return`): è lo stesso gate fragile segnalato nella retro di Epic 1. Deve fallire se la cartella manca. [packages/scripts/tests/no-legacy-consumers.test.ts:26] — **CORRETTO (2026-09-12)**: throw fail-closed se la directory manca.
- [x] [Review][Patch] `library-plan.test.ts` ricopia a mano i contratti (`contractFixture`) invece di usare il registry, contro la Dev Note "il registry è l'unico elenco". Inoltre il test "…resta refused anche in modalità additiva…" verifica il contrario di quello che dice il nome. Serve almeno un'asserzione di uguaglianza con `COMPONENT_CONTRACTS`, e il test va rinominato. [packages/scripts/src/library/library-plan.test.ts:26] — **CORRETTO (2026-09-12)**: test sui contratti reali del registry, contratto fittizio derivato da `COMPONENT_CONTRACTS.input`, test rinominato ("l'additiva non rifiuta mai").
- [x] [Review][Patch] Manca il test di mascheratura del token negli errori di reader e writer, richiesto dal Task 10 (`userToken=***`), anche se il Task è spuntato. [packages/scripts/src/library/library-reader.test.ts] — **CORRETTO (2026-09-12)**: test nel reader sul contratto `displayUrl` mascherato + test nel writer sulle guardie generate; il reader passa da `callPenpotTool`, i cui messaggi usano solo `displayUrl`.
- [x] [Review][Patch] Il `.d.mts` dichiara `line?: number`, ma il backstop raw usa `line: "?"`. Il tipo giusto è `number | "?"`. [packages/scripts/scripts/check-boundaries.d.mts:4] — **CORRETTO (2026-09-12)**.
- [x] [Review][Patch] `isDirectInvocation` di `library-cli` non usa `realpathSync`, a differenza del gate aggiornato in questo diff: se il file viene invocato tramite un symlink, `main()` non parte ed esce 0 in silenzio. [packages/scripts/src/library/library-cli.ts:183] — **CORRETTO (2026-09-12)**: stesso schema del gate.
- [x] [Review][Patch] `verifyLibrary` non verifica mai che il catalogo live coincida con `semantic-tokens.seed.json`: la regola 8 controlla solo nome e tipo, non i valori, e `verify:library` non riceve il seed. Un token ripuntato a mano in Penpot (es. `color.primary` su un altro colore) passa verde. [packages/scripts/src/library/verify-library.ts:221] — **CORRETTO (2026-09-12)**: `VerifyLibraryInput` accetta `seed` opzionale; il CLI lo passa sempre (verify e post-scrittura). I valori ripuntati diventano errori che nominano atteso/trovato; hex con case diverso non è differenza.
- [x] [Review][Patch] L'additiva salta in silenzio la verifica dei valori d'asse quando `axesValues[axis.name]` manca (`if (!found) continue`, library-plan.ts:327) — la stessa condizione che la regola 4 del verify tratta come errore: le due fasi sono in disaccordo su un container senza `currentValues`. [packages/scripts/src/library/library-plan.ts:327] — **CORRETTO (2026-09-12)**: l'additiva segnala la differenza.
- [x] [Review][Patch] Il gate `check-boundaries` non ha alcun test che esegua lo script come CLI (`node scripts/check-boundaries.mjs`, come fa `lint` in CI): se `isDirectInvocation` regredisce a sempre-falso, il gate diventa un no-op silenzioso con exit 0 e i test sulle funzioni esportate restano verdi. [packages/scripts/tests/check-boundaries.test.ts] — **CORRETTO (2026-09-12)**: test `execFileSync` che verifica stdout `✔ Confine scripts rispettato` dall'invocazione reale.
- [x] [Review][Defer] Stati dei design lasciati al designer (decision 3, 2026-09-12): la differenziazione visiva degli stati in `designs/*.design.json` non è in questa story; da riaprire alla 2.5 se le celle estratte risultano ambigue.
- [x] [Review][Defer] `fontFamilies` non legato ai token (AC #1, "ogni proprietà di stile") [packages/scripts/src/library/library-reader.ts] — deferred: limite dell'API Penpot 2.17.2 (`applyToken` rifiuta i `fontFamilies`), già registrato in `deferred-work.md`.
- [x] [Review][Defer] `--font-sans: Manrope` / `--font-serif: "Noto Serif"` senza stack di fallback [packages/tokens/src/tailwind-theme.css:74] — deferred: lo produce la pipeline token, che per AC #4 non si tocca.
- [x] [Review][Defer] `pds-setup` lancia `cleanup-legacy.py --also-remove _config`, che in un progetto gestito dall'installer cancellerebbe `_bmad/_config/`, `_bmad/core/` e `_bmad/pds/`. Inoltre `_bmad/pds/config.yaml` contiene `user_name` [skills/pds-setup/SKILL.md:74] — deferred: è il boilerplate del builder, identico a `bmad-bmb-setup`; va valutato a livello di framework.
- [x] [Review][Defer] `applyToken` su `strokeColor`/`strokeWidth` di shape che non hanno ancora uno stroke (divider, chevron, root dell'Input) [packages/scripts/src/library/penpot-writer.ts] — deferred: non verificato (medium se confermato). Per chiarirlo basta controllare in "Page Builder DS" che divider e bordo dell'Input abbiano uno stroke visibile.
- [x] [Review][Defer] Il gate `scripts` non intercetta import relativi fuori dal package (`../../apps/web/src/x`, `../../ui/src`) [packages/scripts/scripts/check-boundaries.mjs:40] — deferred: preesistente, il gate a `HEAD` non li copriva neanche prima.

#### Rejected

- `false`: la modalità additiva non segnala un asse senza `axesValues` — lo segnala già `axesMismatch` (library-plan.ts:316).
- `false`: gli script di `pds-setup` mancano — esistono in `skills/pds-setup/scripts/`, erano solo esclusi dal diff.
- `false`: la regola 7 non confronta il binding con il design — è voluto, dopo il bootstrap i valori sono del designer.
- `false`: le chiavi di `shape.tokens` non corrispondono alle proprietà di stile — il verify live è verde su 190 binding reali.
- `false`: il backstop raw non copre `@app/contracts/./` — lo rifiuta già `isForbiddenSpecifier`.
- `low`: il conteggio dei test nelle Completion Notes non torna (7/6/9 contro 13/8/12) — la correzione toccherebbe la spec sotto review.
- `low`: la prova di rifiuto su "Nuovo File 4" non è stata eseguita — il file è vuoto, e il sostituto (Page Builder DS non vuoto, più la library `mis`) è documentato.
- `low`: le skill sono state scritte a mano invece che con `bmad-workflow-builder` — nessun danno concreto, `validate-module.py` è verde.
- `low`: il piano non valida i nomi token dei design contro la spec — lo fa già un test sui design committati.
- `low`: il design non valida l'ordine dei parent né le chiavi sconosciute — i dati sono committati e coperti dai test, e la guardia aggiungerebbe complessità.
- `low`: nomi token duplicati tra set diversi si sovrascrivono nella `Map` — caso improbabile, la guardia aggiungerebbe complessità.
- `low`: il timeout di default di 15 s per la rilettura dopo la scrittura — il run live è riuscito.
- `low`: l'attesa fissa di 150 ms dopo `applyToken` — il run live è verde, non ci sono prove del contrario.
- `low`: `@penpot-ds/uikit` sarebbe un falso positivo — package inesistente, e il backstop raw si comporta come il vecchio gate.
- `low`: il test verde di verify ricava le chiavi di stile dal design stesso — il verify live copre le chiavi reali.
- `low`: il messaggio di successo di `verifyLibrary` è ridondante — cosmetico.
- `low`: `package.json` ha le chiavi riordinate e `→` al posto della freccia — solo rumore cosmetico.
- `false`: `check-boundaries.mjs` conterrà il duplicato `specifier.startsWith("apps/")` — vero, ma è già coperto dal finding [Patch] sul backstop `apps/` mancante (stessa riga, stessa correzione); nessun secondo ingresso.
- `false`: il gate salta specifier dentro literal con apici misti per `apps/` — confermato live, ma è la stessa radice del finding [Patch] "gate scripts: import apps/* passa inosservato" già in elenco; niente voce doppia.
- `false`: `FORBIDDEN_RAW` non copre `apps/` in forma desincronizzata — rientra nel medesimo finding [Patch] sul gate; non duplicato.
- `false`: `verify:library` esegue `loadSeed()` inutile in modalità verify — vero (library-cli.ts:126), ma il seed esiste sempre nel package (file committato) e il fallimento sarebbe loud; danno concreto nullo, rifiutato come noise.
- `false`: `--snapshot` accettato in bootstrap/add senza `--dry-run` aggira il rifiuto con uno snapshot vuoto — già in elenco come [Review][Patch] (library-cli.ts:61), non duplicato.
- `false`: `no-legacy-consumers` matcha anche prose come "mis-aligned" — pattern `/\bmis[-.]/` lo matcherebbe, ma nei consumer scansionati (`packages/ui/src`, `apps/web/src`) le occorrenze reali sono 0 e un falso positivo è fail-closed con messaggio che nomina file:linea; correzione più complessa del danno, rifiutato.
- `false`: `README` passo 4 "validate:recipe … deve passare" contraddice la nota sul fallimento atteso di Badge — vero a lettera, ma il passo 4 riguarda il workflow di estrazione di componenti nuovi, non la ricetta Badge legacy; ambiguità minima, rifiutato come low-cosmetico.
- `low`: il piano non segnala token con lo stesso nome in due set diversi (l'ultimo vince silenziosamente nella `Map`) — caso improbabile e la guardia aggiungerebbe complessità; già respinto nella forma simile alla review precedente.
- `low`: celle sovrapposte sul canvas (`x = 240*index`, board Accordion 340px) — già in elenco come [Review][Patch]; il danno è solo estetico sul canvas.
- `low`: `deletion` — variabili rimosse da `tailwind-theme.css`/`tokens.generated.ts` (feedback-*, focus, space-*, raggi) potrebbero avere consumer non presidati — verificato: nessun consumer in `packages/ui/src`, `apps/web/src`, `packages/api/src` referenzia le variabili rimosse (grep a 0 risultati; gli unici usi Tailwind sono `bg-primary`, `border-input`, `ring-ring`, tutti presenti nel nuovo tema); il test `no-legacy-consumers` copre la direzione opposta. Rifiutato.
- `low`: `claim` — README dice "exit 0 anche con differenze" ma con operazioni presenti l'exit è quello del verify — vero, ma è già la seconda metà del finding [Decision] "Exit code e verifica di `add:library`"; niente voce doppia.
- `low`: `deletion` — `fail()` non stampa più il path degli scanError — vero (`const loc = file ?? relative(packageRoot, path)` rimosso), ma gli scanError hanno sempre `path` e il vecchio codice usava solo il fallback; l'unico effetto è la perdita del path in un caso che non si verifica. Cosmetico, rifiutato.
- `low`: il rifiuto del bootstrap con 1 set usa il ternario `sets === 1 ? "set di token" : "set di token"` con rami identici — vero (library-plan.ts:220), il messaggio resta comunque corretto e nominativo; cosmetico, rifiutato.
- `low`: `--snapshot` ripetuto nella stessa riga di comando: l'ultimo valore vince in silenzio — caso d'uso irrealistico da CLI con un flag, rifiutato.
- `low`: `mainInstance()` potrebbe restituire null in `containerStep` — il componente è stato appena creato dallo step cella precedente nello stesso file live; nessun percorso noto che lo renda null, rifiutato come speculativo.
- `low`: `library-cli` carica i design JSON a import-time anche per verify — I/O locale di 3 file da ~5 KB, nessun danno; rifiutato.
- `low`: `new-catalog.test.ts` invece di un test dentro `theme-generator.test.ts` come da lettera del Task 8 — l'intento (test che genera dalla nuova fixture e verifica `--color-primary`, `--ring`, `--shadow-ring`) è soddisfatto; deviazione di posizione senza danno, rifiutata.
- `low`: la prova di rifiuto su "Nuovo File 4" non eseguita (file vuoto) — già registrata come `low` nella review precedente; resta valida la sostituzione documentata (Page Builder DS non vuoto + library mis).

## Dev Notes

### Contesto: perché esiste questa story

Il correct-course del 2026-09-12 (scope Major, approvato) ha stabilito che **il contratto è del page builder** (`@app/contracts`, Story 2.3) e che Penpot possiede solo valori e aspetto. Questa story è lo **Stadio 0** di `penpot-pipeline.md`: la library Penpot si allinea al contratto **solo tramite skill**, con un bootstrap una tantum e poi solo aggiunte. Il motivo è concreto: la library attuale (`mis`) ha un Input con asse `colorStyle` a 12 chiavi composte e varianti Indigo/Green identiche, cioè input da buttare. I componenti nuovi devono nascere già sulla linea del contratto, così la Story 2.5 li estrae invece di interpretarli.

Consumer a valle di ciò che crei qui:
- **2.5** estrazione: legge il plugin data (e fallisce su duplicato, nome incoerente, contratto senza container), gli assi, le parti nominate e `shape.tokens`. `verifyLibrary` e lo snapshot sono riusabili lì.
- **2.6** emitter e gate di drift: legge la nuova fixture e i token semantici (`bg-primary`, `ring`).
- **2.7** libreria: ogni contratto nuovo passa dalla modalità **additiva**.

### Guardrail (cosa NON fare)

- **Non toccare** `packages/contracts` (è la porta e resta com'è: un contratto nuovo è una story a sé), `recipe-schema.ts`, `badge.fixture.json`, `badge.recipe.json`, `component-reader.ts`, `extract-component.ts` e `validate-recipe.ts`. Tutti quelli dello Stadio 2 li adegua la **Story 2.5**. Non toccare nemmeno `theme-generator.ts`, `penpot-reader.ts` e `generate-theme.ts` (AC #4: "senza modifiche al codice").
- **Non toccare** `packages/ui`, `apps/web`, `turbo.json` e `.github/workflows/ci.yml`. I comandi `*:library` non vanno in CI: Penpot non è raggiungibile dal runner.
- **Non modificare né cancellare** nulla in Penpot al di fuori del file nuovo. Sui file esistenti ("Nuovo File 4" e la library `mis`) si fanno **solo letture** e le prove di rifiuto. Nessuna sincronizzazione codice→Penpot ricorrente (kill del forge).
- **Nessun tipo d'asse in Penpot**: niente proprietà "type", niente nomi tipo `state:behavior`. Il tipo vive solo nel contratto (decisione del forge).
- **Nessun criterio di successo nel prompt della skill.** Se ti accorgi di scrivere "verifica che…" in un `SKILL.md`, quel controllo va in `verifyLibrary`.
- **Nessun dark mode/themes**: due set attivi (`palette`, `semantic`) e nessun `TokenTheme`. `buildIndex` rifiuta i nomi duplicati tra set (vedi deferred "dark mode").
- Non aggiungere contratti (Box/Flex arrivano nella 3.2, gli altri nella 2.7) e non disegnare segnaposto per i componenti complessi.

### Decisioni già prese (non riaprirle)

- I token hanno **nomi semantici alla shadcn**. Supera la decisione del 2026-09-05 "contratto CSS Penpot-native".
- Il legame è **SharedPluginData** `pagebuilder/contract = nome@versione` sul VariantContainer, e il nome del container fa da controllo incrociato. Lo scrivono solo le skill, mai il designer.
- Il bootstrap crea anche **shadow/ring**. È il crack del forge: l'anello di focus dell'Input era un'ombra spread 3 senza token.
- Esiste **una sola libreria per installazione**. La library Penpot nuova sostituisce `mis` come sorgente dello Stadio 1.
- Il **criterio di stop** (una parte annidata con assi propri fa fallire lo schema) è della Story 2.5, non di questa.

### Evidenze dal prototipo del forge (file "Nuovo File 4", 2026-09-11, via MCP)

- **Badge**: 12 token semantici in un set `semantic`, 6 varianti con `createVariantContainer`, 0 `variantError`, token legati su fill/padding/radius/fontSize, `badge@1` leggibile, resa corretta all'export.
- **Input**: `state` default/focus/error/disabled. Gli stati cambiano lo stile (bordo ring/destructive, opacity 0.5 da un token `disabled-opacity`), ma in codice sono pseudo-classi.
- **AccordionItem**: `state` closed/open. Parti `trigger`(`label`, `chevron`), `content`(`body`), `divider` (bordo solo in basso con il token `border`), chevron come path con token `strokeColor`. Tra le varianti cambia solo il comportamento e la geometria del chevron.
- `switchVariant` su un'istanza funziona, e i token seguono la variante. Dall'istanza si risale al container con `component().mainInstance().parent`.

### Pattern da riusare (non reinventare)

- Il client MCP è `mcp-client.ts` (`callPenpotTool`, `resolveMcpEndpoint`, `withTimeout` 15 s, `isTextContent`, mascheratura del token). Per le operazioni lunghe di scrittura valuta un timeout per chiamata più ampio, passato come parametro, **senza** cambiare il default.
- La validazione dell'envelope segue `penpot-reader.ts#extractCatalog`.
- La regola dei nomi token è `varSuffix`/`varName`/`TYPE_NAMESPACE` (`theme-generator.ts`). Scegli i nomi Penpot in funzione di quella regola, non viceversa.
- `generateTheme()` fa da validatore del catalogo, perché contiene già riferimenti, tipi, unità e collisioni.
- Il gate con test su tmpdir segue `packages/contracts/scripts/check-boundaries.mjs` più `tests/check-boundaries.test.ts`.
- La guardia di invocazione diretta del CLI è in `extract-component.ts`.
- Per le API contratti usa `COMPONENT_CONTRACTS`, `contractId`, `Axis.type`/`values`/`default` e `parts` da `@app/contracts`. Non ricopiare i valori dei contratti negli script: il registry è l'unico elenco.

### Intelligence dalle story precedenti

- **2.3**: il gate ad allowlist è stato aggirato in 12 modi alla prima review. Se tocchi il check di `scripts`, parti dal modello già blindato. Il pattern "il test dimostra il rosso prima del verde" ha funzionato (fingerprint).
- **2.2**: quattro round di review perché le verifiche erano manuali. Il bug `main()` all'import è emerso solo scrivendo il primo test. `applyToken` headless era dato per non persistente, ma il forge lo contraddice (Task 1). Scrivere su Penpot richiede la pagina attiva (`penpot.openPage`).
- **2.1**: la fixture si aggiorna solo dopo che la generazione è riuscita (`generate-theme.ts`), quindi un catalogo rotto non corrompe nulla. Il tracking senza unità fallisce by design.
- **Retro Epic 1**: ogni gate scritto a mano era aggirabile. Per questo AC #3 chiede che l'esito lo decida uno script con i test propri.
- Branch: `story/2.4-bootstrap-della-library-penpot-sui-contratti`. Commit `feat(scripts)[bmad:2.4]: …`. Il codice della skill nel modulo si committa nello stesso branch.

### Project Structure Notes

```
packages/scripts/
  package.json                     # + @app/contracts, script bootstrap:library / add:library / verify:library
  scripts/check-boundaries.mjs     # MODIFICATO: ammette solo @app/contracts; funzione esportata
  scripts/check-boundaries.d.mts   # NUOVO
  tests/check-boundaries.test.ts   # NUOVO (o src/check-boundaries.test.ts, per coerenza con il package)
  src/library/
    library-spec.ts                # token richiesti + coppie di contrasto
    semantic-tokens.seed.json      # valori proposti (dal catalogo validato)
    designs/badge.design.json      # ruolo→token per parte × cella
    designs/input.design.json
    designs/accordion-item.design.json
    library-plan.ts (+ .test.ts)   # piano puro bootstrap/additiva
    library-reader.ts (+ .test.ts) # snapshot via MCP
    verify-library.ts (+ .test.ts) # l'esito (10 regole)
    contrast.ts (+ .test.ts)
    penpot-writer.ts (+ .test.ts)
    library-cli.ts                 # entry CLI
  src/__fixtures__/penpot-catalog.json      # SOSTITUITA dalla nuova library (via --live)
  src/__fixtures__/legacy-mis-catalog.json  # NUOVO: vecchio catalogo, solo per i test fino alla 2.5
packages/tokens/src/tailwind-theme.css, tokens.generated.ts  # RIGENERATI
skills/                            # output di BMad Builder (bmb.bmad_builder_output_folder)
  pds-bootstrap/SKILL.md           # workflow sottile: domande → dry-run → bootstrap:library → verify
  pds-additive/SKILL.md            # workflow sottile: domande → dry-run → add:library → verify
  pds-setup/                       # generata da bmad-module-builder (module.yaml, module-help.csv, script)
```

- La Structural Seed dello spine prevede `scripts/penpot/`, `recipes/`, `render/` e `gates/`, ma il package reale è piatto in `src/`. `src/library/` è coerente con il codice esistente: il codice possiede la struttura dopo il seed.

### Testing Requirements

- Vitest, offline e deterministico. Il transport MCP è mockato e gli snapshot Penpot sono JSON costruiti da helper, senza rete.
- AC #3 si dimostra con `verify-library.test.ts`: un caso rosso per regola più un verde. AC #2 con `library-plan.test.ts` (rifiuto, idempotenza, sole differenze) **e** con le prove live del Task 7.
- AC #4 si dimostra con la rigenerazione `--live` (diff committato di fixture e token), con il test sulla nuova fixture e con il test "nessun `mis-` nei consumer".
- Non regressione: tutti i test esistenti verdi, compresi gli 88+ di `scripts` e i 110 di `contracts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4, #Epic 2 (Tooling), #Story 2.5, #Story 2.7]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-11, #AD-5, #AD-3]: ownership, plugin data, skill bootstrap/additiva, pass/fail negli script.
- [Source: _bmad-output/specs/spec-page-builder/penpot-pipeline.md#Principio guida, #Stadio 0, #Stadio 1]: nomi shadcn, stessa funzione di nome per variabili e classi.
- [Source: _bmad-output/specs/spec-page-builder/design-system.md#tokens]: contrasto ≥4.5:1 per il testo e ≥3:1 per gli indicatori.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-12.md#2 Impatto tecnico, #4.6, #4.9-f]: correzione di AC #4 (verifica al posto del riallineamento di `ui/editor`).
- [Source: _bmad-output/forge/penpot-shadcn-e-esagono-puck/forged-idea.md, .memlog.md]: prototipo MCP e crack shadow/ring.
- [Source: _bmad-output/implementation-artifacts/2-3-package-dei-contratti.md]: API dei contratti e modello del gate testato.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md]: voci "hex-match / applyToken", "dark mode", "5 token tracking".
- [Source: _bmad-output/specs/spec-penpot-dev-mcp/mcp-token.md, README.md#Penpot locale e server MCP]: connessione, token, plugin.
- [Source: packages/scripts/src/theme-generator.ts, penpot-reader.ts, mcp-client.ts, generate-theme.ts]
- [Source: Penpot MCP `high_level_overview`, 2026-09-12]: API di token, varianti, `applyToken` asincrono, `createVariantContainer`.

## Dev Agent Record

### Agent Model Used

glm-5.3-flash (opencode-go/glm-5.3-flash), sessione dev-story del 2026-09-12.

### Debug Log References

- Bootstrap live: 4 run registrati (`/tmp/opencode/bootstrap*.log`). Il run 1 ha esposto due difetti poi corretti: (a) `tokenStep` generava JS invalido (stringa con virgolette non escapate) e l'envelope d'errore di `execute_code` arriva con `isError` undefined → lo step passava per "ok"; corretti quoting + `parseExecuteCodeEnvelope` in `executeSteps` + test che compila ogni step generato. (b) `applyToken` rifiuta i token `fontFamilies` su Penpot 2.17.2 ("should be a set of strings") → font escluso dai binding (design, reader, voce deferred). Il run 3 ha esposto `currentValues(prop)` per NOME (non indice) e il fill bianco di default delle board nuove (rimosso se il design non lega `fill`). Run 4 (canonico): 93/93 step ok, verify verde, exit 0.
- Prova di rifiuto live: su "Page Builder DS" non vuoto (bootstrap rifiutato, exit 1, zero scritture) e sul file "lib-components-shadcn" (la library `mis`: 1 set, 3 componenti prima e dopo). "Nuovo File 4" risulta VUOTO (il prototipo del forge non c'è più): la prova lì non è stata eseguita per non scrivere su un file esterno — il rifiuto su file vuoto è comunque coperto dai test offline del piano (bootstrap su snapshot vuoto procede, su set/componente rifiuta).

### Completion Notes List

- **Task 0**: prerequisiti verdi (bmb v2.2.2, skill builder presenti, Node 22.23.1, stack Penpot attivo, plugin connesso). File nuovo **"Page Builder DS"** creato da Alessandro e connesso.
- **Task 1 (spike hex-match)**: `applyToken` **persiste** dopo reload del file — `shape.tokens = { fill: "spike.color" }` letto identico dopo chiusura/riapertura. Voce "hex-match" aggiornata in `deferred-work.md`: `shape.tokens` via primaria per la 2.5. File ripulito dopo lo spike.
- **Task 2**: `library-spec.ts` (61 token + 14 coppie di contrasto, warning fillPairOnly) + `semantic-tokens.seed.json` (palette 15 + semantic 61, riferimenti `{...}`) + test coerenza spec/seed/`generateTheme()`.
- **Task 3**: `library-plan.ts` puro (bootstrap rifiuta su library non vuota nominando cosa trova; additiva crea solo il mancante, differenze senza update/delete — invariante nel tipo `Operation`) + 3 `designs/*.design.json` (Badge 3×2=6, Input 4, AccordionItem 2 celle, parti annidate come nel forge, chevron path non tokenizzato tranne lo stroke).
- **Task 4**: `library-reader.ts` (snapshot serializzabile via MCP, validazione envelope che nomina il campo malformato) + `verify-library.ts` (10 regole pure, un caso rosso per regola nei test) + `contrast.ts` (WCAG luminanza relativa).
- **Task 5**: `penpot-writer.ts` (un'operazione per chiamata, hex in maiuscolo, `createVariantContainer` di alto livello, plugin data sul container) + `library-cli.ts` (`bootstrap:library`, `add:library`, `verify:library`, `--dry-run`, `--snapshot <path>` offline) + script in `package.json`.
- **Task 6**: skill `skills/pds-bootstrap/` e `skills/pds-additive/` scritte a mano (workflow sottili: domande → dry-run → comando → esito dall'exit code, nessun criterio di successo nel prompt, mai `execute_code` fuori dai CLI). Modulo impacchettato con `scaffold-setup-skill.py` (Nome "Penpot DS", codice `pds`, v1.0.0, standalone; capability [PB]/[PA]/[SU]; nessuna variabile di config; endpoint/token da ambiente). `validate-module.py skills/` verde (0 findings). Registrazione eseguita con gli script di `pds-setup` (merge-config + merge-help-csv: sezione `pds` in `_bmad/config.yaml`, 3 righe in `_bmad/module-help.csv`) e skill installate con `npx bmad-method install --custom-source ./skills --modules core,bmm,bmb,pds --tools claude-code,opencode --action update -y` → `pds-*` visibili in `.claude/skills/` e `.agents/skills/` (17+3 skill per IDE), help catalog aggiornato. Nota operativa: il primo tentativo con `--modules pds` solo aveva rimosso come "shim deprecati" le skill degli altri moduli — recuperato rilanciando l'installer con TUTTI i moduli (core,bmm,bmb,pds): 0 file perso, 58 skill per IDE.
- **Task 7 (esiti live con i numeri)**: bootstrap su "Page Builder DS" — dry-run 81 operazioni → run reale **93 step ok** (2 set + 76 token + 12 celle + 3 container). Risultato misurato via MCP: set `palette` (15 token) + `semantic` (61 token) attivi, 3 VariantContainer (`Badge` badge@1 assi variant×size 6 celle; `Input` input@1 asse state 4 celle; `AccordionItem` accordion-item@1 asse state 2 celle), **0 variantError**, **190 binding token su 34 shape**, `verify:library` verde, exit 0. Export cosmetico di una cella per contratto: resa sensata (Badge destructive rosso/testo bianco, Input bordo+placeholder, AccordionItem trigger/chevron/body/divider). Rosso AC #2: bootstrap su "lib-components-shadcn" (library mis) rifiutato con exit 1, zero scritture (1 set/3 componenti prima e dopo); rifiuto provato live anche su "Page Builder DS" non vuoto. Additiva: idempotente (0 operazioni); con `accent.9` cambiato a mano (#006C00) segnala la differenza senza correggerla (exit 0, valore rileto invariato), poi ripristinato (#006C49).
- **Task 8**: `generate:theme --live` riuscito SENZA modifiche a `theme-generator.ts`/`penpot-reader.ts`/`generate-theme.ts` (git diff vuoto). `penpot-catalog.json` sostituita (palette+semantic, 76 token), `tailwind-theme.css`/`tokens.generated.ts` rigenerati con nomi semantici (`--color-primary: var(--color-accent-9)`, `--color-ring`, `--shadow-ring: 0px 0px 0px 3px var(--color-ring)`); `tailwind-extras.css` intatto. Vecchio catalogo conservato in `legacy-mis-catalog.json` e test ripuntati (`theme-generator.test.ts`, `validate-recipe.test.ts`, `component-reader.test.ts`); drift guard ripuntato alla fixture corrente; nuovo test che genera dalla nuova fixture. Test "nessun consumer vecchio" in `tests/no-legacy-consumers.test.ts` con caso rosso (tmp con `bg-mis-primary`) e verde; le occorrenze reali sono 0. Conseguenza documentata: `validate:recipe -- Badge` da CLI fallisce (fixtureHash drift) — atteso, la 2.5 sostituisce ricetta e fixture; la CI non la lancia. Nota: pnpm inolra `--` come argomento letterale, il comando corretto è `pnpm --filter @penpot-ds/scripts run generate:theme --live`.
- **Task 9**: `check-boundaries.mjs` di `scripts` rifattorizzato sullo schema di `contracts` (`checkBoundaries({ packageRoot })` esportata, `.d.mts`, guardia di invocazione diretta), regola allargata SOLO a `@app/contracts` (traversate `..` vietate), backstop raw anti-desync conservato. Prova rosso/verde in `tests/check-boundaries.test.ts` (su tmpdir): verdi `@app/contracts` + package reale; rossi `@app/domain`, `@app/contracts/../domain`, `@penpot-ds/ui`, `apps/web`. Gli altri quattro check dell'Epic 1 restano senza test proprio (action item open). `"@app/contracts": "workspace:*"` aggiunto alle dependencies + `pnpm install`.
- **Task 10**: suite offline completa — `library-plan.test.ts` (7 casi), `verify-library.test.ts` (verde + 17 casi rossi, uno per regola), `contrast.test.ts` (6), `library-reader.test.ts` (10: envelope, malformati, timeout), `penpot-writer.test.ts` (7, incluso il test che ogni step generato compila), `new-catalog.test.ts` (3), `no-legacy-consumers.test.ts` (3), `check-boundaries.test.ts` (9). La mascheratura del token resta in `mcp-client.ts` (già testata lì): reader e writer non stampano mai l'endpoint. `pnpm install`, `check-types`, `lint`, `test` (6/6 task) e `build` (16/16) verdi a livello repo.
- **Task 11**: README di `scripts` aggiornato (3 comandi `*:library` live/mai in CI, spec/seed/design, fixture legacy fino alla 2.5, nota binding aggiornata); `deferred-work.md` (hex-match risolto, dark mode aggiornato, 5 token tracking superata, nuove voci warning 4.44:1 e applyToken/fontFamilies); action item "BMad Builder + penpot-ds" → done in `sprint-status.yaml`.
- **API Penpot scoperte in questa story** (per la 2.5): `variants.currentValues(prop)` vuole il NOME della proprietà, non l'indice; le board nuove nascono con fill bianco di default (va rimosso se non legato); `applyToken` non supporta `fontFamilies`; gli errori di `execute_code` arrivano come testo non-JSON con `isError` undefined (sempre validare l'envelope).

### File List

- `_bmad-output/implementation-artifacts/2-4-bootstrap-della-library-penpot-sui-contratti.md` (questo file)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/scripts/package.json` (+ `@app/contracts`, script `bootstrap:library`/`add:library`/`verify:library`)
- `packages/scripts/tsconfig.json` (include `tests/**`)
- `packages/scripts/scripts/check-boundaries.mjs` (rifattorizzato, `@app/contracts` ammesso)
- `packages/scripts/scripts/check-boundaries.d.mts` (NUOVO)
- `packages/scripts/tests/check-boundaries.test.ts` (NUOVO)
- `packages/scripts/tests/no-legacy-consumers.test.ts` (NUOVO)
- `packages/scripts/src/library/library-spec.ts` (NUOVO)
- `packages/scripts/src/library/library-spec.test.ts` (NUOVO)
- `packages/scripts/src/library/semantic-tokens.seed.json` (NUOVO)
- `packages/scripts/src/library/library-plan.ts` (NUOVO)
- `packages/scripts/src/library/library-plan.test.ts` (NUOVO)
- `packages/scripts/src/library/library-snapshot.ts` (NUOVO)
- `packages/scripts/src/library/library-reader.ts` (NUOVO)
- `packages/scripts/src/library/library-reader.test.ts` (NUOVO)
- `packages/scripts/src/library/verify-library.ts` (NUOVO)
- `packages/scripts/src/library/verify-library.test.ts` (NUOVO)
- `packages/scripts/src/library/contrast.ts` (NUOVO)
- `packages/scripts/src/library/contrast.test.ts` (NUOVO)
- `packages/scripts/src/library/penpot-writer.ts` (NUOVO)
- `packages/scripts/src/library/penpot-writer.test.ts` (NUOVO)
- `packages/scripts/src/library/library-cli.ts` (NUOVO)
- `packages/scripts/src/library/new-catalog.test.ts` (NUOVO)
- `packages/scripts/src/library/designs/badge.design.json` (NUOVO)
- `packages/scripts/src/library/designs/input.design.json` (NUOVO)
- `packages/scripts/src/library/designs/accordion-item.design.json` (NUOVO)
- `packages/scripts/src/__fixtures__/penpot-catalog.json` (SOSTITUITA dalla nuova library, via --live)
- `packages/scripts/src/__fixtures__/legacy-mis-catalog.json` (NUOVO: vecchio catalogo per i test)
- `packages/scripts/src/theme-generator.test.ts` (fixture legacy + drift guard sulla corrente)
- `packages/scripts/src/validate-recipe.test.ts` (fixture legacy)
- `packages/scripts/src/component-reader.test.ts` (fixture legacy)
- `packages/tokens/src/tailwind-theme.css` (RIGENERATO)
- `packages/tokens/src/tokens.generated.ts` (RIGENERATO)
- `skills/pds-bootstrap/SKILL.md` (NUOVO)
- `skills/pds-additive/SKILL.md` (NUOVO)
- `skills/pds-setup/` (NUOVO: SKILL.md, assets/module.yaml, assets/module-help.csv, scripts/)
- `.claude/skills/pds-bootstrap/`, `.claude/skills/pds-additive/`, `.claude/skills/pds-setup/` (installate)
- `.agents/skills/pds-bootstrap/`, `.agents/skills/pds-additive/`, `.agents/skills/pds-setup/` (installate)
- `.opencode/commands/pds-*.md` (installate)
- `_bmad/config.yaml` (sezione pds), `_bmad/module-help.csv` (3 righe pds), `_bmad/_config/*` (manifest/help/skill rigenerati dall'installer), `_bmad/config.user.yaml` (nuovo), `_bmad/core/*` (ripristinati dall'installer)

## Change Log

- 2026-09-12: story creata con create-story. Ho analizzato epics (Epic 2), sprint change proposal 2026-09-12, spine (AD-3/5/11), penpot-pipeline, design-system, forge e memlog, story 2.3 (codice di `@app/contracts`), 2.2, deferred-work, pipeline token (`theme-generator`, `penpot-reader`, `generate-theme`, `mcp-client`), gate di `scripts` e test che dipendono dalla fixture `mis`. Ho letto le API Penpot dall'MCP. Il prerequisito BMad Builder/`penpot-ds` risulta non soddisfatto. Status → ready-for-dev.
- 2026-09-12: valori dei token decisi con Alessandro (palette + semantic, feedback inclusi, sfondo caldo). BMad aggiornato a 6.12.0 con `bmb` installato (`ca2055c`). Su decisione di Alessandro, la creazione del modulo `penpot-ds` (codice `pds`) entra nella story al Task 6, con le risposte al builder già scritte; il Task 0 verifica solo che il builder sia installato.
- 2026-09-12: implementazione completata (Task 0-11). Spike Task 1: `applyToken` persiste dopo reload (via primaria per la 2.5). Library "Page Builder DS" bootstrappata live: 2 set, 76 token, 3 container (12 celle), 0 variantError, 190 binding, verify verde. Rifiuti provati live (mis + Page Builder DS non vuoto) e offline. Rigenerazione token senza toccare la pipeline (AC #4), fixture legacy conservata per i test fino alla 2.5. Gate `scripts` allargato solo a `@app/contracts` con prova rosso/verde. Modulo BMad `pds` creato, validato e registrato (skill visibili a Claude Code e OpenCode). Suite repo verde: check-types, lint, test (191+ test in scripts), build. Status → review.

- 2026-09-12: story creata con create-story. Ho analizzato epics (Epic 2), sprint change proposal 2026-09-12, spine (AD-3/5/11), penpot-pipeline, design-system, forge e memlog, story 2.3 (codice di `@app/contracts`), 2.2, deferred-work, pipeline token (`theme-generator`, `penpot-reader`, `generate-theme`, `mcp-client`), gate di `scripts` e test che dipendono dalla fixture `mis`. Ho letto le API Penpot dall'MCP. Il prerequisito BMad Builder/`penpot-ds` risulta non soddisfatto. Status → ready-for-dev.
- 2026-09-12: valori dei token decisi con Alessandro (palette + semantic, feedback inclusi, sfondo caldo). BMad aggiornato a 6.12.0 con `bmb` installato (`ca2055c`). Su decisione di Alessandro, la creazione del modulo `penpot-ds` (codice `pds`) entra nella story al Task 6, con le risposte al builder già scritte; il Task 0 verifica solo che il builder sia installato.
