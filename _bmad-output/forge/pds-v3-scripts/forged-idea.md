# pds v3: script, linguaggio e confini (punti 3–4 del README)

Esito: **HARDENED** (2026-10-17). Continua la [forgia pds v3](../pds-v3-penpot-ai-kit/forged-idea.md), le cui 9 regole restano ferme. Fonte: [spike penpot-ai-kit](../../spikes/penpot-ai-kit-2026-10-10/README.md).

## Decisioni
1. **TypeScript**, in `packages/scripts`: il nucleo legge `@app/contracts`. Nessun export JSON dei contratti.
2. **Nucleo puro + un adattatore + un guscio.**
   - Il nucleo è fatto di funzioni che ricevono dati e restituiscono dati: niente disco, rete, console o codice di uscita.
   - `readComponent` è l'unico punto che parla con Penpot (`execute_code`).
   - Il guscio non prende decisioni.
3. **Il guscio è un server MCP `pds`, senza CLI di prodotto.**
   - Non tiene stato: rilegge Penpot live a ogni chiamata (regola 5).
   - Non scrive su Penpot (decisione 2 dello spike).
   - Entra appena il nucleo ha i primi schemi stabili.
4. **Strumenti:**
   - `tokens_from_css` (TB/TV)
   - `describe_component` (CD/MS)
   - `verify_component` (VC)
   - `build_order` (GC)
   - `generate_component` (GC/AC): `styles.ts`, story, scaffold se manca il TSX; restituisce `Change[]`
   - `extract_theme` (ET)
5. **I file `@generated` li scrive il server**, non l'agente. `generate_component` non scrive se ci sono chiavi doppie o parti senza chiave: prima risponde chi lancia la skill (regola 4).
6. **Versioni.** I tipi interni (`Lettura`, `Finding`, `Change`) sono zod con un nome ma senza versione. I file generati che restano nel repo hanno in `@generated` la versione del generatore e l'hash. In CI:
   - hash che non torna: **blocco**;
   - versione vecchia con hash che torna: **avviso**.
7. **CI senza Penpot, quattro livelli:**
   - nucleo, testato con dati minimi scritti a mano;
   - server in memoria, con un adattatore Penpot finto, per controllare gli schemi;
   - hash e versione dei file generati;
   - ogni classe del registro, espansa sui token del tema generato, produce CSS con la Tailwind installata (più il test di `cssToTokens` sul seme).
8. **Collaudo degli aggiornamenti di Penpot.**
   - Un componente campione che usa tutte le proprietà del registro, salvato come `.penpot` nel repo.
   - A ogni aggiornamento: istanza nuova, import del campione, collaudo lanciato a mano.
   - Ogni proprietà del registro deve comparire nella lettura e il campione deve usarle tutte.
   - Il Penpot vero si aggiorna solo se il collaudo passa.

## Scartato
- **Python:** era un'opzione, non un bisogno. Il problema reale era la leggibilità, che dipende dalla struttura del codice e non dal linguaggio.
- **Server proxy che scrive anche su Penpot:** contraddice la decisione 2 dello spike.
- **CLI come guscio della skill:** l'ingresso è una stringa Bash che si verifica solo dopo il lancio, l'uscita è mescolata al rumore di `pnpm`, e il nome del componente (scritto dal designer) finisce in una riga di shell.
- **Fixture della lettura di Penpot per i test dell'adattatore:** copre solo il parsing TS e non vede le proprietà che il codice dentro Penpot non legge. È anche vietata dalla regola 5.
- **Versione sui tipi interni:** nessuno li rilegge.

## Rischi residui
- Il server va riavviato a ogni modifica del nucleo, e mentre sviluppi il dubbio "codice vecchio o nuovo?" resta.
- Se il server non parte, la skill non ha strumenti: niente piano B da CLI.
- Il collaudo vede solo le proprietà già nel registro. Una migrazione dell'import `.penpot` può sembrare un guasto dell'adattatore.

## Aperto
- Punti 7, 8, 10–13 del README dello spike.
