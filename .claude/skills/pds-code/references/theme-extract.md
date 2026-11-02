# ET — Estrai tema

Riporta in `packages/tokens/src` il tema che vive in Penpot. Da qui in poi la fonte è Penpot: il seme `theme.css` ha già fatto il suo giro (TB, in `pds-design`) e questo è il ritorno. I file sono tutti `@generated`: li scrive `extract_theme`, mai a mano.

## Ingresso

Chiedi conferma che il file Penpot aperto sia quello giusto (nome del file e pagina) e che il plugin MCP sia connesso. ET legge **tutti** i set e i temi, non solo quelli attivi: se in Penpot c'è una variante non attiva, arriva lo stesso nel CSS.

## Passi

1. **Lettura.** Una sola `execute_code` (sola lettura) per mostrare cosa cambierà:

   ```js
   const catalog = penpot.library.local.tokens;
   return {
     sets: catalog.sets.map((set) => ({ name: set.name, tokens: set.tokens.length })),
     themes: catalog.themes.map((theme) => ({ group: theme.group, name: theme.name, sets: theme.activeSets.map((set) => set.name) })),
   };
   ```

   Confronta con lo stato del repo: `packages/tokens/src/themes/` (un file per variante) e i set citati in `packages/tokens/src/theme.css` (`/* set: … */`). Dì in due righe cosa cambia: set nuovi o spariti, varianti nuove o sparite.

2. **Conferma.** Una domanda sola: `extract_theme` riscrive `theme.css`, `tokens.generated.ts`, i `themes/*.css` e `fonts.css` in `packages/tokens/src/` da questi set e temi — procedo? Il sì vale per i set e i temi mostrati; se in Penpot cambia qualcosa dopo il sì, rileggi e richiedi.

3. **Estrazione.** `extract_theme { fonts: "fontsource" }` sul server `pds`. Restituisce `{ written, packages }`:
   - `written`: i path relativi a `packages/tokens/src/`. Se un file non era nell'anteprima, dillo: il tema in Penpot è cambiato dopo il sì.
   - `packages`: i `@fontsource/*` che servono. Confrontali con `packages/tokens/package.json`: i mancanti si **elencano** e li installa lo sviluppatore (`pnpm --filter @penpot-ds/tokens add <pacchetto>`), la skill non sceglie dipendenze.

4. **Verifica.** `pnpm --filter @penpot-ds/ui test src/styles/fonts.test.ts src/styles/theme-contrast.test.ts` (o GA): una famiglia senza pacchetto e una coppia di ruolo sotto soglia sono rosse. Poi `git diff --stat -- packages/tokens/src` per dire quante righe sono cambiate e in quali file.

5. **Esito.** Due righe: set e temi riportati, file scritti, pacchetti da installare, controlli verdi o rossi. Se un controllo è rosso, il difetto è nel tema in Penpot: si corregge là (con `pds-design` TB/TV) e si riesegue ET; non si aggiusta il CSS.

## Cosa non fai

- Non scrivi né modifichi `theme.css`, `themes/*.css`, `fonts.css` o `tokens.generated.ts` a mano: un file `@generated` toccato è un blocco di GA.
- Non scrivi plugin data `pagebuilder` e non tocchi Penpot: ET va solo da Penpot al codice.
- Non installi pacchetti né cambi `packages/tokens/package.json` di tua iniziativa: elenchi e chiedi.
- Non nascondi un errore del generatore (collisione di nomi, variante con un token assente dalla base, nome di set o tema non identificatore): si mostra com'è e si corregge in Penpot.
