---
stepsCompleted: ["step-01", "step-02", "step-03", "step-04"]
inputDocuments:
  - "_bmad-output/specs/spec-penpot-estrazione-costruzione/SPEC.md"
  - "_bmad-output/specs/spec-penpot-estrazione-costruzione/scope-roadmap.md"
  - "_bmad-output/specs/spec-penpot-estrazione-costruzione/extraction-flow.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-10-03/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md"
  - "_bmad-output/specs/spec-penpot-estrazione-costruzione/.memlog.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-10-03/.memlog.md"
---

# penpot-estrazione-costruzione - Epic Breakdown

## Overview

Questo documento decompone i requisiti dello SPEC (spec-kernel, in sostituzione del PRD), delle sue companion e della Architecture Spine dedicata in story implementabili. Il sistema è uno **strato agentico senza runtime**: gli step sono eseguiti dalla skill via MCP + repo, con la conferma umana in conversazione come unico gate (eccezione di scope ad AD-11 parent). Lo scope è token → organismi con livelli L0-L3 sequenziali; template e pagine restano a Puck via Tailwind theme.

> **Nota di percorso:** i Functional Requirements derivano 1:1 dalle capability dello SPEC (CAP-1…10); i vincoli tecnici (NFR/Additional) derivano dai constraint dello SPEC e dai 9 Architecture Decision (AD-1…AD-9) della spine dedicata, che eredita AD-3/AD-5/AD-6/AD-11 dalla parent. Ogni story eredita gli AD pertinenti come vincolo. File separato da `epics.md` (page-builder) per vita propria della slice. Decision record: [memlog SPEC](../specs/spec-penpot-estrazione-costruzione/.memlog.md) · [memlog spine](architecture/architecture-page-builder-2026-10-03/.memlog.md).

## Requirements Inventory

### Functional Requirements

FR1 (CAP-1): La skill costruisce componenti React leggendo il design Penpot via MCP al momento dell'estrazione, on-demand senza cache né fixture.
FR2 (CAP-2): La skill sceglie implementazione da-zero o su headless in base al segnale del design, usando profili headless+token versionati nel repo; senza configurazione suggerisce quella mancante invece di fallire.
FR3 (CAP-3): Prima di estrarre, la skill esegue il check iniziale obbligatorio (verifica headless+token, scansione MCP+repo, diff token Penpot vs codice) e propone l'allineamento applicabile in un colpo solo dopo conferma esplicita; mai errore secco senza proposta.
FR4 (CAP-4): Nessun metadato scritto a mano per singolo componente; contratto solo da segnali vivi MCP + convenzioni atomic + token Penpot.
FR5 (CAP-5): Regole di token e semantica proposte come fix applicabili, mai come blocchi; interpretazione confermata prima di generare.
FR6 (CAP-6): Se mancano requisiti, la skill li disegna o propone in Penpot via MCP invece di fallire; prima di estrarre passa il gate a 4 controlli (contratto esistente, ruoli ammessi, token nel vocabolario, nomi in convenzione) + convenzione nomi atomic.
FR7 (CAP-7): Doppio contratto di fedeltà — screenshot→Penpot giudicato da umano con problemi segnalati, Penpot→React verificato al gate H2 contro lettura congelata.
FR8 (CAP-8): Componenti esistenti mai sovrascritti alla cieca, solo diff di aggiornamento reviewabile su piano numerato.
FR9 (CAP-9): Copertura token → atomi → organismi con livelli L0-L3 sequenziali (il successivo bloccato fino a completamento del precedente); template e pagine a Puck con contratto via Tailwind theme.
FR10 (CAP-10): Intero flusso validato sul caso guida card (fedeltà screenshot → struttura Penpot → estrazione React con gate token verde).

### NonFunctional Requirements

