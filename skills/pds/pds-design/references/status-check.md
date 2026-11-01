# ST — Stato del componente

Controllo di stato **in sola lettura**: dice al designer dove il disegno non è ancora leggibile come componente. Non corregge niente, non risponde alle domande, non scrive su Penpot.

## Cosa chiami

`verify_component { name }` sul server `pds` — `name` è il contratto (`alert`, `alert@1`) o il nome del layer in Penpot. Restituisce `{ findings }`: ogni voce ha `level` (`blocco`, `domanda`, `avviso`), `where` e `message`; una `domanda` porta anche `key` (la chiave di plugin data in cui `pds-code` scriverà la risposta) e `options`.

Se serve il contesto, `describe_component { name }` (sola lettura) per mostrare: il `pluginData` del container (`contract = nome@versione` presente o no) e le celle lette.

## Come lo mostri

Una tabella, nell'ordine che conta:

| Livello | Dove | Cosa | Opzioni |
|---|---|---|---|
| blocco | cella / parte | il messaggio così com'è | — |
| domanda | layer | il messaggio | le `options`, e con quale `key` si risponde |
| avviso | cella / parte | il messaggio | — |

Poi un riepilogo in una riga, con i due numeri che il designer guarda per primi:

- **chiavi mancanti**: layer senza `part` (domande `part`; fra le opzioni c'è il kebab del nome del layer e `ignora`, che fonde il layer nel genitore perdendone le classi);
- **chiavi doppie**: la stessa chiave tra fratelli (domanda `repeat`: `lista` o `parte-nuova`) o in rami diversi (blocco);
- celle doppie, assi o valori estranei al contratto, stati sconosciuti (blocco). Le celle **mancanti** non sono un finding di `verify_component`: se una combinazione dell'editor non è disegnata, aggiungila tu come nota.

Attenzione a **quando** quei numeri esistono. `analyzeComponent` esce con il solo finding del contratto quando `pluginData.contract` manca: finché il container non ha `pagebuilder/contract` (lo scrive `pds-code`, Story 2.29), chiavi e doppioni **non sono stati analizzati**. Se il solo blocco è la mancanza del contratto, dillo con quelle parole — «chiavi e doppioni si leggono dopo che `pds-code` ha scritto il contract» — e non rassicurare su un controllo che non è stato fatto. Quando invece il contratto c'è e non ci sono chiavi mancanti né doppie, dillo con quelle parole.

Se c'è un blocco, aggiungi che `generate_component` non scriverà finché resta: è `pds-code` a doverlo togliere, non tu.

## Cosa non fai

- Non rispondi alle domande e non scrivi plugin data: le risposte le scrive `pds-code`, con la conferma.
- Non «sistemi» layer, nomi o celle in Penpot per far sparire un finding.
- Non generi codice: `generate_component`, `build_order` e `extract_theme` sono di `pds-code`.

## Nota

`verify_component` legge dal disco il `<Comp>.tsx` se esiste: con il componente dello sviluppatore già presente può arrivare anche l'avviso di una parte esportata e non usata. Prima di GC quel file non c'è e quegli avvisi non compaiono: è normale.
