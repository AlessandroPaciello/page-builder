# Pipeline Penpot → codice

Companion di [SPEC.md](./SPEC.md). Descrive **cosa** fa la pipeline design→codice e le regole di aderenza. Il transport verso Penpot **è un server MCP**, confermato in AD-11. Il contratto: Penpot è la sorgente di valori, aspetto e matrice varianti; la generazione è data-driven; i valori sono fedeli al design; il **comportamento accessibile non è disegnabile in Penpot** e arriva da una base headless dichiarata (AD-11).

## Principio guida

Questo è un progetto di **design system**: la coerenza coi token e i componenti esistenti viene prima della creazione di nuovi elementi. Penpot è la single source of truth dei valori. Aderenza stretta: usare **esattamente** i valori del design; non inventare valori mancanti (in assenza, default neutri — mai colori casuali). I nomi di token/componenti Penpot restano allineati 1:1 a quelli in codice, così la mappatura non diverge.

## Stadio 1 — Generazione TOKEN

```
Penpot (catalogo token) ──► TokenCatalog (JSON) ──► mapping puro ──► [ CSS vars @theme | scala TS + opzioni editor ]
```

- Mapping data-driven dal **tipo** del token (non dal nome del set): un nuovo set Penpot genera automaticamente una nuova sezione.
- La stessa funzione di derivazione del nome è riusata sia per le variabili CSS sia per le classi generate dai componenti, così i due lati non possono divergere (es. `color.mis.primary` → sempre sia `--color-mis-primary` sia `bg-mis-primary`).
- Output sovrascritto ad ogni run, con header `@generated`.

## Stadio 2 — Estrazione e generazione COMPONENTI

L'estrazione è **per-componente e su richiesta** ("estrai Input"), non un batch di pagina.

```
Penpot (componente + varianti) ──MCP──► <comp>.fixture.json          [deterministico, committato]
        │  shape, matrice varianti (assi + celle), token binding, CSS raw
        ▼
   code agent ──────────────────────► <comp>.recipe.json             [giudizio, committato, validato]
        │  dominio · headless scelto · modello CVA (base + assi + defaults) · requisiti a11y
        ▼
   renderer puro ───────────────────► <Comp>.tsx · .test.tsx · .stories.tsx · index.ts   [@generated]
```

### Fixture — cosa fissa

Istantanea firmata del design al momento dell'estrazione. Committata: il suo diff mostra **cosa è cambiato nel design**, ed è ciò contro cui il gate di drift confronta Penpot live.

### Ricetta — l'unico passo di giudizio

L'agent decide dominio, headless da comporre, modello delle varianti e requisiti a11y. Vincoli:

- ogni classe dev'essere nel **vocabolario dei token** generati allo Stadio 1 — un valore literal (`bg-[#3b82f6]`, `p-[7px]`) **non passa la validazione**. È l'attuazione di "never assume missing values": un test, non una raccomandazione.
- i binding token espliciti (colore/radius/font) e il layout/spacing/sizing dal CSS raw restano responsabilità separate, per non emettere classi in conflitto.
- l'agent si rievoca solo se cambia la **struttura** del componente. Un token diverso o una nuova variante passano per fixture → render, senza agent.

### Renderer — funzione pura, e più piccola di quanto sembri

Non genera componenti React da zero: **applica il blocco `cva` della ricetta a una base shadcn** già esistente (`npx shadcn add <comp>` fornisce struttura, parti Radix, comportamento e a11y), e da lì deriva test e story. Emette `@generated` con la provenienza (`penpotComponentId` + `fixtureHash`). Stesso input → stesso output, byte per byte.

### Confine fixture / ricetta — la regola

> **Fixture** = tutto ciò che si legge da Penpot **senza sapere cosa sia React**.
> **Ricetta** = tutto ciò per cui serve sapere cosa sono React e l'accessibilità.

| Dato | Dove | Perché |
|---|---|---|
| `height: 32px` | fixture | fatto misurabile nel disegno |
| `h-8` | ricetta | è una classe Tailwind |
| `border-color → color.mis.border` | fixture | binding esplicito del designer |
| assi `size`/`state` e celle | fixture | variant matrix esposta da Penpot |
| quali classi sono comuni a tutte le celle | ricetta | fattorizzazione = giudizio |
| `<input>` invece di `<div>` | ricetta | Penpot non conosce gli elementi HTML |
| `aria-invalid` sullo stato error | ricetta | l'a11y non è disegnabile |
| `@radix-ui/react-accordion` | ricetta | Penpot non conosce le librerie headless |

### Skip protettivo

Se un artefatto esiste con marker `@generated` → rigenerato. Senza marker (editato a mano) → sempre preservato. Un componente si "sgancia" dalla pipeline semplicemente togliendogli il marker.

### La categoria `custom` si restringe, non sparisce

L'headless lo sceglie l'agent componente per componente e lo scrive nella ricetta: non esiste più una tabella statica da mantenere, e cade la maggior parte degli esclusi del legacy. Restano fuori solo i componenti **senza headless disponibile e con logica propria** (Table con sorting, Carousel): scritti a mano, senza marker, ignorati dalla pipeline. Stima 3-4 su ~28.

## Gate di verifica

Quattro gate, tutti **bloccanti in CI**.

| Gate | Verifica |
|---|---|
| Completezza artefatti | ogni componente ha `.tsx` + `.test.tsx` + `.stories.tsx` + `index.ts` |
| Rigenerazione | il renderer su fixture+ricetta committate produce **diff zero** |
| A11y | `vitest-axe` verde su ogni componente; conformità alla `a11y-baseline` |
| Drift della fixture | `hash(fixture committata) == hash(Penpot live)`; se diverge, segnala **quale** componente riestrarre |

## Convenzione @generated

Tutti i file generati iniziano con un commento `@generated` che porta anche la **provenienza** — `penpotComponentId`, `fixtureHash` e il comando di rigenerazione — così si sa da quale stato del design è nato un file. Non si editano mai a mano: per cambiarli si modifica la **ricetta** (o si riestrae la fixture) e si rigenera.
