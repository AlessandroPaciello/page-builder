---
baseline_commit: ff52ff5
---

# Story 2.4: Bootstrap della library Penpot sui contratti

Status: ready-for-dev

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

- [ ] **Task 0: Gate dei prerequisiti (AC: tutti). Va fatto prima di scrivere codice.**
  - [ ] Verifica che BMad Builder sia installato: `bmb` in `_bmad/_config/manifest.yaml`, skill `bmad-workflow-builder` e `bmad-module-builder` presenti in `.claude/skills/`, cartella di output `bmb.bmad_builder_output_folder = {project-root}/skills` in `_bmad/config.toml`. Se manca, **HALT**. Il modulo `penpot-ds` **non** si crea qui ma nel Task 6, perché il builder impacchetta skill già scritte.
  - [ ] Verifica l'ambiente live: stack Penpot attivo (`docker/penpot`, `http://localhost:9001`), `PENPOT_MCP_TOKEN` impostata, plugin MCP connesso. Usa Node 22 (`nvm use 22.23.1`): con Node 20 il postinstall di `packages/db` fallisce.
  - [ ] Chiedi ad Alessandro (o crea con il suo ok) un **file Penpot nuovo e vuoto** per la library, ad esempio "Page Builder DS", e connettici il plugin. **Non** usare "Nuovo File 4" (il prototipo del forge, che ha già token e container `badge@1`/`input@1`/`accordion-item@1`) né il file della library `mis`: servono entrambi come casi rossi del rifiuto (Task 7).
- [ ] **Task 1: Spike di persistenza del binding (rischio aperto, deferred-work "hex-match")**
  - [ ] Sul file nuovo, via `execute_code`: crea un set e un token colore, una board con un fill, e poi `shape.applyToken(token, ["fill"])`. Aspetta circa 100 ms e leggi `shape.tokens`. Poi **ricarica il file** (chiudi e riapri il file, riconnetti il plugin) e rileggi `shape.tokens`.
  - [ ] Ci sono due note in contrasto. Quella della Story 2.2 dice "`applyToken` headless non persiste". Il forge, il 2026-09-11 su "Nuovo File 4", ha legato fill/padding/radius/fontSize. **Se dopo il reload il binding non persiste, HALT (decision-needed)**: senza binding persistente AC #1 ("token legati") non è verificabile. Scrivi l'esito nelle Completion Notes e aggiorna la voce "hex-match" in `deferred-work.md`: se il binding persiste, `shape.tokens` diventa la via primaria per la Story 2.5.
  - [ ] Pulisci il file dopo lo spike (rimuovi token e board). Il bootstrap rifiuterebbe un file "sporco".
