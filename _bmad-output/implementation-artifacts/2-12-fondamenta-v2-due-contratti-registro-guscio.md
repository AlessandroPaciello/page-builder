---
title: 'Story 2.12 — Fondamenta v2: due contratti, registro, guscio'
type: 'feature'
created: '2026-09-17'
status: 'done'
route: 'dispatch'
baseline_commit: 'ae82e9450491a684fca7753674aa71551dbd6ebf'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/specs/spec-refactor-packages-scripts/extraction-contract.md'
  - '{project-root}/_bmad-output/specs/spec-refactor-packages-scripts/commands.md'
  - '{project-root}/_bmad-output/forge/refactor-packages-scripts/simulazione-card.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** la ProductCard non si descrive nel modello v1: nessun ruolo `image`, nessuna parte opzionale per variante o ripetibile, field solo come testo, nessun albero. Il vocabolario sta nel contratto, non negli script, e finché `@app/contracts` porta `parts`/`partRoles`/assi di rendering nel fingerprint ogni scelta di design è un bump di schema.

**Approach:** CAP-1, 2, 3, 8 dello SPEC v2. Il contratto del page builder si riduce a nome, versione, assi `option`, field e slot (`SCHEMA_VERSION` 3→4, una volta sola); `parts`, `partRoles` e gli assi `state`/`behavior` restano tollerati come estensione deprecata fuori dal fingerprint, visibili solo alla v1. In `packages/scripts/src/v2` nascono `defineExtraction` con i controlli a module load, il guscio CLI unico con `ScriptError` e i quattro exit code; il registro unico impara `layout`, `position` e il ruolo `image`. I due contratti della ProductCard sono la prima prova del modello. La v1 resta intatta e verde.

## Boundaries & Constraints

**Always:**
- Dipendenza in un verso solo: il contratto di estrazione importa quello del page builder; `@app/contracts` non conosce Penpot né `src/v2`.
- `SCHEMA_VERSION` sale a 4 con una nuova voce append-only in `contracts.fingerprint.json`; nessuna voce esistente riscritta.
- Nessun file v1 (`src/cli`, `emitter`, `extract`, `library`, `theme`, `shared`) importa da `src/v2`; un test lo verifica. La v1 vede solo i contratti con l'estensione deprecata.
- Ogni controllo a module load, ogni proprietà nuova del registro e ogni categoria di `ScriptError` ha una prova rosso/verde.
- `process.exit`/`process.exitCode` in `src/v2` solo nel file del guscio.
- Gate v1 a diff zero: `render:check`, `verify:library --snapshot`, suite `scripts`, `contracts`, `ui`; nessun test in meno.

