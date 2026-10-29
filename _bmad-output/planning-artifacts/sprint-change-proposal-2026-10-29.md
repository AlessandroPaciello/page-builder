# Sprint Change Proposal — 2026-10-29

**Progetto:** page-builder · **Autore:** Alessandro (con Claude) · **Modalità:** batch · **Scope:** minor

**Stato:** approvata da Alessandro il 2026-10-29 e applicata sul branch `story/2-25-collaudo-aggiornamenti-penpot`.

## 1. Problema

Il 2026-10-29 la spec della Story 2.25 (collaudo degli aggiornamenti di Penpot) superava i 1600 token e Alessandro ha scelto di dividerla. La misura di quali operazioni di Penpot cancellano gli shared plugin data `pagebuilder` è uscita dalla spec ed è diventata una voce di `deferred-work.md` senza story assegnata.

`epics.md` però non è cambiato: l'AC della 2.25 chiede ancora quella misura. La 2.25 non si potrebbe chiudere contro il suo AC, e la misura resterebbe senza responsabile.

**Evidenza:** le ultime due voci di `deferred-work.md` (§ "Deferred from: spec della Story 2.25"), e il finding 10 del Review Triage Log della spec 2.25.

## 2. Impatto

- **Epic 2:** si completa come previsto. Cambiano solo gli AC della 2.25 e della 2.29. Nessuna story aggiunta, tolta o rinumerata.
- **Story 2.25:** l'AC perde la misura dei plugin data e tiene il "fill" dentro hug.
- **Story 2.29 (`pds-code`):** riceve la misura come primo AC. È la prima story che scrive plugin data, e il suo Given cita già il collaudo.
- **Artefatti:** SPEC, architettura e UX non cambiano. `penpot-pipeline.md` § CI e collaudo e `packages/scripts/collaudo/README.md` rimandano oggi a `deferred-work.md`: puntano alla 2.29.
- **Tecnico:** nessun codice. `sprint-status.yaml` invariato.

## 3. Strada scelta

Aggiustamento diretto (sforzo basso, rischio basso).

Alternativa scartata: una story nuova solo per la misura. Rinumererebbe un epic di 32 story, per un lavoro che serve proprio alla 2.29.

## 4. Modifiche

### 4.1 Story 2.25 — `epics.md`, Acceptance Criteria

PRIMA:
> **And** il collaudo misura quali operazioni di Penpot cancellano gli shared plugin data (raggruppa, booleane, copia tra file, ripristino, stacco) e se "fill" dentro hug è leggibile; l'esito è registrato nel README del collaudo e nel `penpot-pipeline.md`

DOPO:
> **And** il collaudo dice se "fill" dentro hug è leggibile; l'esito è registrato nel README del collaudo e nel `penpot-pipeline.md` (quali operazioni cancellano i plugin data si misura nella Story 2.29)

Motivo: la divisione della spec decisa da Alessandro il 2026-10-29.

### 4.2 Story 2.29 — `epics.md`, Acceptance Criteria (nuovo primo blocco)

Il blocco esistente (**Given** il server `pds`, il collaudo …) resta com'è e viene dopo. Questo blocco va prima:

> **Given** una copia del campione del collaudo (Story 2.25) sull'istanza di collaudo
> **When**, prima che la skill scriva plugin data, misuro a mano raggruppa, booleane, copia tra file, ripristino di versione, stacco dell'istanza e duplica
> **Then** per ogni operazione l'esito sugli shared plugin data `pagebuilder` (resta / si perde / si perde in parte) è registrato nel README del collaudo e in `penpot-pipeline.md` § CI e collaudo
> **And** la procedura del collaudo ripete queste operazioni come checklist a ogni aggiornamento di Penpot.

Motivo: la skill scrive `part`, `when`, `slot` e le risposte come plugin data. Prima deve sapere quali operazioni del designer li cancellano.

### 4.3 `_bmad-output/specs/spec-page-builder/penpot-pipeline.md` § CI e collaudo

PRIMA:
> Quali operazioni di Penpot cancellano i plugin data si misura sul campione in un passo a parte *(voce di `deferred-work.md`, prima della 2.29)*.

DOPO:
> Quali operazioni di Penpot cancellano i plugin data si misura sul campione nella Story 2.29, prima che `pds-code` scriva plugin data *(esito da registrare qui)*.

### 4.4 `packages/scripts/collaudo/README.md` § Esiti

PRIMA:
> … non si misura qui: è una voce di `deferred-work.md`, da fare sul campione prima della 2.29.

DOPO:
> … non si misura qui: lo misura la Story 2.29 sul campione, prima che `pds-code` scriva plugin data.

### 4.5 `_bmad-output/implementation-artifacts/deferred-work.md`

- Voce "Misurare a mano, una volta, …": in testa al summary va **routed: Story 2.29** (primo AC, correct-course 2026-10-29).
- Voce "l'AC della Story 2.25 in `epics.md` chiede ancora …": in testa al summary va **chiusa con il correct-course del 2026-10-29** (`epics.md` allineato, misura assegnata alla 2.29).

## 5. Passaggio

- **Scope minor:** le modifiche le applica direttamente lo sviluppatore (Claude, in questa sessione), sul branch `story/2-25-collaudo-aggiornamenti-penpot`. Entrano nella PR della 2.25.
- **Criterio di riuscita:**
  - in `epics.md` la 2.25 non chiede più la misura e la 2.29 la chiede come primo blocco;
  - `penpot-pipeline.md` e il README del collaudo rimandano alla 2.29;
  - le due voci di `deferred-work.md` sono una `routed` e una chiusa.
