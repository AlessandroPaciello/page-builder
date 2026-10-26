# Epic 2 Context: Design system — token e componenti da Penpot

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Generare in modo riproducibile dal catalogo Penpot il tema (token, varianti di tema, font) e gli stili dei componenti, con sopra componenti React accessibili scritti dallo sviluppatore, visibili e testati in Storybook, e verificati in CI senza Penpot. Il regime in vigore è la **v3** (correct-course 2026-10-17): un solo contratto dell'editor per componente, Penpot letto dal vivo, `styles.ts` e story generati, componente dello sviluppatore, server MCP `pds` sopra un nucleo puro, due skill `pds-design` e `pds-code`. Le Story 2.1–2.16 (v1 e v2) restano solo come storia: il loro modello (contratti di estrazione, istantanee, ricette, sei comandi, ruoli di parte, livelli L0–L3) non vale più. È la base su cui l'Epic 3 costruisce blocchi, sezioni e composizioni.

## Stories

- Story 2.1–2.16: storia v1/v2 (done, non si riscrivono)
- Story 2.17: Il tema Penpot nel CSS compilato (done)
- Story 2.18: Rimozione dei componenti di prova e della pipeline v2 (done)
- Story 2.19: Fixture sul catalogo Tailwind e codice nuovo dentro i confini (done)
- Story 2.20: Nucleo puro e registro delle proprietà (done)
- Story 2.21: Geometria e larghezza nel registro (done)
- Story 2.22: Verifica e generazione — chiavi di parte, `styles.ts`, scaffold, story (done)
- Story 2.23: Adattatore Penpot `readComponent`
- Story 2.24: Server MCP `pds` e controllo dei file generati in CI
- Story 2.25: Collaudo degli aggiornamenti di Penpot
- Story 2.26: Tema da seme CSS, varianti di tema e font
- Story 2.27: Sezioni
- Story 2.28: Skill `pds-design` e configurazione di progetto
- Story 2.29: Skill `pds-code`
- Story 2.30: Comportamento accessibile
- Story 2.31: Rigenerazione dei componenti di prova con la v3
- Story 2.32: Libreria componenti accessibile

## Requirements & Constraints

- Il tema nasce da un seme `theme.css` (Tailwind v4 + ruoli shadcn), passa in Penpot, poi la fonte è Penpot; la rigenerazione scrive `theme.css`, un file per variante di tema e `fonts.css`, e il giro seme → Penpot → CSS chiude senza perdite. Il tema Penpot vince nel CSS compilato.
- Si generano solo stili e story; il componente React è dello sviluppatore e la rigenerazione non lo tocca mai (byte per byte).
- File `@generated` con versione del generatore e hash, mai editati a mano; i file senza marker sono sempre preservati.
- **Ogni bug noto ha la sua story e un test rosso/verde.**
- Accessibilità WCAG 2.1 AA: focus visibile ≥3:1 (mai tolto), stato = testo + colore, ARIA corretto, overlay su portale root condiviso; axe bloccante su ogni story generata; tastiera coperta dai test di comportamento.
- Nessuna misura persa in silenzio: ogni proprietà del registro ha una traduzione o produce un esito esplicito.
- Ogni scrittura (contratti, plugin data Penpot, file) passa da una conferma umana; la fedeltà visiva è un giudizio umano in Storybook, con "testo + colore" come voce fissa.
- Il frontend consuma solo `@penpot-ds/ui`; Base UI è importabile solo da `ui/src/domains`; i componenti dei domini non importano da `editor/`.
- Domini della libreria: data-display, inputs, feedback, layout, navigation, overlays, commerce.

## Technical Decisions

