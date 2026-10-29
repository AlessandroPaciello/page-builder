---
ticket: 25
title: 'Story 2.25 — Collaudo degli aggiornamenti di Penpot'
type: 'feature'
created: '2026-10-29'
status: 'done'
baseline_revision: 'd0c86ffcd54416e1d59b44268b9545cddd985d22'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/packages/scripts/src/penpot/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `readComponent` gira solo dal vivo, sul file "tailwind" del Penpot vero. Nessuna prova dice se una versione nuova di Penpot rompe la lettura, e le voci di `deferred-work.md` assegnate alla 2.25 restano aperte.

**Approach:** In `packages/scripts/collaudo/` ci sono tre cose:
- un campione `.penpot` che usa ogni voce del registro e ogni chiave di plugin data;
- un test lanciato a mano su un'istanza Penpot nuova, che fallisce nominando ciò che manca;
- un README con la procedura di aggiornamento.

## Boundaries & Constraints

**Always:**
- **Istanza nuova.** È un secondo progetto sullo stesso compose: `docker compose -p penpot-collaudo -f docker/penpot/docker-compose.yml`, con volumi suoi. Lo stack vero va fermato prima (`stop`), perché le porte sono le stesse. Il progetto `penpot` e i suoi volumi non si toccano.
- **Campione** (`collaudo/campione.penpot`, con i suoi token):
  - un container di varianti con contratto `collaudo@1`, almeno due celle, un'istanza annidata e un figlio assoluto;
  - un componente "fill dentro hug";
  - nella pagina "doppione", un secondo container con lo stesso contratto.

  Ogni proprietà di `registeredProperties()` compare almeno una volta, e con un valore diverso dal default se ne ha uno. Le chiavi `contract`, `part`, `when` e `slot` compaiono ciascuna almeno una volta. Di `when` e `slot` si controlla solo che ci siano: il significato lo danno la 2.27 e la 2.29.
- **Collaudo** (`collaudo/collaudo.live.test.ts`). Si salta senza `PDS_PENPOT_COLLAUDO=1`. Usa `readComponent` e `readPenpotTokenCatalog` così come sono e controlla che:
  - ogni proprietà e ogni chiave compaia nella lettura. Se manca, il test fallisce nominandola, insieme al layer atteso (dalla tabella del README). Non c'è nessuna lista di esclusioni;
  - `Lettura.parse` passi;
  - la scala ricavata dal catalogo (`scaleFromThemeCss(generateTheme(catalog).css)`) non sia vuota, e una misura in scala dia la sua classe;
  - il "fill dentro hug" sia leggibile e arrivi come domanda;
  - il doppione dia l'errore che elenca i due;
  - il default reale di `layoutAlign` su un flex non toccato sia `start` (misurato su 2.18.3) e dia `items-start`. *Rinegoziato da Alessandro il 2026-10-29: era `stretch`, che è il default del CSS e non quello di Penpot.*
- **Procedura** (`collaudo/README.md`):
  - backup del Penpot vero (`pg_dump` più il volume degli asset) prima di una migrazione;
  - istanza nuova → utente → token MCP → plugin → import → collaudo;
  - il Penpot vero (2.18.3) si aggiorna solo se il collaudo passa.
- **Migrazione o guasto.** Se il collaudo fallisce, si guarda via MCP il valore grezzo sul layer indicato. Se il valore è sparito o cambiato dopo l'import, è una migrazione dell'import `.penpot`. Se c'è ma manca nella `Lettura`, è un guasto dell'adattatore.

**Decisioni (di Alessandro, 2026-10-29):**
- Il campione lo costruisce Claude via MCP Penpot sull'istanza di collaudo, una cella per chiamata. Ogni scrittura va confermata. Alessandro lo giudica a vista e lo esporta.
- Il collaudo si lancia solo su un'istanza nuova 2.18.3, come riferimento. Nessun aggiornamento del Penpot vero.
- La misura delle operazioni che cancellano i plugin data è rimandata in `deferred-work.md` (divisione della spec).

**Never:**
- scrivere sul Penpot vero o aggiornarlo;
- salvare nel repo letture, JSON della `Lettura` o snapshot (regola 5). Il `.penpot` è un file di Penpot, non una lettura;
- modificare il nucleo, l'adattatore o il server. Un guasto diventa una voce di deferred, salvo una correzione di una riga concordata;
- aggiungere voci al registro;
- far girare il collaudo in CI.

