# Architettura — apps/pagebuilder

> Documento generato da deep scan (BMad document-project) il 2026-07-10.
> `apps/pagebuilder` è un'applicazione **JHipster-generata** (Spring Boot + React) che sostituisce il vecchio backend Strapi CMS come motore del page builder Puck-driven. Il codice scaffolding JHipster **non va modificato a mano** salvo le eccezioni documentate qui e in `docs/development-guide.md` (patch post-JDL, vedi sezione RBAC/Entità).

## 1. Stack tecnologico

| Componente | Versione | Note |
|---|---|---|
| generator-jhipster | 9.1.0 | monorepository: true (`.yo-rc.json`) |
| Java | 21 | |
| Spring Boot | 4.0.6 (spring-boot-starter-parent) | |
| Node (per build frontend-maven-plugin) | v24.16.0 | pin in `pom.xml` |
| React | 19.2.6 | **vedi discrepanza pnpm-workspace §5** |
| TypeScript | 6.0.3 | |
| Liquibase | via `liquibase.version` proprietà Maven | migrazioni SQL/XML in `src/main/resources/config/liquibase` |
| Hibernate Envers | usato per audit trail (`@Audited`) | tabella `revinfo` (WIP, vedi §4) |
| Puck | `@measured/puck` ~0.20.0 | editor a blocchi lato client |
| `@penpot-ds/puck-components` | `workspace:*` | dipendenza interna al monorepo pnpm |
| Redux Toolkit | 2.12.0 | store globale frontend |
| Keycloak | 26.6.2 (immagine Docker) | OIDC provider dev |
| PostgreSQL | 18.4 (immagine Docker) | DB dev |

Build orchestrata da Maven (`./mvnw`) con `frontend-maven-plugin` che invoca npm/webpack per il bundle React, incapsulato nel jar Spring Boot finale (profilo `webapp`). Gli script npm (`package.json`) sono alias verso i target Maven equivalenti (`app:start`, `backend:*`, `webapp:*`, `java:jar`/`java:war`/`java:docker`).

## 2. Struttura backend (Java)

Package radice: `com.penpot.pagebuilder`.

```
domain/            entità JPA (Page, PageVersion) + enum + VO
  enumeration/      PageStatus, PageVersionStatus
  puck/             PuckPayload — record Java, VO tipizzato per il JSON del payload Puck (non usato dall'entity CRUD)
  audit/            RevisionInfo — interfaccia di dominio per i metadati Envers
repository/         PageRepository, PageVersionRepository (Spring Data JPA)
service/            PageService, PageVersionService, PageAuditQueryService
  dto/              DTO REST (vedi api-contracts-pagebuilder.md)
  mapper/            MapStruct mapper (PageMapper, PageVersionMapper, PageCreateMapper, EntityMapper)
  puck/              FieldClassifier, PuckPayloadValidator, PuckSanitizer, PuckPayloadPipeline, PayloadValidationException — pipeline di validazione/sanitizzazione del payload Puck lato server
web/rest/            controller REST (PageResource, PageVersionResource, PageAuditResource, AuthInfoResource, LogoutResource, AccountResource)
  errors/            ExceptionTranslator (RFC 7807 ProblemDetail), BadRequestAlertException, ErrorConstants, PuckPayloadExceptionHandler
security/            AuthoritiesConstants (ROLE_ADMIN, ROLE_EDITOR, ROLE_CLIENTE, ROLE_USER legacy, ROLE_ANONYMOUS), SecurityUtils, oauth2/ (AudienceValidator, CustomClaimConverter)
config/              SecurityConfiguration e altre config JHipster standard
```

### Entità di dominio

Documentate in dettaglio in `docs/data-models-pagebuilder.md`. Sintesi:

- **Page** (`page`): slug univoco, path, seoTitle/seoDescription/seoMetaJson (jsonb), status (`PageStatus`), optimistic locking, relazione 1:N con `PageVersion`, più una `@ElementCollection` `clienti` (Set<String>) su tabella `page_cliente` — **patch manuale post-JDL** (Story 2.12/AR-19): non generabile da JDL perché `cliente_id` è una stringa (sub/email Keycloak), non FK verso una entità utente locale.
- **PageVersion** (`page_version`): versionNumber, documentVersion, status (`PageVersionStatus`: DRAFT/PUBLISHED), payload (jsonb, JSON grezzo del contenuto Puck), optimistic locking, FK a `Page`, più `createdBy`/`createdDate`/`origin` — anch'essi patch manuale post-JDL (Story 2.11, colonne aggiunte via changelog dedicato perché rigenerare il JDL avrebbe distrutto le patch delle Story 2.4–2.10).

