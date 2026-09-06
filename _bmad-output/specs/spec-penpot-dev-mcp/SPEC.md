---
id: SPEC-penpot-dev-mcp
companions: ["penpot-mcp-setup.md"]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Ambiente di sviluppo Penpot con MCP

## Why

Story 2.1 (Epic 2, `page-builder`) richiede di generare i design token da un catalogo Penpot reale, ma nessun server MCP è raggiungibile: esiste già un'istanza Penpot self-hosted attiva da giorni (usata in fase UX), ma senza il servizio MCP abilitato. Senza questo, `packages/scripts` non può leggere il catalogo token/componenti e la pipeline Penpot→codice (AD-11) resta bloccata. Il vincolo dell'utente è che tutto resti gratuito — condizione già soddisfatta dal fatto che Penpot self-hosted e il suo server MCP ufficiale sono entrambi open source e gratuiti.

## Capabilities

- **CAP-1**
  - **intent:** Alessandro ha un'istanza Penpot self-hosted locale con il server MCP ufficiale abilitato e raggiungibile da un processo Node/tsx sull'host (fuori Docker).
  - **success:** `curl http://localhost:4401/mcp` risponde (non connection-refused) dopo aver applicato la modifica descritta in `penpot-mcp-setup.md` e riavviato lo stack esistente; uno script Node con `@modelcontextprotocol/sdk` completa una `execute_code`/`high_level_overview` senza errori di connessione.
- **CAP-2**
  - **intent:** `packages/scripts` (Story 2.1 e successive) assume un contratto stabile e documentato per raggiungere l'MCP, senza hardcodare assunzioni fragili sull'ambiente di chi sviluppa.
  - **success:** con l'istanza locale standard descritta in questo spec, il default (`http://localhost:4401/mcp`) funziona out-of-the-box; chi gira su una porta diversa può sovrascriverlo con la variabile d'ambiente `PENPOT_MCP_URL` senza modificare codice.

## Constraints

- Tutto gratuito: solo componenti open source self-hosted (Penpot + il suo server MCP ufficiale, immagine `penpotapp/mcp`); nessun servizio o tier a pagamento.
- Il container `penpot-mcp` non espone porte host nel compose ufficiale Penpot (raggiungibile solo dalla rete Docker interna) — va aggiunta esplicitamente `ports: ["4401:4401"]` (vedi companion).
- AD-11 (Architecture Spine di `page-builder`): Penpot è single source of truth dei valori di design — nessuna fixture con valori inventati; se il catalogo Penpot reale non è ancora popolato con token veri, la generazione (Story 2.1) resta bloccata finché non lo è.
- Solo uso locale (`localhost`): nessuna esposizione pubblica, nessun setup HTTPS/reverse proxy in questo spec.
- Il docker-compose dello stack Penpot vive in `docker/penpot/docker-compose.yml` dentro il repo `page-builder` (spostato dalla directory esterna `~/Scrivania/projects/penpot/`, decisione 2026-09-06). Il campo `name: penpot` è pinnato esplicitamente nel file — **non va rimosso**: preserva i volumi dati esistenti (`penpot_penpot_assets`, `penpot_penpot_postgres_v15`) indipendentemente dalla directory da cui si lancia `docker compose up`.

## Non-goals

- Il contenuto della library Penpot (quali colori/componenti/token) — decisione di design separata, non coperta da questo spec tecnico.
- Deploy/esposizione di Penpot o del suo MCP oltre a `localhost` (niente HTTPS, niente produzione, niente accesso da altre macchine).
- Pin della versione (`PENPOT_VERSION`) dello stack Penpot esistente: oggi floating (`:latest`); non è nello scope di questo spec (strumento di sviluppo personale, non l'app in release di `page-builder`).

## Success signal

Da terminale, dopo aver applicato la modifica al compose esterno e riavviato lo stack: `curl http://localhost:4401/mcp` risponde (non connection-refused), e un piccolo script Node con `@modelcontextprotocol/sdk` (`StreamableHTTPClientTransport` verso quell'URL) riceve una risposta valida dal tool `high_level_overview`. Da quel momento Story 2.1 può leggere un catalogo token reale invece di essere bloccata.

## Assumptions

- Lo stack Penpot esistente (progetto compose `penpot`, ora `docker/penpot/docker-compose.yml` nel repo `page-builder`) è quello che Alessandro vuole continuare a usare per tutta Epic 2 — non se ne prevede la sostituzione.
- La versione floating (`penpotapp/*:latest`) dello stack esistente resta accettabile per uso locale/personale; non viene applicata la disciplina di pin delle versioni che vale per il repo `page-builder` (quello è un ambiente di sviluppo esterno al repo, non un artefatto di release).

## Open Questions

_(chiusa 2026-09-06)_ ~~Il catalogo token/componenti nella library Penpot esistente di Alessandro è quello da usare, o va definita una nuova library da zero?~~ **Deciso: si riusa la library esistente.** Validata in sessione UX contro i ruoli richiesti da `design-system.md`: colori/typography/spacing/radii/shadow confermati e allineati (valori aggiornati in [DESIGN.md](../../planning-artifacts/ux-designs/ux-page-builder-2026-07-26/DESIGN.md)); un difetto di contrasto sul token `border` (falliva ≥3:1) è stato corretto direttamente in Penpot. Il ruolo tipografico `mono` resta deferred (non richiesto dall'AC di Story 2.1). Story 2.1 può ora generare una fixture reale da questa library.
