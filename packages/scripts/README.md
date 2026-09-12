# @penpot-ds/scripts

Pipeline MCP che legge il catalogo token da Penpot e genera i file di [`@penpot-ds/tokens`](../tokens/README.md).

**Stage 1 (token) + Stage 2 per-componente (estrazione componenti/ricette).** Il renderer deterministico (fixture+ricetta → componente) è Story 2.3.

## Script

| Comando | Cosa fa |
|---|---|
| `pnpm --filter @penpot-ds/scripts generate:theme` | Rigenera `tailwind-theme.css` + `tokens.generated.ts` **dalla fixture committata** (`src/__fixtures__/penpot-catalog.json`), offline. |
| `pnpm --filter @penpot-ds/scripts generate:theme -- --live` | Si connette al server MCP Penpot (vedi [Connessione a Penpot](#connessione-a-penpot)), legge il catalogo reale, **aggiorna anche la fixture committata**, poi rigenera. |
| `pnpm --filter @penpot-ds/scripts extract:component -- <Nome>` | **Sempre live** (mai in CI né in build): estrae UN componente da Penpot e scrive `src/recipes/<nome>.fixture.json`. Il nome è quello del componente (`Badge`), non della singola variante (`Badge / Default`). |
| `pnpm --filter @penpot-ds/scripts validate:recipe -- <Nome>` | Offline: valida `src/recipes/<nome>.recipe.json` contro lo schema e contro il vocabolario token Stadio 1 (fail-loud sulle classi non risolvibili). Ha anche il check di provenienza (`penpotComponentId`, `fixtureHash`). Diventerà un gate CI in Story 2.3 — non è wired qui. |
| `pnpm --filter @penpot-ds/scripts bootstrap:library [-- --dry-run]` | **Live, una tantum** (mai in CI né in build): bootstrap della library Penpot sui contratti (Story 2.4). Su un file Penpot vuoto crea i set `palette` e `semantic`, i token semantici e un VariantContainer per contratto, poi verifica. Rifiuta con exit 1 e zero scritture se la library non è vuota. `--dry-run` stampa il piano senza scrivere. Guidato dalla skill `pds-bootstrap` (modulo BMad `pds`). |
| `pnpm --filter @penpot-ds/scripts add:library [-- --dry-run]` | **Live** (mai in CI né in build): modalità additiva sulla library esistente — crea solo i token mancanti e i container dei contratti senza container legato, **segnala** le differenze senza correggerle (exit 0 anche con differenze). Guidato dalla skill `pds-additive`. |
| `pnpm --filter @penpot-ds/scripts verify:library [-- --snapshot <path>]` | **Sola lettura**: legge lo snapshot della library e lancia `verifyLibrary` (10 regole: un container per contratto, assi/valori/celle/parti, binding token su ogni proprietà di stile, spec completa, `generateTheme()` verde, coppie di contrasto). L'exit code decide l'esito. Offline accetta `--snapshot <path>` (seam dei test). |
| `pnpm --filter @penpot-ds/scripts test` | Test unitari, offline e deterministici — nessuna rete (i transport MCP nei test sono mockati). |

## Connessione a Penpot

Solo i comandi live (`generate:theme --live`, `extract:component`, `bootstrap:library`, `add:library`, `verify:library`) parlano con Penpot; test, `validate:recipe` e `generate:theme` offline non leggono mai queste variabili. I comandi `*:library` sono **mai in CI né in build**: Penpot non è raggiungibile dal runner.

| Variabile | Obbligatoria | Default / effetto |
|---|---|---|
| `PENPOT_MCP_URL` | no | `http://localhost:9001/mcp/stream` (proxy MCP del frontend Penpot, flag `enable-mcp`) |
| `PENPOT_MCP_TOKEN` | no (ma il server multi-user lo richiede per ogni tool) | aggiunto come query `userToken`; mascherato (`userToken=***`) in ogni messaggio |

Setup di Penpot, del token e di direnv: [README alla root](../../README.md#penpot-locale-e-server-mcp).

Se manca il token, se è stato rigenerato o se il plugin non è connesso, i comandi live falliscono con un errore che nomina `PENPOT_MCP_TOKEN`.

## Dove vive la fixture del catalogo token

`src/__fixtures__/penpot-catalog.json` — serializzazione del catalogo token Penpot (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`), solo i set `active`. Committata così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design (AC #3 di Story 2.1). È anche il vocabolario contro cui `validate:recipe` valida le classi e da cui `extract:component` deriva i binding (provenienza deterministica).

**Dal Task 8 della Story 2.4 la fixture è la NUOVA library** (`palette` + `semantic`, token semantici alla shadcn: `--color-primary`, `--shadow-ring`, …), bootstrap della Story 2.4. Il vecchio catalogo `mis` è conservato in `src/__fixtures__/legacy-mis-catalog.json` SOLO per i test che dipendono dai nomi `mis` (`theme-generator.test.ts`, `validate-recipe.test.ts`, `component-reader.test.ts`), finché la Story 2.5 non sostituisce ricetta e fixture Badge. Conseguenza: `validate:recipe -- Badge` da CLI ora fallisce (drift del `fixtureHash` contro il nuovo catalogo) — è atteso: la ricetta Badge è l'unica eccezione tollerata e la sostituisce la 2.5; la CI non la lancia. Un test (`tests/no-legacy-consumers.test.ts`) impedisce che nomi `mis-*` ricompaiano in `packages/ui/src` e `apps/web/src` (`packages/tokens` è l'eccezione ammessa).

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

Nota binding (aggiornata dal Task 1 della Story 2.4): `shape.applyToken` via MCP **persiste** dopo il reload del file (spike verificato su "Page Builder DS"): `shape.tokens` è la via primaria di lettura per l'estrazione (Story 2.5). Il vecchio hex-match di `component-reader.ts` resta come fallback per i componenti della vecchia library `mis`. Limitazione API scoperta nella stessa story: `applyToken` NON supporta i token `fontFamilies` su Penpot 2.17.2 ("should be a set of strings" su ogni variante) — il font family resta una scelta del designer e non è soggetto a binding.

## Dove vivono fixture e ricette dei componenti

`src/recipes/` — dati committati, non codice:

- **`<nome>.fixture.json`** — fatti letti da Penpot **senza sapere cosa sia React**: assi, celle (`variantProps`, anche `null` per la Default), fatti di stile (fills/strokes/borderRadius/testi), CSS raw generato da `penpot.generateStyle`, `tokenBindings` (proprietà → nome token Stadio 1). Scritta SOLO da `extract:component`.
- **`<nome>.recipe.json`** — giudizio, scritto **a mano**: dominio, libreria headless (`null` se presentazionale), blocco `cva` (con SOLO classi risolvibili al vocabolario Stadio 1 o strutturali whitelisted), requisiti a11y, provenienza (`penpotComponentId` + `fixtureHash`, stampati da `extract:component`).

**Confine fixture/ricetta (regola assoluta):** nella fixture niente decisioni (dominio, classi CVA, ARIA); nella ricetta niente fatti grezzi (hex, CSS raw, shape). Non spostare classi CVA nella fixture né shape/CSS raw nella ricetta.

## Estrarre un nuovo componente

1. Verifica che in Penpot il componente sia un `VariantContainer` (es. `Input / Legacy`, pagina Docs) e che **ogni** hex/valore letterale abbia un token esatto nella library (valori fuori token = stop esplicito dell'estrazione: applica il token in Penpot e riprova).
2. `pnpm --filter @penpot-ds/scripts extract:component -- <Nome>` → scrive e committa `src/recipes/<nome>.fixture.json`.
3. Scrivi a mano `src/recipes/<nome>.recipe.json` (copia la provenienza stampata dal passo 2).
4. `pnpm --filter @penpot-ds/scripts validate:recipe -- <Nome>` → deve passare; se una classe non matcha il vocabolario, correggi la **ricetta**, non il validatore.

Nota: i componenti della vecchia library `mis` NON hanno binding token nativi — il binding è derivato per **corrispondenza esatta del valore** (hex/radius) contro il catalogo Stadio 1. Dalla Story 2.4 i componenti della nuova library hanno binding esplicito (`shape.applyToken` persiste, vedi sopra): `shape.tokens` è la via primaria, l'hex-match resta il fallback per `mis`.

## File

- `penpot-reader.ts` — client MCP minimale, legge **solo** `penpot.library.local.tokens`.
- `component-reader.ts` — client MCP per UN componente: trova il `VariantContainer` per nome, mappa le celle (`variants.variantComponents()`) sulle board figlie via `componentInstance.componentId`, cattura fatti di stile + CSS raw, deriva i token binding per valore esatto. Errori espliciti su: componente non trovato, shape non-variant, celle non mappabili, valori fuori token (stop-signal), envelope MCP malformato, timeout (15s).
- `mcp-client.ts` — utilità condivisa MCP: `withTimeout` (15s), validazione esplicita dell'envelope `execute_code`.
- `recipe-schema.ts` — Zod: `FixtureSchema` + `RecipeSchema` (contratto degli artefatti committati, AD-11).
- `token-vocabulary.ts` — vocabolario classi Tailwind v4 dal catalogo (prefissi utility per tipo; `borderWidth`/`opacity` senza namespace → nessuna classe) + whitelist strutturale esplicita e minimale.
- `validate-recipe.ts` — validatore puro della ricetta (schema + classi cva contro il vocabolario).
- `extract-component.ts` — entry CLI `extract:component` / `validate:recipe`.
- `theme-generator.ts` — mapping puro e testabile `TokenCatalog → { css, ts }`. `varSuffix()`/`varName()`/`TYPE_NAMESPACE`/`fixtureHash()` esportati e riusati dal vocabolario token e dalle ricette (provenienza).
- `generate-theme.ts` — entry point `generate:theme`.
- `library/` — pipeline di allineamento library↔contratti (vedi sopra).
- `scripts/check-boundaries.mjs` + `tests/check-boundaries.test.ts` — gate di confine con prova rosso/verde (ammette solo `@app/contracts` fra gli `@app/*`).

## Cosa non toccare

`packages/tokens/src/tailwind-extras.css` non ha corrispondenza nel catalogo Penpot: la generazione non lo tocca mai, va editato a mano.
