---
id: SPEC-penpot-estrazione-costruzione
companions:
  - ./scope-roadmap.md
  - ./extraction-flow.md
sources:
  - ../../brainstorming/brainstorm-penpot-estrazione-costruzione-2026-10-03/brainstorm-intent.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Estrazione e Costruzione Penpot→React senza script rigidi

## Why

Gli script di estrazione Penpot→React attuali sono rigidi e non manutenibili: ogni nuova regola o variazione di design li degrada e vincola il design stesso. Serve un sistema evolvibile che costruisca componenti React leggendo il design live, senza metadati manuali. È insieme un **pain da risolvere** (designer e dev bloccati dal caso guida card: ricostruzione Penpot infedele allo screenshot e struttura React incoerente) e un'**opportunità da catturare** (MCP Penpot come contratto vivo).

## Capabilities

- **CAP-1 — Costruzione live via MCP**
  - **intent:** lo strumento costruisce componenti React leggendo il design Penpot via MCP al momento dell'estrazione, on-demand senza cache.
  - **success:** un'estrazione con Penpot raggiungibile produce output senza leggere alcuna cache o fixture locale; a Penpot spento l'estrazione non procede in silenzio.

- **CAP-2 — Scelta da-zero vs headless guidata dal design**
  - **intent:** lo strumento sceglie implementazione da-zero o su headless (es. Base UI) in base al segnale del design, usando profili headless+token versionati nel repo con default ragionevoli.
  - **success:** dato un componente Penpot con segnale headless, l'output usa il profilo corrispondente dal repo; senza configurazione, lo strumento suggerisce quella mancante invece di fallire.

- **CAP-3 — Check iniziale obbligatorio pre-estrazione**
  - **intent:** prima di estrarre, lo strumento verifica definizione headless e token, scansiona Penpot via MCP + repo, calcola il diff token Penpot vs codice e propone l'allineamento applicabile in un colpo solo dopo conferma esplicita.
  - **success:** con token disallineati, l'estrazione si ferma al check e presenta diff + proposta applicabile; mai errore secco senza proposta. Dettaglio → [extraction-flow.md](./extraction-flow.md).

- **CAP-4 — Contratto vivo, zero metadati**
  - **intent:** nessun metadato scritto a mano per singolo componente; contratto solo da segnali vivi MCP + convenzioni atomic + token letti da Penpot.
  - **success:** `git grep` di file di metadati manuali per componente non trova nulla; l'estrazione funziona leggendo solo Penpot + convenzioni.

- **CAP-5 — Regole come fix, conferma prima di generare**
  - **intent:** regole di token e semantica proposte come fix applicabili, non come blocchi; l'interpretazione è confermata prima di generare.
  - **success:** una violazione di regola produce proposta di fix; nessun file React è scritto senza conferma esplicita dell'interpretazione.

- **CAP-6 — Auto-proposta in Penpot se mancano requisiti + gate**
  - **intent:** se mancano requisiti per estrarre, lo strumento li disegna o li propone in Penpot via MCP invece di fallire; prima di estrarre passa il gate legame componente-token e la convenzione nomi atomic.
  - **success:** con requisito mancante, esiste proposta/disegno in Penpot tracciabile; con gate fallito, nessuna estrazione parte. Dettaglio → [extraction-flow.md](./extraction-flow.md).

- **CAP-7 — Doppio contratto di fedeltà**
  - **intent:** contratto 1: componente Penpot fedele allo screenshot, giudicato da umano con problemi segnalati esplicitamente; contratto 2: estrazione React coerente a Penpot.
  - **success:** sul caso card, Penpot infedele allo screenshot produce segnalazione esplicita invece di estrazione silenziosa; React estratto rispecchia struttura e token Penpot. Dettaglio → [extraction-flow.md](./extraction-flow.md).

- **CAP-8 — Update solo per diff**
  - **intent:** i componenti già presenti non sono mai sovrascritti alla cieca, solo aggiornati per diff.
  - **success:** una seconda estrazione di un componente esistente produce diff reviewabile; nessun file esistente è sostituito integralmente senza diff.

- **CAP-9 — Scope atomic fino a organismi, roadmap a livelli**
  - **intent:** copertura token → atomi → organismi con roadmap L0-L3 dove ogni livello sblocca il successivo; template e pagine restano a Puck con contratto via Tailwind theme.
  - **success:** un livello successivo non è estraibile finché il precedente non è completo secondo i criteri in scope-roadmap; nessun template/pagina è generato da questo sistema. Dettaglio → [scope-roadmap.md](./scope-roadmap.md).

- **CAP-10 — Validazione end-to-end sul caso guida Card**
  - **intent:** l'intero flusso è validato sulla card: fedeltà screenshot → struttura Penpot → estrazione React con legame componente-token verificato.
  - **success:** demo card completa: card Penpot giudicata fedele o con problemi segnalati, React estratto coerente, gate token verde; il riferimento vive in `assets/card-reference/` se presente, la sua assenza non blocca (si procede con segnalazione).

## Constraints

- Zero metadati manuali per singolo componente; solo segnali vivi MCP (lettura struttura/token/screenshot + scrittura/proposta) + convenzioni atomic da docs nel repo + token Penpot.
- Lettura live via MCP on-demand, senza cache.
- Check iniziale obbligatorio prima di ogni estrazione; mismatch token o configurazione mancante mai errore secco, sempre con proposta applicabile in un colpo solo dopo conferma esplicita.
- Profili headless+token versionati nel repo; senza configurazione, suggerimento invece di fallimento.
- Nessuna generazione senza conferma dell'interpretazione; regole solo come fix, mai come blocchi muti.
- Gate legame componente-token e convenzione nomi atomic (canonica in docs repo) vincolanti prima di estrarre.
- Fedeltà screenshot→Penpot giudicata da umano con segnalazione esplicita; nessun score pixel-perfect automatico.
- Stop a organismi: template e pagine solo via Puck, contratto via Tailwind theme.
- Mai sovrascrittura cieca di componenti esistenti, solo diff di aggiornamento.

## Non-goals

- Template e pagine (competenza Puck, contratto via token soltanto).
- Script rigidi di estrazione e qualsiasi cache/fixture come scorciatoia al live MCP.
- Metadati manuali per componente e blocchi muti senza proposta di fix.
- Ridefinizione del design system o dei token: il sistema li legge e ne propone l'allineamento, non li reinventa.
- Metriche automatiche di fedeltà visiva pixel-perfect: la fedeltà è giudizio + segnalazione esplicita, non score.

## Success signal

Un designer ottiene una card su Penpot fedele allo screenshot oppure problemi segnalati esplicitamente; un dev ne estrae il React coerente a Penpot con gate componente-token verde; il tutto senza scrivere metadati manuali e senza che nuove regole o complessità di design degradino il sistema. Dimostrabile sul caso card da screenshot a React.

## Assumptions

- Base UI come headless di riferimento iniziale; profili alternativi seguono lo stesso schema nel repo.
- Puck come composer di template/pagine.
- Riferimento card opzionale in `assets/card-reference/` (`screenshot.png` + `penpot-link.md` con URL/ID file Penpot): se assente, CAP-7/CAP-10 procedono con segnalazione esplicita senza bloccare.