Entrambe le entità sono annotate `@Audited` (Hibernate Envers) per il tracciamento storico; la collection `clienti` è invece `@NotAudited`.

### Pipeline Puck payload (server-side)

`service/puck/` contiene una pipeline dedicata (net-new, non generata da JHipster) per validare/sanificare il payload JSON prima del salvataggio: `PuckPayloadValidator`, `PuckSanitizer`, `FieldClassifier`, orchestrati da `PuckPayloadPipeline`, con eccezione dedicata `PayloadValidationException` gestita da `PuckPayloadExceptionHandler`. Il VO `domain/puck/PuckPayload.java` (record Java immutabile) rappresenta la struttura tipizzata attesa (`schemaVersion`, `content`, `root`, `zones`) con la convenzione del "block-id stabile" (ogni blocco ha un id persistente indipendente dalla posizione, per abilitare diff/audit a livello di blocco).

## 3. Sicurezza / RBAC

Autenticazione: **OIDC via Keycloak** (Story 4.1). `SecurityConfiguration` configura:
- `oauth2Login` (SPA con redirect) + `oauth2ResourceServer` JWT (per API chiamate con bearer token) + `oauth2Client`.
- Regola globale: `/api/**` → `authenticated()`; `/api/admin/**` e `/management/**` (tranne health/info/prometheus) → `hasAuthority(ROLE_ADMIN)`; `/api/authenticate` e `/api/auth-info` → `permitAll()`.
- `@EnableMethodSecurity(securedEnabled = true)` abilita `@PreAuthorize` sui controller.

Ruoli applicativi (`AuthoritiesConstants`, documentati anche in `docs/rbac-matrix.md` referenziato dal codice):
- `ROLE_ADMIN` — accesso completo, incluso audit trail.
- `ROLE_EDITOR` — crea/salva/pubblica/rollback/archivia Page, ma **non** vede l'audit trail.
- `ROLE_CLIENTE` — può salvare solo modifiche content-only su Page a cui è esplicitamente assegnato (via `POST /api/pages/{id}/assign-cliente/{clienteId}`); niente publish/rollback/archive/create.
- `ROLE_USER` — mantenuto per compatibilità JHipster, non usato nel dominio page-builder.

**Gap RBAC rilevato (deep scan):** gli endpoint CRUD generici JHipster su `PageResource` (`PUT /api/pages/{id}`, `PATCH /api/pages/{id}`, `GET /api/pages`, `GET /api/pages/{id}`, `DELETE /api/pages/{id}`) e **tutti** gli endpoint di `PageVersionResource` (`POST/PUT/PATCH/GET/DELETE /api/page-versions/**`) **non hanno annotazioni `@PreAuthorize`**, a differenza degli endpoint di business custom (create/save-version/publish/rollback/archive/restore/assign-cliente) che applicano correttamente la matrice ADMIN/EDITOR/CLIENTE. Essendo comunque protetti dalla regola globale `/api/** → authenticated()`, l'effetto pratico è che **qualsiasi utente autenticato, incluso un CLIENTE**, può aggiornare o cancellare qualunque `Page`/`PageVersion` tramite gli endpoint CRUD generici, bypassando le restrizioni pensate per gli endpoint business (es. un CLIENTE non assegnato potrebbe `DELETE /api/pages/{id}` o `PUT /api/page-versions/{id}` su versioni non sue). Da verificare se questi endpoint generici sono effettivamente esposti/usati dal frontend o vanno rimossi/ristretti.

L'audit trail (Envers) è consultabile solo da ADMIN via `PageAuditResource` (`GET /api/pages/{id}/audit`, `GET /api/audit?username=`).

## 4. Persistenza / Liquibase

Changelog master: `src/main/resources/config/liquibase/master.xml`. Elenco changeset (in ordine):
1. `00000000000000_initial_schema.xml` — schema base JHipster.
2. `20260607144010_added_entity_Page.xml`, `20260607144011_added_entity_PageVersion.xml` (+ constraints) — generati da JDL.
3. `20260612000001_unique_published_per_page.xml` — indice univoco parziale Postgres (`CREATE UNIQUE INDEX ... WHERE status='PUBLISHED'`) per garantire al massimo una `PageVersion` PUBLISHED per Page.
4. `20260612000002_add_version_metadata.xml` — patch manuale post-JDL (Story 2.11, AR-19): aggiunge `created_by`, `created_date`, `origin` a `page_version` (colonne nullable per compatibilità con record pre-esistenti).
5. `20260613000001_add_page_cliente_table.xml` — patch manuale post-JDL (Story 2.12, AR-19): crea tabella join `page_cliente` (PK composita `page_id`+`cliente_id`, FK `ON DELETE CASCADE` verso `page`).
6. `20260621000001_add_envers_revinfo_table.xml` — **NON COMMITTATO (WIP)**, vedi §5.

