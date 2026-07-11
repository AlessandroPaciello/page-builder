# Development Guide — penpot-design-system

## Prerequisiti

| Strumento | Versione |
|-----------|----------|
| Node.js | `>=20 <=24` (richiesto da Strapi) |
| pnpm | 10.33.0 (campo `packageManager`) |
| Docker | per Penpot e/o Postgres/Keycloak (opzionale in dev) |
| JDK 21 + Maven Wrapper (`./mvnw`) | solo per `apps/pagebuilder` (JHipster/Spring Boot) |

## Setup iniziale

```bash
pnpm install            # installa tutto il workspace
pnpm build              # turbo build di tutte le parti (rispetta il grafo dipendenze)
```

> `pnpm-workspace.yaml` abilita esplicitamente i build di `esbuild` e `better-sqlite3` (`allowBuilds`).
> **Nota:** `pnpm-workspace.yaml` include `apps/*` senza eccezioni — `apps/pagebuilder` **non è più escluso** dal
> workspace pnpm (l'esclusione `!apps/pagebuilder` è stata rimossa in un commit recente). `pagebuilder` resta però
> orchestrato tramite i propri script npm/Maven (`./mvnw`, `npm run ...`) via gli alias `dev:pagebuilder` /
> `build:pagebuilder` in root, non tramite le pipeline turbo (`build`/`test`/`lint`). Dettagli e implicazioni in
> [`architecture-pagebuilder.md`](./architecture-pagebuilder.md).

## Comandi root (Turborepo)

| Comando | Azione |
|---------|--------|
| `pnpm build` | `turbo run build` (tutte le parti) |
| `pnpm test` | `turbo run test` (di fatto solo `primitives`) |
| `pnpm lint` | `turbo run lint` |
| `pnpm storybook` | `turbo run storybook:dev` → Storybook su :6006 |
| `pnpm storybook:build` | build statica Storybook |
| `pnpm generate` | pipeline Penpot→codice (`scripts`) |
| `pnpm check:artifacts` | `turbo run check:artifacts` — verifica coerenza dei file `@generated` (`packages/scripts/src/check-artifacts.ts`) |
| `pnpm dev:strapi` | `turbo run develop --filter=@penpot-ds/strapi` |
| `pnpm build:strapi` | build admin Strapi |
| `pnpm dev:pagebuilder` | `pnpm --dir apps/pagebuilder run develop` — vedi sezione dedicata sotto |
| `pnpm build:pagebuilder` | `pnpm --dir apps/pagebuilder run java:jar:prod` — build JAR di produzione (Maven, profilo `prod`) |

## Workflow tipici

### Lavorare sulle primitives
```bash
pnpm --filter @penpot-ds/primitives test:watch   # TDD con vitest
pnpm --filter @penpot-ds/primitives build         # tsup
pnpm storybook                                     # vedere i componenti
```
Test stack: Vitest + Testing Library + `vitest-axe` (controlli a11y). Setup in `packages/primitives/src/test-setup.ts`.

### Aggiungere/aggiornare token
1. Modifica i moduli in `packages/tokens/src/*`.
2. `pnpm --filter @penpot-ds/tokens build`.
3. Rebuild dei consumer (`primitives`, `puck-components`) — `pnpm build` li ricostruisce in ordine.
> Ricorda: i nuovi token custom vanno registrati in `cn.ts` (tailwind-merge) e, se servono nell'editor, in `puck-tokens.ts`.

### Rigenerare codice da Penpot
```bash
# Avvia Penpot (vedi sotto) e assicurati che l'MCP sia raggiungibile
pnpm generate           # genera senza sovrascrivere i custom
pnpm --filter @penpot-ds/scripts generate:force   # sovrascrive i @generated
```

### Lavorare sull'editor Puck (Strapi)
```bash
pnpm dev:strapi         # admin su http://localhost:1337/admin → menu "Layout Builder"
```
Prima volta: copia `apps/strapi/.env.example` in `.env` e valorizza i secret.

### Avviare il pagebuilder (JHipster) con login OIDC

Stack dev = App (`:8080`) + Postgres + Keycloak (`:9080`, realm `jhipster`):
```bash
# in apps/pagebuilder/ — Postgres + Keycloak (start-dev --import-realm)
docker compose -f src/main/docker/postgresql.yml up -d
docker compose -f src/main/docker/keycloak.yml up -d   # attendi che importi il realm

# dalla root — avvia backend Spring (:8080) E frontend dev-server (webpack :9060 + BrowserSync :9000)
# in un unico comando concorrente (script "develop" = concurrently mvnw + webapp:dev)
pnpm dev:pagebuilder
```
**Nota:** `pnpm dev:pagebuilder` (alias root di `pnpm --dir apps/pagebuilder run develop`) avvia **già** backend e
frontend insieme via `concurrently --kill-others`; non serve lanciare separatamente `pnpm --dir apps/pagebuilder start`
(che duplicherebbe il webpack-dev-server sulla stessa porta `9060` e andrebbe in conflitto).

**⚠️ Per il login OIDC apri `http://localhost:9000` (dev-server), NON `:8080` diretto.** Il dev-server (BrowserSync
`:9000` → webpack `:9060` → backend `:8080`) compila a caldo il sorgente TS e proxa `/api`,`/oauth2`,`/login` al
backend; `:8080` da solo serve il bundle **già compilato** in `target/classes/static/` (stale). Le chiamate API con
bearer token (test `401`/`2xx`) vanno invece fatte direttamente a `:8080`.

**Fix login OIDC (story 1.2).** Il codice generato `app/shared/util/url-utils.ts` costruiva l'URL di login come
protocol-relative `//${hostname}:${port}/sign-in`; passato a React Router `navigate()` (in `home.tsx`/`account.tsx`)
il `//host` collassava in path → redirect malformato `http://host/host/sign-in` (host raddoppiato). Corretto a
`return '/sign-in'` (path interno, coerente con `private-route.tsx`). Unica modifica a codice generato di questa
story, strettamente necessaria a sbloccare il login (AR-19: deviazione minima + documentata).

**Nota (wiring profilo OIDC dev).** `issuer-uri`/`client-id`/`client-secret` vivono **solo** in
`application-secret-samples.yml`, non in `application.yml`/`application-dev.yml`. Non serve attivarlo a mano:
`pom.xml` ha `defaultGoal = spring-boot:run` e il profilo Maven `dev` è `activeByDefault`, quindi `pnpm dev:pagebuilder`
(plain `./mvnw`) imposta `spring.profiles.active=dev`; in `application.yml` il **profile group** `dev` include
`secret-samples` (+ `api-docs`) → i 3 valori OIDC sono caricati automaticamente. Niente edit ai file generati
(deferenza al codice generato, AR-19). Identità governata da Keycloak: nessuna anagrafica utenti locale.

**ADR leggero — mapping JDBC dei campi `@Lob String` (story 1.2).** Le entity `PageVersion.payload` e
`Page.seoMetaJson` portano `@JdbcTypeCode(SqlTypes.LONGVARCHAR)` sul campo `@Lob String`. Senza questa annotazione,
Hibernate 6 su Postgres mappa `@Lob String` su **Large Object (OID)**, mentre la colonna Liquibase è `text` (`clob`):
il disallineamento rompe la lettura del valore (ritorna l'OID, non il contenuto) → `GET /api/page-versions` non
restituirebbe il payload. `LONGVARCHAR` forza il mapping carattere (`text`), allineato alla colonna. **Deviazione
minima e necessaria** per sbloccare AC-2 della story 1.2. **NB (migrato a `jsonb` in Story 2.1):** il mapping è stato
sostituito con `@JdbcTypeCode(SqlTypes.JSON)` + colonna Liquibase `jsonb` (vedi ADR sotto).

**ADR leggero — migrazione `text`→`jsonb` e `@Version` optimistic locking (story 2.1).** Dopo ogni rigenerazione
`jhipster jdl pagebuilder.jdl` vanno applicate le seguenti patch manuali (si perdono alla prossima rigenerazione —
AR-19):

- **(a) Mappatura `jsonb` su `payload` e `seoMetaJson`.** JHipster genera `@Lob` senza `@JdbcTypeCode` per i campi
  `TextBlob`. Patch entity: sostituire `@Lob` → `@JdbcTypeCode(SqlTypes.JSON)` (import da
  `org.hibernate.annotations.JdbcTypeCode` e `org.hibernate.type.SqlTypes`). Il tipo Java resta `String` (JSON grezzo).
  File: `Page.java` (campo `seoMetaJson`), `PageVersion.java` (campo `payload`).
- **(b) `@Version` su `optimisticLock`.** JHipster genera il campo `optimisticLock Long` come plain field, senza
  `@jakarta.persistence.Version`. Patch entity: aggiungere `@jakarta.persistence.Version` sul campo `optimisticLock`
  in entrambe le entity. Questo abilita l'optimistic locking JPA: Hibernate incrementa il valore ad ogni update e
  include il campo nel WHERE della UPDATE; se il WHERE non matcha (versione stale), lancia `OptimisticLockException`
  → il controller traduce in `409 Conflict`.
- **(c) Changeset Liquibase `jsonb`.** Nei file `*_added_entity_Page.xml` e `*_added_entity_PageVersion.xml`:
  cambiare `type="${clobType}"` → `type="jsonb"` per le colonne `seo_meta_json` e `payload`. Nei blocchi `loadData`
  (faker): cambiare `type="clob"` → `type="string"` per le stesse colonne.
- **(d) Fake-data JSON valido.** Nei CSV `page.csv` e `page_version.csv`: sostituire i riferimenti
  `../fake-data/blob/hipster.txt` con JSON valido (es. `{"keywords":"test","robots":"noindex"}` per `seo_meta_json`,
  `{"content":{},"root":{},"zones":{}}` per `payload`). Il JSON deve essere quotato correttamente nel CSV (doppi
  apici interni raddoppiati: `"{""key"":""value""}"`).
- **(e) Asserzioni IT tolerant.** Nei test `PageResourceIT.java` e `PageVersionResourceIT.java`: le costanti
  `DEFAULT_SEO_META_JSON`, `UPDATED_SEO_META_JSON`, `DEFAULT_PAYLOAD`, `UPDATED_PAYLOAD` devono essere JSON valido
  in forma canonica (chiavi ordinate alfabeticamente, senza spazi superflui). Questo perché PostgreSQL `jsonb`
  normalizza i dati al salvataggio (rimuove spazi, riordina chiavi). Usando JSON canonico, il round-trip DB produce
  la stessa stringa e le asserzioni `jsonPath(...).value(...)` passano. Per confronti più robusti (chiavi non
  ordinate), usare `ObjectMapper.readTree()` + `JsonNode.equals()` invece di confronti stringa.
- **(f) Value object `PuckPayload`.** Net-new in `domain/puck/PuckPayload.java` — record Java immutabile con
  `schemaVersion`, `content`, `root`, `zones`. Usato dalle story successive per validazione/serializzazione.
  L'entity generata resta `String`/JSON grezzo.

**Perché `String` e non `JsonNode`/POJO per il campo entity:** il campo `payload` nell'entity generata resta `String`
(JSON grezzo) perché (a) è il tipo più semplice e vicino al comportamento attuale, (b) evita complicazioni con
MapStruct (che dovrebbe mappare `JsonNode`↔DTO), (c) il value object `PuckPayload` è usato dalle story successive
per validazione/serializzazione, non dall'entity CRUD generata. Lo spike 1.4 ha usato `String` con successo.

**ADR leggero — spike Envers su `jsonb` (story 1.4, PoC Fase-0 / de-risking D4).** Validazione empirica
di **Hibernate Envers sopra una colonna `jsonb`** (custom JDBC type) — il rischio non-lineare D4 — prima del
Go/No-Go (1.5). Cosa è stato fatto e perché:

- **Dipendenza** `org.hibernate.orm:hibernate-envers` aggiunta a `apps/pagebuilder/pom.xml` con **`<scope>test</scope>`**,
  versione **gestita dal BOM Spring Boot** (allineata a `hibernate-core`, non pinnata). Scope test = **zero impatto sul
  runtime di produzione** (nessuna `@Audited` in `src/main` → Envers non si attiva in prod). ⚠️ **Deferenza al generato
  (AR-19):** è una patch a file generato JHipster → **si perde alla rigenerazione**; in Epic 2 (Story 2.3) l'audit di
  produzione va reintrodotto preferibilmente **via JDL** (`@EnableAudit`/equivalente) per essere regen-safe.
- **Entità-probe isolata** `JsonbAuditProbe` (`src/test/java/.../poc/`): `@Audited` + `payload` su colonna `jsonb` via
  `@JdbcTypeCode(SqlTypes.JSON)`. **Mirror minimale** della futura `PageVersion`-jsonb, **non** la `PageVersion` di
  produzione (che resta `@JdbcTypeCode(LONGVARCHAR)`/`text`, intoccata — la migrazione a `jsonb` è **Story 2.1**).
- **Schema senza changeset Liquibase a mano** (rispetta "schema solo via JDL→Liquibase"): l'IT spike
  `JsonbEnversProbeIT` usa `@TestPropertySource` con `spring.liquibase.enabled=false` (onorato da
  `LiquibaseConfiguration.setShouldRun(isEnabled())`) + `spring.jpa.hibernate.ddl-auto=create-drop`, così Hibernate+Envers
  creano probe-table + `jsonb_audit_probe_aud` + `revinfo` su **Postgres reale** (Testcontainers — `jsonb` non esiste su DB
  embedded). Avendo property distinte l'IT ottiene un **context Spring dedicato** → gli altri IT
  (`PageVersionResourceIT`, …) restano su Liquibase e verdi.
- **Esito validazione (AC-1):** Envers registra `ADD` sull'insert e `MOD` sull'update di un payload **Puck reale** (la
  fixture round-trip della 1.3, copiata in `src/test/resources/poc/`), **senza errori di custom type né di dirty-checking**;
  il `jsonb` storicizzato è **ricostruibile integro** da `AuditReader` (deep-equal di `{content,root,zones}`). _(Risultato
  effettivo della suite annotato nelle Completion Notes della story 1.4.)_

**Strategia di audit adottata (D4) — il "cosa" della validazione.** Lo storico utile delle pagine vive nella relazione
`Page 1‑a‑molti PageVersion` (**ogni save = nuova `PageVersion`**); Envers copre i **metadati immutabili** (chi/quando/
transizioni), **non** diffa il blob `jsonb` ad ogni save. Razionale vs. l'alternativa "diff del blob": l'IT misura che il
blob `jsonb` viene **copiato per intero** in una riga `_aud` **ad ogni revisione** (N revisioni → N copie del payload →
crescita lineare nella dimensione del blob). Auditare il blob in produzione **gonfierebbe** le `_aud` duplicando l'intero
payload ad ogni save. **Mitigazione raccomandata per Story 2.3:** `@NotAudited` sul campo blob (o audit dei soli metadati),
storico dei contenuti via `PageVersion`. Vedi `_bmad-output/implementation-artifacts/1-4-validare-hibernate-envers-su-jsonb.md`.

**ADR leggero — RBAC scaffolding deny-by-default (story 2.2).** Dopo ogni rigenerazione `jhipster jdl pagebuilder.jdl`
vanno applicate le seguenti patch manuali (si perdono alla prossima rigenerazione — AR-19):

- **(a) Ruoli di dominio in `AuthoritiesConstants.java`.** JHipster genera solo `ROLE_ADMIN`, `ROLE_USER`, `ROLE_ANONYMOUS`.
  Patch: aggiungere `ROLE_EDITOR` e `ROLE_CLIENTE`. `ROLE_USER` resta per compatibilità JHipster ma **non è usato** nel
  dominio page-builder. La matrice ruolo→operazione è documentata in `docs/rbac-matrix.md`.
- **(b) Claim mapping Keycloak→Spring in `SecurityUtils.java`.** Il metodo `getRolesFromClaims()` è stato esteso per leggere
  anche `realm_access.roles` (claim standard Keycloak) oltre a `groups` e `roles`. Ordine di fallback:
  `groups` → `realm_access.roles` → `roles` → `https://www.jhipster.tech/roles`.
  **Guardia instanceof:** tutti i cast sono protetti da `instanceof` pattern matching per evitare `ClassCastException`
  con JWT malformed (es. claim di tipo inatteso).
- **(c) `@PreAuthorize` sui service generati.** Aggiunta annotazione a livello di classe su `PageService` e
  `PageVersionService`:
  ```java
  @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('ROLE_EDITOR')")
  ```
  Questo blocca `ROLE_CLIENTE` e `ROLE_USER` da tutte le operazioni di dominio (deny-by-default scaffold).
  La granularità fine (es. Cliente può scrivere solo `dataJson`) è deferred a Story 2.12.
  **⚠️ Self-invocation caveat:** Spring AOP proxy intercetta solo chiamate esterne. Se un metodo del service chiama
  `this.altroMetodo()`, l'autorizzazione viene saltata. Allo stato attuale nessun metodo interno chiama altri metodi
  dello stesso service, quindi il rischio è teorico. Se in futuro si aggiungono chiamate interne, spostare
  `@PreAuthorize` a livello di metodo o usare `AopContext.currentProxy()`.
- **(d) Matrice RBAC documentata.** `docs/rbac-matrix.md` contiene la tabella ruolo→operazione (scaffolding).

**Perché `@PreAuthorize` sui service e non su `SecurityConfiguration.filterChain()`:** il deny-by-default di dominio
richiede granularità a livello di operazione (es. Cliente può leggere ma non scrivere). `authorizeHttpRequests` è troppo
grossolano (path-based). `@PreAuthorize` permette enforcement method-level (D7) e può essere affinato nelle story successive.

**Configurazione Keycloak (ambiente dev, non codice).** I ruoli `ROLE_EDITOR` e `ROLE_CLIENTE` vanno aggiunti manualmente
nel realm `jhipster` di Keycloak:
1. Admin console Keycloak (`:9080`) → Realm `jhipster` → Roles → Add role: `ROLE_EDITOR`, `ROLE_CLIENTE`
2. Assign ruoli agli utenti di test (es. `admin` → `ROLE_ADMIN`, `editor` → `ROLE_EDITOR`, `cliente` → `ROLE_CLIENTE`)
3. Verificare che i ruoli appaiano nel JWT (`realm_access.roles` o `groups`).

**ADR leggero — Audit Envers di produzione (story 2.3).** Infrastruttura trasversale di audit-recording automatico
su `Page`/`PageVersion` tramite Hibernate Envers. Dopo questa story, **nessun agente deve scrivere codice di audit a mano**
nelle story successive (2.4–2.13): l'audit è un effetto collaterale trasparente di ogni mutazione sulle entità `@Audited`.

- **(a) Dipendenza Envers → compile scope.** La dipendenza `org.hibernate.orm:hibernate-envers` (già presente in scope
  `test` dalla PoC 1.4) è stata promossa a **compile scope** (rimosso `<scope>test</scope>`). Versione gestita dal BOM
  Spring Boot 4.0.x.
- **(b) `@Audited` su entità generate.** Aggiunta annotazione `@Audited` (`org.hibernate.envers.Audited`) su
  `Page.java` e `PageVersion.java`. **⚠️ Si perde alla rigenerazione JHipster** — patch post-regen documentata come ADR.
- **(c) `RevisionListener` custom per identità OIDC.** Creato `OidcRevisionListener.java` che cattura
  `SecurityUtils.getCurrentUserLogin()` e popola il campo `username` in `revinfo`. Il `SecurityContext` è disponibile
  nel thread di persistenza (propagato dal filtro OIDC).
- **(d) `OidcRevisionEntity` custom.** Entità JPA standalone (non sottoclasse di `DefaultRevisionEntity`, che è `final` in Hibernate 7.x) con campi `id`, `timestamp`, `username` (length 50),
  annotata con `@RevisionEntity(OidcRevisionListener.class)` e `@Table(name = "revinfo")`.
- **(e) Tabelle `_aud` non esposte come API.** Nessun repository o endpoint REST per `page_aud`, `page_version_aud`,
  `revinfo`. Le tabelle sono gestite esclusivamente da Envers a livello di persistenza.
- **(f) Envers su `jsonb` — nessuna regressione.** `JsonbEnversProbeIT` (PoC 1.4) resta verde dopo l'aggiunta di
  `@Audited`. Il custom type `JsonbType` implementa correttamente `isDirty()`/`deepCopy()` per evitare revisioni fantasma.
- **(g) Strategia: metadati auditati, blob no.** Envers registra ogni mutazione su `Page`/`PageVersion` inclusi i
  metadati, ma il blob `jsonb` viene copiato per intero ad ogni revisione (come validato in 1.4). Lo storico dei
  contenuti vive nella relazione `Page→PageVersion`, non nel diffare il blob.

**Tabelle generate da Envers:**
| Tabella | Contenuto |
|---------|-----------|
| `page_aud` | Audit trail di Page (una riga per mutazione) |
| `page_version_aud` | Audit trail di PageVersion |
| `revinfo` | Metadati delle revisioni (timestamp, autore/username) |

**Configurazione Envers (default, nessuna property custom necessaria):**
```yaml
spring:
  jpa:
    properties:
      org.hibernate.envers:
        audit_table_suffix: _aud
        revision_field_name: REV
        revision_type_field_name: REVTYPE
```

## Penpot in locale (Docker)

`docker-compose.yaml` avvia lo stack Penpot completo:
```bash
docker compose up -d
# Penpot UI: http://localhost:9001
# Mailcatcher: http://localhost:1080
# Penpot Postgres: localhost:5432 · Strapi Postgres: localhost:5433
```
Servizi: `penpot-frontend`, `penpot-backend`, `penpot-exporter`, `penpot-postgres` (pg15), `penpot-valkey`, `penpot-mailcatch`, più `strapi-postgres` (pg16).

## Convenzioni di codice

- **TypeScript everywhere**, ESM, Prettier (`.prettierrc`).
- **Primitives per dominio** + co-location story/test.
- File generati: header `// @generated — do not edit manually` → non modificare a mano.
- `cn()` per comporre classi Tailwind con i token custom.
- Schemi **Zod** per i blocchi Puck; `fields` derivati dai token via `puck-tokens.ts`.

## Note / vincoli

- Non importare `puck-tokens.ts` in `tailwind.config.ts` (jiti CJS non carica i token ESM-only).
- React: Strapi usa 18, le librerie 19 — le primitives sono peer `^18 || ^19`.
