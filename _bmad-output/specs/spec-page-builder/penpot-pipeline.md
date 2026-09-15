# Pipeline Penpot → codice

Companion di [SPEC.md](./SPEC.md). Descrive **cosa** fa la pipeline design→codice e le regole di aderenza. Il transport verso Penpot **è un server MCP**, confermato in AD-11. Il contratto di ogni componente (assi, valori, tipo di asse, parti) è del page builder e vive in `@app/contracts`; **Penpot è la sorgente di valori e aspetto** — disegna gli assi del contratto, non li decide. La generazione è data-driven; i valori sono fedeli al design; il **comportamento accessibile non è disegnabile in Penpot** e arriva da una base headless dichiarata (AD-11). *(Rivisto dai correct-course 2026-09-12 e 2026-09-13.)*

## Principio guida

Questo è un progetto di **design system**: la coerenza coi token e i componenti esistenti viene prima della creazione di nuovi elementi. Penpot è la single source of truth dei valori. Aderenza stretta: usare **esattamente** i valori del design; non inventare valori mancanti (in assenza, default neutri — mai colori casuali). I nomi di token/componenti Penpot restano allineati 1:1 a quelli in codice, così la mappatura non diverge.

**Il designer di riferimento è non tecnico**: lavora in Penpot da solo e consegna il file finito o quasi. Far passare la pipeline (ricetta, binding, emitter) è compito dello **sviluppatore**; il designer torna in Penpot solo per scelte di design vere (es. un colore senza token), mai per esigenze della pipeline.

- Token semantici con nomi alla shadcn (`primary`, `muted`, `destructive`, `border`, `ring`…) e anatomia dei componenti allineata agli assi del contratto; valori e stile restano del designer. *(Supera la decisione del 2026-09-05 "contratto CSS Penpot-native, non nomi shadcn".)*
- Ogni VariantContainer porta `pagebuilder/contract = nome@versione` (SharedPluginData): fonte primaria del legame componente→contratto; il nome del container è il controllo incrociato.

## Stadio 0 — Contratto e library Penpot

Il contratto nasce in codice (`@app/contracts`). La library Penpot si allinea al contratto **solo tramite skill** (modulo BMad `penpot-ds`):

- **bootstrap** una tantum: token semantici (**inclusi shadow/ring**) e componenti stilizzati con gli assi dei contratti, token legati a ogni proprietà di stile, plugin data scritto; rifiuta se la library esiste già;
- **additiva**: crea solo ciò che manca — componenti e token richiesti da un contratto nuovo, e le **celle** di un container esistente richieste da un valore d'asse nuovo del contratto; non modifica né cancella mai ciò che esiste — le differenze si **segnalano**, indicando dove si risolvono.