## I/O & Edge-Case Matrix

| Scenario | Input / Stato | Atteso |
|---|---|---|
| campione completo | 2.18.3 nuova, campione importato | verde |
| proprietà assente | una voce tolta dal campione (prova a mano) | rosso che nomina la proprietà e il layer |
| chiave assente | `slot` tolto | rosso che nomina `slot` |
| doppione | due container `collaudo@1` | l'errore elenca i due |
| senza variabile | `PDS_PENPOT_COLLAUDO` assente | suite saltata |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/penpot/read-component.ts`: `readComponent(name, {endpoint?})` si usa così com'è. La ricerca per contratto e il caso con più risultati stanno in `READ_COMPONENT_SOURCE`.
- `packages/scripts/src/penpot/penpot-reader.ts`: `readPenpotTokenCatalog(endpoint?)`.
- `packages/scripts/src/core/registry.ts` e `geometry.ts`: `registeredProperties()`, cioè l'elenco da coprire. I default stanno nelle voci `keyword` e `list`.
- `packages/scripts/src/core/verify.ts:51-57`: le chiavi già in uso (`part`, `repeat`, `element`). `when` e `slot` non ci sono ancora.
- `core/geometry.ts` `scaleFromThemeCss` e `shared/theme-generator.ts` `generateTheme`: la scala.
- `packages/scripts/tests/penpot/read-component.live.test.ts`: è il modello (skip su variabile, `beforeAll` con timeout lunghi).
- `packages/scripts/tsconfig.json`: in `include` va aggiunto `collaudo/**/*.ts`.
- `docker/penpot/docker-compose.yml`: il `name: penpot` pinnato resta; `-p` lo sovrascrive.
- `deferred-work.md`: le voci da chiudere sono `layoutAlign`/`alignItems` di default, `READ_COMPONENT_SOURCE` mai in CI (caso doppione) e la scala del server non esercitata. `min-w-0` e il limite degli override restano aperti.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/collaudo/README.md`: procedura, tabella proprietà → layer → valore, regola migrazione/guasto, esito di "fill dentro hug".
- [x] `packages/scripts/collaudo/collaudo.live.test.ts` e `tsconfig.json`: i controlli dei Boundaries.
- [x] `packages/scripts/collaudo/campione.penpot`: costruito ed esportato dall'istanza di collaudo.
- [x] `penpot-pipeline.md` (§ CI e collaudo), `packages/scripts/README.md` e `src/penpot/README.md`: i rimandi al collaudo.
- [x] `deferred-work.md` e `sprint-status.yaml`: il bookkeeping.

**Acceptance Criteria:**
- Given l'istanza di collaudo con il campione importato e il plugin collegato, when lancio `PDS_PENPOT_COLLAUDO=1 pnpm --filter @penpot-ds/scripts exec vitest run collaudo/`, then è verde.
- Given `pnpm turbo run check-types lint test --force`, then è verde e il collaudo risulta saltato.

## Implementation Notes

