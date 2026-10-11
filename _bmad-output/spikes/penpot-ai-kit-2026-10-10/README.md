# Spike — penpot-ai-kit e la pipeline Penpot → codice

- **Data:** 2026-10-10 · **Branch:** `spike/penpot-ai-kit` (da `develop`, `999ba13`)
- **Kit valutato:** [penpot/penpot-ai-kit](https://github.com/penpot/penpot-ai-kit) v0.5.1 (`fe4f99e`, 2026-10-07), CC BY 4.0
- **Stato:** prove A–E svolte, tutte le prove svolte (A–E, T4b-2, T5, T6): pronto per la forgia
- **Alimenta:** `bmad-forge-idea` (poi `bmad-module-builder`, ed eventualmente `bmad-correct-course` per AD-11)

## Contenuto della cartella

| File | Cosa |
|---|---|
| **README.md** | questo documento: sintesi, decisioni, modello proposto, problemi, punti aperti |
| [prove.md](prove.md) | dettaglio delle prove A–E, in ordine |
| [recipes/](recipes/) | ricetta della Card ricavata dal sorgente shadcn `base-nova` |
| [tailwind-to-penpot/](tailwind-to-penpot/) | seme del tema (`theme.css`), convertitore CSS → token, estrazione per tema, output d'esempio |
| [test-v3/](test-v3/README.md) | test del modello nuovo sulla ShopCard: **tutto il codice dello spike** (file nuovi in `codice/`, modifiche ai file esistenti in `patch/`), lettura di Penpot, foto di Storybook |

## Sintesi

1. **Il kit è compatibile con la pipeline.** Un designer che parte da un file vuoto con il kit arriva al codice generato; gli attriti sono di convenzione (nomi di assi e layer, token tipografici, plugin data), non di struttura.
2. **Il tema può nascere da un CSS Tailwind.** Seme `theme.css` (Tailwind v4 + ruoli shadcn) → token Penpot → di nuovo CSS, comprese le varianti di brand: il giro si chiude senza perdite e il codice generato torna idiomatico (`bg-primary`, `text-sm`).
3. **La composizione funziona.** Un Badge dentro una card è un'istanza in Penpot e diventa `<Badge />` nel codice, con variante scelta dal designer e override vietati.
4. **Un generatore generico è possibile.** Il prototipo v3 genera la ShopCard da due contratti piccoli e dalla lettura di Penpot, senza una riga specifica per quel componente, con un risultato molto vicino al disegno.
5. **La pipeline attuale ha bug seri**, il più grave dei quali è che **il tema Penpot non arriva nel CSS compilato** (vedi Problemi).

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
| 8 | Il **collegamento** registra ciò che cambia **struttura o comportamento** (componente annidato, `when`, field, elemento HTML, a11y); l'**aspetto** si legge da Penpot |
| 9 | Contratto dell'editor della ShopCard corretto: link relativi, immagine e testo del badge facoltativi |
| 10 | Penpot locale fissato a **2.18.3** (compose, con backup prima della migrazione) |
| 11 | **Stili generati, componente tuo:** il generatore scrive solo `<Comp>.styles.ts`; `<Comp>.tsx` è dello sviluppatore dopo lo scaffold (più elasticità sul codice) |

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
| | GC | Genera `styles.ts` e story; scaffold del componente se non esiste; giudizio in Storybook |
| | AC | Rigenera `styles.ts`, riassume i cambi; per la struttura propone il diff del componente |
| | GA | Gate: typecheck, test, tema nel CSS, contrasto |

Strade: *dal contratto* `CN → DC → GC`; *dal design* `DC (libera) → CD → GC`. Modifiche: aspetto → `AC`; struttura → `MS → AC`.

### I contratti di un componente

| | Contratto dell'editor | Collegamento |
|---|---|---|
| File | `packages/contracts/src/components/<nome>.ts` | `packages/scripts/src/contracts/<nome>.binding.ts` |
| Contiene | varianti e field per chi compone le pagine | elemento HTML, parte → field, componenti annidati, `when`, a11y, dominio |
| Scritto da | la skill (CN/CD), approvato | la skill (CN/CD), approvato |
| Versione | `SCHEMA_VERSION` + fingerprint (pagine salvate) | — |

Esempio: [contratto dell'editor](test-v3/codice/packages/contracts/src/components/shop-card.ts) e [collegamento](test-v3/codice/packages/scripts/src/contracts/shop-card.binding.ts).

### Gli script: 5, tutti generici

| Script | Usato da | Stato |
|---|---|---|
| `css-to-tokens` (seme → token) | TB, TV | prototipo ✅ |
| estrazione del tema (Penpot → CSS per tema) | ET | prototipo ✅ (`theme` da estendere) |
| reader Penpot (celle, token, layout, dimensionamento, istanze) | CD, MS, VC, GC, AC | esiste; corretto nel prototipo |
| verifica (struttura = blocco, aspetto = avviso) | VC, GC, AC, MS | prototipo ✅ |
| generatore | GC, AC | prototipo ✅ |

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

Provato sulla ShopCard (prove.md, T4b-2): file modificato a mano rimasto identico dopo la rigenerazione. Superati gli agganci provati prima (`behavior.ts`, `aria`, eject: T4b-1). Esempio: [`ShopCard.tsx`](test-v3/codice/packages/ui/src/domains/commerce/ShopCard.tsx) e [`ShopCard.styles.ts`](test-v3/codice/packages/ui/src/domains/commerce/ShopCard.styles.ts).

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
| La struttura dipende dalla tabella dei token di partenza | nessun componente nuovo leggibile senza codice | `library-plan.ts` (`COMPONENT_TOKENS`) | D-4 |
| Render scritto a mano per componente | ogni componente nuovo richiede codice | `render.ts` | D, E |
| Contratti di estrazione caricati tutti all'avvio della CLI | un contratto cambia, si rompe `theme` | `registry.ts` | E |
| Template dei test cablati; log di `extract` | test fragili, messaggi fuorvianti | `render.ts`, `extract.ts` | A-14, A-15 |

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
| Scheda Penpot sospesa dal browser | documentare: finestra visibile o flag `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` |

## Punti aperti per la forgia

1. **Chi genera il codice:** deciso (11): generatore deterministico per l'aspetto, scaffold una tantum per la struttura, poi il componente è dello sviluppatore.
2. **Uno o due contratti:** proposta due file, entrambi scritti dalla skill.
3. **Gli script in Python?** Alessandro lo ritiene la soluzione giusta per le skill. Nodo: contratti, registro e generatore del tema sono TypeScript; servirebbe un'esportazione dei contratti in JSON come confine stabile.
4. **Ogni script, uno per uno:** input e output stabili, cosa può cambiare senza rompere gli altri, test, aggiornamenti di Penpot e Tailwind. Richiesta esplicita di Alessandro, per evitare intoppi nelle evoluzioni.
5. **Copia della lettura di Penpot nel repository** (come l'istantanea di oggi), da scrivere con AC: permetterebbe di rigenerare e di verificare in CI senza Penpot.
6. **Componente dello sviluppatore:** come AC propone il diff del JSX dopo un cambio di struttura; se lo scaffold genera anche il test; cosa resta nel collegamento dopo lo scaffold (serve ancora a VC per istanze e `when`).
7. **Larghezza dei componenti** (fissa in Penpot, non un token) e caricamento del webfont.
8. **Render generico prima della 2.18** (libreria dei sei domini).
9. **AD-11 e i "sei comandi" della v2** cambiano: correct-course.

## Stato

| Dove | Cosa c'è |
|---|---|
| Penpot "Nuovo File 5" | prova A (vocabolario del kit, due container Badge) |
| Penpot "tailwind" | set `tailwind`, `semantic`, `brand/ocean`; temi `mode/light`, `brand/default`, `brand/ocean`; container `Badge` e `ShopCard` (con istanze del Badge; raggio `radius.2xl` e parte `Category` dopo T5/T6) |
| Codice dello spike | applicato sul branch `spike/penpot-ai-kit` (working tree, non committato); copia in [`test-v3/`](test-v3/README.md). Nessun worktree (perso il 2026-10-11, rimosso con `git worktree prune`) |
| `docker/penpot/docker-compose.yml` | Penpot 2.18.3, non committato |
| Backup Penpot | `~/Scrivania/projects/penpot-backups/2026-10-10-pre-2.18.3/` |