**Nota architetturale (AR-19):** più changeset sono definiti come "post-JDL manual patch" esplicitamente perché rigenerare il JDL dopo le Story 2.4-2.12 distruggerebbe queste modifiche. Qualunque rigenerazione futura da JDL deve tenerne conto (vedi `docs/development-guide.md`, non riletto in questo scan).

### Tabella `revinfo` (Envers) — stato WIP

Il file `apps/pagebuilder/src/main/resources/config/liquibase/changelog/20260621000001_add_envers_revinfo_table.xml` è **untracked** (non ancora in git) e crea la tabella standard Envers `revinfo` (id autoincrement, timestamp bigint, username varchar(50)) necessaria per registrare le revisioni delle entità `@Audited` (Page, PageVersion). `master.xml` è già stato modificato (diff non committato) per includere questo changelog. Le entità `Page`/`PageVersion` sono già annotate `@Audited` nel codice, e `domain/audit/RevisionInfo.java` è un'interfaccia di dominio pensata per essere implementata da `config.audit.OidcRevisionEntity` (non trovata/verificata in questo scan — probabile prossimo passo del lavoro in corso) in modo che il service layer possa leggere i metadati di revisione senza dipendere dal package `config` (vincolo ArchUnit). **Stato: lavoro in corso, non commitato** — la feature di audit trail Envers non è operativa finché questo changeset e la relativa entity di revisione non sono committati e testati.

## 5. Frontend — struttura React

Codice generato JHipster (CRUD scaffolding, da non editare a mano):
- `src/main/webapp/app/entities/page/` — schermate CRUD generate per `Page`.
- `src/main/webapp/app/entities/page-version/` — schermate CRUD generate per `PageVersion`.
- `src/main/webapp/app/shared/auth/` — integrazione OIDC/Keycloak (login page, gestione sessione).

Codice applicativo custom (non generato), sotto `src/main/webapp/app/pagebuilder/`:
```
index.tsx                  entry-point del modulo pagebuilder
PagebuilderShell.tsx        shell/layout dell'app page builder
pagebuilder.css
api/pagebuilderApi.ts       client HTTP (axios) verso /api/pages, gestisce ProblemDetail (RFC 7807) → ProblemDetailError
pages/PageListPage.tsx      lista pagine (Story 4.2, done)
pages/PageEditorPage.tsx    editor pagina (Story 4.2, done)
puck/puckConfig.ts          configurazione componenti Puck (integrazione canvas — Story 4.3, ready-for-dev, non ancora implementata)
store/pagebuilderSlice.ts   Redux Toolkit slice: pages, currentPage, versionHistory, loading, error; thunk fetchPagesAsync/fetchPageAsync/createPageAsync/fetchVersionHistoryAsync/saveVersionAsync
```

Lo store gestisce lo stato applicativo del page builder in modo indipendente dagli slice generati da JHipster per le entity CRUD standard.

### Storia recente (da git log, non riverificata riga per riga)
- Story 4.1: login OIDC/Keycloak.
- Story 4.2 (done): `PageListPage`/`PageEditorPage` implementate con relativi test e routing.
- Story 4.3 (ready-for-dev, **non implementata**): integrazione canvas Puck con autosave locale della bozza — `puck/puckConfig.ts` esiste già come base ma l'integrazione canvas/autosave descritta nella storia non risulta ancora implementata in questo scan.

## 6. Discrepanza pnpm-workspace — RISCHIO da verificare

**Confermato via `git show ae6327a -- pnpm-workspace.yaml`:** il commit più recente (`ae6327a`, messaggio "chore: exclude pagebuilder app from pnpm workspace to prevent dependency conflicts") ha in realtà **fatto l'opposto di quanto dichiara**: ha **rimosso** la riga `- "!apps/pagebuilder"` dal root `pnpm-workspace.yaml`, che in precedenza escludeva esplicitamente `apps/pagebuilder` dal workspace pnpm. Il commento rimosso insieme alla riga spiegava chiaramente il motivo dell'esclusione:

