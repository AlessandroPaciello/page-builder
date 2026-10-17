# Epic 2 Context: Design system — token e componenti da Penpot

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Generare in modo riproducibile dal catalogo Penpot il tema (token, varianti di tema, font) e gli stili dei componenti, con componenti React accessibili scritti dallo sviluppatore sopra quegli stili, visibili e testati in Storybook e verificati in CI senza Penpot. È la base su cui poggiano blocchi Puck, sezioni e composizioni dell'editor (Epic 3) e quindi tutte le pagine. Il regime in vigore è la **v3** (correct-course 2026-10-17): un solo contratto dell'editor per componente, Penpot letto dal vivo, `styles.ts` e story generati, componente dello sviluppatore, server MCP `pds` su un nucleo puro, due skill `pds-design` e `pds-code`. Le Story 2.1–2.16 (v1 e v2) sono storia: le loro decisioni non valgono più.

## Stories

Storia (v1/v2, done):
- Story 2.1: Pipeline token Penpot→codice
- Story 2.2: Estrazione componenti e schema delle ricette
- Story 2.3: Package dei contratti (Badge, Input, Accordion)
- Story 2.4: Bootstrap della library Penpot sui contratti
- Story 2.5: Estrazione adeguata — ricette per parti e token, validate contro il contratto
- Story 2.6: Emitter shadcn deterministico e gate CI
- Story 2.7: Pipeline pronta per più componenti
- Story 2.8: Registro delle proprietà e blocco per componente
- Story 2.9: Skill `pds-component` — creare e sincronizzare i componenti
- Story 2.10: Fedeltà live ed estrazione guidata dal contratto
- Story 2.11: Storybook del design system
- Story 2.12: Fondamenta v2 — due contratti, registro, guscio
- Story 2.13: `library` e `propose` — Penpot dal contratto di estrazione
- Story 2.14: `extract` e `render` — una istantanea, quattro file
- Story 2.15: ProductCard end-to-end e gate in CI
- Story 2.16: Rimozione della v1 e rigenerazione dei quattro componenti

Regime v3:
- Story 2.17: Il tema Penpot nel CSS compilato
- Story 2.18: Rimozione dei componenti di prova e della pipeline v2
- Story 2.19: Fixture sul catalogo Tailwind e codice nuovo dentro i confini
- Story 2.20: Nucleo puro e registro delle proprietà
- Story 2.21: Geometria e larghezza nel registro
- Story 2.22: Verifica e generazione — chiavi di parte, `styles.ts`, scaffold, story
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

- **Tema:** nasce da un seme `theme.css` (Tailwind v4 + ruoli shadcn), passa in Penpot; da lì Penpot è la fonte. La rigenerazione scrive `theme.css`, un file per variante di tema e `fonts.css`. Il tema Penpot deve **vincere nel CSS compilato**: nessun blocco o variabile shadcn/Tailwind ne ridefinisce colori, raggi o font. Il giro seme → Penpot → CSS chiude senza perdite.
- **Componenti:** si generano solo gli stili e le story; il componente React è dello sviluppatore e la rigenerazione non lo tocca mai (byte per byte).
- **Accessibilità (WCAG 2.1 AA):** focus visibile ≥3:1, mai tolto; stato comunicato da testo + colore; ARIA corretto per tipo; overlay su portale root condiviso. axe è bloccante su ogni story generata; la tastiera è coperta da test di comportamento; "testo + colore" è voce fissa del giudizio visivo in Storybook.
- **Coerenza design↔codice:** i file `@generated` portano versione del generatore e hash e non si editano a mano; i file senza marker sono sempre preservati. Nessun valore di design scritto a mano, nessuna proprietà Penpot persa in silenzio.
- **Confini:** `ui/src/domains` non importa da `editor/` (lint bloccante); Base UI importabile solo da `ui/src/domains`; ogni regola di confine ha un test rosso/verde.
- **CI senza Penpot**, a quattro livelli: nucleo con dati minimi scritti a mano; server in memoria con adattatore Penpot finto; hash/versione dei file `@generated` (hash sbagliato = blocco, versione vecchia con hash giusto = avviso); ogni classe del registro espansa sui token del tema produce CSS con la Tailwind installata.

## Technical Decisions

