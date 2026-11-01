---
title: 'Operazione `pds` di raggruppamento in varianti'
type: 'feature'
ticket: '36'
created: '2026-11-01'
status: 'built'
baseline_revision: '277635f7066a81d2b8ac2edb3236acc0fc80f360'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context: ['{project-root}/packages/scripts/src/server/README.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** raggruppare le celle di un componente in un container di varianti è una sequenza manuale di sei passi in `draw-component.md` (2.28): lenta e facile da sbagliare. Il server `pds` oggi legge soltanto.

**Approach:** un nuovo strumento `group_variants` del server `pds` esegue la sequenza in una chiamata, dopo la conferma nella skill. È l'unico strumento che scrive su Penpot; il sorgente di scrittura sta in `src/penpot/`, dietro un metodo dell'adattatore.

## Boundaries & Constraints

**Always:** la matrice attesa si calcola dal contratto (`axes` + `RENDERING_AXES` + `state`); validazione completa prima di qualunque scrittura; nomi completi `Component / Axis=Value` con tutte le proprietà; il server non importa `src/penpot` (resta `main.ts` a legare l'adattatore); chiamata idempotente.

**Decisioni (2026-11-01):** (1) Multiselect Panel resta un componente singolo, come dice il ticket: `group_variants` non lo raggruppa e si correggono `draw-component.md:24` e il disegno, non il ticket; la voce `multiselect-panel` di `RENDERING_AXES` non si tocca in questa story. (2) Input `{ component }`: celle e valori si ricavano dai nomi dei board.

**Never:** scrivere plugin data `pagebuilder`; creare o modificare token; modificare il disegno; offrire un ripiego «componenti separati»; allentare il resto dell'adattatore di lettura.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Raggruppa | celle complete, nessun container | container senza `variantError`, varianti distinte, assi impostati, istanze collegate | — |
| Idempotenza | componente già raggruppato | nessuna scrittura, esito `già raggruppato` | — |
| Set parziale | manca una combinazione della matrice | rifiuto che nomina la cella mancante | nessuna scrittura |
| Nome incompleto | cella senza tutte le proprietà | rifiuto che nomina la cella | nessuna scrittura |
| Senza assi | componente a cella sola | resta singolo, nessuna scrittura | — |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/server/tools.ts:25-62` -- schemi zod di `TOOLS`; aggiungere `group_variants`
- `packages/scripts/src/server/server.ts:49-52,131-187` -- `PenpotAdapter` e `registerTool`; estendere con `groupVariants`
- `packages/scripts/src/server/main.ts:21-30` -- binding dell'adattatore vero
- `packages/scripts/src/penpot/read-component.ts:104-372,399-419` -- modello del sorgente `execute_code` e del client; nuovo `group-variants.ts` accanto
- `packages/scripts/src/core/rendering.ts:43-53`, `core/verify.ts:287-356` -- assi e regola dei nomi; il calcolo della matrice va in `core/`
- `packages/scripts/tests/server/server.test.ts:111` -- «espone i sei strumenti»; adattatore finto da `tests/fixtures/components.ts`
- `skills/pds/pds-design/references/draw-component.md:24-35`, `kit-wrappers.md:28`, `SKILL.md:28`, `pds-setup/SKILL.md:36` -- sostituire i passi 1–5 con la chiamata; tre copie identiche (`.agents/`, `.claude/`)
- `packages/scripts/src/server/README.md:34`, `penpot/README.md:7` -- il confine «mai su Penpot» cambia

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/core/group-variants.ts` -- matrice attesa e validazione delle celle (parziale, nome incompleto) -- logica pura testabile
- [x] `packages/scripts/src/penpot/group-variants.ts` -- sorgente `execute_code` della sequenza e metodo dell'adattatore -- scrittura isolata
- [x] `packages/scripts/src/server/{tools,server,main}.ts` -- strumento `group_variants` e binding -- esposizione
- [x] `packages/scripts/tests/**` -- test del nucleo, del sorgente e del server; test di confine esteso alla scrittura -- copre la matrice
- [x] README e tre copie della skill `pds-design` -- chiamata al posto della sequenza manuale -- documentazione

**Acceptance Criteria:**
- Given il server avviato, when si elencano gli strumenti, then `group_variants` è l'unico che scrive.
- Given un set non valido, when si chiama `group_variants`, then nessuna scrittura parte.
- Given il file Penpot duplicato con i cinque set della Multiselect, when si segue la voce DC, then ogni componente si raggruppa con una chiamata e `verify_component` lo trova.

## Implementation Notes

Il raggruppamento usa `penpot.createVariantFromComponents` («Combine as variants»), non la sequenza `transformInVariant`: il container nasce senza variante automatica ma senza layout flex. Un solo board senza proprietà nel nome (Multiselect Panel) o una matrice a una combinazione risponde `singolo`; un board solo con proprietà nel nome è un set parziale. Prova live della scrittura non eseguita: serve il file Penpot duplicato.

## Plan Change Log

## Review Triage Log

Pass 1 (quick): 0 high, 1 medium, 3 low, 2 false.

| Verdetto | Rotta | Esito |
|---|---|---|
| false | — | `server.ts:199` tipo: `exactOptionalPropertyTypes` non è attivo in nessun tsconfig; `pnpm check-types` verde |
| low | patch | `.replace("__PLAN__", stringa)` interpreta `$&`: sostituito con funzione |
| medium | patch | Più container che rispondono allo stesso nome (file con pagina duplicata) non erano segnalati: ora errore «Più componenti rispondono», come `readComponent` |
| low | scartato | Componente senza assi con più celle sciolte risponde `singolo`: caso improbabile, la correzione aggiunge un ramo |
| low | patch | Etichetta «Story 2.28» al posto di 2.36 in commenti e README |
| false | — | AC 3 senza prova live: non è un difetto del codice; resta il controllo manuale della Verification, non eseguito |

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde
- `pnpm lint && pnpm check-types` -- expected: verdi

**Manual checks (if no CLI):**
- Prova live sul file Penpot duplicato (Chip, Checkbox, Option, Multiselect Trigger, Multiselect): una chiamata per componente, seconda chiamata senza effetti.
