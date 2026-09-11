# Token MCP Penpot

Companion di [SPEC.md](./SPEC.md) per CAP-2, CAP-3 e CAP-4. Contiene i fatti verificati sull'istanza e la configurazione di riferimento per ogni consumatore. Supera la riga "Auth: nessuna" della tabella in [penpot-mcp-setup.md](./penpot-mcp-setup.md).

## Fatti verificati (2026-09-11, Penpot 2.17.2)

| Cosa | Stato |
|---|---|
| UI token | *Settings → Integrations → MCP server*: toggle, chiave, *regenerate* e snippet `{"mcpServers":{"penpot":{"url":"<mcp_server_url>?userToken=<token>"}}}`. Visibile solo con `enable-mcp`. |
| Cache del browser | Il frontend serve `js/config.js` (dove vivono i flag) con `Cache-Control: max-age=604800` e un `?version=` che cambia solo con la versione di Penpot. Dopo aver cambiato `PENPOT_FLAGS` serve un hard reload (Ctrl+Shift+R), altrimenti la voce *Integrations* non compare. |
| Proxy frontend | Con `enable-mcp` l'entrypoint del frontend genera un proxy nginx su `:9001`: `/mcp/stream` → `penpot-mcp:4401/mcp`, `/mcp/sse` → `/sse`, `/mcp/ws` → `penpot-mcp:4402`. Si può sovrascrivere con `PENPOT_MCP_URI` e `PENPOT_MCP_URI_WS`. |
| Flag | Prima del cambio `PENPOT_FLAGS` non conteneva `enable-mcp`, quindi `:9001/mcp/stream` non raggiungeva l'MCP. Ora il flag è attivo. |
| Container MCP | Prima del cambio il log diceva `Multi-user mode: false`, per l'override della PR #20; ora dice `true`. L'unica opzione CLI è `--multi-user`, il resto si configura con le variabili `PENPOT_MCP_*`. |
| Multi-user (verificato dopo il cambio) | `initialize` riesce anche senza token, sia su `:9001/mcp/stream` sia su `:4401/mcp`. Il rifiuto arriva nel testo del tool, non come HTTP 401: `No userToken found in session context` se il token manca, `No Penpot instance connected for user token` se il token è sbagliato o il plugin non è connesso con quell'utente. Quindi il plugin va ancora connesso, e le porte dirette non danno accesso ai tool senza token. |
| Rigenerazione | Verificato: rigenerare il token invalida il precedente (CAP-3) e chiude la connessione del plugin. Finché il plugin non si riconnette, anche la chiave nuova riceve `No Penpot instance connected for user token`. |
| Script | Prima del cambio i reader hardcodavano `http://127.0.0.1:4401/mcp`. Ora risolvono endpoint e token da `PENPOT_MCP_URL`/`PENPOT_MCP_TOKEN` in `mcp-client.ts`. |

## Configurazione di riferimento

**Penpot** (`docker/penpot/docker-compose.yml`)
- Aggiungere `enable-mcp` all'anchor `x-flags` (`PENPOT_FLAGS`), che è condiviso da frontend e backend.
- Togliere l'override `command` da `penpot-mcp`, così il container torna al default `--multi-user` (vedi Assumptions nella SPEC).

**Variabile d'ambiente** (unica sorgente, mai in file tracciati)
```bash
export PENPOT_MCP_TOKEN="<token copiato da Penpot>"   # ~/.bashrc, oppure direnv .envrc (ignorato da git)
```
Metodo di riferimento: `PENPOT_MCP_TOKEN=<token>` nel `.env` (ignorato), caricato da direnv con un `.envrc` che contiene `dotenv`. VS Code va aperto con `code .` da una shell dentro il repo. Procedura completa nel [README alla root](../../../README.md#penpot-locale-e-server-mcp).

**Claude Code**: `.mcp.json` alla root, committato. Claude Code espande `${VAR:-default}`.
```json
{ "mcpServers": { "penpot": { "type": "http",
  "url": "http://localhost:9001/mcp/stream?userToken=${PENPOT_MCP_TOKEN:-}" } } }
```

**OpenCode**: `opencode.json` alla root, committato. OpenCode espande `{env:VAR}`.
```json
{ "$schema": "https://opencode.ai/config.json",
  "mcp": { "penpot": { "type": "remote", "enabled": true,
    "url": "http://localhost:9001/mcp/stream?userToken={env:PENPOT_MCP_TOKEN}" } } }
```

**`packages/scripts`**
| Variabile | Obbligatoria | Default / effetto |
|---|---|---|
| `PENPOT_MCP_URL` | no | `http://localhost:9001/mcp/stream` |
| `PENPOT_MCP_TOKEN` | no | se presente, viene aggiunto come query `userToken`. Se assente, nessun parametro; un eventuale rifiuto del server produce un errore che nomina la variabile. |

Il token non deve mai comparire nei log degli script, nei messaggi d'errore o negli snapshot di test: si maschera l'URL prima di stamparlo. Limite noto: viaggiando in query, il token compare negli access log locali di nginx e dell'MCP dentro Docker.

Se `PENPOT_MCP_TOKEN` non è impostata, Claude Code e OpenCode tentano comunque la connessione con `userToken` vuoto e mostrano `penpot` in errore. Chi non usa Penpot può disattivarlo (`"enabled": false` in una config OpenCode personale, `/mcp` in Claude Code).

## Verifica

1. `test -n "$PENPOT_MCP_TOKEN" && ! git grep -nF "$PENPOT_MCP_TOKEN"` termina con successo.
2. `curl -i "http://localhost:9001/mcp/stream?userToken=$PENPOT_MCP_TOKEN"` risponde dall'MCP, non con la SPA o un 404.
3. `/mcp` in Claude Code e `opencode mcp list` mostrano `penpot` connesso.
4. I reader in `packages/scripts` leggono il catalogo con le sole variabili impostate. Senza variabili, i test offline passano.
