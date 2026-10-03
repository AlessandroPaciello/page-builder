---
title: 'Story 2.16 — Rimozione della v1 e rigenerazione dei quattro componenti'
type: 'refactor'
created: '2026-10-03'
status: 'done'
route: 'dispatch'
baseline_commit: 'a35b6770b9836f9f9375dbb589a37454f0113387'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-refactor-packages-scripts/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-refactor-packages-scripts/migration.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** convivono due pipeline: la v1 (contratto → fixture → ricetta → emitter shadcn) e la v2 (due contratti → istantanea → render headless). Due modi di descrivere un componente, doppia CI, dipendenze legacy (shadcn, Radix) e campi deprecati nei contratti.

**Approach:** cancellare la v1 in un colpo solo (dati, comandi, codice, quattro generati, shadcn/Radix), appiattire `src/v2` in `src`, rimuovere i campi deprecati senza nuovo bump di `SCHEMA_VERSION`, poi far rinascere Badge, Input, Alert e AccordionItem (ultimo) uno alla volta dalla v2 via `extract` + `render` con diff zero.

## Boundaries & Constraints

**Always:**
- Rosso/verde per ogni controllo; esito solo da exit code (`ScriptError` 4 categorie). `extract` sola scrittrice istantanee (tmp+rename, `--check` senza scrittura); `render` 4 file `@generated`; file senza marker mai sovrascritti; `--all` accumula.
- Uno alla volta Badge → Input → Alert → AccordionItem ultimo; diff zero dal primo commit; nessun confronto v1. Badge layout da layer, Alert `role` per variante, AccordionItem su Base UI.
- `gates` v2 verde (`render --check --all` + ui + axe, report per componente); nessun live in CI. `SCHEMA_VERSION` resta 4. Ricontrollo `apps/web`, rivalutazione dropdown, chiusura voci v1, cancellazione Stadio 2 v1.

**Never:**
- Scritture Penpot fuori `library`; live in CI/build; classi mano, token inventati, basi shadcn/`cva` in v2.
- Toccare skill `pds-*` (2.17), token Stadio 1, ProductCard verde; confronti byte con la v1.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rimozione v1 | repo con v1+v2 verdi | `data/judgments|bindings|designs|bases|recipes`, 8 comandi v1, codice v1, 4 generati, shadcn/Radix spariti; `src/v2` appiattito in `src` | N/A |
| Contratti puliti | `parts`, `partRoles`, assi `state`/`behavior` deprecati | campi cancellati, fingerprint aggiornato, `SCHEMA_VERSION` ancora 4, test legacy rimossi | N/A |
| Rigenerazione singolo | contratto ridotto + estrazione da storia git, `extract` + `render` | 4 file `@generated`, test e axe verdi, diff zero, story in Storybook | `contract` nomina comp/cella/parte; `gate` exit 4 nominativo |
| AccordionItem headless | contratto estrazione con headless Base UI | componente su `@base-ui/react`, axe verde | blocco solo del componente |
| Finestra senza componenti | `apps/web` tra rimozione e rigenerazione | nessun import rotto (verificato: solo `editor/`, mai `domains/` v1) | build rossa nomina il consumatore |
| CI solo v2 | push/PR | solo `gates` v2 a diff zero; `gates:render` v1 sparito | job rosso nomina il componente |

## Decisions

- SEED-MCP: i quattro rinascono da seed MCP riproducibile come 2.15 (passi committati), non da live diretto né da sintetici puri.
- DROPDOWN-BASEUI: il dropdown editor migra a Base UI in questa story (coerente con AccordionItem), non resta a mano.
- CONTAINER-CHECK: verifica in implementazione — se i container esistono basta `extract`; `library add` solo se mancano, mai senza evidenza nei log.

</frozen-after-approval>

## Code Map