- **Il doppione e la lettura del principale.** Con due container `collaudo@1` nello stesso file, `readComponent("collaudo")` e `readComponent("collaudo@1")` trovano sempre i due (la ricerca per contratto viene prima del nome). Senza toccare l'adattatore, il principale si legge per nome del layer: `readComponent("Collaudo")` non corrisponde a nessun contratto (confronto esatto, sensibile alle maiuscole), quindi passa al nome e trova solo il container `Collaudo`; il doppione si chiama `CollaudoDoppione`. Scritto nel README del collaudo.
- **Layer atteso dal README.** Il test legge la tabella proprietà → layer → valore di `collaudo/README.md` (righe `| \`nome\` | layer | valore |`): una voce nuova del registro senza riga fallisce dicendo di aggiungerla.
- **Valore diverso dal default.** Per le voci `keyword` e le `list` di geometria il test vuole almeno un valore diverso dal default; `layoutAlign` ha in più il default reale di Penpot, `start`, su `FlexNonToccato`. Il `default` del registro (`stretch`) è il valore che non dà classi perché è già il comportamento del CSS: non è il default di Penpot.
- **Non fatto dal sub-agente (2026-10-29):** `campione.penpot` e il collaudo dal vivo. Richiedono di fermare lo stack `penpot`, l'istanza `penpot-collaudo`, utente, token e plugin collegato nel browser, e le conferme di Alessandro a ogni scrittura via MCP. L'MCP Penpot della sessione punta al Penpot vero, dove non si scrive. Le voci di `deferred-work.md` sono marcate "in chiusura", non chiuse; la story resta `in-progress`.
- **Fatto in sessione (2026-10-29).** Campione costruito da Claude via MCP sull'istanza `penpot-collaudo` 2.18.3, con la conferma di Alessandro a ogni scrittura, ed esportato in `campione.penpot`. Trovato costruendolo: i token non possono essere prefisso l'uno dell'altro (finding 17), quindi nomi coi namespace Tailwind v4; la proprietà del token font è `fontFamily` (Bug 5 del registro), non `fontFamilies` come dice la documentazione dell'API; un container di varianti vuole almeno due celle (il doppione ne ha due); il "fill dentro hug" si costruisce solo mettendo prima il figlio in *fill* (README, § Esiti). Prova sul file sorgente: 9/10, rosso su `layoutAlign` (`start`, rinegoziato, vedi Spec Change Log). Collaudo sul file importato: 10/10. Prova a mano su una copia importata (`slot` vuoto, token `opacity.muted` staccato da `Assoluto`): i due rossi attesi, che nominano `slot`/`Slot` e `opacity`/`Assoluto`. Voci di `deferred-work.md` chiuse; restano aperti `min-w-0`/`min-h-0`, il limite degli override e `variantError`.

## Spec Change Log

- **2026-10-29, default di `layoutAlign` (rinegoziato da Alessandro).** La prova del collaudo sul file del campione ha dato `layoutAlign = start` su `FlexNonToccato`: è il valore grezzo di Penpot 2.18.3 (`flex.alignItems`), la `Lettura` lo riporta uguale, quindi non è un guasto né una migrazione. La Boundary chiedeva `stretch`, che è il default del CSS: nel registro `default` vuol dire "nessuna classe" (`core/registry.ts`), e un flex non toccato dà `items-start`, fedele a Penpot. Il controllo ora vuole `start` e `items-start`, così una versione di Penpot che cambia il default fa diventare rosso il collaudo.

## Review Triage Log

Review del 2026-10-29 (Blind Hunter, Edge Case Hunter, Verification Gap), iterazione 0.

