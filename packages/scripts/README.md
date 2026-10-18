# @penpot-ds/scripts

Legge il catalogo token da Penpot (o dalla fixture committata) e genera i file di [`@penpot-ds/tokens`](../tokens/README.md). Ospita anche il nucleo puro della pipeline v3 (`src/core`, Story 2.20–2.21): gli schemi `Lettura`, `Finding`, `Change`, il registro delle proprietà e le regole di geometria.

La pipeline v1 (Story 2.1–2.11) e la v2 (Story 2.12–2.16) sono state rimosse (Story 2.16 e 2.18): niente più comandi `library`/`propose`/`extract`/`render`/`gates`, contratti di estrazione né istantanee. La pipeline v3 cresce dalla Story 2.19: il nucleo c'è (2.20), adattatore Penpot e server MCP `pds` arrivano con le 2.23–2.24.

## Script

| Comando | Cosa fa |
|---|---|
| `pnpm --filter @penpot-ds/scripts theme` | Rigenera `tailwind-theme.css` + `tokens.generated.ts` **dalla fixture committata** (`data/penpot-catalog.json`), offline. |
| `pnpm --filter @penpot-ds/scripts theme -- --live` | Si connette al server MCP Penpot (vedi [Connessione a Penpot](#connessione-a-penpot)), legge il catalogo reale, **aggiorna anche la fixture committata** (solo dopo che la generazione è riuscita), poi rigenera. Mai in CI né in build. |
| `pnpm --filter @penpot-ds/scripts test` | Test unitari, offline e deterministici: nessuna rete (la lettura live nei test è un seam). |

Uscite di `theme` (entrypoint `src/theme/main.ts`): `0` tema rigenerato · `1` input (argomento ignoto, fixture illeggibile, catalogo che non genera) · `2` penpot (lettura live fallita).

## Connessione a Penpot

Solo `theme --live` parla con Penpot; test e `theme` offline non leggono mai queste variabili.

| Variabile | Obbligatoria | Default / effetto |
|---|---|---|
| `PENPOT_MCP_URL` | no | `http://localhost:9001/mcp/stream` (proxy MCP del frontend Penpot, flag `enable-mcp`) |
| `PENPOT_MCP_TOKEN` | no (ma il server multi-user lo richiede per ogni tool) | aggiunto come query `userToken`; mascherato (`userToken=***`) in ogni messaggio |

Setup di Penpot, del token e di direnv: [README alla root](../../README.md#penpot-locale-e-server-mcp).

Se manca il token, se è stato rigenerato o se il plugin non è connesso, `theme --live` fallisce con exit 2 e un errore che nomina `PENPOT_MCP_TOKEN`.

## Dove vive la fixture del catalogo token

`data/penpot-catalog.json` — serializzazione del catalogo token Penpot (`{ sets: [{ name, tokens: [{ name, type, value }] }] }`), solo i set `active`. Committata così la generazione gira offline e il diff della fixture mostra cosa è cambiato nel design.

È l'unica fixture da cui si genera il tema committato: la vecchia library `mis` è stata cancellata. Un test (`tests/no-legacy-consumers.test.ts`) impedisce che nomi `mis-*` ricompaiano in `packages/ui/src` e `apps/web/src` (`packages/tokens` è l'eccezione ammessa).

### Catalogo Tailwind dei test

`tests/fixtures/tailwind-catalog.json` (Story 2.19) — catalogo token scritto come dati, **non letto da Penpot**: i set `tailwind` (palette e scale di Tailwind v4) e `semantic` (ruoli shadcn come riferimenti alla palette) del seme dello spike, `_bmad-output/spikes/penpot-ai-kit-2026-10-10/tailwind-to-penpot/tokens.json` (ricavato da `theme.css`), convertiti nella forma `TokenCatalog`. Il set `brand/ocean` resta fuori: ridefinisce i ruoli di `semantic` e collide nel generatore fino alla Story 2.26. Serve solo ai test (`tests/fixtures/catalog.ts` lo carica); `data/penpot-catalog.json` e il tema generato non cambiano fino alla 2.26.

## File

- `data/penpot-catalog.json` — il catalogo token committato.
- `src/theme/` — `main.ts` (entrypoint: argomenti e codice d'uscita), `theme-command.ts` (lettura e scrittura atomica del tema).
- `src/penpot/` — l'unica cartella che parla con Penpot: `mcp-client.ts` (utilità MCP) e `penpot-reader.ts` (client MCP minimale che legge solo `penpot.library.local.tokens`; `src/theme` lo importa da qui fino alla 2.26).
- `src/shared/` — `paths.ts` (l'**unico** modulo di `src/` che calcola i path: `tests/paths.test.ts` fallisce nominando la chiave che punta a un file inesistente), `theme-generator.ts` (mapping puro `TokenCatalog → { css, ts }`; i nomi dei token li prende da `src/core/token-names.ts`), `naming.ts`.
- `src/core/` — il nucleo puro (Story 2.20): `schemas.ts` (zod `Lettura`, `Finding`, `Change`, con un nome e senza versione), `registry.ts` (registro delle proprietà), `geometry.ts` (regole di geometria, Story 2.21), `token-names.ts` (tipo, namespace e suffisso dei token), `index.ts`.
- `tests/core/` — i test del nucleo: livello 1 (`schemas.test.ts`, `registry.test.ts`, `geometry.test.ts`, dati scritti a mano) e livello 4 (`registry-tailwind.test.ts`). Stanno fuori da `src/core` perché importano `vitest`, che il confine `core` vieta.
- `tests/fixtures/` — il catalogo Tailwind dei test e il suo loader.
- `scripts/check-boundaries.mjs` + `tests/check-boundaries.test.ts` — gate di confine con prova rosso/verde per ogni regola.
- `tests/pipeline-boundary.test.ts` — le directory v1/v2 non esistono e `process.exit*` compare solo in `src/theme/main.ts`.

## Registro delle proprietà (`src/core/registry.ts`)

Una voce per proprietà Penpot, con la sua traduzione in classi Tailwind: un token del tipo dichiarato (`fill` → `bg-*`/`text-*`/`fill-*` sulle icone, `strokeWidth` → `border-(length:--border-width-*)`, `fontFamily` → `font-*`, …) oppure una parola chiave di una lista chiusa (layout flex, `strokeStyle`, dimensionamento `sizingH`/`sizingV`). Il valore di default di una parola chiave non dà classi; "fill" dipende dalla direzione del genitore (in colonna `self-stretch` in orizzontale e `flex-1` in verticale, in riga il contrario, fuori da un flex `w-full`/`h-full`). Quattro angoli con lo stesso token diventano `rounded-<sfx>`.

`layerClasses(layer, { parent, tokenTypeOf, scale })` restituisce le classi di un layer, gli avvisi e le domande. `parent` assente = il layer è la radice della cella; la direzione del flex si ricava da `parent.style.layoutDir`. Una proprietà che il registro non sa tradurre (non registrata, fuori lista, token del tipo sbagliato o assente dal tema, `strokeAlignment` center/outer) non ferma mai la generazione: è un `Finding` di tipo avviso, senza classe, che dice cosa aggiungere.

Insegnare una proprietà = una voce in `REGISTRY` + i suoi casi verdi in `tests/core/registry.test.ts` (il test fallisce se una voce non ha il suo verde; il rosso di ogni voce lo genera il test: token del tipo sbagliato o valore fuori lista). Il livello 4 (`tests/core/registry-tailwind.test.ts`) espande ogni voce su tutti i token del suo tipo nel tema generato dal catalogo Tailwind, compila con `@tailwindcss/node` e fallisce nominando la classe che non produce CSS o che usa una variabile assente dal tema; espande anche le classi di geometria sulla scala `--spacing-*` del tema generato.

### Geometria (`src/core/geometry.ts`, Story 2.21)

Voci `kind: "geometry"`, lette solo da `style`: `x`, `y`, `width`, `height` (px, `x`/`y` relativi all'angolo del genitore), `position` (`flow`|`absolute`), `constraintH` (`left`|`right`|`leftright`|`center`|`scale`), `constraintV` (`top`|`bottom`|`topbottom`|`center`|`scale`), `clip` (booleano). `layerClasses` le valida (un valore malformato è un avviso, senza classe) e poi applica le regole di contesto di `geometryClasses`:

- **Scala** = i token `spacing` del tema (`scale: {suffix, px}[]`), non i multipli di 4px. In scala `w-<sfx>`; fuori scala `w-[37px]` con un avviso che nomina il passo più vicino (a parità il più piccolo); negativi `-left-<sfx>` o `left-[-3px]`; zero `<prefix>-0`.
- **Misura fissa** (sizing `fix`, anche se assente, su un layer non radice) → `w-`/`h-`; niente se l'assoluto è ancorato ai due lati (`leftright`/`topbottom`) o ha vincolo `scale`, o se tutti i figli nel flusso sono `fill` su quell'asse (vale anche per la radice).
- **Radice:** `rootSizeClasses(cells, { scale })` dà le classi di misura per cella: vuote se la misura è uguale in tutte le celle.
- **Assoluti:** `absolute` sul layer, `relative` sul genitore; `left`/`right`/`leftright` → `left-*`/`right-*` (in verticale `top-*`/`bottom-*`); `center` → `left-1/2 -translate-x-1/2` con un avviso se non è centrato esattamente; `scale` → avviso, nessuna classe su quell'asse. Nei layer nel flusso `x`/`y` e vincoli non danno classi.
- **Ritaglio** (solo `clip: true`): `overflow-hidden` se un figlio esce dal riquadro o se c'è un raggio e un figlio tocca un bordo; se niente esce ma un discendente ha contenuto variabile (testo, immagine, `pluginData.slot`) è una domanda con `key: "overflow"` (`hidden`|`visible`); altrimenti nessuna classe.
- **"Fill" dentro hug:** figlio `fill` in un genitore `auto` sullo stesso asse → domanda con `key: "fillInHugH"`/`"fillInHugV"` (`fill` = classi di fill, `hug` = nessuna classe).

Una `domanda` porta sempre `key`: la chiave di plugin data in cui `pds-code` scriverà la risposta. Una risposta valida sostituisce la domanda, un valore non valido la ripropone.

## Confini (`pnpm --filter @penpot-ds/scripts lint`)

Oltre alle regole di package (`@app/*` vietato tranne `@app/contracts`, `@penpot-ds/ui`, `apps/*`, relativi fuori dal package), il gate conosce le cartelle della v3 (Story 2.19), anche prima che esistano:

| Regola | Cosa vieta |
|---|---|
| `core` | in `src/core` ogni import che non sia un relativo interno a `src/core`, `@app/contracts` o `zod`; import dinamici e `require` con argomento non letterale; `process`, `console`, `fetch`, `globalThis`, `global`, `eval`, `Buffer`, `__dirname`, `__filename` e `import.meta` nel testo senza commenti (gli accessi a membro come `job.process()` restano ammessi) |
| `penpot` | il client MCP (`@modelcontextprotocol/sdk/…/client…`) fuori da `src/penpot`, e gli import di `src/penpot` da `src/shared` (un re-export lì aggirerebbe `server`). Il gate controlla il client MCP, non ogni accesso di rete: non garantisce da solo che nessun altro file parli con Penpot |
| `server` | gli import di `src/penpot` da `src/server`, tranne il punto di iniezione `src/server/main.ts` |
| `v3` | una cartella `v3` in `src/` (anche vuota) e gli import relativi verso una cartella `v3` |

## Cosa non toccare

`packages/tokens/src/tailwind-extras.css` di norma non ha corrispondenza nel catalogo Penpot (unica eccezione: `--color-tracer-primary`, tracciante Story 1.4): la generazione non lo tocca mai, va editato a mano.