> "pagebuilder è un'app poliglotta (Java+npm via frontend-maven-plugin): la sua toolchain frontend è gestita da npm/Maven (package-lock.json proprio), non da pnpm. Escluderla dal workspace evita che l'override `@types/react ^18` coli su un'app React 19 e che pnpm crei un'installazione concorrente."

**Stato attuale confermato** (contenuto corrente di `pnpm-workspace.yaml`, root del monorepo):
```yaml
packages:
  - "packages/*"
  - "apps/*"
allowBuilds:
  esbuild: true
  better-sqlite3: true
```
Nessuna riga di esclusione presente: **`apps/pagebuilder` è oggi incluso nel workspace pnpm**, in contraddizione con la documentazione precedente (che indicava l'app come esclusa e gestita solo via `./mvnw`/npm).

**Impatto potenziale:**
- Il root `pnpm.overrides` pinna `@types/react` a `^18` per tutto il workspace, mentre `apps/pagebuilder` dichiara `react@19.2.6`/`react-dom@19.2.6` in `dependencies`. Se pnpm ora risolve le dipendenze di `apps/pagebuilder` come parte del workspace, l'override potrebbe forzare `@types/react ^18` anche su un'app che usa React 19, causando conflitti di tipi o un'installazione dei tipi non coerente con il runtime.
- Rischio di doppia installazione/conflitto tra il `package-lock.json` proprio di pagebuilder (gestito da frontend-maven-plugin/npm) e l'installazione pnpm a livello di workspace.
- Il commit sembra una regressione accidentale (il messaggio del commit dice "exclude" ma il diff fa "include") — da verificare con l'autore prima di procedere con qualunque `pnpm install` a livello di root, perché potrebbe rompere silenziosamente la toolchain di pagebuilder o introdurre incoerenze di tipi React.

**Raccomandazione (solo segnalazione, non applicata in questo scan):** ripristinare `- "!apps/pagebuilder"` in `pnpm-workspace.yaml`, oppure — se l'inclusione è intenzionale — aggiornare l'override `@types/react` per escludere esplicitamente `apps/pagebuilder`.

## 7. Modifiche non committate (WIP) al momento dello scan

Da `git status` (branch `master`):
- `M apps/pagebuilder/src/main/resources/config/liquibase/master.xml` — aggiunge l'include del changelog Envers `revinfo` (vedi §4).
- `?? apps/pagebuilder/src/main/resources/config/liquibase/changelog/20260621000001_add_envers_revinfo_table.xml` — nuovo changelog, non tracciato.
- `M apps/pagebuilder/webpack/webpack.dev.js` e `M apps/pagebuilder/webpack/webpack.prod.js` — modifica minore e identica in entrambi i file: aggiunge `options: { postcssOptions: { plugins: [require('autoprefixer')] } }` al loader `postcss-loader` (in precedenza il loader non passava alcuna opzione, quindi autoprefixer probabilmente non veniva applicato). Basso rischio, non blocca la build.

Tutte queste modifiche risultano coerenti con un lavoro in corso sulla feature di audit trail Envers (Story presumibilmente 2.13-correlata o successiva) non ancora concluso/committato.

## 8. Dev stack (Docker)

`src/main/docker/` contiene i compose file JHipster standard:
- `postgresql.yml` — Postgres 18.4, utente `pagebuilder`, porta 5432 (bind localhost).
- `keycloak.yml` — Keycloak 26.6.2 in `start-dev --import-realm`, realm config in `realm-config/`, porte 9080/9443/9990 (bind localhost).
- `app.yml`, `services.yml`, `monitoring.yml`, `sonar.yml`, `jhipster-control-center.yml` — altri compose ausiliari standard JHipster (non riletti in dettaglio in questo scan).

Avvio locale tipico (da `package.json`): `docker:db:up` + `docker:keycloak:up` (o `services:up` aggregato), poi `develop` (backend `./mvnw` + `webapp:dev` in parallelo, porta dev server 9060 con proxy verso backend).

## 9. Note per rigenerazioni future JHipster

Diverse aree sono patch manuali post-JDL esplicitamente marcate nel codice come "AR-19 exception" (rigenerare distruggerebbe le patch): la collection `clienti` su `Page`, le colonne `createdBy/createdDate/origin` su `PageVersion`, la tabella `page_cliente`, e l'intera pipeline `service/puck/` + `domain/puck/PuckPayload`. Qualunque rigenerazione da JDL richiede di riapplicare manualmente queste modifiche o di aggiornare il JDL sorgente per includerle.