| # | Layer | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|---|
| 1 | Blind, Edge, VG | La copertura accetta `tokens[p]` o `style[p]`: un import che perde i binding (resta il grezzo) o una lettura grezza rotta (resta il token) passa verde | medium | `collaudo.live.test.ts:483-486`; nel campione ogni voce `token` è legata, `tokensOf` e `styleOf` leggono campi separati | patch |
| 2 | VG, Edge, Blind | Una voce del registro senza riga nel README non fa fallire nulla (cambia solo il messaggio), contro quanto dice il README; il parser prende la prima riga col backtick in tutto il file, anche dalla tabella dei token | low | `where()` ripiega su "nessuna riga…"; `expectedLayers()` scorre tutto il README | patch |
| 3 | Blind, Edge, VG | L'istanza di `Etichetta` è controllata solo come presente: componente e `overrides: []` (promessi dal README) no, quindi una regressione di `overridesOf` passa | medium | `collaudo.live.test.ts:475`; `overridesOf` in `read-component.ts:262` | patch |
| 4 | VG | La voce di deferred `READ_COMPONENT_SOURCE` è data "in chiusura" ma il collaudo non controlla la soppressione dei default (`> 0` su padding/gap), il nome ignoto né `variantError` | medium | `read-component.ts:207-214, 341, 358`; nessuna asserzione nel test | patch (asserzioni su `FlexNonToccato` e nome ignoto; `variantError` resta aperto nella voce) |
| 5 | Blind, VG | Il test `Lettura.parse` non può fallire: `readComponent` fa già `safeParse` e lancia in `beforeAll` | low | `read-component.ts` valida prima di restituire | patch |
| 6 | Blind | "Fill dentro hug" accetta la domanda su H o V; il campione è su H | low | `collaudo.live.test.ts:521` | patch |
| 7 | Blind | Procedura con backup ma senza ripristino | medium | `collaudo/README.md` passo 1 | patch |
| 8 | Blind, Edge | `export PENPOT_MCP_TOKEN` nella shell viene sovrascritto da direnv (`.envrc` = `dotenv`) e dall'estensione `mkhl.direnv` | medium | `.envrc` alla root; `resolveMcpEndpoint` legge l'ambiente | patch |
| 9 | Blind | Nessun controllo che la lettura venga dall'istanza di collaudo né che il catalogo abbia il set `collaudo` | low | `beforeAll` non controlla il catalogo | patch |
| 10 | Blind | L'AC dell'epic chiede ancora la misura dei plugin data; la voce di deferred non ha `routed:` | medium | `epics.md` Story 2.25 invariato; divisione decisa da Alessandro | defer (allineare `epics.md` con un correct-course) |
| 11 | Blind | La copertura mette insieme tutti i layer: la colonna "layer" non è controllata | low | i campi si leggono uguali per tipo di shape, quindi una rinomina di Penpot si vede comunque; la correzione richiede di interpretare la colonna in prosa | rifiutato |
| 12 | Blind | Le chiavi di plugin data sono controllate solo su `Collaudo` e non sul layer della tabella | low | come la 11 | rifiutato |
| 13 | Blind | `layoutAlign` assente o sbagliato su `FlexNonToccato` danno lo stesso rosso | false | il rosso porta alla regola migrazione/guasto, che guarda il valore grezzo; è il compito del collaudo | rifiutato |
| 14 | Edge | Il test non registra la versione di Penpot | low | serve un `execute_code` in più; la versione la fissa `PENPOT_VERSION` nella procedura | rifiutato |
| 15 | Blind, Edge | Stato della spec, checkbox del bookkeeping, "verde" in Verification, esito di "fill dentro hug" dato per fatto | — | la correzione modifica la spec di questa build | rifiutato (regola) |
| 16 | Blind | I documenti descrivono `campione.penpot` che non c'è ancora | low | arriva nella stessa story, prima della chiusura | rifiutato |
| 17 | Blind | `bordo` (color) e `bordo.sottile` potrebbero collidere come token e gruppo in Penpot | low | confermato il 2026-10-29 costruendo il campione: Penpot rifiuta `bordo.sottile` ("A token already exists at the path … or at a prefix thereof") | patch (token rinominati con i namespace Tailwind v4: `color.border`, `border-width.thin`, `font-weight.bold`, `opacity.muted`, …; README del collaudo aggiornato) |
| 18 | VG | Il collaudo non è mai stato eseguito | — | già noto e dichiarato nelle Implementation Notes | rifiutato (duplicato) |

Review del 2026-10-29 (Blind Hunter, Edge Case Hunter, Verification Gap), iterazione 0, dopo la costruzione del campione e il collaudo dal vivo.