- `packages/scripts/data/` — cancellare `bindings/`, `designs/`, `bases/`, `recipes/`, `judgments/`; tenere `components/product-card.json` + catalogo token.
- `packages/scripts/src/` — cancellare `cli/` v1 (8 comandi), `{emitter,library,extract,theme}/`; verificare `shared/` riusato; appiattire `v2/` in `src/` (guscio, 6 comandi, contratti, registro).
- `packages/scripts/package.json` — togliere script v1, riscrivere i 6 v2 su `src/cli.ts`.
- `packages/contracts/` — togliere `parts`/`partRoles`/`state`/`behavior`/`Legacy*` senza bump (resta 4); fingerprint + test legacy.
- `packages/ui/` — cancellare/rigenerare 4 domini; esce shadcn/Radix, entra `@base-ui/react`; contratti nuovi da storia git (modello ProductCard).
- Docs/consumers — `penpot-pipeline.md` Stadio 2 via, `deferred-work.md` voci v1 chiuse, `apps/web` ricontrollo, `editor/dropdown-menu.tsx` rivalutazione. NON TOCCARE: card, token, skill.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/` — cancellare dati/comandi/codice v1, appiattire `v2/` in `src/`, riscrivere 6 script — una sola pipeline
- [x] `packages/contracts/` — togliere deprecati senza bump (resta 4), fingerprint + rimuovere test legacy — contratto ridotto
- [x] `packages/ui` — cancellare 4 generati; esce shadcn/Radix, entra Base UI — dipendenze pulite
- [x] Badge → Input → Alert → AccordionItem ultimo — per ciascuno contratto da storia git + `extract` + `render`, diff zero, axe verdi (Alert `role`, Badge layout da layer, Accordion Base UI)
- [x] `apps/web` + dropdown + docs — ricontrollo finestra, rivalutazione menu, Stadio 2 via, voci v1 chiuse — nessun rotto
- [x] `gates` + CI — solo v2 a diff zero, report per componente, nessun live — cancello unico

**Acceptance Criteria:**
- Given la card verde, when rimuovo la v1, then dati, comandi, codice, 4 generati, shadcn/Radix spariti; `src/v2` appiattito; deprecati cancellati senza bump; sezione Stadio 2 cancellata.
- Given i contratti da storia git, when rigenero uno alla volta Badge→Input→Alert→AccordionItem ultimo, then per ciascuno `extract`+`render` verdi, test e axe verdi, diff zero, nessun confronto con la v1.
- Given i rigenerati, when ispeziono Badge/Alert/AccordionItem, then Badge ha layout da Penpot, Alert emette `role` per variante, AccordionItem usa Base UI.
- Given `apps/web` nella finestra, when ricontrollo, then nessun consumatore rotto; il dropdown è rivalutato; le voci v1 di `deferred-work.md` sono chiuse.
- Given le suite `scripts`/`contracts`/`ui` e `gates`, when girano, then verdi con report per componente e nessun live in CI.

## Implementation Notes

- Subagent su branch `story/2-16-rimozione-v1` (baseline `a35b677`): 170 file, +2738/-20598. V1 cancellata (dati, 8 comandi, `emitter`/`library`/`extract`/`theme`), `src/v2` appiattito in `src`, 6 script v2 su `src/cli.ts`.
- Contratti senza bump (`SCHEMA_VERSION` 4, fingerprint invariato); 4 rigenerati via seed MCP + `extract --snapshot` + `render` (Badge layout da layer, Alert `role` per variante, AccordionItem Base UI ultimo); ProductCard byte-identica.
- Dropdown migrato a Base UI (chiude voce deferred 1-1); `apps/web` solo `editor/`, nessun rotto; Stadio 2 v1 cancellato (141 righe); CI solo `gates` v2.
- Verifiche proprie: contracts 137 verdi, scripts 301 verdi, ui 41 verdi con axe, `render --check --all` 5 diff zero, `gates` 5 ok. Residuo noto: `packages/scripts/README.md` ancora con comandi v1 (fuori scope, skill congelate per 2.17); commento storico v1 in `ci.yml:88`.

## Spec Change Log

## Review Triage Log

Review 2026-10-03 su `/tmp/bmad-2-16-diff.patch` (1129 kB, 26k righe): `blind-hunter` 14 finding, `edge-case-hunter` 19, `verification-gap` 2 pre-verificati.

- [false] B1 fingerprint matrice vs note — hash invariato è corretto (cancellazione senza bump, `SCHEMA_VERSION` 4); solo wording, fix=spec → respinto.
- [false] B2 log vuoti + tracciabilità — log vuoti by design prima della review; decisioni in `## Decisions` + contratti (es. `input.extract.ts:10-15`).
- [false] B3 comandi Verification con `exec` — forme giuste in Implementation Notes e CI (`render -- --check`, `gates`); fix=spec → respinto.
- [false] B4 paragrafo Due-pipeline resta — smentito: `grep` zero occorrenze `Stadio 2 (v1)`/`Due pipeline`; sezione cancellata.
- [false] B5 nomi shadcn + plugin-data — naming semantico intenzionale (non libreria); plugin data `nome@versione` ancora valido in v2.
- [false] B6 `defineContract` accetta `parts` — tipi TS rifiutano a compile (`AxisType` solo `option`); nessun caller runtime; produttori v1 cancellati.
- [false] B7 commenti senza link + guard `propsSchema` — assi non-`option` impossibili per tipo; link ai file `.extract.ts` nice-to-have.
- [low→patch] B8a `package.json` senza newline — vero, ultimi byte `}\n}`; fix banale.
- [defer] B8b `README.md` con comandi v1 — vero ma rewrite ampia fuori scope (skill congelate per 2.17); follow-up docs.
- [low→patch] B8c commento storico in `ci.yml:88` — vero; cancellazione di una riga.
- [low→defer] B9 seed senza SHA/timestamp — `seed.md` documenta i passi e la provenance è nello snapshot; metadata follow-up con B8b.
- [false] B10a titolo Storybook `DataDisplay/Badge` — convenzione v2 meccanica, coerente con `Commerce/ProductCard` (2.15); non un difetto.
- [low→patch] B10b axe solo su default — v1 ne aveva 4; template v2 emette solo default (stessa radice di VG2, una patch sola).
- [false] B10c giudizio visivo senza data — nessun giudizio richiesto in 2.16 (era AC solo 2.15); story in Storybook verificata dallo smoke.
- [low respinto] B11a prop `render` allargata — i due call site (`mode-toggle`, `user-menu`) sono verdi e tipizzati all'uso; restringerla rischia rotture.
- [patch] B11b dropdown senza test — duplicato di VG1, stessa patch.
- [false] B12 chevron/divider/focus Accordion — output della pipeline dal seed (non semplificazione manuale), axe verdi.
- [patch] B13 `apps/web/components.json` orfano — zero riferimenti nel repo (`grep` vuoto); rimozione sicura.
- [false] B14 `2-15` in review vs acceptance — solo tracking; card verificata (`render --check` + `gates` 5 ok, file card byte-identici).
- [false] E1 legacy `parts` passa — come B6 (tipi + nessun produttore).
- [false] E2 `propsSchema` con asse non-option — come B7 (impossibile per tipo).
- [false] E3 cella `size` mancante — `extract` valida il cartesiano completo o fallisce `contract`; `render` legge snapshot validati.
- [low respinto] E4 fallback variante Badge invalida — props tipizzate; il fallback proposto maschera i bug (peggio del guasto visibile); TS previene.
- [false] E5 radici per-status diverse — nessuno snapshot corrente le ha; output rivisto; solo ipotetico.
- [low respinto] E6 fallback `status` Alert — come E4.
- [false] E7 cella `state` mancante — `extract` scrive le 4 celle o fallisce; mai snapshot parziali committati.
- [false] E8 token open≠closed — seed disegnati così; output rivisto e axe verdi.
- [false] E9 entry mancante — come E3/E7 (garanzia `extract`).
- [false] E10 entry null/non-oggetto — snapshot validati all'origine; un malformato crasha loud, non silent.
- [false] E11 parte `placeholder` ignorata — decisione documentata (`input.extract.ts:12-15`): attributo, nessuno styling separato.
- [low respinto] E12 `data-slot` sovrascrivibile — nessun consumer lo passa; il fix aggiunge complessità per un caso mai raggiunto.
- [false] E13 evasione via `?.exit` — nessun uso nel diff; solo ipotetico.
- [low→patch] E14 commento `registry.ts:10-14` cita `hasLegacyExtension` — gruppo docs P3.
- [low→patch] E15 commento `product-card.ts:9` con path `src/v2/` — gruppo docs P3.
- [low→patch] E16 `seed.md` con path `src/v2/` — gruppo docs P3.
- [defer] E17 `README.md` v1 — con B8b (stesso follow-up).
- [false] E18 check headless rimosso — smentito: `defineExtraction` valida a load (`extraction.ts:315-322`, package + parts + esistenza parti).
- [false] E19 titolo test fingerprint — solo wording; hash invariato è il comportamento corretto.
- [patch] VG1 dropdown senza test (pre-verificato) — `editor/` a zero test, `gates` copre solo `domains/`; test dedicato.
- [patch] VG2 stati Input mai asseriti (pre-verificato) — template emette solo axe default; esteso con B10b (stesso file template).

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test && pnpm --filter @app/contracts test && pnpm --filter @penpot-ds/ui test` -- expected: suite verdi, nessun legacy
- `pnpm --filter @penpot-ds/scripts exec render --check --all && pnpm --filter @penpot-ds/scripts exec gates` -- expected: diff zero, report per componente