NFR1 (No-runtime): Nessun package o modulo runtime per questo sistema; flusso come step della skill (AD-1).
NFR2 (Gate umano): Conferma umana in conversazione come unico gate, mappa H1 (allineamento+Penpot) / H2 (generazione); un sì = un piano-diff numerato; sì esecutivi mai persistenti (AD-2, eccezione di scope ad AD-11 parent).
NFR3 (Base congelata): Ogni stadio rilegge live e mostra fotografia e output; la fotografia congelata è l'unica base decisionale, la rilettura serve solo a invalidarla (AD-3).
NFR4 (Profili): JSON in `packages/scripts/profiles/<nome>.json`, campi obbligatori name/version/headless/tokens; validatore = rilettura skill + ratifica umana; profili per specie, mai per istanza (AD-4).
NFR5 (Mani): Vietato toccare file `@generated` e `tailwind-theme.css` generato; extras solo additivo; precedenza shadcn < extras < generato; un token un solo proprietario (AD-5).
NFR6 (Vocabolario unico): Token Penpot mappati a theme variables `@theme` (Tailwind v4 CSS-first) per Puck; nessuna struttura oltre gli organismi (AD-6).
NFR7 (Fedeltà): Giudizio umano, nessuno score pixel-perfect; riferimento card opzionale in `assets/card-reference/`, assenza non bloccante (AD-7).

### Additional Requirements

_Dalla Architecture Spine dedicata (AD-1…AD-9) e Stack — vincoli tecnici che impattano l'implementazione._

- **[NO-STARTER] Strato agentico brownfield:** nessuno scaffolding; la prima story utile è il primo profilo reale ( AD-4), non uno Story 1 di setup.
- **Ereditati parent:** AD-3 (headless solo in `ui/src/domains`), AD-5 (`packages/contracts` unica fonte), AD-6 (payload Puck, schemaVersion di contracts), AD-11 v2 (due contratti, istantanea, registro, marker `@generated`) salvo enforcement.
- **Stack pinnato e verificato al 2026-10-03:** Tailwind ^4.3.2 installato; `@base-ui/react` ^1.8.0 da installare al primo profilo headless (L1); `@puckeditor/core` 0.23.x differito a Epic 3/4 con riconferma; MCP Penpot esistente (docker/penpot, `PENPOT_MCP_TOKEN`).
- **Gate a 4 contenuti (AD-8):** contratto dichiarato esistente, ruoli di parte ammessi, token nel vocabolario, nomi in convenzione — esito go/no-go per voce prima del sì.

### UX Design Requirements

_Nessun contratto UX: skill senza interfaccia grafica. La UX conversazionale (tono, formato proposte/diff, conferme H1/H2, messaggistica di errore) è governata dagli AD e dagli step della skill; eventuale disegno dedicato (bmad-ux sullo strato conversazionale) resta opzionale e fuori da questo breakdown._

### FR Coverage Map

FR1: Epic 1 — lettura live MCP senza cache.
FR2: Epic 2 — scelta da-zero/headless con profili versionati.
FR3: Epic 1 — check iniziale, diff e proposta con conferma.
FR4: Epic 1 — zero metadati, contratto da segnali vivi.
FR5: Epic 1 — regole come fix, conferma pre-generate.
FR6: Epic 2 — auto-proposta Penpot e gate a 4 controlli.
FR7: Epic 3 — doppio contratto di fedeltà + checklist a freddo eseguita su atomo.
FR8: Epic 2 — update solo per diff.
FR9: Epic 4 — scope L0-L3 sequenziale e contratto Puck via theme.
FR10: Epic 4 — validazione end-to-end sul caso card con checklist della Epic 3.

## Refinement notes (elicitation 2026-10-03, tutte accettate)

- **Epic 1, story tracciante:** chiudere con un token verticale check→diff→proposta→conferma→apply come prova che il loop regge (reframe + pre-mortem momentum).
- **Epic 1, disciplina e trace:** includere rules-as-fixes come disciplina esplicita e linkare i decision record (memlog SPEC e spine) dal file.
- **Epic 1, story canarino:** osservare il primo loop H1/H2 per skip silenziosi e registrarlo; assunzione A1/A2 sotto osservazione.
- **Epic 2, reuse test:** il secondo profilo deve riusare il pattern del primo; eccezioni per-componente solo per amendment AD-4, mai silenziose (watch-item A6).
- **Epic 4, precondizione card:** prima story = provisioning riferimento card oppure proceed-with-flag esplicito.

