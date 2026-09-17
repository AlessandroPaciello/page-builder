---
title: 'Story 2.10 — Fedeltà live ed estrazione guidata dal contratto'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'dispatch'
baseline_commit: '54019c03ae600db50aa082366e114a49779e8318'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-15.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** l'estrazione non usa il contratto come riferimento: un token su una proprietà estranea alla parte (es. `strokeColor` su un testo) si perde o passa in silenzio. La regola 10 misura il contrasto sui design committati e non su Penpot live (Alert `warning` a 1.82:1 con gate verdi). Nessun comando riallinea un design committato e il giudizio ammette un solo `role` (Alert è `role="alert"` anche su info/success).

**Approach:** quattro consegne in una spec, in quest'ordine:
- **D:** `a11y.role` per variante.
- **C:** `design-drift` + `sync:design`.
- **A:** ruolo delle parti nel contratto con controllo "proprietà fuori ruolo".
- **B:** regola 10 per componente sui token live.

Chiude la routing di [PS] in `pds-component`.

## Boundaries & Constraints

**Always:**
- Pass/fail e `kind` negli script. Ogni controllo nuovo ha un test rosso/verde.
- `render:check` a diff zero su Badge, Input e AccordionItem. Su Alert l'unico diff ammesso è quello del role per variante (D).
- Ogni cambio ai contratti alza solo `SCHEMA_VERSION` + voce del fingerprint (regola A, compatibile).
- `sync:design` e il comando di cambio ruolo: senza `--yes` stampano il diff e non scrivono. Con `--yes` scrivono con tmp + rename. Mai scritture su Penpot.
- Il vocabolario dei ruoli sta in `@app/contracts` (zero dipendenze). La tabella ruolo → proprietà sta in `packages/scripts`.

