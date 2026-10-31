# Server MCP `pds` (Story 2.24)

L'unico guscio sopra il nucleo puro (`src/core`). Gira su stdio, registrato in `.mcp.json` alla root del repo:

```json
"pds": { "type": "stdio", "command": "pnpm", "args": ["--silent", "--filter", "@penpot-ds/scripts", "pds"] }
```

Il processo MCP eredita l'ambiente in cui parte Claude Code: lì servono **Node 22** (`.nvmrc` = 22.23.1, `engines` `>=22.13.0 <23` nel `package.json` alla root) e `PENPOT_MCP_TOKEN` (direnv, vedi il [README alla root](../../../../README.md#penpot-locale-e-server-mcp)). Se Claude Code parte da una shell con un altro Node o senza il token, il server parte con quelli.

`--silent` serve: lo stdout è il canale del protocollo e il banner di `pnpm` lo sporcherebbe. Il server non stampa niente su stdout; gli errori di avvio vanno su stderr. Penpot si raggiunge con le stesse variabili di `theme --live` (`PENPOT_MCP_URL`, `PENPOT_MCP_TOKEN`, vedi [README del package](../../README.md#connessione-a-penpot)).

**Dopo una modifica del nucleo o del server, riavvialo:** nella sessione di Claude Code `/mcp` → `pds` → reconnect. Il processo carica il codice una volta sola.

## Strumenti

| Strumento | Ingresso | Uscita | Scrive |
|---|---|---|---|
| `describe_component` | `{ name }` | la `Lettura` | no |
| `verify_component` | `{ name }` | `{ findings }` (`existingTsx` letto dal disco) | no |
| `build_order` | `{ names[] }` | `{ order, findings }` | no |
| `generate_component` | `{ name }` | `{ changes, findings, suggestions, written }` | sì, solo in `packages/ui/src/domains/<name>/` |
| `tokens_from_css` | `{ css }` | `{ sets, themes, warnings }` | no |
| `extract_theme` | `{ fonts? }` | `{ written, packages }` | sì, solo in `packages/tokens/src/` |

`name` è il nome del contratto (`badge`, `badge@1`) o del layer in Penpot, come in `readComponent`. Ingressi e uscite sono schemi zod (`tools.ts`); l'uscita arriva sia come `structuredContent` sia come testo JSON.

## Regole

- **Iniezione.** `createPdsServer({ penpot, root, contracts? })` riceve l'adattatore `{ readComponent, readTokenCatalog }` e non importa da `src/penpot`. Solo `main.ts` lega l'adattatore vero e la root del repo (`PATHS.repoRoot`); la regola `server` di `check-boundaries.mjs` lo impone.
- **Nessuno stato.** Ogni chiamata rilegge da Penpot il catalogo token (tutti i set più i temi) e i componenti. Dal catalogo: `tokenTypeOf` (nome → tipo) e `scale` (`scaleFromThemeCss(generateTheme(baseCatalog(catalog)).css)`) — solo la base, perché le varianti ripetono i nomi dei token.
- **Mai su Penpot.** L'adattatore espone solo letture. Gli esiti del nucleo tornano così come sono: il server non decide niente.
- **`generated`** = le cartelle di `packages/ui/src/domains/` con un `<Comp>.styles.ts` che ha il marker `@generated` (`generated-files.ts`).
- **Scrittura** (`write-changes.ts`). Si applicano solo i `Change` del nucleo. Prima si controllano tutti, poi si scrive: un path assoluto, con `..`/`.`/segmenti vuoti, fuori da `packages/ui/src/domains/<name>/` o che esce attraverso un symlink è un errore e non si scrive nessun file; `crea` su un file che esiste è un errore; `aggiorna` ed `elimina` toccano solo un file con marker. Con un blocco o una domanda aperta non si scrive niente (`written: []`). Il `<Comp>.tsx` dello sviluppatore non si tocca mai.
- **Scrittura del tema** (`write-theme.ts`, Story 2.26). `extract_theme` scrive in `packages/tokens/src/` con le stesse regole (path confinato, niente symlink, sovrascrive solo file con il marker).
- **Errori.** Ingresso non valido (schema zod), errore dell'adattatore, del nucleo o della scrittura → risultato MCP `isError` con il messaggio. Il processo non cade.

## Livello 3: file `@generated` (`generated-files.ts`)

`checkGeneratedFiles(root)` scorre i `.ts`/`.tsx`/`.css` di `packages/` e `apps/` (esclusi `node_modules`, `dist`, `.next`, `storybook-static`; i symlink non si seguono). Per ogni file con il marker di pds: hash che non torna → blocco che nomina il file; `GENERATOR_VERSION` diversa con l'hash giusto → avviso. Il comando di rigenerazione citato dipende dal file: `extract_theme` per i file sotto `packages/tokens/src/` (il tema), `generate_component` per gli altri. Gira in CI come test di vitest sul repo vero (`tests/server/generated-files.test.ts`, nessun blocco ammesso), insieme al suo rosso/verde su una cartella temporanea.

## Test (livello 2)

`tests/server/server.test.ts`: il server in memoria (`InMemoryTransport`) con un adattatore finto costruito dalle `Lettura` di `tests/fixtures/components.ts` e un catalogo token scritto a mano. Ogni strumento ha un test verde e uno d'ingresso rifiutato; `generate_component` scrive in una root temporanea. Il seam `generate` (un nucleo finto) prova i path rifiutati. `tests/server/write-changes.test.ts` prova i limiti dei path uno per uno.

## Prova a mano

Handshake su stdio (dalla root del repo, Node 22):

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | pnpm --silent --filter @penpot-ds/scripts pds
```

Lo stdout contiene solo le due risposte JSON-RPC, con i sei strumenti. Con Penpot collegato, `describe_component {"name":"badge"}` restituisce la `Lettura` di Badge.
