# `src/penpot` — l'unico punto che parla con Penpot

- `mcp-client.ts` — utilità MCP: `callPenpotTool`, `parseExecuteCodeEnvelope`, `resolveMcpEndpoint` (variabili `PENPOT_MCP_URL`, `PENPOT_MCP_TOKEN`).
- `penpot-reader.ts` — legge solo il catalogo token per `theme --live` (resta fino alla Story 2.26).
- `read-component.ts` — `readComponent(nome)` (Story 2.23): legge un componente e restituisce una `Lettura` validata con zod.

Nessun file qui scrive su Penpot: niente `set*`, niente `storage`, nessun plugin data scritto.

## `readComponent(nome, { endpoint?, callTool?, timeoutMs? })`

Esegue via `execute_code` il sorgente `READ_COMPONENT_SOURCE`. Prima di leggere, `assertRegistryCovered()` controlla che ogni proprietà del registro (`registeredProperties()`) stia in `READ_PROPERTIES`, e che ogni voce di `READ_PROPERTIES` compaia nel sorgente come `style.<p>` o come letterale `"<p>"` (la lista iniettata delle esclusioni degli override non conta). Se una manca, l'errore la nomina.

### Ricerca

I candidati sono i container di varianti e i componenti principali senza container di `penpot.library.local.components`. Si cerca prima il plugin data `pagebuilder.contract` uguale a `<nome>` o a `<nome>@<versione>`, poi il nome del layer (uguale, o uguale in kebab-case: `ShopCard` → `shop-card`). Con zero risultati l'errore nomina il nome cercato ed elenca i componenti del file. Con più di un risultato li elenca tutti.

### Cosa legge e da dove

| Campo della `Lettura` | Da dove |
|---|---|
| `component` | il nome del container (o del componente principale) |
| `pluginData` | tutte le chiavi del namespace `pagebuilder` (`getSharedPluginDataKeys`); assente se non ce n'è nessuna. Vale per il container e per ogni layer. |
| `cells[].variant` | `variantProps` della variante la cui `mainInstance().id` coincide con l'`id` della board; `{}` per un componente senza container. Un `variantError` è un errore che nomina la cella. |
| `tokens` | `shape.tokens` così com'è, tranne `fontFamilies` → `fontFamily` (bug 5) |
| `style` di fill e tratto | il primo fill/tratto con colore (`gradient`/`image` se non è un colore pieno); `strokeWidth` > 0, `strokeStyle`, `strokeAlignment` |
| `style` di raggio, padding e gap | `borderRadius*`; padding e gap dal flex (o dalla griglia); solo se > 0 |
| `style` del testo | `fontSize`, `fontWeight`, `letterSpacing` (non 0), `fontFamily` |
| `fillOpacity`, `strokeOpacity`, `hidden` | opacità del fill e del tratto scelti (se ≠ 1, arrotondata), `hidden: true` per un layer nascosto. Non sono voci del registro: arrivano come "non registrata" (un avviso, mai in silenzio) |
| `opacity`, `shadow` | opacità ≠ 1 (Penpot dà null quando è di default); ombre visibili, come una stringa `x y blur spread colore` |
| `layoutDir`, `layoutAlign`, `layoutJustify`, `layoutWrap` | il flex, valore grezzo, sempre; una griglia dà `layoutDir: "grid"` (il registro avvisa) |
| `sizingH`, `sizingV` | `layoutChild`, altrimenti il dimensionamento del flex del layer stesso |
| `width`, `height`, `x`, `y` | misura del layer e `parentX`/`parentY`, arrotondati a 2 decimali (Penpot emette 288.0000114) |
| `constraintH`, `constraintV`, `position`, `clip` | i vincoli; `absolute` se `layoutChild.absolute`; `clip: true` se la board ha `clipContent` |
| `instance` | per un layer con `isComponentCopyInstance() && isComponentHead()` (mai dal nome): `component` = nome del `component()`, `contract` = plugin data `contract` del container della sua istanza principale, `variant` = `variantProps`, `overrides`. I figli dell'istanza non si leggono. |

Le proprietà legate a un token arrivano in `style` solo se hanno un valore non di default: un padding a 0 o un'opacità a 1 non producono un avviso "senza token".

### Il limite degli override

Penpot non espone gli override (`componentRefShape()` restituisce null). L'adattatore confronta allora, per indice, `tokens` e `style` dell'istanza e dei suoi discendenti con l'istanza principale della variante. Ogni proprietà diversa dà il suo nome in `overrides`, ordinato e senza doppioni: anche `fillOpacity`, `strokeOpacity` e `hidden`, quindi un'istanza con un fill trasparente o un layer nascosto è un override. Non contano i nomi di `PLACEMENT_PROPERTIES` (dimensionamento e geometria, bug 12) né il testo, che non si legge. Un layer senza corrispettivo, o di un altro tipo, dà `"struttura"`.

Il confronto vede solo ciò che l'adattatore legge. Un override su una proprietà che `styleOf` non scrive (per esempio l'altezza di riga) non si vede, e il nome di un layer non conta (`switchVariant` lo rinomina).

### Errori

- envelope: `parseExecuteCodeEnvelope` (errore del tool, niente testo, JSON non valido, `result` mancante);
- il sorgente restituisce `{ error }` per nome ignoto, doppio, cella senza variante, `variantError` o eccezione in Penpot, e l'adattatore lo rilancia così com'è;
- una `Lettura` che non passa lo schema dà un errore con il percorso zod di ogni problema (`cells.0.root.children.0.name: …`).

## Scheda Penpot sospesa

Il plugin MCP gira nella scheda di Penpot. Se il browser la sospende (scheda in secondo piano o finestra coperta) `execute_code` non risponde e la chiamata va in timeout. Tieni la finestra di Penpot visibile, oppure avvia il browser con:

```
--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows
```

## Test

- Livello 1, senza Penpot: `tests/penpot/read-component.test.ts`. Usa un `callTool` finto e non salva letture Penpot nel repo (regola 5).
- Dal vivo: `tests/penpot/read-component.live.test.ts` legge Badge, ShopCard e Carousel dal file "tailwind" (Penpot 2.18.3). Senza `PDS_PENPOT_LIVE=1` si salta, quindi in CI non gira mai. Per lanciarlo a mano, con Penpot aperto, il plugin MCP connesso e `PENPOT_MCP_TOKEN` nell'ambiente:

```
PDS_PENPOT_LIVE=1 pnpm --filter @penpot-ds/scripts exec vitest run tests/penpot/read-component.live.test.ts
```
