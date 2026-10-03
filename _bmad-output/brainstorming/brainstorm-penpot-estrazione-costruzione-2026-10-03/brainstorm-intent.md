# Brainstorm Intent — Estrazione e Costruzione Penpot-React

## Topic / Goal
Nuovo sistema di estrazione e costruzione design Penpot→React senza script rigidi. Obiettivo: superare rigidità e non-manutenibilità degli script attuali, sistema evolvibile che non vincola il design.

## Direzione Must (A) — Costruzione live via MCP
- Strumento che costruisce componenti React live leggendo il design Penpot via MCP, on-demand senza cache.
- Scelta da-zero vs headless (es. Base UI) guidata dal segnale del design.
- Profili headless+token configurabili con default ragionevoli; se manca configurazione, lo strumento la suggerisce.
- Check iniziale obbligatorio prima di estrarre: verifica esistenza definizione headless e token, scansiona Penpot via MCP + repo, diff token Penpot vs codice con proposta di allineamento applicabile in un colpo. Se i token non coincidono, propone lui la correzione (mai errore secco).

## Supporto (B) — Contratto vivo, zero metadati
- Buttare via tutti i metadati scritti a mano per singolo componente.
- Solo segnali vivi via MCP + convenzioni atomic + token letti da Penpot come contratto vivo.
- Regole (token, semantica) proposte come fix, non come blocchi; conferma interpretazione prima di generare.
- Se mancano requisiti per estrarre, li disegna/disegna-propone in Penpot via MCP invece di fallire.
- Gate legame componente-token prima di estrarre; convenzione nomi atomic.

## Supporto (C) — Doppio contratto di fedeltà
- Contratto 1: fedeltà allo screenshot (componente Penpot fedele all'immagine di riferimento, problemi segnalati).
- Contratto 2: coerenza Penpot-React (estrazione React coerente a Penpot).
- Update mai con sovrascrittura cieca: solo diff di aggiornamento per componenti già presenti.

## Confine / Scope
- Atomic design fino a organismi: token → atomi → organismi (es. button, switch, checkbox, select fino a card, tabelle, header, footer, sidebar, dashboard, hero, carousel).
- Stop a organismi: template e pagine con Puck. Contratto tra i due via token.
- Roadmap a livelli: ogni livello sblocca l'estrazione del successivo.

## Caso guida: Card
- Fallimento di riferimento: card ricostruita male su Penpot da screenshot (alberatura poco chiara, senza grafica) e struttura React manuale incoerente sia con Penpot che con immagine.
- Uso: validare su card l'intero flusso (fedeltà screenshot → struttura Penpot → estrazione React).

## Criteri di successo
1. Designer: card su Penpot fedele allo screenshot, oppure problemi segnalati esplicitamente.
2. Dev: estrazione React coerente a Penpot, con legame componente-token verificato.
3. Manutenzione: nessun metadato manuale; sistema non degrada con crescita di regole o complessità design.
