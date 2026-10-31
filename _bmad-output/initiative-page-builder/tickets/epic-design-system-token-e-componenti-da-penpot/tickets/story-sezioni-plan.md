---
title: 'Sezione Carousel letta e generata come componente'
type: 'feature'
ticket: '27'
created: '2026-10-31'
status: 'built'
baseline_revision: '5dfde3d8ffefdd38bfec3deeb2e367f48c57d561'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-page-builder/spec-page-builder/penpot-pipeline.md'
  - '{project-root}/_bmad-output/spikes/penpot-ai-kit-2026-10-10/test-v3/codice/packages/contracts/src/sections/carousel.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le definizioni di sezione esistono solo come dati in `@app/contracts`; `verifyComponent`/`generateComponent` conoscono solo i contratti di componente, quindi una sezione non si verifica né si genera: un field `structure` non diventa asse, uno slot non è riconosciuto, una forma disegnata non ha regole e la story non ha i figli di default.

**Approach:** Derivare il contratto effettivo della sezione dalla definizione e dalla lettura Penpot (field `structure` enum disegnato come variante → asse; slot dai figli istanza dei componenti ammessi; forma disegnata → parte con chiave) e generare `styles.ts`/scaffold/story come per un componente: lo slot rende `children`, la story passa i figli di default del contratto. Prova end-to-end sulla sezione Carousel dello spike. Il rendering condizionale `when` è fuori: rinviato in `deferred-work.md`.

## Decisions (2026-10-31)

- `sections/carousel.ts`: `perView` enum `1|2|3` default `3` (structure), `autoplay` false/`interval` 5/`label` (content), slot `slides` con `allow: ["product-card"]`, 3 figli `product-card` di default. Registrata in `SECTION_DEFINITIONS`; `SCHEMA_VERSION` 4→5 con voce nuova nel fingerprint (append-only).
- Asse: solo un field `structure` con schema enum disegnato come nome di variante; valori e default dallo schema. Disegnato ma non enum → blocco. Il field che diventa asse non resta anche field.
- Field `structure` senza variante → domanda `key: "asse"` con opzioni `["asse","content"]`: disegna le celle con quel nome, oppure il field non guida il disegno e passa a `content` con MS. Nessun `Change`.
- Slot: vale `pluginData.slot`; altrimenti il layer è slot se **tutti** i figli sono istanze e **uno solo** slot le ammette. Più candidati → domanda `key: "slot"` con gli id; id non dichiarato → blocco. I figli dello slot sono esempi: non diventano parti né si visitano.
- Forma disegnata (layer `path`): è una parte come le altre; con `part` ha `cva` e `data-slot`, senza chiave resta la domanda `part` `[kebab del nome, "ignora"]`.
- File della sezione in `packages/ui/src/domains/<kebab>/` (layout piatto attuale). `buildOrder` e l'adattatore Penpot restano invariati.

## Boundaries & Constraints

**Always:**
- Nucleo puro, funzioni dati → dati: senza disco, rete o console; in `src/core` solo import relativi interni, `@app/contracts`, `zod`, `node:crypto` (gate `check-boundaries.mjs`).
- Una sezione deriva tutto da `@app/contracts` + `Lettura`: niente assi, parti o chiavi scritte a mano.
- Output deterministico byte per byte; nessun `Change` con blocco o domanda aperta; `<Comp>.tsx` solo se manca.
- Ciò che non si sa resta un `Finding` esplicito che nomina sezione, cella o layer.

