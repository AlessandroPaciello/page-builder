---
title: 'Story 2.25 — Collaudo degli aggiornamenti di Penpot'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
baseline_commit: 'd0c86ffcd54416e1d59b44268b9545cddd985d22'
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
  - il default reale di `layoutAlign` su un flex non toccato sia `stretch`.
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
- [ ] `packages/scripts/collaudo/campione.penpot`: costruito ed esportato dall'istanza di collaudo.
- [x] `penpot-pipeline.md` (§ CI e collaudo), `packages/scripts/README.md` e `src/penpot/README.md`: i rimandi al collaudo.
- [ ] `deferred-work.md` e `sprint-status.yaml`: il bookkeeping.

**Acceptance Criteria:**
- Given l'istanza di collaudo con il campione importato e il plugin collegato, when lancio `PDS_PENPOT_COLLAUDO=1 pnpm --filter @penpot-ds/scripts exec vitest run collaudo/`, then è verde.
- Given `pnpm turbo run check-types lint test --force`, then è verde e il collaudo risulta saltato.

## Implementation Notes

- **Il doppione e la lettura del principale.** Con due container `collaudo@1` nello stesso file, `readComponent("collaudo")` e `readComponent("collaudo@1")` trovano sempre i due (la ricerca per contratto viene prima del nome). Senza toccare l'adattatore, il principale si legge per nome del layer: `readComponent("Collaudo")` non corrisponde a nessun contratto (confronto esatto, sensibile alle maiuscole), quindi passa al nome e trova solo il container `Collaudo`; il doppione si chiama `CollaudoDoppione`. Scritto nel README del collaudo.
- **Layer atteso dal README.** Il test legge la tabella proprietà → layer → valore di `collaudo/README.md` (righe `| \`nome\` | layer | valore |`): una voce nuova del registro senza riga fallisce dicendo di aggiungerla.
- **Valore diverso dal default.** Per le voci `keyword` e le `list` di geometria il test vuole almeno un valore diverso dal default; `layoutAlign` ha in più il default `stretch` su `FlexNonToccato`.
- **Non fatto dal sub-agente (2026-10-29):** `campione.penpot` e il collaudo dal vivo. Richiedono di fermare lo stack `penpot`, l'istanza `penpot-collaudo`, utente, token e plugin collegato nel browser, e le conferme di Alessandro a ogni scrittura via MCP. L'MCP Penpot della sessione punta al Penpot vero, dove non si scrive. Le voci di `deferred-work.md` sono marcate "in chiusura", non chiuse; la story resta `in-progress`.

## Spec Change Log

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
| 17 | Blind | `bordo` (color) e `bordo.sottile` potrebbero collidere come token e gruppo in Penpot | maybe-false | da vedere quando si costruisce il campione; anche se fosse vero sarebbe solo low | rifiutato |
| 18 | VG | Il collaudo non è mai stato eseguito | — | già noto e dichiarato nelle Implementation Notes | rifiutato (duplicato) |

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force` (con `pnpm db:start`): verde.
- `PDS_PENPOT_COLLAUDO=1 pnpm --filter @penpot-ds/scripts exec vitest run collaudo/` sull'istanza di collaudo: verde.

**Manual checks:**
- Dopo il collaudo, `docker volume ls` mostra ancora intatti i volumi `penpot_penpot_*`.