- **Un file per componente:** il contratto dell'editor in `packages/contracts/src/components/<nome>.ts` (o `sections/<nome>.ts`), con soli assi `option`, field e slot, versionato da `SCHEMA_VERSION` + fingerprint. Un cambio di contratto alza entrambi. Nessun altro metadato per componente nel repo, nessuna lettura di Penpot salvata.
- **Provenienza:** parti, albero, istanze e variante, celle, token, layout e geometria vengono da Penpot letto dal vivo a ogni chiamata; elemento HTML, field → parte, icone, comportamento e a11y stanno nel componente dello sviluppatore. Il legame è la chiave di parte (`data-slot` in codice).
- **Metadati in Penpot:** shared plugin data `pagebuilder` (`contract=nome@versione` sul container; `part`, `when`, `slot` e le risposte alle domande sui layer). Li scrive solo `pds-code`, via MCP Penpot, con conferma; mai stile, geometria, layer o token. Il nome del layer serve solo a proporre la chiave.
- **Generazione:** `<Comp>.styles.ts` (una `cva` per chiave di parte, tutti gli assi, varianti delle istanze annidate) e `<Comp>.stories.tsx` (una per cella); scaffold di `<Comp>.tsx` una tantum. Il lato codice lo controlla `tsc`; la verifica controlla solo il lato Penpot. Un cambio di struttura rigenera solo `styles.ts` e produce suggerimenti sul TSX, mai applicati da soli.
- **Esiti (`Finding`):** avviso (aspetto, valori fuori scala, export inutilizzato), blocco (es. override di stile su un'istanza), domanda con opzioni (parte senza chiave, chiavi doppie → `repeat` o parte nuova, casi ambigui). `generate_component` non scrive finché restano chiavi doppie, parti senza chiave o domande aperte.
- **Stati:** `state` è un nome d'asse riservato in Penpot, mai una prop; hover/active solo se disegnati, applicati col prefisso a tutte le taglie; focus (anello `ring`) e disabled (opacità 50%) hanno un default globale nel livello `base`, una cella disegnata vince.
- **Geometria:** regola (a′) sulla misura fissa della radice; fuori scala → valore arbitrario + avviso col valore in scala più vicino; regole di ritaglio fisse; "fill" dentro hug → domanda; `scale` → avviso senza classe.
- **Ordine:** niente livelli; `build_order` genera un componente solo se esistono già quelli che contiene.
- **Script (`packages/scripts`, TypeScript):** `src/core` nucleo puro dati → dati (niente disco, rete, console, exit code; tipi zod `Lettura`, `Finding`, `Change` con nome e senza versione; registro unico delle proprietà senza tabella ruolo → proprietà); `src/penpot` con `readComponent`, unico punto che parla con Penpot (`execute_code`), elementi ritrovati da nomi e plugin data, mai dallo `storage`; `src/server` server MCP `pds`, unico guscio, senza stato, non scrive mai su Penpot, scrive lui i file `@generated`. Strumenti: `tokens_from_css`, `describe_component`, `verify_component`, `build_order`, `generate_component`, `extract_theme`. Nessuna CLI di prodotto; confini imposti da `check-boundaries.mjs` con test rosso/verde.
- **CI senza Penpot, quattro livelli:** 1) nucleo con dati minimi scritti a mano; 2) server in memoria con adattatore Penpot finto; 3) hash/versione dei file `@generated` (hash errato = blocco, versione vecchia = avviso); 4) ogni classe del registro espansa sui token produce CSS con la Tailwind installata, più il giro di `tokens_from_css` sul seme.
- **Collaudo Penpot:** campione `.penpot` nel repo che usa ogni voce del registro e ogni chiave di plugin data, lanciato a mano su un'istanza nuova; il Penpot vero si aggiorna solo se passa.
- **Comportamento:** primitivo Base UI se esiste; altrimenti ricetta shadcn `base` + pattern APG letti dal vivo, mai salvati; un diff piccolo e un test per comportamento; le dipendenze nuove le sceglie lo sviluppatore.
- **Sezioni:** contratto con almeno uno slot; slot = layer i cui figli sono tutti istanze dei componenti ammessi; una forma disegnata è una parte; una sezione di sola disposizione non ha `styles.ts` né scaffold; la story usa i figli di default del contratto.
- **Configurazione `pds-setup`:** `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource`; ogni altro valore è rifiutato esplicitamente. Font via `@fontsource/*` dallo stesso file in Next e Storybook, niente `next/font`.
- **Fuori da Penpot:** un componente senza container (3D, mappe, configuratori) è scritto a mano: contratto sì, niente di generato, solo il gate.
- **Ambiente e limiti noti:** Penpot locale fissato a 2.18.3, penpot-ai-kit 0.5.1. Limiti da gestire: clone annidato di `createVariants.js` (celle costruite da zero), `applyToken` lento (una cella per chiamata, verifica separata), `switchVariant` rinomina il layer (istanze riconosciute dal componente d'origine), override non esposti dall'API, `spread` negativo e colori fuori sRGB (→ avviso), scheda Penpot sospesa dal browser.
- **Stack:** Penpot self-hosted 2.18.3, penpot-ai-kit 0.5.1, `@base-ui/react` ^1.8.0, `@fontsource/*`.
- **Cartelle di `packages/scripts`:** `src/server` riceve l'adattatore per iniezione (solo `src/server/main.ts` importa da `src/penpot`); `collaudo/` contiene il campione `.penpot`; il comando `theme` resta fino alla 2.26.
- Il codice dello spike in `test-v3/` è riferimento, non si copia; nessuna cartella `v3/` nel repo.

## UX & Interaction Patterns

- Le skill sono sequenze di conferme, non di comandi: mostrano le domande con opzioni, scrivono la risposta in Penpot e non la richiedono più.
- `pds-design`: voci TB (tema base), TV (variante di tema), CN (nuovo contratto), DC (disegna componente via kit), CD (contratto dal design), MS (modifica di struttura); un controllo di stato mostra al designer chiavi mancanti o doppie. Il designer non scrive metadati.
- `pds-code`: voci ET (estrai tema), VC (verifica), GC (genera + giudizio in Storybook), AC (riallinea stili e suggerisce modifiche al TSX), GA (gate: `tsc`, test, tema nel CSS, contrasto, axe, un pacchetto font per famiglia).
- Le skill fanno da wrapper al kit Penpot dove ha senso, senza trigger in conflitto con quelli del kit; non scrivono mai un file `@generated`.

## Cross-Story Dependencies

- Catena: 2.23 → 2.20; 2.24 → 2.20 (schemi) e 2.23 per l'uso reale (può partire in parallelo a 2.23); 2.25 → 2.23, 2.24; 2.26 → 2.24; 2.27 → 2.22, 2.24; 2.28 → 2.24, 2.26; 2.29 → 2.24, 2.25; 2.30 → 2.29; 2.31 → tutte le precedenti; 2.32 → 2.31.
- Il collaudo (2.25) misura quali operazioni di Penpot cancellano i plugin data prima che le skill ci scrivano.
- 2.31 rifà Badge (strada dal contratto), ShopCard con istanze di Badge (strada dal design) e la sezione Carousel, nell'ordine di `build_order`.
- Epic 3 dipende da questo epic: blocchi Puck come adapter dei contratti e sezioni nell'editor (Story 3.4 riscritta, ritocco a 3.2 senza assi `state`/`behavior`). Contratti, fingerprint, `SCHEMA_VERSION` e payload Puck restano invariati per le Epic 4–6.
