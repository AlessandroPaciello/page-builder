# Pipeline Penpot → codice

Companion di [SPEC.md](./SPEC.md). Descrive **cosa** fa la pipeline design→codice e le regole di aderenza. Il transport verso Penpot **è un server MCP**, confermato in AD-11. Il contratto di ogni componente (assi, valori, tipo di asse, parti) è del page builder e vive in `@app/contracts`; **Penpot è la sorgente di valori e aspetto** — disegna gli assi del contratto, non li decide. La generazione è data-driven; i valori sono fedeli al design; il **comportamento accessibile non è disegnabile in Penpot** e arriva da una base headless dichiarata (AD-11). *(Rivisto dal correct-course 2026-09-12.)*

## Principio guida

Questo è un progetto di **design system**: la coerenza coi token e i componenti esistenti viene prima della creazione di nuovi elementi. Penpot è la single source of truth dei valori. Aderenza stretta: usare **esattamente** i valori del design; non inventare valori mancanti (in assenza, default neutri — mai colori casuali). I nomi di token/componenti Penpot restano allineati 1:1 a quelli in codice, così la mappatura non diverge.

- Token semantici con nomi alla shadcn (`primary`, `muted`, `destructive`, `border`, `ring`…) e anatomia dei componenti allineata agli assi del contratto; valori e stile restano del designer. *(Supera la decisione del 2026-09-05 "contratto CSS Penpot-native, non nomi shadcn".)*
- Ogni VariantContainer porta `pagebuilder/contract = nome@versione` (SharedPluginData): fonte primaria del legame componente→contratto; il nome del container è il controllo incrociato.

## Stadio 0 — Contratto e library Penpot

Il contratto nasce in codice (`@app/contracts`). La library Penpot si allinea al contratto **solo tramite skill** (modulo BMad `penpot-ds`):

- **bootstrap** una tantum: token semantici (**inclusi shadow/ring**) e componenti stilizzati con gli assi dei contratti, token legati a ogni proprietà di stile, plugin data scritto; rifiuta se la library esiste già;
- **additiva**: crea solo componenti/token mancanti richiesti da un contratto nuovo; non modifica né cancella mai ciò che esiste — le differenze si **segnalano**.

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

- la ricetta è una **mappa di parti a profondità 1**; ogni cella è `proprietà → token` (es. `fill: destructive`, `padding: spacing.2`) per parte × valore d'asse — nessuna classe di una libreria;
- ogni token referenziato esiste nel catalogo dello Stadio 1 — un valore literal **non passa la validazione**. È l'attuazione di "never assume missing values": un test, non una raccomandazione;
- una parte annidata con assi propri fa **fallire lo schema**: la composizione (più item, sezioni) è una definizione di sezione, non una ricetta;
- la **geometria delle icone** (path) è ignorata — l'icona in codice viene dalla libreria icone;
- i binding token espliciti (colore/radius/font) e il layout/spacing/sizing dal CSS raw restano responsabilità separate, per non emettere stili in conflitto;
- l'agent si rievoca solo se cambia la **struttura** del componente. Un token diverso o una nuova variante (già nel contratto) passano per fixture → render, senza agent.

### Emitter per libreria e binding

Un emitter per libreria; **una sola libreria per installazione**, scelta a build time. La **tabella di binding** per componente e per libreria (committata) dichiara: componente base, parti della ricetta → parti della libreria, headless, valori d'asse → API della libreria.

L'**emitter shadcn** (riferimento) non genera componenti React da zero: parte da `npx shadcn add <comp>` (struttura, parti Radix, comportamento, a11y) e instrada gli assi per tipo — `option` → varianti `cva`; `state` → prefissi `focus-visible:`/`aria-invalid:`/`disabled:`; `behavior` → `data-[state=…]:`. Deriva le classi dalla stessa funzione di nome dello Stadio 1, poi test e story. Emette `@generated` con la provenienza (`penpotComponentId` + `fixtureHash`). Stesso input → stesso output, byte per byte.

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

## Convenzione @generated

Tutti i file generati iniziano con un commento `@generated` che porta anche la **provenienza** — `penpotComponentId`, `fixtureHash` e il comando di rigenerazione — così si sa da quale stato del design è nato un file. Non si editano mai a mano: per cambiarli si modifica la **ricetta** o il **binding** (o si riestrae la fixture) e si rigenera.
