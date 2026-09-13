# Pipeline Penpot → codice: meno vincoli per il designer

Designer di riferimento: non tecnico, lavora in Penpot da solo e consegna a lavoro finito o quasi.

## Decisioni
- **Penpot resta la fonte del design.** Far passare la pipeline è compito dello sviluppatore (ricetta, binding, emitter). Il designer torna in Penpot solo per scelte di design vere.
- **Token:** ogni *valore* (colore, misura, spessore, opacità, ombra) ha un token. Gli stili a parola chiave di una lista chiusa (tratteggio `solid`/`dashed`/`dotted`) sono ammessi senza token.
- **Blocco per componente:** quello che non rientra blocca solo quel componente, con un messaggio che nomina il problema; gli altri proseguono. Mai generare in silenzio una versione infedele.
- **Si estende l'emitter una volta per tutte** quando non sa esprimere un design valido fatto con i token (primo caso: una variante senza una proprietà che il default ha, come l'outline senza fill, a `render-component.ts:376-383`). Condizione: per lo sviluppatore adeguarsi deve restare semplice.
- **Registro unico delle proprietà Penpot**, letto da reader, `verify:library` ed emitter. Solo due stati, supportata o bloccata, e nessuno skip. Una proprietà assente dal registro blocca. Il refactor deve lasciare l'output attuale identico byte per byte.
- **Proprietà oggi "silenziose"** (spessore, opacità, tratteggio, allineamento del tracciato): per ora bloccano. Si supportano quando un componente reale le richiede: una riga del registro, la mappatura e un test rosso/verde.
- **Attriti di organizzazione del file:** maiuscole, spazi e ordine degli assi → normalizzati dalla pipeline. Layer con un nome diverso dalla parte → alias nel binding, a cura dello sviluppatore. Cella mancante → blocco del componente e domanda al designer, mai inventata.
- **Variante nuova in Penpot:** blocca solo quel componente, che resta all'ultima versione buona, finché lo sviluppatore non la adotta (skill `pds-component` / `adopt:variant`). I componenti in attesa devono essere visibili nel report di PR/CI.

## Scartato
- Adozione automatica delle varianti all'estrazione: sarebbe Penpot a decidere il vocabolario che le pagine salvano, e un refuso diventerebbe una migrazione dati.
- Variante "generata ma nascosta" nell'editor: introdurrebbe un secondo vocabolario per risparmiare minuti.
- Skip con log per le proprietà non esprimibili: producono verdi finti.
- Asse `removable` sul Badge: sarebbe l'editor, e non i dati, a decidere se mostrare la X. Parti opzionali nelle primitive: costo su verify, estrazione e registro, e uno stile da inventare nelle celle senza X.

## Primitive rigide, composizioni elastiche
- Un tag cliccabile su un prodotto è un **link**: l'`href` arriva dai dati commerce della ProductCard e la logica di ricerca resta esterna. Penpot disegna solo gli stati (hover/focus); il `<a>` lo decidono contratto e binding.
- La X su un filtro attivo è una **composizione** (Badge + icona-link in un blocco "Filtro attivo"), non una parte opzionale del Badge. È il caso di prova per le sezioni della Story 3.4, che dovranno dare al designer la stessa libertà decisa qui per i componenti.

## Aperto
- Variante esistente modificata (caso 1) rimandata, ma il fix "rimozione di una proprietà" dell'emitter serve comunque alle varianti nuove.
- `applyToken` sulle ombre in Penpot 2.17 non verificato dal vivo.
- Proprietà che varia con due assi: servono le `compoundVariants`, stesso principio.
- Oggi `gates:render` e `verify:library` sono globali: l'isolamento per componente in CI va progettato.
