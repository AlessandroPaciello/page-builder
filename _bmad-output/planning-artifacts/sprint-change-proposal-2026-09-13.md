---
workflow: bmad-correct-course
date: 2026-09-13
author: Alessandro (con agente Developer)
mode: incrementale
scope: Moderate
status: approved
trigger: forge "pipeline troppo vincolante per il designer" (`_bmad-output/forge/pipeline-troppo-vincolante-per-il-designer/forged-idea.md`, 2026-09-13)
supersedes: nessuna — si aggiunge a `sprint-change-proposal-2026-09-12-v2.md` (Story 2.7 e 2.8 in Epic 2)
---

# Sprint Change Proposal — Registro delle proprietà e blocco per componente

## 1. Sintesi del problema

**Trigger.** Mentre la Story 2.7 è in-progress (parte A "niente verdi finti" done, parte B `addCell`/`adopt:variant` in deferred), Alessandro ha condotto una sessione di forge con la lente del **designer non tecnico**: lavora in Penpot da solo e consegna il file finito o quasi. Domanda: quali vincoli della pipeline Penpot→codice servono davvero, e quali puniscono il designer per attriti che non sono scelte di design?

**Tipo.** Limiti tecnici emersi esercitando la pipeline, più una decisione strategica sulla divisione dei ruoli. Non un cambio di obiettivi: **l'MVP non cambia**.

**Problema.** La pipeline fallisce **tutto-o-niente** e perde fedeltà **in silenzio**:

- `verify:library` e `gates:render` valutano tutto il catalogo insieme: un componente fuori regola rende rossa la CI per tutti;
- spessore, opacità, tratteggio e allineamento dello stroke sono **saltati con un log** — uno stroke da 2px sparisce dal codice generato e nessun gate lo vede (verde finto);
- una variante senza una proprietà che il default ha (es. outline senza fill) blocca per un limite dell'emitter (`computePartClasses`), non per un errore del designer;
- la conoscenza delle proprietà è sparsa in 4 punti (reader, `PROPERTY_TOKEN_TYPE`, prefissi utility, controlli di `verify:library`) — sbloccarne una richiede una caccia in quattro file.

**Evidenze verificate nel codice (2026-09-13).** `render-component.ts:385-392` (fail-loud solo sul caso "rimozione di una classe"), `render-component.ts:394-400` (`skippedProperties` → solo log in `render-cli.ts:132` e `gates-cli.ts:102`, nessun gate rosso), `verify-library.ts`/`gates.ts` (valutazione globale), register Alert in `deferred-work.md` (problemi 1-8).

**Decisioni del forge** (testo completo in `forged-idea.md`): Penpot resta la fonte del design e far passare la pipeline è compito dello sviluppatore; ogni valore ha un token, gli stili a parola chiave di lista chiusa (tratteggio) sono ammessi senza token; blocco **per componente** con messaggio nominativo, mai generazione di versioni infedeli; estensione dell'emitter **una volta per tutte** quando non sa esprimere un design valido coi token; registro unico delle proprietà Penpot; attriti di file normalizzati (maiuscole/spazi/ordine assi), alias layer nel binding, cella mancante → blocco + domanda al designer, mai inventata; variante nuova in Penpot blocca solo quel componente, visibile nel report di PR/CI; tag cliccabile = link con `href` dai dati commerce; X del filtro attivo = composizione FilterChip (scartati asse `removable` e parti opzionali nelle primitive).

## 2. Analisi d'impatto

### Epic

| Epic | Impatto |
|---|---|
| 2 | **Da 10 a 11 story.** Nuova Story 2.8 (registro delle proprietà e blocco per componente) dopo la 2.7; skill `pds-component` 2.8→2.9 (con percorsi [PS] aggiornati), libreria 2.9→2.10, Storybook 2.10→2.11. Obiettivo e FR coperti invariati. |
| 3 | Story 3.4: la composizione "Filtro attivo" (Badge + icona-link) è il caso di prova designato — nuovo AC. |
| 4–6 | Nessun impatto. La decisione "tag cliccabile = link" cade in 6.4 ed è coerente con CAP-15/AD-10 (decisione registrata, non lavoro nuovo). |