**Never:**
- Nessun elenco di proprietà Penpot nel contratto.
- Nessuna modifica a mano sui file `@generated`.
- Nessuna correzione automatica di una proprietà fuori ruolo.
- Nessuna ristrutturazione delle regole 2, 3, 6, 7 (è lavoro di un'altra story).

## I/O & Edge-Case Matrix

| Scenario | Input / Stato | Comportamento atteso | Errore |
|---|---|---|---|
| Proprietà fuori ruolo | cella con `strokeColor` su parte `text` | componente `pending`, `kind: property-outside-role`, messaggio con componente/cella/parte/ruolo/proprietà/token e i tre adattamenti in ordine | gli altri componenti restano verdi |
| Contrasto sotto soglia live | Alert `warning` root `color.muted-foreground` (1.82:1) | voce Alert `red`, `kind: contrast` | coppie di catalogo restano globali |
| Design committato ≠ Penpot | celle di `design.json` diverse dalla lettura live | voce `pending`, `kind: design-drift`; `sync:design -- Alert` stampa il diff, `--yes` riscrive | componente assente → errore nominativo, exit ≠ 0 |
| Role per variante | `role: {axis:"status", values:{info:"status",…}}` | `Alert.tsx` emette il role dalla mappa; il test generato ha un `it` per valore; il gate verifica ogni valore | mappa su asse `state`/`behavior`, incompleta o con valori estranei → rifiutata dallo schema |
| Tutto allineato | 4 componenti, Penpot live | `verify:library` e `gates:render` exit 0 | N/A |

## Decisioni (Alessandro, 2026-09-15)

- **Scope:** la 2.10 resta intera in una spec sola, oltre la soglia di token. L'ordine di esecuzione è D → C → A → B.
- **Tabella ruolo → proprietà ammesse** (approvata):
  - `surface`: fill, stroke (colore/spessore/stile/allineamento), radius, padding, gap, shadow, opacity;
  - `text`: fill, tipografia del registro, opacity;
  - `icon`: fill, strokeColor, strokeWidth;
  - `divider`: strokeColor, strokeWidth, strokeStyle.
  Nessuna cella attuale la viola.
- **Outline ammessa:** una `surface` con solo `strokeColor`, senza `fill`, è valida e non ha controlli in più.
- **Sede del controllo di ruolo:** `layerTreeIssues` (`style-properties.ts`), già condiviso da estrazione e `verify:library`. Non si aspetta il modulo delle regole 2, 3, 6, 7. Il rischio di conflitti di merge con quella story è accettato.
- **Comando di cambio ruolo:** `role:part -- <Comp> <part> <role> [--yes]`. Riscrive `components/<comp>.ts`, alza `SCHEMA_VERSION` e aggiunge la voce del fingerprint calcolata con `fingerprint.ts`.

</frozen-after-approval>

## Code Map

Path relativi a `packages/scripts` salvo dove indicato.

- **D — schema del giudizio:**
  - `src/extract/recipe-schema.ts:76-92` `JudgmentSchema` (`role` :85): diventa stringa, oppure `{axis, values}`.
  - `src/extract/validate-recipe.ts:229-236`: giudizio uguale a `data/recipes/judgments/<name>.json`; qui va la verifica "asse `option` del contratto, valori completi".
- **D — emitter:** `src/emitter/render-component.ts`:
  - `declaredRole` :697-704;
  - emissione del role sulla root :741-745;
  - modello cva e default :536-560 (prop = `bound.prop ?? axis.name`, valori da `bound.values`);
  - test generato :1002-1010, con `jsxArgs` :900-912 per le props extra;
  - `declaredA11yAssertion` :712-717, condivisa con il gate.
- **D — gate:**
  - `src/emitter/gates.ts:84-121` (`DeclaredA11yEntry`, `checkDeclaredA11y`) deve verificare ogni valore;
  - lo alimenta `src/emitter/gates-runner.ts:126,153,189-198`.
- **D — Alert:** `data/recipes/judgments/alert.json`, `data/recipes/alert.recipe.json:107`, `packages/ui/src/domains/feedback/Alert.tsx:68` e `Alert.test.tsx:44-46`, che si rigenerano.
- **C — design:**
  - tipo `ComponentDesign` in `src/library/library-plan.ts:29-53`;
  - loader in `src/library/designs-loader.ts:33`;
  - file in `data/designs/*.design.json`.
- **C — lettura live:**
  - `componentFixtureFromSnapshot` in `src/extract/component-reader.ts:52`;
  - `buildRecipe` in `src/extract/extract-component.ts:139`, che dà parte → cella → token, cioè la trasposta di `design.cells`.
  - `sync:design` confronta e riscrive solo `cells` e lascia invariato `parts` (seed di `addCell`).
- **C — pezzi da riusare:**
  - `parseComponentArgs` (`src/cli/component-args.ts`);
  - `formatDiff` (`src/library/adopt-command.ts:62`);
  - scrittura tmp + rename sul modello di `writeAdoption` (`adopt-variant.ts:607-644`, che contiene un byte non UTF-8: usa `grep -a`);
  - entry CLI sul modello di `src/cli/adopt-variant.ts`;
  - script in `package.json:8-21`.
- **Kind:** `PROBLEM_KINDS` in `src/shared/component-report.ts:21-48`. Si aggiungono `design-drift`, `property-outside-role` e `contrast`. Gli helper `red`/`pending` stanno in `verify-library.ts:152-153`.
- **A — contratti:**
  - `packages/contracts/src/contract.ts:42` (`parts`) e la validazione :160-163;
  - `schema-version.ts:6`;
  - `fingerprint.ts:46-60`;
  - `tests/contracts.fingerprint.json` (append-only);
  - le parti in `components/{badge,input,accordion-item,alert}.ts`.
  - Ruoli: board → `surface`, text → `text`, chevron → `icon`, divider (board con solo stroke) → `divider`.
- **A — design `kind`:**
  - consumatori: `library-plan.ts:191-200`, `penpot-writer.ts:70,76,147,153`, `library-spec.ts:120,128`;
  - si ricava con `surface`/`divider` → board, `text` → text, `icon` → path;
  - si toglie `kind` dai 4 design. Il piano di `add:library` deve restare identico.
- **A — registro:**
  - `src/shared/style-properties.ts`: `STYLE_PROPERTIES` :117, `layerTreeIssues` :375-400;
  - chiamato dall'estrazione (`extract-component.ts:166`) e da verify.
  - La tabella ruolo → proprietà va accanto a `STYLE_PROPERTIES`.
- **B — regola 10:**
  - oggi è in `verify-library.ts:474-495`, globale, con le coppie da `library-spec.ts:99-135,182,232` (`deriveDesignContrastPairs`);
  - la nuova usa lo snapshot live (`SnapshotLayer.tokens`, `library-snapshot.ts:29-37`), `resolveColor`/`buildTokenIndex` e `contrast.ts:39`;
  - soglie: 4.5 per `text`, 3 per `icon`, contro la `surface` antenata più vicina con fill (altrimenti `color.background`);
  - `CATALOG_PAIRS` resta globale.
- **Skill:**
  - `skills/pds-component/SKILL.md:67-81` (tabella [PS]);
  - copie identiche in `.claude/skills/` e `.agents/skills/`;
  - hash in `_bmad/_config/files-manifest.csv:391`.
- **Da non toccare:** le regole 2, 3, 6, 7 (`component-reader.ts:111-130`, `verify-library.ts:180-193,340-388`), `pds-bootstrap`, `bump:contract`.

## Tasks & Acceptance

**Execution:**
- [x] `src/extract/recipe-schema.ts`, `validate-recipe.ts` -- `role` stringa oppure mappa su un asse `option`, completa, rifiutata su `state`/`behavior` -- D
- [x] `src/emitter/render-component.ts` -- mappa const + `role={map[prop ?? default]}`; un `it` per valore nel test generato; il ramo stringa resta byte-identico -- D
- [x] `src/emitter/gates.ts`, `gates-runner.ts` -- `checkDeclaredA11y` su ogni valore della mappa -- D
- [x] `data/recipes/judgments/alert.json` + `extract:component`/`render:component -- Alert` -- `status` per info/success, `alert` per warning/error -- D
- [x] `src/library/sync-design.ts` + `src/cli/sync-design.ts` + script `sync:design` -- design live dalle celle estratte, diff, `--yes` con tmp + rename -- C
- [x] `src/library/verify-library.ts` -- `design-drift` (`pending`) quando le celle committate ≠ live -- C
- [x] `packages/contracts/src/**` -- tipo `PartRole`, parti `{name, role}` o forma equivalente, validazione, ruoli dei 4 contratti, `SCHEMA_VERSION` 3 + voce del fingerprint -- A
- [x] `src/shared/style-properties.ts` (`layerTreeIssues` + tabella accanto a `STYLE_PROPERTIES`) -- tabella ruolo → proprietà, `property-outside-role` con i tre adattamenti -- A
- [x] `src/library/library-plan.ts`, `penpot-writer.ts`, `library-spec.ts`, `data/designs/*.json` -- `kind` ricavato dal ruolo, tolto dai design -- A
- [x] `src/library/role-part.ts` + `src/cli/role-part.ts` + script `role:part` -- diff + `--yes`, solo `SCHEMA_VERSION` -- A
- [x] `src/library/verify-library.ts`, `library-spec.ts` -- regola 10 per componente e per cella sullo snapshot live, `kind: contrast`; via `deriveDesignContrastPairs` -- B
- [x] `**/*.test.ts` -- rosso/verde per ogni controllo e `kind` nuovo, e per le righe della matrice -- prova
- [x] `skills/pds-component/SKILL.md` + copie + hash -- righe [PS] `property-outside-role`, `design-drift`, `contrast` -- skill

**Acceptance Criteria:**
- Given i 4 contratti con i ruoli, when giro `render:check`, then il diff è zero salvo `Alert.tsx`/`Alert.test.tsx` per il role per variante.
- Given `add:library --dry-run` sulla library live, when i design non hanno più `kind`, then il piano è identico a quello prima della modifica.
- Given `sync:design -- Alert` su Penpot live, when lo giro, then il diff è vuoto ed exit 0 (`alert.design.json` è già riallineato nella 2.9).
- Given `pnpm test`, `check-types` e `lint` (turbo `--force`), when girano, then sono verdi senza skip.

## Implementation Notes

- **D:** `a11y.role` = stringa | `null` | `{axis, values}` (`RoleMapSchema` strict); `roleMapProblems` (recipe-schema) verifica asse `option`, valori completi e senza estranei, ed è usata da `validateRecipe`, `loadJudgment` e dall'emitter. Il test generato ha un `it("porta il role dichiarato (<asse>=<valore>: <role>)")` per valore; `checkDeclaredA11y` verifica titolo + asserzione per ogni valore (l'asserzione da sola è uguale per due valori con lo stesso role). La ricetta di Alert è stata ricostruita con `buildRecipe` dalla fixture committata (Penpot live non raggiungibile), la fixture non è cambiata.
- **C:** `src/library/sync-design.ts` (pure `liveDesignCells`/`designDrift`/`syncedDesignCells` + `runSyncDesign`), CLI `src/cli/sync-design.ts`, script `sync:design`. Una cella del design assente in Penpot non è drift (seed di `addCell`). In `verify:library` il problema è `pending`, una riga per cella.
- **A:** forma equivalente scelta: `parts` resta la lista, più `partRoles: Record<parte, PartRole>` (`PART_ROLES` in `@app/contracts`), validato in `defineContract` e incluso nel fingerprint. `SCHEMA_VERSION` 3, voce `"3"` aggiunta. `ROLE_PROPERTIES` + `outsideRoleProblem` accanto a `STYLE_PROPERTIES`; `layerTreeIssues(…, roles)` segnala `outsideRole` solo sui token di proprietà usabili. `kind` del design ricavato con `PART_KIND_BY_ROLE`; il piano di `add:library` (bootstrap, additiva, addCell) è byte-identico al precedente. `role:part` in `src/library/role-part.ts` + CLI, riscrittura via AST TypeScript e `writeAdoption`.
- **B:** regola 10 per componente in `verifyLibrary`, sui `tokens` dello snapshot (albero reale dei layer, alias inclusi); `deriveDesignContrastPairs`/`buildContrastPairs` rimosse, `LIBRARY_SPEC.contrastPairs = CATALOG_PAIRS`.
- **Da verificare live:** Penpot non era raggiungibile in questa sessione (plugin MCP non connesso). Lo snapshot committato ha Alert `status=warning` description = `color.card-foreground`, mentre fixture, ricetta, `Alert.tsx` e `alert.design.json` hanno `color.muted-foreground`: su quello snapshot `sync:design -- Alert` mostra 1 differenza e `verify:library` mette Alert in attesa (`design-drift`). Non è stato scritto nulla da snapshot: serve la lettura live.

## Spec Change Log

## Review Triage Log

## Design Notes

**Default del role per variante:** quando la prop non è passata vale il default cva dell'asse (Alert `info` → `status`). Esempio emesso: `const alertRoles = { info: "status", success: "status", warning: "alert", error: "alert" } as const;` e `role={alertRoles[status ?? "info"]}`.

**`design-drift` è `pending`, non `red`:** il codice generato non diventa infedele (lo protegge il gate drift). Resta indietro solo il seed di `addCell`, e con B il contrasto non dipende più dal design.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` / `check-types` -- expected: verdi
- `pnpm --filter @app/contracts test` -- expected: verde con `SCHEMA_VERSION` 3
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: diff solo su Alert (D)
- `pnpm lint` -- expected: verde
- `diff -r skills/pds-component .claude/skills/pds-component` (e `.agents`) -- expected: nessuna differenza

**Manual checks:**
- Live, con il token Penpot caricato:
  - `verify:library --json` e `gates:render --json` exit 0, 4/4 ok;
  - `sync:design -- Alert` con diff vuoto;
  - prova rossa del contrasto riproducendo Alert `warning` a 1.82:1 in un test sullo snapshot.
