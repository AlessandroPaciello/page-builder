# Il kit come strumento, il progetto come regola

`pds-design` non reimplementa il kit: chiama le sue skill e cambia solo i punti in cui il progetto ha deciso diversamente. Vale per tutte le voci.

## Delega

| Skill del kit | Usata da | Cosa fa | Cosa aggiunge `pds-design` |
|---|---|---|---|
| `penpot-foundations` | TB, TV | set e token (`addSet`, `set.addToken`), alias semantici, temi (`addTheme`), legame dei token (`applyToken`), validazione (`validateTokens.js`) | i nomi e i valori arrivano da `tokens_from_css`, non da una scala proposta dal kit; un token nuovo si approva, non si inventa |
| `penpot-component-factory` | DC | board di base con flex, matrice di varianti, container di varianti, validazione | le celle si costruiscono **da zero** (non col clone di `createVariants.js`), una per chiamata, verifica separata; gli assi sono quelli del contratto e i nomi dei layer quelli delle parti |
| `penpot-rename-layers` | DC (su richiesta) | rinomina i layer senza nome in nomi semantici | solo su richiesta e solo sui layer senza nome: un layer che il designer ha nominato non si tocca |

Quando la skill del kit è installata, leggila e seguila, applicando sopra le divergenze di questa pagina. Quando non lo è, la procedura della reference si esegue lo stesso con `execute_code` e `penpot_api_info`: non si copia codice del kit nel repo, non si inventano file di script.

## Cosa cambia rispetto al kit

- **Il plugin data lo scrive `pds-code`.** Un container disegnato da DC non ha `pagebuilder/contract`; senza quel dato la lettura per contratto non trova nulla e si passa dal nome del layer. Dillo al designer: è atteso, e `pds-code` lo scrive dopo la conferma.
- **Il raggruppamento è una chiamata, senza ripiego.** Le celle sciolte `Component / Axis=Value` non sono leggibili come componente: `describe_component` cerca un container per contratto o per nome e ne legge uno solo, e una cella senza assi non risponde al nome kebab del componente. Il raggruppamento lo fa `group_variants` (uno strumento del server `pds`, non il kit), dopo la conferma: un nome incompleto o la cella di partenza mancante è un rifiuto che nomina la cella, e nessuna scrittura parte; le combinazioni non disegnate sono una nota. Se la chiamata fallisce, DC si ferma e lo riporta: non lascia celle separate e non torna al kit per un ripiego.
- **Un token un proprietario.** Il vocabolario è quello che `tokens_from_css` restituisce e che `extract_theme` rigenera; il kit propone scale (Minor Third, griglia 4 px) solo quando non c'è nulla da cui partire.
- **Niente stato persistente.** Non salvi letture Penpot nel repo, non tieni cache fra le chiamate: Penpot si rilegge quando serve.

## Limiti da ricordare (Penpot e kit)

| Limite | Conseguenza |
|---|---|
| `applyToken` asincrono (~100 ms, ~0,8 s con molti token) e lega per nome | applica a blocchi di ~25–40 forme, verifica in una chiamata successiva, ritenta i buchi; mai applicare e rileggere nello stesso `execute_code` |
| `createVariants.js` annida una copia nel clone | una cella per chiamata, costruita da zero |
| Mutare le varianti (`setVariantProperty`, rinomina di assi, detach) può corrompere il file: i salvataggi successivi si bloccano | prima di raggruppare, chiedi di duplicare il **file** (non la pagina); il raggruppamento è la chiamata `group_variants` di `draw-component.md` (idempotente: una seconda chiamata non cambia niente), l'aggiunta di un asse a un container esistente segue la procedura di `draw-component.md` sullo stesso file duplicato, e `library.local.components` deve elencare un componente per container. Se la chiamata non torna entro ~30 s, fermati e riportalo: non si torna ai componenti separati |
| Un set nuovo nasce inattivo | `set.toggleActive()` prima di aggiungere token che lo referenziano |
| I tipi di token sono camelCase/plurale (`borderRadius`, `fontSizes`, `fontFamilies`) | verifica con `penpot_api_info('Token')` se non sei sicuro |
| I board ritagliano per default | il ritaglio non si "sistema" a mano: si legge dopo (è la pipeline a decidere) |
| La scheda Penpot sospesa dal browser ferma il plugin | finestra visibile, o i flag `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` |
| Il plugin perde lo `storage` al ricollegamento | ritrova gli elementi da nome e plugin data, non da un id salvato in memoria |

## Come si chiede un sì

Mostra **una** cosa per volta: il file da scrivere (o il suo diff), oppure l'export della cella appena disegnata. Poi una domanda sola: «Procedo?». Se la risposta cambia qualcosa, rifai l'anteprima: un sì vecchio non vale per una scrittura diversa.

L'esito non è mai la tua impressione: per i contratti è l'exit code dei test del package, per Penpot è la lettura successiva che ritrova gli elementi.
