# PoC Fase-0: Report Go/No-Go

**Progetto:** penpot-design-system  
**Data:** 2026-06-09  
**Owner:** Alessandro  
**Gate:** FR-17 — PoC Fase-0 (passo 5 di 5)  
**Status:** ✅ Definitivo — tutti e 4 i gate superati, suite completa verde (2026-06-10)

---

## Obiettivo della PoC

La PoC Fase-0 valida empiricamente che lo stack selezionato (JHipster 9.1.x / Spring Boot 4.0.x / Java 21 / React 19 / PostgreSQL / Keycloak OIDC) regge i requisiti minimi del progetto di migrazione prima di impegnare le risorse necessarie all'Epic 2 e successive. Il gate verifica quattro punti critici: (1) generabilità dell'app da JDL, (2) login SSO con Keycloak OIDC, (3) ciclo round-trip del payload Puck reale, (4) compatibilità di Hibernate Envers con la colonna `jsonb` (rischio architetturale D4). Il superamento abilita l'avvio dell'Epic 2 con parametri tecnici bloccati.

---

## Esiti delle 4 PoC

| # | Story | Titolo | Esito | Evidenza principale |
|---|-------|--------|-------|---------------------|
| 1.1 | App da JDL | Generare app monolite da `pagebuilder.jdl` | ✅ | JHipster 9.1.0 / SB 4.0.6 / Java 21 / React 19.2.6; schema Liquibase verde; entità `Page`/`PageVersion` generate |
| 1.2 | Login OIDC | Login Keycloak end-to-end | ✅ | Sessione con claim Keycloak; `401` deny-by-default; fix `getLoginUrl()` + mapping JDBC `LONGVARCHAR` documentati come ADR |
| 1.3 | Round-trip Puck | Ciclo `POST`/`GET` payload Puck reale | ✅ | `POST` → `201` (`PageVersion` id=1002), `GET` → `200`, deep-equal lossless `{content,root,zones}`; render Storybook OK |
| 1.4 | Envers su jsonb | Validazione Hibernate Envers su colonna `jsonb` | ✅ | `JsonbEnversProbeIT` BUILD SUCCESS (20.25s, Postgres reale); rev. ADD+MOD senza eccezioni; AuditReader deep-equal ✅; 2 righe `_aud`; blob duplicato per intero → strategia D4 confermata |

### Dettaglio Story 1.1: App da JDL ✅

**Esito:** App generata con successo da `pagebuilder.jdl`, avviata e schema Liquibase applicato.

- **Stack confermato:** JHipster 9.1.0, Spring Boot 4.0.6, Java 21, React 19.2.6, Maven, PostgreSQL
- **Entità generate:** `Page` (slug, stato, SEO) + `PageVersion` (payload, versionNumber, stato draft/published)
- **Build:** `./mvnw` verde; client React avviato; `apps/pagebuilder/` affianca `apps/strapi` senza interferenze
- **Note di drift (ADR):** `package.json` e script `develop` modificati manualmente per integrazione monorepo — patch su file generato JHipster, documentata in `docs/development-guide.md`
- **Fonte:** `_bmad-output/implementation-artifacts/1-1-generare-app-monolite-da-pagebuilder-jdl.md`

### Dettaglio Story 1.2: Login OIDC ✅

**Esito:** Login Keycloak end-to-end riuscito, `401` deny-by-default verificato.

- **Stack auth:** Keycloak 26.6.2, realm `jhipster`, client `web_app` (audience corretta)
- **Login OIDC:** flusso completo verso `http://localhost:9080`, sessione autenticata con claim/ruoli da Keycloak
- **Deny-by-default:** endpoint protetto restituisce `401` senza token valido
- **Fix applicati:**
  - `getLoginUrl()` in `url-utils.ts` (fix redirect → `/sign-in`; perduto alla rigenerazione → ADR in `development-guide.md`)
  - `@JdbcTypeCode(SqlTypes.LONGVARCHAR)` su `payload`/`seoMetaJson` (fix mapping Hibernate 6; evita promozione OID su PostgreSQL)
