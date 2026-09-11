---
id: SPEC-penpot-dev-mcp
companions: ["penpot-mcp-setup.md", "mcp-token.md"]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Ambiente di sviluppo Penpot con MCP

## Why

La pipeline Penpot→codice (AD-11, Epic 2) legge token e componenti da un'istanza Penpot self-hosted locale tramite il server MCP ufficiale. Il primo passo (CAP-1/CAP-2) ha reso l'MCP raggiungibile in modalità single-user senza autenticazione. Ora Alessandro vuole collegare lo stesso server a Claude Code, OpenCode e agli script con un **token personale generato da Penpot**, tenendo la configurazione condivisa nel repo senza che il token ci finisca mai. Il vincolo di partenza resta: tutto gratuito e open source.

## Capabilities

- **CAP-1**
  - **intent:** Alessandro ha un'istanza Penpot self-hosted locale con il server MCP ufficiale abilitato e raggiungibile da processi sull'host (fuori Docker).
  - **success:** con lo stack avviato da `docker/penpot/`, un client MCP (`@modelcontextprotocol/sdk`, Streamable HTTP) verso l'endpoint documentato in `mcp-token.md` completa `high_level_overview` senza errori di connessione.
- **CAP-2**
  - **intent:** `packages/scripts` raggiunge l'MCP con un contratto stabile preso dall'ambiente: URL facoltativo con default e token facoltativo, senza hardcodare l'ambiente di chi sviluppa.
  - **success:** con `PENPOT_MCP_TOKEN` (ed eventualmente `PENPOT_MCP_URL`) impostate, i reader leggono il catalogo reale da Penpot. Senza variabili, la pipeline offline sulla fixture passa. Se l'endpoint richiede il token e il token manca, l'errore lo dice in modo esplicito.
- **CAP-3**
  - **intent:** Penpot self-hosted genera e rigenera, dalle impostazioni utente, un token MCP personale.
  - **success:** con lo stack avviato, *Settings → Integrations* mostra la sezione "MCP server" attiva con un token copiabile, e rigenerarlo invalida il precedente.
- **CAP-4**
  - **intent:** Claude Code e OpenCode si collegano al server MCP Penpot con il token personale. La configurazione è condivisa nel repo e non contiene il token.
  - **success:** `/mcp` in Claude Code e l'elenco MCP di OpenCode mostrano `penpot` connesso con i suoi tool. `git grep` del valore del token nel repo non trova nulla.

## Constraints

- Tutto gratuito: solo Penpot self-hosted e l'immagine ufficiale `penpotapp/mcp`, nessun servizio a pagamento.
- **Il token non viene mai scritto in un file tracciato da git.** Vive solo in variabili d'ambiente o in file ignorati (`.env*` è già in `.gitignore`). `.mcp.json` e `opencode.json` lo referenziano solo come variabile.
- Unica sorgente del token per i tre consumatori (Claude Code, OpenCode, script): la variabile `PENPOT_MCP_TOKEN`. Claude Code non carica `.env` da solo, quindi la variabile deve esistere nell'ambiente della shell o dell'IDE.
- La generazione del token in Penpot 2.17.x dipende dal flag `enable-mcp` in `PENPOT_FLAGS`. Prima del 2026-09-11 il flag mancava, ed era la causa per cui il token "non veniva generato" (PR #20). Ora è attivo.
- Il compose vive in `docker/penpot/docker-compose.yml` con `name: penpot` pinnato. **Non va rimosso**: preserva i volumi `penpot_penpot_assets` e `penpot_penpot_postgres_v15`.
- AD-11: Penpot è la single source of truth dei valori di design, quindi niente fixture con valori inventati.
- Solo `localhost`: nessuna esposizione pubblica, niente HTTPS o reverse proxy.

## Non-goals

- Gestione segreti centralizzata (vault, secret manager), rotazione automatica del token, uso del token in CI. Il percorso offline e la CI restano sulla fixture e non usano mai il token.
- Esporre Penpot o l'MCP oltre `localhost`.
- Il contenuto della library Penpot (quali token o componenti): è una decisione di design separata.
- Il pin di `PENPOT_VERSION`: resta `:latest`, perché è uno strumento di sviluppo personale e non l'app in release.

## Success signal

Alessandro genera il token in Penpot e lo esporta come `PENPOT_MCP_TOKEN` nella propria shell. Poi, senza toccare file tracciati, Claude Code e OpenCode mostrano `penpot` connesso e `packages/scripts` legge il catalogo token reale. Chi clona il repo ripete il flusso con il proprio token.

## Assumptions

- Il token ha effetto solo in modalità multi-user. Si assume di dover togliere l'override `command: ["node", "index.js"]` del commit #20 e tornare al default `--multi-user` dell'immagine. _(verificata 2026-09-11: senza token i tool rispondono `No userToken found in session context`)_
- Gli script adottano lo stesso endpoint dei client (default `PENPOT_MCP_URL` = `http://localhost:9001/mcp/stream`) e aggiungono `userToken` preso dall'ambiente. Esporre direttamente 4401/4402 sull'host diventa superfluo. _(confermata 2026-09-11 per l'endpoint; la chiusura delle porte resta una decisione aperta)_
- Lo stack Penpot esistente resta quello usato per tutta Epic 2.
- La versione floating `:latest` resta accettabile per uso locale.

## Open Questions

- In modalità multi-user il plugin "MCP Server" dentro Penpot va ancora connesso a mano (*File → Plugins → Connect*) in ogni sessione, o si lega da solo all'utente del token? _(risposta 2026-09-11: va ancora connesso; senza plugin il token restituisce `No Penpot instance connected for user token`)_
- In modalità multi-user l'endpoint diretto `:4401/mcp` senza `userToken` viene rifiutato o accetta connessioni anonime? La risposta decide se le porte 4401/4402 esposte sull'host vanno chiuse. _(risposta 2026-09-11: `initialize` è accettato anche senza token, i tool no. Chiudere le porte o legarle a `127.0.0.1` è da decidere)_
- _(chiusa 2026-09-06)_ ~~Library esistente o nuova?~~ **Si riusa la library esistente**, validata in UX. Il contrasto del token `border` è stato corretto in Penpot, il ruolo `mono` è deferred.
