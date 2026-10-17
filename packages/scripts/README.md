# @penpot-ds/scripts

Legge il catalogo token da Penpot (o dalla fixture committata) e genera i file di [`@penpot-ds/tokens`](../tokens/README.md). Ospita anche il registro delle proprietà di stile (`src/shared/style-properties.ts`).

La pipeline v1 (Story 2.1–2.11) e la v2 (Story 2.12–2.16) sono state rimosse (Story 2.16 e 2.18): niente più comandi `library`/`propose`/`extract`/`render`/`gates`, contratti di estrazione né istantanee. La pipeline v3 (nucleo puro e server MCP `pds`) arriva con le Story 2.19+.

## Script

| Comando | Cosa fa |
|---|---|
| `pnpm --filter @penpot-ds/scripts theme` | Rigenera `tailwind-theme.css` + `tokens.generated.ts` **dalla fixture committata** (`data/penpot-catalog.json`), offline. |
| `pnpm --filter @penpot-ds/scripts theme -- --live` | Si connette al server MCP Penpot (vedi [Connessione a Penpot](#connessione-a-penpot)), legge il catalogo reale, **aggiorna anche la fixture committata** (solo dopo che la generazione è riuscita), poi rigenera. Mai in CI né in build. |
| `pnpm --filter @penpot-ds/scripts test` | Test unitari, offline e deterministici: nessuna rete (la lettura live nei test è un seam). |

Uscite di `theme` (entrypoint `src/theme/main.ts`): `0` tema rigenerato · `1` input (argomento ignoto, fixture illeggibile, catalogo che non genera) · `2` penpot (lettura live fallita).

## Connessione a Penpot

Solo `theme --live` parla con Penpot; test e `theme` offline non leggono mai queste variabili.

| Variabile | Obbligatoria | Default / effetto |
|---|---|---|
| `PENPOT_MCP_URL` | no | `http://localhost:9001/mcp/stream` (proxy MCP del frontend Penpot, flag `enable-mcp`) |
| `PENPOT_MCP_TOKEN` | no (ma il server multi-user lo richiede per ogni tool) | aggiunto come query `userToken`; mascherato (`userToken=***`) in ogni messaggio |

Setup di Penpot, del token e di direnv: [README alla root](../../README.md#penpot-locale-e-server-mcp).

Se manca il token, se è stato rigenerato o se il plugin non è connesso, `theme --live` fallisce con exit 2 e un errore che nomina `PENPOT_MCP_TOKEN`.

## Dove vive la fixture del catalogo token

`data/penpot-catalog.json` — serializzazione del catalogo token Penpot (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`), solo i set `active`. Committata così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design.

È l'unica fixture: la vecchia library `mis` è stata cancellata. Un test (`tests/no-legacy-consumers.test.ts`) impedisce che nomi `mis-*` ricompaiano in `packages/ui/src` e `apps/web/src` (`packages/tokens` è l'eccezione ammessa).

## File

- `data/penpot-catalog.json` — il catalogo token committato.
- `src/theme/` — `main.ts` (entrypoint: argomenti e codice d'uscita), `theme-command.ts` (lettura e scrittura atomica del tema), `penpot-reader.ts` (client MCP minimale che legge solo `penpot.library.local.tokens`).
- `src/shared/` — `paths.ts` (l'**unico** modulo che calcola i path: `tests/paths.test.ts` fallisce nominando la chiave che punta a un file inesistente), `mcp-client.ts` (utilità MCP), `theme-generator.ts` (mapping puro `TokenCatalog → { css, ts }`), `style-properties.ts` (registro delle proprietà), `naming.ts`.
- `scripts/check-boundaries.mjs` + `tests/check-boundaries.test.ts` — gate di confine con prova rosso/verde.
- `tests/pipeline-boundary.test.ts` — le directory v1/v2 non esistono e `process.exit*` compare solo in `src/theme/main.ts`.

## Cosa non toccare

`packages/tokens/src/tailwind-extras.css` di norma non ha corrispondenza nel catalogo Penpot (unica eccezione: `--color-tracer-primary`, tracciante Story 1.4): la generazione non lo tocca mai, va editato a mano.
