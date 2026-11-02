# AC — Riallinea stili

Il disegno è cambiato in Penpot e il codice deve seguirlo. Un cambio di **aspetto** (un colore, un raggio, una spaziatura, un token, lo stile di una cella) si porta in `styles.ts` rigenerandolo; un cambio di **struttura** (una parte aggiunta, tolta o diventata lista) arriva come suggerimento e si applica al TSX solo su richiesta. Il TSX dello sviluppatore resta identico byte per byte.

## Ingresso

Il componente e cos'è cambiato in Penpot. Se il cambio è di struttura (un asse in più, una parte nuova, uno slot che ammette un altro componente) la strada è `pds-design` MS prima, poi AC: il contratto deve seguire il disegno. Se il cambio è del **tema** (un token di colore, un raggio, un font), la voce è ET, non AC.

## Passi

1. **Verifica prima di toccare.** `verify_component { name }`: un blocco o una domanda nuova (per esempio un layer aggiunto senza `part`) si risolve in VC prima di rigenerare. Mostra i finding nuovi rispetto al giro precedente.

2. **Rigenerazione.** `generate_component { name }` (dopo `build_order` se il componente contiene istanze). Restituisce `{ changes, findings, suggestions, written }`. `written` deve contenere `<Comp>.styles.ts` (e `<Comp>.stories.tsx` se le celle sono cambiate).

3. **Prova che il TSX è intatto.** Il `<Comp>.tsx` è dello sviluppatore:

   ```bash
   git diff --stat -- packages/ui/src/domains/<nome>
   git diff --exit-code -- packages/ui/src/domains/<nome>/<Comp>.tsx
   ```

   Il primo comando elenca solo i file `@generated` cambiati; il secondo deve uscire 0 (nessuna differenza). Se il TSX è cambiato, fermati: `generate_component` non lo tocca, quindi è una modifica esterna — riportala, non annullarla di nascosto.

4. **Cambi di struttura, come diff.** Ogni `suggestions` (parte `aggiunta`, `rimossa`, `lista`) si mostra all'utente come diff del TSX — l'esempio del suggerimento più la riga da cambiare — e si **applica solo se l'utente lo chiede**. Un cambio di struttura non si annuncia come «già fatto».

5. **Esito.** Due righe: cosa è cambiato in `styles.ts` (quali classi, quali token), il TSX identico, i suggerimenti mostrati e non applicati. Se il cambio tocca una parte usata da un comportamento, chiedi se riproporre il comportamento (GC, passo 4).

## Cosa non fai

- Non scrivi `styles.ts` a mano: lo rigenera `generate_component`, e un file `@generated` toccato è un blocco di GA.
- Non applichi un suggerimento di struttura senza richiesta, e non modifichi il TSX «per far tornare i tipi».
- Non porti un cambio di tema con AC: quello è ET.
- Non nascondi un diff: se `styles.ts` cambia in un punto che l'utente non si aspetta, mostralo e fermati.
