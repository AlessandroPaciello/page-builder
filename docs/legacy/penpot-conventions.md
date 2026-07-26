# Convenzioni Penpot MCP — penpot-design-system

Guida operativa per interagire col **server MCP di Penpot** durante la fase UX.
Caricata come `persistent_fact` dal workflow `bmad-create-ux-design` e dall'agente Sally.
Obiettivo: usare la Plugin API in modo affidabile, con meno errori, aderendo al design system.

## Tool MCP disponibili

| Tool | Uso |
|---|---|
| `high_level_overview` | Panoramica della Plugin API + struttura del file. Leggilo una volta a inizio sessione. |
| `penpot_api_info` | Documentazione di tipi/interfacce specifici prima di scrivere codice. |
| `execute_code` | Esegue JS con la Plugin API: è così che si costruisce/modifica il design. |
| `import_image` / `export_shape` | Import immagini ed export (anche per ispezione visiva). |

## Regole d'oro per `execute_code`

- **Non loggare ciò che ritorni.** `console.log` + `return` dello stesso dato duplica l'output. Ritorna e basta.
- **Usa `storage`** per conservare shape/risultati intermedi tra una chiamata e la successiva, invece di riconquistare lo stato ogni volta. Copia *subito* `penpot.selection` in `storage`: la selezione può cambiare.
- **Batch:** raggruppa più operazioni correlate in una sola `execute_code` invece di tante micro-chiamate.
- **`penpotUtils` prima di tutto:** usa `findShape`/`findShapes`/`shapeStructure`/`setParentXY`/`analyzeDescendants` invece di reimplementare ricerche o validazioni.
- **Consulta `penpot_api_info`** per il tipo che stai per manipolare se non sei certo della firma; non inventare metodi.

## Trappole della Plugin API (errori frequenti)

- **Gerarchia:** per aggiungere un figlio usa `parent.insertChild(parent.children.length, shape)`. **MAI `appendChild`** (rotto, posizione imprevedibile) — eccezione: board flex, dove si usa `board.appendChild(shape)`.
- **Dimensioni:** `width`/`height` sono read-only → usa `resize(w, h)`. `x`/`y` sono scrivibili (coordinate assolute di pagina). `parentX`/`parentY` read-only → posiziona con `penpotUtils.setParentXY(shape, px, py)`.
- **Flex layout:** l'ordine dell'array `children` è **invertito** rispetto all'ordine visivo per `dir="row"`/`"column"`. `board.flex.appendChild` è rotto: usa `board.appendChild(shape)` nell'ordine di apparizione visiva. Per aggiungere flex a un board con figli esistenti usa `penpotUtils.addFlexLayout(container, dir)` (preserva l'ordine).
- **Layout attivo:** se un board ha flex/grid, le posizioni dei figli sono controllate dal layout — modifica `rowGap`/`columnGap`/padding, non le x/y dei figli.
- **Testo:** la dimensione si cambia con `fontSize`, non con `resize` (che fissa `growType="fixed"`). Per auto-sizing reimposta `growType="auto-width"`/`"auto-height"`; attendi ~100ms prima di rileggere il bounding box.
- **Asincronia:** l'applicazione dei token è asincrona → attendi ~100ms per vederne l'effetto.
- **Z-order:** determinato dall'ordine in `children`; aggiungi prima gli sfondi, poi il foreground. Dopo: `bringToFront`/`sendToBack`/`setParentIndex(i)`.

## Sync design ↔ codice (design system)

Questo è un progetto di **design system**: la coerenza coi token e i componenti esistenti viene prima della creazione di nuovi elementi.

- **Aderenza stretta.** Quando porti stili da Penpot al codice (o viceversa) usa **esattamente** i valori del design. Non inventare valori mancanti; in assenza di un'informazione usa default neutri (bianco/nero), mai colori scelti a caso.
- **Riusa prima di creare.** Ispeziona con `penpotUtils.tokenOverview()` e `penpot.library.local`/`penpot.library.connected`; istanzia componenti esistenti con `component.instance()` invece di ridisegnarli.
- **Token = fonte di verità per i valori.** Catalogo in `penpot.library.local.tokens` (`sets`, `themes`). Applica con `shape.applyToken(token, [props])` (es. `["fill"]`, `["font-size"]`). Crea con `set.addToken(type, name, value)`, supportando riferimenti come `"{color.primary}"`. Solo i set `active` hanno effetto.
- **Generazione codice:** `penpot.generateStyle(shapes, { type: "css", withChildren: true })` e `penpot.generateMarkup(...)` per estrarre CSS/HTML/SVG fedeli al design.
- **Naming:** allinea i nomi di token/componenti Penpot a quelli del design system in codice (`@penpot-ds/*`), così la mappatura resta 1:1.
- **Validazione:** dopo aver costruito, usa `penpotUtils.analyzeDescendants` per verificare allineamento (es. griglia a multipli di 4) e `penpotUtils.isContainedIn` per i confini.

## Inizio sessione (checklist)

1. Verifica che il server `penpot` sia connesso (plugin "Connected"); altrimenti il lavoro ricade su specifiche testuali.
2. `high_level_overview` per orientarti; chiedi quale file/board Penpot usare.
3. Ispeziona token e libreria esistenti prima di proporre nuovi elementi.