- **Fonte:** `_bmad-output/implementation-artifacts/1-2-login-keycloak-oidc-end-to-end.md`

### Dettaglio Story 1.3: Round-trip Puck ✅

**Esito:** Ciclo `POST`/`GET` lossless con payload Puck reale verificato end-to-end.

- **Payload testato:** fixture reale `{content, root, zones}` con componenti `Hero`, `Section`+slot, `Typography`×2, `Button` (da `packages/puck-components/src/__poc__/puck-payload.fixture.json`)
- **POST:** `201 Created` con `PageVersion` id=1002 (sotto JWT bearer da Keycloak)
- **GET:** `200 OK`, deep-equal del payload — nessuna perdita o trasformazione del JSON
- **401 deny-by-default:** request senza token rifiutata
- **Render Storybook:** layout Puck renderizzato correttamente in Storybook (`@penpot-ds/storybook`)
- **Precondizione confermata:** `@JdbcTypeCode(SqlTypes.LONGVARCHAR)` è la base funzionante; migrazione a `jsonb` è Story 2.1
- **Fonte:** `_bmad-output/implementation-artifacts/1-3-ciclo-post-get-payload-puck-reale.md`

### Dettaglio Story 1.4: Envers su jsonb ✅

**Esito: `✅ valida`** — `JsonbEnversProbeIT` BUILD SUCCESS (Tests run: 1, Failures: 0, Errors: 0, Time elapsed: 20.25s), eseguito su PostgreSQL reale via Testcontainers.

| Campo | Valore |
|-------|--------|
| **Esito** | ✅ `valida` — nessuna eccezione di custom type, dirty-checking o Envers |
| Versione `hibernate-envers` risolta | 6.6.x, gestita dal BOM Spring Boot 4.0.6 (allineata a `hibernate-core`) |
| Revisioni `ADD`+`MOD` senza eccezioni | ✅ — 2 revisioni registrate (ADD su insert, MOD su update); nessun `MappingException`/`AuditException`/`PropertyValueException` |
| Read-back `AuditReader` deep-equal | ✅ — rev.1: payload originale `{content,root,zones}` integro; rev.2: prop modificata (`headingLine1=MODIFICATO 1.4`) correttamente storicizzata; `AuditReader.find(class, id, revN)` ricostruisce lo stato alla singola revisione |
| Crescita tabella `_aud` | 2 righe in `jsonb_audit_probe_aud` dopo 2 revisioni — **il blob `jsonb` è copiato per intero ad ogni revisione** (crescita lineare, evidenza AC-2) |
| Altri IT rimasti verdi | ✅ `./mvnw test` BUILD SUCCESS (37 test, 0 fallimenti, 20s) — Task 6 Story 1.4 completato (2026-06-10) |

**Strategia D4 confermata:** il blob `jsonb` viene duplicato interamente in `_aud` ad ogni revisione Envers → crescita lineare delle tabelle audit. Decisione architetturale confermata: in produzione (Story 2.3) si usa `@NotAudited` sul campo blob + storico contenuti via `PageVersion`; Envers copre i soli metadati immutabili (`Page`/`PageVersion`). Questo è esattamente il piano D4 già previsto dall'architettura — nessun blocker, nessuna sorpresa.

---

## Raccomandazione linea di versione

**Linea raccomandata:** JHipster 9.1.x / Spring Boot 4.0.x / Java 21

### Motivazione

**1. La PoC gira interamente su questa linea, senza blocanti noti:**
- Story 1.1: app generata e avviata ✅
- Story 1.2: login OIDC + `401` deny-by-default ✅
- Story 1.3: round-trip payload Puck reale lossless ✅
- Story 1.4: `JsonbEnversProbeIT` ✅ BUILD SUCCESS su Postgres reale (Testcontainers) — rev. ADD+MOD senza eccezioni, AuditReader deep-equal ✅, blob `jsonb` duplicato per intero in `_aud` (2 righe/2 revisioni) → strategia `@NotAudited` sul blob confermata (D4)

