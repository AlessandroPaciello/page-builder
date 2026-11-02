---
title: 'Comportamento accessibile'
type: 'feature'
ticket: '30'
created: '2026-11-02'
status: 'built'
baseline_revision: 'e7caac43907bb96a5220e0cfae5bcea5ccd5180c'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-page-builder/spec-page-builder/a11y-baseline.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `pds-code` tratta il comportamento in una riga dentro GC: manca la procedura per sceglierlo un pezzo alla volta, leggere ricetta shadcn `base` e pattern APG senza salvarli, mostrare un diff piccolo per pezzo e pretendere il test. Nel codice l'unico componente generato, il Chip, ha la croce di `removable` come icona `aria-hidden` che non fa nulla.

**Approach:** una reference `behaviour.md` in `pds-code` (elenco → un diff per comportamento con conferma → un test per comportamento), il gancio in `generate.md` e `SKILL.md`, la regola nella §6 della baseline, e la prova sul Chip: la croce diventa un pulsante con nome accessibile e `onRemove`, con i suoi test. La §6 e axe sulle story `@generated` sono già in piedi dalla 2.29: qui si verificano, non si rifanno.

## Boundaries & Constraints

**Always:** Base UI per primo — se il primitivo esiste si propone solo il collegamento; altrimenti ricetta shadcn `base` e APG letti dal vivo, mai salvati. Un comportamento per volta: elenco, diff piccolo, conferma, test nel file dello sviluppatore, eseguito da GA. Una dipendenza nuova la sceglie lo sviluppatore, con l'alternativa senza dipendenze. Si ripropone solo su richiesta o quando un cambio di struttura tocca una parte usata. `styles.ts` e la story restano `@generated`; il TSX si tocca solo su richiesta. Il comportamento resta dentro GC, senza voce nuova nel menu della skill.

**Never:** non salvare la ricetta o l'APG nel repo; non scegliere una dipendenza al posto dello sviluppatore; non toccare i file `@generated`; non estendere il comportamento a componenti assenti (Badge, ShopCard e Carousel sono della 2.31); non toccare nucleo e server `pds`.

