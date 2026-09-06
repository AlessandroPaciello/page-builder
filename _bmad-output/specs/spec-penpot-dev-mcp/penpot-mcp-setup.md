# Setup MCP sull'istanza Penpot esistente

Companion di [SPEC.md](./SPEC.md). Istruzioni operative concrete per CAP-1/CAP-2: come abilitare il server MCP ufficiale sull'istanza Penpot già in esecuzione, e il contratto che `packages/scripts` (Story 2.1+, nel repo `page-builder`) può assumere come stabile.

## Dove si applica

**Non nel repo `page-builder`.** Lo stack Penpot gira da una directory separata:

```
/home/alessandro/Scrivania/projects/penpot/docker-compose.yaml
```

(rilevato via `docker inspect` sul container `penpot-penpot-frontend-1` in esecuzione — progetto compose `penpot`, servizi `penpot-frontend`/`penpot-backend`/`penpot-exporter`/`penpot-postgres`/`penpot-valkey`/`penpot-mailcatch`, porta 9001, nessun servizio `penpot-mcp`).

## Modifica da applicare

Aggiungere questo servizio al file sopra (stesso `networks: [penpot]` degli altri servizi):

```yaml
services:
  penpot-mcp:
    image: "penpotapp/mcp:${PENPOT_VERSION:-latest}"
    restart: always
    ports:
      - "4401:4401"   # Streamable HTTP MCP — questo è ciò che packages/scripts consuma
      - "4402:4402"   # WebSocket task bridge (facoltativo, non usato da Story 2.1)
    networks:
      - penpot
```

Facoltativo ma consigliato: aggiungere `penpot-mcp` alla lista `depends_on` di `penpot-frontend`, come fa il compose ufficiale Penpot, così l'ordine di avvio è coerente.

Applicare con:

```bash
cd /home/alessandro/Scrivania/projects/penpot
docker compose up -d penpot-mcp
# oppure, per riapplicare tutto il file dopo la modifica:
docker compose up -d
```

Non serve fermare o ricreare gli altri servizi: `docker compose up -d` aggiunge solo il servizio nuovo.

## Abilitare il plugin dentro Penpot

Nel file Penpot che si vuole leggere via MCP: **File → Plugins → MCP Server → Connect**. La connessione usa la sessione del browser attivo — va rifatta se si riapre Penpot in una nuova tab/sessione.

## Contratto stabile per `packages/scripts`

| Cosa | Valore di default | Override |
|---|---|---|
| URL MCP (Streamable HTTP) | `http://localhost:4401/mcp` | variabile d'ambiente `PENPOT_MCP_URL` (facoltativa; se assente, usa il default) |
| Transport | `StreamableHTTPClientTransport` (`@modelcontextprotocol/sdk`) | — |
| Tool per leggere il catalogo token | `execute_code` (esegue JS con la Plugin API Penpot; leggere `penpot.library.local.tokens`) | — |
| Auth | nessuna, in locale (la sessione del plugin nel browser è ciò che autorizza) | — |

`packages/scripts` deve trattare `PENPOT_MCP_URL` come opzionale con questo default — non richiedere la variabile obbligatoriamente (fallirebbe l'esecuzione offline sulla fixture, che non deve mai dipendere dall'MCP).

## Verifica

```bash
# Il server deve rispondere (non connection-refused). Un 4xx/426 su GET semplice è normale
# per un endpoint Streamable HTTP che si aspetta una richiesta MCP vera, non un browser.
curl -i http://localhost:4401/mcp
```

Verifica applicativa completa: uno script che si connette con `@modelcontextprotocol/sdk` e chiama il tool `high_level_overview` deve ricevere una risposta, non un errore di connessione.

## Non fatto qui (fuori scope)

- Pin della versione (`PENPOT_VERSION`) dello stack esistente: oggi è `:latest` (floating), non toccato da questo spec — è uno strumento di sviluppo personale, non l'app in release. Vedi Open Questions in SPEC.md.
- Contenuto della library Penpot (token/componenti reali): decisione di design separata, non tecnica.