**2. Spring Boot 3.x va in EOL OSS il 2026-06-30:**
- La minor più recente di Spring Boot 3.x (3.5) perde il supporto di sicurezza open-source entro la fine di giugno 2026
- Per un progetto che entra in produzione dopo questa data, adottare la 3.x significa ereditare immediatamente debito di patch di sicurezza non più rilasciate dalla community
- La linea 4.0.x è quella con supporto OSS attivo in avanti
- La premessa del "fallback prudente a 3.x LTS" nel PRD originale era basata su un'assunzione falsa: non esiste un "LTS" in Spring Boot (fonte: architettura.md §Starter-Template-Evaluation)

**3. Nessun blocker tecnico identificato:**
- I fix applicati in 1.2 (mapping JDBC, redirect login) sono patch a file generati, non limitazioni dello stack; sono documentati come ADR e il pattern di gestione è consolidato
- La dipendenza `hibernate-envers` (test scope ora, runtime in Story 2.3) è gestita dal BOM SB 4.0.6 senza conflitti

**Alternativa considerata e scartata:** JHipster 8.x / Spring Boot 3.x — scartata per EOL OSS imminente (2026-06-30) e assenza di vantaggi tecnici per questo progetto pre-produzione.

---

## Decisione Go/No-Go

| Campo | Valore |
|-------|--------|
| **Decisione** | **Go definitivo** |
| **Data** | 2026-06-10 |
| **Owner** | Alessandro |
| **Rationale** | La PoC ha dimostrato il percorso end-to-end minimo su tutti e 4 i gate: app da JDL avviata, login OIDC funzionante, round-trip payload Puck lossless, Envers su `jsonb` validato senza eccezioni. La linea JHipster 9.1.x / Spring Boot 4.0.x è l'unica con supporto OSS in avanti (3.x in EOL OSS 2026-06-30). I rischi residui sono documentati e gestibili nell'Epic 2 — inclusi sanitizzazione XSS (R6, Story 2.5) e budget di latenza (R7, Story 2.10). |

---

## Parametri confermati (baseline per Epic 2)

_Validi al superamento del gate. Da bloccare come precondizioni per tutte le story dell'Epic 2._

| Parametro | Valore confermato | Fonte |
|-----------|-------------------|-------|
| Starter / generatore | JHipster 9.1.0 | Story 1.1 |
| Spring Boot | 4.0.6 | Story 1.1 |
| Java | 21 | Story 1.1 |
| React | 19.2.6 | Story 1.1 |
| Build tool | Maven (`./mvnw`) | Story 1.1 |
| Auth identity | Keycloak 26.6.2, realm `jhipster` | Story 1.2 |
| Auth protocol | OIDC resource-server (JWT), deny-by-default | Story 1.2 |
| DB runtime | PostgreSQL 18.4 (Docker `postgres:18.4`) | Story 1.1 |
| DB test | Testcontainers `postgres:18.4` (con `.withReuse(true)`) | Story 1.3/1.4 |
| Storage payload (target) | `jsonb`, custom Hibernate type `@JdbcTypeCode(SqlTypes.JSON)` — da applicare in Story 2.1 | D2 |
| Storage payload (attuale PoC) | `LONGVARCHAR` / colonna `text` — precondizione round-trip; non toccare fino a Story 2.1 | Story 1.3 |
| Strategia audit | Envers su metadati; `@NotAudited` sul blob jsonb; storico contenuti via `PageVersion` | D4 |
| Schema DB | Solo via JDL → Liquibase (nessun DDL / ALTER a mano) | NFR-11 |
| Contratto payload | `{content, root, zones}` accettato 1:1 (nessuna riscrittura della forma Puck) | Story 1.3 |
| Pattern patch generato | ADR leggero in `docs/development-guide.md` + File List della story | Story 1.1/1.2 |

---

## Rischi residui

_Rischi noti al termine della PoC Fase-0. Da gestire nelle story indicate._