## Epic List

### Epic 1: Fondamenta vive — leggere, diffare, proporre
Dopo questa epic, il sistema legge Penpot live, mostra diff token e propone fix chiedendo conferma — senza generare ancora nulla.
**FRs covered:** FR1, FR3, FR4, FR5

### Epic 2: Primo atomo estratto — profili, gate, generazione
Dopo questa epic, un atomo va da Penpot a React con profilo versionato, gate a 4 controlli verde e update solo per diff.
**FRs covered:** FR2, FR6, FR8

### Epic 3: Fiducia — checklist a freddo e giudizio su atomo
Dopo questa epic, esiste la checklist di fedeltà scritta a freddo (skill propone, umano ratifica) e il flusso è validato su un atomo della Epic 2 con go/no-go per voce + riga veto libera.
**FRs covered:** FR7

### Epic 4: Scala — molecole, organismi, caso card
Dopo questa epic, il sistema copre fino agli organismi con livelli sequenziali, la card è validata end-to-end con la checklist della Epic 3 e il vocabolario token via Tailwind theme è pronto per Puck.
**FRs covered:** FR9, FR10

## Epic 1: Fondamenta vive — leggere, diffare, proporre

Dopo questa epic, il sistema legge Penpot live, mostra diff token e propone fix chiedendo conferma — senza generare ancora nulla.
**FRs covered:** FR1, FR3, FR4, FR5

### Story 1.1: Prima lettura live con disciplina

As a dev,
I want la skill leggere Penpot via MCP + repo e mostrare la fotografia congelata con la disciplina rules-as-fixes,
So that ogni passo successivo ha una base verificabile e nessuna violazione passa muta.

**Acceptance Criteria:**

**Given** Penpot raggiungibile via MCP e repo leggibile
**When** eseguo lo step check
**Then** vedo struttura, token, screenshot e stato repo in un output congelato che lo step dopo cita come base (FR1, AD-3)
**And** ogni violazione di regola è proposta come fix applicabile, mai come blocco muto (FR5)
**And** `git grep` di metadati manuali per componente è vuoto e i decision record (memlog SPEC e spine) sono linkati dal file epic (FR4, refinement trace)

### Story 1.2: Diff token e proposta in un colpo

As a dev,
I want diff Penpot-vs-codice voce-per-voce più proposta applicabile in un colpo,
So that so esattamente cosa allineare prima di toccare nulla.

**Acceptance Criteria:**

**Given** la fotografia congelata della Story 1.1
**When** eseguo diff
**Then** vedo voci prima/dopo per file sulla base citata, senza basi miste (FR3, AD-3)
**And** la proposta è un piano-diff numerato con ordine, applicabile in un colpo solo dopo H1; mai errore secco senza proposta (FR3, AD-2)
**And** un token fuori vocabolario segue la via designer → registro → contratto, proposta come fix (FR5)

### Story 1.3: Canarino del primo gate H1

As a dev,
I want osservare il primo loop di conferma H1 e registrarne l'esito,
So that so se il gate convenzionale regge o viene saltato in silenzio.

**Acceptance Criteria:**

**Given** un piano-diff numerato dalla Story 1.2
**When** chiedo H1
**Then** il sì o no è esplicito in conversazione e nessun effetto parte senza (AD-2)
**And** l'esito (tenuta, frizioni, tentativi di skip) è registrato nel memlog SPEC come osservazione canarino (refinement audit A1/A2)
**And** il sì esecutivo non persiste oltre la sessione (AD-2)

### Story 1.4: Tracciante verticale su un token

As a dev,
I want applicare l'allineamento su un singolo token e verificarne la chiusura,
So that il loop completo è provato prima della Epic 2.

**Acceptance Criteria:**

**Given** H1 concessa sul piano della Story 1.2
**When** applico
**Then** un solo token cambia per la via decisa (rigenerazione via generate:theme oppure extras additivo, mai edit del generato) senza parziali silenziosi (AD-5)
**And** la rilettura successiva mostra diff vuoto sulla voce (chiusura verificata)
**And** il criterio L0 per quel token risulta soddisfatto e la Epic 2 può aprirsi (AD-9)