Nessuna epic obsoleta, nessuna epic nuova, ordine invariato.

### Artefatti

- **SPEC (in sostituzione del PRD):** nessun conflitto, MVP invariato. CAP-2 cita "cinque gate": la granularità per componente non cambia il numero né la promessa — sono gli stessi gate, valutati per componente.
- **Architecture Spine:** nessuna modifica. AD-11 regge ("mai generare in silenzio una versione infedele" attua NFR5); registro e granularità dei gate sono organizzazione interna di `packages/scripts`.
- **`penpot-pipeline.md`:** aggiornamento normativo (proposta 1): persona del designer, regola token precisata, sezione "Registro delle proprietà e fedeltà", nota di granularità dei gate.
- **`design-system.md`:** nuova sezione "Primitive rigide, composizioni elastiche" (proposta 2).
- **UX (DESIGN/EXPERIENCE):** nessun impatto — la libertà del designer riguarda la pipeline, non i render dell'editor.
- **Artefatti di implementazione:** `sprint-status.yaml` (chiavi e action item), `deferred-work.md` (register nuovo + riferimenti rinumerati).

### Impatto tecnico

Il codice (reader, emitter, `verify:library`, gate CLI) cambia dentro la Story 2.8, con vincolo di output byte-identico (`render:check` diff zero) durante il refactor del registro. Le story rinumerate sono in `backlog` senza story file: nessun file da rinominare.

## 3. Approccio raccomandato

**Aggiustamento diretto** (opzione 1): una story nuova nell'Epic 2, aggiornamento normativo dei companion e nota sulla Story 3.4.

**Scartate.**
- *Rollback*: nulla da ripristinare — la parte A di 2.7 è corretta e la derivazione delle liste è la stessa filosofia del registro.
- *Revisione MVP*: l'MVP non cambia; le decisioni irrigidiscono la fedeltà (più controlli, non meno scope).
- *Estendere la 2.7 con una parte C*: la 2.7 è già divisa in due parti per controllo di scope; aggiungervi cinque deliverable indipendenti ripeterebbe l'errore che lo split ha corretto.

**Motivazione.** Il forge ha fissato la direzione *prima* che la libreria (2.10) moltiplichi i componenti e prima che la skill (2.9) codifichi i percorsi di sincronizzazione sbagliati. Il registro è il prerequisito anti-rework: sbloccare una proprietà dopo = una riga + mappatura + test rosso/verde, invece di una caccia in quattro file.

**Sforzo e rischio.** Medio / medio-basso. Il refactor del registro ha il vincolo byte-identico (verificabile con `render:check`); l'isolamento per componente è progettazione nuova (tuttavia dentro il regime rosso/verde esistente). Dipendenza dalla parte B di 2.7 solo per costruzione di `adopt:variant` (il fix dell'emitter ne toglie il blocco sul primo caso reale).

**Impatto sulla timeline.** Epic 2 passa da 10 a 11 story; la libreria e Storybook slittano di una story.

## 4. Proposte di modifica dettagliate (approvate in modalità incrementale)

### 4.1 `penpot-pipeline.md` — aggiornamenti normativi (proposta 1, approvata)

**1a. Principio guida**, dopo il primo paragrafo:

```markdown
**Il designer di riferimento è non tecnico**: lavora in Penpot da solo e consegna il file finito o
quasi. Far passare la pipeline (ricetta, binding, emitter) è compito dello **sviluppatore**; il
designer torna in Penpot solo per scelte di design vere (es. un colore senza token), mai per
esigenze della pipeline.
```

**1b. Regola della ricetta precisata:**

