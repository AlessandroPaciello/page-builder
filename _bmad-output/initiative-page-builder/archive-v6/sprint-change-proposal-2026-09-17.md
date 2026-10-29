---
workflow: bmad-correct-course
date: 2026-09-17
author: Alessandro (con agente Developer)
mode: incrementale
scope: Moderate
status: approved
trigger: SPEC "Pipeline Penpot→codice v2" (forge 2026-09-16, `_bmad-output/specs/spec-refactor-packages-scripts/`) — il modello v1 si ferma sulla ProductCard in cinque punti che stanno nel vocabolario del contratto, non negli script
supersedes: nessuna — si aggiunge a `sprint-change-proposal-2026-09-15.md` (Epic 2); rivede AD-11 (2026-09-12, 2026-09-15)
---

# Sprint Change Proposal — Pipeline Penpot→codice v2

## 1. Sintesi del problema

**Trigger.** Chiusa la Story 2.10 (PR #43), la forge del 2026-09-16 ha provato il modello v1 sul primo caso davvero composito, la **ProductCard** (immagine, prezzo, descrizione, tag ripetuti, link, badge sconto solo in alcune varianti). Si ferma in cinque punti: nessun ruolo `image`, nessuna parte opzionale per variante, nessuna parte ripetibile, field solo come testo di una parte, nessuna composizione. Nessuno dei cinque sta in `packages/scripts`: stanno nel **vocabolario del contratto** (AD-11). Riscrivere gli script per leggibilità — l'idea di partenza della forge — lascerebbe la card bloccata sulle stesse cinque righe.

**Tipo.** Limite di modello scoperto esercitando la pipeline su un caso reale. Non un errore di implementazione: le Story 2.1–2.10 hanno fatto quello che dicevano.

**Evidenza.** `forge/refactor-packages-scripts/simulazione-card.md` (la card scritta a mano nel modello v2), `specs/spec-refactor-packages-scripts/SPEC.md` (CAP-1…11, constraint, non-goal), `extraction-contract.md`, `commands.md`, `migration.md`. Nessuna pagina salvata usa ancora i contratti: cambiare il fingerprint **oggi costa zero**.

**Cosa chiede lo SPEC v2 a questo correct-course.** Testualmente: «la revisione formale di AD-11, di Story 2.11 e 2.12 passa da un correct-course prima della prima story».

**La v2 in una riga.** Due contratti con dipendenza in un verso solo (page builder in `@app/contracts`, nel fingerprint; estrazione in `packages/scripts`, che lo importa), una sola istantanea generata da `extract`, un registro unico, sei comandi con un guscio e un tipo di errore, primitivi headless Base UI al posto delle basi shadcn. La v1 resta intatta e verde finché la card non passa; poi si cancella e i quattro componenti rinascono.

## 2. Analisi d'impatto

### Epic

| Epic | Impatto |
|---|---|
| 2 | **Da 12 a 18 story.** L'outcome resta; il regime cambia nel mezzo. 2.1–2.10 restano come storia (v1). Storybook (ex 2.12) **anticipato a 2.11** perché CAP-10 richiede il giudizio visivo in Storybook. Nuove 2.12–2.17 per CAP-1…11. Libreria (ex 2.11) → **2.18**. |
| 3 | Nessun impatto sostanziale: parla a `@app/contracts` e `@penpot-ds/ui`, entrambi conservati. Il contratto ridotto (solo assi `option`, field, slot) è anzi esattamente ciò che i blocchi Puck consumano. |
| 4–6 | Nessun impatto. La ProductCard anticipa il vocabolario di FR15 senza toccarne le story. |

### Artefatti

- **Spec-kernel (`spec-page-builder`):** nessun conflitto con le CAP; MVP invariato. Due righe lessicali (`SPEC.md:112` "base shadcn", `design-system.md:16/:31` "headless Radix", "fixture → ricetta → emitter") da allineare.
- **`penpot-pipeline.md`:** Stadio 0 e 1 restano validi; **Stadio 2 interamente superato** dalla v2, ma **in servizio** finché la v1 gira. Convivenza esplicita.
- **Architecture:** **AD-11** riscritta (tre cambi di sostanza: ownership in due contratti, un'istantanea al posto di tre artefatti, nessuna base di libreria). Ricadute in AD-3 (`:102` Radix), AD-5 (`:114` tipi di asse), albero del repo (`:236`, `:242-245`), deferred "seconda libreria" (`:280`).
- **`epics.md`:** FR2, NFR6, bullet AD-3/AD-11, blurb e overview di Epic 2; Story 2.11–2.18.
- **UX (`ux-designs`, `a11y-baseline`):** N/A nella sostanza — requisiti di risultato, indifferenti all'headless. Base UI deve reggerli: l'AccordionItem è la verifica pratica (2.16).
- **CI/CD:** convivenza `gates:render` (v1) e `gates` (v2) dalla 2.15 alla 2.16; `extract`/`render` non girano mai in CI.
- **Tracciamento:** `sprint-status.yaml` (2.10 → done, 8 chiavi nuove), due action item della retro Epic 1, una voce di registro in `deferred-work.md`.

### Impatto tecnico

- `@app/contracts`: fingerprint ridotto e `SCHEMA_VERSION` +1 **una volta** (2.12); `parts`/`partRoles`/assi `state`-`behavior` tollerati come **estensione deprecata fuori dal fingerprint** fino alla 2.16, poi cancellati senza nuovo bump. È la lettura di CAP-1 che tiene insieme «`SCHEMA_VERSION` sale una volta» e «la v1 resta intatta» (decisione di Alessandro, 2026-09-17).
- `packages/scripts`: `src/v2` accanto alla v1, poi appiattito in `src`; `data/components/<nome>.json` sostituisce fixture, ricetta, judgment, binding, design, base.
- `packages/ui`: quattro componenti cancellati e rigenerati; `shadcn`, `radix-ui`, `@radix-ui/react-accordion` escono; entra `@base-ui/react`.
- `apps/web`: nessun consumatore dei quattro componenti oggi (Epic 3 non iniziata); da ricontrollare nella finestra della 2.16.
- Skill `pds-*`: riscritte sui sei comandi (2.17).

## 3. Approccio raccomandato

**Opzione 1 — Direct Adjustment** (scelta). Effort **Alto**, rischio **Medio**, timeline: Epic 2 si allunga di sei story; Epic 3–6 non si spostano di posto né di contenuto.

- **Rollback (Opzione 2): non viable.** 2.1–2.10 sono mergiate e la v1 serve *funzionante* durante la transizione. Il piano non è un rollback: è cancella-e-rigenera, *dopo* la prova sulla card.
- **MVP Review (Opzione 3): non necessaria.** Nessuna CAP dello spec-kernel cambia, nessun FR esce.

**Perché ora.** Zero pagine salvate → cambiare il fingerprint costa zero; la libreria dei sei domini (2.18) moltiplicherebbe per venti il costo di farlo dopo.

**Rischi e mitigazioni.**
- *Base UI non regge un requisito a11y che Radix reggeva* → l'AccordionItem è rigenerato per ultimo nella 2.16 come verifica pratica; il gate axe e le prove rosso/verde sono le stesse della v1.
- *Finestra senza i quattro componenti* → nessun consumatore oggi; controllo esplicito in 2.16.
- *Due pipeline in CI* → per una sola finestra (2.15 → 2.16), entrambe a diff zero.
- *Skill che citano comandi morti* → `grep` a zero come AC della 2.17.

## 4. Proposte di modifica dettagliate (approvate in modalità incrementale)

### 4.1 `ARCHITECTURE-SPINE.md` — AD-11 riscritta alla v2 (proposta 1, approvata; sostituzione sul posto con nota di revisione)

**Titolo**

```
OLD: ### AD-11 — Il contratto è del page builder, Penpot disegna valori e aspetto; il giudizio si congela in ricette, il codice è funzione pura [ADOPTED, rivisto 2026-09-12]
NEW: ### AD-11 — Due contratti, una istantanea, un registro: il page builder possiede il vocabolario, l'estrazione possiede la lettura di Penpot e il render [ADOPTED, rivisto 2026-09-17 — v2, supera il regime fixture/ricetta/emitter]
```

**Regola — testo nuovo integrale**

- **Binds:** CAP-1, CAP-2, CAP-3, CAP-4.
- **Prevents:** valori di design inventati a mano; drift design↔codice; componenti generati non accessibili perché il design non esprime comportamento; generazione non riproducibile; **vocabolario delle props — e quindi le pagine salvate — legato alla libreria generata o a Penpot**; un caso di design (parte opzionale, ripetibile, immagine, albero) che blocca la pipeline perché il modello non lo sa dire.
- **Rule:**
  **Due contratti, dipendenza in un verso solo.** Il **contratto del page builder** (`@app/contracts`, AD-5, **nel fingerprint**) descrive solo ciò che l'editor e le pagine salvate usano: `name`, `version`, assi `option`, `fields` (testo, attributo, url, array), slot. Regola: ci sta solo ciò che cambia una pagina salvata o un campo dell'editor. Il **contratto di estrazione** (`packages/scripts/src/contracts/<nome>.extract.ts`, **fuori dal fingerprint**) importa il primo e dichiara come il componente si legge da Penpot e come si rende: assi `state`/`behavior`, parti con ruolo, `when` (parte presente solo per certi valori d'asse `option`), `repeat` (parte ripetuta su un field array), `parent` (albero con radice `root`), `layer`/alias, `element`, `content`/`attribute` verso i field, `headless` per parte, dominio, a11y con role per variante, container Penpot. Contraddire il contratto del page builder (field inesistente, tipo sbagliato, `when` su asse non `option`, albero senza radice o con cicli, parte senza ruolo) è errore **a module load**, che nomina parte e campo, prima di qualsiasi comando. Mai il contrario: il page builder non conosce Penpot. Una variante nuova è un cambio esplicito del contratto del page builder (`SCHEMA_VERSION`), non una scoperta nell'istantanea.
  **Tipi di asse**, dichiarati nei contratti e mai in Penpot: `option` (page builder: prop scelta in Puck → stile per variante), `state` (estrazione: browser → `hover:`/`focus-visible:`/`aria-invalid:`/`disabled:`, nessuna prop), `behavior` (estrazione: headless → `data-[state=…]:`, nessuna prop). Penpot disegna *tutti* gli assi come celle; una cella mancante è errore `contract`.
  **Ruolo di parte**, dichiarato nel **contratto di estrazione** e mai in Penpot: vocabolario chiuso `surface` · `text` · `icon` · `divider` · `image`, che dice che cosa la parte è e quindi quali proprietà porta. La tabella ruolo → proprietà ammesse vive nel **registro delle proprietà** in `packages/scripts`, unico e globale: l'unico posto dove si insegna una proprietà Penpot (token, e da v2 anche layout e posizione letti dal layer, così nessuna classe Tailwind entra a mano). `image` ammette raggio, opacità, layout, posizione e **nessun `fill`**: unica eccezione alla regola "token su ogni stile", perché il contenuto arriva dal field. Un token su una proprietà che il ruolo non ammette non passa in silenzio: si segnala per nome e si propone l'adattamento nell'ordine designer → registro (una volta per tutte) → contratto di estrazione (invariato dalla 2.10).
  **Legame componente→contratto:** SharedPluginData sul VariantContainer (`pagebuilder/contract = nome@versione`), scritto solo da `library`; il nome del container è controllo incrociato. `extract` fallisce su contratto dichiarato da due container, nome incoerente, contratto senza container.
  **Un solo artefatto generato:** l'**istantanea** `data/components/<nome>.json`, scritta solo da `extract` (tmp + rename, mai a mano), con `contract`, `provenance` (id Penpot, `readAt`, hash) e `cells[cella][parte]` = token per proprietà più layout/posizione. Validata contro i due contratti. Il suo diff in PR **è** la review del design; `extract --check` confronta Penpot live senza scrivere. `judgments/`, `bindings/`, `designs/`, `bases/`, `recipes/` e la coppia fixture+ricetta non esistono più. L'albero delle parti (`parent`) sostituisce il vincolo "profondità 1".
  **Nessuna base di libreria.** `render` genera `<Comp>.tsx`, `.test.tsx`, `.stories.tsx` e barrel — `@generated` con provenienza, a diff zero — da istantanea + contratto di estrazione + registro: `when` → render condizionale, `repeat` → `map`, `attribute` → attributo HTML, assi `state` → prefissi, `behavior` → `data-[state=…]:`, il **primitivo headless per parte** (Base UI, `headless: null` per chi non ne ha) è l'elemento della parte. Il **comportamento accessibile non è disegnabile in Penpot**: entra dal primitivo headless dichiarato nel contratto di estrazione, *input* del rendering, mai suo output. **Una sola libreria per installazione**: una seconda (es. MUI) è un altro contratto di estrazione sugli stessi contratti del page builder.
  **Sei comandi, un guscio, un errore:** `theme`, `library`, `extract`, `render`, `gates`, `propose`; `ScriptError { kind, component?, cell?, part?, detail }` con exit `1` input · `2` penpot · `3` contract · `4` gate. Solo `library` scrive su Penpot; solo `extract` scrive l'istantanea; `extract` e `render` non girano mai in CI né in build; `propose` stampa il diff dei contratti e non scrive mai. Dettaglio → `commands.md`.
  **Composizione ≠ componente estratto.** Un componente composto (Accordion Root con più item), una hero o una sezione non sono componenti estratti: sono **definizioni di sezione** in `contracts` — alberi di dati (AD-5).
  **Componenti senza headless o con logica propria** (Table con sorting, Carousel, 3D, mappe): contratto completo come gli altri; in Penpot solo un **segnaposto** (dimensioni, etichetta, plugin data) non estratto; adapter scritto a mano, senza marker.
  **Scrittura su Penpot solo via skill e `library`:** bootstrap una tantum (rifiuta se la library esiste; crea anche i token shadow/ring), poi solo additiva; le differenze si segnalano, non si correggono. Nessuna sincronizzazione ricorrente codice→Penpot.
  **Pass/fail sta negli script e negli schemi, mai nel prompt di una skill.** Il principio della libertà del designer resta: si chiede di toccare Penpot solo per scelte di design vere.
  I file `@generated` non si editano a mano; i file senza marker sono sempre preservati. Dettaglio → companion `penpot-pipeline.md` (Stadio 2 v2) e `specs/spec-refactor-packages-scripts/`.

**Rationale.** I cinque blocchi della ProductCard sono tutti nel vocabolario del contratto. Separare i due contratti li sblocca *e* toglie Penpot dal fingerprint delle pagine salvate — ciò che AD-11 v1 già voleva prevenire ma otteneva solo a metà.

### 4.2 `ARCHITECTURE-SPINE.md` — ricadute fuori da AD-11 (proposta 2, approvata)

**AD-3 (`:102`)**
```
OLD: Le primitive **headless** (Radix) non sono una libreria concorrente: non portano stile, sono la dipendenza di *comportamento* dichiarata nelle ricette (AD-11)
NEW: Le primitive **headless** (Base UI) non sono una libreria concorrente: non portano stile, sono la dipendenza di *comportamento* dichiarata per parte nel contratto di estrazione (AD-11)
```

**AD-5 (`:114`)**
```
OLD: gli schemi Zod delle props di ogni componente/blocco, i tipi di asse (`option`/`state`/`behavior`, AD-11), il classifier structure/content e le **definizioni di sezione** … **Zero dipendenze** da React, Puck, shadcn, Tailwind.
NEW: gli schemi Zod delle props di ogni componente/blocco, gli assi **`option`** (gli assi `state`/`behavior` sono di rendering e vivono nel contratto di estrazione, AD-11), i field, gli slot, il classifier structure/content e le **definizioni di sezione** … **Zero dipendenze** da React, Puck, Tailwind e da Penpot.
```

**Albero del repo (`:236`, `:242-245`)**
```
OLD:   src/domains/   #   navigation, overlays — shadcn/Radix/CVA, @generated
NEW:   src/domains/   #   navigation, overlays — Base UI headless + token, @generated

OLD: scripts/     # pipeline Penpot→codice (AD-11): fixture, ricette, emitter per libreria, gate
       penpot/    #   lettore MCP → fixture committate
       recipes/   #   schema + validazione ricette
       render/    #   renderer puro ricetta+fixture → tsx/test/story
NEW: scripts/     # pipeline Penpot→codice (AD-11): contratti di estrazione, registro, sei comandi
       contracts/ #   <nome>.extract.ts — come si legge da Penpot e come si rende
       registry/  #   registro proprietà unico (token, layout, posizione) + tabella ruolo→proprietà
       penpot/    #   lettore MCP → istantanea data/components/<nome>.json
       render/    #   istantanea + contratto di estrazione + registro → tsx/test/story/barrel
```

**Deferred "Emitter per una seconda libreria" (`:280`)** — aggiunta: *Nota (2026-09-17): con la v2 la voce cambia forma — non "un emitter per libreria" ma "un contratto di estrazione per target"; contratti del page builder, sezioni, pagine salvate e core restano invariati, come già previsto.*

### 4.3 `penpot-pipeline.md` — Stadio 2 v1 e v2 in convivenza (proposta 3, approvata)

- **Banner** dopo il cappello: due pipeline in servizio dal 2026-09-17 a CAP-11; Stadio 0 e 1 valgono per entrambe; Stadio 2 in due versioni; dove confliggono prevale `SPEC-refactor-packages-scripts`; alla chiusura di CAP-11 la sezione v1 **si cancella, non si aggiorna**.
- **Titolo esistente:** `## Stadio 2 — Estrazione e generazione COMPONENTI` → `## Stadio 2 (v1) — Estrazione e generazione COMPONENTI  [in servizio fino a CAP-11, poi cancellata]`. Corpo v1 **intatto**.
- **Nuova sezione `## Stadio 2 (v2) — Due contratti, una istantanea, sei comandi`** subito dopo lo Stadio 1: diagramma (page builder → contratto di estrazione → `extract` → istantanea → `render` → quattro file), i sei comandi con gli exit code, rimandi a `extraction-contract.md` e `commands.md`, "cosa non cambia rispetto alla v1" (principio guida, aderenza ai valori, registro unico, ordine degli adattamenti, esito per componente, pass/fail negli script, scrittura su Penpot solo via skill, `@generated`) e "cosa cambia" (spariscono judgment/binding/design/base/fixture+ricetta; il drift non è più un gate a sé: `extract --check`).
- **`## Convenzione @generated`:** aggiunta: in v2 la provenienza è nell'istantanea; per cambiare un file generato si modifica il contratto di estrazione o il registro (o si riestrae), mai il file.
- **Cappello:** `(Rivisto dai correct-course 2026-09-12, 2026-09-13, 2026-09-15 e 2026-09-17.)`

### 4.4 `epics.md` — cornice di Epic 2 (proposta 4, approvata)

**FR2**
```
OLD: … (assi del contratto disegnati come varianti in Penpot → ricetta per parti → emitter della libreria) …
NEW: … (contratto del page builder + contratto di estrazione → istantanea letta da Penpot → render sul registro delle proprietà) …
```

**NFR6** — `Le primitive headless (Radix)` → `Le primitive headless (Base UI)`.

**Additional Requirements, bullet AD-3/AD-11**
```
OLD: … con regime contratto → fixture → ricetta → emitter per libreria (una libreria per installazione).
NEW: … con regime due contratti → istantanea → render (AD-11 v2, correct-course 2026-09-17); il regime v1 (fixture → ricetta → emitter shadcn) resta in servizio fino alla rimozione prevista dalla Story 2.16.
```

**Epic List, blurb di Epic 2**
```
NEW: Pipeline Penpot→codice (packages/scripts) che genera token (packages/tokens) e componenti React accessibili (packages/ui/src/domains). Il regime arriva in due tempi: la v1 (contratto → fixture → ricetta → emitter shadcn, Story 2.1–2.10) porta la pipeline fino a quattro componenti reali e ne scopre il limite sul primo caso davvero composito; la v2 (due contratti → istantanea → render headless, Story 2.12–2.17) lo risolve nel vocabolario del contratto e cancella la v1. Outcome: si generano token e componenti accessibili dal catalogo Penpot in modo riproducibile, conformi ai contratti del page builder, visibili e testati in Storybook — ProductCard compresa, senza una riga di codice a mano.
```

**Overview di Epic 2**
```
NEW: Il regime è `due contratti → istantanea → render` (AD-11 v2, rivisto 2026-09-17): il contratto del page builder (`@app/contracts`) possiede il vocabolario che l'editor e le pagine salvate usano; il contratto di estrazione (`packages/scripts`) possiede come il componente si legge da Penpot e come si rende; Penpot disegna valori e aspetto; l'unica istantanea, scritta solo da `extract`, è ciò che si rivede in PR; il codice è funzione pura di istantanea + contratto di estrazione + registro.

> **Story 2.1–2.10 (v1).** Descrivono il regime `contratto → fixture → ricetta → emitter shadcn`, completato e mergiato. Restano **come storia**: non vanno riscritte, e il codice che documentano è in servizio finché la Story 2.16 non lo cancella. Il limite che ha portato alla v2 non era negli script ma nel vocabolario del contratto — vedi [SPEC-refactor-packages-scripts](../specs/spec-refactor-packages-scripts/SPEC.md).
```

Non toccati: NFR5 (già in termini di risultato), FR Coverage Map, AC delle Story 2.1–2.10, paragrafo Tooling.

### 4.5 `epics.md` — Story 2.11–2.18 (proposta 5, approvata; CAP-1 in due tempi confermato)

Sostituiscono le attuali 2.11 e 2.12 e ne aggiungono sei. Testo integrale nelle sezioni corrispondenti di `epics.md`; qui i titoli e ciò che ciascuna chiude.

| Story | Titolo | CAP v2 | Nota |
|---|---|---|---|
| 2.11 | Storybook del design system | — | ex 2.12, **anticipata**: CAP-10 richiede il giudizio visivo in Storybook. Il gate smoke sulle story vale per v1 oggi e v2 domani. Build statico in CI. |
| 2.12 | Fondamenta v2 — due contratti, registro, guscio | CAP-1, 2, 3, 8 | Fingerprint ridotto e `SCHEMA_VERSION` +1 una volta; campi v1 tollerati come estensione deprecata con test che ne fissa la cancellazione alla 2.16; `defineExtraction` con i controlli a module load; i due contratti della ProductCard scritti; registro con `layout`/`position`/`image`; guscio e `ScriptError`; v1 intatta. |
| 2.13 | `library` e `propose` — Penpot dal contratto di estrazione | CAP-6, 7 | `library add ProductCard` crea container, assi (inclusi `state`), 6 board, layer con i nomi delle parti; idempotente; `--dry-run`; `propose` stampa il diff sui due contratti e non scrive mai. |
| 2.14 | `extract` e `render` — una istantanea, quattro file | CAP-4, 5 | Istantanea a 6 celle; errore `contract` nominativo sul `Badge` in `promo=none`; stadi nel log; `render` senza basi con `when`/`repeat`/`attribute`/headless/layout; `--check --all` a diff zero; marker rispettato. |
| 2.15 | ProductCard end-to-end e gate in CI | CAP-10, 9 | Card disegnata da Alessandro, `extract` e `render` verdi, test e axe verdi, giudizio visivo in Storybook; `gates` con report per componente; `gates:render` e `gates` convivono fino alla 2.16; nessuna riga a mano. |
| 2.16 | Rimozione della v1 e rigenerazione dei quattro componenti | CAP-11 | Cancella data v1, otto comandi, codice v1, quattro componenti, shadcn/Radix; entra Base UI; `src/v2` → `src`; campi deprecati di `@app/contracts` cancellati senza nuovo bump; sezione "Stadio 2 (v1)" cancellata. Rigenerazione uno alla volta (Badge, Input, Alert, AccordionItem ultimo). Controllo `apps/web`; retro-voce dropdown-menu; chiusura voci deferred-work. |
| 2.17 | Skill `pds-*` sui sei comandi | CAP-11 (skill) | `grep` a zero sui dieci comandi v1; [PC] e [PS] sui sei comandi; regola di `repeat` detta al designer; `module-help.csv`; verifica su componente reale. |
| 2.18 | Libreria componenti accessibile | FR3, NFR1 | ex 2.11; Given aggiornata (v2 + skill); headless Base UI dichiarato per parte nel contratto di estrazione. |

**CAP-1 in due tempi (decisione di Alessandro, 2026-09-17).** Togliere `parts`/`partRoles`/assi `state` da `@app/contracts` alla 2.12 romperebbe la v1 (l'estrazione 2.10 legge `partRoles`, `defineContract` controlla le parti), contro il constraint «la v1 resta intatta, `main` non si rompe mai». Alla 2.12 si restringe il **fingerprint** e si dichiara canonico il formato ridotto; i campi v1 restano tollerati come estensione deprecata fuori dal fingerprint, letta solo dalla v1, e si cancellano con la v1 alla 2.16. `SCHEMA_VERSION` sale una volta sola.

### 4.6 Spec — spec-kernel e SPEC v2 (proposta 6, approvata)

**`spec-page-builder/SPEC.md:112`**
```
OLD: … oggi la libreria generata da Penpot su base shadcn; una seconda libreria (es. MUI) implementerebbe gli stessi contratti.
NEW: … oggi la libreria generata da Penpot su primitivi headless Base UI, senza basi di libreria; una seconda libreria (es. MUI) implementerebbe gli stessi contratti del page builder con un proprio contratto di estrazione.
```

**`design-system.md`** — `:14` "possiede props, tipi di asse, classifier…" → "possiede props, assi `option`, field, slot, classifier structure/content e definizioni di sezione"; `:16` "(+ headless Radix)" → "(+ headless Base UI)"; `:31` "pipeline fixture → ricetta → emitter (AD-11); compongono primitive **headless** (Radix)" → "pipeline due contratti → istantanea → render (AD-11 v2); compongono primitive **headless** (Base UI), dichiarate per parte nel contratto di estrazione,".

**`spec-refactor-packages-scripts/SPEC.md`**
- CAP-1 success riscritto in due tempi (testo in 4.5).
- Constraint nuovo: «Il contratto del page builder tollera i campi v1 come estensione deprecata fuori dal fingerprint fino a CAP-11: è ciò che tiene insieme "`SCHEMA_VERSION` sale una volta" e "la v1 resta intatta" (correct-course 2026-09-17).»
- Constraint finale: «…la revisione formale di AD-11, di Story 2.11 e 2.12 è avvenuta col correct-course del 2026-09-17 (`sprint-change-proposal-2026-09-17.md`): Epic 2 a 18 story, Storybook anticipato alla 2.11, v2 nelle Story 2.12–2.17.»

### 4.7 Tracciamento (proposta 7, approvata)

**`sprint-status.yaml`, Epic 2**
```
2-10-fedelta-live-ed-estrazione-guidata-dal-contratto: done       # PR #43 mergiata, 13/13 task
2-11-storybook-del-design-system: backlog
2-12-fondamenta-v2-due-contratti-registro-guscio: backlog
2-13-library-e-propose-penpot-dal-contratto-di-estrazione: backlog
2-14-extract-e-render-una-istantanea-quattro-file: backlog
2-15-productcard-end-to-end-e-gate-in-ci: backlog
2-16-rimozione-della-v1-e-rigenerazione-dei-quattro-componenti: backlog
2-17-skill-pds-sui-sei-comandi: backlog
2-18-libreria-componenti-accessibile: backlog
```
Il frontmatter di `2-10-….md` passa a `done`. Nessun file 2-11/2-12 esiste: niente rinomine. `last_updated` aggiornato.

**Action item (retro Epic 1)**
- dropdown-menu: «…quando Story 2.16 rigenera l'AccordionItem via Base UI (ex 2.4, 2.7, 2.9, 2.10, 2.11 — correct-course 2026-09-17)».
- alias shadcn in `components.json`: `status: done` — «Senza oggetto: shadcn e components.json escono con la v1 nella Story 2.16 (correct-course 2026-09-17)».
- Gli altri tre restano `open`: il principio "prova rosso/verde per ogni gate" è ereditato dalle AC v2.

**`deferred-work.md`** — nuova voce di registro «correct-course "pipeline v2" (2026-09-17)»: le voci su artefatti v1 (righe 75, 116, 120, 134, 136, 139, 147, 176, 183, 189, 203, 207, 212 al 2026-09-17) restano aperte finché la v1 è in servizio e si chiudono alla 2.16 come "senza oggetto".

**Memoria dell'agente** (fuori repo): `ad11-penpot-generation-under-review.md` e `forge-penpot-shadcn-puck-hardened.md` aggiornati; nuova nota sulla v2.

## 5. Handoff di implementazione

**Scope: Moderate** — riorganizzazione del backlog di Epic 2 e revisione dei documenti di pianificazione; nessuna replan di prodotto (MVP e FR invariati), nessuna riscrittura di story fatte.

| Chi | Cosa | Quando |
|---|---|---|
| **Developer (questa sessione)** | Applica le sette proposte ai file: `ARCHITECTURE-SPINE.md`, `penpot-pipeline.md`, `epics.md`, `spec-page-builder/SPEC.md`, `design-system.md`, `spec-refactor-packages-scripts/SPEC.md`, `sprint-status.yaml`, `2-10-….md`, `deferred-work.md`. Commit sul branch `chore/forge-refactor-packages-scripts` insieme alla forge e allo SPEC v2, PR verso `main`. | ora |
| **Developer (`bmad-build`)** | Story 2.11 (Storybook) per prima; poi 2.12 → 2.17 nell'ordine, senza salti: ogni story lascia `main` verde con la v1 intatta fino alla 2.16. | dopo il merge |
| **Alessandro** | Disegna la ProductCard in Penpot dopo la 2.13 (container creato da `library add`); giudizio visivo in Storybook nella 2.15; decide se una story va splittata al controllo di scope di `bmad-build`. | 2.13 → 2.15 |

**Criteri di successo del correct-course.**
- I sei documenti dicono la stessa cosa sulla v2 e dichiarano esplicitamente dove la v1 è ancora in servizio.
- `sprint-status.yaml` ha 18 chiavi in Epic 2, 2.10 `done`, nessuna chiave orfana.
- La Story 2.12 può partire da `bmad-build` senza un documento che la contraddica.

**Criterio di successo della v2** (invariato dallo SPEC): la ProductCard passa da Penpot a `packages/ui` senza codice a mano; poi Badge, Input, Alert e AccordionItem rinascono dalla stessa strada, senza che nessuno noti la differenza in Storybook.
