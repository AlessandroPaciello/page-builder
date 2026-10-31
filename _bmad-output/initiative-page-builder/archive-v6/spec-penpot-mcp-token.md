---
title: 'Token MCP Penpot per Claude Code, OpenCode e script'
type: 'chore'
created: '2026-09-11'
status: 'done'
baseline_commit: '15d2efbc7692fc0aa7c71d6bf7467f7e54ae356c'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-penpot-dev-mcp/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-penpot-dev-mcp/mcp-token.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Penpot 2.17.2 non genera il token MCP personale perché manca `enable-mcp`, e `penpot-mcp` gira in single-user (override del commit #20). Claude Code e OpenCode non hanno una configurazione condivisa. I reader di `packages/scripts` hardcodano `127.0.0.1:4401/mcp` e ignorano `PENPOT_MCP_URL`.

**Approach:** abilitare `enable-mcp` e la modalità multi-user nel compose. Committare `.mcp.json` e `opencode.json` che referenziano `PENPOT_MCP_TOKEN` solo come variabile. Centralizzare in `mcp-client.ts` la risoluzione dell'endpoint da env (URL con default `http://localhost:9001/mcp/stream` più `userToken` facoltativo), con URL mascherato in ogni messaggio.

## Boundaries & Constraints

**Always:** `PENPOT_MCP_TOKEN` è l'unica sorgente del token per tutti e tre i consumatori. Il valore del token non compare mai in file tracciati, log, messaggi d'errore o snapshot di test: ogni URL stampato ha `userToken` mascherato. `name: penpot` nel compose resta. Test offline, senza rete. Il percorso `generate:theme` senza `--live` non legge mai l'env MCP.

**Ask First:** chiudere o rimuovere le porte host 4401/4402. HALT anche se la verifica live smentisce l'assunzione che serva la multi-user (per esempio token ignorato, o MCP inutilizzabile senza riconnettere il plugin).

**Never:** vault o secret manager, token in CI, esposizione oltre `localhost`, pin di `PENPOT_VERSION`, modifiche al contenuto della library Penpot, `.env` letto automaticamente dagli script (niente dotenv).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | nessuna env | URL `http://localhost:9001/mcp/stream`, senza `userToken` | N/A |
| Token | `PENPOT_MCP_TOKEN=abc` | URL con `?userToken=abc`; nei messaggi `userToken=***` | N/A |
| URL custom | `PENPOT_MCP_URL=http://h:1/mcp?x=1` + token | `x=1` preservato, `userToken` aggiunto o sovrascritto | N/A |
| Env vuote | `PENPOT_MCP_URL=""`, `PENPOT_MCP_TOKEN="  "` | trattate come assenti | N/A |
| URL invalido | `PENPOT_MCP_URL=not-a-url` | errore che nomina `PENPOT_MCP_URL` | throw prima della rete |
| Rifiuto auth | server risponde 401/403, token assente | errore che dice di impostare `PENPOT_MCP_TOKEN` | throw esplicito |
| Rifiuto auth con token | 401/403, token presente | errore che dice token non valido o rigenerato, URL mascherato | throw esplicito |

</frozen-after-approval>

## Code Map

- `docker/penpot/docker-compose.yml` -- anchor `x-flags` (frontend e backend), servizio `penpot-mcp` con l'override `command`
- `packages/scripts/src/mcp-client.ts` -- helper MCP condivisi (timeout, envelope): qui va la risoluzione dell'endpoint
- `packages/scripts/src/penpot-reader.ts` -- reader token: `DEFAULT_PENPOT_MCP_URL` hardcodato e `withTimeout` duplicato
- `packages/scripts/src/component-reader.ts` -- reader componenti: stesso hardcode, opzione `mcpUrl`
- `packages/scripts/src/mcp-client.test.ts` -- test esistenti di `withTimeout`
- `packages/scripts/README.md` -- documenta ancora `127.0.0.1:4401/mcp`
- `_bmad-output/specs/spec-penpot-dev-mcp/penpot-mcp-setup.md` -- sezione Verifica e commento porte ancora su 4401

## Tasks & Acceptance

**Execution:**
- [x] `docker/penpot/docker-compose.yml` -- aggiungere `enable-mcp` a `PENPOT_FLAGS`; rimuovere `command` e il suo commento da `penpot-mcp`, sostituendoli con una nota su multi-user e token. Porte invariate (Ask First) -- CAP-3
- [x] `packages/scripts/src/mcp-client.ts` -- esportare `resolveMcpEndpoint(env = process.env)` → `{ url: URL; displayUrl: string; hasToken: boolean }`, `maskMcpUrl(url)` e `connectMcpClient(endpoint, timeoutMs?)`. Quest'ultima connette via Streamable HTTP e traduce 401/403 negli errori della matrice -- unico punto di verità CAP-2
- [x] `packages/scripts/src/penpot-reader.ts` -- usare `resolveMcpEndpoint`/`connectMcpClient` e il `withTimeout` condiviso; eliminare hardcode e duplicato; parametro opzionale `endpoint` per override -- chiude il drift
- [x] `packages/scripts/src/component-reader.ts` -- `mcpUrl` sostituito da `endpoint?: McpEndpoint` (default `resolveMcpEndpoint()`); messaggi con `displayUrl` -- idem
- [x] `packages/scripts/src/mcp-client.test.ts` -- test di ogni riga della matrice; per i casi auth, stub di `fetch` o transport che risponde 401, e asserzione che il token non compaia mai nel messaggio
- [x] `.mcp.json` (root) -- `penpot` di tipo `http`, url `http://localhost:9001/mcp/stream?userToken=${PENPOT_MCP_TOKEN}` -- CAP-4
- [x] `opencode.json` (root) -- `$schema`, `mcp.penpot` di tipo `remote`, `enabled: true`, url con `{env:PENPOT_MCP_TOKEN}` -- CAP-4
- [x] `packages/scripts/README.md` -- sezione "Connessione a Penpot": tabella delle variabili, come generare il token (*Settings → Integrations*) ed export nella shell; rimuovere i riferimenti a `4401`
- [x] `_bmad-output/specs/spec-penpot-dev-mcp/penpot-mcp-setup.md` -- allineare Verifica e snippet del servizio al compose nuovo e a `mcp-token.md`

**Acceptance Criteria:**
- Given lo stack riavviato con `docker compose up -d`, when si apre *Settings → Integrations*, then compare la sezione "MCP server" con un token copiabile, e il log di `penpot-mcp` riporta `Multi-user mode: true`.
- Given `PENPOT_MCP_TOKEN` esportato, when `curl -i "http://localhost:9001/mcp/stream?userToken=$PENPOT_MCP_TOKEN"`, then risponde l'MCP (non la SPA né un 404).
- Given `PENPOT_MCP_TOKEN` esportato e il plugin connesso nel file, when `generate:theme -- --live`, then il catalogo reale viene letto senza altre variabili.
- Given nessuna variabile, when `pnpm --filter @penpot-ds/scripts test`, `check-types` e `generate:theme` (offline), then passano tutti.
- Given il repo dopo la modifica, when `git grep -n "$PENPOT_MCP_TOKEN"` con il token reale, then nessun risultato.

## Design Notes

Il token va solo nella query `userToken`, come nello snippet che Penpot mostra (niente header). Maschera: `url.searchParams.has("userToken")` → valore sostituito con `***` in una copia dell'URL. Il 401/403 arriva dall'SDK come errore HTTP del transport: si riconosce dal codice o dallo status, mai dal testo intero, che potrebbe contenere l'URL.

## Verification

**Commands:**
- `pnpm --filter @penpot-ds/scripts test` -- expected: verde, nessuna rete
- `pnpm --filter @penpot-ds/scripts check-types && pnpm --filter @penpot-ds/scripts lint` -- expected: verde
- `docker compose -f docker/penpot/docker-compose.yml config -q` -- expected: nessun errore
- `docker logs penpot-penpot-mcp-1 2>&1 | grep "Multi-user mode"` -- expected: `true` dopo il riavvio

**Manual checks (if no CLI):**
- Alessandro: generare il token in Penpot, esportarlo, poi verificare `/mcp` in Claude Code e `opencode mcp list` con `penpot` connesso; rispondere alle due Open Questions della SPEC.

## Suggested Review Order

**Risoluzione endpoint e token (CAP-2)**

- Punto d'ingresso: una sola funzione legge `PENPOT_MCP_URL` e `PENPOT_MCP_TOKEN` per tutti i reader.
  [`mcp-client.ts:135`](../../packages/scripts/src/mcp-client.ts#L135)

- Default allineato al proxy `:9001/mcp/stream` usato anche da Claude Code e OpenCode.
  [`mcp-client.ts:105`](../../packages/scripts/src/mcp-client.ts#L105)

**Rifiuti di autenticazione e mascheramento del token**

- Connect, call e close in un solo punto; traduce i rifiuti in errori che nominano la variabile.
  [`mcp-client.ts:224`](../../packages/scripts/src/mcp-client.ts#L224)

- Penpot rifiuta via testo del tool, non via HTTP 401: fatto verificato dal vivo.
  [`mcp-client.ts:170`](../../packages/scripts/src/mcp-client.ts#L170)

- Redazione applicata prima di `withTimeout`, così anche il log del rifiuto tardivo è pulito.
  [`mcp-client.ts:233`](../../packages/scripts/src/mcp-client.ts#L233)

- Rete di sicurezza: token in chiaro e codificato, anche nello stack e nei throwable non-Error.
  [`mcp-client.ts:200`](../../packages/scripts/src/mcp-client.ts#L200)

**Reader migrati**

- Endpoint risolto alla chiamata: il percorso offline non legge mai l'ambiente MCP.
  [`penpot-reader.ts:72`](../../packages/scripts/src/penpot-reader.ts#L72)

- Il seam `callTool` dei test resta; il percorso reale delega all'helper condiviso.
  [`component-reader.ts:371`](../../packages/scripts/src/component-reader.ts#L371)

**Stack Penpot (CAP-3)**

- `enable-mcp` accende la UI del token e il proxy nginx `/mcp/stream`.
  [`docker-compose.yml:33`](../../docker/penpot/docker-compose.yml#L33)

- Override `command` rimosso: il container torna al default `--multi-user`.
  [`docker-compose.yml:267`](../../docker/penpot/docker-compose.yml#L267)

**Periferiche: config client, test, documentazione**

- Claude Code: token solo come variabile, con default vuoto per non rompere la config.
  [`.mcp.json:5`](../../.mcp.json#L5)

- OpenCode: stessa variabile, sintassi `{env:...}`.
  [`opencode.json:7`](../../opencode.json#L7)

- `.envrc` ignorato: la guida suggerisce direnv per esportare il token.
  [`.gitignore:29`](../../.gitignore#L29)

- Test della matrice I/O e dei casi emersi dalla review, con client MCP finto.
  [`mcp-client.test.ts:77`](../../packages/scripts/src/mcp-client.test.ts#L77)

- Guida operativa: variabili, generazione del token, connessione del plugin.
  [`README.md:17`](../../packages/scripts/README.md#L17)