```markdown
OLD: - la ricetta è una **mappa di parti a profondità 1**; ogni cella è `proprietà → token`
     (es. `fill: destructive`, `padding: spacing.2`) per parte × valore d'asse — nessuna classe di una libreria;
NEW: - la ricetta è una **mappa di parti a profondità 1**; ogni cella è `proprietà → token`
     (es. `fill: destructive`, `padding: spacing.2`) per parte × valore d'asse — nessuna classe di una libreria;
     ogni **valore** (colore, misura, spessore, opacità, ombra) ha un token; gli stili a **parola chiave**
     di una lista chiusa (es. tratteggio `solid`/`dashed`/`dotted`) sono ammessi senza token;
```

**1c. Nuova sezione**, dopo "### Emitter per libreria e binding":

```markdown
### Registro delle proprietà e fedeltà

Le proprietà di stile Penpot che la pipeline conosce vivono in un **registro unico**, letto da
reader, `verify:library` ed emitter: per ognuna, la lettura, il tipo (token o lista di parole
chiave), lo stato (**supportata** o **bloccata**) e la mappatura dell'emitter. Solo due stati:
**nessuno skip** — una proprietà o genera codice fedele o blocca il componente; una proprietà
Penpot assente dal registro blocca anch'essa. Sbloccarne una = una riga del registro + la
mappatura + un test rosso/verde (le proprietà oggi "silenziose" — spessore, opacità, tratteggio,
allineamento dello stroke — **bloccano** finché un componente reale non le richiede). Il refactor
che introduce il registro lascia l'output attuale identico byte per byte.

Quando l'emitter non sa esprimere un design valido fatto con i token, si estende l'emitter
**una volta per tutte** — non per componente né a mano sul generato (primo caso: una variante
senza una proprietà che il default ha, come l'outline senza fill: la proprietà assente entra
nelle classi per variante, non nella base `cva`). Condizione: adeguarsi deve restare semplice
per lo sviluppatore. Una proprietà che varia con due assi resta non esprimibile finché
l'emitter non guadagna le `compoundVariants` (stesso principio).

**Mai generare in silenzio una versione infedele.** Ciò che non è esprimibile blocca **solo quel
componente**, con un messaggio che nomina il problema; gli altri proseguono. Attriti di
organizzazione del file: maiuscole, spazi e ordine degli assi sono normalizzati dalla pipeline;
un layer con un nome diverso dalla parte è un **alias nel binding** (a cura dello sviluppatore);
una cella mancante blocca il componente e chiede al designer — mai inventata. Una variante
aggiunta in Penpot blocca solo quel componente, che resta all'ultima versione buona, finché lo
sviluppatore non la adotta (skill `pds-component` / `adopt:variant`); i componenti in attesa sono
visibili nel report di PR/CI, non solo nel terminale.
```

**1d. Gate di verifica**, dopo la tabella dei gate:

```markdown
I gate valutano **per componente**: un componente fuori regola rende rossa solo la sua voce, e i
componenti in attesa (variante non ancora adottata, proprietà bloccata) restano visibili nel
report — la CI non è più tutto-o-niente.
```

*Razionale:* diventano la legge della pipeline che la Story 2.8 implementa; senza, lo skip silenzioso e il fallimento tutto-o-niente resterebbero lo stato di fatto.

### 4.2 `design-system.md` — primitive rigide, composizioni elastiche (proposta 2, approvata)

Nel paragrafo "## puck-components", dopo il paragrafo "Sezioni":

```markdown
**Primitive rigide, composizioni elastiche.** I componenti della library sono primitive senza
parti opzionali (ogni parte esiste in ogni cella) e senza comportamento disegnato in Penpot; la
flessibilità sta nelle composizioni e nelle sezioni. Due casi fissati dal correct-course
2026-09-13 (forge "pipeline meno vincolante"):

- Un **tag cliccabile su un prodotto è un link**: Penpot disegna solo gli stati (hover/focus,
  assi `state`); il `<a>` lo decidono contratto e binding, e l'`href` arriva dai dati commerce
  della ProductCard (CAP-15) — la logica di ricerca resta nella sorgente esterna.
- La **X su un filtro attivo** non è una parte opzionale del Badge: è una **composizione**
  (Badge + icona-link in un blocco "Filtro attivo"). Scartati l'asse `removable` sul Badge e le
  parti opzionali nelle primitive: sarebbe l'editor, non i dati, a decidere la presenza della X
  (costo su verify, estrazione e registro, e uno stile da inventare nelle celle senza X). Il
  filtro attivo è il caso di prova per l'estrazione delle sezioni, che devono dare al designer
  la stessa libertà concessa qui ai componenti.
```