## Epic 2: Primo atomo estratto — profili, gate, generazione

Dopo questa epic, un atomo va da Penpot a React con profilo versionato, gate a 4 controlli verde e update solo per diff.
**FRs covered:** FR2, FR6, FR8

### Story 2.1: Primo profilo headless+token proposto e ratificato

As a dev,
I want il profilo del primo atomo proposto dalla skill e ratificato da me,
So that la scelta da-zero/headless ha una base versionata e approvata.

**Acceptance Criteria:**

**Given** il segnale del design dell'atomo scelto
**When** la skill propone il profilo
**Then** è un JSON in `packages/scripts/profiles/<nome>.json` con `name`, `version`, `headless`, `tokens` e nient'altro (FR2, AD-4)
**And** senza mia ratifica esplicita il profilo non si usa; senza profilo corrispondente vedo un suggerimento, mai un fail muto (FR2, AD-4)
**And** il profilo descrive la specie headless, non l'istanza: nessun dato per-componente dentro (AD-1, AD-4)

### Story 2.2: Gate a 4 controlli con auto-proposta Penpot

As a dev,
I want l'esito dei 4 controlli mostrato prima di qualsiasi sì, con proposta in Penpot se mancano requisiti,
So that il mio sì approva un esito visibile, non una promessa.

**Acceptance Criteria:**

**Given** il profilo ratificato della Story 2.1 e la lettura live
**When** la skill esegue il gate
**Then** vedo go/no-go per voce: contratto esistente, ruoli ammessi, token nel vocabolario, nomi in convenzione (FR6, AD-8)
**And** se mancano requisiti vedo disegno o proposta tracciabile in Penpot via MCP invece di un fallimento (FR6)
**And** H1 copre anche eventuale disegno su Penpot, per la mappa fissa H1/H2 (AD-2)

### Story 2.3: Prima generazione con H2 e update solo diff

As a dev,
I want i file dell'atomo generati solo dopo H2, e mai sovrascritti alla cieca in seguito,
So that la prima estrazione è consapevole e le successive sono reviewabili.

**Acceptance Criteria:**

**Given** gate verde della Story 2.2
**When** la skill propone i file e chiedo H2
**Then** niente è scritto prima del sì; i file rispecchiano lettura congelata e profilo (FR6-chiusura, AD-2, AD-3)
**And** una seconda estrazione dello stesso atomo produce diff reviewabile su piano numerato, mai sostituzione integrale (FR8, AD-5, AD-2)

### Story 2.4: Reuse test del pattern profilo

As a dev,
I want il secondo profilo costruito riusando il pattern del primo,
So that i profili restano una specie versionata e non proliferano per componente.

**Acceptance Criteria:**

**Given** il profilo ratificato della Story 2.1
**When** serve un secondo profilo
**Then** riusa formato, sede e convenzioni del primo; deviazioni solo motivate e ratificate (refinement pre-mortem, AD-4)
**And** un'esigenza per-componente non coperta dalla specie si scala ad amendment AD-4 esplicito, mai a metadato silenzioso (watch-item A6)

## Epic 3: Fiducia — checklist a freddo e giudizio su atomo

Dopo questa epic, esiste la checklist di fedeltà scritta a freddo (skill propone, umano ratifica) e il flusso è validato su un atomo della Epic 2 con go/no-go per voce + riga veto libera.
**FRs covered:** FR7

### Story 3.1: Checklist di fedeltà scritta a freddo e ratificata

As a designer,
I want i criteri di fedeltà scritti prima di vedere l'output, proposti dalla skill e ratificati da me,
So that quando giudico non sto difendendo il mio lavoro.

**Acceptance Criteria:**

**Given** nessun output ancora mostrato per il soggetto
**When** la skill propone la checklist
**Then** è una lista di voci secche e spuntabili in una schermata, con go/no-go per voce e una riga veto libera "altro che non torna" (FR7, decisione party)
**And** senza mia ratifica la checklist non si usa (pattern proposta-fredda/ratifica-calda, AD-4 per analogia)

