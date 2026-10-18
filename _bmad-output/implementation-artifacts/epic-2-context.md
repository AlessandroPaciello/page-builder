# Epic 2 Context: Design system — token e componenti da Penpot

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Generare in modo riproducibile, dal catalogo Penpot, il tema (token, varianti di tema, font) e gli stili dei componenti di `packages/ui/src/domains`. I componenti React accessibili li scrive lo sviluppatore sopra gli stili generati, e sono visibili e testati in Storybook. La CI li verifica senza Penpot. Il regime in vigore è la **v3**: un solo contratto dell'editor per componente, Penpot letto dal vivo, `styles.ts` e story generati, componente dello sviluppatore, un server MCP `pds` sopra un nucleo puro e due skill (`pds-design`, `pds-code`). Le Story 2.1–2.16 (v1 e v2) restano solo come storia e non vanno riprese né riscritte. Il codice dello spike in `test-v3/` è un riferimento e non si copia così com'è.

## Stories

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

- **Tema:** nasce da un seme `theme.css` (Tailwind v4 con i ruoli shadcn) e viene portato in Penpot. Da quel momento la fonte è Penpot, e la rigenerazione scrive `theme.css`, un file per variante di tema e `fonts.css`. Nel CSS compilato vince il tema Penpot.
- **Componenti:** si generano solo `<Comp>.styles.ts` e `<Comp>.stories.tsx`, marcati `@generated` con versione del generatore e hash, e non si editano mai a mano. `<Comp>.tsx` lo crea lo scaffold una sola volta; da lì in poi è dello sviluppatore e la rigenerazione non lo tocca. I file senza marker restano sempre intatti.
- **Accessibilità (WCAG 2.1 AA):** focus visibile (contrasto ≥3:1), stato comunicato con testo e colore insieme, ARIA corretto, overlay su un portale root condiviso. axe è bloccante su ogni story generata e la tastiera è coperta dai test di comportamento.
- **Confine UI:** il frontend consuma solo `@penpot-ds/ui`. Base UI si importa solo da `ui/src/domains/**`. `domains/` non importa mai da `editor/`, e lo garantisce un lint bloccante.
- **CI senza Penpot, su quattro livelli:**
  1. nucleo testato con dati minimi scritti a mano;
  2. server in memoria con un adattatore Penpot finto;
  3. hash e versione dei file `@generated`;
  4. ogni classe del registro, espansa sui token, produce CSS con la Tailwind installata.
- **Nessuna lettura di Penpot salvata nel repo.**
- **Ogni bug noto ha la sua story e un test rosso/verde.** Il bug 14 (45 test di `scripts` rossi applicando lo spike, per fixture col catalogo vecchio e `v3/` fuori dai confini) appartiene alla 2.19.

## Technical Decisions

- **Un solo file per componente:** il contratto dell'editor in `packages/contracts/src/components/<nome>.ts`, oppure `sections/<nome>.ts` per una sezione. Contiene solo assi `option`, field e slot, ed è versionato da `SCHEMA_VERSION` più il fingerprint. Non esistono contratti di estrazione, istantanee, binding o ricette salvate.
- **Da dove arrivano le informazioni:**
  - parti, albero, istanze, celle, token, layout e geometria arrivano da Penpot, letto dal vivo a ogni chiamata;
  - elemento HTML, comportamento e a11y li decide il componente dello sviluppatore;
  - il legame tra Penpot e codice è la chiave di parte, che in codice è `data-slot`.
- **Metadati in Penpot:** shared plugin data `pagebuilder` (`contract`, `part`, `when`, `slot`, risposte). Li scrive solo `pds-code`, previa conferma. Il server non scrive mai su Penpot.
- **Esiti della verifica:** `Finding` di tipo avviso, blocco o domanda. Chiavi doppie, parti senza chiave e domande aperte fermano `generate_component`.
- **Script in TypeScript dentro `packages/scripts`:**
  - `src/core` è il nucleo puro: funzioni dati → dati, senza disco, rete, console, exit code né MCP; legge `@app/contracts`;
  - `src/penpot` contiene `readComponent`, l'unico punto che parla con Penpot (`execute_code`);
  - `src/server` è il server MCP `pds`: senza stato, con sei strumenti, scrive lui i file `@generated` e riceve l'adattatore per iniezione;
  - `collaudo/` contiene il campione `.penpot`;
  - non c'è nessuna CLI di prodotto. Il comando `theme` resta fino alla 2.26.
- **Tipi zod `Lettura`, `Finding`, `Change`:** hanno un nome e nessuna versione.
- **Configurazione `pds-setup`:** `framework=react`, `headless=base-ui`, `styling=tailwind-v4`, `fonts=fontsource`. Ogni altro valore viene rifiutato esplicitamente.
- **Ordine di generazione:** `build_order` genera un componente solo se esistono già i componenti che contiene. Non ci sono livelli.
- **Stack:** Penpot self-hosted 2.18.3, penpot-ai-kit 0.5.1, `@base-ui/react` ^1.8.0, `@fontsource/*`.

### Rilevante per la Story 2.19

- **Fixture:** i test di `scripts` devono usare un catalogo token derivato dal seme Tailwind dello spike (`tailwind-to-penpot/theme.css`), scritto a mano come dati e non letto da Penpot.
- **Confini nuovi:** `check-boundaries.mjs` di `packages/scripts` deve coprire `src/core`, `src/penpot` e `src/server` con queste regole:
  - il nucleo non importa né disco, né rete, né MCP;
  - solo `src/penpot` parla con Penpot;
  - `src/server` non importa da `src/penpot`, salvo nel punto di iniezione dell'adattatore.
- **Test dei confini:** ogni regola di confine ha un test automatico rosso/verde. Chiude un'azione aperta dalla retro Epic 1: i `check-boundaries.mjs` scritti a mano erano bypassabili e non avevano test propri, si verificavano solo con un canary manuale. Per `ui`, `domain` e `api` la story sceglie se coprirli ora o lasciarli aperti.
- **Niente cartella `v3/`:** il codice nuovo vive nelle cartelle del seed.

## Cross-Story Dependencies

- **Catena delle dipendenze:**
  - 2.18 dipende da 2.17; 2.19 da 2.18; 2.20 da 2.19;
  - 2.21, 2.22 e 2.23 dipendono da 2.20;
  - 2.24 dipende da 2.20 per gli schemi e da 2.23 per l'uso reale, quindi può partire in parallelo a 2.21–2.23;
  - 2.25 dipende da 2.23 e 2.24; 2.26 da 2.24; 2.27 da 2.22 e 2.24;
  - 2.28 dipende da 2.24 e 2.26; 2.29 da 2.24 e 2.25; 2.30 da 2.29;
  - 2.31 dipende da tutte le precedenti; 2.32 da 2.31.
- **I confini della 2.19 sono la verifica di purezza del nucleo** su cui si appoggia la 2.20. Le fixture del catalogo Tailwind servono ai test di livello 1 e 4.
- **Il collaudo della 2.25** misura quali operazioni di Penpot cancellano i plugin data. Deve arrivare prima che le skill (2.28–2.29) ci scrivano.
- **Epic 3:** la 3.4 (sezioni nell'editor) e la 3.2 (contratto senza assi `state`/`behavior`) dipendono da questo modello. Contratti, fingerprint, `SCHEMA_VERSION` e payload Puck restano invariati per le Epic 4–6.