| # | Rischio | Probabilità | Impatto | Mitigazione | Owner | Destinazione |
|---|---------|-------------|---------|-------------|-------|--------------|
| R1 | Migrazione `text`→`jsonb` di `payload`/`seoMetaJson` in `PageVersion`: fake-data IT non-JSON, IT `*ResourceIT` che usano stringhe esatte rotte dalla normalizzazione `jsonb` (spazi, ordine chiavi) | Media | Medio | Rigenerare entità via JDL; sostituire fake-data con JSON valido; rendere asserzioni IT whitespace/key-order tolerant | Alessandro | Story 2.1 |
| R2 | Blob `jsonb` duplicato per intero in `*_aud` ad ogni revisione Envers (crescita lineare delle tabelle audit) — **comportamento noto e accettato**, confermato dal PoC | Certa (comportamento Envers by-design) | Basso | `@NotAudited` sul campo blob in produzione; storico contenuti via `PageVersion` già pianificato (D4, Story 2.3) | Alessandro | Story 2.3 |
| R3 | Fix `getLoginUrl()` in `url-utils.ts` perso alla prossima rigenerazione JHipster (file generato) | Media | Basso | ADR documentato; reintrodurre tramite hook di post-generazione o opzione JDL equivalente | Alessandro | Story 2.2 |
| R4 | Fix `@JdbcTypeCode(SqlTypes.LONGVARCHAR)` su `Page.java`/`PageVersion.java` perso alla rigenerazione | Media | Medio | ADR documentato; il mapping corretto sarà `SqlTypes.JSON` in Story 2.1 (riscrittura regen-safe via JDL) | Alessandro | Story 2.1 |
| R5 | NPE in `login-redirect.tsx` se `/sign-in` è raggiunto direttamente (bookmark/refresh: `state` è `null`) | Media (in produzione bookmark/refresh sono scenari standard) | Basso | Fix `state?.from?.pathname ?? '/'` rimandato a Story 4.1 (app shell React) | Alessandro | Story 4.1 |
| R6 | Sanitizzazione XSS payload Puck non implementata nel PoC | Certa (non era in scope) | Alto (NFR-2) | Implementare dalla prima story dell'Epic 2 che introduce salvataggio (`onPublish`): Story 2.5 pipeline sicurezza payload | Alessandro | Story 2.5 |
| R7 | Budget latenza render (`p95 < 300ms`) e save (`p95 < 800ms`) non misurati | Certa (non era in scope) | Medio | Misurare con Caffeine cache su payload reale durante Epic 2; NFR-6/NFR-7 da confermare | Alessandro | Story 2.10 |
| R8 | Deploy su subpath (basename/context-path): `/oauth2/authorization/oidc` assoluto in `login-redirect.tsx` ignora il basename | Bassa (PoC servito da root) | Basso | Rivedere se/quando si pianifica deploy non-root | Alessandro | Story 4.1 |
| R9 | Promozione scope `hibernate-envers` da `test` a `runtime` in Story 2.3: auto-attivazione Envers su classpath di produzione può avere side-effect inattesi (startup, scanning entità) | Media | Medio | Verificare startup e scanning `@Audited` in Story 2.3; reintrodurre preferibilmente via JDL (opzione `@EnableAudit`) | Alessandro | Story 2.3 |

---

## Riferimenti

| Documento | Path |
|-----------|------|
| Story 1.1 | `_bmad-output/implementation-artifacts/1-1-generare-app-monolite-da-pagebuilder-jdl.md` |
| Story 1.2 | `_bmad-output/implementation-artifacts/1-2-login-keycloak-oidc-end-to-end.md` |
| Story 1.3 | `_bmad-output/implementation-artifacts/1-3-ciclo-post-get-payload-puck-reale.md` |
| Story 1.4 | `_bmad-output/implementation-artifacts/1-4-validare-hibernate-envers-su-jsonb.md` |
| Architecture | `_bmad-output/planning-artifacts/architecture.md` — D1..D4, D6, D7, OQ-6, OQ-7 |
| Epic breakdown | `_bmad-output/planning-artifacts/epics.md` — Epic 1, FR-17 |
| Deferred work | `_bmad-output/implementation-artifacts/deferred-work.md` |
| Development Guide (ADR) | `docs/development-guide.md` |
| Project context (regole AI) | `_bmad-output/project-context.md` |
