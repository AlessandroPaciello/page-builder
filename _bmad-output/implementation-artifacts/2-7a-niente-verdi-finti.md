---
title: 'Story 2.7 parte A — niente verdi finti con più componenti'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
baseline_commit: 'ceb07ad930679963bf2637ec79870cb88eaf8cc3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** con un quarto componente la pipeline mente o si rompe (register Alert, `deferred-work.md`): il gate a11y resta verde se il giudizio dichiara `role`/`aria-*` che il componente non porta (1); test e CLI hanno liste di design a mano e 42 test cadono (3); `verify:library` ignora i container orfani (8) e misura coppie di contrasto scritte a mano (6); un field `title` ombreggia l'attributo HTML (2).

**Approach:** l'emitter emette `role` dal giudizio e il test generato asserisce nel DOM ogni attributo dichiarato, con un gate che prova che l'asserzione esiste; design e liste derivati da `designs/*.design.json` e `COMPONENT_CONTRACTS`; `verify:library` con regola sui container orfani e coppie di contrasto derivate dai design; `defineContract` rifiuta i field con nomi di attributi HTML globali. Parte B (`addCell`, `adopt:variant`, regola versioni) è in `deferred-work.md`.

## Boundaries & Constraints

**Always:** ogni controllo nuovo con prova rosso/verde nella suite. Rigenerazione byte-identica (`render:check` verde dopo il commit dei file rigenerati). Messaggi d'errore nominativi (componente, container, file). Le formulazioni d'errore delle regole 1–10 di `verifyLibrary` e di `designFor` restano invariate. Copertura test di `scripts` (20 file / 285 test) e `contracts` (6 / 110) non scende.

