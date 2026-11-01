# TV — Variante di tema

Aggiunge una variante (un brand, un modo) al tema Penpot: **un set di colori con gli stessi nomi del tema base** e **un tema** che lo accende. La variante cambia valori, mai il vocabolario dei token.

## Ingresso

Il seme dichiara una variante così:

```css
[data-brand="ocean"] {
  --color-primary: var(--color-blue-600);
  --color-primary-foreground: var(--color-white);
  --color-ring: var(--color-blue-400);
}
```

`[data-<gruppo>="<nome>"]` diventa il set `"<gruppo>/<nome>"` e il tema (gruppo `<gruppo>`, nome `<nome>`). Il tema `"<gruppo>/default"` esiste già e non aggiunge set: è la base.

Chiedi quale variante serve (gruppo, nome) e da dove viene: dal seme, oppure nata in Penpot.

## Passi — variante dichiarata nel seme

1. Chiama `tokens_from_css { css }` sul seme **intero** (base + tutte le varianti: il tool le legge insieme e non vuole una variante da sola).
2. Mostra solo ciò che riguarda la variante: il set `"<gruppo>/<nome>"`, i token che sovrascrive, i `warnings` (in particolare «la variante sovrascrive un ruolo che il tema di default non definisce»). Il tool non controlla la copertura: se il designer vuole un tema completo, l'elenco dei ruoli di colore del base è il riferimento, e i ruoli assenti si dicono («in quel tema non cambiano»).
3. Conferma, poi crea **solo ciò che manca** in Penpot, con i nomi restituiti: il set nuovo (`addSet` + `toggleActive`), i token, il tema `addTheme({ group, name })` con il legame al set. Se set o tema esistono, non li ricrei: aggiungi solo i token mancanti o segnala la differenza.
4. Verifica in una chiamata separata: `tokenOverview()` per set e tema; confronta nomi e valori con l'uscita del tool. Un nome in più o un valore diverso è una differenza da mostrare, non da correggere in silenzio.
5. Esito in due righe: set e tema creati o già presenti, differenze, cosa manca perché la variante sia completa. Il passaggio al tema lo fa il designer dal pannello Tokens (il plugin non riesce a mostrarlo); digli come si fa e che dopo il riavvio si verifica di nuovo.

## Passi — variante nata in Penpot

1. Parti dai colori del set base: **gli stessi nomi**, uno per uno. Duplica i nomi in un set nuovo `<gruppo>/<nome>` e cambia solo i valori decisi dal designer (come fa `createThemes.js` di `penpot-foundations`, che restituisce la lista `missing` dei nomi non coperti).
2. `missing` non vuoto = variante incompleta: mostrala e fermati lì. Non riempire un buco inventando un colore: si chiede al designer o si copia il valore del base con il suo sì.
3. Crea il tema e lega il set; verifica in una chiamata separata.

## Non fai

- Non cambi i nomi dei token e non crei un token che il tema base non ha: il codice rigenerato usa i nomi del base.
- Non scrivi CSS né `packages/tokens/src/themes/*`: lo fa `pds-code` ET.
- Non scrivi plugin data `pagebuilder`.
- Non «sistemi» i valori di un tema esistente: o il designer li cambia in Penpot, o si passa da `pds-code` AC per l'aspetto in codice.
