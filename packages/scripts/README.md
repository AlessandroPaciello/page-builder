# @penpot-ds/scripts

Legge il catalogo token da Penpot (o dalla fixture committata) e genera i file di [`@penpot-ds/tokens`](../tokens/README.md). Ospita anche il nucleo puro della pipeline v3 (`src/core`, Story 2.20–2.22): gli schemi `Lettura`, `Finding`, `Change`, `Suggerimento`, il registro delle proprietà, le regole di geometria, la verifica e la generazione dei componenti; sopra il nucleo c'è il server MCP `pds` (`src/server`, Story 2.24).

La pipeline v1 (Story 2.1–2.11) e la v2 (Story 2.12–2.16) sono state rimosse (Story 2.16 e 2.18): niente più comandi `library`/`propose`/`extract`/`render`/`gates`, contratti di estrazione né istantanee. La pipeline v3 cresce dalla Story 2.19: il nucleo c'è (2.20–2.22), l'adattatore Penpot `readComponent` pure (2.23, [`src/penpot/README.md`](src/penpot/README.md)) e il server MCP `pds` (2.24, [`src/server/README.md`](src/server/README.md)).

## Script

| Comando | Cosa fa |
|---|---|
| `pnpm --filter @penpot-ds/scripts theme` | Rigenera `tailwind-theme.css` + `tokens.generated.ts` **dalla fixture committata** (`data/penpot-catalog.json`), offline. |
| `pnpm --filter @penpot-ds/scripts theme -- --live` | Si connette al server MCP Penpot (vedi [Connessione a Penpot](#connessione-a-penpot)), legge il catalogo reale, **aggiorna anche la fixture committata** (solo dopo che la generazione è riuscita), poi rigenera. Mai in CI né in build. |
| `pnpm --filter @penpot-ds/scripts test` | Test unitari, offline e deterministici: nessuna rete (la lettura live nei test è un seam). Il test dal vivo di `readComponent` si salta senza `PDS_PENPOT_LIVE=1`, il collaudo senza `PDS_PENPOT_COLLAUDO=1`. |
| `PDS_PENPOT_LIVE=1 pnpm --filter @penpot-ds/scripts exec vitest run tests/penpot/read-component.live.test.ts` | Legge Badge, ShopCard e Carousel dal Penpot locale (a mano, mai in CI). |
| `PDS_PENPOT_COLLAUDO=1 pnpm --filter @penpot-ds/scripts exec vitest run collaudo/` | Collaudo di Penpot sul campione `collaudo/campione.penpot`, su un'istanza nuova (a mano, mai in CI; procedura in [`collaudo/README.md`](collaudo/README.md)). |
| `pnpm --silent --filter @penpot-ds/scripts pds` | Avvia il server MCP `pds` su stdio. Non si lancia a mano: lo avvia Claude Code da `.mcp.json`. Dopo una modifica del nucleo o del server: `/mcp` → `pds` → reconnect. Non è una CLI: gli strumenti si chiamano solo via MCP. |

Uscite di `theme` (entrypoint `src/theme/main.ts`): `0` tema rigenerato · `1` input (argomento ignoto, fixture illeggibile, catalogo che non genera) · `2` penpot (lettura live fallita).

## Connessione a Penpot

Solo `theme --live` e `readComponent` (Story 2.23, usato dal server `pds` e dal test dal vivo) parlano con Penpot; i test di livello 1 e `theme` offline non leggono mai queste variabili.

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
- `src/penpot/` — l'unica cartella che parla con Penpot: `mcp-client.ts` (utilità MCP), `penpot-reader.ts` (client MCP minimale che legge solo `penpot.library.local.tokens`; `src/theme` lo importa da qui fino alla 2.26) e `read-component.ts` (`readComponent(nome)` → `Lettura`, Story 2.23; cosa legge e da dove in [`src/penpot/README.md`](src/penpot/README.md)).
- `src/shared/` — `paths.ts` (l'**unico** modulo di `src/` che calcola i path: `tests/paths.test.ts` fallisce nominando la chiave che punta a un file inesistente), `theme-generator.ts` (mapping puro `TokenCatalog → { css, ts }`; i nomi dei token li prende da `src/core/token-names.ts`), `naming.ts`.
- `src/server/` — il server MCP `pds` (Story 2.24): `server.ts` (`createPdsServer({ penpot, root })`, i sei strumenti), `tools.ts` (nomi e schemi zod), `write-changes.ts` (scrittura confinata nella cartella del componente), `generated-files.ts` (`checkGeneratedFiles`, livello 3, e i componenti già generati), `main.ts` (avvio su stdio con l'adattatore vero, unico import di `src/penpot`). Dettagli in [`src/server/README.md`](src/server/README.md).
- `src/core/` — il nucleo puro (Story 2.20): `schemas.ts` (zod `Lettura`, `Finding`, `Change`, `Suggerimento`, con un nome e senza versione), `registry.ts` (registro delle proprietà), `geometry.ts` (regole di geometria e `scaleFromThemeCss`, Story 2.21–2.22), `verify.ts`, `generate.ts`, `build-order.ts`, `hash.ts` (verifica, generazione, ordine e intestazione `@generated`, Story 2.22), `naming.ts` (nomi; `src/shared/naming.ts` li riesporta), `token-names.ts` (tipo, namespace e suffisso dei token), `index.ts`.
- `tests/core/` — i test del nucleo: livello 1 (`schemas.test.ts`, `registry.test.ts`, `geometry.test.ts`, `verify.test.ts`, `generate.test.ts`, `build-order.test.ts`, `hash.test.ts`, dati scritti a mano) e livello 4 (`registry-tailwind.test.ts`). Stanno fuori da `src/core` perché importano `vitest`, che il confine `core` vieta.
- `tests/server/` — livello 2 (`server.test.ts`, server in memoria con adattatore finto; `write-changes.test.ts`, limiti dei path) e livello 3 (`generated-files.test.ts`, sul repo vero e su una cartella temporanea).
- `collaudo/` — collaudo degli aggiornamenti di Penpot (Story 2.25): `campione.penpot`, `collaudo.live.test.ts` (saltato senza `PDS_PENPOT_COLLAUDO=1`) e la procedura in [`collaudo/README.md`](collaudo/README.md).
- `tests/penpot/` — `read-component.test.ts` (livello 1, `callTool` finto) e `read-component.live.test.ts` (dal vivo, saltato senza `PDS_PENPOT_LIVE=1`).
- `tests/fixtures/` — il catalogo Tailwind dei test e il suo loader; `components.ts`, le `Lettura` scritte a mano di Badge e ShopCard⊃Badge (ShopCard è un contratto di prova, definito lì).
- `scripts/check-boundaries.mjs` + `tests/check-boundaries.test.ts` — gate di confine con prova rosso/verde per ogni regola.
- `tests/pipeline-boundary.test.ts` — le directory v1/v2 non esistono e `process.exit*` compare solo in `src/theme/main.ts` (`src/server/main.ts` non lo usa).

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

## Verifica e generazione dei componenti (Story 2.22)

Quattro funzioni pure, `Lettura` → dati, guidate dal contratto di `@app/contracts` (si trova da `pluginData.contract`, `badge` o `badge@1`), senza codice per componente. Ricevono `tokenTypeOf`, `scale` (`scaleFromThemeCss(css)`: le `--spacing-<sfx>: <n>px` del tema) e, facoltativi, `contracts` (default `COMPONENT_CONTRACTS`) ed `existingTsx`.

- `verifyComponent(lettura, input)` → `Finding[]`. **Celle:** assi `option` del contratto più `state` facoltativo (`default|hover|active|focus|disabled`); un asse o un valore estraneo, una cella doppia, una cella di stato senza la sua cella base sono blocchi; le celle mancanti no. **Parti:** la chiave è `pluginData.part` (kebab-case); la radice senza chiave vale `root`. Un layer senza chiave → domanda `part` [kebab del nome, `ignora`]; `ignora` lo fonde nel genitore (le sue classi si perdono, con un avviso). Una chiave doppia tra fratelli → domanda `repeat` sul secondo [`lista`, `parte-nuova`]: `lista` = una parte che si ripete (una `cva`, un `.map` nel TSX, le copie non si visitano), `parte-nuova` = domanda `part` aperta. La stessa chiave in rami diversi è un blocco. **Istanze:** il contratto annidato viene da `instance.contract` (`badge@1`, plugin data del container d'origine, con controllo della versione) e, se manca, dal kebab di `instance.component`; variant validate sul contratto annidato, override bloccanti tranne dimensionamento e geometria (`sizingH`, `sizingV`, `GEOMETRY_ENTRIES`, bug 12), figli non visitati. **Elemento** (solo senza `existingTsx`): un nome da titolo (`title|heading|titolo`) senza `pluginData.element` → domanda `element` [`h2`, `h3`, `p`]. Con `existingTsx`, una parte la cui chiave non compare come `.<key>` o `["<key>"]` dà un avviso di export inutilizzato. Arrivano anche gli avvisi e le domande del registro, con la cella in `where`.
- `generateComponent(lettura, { ...input, generated, existingStyles?, existingStories? })` → `{ changes, findings, suggestions }`. Con un blocco o una domanda, o un'istanza di un componente che non sta in `generated`, nessun `Change`. Scrive in `packages/ui/src/domains/<kebab>/` (path relativi alla root del repo):
  - `<Comp>.styles.ts` (`@generated`): una `cva` per chiave con tutti gli assi `option` (stringa vuota dove non cambia niente), classi comuni nella base, quelle spiegate da un asse in `variants`, le altre in `compoundVariants`; la misura della radice per cella da `rootSizeClasses`; `<id>Parts`, `<id>ListParts`, `<Comp>Axes`, `<id>Styles` e, se ci sono istanze, `<id>Instances.<key>(axes)` → props di variante del componente annidato (una tabella per cella se variano). **Stati:** la differenza tra la cella di stato e la sua cella base, con il prefisso `hover:`, `active:`, `focus-visible:` o `[&:is(:disabled,[data-disabled],[aria-disabled=true])]:` (come il default di `globals.css`); si generalizza **solo l'asse che si chiama `size`** (convenzione sul nome: un asse delle taglie va chiamato `size` nel contratto, altrimenti non si generalizza); gli altri assi devono coincidere con la cella di stato. L'hover di `variant=default, size=md` vale per tutte le taglie di `default`, mai per `secondary`, anche se è soltanto additivo. Con stati disegnati su più taglie ogni taglia disegnata tiene la sua differenza; le taglie non disegnate prendono quella della taglia di default del contratto, se è disegnata, altrimenti della prima taglia disegnata. Focus e disabled non disegnati non danno classi. Una cella di stato che toglie soltanto classi, o una parte presente solo nella cella di stato o solo nella base, dà un avviso e nessuna classe.
  - `<Comp>.stories.tsx` (`@generated`): CSF3, una story per cella non di stato, `args` = assi + campioni dei field (stringa → nome del field, numero 1, booleano `false`, enum → primo valore, array `[]`, opzionale omesso), nome = PascalCase dei valori.
  - `<Comp>.tsx`, **solo se `existingTsx` manca**: lo scaffold (`data-slot` = chiave, la radice col nome del contratto, `cn(s.root(axes), className)` e `{...props}`; elemento dalla risposta `element`, da un indizio nel nome, poi dal tipo di layer). Da lì in poi è dello sviluppatore: non compare mai in un `aggiorna`/`elimina`.
  - Un `styles.ts`/`stories.tsx` esistente senza marker `@generated` è un blocco (non si sovrascrive mai); identico al nuovo → nessun `Change`; modificato a mano → `aggiorna` con un avviso.
  - **Cambio di struttura:** con `existingStyles`, le `<id>Parts`/`<id>ListParts` vecchie si confrontano con le nuove; ogni parte aggiunta, tolta o diventata lista dà un `Suggerimento {part, kind, message, example}`, mai applicato, con l'esempio preso dal TSX attuale.
- `buildOrder(letture, generated)` → `{ order, findings }`: ordine topologico dalle istanze (a parità alfabetico); un annidato né letto né generato, un `instance.contract` sconosciuto o di un'altra versione, un ciclo, una lettura senza contratto valido e due letture con lo stesso contratto sono blocchi (ordine vuoto).
- `readGeneratedHeader(text)` → `{ version, hash, ok } | undefined`: la prima riga `// @generated pds <GENERATOR_VERSION> sha256:<hex> — non modificare a mano`, con l'hash del corpo dopo la prima riga (LF). SHA-256 viene da `node:crypto` (`hash.ts`), l'unico builtin ammesso nel nucleo; il test lo controlla su vettori noti. Serve al livello 3 (Story 2.24, `checkGeneratedFiles` in `src/server/generated-files.ts`).

Il livello 4 (`tests/core/registry-tailwind.test.ts`) compila anche ogni classe del registro e della geometria con il prefisso di ogni stato.

## Confini (`pnpm --filter @penpot-ds/scripts lint`)

Oltre alle regole di package (`@app/*` vietato tranne `@app/contracts`, `@penpot-ds/ui`, `apps/*`, relativi fuori dal package), il gate conosce le cartelle della v3 (Story 2.19), anche prima che esistano.

Gli import sono letti con il parser del compilatore TypeScript: dichiarazioni `import`/`export … from`, `import x = require()`, `import()`, `require()` e `import("x")` di tipo. Un testo che sembra un import dentro una stringa o un template non lo è; un sorgente che il parser non legge fa uscire il gate con 1. Sul testo senza commenti resta un backstop: `@app/` fuori dai casi ammessi, `@penpot-ds/ui` e `apps/` sono rossi anche dentro una stringa, il client MCP fuori da `src/penpot` anche in un literal qualunque.

| Regola | Cosa vieta |
|---|---|
| `core` | in `src/core` ogni import che non sia un relativo interno a `src/core`, `@app/contracts`, `zod` o `node:crypto` (esatto: un hash è deterministico); import dinamici e `require` con argomento non letterale; `process`, `console`, `fetch`, `globalThis`, `global`, `eval`, `Buffer`, `__dirname`, `__filename` e `import.meta` nel testo senza commenti (gli accessi a membro come `job.process()` restano ammessi) |
| `penpot` | il client MCP (`@modelcontextprotocol/sdk/…/client…`) fuori da `src/penpot`, e gli import di `src/penpot` da `src/shared` (un re-export lì aggirerebbe `server`). Il gate controlla il client MCP, non ogni accesso di rete: non garantisce da solo che nessun altro file parli con Penpot |
| `server` | gli import di `src/penpot` da `src/server`, tranne il punto di iniezione `src/server/main.ts` |
| `v3` | una cartella `v3` in `src/` (anche vuota) e gli import relativi verso una cartella `v3` |

## Cosa non toccare

`packages/tokens/src/tailwind-extras.css` di norma non ha corrispondenza nel catalogo Penpot (unica eccezione: `--color-tracer-primary`, tracciante Story 1.4): la generazione non lo tocca mai, va editato a mano.