| # | Layer | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|---|
| 19 | Blind, VG, Edge | La soppressione dei default su `FlexNonToccato` copre padding, gap e opacità ma non raggi, tratto e ombra, che `READ_COMPONENT_SOURCE` sopprime allo stesso modo | medium | `read-component.ts:190-227`; la voce di deferred cita "default soppressi" | patch (`DEFAULT_SUPPRESSED` esteso) |
| 20 | Blind | Le voci geometriche senza default (`clip`, `width`, `height`) sono controllate solo come presenti: `clip: false` o `Quadrato` a 15 px passano | medium | `core/geometry.ts:49-56`; il test di copertura salta il confronto senza `default` | patch (test su `clip` delle celle e su 16×16 di `Quadrato`) |
| 21 | Edge | Token e valore grezzo si cercano su layer qualsiasi: un import che perde il legame su un layer passa se un altro layer ha lo stesso token | medium | il test di copertura usa `all.some` separati per `tokens` e `style` | patch (ogni layer legato deve avere anche il grezzo) |
| 22 | Edge | Un token legato che manca dal catalogo dà solo un avviso di `layerClasses`, e il collaudo resta verde | low | `beforeAll` costruisce `tokenTypeOf` dal catalogo, nessuna asserzione lo confronta coi legami | patch (test "ogni token legato è nel catalogo") |
| 23 | Blind | Il README dice "almeno una cella" per il doppione, ma Penpot vuole almeno due componenti per un container di varianti | low | `createVariantContainer` con un componente non crea il container (prova del 2026-10-29) | patch |
| 24 | Blind | La prova del rosso della matrice non è nella procedura: al prossimo aggiornamento nessuno la ripete | medium | `collaudo/README.md`, passo 8 | patch (passo "Prova del rosso") |
| 25 | Blind, Edge | Il ripristino usa `$B` della shell del backup: in una shell nuova o in un altro giorno punta a una cartella vuota, e il volume degli asset è già svuotato | medium | `collaudo/README.md`, passo 1 | patch (`B` esplicito e controllo dei file) |
| 26 | Edge | Un `pg_dump` fallito crea comunque il file del dump, e il backup sembra valido | medium | il `>` crea il file prima dell'esito del comando | patch (`test -s` e "dump ok") |
| 27 | Edge | `rm -rf /assets/*` non toglie i file nascosti prima del ripristino | low | glob della shell | patch (`find -mindepth 1 -delete`) |
| 28 | Edge | Con `restart: always` un riavvio di Docker riaccende tutti e due gli stack sulle stesse porte | low | `docker/penpot/docker-compose.yml`, 7 servizi | patch (nota nel passo 2) |
| 29 | Blind | La checklist dell'aggiornamento dimentica il commento di `UNTOUCHED_ALIGN`, la tabella degli esiti e la riesportazione del campione | low | `collaudo/README.md`, § Procedura | patch |
| 30 | Blind | Il campione non dice da quale versione e quando è stato esportato | low | `collaudo/README.md`, prima lista | patch |
| 31 | VG | La voce di deferred sulla scala del server è data chiusa, ma il collaudo riscrive la formula e non passa da `coreContext` | medium | `src/server/server.ts:91-97`; nessun test del server con misure in px | patch (voce riaperta per il cablaggio del server) |
| 32 | VG | Il rilevamento degli override non è verificato dal vivo: il campione ha solo un'istanza senza override, quindi un `overridesOf` che restituisce sempre `[]` passa | medium | `collaudo.live.test.ts`, test del container | defer (voce nuova; la chiusura di `READ_COMPONENT_SOURCE` ora la nomina) |
| 33 | VG | La chiusura di `READ_COMPONENT_SOURCE` dice più di quanto il collaudo verifica (regole di stile e override) | low | stessa radice di 19 e 32 | patch (testo della chiusura) |
| 34 | Blind | Paragrafo "Non fatto dal sub-agente" e righe 16 e 18 superati dal lavoro in sessione | — | la correzione modifica la spec di questa build | rifiutato (regola) |
| 35 | Blind | `sprint-status.yaml` dice `in-progress` mentre la spec dice `in-review` | false | lo stato lo allinea il passo di presentazione del workflow | rifiutato |
| 36 | Blind | Il PRIMA del § 4.3 del correct-course non corrisponde a `main` | false | il correct-course descrive lo stato del branch al momento (dopo `df197a5`); `penpot-pipeline.md` non è su `main` con quel percorso | rifiutato |
| 37 | Blind | Voci aperte (`min-w-0`, override, `variantError`) senza `routed:` | low | voci precedenti alla 2.25, che la spec lascia aperte | rifiutato |
| 38 | Blind | La Boundary `Lettura.parse` non ha un'asserzione esplicita | low | carried: riga 5 | carried, patch |
| 39 | Edge | La regex della tabella (`[A-Za-z]+`) non prende nomi con cifre o trattini | false | tutte le proprietà del registro e le chiavi di plugin data sono solo lettere | rifiutato |
| 40 | Edge | Il README si legge anche quando la suite è saltata: senza README la raccolta in CI si rompe | low | caso improbabile, il README sta accanto al test; la correzione aggiunge un ramo | rifiutato |

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force` (con `pnpm db:start`): verde.
- `PDS_PENPOT_COLLAUDO=1 pnpm --filter @penpot-ds/scripts exec vitest run collaudo/` sull'istanza di collaudo: verde.

**Manual checks:**
- Dopo il collaudo, `docker volume ls` mostra ancora intatti i volumi `penpot_penpot_*`.
