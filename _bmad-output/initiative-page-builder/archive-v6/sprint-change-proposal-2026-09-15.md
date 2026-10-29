---
workflow: bmad-correct-course
date: 2026-09-15
author: Alessandro (con agente Developer)
mode: incrementale
scope: Moderate
status: approved
trigger: rimandi di `deferred-work.md` da trattare prima della Story 2.10 (verifica live 2.9 [PS] su Alert, code review 2.9, riordino di `packages/scripts`) e principio "la pipeline si adatta al designer" (forge 2026-09-13)
supersedes: nessuna — si aggiunge a `sprint-change-proposal-2026-09-13.md` (Epic 2)
---

# Sprint Change Proposal — Fedeltà live ed estrazione guidata dal contratto

## 1. Sintesi del problema

**Trigger.** Chiusa la Story 2.9 (skill `pds-component`), restano tre rimandi da trattare prima della libreria (oggi Story 2.10), che moltiplica i componenti:

- **(a) Contrasto su una fonte sbagliata.** La regola 10 di `verify:library` misura le coppie ricavate da `designs/*.design.json` (`committedDesigns()` caricato all'avvio del modulo in `library-spec.ts:232`), non dai token live di Penpot. Nella verifica live di [PS] su Alert (2026-09-14) `color.muted-foreground` è finito sulla root della cella `status=warning`: heading 1.93:1, description 1.82:1, con `verify:library` e `gates:render` verdi (verde finto). Nessun comando riallinea il design committato dopo un drift: `alert.design.json` diverge ancora da Penpot e dalla fixture.
- **(b) Un solo `role` per componente.** `a11y.role` del giudizio è una stringa (`recipe-schema.ts:85`): Alert emette `role="alert"` (live region assertiva) anche per `info`/`success`.
- **(c) L'estrazione non ha un riferimento per le proprietà.** Il contratto dichiara solo i nomi delle parti (`contract.ts:42`); che cosa sia una parte vive implicito nel `kind` di `design.json`, che è un input del bootstrap. Una variante che mette un token su `strokeColor` di un testo (anche al posto del `fill`) passa in silenzio: il registro supporta `strokeColor` (`border-<token>`), dopo la 2.8c l'emitter lo esprime per variante, e il testo perde il colore dello stato senza che un gate lo veda.

**Tipo.** Limiti tecnici emersi esercitando la pipeline. L'MVP non cambia.

**Decisione di Alessandro su (c).** L'estrazione deve basarsi sul **contratto** come riferimento: quando una variante porta un token su una proprietà diversa da quella attesa, l'estrazione lo segnala e aiuta ad adattarlo. Variante scelta: **A — ruolo di parte nel contratto, tabella ruolo → proprietà in `packages/scripts`** (scartata B: proprietà elencate per parte nel contratto, che porterebbe il vocabolario Penpot in `@app/contracts`, contro AD-5).

**Contesto in corso.** In un'altra sessione è in corso la story che porta le regole 2, 3, 6 e 7 della library in un modulo condiviso fra estrazione e `verify:library` (rimando del riordino di `packages/scripts`). Qui è trattata come **in corso**: è la Given della nuova Story 2.10.

## 2. Analisi d'impatto

### Epic

| Epic | Impatto |
|---|---|
| 2 | **Da 11 a 12 story.** Nuova Story 2.10 "Fedeltà live ed estrazione guidata dal contratto"; libreria 2.10 → **2.11**, Storybook 2.11 → **2.12**. Obiettivo e FR coperti invariati. |
| 3 | Nessun impatto diretto. Le sezioni (3.4) potranno riusare il ruolo di parte, ma nessun AC cambia. |
| 4–6 | Nessun impatto. |

### Artefatti

- **SPEC:** nessun conflitto, MVP invariato.
- **Architecture Spine, AD-11:** emendamento — il contratto dichiara il **ruolo** delle parti (proposta 1). AD-5 resta rispettato: il ruolo è un vocabolario chiuso indipendente da librerie e da Penpot.
- **`penpot-pipeline.md`:** ruolo nella tabella del confine, nuova sezione "Ruolo di parte", regola 10 per componente sui token live + `sync:design`, `a11y.role` per variante (proposta 2).
- **UX:** nessun impatto.
- **Implementazione:** `epics.md`, `sprint-status.yaml`, `deferred-work.md`; `epic-2-context.md` si ricompila da solo.

### Impatto tecnico

`@app/contracts` (ruolo nelle parti, `SCHEMA_VERSION` + fingerprint: cambio compatibile, le pagine salvate non cambiano), `packages/scripts` (tabella ruolo → proprietà, reader/estrazione, `verify:library` regola 10, nuovo comando `sync:design`, comando di cambio ruolo, schema del giudizio, emitter e gate a11y), skill `pds-component` [PS]. Vincolo: output generato byte-identico per i componenti esistenti.

## 3. Approccio raccomandato

**Aggiustamento diretto:** una story nuova nell'Epic 2 prima della libreria, più l'emendamento di AD-11 e dei companion.

**Scartate.**
- *AC dentro la libreria*: è già la story più grande dell'Epic; ripeterebbe l'errore corretto dagli split della 2.7 e della 2.8.
- *Due story (a+b / c)*: a e c condividono la radice (il ruolo di parte alimenta sia le coppie di contrasto sia il confronto dell'estrazione); separarle obbligherebbe la regola 10 a passare di nuovo dal `kind` del design, la fonte sbagliata.
- *Rollback / revisione MVP*: nulla da ripristinare, MVP invariato.

**Sforzo e rischio.** Medio / medio. Il ruolo tocca contratti, estrazione, verify ed emitter, ma dentro il regime rosso/verde e byte-identico esistente. Dipende dalla story delle regole condivise (in corso).

**Timeline.** Epic 2 passa da 11 a 12 story; libreria e Storybook slittano di una.

## 4. Proposte di modifica dettagliate (approvate in modalità incrementale)

### 4.1 `ARCHITECTURE-SPINE.md` — AD-11, ownership del contratto (proposta 1, approvata con variante A)

```
OLD:
  **Ownership.** Il **contratto** di ogni componente (assi, valori ammessi, tipo di asse, parti)
  vive in `packages/contracts` (AD-5) ed è del page builder.

NEW:
  **Ownership.** Il **contratto** di ogni componente (assi, valori ammessi, tipo di asse, parti
  con il loro **ruolo**) vive in `packages/contracts` (AD-5) ed è del page builder.
  **Ruolo di parte**, dichiarato nel contratto e mai in Penpot: un vocabolario chiuso e
  indipendente da librerie e da Penpot (`surface`, `text`, `icon`, `divider`), che dice che cosa
  la parte è e quindi quale proprietà ne porta il colore. La tabella ruolo → proprietà ammesse
  vive in `packages/scripts`, accanto al registro delle proprietà (es. `text` → colore su
  `fill`, `icon` → colore su `strokeColor`). L'estrazione confronta ogni cella con il ruolo: un
  token su una proprietà che il ruolo non ammette non passa in silenzio — si segnala per nome e
  si propone l'adattamento, in quest'ordine: il designer sposta il token; lo sviluppatore insegna
  la proprietà al ruolo (una volta per tutte, il contratto non cambia); lo sviluppatore cambia il
  ruolo della parte (cambio compatibile: solo `SCHEMA_VERSION`).
```

*Razionale:* il contratto diventa il riferimento unico dell'estrazione senza vocabolario Penpot/Tailwind; il `kind` del design, input del bootstrap, smette di essere la fonte. Esempio concordato: `strokeColor` su `root` (`surface`) passa, è un outline legittimo; `strokeColor` su `heading` (`text`), anche al posto del `fill`, mette in attesa il solo Alert con i tre adattamenti.

### 4.2 `penpot-pipeline.md` (proposta 2, approvata)

**2a. Tabella del confine:**

```
OLD:
| assi, valori ammessi, tipo di asse (`option`/`state`/`behavior`) | contratto | vocabolario del page builder |
NEW:
| assi, valori ammessi, tipo di asse (`option`/`state`/`behavior`), ruolo di parte (`surface`/`text`/`icon`/`divider`) | contratto | vocabolario del page builder |
```

**2b. Nuova sezione, dopo "Registro delle proprietà e fedeltà":**

```markdown
### Ruolo di parte — il contratto come riferimento dell'estrazione

Ogni parte del contratto dichiara un **ruolo** (AD-11): `surface`, `text`, `icon`, `divider`.
Accanto al registro delle proprietà, in `packages/scripts`, una **tabella ruolo → proprietà
ammesse** dice quali proprietà del registro può portare una parte con quel ruolo (es. `text`:
colore su `fill`, tipografia; `surface`: `fill`, `strokeColor`, radius, padding, gap, ombra;
`icon`: colore su `strokeColor` o `fill`). Estrazione e `verify:library` confrontano ogni cella
con la tabella: una proprietà che il ruolo non ammette **blocca solo quel componente** (stato
**in attesa**) con un messaggio che nomina componente, cella, parte, ruolo, proprietà e token, e
propone l'adattamento in quest'ordine:

1. **al designer** — sposta il token sulla proprietà attesa (es. da `strokeColor` a `fill` su
   un testo); il messaggio è leggibile senza conoscere la pipeline;
2. **allo sviluppatore, se il design è voluto** — il ruolo impara la proprietà: una riga della
   tabella + la mappatura dell'emitter + un test rosso/verde, **una volta per tutte**; il
   contratto non cambia;
3. **allo sviluppatore, se la parte è d'altro tipo** — cambio di ruolo nel contratto (cambio
   compatibile: solo `SCHEMA_VERSION`), con un comando che propone il diff e scrive con `--yes`,
   come `adopt:variant`.

Il ruolo sostituisce il `kind` del design committato come fonte: `designs/*.design.json` lo
eredita dal contratto.
```

**2c. "Esito per componente e report", regola 10:**

```
OLD:
Le regole globali di `verify:library` (8 copertura spec, 9 tema, 10 contrasto, e la copertura
design↔registry) sono righe **globali**, fuori dalle voci; …
NEW:
Le regole globali di `verify:library` (8 copertura spec, 9 tema, e la copertura design↔registry)
sono righe **globali**, fuori dalle voci; …
La **regola 10 (contrasto)** è **per componente** e misura i token **live**: le coppie si
ricavano dallo snapshot letto da Penpot (parte `text`/`icon` × parte `surface` che la contiene,
per cella, grazie al ruolo), non da `designs/*.design.json`; le coppie di catalogo
(`CATALOG_PAIRS`) restano globali. Un design committato che diverge da Penpot è un problema
nominativo della voce (kind `design-drift`), che rimanda a `pnpm sync:design -- <Comp>`: il
comando stampa il diff design committato ↔ Penpot, con `--yes` riscrive il design
(tmp + rename), non scrive mai su Penpot.
```

**2d. "Ricetta", vincoli, dopo la voce sulla geometria delle icone:**

```markdown
- `a11y.role` è un role unico **oppure** una mappa per un asse `option`
  (`{ "axis": "status", "values": { "info": "status", "success": "status", "warning": "alert",
  "error": "alert" } }`): ogni valore dell'asse ha il suo role ARIA valido, l'emitter lo emette
  per variante e il gate a11y verifica ogni variante (prova rosso/verde); una mappa su un asse
  `state`/`behavior` o incompleta è rifiutata dallo schema.
```

*Razionale:* 2b rende operativa la decisione su (c); 2c chiude il verde finto del warning a 1.82:1 e rende visibile ogni divergenza del design committato; 2d copre Alert (`status` per info/success, `alert` per warning/error).

### 4.3 `epics.md` — nuova Story 2.10 e rinumerazione (proposta 3, approvata)

Inserita dopo la Story 2.9:

```markdown
### Story 2.10: Fedeltà live ed estrazione guidata dal contratto

As a designer/sviluppatore,
I want che l'estrazione prenda il contratto come riferimento, misuri il contrasto su Penpot live
e che l'a11y possa variare per variante,
So that la libreria dei sei domini (2.11) nasca senza verdi finti, e quando il design si allontana
dal contratto la pipeline lo segnali e aiuti ad adattarlo invece di perderlo in silenzio
(FR2, NFR1, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il modulo condiviso delle regole della library fra estrazione e `verify:library`
(regole 2, 3, 6, 7), il registro delle proprietà della Story 2.8 e ogni parte di contratto con
un ruolo (`surface`/`text`/`icon`/`divider`, AD-11)
**When** estraggo o verifico un componente in cui una cella porta un token su una proprietà che
il ruolo della parte non ammette (es. `strokeColor` su una parte `text`, anche al posto del `fill`)
**Then** il solo componente è **in attesa**, con un messaggio che nomina componente, cella,
parte, ruolo, proprietà e token, e propone l'adattamento nell'ordine designer → ruolo che impara
la proprietà (riga della tabella ruolo → proprietà + mappatura + test rosso/verde) → cambio di
ruolo nel contratto (comando con diff e `--yes`, solo `SCHEMA_VERSION`)
**And** i contratti esistenti (Badge, Input, AccordionItem, Alert) dichiarano il ruolo delle
parti, `designs/*.design.json` lo eredita dal contratto invece di dichiarare `kind`, e l'output
generato resta byte-identico (`render:check` a diff zero)
**And** la regola 10 di `verify:library` misura le coppie testo/sfondo **per componente** sui
token dello snapshot live (parte `text`/`icon` × `surface` che la contiene, per cella), e un
contrasto sotto soglia rende rossa la voce del componente (prova rosso/verde con il caso Alert
`status=warning` a 1.82:1)
**And** un design committato diverso da Penpot è un problema `design-drift` della voce, e
`pnpm sync:design -- <Comp>` stampa il diff e con `--yes` riscrive `designs/<comp>.design.json`
(tmp + rename, mai scritture su Penpot); `alert.design.json` è riallineato con il comando
**And** `a11y.role` del giudizio accetta una mappa per un asse `option`; l'emitter emette il
role per variante e il gate a11y lo verifica per ogni variante; Alert emette `role="status"` per
`info`/`success` e `role="alert"` per `warning`/`error`
**And** la skill `pds-component` [PS] instrada i nuovi stati (proprietà fuori ruolo → i tre
adattamenti; `design-drift` → `sync:design`)
**And** ogni controllo nuovo ha una propria prova rosso/verde.
```

**Rinumerazione:** libreria 2.10 → **2.11**, Storybook 2.11 → **2.12**. Riferimenti: "So that" della 2.7 "(2.10)" → "(2.11)"; la Given della libreria guadagna "e l'estrazione guidata dal contratto della Story 2.10".

*Razionale:* a, b, c condividono la radice (il ruolo di parte); la libreria resta intatta.

### 4.4 `sprint-status.yaml` (proposta 4, approvata)

```yaml
# a. Chiavi Epic 2
OLD:
  2-10-libreria-componenti-accessibile: backlog
  2-11-storybook-del-design-system: backlog
NEW:
  2-10-fedelta-live-ed-estrazione-guidata-dal-contratto: backlog
  2-11-libreria-componenti-accessibile: backlog
  2-12-storybook-del-design-system: backlog

# b. Action item dropdown (retro Epic 1)
OLD: ...quando Story 2.10 genera il primo primitivo reale via Radix (ex 2.4, poi 2.7, poi 2.9)
NEW: ...quando Story 2.11 genera il primo primitivo reale via Radix (ex 2.4, poi 2.7, poi 2.9, poi 2.10)

# c. Intestazione
last_updated: "2026-09-15 (correct-course elasticità dell'estrazione: nuova Story 2.10 fedeltà live
  ed estrazione guidata dal contratto, libreria → 2.11, Storybook → 2.12; Epic 2 da 11 a 12 story)"
```

*Razionale:* le chiavi devono restare allineate 1:1 a `epics.md` (`bmad-build` risolve per i primi due segmenti numerici). La 2.10 resta `backlog` finché la story delle regole condivise non è done.

### 4.5 `deferred-work.md` (proposta 5, approvata)

**a. Righe `routed:` in coda alle voci** (testo storico invariato):

- verifica live 2.9, regola 10 → `routed: Story 2.10 (correct-course 2026-09-15) — regola 10 per componente sui token live + sync:design; alert.design.json riallineato con il comando.`
- code review 2.9, `role` unico → `routed: Story 2.10 (correct-course 2026-09-15) — a11y.role come mappa per asse option; Alert status/alert per variante.`
- riordino, regole 2/3/6/7 → `routed: in corso in un'altra sessione (2026-09-15); è la Given della Story 2.10, che resta backlog finché non è done.`
- `skill-manifest.csv`: resta aperta (non blocca la 2.10).

**b. Nuova sezione register, in fondo al file:**

```markdown
## Register: correct-course "elasticità dell'estrazione" (2026-09-15)

Pianificato da `sprint-change-proposal-2026-09-15.md`, prima della libreria:

- **Contratto come riferimento dell'estrazione** (decisione di Alessandro, variante A): ogni parte
  del contratto dichiara un ruolo (`surface`/`text`/`icon`/`divider`); la tabella ruolo →
  proprietà ammesse sta in `packages/scripts`, accanto al registro. Una proprietà fuori ruolo
  (es. `strokeColor` su un testo, anche al posto del `fill`) mette in attesa il solo componente e
  propone: designer → ruolo che impara la proprietà → cambio di ruolo nel contratto.
  Scartata la variante B (proprietà elencate per parte nel contratto): porterebbe il vocabolario
  Penpot in `@app/contracts` (AD-5). → AD-11, `penpot-pipeline.md`, **Story 2.10**.
- **Contrasto live + `sync:design`** e **role per variante** → **Story 2.10**.
- Rinumerazione: libreria **2.11**, Storybook **2.12**. I riferimenti storici di questo file a
  "Story 2.10" come libreria e "Story 2.11" come Storybook (register Alert, problema 7) valgono
  con i numeri nuovi.
- **Aperti:** vocabolario esatto dei ruoli e proprietà ammesse per ruolo (da fissare nella spec
  della 2.10); se `surface` con solo `strokeColor` (outline) resta ammesso senza `fill`.
```

## 5. Handoff di implementazione

**Classificazione: Moderate.** Aggiunge una story all'Epic 2, emenda AD-11 (senza toccarne la decisione di fondo) e aggiorna un companion normativo; rinumera due story in backlog, senza story file da rinominare.

**Destinatari.**
- **Developer (questa sessione):** applica le cinque modifiche approvate a `ARCHITECTURE-SPINE.md`, `penpot-pipeline.md`, `epics.md`, `sprint-status.yaml`, `deferred-work.md`, su un branch `bmad/` dedicato; verifica che non restino riferimenti ai vecchi numeri negli artefatti vivi.
- **Developer (altra sessione):** chiude la story delle regole condivise (2, 3, 6, 7).
- **Developer (sessioni successive):** `bmad-build` sulla **Story 2.10**, poi 2.11 libreria e 2.12 Storybook.
- **Alessandro:** vocabolario dei ruoli e proprietà ammesse per ruolo nella spec della 2.10; conferma del caso outline (`surface` con solo `strokeColor`).

**Criteri di successo.**
- `epics.md` elenca le story 2.1–2.12 con 2.10 fedeltà live/estrazione guidata dal contratto → 2.11 libreria → 2.12 Storybook.
- Le chiavi di `sprint-status.yaml` corrispondono una a una alle story di `epics.md`.
- AD-11 nomina il ruolo di parte; `penpot-pipeline.md` contiene la sezione "Ruolo di parte", la regola 10 per componente sui token live con `sync:design`, e `a11y.role` per variante.
- I tre rimandi di `deferred-work.md` hanno la riga `routed:` e il register nuovo è in fondo al file.
