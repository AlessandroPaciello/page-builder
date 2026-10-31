# Spike — penpot-ai-kit e la pipeline Penpot → codice

- **Data:** 2026-10-10/11 · **Branch:** `spike/penpot-ai-kit` (da `develop`, `999ba13`)
- **Kit valutato:** [penpot/penpot-ai-kit](https://github.com/penpot/penpot-ai-kit) v0.5.1 (`fe4f99e`, 2026-10-07), CC BY 4.0
- **Stato:** prove A–F concluse (F = simulazione completa delle skill sul Carousel); pronto per la forgia
- **Alimenta:** `bmad-forge-idea` (poi `bmad-module-builder`, ed eventualmente `bmad-correct-course` per AD-11)

## Contenuto della cartella

| File | Cosa |
|---|---|
| **README.md** | questo documento: sintesi, decisioni, modello proposto, problemi, punti aperti |
| [prove.md](prove.md) | dettaglio delle prove A–F, in ordine |
| [recipes/](recipes/) | ricette ricavate dai sorgenti shadcn: [Card](recipes/card.md) (`base-nova`), [Carousel](recipes/carousel.md) (`base`) |
| [tailwind-to-penpot/](tailwind-to-penpot/) | seme del tema (`theme.css`), convertitore CSS → token, estrazione per tema, output d'esempio |
| [test-v3/](test-v3/README.md) | il modello nuovo su due casi d'uso — **[Carousel](test-v3/carousel/README.md)** (simulazione completa delle skill, da presentare) e [ShopCard](test-v3/shop-card/README.md) — e **tutto il codice dello spike** (`codice/`, `patch/`) |

## Sintesi

1. **Il kit è compatibile con la pipeline.** Un designer che parte da un file vuoto con il kit arriva al codice generato; gli attriti sono di convenzione (nomi di assi e layer, token tipografici, plugin data), non di struttura.
2. **Il tema può nascere da un CSS Tailwind.** Seme `theme.css` (Tailwind v4 + ruoli shadcn) → token Penpot → di nuovo CSS, comprese le varianti di brand: il giro si chiude senza perdite e il codice generato torna idiomatico (`bg-primary`, `text-sm`).
3. **La composizione funziona.** Un Badge dentro una card è un'istanza in Penpot e diventa `<Badge />` nel codice, con variante scelta dal designer e override vietati.
4. **Un generatore generico è possibile.** Il prototipo v3 genera la ShopCard da due contratti piccoli e dalla lettura di Penpot, senza una riga specifica per quel componente, con un risultato molto vicino al disegno.
5. **Stili generati, componente dello sviluppatore** (decisione 11). Il generatore scrive solo l'aspetto (`<Comp>.styles.ts`); il componente React è codice libero. Un cambio di aspetto in Penpot diventa una riga di `styles.ts`, un cambio di struttura una proposta da approvare; il codice scritto a mano non viene mai riscritto.
6. **Il percorso delle skill regge su un componente nuovo e complesso.** La [simulazione sul Carousel](test-v3/carousel/README.md) va dal primo prompt al componente funzionante in 8 passi e 4 approvazioni: ricetta → contratti → disegno in Penpot → codice, con una sezione con slot e molto comportamento.
7. **La pipeline attuale ha bug seri**, il più grave dei quali è che **il tema Penpot non arriva nel CSS compilato** (vedi Problemi).
8. **Lo spike non è partito dalle decisioni già prese.** Cambia consapevolmente AD-11 v2, ma è in conflitto con la spine 2026-10-03 su cinque punti (verifica che blocca, letture salvate, headless, ruoli di parte, ordine dei livelli): vedi [Confronto con le decisioni precedenti](#confronto-con-le-decisioni-precedenti).

## Decisioni di Alessandro

| # | Decisione |
|---|---|
| 1 | Le skill `pds` fanno da **wrapper** alle skill ufficiali di penpot-ai-kit, dove ha senso, invece di reimplementarle |
| 2 | **Nessuno script tra i contratti e Penpot:** i componenti li crea il designer con il kit, tramite `pds`. Spariscono `library` (comando, writer, `COMPONENT_TOKENS`, `SAMPLE_TEXT`). Cambia AD-11: "solo `library` scrive su Penpot" → "su Penpot scrive il designer col kit, via `pds`" |
| 3 | **Tema da seme CSS:** la skill porta un `theme.css` (Tailwind v4 + ruoli shadcn); il bootstrap lo porta in Penpot; poi la fonte è Penpot e l'estrazione rigenera `theme.css` più un file per variante (`themes/<gruppo>-<nome>.css`) |
| 4 | **Varianti di tema** dichiarate nel seme come `[data-<gruppo>="<nome>"]` → set + tema Penpot |
| 5 | **Due skill:** `pds-design` (verso Penpot) e `pds-code` (verso il codice), con i comandi sotto; `pds-setup` resta |
| 6 | **Due strade per un componente nuovo:** *dal contratto* o *dal design*; in entrambe **la skill propone i contratti** e lo sviluppatore approva |
| 7 | **Composizione con istanze** (D1–D5): variante scelta dal designer e validata; override di stile vietati; testo dell'istanza solo d'esempio (nel codice dal field); istanze annidate ammesse; contratto dell'editor invariato |
| 8 | *(rivista il 2026-10-11)* **Nessun file per componente oltre al contratto dell'editor** (AD-1/CAP-4 della spine 2026-10-03: zero metadati per componente). Struttura e aspetto si leggono da Penpot; elemento HTML, field → parte, a11y e comportamento stanno nel componente dello sviluppatore (decisione 11). Il collegamento per componente usato nel prototipo è superato |
| 9 | Contratto dell'editor della ShopCard corretto: link relativi, immagine e testo del badge facoltativi |
| 10 | Penpot locale fissato a **2.18.3** (compose, con backup prima della migrazione) |
| 11 | **Stili generati, componente tuo:** il generatore scrive solo `<Comp>.styles.ts`; `<Comp>.tsx` è dello sviluppatore dopo lo scaffold (più elasticità sul codice) |
| 12 | Il **Carousel** è una **sezione** con slot di `shop-card` (come l'Accordion): `perView` 1–3, `autoplay` e `interval` impostabili da chi compone, solo orizzontale; il Button arriverà dopo |
| 13 | La **categoria** della ShopCard (T6) è obbligatoria ed è uno `span`; come ogni cambio del contratto dell'editor passa da un aumento di `SCHEMA_VERSION` (il gate rifiuta di riscrivere una voce): 6 per `category`, 7 per `carousel` |

## Il modello proposto

### Le due skill

| Skill | Codice | Comando |
|---|---|---|
| **pds-design** | TB | Tema base: seme `theme.css` → set e temi Penpot (via `penpot-foundations`) |
| | TV | Variante di tema |
| | CN | Contratto nuovo: ricetta → domande → proposta dei contratti → approvazione |
| | DC | Disegna componente (dal contratto o libera), via `penpot-component-factory`; plugin data; verifica di salvataggio |
| | CD | Contratto dal design: bozza ricavata da Penpot → approvazione |
| | MS | Modifica struttura: diff sui contratti → approvazione |
| **pds-code** | ET | Estrai tema |
| | VC | Verifica: blocca solo per struttura, il resto sono avvisi |
| | GC | Genera `styles.ts` e story; scaffold del componente se non esiste; giudizio in Storybook; propone il comportamento come diff |
| | AC | Rigenera `styles.ts`, riassume i cambi; per la struttura propone il diff del componente |
| | GA | Gate: typecheck, test, tema nel CSS, contrasto |

Strade: *dal contratto* `CN → DC → GC`; *dal design* `DC (libera) → CD → GC`. Modifiche: aspetto → `AC`; struttura → `MS → AC`.

### Da dove viene ogni informazione di un componente

Un solo file per componente scritto e approvato: il **contratto dell'editor**. Niente altro metadato per componente (decisione 8, AD-1).

| Informazione | Fonte |
|---|---|
| varianti, field, slot (ciò che usano l'editor e le pagine salvate) | **contratto dell'editor**: `packages/contracts/src/components/<nome>.ts`, o `sections/<nome>.ts` per una sezione con slot; versionato da `SCHEMA_VERSION` + fingerprint; scritto dalla skill (CN/CD/MS), approvato |
| parti, albero, componenti annidati e variante scelta, quando una parte esiste (celle), aspetto (token), geometria | **Penpot**, letto live (plugin data `nome@versione` sul container) |
| assi delle celle di una sezione | field `enum` della sezione con lo stesso nome della proprietà di variante in Penpot |
| contenuto di uno slot | layer i cui figli sono istanze dei componenti ammessi dallo slot: in Penpot sono esempi |
| elemento HTML, field → parte, icone, a11y, comportamento, cartella | **componente dello sviluppatore** (decisione 11): lo scaffold li propone, l'umano conferma, poi sono codice |
| legame tra Penpot e codice | `data-slot` = nome della parte in Penpot (convenzione shadcn) |

Esempi: [contratto della ShopCard](test-v3/codice/packages/contracts/src/components/shop-card.ts), [sezione Carousel](test-v3/codice/packages/contracts/src/sections/carousel.ts).

### Gli script: 5, tutti generici

| Script | Usato da | Stato |
|---|---|---|
| `css-to-tokens` (seme → token) | TB, TV | prototipo ✅ |
| estrazione del tema (Penpot → CSS per tema) | ET | prototipo ✅ (`theme` da estendere) |
| reader Penpot (celle, token, layout, dimensionamento, istanze, ritaglio, dimensioni, vincoli) | CD, MS, VC, GC, AC | esiste; corretto nel prototipo |
| verifica (struttura = blocco, aspetto = avviso; parti ↔ `data-slot`) | VC, GC, AC, MS | prototipo ✅ |
| generatore (`styles.ts`, scaffold, story) | GC, AC | prototipo ✅ |

In creazione non c'è nessuno script nostro (kit + skill). Divisione dei ruoli: lo script trova i fatti, la skill li spiega e propone cosa fare.

### Il codice del componente è dello sviluppatore

Decisione 11. Il generatore possiede **solo l'aspetto**; il componente è dello sviluppatore, come con shadcn.

```
commerce/
  ShopCard.styles.ts   ← @generated: una cva per parte (tutti gli assi) + varianti delle istanze annidate
  ShopCard.tsx         ← tuo: GC lo crea una volta (scaffold), poi non lo tocca più
```

| Cambio | Cosa succede |
|---|---|
| aspetto in Penpot | si rigenera solo `<Comp>.styles.ts` |
| il tuo codice (stato, eventi, a11y, elementi in più, wrapper) | lo scrivi nel componente: nessun aggancio |
| struttura in Penpot | VC confronta le parti con i `data-slot`: parte mancante nel codice = blocco, elemento solo del codice = avviso; una parte tolta sparisce da `styles.ts` e TypeScript la segnala; AC propone il diff del JSX da approvare |

Provato sulla ShopCard (prove.md, T4b-2, T5, T6: file modificato a mano rimasto identico dopo le rigenerazioni) e sul Carousel (prova F: comportamento proposto dalla skill e approvato). Superati gli agganci provati prima (`behavior.ts`, `aria`, eject: T4b-1). Esempi: [`ShopCard.tsx`](test-v3/codice/packages/ui/src/domains/commerce/ShopCard.tsx), [`Carousel.tsx`](test-v3/codice/packages/ui/src/domains/layout/Carousel.tsx) e i rispettivi `styles.ts`.

## Problemi trovati

### Nella pipeline attuale (da correggere comunque)

| Problema | Effetto | Dove | Prova |
|---|---|---|---|
| **Il tema Penpot non entra nel CSS compilato** | le classi usano le variabili shadcn e i default Tailwind; i cambi del designer non arrivano al browser | `@import` a metà di `packages/ui/src/styles/globals.css`; `@theme inline` shadcn che ridefinisce colori, raggi e font | C-6, E |
| Il reader live non legge il layout flex | componenti senza `flex`/allineamenti | `library-reader.ts` (`styleOf`) | A-13 |
| Il dimensionamento "fill" non si legge | blocchi che non occupano la larghezza | reader + registro | E |
| Lo spessore del bordo non genera classi | bordi invisibili | registro: `strokeWidth` è `coveredByBase` (residuo v1) | E |
| `fontFamily` non registrato | font non legato (Penpot 2.18 usa il singolare) | registro | V-2 |
| `theme` legge solo i set attivi e rifiuta i nomi duplicati | niente varianti di tema; CSS che dipende dal tema acceso | `theme/penpot-reader.ts`, generatore del tema | C-2 |
| La struttura dipende dalla tabella dei token di partenza — *sparito con la v2 (Story 2.18)* | nessun componente nuovo leggibile senza codice | `library-plan.ts` (`COMPONENT_TOKENS`) | D-4 |
| Render scritto a mano per componente — *sparito con la v2 (Story 2.18); il generatore generico resta alla 2.22* | ogni componente nuovo richiede codice | `render.ts` | D, E |
| Contratti di estrazione caricati tutti all'avvio della CLI — *sparito con la v2 (Story 2.18)* | un contratto cambia, si rompe `theme` | `registry.ts` | E |
| Template dei test cablati; log di `extract` — *sparito con la v2 (Story 2.18)* | test fragili, messaggi fuorvianti | `render.ts`, `extract.ts` | A-14, A-15 |
| Il reader non leggeva ritaglio, dimensioni fisse, posizione degli assoluti, "fill" verticale | frecce e pallini senza misura, card fuori dal contenitore | `library-reader.ts`, generatore (corretto nel prototipo) | F-7, F-8 |
| D2 contava come override il dimensionamento di un'istanza | blocco su card in "fill" dentro uno slot | `instanceInfo` del reader (corretto nel prototipo) | F-6, F-8 |
| La pipeline conosce solo contratti di componente | una sezione con slot non si legge né si genera | da leggere da contratto della sezione + Penpot (prototipo con un adattatore) | F-3 |
| Test di `scripts` rotti dallo spike | 45 rossi: fixture col catalogo vecchio, confini violati da `v3/` | catalogo, `v3/` | F |

### Limiti di Penpot, del kit e dell'ambiente

| Limite | Conseguenza per `pds` |
|---|---|
| `createVariants.js` del kit: il clone annida una copia (2.17.2 e 2.18.3) | il wrapper costruisce le celle da zero |
| Ombre con `spread` negativo rifiutate | il convertitore porta lo spread a 0 con avviso |
| 95 colori Tailwind v4 fuori sRGB | ridotti al più vicino, con avviso |
| `applyToken` lento con molti token (~0,8 s a legame) | una cella per chiamata, verifica in una chiamata separata |
| Il plugin perde lo `storage` al ricollegamento | ritrovare gli elementi da nomi e plugin data |
| `switchVariant` su un'istanza con override rinomina il layer | riconoscere le istanze anche dal componente, non solo dal nome |
| Gli override non sono esposti dall'API | confronto con l'istanza principale |
| Altezza "come la più alta": con tutti i figli in fill Penpot fissa il genitore; Stretch incoerente | regola del generatore: misura fissa ignorata se tutti i figli riempiono l'asse |
| Board con ritaglio attivo per default | `overflow-hidden` quasi ovunque: decidere quando leggerlo |
| Scheda Penpot sospesa dal browser | documentare: finestra visibile o flag `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` |

## Confronto con le decisioni precedenti

Lo spike non è partito dalle decisioni già prese: va confrontato con la [spine 2026-10-03](../../initiative-page-builder/architecture-page-builder-2026-10-03/ARCHITECTURE-SPINE.md) (estrazione-costruzione, con la [spec](../../specs/spec-penpot-estrazione-costruzione/SPEC.md)) e con AD-11 v2 della [spine 2026-07-25](../../initiative-page-builder/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md), che la prima eredita. Esito: ✅ coerente · ⚠️ in conflitto, da decidere · 🔁 cambia consapevolmente (da registrare nel correct-course).

### Spine 2026-10-03 (estrazione-costruzione)

| Decisione | Cosa dice | Lo spike | Esito |
|---|---|---|---|
| AD-1 | nessun runtime: la skill guida; `packages/scripts` non guida né vincola il flusso; **zero metadati per componente** (CAP-4) | la skill guida tutti i passi; metadati per componente tolti (decisione 8 rivista); restano 5 script (reader, verifica, generatore, tema) chiamati dalla skill | ✅ metadati · ⚠️ script: leggono e generano su richiesta della skill, ma la verifica può bloccare |
| AD-2, CAP-5 | conferma umana unico gate; regole come fix, **mai blocchi muti** | ogni scrittura (contratti, Penpot, diff del componente) passa da un'approvazione; VC però **blocca** da script | ⚠️ VC: trasformare i blocchi in proposte di fix confermate |
| AD-3, CAP-1 | rilettura live a ogni stadio; **mai cache né fixture** | letture salvate (`--snapshot`) usate per generare, per aggirare la scheda Penpot sospesa; punto aperto 5 proponeva una copia della lettura nel repo | ⚠️ nel flusso solo lettura live; le letture salvate restano materiale dello spike |
| AD-4, CAP-2 | profili headless+token versionati (`packages/scripts/profiles/`), Base UI | nessun profilo; il comportamento del Carousel è scritto a mano senza headless | ⚠️ non coperto |
| AD-5, CAP-8 | mai mani su `@generated`; un token un proprietario (generato Penpot vince); componenti esistenti solo per diff | `styles.ts` solo dal generatore; componente dello sviluppatore aggiornato per diff approvati; correzione di `globals.css` (C-6) fa vincere il tema Penpot | ✅ |
| AD-6, CAP-9 | un solo vocabolario verso Puck: Tailwind theme v4 | seme `theme.css` Tailwind v4 → Penpot → di nuovo CSS | ✅ |
| AD-7, CAP-7 | fedeltà = giudizio umano, nessuno score | giudizio in Storybook (negativo sul primo Carousel, decisivo) | ✅ |
| AD-8, CAP-6 | il gate mostra 4 controlli: plugin data → contratto esistente, **ruoli di parte nel vocabolario chiuso**, token nel theme, nomi | plugin data ✅, token (avvisi) ✅, nomi in parte; **ruoli di parte tolti** | ⚠️ ruoli |
| AD-9 | livelli L0 → L3 in ordine: un livello si apre solo a precedente completo | Carousel (organismo) prima del Button (atomo) | ⚠️ deroga non registrata: registrarla o rifare in ordine |
| Convenzione a11y | il comportamento accessibile entra dal primitivo headless, mai disegnato | a11y nel codice dello sviluppatore, proposta dalla skill | ⚠️ con AD-4 |

### AD-11 v2 (spine 2026-07-25, rivista il 2026-09-17)

| Regola | Cosa dice | Lo spike | Esito |
|---|---|---|---|
| Due contratti | page builder (nel fingerprint) + estrazione `<nome>.extract.ts` | un solo contratto (editor); il resto da Penpot o dal codice | 🔁 (decisione 8) |
| Ruoli di parte | vocabolario chiuso `surface`/`text`/`icon`/`divider`/`image` nel contratto di estrazione | registro per tipo di layer, senza ruoli | 🔁 / ⚠️ (vedi AD-8) |
| Istantanea | `data/components/<nome>.json`, unico artefatto generato; il suo diff è la review del design | nessuna istantanea: la review è il diff di `styles.ts` | 🔁 (coerente con AD-3 della spine 10-03) |
| Render | tutto `@generated` (componente, test, story, barrel), nessuna base | solo `styles.ts` e story generati; componente dello sviluppatore | 🔁 (decisione 11) |
| Headless per parte | Base UI come elemento della parte; a11y dal primitivo | nessun headless | ⚠️ (vedi AD-4) |
| Sei comandi; solo `library` scrive su Penpot | `theme`, `library`, `extract`, `render`, `gates`, `propose` | due skill (pds-design, pds-code); su Penpot scrive il designer col kit | 🔁 (decisioni 2 e 5) |
| Composizione ≠ componente | Accordion, hero, sezioni: definizioni di sezione in `contracts` | Carousel come sezione | ✅ |
| Logica propria (Table, **Carousel**…) | in Penpot solo un segnaposto; adapter scritto a mano, senza marker | Carousel disegnato in Penpot, stili generati, comportamento nel codice dello sviluppatore | 🔁 da registrare: con la decisione 11 il segnaposto non serve più |
| Pass/fail | negli script e negli schemi, mai nel prompt di una skill | VC blocca da script | ✅ qui, ma ⚠️ con la spine 10-03 (AD-2): le due regole vanno conciliate |
| `@generated` | mai a mano; i file senza marker sono preservati | idem | ✅ |

**In sintesi:** lo spike è coerente sul vocabolario del tema, sulla fedeltà giudicata dall'umano, sui file generati e sull'aggiornamento per diff. Cambia consapevolmente AD-11 v2 (un contratto, niente istantanea, componente dello sviluppatore, scrittura su Penpot dal designer). Resta in conflitto con la spine 2026-10-03 su: verifica che blocca, letture salvate, profili headless e a11y, ruoli di parte, ordine dei livelli. Questi punti vanno risolti nella forgia, uno per uno, prima del correct-course.

## Punti aperti per la forgia

1. **Chi genera il codice:** deciso (11): generatore deterministico per l'aspetto, scaffold una tantum per la struttura, poi il componente è dello sviluppatore.
2. **Uno o due contratti:** deciso (8, rivista): un solo contratto, quello dell'editor; nessun file per componente.
3. **Gli script in Python?** Alessandro lo ritiene la soluzione giusta per le skill. Nodo: contratti, registro e generatore del tema sono TypeScript; servirebbe un'esportazione dei contratti in JSON come confine stabile.
4. **Ogni script, uno per uno:** input e output stabili, cosa può cambiare senza rompere gli altri, test, aggiornamenti di Penpot e Tailwind. Richiesta esplicita di Alessandro, per evitare intoppi nelle evoluzioni.
5. **Copia della lettura di Penpot nel repository:** in conflitto con AD-3 della spine 2026-10-03 (mai cache né fixture); da decidere se serve davvero (CI senza Penpot) o se resta solo la lettura live.
6. **Componente dello sviluppatore:** come AC propone il diff del JSX dopo un cambio di struttura; se lo scaffold genera anche il test; quali controlli restano a VC senza un file per componente (es. "testo senza field") e quali passano al gate della skill con conferma umana.
7. **Larghezza dei componenti** (fissa in Penpot, non un token) e caricamento del webfont.
8. **Render generico prima della 2.18** (libreria dei sei domini).
9. **AD-11 e i "sei comandi" della v2** cambiano: correct-course.
10. **Sezioni nella pipeline** (prova F): assi dai field `enum` della sezione, slot riconosciuti da Penpot (istanze dei componenti ammessi), ripetizioni e icone riconosciute da Penpot e decise allo scaffold, story con i figli di default; chiarire la differenza tra componente con slot e sezione (AD-11 "Composizione ≠ componente").
11. **Comportamento proposto dalla skill** dopo lo scaffold (prova F, B): come la skill lo scrive e lo mostra, e quando ripropone (cambi di struttura).
12. **Geometria in Penpot**: dimensioni fisse fuori scala, vincoli degli assoluti, ritaglio di default, "fill" sul genitore auto.
13. **Test dello spike**: riallineare le fixture al catalogo Tailwind e portare `v3/` dentro i confini prima di riapplicare il codice. **Chiuso con la Story 2.19**: catalogo Tailwind dei test in `packages/scripts/tests/fixtures/tailwind-catalog.json`; il gate di `scripts` conosce `src/core`, `src/penpot`, `src/server` e vieta le cartelle `v3`.

## Stato

| Dove | Cosa c'è |
|---|---|
| Penpot "Nuovo File 5" | prova A (vocabolario del kit, due container Badge) |
| Penpot "tailwind" | set `tailwind`, `semantic`, `brand/ocean`; temi `mode/light`, `brand/default`, `brand/ocean`; container `Badge` e `ShopCard` (con istanze del Badge; raggio `radius.2xl` e parte `Category` dopo T5/T6, `Content` in fill), `Carousel` (`perView` 1/2/3, istanze di ShopCard) |
| Codice dello spike | **solo** in [`test-v3/`](test-v3/README.md) (`codice/` + `patch/`); `packages/` sul branch è pulito, le patch si applicano. Nessun worktree (perso il 2026-10-11) |
| Branch `spike/penpot-ai-kit` | `4feaedb` (spike), `6cded58` (prova F) e il riordino dei casi d'uso |
| `docker/penpot/docker-compose.yml` | Penpot 2.18.3, committato in `4feaedb` |
| Backup Penpot | `~/Scrivania/projects/penpot-backups/2026-10-10-pre-2.18.3/` |
