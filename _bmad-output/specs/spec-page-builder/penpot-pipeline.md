# Pipeline Penpot → codice (v3)

Companion di [SPEC.md](./SPEC.md). Descrive **cosa** fa la pipeline design → codice e le regole di aderenza. Regole vincolanti in AD-11 v3 della [spine 2026-07-25](../../planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md); razionale nello [spike penpot-ai-kit](../../spikes/penpot-ai-kit-2026-10-10/README.md) e nelle tre forgie pds v3 ([regole](../../forge/pds-v3-penpot-ai-kit/forged-idea.md), [script](../../forge/pds-v3-scripts/forged-idea.md), [punti aperti](../../forge/pds-v3-punti-aperti/forged-idea.md)). *(Riscritto dal correct-course 2026-10-17: le versioni v1 e v2 — fixture e ricetta, poi due contratti, istantanea e sei comandi — restano nella storia git e nelle sprint change proposal del 2026-09.)*

## Principio guida

Questo è un progetto di **design system**: la coerenza coi token e i componenti esistenti viene prima della creazione di nuovi elementi. Penpot è la single source of truth di valori e aspetto. Aderenza stretta: usare **esattamente** i valori del design; non inventare valori mancanti; mai una classe persa in silenzio.

**Il designer di riferimento è non tecnico.** Disegna in Penpot con il kit ufficiale ([penpot-ai-kit](https://github.com/penpot/penpot-ai-kit)) attraverso `pds-design`, e non scrive metadati. Far passare la pipeline è compito dello **sviluppatore**, attraverso `pds-code`; al designer si chiede di tornare in Penpot solo per scelte di design vere.

## Chi fa cosa

| Pezzo | Ruolo |
|---|---|
| **contratto dell'editor** (`@app/contracts`, `components/<nome>.ts` o `sections/<nome>.ts`) | unico file per componente: assi `option`, field, slot; `SCHEMA_VERSION` + fingerprint. Lo propone la skill, lo approva lo sviluppatore |
| **Penpot** | parti, albero, istanze e variante scelta, celle, token, layout, geometria. Letto dal vivo, mai salvato nel repo |
| **plugin data `pagebuilder`** (shared) | `contract = nome@versione` sul container; `part=<chiave>`, `when=<field>`, `slot=<id>` e le risposte alle domande sui layer. Li scrive solo `pds-code`, con conferma |
| **nucleo** (`packages/scripts/src/core`) | funzioni dati → dati: registro, geometria, verifica, generatore, ordine, tema |
| **adattatore** (`readComponent`, `src/penpot`) | unico punto che parla con Penpot (`execute_code`) |
| **server MCP `pds`** (`src/server`) | unico guscio, senza CLI: senza stato, rilegge Penpot a ogni chiamata, non scrive su Penpot, scrive lui i file `@generated` |
| **`pds-design`** | verso Penpot: TB, TV, CN, DC, CD, MS |
| **`pds-code`** | verso il codice: ET, VC, GC, AC, GA |
| **`pds-setup`** | configurazione di progetto: `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource`; un valore non implementato è un rifiuto esplicito |
| **componente dello sviluppatore** (`<Comp>.tsx`) | elemento HTML, field → parte, icone, comportamento, a11y. Creato una volta dallo scaffold, poi mai riscritto |

Strumenti del server: `tokens_from_css` (TB/TV), `describe_component` (CD/MS), `verify_component` (VC), `build_order` (GC), `generate_component` (GC/AC, restituisce `Change[]`), `extract_theme` (ET).

Strade per un componente nuovo: *dal contratto* `CN → DC → GC`; *dal design* `DC (libera) → CD → GC`. Modifiche: aspetto → `AC`; struttura → `MS → AC`.

## Tema

```
seme theme.css (Tailwind v4 + ruoli shadcn) ──tokens_from_css──► set e temi Penpot
                                                                     │  (da qui la fonte è Penpot)
                                                                     ▼
                         extract_theme ──► theme.css · themes/<gruppo>-<nome>.css · fonts.css   [@generated]
```

- Le varianti di tema si dichiarano nel seme come `[data-<gruppo>="<nome>"]` e diventano set + tema Penpot.
- `extract_theme` legge **tutti** i set e i temi, non solo quelli attivi, e accetta nomi uguali in set diversi.
- Un'ombra con `spread` negativo diventa 0, un colore fuori sRGB il più vicino: sempre con un avviso.
- Il nome della variabile deriva dal tipo del token, non dal nome del set: un set nuovo produce una sezione nuova senza toccare il codice.
- Il tema Penpot **vince** nel CSS compilato: nessun blocco ridefinisce colori, raggi o font del tema.
- Font: `fonts.css` dalle famiglie del tema, pacchetti `@fontsource/*`, lo stesso file in Next e in Storybook; niente `next/font`.

## Componente

```
contratto dell'editor ─┐
                       ├─► verify_component ─► avvisi · blocchi · domande ──(pds-code chiede, scrive la risposta in Penpot)
Penpot (dal vivo) ─────┘                                │
                                                        ▼ nessuna domanda aperta
                                              generate_component (in ordine di build_order)
                                                        │
       <Comp>.styles.ts · <Comp>.stories.tsx  [@generated, versione + hash]      <Comp>.tsx  [scaffold una tantum, poi dello sviluppatore]
```

- **Chiave di parte.** `part=<chiave>` sul layer; in codice è `data-slot`. Il nome del layer serve solo a proporla. Chiavi doppie (tipiche dopo Ctrl+D) → domanda: *lista* (`repeat`) o *parte nuova*.
- **`styles.ts`** dichiara le parti: una `cva` per chiave, tutti gli assi, varianti delle istanze annidate. Il TSX usa quelle chiavi e `tsc` controlla il lato codice; la verifica controlla solo il lato Penpot.
- **Parte tolta dallo sviluppatore:** avviso (export inutilizzato). **Cambio di struttura:** si rigenera solo `styles.ts`; per ogni parte aggiunta, tolta o diventata lista la skill suggerisce la modifica del TSX con un esempio e la applica solo su richiesta.
- **Istanze:** un'istanza in Penpot diventa `<Comp />`; variante scelta dal designer e validata; override di stile vietati (il dimensionamento non è un override); testo dell'istanza solo d'esempio.
- **Esiti:** l'aspetto produce avvisi; un caso ambiguo è una domanda con le opzioni, la cui risposta si scrive in Penpot e non si richiede più; `generate_component` non scrive con domande aperte, chiavi doppie o parti senza chiave.
- **Ordine:** `build_order` genera un componente solo se esistono già i componenti che contiene. Niente livelli.
- **Fuori da Penpot:** un componente senza container è scritto a mano (contratto sì, niente generato, solo GA).

## Assi e stati

- Nel contratto solo assi `option`. Un field `structure` è un asse se Penpot ha una variante con lo stesso nome, altrimenti un rendering condizionale con `when=<field>` su una parte; senza asse né `when` → domanda.
- Focus e disabled: default nel CSS globale (anello `ring`, opacità 50%); una cella disegnata vince; il focus non si toglie.
- Hover e active: solo se disegnati, sull'asse riservato `state` (una cella per variante su una sola taglia, applicata col prefisso a tutte le taglie). Non è una prop; le celle mancanti non sono un errore.

## Geometria

- **Radice (a′):** la misura fissa della radice si ignora se è uguale in tutte le celle; se cambia tra le celle entra nella `cva` sotto l'asse.
- **Fuori scala:** valore arbitrario (`w-[37px]`) + avviso ripetuto con il valore in scala più vicino, per misure e posizioni.
- **Ritaglio:** `overflow-hidden` se un figlio esce o se il genitore ha raggio e un figlio tocca un bordo; niente se niente esce e non c'è contenuto variabile; domanda se niente esce ma c'è contenuto variabile (testo da field, immagine, slot).
- **Vincoli:** `left+right` e `top+bottom` si traducono; un vincolo non traducibile (`scale`) dà un avviso e nessuna classe; "fill" dentro hug è una domanda; con tutti i figli in fill la misura fissa del genitore si ignora.
- Ogni voce sta nel registro con la sua traduzione; le regole di contesto sono funzioni del nucleo.

## Sezioni

- **Componente:** tutti i pezzi li sceglie il designer. **Sezione:** almeno uno slot. Le parti proprie seguono le stesse regole in entrambi.
- Una sezione con parti proprie ha container, `styles.ts` e scaffold; una di sola disposizione no. Una forma disegnata in una sezione è una parte, non un errore.
- **Slot:** layer i cui figli sono tutti istanze dei componenti ammessi; se ambiguo → domanda, `slot=<id>`. Le istanze nello slot sono esempi.
- **Icona:** parte con chiave; quale icona la propone lo scaffold. **Story:** figli di default del contratto, una per cella.

## Comportamento e a11y

- Primitivo Base UI se esiste (lo scaffold lo usa, la skill propone solo il collegamento); altrimenti ricetta shadcn `base` letta dal vivo + pattern APG, mai salvata.
- Proposta: prima un elenco di comportamenti da scegliere, poi un diff piccolo per comportamento con conferma, e un test per ogni comportamento (file dello sviluppatore, eseguito da GA). Riproposta solo su richiesta o quando un cambio di struttura tocca una parte usata da un comportamento.
- Le dipendenze nuove le sceglie lo sviluppatore, con l'alternativa senza dipendenze.
- axe in GA, bloccante, su ogni story `@generated`; tastiera coperta dai test di comportamento; "testo + colore" è una voce fissa del giudizio in Storybook.

## CI e collaudo

**CI senza Penpot, quattro livelli:**
1. nucleo, testato con dati minimi scritti a mano;
2. server in memoria, con un adattatore Penpot finto, per gli schemi;
3. hash e versione dei file `@generated`: hash che non torna = blocco; versione vecchia con hash giusto = avviso;
4. ogni classe del registro, espansa sui token del tema generato, produce CSS con la Tailwind installata; più il test di `tokens_from_css` sul seme.

Nessuna lettura di Penpot salvata nel repo. Penpot si verifica solo in sessione, quando si rigenera.

**Collaudo degli aggiornamenti di Penpot.** Un componente campione che usa tutte le proprietà del registro e tutte le chiavi di plugin data, salvato come `.penpot` nel repo. A ogni aggiornamento: istanza nuova, import del campione, collaudo lanciato a mano; ogni proprietà del registro deve comparire nella lettura. Il Penpot vero (oggi 2.18.3) si aggiorna solo se il collaudo passa. Campione, test e procedura (backup, istanza `penpot-collaudo` sullo stesso compose, import, collaudo) stanno in `packages/scripts/collaudo/` (Story 2.25, [README](../../../packages/scripts/collaudo/README.md)). Quali operazioni di Penpot cancellano i plugin data si misura sul campione in un passo a parte *(voce di `deferred-work.md`, prima della 2.29)*.

## Limiti noti di Penpot e del kit

| Limite | Conseguenza |
|---|---|
| `createVariants.js` del kit: il clone annida una copia (2.17.2 e 2.18.3) | `pds-design` costruisce le celle da zero |
| `applyToken` lento con molti token (~0,8 s a legame) | una cella per chiamata, verifica in una chiamata separata |
| Il plugin perde lo `storage` al ricollegamento | elementi ritrovati da nomi e plugin data |
| `switchVariant` su un'istanza con override rinomina il layer | istanze riconosciute dal componente d'origine |
| Gli override non sono esposti dall'API | confronto con l'istanza principale |
| Board con ritaglio attivo per default | regole del ritaglio sopra |
| Scheda Penpot sospesa dal browser | finestra visibile o flag `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` |

## Invariato

`@generated` non si edita a mano; i file senza marker sono sempre preservati. Nessuna sincronizzazione ricorrente codice → Penpot. Un contratto dell'editor cambiato alza `SCHEMA_VERSION` (il gate rifiuta di riscrivere una voce del fingerprint).
