---
workflow: bmad-correct-course
date: 2026-10-17
author: Alessandro (con agente Developer)
mode: batch
scope: Major
status: approved
trigger: spike penpot-ai-kit (2026-10-10/11) e tre forgie HARDENED (2026-10-13, 2026-10-17, 2026-10-17) — pipeline Penpot → codice v3
supersedes:
  - "AD-11 v2 della spine 2026-07-25 (rivista il 2026-09-17)"
  - "spine 2026-10-03 penpot-estrazione-costruzione (AD-1…AD-9) e la sua SPEC (CAP-1…CAP-10)"
  - "SPEC-refactor-packages-scripts (v2: due contratti, istantanea, sei comandi)"
  - "Story 2.17 (skill pds-* sui sei comandi) e i backlog di Epic 2–4 della slice estrazione-costruzione"
sources:
  - _bmad-output/spikes/penpot-ai-kit-2026-10-10/README.md
  - _bmad-output/forge/pds-v3-penpot-ai-kit/forged-idea.md
  - _bmad-output/forge/pds-v3-scripts/forged-idea.md
  - _bmad-output/forge/pds-v3-punti-aperti/forged-idea.md
branch: chore/correct-course-pds-v3 (da spike/penpot-ai-kit, `eb0d899`, perché le quattro fonti esistono solo lì)
---

# Sprint Change Proposal — pds v3, la pipeline Penpot → codice

## 1. Sintesi del problema

**Trigger.** Lo spike su [penpot-ai-kit](../spikes/penpot-ai-kit-2026-10-10/README.md) (prove A–F, simulazione completa sul Carousel) ha mostrato che un designer che parte da un file vuoto col kit ufficiale di Penpot arriva al codice, e che un generatore **generico** (nessuna riga per componente) è possibile. Ha anche trovato bug seri nella pipeline in servizio, il più grave dei quali è che **il tema Penpot non entra nel CSS compilato**. Tre forgie, tutte HARDENED, hanno poi fissato il modello v3:

| Fonte | Data | Cosa fissa |
|---|---|---|
| [Spike](../spikes/penpot-ai-kit-2026-10-10/README.md) | 2026-10-10/11 | 13 decisioni di Alessandro, modello a due skill, problemi trovati, confronto con le decisioni precedenti |
| [Forgia 1 — regole](../forge/pds-v3-penpot-ai-kit/forged-idea.md) | 2026-10-13 | 9 regole: chiave `part` in Penpot, `styles.ts` controllato da `tsc`, CI senza Penpot, configurazione di progetto, ruoli di parte e livelli L0–L3 eliminati |
| [Forgia 2 — script](../forge/pds-v3-scripts/forged-idea.md) | 2026-10-17 | TypeScript, nucleo puro + un adattatore + server MCP `pds` come unico guscio, niente CLI, CI a quattro livelli, collaudo Penpot con campione `.penpot` |
| [Forgia 3 — punti aperti](../forge/pds-v3-punti-aperti/forged-idea.md) | 2026-10-17 | `part`/`when`/`slot` li scrive `pds-code` (corregge la regola 1), domande, geometria (a′), font, sezioni = slot, comportamento Base UI → ricetta, stati, axe bloccante |

**Tipo.** Cambio di modello deciso, non un errore di implementazione: le Story 2.12–2.16 hanno fatto quello che dicevano. La v2 resta nella storia git; da qui la sorgente di verità della pipeline sono le quattro fonti, che questa proposta **non riapre**.

**Premesse (di Alessandro, non in discussione).**
- AD-11 v2 e la spine 2026-10-03 si scartano. Delle vecchie regole si conserva solo il rischio che prevenivano, se vale ancora (§2.3). Le AD non legate alla pipeline (editor, Puck, RBAC, snapshot di contenuto, render, commerce) restano valide.
- I cinque componenti generati nel repo (Badge, Input, Alert, AccordionItem, ProductCard) sono test pushati per errore: si rimuovono e si rigenerano con la v3.
- Il codice dello spike sta solo in [`test-v3/`](../spikes/penpot-ai-kit-2026-10-10/test-v3/README.md): è riferimento, non si copia così com'è.

