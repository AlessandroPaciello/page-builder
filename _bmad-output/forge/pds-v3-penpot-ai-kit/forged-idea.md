# pds v3: regole della pipeline Penpot → codice

Esito: **HARDENED** (2026-10-13). Fonte: [spike penpot-ai-kit](../../spikes/penpot-ai-kit-2026-10-10/README.md). Input per il correct-course che riscrive gli AD.

## Premesse
- Le AD precedenti (spine 2026-10-03, AD-11 v2) si scartano. Delle vecchie regole si conserva solo il rischio che prevenivano, se vale ancora.
- I componenti già generati nel repo sono test pushati per errore: si rimuovono e si rigenerano.

## Decisioni
1. **Identità della parte:** plugin data `part=<chiave>` sul layer Penpot, scritto da `pds-design` con conferma. Il nome del layer è libero e serve solo a proporre la chiave.
   *Prova:* la chiave sopravvive al rename, viene ereditata dalle istanze e viene copiata da Ctrl+D (a nome identico).
2. **`styles.ts` dichiara le parti:** una `cva` per chiave. Il TSX usa quelle chiavi e il lato codice lo controlla `tsc`; VC controlla solo il lato Penpot.
3. **Parte tolta di proposito dallo sviluppatore:** solo un avviso (export inutilizzato). Nessun blocco e nessun metadato.
4. **Chiavi doppie** (tipiche dopo Ctrl+D): sceglie chi lancia la skill, *lista* (`repeat`) o *parte nuova* (chiave proposta dal nome). La risposta si scrive in Penpot.
5. **CI senza Penpot:** in CI si controlla solo il codice (tsc, test, tema nel CSS, contrasto, `styles.ts` intatto grazie a un hash nell'intestazione `@generated`). Penpot si verifica solo in sessione, quando si rigenera. Nessuna copia della lettura nel repo.
6. **Configurazione di progetto** (`pds-setup`): `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, un valore implementato per chiave. Valori non supportati: rifiuto esplicito.
7. **Cambio di struttura:** AC rigenera solo `styles.ts`. Per ogni parte aggiunta, tolta o diventata lista la skill suggerisce sempre la modifica con un esempio basato sul TSX attuale, e la applica solo su richiesta.
8. **Ruoli di parte eliminati:** lo stile si legge dal layer. L'elemento HTML lo decide lo scaffold, che chiede quando il layer è ambiguo.
9. **Niente livelli L0–L3:** l'ordine lo danno le istanze. Un componente si genera solo se esistono già i componenti che contiene.

## Scartato
- Nome del layer come identità: un rename innocuo rompeva il legame col codice.
- VC che legge il TSX: si rompe con `data-slot` dinamici, spread o sottocomponenti.
- Copia della lettura di Penpot per la CI: invecchia e fa da fixture.
- Profili headless per componente e scelta "headless o a mano" chiesta ogni volta: entrambi portano a componenti incoerenti tra una sessione e l'altra.
- Framework e stile configurabili subito: non esiste ancora un secondo progetto.
- Diff del TSX applicato in automatico: porta al "sì" detto senza leggere.

## Aperto (prossima forgia)
- Punti 3–4 del README: script in Python o TypeScript; ingressi e uscite stabili di ogni script.
- Punti 7, 8, 10–13: larghezza e webfont, render generico, sezioni, comportamento proposto, geometria, test dello spike.
- Rischio residuo: le chiavi in Penpot non si vedono e il designer non sa che duplicare copia l'identità.
