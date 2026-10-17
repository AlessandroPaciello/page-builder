# pds v3: geometria, sezioni, comportamento, a11y (punti 7, 8-a11y, 10–12 del README)

Esito: **HARDENED** (2026-10-17). Continua la [forgia pds v3](../pds-v3-penpot-ai-kit/forged-idea.md) e la [forgia degli script](../pds-v3-scripts/forged-idea.md), le cui regole restano ferme salvo la correzione della regola 1. Fonte: [spike penpot-ai-kit](../../spikes/penpot-ai-kit-2026-10-10/README.md). Punto 13 fuori.

## Correzione della regola 1 (13/10)
`part`, `when`, `slot` e le risposte alle domande li scrive **`pds-code` alla generazione**, via MCP Penpot, con conferma, solo come shared plugin data `pagebuilder`. Mai stile, geometria, layer o token: il disegno resta del designer, che non scrive metadati. Il server `pds` continua a non scrivere su Penpot.

## Casi ambigui
Il nucleo restituisce un `Finding` di tipo **domanda**, con le opzioni; la skill chiede; la risposta si scrive in Penpot sul layer e non si richiede più. `generate_component` non scrive finché resta una domanda aperta. Le scelte di progetto non sono domande ripetute: si fanno una volta in `pds-setup`.

## Geometria e larghezza (12, 7)
1. **Radice (a′):** la misura fissa della radice si ignora se è uguale in tutte le celle (è un esempio, decide chi usa il componente); se cambia tra le celle è aspetto ed entra nella `cva` sotto l'asse.
2. **Fuori scala:** valore arbitrario (`w-[37px]`) + avviso VC ripetuto, con il valore in scala più vicino. Stessa regola per misure e posizioni. Mai una classe persa in silenzio.
3. **Ritaglio:** `overflow-hidden` se un figlio esce dal riquadro o se il genitore ha un raggio e un figlio tocca un bordo; ignorato se niente esce e non c'è contenuto variabile; **domanda** se niente esce ma c'è contenuto variabile (testo da field, immagine, slot). Motivo: `overflow-hidden` ovunque taglia l'anello di focus.
4. **Geometria nel registro**, con una traduzione per voce; le regole di contesto sono funzioni del nucleo; `left+right` e `top+bottom` si traducono; un valore non traducibile (vincolo `scale`) dà un avviso e nessuna classe. "Fill" dentro hug: domanda. Il campione `.penpot` usa ogni voce.
5. **Font:** `fonts=fontsource` in `pds-setup`. ET scrive `fonts.css` `@generated` dalle famiglie del tema; Next e Storybook caricano lo stesso file; GA verifica un pacchetto per famiglia. Via `next/font`, Geist e l'override di `globals.css`.

## Sezioni (10)
6. **Componente = tutti i pezzi li sceglie il designer; sezione = almeno uno slot.** Le parti proprie seguono le stesse regole in entrambi. Una sezione con parti proprie ha container, `styles.ts` e scaffold; una di sola disposizione no. La Story 3.4 cambia: una forma disegnata non è più un errore.
7. **Field `structure`:** è un asse solo se Penpot ha una variante con lo stesso nome; altrimenti è un rendering condizionale con `when=<field>` su una parte. Senza asse né `when` → domanda (quale parte, asse da disegnare, oppure field in `content` con MS).
8. **Slot:** layer i cui figli sono tutti istanze dei componenti ammessi; se è ambiguo → domanda, `slot=<id>`. **Icona:** parte con chiave; quale icona la propone lo scaffold. **Story:** figli di default del contratto, una per cella.

## Comportamento (11)
9. **Fonte:** primitivo Base UI se esiste (lo scaffold lo usa, la skill propone solo il collegamento); altrimenti ricetta shadcn `base` letta dal vivo + pattern APG. La ricetta non si salva. Le dipendenze nuove le sceglie lo sviluppatore, con l'alternativa senza dipendenze.
10. **Proposta:** prima un elenco di comportamenti da scegliere, poi un diff piccolo per comportamento con conferma, e un test per ogni comportamento (file dello sviluppatore, eseguito da GA). La riproposta avviene solo su richiesta o quando un cambio di struttura tocca una parte usata da un comportamento.

## A11y (8)
11. **Stati:** focus e disabled hanno sempre un default nel CSS globale (anello `ring`, opacità 50%); una cella disegnata vince; il focus non si toglie. Hover e active esistono solo se disegnati: asse riservato `state`, una cella per variante su una sola taglia, la differenza va applicata con il prefisso a tutte le taglie; non è una prop; le celle mancanti non sono un errore.
12. **Verifica:** axe in GA, bloccante, su ogni story `@generated`; tastiera coperta dai test di comportamento; "testo + colore" è una voce fissa del giudizio in Storybook. La Story 2.18 va riscritta nel correct-course.

## Fuori da Penpot
13. Un componente senza container è scritto a mano (contratto sì, niente generato, solo GA). Un disegno fatto altrove si riporta in Penpot. Un secondo ingresso solo quando il caso diventa reale.

## Scartato
- **Misura fissa della radice sempre ignorata (a rigida):** perde in silenzio le taglie disegnate sulla radice e obbliga il designer ad aggiungere un layer.
- **Arrotondare i valori fuori scala:** sceglie un valore che nessuno ha deciso. **Bloccarli:** l'aspetto produce solo avvisi.
- **Ritaglio sempre o mai:** sempre taglia il focus, mai perde l'immagine nella card arrotondata.
- **`next/font`:** due strade di caricamento, e Storybook mente.
- **Hover con default globale e "cella identica = nessun hover":** troppo macchinoso.
- **Diff del comportamento in blocco:** porta al "sì" detto senza leggere.
- **Semantic Tagger:** tiene i tag solo in memoria, e il suo vocabolario non è il nostro.

## Rischi residui
- I metadati in Penpot non si vedono: una perdita si scopre alla generazione successiva. Controllo di stato in `pds-design`; pannello in sola lettura rimandato ([deferred-work](../../implementation-artifacts/deferred-work.md)).
- Un layer che tiene la chiave ma cambia significato: lo vede solo il giudizio in Storybook.
- Quali operazioni di Penpot cancellano i plugin data (raggruppa, booleane, copia tra file, ripristino, stacco): da misurare nel collaudo. Anche "fill" dentro hug è da verificare.
- Senza hover disegnato non c'è hover. "Testo + colore" resta affidato al giudizio umano.
