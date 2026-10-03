# Flusso di estrazione — check, gate, fedeltà, update

Procedura viva per CAP-3, CAP-6, CAP-7, CAP-8. SPEC madre: [SPEC.md](./SPEC.md).

## Check iniziale obbligatorio (CAP-3)

Prima di ogni estrazione, in ordine:

1. Verifica esistenza definizione headless e token richiesti dal segnale design (profili dal repo).
2. Scansione Penpot via MCP (lettura struttura/token/screenshot + scrittura/proposta) + repo.
3. Diff token Penpot vs codice.
4. Proposta di allineamento applicabile in un colpo, applicata solo dopo conferma esplicita.
5. Se manca configurazione headless+token: suggerimento della configurazione, non errore secco.

Esito: verde → si procede; rosso → proposta, nessuna estrazione senza conferma.

## Gate + auto-proposta (CAP-6)

- Gate legame componente-token + convenzione nomi atomic (canonica in docs repo): vincolante.
- Se mancano requisiti estraibili: disegno o proposta in Penpot via MCP, tracciabile, invece di fallire.
- Regole token/semantica sempre come fix, mai come blocchi muti; conferma interpretazione prima di generare (CAP-5).

## Doppio contratto di fedeltà (CAP-7)

- **Contratto 1 — screenshot→Penpot:** giudizio umano di fedeltà all'immagine di riferimento; in caso contrario problemi segnalati esplicitamente, nessuna estrazione silenziosa, nessuno score pixel-perfect automatico.
- Riferimento opzionale in `assets/card-reference/` (`screenshot.png` + `penpot-link.md`): se assente, si procede con segnalazione senza bloccare.
- **Contratto 2 — Penpot→React:** React estratto coerente a struttura e token Penpot.

## Update (CAP-8)

- Componenti esistenti: solo diff di aggiornamento, mai sovrascrittura cieca.
- Il diff è reviewabile prima dell'applicazione.