**Celle mancanti di un container esistente (`addCell`).** Quando il contratto acquista un valore d'asse (e il design la cella corrispondente), `add:library` pianifica un'operazione `addCell` per ogni combinazione del prodotto cartesiano assente dal container — solo se **esattamente un** container dichiara il contratto via plugin data e ha gli assi del contratto nello stesso ordine (altrimenti restano le sole differenze). La cella nasce come quelle del bootstrap: board costruita **da zero** dalle parti e dai token del design (stesso nome `"<Container> asse=valore|…"`), `createComponent`, `container.appendChild(board)` con la board dopo la cella più a destra, sulla sua stessa riga e col passo del bootstrap, e il container allargato fino a contenerla col suo margine (difetto trovato nella prova live del 2026-09-13: con la posizione dall'indice la cella finiva fuori dal container, e `verify:library` non lo vede perché non controlla la geometria), poi `setVariantProperty(pos, valore)` per ogni asse con l'indice letto da `variants.properties`. Mai `addVariant()`: duplica una variante esistente e ne eredita geometria, stili e binding token, che l'API non permette di rimuovere. Guardia anti-duplicato: se una variante ha già gli stessi `variantProps` lo step salta (il CLI stampa "saltato (motivo)"); celle esistenti e plugin data non si toccano. Un design senza la cella richiesta è un errore che nomina contratto e cella.

**Versionamento del contratto (regola A, decisa da Alessandro il 2026-09-13).** Il plugin data `pagebuilder/contract = nome@versione` segue `contract.version`, che **non** si alza a ogni cambio:

- **cambio compatibile** (valori d'asse, parti o field aggiunti) → si alza solo `SCHEMA_VERSION` (+ voce del fingerprint); `contract.version` e il plugin data restano invariati, e le celle nuove arrivano in Penpot con `addCell`;
- **cambio incompatibile** (rimozioni, rinomine di valori o field) → si alza `contract.version` (oltre a `SCHEMA_VERSION`), poi `pnpm bump:contract -- <Comp>` porta il plugin data del container al `contractId` corrente. Senza `--yes` stampa `atteso` vs `trovato` (es. `badge@1 → badge@2`) e non scrive (exit 0); con `--yes` scrive con guardia sul valore letto e rilegge Penpot (exit 1 se il valore non è quello atteso). Rifiuta un downgrade (versione in Penpot ≥ di quella del contratto) e i casi con zero o più container dichiaranti. Non tocca contratti, `SCHEMA_VERSION` né fingerprint;
- **ordine con un cambio incompatibile**: prima `bump:contract`, poi `add:library` — `addCell` gira solo su un container il cui plugin data è già il `contractId` corrente;
- **celle di valori rimossi o rinominati**: l'additiva non cancella mai, quindi le rimuove a mano in Penpot lo **sviluppatore** (non esiste ancora un comando); il designer riceve solo l'avviso, la pulizia post-bump è un'esigenza della pipeline, non una scelta di design; finché restano, `verify:library` resta rosso (regole 4/5) anche dopo il bump;
- **rinomina del contratto** = contratto nuovo, non un bump: il container col nome vecchio resta orfano (regola 11 di `verify:library`) finché non viene rimosso in Penpot.

**Adozione di una variante nata in Penpot.** Se il designer aggiunge in Penpot un valore d'asse che il contratto non ha, la pipeline lo **rileva** (`verify:library` rosso, estrazione ferma senza scrivere) ma non lo adotta da sola: una variante è un nuovo valore di prop per l'editor e un bump di `schemaVersion` (AD-6), quindi entra nel contratto solo con una **decisione esplicita** di chi sviluppa. Presa la decisione, i passi derivati (contratto, `schemaVersion`, binding, design) sono meccanici e affidati a un comando, non al prompt. Il contratto resta del page builder: l'adozione è una decisione in codice, non una sincronizzazione Penpot→codice.

Il comando è `pnpm adopt:variant -- <Comp>` (`--dry-run` / `--yes`; `--snapshot <path>` solo in lettura, come `bump:contract`). Legge Penpot e non lo scrive mai. Rileva i valori in più sugli assi `option` del container con lo stesso criterio della regola 4 di `verify:library`, stampa il diff dei cinque file e con `--yes` li scrive. Per la regola A è un cambio compatibile:
- **contratto** (`packages/contracts/src/components/<nome>.ts`): il valore va in coda all'array `values` dell'asse, modificato e riletto con l'AST TypeScript; il default resta invariato;
- **`SCHEMA_VERSION`** N→N+1 e una **voce N+1** in `contracts.fingerprint.json`, con l'hash calcolato sullo stesso payload del test (`fingerprintPayload` di `@app/contracts`); le voci esistenti non si riscrivono;
- **binding**: `axes.<asse>.values` acquista `valore: "valore"`;
- **design**: le celle nuove, con i token letti dalle celle Penpot (`partBindings`).

`contract.version`, il plugin data, il giudizio, la ricetta e la fixture restano invariati: dopo l'adozione girano `extract:component`, `render:component`, `gates:render` e `verify:library`. Tutti i contenuti si calcolano e si validano prima della prima scrittura, poi ogni file si scrive con tmp + rename. Senza `--yes` non scrive (exit 0); senza valori in più risponde "nulla da adottare" (exit 0). Rifiuta con exit 1 e senza scrivere, con un errore che nomina contratto, asse, valore, cella o layer:
- valore in più su un asse `state`/`behavior` (nessun mapping 1:1 con una prop);
- valore che non rispetta `/^[a-z][a-z0-9-]*$/` (es. `Outline`, `out line`);
- una proprietà di una parte che dopo l'adozione varia con più assi (stesso controllo dell'emitter, `influencingAxes`);
- un literal (proprietà di stile senza binding) in una cella nuova;
- una cella del prodotto cartesiano nuovo assente o duplicata in Penpot;
- zero o più container dichiaranti, plugin data ≠ `contractId`, assi in ordine diverso dal contratto;
- `SCHEMA_VERSION` non unica, fingerprint incoerente (voce corrente assente, voci oltre la corrente, contratti già cambiati senza bump), cella o valore già presenti nel design o nel binding.

I valori mancanti in Penpot non si rimuovono: è l'altro senso, che copre `addCell`.

Nessuna sincronizzazione ricorrente codice→Penpot (due sorgenti, conflitto irrisolvibile). Le skill guidano e fanno domande; **pass/fail sta negli script e negli schemi**, mai nel prompt.

## Stadio 1 — Generazione TOKEN

```
Penpot (catalogo token) ──► TokenCatalog (JSON) ──► mapping puro ──► [ CSS vars @theme | scala TS + opzioni editor ]
```

- Mapping data-driven dal **tipo** del token (non dal nome del set): un nuovo set Penpot genera automaticamente una nuova sezione.
- La stessa funzione di derivazione del nome è riusata sia per le variabili CSS sia per le classi emesse dall'emitter, così i due lati non possono divergere (es. `color.primary` → sempre sia `--color-primary` sia `bg-primary`).
- Output sovrascritto ad ogni run, con header `@generated`.

## Stadio 2 — Estrazione e generazione COMPONENTI

L'estrazione è **per-componente e su richiesta** ("estrai Input"), non un batch di pagina.

```
@app/contracts (assi tipizzati, valori, parti)
        │
Penpot (VariantContainer + plugin data) ──MCP──► <comp>.fixture.json   [deterministico, committato, validato vs contratto]
        │  parti, matrice varianti, token binding, CSS raw
        ▼
   code agent ──────────────────────────────► <comp>.recipe.json    [giudizio, committato, validato]
        │  parti (profondità 1) × assi tipizzati → celle proprietà→token · requisiti a11y
        ▼
   emitter <lib> + <comp>.binding (<lib>) ───► <Comp>.tsx · .test.tsx · .stories.tsx · index.ts   [@generated]
```

### Fixture — cosa fissa

Istantanea firmata del design al momento dell'estrazione. Committata: il suo diff mostra **cosa è cambiato nel design**, ed è ciò contro cui il gate di drift confronta Penpot live. L'estrazione legge il plugin data e **fallisce** su contratto dichiarato da due container, nome incoerente, contratto senza container; la fixture deve coprire **esattamente** assi e valori del contratto.

### Ricetta — l'unico passo di giudizio

L'agent decide la fattorizzazione per parti e i requisiti a11y. Vincoli:

- la ricetta è una **mappa di parti a profondità 1**; ogni cella è `proprietà → token` (es. `fill: destructive`, `padding: spacing.2`) per parte × valore d'asse — nessuna classe di una libreria; ogni **valore** (colore, misura, spessore, opacità, ombra) ha un token; gli stili a **parola chiave** di una lista chiusa (es. tratteggio `solid`/`dashed`/`dotted`) sono ammessi senza token;
- ogni token referenziato esiste nel catalogo dello Stadio 1 — un valore literal **non passa la validazione**. È l'attuazione di "never assume missing values": un test, non una raccomandazione;
- una parte annidata con assi propri fa **fallire lo schema**: la composizione (più item, sezioni) è una definizione di sezione, non una ricetta;
- la **geometria delle icone** (path) è ignorata — l'icona in codice viene dalla libreria icone;
- i binding token espliciti (colore/radius/font) e il layout/spacing/sizing dal CSS raw restano responsabilità separate, per non emettere stili in conflitto;
- l'agent si rievoca solo se cambia la **struttura** del componente. Un token diverso o una nuova variante (già nel contratto) passano per fixture → render, senza agent.

### Emitter per libreria e binding

Un emitter per libreria; **una sola libreria per installazione**, scelta a build time. La **tabella di binding** per componente e per libreria (committata) dichiara: componente base, parti della ricetta → parti della libreria, headless, valori d'asse → API della libreria.

L'**emitter shadcn** (riferimento) non genera componenti React da zero: parte da `npx shadcn add <comp>` (struttura, parti Radix, comportamento, a11y) e instrada gli assi per tipo — `option` → varianti `cva`; `state` → prefissi `focus-visible:`/`aria-invalid:`/`disabled:`; `behavior` → `data-[state=…]:`. Deriva le classi dalla stessa funzione di nome dello Stadio 1, poi test e story. Emette `@generated` con la provenienza (`penpotComponentId` + `fixtureHash`). Stesso input → stesso output, byte per byte.

### Registro delle proprietà e fedeltà

Le proprietà di stile Penpot che la pipeline conosce vivono in un **registro unico**, letto da reader, `verify:library` ed emitter: per ognuna, la lettura, il tipo (token o lista di parole chiave), lo stato (**supportata** o **bloccata**) e la mappatura dell'emitter. Solo due stati: **nessuno skip** — una proprietà o genera codice fedele o blocca il componente; una proprietà Penpot assente dal registro blocca anch'essa. Sbloccarne una = una riga del registro + la mappatura + un test rosso/verde (delle proprietà un tempo "silenziose", tratteggio e allineamento dello stroke **bloccano** finché un componente reale non li richiede, mentre spessore e opacità sono **coperte dalla base**: verificate contro la base shadcn, senza classi emesse — decisione del 2026-09-13). Il refactor che introduce il registro lascia l'output attuale identico byte per byte.

**Il registro in pratica** (`packages/scripts/src/shared/style-properties.ts`, Story 2.8 parte A). Ogni riga dice: `read` (come la legge `styleOf` nel reader, che riceve le liste iniettate dal registro), `type` (`token` col suo tipo di token, oppure `keyword` con la lista chiusa e il valore di default), `status` (`supported` | `blocked` con motivo) e `emitter` (prefisso utility, eventualmente per tipo di layer; angolo del radius; `coveredByBase`; `none` per le bloccate). Estrazione (`buildRecipe`), `verify:library` (regola 7) ed emitter chiedono tutti al registro con lo stesso errore nominativo, che dice componente, parte, cella, proprietà e token o valore: **non registrata**, **valore fuori lista** oppure **bloccata**. Gli stati di oggi:
- **supportate**: `fill`, `strokeColor`, i quattro radius, padding, `rowGap`/`columnGap`, `fontSize`/`fontWeight`/`letterSpacing` e `shadow`, che emettono classi. Poi `strokeWidth` e `opacity`, **coperte dalla base** (decisione di Alessandro, 2026-09-13): non emettono classi, ma il valore del token deve coincidere con quello che la base shadcn già esprime per quella parte con lo stesso prefisso di stato (`border`/`border-b`/`border-t` = 1px, `disabled:opacity-50` = 0.5). Un valore diverso, ad esempio `border-width.thick`, oppure una base che non esprime nulla per la parte, blocca il componente;
- **bloccate**: `strokeStyle` (lista `solid`/`dashed`/`dotted`, letto solo se diverso da `solid`), `strokeAlignment` (lista `inner`/`center`/`outer`, letto solo se diverso da `inner`, l'unico valore che corrisponde al bordo CSS) e `fontFamilies`, che `applyToken` non supporta;
- **regola icona**: `strokeWidth` sui layer `path`/`vector`/`ellipse`/`line` è geometria dell'icona e si ignora per una regola dichiarata nella riga, non per omissione.

**Sbloccare una proprietà** richiede tre cose nella stessa PR: la riga del registro (stato `supported`), la mappatura dell'emitter e un test rosso/verde, cioè un input che prima bloccava e ora genera codice fedele, più un caso che deve restare rosso. È una decisione umana presa quando un componente reale la richiede.

Quando l'emitter non sa esprimere un design valido fatto con i token, si estende l'emitter **una volta per tutte** — non per componente né a mano sul generato (primo caso: una variante senza una proprietà che il default ha, come l'outline senza fill: la proprietà assente entra nelle classi per variante, non nella base `cva`). Condizione: adeguarsi deve restare semplice per lo sviluppatore. Una proprietà che varia con due assi resta non esprimibile finché l'emitter non guadagna le `compoundVariants` (stesso principio).

**Mai generare in silenzio una versione infedele.** Ciò che non è esprimibile blocca **solo quel componente**, con un messaggio che nomina il problema; gli altri proseguono. Attriti di organizzazione del file: maiuscole, spazi e ordine degli assi sono normalizzati dalla pipeline; un layer con un nome diverso dalla parte è un **alias nel binding** (a cura dello sviluppatore); una cella mancante blocca il componente e chiede al designer — mai inventata. Una variante aggiunta in Penpot blocca solo quel componente, che resta all'ultima versione buona, finché lo sviluppatore non la adotta (skill `pds-component` / `adopt:variant`); i componenti in attesa sono visibili nel report di PR/CI, non solo nel terminale.

### Confine contratto / fixture / ricetta / emitter — la regola

> **Contratto** = il vocabolario che il page builder espone (e che le pagine salvano).
> **Fixture** = tutto ciò che si legge da Penpot **senza sapere cosa sia React**.
> **Ricetta** = la fattorizzazione per parti e l'accessibilità, **senza sapere quale libreria** la renderà.
> **Emitter + binding** = tutto ciò che dipende dalla libreria.

| Dato | Dove | Perché |
|---|---|---|
| assi, valori ammessi, tipo di asse (`option`/`state`/`behavior`) | contratto | vocabolario del page builder |
| `height: 32px`, `border-color → border` | fixture | fatto misurabile / binding esplicito del designer |
| celle `proprietà → token` per parte × asse | ricetta | fattorizzazione = giudizio |
| `aria-invalid` sullo stato error | ricetta | l'a11y non è disegnabile |
| `h-8`, `bg-destructive`, `<input>` invece di `<div>` | emitter (shadcn) | dipende dalla libreria |
| `@radix-ui/react-accordion`, parte → `AccordionTrigger` | binding (per libreria) | Penpot non conosce le librerie headless |

### Skip protettivo

Se un artefatto esiste con marker `@generated` → rigenerato. Senza marker (editato a mano) → sempre preservato. Un componente si "sgancia" dalla pipeline semplicemente togliendogli il marker.

### La categoria `custom` si restringe, non sparisce

L'headless si dichiara nel binding componente per componente: non esiste più una tabella statica da mantenere, e cade la maggior parte degli esclusi del legacy. Restano fuori solo i componenti **senza headless disponibile e con logica propria** (Table con sorting, Carousel) e i componenti complessi (3D, mappe, configuratori): scritti a mano, senza marker, ignorati dalla pipeline. Hanno comunque un **contratto completo**; in Penpot esistono come **segnaposto** (dimensioni, immagine/etichetta, plugin data) usato per posizionarli nelle sezioni, non estratto come stile. Stima 3-4 su ~28.

## Sezioni

- In Penpot una sezione si compone **solo** di istanze di componenti della library + layout; una forma sciolta fa fallire l'estrazione nominando l'elemento. Contenitori e decorazioni passano da `Box`.
- Mapping meccanico dei board: flex senza fill → `Flex`; fill/stroke senza layout → `Box`; entrambi → `Box` con `Flex` dentro. Tutti i valori da token.
- La **fixture di sezione** è l'albero estratto; la **ricetta di sezione** (giudizio) dichiara gli slot — riferiti per **id Penpot stabile** — con `allow` e `max`. Un nodo referenziato che sparisce fa fallire la validazione.
- I testi del mockup diventano **default di campi content**, mai valori fissi nel codice.
- Output: una **definizione di sezione** in `@app/contracts` (dati, non codice React), esposta in Puck per nome.

## Gate di verifica

Cinque gate, **bloccanti in CI** (salvo la condizione sul drift).

| Gate | Verifica |
|---|---|
| Completezza artefatti | ogni componente ha `.tsx` + `.test.tsx` + `.stories.tsx` + `index.ts` |
| Rigenerazione | l'emitter su fixture+ricetta+binding committati produce **diff zero** |
| A11y | `vitest-axe` verde su ogni componente; conformità alla `a11y-baseline` |
| Conformità al contratto | fixture e ricetta coprono **esattamente** assi e valori del contratto; ogni slot di sezione punta a un nodo esistente |
| Drift della fixture | `hash(fixture committata) == hash(Penpot live)`; se diverge, segnala **quale** componente riestrarre. Bloccante in CI **se e solo se** il runner raggiunge il server MCP Penpot; altrimenti manuale/nightly con decisione documentata |

Ogni gate ha una propria prova rosso/verde (un input che lo viola lo fa fallire), non solo un canary manuale.

I gate valutano **per componente**: un componente fuori regola rende rossa solo la sua voce, e i componenti in attesa (variante non ancora adottata, proprietà bloccata) restano visibili nel report — la CI non è più tutto-o-niente.

### Esito per componente e report (Story 2.8 parte B)

`verify:library` e `gates:render` producono **una voce per componente** con uno di tre stati e i problemi nominativi sotto (`packages/scripts/src/shared/component-report.ts`):

- **ok** — nessun problema;
- **rosso** — almeno un problema che va corretto (artefatto rotto, gate violato, collisione di normalizzazione, alias invalido, regole 1–3, 6, 7 non bloccata, cella duplicata o in più senza valore nuovo);
- **in attesa** — solo problemi che aspettano una decisione: **valore d'asse in Penpot non adottato** (rimando a `pnpm adopt:variant -- <Comp>`; le celle di quel valore sono in attesa anche loro), **proprietà bloccata dal registro**, **cella mancante** (o valore del contratto assente in Penpot): una **domanda al designer**, mai una cella inventata; se il design committato prevede la cella, il messaggio rimanda a `pnpm add:library` (`addCell`).

Le regole globali di `verify:library` (8 copertura spec, 9 tema, 10 contrasto, e la copertura design↔registry) sono righe **globali**, fuori dalle voci; in `gates:render` è globale la suite ui (vitest-axe), mentre l'a11y dichiarata, conformità, completezza, rigenerazione e drift sono per componente. In `gates:render` il caricamento e il rendering di ogni componente sono isolati: un artefatto che lancia rende rossa la sua voce e gli altri vengono comunque valutati. Un gate drift saltato (Penpot irraggiungibile) è una **nota** del report col motivo.

**Exit code** (decisione 1 di Alessandro, 2026-09-13): 1 solo se almeno una voce (di componente o globale) è rossa; con voci `ok`/`in attesa` l'exit è 0.

**Formato e posizione del report** (decisione 2): nel terminale una tabella in testo (voce, esito, problemi indentati); in CI la stessa tabella in Markdown appesa a `$GITHUB_STEP_SUMMARY` quando la variabile esiste (pagina di riepilogo del job), senza permessi nuovi nel workflow.

**Snapshot committato** (decisione 3): `packages/scripts/data/library.snapshot.json` si scrive dal vivo con `pnpm verify:library --write-snapshot data/library.snapshot.json` (lo lancia lo sviluppatore, token Penpot da `.env`; alternativo a `--snapshot`). In CI `verify:library --snapshot data/library.snapshot.json` gira offline e alimenta il report; un componente committato (con ricetta) assente dallo snapshot è una voce rossa "snapshot da aggiornare".

### Attriti del file Penpot (Story 2.8 parte B)

- **Normalizzazione unica** (`packages/scripts/src/extract/variant-normalize.ts`), applicata nel reader (`componentFixtureFromSnapshot`) e all'ingresso di `verifyLibrary`: nomi e valori d'asse si confrontano col contratto dopo trim, spazi interni compressi e senza maiuscole (`Size`/` SM ` → `size`/`sm`), **per nome e non per posizione** (l'ordine degli assi di Penpot non conta: la fixture li porta nell'ordine del contratto, e la regola 4 confronta gli assi come insieme). Un nome o valore senza corrispondenza resta intatto (quindi "valore in più"); due valori diversi che normalizzati coincidono (`SM` e `sm`) sono una **collisione**: errore nominativo, voce rossa, estrazione ferma. `addCell` resta com'è (richiede ancora gli assi nello stesso ordine).
- **Alias dei layer nel binding**: `parts.<parte>.aliases: ["Label Text"]` in `data/bindings/<comp>.binding.json` lega un layer con un nome diverso alla parte, per `partBindings` (estrazione e `validateRecipe`), la regola 6 di `verify:library` e l'emitter. La ricetta resta per parti del contratto, identica. Un alias verso una parte che il contratto non ha, lo stesso layer dichiarato due volte o un alias uguale al nome di un'altra parte sono errori nominativi (voce rossa). Nessuna rinomina in Penpot: l'alias vive solo nel binding.

Lato library, `verify:library` resta in sola lettura: una versione del contratto diversa dal plugin data del container la rende rossa (regola 3). Si risolve con la regola A dello Stadio 0 (`bump:contract` dopo un cambio incompatibile), mai modificando a mano il plugin data.

## Convenzione @generated

Tutti i file generati iniziano con un commento `@generated` che porta anche la **provenienza** — `penpotComponentId`, `fixtureHash` e il comando di rigenerazione — così si sa da quale stato del design è nato un file. Non si editano mai a mano: per cambiarli si modifica la **ricetta** o il **binding** (o si riestrae la fixture) e si rigenera.
