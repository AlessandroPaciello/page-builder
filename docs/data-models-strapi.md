# Data Models — Strapi (puck-builder)

> ⚠️ **LEGACY** — sorgente di migrazione verso `apps/pagebuilder` (JHipster). Solo lettura fino al cutover (Epic 5). Non proporre modifiche al codice di questo pacchetto.
> Ultima ri-verifica: **2026-07-10** (deep scan, doc-project). Contenuto confermato accurato rispetto al codice attuale.

> Parte: `apps/strapi`. Il dominio dati del progetto è minimale: il plugin `puck-builder` definisce **un solo content-type**.

## Content-type: `template`

Definito in `apps/strapi/src/plugins/puck-builder/server/src/content-types/template/schema.json`.

| Proprietà | Valore |
|-----------|--------|
| `kind` | `collectionType` |
| `collectionName` | `puck_builder_templates` |
| `singularName` / `pluralName` | `template` / `templates` |
| `draftAndPublish` | `false` |
| UID content-type | `plugin::puck-builder.template` |

### Attributi

| Campo | Tipo | Vincoli | Descrizione |
|-------|------|---------|-------------|
| `name` | `string` | `required` | Nome leggibile del template |
| `slug` | `uid` | `targetField: name` | Slug generato dal nome |
| `config` | `json` | `required` | **Documento Puck completo** (`Data`): `{ content, root, zones }` con i blocchi del page-builder |
| `documentId` | (gestito da Strapi) | auto | Identificatore stabile Strapi v5 (Documents API) |
| `createdAt` / `updatedAt` | datetime | auto | Timestamp di sistema |

### Note sul modello

- **Il payload di design vive interamente in `config`** (colonna JSON). Strapi qui funge da *storage JSON* del documento Puck; non c'è uno schema relazionale dei blocchi — la struttura dei blocchi è validata a livello applicativo dagli schemi Zod di `@penpot-ds/puck-components`.
- La forma di `config` corrisponde al tipo `Data` di `@measured/puck`:
  ```ts
  type Data = { content: ComponentData[]; root: { props: {} }; zones: Record<string, ComponentData[]> }
  ```
- Visibile sia in **Content Manager** sia in **Content-Type Builder** (`pluginOptions`).

## Persistenza (database)

Config in `apps/strapi/config/database.ts`. Client selezionabile via env `DATABASE_CLIENT`:

| Client | Default / uso | Parametri |
|--------|---------------|-----------|
| `sqlite` (**default dev**) | File `.tmp/data.db` (env `DATABASE_FILENAME`) | `better-sqlite3` |
| `postgres` | Stack docker (`strapi-postgres`, porta host 5433) | host/port/db/user/password, SSL, pool |
| `mysql` | Supportato | host/port/db/user/password, SSL, pool |

> Lo schema fisico delle tabelle è gestito/migrato da Strapi (`database/migrations/`, attualmente vuota a parte `.gitkeep`).

## Strategia di migrazione (contesto)

La migrazione del backend verso **Spring Boot / JHipster** (`apps/pagebuilder`) è in corso: Epic 4 è ormai in gran parte completata lato `pagebuilder`. Il modello dati target non è un mapping 1:1 di `template`, ma un'evoluzione più ricca su due entità JPA:

- `Page` (`apps/pagebuilder/src/main/java/com/penpot/pagebuilder/domain/Page.java`): `slug` (univoco), `path`, `seoTitle`, `seoDescription`, `seoMetaJson`, `status` (enum `PageStatus`), `optimisticLock`, relazione 1:N verso `PageVersion`, più `clienti` (Set di identificativi Keycloak, patch manuale post-JDL per assegnazione multi-tenant).
- `PageVersion` (`.../domain/PageVersion.java`): `versionNumber`, `documentVersion`, `status` (enum `PageVersionStatus`), `payload` (JSON — l'equivalente concettuale del `config` di Strapi), `optimisticLock`, `createdBy`/`createdDate`/`origin`, relazione N:1 verso `Page`. Entrambe le entità sono `@Audited` (Hibernate Envers) per lo storico versioni/audit.

**Confronto con `template` di Strapi**: il singolo content-type `template` (name/slug/config) è stato scisso in due entità (`Page` + `PageVersion` in relazione 1:N), introducendo: versionamento esplicito (`versionNumber`, `status` per versione), metadati SEO, stato pubblicazione (`PageStatus`), audit/optimistic locking nativi e assegnazione clienti. Il blob JSON dei blocchi Puck sopravvive concettualmente come `payload` su `PageVersion` (non più su un'unica riga `template.config`). Non esiste import/migrazione dati automatica nota da `template` → `Page`/`PageVersion`: da verificare a ridosso del cutover (Epic 5) se serve uno script di backfill dai record Strapi esistenti.