- [ ] **Task 2: Specifica della library, come dati (AC: #1, #3)**
  - [ ] `packages/scripts/src/library/library-spec.ts` definisce l'**elenco minimo dei token semantici richiesti**, in stile shadcn (principio guida di `penpot-pipeline.md`), con il nome Penpot e il tipo. I nomi sono scelti perché `varSuffix()` (Stadio 1) produca variabili pulite, senza toccare il generatore: `color.primary` → `--color-primary`/`bg-primary`, `text.sm` → `--text-sm`, `font.sans` → `--font-sans`, `shadow.ring` → `--shadow-ring`, `opacity.disabled` → `--opacity-disabled`. Il minimo richiesto è:
    - **color**: `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input`, `ring`, e i feedback `success`, `success-foreground`, `warning`, `warning-foreground`, `info`, `info-foreground` (decisione di Alessandro del 2026-09-12: servono a LifecycleBadge e ai toast, UX-DR2);
    - **radius**: `radius.sm`, `radius.md`, `radius.lg`, `radius.full`;
    - **spacing**: una scala `spacing.*`;
    - **tipografia**: `text.*` (fontSizes), `font-weight.*`, `font.sans`, e `tracking.*` con unità esplicita (`px`/`em`), perché il generatore rifiuta i bare number;
    - **border-width**: `border-width.default`;
    - **opacity**: `opacity.disabled`;
    - **shadow**: `shadow.ring` (l'anello di focus del forge: spread 3 che referenzia `{color.ring}`) più almeno `shadow.sm`.
  - [ ] **Coppie di contrasto** dichiarate nella spec: ogni `X` / `X-foreground` e `background`/`foreground` devono avere un rapporto ≥ 4.5:1. `border`, `input` e `ring` devono avere ≥ 3:1 contro `background`. È il vincolo non negoziabile di `design-system.md`, che la memoria della Story 2.1 ha dimostrato violabile (il bug `border` 1.5:1). Qui diventa un controllo meccanico, non una revisione a occhio.
  - [ ] `packages/scripts/src/library/semantic-tokens.seed.json` contiene i **valori del bootstrap, già decisi con Alessandro il 2026-09-12**. Sono tutti presi dal catalogo `mis` validato, nessuno è inventato. **Due set attivi**: `palette` contiene le scale e i colori raw, con i nomi sotto; `semantic` contiene i token semantici, che **referenziano** la palette (`color.primary = {accent.9}`), così il designer cambia un colore in un punto solo. Il generatore gestisce già i riferimenti tra token dello stesso tipo. Nomi dei token palette senza collisioni con i semantici dopo `varSuffix` (per esempio `gray.1` → `--color-gray-1`, `color.primary` → `--color-primary`). La collisione la verifica comunque `generateTheme()`.

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
  - [ ] Riferimenti tra token ammessi (`{color.ring}` dentro `shadow.ring`), ma solo quelli compatibili con le regole di `theme-generator.ts` (stesso tipo, oppure tipi numerici tra loro). Il verificatore li valida con `generateTheme()` stesso (Task 4), senza reimplementarle.
- [ ] **Task 3: Piano di bootstrap/additiva, funzione pura (AC: #1, #2)**
  - [ ] `packages/scripts/src/library/library-plan.ts`: `planLibrary({ mode: "bootstrap" | "additive", contracts, spec, seed, snapshot }) → { refused?: string; operations: Operation[]; differences: Difference[] }`. Non fa I/O e non chiama MCP.
    - **bootstrap**: se lo `snapshot` ha **almeno un set di token o almeno un componente** in `library.local`, restituisce `refused` con un motivo che nomina cosa ha trovato, e `operations: []`. Altrimenti produce, in ordine deterministico: set `palette` e `semantic` attivi, poi i token (prima la palette, poi i semantici che la referenziano), poi un container per contratto.
    - **additive**: crea solo i token mancanti e i container dei contratti che non hanno ancora un container legato via plugin data. Per ciò che esiste ma diverge produce `differences` e **nessuna** operazione: valore di un token diverso dal seed, assi o valori di un container diversi dal contratto, plugin data con versione diversa, nome incoerente. Ogni differenza nomina token/contratto, atteso e trovato. Mai operazioni di update o delete: il tipo `Operation` non ha varianti per farle, così l'invariante è garantito dal tipo e non dalla disciplina.
  - [ ] **Container per contratto**: il nome è il PascalCase del contratto (`badge` → `Badge`, `accordion-item` → `AccordionItem`). Le proprietà di variante sono gli assi del contratto **nell'ordine del contratto**, con i nomi degli assi del contratto (`variant`, `size`, `state`). Le celle sono il prodotto cartesiano completo dei valori (Badge 3×2 = 6; Input 4; AccordionItem 2). Tutti e tre i tipi d'asse (`option`/`state`/`behavior`) sono disegnati come varianti (AD-11): il tipo **non** va scritto in Penpot.
  - [ ] **Parti**: ogni cella contiene layer nominati come le `parts` del contratto (`root` = la board della cella). L'annidamento geometrico è libero, perché è layout: in AccordionItem `label`/`chevron` stanno dentro `trigger` e `body` dentro `content`, come nel prototipo del forge. È ciò che la Story 2.5 leggerà.
  - [ ] **Stile per cella**: ogni proprietà di stile di ogni parte è un'applicazione di token (`fill`, `strokeColor`, `strokeWidth`, `borderRadius*`, `padding*`, `rowGap`/`columnGap`, `fontSize`, `fontWeight`, `fontFamilies`, `letterSpacing`, `opacity`, `shadow`), mai un literal senza binding. La mappatura ruolo → token per cella (per esempio Badge `destructive` → `root.fill = color.destructive`, `label.fill = color.destructive-foreground`; Input `focus` → `root.shadow = shadow.ring`; Input `disabled` → `root.opacity = opacity.disabled`; AccordionItem `divider.strokeColor = color.border`) sta in un file dati per contratto, `packages/scripts/src/library/designs/<contratto>.design.json`. È il disegno di partenza: il designer poi lo cambia in Penpot. Il test verifica che ogni cella di ogni contratto sia coperta e che ogni token referenziato esista nella spec.
  - [ ] Il chevron di AccordionItem è un path: la sua geometria è libera e non viene tokenizzata (AD-11: "geometria delle icone ignorata"). Lo stroke però è legato a un token.
- [ ] **Task 4: Snapshot e verifica, lo script che decide l'esito (AC: #1, #3)**
  - [ ] `packages/scripts/src/library/library-reader.ts` legge via MCP (`execute_code`) uno **snapshot serializzabile** della library: set di token (nome, attivo) e token (nome, tipo, valore); per ogni VariantContainer il nome, `variants.properties`, i valori per proprietà (`currentValues`), le celle (`variantProps`, `variantError`), il plugin data `getSharedPluginData("pagebuilder", "contract")` e, per ogni cella, l'albero dei layer con nome, proprietà di stile valorizzate e `shape.tokens`. Riusa `callPenpotTool`/`withTimeout`/`isTextContent` di `mcp-client.ts` e lo stile di validazione dell'envelope di `penpot-reader.ts`: errori che nominano il campo malformato. Il plugin data sta **sul VariantContainer**, non sull'istanza (forge).
  - [ ] `packages/scripts/src/library/verify-library.ts`: `verifyLibrary({ contracts, spec, snapshot }) → { ok: boolean; errors: string[] }`, **pura**. Fallisce, e ogni errore nomina contratto/cella/layer/token, se:
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
  - [ ] Un container senza plugin data `pagebuilder` è un **errore solo se il suo nome coincide con quello di un contratto**. Container estranei (i segnaposto della Story 2.7, ad esempio) non sono affar suo.
  - [ ] **Struttura testabile**, lezione della Story 2.2 Round 4: funzioni esportate, e CLI dietro la guardia `isDirectInvocation` (vedi `extract-component.ts`).
- [ ] **Task 5: Scrittura su Penpot ed entry CLI (AC: #1, #2, #3)**
  - [ ] `packages/scripts/src/library/penpot-writer.ts` traduce le `Operation` in codice `execute_code`, **un'operazione per chiamata** oppure a lotti piccoli, così un errore nomina l'operazione fallita. API da usare (verificate con `high_level_overview` il 2026-09-12):
    - `penpot.library.local.tokens.addSet({ name, active: true })`, `set.addToken({ type, name, value })`;
    - board e parti con flex layout (`board.addFlexLayout()`) e `penpot.library.local.createComponent([board])` per ogni cella;
    - `penpotUtils.createVariantContainer([{ shape, properties }...])`, **non** la sequenza a basso livello;
    - `shape.applyToken(token, [prop])`, che è **asincrono**: aspetta circa 100 ms prima di rileggere;
    - `container.setSharedPluginData("pagebuilder", "contract", contractId(c))`.
    
    Scrivi i valori colore hex **in maiuscolo** (convenzione dell'API).
  - [ ] `packages/scripts/src/library/library-cli.ts` e script in `package.json`:
    - `bootstrap:library`: legge lo snapshot, poi `planLibrary(bootstrap)`. Se è `refused` esce con 1 senza scrivere nulla. Altrimenti esegue le operazioni, rilegge lo snapshot, lancia `verifyLibrary` ed esce con 1 se fallisce.
    - `add:library`: `planLibrary(additive)`. Stampa le `differences` (**exit 0**: segnalare non è un errore), esegue solo le operazioni di creazione e poi verifica.
    - `verify:library`: sola lettura. Snapshot, poi `verifyLibrary`, poi exit code.
    - Opzione `--dry-run` su bootstrap/additiva: stampa il piano senza scrivere.
    
    **Mai** in CI né in build: sono comandi live come `extract:component`, e vanno documentati così.
  - [ ] Offline, `verify:library` può girare su uno snapshot salvato (`--snapshot <path>`). È il seam dei test, e permette alla Story 2.5/2.6 di riusarlo.
- [ ] **Task 6: Il modulo `penpot-ds` e le sue skill (AC: #1, #2, #3)**
  - [ ] **6a. Scrivi le skill** con `bmad-workflow-builder` (build a workflow) nella cartella di output del builder, `skills/` alla root del repo: `skills/pds-bootstrap/` e `skills/pds-additive/`, ciascuna con `SKILL.md`. Per il prefisso: il builder usa il codice del modulo nel nome delle skill. Sono due workflow sottili: **bootstrap** e **additiva**. Il loro compito è guidare e fare domande: conferma del file Penpot connesso, revisione dei valori del seed e dei `design.json` con il designer, lancio del `--dry-run`, conferma, lancio del comando, lettura dell'esito. **Il pass/fail lo decide l'exit code di `verify:library`**. Il prompt non contiene criteri di successo propri (AD-11: "pass/fail sta negli script e negli schemi, mai nel prompt"). Una skill non chiama mai `execute_code` per scrivere al di fuori dei comandi CLI.
  - [ ] La skill additiva, per le differenze, **riporta e basta**. Non propone correzioni automatiche: sistemarle è del designer in Penpot o di un cambio esplicito di contratto.
  - [ ] **6b. Impacchetta il modulo** con `bmad-module-builder` in modalità **create module**, sulla cartella `skills/`. Ci sono due skill, quindi il builder genera una **skill di setup dedicata** (`skills/pds-setup/`, tramite `scripts/scaffold-setup-skill.py`) e non l'approccio standalone. Risposte già decise, da dare senza chiedere ad Alessandro:
    - **Nome del modulo**: `Penpot DS`. **Codice**: `pds` (il builder vuole 2-4 lettere: `penpot-ds` è il nome concettuale usato nei documenti). **Versione**: `1.0.0`. **Tipo**: standalone, non un'espansione di `bmm`.
    - **Descrizione**: "Allinea la library Penpot ai contratti del page builder: bootstrap una tantum e aggiunte successive, con esito deciso dagli script di `packages/scripts`."
    - **Capability** (`module-help.csv`): `[PB] Bootstrap library` → `pds-bootstrap`, phase `anytime`, `required: false`. `[PA] Aggiunta additiva` → `pds-additive`, `after: pds-bootstrap:bootstrap`. `[SU] Setup` → `pds-setup`. `outputs`: "library Penpot verificata (`verify:library` verde)".
    - **Variabili di config**: nessuna. Endpoint e token vengono da `PENPOT_MCP_URL`/`PENPOT_MCP_TOKEN`, mai dalla config del modulo.
    - **Dipendenze esterne** (step 5 del builder): server MCP Penpot raggiungibile e plugin connesso. La skill di setup si limita a controllare che siano presenti e rimanda al README (`#penpot-locale-e-server-mcp`), senza installare nulla.
    - **Greeting**: "Modulo Penpot DS pronto. Apri il file Penpot, connetti il plugin MCP e lancia [PB] (bootstrap) oppure [PA] (additiva)."
  - [ ] **6c. Valida e registra**: `python3 .claude/skills/bmad-module-builder/scripts/validate-module.py skills/` deve essere verde. Poi esegui `pds-setup` per registrare il modulo (config e voci nell'help di BMad). **Verifica** che `bmad-help` elenchi `[PB]`/`[PA]` e che le skill `pds-*` siano visibili a Claude Code e OpenCode. Se la skill di setup non le copia in `.claude/skills/` e `.agents/skills/`, segui il meccanismo indicato da `assets/setup-skill-template/SKILL.md` o dall'installer (`npx bmad-method install --custom-source ./skills`). Documenta nelle Completion Notes quale meccanismo hai usato. **Non** copiare a mano file nelle cartelle rigenerate dall'installer senza un meccanismo che le reinstalli.
- [ ] **Task 7: Esecuzione live e prove di rifiuto (AC: #1, #2, #3)**
  - [ ] Sul file nuovo: `bootstrap:library --dry-run`, poi `bootstrap:library`, con `verify:library` verde. Esporta almeno una cella per contratto (`export_shape`) e controlla a occhio che la resa sia sensata. È un controllo cosmetico: non decide l'esito.
  - [ ] **Rosso di AC #2**: `bootstrap:library` su "Nuovo File 4" e sul file della library `mis` deve **rifiutare** con exit 1 e zero scritture. Confronta il numero di set e di componenti prima e dopo.
  - [ ] **Additiva**: rilanciare `add:library` sul file appena creato non produce operazioni (idempotenza). Poi cambia a mano in Penpot il valore di un token: `add:library` deve riportare la differenza senza correggerla, e lo verifichi rileggendo il valore. **Ripristina il valore** alla fine.
  - [ ] Scrivi gli esiti con i numeri (container, celle, token, binding) nelle Completion Notes.
- [ ] **Task 8: Rigenerazione token sulla nuova library (AC: #4)**
  - [ ] Con il plugin sul file nuovo, lancia `pnpm --filter @penpot-ds/scripts generate:theme -- --live`. **Nessuna modifica** a `theme-generator.ts`, `penpot-reader.ts` e `generate-theme.ts`. Se il generatore rifiuta il catalogo, si correggono i **token** (seed + Penpot), non il generatore. Il risultato è `src/__fixtures__/penpot-catalog.json` sostituita e `packages/tokens/src/tailwind-theme.css`/`tokens.generated.ts` rigenerati con nomi semantici (`--color-primary`…). `tailwind-extras.css` non si tocca.
  - [ ] **Conserva il vecchio catalogo per i test**: prima della rigenerazione copia la fixture attuale in `src/__fixtures__/legacy-mis-catalog.json` e ripunta lì i test che dipendono dai nomi `mis`, cioè `theme-generator.test.ts` (asserzioni su set `mis.*` e `--color-mis-border`), `validate-recipe.test.ts` (valida la `badge.recipe.json` con classi `bg-mis-*`) e `component-reader.test.ts`. È un cambio **dei test**, non della pipeline, e tiene verdi gli 88+ test finché la Story 2.5 non sostituisce ricetta e fixture Badge. Aggiungi a `theme-generator.test.ts` un test che genera anche dalla **nuova** fixture e verifica almeno `--color-primary`, `--color-ring` e `--shadow-ring`.
  - [ ] Conseguenza da documentare (README di `scripts` e Completion Notes): `validate:recipe -- Badge` da CLI ora fallisce contro il nuovo vocabolario. È atteso, perché la ricetta Badge è l'unica eccezione tollerata da AC #4 e la sostituisce la 2.5. La CI non la lancia.
  - [ ] **Verifica "nessun consumer vecchio"**: un test in `packages/scripts` (o un piccolo script) scansiona `packages/ui/src` e `apps/web/src` (non `packages/tokens`, che è l'eccezione ammessa da AC #4) e fallisce se trova `mis-` o `mis.` in classi o variabili. Deve avere un caso rosso (un file tmp con `bg-mis-primary`) e uno verde. Oggi le occorrenze sono zero, come verificato dal correct-course. Il test impedisce che ricompaiano.
- [ ] **Task 9: Confine di `packages/scripts` (AC: #3), perché la verifica deve leggere i contratti**
  - [ ] `packages/scripts/scripts/check-boundaries.mjs` vieta **tutti** gli `@app/*` in `src/`. Allarga la regola **solo** a `@app/contracts`: `@app/*` diverso da `contracts` resta vietato, così come `@penpot-ds/ui` e `apps/*`. Poi aggiungi `"@app/contracts": "workspace:*"` alle `dependencies` e fai `pnpm install`. Il layering lo ammette: `contracts` è una foglia senza dipendenze UI, e la pipeline ne è un consumer (penpot-pipeline.md, Stadio 2).
  - [ ] Poiché cambi la regola di un gate, dagli la **prova rosso/verde automatica** chiesta dall'action item Epic 1. Rifattorizza il check con lo schema del gate di `@app/contracts` (funzione `checkBoundaries({ packageRoot })` esportata, `.d.mts`, guardia di invocazione diretta) e aggiungi `packages/scripts/tests/check-boundaries.test.ts` (su tmpdir). Casi verdi: `@app/contracts` e il package reale. Casi rossi: `@app/domain`, `@app/contracts/../domain`, `@penpot-ds/ui`, `apps/web`. Non estendere il lavoro agli altri quattro check: l'action item resta open per quelli.
  - [ ] Nota su vitest: in `packages/scripts` i test stanno in `src/*.test.ts`. Se aggiungi `tests/`, controlla che vitest li trovi (i default includono `**/*.test.ts`) e che `tsconfig.json` li includa per `check-types`.
- [ ] **Task 10: Test (AC: #1, #2, #3)**. Tutti offline, deterministici, con il transport MCP mockato (seam `callTool`, come in `component-reader.test.ts`).
  - [ ] `library-plan.test.ts`:
    - bootstrap su snapshot vuoto → operazioni complete, in ordine stabile (snapshot del piano o asserzioni esplicite);
    - bootstrap con un set presente → `refused` e 0 operazioni;
    - bootstrap con un componente presente → `refused`;
    - additiva idempotente → 0 operazioni;
    - additiva con un contratto nuovo nel registry (fittizio, iniettato come parametro `contracts`) → crea solo quel container;
    - additiva con un token di valore diverso → 1 differenza e 0 operazioni;
    - container con un asse in più → differenza.
  - [ ] `verify-library.test.ts`: uno snapshot **verde** (costruito da un helper) e poi **un caso rosso per ciascuna delle 10 regole** del Task 4, con l'asserzione sul messaggio che nomina l'elemento. È la prova rosso/verde di AC #3: se un caso rosso passa, il gate è rotto, non il test.
  - [ ] `contrast.test.ts`: coppie note, per esempio `#000`/`#FFF` = 21:1, e il caso `border` 1.5:1 della memoria 2.1 sotto soglia.
  - [ ] `penpot-writer.test.ts` / `library-reader.test.ts`: il codice generato contiene le API attese, l'envelope malformato fallisce loud, il timeout viene propagato e il token non compare nei messaggi (maschera `userToken=***`, stile di `mcp-client`).
  - [ ] `pnpm install`, `pnpm check-types`, `pnpm lint`, `pnpm test` e `pnpm build` verdi **a livello repo**. I test di `@app/db`/`@app/auth` richiedono `pnpm db:start`.
- [ ] **Task 11: Documentazione e chiusura**
  - [ ] `packages/scripts/README.md`: i tre comandi `*:library` (live, mai in CI), la spec/seed/design, il vecchio catalogo tenuto per i test fino alla 2.5, l'aggiornamento della nota "binding hex-match" in base all'esito del Task 1.
  - [ ] `deferred-work.md`:
    - aggiorna la voce "hex-match" con l'esito del Task 1;
    - aggiorna la voce "dark mode" (la nuova library ha i set `palette` + `semantic`, niente themes: la voce resta aperta); aggiungi la voce "testo warning su background 4.44:1, serve un tono più scuro dal designer";
    - chiudi la voce "correzione 5 token tracking nell'UI di Penpot" come **superata**, perché la library `mis` non è più la sorgente;
    - aggiungi solo ciò che rimandi davvero.
  - [ ] `sprint-status.yaml`: action item "BMad Builder + `penpot-ds`" → `done` quando il Task 6 è verde (modulo validato e skill visibili).

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-09-12: story creata con create-story. Ho analizzato epics (Epic 2), sprint change proposal 2026-09-12, spine (AD-3/5/11), penpot-pipeline, design-system, forge e memlog, story 2.3 (codice di `@app/contracts`), 2.2, deferred-work, pipeline token (`theme-generator`, `penpot-reader`, `generate-theme`, `mcp-client`), gate di `scripts` e test che dipendono dalla fixture `mis`. Ho letto le API Penpot dall'MCP. Il prerequisito BMad Builder/`penpot-ds` risulta non soddisfatto. Status → ready-for-dev.
- 2026-09-12: valori dei token decisi con Alessandro (palette + semantic, feedback inclusi, sfondo caldo). BMad aggiornato a 6.12.0 con `bmb` installato (`ca2055c`). Su decisione di Alessandro, la creazione del modulo `penpot-ds` (codice `pds`) entra nella story al Task 6, con le risposte al builder già scritte; il Task 0 verifica solo che il builder sia installato.
