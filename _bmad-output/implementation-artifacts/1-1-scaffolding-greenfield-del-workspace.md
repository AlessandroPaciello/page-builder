---
baseline_commit: 6d731044cdec9b781e58e105ef76a305438553c3
---

# Story 1.1: Scaffolding greenfield del workspace

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a sviluppatore,
I want inizializzare il workspace con create-better-t-stack e la struttura monorepo,
so that esiste una base full-TypeScript avviabile su cui costruire tutto il resto.

## Acceptance Criteria

1. **Given** un workspace vuoto (solo `docs/` legacy di riferimento) **When** eseguo lo scaffolding con create-better-t-stack (Next.js App Router, Node LTS, Prisma, Better Auth, oRPC) e configuro pnpm + Turborepo **Then** l'app Next parte in dev senza errori e il monorepo espone `apps/web` e la cartella `packages/`.
2. Le versioni sono pinnate come da architecture spine (Next 16.x, React 19, Prisma 7.9+, Tailwind 4) e nessun residuo legacy (JHipster/Strapi) è presente nel codice scaffoldato. `@puckeditor/core` è **fuori scope** di questa story (arriva in Epic 3/4).
3. `packages/ui` è predisposto come **libreria componenti unica** (AD-3/AD-11 riviste, Sprint Change Proposal 2026-07-26): `src/domains/` (destinato al generato) e `src/editor/` (a mano) esistono con export separati `.` e `./editor`; `@base-ui/react` è rimosso; una regola di **lint bloccante** vieta gli import `domains/**` → `editor/**`.

## Tasks / Subtasks