**Decisione (2026-11-02):** la prova sul codice è il Chip `removable`. Il ramo shadcn non si esercita qui — shadcn non ha un badge con rimozione — e si prova alla 2.31 con il Carousel, che resta una sezione con il suo `build_order`, la card e il disegno in Penpot.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Primitivo Base UI | componente con primitivo esistente (il menu dell'editor) | solo il collegamento, con diff e test | nessun pacchetto nuovo |
| Nessun primitivo | Chip `removable` | ricetta `base` e APG letti dal vivo; elenco, un diff, un test per comportamento | la ricetta non entra nel repo |
| Dipendenza nuova | un comportamento la chiede | la scelta è dell'utente, con l'alternativa senza dipendenze | senza scelta non si installa |
| GA | un test di comportamento rosso | rosso con comando, file e test | nessun verde parziale |

</frozen-after-approval>

## Code Map

- `skills/pds/pds-code/SKILL.md` — copia identica in `.agents/skills/pds-code` e `.claude/skills/pds-code`: `description`, «Su cosa non si transige», riga GC, `Riferimenti`.
- `skills/pds/pds-code/references/generate.md` — il passo 4 diventa un gancio di due righe verso la reference nuova; le altre voci non cambiano.
- `skills/pds/pds-code/references/behaviour.md` — nuovo, stile delle reference esistenti (`# XX — Titolo`, `## Ingresso`, passi, `## Cosa non fai`).
- `_bmad-output/initiative-page-builder/spec-page-builder/a11y-baseline.md:38-45` — la §6 esiste già: si aggiunge la regola della fonte, senza riscritture.
- `packages/ui/src/domains/chip/Chip.tsx` — scaffold dello sviluppatore; `removable` rende `<X aria-hidden>` senza controllo; `onRemove` va dichiarato e tolto dallo spread.
- `packages/ui/src/editor/dropdown-menu.test.tsx` — modello di test: `fireEvent`, `screen`, `axe` da `vitest-axe`, `cleanup`; niente `jest-dom` né `user-event`.
- `packages/ui/src/domains/stories-axe.test.tsx` — gate axe della 2.29: resta com'è.

## Tasks & Acceptance

**Execution:**
- [x] `skills/pds/pds-code/references/behaviour.md` (+ copie) — quando parte, fonti in ordine (Base UI → ricetta `base` + APG letti dal vivo), elenco, un diff per comportamento con conferma, un test per comportamento, scelta della dipendenza, riproposizione, cosa non fa.
- [x] `skills/pds/pds-code/references/generate.md` (+ copie) — il passo 4 rimanda a `behaviour.md`.
- [x] `skills/pds/pds-code/SKILL.md` (+ copie) — la regola del comportamento un pezzo alla volta con il test; «proponi il comportamento» nella `description`; GC e `Riferimenti`.
- [x] `a11y-baseline.md` §6 — fonte del comportamento e test per pezzo.
- [x] `packages/ui/src/domains/chip/Chip.tsx` — con `removable` la croce diventa `<button type="button">` con `aria-label={`Rimuovi ${label}`}` e `onClick={onRemove}`, diff mostrato prima; classi e resa invariate.
- [x] `packages/ui/src/domains/chip/Chip.test.tsx` — nome accessibile, click che chiama `onRemove`, assenza del pulsante senza `removable`, axe verde sul Chip `removable`.

**Acceptance Criteria:**
- Given un componente con un primitivo Base UI, when si chiede il comportamento, then la reference propone solo il collegamento, con un diff e un test, senza pacchetti nuovi.
- Given un componente senza primitivo, when si chiede il comportamento, then la skill legge ricetta `base` e APG dal vivo, propone un diff per comportamento con conferma e un test per comportamento, e nessun file della ricetta entra nel repo.
- Given il Chip con `removable`, when si usa la croce, then è un pulsante «Rimuovi <label>» che chiama `onRemove`; senza `removable` non esiste; axe è verde; `pnpm test` li esegue.
- Given il repo dopo il cambio, when si esegue GA, then `check-types` e `test` sono verdi e le tre copie della skill sono identiche.

## Implementation Notes

**Fatto.** Nuova `skills/pds/pds-code/references/behaviour.md` (+ copie identiche in `.agents/skills/pds-code` e `.claude/skills/pds-code`): quando parte, fonti in ordine (Base UI → ricetta shadcn `base` + APG letti dal vivo), elenco, un diff per comportamento con conferma, un test per comportamento, scelta della dipendenza, riproposizione, cosa non fa. `references/generate.md` passo 4 rimanda alla reference nuova; `SKILL.md` ha la regola del comportamento un pezzo alla volta, la `description` con «proponi il comportamento», la riga GC e `Riferimenti`. `_bmad-output/initiative-page-builder/spec-page-builder/a11y-baseline.md` §6 riceve la regola della fonte e del test per pezzo.

**Chip.** Con `removable` e `onRemove` la croce è `<button type="button" data-slot="icon-x" aria-label={`Rimuovi ${label}`} onClick={onRemove}>`; senza handler la croce resta la `X` `aria-hidden` di prima, con le stesse classi. `onRemove` è dichiarato in `ChipProps` e tolto dallo spread. Al pulsante servono `inline-flex items-center` per non introdurre l'altezza di riga del bottone nativo: la resa del Chip resta quella di `md`/`sm`.

**Test.** `packages/ui/src/domains/chip/Chip.test.tsx`: nome accessibile e `type="button"`, click che chiama `onRemove`, nessun pulsante senza `removable`, con `removable` ma senza `onRemove` la croce resta un'icona non interattiva, axe verde sul Chip `removable`. Stesso modello di `editor/dropdown-menu.test.tsx` (`fireEvent`, `screen`, `vitest-axe`, `cleanup`), senza `jest-dom` né `user-event`.

**Verifica.** Prima delle correzioni di review: `pnpm check-types` 11/11; `pnpm test` 8/8 (dopo `pnpm db:start`, per i test di integrazione di `@app/db`); `pnpm --filter @penpot-ds/ui test` 10 file / 38 test verdi. Dopo le correzioni: test del Chip 5/5 e `diff -r` tra le tre copie della skill senza differenze.

**Nota.** La prova visiva in Storybook (resa del Chip `removable` invariata su `md`/`sm`) resta manuale: non c'è un test visivo nel repo.

## Plan Change Log

## Review Triage Log

### Review quick (2026-11-02, iterazione 0)

Verdetti: high 0 · medium 3 · low 2 · false 0. Un solo gruppo per causa comune (#2 e #3): la registrazione della skill non segue il cambio di descrizione e della riga GC.

| # | Finding | Verdetto | Route | Evidenza / azione |
|---|---|---|---|---|
| 1 | `behaviour.md` cita `a11y-baseline.md` come path nudo | medium | patch | il path nudo risolve dalla dir della skill, dove il file non c'è; esiste `docs/legacy/a11y-baseline.md` (si ferma a §5) e la policy vieta di usarlo come grounding: path completo |
| 2 | `.opencode/commands/pds-code.md` ha la `description` vecchia | low | patch | verificato: lo stub è identico alla riga rimossa dalla `SKILL.md`, mentre `pds-design` la specchia: si allinea |
| 3 | le tre `module-help.csv` hanno la riga GC vecchia | low | patch | verificato: il testo è quello di `SKILL.md` prima del cambio: si allinea alla riga GC nuova (#2 e #3, stessa causa) |
| 4 | con `removable` e senza `onRemove` il Chip rende un pulsante inerte e focusabile | medium | patch | verificato: `<button aria-label="Rimuovi …" onClick={undefined}>`; il test renderizza proprio quel caso — senza handler resta l'icona `aria-hidden` di prima |
| 5 | §6 e `behaviour.md` chiedono test di tastiera con `fireEvent`, non realizzabili su un `<button>` nativo in jsdom | medium | patch | verificato: Enter/Spazio su un bottone nativo non producono click in jsdom e `user-event` è escluso — la regola si limita ai controlli che gestiscono i tasti da sé |

## Design Notes

La resa resta identica: il pulsante porta `data-slot="icon-x"`, la `X` dentro resta `aria-hidden`, le classi non cambiano. `type="button"` perché il Chip può stare in un form; il nome viene da `aria-label`, non dal testo del chip, che è la label e non l'azione. Un `<button>` nativo dà Enter/Spazio e tabulazione senza dipendenze: il test prova ruolo, nome, click e axe.

## Verification

**Commands:**
- `pnpm check-types && pnpm test` — expected: verdi.
- `diff -r skills/pds/pds-code .agents/skills/pds-code && diff -r skills/pds/pds-code .claude/skills/pds-code` — expected: nessuna differenza.

**Manual checks (if no CLI):**
- Il diff del Chip mostrato prima dell'applicazione; resa invariata per `md`/`sm`.