**Stato del repo al trigger.** `develop` = `999ba13` (Story 2.16 mergiata, PR #56; 2.15 mergiata in `186f0c5`). In `sprint-status.yaml` 2.15 e 2.16 risultano ancora `review`: va riallineato (§4.5). La Story 2.17 ha un commit solo sul branch `story/2-17-skill-pds-sui-sei-comandi` (`6e9083c`), mai mergiato.

## 2. Analisi dell'impatto

### 2.1 Epic

| Epic | Impatto |
|---|---|
| Epic 1 | nessuno (done). La slice "Fondamenta vive" (1.1–1.4 della spine 2026-10-03) resta come storia |
| **Epic 2** | **ripianificato da 2.17 in poi**: 2.1–2.16 restano come storia; 2.17 sparisce; entrano 15 story v3 (2.17–2.31) e la libreria dei sei domini diventa 2.32 (ex 2.18, riscritta). Epic 2 passa da 18 a 32 story |
| Epic 3 | Story 3.4 riscritta (sezioni nell'editor, forma disegnata non più errore); ritocco a 3.2 (niente assi `state`/`behavior` nel contratto) |
| Epic 4–6 | nessuno. Contratti dell'editor, fingerprint, `SCHEMA_VERSION`, payload Puck invariati |
| Slice estrazione-costruzione, Epic 2–4 | **spariscono** (profili, gate a 4 controlli, H2, livelli, checklist): le loro voci in `sprint-status.yaml` si tolgono |

### 2.2 SPEC (fa da PRD) e companion

| Documento | Sezione | Cambia |
|---|---|---|
| `SPEC.md` | CAP-1 success | il tema nasce da un seme `theme.css` (Tailwind v4 + ruoli shadcn), passa in Penpot, poi Penpot è la fonte e la rigenerazione scrive `theme.css`, un file per variante di tema e `fonts.css` |
| `SPEC.md` | CAP-2 intent e success | **riscritti**: niente fixture, ricetta, cinque gate; si generano solo gli stili (`<Comp>.styles.ts`) e le story, il componente è dello sviluppatore dopo lo scaffold; CI senza Penpot a quattro livelli |
| `SPEC.md` | CAP-3 success | comportamento da Base UI o da ricetta shadcn + pattern APG; axe bloccante su ogni story generata; default globali di focus e disabled |
| `SPEC.md` | CAP-4 intent | una sezione è un contratto dell'editor con almeno uno slot, disegnata in Penpot come un componente; non più "albero estratto" |
| `SPEC.md` | Constraint 1 | "token e componenti sono generati" → "token e stili sono generati; il componente React è dello sviluppatore e la rigenerazione non lo tocca" |
| `SPEC.md` | Assumption 3 | "un'altra libreria = un altro contratto di estrazione" → "un'altra libreria = un altro valore di configurazione in `pds-setup`, oggi rifiutato in modo esplicito" |
| `penpot-pipeline.md` | Stadio 0, 1, 2 | **riscritto** sul modello v3 (il testo è la nuova AD-11 in forma di companion); cadono regola A di versionamento del plugin data, `addCell`, `adopt:variant`, sei comandi |
| `design-system.md` | `ui/domains`, sezioni, "Primitive rigide" | stili generati + componente dello sviluppatore; Carousel e Table non sono più segnaposto; Carousel è una sezione (decisione 12 dello spike); dominio `commerce` (ShopCard) da aggiungere alla tabella; sezioni = slot. La frase "primitive senza parti opzionali" cade: una parte può dipendere da un field con `when` (forgia 3, regola 7). Il "Filtro attivo" resta come composizione, ma con la regola 6 è un **componente** (nessuno slot), non una sezione |
| `a11y-baseline.md` | nuova §6 | stati (focus e disabled con default globale, hover/active solo se disegnati), axe bloccante, "testo + colore" come voce fissa del giudizio in Storybook |
| `glossary.md` | — | aggiungere *chiave di parte*, *sezione*, *componente dello sviluppatore*, *domanda* (Finding) |
| `specs/spec-refactor-packages-scripts/` | tutto | `status: superseded` (v2), con rimando a questa proposta |
| `specs/spec-penpot-estrazione-costruzione/` | tutto | `status: superseded`, con rimando a questa proposta |

Nessun impatto su `rbac-matrix.md` né sulla UX (`ux-designs/`): la pipeline non tocca schermate dell'editor.

### 2.3 Architettura — AD che restano, cambiano, spariscono

**Spine 2026-07-25 (page-builder).**

| AD | Esito | Cosa |
|---|---|---|
| AD-1, AD-2, AD-4, AD-6, AD-7, AD-8, AD-9, AD-10, AD-12, AD-13 | **restano** | non legate alla pipeline |
| AD-3 | **cambia** (una frase) | Base UI non è più "dichiarata per parte nel contratto di estrazione": è `headless=base-ui` in `pds-setup` e la usa il componente dello sviluppatore. Resta: importabile solo da `ui/src/domains/**` |
| AD-5 | **cambia** (una frase) | via "gli assi `state`/`behavior` vivono nel contratto di estrazione": nel contratto ci sono solo assi `option`; `state` è un nome d'asse riservato in Penpot, mai una prop. La definizione di sezione è contratto dell'editor con almeno uno slot (field + slot `allow`/`max`), l'albero sta in Penpot e nel componente |
| **AD-11** | **sostituita** da AD-11 v3 (§4.2) | |
| Diagramma dipendenze, Structural Seed, Capability Map, Stack, Deferred | **ritocchi** | `ui/src/domains` = stili generati + componenti dello sviluppatore; seed di `packages/scripts` (nucleo, adattatore, server); Penpot 2.18.3 e penpot-ai-kit 0.5.1 nello Stack; Deferred "seconda libreria" → rifiuto esplicito in `pds-setup`; nuovo Deferred "pannello Penpot" |

**Spine 2026-10-03 (estrazione-costruzione): scartata per intero** (`status: superseded`). Delle sue regole resta solo il rischio, dove vale:

| AD | Rischio che preveniva | Vale ancora? | Dove finisce in v3 |
|---|---|---|---|
| AD-1 nessun runtime, zero metadati per componente | metadati a mano che divergono; due driver che decidono | sì (metadati) · no (runtime) | un solo file per componente (contratto dell'editor); i metadati stanno in Penpot. Il server `pds` esiste ma non decide |
| AD-2 conferma umana unico gate | fix o generazioni senza consenso | sì | ogni scrittura (contratti, plugin data, file) passa da una conferma; il diff del TSX non si applica mai da solo; ma CI e `generate_component` possono rifiutare (hash, domande aperte) |
| AD-3 rilettura live, mai cache né fixture | decisioni su dati vecchi | sì | regola 5: server senza stato, rilettura a ogni chiamata, nessuna copia della lettura nel repo |
| AD-4 profili headless versionati | configurazione orale che diverge tra sessioni | sì (rischio) · no (profili, scartati dalla forgia 1) | `pds-setup`: un valore per chiave, scelto una volta |
| AD-5 mai mani su `@generated`, un token un proprietario | drift dal generatore; due proprietari | sì | hash nell'intestazione `@generated`; il tema Penpot vince in `globals.css` |
| AD-6 un solo vocabolario verso Puck: Tailwind v4 | secondo vocabolario | sì | seme `theme.css` → Penpot → `theme.css` |
| AD-7 fedeltà = giudizio umano | score automatici al posto del giudizio | sì | giudizio in Storybook, con "testo + colore" come voce fissa |
| AD-8 gate a 4 controlli | gate vuoto, sì dato alla cieca | sì (rischio) · no (ruoli) | `verify_component` restituisce avvisi, blocchi e domande, mostrati prima di generare |
| AD-9 livelli L0 → L3 | molecole su atomi mai validati | sì (rischio) · no (livelli) | `build_order`: un componente si genera solo se esistono già quelli che contiene |

**AD-11 v2 regola per regola.**

| Regola v2 | Esito | v3 |
|---|---|---|
| Due contratti (page builder + estrazione) | sparisce | un contratto (dell'editor); il resto da Penpot o dal componente |
| Ruoli di parte `surface`/`text`/`icon`/`divider`/`image` | sparisce | lo stile si legge dal layer; l'elemento HTML lo decide lo scaffold |
| Istantanea `data/components/<nome>.json` | sparisce | nessuna lettura nel repo; la review è il diff di `styles.ts` |
| Render tutto `@generated`, nessuna base | cambia | generati solo `styles.ts` e story; scaffold una tantum, poi il componente è dello sviluppatore |
| Headless per parte nel contratto di estrazione | cambia | Base UI se esiste il primitivo, altrimenti ricetta shadcn `base` + APG, nel componente dello sviluppatore |
| Sei comandi, `ScriptError`, exit code | sparisce | server MCP `pds` con sei strumenti; `Finding` e `Change` come tipi zod |
| Solo `library` scrive su Penpot | cambia | il disegno lo fa il designer col kit via `pds-design`; i metadati li scrive `pds-code` con conferma; il server mai |
| Plugin data `pagebuilder/contract = nome@versione` | resta (forma), cambia (scrittore) | resta il legame container → contratto; si aggiungono `part`, `when`, `slot` e le risposte, tutti shared plugin data `pagebuilder` |
| Registro unico delle proprietà | resta | impara geometria e dimensionamento; nessuna tabella ruolo → proprietà |
| Composizione ≠ componente | cambia | componente = tutti i pezzi scelti dal designer; sezione = almeno uno slot |
| Logica propria → segnaposto, adapter a mano | sparisce | si disegna in Penpot come gli altri; senza container = scritto a mano (contratto sì, niente generato, solo GA) |
| Pass/fail negli script, mai nel prompt | resta (rischio) | i fatti e gli esiti li danno nucleo e CI; la skill spiega e chiede |
| `@generated` mai a mano; file senza marker preservati | resta | |

### 2.4 CAP della SPEC page-builder

| CAP | Esito |
|---|---|
| CAP-1 | cambia (success) |
| CAP-2 | cambia (intent e success, riscritti) |
| CAP-3 | cambia (success) |
| CAP-4 | cambia (intent: sezioni) |
| CAP-5…CAP-15 | restano |

I CAP-1…CAP-10 della SPEC estrazione-costruzione e i CAP-1…CAP-11 della SPEC v2 **spariscono** con le loro SPEC.

### 2.5 Impatto tecnico

- **Si rimuove:** cinque componenti generati in `packages/ui/src/domains` e i loro barrel, `data/components/*`, i contratti di estrazione `.extract.ts`, i comandi `library`/`propose`/`extract`/`render`/`gates`, `library-writer.ts`, `library-plan.ts` (`COMPONENT_TOKENS`, `SAMPLE_TEXT`), `render.ts`, il guscio CLI e `ScriptError`, le skill `pds-bootstrap`, `pds-additive`, `pds-component`, il job `gates` in CI. `theme` resta finché `extract_theme` non lo sostituisce (Story 2.26).
- **Resta:** i contratti dell'editor (`@app/contracts`, fingerprint, `SCHEMA_VERSION`), `pds-setup`, il registro (da estendere), Storybook e il suo smoke gate, `@base-ui/react`, il dropdown dell'editor già su Base UI.
- **Entra:** `packages/scripts/src/{core,penpot,server}` (seed), server MCP `pds` nella configurazione MCP del progetto, campione `.penpot`, `fonts.css` + pacchetti `@fontsource/*`, `axe` bloccante sulle story generate.
- **Confini:** `check-boundaries.mjs` deve coprire le cartelle nuove, con test rosso/verde (azione aperta della retro Epic 1, §4.5).
- **Penpot locale** fissato a 2.18.3 (decisione 10 dello spike, compose committato in `4feaedb`).

## 3. Approccio raccomandato

**Direct Adjustment con rollback mirato.** Si tiene Epic 2 e la storia 2.1–2.16; si rimuovono codice e componenti v2 (rollback dei soli artefatti di prova, non delle story) e si costruisce la v3 in story piccole, ognuna verde in CI. Non serve una MVP review: nessun CAP di prodotto cambia scopo, e nessuna pagina salvata usa ancora i contratti.

**Ordine e motivo.**
1. **2.17** chiude subito il bug più grave, indipendente dal resto.
2. **2.18–2.19** puliscono il terreno: via la v2 e i componenti di prova, fixture e confini pronti per il codice nuovo (punto 13 dello spike).
3. **2.20–2.25** costruiscono il nucleo, l'adattatore e il server, poi il collaudo Penpot, che misura anche quali operazioni cancellano i plugin data **prima** che le skill ci scrivano.
4. **2.26–2.27** aggiungono tema, font e sezioni sul nucleo.
5. **2.28–2.30** sono le skill e il comportamento, che consumano nucleo e server.
6. **2.31** rigenera i componenti di prova con la v3 (Badge → ShopCard → Carousel), **2.32** la libreria dei sei domini.

Il server può entrare appena il nucleo ha i primi schemi stabili (forgia 2, decisione 3): 2.24 può partire dopo 2.20, in parallelo a 2.21–2.23.

**Effort e rischio.** 16 story, la maggior parte di dimensione media; le più grandi sono 2.22 (generatore), 2.23 (adattatore) e 2.32 (libreria). Rischio medio: il modello è provato su ShopCard e Carousel, ma il codice dello spike non si riusa così com'è. Rischi residui in §6.

## 4. Proposte di modifica

### 4.1 Bug della pipeline attuale (spike, "Problemi trovati")

Ogni bug ha un proprietario. Quelli che spariscono con la v2 si chiudono nella story di rimozione; gli altri hanno un test rosso/verde nella story che li corregge.

| # | Bug | Effetto | Esito | Story |
|---|---|---|---|---|
| 1 | **Il tema Penpot non entra nel CSS compilato** (`@import` a metà di `globals.css`, `@theme inline` shadcn che ridefinisce colori, raggi e font) | i cambi del designer non arrivano al browser | **si corregge subito** | **2.17** |
| 2 | Il reader live non legge il layout flex | componenti senza `flex`/allineamenti | corretto nell'adattatore | 2.23 |
| 3 | Il dimensionamento "fill" non si legge | blocchi che non occupano la larghezza | corretto in adattatore e registro | 2.20, 2.23 |
| 4 | Lo spessore del bordo non genera classi (`strokeWidth` `coveredByBase`, residuo v1) | bordi invisibili | corretto nel registro | 2.20 |
| 5 | `fontFamily` non registrato (Penpot 2.18 usa il singolare) | font non legato | corretto nel registro | 2.20 |
| 6 | `theme` legge solo i set attivi e rifiuta i nomi duplicati | niente varianti di tema | corretto in `extract_theme` | 2.26 |
| 7 | Struttura dipendente da `COMPONENT_TOKENS` | nessun componente nuovo senza codice | sparisce con `library-plan.ts` | 2.18 |
| 8 | Render scritto a mano per componente | codice per ogni componente | sparisce; il generatore è generico | 2.18, 2.22 |
| 9 | Contratti di estrazione caricati tutti all'avvio della CLI | un contratto cambia e si rompe `theme` | sparisce con la CLI | 2.18 |
| 10 | Template dei test cablati; log di `extract` | test fragili, messaggi fuorvianti | sparisce con `render`/`extract` | 2.18 |
| 11 | Ritaglio, dimensioni fisse, posizione degli assoluti, "fill" verticale non letti | frecce e pallini senza misura | corretto in adattatore e geometria | 2.21, 2.23 |
| 12 | D2 contava come override il dimensionamento di un'istanza | blocco su card in "fill" in uno slot | corretto nell'adattatore | 2.23 |
| 13 | La pipeline conosce solo contratti di componente | una sezione non si legge né si genera | corretto | 2.27 |
| 14 | 45 test di `scripts` rossi applicando lo spike (fixture col catalogo vecchio, `v3/` fuori dai confini) | | corretto (punto 13) | 2.19 |

### 4.2 Nuova AD-11 (sostituisce AD-11 v2 nella spine 2026-07-25)

> Testo da inserire al posto dell'attuale AD-11. Il razionale sta nelle quattro fonti; qui solo le regole.

### AD-11 — Un contratto, Penpot letto dal vivo, stili generati e componente dello sviluppatore [ADOPTED, v3 2026-10-17 — supera AD-11 v2 (2026-09-17) e la spine 2026-10-03]

- **Binds:** CAP-1, CAP-2, CAP-3, CAP-4.
- **Prevents:** valori di design inventati a mano; drift design ↔ codice; vocabolario delle props, e quindi le pagine salvate, legato alla libreria o a Penpot; metadati per componente scritti a mano che divergono; letture salvate o fixture che invecchiano; codice dello sviluppatore riscritto dal generatore; fedeltà persa in silenzio; scritture senza consenso; componenti non accessibili perché il comportamento non si disegna.
- **Rule:**
  **Un solo file per componente: il contratto dell'editor.** `packages/contracts/src/components/<nome>.ts`, o `sections/<nome>.ts` per una sezione; assi `option`, field, slot; versionato da `SCHEMA_VERSION` + fingerprint (AD-5, AD-6). Lo propone la skill (dal contratto o dal design), lo approva lo sviluppatore. Nessun altro metadato per componente nel repo: niente contratto di estrazione, istantanea, binding, ricetta salvata.
  **Da dove viene ogni informazione.** Parti, albero, istanze annidate e variante scelta, celle, token, layout e geometria: **Penpot, letto dal vivo** a ogni chiamata. Elemento HTML, field → parte, icone, comportamento, a11y: **il componente dello sviluppatore**. Il legame Penpot ↔ codice è la chiave di parte, che in codice è `data-slot`.
  **Metadati in Penpot.** Shared plugin data `pagebuilder`: `contract = nome@versione` sul container; `part=<chiave>` sul layer (sopravvive al rename, passa alle istanze, Ctrl+D la copia); `when=<field>`, `slot=<id>` e le risposte alle domande. Li scrive **solo `pds-code`**, alla generazione, via MCP Penpot, con conferma. Mai stile, geometria, layer o token: il disegno è del designer, che non scrive metadati. Il nome del layer è libero e serve solo a proporre la chiave.
  **Stili generati, componente dello sviluppatore.** Il generatore scrive `<Comp>.styles.ts` (una `cva` per chiave di parte, tutti gli assi, varianti delle istanze annidate) e `<Comp>.stories.tsx` (una per cella, figli di default del contratto per le sezioni), entrambi `@generated` con versione del generatore e hash. `<Comp>.tsx` lo crea lo scaffold una volta, poi è dello sviluppatore e il generatore non lo tocca più. Il lato codice lo controlla `tsc` (chiavi esportate da `styles.ts`); la verifica controlla solo il lato Penpot. Una parte tolta di proposito dallo sviluppatore è un avviso (export inutilizzato). Un cambio di struttura rigenera solo `styles.ts`; per ogni parte aggiunta, tolta o diventata lista la skill suggerisce la modifica del TSX con un esempio sul file attuale e la applica solo su richiesta.
  **Esiti: avviso, blocco, domanda.** L'aspetto produce solo avvisi. Un caso ambiguo è una **domanda** con le opzioni: la skill chiede, la risposta si scrive in Penpot sul layer e non si richiede più. Chiavi doppie (lista `repeat` o parte nuova), parti senza chiave e domande aperte fermano `generate_component`, che non scrive finché restano.
  **Assi e stati.** Nel contratto solo assi `option`. Un field `structure` è un asse se Penpot ha una variante con lo stesso nome, altrimenti è un rendering condizionale con `when=<field>` su una parte; né l'uno né l'altro → domanda. Focus e disabled hanno un default nel CSS globale (anello `ring`, opacità 50%); una cella disegnata vince; il focus non si toglie. Hover e active esistono solo se disegnati, sull'asse riservato `state` (una cella per variante su una taglia, applicata col prefisso a tutte le taglie), mai una prop; le celle mancanti non sono un errore.
  **Componente e sezione.** Componente: tutti i pezzi li sceglie il designer. Sezione: almeno uno slot. Le parti proprie seguono le stesse regole; una sezione con parti proprie ha container, `styles.ts` e scaffold, una di sola disposizione no. Slot = layer i cui figli sono tutti istanze dei componenti ammessi; se ambiguo → domanda, `slot=<id>`. Un'istanza in Penpot diventa `<Comp />` nel codice: variante scelta dal designer e validata, override di stile vietati, testo solo d'esempio.
  **Geometria.** Ogni voce nel registro ha una traduzione; le regole di contesto sono funzioni del nucleo. La misura fissa della radice si ignora se è uguale in tutte le celle, entra nella `cva` se cambia tra le celle (a′). Un valore fuori scala diventa un valore arbitrario (`w-[37px]`) con un avviso ripetuto e il valore in scala più vicino; mai una classe persa in silenzio. Ritaglio: `overflow-hidden` se un figlio esce o se il genitore ha un raggio e un figlio tocca un bordo; ignorato se niente esce e non c'è contenuto variabile; domanda se niente esce ma c'è contenuto variabile. `left+right` e `top+bottom` si traducono; un vincolo non traducibile (`scale`) dà un avviso e nessuna classe; "fill" dentro hug è una domanda.
  **Comportamento e a11y.** Primitivo Base UI se esiste (lo scaffold lo usa); altrimenti ricetta shadcn `base` letta dal vivo + pattern APG, mai salvata. La skill propone prima un elenco di comportamenti, poi un diff piccolo per comportamento con conferma e un test per ognuno (file dello sviluppatore). Le dipendenze nuove le sceglie lo sviluppatore, con l'alternativa senza dipendenze. axe è bloccante su ogni story `@generated`; la tastiera è coperta dai test di comportamento; "testo + colore" è una voce fissa del giudizio in Storybook.
  **Tema e font.** Seme `theme.css` (Tailwind v4 + ruoli shadcn) → token Penpot (`tokens_from_css`); poi la fonte è Penpot e `extract_theme` scrive `theme.css` e `themes/<gruppo>-<nome>.css` per le varianti dichiarate come `[data-<gruppo>="<nome>"]`, e `fonts.css` dalle famiglie del tema. Il tema Penpot vince nel CSS compilato. Font via `fontsource`, caricati dallo stesso file in Next e in Storybook; niente `next/font`.
  **Script: nucleo puro, un adattatore, un guscio.** TypeScript in `packages/scripts`; il nucleo legge `@app/contracts` ed è fatto di funzioni dati → dati (niente disco, rete, console, exit code). `readComponent` è l'unico punto che parla con Penpot (`execute_code`). Il guscio è il **server MCP `pds`**, senza CLI di prodotto: senza stato, rilegge Penpot a ogni chiamata, non scrive mai su Penpot, non decide. Strumenti: `tokens_from_css`, `describe_component`, `verify_component`, `build_order`, `generate_component` (restituisce `Change[]` e scrive lui i file `@generated`), `extract_theme`. Tipi interni (`Lettura`, `Finding`, `Change`) zod con nome e senza versione.
  **Due skill.** `pds-design` (verso Penpot: tema, varianti di tema, contratto nuovo, disegno via kit, contratto dal design, modifica di struttura) e `pds-code` (verso il codice: tema, verifica, generazione, aggiornamento, gate), wrapper delle skill di penpot-ai-kit dove ha senso; `pds-setup` resta. Nessuno script tra i contratti e Penpot: i componenti li disegna il designer col kit.
  **Ordine.** Niente livelli: `build_order` genera un componente solo se esistono già i componenti che contiene.
  **Configurazione di progetto** in `pds-setup`: `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource`, un valore implementato per chiave; un valore non supportato è un rifiuto esplicito.
  **CI senza Penpot, quattro livelli:** nucleo con dati minimi scritti a mano; server in memoria con un adattatore Penpot finto; hash e versione dei file `@generated` (hash che non torna = blocco, versione vecchia con hash giusto = avviso); ogni classe del registro, espansa sui token del tema generato, produce CSS con la Tailwind installata, più il test di `tokens_from_css` sul seme. Nessuna lettura di Penpot salvata nel repo.
  **Collaudo degli aggiornamenti di Penpot.** Un componente campione che usa tutte le proprietà del registro, salvato come `.penpot` nel repo. A ogni aggiornamento: istanza nuova, import, collaudo lanciato a mano; ogni proprietà del registro compare nella lettura. Il Penpot vero si aggiorna solo se il collaudo passa.
  **Fuori da Penpot.** Un componente senza container è scritto a mano: contratto sì, niente di generato, solo il gate. Un disegno fatto altrove si riporta in Penpot.
  I file `@generated` non si editano a mano; i file senza marker sono sempre preservati. Dettaglio → companion `penpot-pipeline.md`.

**Ritocchi collegati nella spine 2026-07-25.**

```
AD-3, Rule — OLD:
… sono la dipendenza di *comportamento* dichiarata per parte nel contratto di estrazione (AD-11), e sono importabili **solo** …
AD-3, Rule — NEW:
… sono la dipendenza di *comportamento* fissata in `pds-setup` (`headless=base-ui`) e usata dal componente dello sviluppatore (AD-11), e sono importabili **solo** …

AD-5, Rule — OLD:
… gli assi **`option`** (gli assi `state`/`behavior` sono di rendering e vivono nel contratto di estrazione, AD-11), i field, gli slot, il classifier structure/content e le **definizioni di sezione** (albero di blocchi del contratto + props + slot con `allow` e `max`).
AD-5, Rule — NEW:
… gli assi **`option`** (l'unico tipo di asse del contratto; `state` è un nome d'asse riservato in Penpot, mai una prop, AD-11), i field, gli slot, il classifier structure/content e le **definizioni di sezione** (contratto con almeno uno slot: field + slot con `allow` e `max`; l'albero sta in Penpot e nel componente, AD-11).
```

Structural Seed, voce `packages/scripts` (NEW):

```text
    scripts/                 # pipeline Penpot→codice v3 (AD-11)
      src/core/              #   nucleo puro: tipi zod (Lettura, Finding, Change), registro, geometria,
                             #   verifica, generatore, ordine, tema — dati → dati
      src/penpot/            #   readComponent: unico punto che parla con Penpot (execute_code)
      src/server/            #   server MCP pds: sei strumenti, senza stato, scrive i file @generated
      collaudo/              #   campione .penpot con tutte le proprietà del registro
```

e `ui/src/domains/`: "GENERATO: … `@generated`" → "`<Comp>.styles.ts` e `.stories.tsx` @generated; `<Comp>.tsx` dello sviluppatore (scaffold una tantum)". `tokens/`: aggiunge `themes/*.css` e `fonts.css` @generated.

Stack: + `Penpot (self-hosted) 2.18.3`, `penpot-ai-kit 0.5.1`, `@base-ui/react ^1.8.0` (installato in 2.16), `@fontsource/*`.

Deferred: la voce "Emitter per una seconda libreria" diventa "**Seconda libreria o secondo framework**: oggi `pds-setup` rifiuta i valori non implementati; riaprire al primo progetto reale che li chieda". Nuova voce "**Pannello Penpot in sola lettura**" (da `deferred-work.md`).

Frontmatter: `updated: '2026-10-17'`. Spine 2026-10-03: `status: superseded`, `superseded_by: sprint-change-proposal-2026-10-17.md`.

### 4.3 Epic 2 ripianificato (da 2.17 in poi)

**Testata di Epic 2 (NEW):**

> Si generano token e stili dei componenti dal catalogo Penpot in modo riproducibile, con componenti React accessibili scritti dallo sviluppatore sopra gli stili generati, visibili e testati in Storybook. Il regime è la **v3** (AD-11, correct-course 2026-10-17): un contratto dell'editor per componente; Penpot letto dal vivo per parti, celle, token e geometria; `styles.ts` e story generati, componente dello sviluppatore; un server MCP `pds` sopra un nucleo puro; due skill `pds-design` e `pds-code`.
>
> **Story 2.1–2.16 (v1 e v2).** Restano come storia: non si riscrivono. Il codice v2 e i componenti di prova si rimuovono nella Story 2.18. La Story 2.17 "Skill pds-* sui sei comandi" è cancellata (branch mai mergiato).

Dipendenze: 2.17 → nessuna · 2.18 → 2.17 · 2.19 → 2.18 · 2.20 → 2.19 · 2.21, 2.22 → 2.20 · 2.23 → 2.20 · 2.24 → 2.20 (schemi) e 2.23 per l'uso reale · 2.25 → 2.23, 2.24 · 2.26 → 2.24 · 2.27 → 2.22, 2.24 · 2.28 → 2.24, 2.26 · 2.29 → 2.24, 2.25 · 2.30 → 2.29 · 2.31 → tutte · 2.32 → 2.31.

#### Story 2.17: Il tema Penpot nel CSS compilato

As a designer/sviluppatore,
I want che i valori del tema Penpot arrivino davvero nel CSS che il browser riceve,
So that un cambio del designer si veda nei componenti e non resti coperto dai default shadcn e Tailwind (FR1, NFR5, AD-11).

**Acceptance Criteria:**

**Given** `packages/ui/src/styles/globals.css` con `@import` del tema a metà file e il blocco `@theme inline` shadcn che ridefinisce colori, raggi e font
**When** riordino il CSS globale
**Then** l'`@import` del tema Penpot è in testa con gli altri e nessun blocco ridefinisce i nomi che il tema possiede (colori, raggi, font); le variabili shadcn in `:root`/`.dark` che oscurano il tema non esistono più
**And** un test compila il CSS con la Tailwind installata e verifica che `bg-primary`, `rounded-lg` e `font-sans` usino i valori del tema Penpot, rosso sul CSS di oggi e verde dopo la correzione
**And** il default globale di focus (anello `ring`) e di disabled (opacità 50%) resta nel livello `base`
**And** Storybook e `apps/web` caricano lo stesso CSS globale, e il build statico di Storybook resta verde.

#### Story 2.18: Rimozione dei componenti di prova e della pipeline v2

As a sviluppatore,
I want togliere i componenti generati per prova e il codice della v2,
So that la v3 parta da un terreno pulito e nessuno usi più artefatti che non hanno un proprietario (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** `develop` dopo la Story 2.17
**When** rimuovo la v2
**Then** non esistono più Badge, Input, Alert, AccordionItem e ProductCard in `packages/ui/src/domains` (componente, test, story, barrel), `packages/scripts/data/components/*`, i contratti di estrazione, i comandi `library`, `propose`, `extract`, `render`, `gates`, `library-writer.ts`, `library-plan.ts`, `render.ts`, il guscio CLI e `ScriptError`, né il job `gates` in CI
**And** restano i contratti dell'editor in `@app/contracts` con fingerprint e `SCHEMA_VERSION` invariati, il registro delle proprietà, il comando `theme` (fino alla Story 2.26), Storybook con il suo smoke gate e il dropdown dell'editor su Base UI
**And** le skill `pds-bootstrap`, `pds-additive` e `pds-component` sono rimosse (da `.claude/skills`, `.agents/skills` e `module-help.csv`); `pds-setup` resta; il branch `story/2-17-skill-pds-sui-sei-comandi` si chiude senza merge
**And** `apps/web` e `ui/editor` non importano nulla di rimosso (verificato con `tsc` e la build), e la CI è verde
**And** i bug 7–10 dello spike (`COMPONENT_TOKENS`, render per componente, contratti caricati all'avvio, template e log) sono chiusi come "spariti con la v2" con rimando a questa story; le voci di `deferred-work.md` legate ad artefatti v2 sono chiuse come "senza oggetto".

#### Story 2.19: Fixture sul catalogo Tailwind e codice nuovo dentro i confini

*(Punto 13 dello spike.)*

As a sviluppatore,
I want che i test di `scripts` usino il catalogo nato dal seme Tailwind e che i confini coprano le cartelle del nuovo codice,
So that riportare il modello v3 non renda rossa la suite (i 45 test dello spike) e nessun modulo nuovo sfugga alle regole di dipendenza (FR2, NFR6, AD-11).

**Acceptance Criteria:**

**Given** il seme `theme.css` dello spike (`tailwind-to-penpot/`) e i test di `scripts` scritti sul catalogo vecchio
**When** riallineo le fixture
**Then** i test di `scripts` leggono il catalogo token derivato dal seme Tailwind (catalogo dati a mano, non una lettura di Penpot), e la suite è verde con il codice di [`test-v3/`](../spikes/penpot-ai-kit-2026-10-10/test-v3/README.md) usato come riferimento
**And** `check-boundaries.mjs` di `packages/scripts` copre `src/core`, `src/penpot` e `src/server`: il nucleo non importa né disco né rete né MCP, solo `src/penpot` parla con Penpot, `src/server` non importa da `src/penpot` fuori dal punto di iniezione dell'adattatore
**And** ogni regola di confine ha un test rosso/verde automatico (chiude per `packages/scripts` l'azione aperta della retro Epic 1 sui `check-boundaries.mjs`; `ui`, `domain` e `api` si aggiungono qui o restano aperte, a scelta della story)
**And** nessuna cartella `v3/` entra nel repo: il codice nuovo vive nelle cartelle del seed.

#### Story 2.20: Nucleo puro e registro delle proprietà

As a sviluppatore,
I want un nucleo di funzioni dati → dati con i tipi della pipeline e un registro unico delle proprietà Penpot,
So that ogni proprietà si insegni in un solo posto e tutta la logica sia testabile senza Penpot (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** `packages/scripts/src/core` vuoto e il registro attuale
**When** scrivo il nucleo
**Then** esistono gli schemi zod `Lettura`, `Finding` (`avviso` · `blocco` · `domanda` con opzioni) e `Change`, con un nome e senza versione, e nessuna funzione del nucleo tocca disco, rete, console o codice di uscita (verificato dai confini della Story 2.19)
**And** il registro ha una voce per proprietà con la sua traduzione in classe Tailwind (token, layout flex, dimensionamento), senza tabella ruolo → proprietà; `strokeWidth` produce classi (bug 4), `fontFamily` al singolare è registrato (bug 5), "fill" orizzontale e verticale produce classi (bug 3)
**And** livello 1 della CI: il nucleo è testato con dati minimi scritti a mano, un test rosso/verde per voce del registro
**And** livello 4 della CI: ogni classe del registro, espansa sui token del tema generato, produce CSS con la Tailwind installata.

#### Story 2.21: Geometria e larghezza nel registro

As a designer/sviluppatore,
I want che dimensioni, posizioni e ritaglio disegnati in Penpot arrivino nel codice con regole fisse,
So that nessuna misura si perda in silenzio e il ritaglio non tagli l'anello di focus (FR2, NFR1, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il nucleo della Story 2.20
**When** aggiungo le voci di geometria e le regole di contesto come funzioni del nucleo
**Then** la misura fissa della radice uguale in tutte le celle si ignora, e se cambia tra le celle entra nella `cva` sotto l'asse (a′)
**And** un valore fuori scala diventa un valore arbitrario (`w-[37px]`) con un `Finding` di tipo avviso che riporta il valore in scala più vicino, per misure e posizioni
**And** il ritaglio segue le tre regole: `overflow-hidden` se un figlio esce o il genitore ha raggio e un figlio tocca un bordo; nessuna classe se niente esce e non c'è contenuto variabile; domanda se niente esce ma c'è contenuto variabile (testo da field, immagine, slot)
**And** `left+right` e `top+bottom` si traducono; un vincolo `scale` dà un avviso e nessuna classe; "fill" dentro hug dà una domanda; con tutti i figli in fill la misura fissa del genitore si ignora (limite di Penpot dello spike)
**And** ogni regola ha un test rosso/verde nel livello 1 della CI (bug 11, lato nucleo).

#### Story 2.22: Verifica e generazione — chiavi di parte, `styles.ts`, scaffold, story

As a sviluppatore,
I want verificare un componente letto da Penpot e generarne stili, scaffold e story con un generatore unico,
So that un componente nuovo non richieda una riga di codice nella pipeline e il mio componente non venga mai riscritto (FR2, FR3, NFR5, AD-11).

**Acceptance Criteria:**

**Given** una `Lettura` scritta a mano (componente con istanza annidata, parti con e senza chiave, chiavi doppie)
**When** chiamo verifica, ordine e generazione del nucleo
**Then** la verifica restituisce: parte senza chiave → domanda con la chiave proposta dal nome del layer; chiavi doppie → domanda *lista* (`repeat`) o *parte nuova*; aspetto → avvisi; e la generazione rifiuta finché resta una domanda aperta
**And** il generatore produce `<Comp>.styles.ts` con una `cva` per chiave (tutti gli assi `option`, varianti delle istanze annidate), intestazione `@generated` con versione del generatore e hash, e `<Comp>.stories.tsx` con una story per cella
**And** lo scaffold crea `<Comp>.tsx` solo se non esiste, con `data-slot` = chiave di parte e l'elemento HTML proposto (domanda se il layer è ambiguo); un `<Comp>.tsx` esistente resta identico byte per byte dopo ogni rigenerazione (prova T4b-2 dello spike come test)
**And** un'istanza annidata diventa `<Comp />` con la variante scelta in Penpot e validata; un override di stile su un'istanza è un blocco; il dimensionamento dell'istanza non è un override (bug 12, lato nucleo)
**And** asse riservato `state`: hover/active disegnati diventano prefissi su tutte le taglie, mai una prop; celle mancanti non sono un errore; focus e disabled non disegnati usano il default globale
**And** `build_order` restituisce l'ordine di generazione dalle istanze e rifiuta un componente che contiene un componente non ancora generato
**And** una parte tolta dal TSX dallo sviluppatore è un avviso (export inutilizzato); un cambio di struttura restituisce `Change[]` per `styles.ts` e, per ogni parte aggiunta, tolta o diventata lista, un suggerimento con esempio sul TSX attuale, mai applicato
**And** tutto è testato nel livello 1 della CI (bug 8 chiuso: nessun codice per componente).

#### Story 2.23: Adattatore Penpot `readComponent`

As a sviluppatore,
I want un unico punto che legge un componente da Penpot e lo restituisce come `Lettura`,
So that tutte le proprietà del registro arrivino dal file vero e nessun altro modulo parli con Penpot (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** Penpot 2.18.3 locale con il file "tailwind" dello spike (Badge, ShopCard, Carousel)
**When** chiamo `readComponent` via `execute_code`
**Then** la `Lettura` contiene celle, token, layout flex (bug 2), dimensionamento "fill" e "hug" (bug 3), ritaglio, dimensioni fisse, posizione e vincoli degli assoluti, "fill" verticale (bug 11), istanze con componente d'origine, variante e override confrontati con l'istanza principale (bug 12), e lo shared plugin data `pagebuilder` di container e layer
**And** le istanze si riconoscono dal componente d'origine, non solo dal nome (limite `switchVariant` dello spike); gli elementi si ritrovano da nomi e plugin data, mai dallo `storage` del plugin
**And** la `Lettura` è validata dallo schema zod del nucleo, e una proprietà nel registro che la lettura non porta è un errore che la nomina
**And** l'adattatore non ha fixture di lettura Penpot (regola 5): i suoi test girano solo nel collaudo (Story 2.25); in CI l'adattatore è sostituito da quello finto della Story 2.24
**And** il README dell'adattatore documenta la scheda Penpot sospesa dal browser (finestra visibile o i flag `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows`).

#### Story 2.24: Server MCP `pds` e controllo dei file generati in CI

As a sviluppatore,
I want un server MCP `pds` che esponga il nucleo come strumenti e scriva i file generati,
So that la skill non passi da stringhe di shell né scriva a mano un file `@generated`, e la CI sappia se un file generato è stato toccato (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il nucleo (Story 2.20) e l'adattatore (Story 2.23)
**When** avvio il server `pds` registrato nella configurazione MCP del progetto
**Then** espone `tokens_from_css`, `describe_component`, `verify_component`, `build_order`, `generate_component` e `extract_theme`, con ingressi e uscite validati dagli schemi del nucleo; non tiene stato, rilegge Penpot a ogni chiamata e non scrive mai su Penpot
**And** `generate_component` scrive lui i file `@generated` e restituisce `Change[]`; non scrive se ci sono chiavi doppie, parti senza chiave o domande aperte
**And** livello 2 della CI: il server gira in memoria con un adattatore Penpot finto, un test per strumento e per schema
**And** livello 3 della CI: per ogni file `@generated` del repo, hash che non torna = blocco che nomina il file; versione del generatore vecchia con hash giusto = avviso
**And** non esiste una CLI di prodotto; il README dice come riavviare il server dopo una modifica del nucleo.

#### Story 2.25: Collaudo degli aggiornamenti di Penpot

As a sviluppatore,
I want un componente campione e una procedura che dicano se una versione nuova di Penpot rompe la lettura,
So that il Penpot vero si aggiorni solo quando la pipeline lo legge ancora tutto (FR2, NFR5, AD-11).

**Acceptance Criteria:**

**Given** il registro completo (Story 2.20–2.21) e l'adattatore (Story 2.23)
**When** costruisco il campione e lancio il collaudo a mano su un'istanza Penpot nuova
**Then** esiste un componente campione salvato come `.penpot` nel repo che usa **ogni** voce del registro (geometria compresa) e ogni chiave di plugin data (`contract`, `part`, `when`, `slot`)
**And** la procedura (istanza nuova → import del campione → collaudo) verifica che ogni proprietà del registro compaia nella lettura e che il campione le usi tutte; un'esclusione è un errore che nomina la proprietà
**And** il collaudo misura quali operazioni di Penpot cancellano gli shared plugin data (raggruppa, booleane, copia tra file, ripristino, stacco) e se "fill" dentro hug è leggibile; l'esito è registrato nel README del collaudo e nel `penpot-pipeline.md`
**And** la procedura dice che il Penpot vero (oggi 2.18.3, backup prima della migrazione) si aggiorna solo se il collaudo passa, e come distinguere una migrazione dell'import `.penpot` da un guasto dell'adattatore.

#### Story 2.26: Tema da seme CSS, varianti di tema e font

As a designer/sviluppatore,
I want portare un tema Tailwind in Penpot e riportarlo in codice con le sue varianti e i suoi font,
So that il designer parta da un tema idiomatico e il codice torni idiomatico (`bg-primary`, `text-sm`) senza perdite (FR1, NFR5, AD-6, AD-11).

**Acceptance Criteria:**

**Given** il seme `theme.css` (Tailwind v4 + ruoli shadcn) e il server `pds`
**When** chiamo `tokens_from_css` e poi `extract_theme`
**Then** `tokens_from_css` restituisce set e temi Penpot dal seme, comprese le varianti dichiarate come `[data-<gruppo>="<nome>"]`; un'ombra con `spread` negativo diventa 0 e un colore fuori sRGB il più vicino, entrambi con un avviso
**And** `extract_theme` legge **tutti** i set e i temi, non solo quelli attivi, accetta nomi uguali in set diversi (bug 6) e scrive `theme.css` e `themes/<gruppo>-<nome>.css` `@generated`; il giro seme → Penpot → CSS chiude senza perdite sul seme dello spike (test di livello 4)
**And** con `fonts=fontsource` in `pds-setup`, `extract_theme` scrive `fonts.css` `@generated` dalle famiglie del tema; Next e Storybook caricano lo stesso file; `next/font`, Geist e l'override dei font in `globals.css` non esistono più
**And** il comando `theme` e il suo codice sono rimossi: non resta nessuna CLI di prodotto.

#### Story 2.27: Sezioni

As a designer/sviluppatore,
I want leggere e generare una sezione con slot come un componente,
So that hero, carousel e sezioni prodotto si disegnino in Penpot con la stessa libertà dei componenti (FR2, FR4, AD-5, AD-11).

**Acceptance Criteria:**

**Given** un contratto `sections/<nome>.ts` con almeno uno slot e un container Penpot (Carousel dello spike: `perView` 1–3, slot di `shop-card`)
**When** verifico e genero la sezione
**Then** un field `structure` è un asse se Penpot ha una variante con lo stesso nome, altrimenti un rendering condizionale con `when=<field>` su una parte; senza asse né `when` è una domanda (quale parte, asse da disegnare, o field in `content` con MS)
**And** uno slot è il layer i cui figli sono tutti istanze dei componenti ammessi dallo slot; se è ambiguo è una domanda e la risposta è `slot=<id>`; le istanze nello slot sono esempi
**And** una forma disegnata nella sezione è una parte con la sua chiave, non un errore; un'icona è una parte con chiave e quale icona la propone lo scaffold
**And** una sezione con parti proprie ha container, `styles.ts` e scaffold; una sezione di sola disposizione non ne ha
**And** la story della sezione usa i figli di default del contratto, una per cella (bug 13 chiuso)
**And** ogni regola ha un test rosso/verde nel livello 1 della CI.

#### Story 2.28: Skill `pds-design` e configurazione di progetto

As a designer/sviluppatore,
I want una skill che porti tema e componenti in Penpot attraverso il kit ufficiale,
So that il designer lavori con gli strumenti di Penpot e io approvi i contratti senza scrivere codice di pipeline (FR1, FR2, AD-11).

**Acceptance Criteria:**

**Given** il server `pds` e penpot-ai-kit 0.5.1
**When** costruisco `pds-design` con `bmad-workflow-builder`
**Then** le voci sono **TB** (tema base dal seme, via `tokens_from_css` e `penpot-foundations`), **TV** (variante di tema), **CN** (ricetta → domande → proposta dei contratti → approvazione), **DC** (disegna il componente, dal contratto o libero, via `penpot-component-factory`), **CD** (bozza del contratto dal design, via `describe_component` → approvazione), **MS** (diff sui contratti → approvazione)
**And** la skill fa da wrapper alle skill del kit dove ha senso; le celle si costruiscono da zero (il clone di `createVariants.js` annida una copia); una cella per chiamata e la verifica in una chiamata separata (`applyToken` lento); i trigger non entrano in conflitto con quelli del kit
**And** `pds-design` non scrive metadati in Penpot; offre un controllo di stato che chiama `verify_component` e mostra chiavi mancanti o doppie al designer
**And** `pds-setup` scrive `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource` e rifiuta in modo esplicito ogni altro valore
**And** ogni scrittura (contratti, Penpot) passa da una conferma; un contratto dell'editor cambiato alza `SCHEMA_VERSION` e il fingerprint; `module-help.csv` è aggiornato; la skill è verificata eseguendo le due strade (dal contratto, dal design) su un componente reale.

#### Story 2.29: Skill `pds-code`

As a sviluppatore,
I want una skill che porti un componente da Penpot al codice, risponda alle domande e aggiorni gli stili,
So that generare e riallineare un componente sia una sequenza di conferme e non di comandi (FR2, FR3, NFR1, AD-11).

**Acceptance Criteria:**

**Given** il server `pds`, il collaudo (Story 2.25) e `pds-design`
**When** costruisco `pds-code` con `bmad-workflow-builder`
**Then** le voci sono **ET** (estrai tema), **VC** (verifica), **GC** (genera `styles.ts` e story, scaffold se manca il TSX, giudizio in Storybook), **AC** (rigenera `styles.ts`, riassume i cambi, suggerimenti per i cambi di struttura), **GA** (gate: `tsc`, test, tema nel CSS, contrasto, axe, un pacchetto font per famiglia)
**And** a ogni `Finding` di tipo domanda la skill mostra le opzioni, scrive la risposta in Penpot come shared plugin data `pagebuilder` (`part`, `when`, `slot`, risposta) via MCP Penpot **solo dopo conferma**, e non la richiede più; mai stile, geometria, layer o token
**And** GC rispetta `build_order`; il giudizio in Storybook ha "testo + colore" come voce fissa; AC suggerisce le modifiche del TSX con un esempio e le applica solo su richiesta
**And** la skill non scrive mai un file `@generated` (li scrive il server) e si ferma solo sulle decisioni umane; `module-help.csv` è aggiornato; verificata su un componente reale per GC e per un AC con cambio di struttura.

#### Story 2.30: Comportamento accessibile

As a sviluppatore,
I want che la skill mi proponga il comportamento del componente da Base UI o da una ricetta, un pezzo alla volta e con un test per pezzo,
So that il comportamento accessibile entri nel mio componente senza diff in blocco e senza dipendenze scelte da altri (FR3, NFR1, AD-3, AD-11).

**Acceptance Criteria:**

**Given** un componente generato da `pds-code` GC (Carousel dello spike come caso)
**When** chiedo il comportamento
**Then** se Base UI ha il primitivo lo scaffold lo usa e la skill propone solo il collegamento; altrimenti la skill legge dal vivo la ricetta shadcn `base` e il pattern APG, senza salvarli
**And** la skill propone prima l'elenco dei comportamenti da scegliere, poi un diff piccolo per comportamento con conferma, e un test per ogni comportamento (file dello sviluppatore, eseguito da GA); una dipendenza nuova la sceglie lo sviluppatore, con l'alternativa senza dipendenze
**And** la riproposta avviene solo su richiesta o quando un cambio di struttura tocca una parte usata da un comportamento
**And** axe in GA è bloccante su ogni story `@generated`, con una prova rosso/verde; la tastiera è coperta dai test di comportamento
**And** `a11y-baseline.md` riceve la §6 (stati, axe, giudizio "testo + colore").

#### Story 2.31: Rigenerazione dei componenti di prova con la v3

As a designer/sviluppatore,
I want rifare Badge, ShopCard e Carousel con le due skill, dal disegno al componente,
So that il modello v3 sia dimostrato su un atomo, una card con istanze e una sezione prima della libreria (FR1, FR2, FR3, NFR1).

**Acceptance Criteria:**

**Given** le Story 2.17–2.30 e il file Penpot "tailwind"
**When** genero nell'ordine di `build_order` Badge, ShopCard (con istanze di Badge, contratto dell'editor corretto dello spike: link relativi, immagine e testo del badge facoltativi, `category` obbligatoria) e la sezione Carousel
**Then** ciascuno ha `styles.ts` e story `@generated`, il componente dello sviluppatore, test e axe verdi, e il giudizio visivo di Alessandro in Storybook
**And** Badge passa dalla strada *dal contratto* e ShopCard dalla strada *dal design*; un cambio di aspetto in Penpot diventa una riga di `styles.ts` e un cambio di struttura un suggerimento sul TSX (T5 e T6 dello spike)
**And** i cambi del contratto dell'editor passano da un aumento di `SCHEMA_VERSION` (decisione 13 dello spike)
**And** la CI a quattro livelli è verde e non legge Penpot.

#### Story 2.32: Libreria componenti accessibile

*(ex 2.18, riscritta dal correct-course 2026-10-17.)*

As a sviluppatore,
I want una libreria di componenti organizzata per dominio e conforme alla a11y baseline,
So that l'editor e le composizioni possano costruirci sopra (FR3, NFR1).

**Acceptance Criteria:**

**Given** la v3 dimostrata (Story 2.31)
**When** creo i componenti dei domini (data-display, inputs, feedback, layout, navigation, overlays, commerce) in `packages/ui/src/domains`, ciascuno con `pds-design` e `pds-code` nell'ordine di `build_order`
**Then** ogni componente ha un contratto dell'editor, `styles.ts` e story `@generated` e un componente dello sviluppatore; il comportamento viene dal primitivo Base UI se esiste, altrimenti dalla ricetta shadcn `base` + APG proposta per comportamento (Story 2.30)
**And** ogni componente interattivo ha focus visibile WCAG AA (default globale o cella disegnata), stato comunicato da testo + colore (voce del giudizio in Storybook) e ARIA corretto; axe è verde su ogni story generata e la tastiera è coperta dai test di comportamento
**And** Table e Carousel si disegnano in Penpot come gli altri: niente segnaposto; gli stili sono generati e la logica propria sta nel componente dello sviluppatore
**And** un componente senza container in Penpot (3D, mappe, configuratori) è scritto a mano: contratto sì, niente di generato, solo GA
**And** il "Filtro attivo" (Badge + icona-link) è un componente con un'istanza di Badge, non una parte opzionale del Badge
**And** i componenti in `domains/` non importano da `editor/`, verificato da lint bloccante.

### 4.4 Story 3.4 riscritta (e ritocco a 3.2)

```
Story 3.4 — OLD title: Definizioni di sezione da Penpot
Story 3.4 — NEW title: Sezioni nell'editor
```

**NEW:**

As a sviluppatore/autore,
I want esporre in Puck le sezioni disegnate in Penpot, rigide e aperte solo negli slot dichiarati,
So that hero e sezioni siano fedeli al disegno e l'autore cambi solo il contenuto (FR4, AD-5, AD-11).

**Acceptance Criteria:**

**Given** una sezione generata con la v3 (contratto `sections/<nome>.ts` con almeno uno slot, `styles.ts` e componente dello sviluppatore, Story 2.27)
**When** la registro in `puckConfig`
**Then** è esposta in Puck per nome; la struttura è bloccata e i campi `content` sono modificabili; gli slot accettano solo i blocchi dell'`allow` fino a `max` (`resolvePermissions`) e il core lo impone comunque (Story 4.3)
**And** una forma disegnata nella sezione **non è un errore**: è una parte della sezione con la sua chiave, con stili generati come in un componente
**And** uno slot si riconosce in Penpot (layer i cui figli sono istanze dei componenti ammessi, o `slot=<id>` scritto da `pds-code`); uno slot del contratto che in Penpot non si trova più è un blocco di `verify_component` che nomina slot e sezione
**And** i valori iniziali in editor sono i figli e i default del contratto; i testi delle istanze in Penpot restano esempi
**And** una sezione di sola disposizione (nessuna parte propria) è esposta senza `styles.ts`.

Rationale: la forgia 3 (regola 6) fa della sezione "un componente con almeno uno slot" e toglie l'errore sulla forma sciolta; la regola 7 dello spike (D3: testo dell'istanza solo d'esempio) toglie i "testi del mockup come default"; il "Filtro attivo" non ha slot ed esce da 3.4 (va in 2.32).

```
Story 3.2, AC — OLD:
**Then** gli assi `state`/`behavior` non diventano campi; Box, Flex, …
Story 3.2, AC — NEW:
**Then** solo gli assi `option` diventano campi (l'asse riservato `state` vive solo in Penpot); Box, Flex, …
```

### 4.5 `epics.md` (testata e inventario) e `sprint-status.yaml`

**`epics.md`:**

```
FR2 — OLD:
… (contratto del page builder + contratto di estrazione → istantanea letta da Penpot → render sul registro delle proprietà), con componente+test+story+barrel, preservando i file scritti a mano.
FR2 — NEW:
… (contratto dell'editor + Penpot letto dal vivo → stili e story generati sul registro delle proprietà; componente dello sviluppatore creato una volta dallo scaffold), preservando i file scritti a mano.

NFR5 — OLD: … artefatti generati marcati @generated e mai editati a mano; la rigenerazione preserva i file scritti a mano.
NFR5 — NEW: … artefatti generati marcati @generated con versione del generatore e hash, mai editati a mano (controllato in CI); il componente React è dello sviluppatore e la rigenerazione non lo tocca.

NFR6 — aggiunge: "Base UI fissato in pds-setup (headless=base-ui)".

Additional Requirements, AD-3/AD-11 — NEW:
- **AD-3/AD-11 (design system):** ricostruzione dei `packages/*`; token, tema, font e stili dei componenti generati via pipeline v3 (correct-course 2026-10-17): un contratto dell'editor, Penpot letto dal vivo, server MCP `pds` su nucleo puro, skill `pds-design`/`pds-code`; componente dello sviluppatore. Una libreria per installazione, fissata in `pds-setup`.

Epic 2 (Epic List) — NEW:
Pipeline Penpot→codice (packages/scripts) che genera token, tema, font (packages/tokens) e stili dei componenti (packages/ui/src/domains), con componenti React accessibili scritti dallo sviluppatore sopra gli stili. Il regime arriva in tre tempi: v1 (2.1–2.10), v2 (2.12–2.16), v3 (2.17–2.31, correct-course 2026-10-17). Outcome: dal catalogo Penpot si generano in modo riproducibile tema e stili; i componenti dei sei domini sono accessibili, visibili e testati in Storybook, e la CI li verifica senza Penpot.
```

`inputDocuments`: + le quattro fonti.

**`sprint-status.yaml`:**

```yaml
  2-15-productcard-end-to-end-e-gate-in-ci: done        # era review; mergiata in 186f0c5
  2-16-rimozione-della-v1-e-rigenerazione-dei-quattro-componenti: done   # era review; PR #56
  # 2-17-skill-pds-sui-sei-comandi: rimossa (superata dalla v3)
  # 2-18-libreria-componenti-accessibile: rinumerata 2-32
  2-17-tema-penpot-nel-css-compilato: backlog
  2-18-rimozione-dei-componenti-di-prova-e-della-pipeline-v2: backlog
  2-19-fixture-sul-catalogo-tailwind-e-codice-nuovo-dentro-i-confini: backlog
  2-20-nucleo-puro-e-registro-delle-proprieta: backlog
  2-21-geometria-e-larghezza-nel-registro: backlog
  2-22-verifica-e-generazione-chiavi-di-parte-styles-scaffold-story: backlog
  2-23-adattatore-penpot-readcomponent: backlog
  2-24-server-mcp-pds-e-controllo-dei-file-generati-in-ci: backlog
  2-25-collaudo-degli-aggiornamenti-di-penpot: backlog
  2-26-tema-da-seme-css-varianti-di-tema-e-font: backlog
  2-27-sezioni: backlog
  2-28-skill-pds-design-e-configurazione-di-progetto: backlog
  2-29-skill-pds-code: backlog
  2-30-comportamento-accessibile: backlog
  2-31-rigenerazione-dei-componenti-di-prova-con-la-v3: backlog
  2-32-libreria-componenti-accessibile: backlog
  # rimosse (slice estrazione-costruzione, superata): 2-1-primo-profilo-…, 2-2-gate-a-4-…,
  # 2-3-prima-generazione-…, 2-4-reuse-test-…, 3-1-checklist-…, 3-2-giudizio-…,
  # 3-3-verifica-coerenza-…, 4-1-precondizione-card-…, 4-2-prima-molecola-…,
  # 4-3-card-validata-…, 4-4-vocabolario-theme-…
  3-4-sezioni-nell-editor: backlog                       # era 3-4-definizioni-di-sezione-da-penpot
```

Action item:

| Azione | Esito |
|---|---|
| Test rosso/verde per `check-boundaries.mjs` (retro Epic 1) | resta `open`; per `packages/scripts` si chiude nella Story 2.19 |
| Disciplina "test del gate" sui 5 gate della 2.6 | `done` come "senza oggetto" (gate v1 spariti); la disciplina passa ai quattro livelli della CI v3, ognuno con prova rosso/verde |
| Criterio di stop in `RecipeSchema` | `done` come "senza oggetto" (ricette sparite nella v2) |
| Robustezza del dropdown-menu scritto a mano | `done`: migrato a Base UI nella Story 2.16 (`packages/ui/src/editor/dropdown-menu.tsx`) |

`epic-2-context.md` va rigenerato alla prima story v3 (oggi descrive la v2).

## 5. Passaggio all'implementazione

**Scope: Major.** Cambia una AD architetturale, se ne scarta una spine intera, cambiano quattro CAP della SPEC e metà di Epic 2.

| Chi | Cosa |
|---|---|
| Architetto (Alessandro) | approva AD-11 v3 e i ritocchi ad AD-3, AD-5, seed, stack, deferred; marca superseded la spine 2026-10-03 e le due SPEC |
| PM / PO (Alessandro) | approva CAP-1…CAP-4 riscritti, Epic 2 ripianificato, 3.4 e 3.2 |
| Developer | applica le modifiche ai planning-artifacts su `chore/correct-course-pds-v3`, poi apre la Story 2.17 con `bmad-build` |

**Criteri di riuscita del correct-course.**
- `epics.md`, la spine 2026-07-25, `SPEC.md` e companion, `sprint-status.yaml` riportano le modifiche di §4 e nessun riferimento attivo a contratti di estrazione, istantanee, sei comandi, ruoli di parte, profili o livelli L0–L3 (fuori dalle sezioni di storia).
- `grep` su `pds-component`, `library add`, `extract`, `render --check` nei documenti di pianificazione attivi restituisce solo righe di storia.
- La Story 2.17 si apre con il test rosso sul CSS di oggi.

## 6. Rischi residui e voci rimandate

Riportati dalle forgie e da `deferred-work.md`, **non risolti** qui.

**Forgia 1 (regole).**
- Le chiavi in Penpot non si vedono, e il designer non sa che duplicare copia l'identità.

**Forgia 2 (script).**
- Il server va riavviato a ogni modifica del nucleo; mentre si sviluppa resta il dubbio "codice vecchio o nuovo?".
- Se il server non parte la skill non ha strumenti: nessun piano B da CLI.
- Il collaudo vede solo le proprietà già nel registro; una migrazione dell'import `.penpot` può sembrare un guasto dell'adattatore.

**Forgia 3 (punti aperti).**
- I metadati in Penpot non si vedono: una perdita si scopre alla generazione successiva. Per ora il controllo di stato di `pds-design`; pannello rimandato (sotto).
- Un layer che tiene la chiave ma cambia significato lo vede solo il giudizio in Storybook.
- Quali operazioni di Penpot cancellano i plugin data (raggruppa, booleane, copia tra file, ripristino, stacco) e se "fill" dentro hug regge: da misurare nel collaudo (Story 2.25).
- Senza hover disegnato non c'è hover; "testo + colore" resta affidato al giudizio umano.

**`deferred-work.md` — pannello Penpot.**
- Pannello plugin Penpot in sola lettura (`content:read`), autonomo: mostra le chiavi `part`/`when`/`slot` del layer selezionato, segnala layer senza chiave e chiavi doppie. La scrittura resta solo di `pds-code`. Si attiva quando un designer lavora senza skill e una chiave si perde prima della generazione. Da verificare: due plugin aperti insieme in Penpot. Il Semantic Tagger non serve (tag solo in memoria).

**Limiti di Penpot, del kit e dell'ambiente (spike)** — vincoli per le Story 2.23 e 2.28, non rischi da risolvere: clone annidato di `createVariants.js`; `spread` negativo rifiutato; 95 colori Tailwind fuori sRGB; `applyToken` lento; `storage` perso al ricollegamento; `switchVariant` che rinomina il layer; override non esposti dall'API; altezza "come la più alta" con figli in fill; ritaglio attivo per default; scheda sospesa dal browser.

**Deferred della spine (da riscrivere, §4.2):** seconda libreria o secondo framework (oggi rifiuto esplicito in `pds-setup`).