*Razionale:* senza questa registrazione, le sezioni (3.4) e i blocchi commerce (6.4) seguirebbero l'istinto di modellare la X come parte opzionale — l'opzione scartata con motivi a portata di verifica.

### 4.3 `epics.md` — nuova Story 2.8 + rinumerazione (proposta 3, approvata)

Inserita dopo la Story 2.7:

```markdown
### Story 2.8: Registro delle proprietà e blocco per componente

As a designer/sviluppatore,
I want le proprietà di stile Penpot in un registro unico e che ciò che la pipeline non sa
esprimere blocchi solo il componente interessato,
So that nessuna fedeltà vada persa in silenzio e un componente fuori regola non renda rossa la
CI per tutti (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il registro unico delle proprietà Penpot (lettura, tipo token o lista di parole
chiave, stato supportata/bloccata, mappatura emitter) letto da reader, `verify:library` ed emitter
**When** estraggo e rendo i componenti committati
**Then** nessuna proprietà viene saltata in silenzio: una proprietà non espressibile blocca il
solo componente con messaggio nominativo, e le proprietà oggi "silenziose" (spessore, opacità,
tratteggio, allineamento dello stroke) bloccano; il reader legge `strokeStyle` come parola
chiave di lista chiusa (`solid`/`dashed`/`dotted`) e i valori fuori lista bloccano
**And** il refactor lascia l'output attuale identico byte per byte (Badge/Input/AccordionItem
byte-identici, `render:check` a diff zero) e la copertura di test di `scripts` non scende
**And** una variante senza una proprietà che il default ha (es. outline senza fill) è
esprimibile: la proprietà assente produce classi per variante, non nella base `cva` — l'emitter
è stato esteso **una volta per tutte**, non per componente
**And** maiuscole, spazi e ordine degli assi sono normalizzati dalla pipeline; un layer con
nome diverso dalla parte si lega via alias nel binding; una cella mancante blocca il
componente con una domanda al designer, mai inventata
**And** `verify:library` e `gates:render` valutano **per componente**: un componente fuori
regola rende rossa solo la sua voce, e i componenti in attesa (variante non adottata,
proprietà bloccata) sono visibili nel report di PR/CI, non solo nel terminale
**And** ogni controllo nuovo ha una propria prova rosso/verde.
```

**Rinumerazione:** 2.8 skill → **2.9**; 2.9 libreria → **2.10**; 2.10 Storybook → **2.11**. Ritocchi di referenza interna: "So that" della 2.7 "(2.9)" → "(2.10)"; la libreria cita `pds-component` "(Story 2.8)" → "(Story 2.9)" e il suo Given guadagna "il registro della Story 2.8".

*Razionale:* il registro è prerequisito anti-rework prima della libreria e della skill; l'estensione dell'emitter toglie il blocco outline-senza-fill che oggi fermerebbe `adopt:variant` sul primo caso reale.

### 4.4 `epics.md` — skill (2.9), percorsi [PS] aggiornati (proposta 4, approvata)