**Never:**
- Nessun comando `library`/`extract`/`render`/`gates`/`propose` (Story 2.13–2.15); nessuna istantanea, nessuna `PATHS.componentsDir`.
- Nessuna cancellazione o riscrittura della v1: contratti Badge/Input/Alert/AccordionItem restano col formato v1 (rinascono alla 2.16).
- Nessuna lettura live di Penpot (MCP non raggiungibile): `position` entra nel registro come dichiarazione di lettura, la verifica sul reader è della 2.13.
- Nessuna riscrittura delle skill `pds-*` (2.17).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Fingerprint ridotto | contratto con `partRoles` e asse `state` | payload identico con o senza estensione | N/A |
| Estensione incoerente | `parts` senza `partRoles` (o viceversa) | `defineContract` lancia nominando il contratto | Error a module load |
| Field inesistente | `content: "prezzo"` non nei field | lancia: componente, parte `price`, field `prezzo` | `ScriptError contract` |
| Tipo sbagliato | `attribute: { src: "price" }` con `price` stringa non url; `repeat` su field non array; `content` su field array | lancia nominando parte, field e tipo atteso | `ScriptError contract` |
| `$item` fuori da `repeat` | `content: "$item"` su parte senza `repeat` né antenato ripetuto | lancia nominando la parte | `ScriptError contract` |
| `when` su asse non `option` | `when: { hover: ["on"] }` (asse di rendering) o valore assente | lancia nominando parte, asse e valori ammessi | `ScriptError contract` |
| Albero senza radice / cicli | nessuna parte `root`; `root` con `parent`; `a.parent=b`, `b.parent=a`; parte irraggiungibile | lancia nominando le parti coinvolte | `ScriptError contract` |
| Parte senza ruolo o ruolo ignoto | `role` mancante o `"heading"` | lancia con il vocabolario dei 5 ruoli | `ScriptError contract` |
| Plugin data incoerente | `penpot.container: "Card"` per `product-card` | lancia: atteso `ProductCard`, plugin data derivato `product-card@1` | `ScriptError contract` |
| `href` sulla radice | `root` con `attribute.href` ed `element` ≠ `a` | lancia | `ScriptError contract` |
| Ruolo `image` | token `fill` su parte `image` | `roleAdmits("image","fill")` falso; problema `outsideRole` | messaggio nominativo esistente |
| Layout/position | `layoutDir: "column"`, `positionAbsolute: "absolute"`, `positionX` token spacing, `zIndex: "10"` | righe supported; classi `flex flex-col`, `absolute`, `left-*`, `z-10` | valore fuori lista → problema esistente |
| Guscio: comando ignoto/assente | `argv = []` o `["nope"]` | usage con i comandi registrati, exit 1 | `ScriptError input` |
| Guscio: per categoria | comando che lancia `ScriptError` input/penpot/contract/gate | stampa `✖ <kind>  <Comp> · cella · parte` + detail; exit 1/2/3/4 | errore non tipizzato → exit 1 |
| Guscio: successo | comando che ritorna `0` | exit 0, nessuna scrittura di `process.exitCode` | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/contract.ts` -- `ComponentContract` (`parts`/`partRoles` diventano opzionali `@deprecated`), `defineContract` (controlli sulle parti solo se l'estensione è presente, coerenza `parts`⇔`partRoles`), `AxisType` (`state`/`behavior` deprecati nel page builder), nuovo `LegacyComponentContract` + `hasLegacyExtension()`.
- `packages/contracts/src/fingerprint.ts:45-70` -- payload: solo assi `option` (`name`, `values`, `default`), `fields`, per le sezioni anche `slots`; via `parts`/`partRoles`.
- `packages/contracts/src/schema-version.ts`, `tests/contracts.fingerprint.json`, `tests/schema-version.test.ts` -- bump a 4 + voce; guardia invariata.
- `packages/contracts/src/components/product-card.ts`, `src/registry.ts`, `src/index.ts` -- contratto ridotto (asse `promo`, field `image`/`price`/`description`/`tags`/`href`/`badgeLabel`); registrato ed esportato.
- `packages/contracts/tests/contract.test.ts:36-45` -- "il ruolo entra nel fingerprint" va invertito; `tests/components.test.ts` asserzioni su `parts` restano (estensione presente).
- `packages/scripts/src/extract/component-reader.ts:29-36` -- `contractByName` e nuova `legacyContracts()` filtrano con `hasLegacyExtension`: unico punto in cui la v1 sceglie i contratti. Sostituire `Object.values(COMPONENT_CONTRACTS)` in `library-command.ts:166,203`, `adopt-command.ts:81`, `bump-command.ts:49`, `role-part.ts:128,244`, `sync-design.ts:183`; tipi `ComponentContract` → `LegacyComponentContract` dove si legge `parts`/`partRoles` (`verify-library.ts:25`, `library-plan.ts:43,135`, `sync-design.ts:50`, `validate-recipe.ts`, `role-part.ts`). Solo tipi e filtro: nessun cambio di comportamento.
- `packages/scripts/src/shared/style-properties.ts` -- registro unico: nuove `ReadRule` (`flexLayout`, `layoutChild`), nuova `EmitRule` `keywordClass`, righe `layoutDir`/`layoutAlign`/`layoutJustify`/`layoutWrap`/`positionAbsolute`/`positionX`/`positionY`/`zIndex` in coda (l'ordine delle righe esistenti è quello delle fixture v1); `PART_ROLES` v2 a 5 ruoli qui (il registro possiede ruolo→proprietà); `ROLE_PROPERTIES` con `image` e layout/position su `surface`/`image`; `roleAdmits` accetta i 5 ruoli.
- `packages/scripts/src/shared/style-properties.test.ts:40-48,197-230` -- test "quattro ruoli" → cinque; completezza prefissi per le righe token nuove.
- `packages/scripts/src/theme/token-vocabulary.ts:20-35` -- `spacing` acquisisce `top`/`right`/`bottom`/`left` (prefissi reali Tailwind v4).
- `packages/scripts/src/emitter/render-component.ts:259-340` -- switch sugli `emit`: aggiungere il caso `keywordClass` come blocco nominativo (la v1 non lo incontra mai).
- `packages/scripts/src/v2/errors.ts` (nuovo) -- `ScriptError { kind, component?, cell?, part?, detail }`, `EXIT_CODES`, `formatScriptError`.
- `packages/scripts/src/v2/shell.ts` (nuovo) -- `Command { name, usage, run(argv) }`, `runShell(argv, commands, io) → Promise<number>`: parser, dispatch, cattura, exit code; puro rispetto al processo.
- `packages/scripts/src/v2/cli.ts` (nuovo) -- unico entry: `isDirectInvocation` (riuso `src/shared/direct-invocation.ts`) → `process.exit(await runShell(...))`.
- `packages/scripts/src/v2/commands/theme.ts` (nuovo) + `src/theme/theme-command.ts` (estratto da `src/cli/generate-theme.ts:33-61`, `runTheme({live})` pura rispetto al processo; il CLI v1 la chiama, comportamento identico).
- `packages/scripts/src/v2/extraction.ts` (nuovo) -- tipi `ExtractionContract`, `Part`, `RenderAxis`, `Headless`, `A11y`; `defineExtraction(contract, def)` con i controlli a module load; `fieldType()` via `z.toJSONSchema` (`string`/`uri`/`array`); domini = `DESIGN_DOMAINS` v1 + `commerce`.
- `packages/scripts/src/v2/contracts/product-card.extract.ts` (nuovo) -- dalla simulazione, con `badgeLabel: { content: "badgeLabel" }` al posto di `static`.
- `packages/scripts/package.json` -- script `theme` → `src/v2/cli.ts theme`; `generate:theme` invariato.
- `packages/scripts/tests/cli-smoke.test.ts` -- enumera solo `src/cli/`: lo smoke del guscio v2 sta in `src/v2/cli.test.ts`.
- `packages/scripts/README.md` -- sezione "v2 (Story 2.12)" breve.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/{contract,fingerprint,schema-version}.ts` + `tests/contracts.fingerprint.json` -- contratto ridotto, estensione deprecata, fingerprint solo page builder, bump 4 -- CAP-1
- [x] `packages/contracts/tests/legacy-extension.test.ts` (nuovo) -- estensione tollerata, fuori dal fingerprint, `propsSchema` ignora `state`; intestazione "da cancellare nella Story 2.16 con i campi" -- fissa la cancellazione
- [x] `packages/contracts/src/components/product-card.ts` + registry/index + test in `components.test.ts` -- primo contratto ridotto -- prova del modello
- [x] `packages/scripts/src/extract/component-reader.ts` + i 7 siti v1 -- `legacyContracts()`/`LegacyComponentContract` -- v1 legge solo l'estensione
- [x] `packages/scripts/src/shared/style-properties.ts` + test, `token-vocabulary.ts`, `render-component.ts` -- layout, position, `image`, 5 ruoli -- CAP-3
- [x] `packages/scripts/src/v2/{errors,shell,cli}.ts` + `src/v2/shell.test.ts`, `src/v2/cli.test.ts` -- guscio ed errore, un test per categoria + smoke dell'entry -- CAP-8
- [x] `packages/scripts/src/theme/theme-command.ts`, `src/cli/generate-theme.ts`, `src/v2/commands/theme.ts`, `package.json` -- primo comando sul guscio -- chiude la voce deferred-work su `generate:theme`
- [x] `packages/scripts/src/v2/extraction.ts` + `extraction.test.ts` -- `defineExtraction` con i controlli della matrice -- CAP-2
- [x] `packages/scripts/src/v2/contracts/product-card.extract.ts` + test di caricamento -- i due contratti della card -- prima prova
- [x] `packages/scripts/tests/v2-boundary.test.ts` (nuovo) -- nessun import v1→v2; `process.exit*` solo in `src/v2/cli.ts` -- invarianti
- [x] `packages/scripts/README.md` -- sezione v2 -- documentazione

