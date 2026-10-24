---
title: 'Story 2.23 — Adattatore Penpot readComponent'
type: 'feature'
created: '2026-10-24'
status: 'done'
baseline_commit: 'b5bbd8065b5d8ea66d6869e9e9adb83e3d08f256'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Il nucleo (2.20–2.22) lavora su una `Lettura` scritta a mano. Non esiste ancora il punto unico che la legge dal file Penpot vero. Senza questo punto le proprietà del registro arrivano solo dai test, e i bug 2, 3, 11 e 12 dello spike restano chiusi solo sulla carta.

**Approach:** `readComponent(nome)` in `src/penpot/read-component.ts` esegue via `execute_code` un sorgente JS che legge un componente: container di varianti, oppure componente principale senza assi. Il risultato è una `Lettura` validata con zod. Prima di leggere, l'adattatore controlla che ogni proprietà del registro abbia una sua regola di lettura.

## Boundaries & Constraints

**Always:**
- **Solo `src/penpot` parla con Penpot.** Il nucleo resta puro: si tocca solo per il campo `Instance.contract` (vedi sotto). L'adattatore non scrive mai su Penpot: niente `set*`, niente `storage`.
- **Ricerca del componente.** Si cerca prima il container (o il componente principale) il cui plugin data `pagebuilder.contract` vale `<nome>` o `<nome>@<versione>`, poi il nome del layer. Zero risultati → errore che nomina il nome cercato. Più di un risultato → errore che li elenca.
- **Celle.** La variante di una cella si ricava dall'`id` della sua board, che deve coincidere con `variantComponents()[i].mainInstance().id`. Un componente senza container dà una sola cella con `variant: {}`. Un `variantError` è un errore che nomina la cella.
- **Plugin data.** Si leggono tutte le chiavi del namespace `pagebuilder` del container e di ogni layer; nessuna chiave → `pluginData` assente.
- **Token.** Le chiavi di `shape.tokens` vanno così come sono, tranne `fontFamilies` → `fontFamily` (bug 5).
- **Stile.** Le proprietà legate a un token sono scritte in `style` solo se hanno un valore non di default:
  - fill o stroke presenti;
  - raggio, padding e gap > 0;
  - opacità ≠ 1;
  - ombre non vuote;
  - per il testo, `fontSize`, `fontWeight`, `letterSpacing` e `fontFamily` (voce deferred della 2.20).
- **Layout.** Il flex dà `layoutDir`, `layoutAlign`, `layoutJustify` e `layoutWrap` col valore grezzo, sempre. Una griglia dà `layoutDir: "grid"`, così il registro avvisa invece di tacere.
- **Dimensionamento.** `sizingH`/`sizingV` vengono da `layoutChild`. Se `layoutChild` manca si usa la misura del flex del layer stesso.
- **Geometria.** Per ogni layer: `width`, `height`, `x`/`y` (`parentX`/`parentY`), `constraintH`/`constraintV`. `position: "absolute"` se `layoutChild.absolute`. `clip` se la board ha `clipContent`. Misure e posizioni sono arrotondate a 2 decimali, perché Penpot emette valori sub-pixel (288.0000114): chiude la voce deferred della 2.21.
- **Istanze.** Un'istanza si riconosce con `isComponentCopyInstance() && isComponentHead()`, mai dal nome. `component` = nome del `component()`. `contract` = plugin data `contract` del container della sua istanza principale. `variant` = `variantProps`. I figli dell'istanza non si leggono.
- **Override.** Penpot non espone `componentRefShape()` (restituisce null). Si confrontano allora, per indice, `tokens` e `style` dell'istanza e dei suoi discendenti con l'istanza principale della variante. Ogni proprietà diversa dà un nome di proprietà in `overrides`, senza doppioni e ordinato. Sono esclusi i nomi di `PLACEMENT_PROPERTIES` e il testo (bug 12). Un layer senza corrispettivo dà `"struttura"`.
- **Errori.** Per l'envelope si usa `parseExecuteCodeEnvelope`. Una `Lettura` che non passa lo schema è un errore che cita il percorso zod.
- **Test.** I test di livello 1 sono senza Penpot. Il test dal vivo si salta senza `PDS_PENPOT_LIVE=1`.

**Never:**
- fixture di lettura Penpot nel repo (regola 5);
- adattatore finto o server MCP (sono della 2.24);
- campione `.penpot` e procedura di collaudo (sono della 2.25);
- slot e sezioni (sono della 2.27);
- copiare il `library-reader` dello spike così com'è;
- nuove voci di registro.

