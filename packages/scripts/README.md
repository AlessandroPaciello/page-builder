# @penpot-ds/scripts

Pipeline MCP che legge il catalogo token da Penpot e genera i file di [`@penpot-ds/tokens`](../tokens/README.md).

**Stage 1 (token) solo.** L'estrazione di componenti/varianti Penpot (Stage 2) è fuori scope — vedi Story 2.2/2.3.

## Script

| Comando | Cosa fa |
|---|---|
| `pnpm --filter @penpot-ds/scripts generate:theme` | Rigenera `tailwind-theme.css` + `tokens.generated.ts` **dalla fixture committata** (`src/__fixtures__/penpot-catalog.json`), offline. |
| `pnpm --filter @penpot-ds/scripts generate:theme -- --live` | Si connette al server MCP Penpot (`http://127.0.0.1:4401/mcp`), legge il catalogo reale, **aggiorna anche la fixture committata**, poi rigenera. |
| `pnpm --filter @penpot-ds/scripts test` | Test unitari (`theme-generator.test.ts`), offline e deterministici — nessuna rete. |

## Dove vive la fixture

`src/__fixtures__/penpot-catalog.json` — serializzazione del catalogo token Penpot (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`), solo i set `active`. Committata così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design (AC #3 di Story 2.1).

## File

- `penpot-reader.ts` — client MCP minimale, legge **solo** `penpot.library.local.tokens`.
- `theme-generator.ts` — mapping puro e testabile `TokenCatalog → { css, ts }`. Il nome di ogni variabile deriva dal **tipo** del token (namespace stabile: `color`, `text`, `font-weight`, `tracking`, `font`, `space`, `radius`, `border-width`, `opacity`, `shadow`), mai dal nome del set: un nuovo set Penpot produce automaticamente una nuova sezione senza modifiche a questo file. `varSuffix()`/`varName()` sono esportate per essere riusate in Story 2.2/2.3 da un futuro `token-resolver.ts` per le classi dei componenti.
- `generate-theme.ts` — entry point `generate:theme`.

## Cosa non toccare

`packages/tokens/src/tailwind-extras.css` non ha corrispondenza nel catalogo Penpot: la generazione non lo tocca mai, va editato a mano.
