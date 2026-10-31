# Sprint Change Proposal — Revisione di AD-11

- **Data:** 2026-07-26
- **Autore:** Alessandro (via workflow `correct-course`)
- **Trigger:** Story 1.1 — Scaffolding greenfield del workspace
- **Scope classification:** **Major** — riscrittura di una decisione architetturale adottata, ristrutturazione di Epic 2, fusione di due package
- **Stato:** ✅ **APPROVATA e APPLICATA** — approvata da Alessandro il 2026-09-05; edit A-N applicati a spine, companion, SPEC, epics, sprint-status e Story 1.1 nella stessa sessione. Resta da implementare il Task 5 della Story 1.1 (codice).

---

## 1. Issue Summary

### Problema

AD-11 dichiara che token **e componenti** sono generati data-driven dal catalogo Penpot e immutabili. Il companion che ne detta il dettaglio (`penpot-pipeline.md`) descrive però una pipeline che **presuppone già esistenti** le primitive (strategia `primitiva nota | alternativa | custom`), **salta** i componenti `custom` lasciandoli a scrittura manuale, e preserva il codice scritto a mano. Descrive cioè un modello **ibrido** che la regola non ammette.

La regola non definisce dove passa il confine generato/manuale, cosa la pipeline estrae davvero, né come il comportamento accessibile — che un file Penpot non contiene — arrivi nei componenti generati.

### Contesto della scoperta

Emerso il 2026-07-26 durante la code review della Story 1.1. La review è stata **sospesa** prima di applicare qualsiasi fix, perché quattro finding dipendevano dall'esito di questa revisione — in particolare la presenza di `@base-ui/react ^1.6.0` in `packages/ui`, classificabile come violazione di AD-3 solo finché AD-11 esclude una base scritta a mano.

### Evidenze

| # | Evidenza | Fonte |
|---|---|---|
| E1 | **Circolarità:** la strategia di mapping sceglie tra `primitiva nota \| alternativa \| custom` — un input che AD-11 dichiara essere l'output della pipeline | `penpot-pipeline.md:25` vs `ARCHITECTURE-SPINE.md:145` |
| E2 | I componenti `custom` sono "**saltati** (implementati a mano)": codice non generato dentro un package dichiarato generato | `penpot-pipeline.md:30` |
| E3 | Anche i token hanno una parte manuale ("font utility, line-height... l'unica parte scritta a mano"): nemmeno `tokens` è puramente `@generated` | `design-system.md:25` |
| E4 | La Story 2.3 dice "**implemento/genero** le primitive": l'epic ha già silenziosamente assunto l'ibrido | `epics.md:243` |
| E5 | Transport mai confermato: "oggi un server MCP... dettaglio realizzativo **da confermare in fase architecture**", mai confermato nello spine | `penpot-pipeline.md:3` |
| E6 | `@base-ui/react ^1.6.0` presente in `packages/ui`: formalmente in violazione di AD-3 solo per effetto di AD-11 | `packages/ui/package.json:17` |
| E7 | Lo Structural Seed marca `tokens/` "(generato, AD-11)" ma `primitives/` solo "(AD-3)": lo spine è incoerente con sé stesso su chi è generato | `ARCHITECTURE-SPINE.md:211-212` |

### Causa radice

Non è un cambio di direzione né un errore di implementazione: è **perdita di informazione in fase di astrazione**. Il legacy (`docs/legacy/design-token-pipeline.md`) documenta la stessa pipeline con precisione: `radix-mapper.ts` mappa i componenti Penpot su una tabella statica `RADIX_PRIMITIVES` (~27 componenti Radix). "Primitiva nota" nella SPEC era l'astrazione — mal riuscita — di *"primitiva Radix presente nella tabella di mapping"*. Generalizzando "Radix" in "nota", la SPEC ha eliminato proprio il termine che rendeva la regola non circolare.

### Vincolo tecnico non dichiarato