**Acceptance Criteria:**
- Given `pnpm --filter @app/contracts test`, when gira, then il fingerprint corrisponde alla voce `"4"`, la voce `"3"` è intatta e il test dell'estensione deprecata è verde.
- Given `import "src/v2/contracts/product-card.extract"`, when il modulo carica, then nessun errore; ogni riga rossa della matrice, applicata in un test con un contratto modificato, lancia un `ScriptError` di kind `contract` che nomina parte e campo.
- Given `pnpm --filter @penpot-ds/scripts render:check`, `verify:library --snapshot data/library.snapshot.json`, `validate:recipe -- Badge`, when girano, then exit 0 e nessun file generato cambia.
- Given `node --import tsx src/v2/cli.ts` senza argomenti, when gira, then usage con `theme` ed exit 1; `theme` offline rigenera i token a diff zero.

## Implementation Notes

- **CAP-1:** `ComponentContract` unico con `parts?`/`partRoles?` `@deprecated`; `LegacyComponentContract` + `hasLegacyExtension` esportati. `defineContract` controlla l'estensione solo se presente e rifiuta `parts` senza `partRoles` (e viceversa). Fingerprint: assi `option` senza `type`, field, `slots` delle sezioni; `SCHEMA_VERSION` 4, voce `"4"` = `d71a057e…`. `product-card` registrato: nel fingerprint, invisibile alla v1.
- **v1 intatta:** un solo punto di scelta, `legacyContracts()`/`contractByName()` in `component-reader.ts` (filtro `hasLegacyExtension`); 7 siti v1 passati da `Object.values(COMPONENT_CONTRACTS)`; tipi `LegacyComponentContract` dove si leggono `parts`/`partRoles`. `adopt:variant` e `role:part` calcolano il fingerprint su TUTTO il registry con i contratti v1 sostituiti per nome (`fingerprintComponents`), altrimenti l'hash divergeva dal test di `@app/contracts`. Nessun cambio di comportamento: `render:check` 4/4, `verify:library` snapshot exit 0, `validate:recipe` ok, `gates:render` 4 ok.
- **CAP-3:** `PART_ROLES` (5) e `PartRole` nel registro; `ReadRule` `flexLayout`/`layoutChild`, `EmitRule` `keywordClass`; 8 righe in coda (ordine v1 intatto, test lo fissa); `image` senza `fill`; `top/right/bottom/left` nei prefissi `spacing`; caso `keywordClass` nell'emitter v1 come blocco nominativo mai raggiunto.
- **CAP-8:** `src/v2/errors.ts` (`ScriptError`, `EXIT_CODES`, `formatScriptError` nella forma della simulazione), `shell.ts` (`runShell`, `parseArgs`, `usageOf`; mai lancia), `cli.ts` (unico `process.exit`). `theme` primo comando: corpo estratto in `src/theme/theme-command.ts`, condiviso con l'entry v1 `generate:theme`; script `theme` in `package.json`.
- **CAP-2:** `src/v2/extraction.ts` con i controlli della matrice più: assi di rendering (tipo, collisioni, default), layer duplicati, headless su parte ignota, dominio (`RENDER_DOMAINS` = v1 + `commerce`), `image` senza `content`, `a11y.role` per variante = valori di un asse `option`. `fieldType` via `z.toJSONSchema` (`uri` → url). `product-card.extract.ts` con `content: "badgeLabel"`.
- **Test:** scripts 626 → 686, contracts 135 → 147; `tests/v2-boundary.test.ts` (nessun import v1→v2; `process.exit*` solo in `cli.ts`, commenti esclusi). Non verificato live: la lettura MCP di `layoutChild`/`parentX`/`zIndex` (Penpot non raggiungibile) — righe dichiarate, verifica alla 2.13 come da spec.
- **Dopo la review (patch applicate):** parte `media` nella card e rifiuto del `parent` void; `content` solo al ruolo `text` (`tagLabel` sotto `tag`); `when`/`repeat` sulla radice, `repeat` annidato e `layer` vuoto rifiutati; assi `state`/`behavior` vietati nei contratti ridotti; regola 11 di `verify:library` sul registry completo; vocabolario `spacing` solo `top`/`left`; `v2-boundary` con import dinamici e test v1; `cli.test.ts` ripristina i file generati; test degli slot nel fingerprint. Suite: scripts 687, contracts 149, ui 39.
- **Fuori diff:** `apps/web/next-env.d.ts` è sporco per rigenerazione di Next, non fa parte della story.

