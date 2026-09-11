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
| `pnpm --filter @penpot-ds/scripts test` | Test unitari, offline e deterministici — nessuna rete (i transport MCP nei test sono mockati). |

## Connessione a Penpot

Solo i comandi live (`generate:theme -- --live`, `extract:component`) parlano con Penpot; test, `validate:recipe` e `generate:theme` offline non leggono mai queste variabili.

| Variabile | Obbligatoria | Default / effetto |
|---|---|---|
| `PENPOT_MCP_URL` | no | `http://localhost:9001/mcp/stream` (proxy MCP del frontend Penpot, flag `enable-mcp`) |
| `PENPOT_MCP_TOKEN` | no (ma il server multi-user lo richiede per ogni tool) | aggiunto come query `userToken`; mascherato (`userToken=***`) in ogni messaggio |

1. In Penpot: *Settings → Integrations → MCP server*, attiva e copia il token.
2. Esportalo nella shell o nell'ambiente dell'IDE (mai in un file tracciato): `export PENPOT_MCP_TOKEN="<token>"`. La stessa variabile è usata da `.mcp.json` (Claude Code) e `opencode.json` (OpenCode) alla root.
3. Nel file Penpot da leggere: *File → Plugins → MCP Server → Connect*.

Se manca il token, se è stato rigenerato o se il plugin non è connesso, i comandi live falliscono con un errore che nomina `PENPOT_MCP_TOKEN`.

## Dove vive la fixture del catalogo token

`src/__fixtures__/penpot-catalog.json` — serializzazione del catalogo token Penpot (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`), solo i set `active`. Committata così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design (AC #3 di Story 2.1). È anche il vocabolario contro cui `validate:recipe` valida le classi e da cui `extract:component` deriva i binding (provenienza deterministica).

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

Nota: i componenti Penpot NON hanno binding token nativi (`shape.tokens` quasi sempre vuoto) — il binding è derivato per **corrispondenza esatta del valore** (hex/radius) contro il catalogo Stadio 1. Applicare i token in Penpot (`shape.applyToken`) renderebbe il binding esplicito, ma finché non accade ogni estrazione rifà lo stesso lookup.

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

## Cosa non toccare

`packages/tokens/src/tailwind-extras.css` non ha corrispondenza nel catalogo Penpot: la generazione non lo tocca mai, va editato a mano.
