# GC — Genera componente

Da un componente verificato ai file in `packages/ui/src/domains/<nome>/`. L'ordine lo decide `build_order`, i file li scrive `generate_component`, il giudizio è dell'utente in Storybook. Nessuna domanda aperta, nessun blocco: altrimenti non si scrive.

## Ingresso

Il componente — o i componenti — da generare. Per una composizione (la Multiselect con Chip, Checkbox, Option, Multiselect Trigger e Multiselect Panel) si passano **tutti** a `build_order`: l'ordine non si sceglie a mano. Prima di partire, `verify_component` su ognuno deve dare zero domande e zero blocchi (VC).

## Passi

1. **Ordine.** `build_order { names: [...] }` sul server `pds`. Restituisce `{ order, findings }`:
   - `order`: i nomi nell'ordine in cui generarli (un componente dopo quelli che contiene). I componenti già generati (con un `<Comp>.styles.ts` `@generated`) non si rifanno.
   - un `blocco` (contratto sconosciuto, dipendenza mancante, ciclo) → **stop**: si riporta il messaggio e si torna a VC o a `pds-design`.
   - una `domanda` → si risponde con VC prima di generare.
   Mostra `order` e chiedi il sì sul giro: è l'elenco dei file che verranno toccati, componente per componente.

2. **Generazione, nell'ordine.** Per ogni nome: `generate_component { name }` sul server `pds`. Restituisce `{ changes, findings, suggestions, written }`:
   - `written: []` con domande o blocchi → non ha scritto niente: torna a VC, mostra i finding, non insistere.
   - `written` con dei path → mostra `changes` (azione `crea`/`aggiorna`/`elimina` e path) e `suggestions`. Un path che non era nell'elenco del giro è un rosso: fermati e rileggi.
   - Il `<Comp>.tsx` viene **creato** solo se manca, ed è lo scaffold: da quel momento è dello sviluppatore. Un `<Comp>.tsx` esistente non si tocca mai.

   Cosa scrive: `<Comp>.styles.ts` (una `cva` per chiave, tutti gli assi, le varianti delle istanze annidate), `<Comp>.stories.tsx` (una story per cella) e, se manca, `<Comp>.tsx`. `styles.ts` e la story portano il marker `@generated` con versione e hash.

3. **Giudizio in Storybook.** `pnpm --filter storybook dev` e apri il componente. L'utente guarda e dice se la cella è fedele a Penpot. Le voci fisse:
   - ogni cella disegnata ha la sua story e rende come in Penpot (struttura, token, testo d'esempio);
   - **testo + colore**: nessuno stato o variante che si distingua solo per il colore — serve anche un testo (o icona + testo);
   - i nomi accessibili e i ruoli che il contratto dichiara ci sono;
   - le celle mancanti non sono un errore, ma vanno dette.

   Un giudizio negativo è un cambio da fare in Penpot (con `pds-design`), non una modifica a mano dei file generati.

4. **Comportamento e a11y, solo su richiesta.** Dopo lo scaffold, se l'utente vuole il comportamento: prima un **elenco** di comportamenti da scegliere (primitive Base UI se esiste, altrimenti pattern APG), poi un diff piccolo per comportamento con conferma, e un test per ogni comportamento nel file dello sviluppatore (lo esegue GA). Le dipendenze nuove le sceglie lo sviluppatore, con l'alternativa senza dipendenze. Non riproporre se non è richiesto o se un cambio di struttura tocca una parte usata da un comportamento.

5. **Esito.** Due righe per componente: file scritti, suggerimenti aperti, giudizio. Poi GA.

## Cosa non fai

- Non scrivi a mano `styles.ts`, la story o lo scaffold: li scrive `generate_component`, e un file `@generated` toccato è un blocco.
- Non scegli l'ordine: `build_order` decide.
- Non generi con domande aperte o blocchi: `written: []` non è un caso da aggirare.
- Non modifichi il `<Comp>.tsx` dello sviluppatore senza richiesta; i cambi di struttura restano `suggestions` finché l'utente non li chiede.
- Non scrivi plugin data: le risposte sono VC.
