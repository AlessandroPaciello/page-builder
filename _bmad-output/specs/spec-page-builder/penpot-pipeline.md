# Pipeline Penpot → codice

Companion di [SPEC.md](./SPEC.md). Descrive **cosa** fa la pipeline design→codice e le regole di aderenza. Il transport verso Penpot **è un server MCP**, confermato in AD-11. Il contratto di ogni componente (nome, versione, assi `option`, field) è del page builder e vive in `@app/contracts`; **Penpot è la sorgente di valori e aspetto** — disegna gli assi del contratto, non li decide. La generazione è data-driven; i valori sono fedeli al design; il **comportamento accessibile non è disegnabile in Penpot** e arriva da un primitivo headless dichiarato (AD-11). *(Rivisto dai correct-course 2026-09-12, 2026-09-13, 2026-09-15 e 2026-09-17; Stadio 2 v1 cancellato nella Story 2.16.)*

> **Pipeline unica v2 (dalla Story 2.16, CAP-11 chiuso).** Lo Stadio 0 (contratto e library) e lo Stadio 1 (token) restano come prima. Lo **Stadio 2** è solo la **v2** (due contratti → istantanea → render headless) da [SPEC-refactor-packages-scripts](../spec-refactor-packages-scripts/SPEC.md). La sezione v1 (fixture → ricetta → emitter shadcn) è stata **cancellata** con la 2.16, non aggiornata.

## Principio guida

Questo è un progetto di **design system**: la coerenza coi token e i componenti esistenti viene prima della creazione di nuovi elementi. Penpot è la single source of truth dei valori. Aderenza stretta: usare **esattamente** i valori del design; non inventare valori mancanti (in assenza, default neutri — mai colori casuali). I nomi di token/componenti Penpot restano allineati 1:1 a quelli in codice, così la mappatura non diverge.

**Il designer di riferimento è non tecnico**: lavora in Penpot da solo e consegna il file finito o quasi. Far passare la pipeline (contratto di estrazione, istantanea, render) è compito dello **sviluppatore**; il designer torna in Penpot solo per scelte di design vere (es. un colore senza token), mai per esigenze della pipeline.

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

## Stadio 2 (v2) — Due contratti, una istantanea, sei comandi

Regime deciso dal correct-course del 2026-09-17 su [SPEC-refactor-packages-scripts](../spec-refactor-packages-scripts/SPEC.md) (Story 2.12–2.17). L'estrazione resta **per-componente e su richiesta**, mai in CI né in build.

```
@app/contracts (name, version, assi option, fields, slot)          ← nel fingerprint
        │  importato da
        ▼
packages/scripts/src/contracts/<nome>.extract.ts                    ← fuori dal fingerprint
  (ruoli, when, repeat, parent, layer, element, content/attribute, headless, a11y)
        │  validato a module load: contraddire il page builder = errore che nomina parte e campo
        ▼
Penpot (VariantContainer + plugin data) ──MCP── extract ──► data/components/<nome>.json   [unica istantanea]
        │                                                    contract · provenance · cells[cella][parte]
        ▼
render (istantanea + contratto di estrazione + registro)
        └─► <Comp>.tsx · .test.tsx · .stories.tsx · index.ts        [@generated, nessuna base]
```

**Sei comandi**, un guscio, una classe di errore: `theme`, `library`, `extract`, `render`, `gates`, `propose`. `ScriptError { kind, component?, cell?, part?, detail }`, exit `1` input · `2` penpot · `3` contract · `4` gate; nessun `process.exitCode` fuori dal guscio. Vocabolario completo del contratto di estrazione in [extraction-contract.md](../spec-refactor-packages-scripts/extraction-contract.md), tabella dei comandi e stadi di `extract` in [commands.md](../spec-refactor-packages-scripts/commands.md), piano di transizione in [migration.md](../spec-refactor-packages-scripts/migration.md).

**Cosa non cambia rispetto alla v1:** il principio guida e la libertà del designer; l'aderenza stretta ai valori del design; il registro delle proprietà come unico posto dove si insegna una proprietà (da v2 impara anche `layout` e `position` dal layer, e il ruolo `image` senza `fill`); l'ordine degli adattamenti designer → registro → contratto; l'esito per componente col report (`gates`); il pass/fail negli script e mai nel prompt; la scrittura su Penpot solo via skill e `library`, mai correttiva; la convenzione `@generated`.

**Cosa cambia:** `judgments/`, `bindings/`, `designs/`, `bases/`, `recipes/` e la coppia fixture+ricetta spariscono — l'istantanea li sostituisce tutti, e il suo diff in PR **è** la review del design. Il ruolo di parte esce dal contratto del page builder ed entra nel contratto di estrazione; il page builder tiene solo assi `option`, field e slot. Il drift non è più un gate a sé: `extract --check` confronta Penpot live senza scrivere. `propose` sostituisce `adopt:variant`, `bump:contract` e `role:part`: stampa il diff sui due contratti, lo sviluppatore lo applica a mano. Le basi shadcn e Radix escono; il primitivo headless è Base UI, dichiarato per parte.


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

