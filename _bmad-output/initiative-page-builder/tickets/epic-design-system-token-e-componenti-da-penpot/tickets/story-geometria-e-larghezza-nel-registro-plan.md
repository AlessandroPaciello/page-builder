---
ticket: 21
title: 'Story 2.21 — Geometria e larghezza nel registro'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_revision: '5630a1a099abf0edc61fdd9fc1662600deafa937'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-page-builder/archive-v6/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Oggi il nucleo traduce token, layout flex e "fill", ma ignora misure fisse, posizione degli assoluti, vincoli e ritaglio (bug 11, lato nucleo). Di conseguenza frecce e pallini restano senza misura, e un `overflow-hidden` messo ovunque taglierebbe l'anello di focus.

**Approach:** Aggiungere al registro le voci di geometria e scrivere in `src/core/geometry.ts` le regole di contesto, che leggono genitore, figli e celle. Tutte le regole della forgia (a′, fuori scala, ritaglio, vincoli, fill dentro hug) diventano funzioni pure, ognuna con il suo test rosso/verde.

## Boundaries & Constraints

**Always:** si rispettano i confini della 2.19 e le regole della 2.20 (classi ordinate e senza doppioni, una proprietà non traducibile dà un avviso e mai un blocco). La geometria si legge solo da `style`. I test stanno in `tests/core/`.

**Never:**
- `cva`, raggruppamento per asse e generazione: sono della 2.22;
- adattatore e calcolo delle coordinate da Penpot: sono della 2.23;
- scrittura delle risposte in Penpot: è della 2.29;
- copiare `test-v3/`;
- toccare `contracts`, `tokens`, `ui`.

**Decisioni (mie, da confermare se riemergono):**
- **Chiavi di `style`:**
  - `x`, `y`, `width`, `height` in px, con `x`/`y` relativi all'angolo del genitore;
  - `position` `flow`|`absolute` (default `flow`);
  - `constraintH` `left`|`right`|`leftright`|`center`|`scale` (default `left`);
  - `constraintV` `top`|`bottom`|`topbottom`|`center`|`scale` (default `top`);
  - `clip` booleano, assente = nessun ritaglio.
- **Scala = token `spacing` del tema** (input `scale: {suffix, px}[]`). Non si usano i multipli di 4px, perché il tema reale ridefinisce `--spacing-5` = 24px.
  - In scala: `w-<sfx>`.
  - Fuori scala: `w-[37px]` con un avviso che riporta il token più vicino (a parità di distanza vince il più piccolo).
  - Negativi: `-left-<sfx>` oppure `left-[-3px]`.
- **Dimensione fissa** (sizing `fix` su un layer non radice) → `w-`/`h-`, oppure niente se:
  - con `leftright` o `topbottom`, quell'asse non ha misura;
  - con tutti i figli in `fill` su un asse, la misura del genitore su quell'asse si ignora (vale anche per la radice).
- **Radice:** `rootSizeClasses(cells, {scale})` restituisce le classi per cella. Sono vuote se la misura è uguale in tutte le celle; altrimenti la `cva` della 2.22 le raggruppa sotto l'asse.
- **Assoluti:**
  - il layer prende `absolute` e il genitore `relative`;
  - `left`/`right`/`leftright` diventano `left-*`/`right-*`, e analogamente in verticale;
  - `center` → `left-1/2 -translate-x-1/2`, con un avviso se il layer non è centrato esattamente;
  - `scale` → avviso e nessuna classe.
- **Ritaglio** (solo con `clip: true`): `overflow-hidden` se un figlio esce dal riquadro, oppure se il genitore ha un raggio e un figlio tocca un bordo. Se invece niente esce ma un discendente ha contenuto variabile, è una domanda; altrimenti non c'è classe.
  - Contenuto variabile = `kind` `text` o `image`, oppure `pluginData.slot`. Ogni testo conta, perché il nucleo non sa quale field lo riempie: lo decide il TSX.
- **Domande con risposta in plugin data:** `Finding` `domanda` riceve un campo obbligatorio `key`, cioè la chiave di plugin data in cui `pds-code` scriverà la risposta.
  - Ritaglio: `overflow` = `hidden`|`visible`.
  - "Fill" dentro hug: `fillInHugH`/`fillInHugV` = `fill` (classi di fill) | `hug` (nessuna classe).
  - Una risposta valida sostituisce la domanda; un valore non valido la ripropone.
- `layerClasses` prende `parent?: LetturaLayer` al posto di `parentDir`, che si ricava da `parent.style.layoutDir`, più `scale`.

## I/O & Edge-Case Matrix

Scala: `spacing.4` = 16, `spacing.10` = 40.

