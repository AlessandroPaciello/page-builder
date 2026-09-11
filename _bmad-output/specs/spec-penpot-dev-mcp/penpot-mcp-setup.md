# Setup MCP sull'istanza Penpot esistente

Companion di [SPEC.md](./SPEC.md). Istruzioni operative concrete per CAP-1/CAP-2: come abilitare il server MCP ufficiale sull'istanza Penpot già in esecuzione, e il contratto che `packages/scripts` (Story 2.1+, nel repo `page-builder`) può assumere come stabile.

## Dove si applica

**Nel repo `page-builder`**, spostato qui il 2026-09-06 dalla directory esterna `~/Scrivania/projects/penpot/` dove viveva originariamente:

```
docker/penpot/docker-compose.yml
```

Il file ha `name: penpot` pinnato esplicitamente in testa — **non rimuoverlo**: è ciò che preserva i volumi dati esistenti (`penpot_penpot_assets`, `penpot_penpot_postgres_v15`) indipendentemente dalla directory da cui si lancia `docker compose up`. Servizi: `penpot-frontend`/`penpot-backend`/`penpot-exporter`/`penpot-postgres`/`penpot-valkey`/`penpot-mailcatch`/`penpot-mcp`, porta 9001 (frontend), 4401/4402 (mcp).

## Modifica applicata (già presente in questo file)

Il servizio è già stato aggiunto (stesso `networks: [penpot]` degli altri servizi). Dal 2026-09-11 gira con il comando di default dell'immagine (`--multi-user`) e `PENPOT_FLAGS` contiene `enable-mcp`: vedi [mcp-token.md](./mcp-token.md).

```yaml
services:
  penpot-mcp:
    image: "penpotapp/mcp:${PENPOT_VERSION:-latest}"
    restart: always
    ports:
      - "4401:4401"   # Streamable HTTP MCP diretto (i client usano il proxy :9001/mcp/stream)
      - "4402:4402"   # WebSocket task bridge del plugin
    networks:
      - penpot
```

`penpot-mcp` è già presente anche nella lista `depends_on` di `penpot-frontend`, come fa il compose ufficiale Penpot, così l'ordine di avvio è coerente.

Per avviare/riavviare lo stack:

```bash
cd /home/alessandro/Scrivania/projects/page-builder/docker/penpot
docker compose up -d
```

Grazie a `name: penpot` pinnato nel file, questo riusa container e volumi esistenti (verificato: nessuna ricreazione, stessi volumi `penpot_penpot_assets`/`penpot_penpot_postgres_v15`) anche se lanciato da questa nuova posizione nel repo.

## Abilitare il plugin dentro Penpot

Nel file Penpot che si vuole leggere via MCP: **File → Plugins → MCP Server → Connect**. La connessione usa la sessione del browser attivo — va rifatta se si riapre Penpot in una nuova tab/sessione.

## Contratto stabile per `packages/scripts`

| Cosa | Valore di default | Override |
|---|---|---|
| URL MCP (Streamable HTTP) | **superato:** vedi [mcp-token.md](./mcp-token.md) (`http://localhost:9001/mcp/stream`) | variabile d'ambiente `PENPOT_MCP_URL` (facoltativa) |
| Transport | `StreamableHTTPClientTransport` (`@modelcontextprotocol/sdk`) | — |
| Tool per leggere il catalogo token | `execute_code` (esegue JS con la Plugin API Penpot; leggere `penpot.library.local.tokens`) | — |
| Auth | token personale `userToken`, dalla variabile `PENPOT_MCP_TOKEN` (vedi [mcp-token.md](./mcp-token.md)) | — |

`packages/scripts` tratta `PENPOT_MCP_URL` come opzionale, con il default indicato in [mcp-token.md](./mcp-token.md) — non richiedere la variabile obbligatoriamente (fallirebbe l'esecuzione offline sulla fixture, che non deve mai dipendere dall'MCP).

## Verifica

```bash
# Proxy MCP del frontend (richiede enable-mcp): una GET semplice risponde 406, non la SPA né 404.
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9001/mcp/stream
# Il container deve essere in multi-user.
docker compose -f docker/penpot/docker-compose.yml logs penpot-mcp | grep "Multi-user mode"   # → true
```

Verifica applicativa completa: con `PENPOT_MCP_TOKEN` esportato e il plugin connesso, `pnpm --filter @penpot-ds/scripts generate:theme -- --live` legge il catalogo reale.

## Non fatto qui (fuori scope)

- Pin della versione (`PENPOT_VERSION`) dello stack esistente: oggi è `:latest` (floating), non toccato da questo spec — è uno strumento di sviluppo personale, non l'app in release. Vedi Open Questions in SPEC.md.
- Contenuto della library Penpot (token/componenti reali): decisione di design separata, non tecnica.