```markdown
Story: 2.9 (ex 2.8) — Skill `pds-component` — creare e sincronizzare i componenti
Section: Acceptance Criteria, voce [PS] Sincronizza componente

OLD:
- la voce **[PS] Sincronizza componente** legge lo stato con `verify:library` e `gates:render` e
  sceglie il percorso: drift → riestrazione e render con diff; valore d'asse in più da Penpot →
  `adopt:variant`; cella mancante → `addCell`; proprietà senza token → indicazione al designer

NEW:
- la voce **[PS] Sincronizza componente** legge lo stato **per componente** con `verify:library`
  e `gates:render` e sceglie il percorso: drift → riestrazione e render con diff; valore d'asse
  in più da Penpot → `adopt:variant`; cella richiesta dal contratto ma assente dal container →
  `addCell`; cella che il design usa e il contratto non ha, o mancante dal container → blocco
  del componente e domanda al designer (mai inventata); proprietà bloccata dal registro →
  indicazione dello sblocco (una riga del registro + mappatura + test rosso/verde) e decisione
  umana; componente in attesa → visibile nel report, nessuna correzione da parte della skill
```

*Razionale:* `addCell` resta dev-side (il contratto richiede una cella che Penpot non ha); la cella che arriva dal design senza contratto è una scelta di design vera → blocco + domanda. Senza, la skill instraderebbe i nuovi stati sui percorsi vecchi.

### 4.5 `epics.md` — Story 3.4, caso di prova "Filtro attivo" (proposta 5, approvata)

```markdown
Story: 3.4 — Definizioni di sezione da Penpot
Section: Acceptance Criteria

OLD:
- in editor la struttura è bloccata e il contenuto modificabile; gli slot accettano solo i
  blocchi dell'`allow` fino a `max` (`resolvePermissions`); i testi del mockup diventano default
  dei campi content.

NEW:
- in editor la struttura è bloccata e il contenuto modificabile; gli slot accettano solo i
  blocchi dell'`allow` fino a `max` (`resolvePermissions`); i testi del mockup diventano default
  dei campi content.
- il primo estratto di sezione comprende una composizione di designer — il blocco "Filtro
  attivo" (Badge + icona-link affiancati) — come prova che una sezione dà al designer la stessa
  libertà decisa per i componenti: la X del filtro non è una parte opzionale del Badge ma un
  link accanto ad esso (`href` verso la ricerca senza il filtro), e nessuna parte del Badge è
  opzionale.
```

*Razionale:* scriverlo nell'AC evita che la prima sezione reale ripresenti l'opzione scartata (parte opzionale / asse `removable`) per comodo implementativo.

### 4.6 `sprint-status.yaml` (proposta 6, approvata)

```yaml
# a. Chiavi Epic 2

OLD:
  2-7-pipeline-pronta-per-piu-componenti: in-progress
  2-8-skill-pds-component: backlog
  2-9-libreria-componenti-accessibile: backlog
  2-10-storybook-del-design-system: backlog

NEW:
  2-7-pipeline-pronta-per-piu-componenti: in-progress
  2-8-registro-delle-proprieta-e-blocco-per-componente: backlog
  2-9-skill-pds-component: backlog
  2-10-libreria-componenti-accessibile: backlog
  2-11-storybook-del-design-system: backlog

# b. Action item dropdown (retro Epic 1)

OLD: ...quando Story 2.9 genera il primo primitivo reale via Radix (ex 2.4, poi 2.7)...
NEW: ...quando Story 2.10 genera il primo primitivo reale via Radix (ex 2.4, poi 2.7, poi 2.9)...

# c. Intestazione
# last_updated: 2026-09-13 (correct-course: nuova Story 2.8 registro/blocco, Epic 2 da 10 a 11 story)
```

*Razionale:* la risoluzione delle chiavi (primi due segmenti numerici) deve restare allineata 1:1 a `epics.md`, altrimenti `bmad-build` aprirebbe la story sbagliata.

### 4.7 `deferred-work.md` — register del forge + riferimenti (proposta 7, approvata)

**a. Nuova sezione register** (in fondo al file):

