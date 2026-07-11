# Data Models — apps/pagebuilder

> Documento generato da deep scan (BMad document-project) il 2026-07-10, basato sulla lettura diretta delle entità JPA (`domain/`) e dei changelog Liquibase (`src/main/resources/config/liquibase/`).

## Panoramica entità

Il dominio page-builder ha **2 entità JPA persistite** (Page, PageVersion), entrambe `@Audited` (Hibernate Envers), più 1 tabella di join manuale (`page_cliente`, non backed da un'entità JPA dedicata ma da una `@ElementCollection` su `Page`) e (WIP, non committata) la tabella tecnica Envers `revinfo`.

## 1. `Page` (tabella `page`)

File: `apps/pagebuilder/src/main/java/com/penpot/pagebuilder/domain/Page.java`

| Campo | Tipo colonna | Vincoli | Note |
|---|---|---|---|
| `id` | bigint (sequence) | PK | |
| `slug` | varchar | `NOT NULL`, `UNIQUE` | identificatore pubblico della pagina |
| `path` | varchar | nullable | |
| `seoTitle` | varchar | nullable | |
| `seoDescription` | varchar | nullable | |
| `seoMetaJson` | jsonb (`@JdbcTypeCode(SqlTypes.JSON)`) | nullable | meta SEO libere in JSON |
| `status` | enum stringa (`PageStatus`) | `NOT NULL` | DRAFT / PUBLISHED / ARCHIVED |
| `optimisticLock` | bigint (`@jakarta.persistence.Version`) | | optimistic locking JPA |
| `versionses` | `@OneToMany` (mappedBy `page`, lazy) | | relazione 1:N verso `PageVersion` (nome campo "versionses" — refuso di pluralizzazione lasciato dal generatore JHipster/JDL, non corretto) |
| `clienti` | `@ElementCollection` (lazy) su tabella `page_cliente`, colonna `cliente_id` | `@NotAudited` | **patch manuale post-JDL** (Story 2.12/AR-19): Set di identificatori Keycloak (sub/email) dei clienti assegnati alla pagina. Non è una FK verso una entità utente locale perché gli utenti sono gestiti da Keycloak, non dal DB applicativo. |

Annotazioni di classe: `@Entity`, `@Audited` (Envers), `@Table(name="page")`, `@Cache(usage=READ_WRITE)` (secondo livello Hibernate).

### Enum `PageStatus`
`DRAFT`, `PUBLISHED`, `ARCHIVED`.

## 2. `PageVersion` (tabella `page_version`)

File: `apps/pagebuilder/src/main/java/com/penpot/pagebuilder/domain/PageVersion.java`

| Campo | Tipo colonna | Vincoli | Note |
|---|---|---|---|
| `id` | bigint (sequence) | PK | |
| `versionNumber` | integer | `NOT NULL` | numero progressivo di versione per Page |
| `documentVersion` | varchar | `NOT NULL` | |
| `status` | enum stringa (`PageVersionStatus`) | `NOT NULL` | DRAFT / PUBLISHED |
| `payload` | jsonb (`@JdbcTypeCode(SqlTypes.JSON)`) | nullable | JSON grezzo del contenuto Puck (struttura tipizzata lato dominio: `domain/puck/PuckPayload`, non collegata direttamente all'entity JPA) |
| `optimisticLock` | bigint (`@jakarta.persistence.Version`) | | |
| `page` | `@ManyToOne` (lazy) | FK `page_id` | |
| `createdBy` | varchar(50) | nullable | **patch manuale post-JDL** (Story 2.11) |
| `createdDate` | timestamp (`Instant`) | nullable | **patch manuale post-JDL** (Story 2.11) |
| `origin` | varchar(50) | nullable | **patch manuale post-JDL** (Story 2.11) — presumibilmente traccia l'origine del salvataggio (es. autosave/manuale) |

Annotazioni di classe: `@Entity`, `@Audited` (Envers), `@Table(name="page_version")`, `@Cache(usage=READ_WRITE)`.

### Enum `PageVersionStatus`
`DRAFT`, `PUBLISHED`.

### Vincolo invariante: "al più una PUBLISHED per Page"
Applicato **a livello database**, non solo applicativo, tramite indice univoco parziale Postgres (changelog `20260612000001_unique_published_per_page.xml`):
```sql
CREATE UNIQUE INDEX uq_page_version_published
ON page_version(page_id)
WHERE status = 'PUBLISHED';
```
Permette multiple righe DRAFT per la stessa Page, ma vincola a una sola riga PUBLISHED.

## 3. `page_cliente` (tabella di join, no entity JPA dedicata)

Definita in `20260613000001_add_page_cliente_table.xml` (Story 2.12, patch manuale post-JDL):

| Colonna | Tipo | Vincoli |
|---|---|---|
| `page_id` | bigint | parte di PK composita, FK → `page.id` `ON DELETE CASCADE` |
| `cliente_id` | varchar(255) | parte di PK composita |

Mappata lato JPA come `@ElementCollection` sul campo `clienti` di `Page` (non è un'entità JPA a sé stante, non ha repository proprio).

## 4. Value Object `PuckPayload` (non persistito direttamente)

File: `domain/puck/PuckPayload.java` — record Java immutabile, rappresentazione tipizzata del JSON salvato in `PageVersion.payload`:
```java
record PuckPayload(String schemaVersion, Object content, Object root, Object zones)
```
- `schemaVersion` di default: `"1.0"`.
- Convenzione: ogni blocco in `content`/`zones` ha un `id` stabile (UUID-like) indipendente dalla posizione, per abilitare audit/diff/merge a livello di blocco tra versioni.
- Non collegato via ORM: l'entity `PageVersion` mantiene `payload` come `String` JSON grezzo; la validazione/serializzazione tipizzata è delegata alla pipeline `service/puck/*` (Jackson).

## 5. Audit trail — Hibernate Envers

Entità `Page` e `PageVersion` sono `@Audited`; il campo `Page.clienti` è esplicitamente `@NotAudited`.

`domain/audit/RevisionInfo.java` è un'interfaccia di dominio (`getId()`, `getTimestamp()`, `getUsername()`) pensata per essere implementata da `config.audit.OidcRevisionEntity` (non trovata/verificata in questo scan) — disaccoppia il service layer dal package `config` per un vincolo ArchUnit.

### Tabella tecnica `revinfo` — WIP, NON COMMITTATA

Changelog `20260621000001_add_envers_revinfo_table.xml` (untracked in git al momento dello scan):
```sql
CREATE TABLE revinfo (
  id        integer PRIMARY KEY AUTOINCREMENT,
  timestamp bigint NOT NULL,
  username  varchar(50)
);
```
`master.xml` include già questo changelog (modifica anch'essa non committata). Senza questo changeset applicato, le entità `@Audited` non hanno una tabella di revisione funzionante lato DB — l'audit trail (`PageAuditResource`) rischia quindi di non essere operativo sull'ambiente corrente finché questa modifica non viene committata e la migrazione eseguita.

## 6. Changelog Liquibase — riepilogo cronologico

| File | Autore | Contenuto |
|---|---|---|
| `00000000000000_initial_schema.xml` | JHipster | schema base |
| `20260607144010_added_entity_Page.xml` | JHipster/JDL | crea tabella `page` |
| `20260607144011_added_entity_PageVersion.xml` + constraints | JHipster/JDL | crea tabella `page_version` + FK |
| `20260612000001_unique_published_per_page.xml` | dev | indice univoco parziale PUBLISHED |
| `20260612000002_add_version_metadata.xml` | bmad-dev | `created_by`, `created_date`, `origin` su `page_version` (Story 2.11) |
| `20260613000001_add_page_cliente_table.xml` | bmad-dev | tabella `page_cliente` (Story 2.12) |
| `20260621000001_add_envers_revinfo_table.xml` | pagebuilder | tabella `revinfo` (Story 2.13-correlata) — **untracked/WIP** |

## 7. Rischi/osservazioni sui dati

- Il nome del campo relazionale `Page.versionses` (plurale scorretto di "versions") è un artefatto della generazione JDL non corretto manualmente; impatta solo il codice Java (getter/setter `getVersionses()`/`addVersions()`), non lo schema DB.
- Diverse colonne/tabelle sono state aggiunte come patch manuali post-JDL con la motivazione esplicita "rigenerare il JDL distruggerebbe le patch delle story precedenti" (AR-19): qualsiasi rigenerazione futura da JDL deve riapplicare `createdBy/createdDate/origin`, `page_cliente`, e verificare la pipeline `service/puck/*`.
- La feature di audit trail (Envers + `revinfo`) è al momento in uno stato non committato/non verificato end-to-end.
