---
baseline_commit: ba2ce3f9a35676c4bac414c053f02fbd96b7cc5d
---

# Story 1.4: Autenticazione con ruoli Admin/Editor/Cliente

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utente,
I want autenticarmi e avere un ruolo riconosciuto dal sistema,
So that le operazioni successive possano essere autorizzate per ruolo (FR12 fondamenta).

## Acceptance Criteria

1. **Given** Better Auth configurato con adapter Prisma **When** effettuo il login **Then** ottengo una sessione valida e il mio ruolo (Admin/Editor/Cliente) è disponibile.
2. Una richiesta senza sessione valida verso una risorsa protetta è respinta (deny-by-default).

## Tasks / Subtasks

- [ ] Task 1: Estendere `packages/auth` con ruolo e hardening (AC: #1)
  - [ ] Aggiungere campo `role String` al modello `User` in `packages/db/prisma/schema/auth.prisma` (`@default("CLIENTE")`, non nullable, mappato come le altre colonne camelCase in tabella `user` — meglio colonna che `additionalFields` virtuali: il ruolo è dato di dominio persistente, non un dato di sessione volatile).
  - [ ] Dichiarare il ruolo a Better Auth via `user.additionalFields` (`{ role: { type: "string", defaultValue: "CLIENTE", input: false } }`) così che compaia in `session.user` lato client e server; `input: false` perché il ruolo NON è assegnabile dal client di registro (deny-by-default fin dall'ingresso, vedi Dev Notes "Assegnazione ruoli").
  - [ ] Configurare `emailAndPassword.minPasswordLength` server-side (es. 8) — la policy attuale vive solo negli schemi Zod dei form ed è bypassabile chiamando `/api/auth/sign-up/email` direttamente (voce aperta in `deferred-work.md`, chiusa qui).
  - [ ] Configurare `rateLimit` esplicito su Better Auth (finestra e max espliciti, non i default impliciti — vedi Dev Notes "Hardening").
  - [ ] **Decisione da documentare, non automatizzare**: `requireEmailVerification`. Il campo `emailVerified` esiste ma non è mai usato. Per il percorso di sviluppo della Story 1.4 mantenerlo a `false` (l'invio email richiederebbe un provider non previsto dallo Spine) ma registrare la decisione e il debito esplicitamente — è un gate di sicurezza reale in release (rimando documentato, vedi Dev Notes "Hardening").
  - [ ] Migration per la nuova colonna `role` (`prisma migrate dev --create-only` + revisione SQL); rigenerare e committare il client `packages/db/prisma/generated/`.
- [ ] Task 2: Normalizzare i ruoli di dominio (AC: #1)
  - [ ] Un modulo `packages/auth` (o `packages/db`) che esporta la tassonomia `Role = "ADMIN" | "EDITOR" | "CLIENTE"` come union TS con nomi agli **enum di dominio** dello Spine (Consistency Conventions: `role ∈ {ADMIN, EDITOR, CLIENTE}`, AD-4). Il valore in colonna è una stringa — la validazione dell'insieme valido avviene alla lettura (fail-fast se valore fuori tassonomia).
  - [ ] Uno `zod`/check di normalizzazione che trasforma il valore DB grezzo nel tipo `Role`, rifiutando valori sconosciuti (deny-by-default anche sulla forma del dato: un ruolo non riconosciuto non è mai trattato come ammesso).
- [ ] Task 3: Esposizione del ruolo lato app + guard della shell autenticata (AC: #1, #2)
  - [ ] La dashboard/esempio autenticato mostra il ruolo dell'utente corrente (prova visiva che il ruolo fluisce dalla sessione al client).
  - [ ] **Un guard server-side minimale** per una risorsa protetta di prova (es. la route `/dashboard`): senza sessione valida → redirect/401, con sessione valida → contenuto. Nota di scope: questo NON è l'enforcement RBAC del core (quello arriva in Story 1.5 con Principal nel context oRPC, AD-4) — è solo la dimostrazione dell'AC#2 a livello di app. Un client test di sessione invalida è accettabile come verifica (vedi Testing).
  - [ ] Cancellare l'auto-registrazione pubblica se emergesse in conflitto con l'assegnazione dei ruoli: il sign-up resta aperto (ruolo default CLIENTE), nessun utente nasce ADMIN/EDITOR (Dev Notes "Assegnazione ruoli").
- [ ] Task 4: Test e CI (AC: #1, #2)
  - [ ] Test di integrazione DB (pattern `packages/db/tests/invariants.integration.test.ts`, Postgres reale docker): nuovo utente default → ruolo `CLIENTE`; tentativo di settare un ruolo non valido via API di registro → rifiutato/non appunto onorato (`input: false` di Better Auth).
  - [ ] Test del guard: richiesta senza cookie di sessione alla risorsa protetta → 401/redirect (mai 200).
  - [ ] Verificare `pnpm check-types`, `pnpm test`, `pnpm lint`, `pnpm build` verdi su tutti i package; CI già esistente continua a passare.

## Dev Notes

- **Cosa esiste già (Story 1.1–1.3 done):**
  - `packages/auth` (`@app/auth`) con `betterAuth()` già configurato: `prismaAdapter(prisma)` su postgres, `trustedOrigins`, `emailAndPassword.enabled`, `secret`, `baseURL`, plugin `nextCookies()` — **ma senza hardening e senza ruoli** [packages/auth/src/index.ts]. La versione pinnata in catalog è **better-auth 1.6.23** (da `pnpm-workspace.yaml`).
  - `packages/db` con schema split `schema/schema.prisma` (dominio) + `schema/auth.prisma` (Better Auth); modelli `User/Session/Account/Verification` mappati snake_case. Il modello `User` ha già `emailVerified Boolean @default(false)` e la back-relation `assignments PageAssignment[]` aggiunta dalla Story 1.3.
  - `apps/web` ha già form sign-in/sign-up (`sign-in-form.tsx`, `sign-up-form.tsx`) con `authClient`, `user-menu`, `/login`, `/dashboard` e la route oRPC `/api/rpc/[[...rest]]`.
- **Ruolo: colonna DB, non solo additionalFields** — AD-4 fissa che Better Auth fornisce `identità + ruolo grossolano` (`Principal { userId, role }`). Il ruolo è **dato di dominio persistente**, quindi colonna `user.role` (NOT NULL, default `CLIENTE`), non un campo computato o solo-sessione. Con `user.additionalFields` Better Auth lo proietta in sessione e lato client senza tocchi manuali a Session.Nota di scope Better Auth 1.6.x: per tre ruoli fissi NON serve il plugin `admin` (che aggiunge `role/banned/banReason/banExpires` su user + endpoint di gestione utenti): aggiunge scope di gestione utenti fuori da questa story. La gestione assegnazioni ruoli (chi promuove un Cliente a Editor) non è richiesta dagli AC — vedi "Assegnazione ruoli" sotto e registra il debito su `deferred-work.md` se emerge.
- **Deny-by-default fin dall'ingresso (AC#2 richiede il principio, non solo il meccanismo):** il default del ruolo a registrazione è **CLIENTE** (il ruolo a minor privilegio nella matrice RBAC). Nessun percorso di sign-up può produrre un utente ADMIN/EDITOR: `input: false` su `additionalFields.role` rende il campo non scrivibile dal payload del client Better Auth. Documentare esplicitamente nel test.
- **Assegnazione ruoli (fuori scope, da registrare):** la matrice RBAC (`rbac-matrix.md`) definisce cosa può fare ciascun ruolo, non chi assegna i ruoli. Il seeded di un primo ADMIN e la promozione a EDITOR sono operazioni che l'admin plugin di Better Auth offrirebbe come endpoint — ma la UI/endpoint di gestione utenti non è in questa story. Soluzione minima: promozione manuale via SQL/script di seed in dev, debito esplicito su `deferred-work.md` con miraggio alla prima story che ne ha bisogno (probabile Epic 2+, o a valle di Story 1.5).
- **Hardening (chiude la voce di `deferred-work.md` aperta per Story 1.4):**
  - `minPasswordLength` server-side (la policy Zod dei form è client-side, bypassabile chiamando `/api/auth/sign-up/email` direttamente).
  - `rateLimit` esplicito ( Better Auth lo supporta nativamente; i default esistono ma attivarli senza di loro è un rischio in release — valore esplicito, non implicito).
  - `requireEmailVerification` → **decisione consapevole documentata**: per questa story NON attivo (nessun provider email previsto dallo Spine, la verifica bloccerebbe lo sviluppo). Debito registrato in `deferred-work.md` come gate da attivare prima del deploy reale (probabile Story 1.6, envelope di release). NON rimandare la decisione a un commento: scrivere la voce nel file.
  - L'**a11y dei form** (aria-invalid, live region) NON è di questa story — voce `deferred-work.md` rimirata ad Epic 2 (rewriting delle primitive). Non anticipare.
- **Non toccare:** `packages/domain` (il Principal nel context oRPC e l'autorizzazione fine sono Story 1.5, AD-4); la rotta oRPC `/api/rpc` resta com'è (il contesto con Principal arriva lì in 1.5); la matrice RBAC operazionale (chi può fare cosa sul dominio pagine) non ha enforcement in questa story — solo tassonomia + presenza ruolo. Le versioni pinnate dello Spine.
- **Test DB richiede Postgres reale** (docker compose di `packages/db`) — stesso principio della Story 1.3: senza `DATABASE_URL` il test fallisce chiaramente, mai skip silenzioso.
- **Lezioni delle story precedenti:**
  - Migration: creare con `--create-only`, revisionare il SQL, applicare, verificare che un secondo `migrate dev` sia "already in sync" (pitfall drift, Story 1.3 Task 2).
  - Client generato committato: dopo la migration rigenerare e verificare che `packages/db/prisma/generated/` sia coerente (`check-types` lo rigenera — vedere la voce "lockstep" in `deferred-work.md`, aperta).
  - Il catalog pnpm per le dipendenze condivise; niente pinnature ad-hoc fuori dal catalog.
  - CI: service container postgres già configurato nel workflow; il test di integrazione deve girare lì (pattern Story 1.3).

### Project Structure Notes

- File interessati:
  ```
  packages/db/
    prisma/schema/auth.prisma           # MODIFICATO — colonna role su User
    prisma/migrations/                  # NUOVO — migration per la colonna
    prisma/generated/                   # RIGENERATO e committato
    tests/ (nuovo test ruolo)          # NUOVO
  packages/auth/
    src/index.ts                        # MODIFICATO — additionalFields, hardening
    src/roles.ts (o simile)             # NUOVO — tassonomia Role + normalizzazione
  apps/web/
    src/app/dashboard/ (o simile)       # MODIFICATO — mostra ruolo + guard
  _bmad-output/implementation-artifacts/deferred-work.md  # MODIFICATO — chiusura voce 1-1 hardening, nuova voce assegnazione ruoli
  ```
- Allineamento allo Structural Seed: il ruolo vive nell'adapter auth (`packages/auth` + colonna in `packages/db`), il guard di prova vive in `apps/web`. Nessun tocco al core (`packages/domain`): Story 1.5.
- Conflitti rilevati: nessuno. La back-relation `assignments` su `User` (Story 1.3) non è toccata.

### Testing Requirements

- Test di integrazione DB: default role = CLIENTE su nuovo utente; il campo ruolo non è scrivibile via API di registro (deny-by-default sull'ingresso).
- Test del guard server-side: richiesta senza sessione → respinta (mai 200), con sessione → consentita.
- Non-regressione: `check-types`/`test`/`lint`/`build` verdi su tutti i package; CI verde (service postgres).
- Il test del ruolo deve fallire chiaramente senza DB (no skip silenzioso — pattern Story 1.3).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Autenticazione con ruoli Admin/Editor/Cliente] — user story e AC originali.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#AD-4] — Better Auth fornisce identità + ruolo grossolano (`Principal { userId, role }`); auth ≠ authz; l'autorizzazione fine è del core (Story 1.5).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-page-builder-2026-07-25/ARCHITECTURE-SPINE.md#Consistency Conventions] — `Auth`: Better Auth sessione cookie; `Principal + role` nel context oRPC; deny-by-default (read **e** write).
- [Source: _bmad-output/specs/spec-page-builder/rbac-matrix.md] — ruoli Admin/Editor/Cliente, principio deny-by-default server-side.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 1-1] — voce "Hardening dell'autenticazione assente" (minPasswordLength, requireEmailVerification, rateLimit) chiusa da questa story; voce a11y form rimirata ad Epic 2 (non toccare).
- [Source: _bmad-output/implementation-artifacts/1-3-modello-dati-e-invariante-di-pubblicazione-a-livello-db.md#Dev Agent Record] — pattern migration (`--create-only` + revisione SQL), test DB su Postgres reale, guard "fail without DATABASE_URL".
- [Source: packages/auth/src/index.ts] — configurazione Better Auth corrente (punto di partenza, senza ruoli né hardening).
- [Source: packages/db/prisma/schema/auth.prisma] — modelli Better Auth (User con `emailVerified` mai usato).
- [Source: better-auth.com/docs/plugins/admin] — campi plugin admin (role/banned/...); qui NON adottato, solo colonna `role` + `user.additionalFields`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
