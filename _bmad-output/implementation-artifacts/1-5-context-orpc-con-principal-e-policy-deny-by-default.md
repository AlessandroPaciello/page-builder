---
baseline_commit: 7fbf74199ed459ef66caec0b9101e1c289cd8a98
---

# Story 1.5: Context oRPC con Principal e policy deny-by-default

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a sviluppatore,
I want che ogni procedura oRPC riceva un Principal (userId+ruolo) e passi dal core per l'autorizzazione,
So that l'RBAC sia enforced in un solo punto su ogni via di accesso (AD-4).

## Acceptance Criteria

1. **Given** una sessione autenticata **When** invoco una procedura oRPC di prova che delega a un caso d'uso del core **Then** il Principal è presente nel context e il core applica deny-by-default (autorizza solo se il ruolo lo consente).
2. Una procedura che tenta di accedere al dominio senza passare dal core è impedita da una convenzione/lint verificabile.

## Tasks / Subtasks

- [x] Task 1: `Principal` come contratto canonico del core (AC: #1)
  - [x] Nuovo modulo `packages/domain/src/principal.ts`: `Role = "ADMIN" | "EDITOR" | "CLIENTE"`, tuple `ROLES` e `Principal { userId: string; role: Role }`. Zero dipendenze runtime (no zod, no React/HTTP — il confine esistente di `packages/domain` lo impone già): la validazione dell'insieme valido è una guardia TS piana (`isRole`), il parsing robusto del valore grezzo resta nell'adapter auth.
  - [x] Rationale: `Principal` è un contratto condiviso core-attraversante (Consistency Conventions dello Spine) e l'autorizzazione fine è **dato di dominio** deciso dal core (AD-4): il tipo deve quindi vivere in `packages/domain`, non in `packages/auth` né in `packages/api`.
  - [x] In `packages/auth/src/roles.ts` il tassonomia diventa un **re-export** da `@app/domain` (`ROLES`, `Role`): la definizione canonica è una sola; `parseRole`/`safeParseRole` (zod, costruito sulla tuple di domain) restano in auth perché normalizzano il valore DB grezzo. Aggiungere `@app/domain` alle dipendenze di `@app/auth` (direzione adapter→core, lecita; il boundary check di domain vieta il contrario). Gli export esistenti di `@app/auth` restano invariati (nessun breaking per `apps/web` e `packages/api`).
- [x] Task 2: Policy deny-by-default nel core + errori di dominio tipizzati (AC: #1)
  - [x] Nuovo modulo `packages/domain/src/authz.ts` (o simile): una funzione di policy minima deny-by-default, es. `assertRole(principal, allowed: Role[])` che lancia un errore di dominio tipizzato se `principal` è assente o il ruolo non è tra quelli consentiti. Deny-by-default significa: **qualsiasi** combinazione non prevista esplicitamente (principal null, ruolo fuori tassonomia, lista permessi vuota) è un deny.
  - [x] Prima_minimum di AD-13: un set tipizzato di errori di dominio (es. `UnauthorizedError` / `ForbiddenError` come classi, o discriminated union) esportato dal core — niente stringhe libere. È il seme del mapping fisso verso oRPC del Task 4.
  - [x] Estendere il caso d'uso di prova `CreateNoteUseCase` (packages/domain/src/use-cases/create-note.ts): accetta `Principal` invece dello `actor: string` e applica la policy (es. creare = solo ADMIN/EDITOR, coerente con la matrice RBAC di rbac-matrix.md). Aggiornare il test esistente `create-note.test.ts` di conseguenza. Non rinominare né spostare il file: è il fixture di prova della Story 1.2.
- [x] Task 3: Principal nel context oRPC (AC: #1)
  - [x] `packages/api/src/context.ts`: `createContext` costruisce `principal: Principal | null` dalla sessione — `userId` da `session.user.id`, `role` da `safeParseRole(session.user.role)` (import da `@app/auth`, già dipendenza). `role` mancante o fuori tassonomia → `principal: null` → trattato come non autenticato (deny-by-default anche sulla forma del dato, chiude l'angolo "sessione valida ma ruolo corrotto" rimandato dalla review di 1.4 per le vie RPC). Il context continua a esporre anche `session` (il guard `/dashboard` la usa).
  - [x] `packages/api/src/index.ts`: il middleware `requireAuth` diventa (o viene affiancato da) `requirePrincipal`: se `context.principal` è `null` → `ORPCError("UNAUTHORIZED")`; altrimenti inietta `principal` non-null nel context via `next({ context: { principal } })` (pattern ufficiale oRPC: guard + inject nel middleware). `protectedProcedure` resta l'entry point esportato così le procedure esistenti non cambiano firma — il suo contratto si irrobustisce da "sessione presente" a "Principal presente".
- [x] Task 4: Procedura oRPC di prova che delega al core (AC: #1)
  - [x] Nuova procedura nel router (es. `notes.create` o simile, accanto a `healthCheck`/`privateData`): usa `protectedProcedure`, passa `context.principal` al caso d'uso del core e mappa gli errori di dominio tipizzati sul set oRPC fisso **in un unico punto dell'adapter** (una funzione `toORPCError`/interceptor, non try/catch sparsi): `UnauthorizedError` → `UNAUTHORIZED`, `ForbiddenError` → `FORBIDDEN` (azione nota ma vietata — la risorsa di prova esiste per definizione). Semantica AD-13 completa (404 per non-rivelazione) arriva con le risorse reali in Epic 4/5: qui si fissa il meccanismo di mapping.
  - [x] Le porte del caso d'uso (Repository, AuditWriter) ricevono implementazioni in-memory di prova: **nessun tocco a Prisma** — l'accesso dati concreto del dominio arriva con il primo repository reale (Story 4.2). La procedura dimostra il flusso Principal→core→authz, non la persistenza.
  - [x] La procedura è una **mutation** di prova: è la prima via di scrittura RPC del sistema, quindi il guard Origin/CSRF (vedi Task 5) deve essere in pace prima che questa esista.
- [x] Task 5: Guard Origin/CSRF sulle rotte RPC (AC: #1 — prerequisito della prima mutation; chiusura voce deferred-work 1-1)
  - [x] In `apps/web/src/app/api/rpc/[[...rest]]/route.ts` (o in un helper in `packages/api`): per i metodi state-changing (POST/PUT/PATCH/DELETE) verificare l'header `Origin` (fallback `Referer`) contro l'allow-list (`env.CORS_ORIGIN`); richiesta senza Origin valido → 403, fail-closed. Le richieste RPC legittime del client (`apps/web/src/utils/orpc.ts`) sono same-origin e portano Origin; i client RPC programmatici senza browser no — accettabile: la via autenticata è il browser. GET resta senza guard (le procedure di lettura oggi non mutano).
  - [x] Fail-closed anche sull'config: se `CORS_ORIGIN` non è impostato, il guard per le mutation deve negare, non aprire (stesso spirito del gate `exposeApiReference` della route, che legge `process.env.NODE_ENV` direttamente per non fallire aperto).
  - [x] Aggiornare la voce CSRF in `deferred-work.md` (sezione review 1-1): chiusa da questa story, con nota su ciò che resta (es. SameSite dei cookie Better Auth è già default `lax` — verificare, non assumere).
- [x] Task 6: Convenzione/lint verificabile anti-bypass del core (AC: #2)
  - [x] Nuovo `packages/api/scripts/check-boundaries.mjs` sul pattern di `packages/domain/scripts/check-boundaries.mjs` (gate regex zero-dipendenze — non esiste un linter nel repo e lo Spine non ne ratifica uno): in `src/` di `packages/api` sono vietati gli import di `@app/db`, di `prisma` e di qualunque modulo Prisma — le procedure oRPC (adapter inbound) raggiungono il dominio **solo** tramite `@app/domain` (AD-1: nessun accesso diretto alla persistenza che scavalchi i casi d'uso). Aggiungere lo script come `lint` in `packages/api/package.json` (oggi il package non ha script `lint`; `turbo run lint` lo raccoglie automaticamente).
  - [x] Rimuovere `@app/db` dalle dipendenze di `@app/api` se dopo il check risulta effettivamente non usata (verificare: `createContext` usa solo `@app/auth`; l'eventuale uso residuo va ricondotto via auth/domain).
  - [x] Il check deve fallire verde-garantito: nessun file scannerizzato (come il gemello di domain) → errore, non OK.
- [x] Task 7: Test e CI (AC: #1, #2)
  - [x] Test unitari in `packages/domain` per la policy: ADMIN/EDITOR consentiti, CLIENTE negato, principal null negato, ruolo fuori tassonomia negato (deny-by-default provato per omissione, non solo per grant).
  - [x] Test in `packages/api` (nuovo setup vitest sul pattern `packages/auth`: script `test`, `vitest.config.ts`, devDep vitest in catalog): `createContext` con sessione valida → principal con ruolo corretto; con `session.user.role` corrotto → principal `null`; middleware `requirePrincipal` → UNAUTHORIZED senza principal, principal iniettato con. Mock di `auth.api.getSession` via `vi.mock` (test di unità del context, non di integrazione Better Auth — quella esiste già in `packages/auth/tests/`).
  - [x] Test end-to-end leggero del flusso (facoltativo ma raccomandato): chiamata alla procedura di prova con `call(procedure, input, { context })` di oRPC — verifica che Principal fluisca e che il deny del core si manifesti come errore oRPC mappato, senza DB né server.
  - [x] Verifica anti-bypass: aggiungere temporaneamente un import `@app/db` in un file di `packages/api/src` e confermare che `pnpm lint` fallisce (canary manuale, non committato).
  - [x] Verifica finale: `pnpm check-types` (tutti i package), `pnpm test`, `pnpm lint`, `pnpm build` verdi; CI esistente continua a passare.

## Dev Notes

- **Cosa esiste già (Story 1.1–1.4 done):**
  - `packages/api` (`@app/api`): `createContext(req)` restituisce `{ session }` via `auth.api.getSession` [packages/api/src/context.ts]; `os.$context<Context>()` con `publicProcedure` = `o` e `protectedProcedure` = middleware `requireAuth` che scarta sessione assente e inietta `session` non-null [packages/api/src/index.ts]; router con `healthCheck` (public) e `privateData` (protected) [packages/api/src/routers/index.ts]. **Nessuno script `test` né `lint`** nel package.
  - La route `apps/web/src/app/api/rpc/[[...rest]]/route.ts` monta `RPCHandler` + `OpenAPIHandler` (reference chiusa in prod, fail-closed su `process.env.NODE_ENV`), match del path **prima** della costruzione del context, e gestisce esplicitamente gli errori di `createContext` (gli interceptor non coprono il contesto). Non toccare questa struttura se non per il guard Origin.
  - `packages/domain` (`@app/domain`): port `Repository`/`AuditWriter`/`CacheInvalidator`/`CommerceProvider` + caso d'uso di prova `CreateNoteUseCase` (DI via costruttore, audit con metadati AD-8). Il boundary check `packages/domain/scripts/check-boundaries.mjs` è il **pattern da replicare** per `packages/api` (gate regex, commenti stripped, fail se nessun file scannerizzato, errori di scan segnalati non ignorati).
  - `packages/auth`: `Role`/`ROLES`/`DEFAULT_ROLE` + `parseRole`/`safeParseRole` (zod) [packages/auth/src/roles.ts]; Better Auth configura `user.additionalFields` con `role` (`input: false`), quindi **`session.user.role` è già popolato** lato server e client (Story 1.4) — è da lì che il context costruisce il Principal.
  - `apps/web/src/utils/orpc.ts`: client oRPC con `credentials: "include"` — le chiamate browser sono same-origin con header `Origin` presente: il guard Origin del Task 5 non le disturba.
- **AD-4 è il contratto di questa story:** Better Auth fornisce identità + ruolo **grossolano** (`Principal { userId, role }`) nel context oRPC; l'autorizzazione **fine** è dato di dominio decisa dal core, deny-by-default, su read **e** write; nessun adapter decide da sé. Lo story implementa il **meccanismo**: Principal nel context + policy nel core + mapping errori. L'enforcement sulla matrice operazionale reale (pagine, assegnazioni, audit) arriva con i casi d'uso veri (Epic 4/5) — non anticipare use case di `Page` qui.
- **Il Principal vive nel core, non in auth/api** — perché l'autorizzazione fine è del dominio, il tipo che il core consuma deve essere suo. Direzione dipendenze: `api → domain`, `auth → domain` (adapter→core); `domain ↛ @app/{db,auth,api}` è già enforceato dal boundary check di domain. Un `Principal` definito in `packages/api` creerebbe un'inversione impossibile (il core importerebbe dall'adapter HTTP).
- **Deny-by-default su tre livelli in questa story:** (1) ingresso — già fatto in 1.4 (`input: false`, default CLIENTE); (2) forma del dato — ruolo fuori tassonomia in sessione → `principal: null` → UNAUTHORIZED (non "tratta come CLIENTE"); (3) policy del core — solo i ruoli esplicitamente consentiti passano. I test devono coprire tutti e tre.
- **Semantica errori (AD-13, prima parte):** il set oRPC fisso parte qui con il mapping centralizzato errori-di-dominio→`ORPCError`. Convenzione già fissata dallo Spine: su risorsa non-pubblica non autorizzata → 404 (non si rivela l'esistenza); 403 solo per azioni note-ma-vietate su esistenza lecita; il caso della procedura di prova (risorsa sempre nota) usa UNAUTHORIZED/FORBIDDEN. Le procedure future useranno la stessa funzione di mapping — se il dev la trova naturale solo in un try/catch locale, è un segnale che il design va rivisto in review.
- **CSRF è di questa story, non "nice to have":** la voce `deferred-work.md` (review 1-1) lo rimanda esplicitamente a 1.5 "prima della prima mutation". Il Task 4 introduce la prima mutation. Fare Task 5 prima o insieme al Task 4.
- **Assegnazione ruoli per i test:** nessun endpoint di gestione ruoli (voce deferred-work aperta, rimandata). I test non ne hanno bisogno: la policy del core si testa con `Principal` costruiti a mano, e il context si testa mockando `getSession`. Nessun utente reale con ruolo ADMIN serve in questa story.
- **Lezioni delle story precedenti:**
  - Il catalog pnpm per le dipendenze condivise (vitest, zod); niente pinnature ad-hoc. oRPC è pinnato `^1.14.6` nel catalog — usare `catalog:`.
  - Test di integrazione Better Auth → attenzione ai 429 delle special rules (IP deterministici e univoci per test). Questa story può evitarli del tutto: mock di `getSession`, non flussi di sign-in reali.
  - `packages/domain` non ha dipendenze runtime: mantenerle a zero (la guardia `isRole` piana al posto di zod nel core).
  - Gate regex, non lexer: seguire i limiti dichiarati nel commento di `check-boundaries.mjs` di domain (sbaglia chiudendo, commenti stripped, fail-se-nessun-file).
  - CI: `turbo run lint/test` raccoglie i nuovi script senza modifiche al workflow (service postgres già configurato, ma questa story non ne ha bisogno — nessun test DB).
- **Non toccare:** `packages/db` (nessuna migration in questa story — Principal e ruolo non aggiungono colonne); la struttura della route RPC (fuori dal guard Origin); `apps/web/src/app/dashboard/page.tsx` (guard app-level già fatto in 1.4; il problema "ruolo corrotto → loop login↔redirect" a livello pagina resta deferred — sulle vie RPC è invece chiuso dal principal-null di questa story); i client oRPC (`orpc.ts`); lo Storybook/UI (Epic 2+); la matrice RBAC operazionale su pagine (Epic 4/5).

### Project Structure Notes

- File interessati:
  ```
  packages/domain/
    src/principal.ts                   # NUOVO — Role, ROLES, Principal, isRole
    src/authz.ts (o simile)            # NUOVO — policy deny-by-default + errori tipizzati
    src/index.ts                       # MODIFICATO — export nuovi contratti
    src/use-cases/create-note.ts       # MODIFICATO — Principal + policy
    src/use-cases/create-note.test.ts  # MODIFICATO
    tests/ (nuovi test policy)         # NUOVO
  packages/auth/
    src/roles.ts                       # MODIFICATO — re-export da @app/domain
    package.json                       # MODIFICATO — dep @app/domain
  packages/api/
    src/context.ts                     # MODIFICATO — principal dal sessione
    src/index.ts                       # MODIFICATO — requirePrincipal
    src/routers/index.ts               # MODIFICATO — procedura di prova + mapping errori
    src/errors.ts (o simile)           # NUOVO — mapping errori dominio→oRPC (se non in routers)
    scripts/check-boundaries.mjs       # NUOVO — gate anti-bypass (AC#2)
    package.json                       # MODIFICATO — script lint/test, deps ripulite
    tests/ + vitest.config.ts          # NUOVO
  apps/web/
    src/app/api/rpc/[[...rest]]/route.ts  # MODIFICATO — guard Origin (Task 5)
  _bmad-output/implementation-artifacts/deferred-work.md  # MODIFICATO — chiusura voce CSRF
  ```
- Allineamento allo Structural Seed: `Principal` nel core; il context oRPC e le procedure in `packages/api` (adapter inbound — lo Spine colloca `src/orpc` sotto `apps/web`, ma l'implementazione attuale dell'adapter oRPC vive in `packages/api` dallo scaffold: si mantiene la collocazione esistente, la migrazione non è di questa story); il guard Origin nella route fetch di `apps/web`.
- Conflitti rilevati: la dipendenza `@app/db` dichiarata in `packages/api/package.json` sembra non usata dal codice sorgente (solo `@app/auth` in context) — il Task 6 la rimuove se confermato; nessun altro conflitto con le story precedenti.

### Testing Requirements

- Policy del core: grant per ADMIN/EDITOR, deny per CLIENTE, deny per principal assente, deny per ruolo fuori tassonomia, deny per lista permessi vuota (deny-by-default per omissione).
- Context: sessione valida → `Principal` corretto; ruolo corrotto → `principal: null` (mai ruolo "best-effort"); nessuna sessione → principal `null`.
- Middleware: senza principal → `UNAUTHORIZED`; con principal → iniettato nel context della handler.
- Procedura di prova: flusso completo Principal→core (via `call()` o handler) con mapping errore verificato.
- Guard Origin: mutation senza Origin → 403; con Origin same-origin (da `CORS_ORIGIN`) → passa; GET senza Origin → passa. Fail-closed se `CORS_ORIGIN` manca.
- Boundary check: canary con import `@app/db` → `pnpm lint` rosso; nessun file → errore, non verde.
- Non-regressione: `check-types`/`test`/`lint`/`build` verdi su tutti i package; i 20 test esistenti (auth, db, domain) continuano a passare (il test `create-note` cambia input — aggiornarlo, non eliminarlo).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5: Context oRPC con Principal e policy deny-by-default] — user story e AC originali.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-4] — Principal { userId, role } nel context oRPC; authz fine nel core, deny-by-default read e write; nessun adapter decide da sé.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-13] — errori di dominio tipizzati → set oRPC fisso; 404 vs 403.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-1] — unico punto di accesso al dominio; nessun accesso diretto che scavalchi i casi d'uso (base dell'AC#2).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Consistency Conventions] — `Principal` contratto condiviso core-attraversante; authz fine sempre nel core.
- [Source: _bmad-output/specs/spec-page-builder/rbac-matrix.md#Matrice operazioni] — creare pagina: Admin/Editor ✅, Cliente ❌ (policy del caso d'uso di prova).
- [Source: _bmad-output/implementation-artifacts/1-4-autenticazione-con-ruoli-admin-editor-cliente.md#Dev Agent Record] — `session.user.role` popolato via additionalFields; `safeParseRole` per i guard; 429 rate limit nei test (evitare flussi sign-up reali); lezioni migration non applicabili (nessuna migration qui).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 1-1] — voce CSRF sulle rotte RPC rimandata a **questa story**; voce "assegnazione ruoli" (resta aperta, non serve qui); voce "guard /dashboard non testato a livello rotta" (rivalidare: E2E comunque assente, rimanda).
- [Source: packages/api/src/context.ts] — contesto attuale `{ session }` (punto di partenza).
- [Source: packages/api/src/index.ts] — middleware `requireAuth` attuale (da irrobustire in requirePrincipal).
- [Source: packages/auth/src/roles.ts] — tassonomia Role esistente (da ri-radicare in domain).
- [Source: packages/domain/scripts/check-boundaries.mjs] — pattern del gate di confine da replicare per `packages/api`.
- [Source: orpc.dev/docs/context + /docs/middleware + /docs/error-handling] — oRPC 1.x: `os.$context`, middleware con `next({ context })` per guard+inject, `ORPCError` con codici fissi (UNAUTHORIZED/FORBIDDEN/NOT_FOUND), `call(procedure, input, { context })` per test senza server. Versione pinnata nel catalog: `@orpc/server ^1.14.6`.

## Dev Agent Record

### Agent Model Used

opencode-go/glm-5.3-flash (GLM — via opencode, skill bmad-dev-story)

### Debug Log References

- RED/GREEN per-task: test scritti prima dell'implementazione e confermati rossi (`principal`+`authz` in domain: 2 file falliti; context/middleware api: 5 test falliti; guard Origin: RED; `notes.create` e2e: 4 test falliti) prima del GREEN.
- Canary anti-bypass (Task 6): `import { prisma } from "@app/db"` temporaneo in `packages/api/src` → `pnpm lint` rosso (exit 1, violazione segnalata per riga + rete raw); file rimosso → gate di nuovo verde.
- Correzione TS: `ORPCError` è generico (`ORPCError<TCode, TData>`) — la firma di ritorno di `toORPCError` è `ORPCError<string, unknown>`; `error.defined` riguarda il `data`, non il codice.

### Completion Notes List

- **Task 1**: `Principal`/`Role`/`ROLES`/`isRole` radicati in `packages/domain/src/principal.ts` (zero dipendenze runtime); `packages/auth/src/roles.ts` è diventato re-export della tassonomia da `@app/domain` con `parseRole`/`safeParseRole` (zod) e `DEFAULT_ROLE` che restano in auth; aggiunta dep `@app/domain` a `@app/auth` (direzione adapter→core). Nessun export rimosso da `@app/auth` (nessun breaking).
- **Task 2**: `packages/domain/src/authz.ts` con `assertRole` (deny-by-default: principal null → `UnauthorizedError`, ruolo non consentito o fuori tassonomia → `ForbiddenError`, lista vuota → deny) ed errori di dominio tipizzati (classi, AD-13 prima parte). `CreateNoteUseCase` accetta `Principal` (input `principal: Principal | null`) e applica la policy ADMIN/EDITOR coerente con la matrice RBAC; audit `actor` = `principal.userId`. Test aggiornato (non spostato né rinominato).
- **Task 3**: `createContext` costruisce `principal: Principal | null` da `session.user` (`safeParseRole`; ruolo mancante/corrotto → null, mai best-effort a CLIENTE) e continua a esporre `session`; middleware rinominato semanticamente `requirePrincipal` (guard+inject con `next({ context })`, pattern oRPC 1.x): senza principal → `ORPCError("UNAUTHORIZED")`; `protectedProcedure` resta l'entry point esportato (contratto irrobustito, firme invariate — `privateData` continua a compilare).
- **Task 5 (prima della mutation, come da Dev Notes)**: `packages/api/src/origin-guard.ts` — guard puro e testato: mutation (POST/PUT/PATCH/DELETE) richiedono `Origin` (fallback `Referer`, confronto per origin) in allow-list; fail-closed sia su richiesta (403) sia su config (`CORS_ORIGIN` letto da `process.env` direttamente nella route, come il gate `exposeApiReference`: config assente → mutation negate, GET operativi). Guard invocato nella route RPC prima di `createContext` (una POST cross-site non costa nemmeno la lookup sessione). Voce CSRF in `deferred-work.md` chiusa (con nota: SameSite cookie Better Auth da verificare in 1.6, non assumere).
- **Task 4**: router `notes.create` (mutation di prova, input zod `{ id, content }`): usa `protectedProcedure`, passa `context.principal` a `CreateNoteUseCase` e mappa gli errori di dominio in un UNICO punto (`toORPCError` in `packages/api/src/errors.ts`): `UnauthorizedError`→UNAUTHORIZED, `ForbiddenError`→FORBIDDEN, errori ignoti rethrow (coperti da `onError`). Porte in-memory (Repository/AuditWriter) nel router: nessun tocco a Prisma. Router montato come `notes` (additivo; `healthCheck`/`privateData` invariati).
- **Task 6**: `packages/api/scripts/check-boundaries.mjs` (pattern del gemello di domain: gate regex, commenti stripped, fail-se-nessun-file, scan errors segnalati): in `src/` di `@app/api` vietati `@app/db`, `prisma`, `@prisma/client`, `.prisma/client` (specifier + rete raw). Script agganciato come `lint` in `packages/api/package.json` (raccozzo automatico da `turbo run lint`). Dep `@app/db` rimossa da `@app/api` (confermata non usata dal sorgente).
- **Task 7**: policy del core coperta per omissione (grant ADMIN/EDITOR; deny CLIENTE, principal null, ruolo fuori tassonomia, lista vuota); context coperto (sessione valida→principal, ruolo corrotto→null, nessuna sessione→null, ruolo mancante→null; `getSession` mockato con `vi.mock` + `vi.importActual` di `@app/auth/roles` — parser reali, niente Better Auth/Prisma); middleware via `call()` (UNAUTHORIZED senza principal, inject con principal, sessione-valida-ma-principal-null→UNAUTHORIZED); e2e leggero `notes.create` via `call()` (flusso Principal→core→mapping oRPC verificato, senza DB né server); guard Origin coperto su tutti i rami (GET aperto, mutation deny, Referer fallback, Origin "null", confronto per origin, normalizzazione slash, fail-closed config). Canary anti-bypass eseguito e ripulito.
- **Verifiche finali (root)**: `pnpm check-types` 7/7, `pnpm lint` 3/3, `pnpm test` 4/4 package — 56 test totali verdi (domain 13, db 8, auth 11, api 24; i test pre-esistenti continuano a passare), `pnpm build` 10/10. Nessuna nuova dipendenza oltre `@app/domain` come dep workspace (vitest già in catalog); niente pinnature ad-hoc.

### File List

- packages/domain/src/principal.ts (NUOVO)
- packages/domain/src/authz.ts (NUOVO)
- packages/domain/src/index.ts (MODIFICATO)
- packages/domain/src/use-cases/create-note.ts (MODIFICATO)
- packages/domain/src/use-cases/create-note.test.ts (MODIFICATO)
- packages/domain/tests/principal.test.ts (NUOVO)
- packages/domain/tests/authz.test.ts (NUOVO)
- packages/domain/tests/factories.ts (NUOVO)
- packages/auth/src/roles.ts (MODIFICATO)
- packages/auth/package.json (MODIFICATO)
- packages/api/src/context.ts (MODIFICATO)
- packages/api/src/index.ts (MODIFICATO)
- packages/api/src/origin-guard.ts (NUOVO)
- packages/api/src/errors.ts (NUOVO)
- packages/api/src/routers/index.ts (MODIFICATO)
- packages/api/src/routers/notes.ts (NUOVO)
- packages/api/scripts/check-boundaries.mjs (NUOVO)
- packages/api/vitest.config.ts (NUOVO)
- packages/api/package.json (MODIFICATO)
- packages/api/tests/context.test.ts (NUOVO)
- packages/api/tests/procedure.test.ts (NUOVO)
- packages/api/tests/origin-guard.test.ts (NUOVO)
- packages/api/tests/routers.e2e.test.ts (NUOVO)
- apps/web/src/app/api/rpc/[[...rest]]/route.ts (MODIFICATO)
- _bmad-output/implementation-artifacts/deferred-work.md (MODIFICATO — chiusura voce CSRF)
- pnpm-lock.yaml (MODIFICATO — install deps workspace)

## Change Log

- 2026-09-05 — Story 1.5 implementata: `Principal` nel core (`@app/domain`) con policy deny-by-default (`assertRole`) ed errori di dominio tipizzati; `CreateNoteUseCase` migrato a Principal; Principal nel context oRPC (`requirePrincipal`, deny su ruolo corrotto); guard Origin/CSRF fail-closed sulle mutation RPC (chiusura deferred-work 1-1); prima mutation `notes.create` con mapping centralizzato dominio→oRPC (`toORPCError`); gate anti-bypass `check-boundaries.mjs` per `@app/api` (+ rimozione dep `@app/db` non usata); 36 nuovi test (12 in domain, 24 in api, di cui 4 e2e leggeri) — 56 test totali verdi; `check-types`/`lint`/`test`/`build` verdi a livello repo.
- 2026-09-06 — Fix da code review (1 decision-needed risolta — opzione 1: interceptor handler-level — e 7 patch applicate): mapping AD-13 applicato una volta sola via interceptor `mapDomainErrors` su RPCHandler/OpenAPIHandler (try/catch rimosso da `notes.create`; nuova suite `errors.test.ts` con 8 test su toORPCError/mapDomainErrors); `createContext` difende la forma di `user` e rifiuta `userId` vuoto (`session?.user?.id` truthy); `requirePrincipal` fail-closed anche su chiavi assenti (`== null`); allow-list Origin normalizzata via `new URL().origin` (fail-loud su config rotta); fallback Referer attivo anche con `Origin: ""` (`||`); gate anti-bypass esteso (specifier relativi verso `db` + bare `prisma` in RAW; canary rosso/verde su entrambi i bypass); nota CSRF in deferred-work corretta (limitazione SSR registrata); commento test `isRole` corretto. Verifiche: `check-types` 7/7, `lint` 3/3, `test` 4/4 (66 totali), `build` 10/10. Status → done.

### Review Findings

_Code review adversariale del 2026-09-06 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Base diff: delta non committato (`git diff HEAD` + file nuovi, esclusi lockfile e artifact sprint/story). Auditor: **PASS** (gate e test verificati empiricamente: check-types 7/7, lint 3/3, test 4/4 — 56 totali, build 10/10, canary anti-bypass rosso/verde). Triage: 1 decision-needed, 7 patch, 3 defer, 8 dismiss. Decisione risolta da Alessandro (opzione 1: interceptor handler-level); tutte le patch applicate e verificate — `check-types` 7/7, `lint` 3/3, `test` 4/4 (66 test totali, +8 nuovi in `errors.test.ts`), `build` 10/10, canary del gate esteso rosso/verde su entrambi i bypass nuovi (relativo `../../db` e bare `prisma`)._

- [x] [Review][Decision] Mapping errori con try/catch per-procedura — la traduzione è centralizzata in `toORPCError` (`packages/api/src/errors.ts`), ma l'**applicazione** no: ogni procedura deve ricordarsi di wrappare in `try/catch` (`packages/api/src/routers/notes.ts:52-60`). La prima procedura futura che lo dimentica trasforma `ForbiddenError` in 500 `INTERNAL_SERVER_ERROR`, rompendo silenziosamente la semantica AD-13. Lo spec stesso (Dev Notes AD-13) indica il try/catch locale come "segnale che il design va rivisto in review". Opzioni: (1) interceptor a livello handler in `route.ts` (mapping una volta sola per tutte le vie), (2) factory di procedura/`use()` che centralizza il catch, (3) mantenere il try/catch esplicito e documentarlo come convenzione invariante. **Risolta (opzione 1)**: interceptor `mapDomainErrors` (`packages/api/src/errors.ts`) cablato una volta sola per RPCHandler e OpenAPIHandler in `route.ts`; try/catch rimosso da `notes.create`; il mapping è coperto da nuova suite `errors.test.ts` (nota: `call()` non passa dagli handler — lì il deny si manifesta come errore di dominio tipizzato, per design).
- [x] [Review][Patch] `createContext` non difende la forma di `user` né rifiuta `userId` vuoto [packages/api/src/context.ts:20] — `session?.user.id != null` opcionalizza solo `session`: una sessione non-null con `user` assente lancia TypeError (→ 500 via route) invece di produrre `principal: null`; e `userId: ""` passa il check diventando un Principal con identità vuota (audit `actor: ""`). **Applicata**: `session?.user?.id` con truthy check — user assente o id vuoto → `principal: null` (deny-by-default anche sulla forma del dato).
- [x] [Review][Patch] `requirePrincipal` usa `=== null` e lascia passare `principal: undefined` [packages/api/src/index.ts:20] — un context costruito a mano senza la chiave `principal` (call() nei test, futuro adapter) non scatta il guard e inietta `undefined` tipizzato come `Principal`. **Applicata**: `context.session == null || context.principal == null` — anche le chiavi assenti sono un deny.
- [x] [Review][Patch] Allow-list Origin mai normalizzata via `new URL().origin` [apps/web/src/app/api/rpc/[[...rest]]/route.ts:31-33, packages/api/src/origin-guard.ts:41-62] — lato richiesta l'origin è normalizzato (lowercase host, porta default rimossa), lato allow-list resta grezzo: `CORS_ORIGIN="HTTP://LocalHost:3000"` o `"https://x.com:443"` (o con path oltre l'origin) nega per sempre mutation legittime senza alcun warning al deploy. **Applicata**: `trustedOrigins = [new URL(process.env.CORS_ORIGIN).origin]` — normalizzazione identica a quella della richiesta; un valore non-URL lancia al boot (fail-loud esplicito, non deny silenzioso).
- [x] [Review][Patch] Origin stringa vuota non attiva il fallback Referer [packages/api/src/origin-guard.ts:46] — `headers.get("Origin") ?? headers.get("Referer")`: con `Origin: ""` (certi proxy/redirect) il `??` non scatta e `new URL("")` lancia → deny prima di guardare il Referer. **Applicata**: `||` al posto di `??` — Origin vuoto è assenza d'informazione, il fallback Referer copre il ramo.
- [x] [Review][Patch] Rete del gate anti-bypass incompleta [packages/api/scripts/check-boundaries.mjs:41-59] — (1) un import relativo a `packages/db` (es. `import { prisma } from "../../db/src/index"`) esce dal gate verde: nessun pattern su path relativi; (2) lo specifier nudo `prisma` (senza `/client`) manca da `FORBIDDEN_RAW`, che copre solo `@app/db` e `prisma/client` — la rete secondaria nasce proprio per lo scenario "parser desincronizzato che mangia le virgolette". **Applicata**: `FORBIDDEN_SPECIFIER` + pattern relativi verso `db`; `FORBIDDEN_RAW` + bare `prisma` e rilievi relativi `../db`. Canary: `../../db/src/index` → exit 1, `"prisma"` → exit 1, tree pulito → verde.
- [x] [Review][Patch] Voce CSRF in deferred-work chiusa senza registrare la limitazione SSR [_bmad-output/implementation-artifacts/deferred-work.md] — la voce dichiara "nessun impatto sui client browser", ma il link oRPC (`apps/web/src/utils/orpc.ts:41-50`) è lo stesso codice usato server-side: lì il fetch verso `/api/rpc` porta solo cookie/authorization, senza `Origin` (undici non lo aggiunge) → la prima mutation invocata da RSC/server action sarà negata 403 fail-closed. **Applicata**: nota corretta — impatto zero lato browser, ma la via SSR (oggi inesistente) negherà le mutation fino a rivalidazione (Epic 4/6).
- [x] [Review][Patch] Commento di test impreciso su `isRole` [packages/domain/tests/authz.test.ts] — il commento dice "la guardia isRole precede la lista", ma `assertRole` non chiama `isRole`: il deny fuori-tassonomia è garantito dal sistema di tipi (un ruolo fuori tassonomia non può stare in una lista `Role[]`), non da una guardia esplicita. **Applicata**: commento corretto (il cast `as never` simula l'unico modo in cui un valore grezzo corrotto può arrivare: aggirando i tipi).
- [x] [Review][Defer] Dettagli della policy nel canale client via `toORPCError` [packages/api/src/errors.ts:20-25, packages/domain/src/authz.ts:27-36] — deferred; `ForbiddenError` compone messaggi con `allowedRoles` e il mapping inoltra `error.message` al client: dettagli della policy interna finiscono nel canale client per costruzione. Innocuo per il fixture (ruolo noto al client), ma il meccanismo è quello che Epic 4/5 eredita — decidere lì se/nome-dei-messaggi esposti.
- [x] [Review][Defer] Nessun test automatico dello script `check-boundaries.mjs` [packages/api/scripts/check-boundaries.mjs] — deferred; ~240 righe di parser+regex verificate solo da canary manuale. Una regressione futura spegne il confine in silenzio restando verde. Il gemello di domain ha lo stesso difetto: automatizzare i canary (rosso/verde) per entrambi i gate.
- [x] [Review][Defer] Nessun test del wiring rotta (guard + `createContext` + handler) [apps/web/src/app/api/rpc/[[...rest]]/route.ts:54-89] — deferred; i tre pezzi aggiunti/cambiati dalla story sono testati solo separatamente: l'unico punto senza coverage è dove si incontrano (ordine 404→guard→context). `apps/web` non ha harness di test; E2E assente repo-wide (voce 1-4 "guard /dashboard non testato a livello rotta" è lo stesso problema familiare).