**Decisioni (mie, ritoccabili al checkpoint):**
- **`Instance.contract`** (`nome@versione`, facoltativo) entra nello schema. `verify.ts` e `build-order.ts` ricavano il contratto annidato da lì con `contractOf`, e così controllano anche la versione. Se manca, tornano a `kebabOf(component)`. Chiude la voce deferred 12 della 2.22.
- **Copertura.** `READ_PROPERTIES` è l'elenco delle proprietà che il sorgente sa scrivere. `assertRegistryCovered()` lancia un errore che nomina ogni proprietà di `registeredProperties()` assente da quell'elenco. La chiama `readComponent`, e c'è un test di livello 1 rosso/verde.

## I/O & Edge-Case Matrix

| Scenario | Input / Stato | Atteso |
|---|---|---|
| varianti | `readComponent("badge")` | 6 celle con `variant` `{variant,size}`, `pluginData.contract: "badge@1"` |
| istanza | ShopCard `promo=discount` | layer `Action` con `instance {component:"Badge", contract:"badge@1", variant:{variant:"destructive",size:"sm"}, overrides:[]}`, `children: []` |
| fill in un'istanza | ShopCard in Carousel, `sizingV: fill` | `overrides` vuoto, `style.sizingV: "fill"` |
| assoluti | frecce del Carousel | `position:"absolute"`, `constraintH:"left"/"right"`, `constraintV:"center"`, `x`/`y` arrotondati |
| flex | radice di ShopCard | `layoutDir:"column"`, `layoutAlign:"start"`, `clip:true`, `width:288` |
| nome ignoto | `readComponent("nope")` | errore che nomina `nope` |
| doppio | due container con lo stesso contratto | errore che li elenca |
| registro scoperto | una proprietà del registro non in `READ_PROPERTIES` | errore che la nomina |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/penpot/mcp-client.ts`: si riusano `callPenpotTool`, `parseExecuteCodeEnvelope` e `resolveMcpEndpoint`; il file non cambia.
- `packages/scripts/src/penpot/penpot-reader.ts`: il modello è il sorgente JS in una stringa con l'endpoint risolto alla chiamata; resta per `theme` fino alla 2.26.
- `packages/scripts/src/core/schemas.ts`: `Lettura`, `LetturaLayer`, `Instance` (qui entra `contract`), `PluginData`.
- `packages/scripts/src/core/registry.ts`: `registeredProperties()` dà le chiavi che `READ_PROPERTIES` deve coprire.
- `packages/scripts/src/core/verify.ts`: `instanceName` (riga 131) e il controllo dell'istanza (righe 321–345) passano a `contractOf` quando c'è `instance.contract`; `PLACEMENT_PROPERTIES` (riga 59, già esportato) dice cosa escludere dagli override.
- `packages/scripts/src/core/build-order.ts`: ricava il nome dell'annidato nello stesso modo.
- `packages/scripts/src/core/geometry.ts`: `x`/`y` sono relativi al genitore; `width`/`height` valgono per ogni tipo di layer.
- `packages/scripts/scripts/check-boundaries.mjs`: `src/penpot` può importare da `../core`; `src/core` non importa da `penpot`.
- Riferimento, da non copiare: `_bmad-output/spikes/penpot-ai-kit-2026-10-10/test-v3/patch/1-codice-e-contratti.patch:262-390` (flex, layoutChild, `instanceInfo`/diff) e `git show ddb81c2^:packages/scripts/src/library/library-reader.ts` (`styleOf`, `isVariantContainer`, celle).
- Penpot dal vivo (verificato il 2026-10-24 sul file "tailwind"):
  - le chiavi di `shape.tokens` coincidono con quelle del registro (`fontFamily` è già al singolare);
  - `opacity` vale null quando è di default;
  - non c'è nessun plugin data `part` sui layer;
  - il `component()` del Badge annidato si chiama `"Badge"` e il container d'origine porta `"badge@1"`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/tests/penpot/read-component.test.ts`: test di livello 1 da scrivere per primi. Coprono `assertRegistryCovered` rosso/verde, il `callTool` finto che restituisce un envelope con errore o una `Lettura` non valida (errore col percorso zod) e la propagazione di un errore del sorgente (nome ignoto o doppio).