## Spec Change Log

## Review Triage Log

Solo il layer `blind-hunter` ha prodotto risultati: `edge-case-hunter` e `verification-gap` sono morti con HTTP 429 «monthly spend limit» dell'account, quindi la review è parziale e il loro esito manca.

| Verdetto | Finding | Evidenza / esito |
|---|---|---|
| high | `badge` figlio di `image` (`img` è void, non ha figli) | Verificato: l'albero dichiarato non è HTML renderizzabile; la simulazione stessa rende il badge come fratello dell'immagine. **Patch**: parte `media` (surface) contiene `image` e `badge`; `defineExtraction` rifiuta un `parent` con elemento void, con test. |
| high | regola 11 di `verify:library` marcherebbe orfano il container `ProductCard` | Verificato su `verify-library.ts`: `registered` veniva dai soli contratti v1. **Patch**: la regola guarda il registry completo; test aggiornato. |
| medium | un contratto ridotto accetta ancora assi `state`/`behavior` | Verificato: `defineContract` legava solo `parts`⇔`partRoles`. **Patch**: senza estensione v1 sono ammessi solo assi `option`, con prova rosso/verde. |
| medium | `content` su una parte `surface` non può portare tipografia | Verificato sulla tabella ruolo → proprietà (`surface` non ha `fontSize`). **Patch**: `content` ammesso solo al ruolo `text`; la card ha `tagLabel` sotto `tag`. |
| medium | controlli mancanti: `when`/`repeat` sulla radice, `repeat` annidato, `layer` vuoto | Verificato: nessuno era coperto. **Patch**: tre controlli più i loro test. |
| medium | `cli.test.ts` scrive nei file generati del repo | Verificato: `theme` non ha seam da CLI e riscrive `packages/tokens/src`. **Patch**: il test ripristina i byte letti prima di asserire. |
| medium | `v2-boundary.test.ts` vede solo import statici e salta i test | Verificato sulla regex e sul filtro. **Patch**: regex estesa a `import()`, `vi.mock`, `require`; i test v1 rientrano nel confine. |
| medium | `top/right/bottom/left` allargano il vocabolario del gate v1 | Verificato: `TYPE_UTILITY_PREFIXES` alimenta `validateRecipe`. **Patch**: restano solo `top` e `left`, i due prefissi che il registro usa. |
| low | gli slot entrano nel fingerprint senza test | Verificato: nessun test copriva `allow`/`max`. **Patch**: test in `contract.test.ts`. |
| low | `planRolePart` ha un secondo registry di default | Verificato: default su `COMPONENT_CONTRACTS` mentre il chiamante passa `fingerprintComponents`. **Patch**: un solo default. |
| low | `usageOf` non nomina il separatore `--` di pnpm | Verificato contro il README. **Patch**: riga d'uso aggiornata. |
| low | il commento di `badgeLabel` promette un field inerte, ma è obbligatorio | Verificato su `propsSchema`. **Patch**: commento corretto (il field resta obbligatorio come gli altri). |
| low | `process.exit(code)` può troncare stdout su pipe | Reale ma trascurabile qui: output corto e stesso schema di tutti gli entry v1; cambiarlo divergerebbe dalla v1 a due story dalla sua cancellazione. Respinto. |
| low | categoria `input` anche per errori di filesystem in `writeTheme` | `input` è la categoria di chi non ha un canale proprio (le quattro sono fissate da `commands.md`): un errore di scrittura non è `penpot` né `contract` né `gate`. Respinto. |
| maybe-false | default di `layoutAlign` e lista chiusa di `zIndex` non verificati su Penpot | Non decidibile senza lettura live (MCP non raggiungibile in sessione). Deferred: la verifica dei campi del reader è già prevista dalla Story 2.13. |
| false | `apps/web/next-env.d.ts` va escluso dal commit | Non è un difetto del cambio: il file era già sporco prima della story (rigenerazione di Next) ed è escluso dal diff sotto review. |