- [x] Task 1: Eseguire lo scaffold con create-better-t-stack (AC: #1, #2)
  - [x] Eseguire, dalla root del repo (che oggi contiene solo `docs/` legacy da NON toccare):
    ```
    npx create-better-t-stack@3.37.0 . \
      --frontend next \
      --backend self \
      --database postgres \
      --orm prisma \
      --api orpc \
      --auth better-auth \
      --addons turborepo \
      --package-manager pnpm \
      --db-setup docker \
      --git \
      --install
    ```
    Se il CLI non accetta `.` come nome progetto in una directory non vuota, scaffoldare in una cartella temporanea e spostare il contenuto nella root, preservando `docs/`, `.git/`, `_bmad*/`, `.claude/`, `.github/`, `.gitignore` esistenti (non sovrascriverli).
  - [x] Verificare che il CLI abbia prodotto un monorepo pnpm+Turborepo con `apps/web` (Next.js App Router) e la cartella `packages/` (anche se inizialmente vuota o con solo i package generati dal template — i package del design system veri e propri arrivano in Epic 2+).
  - [x] Confermare che `--backend self` abbia montato oRPC dentro le API routes di `apps/web` (nessun servizio backend separato, coerente con AD-2 monolite fullstack).
- [x] Task 2: Pinning versioni secondo l'Architecture Spine (AC: #2)
  - [x] Verificare/forzare in `package.json` (root e `apps/web`) le versioni: Next.js `16.x`, React `19`, Prisma `7.9+`, Tailwind CSS `4`, TypeScript `~6.0` (ratificato nello Spine il 2026-09-05, era `~5.7+` allo scaffold iniziale), Node engine `LTS`, pnpm `10`, Turborepo `2`.
  - [x] `@puckeditor/core` (0.22.x) NON va installato in questa story — non è nello scope di Epic 1 (arriva con l'editor in Epic 3/4). Non aggiungere dipendenze fuori scope.
  - [x] Se create-better-t-stack installa versioni diverse da quelle pinnate, allineare manualmente via `pnpm add <pkg>@<versione>` e ri-eseguire `pnpm install`.
- [x] Task 3: Pulizia residui legacy e verifica avvio (AC: #1, #2)
  - [x] Verificare che nessun file/dipendenza scaffoldato faccia riferimento a JHipster o Strapi (questi esistono solo come riferimento storico in `docs/`, che resta intatto e non viene incluso nel nuovo workspace applicativo).
  - [x] Avviare `pnpm dev` (o equivalente Turborepo) dalla root e confermare che `apps/web` risponde senza errori in dev.
  - [x] Eseguire `pnpm build` almeno una volta per confermare che la build di produzione passa senza errori di configurazione.
- [x] Task 4: Igiene repo (AC: #1)
  - [x] Verificare/aggiornare `.gitignore` esistente per coprire gli artefatti tipici del nuovo stack (`.next/`, `node_modules/`, `.turbo/`, file env locali) senza duplicare regole già presenti.
  - [x] Non modificare `.github/`, `.claude/`, `_bmad/`, `_bmad-output/` — sono infrastruttura del progetto BMAD, fuori scope di questa story.
- [x] Task 5: Predisporre `packages/ui` secondo AD-3/AD-11 riviste (AC: #3)
  - [x] Rimuovere `@base-ui/react` da `packages/ui/package.json`. Radix **non** entra ora: arriva con i componenti generati nella Story 2.4.
  - [x] Creare `packages/ui/src/domains/` e `packages/ui/src/editor/`, spostando in `editor/` **le primitive** oggi presenti in `packages/ui/src/components/` (button, input, label, skeleton, sonner, dropdown-menu).
    - Decisione di Alessandro il 2026-09-05, che restringe la formulazione originale del task (che elencava anche header/mode-toggle/user-menu/sign-in-form tra i componenti da spostare in `editor/`): quei quattro restano in `apps/web/src/components/` e cambiano solo il path di import verso `@penpot-ds/ui/editor`. Spostarli avrebbe richiesto di far dipendere `@penpot-ds/ui` da Better Auth (`sign-in-form`/`user-menu` usano `authClient`), e quel chrome viene comunque sostituito in Epic 4 (finding deferred già registrato).
  - [x] Dichiarare i due export nel `package.json` di `ui`: `.` → `src/domains`, `./editor` → `src/editor`; aggiornare gli import di `apps/web` di conseguenza.
  - [x] Aggiungere la regola di lint **bloccante** che vieta gli import da `domains/**` verso `editor/**` (il confine ha perso la barriera di package con la fusione: dev'essere difeso da un check, non da una frase).
  - [x] Verificare `pnpm build` e `pnpm check-types` verdi dopo la ristrutturazione.

### Review Findings

_Code review adversariale del 2026-07-26 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Base diff: `main...HEAD`. Verifiche empiriche eseguite: `pnpm build` ✅ EXIT 0, `pnpm check-types` ✅ EXIT 0 (6/6 package), nessun segreto nei chunk client statici._

**Decision needed**

- [x] [Review][Decision] ✅ **SCIOLTA il 2026-09-05** — la Sprint Change Proposal su AD-11 è stata approvata e applicata (spine, companion, SPEC, epics). Esito: `packages/ui` **è** la libreria componenti unica, quindi non occupa impropriamente lo slot di `@penpot-ds/ui` — nessuna violazione di AD-3. Resta però da rimuovere `@base-ui/react`, che non era la scelta giusta (il comportamento verrà da Radix, dichiarato nelle ricette) e da introdurre la separazione `domains/` ↔ `editor/` con lint: vedi **Task 5**. Testo originale del finding: ⛔ **BLOCCATA — in attesa di revisione architetturale di AD-11.** Il 2026-07-26 è stato messo in discussione se `tokens`/`primitives` debbano davvero essere generati dal catalogo Penpot. L'esito ribalta il verdetto su questo punto: se le primitive tornano scritte a mano, `@base-ui/react` già presente in `packages/ui` diventa una fondazione legittima invece di una violazione. Non risolvere prima che AD-11 sia richiuso (via `bmad-correct-course` o update di `bmad-architecture`). — `packages/ui` occupa lo slot di `@penpot-ds/ui` con uno stack UI generico concorrente — `packages/ui/package.json` dichiara `@base-ui/react`, `@shadcn/react`, `shadcn`, `cva`, `tailwind-merge`, e `apps/web` già consuma `@app/ui/components/*` (header, mode-toggle, user-menu, sign-in-form). Spine#Structural Seed assegna `packages/ui` a `@penpot-ds/ui` e AD-3 vieta una libreria UI generica concorrente. Da decidere prima di Epic 2: tollerare come boilerplate temporaneo con nota esplicita, rinominare, o rimuovere.
- [x] [Review][Decision] ✅ **RISOLTA il 2026-09-05 — Alessandro ratifica TS 6 nello Spine.** TS 6.0.3 è già installato e compila verde su 6/6 package; downgradare una major del compilatore su un workspace verde era il rischio maggiore. Applicato: `ARCHITECTURE-SPINE.md:184` `~5.7+` → `~6.0`, e il pin del catalog stretto da `^6` a `~6.0` per chiudere anche la seconda metà del finding (niente minor del compilatore su lockfile rigenerato). Testo originale: TypeScript pinnato a `^6` (risolve 6.0.3) mentre Spine#Stack dichiara `~5.7+` — `pnpm-workspace.yaml:12`. `~5.7` in semver è `>=5.7 <5.8`: è un salto di major non ratificato. O si aggiorna lo Spine, o si allinea il catalog. Inoltre il caret su una major del compilatore lascia entrare minor upstream su lockfile rigenerato (`better-auth: 1.6.23` è invece pinnato esatto: incoerenza).
- [x] [Review][Decision] ✅ **RISOLTA il 2026-09-05 — Alessandro sceglie l'ibrido.** Lo Spine (riga 170) assegna `@penpot-ds/*` **al solo design system** (`tokens`, `ui`, `puck-components`), non all'infrastruttura app. Applicato: root `"name": "page-builder"`, `packages/ui` → `@penpot-ds/ui` (con path mapping, `components.json`, `index.css` e tutti gli import di `apps/web` aggiornati); `api/auth/config/db/env` restano `@app/*` perché non sono design system. Coperti anche i corollari del finding: `layout.tsx` metadata, `README.md`, ASCII art del template in `page.tsx`, e `docker-compose.yml` (progetto/container/volume/DB → `page-builder`). Testo originale: Naming del workspace fermo ai default del CLI — root `package.json:2` `"name": "app"`, namespace `@app/*`, `apps/web/src/app/layout.tsx` `title/description: "app"`, `packages/db/docker-compose.yml` `name: app` e DB `app`. Spine#Consistency Conventions radica su `page-builder` / `@penpot-ds/*`. Rinominare ora o accettare la deriva e ratificarla.
- [x] [Review][Decision] ✅ **RISOLTA il 2026-09-05** (già chiusa con la Sprint Change Proposal, qui solo spuntata): AC2 è stato riscritto in `epics.md:139` e in questa story per dire che `@puckeditor/core` è **fuori scope** invece di elencarlo tra le versioni pinnate. Verificato: 0 occorrenze nel repo. Testo originale: Contraddizione interna della spec su `@puckeditor/core` — AC2 lo elenca tra le versioni "pinnate", Task 2 e Dev Notes vietano di installarlo in questa story. L'implementazione segue Task 2 (0 occorrenze nel repo, verificato), quindi AC2 non è letteralmente soddisfacibile: va corretto in `epics.md` (Story 1.1 e `[STARTER]`) e qui.

**Patch**

- [x] [Review][Patch] Cache Turborepo cieca alle variabili d'ambiente: task `build` senza `env`/`globalEnv`, quindi `DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`CORS_ORIGIN` non entrano nella chiave di cache [turbo.json:5-9]
- [x] [Review][Patch] `.gitignore` non copre `.env.production` / `.env.development`: ignora solo `.env` e `.env*.local`, un file di segreti di produzione verrebbe committato senza protestare [.gitignore:23-25]
- [x] [Review][Patch] Node engine LTS non pinnato nel repo: nessun campo `engines`, nessun `.nvmrc`/`.node-version` (Task 2 lo richiede esplicitamente; il pin oggi vive solo nella shell dello sviluppatore) [package.json:34]
- [x] [Review][Patch] `OpenAPIReferencePlugin` registrato senza gate d'ambiente: `/api/rpc/api-reference` espone l'intera superficie API anche in produzione [apps/web/src/app/api/rpc/[[...rest]]/route.ts:17-22]
- [x] [Review][Patch] `apps/web/tsconfig.json` non estende `@app/config/tsconfig.base.json`: l'unico adapter inbound gira senza `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` [apps/web/tsconfig.json:2]
- [x] [Review][Patch] `packages/env/src/web.ts` ha `client: {}` e `runtimeEnv: {}` (non valida nulla) mentre README e `.env.example` promettono fail-fast all'avvio [packages/env/src/web.ts:3-8]
- [x] [Review][Patch] Task `lint` dichiarato in turbo.json ma nessuno script `lint` in alcun package e nessuna config linter nel repo: gate di qualità fantasma [turbo.json:10-12]
- [x] [Review][Patch] `sign-in-form.tsx`, `sign-up-form.tsx`, `user-menu.tsx` usano `useRouter`/`useForm`/`useSession` senza `"use client"` proprio: funzionano solo perché gli import attuali sono client [apps/web/src/components/sign-in-form.tsx:1]
- [x] [Review][Patch] `createContext` chiamato prima del match della route e fuori dagli interceptor `onError`: query DB su ogni 404 e su `healthCheck` pubblico, ed eccezioni non loggate [apps/web/src/app/api/rpc/[[...rest]]/route.ts:30-32]
- [x] [Review][Patch] `db:start` e `db:migrate` marcati `persistent: true` ma `docker compose up -d` è detached ed esce subito: `persistent` impedisce di usarli come dipendenza di altri task [turbo.json:26-37]
- [x] [Review][Patch] Nessuna normalizzazione dello slash finale su `CORS_ORIGIN` e `BETTER_AUTH_URL`: `trustedOrigins` rifiuta un origin legittimo, e l'URL SSR diventa `//api/rpc` [packages/auth/src/index.ts:13]
- [x] [Review][Patch] `@orpc/tanstack-query` (`^1.14.6`) e `@tanstack/react-query*` fissati a mano in `apps/web/package.json` mentre `@orpc/{server,client,openapi,zod}` passano da `catalog:`: il catalog perde il suo scopo [apps/web/package.json]
- [x] [Review][Patch] `context.auth: null` è un campo fantasma sempre nullo, mai usato: verrà copiato in ogni futura procedura [packages/api/src/context.ts:9]
- [x] [Review][Patch] `privateData` usa `context.session?.user` pur essendo dietro `protectedProcedure`: il tipo di ritorno include `user: User | undefined`, un caso che il middleware ha già escluso [packages/api/src/routers/index.ts:12]
- [x] [Review][Patch] `skipValidation: !!process.env.SKIP_ENV_VALIDATION` è vero anche per `"false"` e `"0"`: la validazione env si disattiva per errore [packages/env/src/server.ts:14]
- [x] [Review][Patch] `createAuthClient({})` senza `baseURL`: funziona solo same-origin, `BETTER_AUTH_URL` non arriva al client [apps/web/src/lib/auth-client.ts:3]
- [x] [Review][Patch] `--font-sans: "Inter Variable"` mai caricato mentre `layout.tsx` scarica Geist/Geist_Mono: i font caricati non vengono usati, fallback al sans di sistema [packages/ui/src/styles/globals.css:79]
- [x] [Review][Patch] `@types/node` divergente nel monorepo: `^20` in `apps/web`, `^22.13.14` in root e `packages/env` [apps/web/package.json]
- [x] [Review][Patch] Dipendenze di build in `dependencies` invece di `devDependencies`: `babel-plugin-react-compiler`, `@swc/helpers` in `apps/web`, CLI `shadcn` in `packages/ui` [apps/web/package.json]
- [x] [Review][Patch] Metadata e README fermi al template generato: `title/description: "app"`, `README.md` "# app", ASCII art "BETTER T STACK" in `page.tsx` — nulla dice che il progetto è page-builder [apps/web/src/app/layout.tsx]
- [x] [Review][Patch] `prisma.config.ts` usa `dotenv.config({ path: "../../apps/web/.env" })` relativo alla cwd e cabla la posizione di `apps/web` dentro il layer DB [packages/db/prisma.config.ts]

**Deferred**

- [x] [Review][Defer] Nessun test, nessun task `test` in turbo.json, nessun workflow CI in `.github/` — deferred, fuori scope: Testing Requirements della story esclude esplicitamente test applicativi (arrivano in Story 1.2)
- [x] [Review][Defer] Nessuna protezione CSRF esplicita sulle rotte RPC (`GET/POST/PUT/PATCH/DELETE` + `credentials: "include"`, nessun check `Origin`/`Referer`) [apps/web/src/app/api/rpc/[[...rest]]/route.ts:49-53] — deferred, nessuna mutation esiste ancora; da affrontare in Story 1.5
- [x] [Review][Defer] Registrazione aperta senza `requireEmailVerification`, senza `minPasswordLength` server-side, senza `rateLimit` esplicito; policy password solo in Zod lato form [packages/auth/src/index.ts:14-16] — deferred, Story 1.4
- [x] [Review][Defer] Form auth senza `aria-invalid`/`aria-describedby` e senza live region per gli errori [apps/web/src/components/sign-in-form.tsx] — deferred, a11y-baseline in Epic 2
- [x] [Review][Defer] Stati `isLoading`/`isError` non gestiti: `dashboard.tsx` mostra "API: " vuoto, `page.tsx` mostra il pallino rosso già durante il caricamento [apps/web/src/app/dashboard/dashboard.tsx:7-11] — deferred, codice demo del template sostituito in Epic 4
- [x] [Review][Defer] Il percorso SSR di `orpc.ts` (queryClient per-richiesta, forwarding header, fetch loopback senza timeout, nessun `MutationCache`) è oggi codice morto: nessun `HydrationBoundary`/prefetch server-side esiste [apps/web/src/utils/orpc.ts:32-77] — deferred, si attiva in Epic 4/6
- [x] [Review][Defer] `output: "standalone"` assente in `next.config.ts`, richiesto da Spine#Envelope operativo [apps/web/next.config.ts] — deferred, Story 1.6 (Docker e migration in release)
- [x] [Review][Defer] `composite`/`declaration`/`outDir` dichiarati ma inerti nei tsconfig dei package (`tsc --noEmit`, nessun `references`) [packages/api/tsconfig.json] — deferred, cargo-cult del template
- [x] [Review][Defer] `check-types` e `build` non dipendono da `db:generate` in turbo.json [turbo.json:13-15] — deferred, innocuo oggi perché il client Prisma è committato
- [x] [Review][Defer] `docker-compose.yml`: porta host 5432 hardcoded (collide con un postgres locale) e `image: postgres:18` non pinnata a patch [packages/db/docker-compose.yml] — deferred, ambiente di sviluppo locale

_Code review adversariale del 2026-09-05 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Base diff: delta non committato (`git diff HEAD` + file nuovi), Task 5 e le 21 patch della review precedente. 0 decision-needed, 10 patch, 4 defer, 3 finding smontati come falsi positivi/non azionabili._

**Patch**

- [x] [Review][Patch] Il check di confine `domains/` ↛ `editor/` è aggirabile: scansiona riga per riga, quindi non vede un import multi-riga (la forma prodotta da un formatter, già presente nel repo in `user-menu.tsx`), non copre `.mts`/`.cts`, e un `"../editor"` scritto con doppio punto extra (`"@penpot-ds/ui/lib/../editor"`) lo elude. Non scansiona `src/lib/`/`src/hooks/`, quindi una violazione indiretta (domains → lib → editor) passa. Verificato empiricamente: EXIT 0 su tutti e tre i casi. [packages/ui/scripts/check-boundaries.mjs:59]
- [x] [Review][Patch] `apps/web/tsconfig.json` mappa `@penpot-ds/ui/*` sull'intero `packages/ui/src/*`, bypassando la `exports` map che dovrebbe essere la metà meccanica del confine AC3: TypeScript risolverebbe silenziosamente un deep import verso `domains/` o `editor/` che il pacchetto non pubblica. Verificato: rimuovendo la voce, `check-types` e `build` restano verdi (nessun consumer ne aveva bisogno). [apps/web/tsconfig.json:19]
- [x] [Review][Patch] `pnpm lint` non è collegato a nulla: nessun workflow in `.github/`, e `build`/`check-types` non dipendono da `lint` in `turbo.json`. Oggi gira solo se uno sviluppatore lo lancia a mano — il gate "bloccante" richiesto da AD-3 è opt-in. La CI resta fuori scope (deferred già accettato il 2026-07-26), ma agganciare `lint` a `build` è economico e rende reale il gate locale. [turbo.json]
- [x] [Review][Patch] `data-slot` viene sovrascritto quando `DropdownMenuTrigger` renderizza via `render={<Button/>}`: `Button` imposta `data-slot="button"` prima di `{...props}`, quindi il `data-slot="dropdown-menu-trigger"` iniettato da `triggerProps` vince. Nessun selettore dipende oggi da `[data-slot=button]` quindi zero impatto visibile, ma rompe silenziosamente la convenzione di styling del pacchetto su entrambi i call site esistenti (mode-toggle, user-menu). [packages/ui/src/editor/button.tsx:53,55]
- [x] [Review][Patch] Il gate della reference OpenAPI legge `env.NODE_ENV` dallo schema Zod, che di default vale `"development"` se la variabile non è impostata: un deploy standalone futuro (Story 1.6) che dimentica `NODE_ENV` esporrebbe la reference in produzione — esattamente lo scenario che la patch doveva chiudere. Non riproducibile oggi (`next dev`/`next start` impostano `NODE_ENV` da soli, verificato), ma la correzione è a costo zero. [apps/web/src/app/api/rpc/[[...rest]]/route.ts:16]
- [x] [Review][Patch] Il match del prefisso `/api/rpc/api-reference` è per `startsWith`, non per confine di path: una futura procedura chiamata ad es. `api-reference-export` verrebbe instradata (e in produzione 404ata) come se fosse la reference. Nessuna procedura del genere esiste oggi in `appRouter`, ma il confine va comunque rispettato. [apps/web/src/app/api/rpc/[[...rest]]/route.ts:42-43]
- [x] [Review][Patch] Rimuovendo `persistent: true` da `db:migrate` insieme a `db:start` sono stati confusi due problemi diversi: `db:start` (`docker compose up -d`, detached) era davvero da correggere; `db:migrate` esegue `prisma migrate dev`, che può chiedere il nome della migration via stdin — il meccanismo turbo corretto per questo è `"interactive": true`, non `persistent`. [turbo.json]
- [x] [Review][Patch] La patch su `createContext` chiude solo metà del finding originale ("query DB su ogni 404 **e su `healthCheck` pubblico**"): il 404 non tocca più il DB (verificato), ma `healthCheck` — l'endpoint di liveness pubblico — esegue ancora una query di sessione a ogni chiamata, perché `createContext` gira prima che oRPC sappia quale procedura verrà invocata. Serve un contesto lazy, che è esattamente lo scope di Story 1.5 ("Context oRPC con principal e policy deny-by-default"): rimandare lì. La nota di completamento della story sovrastima la chiusura di questo punto. [apps/web/src/app/api/rpc/[[...rest]]/route.ts, packages/api/src/context.ts]
- [x] [Review][Patch] Bookkeeping non allineato dopo la ratifica di TS 6: Task 2 di questa story dice ancora "TypeScript `~5.7+`" [riga 45]; la Completion Note "TS 6.0.x (soddisfa `~5.7+`)" [riga 160] è un'affermazione semver falsa (`~5.7` = `>=5.7 <5.8`, 6.0.x non lo soddisfa) — proprio ciò che la decisione doveva correggere; e `ARCHITECTURE-SPINE.md:184` ora scrive `~6.0+`, che non è sintassi semver valida (operatore `~` e `+` concatenati). `sprint-status.yaml` è stato modificato dal diff ma non compare nel File List.
- [x] [Review][Patch] Il sotto-task di Task 5 "spostando i componenti... appartengono a `editor/`" resta spuntato `[x]` col testo originale intatto, mentre la nota sotto dice l'opposto (header/mode-toggle/user-menu/sign-in-form NON si sono spostati). Il testo del sotto-task andrebbe riscritto per riflettere la decisione presa, non solo annotato.

**Deferred**

- [x] [Review][Defer] Il menu a tendina scritto a mano ha lacune di robustezza reali ma non raggiungibili dai due call site attuali: due menu aperti insieme condividono lo stesso Escape/focus globale, nessun portal/collision detection (un antenato con `overflow:hidden` lo taglia), `ArrowUp` con `activeElement` fuori dagli item salta al penultimo invece che all'ultimo, `{...props}` spreadato dopo `ref`/`onKeyDown` su `DropdownMenuContent` permette a un consumer di sovrascriverli silenziosamente, ARIA incompleta (niente `aria-controls`/`id`/`aria-labelledby`), `Tab` senza `preventDefault()`. Tradeoff esplicito e discusso della decisione "potatura + menu a mano": da rivedere quando `domains/` inizia a generare il primitivo reale (Story 2.4) o prima se questo menu deve reggere più a lungo. [packages/ui/src/editor/dropdown-menu.tsx]
- [x] [Review][Defer] Gli alias in `components.json` puntano al barrel `editor` (file), non a una directory: il CLI shadcn scriverebbe comunque nel posto giusto (fa la sua stessa risoluzione di path, non passa da Node), ma un componente aggiunto così resterebbe invisibile finché qualcuno non aggiorna a mano il barrel `editor/index.ts`. Non esercitato da questo diff — nessuno lancia il CLI in questa story. [packages/ui/components.json, apps/web/components.json]
- [x] [Review][Defer] La normalizzazione degli URL d'ambiente (`BETTER_AUTH_URL`, `CORS_ORIGIN`, `NEXT_PUBLIC_SERVER_URL`) copre solo lo slash finale, non case-folding, query string o allow-list di protocollo. Accettabile: sono valori di configurazione impostati da chi fa il deploy, non input di un utente esterno. Da rivedere solo se questa premessa cambia. [packages/env/src/server.ts, packages/env/src/web.ts]
- [x] [Review][Defer] `prisma.config.ts` non produce un errore più chiaro se `apps/web/.env` manca: l'helper `env()` di Prisma già lancia un errore leggibile in quel caso; da rivedere solo se si rivelasse insufficiente in pratica. [packages/db/prisma.config.ts]

**Finding smontati (falsi positivi / non azionabili)**

- Gestione dei valori non riconosciuti di `SKIP_ENV_VALIDATION`: il comportamento attuale (valore non riconosciuto ⇒ la validazione resta ATTIVA) è il default sicuro voluto, non un bug.
- Presunto crash lato client su `process.env` dentro `skip-validation.ts`: smontato leggendo il bundle client compilato — Next.js include un polyfill di `process`, quindi la lettura restituisce `undefined` in sicurezza, non un `ReferenceError`.
- `NEXT_PUBLIC_SERVER_URL` obbligatorio senza default che fa fallire una build che non lo imposta: è il comportamento fail-fast che la patch originale chiedeva esplicitamente, non un difetto.

## Dev Notes

- Questa è la **story fondativa (Epic 1, Story 1)**: non esiste ancora codice applicativo. Il workspace oggi contiene solo `docs/` (riferimento legacy Strapi/JHipster, da NON copiare né reintrodurre) più l'infrastruttura BMAD (`_bmad/`, `_bmad-output/`, `.claude/`, `.github/`). Nessuna story precedente da cui ereditare pattern.
- **Paradigma target (non ancora costruito in questa story, ma la struttura deve prepararlo):** core di dominio esagonale in `packages/domain`, layering `tokens → primitives → {puck-components, ui}`, `apps/web` come unico adapter inbound. Questa story crea solo lo scheletro monorepo (`apps/web` + `packages/`); il contenuto di `packages/domain` arriva in Story 1.2. Non anticipare la creazione di package applicativi non richiesti da questa story.
- **Non introdurre `@puckeditor/core`, Puck, o qualsiasi dipendenza dell'editor in questa story** — fuori scope, arriva in Epic 3/4. Evitare di installare pacchetti "per sicurezza" non richiesti dagli AC.
- Il comando CLI esatto e i flag sono verificati da fonti aggiornate luglio 2026 (vedi References). Se il CLI stampa un configuratore interattivo invece di rispettare i flag non-interattivi, usare `--yes` insieme ai flag espliciti, oppure rispondere al prompt selezionando le stesse opzioni.

### Project Structure Notes

- Struttura attesa dopo lo scaffold (da Architecture Spine, Structural Seed):
  ```
  page-builder/
    apps/
      web/                     # Next.js App Router — editor + render pubblico
    packages/
                                 # popolato nelle story successive (domain, tokens, primitives, puck-components, ui, commerce-provider, scripts, storybook)
  ```
- `packages/` può risultare vuota o con solo package boilerplate del template subito dopo lo scaffold: è atteso, i package del dominio/design-system sono costruiti nelle story successive (1.2 per `packages/domain`, Epic 2 per il design system).
- Nessuna variazione nota rispetto alla struttura unificata; se create-better-t-stack genera nomi di cartella diversi da `apps/web`, rinominare per allinearsi allo spine prima di procedere.

### Testing Requirements

- Nessun framework di test applicativo è richiesto da questa story (il primo caso d'uso testato arriva in Story 1.2, `packages/domain`). La verifica di questa story è operativa: `pnpm dev` e `pnpm build` devono completare senza errori — questo è il criterio di accettazione, non un test automatizzato da scrivere.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Scaffolding greenfield del workspace] — user story e acceptance criteria originali.
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — `[STARTER] Scaffolding greenfield`: versioni pinnate (create-better-t-stack 3.37.0, Next 16.x, React 19, PostgreSQL 18, Prisma 7.9+, Better Auth, oRPC, @puckeditor/core 0.22.x, Tailwind 4, Node LTS, pnpm 10, Turborepo 2).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Stack] — tabella versioni definitiva.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Structural Seed] — albero cartelle target (`apps/web`, `packages/*`).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-2] — topologia monolite fullstack, core estraibile in `packages/domain` (non ancora creato in questa story).
- Web research (luglio 2026): flag CLI `create-better-t-stack` verificati su npm/GitHub — `--frontend next --backend self --database postgres --orm prisma --api orpc --auth better-auth --addons turborepo --package-manager pnpm --db-setup docker`. Fonti: [npm](https://www.npmjs.com/package/create-better-t-stack), [GitHub AmanVarshney01/create-better-t-stack](https://github.com/AmanVarshney01/create-better-t-stack), [Quickstart](https://mintlify.wiki/amanvarshney01/create-better-t-stack/quickstart).

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx create-better-t-stack@3.37.0` in una cartella temporanea richiedeva flag aggiuntivi non presenti nel comando originale della story (`--payments none`, `--examples none`, `--web-deploy none`, `--server-deploy none`) perché il CLI installato (v3.37.0 corrente) presenta prompt aggiuntivi rispetto a quanto documentato nelle References; `--yes` non è combinabile con i flag di stack espliciti (il CLI la rifiuta con errore).
- Ambiente: `npm`/`npx`/`pnpm` non erano nel PATH della shell non interattiva perché gestiti da `nvm` — necessario `source ~/.nvm/nvm.sh && nvm use 22.23.1` e `corepack prepare pnpm@10 --activate` prima di ogni comando.
- `pnpm install` dalla root ha richiesto `CI=true` per evitare il prompt interattivo di conferma rimozione `node_modules` (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`).

### Completion Notes List

- Scaffold eseguito con `create-better-t-stack@3.37.0` in cartella temporanea (frontend next, backend self, database postgres, orm prisma, api orpc, auth better-auth, addon turborepo, package manager pnpm, db-setup docker), poi spostato nella root del repo preservando `docs/`, `.git/`, `_bmad/`, `_bmad-output/`, `.claude/`, `.github/`, `.agents/`, `.opencode/` e il `.gitignore` esistente (unito, non sovrascritto).
- Monorepo pnpm+Turborepo risultante: `apps/web` (Next.js App Router) + `packages/{api,auth,config,db,env,ui}`. oRPC montato dentro `apps/web/src/app/api/rpc/[[...rest]]/route.ts` — nessun servizio backend separato (`--backend self`), coerente con AD-2.
- Versioni verificate/allineate rispetto all'Architecture Spine: Next.js 16.2.x, React 19.2.x, Tailwind CSS 4.3.x, TypeScript 6.0.x (non soddisfaceva il pin `~5.7+` dello scaffold iniziale — semver: `~5.7` è `>=5.7 <5.8`; ratificato a `~6.0` nello Spine il 2026-09-05, vedi decisione sotto), pnpm 10.33.0, Turborepo 2.10.x, Node LTS (v22.23.1, gestito via nvm). Prisma era pinnato a `^7.8.0` dal CLI: allineato manualmente a `^7.9.0` (ultima stabile disponibile su npm che soddisfa `7.9+`) in `pnpm-workspace.yaml` (catalog) e `packages/db/package.json` (`prisma`, `@prisma/adapter-pg`), poi rigenerato con `pnpm install`.
- `@puckeditor/core` non installato (fuori scope, confermato).
- Nessun riferimento a JHipster/Strapi nel codice scaffoldato (verificato con grep ricorsivo); `docs/` legacy lasciato intatto e non incluso nel nuovo workspace applicativo.
- `pnpm dev` (Turborepo → `next dev --port 3001`) avviato con successo: Next.js 16.2.12 risponde HTTP 200 su `http://localhost:3001`.
- `pnpm build` (Turborepo → `next build`) completato con successo: build di produzione compilata, TypeScript check passato, pagine statiche/dinamiche generate senza errori.
- `.gitignore` esistente aggiornato per unione (non sovrascrittura) con le regole tipiche dello stack (`node_modules`, `.next`, `.turbo`, `dist`/`build`, file `.env*`, cache/log vari), senza duplicare la regola `.DS_Store` già presente.
- `.github/`, `.claude/`, `_bmad/`, `_bmad-output/`, `.agents/`, `.opencode/` non modificati.

### File List

- `package.json` (nuovo — root workspace)
- `pnpm-workspace.yaml` (nuovo)
- `pnpm-lock.yaml` (nuovo)
- `turbo.json` (nuovo)
- `tsconfig.json` (nuovo — root)
- `bts.jsonc` (nuovo — config create-better-t-stack)
- `README.md` (nuovo — generato dallo scaffold)
- `.gitignore` (modificato — unione regole stack)
- `apps/web/**` (nuovo — Next.js App Router, incl. route oRPC `src/app/api/rpc/[[...rest]]/route.ts` e Better Auth `src/app/api/auth/[...all]/route.ts`)
- `packages/api/**` (nuovo — package oRPC generato dal template)
- `packages/auth/**` (nuovo — package Better Auth generato dal template)
- `packages/config/**` (nuovo — tsconfig/config condivisi generato dal template)
- `packages/db/**` (nuovo — Prisma schema/client, versione Prisma allineata a `^7.9.0`)
- `packages/env/**` (nuovo — validazione env condivisa)
- `packages/ui/**` (nuovo — package UI boilerplate del template)

**2026-09-05 — Task 5 (AC3) + chiusura dei Review Findings**

- **`@base-ui/react` rimosso davvero, non solo dal manifest.** Non era una riga morta: 8 componenti boilerplate lo importavano. Su decisione di Alessandro sono stati potati gli 11 componenti chat-UI del template mai consumati da `apps/web` (attachment, bubble, card, checkbox, empty, input-group, marker, message, message-scroller, textarea, tooltip — ~1000 righe), ed è uscito anche `@shadcn/react`. Le 6 primitive effettivamente usate sono state riscritte senza headless: `button` e `input` su elemento nativo, `dropdown-menu` scritto a mano (~250 righe: apertura/chiusura, Escape con ritorno del focus al trigger, click esterno, frecce/Home/End, chiusura su Tab). La convenzione `render` del trigger è stata conservata, così i call site in `mode-toggle` e `user-menu` non sono cambiati. Radix **non** è entrato: arriva in Story 2.4 dentro `domains/`.
- **`domains/` + `editor/` con export separati.** `.` → `src/domains/index.ts` (barrel vuoto, ci scriverà il generatore), `./editor` → `src/editor/index.ts`. Gli import di `apps/web` passano dal barrel `@penpot-ds/ui/editor`.
- **Il confine è difeso da un check bloccante**, non da una frase: `packages/ui/scripts/check-boundaries.mjs`, zero dipendenze (nel repo non c'è ancora un linter e lo Spine non ne ratifica uno), wired su `pnpm lint` → `turbo run lint`. Verificato in rosso prima che in verde: fallisce con EXIT 1 sia sull'import via package name (`@penpot-ds/ui/editor`) sia su quello relativo (`../editor/button`), e passa sul repo pulito.
- **21 patch della review applicate**, incluse: `env`/`globalEnv` in `turbo.json`; `.gitignore` esteso a `.env.*` con eccezione per gli esempi (verificato con `git check-ignore`); `engines` + `.nvmrc`; gate d'ambiente sulla reference OpenAPI; `apps/web/tsconfig.json` che ora estende `@app/config/tsconfig.base.json` (i flag stretti hanno subito pescato un import inutilizzato in `mode-toggle`); `packages/env/src/web.ts` che valida davvero qualcosa (`NEXT_PUBLIC_SERVER_URL`, che è anche il `baseURL` mancante di `createAuthClient`); `skipEnvValidation` che non si accende più su `"false"`/`"0"`; normalizzazione dello slash finale centralizzata in `packages/env/src/server.ts` invece che a ogni call site; `createContext` spostato dopo il match della rotta e dentro un try/catch (gli interceptor `onError` coprono solo l'esecuzione delle procedure) — **solo a metà**: chiude il caso del 404 (verificato: zero query su una rotta inesistente), ma non il caso `healthCheck`, che resta dietro `createContext` perché oRPC risolve il contesto prima di sapere quale procedura verrà invocata; risolverlo davvero richiede un contesto lazy, fuori scope qui e rimandato a Story 1.5; `--font-sans` che ora punta al font effettivamente caricato.
- **Verifiche empiriche** (Node 22.23.1, pnpm 10.33.0): `pnpm check-types` EXIT 0 su 6/6 package · `pnpm build` EXIT 0 · `pnpm lint` EXIT 0 · dev server `/` `/login` `/api/rpc/api-reference` → 200 · **server di produzione: `/api/rpc/api-reference` → 404**, che è la prova che il gate funziona · markup SSR del dropdown corretto (`data-slot="dropdown-menu"` + trigger con `aria-haspopup="menu"`, contenuto assente finché chiuso).
- **⚠️ Azione manuale richiesta sull'ambiente locale.** Il rename del progetto ha toccato `packages/db/docker-compose.yml`: progetto, container, volume e `POSTGRES_DB` passano da `app` a `page-builder`/`page_builder`. Il `.env` locale è già stato allineato (aggiunto `NEXT_PUBLIC_SERVER_URL`, `DATABASE_URL` ripuntato su `page_builder`), ma il container va ricreato: `pnpm db:down && pnpm db:start && pnpm db:push`. Non ci sono migration nel repo e i dati erano solo account di prova dello scaffold.
**2026-09-05 — Code review post-Task 5: 10 patch applicate**

- Riscritto `check-boundaries.mjs`: non più riga-per-riga con keyword sulla stessa riga (evaso da qualunque import multi-riga, incluso quello già presente in `user-menu.tsx`), ma scansione del contenuto intero con commenti rimossi. Aggiunte `.mts`/`.cts`, path traversal (`lib/../editor`), e la scansione ora copre anche `src/lib/` e `src/hooks/` (raggiungibili da `domains/` quanto `editor/` stesso). Verificato con una batteria di 6 tentativi di elusione (multi-riga, `.mts`, traversal assoluto e relativo, `import()` dinamico, re-export indiretto via `lib/`): tutti bloccati con EXIT 1; il caso di un commento che nomina "editor" resta EXIT 0.
- `apps/web/tsconfig.json`: rimossa la mappatura `@penpot-ds/ui/*` che bypassava la `exports` map del pacchetto (permetteva a TypeScript di risolvere silenziosamente deep import verso `domains/`/`editor/` mai pubblicati). Verificato che `check-types` e `build` restano verdi senza.
- `turbo.json`: `build` ora dipende da `lint` (il gate di confine non è più opt-in); `db:migrate` marcato `interactive: true` (necessario per il prompt stdin di `prisma migrate dev`, perso insieme a `persistent` quando è stato tolto da `db:start`).
- `button.tsx`: `data-slot="button"` spostato dopo `{...props}` così vince sempre, anche quando il componente è renderizzato via `render={<Button/>}` da `DropdownMenuTrigger` (che inietta il proprio `data-slot`). Verificato sul markup di produzione: `data-slot="button"` ora presente, non più sovrascritto.
- `route.ts`: `exposeApiReference` legge `process.env.NODE_ENV` direttamente invece che tramite lo schema Zod (che defaulta a `"development"` se non impostato) — fail-closed invece di fail-open su un futuro deploy che dimentica la variabile. Il match dei prefissi `/api/rpc` e `/api/rpc/api-reference` ora richiede un confine di path (`===` o seguito da `/`), non solo `startsWith`. Verificato in produzione: `/api/rpc/api-reference` → 404, `/api/rpc/api-reference-export` → 404 (nessuna procedura di quel nome esiste, comportamento corretto).
- Corrette 3 voci di bookkeeping: Task 2 e la Completion Note citavano ancora `~5.7+` dopo la ratifica a `~6.0`; lo Spine scriveva `~6.0+`, non sintassi semver valida (corretto a `~6.0`); `sprint-status.yaml` aggiunto al File List; il sotto-task di Task 5 riscritto per riflettere la decisione presa (solo le primitive si spostano in `editor/`, non header/mode-toggle/user-menu/sign-in-form) invece di restare col testo originale sotto una nota che lo contraddiceva; la nota sulla patch di `createContext` corretta per dire che chiude solo il caso 404, non `healthCheck` (rimandato a Story 1.5).
- **4 finding non toccati, deliberatamente deferred**: robustezza del menu a tendina scritto a mano (multi-menu, portal/collision detection, focus trap) — tradeoff esplicito della decisione "potatura a mano", da rivedere in Story 2.4; alias shadcn puntati al barrel `editor/index.ts` — non esercitato, nessuno lancia il CLI in questa story; normalizzazione URL minima (solo slash finale) — i valori sono config di chi fa il deploy, non input esterno; messaggio d'errore custom in `prisma.config.ts` — l'helper `env()` di Prisma già lancia un errore leggibile.
- **Verifiche finali**: `pnpm check-types` EXIT 0 su 6/6 · `pnpm lint` EXIT 0 (batteria di elusione inclusa) · `pnpm build` EXIT 0, ora con `lint` come dipendenza · server di produzione pulito (killato un `next-server` rimasto da un test precedente che stava mascherando il fix del `data-slot`): `/api/rpc/api-reference` → 404, markup con `data-slot="button"` corretto.

- **Non fatto, deliberatamente:** nessun linter generale (ESLint/Biome) introdotto. Il finding sul task `lint` fantasma è chiuso perché ora `lint` esegue un check reale e bloccante, ma scegliere un linter per tutto il monorepo è una decisione di stack che lo Spine non ratifica e che non appartiene a questa story.

**Aggiornamento 2026-09-05 (Task 5 + review findings):**

- `packages/ui/package.json` (modificato — `@penpot-ds/ui`, export `.`/`./editor`, via `@base-ui/react` e `@shadcn/react`, CLI `shadcn` in devDependencies, script `lint`)
- `packages/ui/tsconfig.json`, `packages/ui/components.json` (modificati — path/alias `@penpot-ds/ui`)
- `packages/ui/src/domains/index.ts` (nuovo — barrel dell'export `.`)
- `packages/ui/src/editor/index.ts` (nuovo — barrel dell'export `./editor`)
- `packages/ui/src/editor/{button,input,label,skeleton,sonner}.tsx` (spostati da `src/components/`, riscritti senza `@base-ui/react`)
- `packages/ui/src/editor/dropdown-menu.tsx` (spostato e riscritto da zero senza primitive headless)
- `packages/ui/src/components/{attachment,bubble,card,checkbox,empty,input-group,marker,message,message-scroller,textarea,tooltip}.tsx` (**eliminati** — boilerplate del template mai consumato)
- `packages/ui/scripts/check-boundaries.mjs` (nuovo — gate bloccante `domains/` ↛ `editor/`)
- `packages/ui/src/styles/globals.css` (modificato — `--font-sans`/`--font-mono` sui font caricati)
- `packages/env/src/skip-validation.ts` (nuovo)
- `packages/env/src/server.ts`, `packages/env/src/web.ts`, `packages/env/package.json` (modificati)
- `packages/api/src/context.ts`, `packages/api/src/routers/index.ts` (modificati)
- `packages/db/docker-compose.yml`, `packages/db/prisma.config.ts` (modificati)
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/components.json` (modificati)
- `apps/web/src/index.css`, `apps/web/src/lib/auth-client.ts` (modificati)
- `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx` (modificati — metadata e home senza ASCII art del template)
- `apps/web/src/app/api/rpc/[[...rest]]/route.ts` (modificato — gate OpenAPI, match rotta prima del contesto, try/catch)
- `apps/web/src/components/{mode-toggle,providers,sign-in-form,sign-up-form,user-menu}.tsx` (modificati — import dal barrel, `"use client"` mancanti)
- `apps/web/.env.example` (modificato — `NEXT_PUBLIC_SERVER_URL`, nome DB)
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `.gitignore`, `README.md` (modificati)
- `.nvmrc` (nuovo)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modificato — status `review`)
- `_bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md` (modificato — riga 184, TypeScript `~5.7+` → `~6.0`)

## Change Log

- 2026-09-05 — Code review adversariale post-Task 5 (Blind Hunter + Edge Case Hunter + Acceptance Auditor): 0 decision-needed, 10 patch, 4 defer, 3 finding smontati come falsi positivi. Il più rilevante: il gate bloccante `domains/` ↛ `editor/` era aggirabile da un import multi-riga (la forma di default di un formatter, già presente nel repo). Tutte e 10 le patch applicate — riscritto `check-boundaries.mjs`, rimossa la mappatura tsconfig che bypassava la `exports` map, `lint` collegato a `build`, `data-slot` non più sovrascrivibile su `Button`, gate OpenAPI fail-closed, confine di path sui prefissi RPC, `interactive` su `db:migrate`, bookkeeping TS/Spine allineato — tutte verificate empiricamente. Story confermata pronta per review.

- 2026-09-05 — Task 5 completato (AC3): `@penpot-ds/ui` con `domains/` + `editor/`, export separati, `@base-ui/react` e `@shadcn/react` rimossi, `dropdown-menu` riscritto senza primitive headless, check di confine bloccante su `pnpm lint`. Sciolti i 3 decision-needed residui della code review (TS 6 ratificato nello Spine, naming ibrido `page-builder`/`@penpot-ds/ui`, contraddizione su `@puckeditor/core`) e applicate tutte e 21 le patch. `check-types`, `build` e `lint` verdi; gate della reference OpenAPI verificato in produzione. Story pronta per review.

- 2026-09-05 — Applicata la Sprint Change Proposal su AD-11 (approvata da Alessandro): AC2 corretto sul falso pin di `@puckeditor/core`, nuovo AC3 e Task 5 per `packages/ui` (`domains/` + `editor/`, rimozione `@base-ui/react`, lint di confine); sciolto il decision-needed della code review che era bloccato da AD-11.

- 2026-07-26: Scaffold greenfield completato con create-better-t-stack@3.37.0; monorepo pnpm+Turborepo con `apps/web` e `packages/*`; Prisma allineato da `^7.8.0` a `^7.9.0` per rispettare il pin `7.9+`; `.gitignore` aggiornato per unione; `pnpm dev` e `pnpm build` verificati con successo. Tutti i task completati, story pronta per review.