Le regole globali di `verify:library` (8 copertura spec, 9 tema, e la copertura design↔registry) sono righe **globali**, fuori dalle voci. La **regola 10 (contrasto)** è **per componente** e misura i token **live** (correct-course 2026-09-15, Story 2.10): le coppie si ricavano dallo snapshot letto da Penpot (parte `text`/`icon` × parte `surface` che la contiene, per cella, grazie al ruolo), non da `designs/*.design.json`; le coppie di catalogo (`CATALOG_PAIRS`) restano globali. Un design committato che diverge da Penpot è un problema nominativo della voce (kind `design-drift`), che rimanda a `pnpm sync:design -- <Comp>`: il comando stampa il diff design committato ↔ Penpot, con `--yes` riscrive il design (tmp + rename), non scrive mai su Penpot. In `gates:render` è globale la suite ui (vitest-axe), mentre l'a11y dichiarata, conformità, completezza, rigenerazione e drift sono per componente. In `gates:render` il caricamento e il rendering di ogni componente sono isolati: un artefatto che lancia rende rossa la sua voce e gli altri vengono comunque valutati. Un gate drift saltato (Penpot irraggiungibile) è una **nota** del report col motivo.

**Exit code** (decisione 1 di Alessandro, 2026-09-13): 1 solo se almeno una voce (di componente o globale) è rossa; con voci `ok`/`in attesa` l'exit è 0.

**Formato e posizione del report** (decisione 2): nel terminale una tabella in testo (voce, esito, problemi indentati); in CI la stessa tabella in Markdown appesa a `$GITHUB_STEP_SUMMARY` quando la variabile esiste (pagina di riepilogo del job), senza permessi nuovi nel workflow.

**Snapshot committato** (decisione 3): `packages/scripts/data/library.snapshot.json` si scrive dal vivo con `pnpm verify:library --write-snapshot data/library.snapshot.json` (lo lancia lo sviluppatore, token Penpot da `.env`; alternativo a `--snapshot`). In CI `verify:library --snapshot data/library.snapshot.json` gira offline e alimenta il report; un componente committato (con ricetta) assente dallo snapshot è una voce rossa "snapshot da aggiornare".

### Attriti del file Penpot (Story 2.8 parte B)

- **Normalizzazione unica** (`packages/scripts/src/extract/variant-normalize.ts`), applicata nel reader (`componentFixtureFromSnapshot`) e all'ingresso di `verifyLibrary`: nomi e valori d'asse si confrontano col contratto dopo trim, spazi interni compressi e senza maiuscole (`Size`/` SM ` → `size`/`sm`), **per nome e non per posizione** (l'ordine degli assi di Penpot non conta: la fixture li porta nell'ordine del contratto, e la regola 4 confronta gli assi come insieme). Un nome o valore senza corrispondenza resta intatto (quindi "valore in più"); due valori diversi che normalizzati coincidono (`SM` e `sm`) sono una **collisione**: errore nominativo, voce rossa, estrazione ferma. `addCell` resta com'è (richiede ancora gli assi nello stesso ordine).
- **Alias dei layer nel binding**: `parts.<parte>.aliases: ["Label Text"]` in `data/bindings/<comp>.binding.json` lega un layer con un nome diverso alla parte, per `partBindings` (estrazione e `validateRecipe`), la regola 6 di `verify:library` e l'emitter. La ricetta resta per parti del contratto, identica. Un alias verso una parte che il contratto non ha, lo stesso layer dichiarato due volte o un alias uguale al nome di un'altra parte sono errori nominativi (voce rossa). Nessuna rinomina in Penpot: l'alias vive solo nel binding.

Lato library, `verify:library` resta in sola lettura: una versione del contratto diversa dal plugin data del container la rende rossa (regola 3). Si risolve con la regola A dello Stadio 0 (`bump:contract` dopo un cambio incompatibile), mai modificando a mano il plugin data.

## Convenzione @generated

Tutti i file generati iniziano con un commento `@generated` che porta anche la **provenienza** — `penpotComponentId`, `fixtureHash` e il comando di rigenerazione — così si sa da quale stato del design è nato un file. Non si editano mai a mano: per cambiarli si modifica la **ricetta** o il **binding** (o si riestrae la fixture) e si rigenera.

In v2 la provenienza sta nell'istantanea (`penpotComponentId`, `readAt`, hash) e per cambiare un file generato si modifica il **contratto di estrazione** o il **registro** (o si riestrae con `extract`), mai il file.