## Design Notes

- **Estensione deprecata, non tipo separato:** `ComponentContract` resta l'unico tipo; `parts?`/`partRoles?` opzionali con `@deprecated`. `LegacyComponentContract = ComponentContract & Required<Pick<…, "parts" | "partRoles">>` e `hasLegacyExtension` sono il solo modo in cui la v1 li ottiene: alla 2.16 si cancellano insieme ai campi senza toccare il fingerprint.
- **ProductCard nel registry ora:** entra nella voce `"4"` così il bump è uno solo; la v1 non la vede (nessuna estensione), quindi `verify:library` non chiede un container che la 2.13 creerà.
- **Ruoli nel registro, non in `src/v2`:** `style-properties.ts` è condiviso e la v1 non può importare da `src/v2`; il vocabolario dei 5 ruoli vive accanto alla tabella ruolo→proprietà. `PART_ROLES` v1 di `@app/contracts` resta a 4, deprecato.
- **`a11y.role`:** `string | null` oppure `Record<valore, string | null>` le cui chiavi coincidono esattamente con i valori di un asse `option` (con più assi `option` deve corrispondere a uno solo, altrimenti errore).
- **`position`:** `positionAbsolute` keyword `static|absolute` (`absolute`; il `relative` sul genitore è del render, 2.14), `positionX`/`positionY` token `spacing` (`left-*`/`top-*`), `zIndex` keyword `0|10|20|30|40|50` (`z-*`). Lettura dichiarata da `layoutChild.absolute`, `parentX`/`parentY`, `layoutChild.zIndex`.
- **Guscio:** `runShell` restituisce sempre un numero; `ScriptError` non tipizzato → 1 con messaggio; formato d'errore come la simulazione (`✖ contract  ProductCard · cella … · parte "badge"` + detail su riga nuova).

```ts
export default defineExtraction(productCard, {
  penpot: { container: "ProductCard" },
  render: { domain: "commerce", headless: null },
  axes: { hover: { type: "state", values: ["off", "on"], default: "off" } },
  parts: { root: { role: "surface", element: "a", attribute: { href: "href" } }, /* … */
           badgeLabel: { role: "text", element: "span", parent: "badge", layer: "Badge/Label", content: "badgeLabel" } },
  a11y: { role: null, focusVisible: true },
});
```

## Verification

**Commands:**
- `pnpm --filter @app/contracts test` -- expected: verde, voce `"4"` del fingerprint
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde, ≥ 626 test + i nuovi
- `pnpm --filter @penpot-ds/scripts render:check` -- expected: 4/4 diff zero
- `pnpm --filter @penpot-ds/scripts verify:library -- --snapshot data/library.snapshot.json` -- expected: exit 0 invariato
- `pnpm --filter @penpot-ds/scripts theme` -- expected: `packages/tokens/src` a diff zero
- `pnpm check-types && pnpm lint && pnpm --filter @penpot-ds/ui test` -- expected: verdi senza skip