```markdown
## Register: forge "pipeline troppo vincolante per il designer" (2026-09-13)

Sessione di Alessandro con agente forge (`_bmad-output/forge/pipeline-troppo-vincolante-per-il-designer/`),
mentre la Story 2.7 parte B è in deferred. Esito pianificato da
`sprint-change-proposal-2026-09-13.md`:

- Registro unico delle proprietà Penpot, nessuno skip (supportata o bloccata), blocco **per
  componente**, estensione dell'emitter una volta per tutte, attriti di file normalizzati →
  **Story 2.8** (nuova); normativo in `penpot-pipeline.md` (§ Registro delle proprietà e fedeltà).
- Percorsi [PS] della skill aggiornati ai nuovi stati → **Story 2.9**.
- Tag cliccabile = link (`href` dai dati commerce), X del filtro = composizione FilterChip,
  primitive rigide / composizioni elastiche → `design-system.md` e **Story 3.4** (caso di prova).
- **Aperti:** `applyToken` sulle ombre (Penpot 2.17) non verificato dal vivo; `compoundVariants`
  per una proprietà che varia con due assi (stesso principio "una volta per tutte"); il caso
  "variante esistente modificata" è rimandato, ma il fix dell'emitter "proprietà assente →
  classi per variante" serve comunque alle varianti nuove.
```

**b. Riferimenti rinumerati:**

```markdown
OLD: ...**Story 2.9**, ex 2.4, poi 2.7 — rinumerata dai correct-course del 2026-09-12...
NEW: ...**Story 2.10**, ex 2.4, poi 2.7, poi 2.9 — rinumerata dai correct-course del 2026-09-12 e 2026-09-13...

OLD: ...problemi 1–6 e 8 e i comandi mancanti nella **Story 2.7**, la skill nella **Story 2.8**,
     il problema 7 nella **Story 2.10** — tutto prima della libreria (**Story 2.9**)...
NEW: ...problemi 1–6 e 8 e i comandi mancanti nella **Story 2.7**, la skill nella **Story 2.9**,
     il problema 7 nella **Story 2.11** — tutto prima della libreria (**Story 2.10**)...

OLD: Da riprendere **in Story 2.10** (Storybook, ex 2.8), o prima se la 2.9 rigenera molte story.
NEW: Da riprendere **in Story 2.11** (Storybook, ex 2.8 poi 2.10), o prima se la 2.10 rigenera molte story.
```

*Razionale:* il register è la memoria operativa del progetto — i numeri superati manderebbero il lavoro sbagliato; la sezione nuova preserva le decisioni del forge (inclusi gli aperti) con la fonte linkata.

## 5. Handoff di implementazione

**Classificazione: Moderate.** Aggiunge una story all'Epic 2, aggiorna due companion normativi e rinumera tre story in backlog; non riscrive decisioni architetturali né lo SPEC.

**Destinatari.**
- **Developer (questa sessione):** applica le sette modifiche approvate a `penpot-pipeline.md`, `design-system.md`, `epics.md`, `sprint-status.yaml`, `deferred-work.md`; verifica che non restino riferimenti ai vecchi numeri negli artefatti vivi.
- **Developer (sessioni successive):** `bmad-build` per chiudere la parte B della 2.7, poi **Story 2.8** (registro e blocco per componente), poi 2.9, 2.10, 2.11. Il contesto dell'Epic 2 (`epic-2-context.md`) viene ricompilato automaticamente.
- **Alessandro:** decisioni umane durante la 2.8 (es. dove l'isolamento per componente tocca la CI) e gli aperti del register (ombra `applyToken`, `compoundVariants`, caso 1 variante modificata).

**Criteri di successo.**
- `epics.md` elenca le story 2.1–2.11 nell'ordine 2.7 pipeline (parti A+B) → 2.8 registro/blocco → 2.9 skill → 2.10 libreria → 2.11 Storybook.
- Le chiavi di `sprint-status.yaml` corrispondono una a una alle story di `epics.md`.
- Nessun artefatto vivo rimanda a skill/libreria/Storybook con i numeri precedenti; le story chiuse restano invariate come registro storico.
- `penpot-pipeline.md` contiene la sezione "Registro delle proprietà e fedeltà" e `design-system.md` la sezione "Primitive rigide, composizioni elastiche".
