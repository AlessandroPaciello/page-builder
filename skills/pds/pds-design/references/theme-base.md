# TB — Tema base dal seme

Porta in Penpot un tema Tailwind v4 con i ruoli shadcn, partendo dal seme `theme.css`. Da qui in poi la fonte è Penpot: il seme serve una volta, e `pds-code` ET riporterà il tema in `packages/tokens/src` quando lo chiederà lui.

## Ingresso

Chiedi il file del seme. Candidati: quello che l'utente indica; altrimenti `packages/tokens/src/theme.css`, cioè l'ultimo giro Penpot → CSS. Se è quello, dillo: è `@generated` e riporta in Penpot lo stato dell'ultimo ET, non un tema nuovo; se Penpot è più avanti, il giro riporterebbe indietro dei valori.

Il seme deve essere un `theme.css` Tailwind v4 con i ruoli shadcn (`--color-*`, `--radius-*`, `--font-*`, `--spacing-*`, ombre) e le varianti come `[data-<gruppo>="<nome>"]`. Se manca il seme, non inventarne uno: senza tema non c'è TB.

## Passi

1. **Lettura.** Leggi il seme (sola lettura) e chiama `tokens_from_css { css }` sul server `pds`. Mostra: numero di set, numero di temi, elenco dei nomi (`sets[].name`, `themes[].group/name`), e **tutti** i `warnings` così come sono. Un avviso non si nasconde né si «aggiusta» in silenzio: spread negativo portato a 0, colore fuori sRGB ridotto al più vicino, variabile saltata. Sono cose che il designer deve sapere.
2. **Conferma.** Una domanda sola: i set e i temi proposti si creano così? Il sì vale per i nomi e i valori mostrati; se cambia qualcosa, ricalcola da `tokens_from_css`.
3. **Set e temi.** Segui `penpot-foundations` (fasi primitive → semantiche → temi) con **i nomi e i valori del tool**, non con una scala proposta dal kit: il tool restituisce i set `tailwind` (valori letterali), `semantic` (riferimenti `var()`), un set `<gruppo>/<nome>` per ogni variante, e i temi (`<gruppo>/default` senza set, più un tema per variante).
   - Idempotente per nome: se il set esiste, non lo ricrei e non lo rinomini; aggiungi solo i token mancanti. Un set nuovo nasce inattivo: `set.toggleActive()` prima di aggiungere token che lo referenziano.
   - `addSet({ name })`, `set.addToken({ type, name, value })` con i tipi esatti (`borderRadius`, `fontSizes`, `fontFamilies`, …): verifica con `penpot_api_info('TokenSet')` / `('Token')` se un membro non ti torna.
   - Un tema per ogni voce di `themes`: `addTheme({ group, name })` e poi il legame ai set del tema come fa `createThemes.js`. Se dopo un riavvio i set non risultano attaccati al tema, è un limite noto: chiedi al designer di attaccarli dal pannello Tokens e verifica di nuovo.
   - Una chiamata `execute_code` per set (o per blocco), poi la verifica in una chiamata **separata**.
4. **Verifica.** `tokenOverview()` in una chiamata nuova: confronta set e nomi con l'uscita del tool. Riporta mancanti, in più e valori diversi. Zero mancanti = TB fatto; un nome in più nei set del seme è un token che il seme non prevede — mostralo, non cancellarlo.
5. **Esito.** Dillo in due righe: set creati/già presenti, temi, avvisi. Ricorda che il file `theme.css` in codice **non** è stato scritto: lo rigenera `pds-code` ET.

## Non fai

- Non scrivi CSS né `packages/tokens/src/*`: TB va solo verso Penpot.
- Non scrivi plugin data `pagebuilder`.
- Non rinomini token o set esistenti e non cambi valori senza un sì: la coerenza col catalogo esistente viene prima.
- Non crei token «che serviranno»: solo quelli del seme.