| Scenario | Input | Output |
|---|---|---|
| fix in scala | figlio con `sizingH: fix`, `width: 16` | `w-4` |
| fuori scala | `width: 37` | `w-[37px]`, avviso con `spacing.10` (40px) come valore più vicino |
| tutti in fill | genitore `fix` largo 200, figli tutti `sizingH: fill` | nessuna `w-` sul genitore |
| radice uguale | due celle, `width: 200` in entrambe | `[[], []]` |
| radice varia | `width` 160 e 200 | `[["w-[160px]"…], [...]]`, con avvisi se fuori scala |
| assoluto | `left` e `top` con `x: 16`, `y: 0` | `absolute left-4 top-0`, genitore `relative` |
| leftright | `x: 16`, larghezza lasciata = 16 | `left-4 right-4`, nessuna `w-` |
| scale | `constraintH: scale` | avviso, nessuna classe orizzontale |
| esce | `clip`, figlio con `x: -4` | `overflow-hidden` |
| raggio + bordo | `clip`, raggio, figlio con `x: 0` | `overflow-hidden` |
| ambiguo | `clip`, niente esce, figlio `text` | domanda `key: overflow`, nessuna classe |
| risposto | come sopra, con `pluginData.overflow: visible` | nessuna domanda, nessuna classe |
| fill in hug | figlio `fill` in un genitore `auto` | domanda `key: fillInHugH`, nessuna classe di fill |
| valore malformato | `width: "abc"`, `clip: "sì"` | avviso, nessuna classe |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/core/registry.ts`: `REGISTRY`, `layerClasses`, `fillSizing`, gli avvisi con `HOW_TO_TEACH`.
  - Le voci di geometria sono un terzo `kind: "geometry"` (con `values` per le liste chiuse e il controllo del tipo per numeri e booleani). Il ciclo principale le valida e poi chiama `geometryClasses`.
  - `fillSizing` riceve la risposta a "fill dentro hug".
- `packages/scripts/src/core/geometry.ts` (nuovo): `geometryClasses(layer, {parent, scale})`, `rootSizeClasses`, `scaleClass` per il fuori scala, il ritaglio e il contenuto variabile. Si esporta da `src/core/index.ts`.
- `packages/scripts/src/core/schemas.ts:81-85`: `key` sulla `domanda`.
- `packages/scripts/tests/core/registry.test.ts`:
  - la tabella `GREEN` è tipata `Record<RegisteredProperty, …>`, quindi ogni nuova voce richiede i suoi verdi;
  - `redCase` va esteso al `kind` geometry;
  - `run()` costruisce un genitore a partire da `parentDir`.
- `packages/scripts/tests/core/registry-tailwind.test.ts`: va esteso alle classi di geometria (per ogni token spacing, ogni lato, i negativi, gli arbitrari e le classi fisse). La scala si ricava dalle `--spacing-*` del tema generato.
- `packages/scripts/tests/core/schemas.test.ts:61-72`: `key` sulla domanda.
- Spike, solo come riferimento: `_bmad-output/spikes/penpot-ai-kit-2026-10-10/test-v3/codice/packages/scripts/src/v3/generate.ts:191-225` (`step`, `classesOf`).

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/tests/core/geometry.test.ts`: scriverlo per primo, rosso. Contiene la matrice e un rosso/verde per regola.
- [x] `packages/scripts/src/core/schemas.ts` + `tests/core/schemas.test.ts`: `key` obbligatoria sulla `domanda`.
- [x] `packages/scripts/src/core/geometry.ts`: le regole (Decisioni).
- [x] `packages/scripts/src/core/registry.ts` + `index.ts`: voci geometry, nuovo input di `layerClasses`, risposta a "fill dentro hug".
- [x] `packages/scripts/tests/core/registry.test.ts`: verdi e rossi delle voci nuove, `run()` con il genitore.
- [x] `packages/scripts/tests/core/registry-tailwind.test.ts`: livello 4 sulle classi di geometria.
- [x] README del package, commento in testa al registro (togliere "Story 2.21") e `sprint-status.yaml`.

**Acceptance Criteria:**
- Given una mutazione per regola (soglia del fuori scala, ramo del raggio, `leftright` che emette `w-`, risposta ignorata), when lancio i test, then almeno un test diventa rosso.
- Given il livello 4, when ogni classe di geometria espansa sulla scala del tema compila, then ognuna produce CSS.
- Given `pnpm turbo run check-types lint test --force`, then tutto verde.

## Implementation Notes

