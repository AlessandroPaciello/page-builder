# API Contracts — apps/pagebuilder

> Documento generato da deep scan (BMad document-project) il 2026-07-10, basato sulla lettura diretta dei controller REST in `apps/pagebuilder/src/main/java/com/penpot/pagebuilder/web/rest/`.

## Convenzioni generali

- Tutti gli endpoint sono sotto `/api/**`, protetti globalmente da `authenticated()` (autenticazione OIDC/JWT Keycloak), salvo `/api/authenticate` e `/api/auth-info` (`permitAll`) e `/api/admin/**` (`ROLE_ADMIN`).
- Formato errori: **RFC 7807 ProblemDetail**, gestito da `ExceptionTranslator` (`@ControllerAdvice`, usa `org.springframework.web.ErrorResponse`/`ErrorResponseException`). Il frontend (`pagebuilderApi.ts`) mappa la risposta in `ProblemDetailError { status, title, detail?, type? }`.
- Endpoint custom di business (`PageResource`, `PageAuditResource`) usano `@PreAuthorize` con `AuthoritiesConstants` (`ROLE_ADMIN`, `ROLE_EDITOR`, `ROLE_CLIENTE`). Gli endpoint CRUD generici JHipster (`PageVersionResource` e parte di `PageResource`) **non hanno `@PreAuthorize`** — vedi gap RBAC in `architecture-pagebuilder.md` §3.
- Documentazione OpenAPI generata via springdoc (`/v3/api-docs/**`, `/swagger-ui/**`, quest'ultimo `permitAll`, il primo riservato ad ADMIN).

## 1. `PageResource` — `/api/pages` (controller custom + CRUD generato)

| Metodo | Path | Auth (`@PreAuthorize`) | Descrizione |
|---|---|---|---|
| POST | `/api/pages` | ADMIN o EDITOR | Crea una nuova Page con validazione di unicità dello slug. Body: `PageCreateDTO`. Risposta: `201 Created`, body `PageDTO`, header `Location`. |
| POST | `/api/pages/{id}/versions` | ADMIN, EDITOR o CLIENTE | Salva un payload Puck come nuova `PageVersion` in stato DRAFT. CLIENTE può salvare solo modifiche content-only su Page assegnate (AC-1, Story 2.12). Body: `SaveVersionRequest`. Risposta: `201 Created`, body `PageVersionDTO`. |
| POST | `/api/pages/{id}/assign-cliente/{clienteId}` | ADMIN o EDITOR | Assegna un cliente (identificato da sub/email Keycloak) a una Page. Endpoint scaffolding (Story 2.12), UI fine-grained rimandata a story future. Risposta: `200 OK`, body vuoto. |
| GET | `/api/pages/{id}/versions/history` | ADMIN o EDITOR | Restituisce la cronologia versioni di una Page (solo metadati, no payload), ordinata per `versionNumber` decrescente. Risposta: `200 OK`, body `List<PageVersionHistoryDTO>`. |
| POST | `/api/pages/{id}/publish` | ADMIN o EDITOR | Promuove una `PageVersion` a PUBLISHED; eventuali altre versioni PUBLISHED della stessa Page vengono retrocesse a DRAFT atomicamente (vincolo DB: al più una PUBLISHED per Page). Body: `PublishVersionRequest`. Risposta: `200 OK`, body `PageVersionDTO`. |
| POST | `/api/pages/{id}/rollback` | ADMIN o EDITOR | Ripristina una Page a una PageVersion precedente (la promuove a PUBLISHED, retrocede l'attuale PUBLISHED a DRAFT). Body: `RollbackVersionRequest`. Risposta: `200 OK`, body `PageVersionDTO`. |
| POST | `/api/pages/{id}/archive` | ADMIN o EDITOR | Transizione della Page a stato ARCHIVED; le PageVersion associate sono preservate. Risposta: `200 OK`, body `PageDTO`. |
| POST | `/api/pages/{id}/restore` | ADMIN o EDITOR | Riporta una Page da ARCHIVED a DRAFT. Risposta: `200 OK`, body `PageDTO`. |
| PUT | `/api/pages/{id}` | **nessuna `@PreAuthorize`** (solo `authenticated()` globale) | Update completo generato da JHipster. Body: `PageDTO`. Risposta: `200 OK`. Valida coerenza `id` path/body e esistenza entità (400 se mancante/incoerente). |
| PATCH | `/api/pages/{id}` | **nessuna `@PreAuthorize`** | Partial update (merge-patch) generato da JHipster. Risposta: `200 OK` o `404`. |
| GET | `/api/pages` | **nessuna `@PreAuthorize`** | Lista tutte le Page. Risposta: `200 OK`, body `List<PageDTO>`. Nota: non paginato (a differenza di `PageVersionResource`). |
| GET | `/api/pages/{id}` | **nessuna `@PreAuthorize`** | Dettaglio Page. Risposta: `200 OK` o `404`. |
| GET | `/api/pages/by-slug/{slug}?version=draft\|published` | nessuna restrizione di ruolo (lettura intenzionalmente permissiva per tutti i ruoli autenticati, FR-10) | Rende una Page tramite slug: versione pubblicata di default, o l'ultima bozza con `?version=draft`. Risposta: `200 OK`, body `PageRenderDTO`. |
| DELETE | `/api/pages/{id}` | **nessuna `@PreAuthorize`** | Elimina una Page. Risposta: `204 No Content`. |

## 2. `PageVersionResource` — `/api/page-versions` (CRUD generato JHipster, nessun `@PreAuthorize`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| POST | `/api/page-versions` | solo `authenticated()` | Crea una PageVersion (deve non avere già un id, altrimenti `400 idexists`). Body/risposta: `PageVersionDTO`. |
| PUT | `/api/page-versions/{id}` | solo `authenticated()` | Update completo. |
| PATCH | `/api/page-versions/{id}` | solo `authenticated()` | Partial update (merge-patch). |
| GET | `/api/page-versions?page=&size=&sort=` | solo `authenticated()` | Lista paginata (Spring `Pageable`), header `X-Total-Count`/link paginazione via `PaginationUtil`. |
| GET | `/api/page-versions/{id}` | solo `authenticated()` | Dettaglio, `200` o `404`. |
| DELETE | `/api/page-versions/{id}` | solo `authenticated()` | Elimina, `204`. |

Tutti questi endpoint sono CRUD scaffolding standard JHipster e **non applicano la matrice RBAC di dominio** — vedi nota rischio in `architecture-pagebuilder.md`.

## 3. `PageAuditResource` — `/api` (audit trail Envers, Story 2.13, solo ADMIN)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/api/pages/{id}/audit` | ADMIN | Cronologia revisioni Envers per una Page, ordinata per numero di revisione decrescente. Risposta: `200 OK`, body `List<PageAuditEntryDTO>`; `404` se Page non trovata; `403` se non ADMIN. |
| GET | `/api/audit?username={user}&page=&size=` | ADMIN | Cronologia revisioni Envers (Page + PageVersion) generate da un dato utente, paginata, ordinata per timestamp decrescente. `400 Bad Request` se `username` è blank/mancante (via `ResponseStatusException`, non ProblemDetail custom). |

Nota: questi endpoint dipendono dalla tabella `revinfo` (Envers), il cui changelog Liquibase è **attualmente non committato** (vedi `architecture-pagebuilder.md` §4) — la feature potrebbe non essere operativa allo stato attuale del repo.

## 4. Altri controller

| Controller | Path | Note |
|---|---|---|
| `AuthInfoResource` | `GET /api/auth-info` | `permitAll`. Espone `issuer` e `clientId` OIDC al frontend (bootstrap login). |
| `AccountResource` | non riletto in dettaglio in questo scan (standard JHipster: gestione account utente) | |
| `LogoutResource` | non riletto in dettaglio in questo scan (standard JHipster OIDC logout) | |

## 5. DTO principali (da `service/dto/`)

- `PageDTO` — rappresentazione completa di Page (usata da GET/PUT/PATCH).
- `PageCreateDTO` — input per la creazione (validazione slug).
- `PageRenderDTO` — output di rendering per `by-slug` (published/draft).
- `PageVersionDTO` — rappresentazione PageVersion.
- `PageVersionHistoryDTO` — metadati versione (no payload) per la cronologia.
- `SaveVersionRequest` — input per salvataggio bozza (payload Puck grezzo).
- `PublishVersionRequest`, `RollbackVersionRequest` — identificano la PageVersion target dell'operazione.
- `PageAuditEntryDTO` — voce di audit trail (revisione Envers).

Frontend (`src/main/webapp/app/pagebuilder/api/pagebuilderApi.ts`) definisce interfacce TypeScript parallele semplificate: `PageSummary`, `PageDTO`, `PageCreateInput`, `PageVersionDTO`, `VersionHistoryItem`, `ProblemDetail`/`ProblemDetailError`. Client attualmente implementato copre solo un sottoinsieme dell'API: `fetchPages` (GET `/api/pages`), `fetchPage` (GET `/api/pages/{id}`), `createPage` (POST `/api/pages`), `fetchVersionHistory` (GET `/api/pages/{id}/versions` — **nota: path diverso da quello reale del backend**, vedi Attenzione sotto), `saveVersion` (POST `/api/pages/{id}/versions`).

**Attenzione — possibile mismatch frontend/backend:** `pagebuilderApi.ts` chiama `GET /api/pages/${pageId}/versions` per la cronologia versioni, mentre il backend (`PageResource`) espone l'endpoint su `GET /api/pages/{id}/versions/history`. Da verificare se si tratta di un refuso non ancora notato (possibile 404 a runtime) o se esiste un routing/proxy che normalizza il path — non è stato trovato altro codice che aggiunga `/history` lato client in questo scan.

## 6. Conteggi

- Controller REST specifici del dominio page-builder: 6 (`PageResource`, `PageVersionResource`, `PageAuditResource`, `AuthInfoResource`, `AccountResource`, `LogoutResource` — questi ultimi due prevalentemente standard JHipster).
- Endpoint di business custom con RBAC esplicito: 9 (create, save-version, assign-cliente, version-history, publish, rollback, archive, restore, by-slug) + 2 audit (ADMIN-only).
- Endpoint CRUD generici senza `@PreAuthorize` di dominio: 5 su `Page` (PUT/PATCH/GET-list/GET-one/DELETE) + 6 su `PageVersion` (POST/PUT/PATCH/GET-list/GET-one/DELETE) = 11 endpoint totali.
