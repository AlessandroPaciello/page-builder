---
stepsCompleted: ["step-01"]
inputDocuments:
  - "_bmad-output/specs/spec-penpot-estrazione-costruzione/SPEC.md"
  - "_bmad-output/specs/spec-penpot-estrazione-costruzione/scope-roadmap.md"
  - "_bmad-output/specs/spec-penpot-estrazione-costruzione/extraction-flow.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-10-03/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md"
---

# penpot-estrazione-costruzione - Epic Breakdown

## Overview

Questo documento decompone i requisiti dello SPEC (spec-kernel, in sostituzione del PRD), delle sue companion e della Architecture Spine dedicata in story implementabili. Il sistema è uno **strato agentico senza runtime**: gli step sono eseguiti dalla skill via MCP + repo, con la conferma umana in conversazione come unico gate (eccezione di scope ad AD-11 parent). Lo scope è token → organismi con livelli L0-L3 sequenziali; template e pagine restano a Puck via Tailwind theme.

> **Nota di percorso:** i Functional Requirements derivano 1:1 dalle capability dello SPEC (CAP-1…10); i vincoli tecnici (NFR/Additional) derivano dai constraint dello SPEC e dai 9 Architecture Decision (AD-1…AD-9) della spine dedicata, che eredita AD-3/AD-5/AD-6/AD-11 dalla parent. Ogni story eredita gli AD pertinenti come vincolo. File separato da `epics.md` (page-builder) per vita propria della slice.

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

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