Un file Penpot contiene forme, stili e matrice varianti. **Non contiene comportamento.** La `a11y-baseline` obbliga Dialog al focus trap con restituzione del focus al trigger, Tabs alla navigazione con frecce, Dropdown a `Escape` che chiude e restituisce il focus, gli overlay a un portale root condiviso. Nessuno di questi è esprimibile in Penpot. Una generazione che parta *solo* dal design non può emettere componenti interattivi conformi: il comportamento deve entrare da una fonte dichiarata.

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impatto |
|---|---|
| **Epic 1** — Fondamenta | **Basso.** Solo la Story 1.1 (in-progress): `packages/ui` diventa la libreria componenti unica; `@base-ui/react` va sostituito con Radix. Sblocca 1 dei 4 decision-needed della code review sospesa. |
| **Epic 2** — Design system | **Ristrutturazione completa.** Da 4 a 5 story: si separa l'estrazione (deterministica) dalla generazione (giudizio) dal rendering (deterministico). Nessuna story era iniziata (`backlog`): **nessun rollback necessario**. |
| **Epic 3** — Blocchi editor | **Medio.** Story 3.2 e 3.4 cambiano package di destinazione (`primitives` → `ui/src/domains`, composizioni → `ui/src/editor`). Nessun cambio di sostanza. |
| **Epic 4/5/6** | **Nessuno.** Non toccano il design system. |

### Story Impact

- **1.1** (in-progress): dipendenze di `packages/ui`, struttura interna `domains/` + `editor/`.
- **2.1 → 2.5**: riscritte, vedi §4.
- **3.2, 3.4**: aggiornamento dei riferimenti di package.

### Artifact Conflicts

| Artefatto | Modifica |
|---|---|
| `ARCHITECTURE-SPINE.md` | AD-11 riscritta, AD-3 riscritta, Structural Seed, Capability Map, Consistency Conventions |
| `penpot-pipeline.md` | riscrittura Stadio 2, nuova sezione determinismo, gate CI |
| `design-system.md` | layering, fusione `primitives`+`ui`, catalogo |
| `SPEC.md` | CAP-2 success criteria |
| `epics.md` | Epic 2 da 4 a 5 story; riferimenti in 3.2/3.4 |
| `sprint-status.yaml` | entry di Epic 2 |
| `a11y-baseline.md` | nessuna modifica di contenuto — diventa il criterio del gate a11y |

### Technical Impact

- `packages/primitives` non viene mai creato; `packages/ui` (già esistente dallo scaffold) lo assorbe.
- Sostituzione `@base-ui/react` → Radix UI in `packages/ui`.
- Nuovo: schema della ricetta + renderer puro in `packages/scripts`.
- Nuovi gate CI: completezza artefatti, a11y, zero-hardcoded, drift fixture, rigenerazione a diff zero.
- La barriera di package tra primitive e composizioni editor sparisce: va sostituita da una **regola di lint bloccante**.

---

## 3. Recommended Approach

**Direct Adjustment.** Nessun rollback (Epic 2 è interamente `backlog`), nessuna riduzione di MVP: le capability CAP-1/2/3 restano intatte nell'intento e diventano *più* realizzabili.

### Le sei decisioni adottate

1. **Generazione piena, non ibrido.** Penpot disegna il componente; l'estrazione produce componente + story + test con i token cablati.
2. **Il comportamento viene da un headless dichiarato (Radix).** Penpot possiede aspetto, varianti e valori; Radix possiede il comportamento; il generatore li cabla. Chiude E1: la tabella di mapping è *input* della pipeline.
3. **Il giudizio lo dà un code agent via MCP, per-componente e su richiesta.** Non un batch di pagina con template statici.
4. **Il determinismo si recupera congelando il giudizio in una ricetta committata.** Vedi sotto — è il cuore della proposta.
5. **Una sola libreria componenti** (`packages/ui`), con `domains/` generato ed `editor/` scritto a mano.
6. **Contratto CSS Penpot-native**: il nome deriva dal *tipo* del token; i template shadcn si adattano a quello, non viceversa. Preserva il success criteria di CAP-1 (nuovo set Penpot = nuova sezione, zero codice).

### Il nodo del determinismo, e come si scioglie

Un code agent che scrive TSX è non deterministico: riestrarre `Input` domani produce codice equivalente ma non identico. Questo renderebbe **impossibile** il gate "rigenerare non produce diff", e svuoterebbe `@generated` del suo significato di immutabilità.

La riparazione: **non serve che sia deterministica la generazione, serve che lo sia l'artefatto.** Il giudizio dell'agent — questo è un `input`, le sue varianti sono `size × state`, serve `aria-invalid` — è un fatto stabile che oggi verrebbe buttato via dentro il TSX. Lo si congela in un artefatto committato, e il codice diventa funzione pura di quell'artefatto.

