---
title: 'Rendering condizionale e field structure come content'
type: 'feature'
ticket: '33'
created: '2026-11-01'
status: 'done'
baseline_revision: 'f0fe32723d14260dfba6fde6a53461fa5a15a394'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `when=<field>` sui plugin data di un layer non è interpretato (nessuna parte condizionale nello scaffold), e la risposta `content` alla domanda `asse` non viene letta: la domanda non si chiude mai.

**Approach:** `when` diventa un attributo della parte (validato contro i field del contratto) e lo scaffold avvolge la parte in `{field ? (…) : null}`. La risposta `content` si legge dai plugin data `pagebuilder` del container, una chiave per field (`asse.<field>` = `content`), e `sectionContract` trasforma quel field da `structure` a `content`.

## Boundaries & Constraints

**Always:** nucleo puro (niente I/O in `src/core`); la risposta `content` vale per Lettura: non tocca `SCHEMA_VERSION`, la definizione della sezione né il path dei file; output deterministico; findings col formato esistente (`blocco` / `domanda` / `avviso`).

**Never:** scrivere plugin data (è `pds-code`, 2.29); toccare la skill `pds-design`; leggere `when` come asse o come variante; ammettere `when` sulla radice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| when valido | parte con `when:"label"`, `label` è un field | scaffold con `{label ? (` … `) : null}` attorno alla parte | nessun finding |
| when su lista | parte `repeat=lista` con `when` | il wrap condizionale è fuori dal `Array.from` | nessun finding |
| when sconosciuto | `when:"nope"`, non è un field (o è un asse) | nessun Change | blocco, con elenco dei field |
| when diverso tra celle | stessa parte, `when` diverso in due celle | nessun Change | blocco |
| when sulla radice | radice con `when` | nessun Change | blocco |
| asse → content | `perView` non disegnato, container `asse.perView="content"` | domanda chiusa; generazione senza asse, `perView` tra i field | nessun finding |
| risposta non valida | `asse.perView="boh"`, o su un field non `structure` | nessun Change | blocco |
| content ma disegnato | `perView` disegnato come variante e risposto `content` | vince il disegno: asse | avviso |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/core/section.ts:49-90` -- `sectionContract(section, cells)`: aggiungere il terzo argomento `answers` (plugin data del container) e il ramo `content`; modello per i findings: `slotOf` (`:113-119`)
- `packages/scripts/src/core/verify.ts:55-62` -- costanti delle chiavi: aggiungere `WHEN_KEY = "when"`; `resolveDefinition` (`:~890`) passa `lettura.pluginData`
- `packages/scripts/src/core/verify.ts:381-422,513-535,613-639` -- `Visit`, `register`, `collectParts`: stesso schema di `elementAnswers` per raccogliere `when` per parte (primo valore, conflitto → blocco); radice con `when` → blocco
- `packages/scripts/src/core/verify.ts:87-108` -- `ModelPart`: aggiungere `when?: string`; validazione contro `contract.fields` in `analyzeComponent`
- `packages/scripts/src/core/generate.ts:341-373` -- `renderPart`: wrap `{field ? (…) : null}` dopo il wrap delle liste; `fields` è già l'insieme dei field
- `packages/scripts/tests/core/sections.test.ts`, `tests/fixtures/sections.ts` (`carouselRoot`, `carouselSenzaVarianti`) -- casi nuovi; attenzione a `generate.test.ts:356-361` (field chiamato `when`)
- `packages/scripts/README.md:94` -- togliere «`when` è fuori»; dire dove si scrive la risposta `content`
- `_bmad-output/initiative-page-builder/deferred-work.md` -- chiudere le due voci (`when`, risposta `content`) in coda

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/src/core/section.ts` -- `answers`: `asse.<field>`=`content` → field `content`; valore o field non validi → blocco; field disegnato → avviso e asse -- chiude la domanda
- [x] `packages/scripts/src/core/verify.ts` -- leggere `when`, validarlo (field del contratto, non asse, non sulla radice, coerente tra celle), `ModelPart.when`; passare `lettura.pluginData` a `sectionContract`
- [x] `packages/scripts/src/core/generate.ts` -- avvolgere la parte con `when` in `{field ? (…) : null}` (mai `&&`: un field numerico `0` stamperebbe «0»)
- [x] `packages/scripts/tests/core/sections.test.ts` -- una prova rosso/verde per ogni riga della matrice
- [x] `packages/scripts/README.md` e `deferred-work.md` -- documentazione e chiusura delle voci

**Acceptance Criteria:**
- Given una parte con `when:"label"` su Carousel, when si genera, then lo scaffold contiene `{label ? (` e `) : null}` attorno alla parte.
- Given `when` su un field sconosciuto, when si verifica, then c'è un blocco e nessun Change.
- Given `perView` non disegnato e `asse.perView="content"`, when si genera, then nessuna domanda `asse`, `perView` non è in `variants` ed è tra i field.
- Given nessuna risposta, when si genera, then la domanda `asse` c'è ancora, invariata.

## Review Triage Log

Pass 1 (quick): 7 findings — medium 0, low 2 (patch), false 1, rejected 4.

| Verdict | Route | Finding / evidence |
|---------|-------|--------------------|
| low | patch | Messaggio «quando=» al posto di `when=` sulla radice. Corretto in `verify.ts`. |
| medium | patch | `when` presente in una cella e assente in un'altra non dava blocco. `register` ora segnala entrambe le direzioni; test aggiunto in `sections.test.ts`. |
| false | — | `when` su layer fuso (`ignora`) o copia di lista: `visitLayer` esce prima di `register` in entrambi i casi, quindi `whenAnswers` non li vede. |
| low | rejected | Risposta `asse` su field non disegnato ricade nella stessa domanda: è il comportamento voluto (bisogna disegnare le celle); coprirlo aggiunge complessità. |
| low | rejected | `asse.<x>` ignorato su un componente non sezione: asimmetria innocua, nessun consumatore. |
| low | rejected | AC «non è in variants» coperto indirettamente: il test controlla `perView: {` assente dallo styles. |
| false | — | Checkbox del plan non spuntate: tracciamento, spuntate qui. |

## Design Notes

La chiave per field (`asse.perView`) evita l'ambiguità di una chiave `asse` unica con due field `structure` senza variante. Risolve la open question del ticket: la risposta sta nei plugin data del container, come `contract`. Il ternario `{field ? (…) : null}` sostituisce il `{field && (…)}` della spec: con `&&` un field numerico `0` stamperebbe «0». Decisione di Alessandro, 2026-11-01.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: tutti verdi
- `pnpm --filter @penpot-ds/scripts check-types && pnpm --filter @penpot-ds/scripts lint` -- expected: nessun errore
- `pnpm --filter @app/contracts test` -- expected: verde (contratti invariati)
