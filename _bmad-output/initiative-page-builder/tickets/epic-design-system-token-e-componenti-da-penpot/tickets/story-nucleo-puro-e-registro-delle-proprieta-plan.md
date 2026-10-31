---
ticket: 20
title: 'Story 2.20 — Nucleo puro e registro delle proprietà'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_revision: 'dbcd2c4ae83d94f9be639d6c687cb86be84273df'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-page-builder/archive-v6/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `packages/scripts/src/core` non esiste. Il registro (`src/shared/style-properties.ts`) è un residuo v1/v2 senza consumer: tabella ruolo → proprietà, `coveredByBase` su `strokeWidth` (bug 4), `fontFamilies` plurale bloccato (bug 5), nessuna voce di dimensionamento (bug 3).

**Approach:** Creare il nucleo puro in `src/core` con gli schemi zod `Lettura`, `Finding` e `Change` e il registro riscritto, dove ogni voce sa tradursi in classi Tailwind. Tutto testato con dati scritti a mano (livello 1) e compilando ogni classe con la Tailwind installata (livello 4).

## Boundaries & Constraints

**Always:** `src/core` passa i confini della 2.19 (solo relativi interni, `@app/contracts`, `zod`). I test vivono in `tests/core/`, perché un `.test.ts` in `src/core` importerebbe `vitest`. La traduzione è deterministica: classi ordinate e senza doppioni. `theme` produce gli stessi file di oggi, e la CI resta verde.

**Never:**
- adattatore Penpot (2.23) o server (2.24);
- geometria (misure fisse, posizione, vincoli, ritaglio): è della 2.21;
- verifica, `cva` o generazione: sono della 2.22;
- copiare `test-v3/`;
- fixture di lettura Penpot;
- toccare `contracts`, `tokens`, `ui`.

**Decisioni (mie, da confermare se riemergono):**
- `TokenType`, `TYPE_NAMESPACE`, `varSuffix` e `varName` passano in `src/core/token-names.ts`. `shared/theme-generator.ts` li importa da lì e li riesporta: l'API non cambia.
- Il registro perde `read`, `ROLE_PROPERTIES`, `PART_ROLES`, le classi di rimozione e `coveredByBase`. Il modo di leggere le proprietà lo decide l'adattatore (2.23).
- `positionAbsolute`, `positionX`, `positionY` e `zIndex` escono dal registro. La 2.21 li rifà con il modello a vincoli dello spike.
- `fontFamily` (singolare, Penpot 2.18.3) sostituisce `fontFamilies`.
- **Proprietà non traducibile** (risposta di Alessandro, 2026-10-18): dà un `Finding` `avviso`, mai un blocco, e nessuna classe. Il messaggio nomina proprietà, valore o token e suggerisce cosa aggiungere: la voce del registro con la sua traduzione, il valore che manca alla lista o il tipo di token atteso.
- `strokeStyle` dashed/dotted → `border-dashed`/`border-dotted`. `strokeAlignment` center/outer → avviso, nessuna classe.
- `sizingH`/`sizingV` (`fix`·`fill`·`auto`, default `fix`). `fill` dipende dalla direzione del genitore:
  - in colonna, H = `self-stretch` e V = `flex-1`;
  - in riga, H = `flex-1` e V = `self-stretch`;
  - senza flex nel genitore, `w-full`/`h-full`.
  
  `auto` e `fix` non danno classi (le misure fisse sono della 2.21).

## I/O & Edge-Case Matrix