```
Penpot ──MCP──►  <comp>.fixture.json    deterministico (da Penpot), committato, hash-verificato
                        │
                  code agent            GIUDIZIO — una volta, rivedibile da umano
                        ▼
                  <comp>.recipe.json    committato, validato da schema + vocabolario token
                        │
                  renderer (funzione pura)   DETERMINISTICO
                        ▼
        <Comp>.tsx · <Comp>.test.tsx · <Comp>.stories.tsx · index.ts    @generated
```

| Artefatto | Prodotto da | Deterministico | Verifica CI |
|---|---|---|---|
| `<comp>.fixture.json` | lettore MCP | sì | drift vs Penpot live |
| `<comp>.recipe.json` | **code agent** | no, ma prodotto una volta e committato | schema + vocabolario token |
| `<Comp>.tsx` + test + story | renderer puro | **sì** | **rigenera → diff zero** |

Esempio di ricetta:

```jsonc
{
  "component": "Input", "domain": "inputs",
  "source": { "penpotComponentId": "…", "fixtureHash": "sha256:…" },
  "headless": null,                          // <input> nativo; Accordion → "@radix-ui/react-accordion"
  "root": { "element": "input", "forwardRef": true },
  "cva": {
    "base": ["flex","w-full","rounded-mis-sm","border-mis-border","bg-mis-surface"],
    "axes": {
      "size":  { "sm": ["h-8","px-2","text-sm"], "md": ["h-10","px-3","text-base"] },
      "state": { "default": [], "error": ["border-feedback-error"] }
    },
    "defaults": { "size": "md", "state": "default" }
  },
  "a11y": { "requires": ["aria-invalid-on-error", "associated-label"] }
}
```

### Il renderer è più piccolo di quanto sembri

Con **shadcn** il componente React esiste già: `npx shadcn add accordion` fornisce struttura, parti Radix, comportamento e a11y. Penpot non deve generare nulla di tutto questo. **Ciò che Penpot aggiunge è solo lo strato di stile — il blocco `cva`.**

```
base shadcn (già esistente)  +  blocco cva dalla ricetta  ──►  il componente del design system
```

Il renderer non è un compilatore che emette componenti React da zero: **sostituisce il blocco `cva` dentro una base shadcn**, e da lì deriva test e story. È la ragione per cui la Story 2.3 è dimensionabile in giorni e non in settimane.

### Il ruolo dell'agent, delimitato

| | |
|---|---|
| Quando gira | solo su richiesta esplicita ("estrai `Input`"). **Mai in CI, mai nella build, mai in automatico.** È uno strumento di design-time. |
| Quante volte | una per componente (~28 in totale), poi solo se cambia la **struttura**. Non per cambi di colore, valore o variante. |
| Cosa consegna | ~20-40 righe di JSON. Mai codice. |
| Se sbaglia | lo vedi rivedendo 30 righe dichiarative. Tre reti sotto: schema, vocabolario token, test axe. Un errore di fattorizzazione è visibile in Storybook. |
| Se non è disponibile | scrivi la ricetta a mano guardando la fixture — 30 righe. **L'agent non è nel percorso critico.** |

### Tre proprietà che si guadagnano

1. **Il valore inventato diventa impossibile, non sconsigliato.** Le classi nella ricetta sono validate contro il vocabolario dei token generati allo Stadio 1: `bg-[#3b82f6]` non passa lo schema. La regola *"never assume missing values"* smette di dipendere dalla diligenza di chi genera.
2. **Un design che cambia non richiede l'agent.** Nuovo token, nuova variante `size: lg`? Fixture aggiornata → render → fatto. L'agent si rievoca solo se cambia la **struttura** del componente.
3. **La categoria `custom` si restringe drasticamente.** Il legacy saltava tutto ciò che non era nella tabella statica `RADIX_PRIMITIVES` — circa metà del catalogo. Qui l'headless lo sceglie l'agent componente per componente. Restano fuori solo i componenti **senza headless disponibile e con logica propria** (Table con sorting, Carousel): scritti a mano, senza marker, ignorati dalla pipeline. Stima: 3-4 su ~28.

### Il criterio economico che giustifica la macchina

| | Costo |
|---|---|
| **A mano** — 28 componenti shadcn, applicando le varianti Penpot con la fixture davanti | ~1h a componente ≈ **28h una tantum**; ogni giro di redesign ~8-12h |
| **Con la macchina** — schema + renderer + gate | ~**30h una tantum**; ogni giro di redesign ~0h |

**Break-even a 2-3 giri di redesign.** La decisione è stata presa sulla previsione esplicita che **il design system itererà** — il designer continua a lavorare in Penpot nei mesi. Se questa premessa cadesse, cadrebbe con essa la giustificazione del renderer (non della generazione token, che vale sempre).

