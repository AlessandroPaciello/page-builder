# @penpot-ds/scripts

Pipeline MCP che legge il catalogo token da Penpot e genera i file di [`@penpot-ds/tokens`](../tokens/README.md).

**Stage 1 (token) + Stage 2 per-componente (estrazione componenti/ricette) + emitter shadcn e gate (Story 2.6).** Il renderer deterministico (fixture+ricetta → componente) è l'emitter di Story 2.6.

## Script

| Comando | Cosa fa |
|---|---|
| `pnpm --filter @penpot-ds/scripts generate:theme` | Rigenera `tailwind-theme.css` + `tokens.generated.ts` **dalla fixture committata** (`src/__fixtures__/penpot-catalog.json`), offline. |
| `pnpm --filter @penpot-ds/scripts generate:theme -- --live` | Si connette al server MCP Penpot (vedi [Connessione a Penpot](#connessione-a-penpot)), legge il catalogo reale, **aggiorna anche la fixture committata**, poi rigenera. |
| `pnpm --filter @penpot-ds/scripts extract:component -- <Nome> [--snapshot <path>]` | **Live di default** (mai in CI né in build): estrae UN componente dalla library Penpot e scrive `src/recipes/<nome>.fixture.json` E `src/recipes/<nome>.recipe.json` (coppia scritta atomicamente: se la ricetta fallisce, la fixture torna indietro — zero artefatti). Il nome è quello del VariantContainer (`Badge`), che deve dichiarare il plugin data `pagebuilder/contract = nome@versione`: fallisce loud (exit ≠ 0, zero artefatti) su contratto duplicato, nome incoerente, contratto senza container. `--snapshot <path>` è il seam offline: legge uno snapshot già salvato invece di parlare con Penpot (il file è validato alla fonte — un JSON che non è uno snapshot fallisce nominando il campo). |
| `pnpm --filter @penpot-ds/scripts validate:recipe -- <Nome>` | Offline: valida la coppia `src/recipes/<nome>.fixture.json` + `<nome>.recipe.json` — conformance meccanica al contratto (assi, valori, parti = esattamente quelli del contratto; celle = prodotto cartesiano completo), conformance ricetta↔fixture (ogni cella `proprietà → token` = binding `shape.tokens` della fixture per la stessa parte×cella; il `judgment` della ricetta = contenuto di `judgments/<contratto>.json`) e gate token Stadio 1 (ogni token esiste nel catalogo; un literal non passa). Ha anche il check di provenienza (`penpotComponentId`, `fixtureHash`). Wired in CI come Gate 4 di `gates:render`. |
| `pnpm --filter @penpot-ds/scripts render:component -- <Nome> [--check] [--base <dir>]` | **Offline, per componente e su richiesta** (mai in build): l'emitter shadcn (Story 2.6) legge fixture+ricetta+binding+base committate e genera i 4 file `@generated` in `packages/ui/src/domains/<domain>/` (`.tsx`, `.test.tsx`, `.stories.tsx`, `index.ts`), instradando gli assi per TIPO letto dal contratto (`option` → varianti `cva`; `state` → prefissi `focus-visible:`/`aria-invalid:`/`disabled:`; `behavior` → `data-[state=…]:`) e derivando le classi da `varSuffix` (stessa funzione di nome dello Stadio 1, validate col vocabolario token — un literal non passa). `--check` NON scrive: confronto byte-per-byte in memoria (`renderCheck`), exit ≠ 0 nominando componente e file divergente — è il gate rigenerazione. Un file esistente senza marker `@generated` non è MAI sovrascritto (skip con log, non errore). Distinzione: `extract:component`/`validate:recipe` producono e validano i DATI (fixture+ricetta, da Penpot); `render:component` consuma i dati committati e produce CODICE, senza mai parlare con Penpot. |
| `pnpm --filter @penpot-ds/scripts bootstrap:library [-- --dry-run]` | **Live, una tantum** (mai in CI né in build): bootstrap della library Penpot sui contratti (Story 2.4). Su un file Penpot vuoto crea i set `palette` e `semantic`, i token semantici e un VariantContainer per contratto, poi verifica. Rifiuta con exit 1 e zero scritture se la library non è vuota. `--dry-run` stampa il piano senza scrivere. Guidato dalla skill `pds-bootstrap` (modulo BMad `pds`). **Recupero da run interrotto**: se una scrittura si interrompe a metà, la library resta parziale (celle orfane senza container). Rilanciare il bootstrap verrà comunque rifiutato (la library non è più vuota): rimuovi a mano in Penpot i componenti orfani (`<Container> <asse>=<valore>`) e i set parziali, poi riparti da un file nuovo. La guardia nel writer fallisce loud se trova un componente con lo stesso nome, invece di creare duplicati. |
| `pnpm --filter @penpot-ds/scripts add:library [-- --dry-run]` | **Live** (mai in CI né in build): modalità additiva sulla library esistente — crea solo i token mancanti e i container dei contratti senza container legato, **segnala** le differenze senza correggerle. Le differenze sono solo avvisi a schermo e **non** cambiano l'exit code: dopo ogni run (anche a 0 operazioni) gira la verifica, e l'exit code è SEMPRE quello di `verifyLibrary`. |
| `pnpm --filter @penpot-ds/scripts verify:library [-- --snapshot <path>]` | **Sola lettura**: legge lo snapshot della library e lancia `verifyLibrary` (10 regole: un container per contratto, assi/valori/celle/parti, binding token su ogni proprietà di stile, spec completa, `generateTheme()` verde, coppie di contrasto). L'exit code decide l'esito. Offline accetta `--snapshot <path>` (seam dei test). |
| `pnpm --filter @penpot-ds/scripts test` | Test unitari, offline e deterministici — nessuna rete (i transport MCP nei test sono mockati). |
| `pnpm --filter @penpot-ds/scripts gates:render` | I **5 gate del regime design→codice** (Story 2.6), bloccanti in CI (wired in `.github/workflows/ci.yml`): 1. **completezza artefatti** (`.tsx` + `.test.tsx` + `.stories.tsx` + `index.ts` per componente in `ui/domains`), 2. **rigenerazione a diff zero** (`renderCheck`, nessuna scrittura), 3. **a11y** (esito della suite `@penpot-ds/ui`, assert `vitest-axe` su ogni componente generato), 4. **conformità al contratto** (riuso `validateRecipe`), 5. **drift della fixture** (Penpot live vs fixture committata, via `readLibrarySnapshot`; skip DOCUMENTATO se la lettura live fallisce — mai verde finto). Ogni gate ha prova rosso/verde propria in `src/emitter/gates.test.ts`. La lista dei componenti coperti è derivata dalle ricette committate (`src/recipes/*.recipe.json`): un componente nuovo entra nei gate per costruzione. |

## Emitter shadcn e gate (Story 2.6)

- **Basi committate** (decisione frozen): `src/emitter/bases/<kebab>/` contiene l'output di `shadcn add` eseguito UNA TANTUM per badge/input/accordion — le basi sono INPUT dell'emitter; il CLI shadcn non gira mai a runtime né in CI. `packages/ui/components.json` ha gli alias riallineati a `@penpot-ds/ui/domains` (Task 0).
- **Binding per componente**: `src/emitter/bindings/<kebab>.binding.json` dichiara tutto ciò che dipende dalla libreria (AD-11): componente base, parti ricetta → parti libreria, headless (con `rootProps` per i render di test), valori d'asse → API. Il TIPO d'asse vive SOLO nel contratto: l'emitter lo legge da `@app/contracts` e il binding lo ripete solo come controllo incrociato fail-loud.
- **Convenzione `@generated` in `domains/`**: ogni file generato inizia con un commento `@generated` che porta provenienza (`contract`, `penpotComponentId`, `fixtureHash`) e comando di rigenerazione. Si modifica la ricetta o il binding (o si riestrae la fixture) e si rigenera — mai edit a mano; un file senza marker è "sganciato" dalla pipeline e viene preservato.
- **Gate drift (decisione frozen, opzione a)**: bloccante in CI SE E SOLO SE il runner raggiunge il server MCP Penpot; altrimenti skip documentato col motivo nel log e riesecuzione manuale/nightly. Nessuna estrazione Penpot in CI/build: l'unica lettura live è il gate drift, con seam offline per i test.

## Connessione a Penpot

Solo i comandi live (`generate:theme --live`, `extract:component`, `bootstrap:library`, `add:library`, `verify:library`) parlano con Penpot; test, `validate:recipe` e `generate:theme` offline non leggono mai queste variabili. I comandi `*:library` sono **mai in CI né in build**: Penpot non è raggiungibile dal runner.

| Variabile | Obbligatoria | Default / effetto |
|---|---|---|
| `PENPOT_MCP_URL` | no | `http://localhost:9001/mcp/stream` (proxy MCP del frontend Penpot, flag `enable-mcp`) |
| `PENPOT_MCP_TOKEN` | no (ma il server multi-user lo richiede per ogni tool) | aggiunto come query `userToken`; mascherato (`userToken=***`) in ogni messaggio |

Setup di Penpot, del token e di direnv: [README alla root](../../README.md#penpot-locale-e-server-mcp).

Se manca il token, se è stato rigenerato o se il plugin non è connesso, i comandi live falliscono con un errore che nomina `PENPOT_MCP_TOKEN`.

## Dove vive la fixture del catalogo token

`src/__fixtures__/penpot-catalog.json` — serializzazione del catalogo token Penpot (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`), solo i set `active`. Committata così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design (AC #3 di Story 2.1). È anche il vocabolario contro cui `validate:recipe` valida i token delle ricette e la provenienza (`fixtureHash`) di fixture e ricette.

**Dalla Story 2.5 è l'unica fixture**: la vecchia library `mis` è stata cancellata insieme a `legacy-mis-catalog.json`, e le ricette sono per parti e token, validate contro i contratti di `@app/contracts`. Un test (`tests/no-legacy-consumers.test.ts`) impedisce che nomi `mis-*` ricompaiano in `packages/ui/src` e `apps/web/src` (`packages/tokens` è l'eccezione ammessa).

## Library Penpot (src/library/)

Dalla Story 2.4 il package possiede anche la pipeline di allineamento library↔contratti (Stadio 0 di penpot-pipeline.md):

- `library-spec.ts` — l'elenco minimo dei token semantici richiesti (61) + le 14 coppie di contrasto (≥4.5:1 testo, ≥3:1 indicatori), come dati.
- `semantic-tokens.seed.json` — i valori del bootstrap (palette + semantic con riferimenti `{...}`), decisi con il designer.
- `designs/<contratto>.design.json` — ruolo → token per parte × cella: il disegno di partenza che il designer poi cambia in Penpot.
- `library-plan.ts` — piano PURO bootstrap/additiva: il tipo `Operation` non ha varianti per update/delete (l'invariante "l'additiva non corregge" è nel tipo).
- `library-reader.ts` — snapshot serializzabile della library via MCP (set, token, container, celle, plugin data `pagebuilder/contract`, albero layer con `shape.tokens`).
- `verify-library.ts` — le 10 regole che decidono l'esito, pure e testate: un caso rosso per regola in `verify-library.test.ts`.
- `contrast.ts` — rapporto di contrasto WCAG (luminanza relativa), helper puro.
- `penpot-writer.ts` — traduce le `Operation` in codice `execute_code`, un'operazione per chiamata.
- `library-cli.ts` — entry CLI `bootstrap:library` / `add:library` / `verify:library`.

Nota binding (aggiornata dalla Story 2.5): l'estrazione legge `shape.tokens` come unica via — `applyToken` persiste dopo il reload del file (spike verificato su "Page Builder DS") e la regola 7 di `verifyLibrary` esige un binding su ogni proprietà di stile valorizzata, quindi nella library verificata non esistono proprietà senza binding da derivare per hex. Il vecchio hex-match di `component-reader.ts` è stato rimosso con la vecchia library `mis`. Limitazione API scoperta nella Story 2.4: `applyToken` NON supporta i token `fontFamilies` su Penpot 2.17.2 ("should be a set of strings" su ogni variante) — il font family resta una scelta del designer e non è soggetto a binding.

## Dove vivono fixture e ricette dei componenti

`src/recipes/` — dati committati, non codice:

- **`<nome>.fixture.json`** — fatti letti da Penpot **senza sapere cosa sia React**: il plugin data `pagebuilder/contract` del VariantContainer (`nome@versione`), assi e valori, e per ogni cella l'albero dei layer con `shape.tokens` (proprietà → nome token) e le proprietà di stile valorizzate. Scritta SOLO da `extract:component`.
- **`<nome>.recipe.json`** — mappa di parti a **profondità 1** (chiavi = le `parts` piatte del contratto): ogni parte mappa chiavi cella (`asse=valore|…`, valori senza separatori `|`/`=`) a celle `proprietà → token`. Le celle sono derivate dai binding della fixture (la conformance ricetta↔fixture lo verifica); il **giudizio** (`domain`, `headless`, `a11y`) arriva dal file per contratto `src/recipes/judgments/<contratto>.json`; la provenienza (`penpotComponentId` + `fixtureHash`) è riregistrata dall'estrazione. Nessuna classe di una libreria: il blocco `cva` è della Story 2.6 (emitter). Una parte annidata con assi propri non è esprimibile nello schema: fallisce (criterio di stop).
- **`judgments/<contratto>.json`** — i campi di giudizio per contratto, scritti a mano e committati: l'estrazione li fonde con le celle estratte. I giudizi sono JSON: le note (es. sul fatto che `headless.parts` nomina componenti Radix, non parti del contratto) stanno nel campo `comment`.

**Confine fixture/ricetta (regola assoluta):** nella fixture niente decisioni (dominio, headless, ARIA); nella ricetta niente fatti grezzi (hex, CSS raw, shape). La ricetta nomina token, mai valori: un literal non passa la validazione.

## Estrarre un nuovo componente

1. Il contratto deve esistere in `@app/contracts` e la library Penpot deve avere il VariantContainer che lo dichiara via plugin data `pagebuilder/contract = nome@versione`, con nome = PascalCase del contratto (le skill `pds` scrivono il plugin data; `verify:library` verifica il resto).
2. `pnpm --filter @penpot-ds/scripts extract:component -- <Nome>` → scrive e committa `src/recipes/<nome>.fixture.json` e `<nome>.recipe.json` (celle dai binding, giudizio dal file `judgments/<contratto>.json`, provenienza). Fallisce loud senza scrivere nulla se il plugin data è malformato o le celle sono ambigue. Per provare offline: `-- --snapshot <path>` con uno snapshot salvato da `verify:library -- --snapshot`-style (o da un run precedente).
3. Se il giudizio del contratto cambia, edita a mano `src/recipes/judgments/<contratto>.json` e riestrai.
4. `pnpm --filter @penpot-ds/scripts validate:recipe -- <Nome>` → deve passare; se un token non è nel catalogo Stadio 1, correggi la **library** (o il contratto), non il validatore.

## File

- `penpot-reader.ts` — client MCP minimale, legge **solo** `penpot.library.local.tokens`.
- `component-reader.ts` — snapshot di library → fixture di UN componente: trova il VariantContainer per nome esatto, valida il plugin data `pagebuilder/contract` (fallisce loud su contratto duplicato, nome incoerente, contratto senza container, contratto ignoto, versione incoerente) e assembla la fixture da plugin data + `shape.tokens`. Errori espliciti anche su: board non mappata alle varianti, `variantError`, fixture malformata. Esporta `PLUGIN_DATA_PATTERN` (definizione unica, riusata dal validatore).
- `mcp-client.ts` — utilità condivisa MCP: `withTimeout` (15s), validazione esplicita dell'envelope `execute_code`.
- `recipe-schema.ts` — Zod: `FixtureSchema` (plugin data + albero layer con `shape.tokens`), `RecipeSchema` (mappa di parti a profondità 1, celle `proprietà → token`, criterio di stop sulle parti annidate), `JudgmentSchema` (domain/headless/a11y) e gli helper condivisi (`cellKeyOf`, `partBindings`).
- `token-vocabulary.ts` — vocabolario classi Tailwind v4 dal catalogo (prefissi utility per tipo; `borderWidth`/`opacity` senza namespace → nessuna classe) + whitelist strutturale esplicita e minimale. Consumato dall'emitter (Story 2.6).
- `validate-recipe.ts` — validatore puro: conformance meccanica di fixture e ricetta al contratto dichiarato dal plugin data, conformance ricetta↔fixture (celle = binding `shape.tokens`; judgment = file per contratto, validato con `JudgmentSchema`) + gate token Stadio 1 (literal rifiutato).
- `extract-component.ts` — entry CLI `extract:component` / `validate:recipe`; assembla la ricetta da fixture (celle) + file di giudizio per contratto + provenienza, valida PRIMA di scrivere e scrive la coppia atomicamente (zero artefatti sui fallimenti).
- `emitter/` — emitter shadcn e gate (Story 2.6): `render-component.ts` (funzione pura fixture+ricetta+binding+basi → 4 file `@generated`), `render-cli.ts` (CLI `render:component`), `binding-shadcn.ts` + `bindings/` (tabelle di binding), `bases/` (basi shadcn committate), `gates.ts` + `gates-cli.ts` (i 5 gate, CLI `gates:render`).
- `theme-generator.ts` — mapping puro e testabile `TokenCatalog → { css, ts }`. `varSuffix()`/`varName()`/`TYPE_NAMESPACE`/`fixtureHash()` esportati e riusati dal vocabolario token e dalle ricette (provenienza).
- `generate-theme.ts` — entry point `generate:theme`.
- `library/` — pipeline di allineamento library↔contratti (vedi sopra).
- `scripts/check-boundaries.mjs` + `tests/check-boundaries.test.ts` — gate di confine con prova rosso/verde (ammette solo `@app/contracts` fra gli `@app/*`).

## Cosa non toccare

`packages/tokens/src/tailwind-extras.css` non ha corrispondenza nel catalogo Penpot: la generazione non lo tocca mai, va editato a mano.