| Scenario | Input | Output |
|---|---|---|
| token | `paddingTop` = `spacing.4` | `pt-4` |
| bordo (bug 4) | `strokeWidth` = token borderWidth `1` | `border-(length:--border-width-1)`; sui layer icona nessuna classe |
| font (bug 5) | `fontFamily` = `sans` | `font-sans` |
| fill (bug 3) | `sizingH: fill` in un genitore `column` | `self-stretch` |
| radius | quattro angoli con lo stesso token | `rounded-<sfx>` (un'unica classe) |
| parola chiave | `layoutDir: column` | `flex flex-col`; il valore di default non dà classi |
| fuori lista | `layoutDir: diagonal` | avviso che nomina proprietà, valore e valori ammessi, nessuna classe |
| non registrata | `blur` | avviso che nomina la proprietà e suggerisce la voce da aggiungere, nessuna classe |
| token di tipo sbagliato | `fill` legato a un token spacing | avviso con il tipo atteso, nessuna classe |
| Lettura malformata | layer senza `name` | `Lettura.safeParse` fallisce con il path |

</frozen-after-approval>

## Code Map

- `packages/scripts/src/shared/style-properties.ts` (+ il suo test): si cancellano dopo il passaggio a `src/core/registry.ts`. Da riusare: le voci token e keyword (prefissi, `byLayerKind`, classi `keywordClass` del flex), gli errori nominativi e il collasso dei radius. `naming.ts` resta.
- `packages/scripts/src/shared/theme-generator.ts:8-145`: `TokenType`, `TYPE_NAMESPACE`, `toWords`, `varSuffix` e `varName` da spostare. Il resto (hash, generazione) non si tocca. Sul token `borderWidth` e su `opacity` non c'è un namespace Tailwind: si usa `<utility>-(length:--border-width-<sfx>)` e `opacity-(--opacity-<sfx>)`.
- `packages/scripts/tests/fixtures/catalog.ts` + `tailwind-catalog.json`: il catalogo del livello 4. Non ha token `opacity`: il test aggiunge a mano un set minimo con un token opacity.
- `packages/ui/src/styles/tracer-tokens.test.ts:7-32`: esempio d'uso di `compile` di `@tailwindcss/node` con `build([...])`, confrontato con `build([])`.
- `packages/scripts/package.json`: aggiungere `zod` alle dependencies, `@tailwindcss/node` e `tailwindcss` alle devDependencies (`catalog:`).
- `packages/scripts/scripts/check-boundaries.mjs`: va solo letto. Il test del package reale deve restare verde.
- `_bmad-output/spikes/.../test-v3/codice/packages/scripts/src/v3/generate.ts:193-262` (`classesOf`): riferimento per sizing e radius, non si copia.
- Forma della lettura nello spike: layer `{name, kind, tokens, style, children}`, celle con le props di variante, istanze.

## Tasks & Acceptance

**Execution:**
- [x] `packages/scripts/tests/core/*.test.ts`: scriverli per primi e vederli rossi. Contengono la matrice e un test rosso/verde per voce del registro.
- [x] `packages/scripts/src/core/schemas.ts`: tre schemi zod.
  - `Lettura`: componente, celle con props di variante e albero dei layer (`name`, `kind`, `pluginData` `part`/`when`/`slot`, `tokens`, `style`, `instance` opzionale, `children`).
  - `Finding`: unione su `level` `avviso`|`blocco`|`domanda`, con `where` e `message`. `domanda` ha `options` (almeno 2).
  - `Change`: `path`, `action` `crea`|`aggiorna`|`elimina`, `content` opzionale.
- [x] `packages/scripts/src/core/token-names.ts` + `shared/theme-generator.ts`: spostamento con riesportazione.
- [x] `packages/scripts/src/core/registry.ts`: le voci (Decisioni), più `layerClasses(layer, {parentDir, tokenTypeOf}) → {classes, findings}`.
- [x] `packages/scripts/src/core/index.ts`: export pubblico.
- [x] `packages/scripts/tests/core/registry-tailwind.test.ts` (livello 4): `generateTheme(catalogo Tailwind)`, poi `compile('@import "tailwindcss";' + css)`. Per ogni voce e ogni token del suo tipo, ogni valore keyword e ogni sizing, `build([cls])` deve essere diverso da `build([])`. Il messaggio nomina voce e classe. Una voce senza token nel catalogo è un rosso.
- [x] Cancellare `style-properties.ts` e il suo test; aggiornare il README del package, il `description` di `package.json` e `sprint-status.yaml`.

**Acceptance Criteria:**
- Given il branch, when lancio `pnpm --filter @penpot-ds/scripts lint`, then i confini passano con i file di `src/core`.
- Given il branch, when cerco `ROLE_PROPERTIES|coveredByBase|fontFamilies:` in `packages/scripts/src/core/registry.ts` e in `src/shared`, then nessun risultato (il tipo di token `fontFamilies` resta, anche come chiave di `TYPE_NAMESPACE` in `token-names.ts`: è il nome Penpot del tipo, non la proprietà).
- Given `pnpm turbo run check-types lint test --force`, then tutto verde.

## Implementation Notes

- Ordine: il codice è stato scritto prima dei test. Il rosso è stato provato dopo, con mutazioni del registro: spessore del bordo senza classe, `fontFamily` rinominata, "fill" senza classi, collasso dei raggi disattivato, classe `border-width-*` inesistente, variabile `--opac-*` assente, `flex-wrapped`. Ogni mutazione rende rosso il livello 1 o il livello 4.
- `tests/core/registry.test.ts`: la tabella `GREEN` è tipata `Record<RegisteredProperty, …>` e un test confronta le sue chiavi con il registro. Una voce senza il suo verde è rossa sia per `tsc` sia per vitest. Il rosso di ogni voce è automatico: token del tipo sbagliato per le voci token, valore fuori lista per quelle a parola chiave.
- Livello 4: `compile().build()` di `@tailwindcss/node` accumula i candidati, quindi ogni classe si confronta con l'output della build precedente e non con quella vuota. Le classi con variabile (`-(--x)`) producono CSS anche se la variabile non esiste: il test controlla anche che ogni `--var` sia dichiarata nel tema generato. Il token di spessore del catalogo Tailwind ha suffisso `default` (`border-(length:--border-width-default)`).
- Avvisi in più rispetto alla matrice: valore senza token su una voce token, token assente dal tema, parola chiave legata a un token. Sono tutti avvisi senza classe, coerenti con la decisione sulle proprietà non traducibili.
- `naming.ts` resta, ma non ha più importatori: lo userà il generatore della 2.22.
- `Change`: `content` è obbligatorio per `crea`/`aggiorna` e vietato per `elimina` (unione discriminata, `elimina` strict). È più stretto del "content opzionale" del task, perché un `crea` senza contenuto non ha senso per il server della 2.24.
- Criterio di accettazione 2: corretto da `fontFamilies"` a `fontFamilies:`. Il testo originale colpiva il tipo di token Penpot (`token("fontFamilies", …)`), che è legittimo.

## Spec Change Log

## Review Triage Log

| # | Finding | Verdetto | Evidenza | Esito |
|---|---|---|---|---|
| 1 | `layerClasses` lancia se `varSuffix` fallisce (token `color` di tipo color) (Edge, Blind) | medium | `varSuffix` lancia sul suffisso vuoto; un'eccezione ferma tutto il componente, contro "mai un blocco" | patch: try/catch → avviso, con test |
| 2 | `fill` su un layer icona dà `bg-*` (Edge, Blind) | medium | `fill` guardava solo `text`; su SVG `bg-*` non colora l'icona e non dà avvisi | patch: `fill-*` sulle icone, verde `ellipse`; il livello 4 lo compila |
| 3 | Gli avvisi "non registrata" e "non tradotta" non nominano valore o token (Edge) | low | la decisione chiede "nomina proprietà, valore o token"; correzione diretta del messaggio | patch |
| 4 | `strokeAlignment: center` senza test (VG) | low | coperto solo `outer`; con `center: ""` tutto resta verde | patch: `it.each(["center","outer"])` |
| 5 | Lista `ICON_LAYER_KINDS` non fissata da un test (VG) | low | il test cancellato la fissava; ora `ellipse`/`line` potevano sparire senza rosso | patch: test della lista e verde `line` |
| 6 | `elimina` con `content` accettato e ripulito in silenzio (Edge, VG) | low | correzione diretta (`.strict()`) | patch, con test |
| 7 | Classi morte `flex-nowrap`/`items-stretch` sui default (Blind) | low | il default esce prima di tradurre; correzione diretta | patch: `""` |
| 8 | README e intestazione dicono "un caso verde e uno rosso" (Blind) | low | il rosso lo genera `redCase`; correzione del testo | patch |
| 9 | Criterio 2 (`fontFamilies:`) colpisce `TYPE_NAMESPACE` in `token-names.ts` (Edge) | low | vero: la chiave `fontFamilies: "font"` è il tipo del token, non la proprietà | criterio ristretto al registro e a `src/shared`, con nota |
| 10 | `Change` più stretto del task ("content opzionale") (Edge, VG) | low | nessun produttore oggi; la 2.24 ha bisogno del contenuto per crea/aggiorna | scartato; nota nelle Implementation Notes |
| 11 | `Change.path` accetta path assoluti e `..` (Edge, Blind) | medium | il danno nasce quando il server della 2.24 scrive su disco; la risoluzione dei path è sua | defer |
| 12 | Valori di default grezzi senza token (`paddingTop: 0`) danno avvisi; default Penpot di `alignItems` non verificato; `flex-1` senza `min-w-0` (Blind) | maybe-false (medium) | dipende da cosa emette l'adattatore (2.23) e dal default reale di Penpot (collaudo 2.25) | defer |
| 13 | Mancano `lineHeight`, `textAlign`, `textTransform`, `textDecoration`, `fontStyle` e le scorciatoie `p-*`/`px` (Blind) | medium | preesistente (il vecchio registro non le aveva); oggi danno avvisi, non classi perse in silenzio | defer |
| 14 | `where` è solo `layer "<nome>"`, senza cella né percorso (Edge, Blind) | false | `layerClasses` lavora su un layer; il chiamante (generatore 2.22) scorre celle e percorsi e qualifica `where`, e nel nucleo non si perde nulla | scartato |
| 15 | Classi di rimozione cancellate (Edge) | false | la rimozione è nelle Decisioni (blocco frozen); le varianti per cella sono della `cva` della 2.22 | scartato |
| 16 | Opzioni doppie in una `domanda` (Edge) | low | improbabile; la correzione aggiunge un refine | scartato |
| 17 | `keyword()` con `null` e motivo vuoto (Edge) | low | l'unica voce con `null` passa il motivo; improbabile | scartato |
| 18 | `strokeStyle`/`strokeAlignment` su icone usano il modello del bordo CSS; `strokeWidth` icona senza avviso (Blind) | low | `strokeWidth` icona senza classi è nella matrice frozen; tratteggio su icone raro; la correzione aggiunge rami | scartato |
| 19 | `strokeColor` senza `strokeWidth` (o il contrario) non dà avvisi (Blind) | low | la larghezza grezza senza token dà già un avviso; il controllo incrociato aggiunge rami | scartato |
| 20 | Il livello 4 prova "qualche CSS", non il CSS giusto; numero magico 300 (Blind, VG) | low | lo slittamento dei namespace è fissato da `theme-generator.test.ts`; l'asserzione sulla proprietà CSS aggiunge complessità | scartato |
| 21 | `Lettura` valida poco (`kind` libero, chiavi di variante non uniformi) (Blind) | low | la forma la fissa l'adattatore (2.23), che valida contro lo schema | scartato |
| 22 | Task "scriverli per primi" spuntato; spec `in-review` e sprint `in-progress` (Blind) | low | l'ordine reale è scritto nelle Implementation Notes; lo sprint passa a review alla presentazione | scartato |
| 23 | `sizingV` senza verdi hug/fix; `layoutAlign`/`layoutJustify` con un solo valore al livello 1 (Blind) | low | il livello 4 espande ogni valore; ridondante | scartato |

## Verification

**Commands:**
- `pnpm turbo run check-types lint test --force`: verde (con `pnpm db:start`).
- `pnpm --filter @penpot-ds/scripts theme && git status --porcelain packages/tokens`: nessun file cambiato.