### Rischi

| | |
|---|---|
| **Principale** | Lo schema della ricetta è troppo povero per un componente complesso → lo si scrive a mano lo stesso. **Mitigazione:** la Story 2.3 valida lo schema su tre componenti di complessità crescente (Badge presentazionale → Input con varianti → Accordion composto con headless) **prima** di generalizzare. Segnale di fallimento da sorvegliare: se la ricetta smette di essere una tabella e diventa un albero, sta diventando JSX in JSON. |
| **Secondario** | La regola di confine `domains/` ↛ `editor/`, persa la barriera di package, resta scritta ma non difesa. **Mitigazione:** lint bloccante in CI, negli AC della Story 1.1. |
| **Timeline** | Epic 2 passa da 4 a 5 story. Epic 1 non slitta. |

---

## 4. Detailed Change Proposals

### 4.1 — `ARCHITECTURE-SPINE.md`

#### Edit A — AD-11 riscritta

**OLD** (righe 141-145)
```
### AD-11 — Pipeline Penpot→codice preservata, artefatti generati immutabili [ADOPTED]

- **Binds:** CAP-1, CAP-2.
- **Prevents:** valori di design inventati a mano e artefatti generati modificati fuori pipeline (drift design↔codice).
- **Rule:** Penpot resta single source of truth dei valori; token e componenti sono **generati** (data-driven dal catalogo Penpot) e marcati `@generated`, mai editati a mano; la rigenerazione preserva i file scritti a mano. Dettaglio → companion `penpot-pipeline.md`.
```

**NEW**
```
### AD-11 — Penpot genera i componenti; il giudizio si congela in ricette, il codice è funzione pura [ADOPTED]

- **Binds:** CAP-1, CAP-2, CAP-3.
- **Prevents:** valori di design inventati a mano; drift design↔codice; componenti generati non
  accessibili perché il design non esprime comportamento; generazione non riproducibile.
- **Rule:** Penpot è single source of truth di **valori, aspetto e matrice varianti**. La pipeline si
  articola in tre artefatti con garanzie distinte:
  (a) **fixture** per-componente, lette da Penpot via MCP, **committate** e verificate per hash;
  (b) **ricetta** per-componente, prodotta da un code agent — l'unico passo di giudizio — **committata**
      e validata contro uno schema e contro il vocabolario dei token generati;
  (c) **codice** (`.tsx` + test + story + barrel) emesso da un **renderer puro** che applica il blocco
      `cva` della ricetta a una **base shadcn** (headless Radix + CVA + `cn()` + `forwardRef`),
      marcato `@generated` e **rigenerabile a diff zero**.
  Il **comportamento accessibile non è disegnabile in Penpot**: entra dalla base shadcn/headless
  dichiarata nella ricetta, che è quindi *input* del rendering, mai suo output. Penpot possiede
  **soltanto lo strato di stile**: quel blocco `cva`, e nient'altro.
  I componenti privi di headless e con logica propria (es. Table con sorting, Carousel) sono **scritti a
  mano**, senza marker, e ignorati dalla pipeline.
  I file `@generated` non si editano a mano: si modifica la ricetta e si rigenera. I file scritti a mano
  (privi di marker) sono sempre preservati. Dettaglio → companion `penpot-pipeline.md`.
```