### Story 3.2: Giudizio di fedeltà su atomo con la checklist

As a designer,
I want eseguire la checklist su un atomo della Epic 2,
So that il giudizio è tracciabile voce per voce invece che a sensazione.

**Acceptance Criteria:**

**Given** la checklist ratificata della Story 3.1 e l'atomo estratto
**When** eseguo il giudizio
**Then** ogni voce ha esito go/no-go registrato in conversazione; problemi espliciti, mai silenzi (FR7, AD-7)
**And** la riga veto libera può bocciare anche a voci verdi (decisione party/Winston)

### Story 3.3: Verifica coerenza Penpot→React a H2

As a dev,
I want confrontare i file proposti con la lettura Penpot congelata al gate H2,
So that il React rispecchia struttura e token Penpot per verifica, non per fiducia.

**Acceptance Criteria:**

**Given** i file proposti e la lettura congelata
**When** arrivo a H2
**Then** confronto struttura e token contro la lettura; scostamenti solo se segnalati esplicitamente (FR7 contratto 2, AD-7, AD-3)
**And** senza H2 niente è scritto (AD-2)

## Epic 4: Scala — molecole, organismi, caso card

Dopo questa epic, il sistema copre fino agli organismi con livelli sequenziali, la card è validata end-to-end con la checklist della Epic 3 e il vocabolario token via Tailwind theme è pronto per Puck.
**FRs covered:** FR9, FR10

### Story 4.1: Precondizione card — riferimento o proceed-with-flag

As a dev,
I want il riferimento card disponibile oppure un proceed-with-flag esplicito,
So that la validazione finale non si blocca in silenzio per materiale mancante.

**Acceptance Criteria:**

**Given** il percorso `assets/card-reference/`
**When** apro la Epic 4
**Then** trovo `screenshot.png` + `penpot-link.md`, oppure dichiaro proceed-with-flag esplicito e si procede con segnalazione (refinement pre-mortem, AD-7)
**And** i livelli precedenti risultano completi secondo AD-9, altrimenti la Epic 4 non si apre (FR9, AD-9)

### Story 4.2: Prima molecola con gate e reuse

As a dev,
I want una molecola estratta componendo atomi validati, senza nuovi token impliciti,
So that L2 si apre su fondamenta verificate.

**Acceptance Criteria:**

**Given** atomi della Epic 2 con gate verde
**When** estraggo la molecola
**Then** check, gate a 4 controlli, H1/H2 e diff-only valgono come per gli atomi (FR9, AD-9, AD-2, AD-8)
**And** nessun token nuovo implicito: ogni token è nel vocabolario o segue la via designer→registro→contratto (FR9, AD-5)

### Story 4.3: Card validata end-to-end con checklist

As a designer e dev,
I want la card giudicata con la checklist della Epic 3 ed estratta in React coerente,
So that il flusso completo è provato sul caso guida.

**Acceptance Criteria:**

**Given** la checklist ratificata (Story 3.1) e il riferimento della Story 4.1
**When** giudico ed estraggo
**Then** fedeltà screenshot→Penpot con go/no-go per voce + veto; problemi espliciti o niente estrazione silenziosa (FR10, FR7, AD-7)
**And** React coerente a struttura e token Penpot, verificato a H2; gate componente-token verde (FR10, CAP-10, AD-7)

### Story 4.4: Vocabolario theme pronto per Puck

As a dev,
I want i token esposti come theme variables pronte per Puck, con handoff documentato,
So that template e pagine futuri consumano un solo vocabolario.

**Acceptance Criteria:**

**Given** i token allineati dei livelli L0-L3
**When** verifico il theme
**Then** ogni token ha la sua variabile `@theme` e nessuna classe fuori theme; extras solo additivo (FR9, AD-6, AD-5)
**And** l'handoff verso Puck è documentato e l'installazione resta differita con versione da riconfermare (AD-6, Deferred)