**Never:** nessuna scrittura su Penpot; niente `addCell`/`adopt:variant`/bump di versione (parte B); non toccare `SCHEMA_VERSION` né `contracts.fingerprint.json` (la regola è solo validazione, non cambia lo schema); non abbassare una soglia di contrasto per far passare una coppia derivata; niente estensioni silenziose di `JudgmentSchema`/`RecipeSchema`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Giudizio con `role` | `a11y.role: "alert"` | `role="alert"` sulla root del `.tsx`, prima di `{...props}`; test generato asserisce il ruolo | N/A |
| `aria-*` dichiarato | input `aria-invalid`, accordion `aria-expanded`/`aria-controls` | il test generato rende lo stato e asserisce l'attributo nel DOM | test generato senza asserzione → gate a11y rosso nominativo |
| Quinto design aggiunto | nuovo `x.design.json` + contratto | nessun test/CLI da modificare | design senza contratto o contratto senza design → test di copertura rosso |
| Container orfano | plugin data `alert@1`, `alert` fuori registry | `verify:library` errore nominativo sul container | N/A |
| Field HTML globale | field `title`/`id`/`tabIndex` | `defineContract` lancia nominando contratto e field | confronto case-insensitive |
| Coppia derivata sotto soglia sul seed | design reale | fermarsi e riportarlo ad Alessandro | mai abbassare `minRatio` |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/recipe-schema.ts:77-92` -- `JudgmentSchema.a11y`: `role` nullable, `ariaAttributes` solo nomi. Oggi nessun `role` dichiarato; input `aria-invalid` (stato), accordion-item `aria-expanded`/`aria-controls` (Radix a runtime).
- `packages/scripts/src/emitter/render-component.ts` -- `renderPartJsx` (637-672, attributi a 656: `data-slot`, attributeProps, className, poi `{...props}` sulla root), `renderComponentFile` (717), `renderTestFile` (render per stato e asserzioni axe).
- `packages/scripts/src/emitter/gates.ts:67-81` `checkA11y` + `gates-cli.ts:120-135` (Gate 3) + `gates.test.ts:57-65` (pattern del test di presenza dell'assert axe da replicare per gli attributi dichiarati).
- `packages/scripts/src/emitter/artifacts.ts:~87` `committedComponents(dir)` -- loader di directory da riusare come modello per `committedDesigns`.
- `packages/scripts/src/library/library-cli.ts:30-36` `DESIGNS` (mappa a mano) ; `library-plan.ts:43-66` `ComponentDesign` (parti con `kind`/`parent`, celle `parte → proprietà → token`), `designFor` (156).
- Liste a mano da derivare: `library-plan.test.ts:16-20,68-69`; `penpot-writer.test.ts:17-21,35,104`; `verify-library.test.ts:18-22`; `packages/contracts/tests/components.test.ts:71-72`; script `render:check` in `packages/scripts/package.json`.
- `packages/scripts/src/library/verify-library.ts:90` `verifyLibrary` -- regole 1–7 per contratto (100: match `pluginData.split("@")[0]`), 8–10 globali; `SnapshotComponent.pluginData` (`library-snapshot.ts:51`). Test: `greenSnapshot()`/`verify()` in `verify-library.test.ts`.
- `packages/scripts/src/library/library-spec.ts:90-96` `DESIGN_USAGE_PAIRS` dentro `LIBRARY_SPEC.contrastPairs`; `library-spec.test.ts:104,107,230` conta le coppie e le verifica sul seed; `contrast.ts:39` `contrastRatio`.
- `packages/contracts/src/contract.ts:89-96` -- loop dei field in `defineContract` (IDENTIFIER, `__proto__`, collisione con asse): la nuova regola va qui; test in `contracts/tests/contract.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/contract.ts` (+ `tests/contract.test.ts`) -- rifiuto dei field il cui nome, case-insensitive, coincide con un attributo HTML globale (lista WHATWG: `accesskey`, `autocapitalize`, `autofocus`, `class`, `contenteditable`, `dir`, `draggable`, `enterkeyhint`, `hidden`, `id`, `inert`, `inputmode`, `is`, `itemid`, `itemprop`, `itemref`, `itemscope`, `itemtype`, `lang`, `nonce`, `popover`, `slot`, `spellcheck`, `style`, `tabindex`, `title`, `translate`, `writingsuggestions`, più `classname`); `components.test.ts` asserisce che ogni file in `src/components/` è nel registry con chiave = nome, non "esattamente tre" -- problema 2 e 3.
- [x] `packages/scripts/src/library/designs-loader.ts` (+ test) -- `committedDesigns(dir)`: legge `designs/*.design.json`, errore nominativo su JSON malformato o directory vuota, ordinato; test di copertura design↔`COMPONENT_CONTRACTS` in entrambi i sensi -- problema 3.
- [x] `library-cli.ts`, `library-plan.test.ts`, `penpot-writer.test.ts`, `verify-library.test.ts`, `packages/scripts/package.json` (`render:check`) -- usare il loader e `COMPONENT_CONTRACTS`; conteggi derivati; `render:check` itera `committedComponents` (es. `render:component -- --all --check`) -- problema 3.
- [x] `library-spec.ts` (+ `library-spec.test.ts`) -- `deriveDesignContrastPairs(designs)` sostituisce `DESIGN_USAGE_PAIRS`: per cella, parte `text` → `fill` contro il `fill` del primo antenato board che lo ha (fallback `color.background`), 4.5; `strokeColor` di una parte contro il fill dell'antenato, 3; dedup e ordine deterministico; `LIBRARY_SPEC` costruito con i design committati -- problema 6.
- [x] `verify-library.ts` (+ test) -- nuova regola 11 dopo il loop dei contratti: ogni `pluginData` non nullo deve nominare un contratto del registry, errore sul nome del container -- problema 8.
- [x] `render-component.ts`, `gates.ts`, `gates-cli.ts` (+ test) -- `role` non nullo emesso sulla root; `renderTestFile` asserisce `role` e ogni `ariaAttributes` nel DOM (stato `state` reso dal suo mapping, `behavior` aperto via trigger); `checkDeclaredA11y` verifica che ogni test generato contenga l'asserzione per ogni attributo dichiarato, wired nel Gate 3; rigenerare e committare i file in `packages/ui/src/domains/**` -- problema 1.

**Acceptance Criteria:**
- Given i tre componenti committati, when eseguo `pnpm check-types && pnpm lint && pnpm test` e `gates:render`, then tutto verde e `render:check` a diff zero.
- Given un contratto e un design sintetici aggiunti in un test, when girano le suite di `scripts` e `contracts`, then nessuna lista a mano va modificata.
- Given ogni controllo nuovo, when gli do un input che lo viola, then fallisce con messaggio nominativo (test rosso/verde nella suite).

## Implementation Notes

*(2026-09-13, implementazione — nessuna modifica al frozen.)*

- **Ring su card non derivabile:** 4 delle 5 coppie a mano escono dalla derivazione; `color.ring` su `color.card` no, perché nessun design lega il ring dentro una board `card` (è il `focus-visible:ring-ring` strutturale del binding AccordionItem). Tenuta come coppia esplicita e commentata in `CATALOG_PAIRS` (`library-spec.ts`), con un test che documenta che non è derivata. **Decisione aperta per Alessandro:** esprimere il focus ring nel design oppure lasciare la coppia dichiarata.
- **Coppia nuova emersa dalla derivazione:** `color.border` su `color.card` (divider dell'AccordionItem), sopra soglia sul seed; nessuna soglia toccata.
- **`LIBRARY_SPEC.contrastPairs` = `buildContrastPairs(committedDesigns())`**: coppie del catalogo (X/X-foreground, warning fill-only, border/input/ring su background) + derivate non già presidiate.
- **`render:check` → `render-cli.ts --all --check`** (`runRenderAll` su `committedComponents()`; `--all` e nome componente sono alternativi).
- **Test generati:** l'attributo dell'headless è cercato sulla radice o su un discendente (non su una parte specifica); la rigenerazione cambia solo `Input.test.tsx` e `AccordionItem.test.tsx`, tutti i `.tsx` byte-identici.
- **Fix in verifica:** la chiave di dedup in `deriveDesignContrastPairs` conteneva un byte NUL letterale (git trattava `library-spec.ts` come binario): sostituito con `|`.
- **Verifica:** contracts 115, scripts 314 (21 file), ui 14; `render:check` diff zero; `check-types`/`lint` verdi; `gates:render` 5/5 con Penpot raggiungibile (drift eseguito, nessuna scrittura).

## Review Triage Log

**Loop 1 — 2026-09-13, 3 layer (blind-hunter, edge-case-hunter, verification-gap):**

- BH#1 + ECH#1 (field `role`, `children`/`key`/`ref`, handler `on*` non rifiutati) — verificato in `contract.ts`: la story emette ora `role` sulla radice prima di `{...props}`, quindi un field `role` sovrascriverebbe il ruolo dichiarato; `children`/`key`/`ref`/`onX` collidono con le prop React. — `medium` → `patch`.
- BH#2 (il test `aria-invalid` passa l'attributo che asserisce) — verificato, ma l'attributo per costruzione lo mette il consumer (mapping `aria-invalid:`): il test prova che arriva alla radice via `{...props}`, che è ciò che il componente deve garantire. — `low`, rifiutato.
- BH#3 (`aria-expanded`/`aria-controls` presenti anche a chiuso, il click è irrilevante) — verificato (Radix mette `aria-expanded="false"`). Il giudizio dichiara la presenza, non il valore; asserire il valore aggiungerebbe logica per attributo nel generatore. — `low`, rifiutato.
- BH#4 + ECH#4 (`declaredAttribute` accetta un discendente anche per `role`) — verificato nel helper generato: un `role` assente dalla radice ma presente in un figlio passa. L'emitter lo mette solo sulla radice. — `medium` → `patch`.
- BH#5 (asserzione contata anche se commentata; helper manomettibile) — `false`: i `.test.tsx` sono `@generated` e il Gate 2 li confronta byte per byte (`render:check`: "4 file attesi"), qualunque manomissione è rossa.
- BH#6 (`ARIA_ROLE` è un pattern, non la lista WAI-ARIA) — verificato; errore di battitura nel giudizio resta loud a axe/test, la lista è superficie nuova. — `low`, rifiutato.
- BH#7 + ECH#6 + ECH#7 (`parent` inesistente o parte di cella fuori `design.parts` → coppia sbagliata in silenzio) — verificato: `library-plan.ts` non valida i `parent`. Richiede un design scritto a mano con un refuso; il fix è una guardia su stato non dimostrato. — `low`, rifiutato.
- BH#8 + ECH#10 (`LIBRARY_SPEC` legge i design all'import) — verificato; `library-cli.ts` leggeva già `DESIGNS` al top-level prima della story, e ogni consumer usa i design. — `low`, rifiutato.
- BH#9 + ECH#9 (regola 11 non segnala `pluginData` senza `@versione`; test verde senza `ok`) — `false`: per un nome registrato la versione la controlla la regola 3; il caso verde è coperto da "passa tutte le 11 regole".
- BH#10 (`designCoverage` mai eseguito fuori dai test) — `false` sul danno: il test di copertura gira in CI sui design committati; un contratto senza design fallisce loud in `designFor`.
- BH#11 + ECH#5 (`runRenderAll`: un `throw` ferma il loop; messaggio finale "Verificati N" anche con divergenze) — verificato: lo stop su throw è loud (corretto); il messaggio finale suona come successo. — `low` → `patch` (solo il messaggio).
- BH#12 (`components.test.ts` fragile con un `index.ts` in `src/components/`) — ipotetico e loud. — `low`, rifiutato.
- BH#13 (bookkeeping: spec `in-review`, 2.7 `in-progress`; decisione ring solo nelle note) — la 2.7 resta `in-progress` per la parte B (voce in deferred-work); la decisione ring va in deferred-work con ECH#11. — `low`, rifiutato.
- BH#14 (branch di fallback di `renderTestFile` e prefissi `aria-*` diversi senza test) — verificato; nessun contratto li raggiunge. — `low`, rifiutato.
- ECH#2 (doppio `role` se il binding ha `attribute: "role"`) — `attribute` richiede `contentField` (refine 2.6): un role come content field non è raggiungibile coi binding attuali, e sarebbe loud a `check-types`. — `low`, rifiutato.
- ECH#3 (mapping `state` con `aria-X:` non in testa) — i valori del binding sono prefissi (`"aria-invalid:"`); il caso ricade nel render di default ed è rosso a runtime della suite. — `low`, rifiutato.
- ECH#8 (`localeCompare` dipende dall'ICU) — verificato: ordinamento di `contrastPairs` potenzialmente diverso fra ambienti. — `low` → `patch` (confronto per code point).
- ECH#11 (claim: `ring` su `card` resta a mano) — verificato: il focus ring viene dalle classi strutturali del binding, mai modellate nei design; limite preesistente, la coppia resta misurata. — `medium` → `defer` (decisione di Alessandro).
- ECH#12 (claim: `validate-recipe.test.ts:273` lista a mano `badge/input/accordion-item`) — verificato: una quarta ricetta committata resterebbe fuori dal test di conformità in silenzio. — `medium` → `patch`.
- VG#1 (ramo rosso della parte dichiarata del Gate 3 in `gates-cli.ts` mai eseguito da un test) — pre-verificato: nessun test importa `gates-cli.ts`; staccare il wiring resterebbe verde. — `medium` → `patch`.

Routing loop 1: nessun `intent_gap`/`bad_spec`. `patch` (BH#1+ECH#1, BH#4+ECH#4, VG#1, ECH#12, BH#11+ECH#5, ECH#8) → **applicate e verificate**: `role`/`children`/`key`/`ref`/`dangerouslySetInnerHTML`/`on[A-Z]…` rifiutati in `defineContract`; `role` asserito solo sulla radice (test Input/AccordionItem rigenerati); `checkA11yGate` esportato in `gates.ts` con prova rosso/verde; `validate-recipe.test.ts` derivato da `recipes/*.recipe.json`; `--all --check` con messaggio di fallimento nominativo; ordinamento per code point. `defer` (ECH#11) → `deferred-work.md`. Verifica post-patch: contracts 118, scripts 315 (21 file), ui 14, `render:check` diff zero, `gates:render` 5/5 (drift eseguito).

## Design Notes

- **Perché asserire nel DOM e non cercare nel `.tsx`:** `aria-expanded`/`aria-controls` li mette Radix e `aria-invalid` il consumer; un grep sul sorgente darebbe falsi rossi. Il test generato che li asserisce nel DOM è il rosso reale; `checkDeclaredA11y` impedisce che quell'asserzione sparisca (stesso schema dell'assert axe, BH#5 della 2.6).
- **Coppie derivate:** le cinque coppie a mano attuali (muted-foreground, foreground su card, destructive e ring a 3:1) devono uscire dalla derivazione; se una manca, il meccanismo è incompleto, non la lista.

## Verification

**Commands** (Node 22: `PATH=~/.nvm/versions/node/v22.23.1/bin:$PATH`):
- `pnpm --filter @app/contracts exec vitest run` -- expected: verde, ≥110 test.
- `pnpm --filter @penpot-ds/scripts exec vitest run` -- expected: verde, ≥285 test.
- `pnpm --filter @penpot-ds/ui run test` -- expected: verde con le nuove asserzioni a11y.
- `pnpm check-types && pnpm lint && pnpm build` -- expected: verdi.
- `pnpm --filter @penpot-ds/scripts run render:check` e `gates:render` -- expected: diff zero, 5/5 gate verdi (drift skip documentato se Penpot irraggiungibile).