**Never:**
- Niente `when`, `buildOrder`, `src/penpot`, server o file generati nel repo (la sezione non si disegna né si committa qui).
- Niente raggruppamento per dominio (`domains/layout/`): il path piatto resta.
- Niente dipendenze nuove.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Field structure come asse | sezione con `perView` enum, celle perView=1,2,3 | asse `perView` in `Axes`/`variants`; una story per cella; nessun finding | — |
| Field structure irrisolto | nessuna variante | domanda `key:"asse"`, opzioni `["asse","content"]`, `changes: []` | nessuna scrittura |
| Slot riconosciuto | layer `Slides` con figli tutti `product-card`, slot `slides` le ammette | parte `slides`; figli non parti; scaffold `{children}`; story con i 3 figli di default | — |
| Slot ambiguo | due slot ammettono `product-card` | domanda `key:"slot"` con i due id | nessuna scrittura |
| Forma disegnata | `path` con `part:"previous-icon"` / senza `part` | parte con `cva` + `data-slot` / domanda `part` `["previous-icon","ignora"]` | — |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/{sections/accordion,section,registry,index,schema-version}.ts` + `tests/contracts.fingerprint.json` -- forma, schema, registrazione, bump append-only.
- `packages/scripts/src/core/verify.ts:118-157,677-721` -- `contractOf`/`analyzeComponent` (risoluzione componente|sezione); `collectParts`/`visitLayer` (`:411-535`) per gli slot.
- `packages/scripts/src/core/generate.ts:279-384` -- `renderStories`/`renderScaffold`; `tests/fixtures/components.ts` e `tests/core/generate.test.ts` -- stile delle letture a mano e dei test.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/sections/carousel.ts` -- nuova sezione (perView/autoplay/interval/label, slot `slides` su `product-card`, 3 figli di default) -- la prova dello spike.
- [x] `packages/contracts/src/{registry,index,schema-version}.ts` + `packages/contracts/tests/contracts.fingerprint.json` -- registra carousel, export, `SCHEMA_VERSION` 5 e voce nuova -- AD-6.
- [x] `packages/contracts/tests/section.test.ts` -- casi Carousel e registry `{accordion, carousel}` -- la definizione resta valida.
- [x] `packages/scripts/src/core/section.ts` -- `sectionContract(section, cells)` (assi, domande) e `slotOf(layer, section)` -- isola le regole nuove fuori da `verify.ts`.
- [x] `packages/scripts/src/core/verify.ts` -- risolvi componente|sezione, porta `section`/`slot` nel modello, salta i figli dello slot -- nucleo.
- [x] `packages/scripts/src/core/generate.ts` -- scaffold `{children}` dentro lo slot; story con import dei figli di default e `children` -- "si genera come un componente".
- [x] `packages/scripts/tests/fixtures/sections.ts` + `packages/scripts/tests/core/sections.test.ts` -- letture a mano e un test rosso/verde per ogni riga della matrice -- livello 1 della CI.
- [x] `packages/scripts/README.md` -- sezione "Sezioni" con le regole asse/slot/forma/story -- documentazione viva.

**Acceptance Criteria:**
- Given la sezione Carousel e una lettura con celle perView=1,2,3, when `verifyComponent`/`generateComponent`, then nessun finding bloccante e `styles.ts` ha `perView` in `variants` con `defaultVariants: { perView: "3" }`.
- Given la stessa lettura, when generate, then `Carousel.stories.tsx` contiene una story per `perView` e `children` con i 3 `ProductCard` dei figli di default del contratto.
- Given un layer slot con figli istanza `product-card`, when verify, then lo slot è riconosciuto, i figli non producono domande `part`, e lo scaffold rende `{children}` dentro `data-slot="slides"`.
- Given due slot che ammettono lo stesso componente o un field `structure` senza variante, when verify/generate, then arriva una domanda `slot`/`asse` e nessun `Change`.

## Implementation Notes

## Plan Change Log

## Review Triage Log

| # | Finding | Verdetto | Esito |
|---|---|---|---|
| 1 | `sectionContract`: la risposta `content` alla domanda `asse` non viene letta | medium (non decidibile dal piano) | defer — "passa a `content` con MS" non dice dove si registra la risposta; la domanda resta aperta finché non si disegna la variante |
| 2 | `slotOf`: slot dichiarato senza controllo dei figli su `allow` | low | rifiutato — improbabile nell'uso corrente, il fix aggiunge rami |
| 3 | `resolveDefinition` duplica `contractOf`; messaggio "sconosciuto" cambiato | false | `buildOrder` resta invariato per decisione; i test esistenti passano |
| 4 | slot e parte con stessa chiave tra fratelli | low | rifiutato — caso non raggiungibile con chiavi da contratto |
| 5 | `instanceNameOf` replica `instanceName` | low | rifiutato — evita un import circolare, nessun divergere dimostrato |
| 6 | story passa `children` senza layer slot disegnato | low | rifiutato — `children` finisce in `...props`, innocuo |
| 7 | `deferred-work.md` usa `source_plan` | false | è il formato prescritto dal workflow |
| 8 | task del plan non spuntati | patch | spuntati |

## Design Notes

- La regola `asse` vale identica per un componente (nessuno ha oggi field `structure`: output invariato). Figli di default = `section.root.children`: `<PascalCase(component) key={id} {...props} />`, import fra pari (`../product-card/ProductCard`), una volta sola e in ordine di dichiarazione.

## Verification

**Commands:**
- `pnpm --filter @app/contracts test` -- contratti, sezione e fingerprint verdi.
- `pnpm --filter @penpot-ds/scripts test` -- livello 1 e livelli 2–4 verdi.
- `pnpm check-types` -- generatore e contratti compilano.
- `pnpm lint` -- confini di package verdi.