**Rationale:** chiude E1 (la circolarità: la scelta dell'headless è nella ricetta, un input), E2/E4 (non esiste più una categoria di componenti che la regola nega ma la pipeline salta), E5 (MCP confermato nello spine), E7. Nomina il vincolo fisico — Penpot non contiene comportamento — invece di lasciarlo implicito, che è la ragione per cui la regola era inapplicabile. Aggiunge la riproducibilità, che la formulazione precedente prometteva implicitamente con `@generated` senza garantirla.

#### Edit B — AD-3 riscritta

**OLD** (riga 97)
```
- **Rule:** `apps/web` costruisce la UI **solo** su `@penpot-ds/ui` + `@penpot-ds/primitives` (+ token). Vietato introdurre una libreria UI generica concorrente. Layering `tokens ← primitives ← {puck-components, ui}`; le primitive non importano da `ui` né conoscono il dominio page-builder.
```

**NEW**
```
- **Rule:** `apps/web` costruisce la UI **solo** su `@penpot-ds/ui` (+ token). Vietato introdurre una
  libreria UI **stilistica** concorrente. Le primitive **headless** (Radix) non sono una libreria
  concorrente: non portano stile, sono la dipendenza di *comportamento* dichiarata nelle ricette (AD-11),
  e sono importabili **solo** da `@penpot-ds/ui/src/domains/**` — mai da `apps/web`, mai da `editor/**`.
  Layering `tokens ← ui{ domains ← editor } ← puck-components`.
  **Regola di confine assoluta:** i componenti in `domains/` non conoscono il dominio page-builder e non
  importano mai da `editor/`. Persa la barriera di package con la fusione, il confine è tenuto da una
  **regola di lint bloccante in CI** e dai due export separati del package.
```

**Rationale:** legittima Radix senza aprire la porta a uno stack UI parallelo — chiude E6 e sblocca il decision-needed della code review 1.1. Riformula il layering dopo la fusione e, soprattutto, nomina il meccanismo che sostituisce l'enforcement perso.

#### Edit C — Structural Seed (righe 211-216)

**OLD**
```
    tokens/                  # @penpot-ds/tokens         (generato, AD-11)
    primitives/              # @penpot-ds/primitives     (AD-3)
    puck-components/         # @penpot-ds/puck-components — schemi Zod + classifier CONDIVISI, schemaVersion owner (AD-5,6)
    ui/                      # @penpot-ds/ui             (composizioni editor)
    scripts/                 # pipeline Penpot→codice     (AD-11)
```

**NEW**
```
    tokens/                  # @penpot-ds/tokens — GENERATO da Penpot (AD-11)
    ui/                      # @penpot-ds/ui — libreria componenti unica (AD-3, AD-11)
      src/domains/           #   GENERATO: data-display, inputs, feedback, layout,
                             #   navigation, overlays — shadcn/Radix/CVA, @generated
                             #   export `.`  → unico consumo per puck-components
      src/editor/            #   A MANO: composizioni di prodotto (TopBar, PageList,
                             #   LifecycleBadge, SaveStateIndicator, EmptyState, VersionList)
                             #   export `./editor` → unico consumo per apps/web (app)
    puck-components/         # @penpot-ds/puck-components — schemi Zod + classifier CONDIVISI, schemaVersion owner (AD-5,6)
    scripts/                 # pipeline Penpot→codice (AD-11)
      penpot/                #   lettore MCP → fixture committate
      recipes/               #   schema + validazione ricette
      render/                #   renderer puro ricetta+fixture → tsx/test/story
      gates/                 #   check artefatti · drift · zero-hardcoded
```

**Rationale:** `packages/primitives` non nasce mai; `packages/ui` — che **esiste già** dallo scaffold della Story 1.1 — lo assorbe. I due export separati rendono il confine di AD-3 **meccanico**: `puck-components` non può raggiungere le composizioni editor nemmeno per errore.

#### Edit D — Capability→Architecture Map

```
OLD  | CAP-1/CAP-2 pipeline Penpot→token/componenti | packages/scripts, tokens, primitives | AD-11 |
NEW  | CAP-1/CAP-2 pipeline Penpot→token/componenti | packages/scripts, tokens, ui/src/domains | AD-11 |

OLD  | CAP-3 primitive accessibili | packages/primitives     | AD-3, a11y-baseline |
NEW  | CAP-3 primitive accessibili | packages/ui/src/domains | AD-3, AD-11, a11y-baseline |

OLD  | CAP-5 composizioni editor   | packages/ui             | AD-3 |
NEW  | CAP-5 composizioni editor   | packages/ui/src/editor  | AD-3 |
```

#### Edit E — Consistency Conventions, riga «Confini package»

Rimuovere `primitives` dall'elenco `@penpot-ds/*`; il design system è `@penpot-ds/tokens` + `@penpot-ds/ui` + `@penpot-ds/puck-components`.

---

### 4.2 — `penpot-pipeline.md` (companion SPEC)

#### Edit F — Stadio 2 riscritto

**OLD** (righe 19-30)
```
## Stadio 2 — Generazione COMPONENTI

Penpot (pagina componenti) ──► PenpotComponent[] (shape, matrice varianti, token binding)
   ──► analisi (deriva dominio; se variant matrix → modello varianti reale)
   ──► mapping strategia (primitiva nota | alternativa | custom)
   ──► generazione componente + test + story + barrel (@generated)

- Divisione delle responsabilità per non emettere classi in conflitto: [...]
- **Skip protettivo:** [...]
- I componenti senza corrispondenza diretta con una primitiva nota sono strategia `custom` e vengono
  **saltati** (implementati a mano).
```

**NEW**
```
## Stadio 2 — Estrazione e generazione COMPONENTI

L'estrazione è **per-componente e su richiesta** ("estrai Input"), non un batch di pagina.

Penpot (componente + varianti) ──MCP──► <comp>.fixture.json          [deterministico, committato]
        │  shape, matrice varianti (assi + celle), token binding, CSS raw
        ▼
   code agent ──────────────────────► <comp>.recipe.json             [giudizio, committato, validato]
        │  dominio · headless scelto · modello CVA (base + assi + defaults) · requisiti a11y
        ▼
   renderer puro ───────────────────► <Comp>.tsx · .test.tsx · .stories.tsx · index.ts   [@generated]

### Fixture — cosa fissa
Istantanea firmata del design al momento dell'estrazione. Committata: il suo diff mostra
**cosa è cambiato nel design**, ed è ciò contro cui il gate di drift confronta Penpot live.

### Ricetta — l'unico passo di giudizio
L'agent decide dominio, headless da comporre, modello delle varianti e requisiti a11y. Vincoli:
- ogni classe dev'essere nel **vocabolario dei token** generati allo Stadio 1 — un valore literal
  (`bg-[#3b82f6]`, `p-[7px]`) **non passa la validazione**. È l'attuazione di "never assume
  missing values": un test, non una raccomandazione.
- i binding token espliciti (colore/radius/font) e il layout/spacing/sizing dal CSS raw restano
  responsabilità separate, per non emettere classi in conflitto.
- l'agent si rievoca solo se cambia la **struttura** del componente. Un token diverso o una nuova
  variante passano per fixture → render, senza agent.

### Renderer — funzione pura, e più piccola di quanto sembri
Non genera componenti React da zero: **applica il blocco `cva` della ricetta a una base shadcn**
già esistente (`npx shadcn add <comp>` fornisce struttura, parti Radix, comportamento e a11y),
e da lì deriva test e story. Emette `@generated` con la provenienza (`penpotComponentId` +
`fixtureHash`). Stesso input → stesso output, byte per byte.

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
Se un artefatto esiste con marker `@generated` → rigenerato. Senza marker (editato a mano) → sempre
preservato. Un componente si "sgancia" dalla pipeline semplicemente togliendogli il marker.

### La categoria `custom` si restringe, non sparisce
L'headless lo sceglie l'agent componente per componente e lo scrive nella ricetta: non esiste più
una tabella statica da mantenere, e cade la maggior parte degli esclusi del legacy. Restano fuori
solo i componenti **senza headless disponibile e con logica propria** (Table con sorting, Carousel):
scritti a mano, senza marker, ignorati dalla pipeline. Stima 3-4 su ~28.
```

#### Edit G — «Gate di verifica» esteso

**OLD** (riga 34): controllo di completezza artefatti.

**NEW**: quattro gate, tutti bloccanti in CI.

| Gate | Verifica |
|---|---|
| Completezza artefatti | ogni componente ha `.tsx` + `.test.tsx` + `.stories.tsx` + `index.ts` |
| Rigenerazione | il renderer su fixture+ricetta committate produce **diff zero** |
| A11y | `vitest-axe` verde su ogni componente; conformità alla `a11y-baseline` |
| Drift della fixture | `hash(fixture committata) == hash(Penpot live)`; se diverge, segnala **quale** componente riestrarre |

#### Edit H — Preambolo (riga 3)

Rimuovere «Il transport verso Penpot (oggi un server MCP) è dettaglio realizzativo **da confermare in fase architecture**» → il transport **è** MCP, confermato in AD-11 (chiude E5).

#### Edit I — Convenzione `@generated`

L'header porta anche la **provenienza**: `penpotComponentId` + `fixtureHash` + comando di rigenerazione. Serve a sapere da quale stato del design è nato un file.

---

### 4.3 — `design-system.md` (companion SPEC)

#### Edit J — Layering (righe 7-17)

**OLD**
```
tokens  ◄── primitives  ◄── puck-components
                     ◄── ui
scripts (pipeline Penpot) ── genera ──► tokens, primitives
```

**NEW**
```
tokens  ◄── ui/domains  ◄── puck-components
                        ◄── ui/editor
scripts (pipeline Penpot) ── genera ──► tokens, ui/domains
```

- `tokens` — foglia del grafo, nessuna dipendenza interna.
- `ui/domains` — dipende solo da `tokens` (+ headless Radix). Export `.`.
- `ui/editor` — dipende solo da `ui/domains` + `tokens`. Export `./editor`.
- `puck-components` — dipende da `ui/domains` + `tokens`. **Non** vede `ui/editor`.
- **Regola di confine assoluta:** un componente in `domains/` non conosce il dominio page-builder e non importa mai da `editor/`. La semantica dell'editor vive in `editor/`, mai in `domains/`.

#### Edit K — Sezioni «primitives» e «ui» rinominate

`## primitives — libreria accessibile per dominio` → `## ui/domains — componenti generati da Penpot`
`## ui — composizioni di prodotto (editor)` → `## ui/editor — composizioni di prodotto`

Contenuto delle tabelle invariato. Aggiungere in `ui/domains`: i componenti sono generati (fixture → ricetta → renderer, AD-11) e compongono headless Radix per il comportamento.

#### Edit L — Nota sui token parzialmente manuali (riga 25)

Il testo esiste già ed è corretto; va reso coerente con la nuova AD-11 esplicitando che le variabili senza corrispondenza Penpot vivono in un file **separato e non generato**, importato da quello generato — così la rigenerazione non può sovrascriverle (chiude E3).

---

### 4.4 — `SPEC.md`

#### Edit M — CAP-2, success criteria (riga 29)

**OLD**
```
- **success:** la pipeline emette componente + test + story + barrel; i file scritti a mano sono
  preservati (skip salvo forzatura); un gate di completezza artefatti passa in CI.
```

**NEW**
```
- **success:** l'estrazione di un componente produce fixture e ricetta committate; il renderer emette
  componente + test + story + barrel in modo **riproducibile** (rigenerare dà diff zero); i file scritti
  a mano sono preservati; i quattro gate (completezza, rigenerazione, a11y, drift fixture) passano in CI.
```

CAP-1 e CAP-3 restano invariate.

---

### 4.5 — `epics.md` — Epic 2 ristrutturata (4 → 5 story)

> Titolo epic: *«Design system — token e componenti da Penpot»* (era «token e primitive»).

| # | Story | Stato |
|---|---|---|
| 2.1 | Pipeline token Penpot→codice | **invariata nella sostanza**, + fixture committata |
| 2.2 | Estrazione componenti e schema delle ricette | **nuova** (scorporata dalla vecchia 2.2) |
| 2.3 | Renderer deterministico e gate CI | **nuova** |
| 2.4 | Libreria componenti accessibile | ex 2.3, riscritta |
| 2.5 | Storybook del design system | ex 2.4, invariata |

**Story 2.1 — Pipeline token Penpot→codice** (AC aggiornati)
> **And** il catalogo token letto da Penpot è serializzato in una fixture committata, così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design.

**Story 2.2 — Estrazione componenti e schema delle ricette** *(nuova)*
> As a designer/sviluppatore, I want estrarre un singolo componente da Penpot e ottenerne una ricetta validata, so that il giudizio su varianti, headless e a11y sia congelato in un artefatto rivedibile invece che disperso nel codice (FR2, AD-11).
>
> **Given** un componente con le sue varianti su Penpot
> **When** ne chiedo l'estrazione
> **Then** sono prodotti `<comp>.fixture.json` (shape, assi e celle delle varianti, token binding, CSS raw) e `<comp>.recipe.json` (dominio, headless, modello CVA, requisiti a11y), entrambi committati
> **And** la ricetta è validata contro lo schema **e** contro il vocabolario dei token dello Stadio 1: una classe con valore literal fa fallire la validazione.

**Story 2.3 — Renderer deterministico e gate CI** *(nuova)*
> As a sviluppatore, I want un renderer puro che applichi la ricetta a una base shadcn, so that il codice sia riproducibile e il drift design↔codice sia un test rosso invece di una scoperta tardiva.
>
> **Given** fixture e ricetta committate e la base shadcn del componente
> **When** eseguo il rendering
> **Then** il blocco `cva` della ricetta è applicato alla base shadcn e sono prodotti `.tsx` + test + story + barrel, marcati `@generated` con la provenienza (`penpotComponentId` + `fixtureHash`)
> **And** rigenerare produce **diff zero**, un file senza marker non viene mai sovrascritto, e i quattro gate passano in CI
> **And** lo schema è validato su tre componenti di complessità crescente — Badge (presentazionale), Input (varianti), Accordion (composto con headless) — prima di generalizzare; se la ricetta di Accordion smette di essere una tabella e diventa un albero annidato, la story si ferma e il regime si rivaluta.

**Story 2.4 — Libreria componenti accessibile** (ex 2.3)
> Sostituire «primitive» → «componenti in `ui/src/domains`»; sostituire l'AC «le primitive non importano dal package `ui`» → «i componenti in `domains/` non importano da `editor/`, verificato da lint bloccante»; aggiungere la copertura dei sei domini.

**Story 2.5 — Storybook** (ex 2.4): invariata, aggiornare i riferimenti di package.

#### Edit N — Epic 3

- **Story 3.2** «Blocchi Puck che wrappano le primitive» → «...che wrappano i componenti `ui/domains`».
- **Story 3.4** «Composizioni dell'editor» → destinazione `packages/ui/src/editor`.

---

### 4.6 — Story 1.1 (in-progress)

| Cambio | Dettaglio |
|---|---|
| Dipendenze | rimuovere `@base-ui/react` da `packages/ui`; Radix entra nella Story 2.4, non ora |
| Struttura | `packages/ui/src/` predisposto con `domains/` e `editor/` |
| Export | `.` → `domains`, `./editor` → `editor` |
| Lint | regola bloccante `domains/**` ↛ `editor/**` |
| Code review | il decision-needed bloccato da AD-11 è **sciolto**: Base UI non era la scelta giusta, ma la sua presenza non era una violazione concettuale — era il sintomo di AD-11 mal formulata |

---

### 4.7 — Deferred: estensione del regime ai blocchi Puck

Da aggiungere alla sezione **Deferred** dello spine.

> **Estensione della pipeline ai blocchi Puck** (Hero, Section, Columns, Card…). Il regime fixture → ricetta → renderer si estende ai blocchi cambiando solo il `kind` della ricetta (`"block"` invece di `"component"`): si genererebbe il **guscio presentazionale** — wrapper, spacing, allineamento, background, matrice varianti — mentre restano **sempre scritti a mano**:
> - la **composizione interna** (quali primitive, in che ordine): è struttura, non stile;
> - lo **schema Zod** e i campi editor: `puck-components` è proprietario dichiarato di `schemaVersion` e il contratto authoring↔render non può essere output di una pipeline (AD-6);
> - la **classificazione structure/content** (CAP-13): è un **confine di sicurezza** — decide cosa un Cliente può modificare (AD-12) e cosa passa per la sanitizzazione XSS lato server (AD-5). Non è un posto dove si generano decisioni per inferenza, con o senza default fail-safe;
> - la distinzione tra **contenuto d'esempio e design**: un testo nel mockup Penpot ("Benvenuto nel nostro store") deve diventare il default di un campo editabile, non finire nel codice.
>
> **Riaprire quando** Epic 2 avrà dimostrato che lo schema della ricetta regge su componenti composti. Il fatto che il meccanismo si estenda cambiando solo il `kind` è indizio che il modello non sia stato costruito attorno al caso particolare delle primitive — ma resta da verificare, non da assumere.

---

## 5. Implementation Handoff

**Scope: Major** — riscrittura di due decisioni `[ADOPTED]`, fusione di due package, ristrutturazione di un'epic.

| Destinatario | Responsabilità |
|---|---|
| **Architect** | applicare gli edit A-E allo spine e F-L ai companion; verificare che il nuovo layering non violi altre AD |
| **PM / PO** | applicare gli edit M (SPEC) e le riscritture di Epic 2/3 in `epics.md`; aggiornare `sprint-status.yaml` |
| **Developer** | §4.6 sulla Story 1.1; poi riprendere la code review sospesa, ora sbloccata |

### Sequenziamento

1. Spine (A-E) — è la fonte da cui discende tutto il resto.
2. Companion (F-L) e SPEC (M) — devono essere coerenti con lo spine prima delle story.
3. `epics.md` + `sprint-status.yaml`.
4. Story 1.1 (§4.6) e ripresa della code review.

### Criteri di successo

- Nessun documento contiene più il termine «primitiva nota» né `packages/primitives`.
- AD-11 e `penpot-pipeline.md` concordano su cosa è generato, da cosa, e con quale garanzia.
- Ogni componente di Epic 2 ha un percorso definito: nessuna categoria «saltata».
- Il confine `domains/` ↛ `editor/` è difeso da un lint, non solo da una frase.
- La code review della Story 1.1 può riprendere senza decision-needed bloccati da AD-11.