- [x] `packages/scripts/src/core/schemas.ts`, `verify.ts`, `build-order.ts`, più i test in `tests/core/`: aggiungere `Instance.contract`, usarlo per il contratto annidato (con controllo della versione) e scrivere i test rosso/verde.
- [x] `packages/scripts/src/penpot/read-component.ts`: `READ_COMPONENT_SOURCE`, `READ_PROPERTIES`, `assertRegistryCovered` e `readComponent(name, {endpoint?, callTool?, timeoutMs?})`.
- [x] `packages/scripts/tests/penpot/read-component.live.test.ts`: `describe.skipIf(!PDS_PENPOT_LIVE)` su Badge, ShopCard e Carousel, con la matrice. Va lanciato a mano in questa story.
- [x] `packages/scripts/src/penpot/README.md`: cosa legge e da dove, il limite degli override, la scheda sospesa (finestra visibile o flag `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows`) e come lanciare il test dal vivo.
- [x] `packages/scripts/README.md`, `deferred-work.md` (chiudere le voci 2.20 default, 2.21 sub-pixel e 2.22 contratto annidato), `sprint-status.yaml`.

**Acceptance Criteria:**
- Given Penpot 2.18.3 con il file "tailwind" e `PDS_PENPOT_LIVE=1`, when lancio il test dal vivo, then Badge, ShopCard e Carousel passano `Lettura.parse` e la matrice è verde.
- Given ShopCard letta dal vivo, when chiamo `verifyComponent` con i contratti dei test, then il Badge annidato non dà blocchi né per override né per contratto.
- Given `pnpm turbo run check-types lint test --force`, then tutto è verde e il test dal vivo risulta saltato.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|
| 1 | Il sorgente che gira in Penpot non viene mai eseguito in CI: le regole di lettura sono protette solo dal test dal vivo (VG, Blind) | medium | `read-component.test.ts` usa solo `callTool` finti; `READ_COMPONENT_SOURCE` è valutato solo dal test dal vivo. L'intento (AC della 2.23) però dice che i test dell'adattatore girano solo nel collaudo (2.25) e che in CI l'adattatore è sostituito da quello finto della 2.24 | defer (2.25) |
| 2 | `assertRegistryCovered` confronta due liste scritte a mano, non il sorgente (VG, Blind, Edge) | medium | Un nome aggiunto a `READ_PROPERTIES` senza regola nel sorgente passa | patch: controllo sul testo del sorgente + rosso/verde |
| 3 | I test "nome ignoto"/"doppio" di livello 1 provano solo la propagazione; il "doppio" non è provato da nessuna parte (Blind) | medium | Vero: il riconoscimento dei doppioni vive nel sorgente. Stessa causa del #1 | defer (2.25, con il #1) |
| 4 | `kebab()` duplicato nel sorgente può divergere da `kebabOf` (Blind) | low | Vero in teoria; serve un cambio di `kebabOf` per vederlo, e il rimedio richiede di eseguire il sorgente | scartato |
| 5 | Il ripiego del dimensionamento sul flex produce `fit-content` (Blind) | false | API `FlexLayout.horizontalSizing: "fill" \| "auto" \| "fix"`; dal vivo `fix`/`fill`/`auto` | scartato |
| 6 | Opacità di fill/tratto e visibilità non lette: misure perse in silenzio, override di visibilità invisibili (Blind, Edge) | medium | `styleOf` legge solo il colore e non `hidden`; il vincolo "nessuna misura persa in silenzio" vale | patch: `fillOpacity`, `strokeOpacity`, `hidden` in `style` (il registro avvisa) |
| 7 | Layer nascosti diventano parti (Blind, Edge) | medium | Vero; cosa fare di un layer nascosto (parte assente in alcune celle) dipende dalle regole `when` | defer (2.27/2.29); il #6 lo rende almeno un avviso |
| 8 | Solo il primo fill/tratto è letto (Blind) | low | Raro nei componenti del DS; il rimedio aggiunge un ramo | scartato |
| 9 | Valori di testo grezzi/stringa e `"mixed"` passano senza avviso (Blind, Edge) | low | Le proprietà di testo hanno il token: il valore in `style` serve solo all'avviso "senza token", che lo mostra; un testo misto è raro | scartato |
| 10 | `letterSpacing` sub-pixel non arrotondato prima del controllo a 0 (Edge) | low | Non visto dal vivo (`tracking.normal`), rimedio con un ramo in più | scartato |
| 11 | Tratto con colore ma spessore 0 (Edge) | low | Raro; dà al più un avviso | scartato |
| 12 | Fill con `fillOpacity` 0 letto come fill (Edge) | medium | Coperto dal #6 (`fillOpacity: 0` arriva e il registro avvisa) | patch (#6) |
| 13 | Schema di `Instance.contract` troppo largo (`"@1"` → nome vuoto) (Blind) | low | `contractOf` dà comunque un blocco; i plugin data li scrive `pds-code` | scartato |
| 14 | `buildOrder` segnala due volte un `instance.contract` sbagliato; il test lo nasconde (Blind) | low | `instancesOf` aggiunge il nome anche col problema; il test passa `["chip"]` | patch |
| 15 | Il test dell'AC 2 può passare a vuoto e salta la cella corretta col reset (Blind) | medium | Il filtro su `where` è vuoto se l'istanza non è visitata; la cella `size=default` non è controllata | patch: controllo positivo + `overrides: []` nelle due celle |
| 16 | Il ripiego sul nome trova un componente con un altro contratto; nome della query non normalizzato (Blind) | low | Serve un componente `Badge` con contratto `chip@1`; caso improbabile | scartato |
| 17 | Istanze di librerie collegate: `mainInstance()` null → errore generico (Blind) | low | L'errore nomina l'istanza ("senza componente d'origine"): esplicito, non silenzioso | scartato |
| 18 | Stringa dell'ombra non CSS; `spread` negativo senza avviso (Blind) | false | L'ombra ha il token: la stringa serve solo all'avviso; l'avviso sul `spread` negativo è di `tokens_from_css` (2.26) | scartato |
| 19 | La riscrittura di `epic-2-context.md` perde fatti (iniezione, `collaudo/`, `theme` fino alla 2.26, stack, "ogni bug noto…") (Blind, Edge) | medium | Verificato nel diff: righe tolte | patch: fatti rimessi |
| 20 | Voce già chiusa nella sezione 2.23 di deferred-work; la scrittura in Penpot non è citata come tale (Blind) | low | La voce registra un fatto utile (il reset tocca nome e testo); la scrittura è avvenuta su conferma esplicita | scartato |
| 21 | Bookkeeping: 2.22 → done nel branch, `review_loop_iteration: 0` (Blind) | false | 2.22 → done era la modifica di Alessandro portata nel branch (scelta all'avvio); nessun loopback finora | scartato |
| 22 | `readComponent("badge@1")` con contratto `badge` senza versione (Edge) | low | Errore esplicito "Nessun componente"; i container hanno la versione | scartato |
| 23 | Variante con l'istanza principale fuori dal container: cella mancante (Edge) | low | Penpot tiene le principali delle varianti nel container; non dimostrato | scartato |

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force` (con `pnpm db:start`): verde.
- `PDS_PENPOT_LIVE=1 pnpm --filter @penpot-ds/scripts exec vitest run tests/penpot/read-component.live.test.ts`: verde con Penpot collegato.

## Implementation Notes

- Ricerca sui candidati di `penpot.library.local.components` (container di varianti o componente principale), non su `findShapes`: trova anche i componenti fuori dalla pagina corrente.
- Il sorgente restituisce `{ lettura }` o `{ error }` invece di lanciare: il messaggio arriva identico qualunque sia il modo in cui `execute_code` riporta un'eccezione.
- `nestedContractOf` in `verify.ts`; `instanceName` ora prende l'`Instance` (non solo `component`). In `build-order.ts` un `instance.contract` sconosciuto o di un'altra versione è un blocco.
- Test dal vivo (2026-10-24, Penpot 2.18.3, file "tailwind"): 8 test su 8 verdi, dopo il reset degli override dell'istanza `Action` nella cella ShopCard `size=default, promo=discount` (aveva i token di padding staccati e `paddingTop` 0, un override vero che l'adattatore segnalava). Senza chiavi di parte nel file la verifica si fermerebbe alla domanda `part` e non guarderebbe l'istanza: il test le assegna in memoria dal nome del layer, con un controllo positivo che l'istanza ci sia in ogni cella promo=discount.
- `fillOpacity`, `strokeOpacity` e `hidden` si leggono senza essere voci del registro: danno l'avviso "non registrata" e contano negli override.
- `assertRegistryCovered` controlla anche che ogni voce di `READ_PROPERTIES` compaia nel sorgente (`style.<p>` o `"<p>"`, esclusa la lista `PLACEMENT` iniettata).
