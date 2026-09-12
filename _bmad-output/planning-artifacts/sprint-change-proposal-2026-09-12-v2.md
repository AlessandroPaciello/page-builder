---
workflow: bmad-correct-course
date: 2026-09-12
author: Alessandro (con agente Developer)
mode: incrementale
scope: Moderate
status: approved
trigger: register "test end-to-end della pipeline su Alert" in `_bmad-output/implementation-artifacts/deferred-work.md` (PR #31)
supersedes: nessuna — si aggiunge a `sprint-change-proposal-2026-09-12.md` (forge Penpot shadcn + esagono Puck)
---

# Sprint Change Proposal — Pipeline pronta per più componenti e skill `pds-component`

## 1. Sintesi del problema

**Trigger.** Dopo il merge della Story 2.6 (PR #30) Alessandro ha messo alla prova la pipeline Penpot→codice con un test manuale su un componente nuovo, Alert (dominio `feedback`, 3 parti, asse `option`), su un branch usa e getta. Il componente è stato portato da contratto a `.tsx` e fatto evolvere nei quattro casi reali: componente nuovo, variante aggiunta dal contratto (`warning`), token cambiati dal designer in Penpot, variante aggiunta dal designer in Penpot (`info`). Esiti registrati in `deferred-work.md` e mergiati con la PR #31.

**Tipo.** Limiti tecnici scoperti esercitando la pipeline, non un cambio di obiettivi. La pipeline regge un componente alla volta; non regge ancora un catalogo che cresce né un design che evolve senza passaggi fuori dai comandi.

**Problema.** La prossima story in piano, la libreria dei sei domini (oggi 2.7), moltiplica i componenti e incontrerebbe tutti i buchi trovati:
- l'emitter ignora `judgment.a11y`: `role`/`aria-*` non arrivano nel `.tsx` e il gate a11y resta verde lo stesso — l'AC "ARIA corretto" della libreria non sarebbe verificabile;
- ogni contratto nuovo fa fallire 42 test di `scripts` (liste di design scritte a mano);
- una variante nuova non ha una via CLI per arrivare in Penpot (`addCell` assente) né per essere adottata nel contratto (`adopt:variant` assente);
- nessuna skill guida il ciclo di vita di un componente oltre il container Penpot.

**Evidenze.** Gli otto problemi del register, ciascuno con la prova osservata:
1. `role: "alert"` dichiarato nel giudizio e presente nella base shadcn, assente dal `.tsx` generato; `gates:render` 5/5 verde.
2. Il field `title` di Alert ombreggia l'attributo HTML `title` del `div`.
3. `Design mancante per il contratto "alert"` in 42 test di `library-plan`/`penpot-writer`; `contracts` asserisce "esattamente tre contratti".
4. La cella `warning` è arrivata in Penpot solo con uno script usa e getta via `execute_code` (fuori dalla regola "nessuna scrittura su Penpot fuori dai comandi CLI").
5. Con il contratto a `alert@2` e il plugin data a `alert@1` l'estrazione fallisce e nessun comando aggiorna il plugin data.
6. `color.warning`/`color.info` come testo su `card` non sono coperti dalla regola 10 di `verify:library` (misurati a parte: 4.87:1 e 7.96:1).
7. Le story generate mettono le props fuori da `args`: in Storybook renderizzerebbero il componente senza props.
8. `verify:library` verde con un container `Alert` (`alert@1`) senza contratto nel registry.

## 2. Analisi d'impatto

### Epic

| Epic | Impatto |
|---|---|
| 2 | **Da 8 a 10 story.** Due story nuove prima della libreria: 2.7 pipeline, 2.8 skill; la libreria passa da 2.7 a 2.9, Storybook da 2.8 a 2.10. Obiettivo e FR coperti invariati. |
| 3 | Nessuna modifica. Consuma `ui/domains` e i contratti e beneficia delle correzioni. |
| 4–6 | Nessun impatto. |

Nessuna epic diventa obsoleta, non servono epic nuove, l'ordine delle epic non cambia.

### Artefatti

- **SPEC (in sostituzione del PRD):** nessun conflitto, **l'MVP non cambia**. CAP-2 cita "cinque gate": il controllo di presenza di `role`/`aria-*` rientra nel gate A11y esistente, che già promette "conformità alla a11y-baseline" — si ripara un gate che non mantiene la promessa, non se ne aggiunge un sesto.
- **Architecture Spine:** nessuna modifica in questa proposta. AD-6 fissa il bump di `schemaVersion` a ogni cambio di contratto ma non dice quando si alza la versione del contratto (`nome@versione`) né come la si porta in Penpot: lacuna di decisione (problema 5) affidata all'AC della nuova Story 2.7, "decisa e documentata". AD-11 invariata.
- **`penpot-pipeline.md`:** lo Stadio 0 limita l'additiva ai "contratti nuovi" e non dice nulla sull'adozione di varianti nate in Penpot — va aggiornato (proposta 4).
- **UX:** nessun impatto.
- **Artefatti di implementazione:** `sprint-status.yaml` (chiavi Epic 2 e un action item), `deferred-work.md` (tre riferimenti). `epic-2-context.md` si invalida da sé quando `epics.md` cambia e verrà ricompilato da `bmad-build`: nessuna modifica manuale.

### Impatto tecnico

Nessuno in questa proposta: il codice (emitter, `verify:library`, `add:library`, i nuovi comandi, la skill, la CI) cambia dentro le story 2.7, 2.8 e 2.10. Le due story rinumerate sono in `backlog` senza story file: nessun file da rinominare.

## 3. Approccio raccomandato

**Aggiustamento diretto** (opzione 1): due story nuove dentro l'Epic 2 e rinumerazione delle due successive.

**Scartate.**
- *Rollback* della 2.6: la 2.6 è corretta, i problemi stanno in ciò che la segue.
- *Revisione dell'MVP*: l'MVP non cambia.
- *Una sola story* per pipeline e skill: troppo grande, e la skill dipende dalla pipeline (regola "prima i comandi, poi la skill").
- *Prerequisiti come task della libreria*: la libreria (sei domini) è già grande, e i prerequisiti non sarebbero tracciati in `sprint-status.yaml`.

**Motivazione.** Il test ha trovato i buchi prima che la libreria li moltiplicasse; inserirli ora costa due story in backlog e nessuna rilavorazione.

**Sforzo e rischio.** Proposta: basso/basso. Story 2.7: media (comandi e regole nuove, ognuna con prova rosso/verde). Story 2.8: media, dipende dalla 2.7.

**Impatto sulla timeline.** Epic 2 passa da 8 a 10 story; la libreria slitta di due story.

## 4. Proposte di modifica dettagliate (approvate in modalità incrementale)

### 4.1 `epics.md` — nuova Story 2.7 (proposta 1, approvata)

Inserita dopo la Story 2.6.

```markdown
### Story 2.7: Pipeline pronta per più componenti

As a sviluppatore,
I want che la pipeline regga un catalogo di componenti che cresce e un design che evolve,
So that la libreria dei sei domini (2.9) si generi senza verdi finti né passaggi a mano fuori dai comandi (FR2, NFR1, AD-11).

**Acceptance Criteria:**

**Given** un giudizio che dichiara `role` e/o `ariaAttributes`
**When** genero il componente
**Then** l'emitter li emette nel `.tsx` e il gate a11y fallisce se un attributo dichiarato manca dal componente generato (prova rosso/verde)
**And** aggiungere un contratto con il suo design non richiede di modificare liste scritte a mano nei test né nel CLI: design e liste sono derivati da `designs/*.design.json` e da `COMPONENT_CONTRACTS`, con un test di copertura design↔registry
**And** `add:library` crea le celle mancanti di un container esistente (`addCell`, additiva, con guardia anti-duplicato), e `adopt:variant -- <Comp>` rileva i valori d'asse presenti in Penpot e assenti dal contratto, propone il diff e, su conferma, aggiorna contratto, `SCHEMA_VERSION` + fingerprint, binding e design; fallisce con errore nominativo quando la variante non è esprimibile (proprietà che varia con due assi, assi `state`/`behavior` senza mapping 1:1)
**And** `verify:library` segnala i container il cui plugin data dichiara un contratto inesistente e ricava le coppie di contrasto testo/sfondo dai design invece che da una lista
**And** un field di contratto con il nome di un attributo HTML globale (es. `title`) è rifiutato
**And** la regola per alzare la versione di un contratto già presente in Penpot (`nome@versione`) è decisa e documentata in `penpot-pipeline.md`, con il comando o il vincolo che la applica
**And** ogni controllo nuovo ha una propria prova rosso/verde.
```

**Motivazione.** Copre i problemi 1–6 e 8 e i due comandi mancanti. Senza, la libreria non può rispettare "ARIA corretto" e porterebbe ogni contratto a decine di test rossi. La decisione sulla versione del contratto resta dentro la story, da prendere con i dati.

### 4.2 `epics.md` — nuova Story 2.8 (proposta 2, approvata)

Inserita dopo la nuova Story 2.7.

```markdown
### Story 2.8: Skill `pds-component` — creare e sincronizzare i componenti

As a sviluppatore,
I want una skill che mi guidi nel ciclo di vita di un componente, dalla creazione all'allineamento con Penpot,
So that aggiungere o aggiornare un componente non richieda di conoscere a memoria l'ordine dei comandi, i file da scrivere e le decisioni che spettano a me (FR2, AD-11).

**Acceptance Criteria:**

**Given** la pipeline della Story 2.7
**When** invoco la voce **[PC] Crea componente** per un componente assente dal registry e da Penpot
**Then** la skill chiede assi, parti, dominio, a11y e l'aspetto delle celle, scrive contratto e design, crea il container richiamando `pds-additive`, poi guida giudizio, binding, base shadcn, estrazione, render, barrel e gate
**And** la voce **[PS] Sincronizza componente** legge lo stato con `verify:library` e `gates:render` e sceglie il percorso: drift → riestrazione e render con diff; valore d'asse in più da Penpot → `adopt:variant`; cella mancante → `addCell`; proprietà senza token → indicazione al designer
**And** la skill si ferma solo sulle decisioni umane, non scrive mai su Penpot né sui contratti fuori dai comandi CLI, e l'esito è sempre l'exit code degli script, mai il prompt
**And** `pds-additive` al passo 3, dopo aver riportato una differenza, indica la voce che la risolve; le due voci sono registrate nel `module-help.csv` di `pds-setup`
**And** la skill è costruita con `bmad-workflow-builder` e verificata eseguendo i due percorsi su un componente reale.
```

**Motivazione.** Mette in pratica il piano e la decisione sulla suite `pds` (opzione A: si aggiunge, non si ristruttura). Dipende dalla 2.7 per costruzione; l'ultimo AC evita una skill scritta ma mai eseguita.

### 4.3 `epics.md` — rinumerazione in 2.9 e 2.10 (proposta 3, approvata)

**a. Libreria: da 2.7 a 2.9.**

OLD:
```markdown
### Story 2.7: Libreria componenti accessibile
...
**Given** i token generati, i contratti e l'emitter della Story 2.6
**When** genero i componenti per i sei domini (data-display, inputs, feedback, layout, navigation, overlays) in `packages/ui/src/domains`, ciascuno con prima il proprio contratto e il proprio container Penpot (skill additiva)
```
NEW:
```markdown
### Story 2.9: Libreria componenti accessibile
...
**Given** i token generati, i contratti, l'emitter della Story 2.6 e la pipeline della Story 2.7
**When** genero i componenti per i sei domini (data-display, inputs, feedback, layout, navigation, overlays) in `packages/ui/src/domains`, ciascuno creato con la voce [PC] di `pds-component` (Story 2.8): prima il contratto e il container Penpot, poi estrazione e render
```
Gli AC successivi restano invariati.

**b. Storybook: da 2.8 a 2.10, con un AC in più.**

OLD:
```markdown
### Story 2.8: Storybook del design system
...
**Then** le storie dei componenti sono navigabili con i token applicati e l'addon a11y attivo
**And** il build statico di Storybook è prodotto senza errori.
```
NEW:
```markdown
### Story 2.10: Storybook del design system
...
**Then** le storie dei componenti sono navigabili con i token applicati e l'addon a11y attivo
**And** l'emitter genera le story in CSF3 valido, con le props in `args`, e un gate esegue le story generate (smoke test), così una story che rende il componente senza props è un test rosso
**And** il build statico di Storybook è prodotto senza errori.
```

**Motivazione.** (a) Rende esplicita la dipendenza da 2.7 e 2.8 senza ridurre lo scope della libreria. (b) Copre il problema 7 dove è verificabile, cioè quando Storybook esiste, con un gate che impedisce al difetto di tornare invisibile.

### 4.4 `penpot-pipeline.md` — Stadio 0 (proposta 4, approvata)

OLD:
```markdown
- **additiva**: crea solo componenti/token mancanti richiesti da un contratto nuovo; non modifica né cancella mai ciò che esiste — le differenze si **segnalano**.

Nessuna sincronizzazione ricorrente codice→Penpot (due sorgenti, conflitto irrisolvibile). Le skill guidano e fanno domande; **pass/fail sta negli script e negli schemi**, mai nel prompt.
```
NEW:
```markdown
- **additiva**: crea solo ciò che manca — componenti e token richiesti da un contratto nuovo, e le **celle** di un container esistente richieste da un valore d'asse nuovo del contratto; non modifica né cancella mai ciò che esiste — le differenze si **segnalano**, indicando dove si risolvono.

**Adozione di una variante nata in Penpot.** Se il designer aggiunge in Penpot un valore d'asse che il contratto non ha, la pipeline lo **rileva** (`verify:library` rosso, estrazione ferma senza scrivere) ma non lo adotta da sola: una variante è un nuovo valore di prop per l'editor e un bump di `schemaVersion` (AD-6), quindi entra nel contratto solo con una **decisione esplicita** di chi sviluppa. Presa la decisione, i passi derivati (contratto, `schemaVersion`, binding, design) sono meccanici e affidati a un comando, non al prompt. Il contratto resta del page builder: l'adozione è una decisione in codice, non una sincronizzazione Penpot→codice.

Nessuna sincronizzazione ricorrente codice→Penpot (due sorgenti, conflitto irrisolvibile). Le skill guidano e fanno domande; **pass/fail sta negli script e negli schemi**, mai nel prompt.
```

**Motivazione.** Senza, `addCell` e `adopt:variant` contraddirebbero la spec normativa della pipeline. Il paragrafo fissa il principio osservato nel test: rilevare è automatico, adottare è una decisione.

### 4.5 `sprint-status.yaml` (proposta 5, approvata)

**a. Chiavi Epic 2.**

OLD:
```yaml
  2-7-libreria-componenti-accessibile: backlog
  2-8-storybook-del-design-system: backlog
```
NEW:
```yaml
  2-7-pipeline-pronta-per-piu-componenti: backlog
  2-8-skill-pds-component: backlog
  2-9-libreria-componenti-accessibile: backlog
  2-10-storybook-del-design-system: backlog
```

**b. Action item della retro Epic 1:** "quando Story 2.7 genera il primo primitivo reale via Radix (ex 2.4)" → "quando Story 2.9 genera il primo primitivo reale via Radix (ex 2.4, poi 2.7)".

**c. Intestazione:** `# last_updated: 2026-09-12 (correct-course: Epic 2 da 8 a 10 story)`.

**Motivazione.** La risoluzione delle chiavi confronta i primi due segmenti numerici: `2-7` deve corrispondere alla Story 2.7 di `epics.md`, altrimenti `bmad-build` aprirebbe la story sbagliata.

### 4.6 `deferred-work.md` — riferimenti (proposta 6, approvata)

- **a.** Voce sul dropdown: "(**Story 2.7**, ex 2.4 — rinumerata dal correct-course 2026-09-12)" → "(**Story 2.9**, ex 2.4, poi 2.7 — rinumerata dai correct-course del 2026-09-12)".
- **b.** Register Alert: "Da riprendere **prima o dentro la Story 2.7**, che moltiplica i componenti." → "Pianificato dal correct-course del 2026-09-12 (sprint-change-proposal-2026-09-12-v2.md): problemi 1–6 e 8 e i comandi mancanti nella **Story 2.7**, la skill nella **Story 2.8**, il problema 7 nella **Story 2.10** — tutto prima della libreria (**Story 2.9**), che moltiplica i componenti."
- **c.** Problema 7: "in 2.8, un gate … Da riprendere **in Story 2.8**, o prima se la 2.7 rigenera molte story." → "in 2.10, un gate … Da riprendere **in Story 2.10** (Storybook, ex 2.8), o prima se la 2.9 rigenera molte story."

**Motivazione.** Il register non deve rimandare a numeri superati ("Story 2.8" indicherebbe la skill invece di Storybook); la frase b collega ogni problema alla story che lo risolve.

## 5. Handoff di implementazione

**Classificazione: Moderate.** Riorganizza il backlog dell'Epic 2 (due story nuove, due rinumerate) e aggiorna una spec di pipeline; non riscrive decisioni architetturali né lo SPEC.

**Destinatari.**
- **Developer (questa sessione):** applica le sei modifiche approvate a `epics.md`, `penpot-pipeline.md`, `sprint-status.yaml`, `deferred-work.md`; verifica che non restino riferimenti ai vecchi numeri negli artefatti vivi.
- **Developer (sessioni successive):** `bmad-build` sulla Story 2.7, poi 2.8, poi 2.9 e 2.10. Il contesto dell'Epic 2 (`epic-2-context.md`) viene ricompilato automaticamente alla prima esecuzione.
- **Alessandro:** decisione sulla versione del contratto in Penpot (problema 5) quando la Story 2.7 la porta sul tavolo.

**Criteri di successo.**
- `epics.md` elenca le story 2.1–2.10 nell'ordine 2.6 → 2.7 pipeline → 2.8 skill → 2.9 libreria → 2.10 Storybook.
- Le chiavi di `sprint-status.yaml` corrispondono una a una alle story di `epics.md`.
- Nessun artefatto vivo rimanda alla libreria come "2.7" o a Storybook come "2.8"; le story chiuse (2.3, 2.4) restano invariate come registro storico.
- Ogni problema del register ha una story di destinazione.