- **I vincoli contano solo sugli assoluti.** `leftright`/`topbottom` (niente misura) e `scale` (avviso) valgono solo con `position: absolute`. Su un layer nel flusso `x`/`y` e vincoli non danno classi, altrimenti resterebbe senza misura. Se l'adattatore (2.23) non marca `absolute` i figli dei board senza flex, la regola va rivista.
- **Avviso fuori scala:** i passi della scala portano solo il suffisso, quindi il messaggio nomina `--spacing-10 (40px)` e non `spacing.10`.
- **"Tutti in fill":** gli assoluti non contano tra i figli. Un layer con soli figli assoluti non attiva la regola.
- **Assoluto con dati mancanti:** se mancano o sono malformati `x`, la misura o la misura del genitore, c'è un avviso e nessuna classe di posizione su quell'asse. `center` senza dati per controllarlo non dà avvisi.
- **Zero:** diventa sempre `<prefix>-0` senza avviso, anche se la scala non ha un passo da 0px. Tailwind lo compila.
- **Ordine dei finding:** quelli di geometria vengono dopo gli avvisi delle proprietà, che restano in ordine alfabetico.
- **Rosso provato con 11 mutazioni**, ognuna fa diventare rosso almeno un test:
  - tolleranza di 1px sulla scala;
  - spareggio invertito;
  - i due modi di rompere il ramo del raggio;
  - `leftright` che emette `w-`;
  - risposte `overflow` e `fillInHug` ignorate;
  - regola "tutti in fill" tolta;
  - classe sconosciuta a Tailwind (livello 4);
  - avviso del centramento tolto;
  - `scale` che tiene la `w-`.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|
| 1 | Layer assoluto con figli assoluti: `absolute` e `relative` insieme (Blind) | medium | `relative` si aggiunge dai figli, `absolute` dal layer; vince `relative` e il layer perde la posizione | patch, con test |
| 2 | "Fill" su un layer assoluto: classi flex e domanda fill-in-hug (Blind, Edge) | medium | `fillSizing` non conosce `position`, mentre `allChildrenFill` esclude gli assoluti | patch: assoluto = genitore senza flex (`w-full`/`h-full`), niente domanda |
| 3 | Match esatto in `scaleClass` non deterministico con due passi agli stessi px (Blind) | low | `find` dipende dall'ordine del catalogo; correzione diretta | patch, con test |
| 4 | Geometria in `tokens` e `style`: l'avviso dice "Nessuna classe", ma la classe esce da `style` (Edge) | low | il messaggio contraddice l'output; correzione diretta del testo | patch |
| 5 | Il livello 4 asserisce `16px → w-4`, che vale anche con i multipli di 4px (Blind) | low | il controllo non prova la frase del commento; cancellazione | patch |
| 6 | `center` con dati mancanti senza test (VG) | — | gap verificato dal layer | patch: test |
| 7 | Sizing malformato con misura senza test (VG) | — | gap verificato dal layer | patch: test |
| 8 | Il nucleo non ha un costruttore di `Scale` dal tema; esiste solo una regex nel test (Blind) | medium | i consumer 2.22/2.24 rischiano scale diverse da quella del livello 4 | defer |
| 9 | Rumore sub-pixel di Penpot (15.9999) nei confronti esatti (Edge) | maybe-false (medium) | dipende da cosa emette l'adattatore: da misurare nel collaudo | defer |
| 10 | Offset degli assoluti dentro un genitore con bordo interno sfalsati dello spessore (Edge) | medium | in CSS l'offset parte dentro il bordo, in Penpot dal riquadro esterno; il nucleo non conosce il valore del token | defer |
| 11 | Raggio 0 (o token a 0) conta come raggio (Blind, Edge) | low | il raggio grezzo dà già un avviso; un token a 0 legato apposta è raro; la correzione richiede i valori dei token | scartato |
| 12 | `touchesEdge` non guarda quale angolo è arrotondato (Blind) | low | il codice segue la regola frozen ("ha raggio e un figlio tocca un bordo"); il raffinamento aggiunge rami | scartato |
| 13 | `rootSizeClasses` tace sui valori malformati e ripete gli avvisi (Blind) | false / low | la radice passa anche da `layerClasses`, che avvisa sul valore malformato; avvisi per cella con `where` diverso | scartato |
| 14 | `center` senza dati non avvisa (Blind) | low | comportamento deciso nelle Implementation Notes; il test arriva con la patch 6 | scartato |
| 15 | La spec non è nel diff (Blind) | false | la spec è untracked per costruzione del workflow e si committa con la story | scartato |
| 16 | Nipote che esce attraverso un figlio che non ritaglia (Edge) | low | un gruppo Penpot ha per riquadro l'unione dei figli; il caso richiede un board senza clip annidato; serve ricorsione | scartato |
| 17 | Rami senza test (Blind) | — | sovrapposto a 1, 2, 3, 6, 7 | coperto dalle patch |

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force` (con `pnpm db:start`): verde.
- `pnpm --filter @penpot-ds/scripts theme && git status --porcelain packages/tokens`: nessun file cambiato.