- **Un solo file per componente: il contratto dell'editor** in `@app/contracts` (`components/<nome>.ts` o `sections/<nome>.ts`), con soli assi `option`, field e slot, versionato da `SCHEMA_VERSION` + fingerprint (un cambio è un bump esplicito). Nessun altro metadato per componente nel repo: niente contratti di estrazione, istantanee, ricette, binding, fixture di lettura Penpot.
- **Fonti dell'informazione:** parti, albero, istanze annidate e variante, celle, token, layout e geometria vengono da **Penpot letto dal vivo** a ogni chiamata; elemento HTML, field → parte, icone, comportamento e a11y dal componente dello sviluppatore. Il legame è la **chiave di parte**, che in codice è `data-slot`.
- **Metadati in Penpot:** shared plugin data `pagebuilder` (`contract = nome@versione` sul container; `part`, `when`, `slot` e le risposte sui layer). Li scrive **solo `pds-code`**, via MCP Penpot, dopo conferma; mai stile, geometria, layer o token. Il nome del layer serve solo a proporre la chiave.
- **Generato vs dello sviluppatore:** `<Comp>.styles.ts` (una `cva` per chiave di parte, tutti gli assi, varianti delle istanze annidate) e `<Comp>.stories.tsx` (una per cella) sono `@generated`; `<Comp>.tsx` lo crea lo scaffold una volta. Il lato codice lo controlla `tsc`; la verifica guarda solo Penpot. Un cambio di struttura rigenera solo `styles.ts` e produce suggerimenti per il TSX, applicati solo su richiesta.
- **Esiti `Finding`:** avviso (aspetto), blocco, domanda con opzioni. Chiavi doppie, parti senza chiave e domande aperte fermano la generazione.
- **Assi e stati:** un field `structure` è asse se Penpot ha una variante omonima, altrimenti rendering condizionale con `when`; altrimenti domanda. Focus (anello `ring`) e disabled (opacità 50%) hanno un default nel CSS globale, una cella disegnata vince. Hover/active solo se disegnati sull'asse riservato `state` (prefisso su tutte le taglie), mai una prop.
- **Geometria:** ogni proprietà ha una voce nel registro; le regole di contesto sono funzioni del nucleo. Fuori scala → valore arbitrario con avviso e valore in scala più vicino; ritaglio, vincoli e misure con regole fisse.
- **Componente vs sezione:** sezione = contratto con almeno uno slot; slot = layer i cui figli sono tutti istanze ammesse (se ambiguo, domanda). Un'istanza diventa `<Comp />` con la variante scelta; override di stile vietati.
- **Comportamento:** primitivo Base UI se esiste, altrimenti ricetta shadcn `base` + pattern APG letti dal vivo e mai salvati; proposti un comportamento alla volta, con diff piccolo, conferma e test. Le dipendenze nuove le sceglie lo sviluppatore.
- **Script (`packages/scripts`, TypeScript):** `src/core` nucleo puro dati → dati (niente disco, rete, console, exit code), tipi zod `Lettura`/`Finding`/`Change`; `src/penpot` con `readComponent`, unico punto che parla con Penpot (`execute_code`); `src/server` server MCP `pds` senza stato, che rilegge Penpot a ogni chiamata, non scrive mai su Penpot e scrive lui i file `@generated`. Strumenti: `tokens_from_css`, `describe_component`, `verify_component`, `build_order`, `generate_component`, `extract_theme`. **Nessuna CLI di prodotto.**
- **Ordine:** niente livelli; `build_order` genera un componente solo se esistono già quelli che contiene.
- **Skill:** `pds-design` (verso Penpot: tema, varianti, contratti, disegno via penpot-ai-kit) e `pds-code` (verso il codice: tema, verifica, generazione, aggiornamento, gate); `pds-setup` fissa `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource` e rifiuta ogni altro valore. Ogni scrittura (contratti, Penpot, file) passa da una conferma umana.
- **Font:** `fontsource`, caricati dallo stesso file in Next e Storybook; niente `next/font`.
- **Stack pinnato:** Penpot self-hosted 2.18.3, penpot-ai-kit 0.5.1, `@base-ui/react` ^1.8.0, Tailwind 4. Il Penpot vero si aggiorna solo se passa il collaudo con il campione `.penpot` che usa ogni voce del registro.
- **Fuori da Penpot:** un componente senza container è scritto a mano (contratto sì, niente generato, solo gate). Il codice dello spike in `test-v3/` è riferimento, non si copia così com'è; nessuna cartella `v3/` nel repo.

## UX & Interaction Patterns

- Semantica ARIA per tipo: dialoghe modali con focus trap, toast con live region, tabelle con caption, tab, menu, breadcrumb con pagina corrente.
- Live region educata per salvataggi e cambi di stato, assertiva solo per errori bloccanti.
- Overlay su portale root condiviso sopra il canvas dell'editor, tooltip escluso.

## Cross-Story Dependencies

- Catena: 2.17 (indipendente) → 2.18 → 2.19 → 2.20 → {2.21, 2.22, 2.23}; 2.24 dopo 2.20 (schemi) e 2.23 per l'uso reale; 2.25 dopo 2.23 e 2.24; 2.26 dopo 2.24; 2.27 dopo 2.22 e 2.24; 2.28 dopo 2.24 e 2.26; 2.29 dopo 2.24 e 2.25; 2.30 dopo 2.29; 2.31 dopo tutte; 2.32 dopo 2.31.
- Il collaudo (2.25) misura quali operazioni Penpot cancellano gli shared plugin data **prima** che le skill ci scrivano.
- Epic 3 consuma i risultati: Story 3.2 (blocchi Puck solo sugli assi `option`) e 3.4 (sezioni nell'editor) dipendono da contratti, stili e sezioni di questa epic (2.27); il core di Epic 4 valida i payload con gli stessi contratti, che la v3 lascia invariati.
- Retro Epic 1: l'azione aperta sulla fragilità dei `check-boundaries.mjs` si chiude per `packages/scripts` nella 2.19.
