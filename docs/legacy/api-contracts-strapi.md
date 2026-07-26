# API Contracts — Strapi (puck-builder)

> ⚠️ **LEGACY** — sorgente di migrazione verso `apps/pagebuilder` (JHipster). Solo lettura fino al cutover (Epic 5). Non proporre modifiche al codice di questo pacchetto.
> Ultima ri-verifica: **2026-07-10** (deep scan, doc-project). Contenuto confermato accurato rispetto al codice attuale.

> Parte: `apps/strapi`. Rotte definite dal plugin `puck-builder` in `server/src/routes/index.ts`.
> Sono rotte di tipo **`admin`** (montate sotto il namespace admin del plugin), non API pubbliche di contenuto.

## Base path

Le rotte sono registrate come `type: 'admin'`. Il client admin (`admin/src/api/templates.ts`) le chiama con il prefisso del plugin:

```
/puck-builder/puck-builder/templates
└─────┬─────┘ └─────┬─────┘
 mount plugin   path rotta
```

> ⚠️ Il doppio segmento `puck-builder/puck-builder` non è un refuso: il primo è il mount del plugin nell'admin, il secondo fa parte del `path` dichiarato nelle rotte.

## Endpoint

| Metodo | Path (come da `routes/index.ts`) | Handler | Descrizione |
|--------|----------------------------------|---------|-------------|
| `GET` | `/puck-builder/templates` | `template.find` | Elenca tutti i template |
| `GET` | `/puck-builder/templates/:documentId` | `template.findOne` | Recupera un template per `documentId` |
| `POST` | `/puck-builder/templates` | `template.create` | Crea un template |
| `PUT` | `/puck-builder/templates/:documentId` | `template.update` | Aggiorna un template |
| `DELETE` | `/puck-builder/templates/:documentId` | `template.delete` | Elimina un template |

`config.policies: []` su tutte le rotte (nessuna policy aggiuntiva oltre all'autenticazione admin di Strapi).

## Schemi richiesta / risposta

Implementazione in `server/src/controllers/index.ts` (usa la **Documents API** di Strapi v5: `strapi.documents('plugin::puck-builder.template')`).

### Forma risorsa `Template` (lato client)

```ts
interface Template {
  documentId: string;
  name: string;
  slug: string;
  config: Record<string, unknown>; // documento Puck { content, root, zones }
  createdAt: string;
  updatedAt: string;
}
```

### `GET /templates`
- **Risposta** `200`: `{ "data": Template[] }` (array vuoto se nessun risultato)

### `GET /templates/:documentId`
- **Risposta** `200`: `{ "data": Template }`
- **Errore** `404`: `ctx.notFound('Template not found')`

### `POST /templates`
- **Body**: `{ name: string, slug?: string, config: object }`
- **Risposta** `201`: `{ "data": Template }`

### `PUT /templates/:documentId`
- **Body**: `{ name?, slug?, config? }` (parziale)
- **Risposta** `200`: `{ "data": Template }`
- **Errore** `404`: se non trovato

### `DELETE /templates/:documentId`
- **Risposta** `204`: `{ "data": null }`

## Client admin

`admin/src/api/templates.ts` espone l'hook `useTemplateApi()` (basato su `useFetchClient` di `@strapi/strapi/admin`) con:

| Metodo client | Chiamata |
|---------------|----------|
| `findAll()` | `GET BASE` |
| `findOne(documentId)` | `GET BASE/:id` |
| `create({ name, config })` | `POST BASE` |
| `update(documentId, { name?, config? })` | `PUT BASE/:id` |
| `remove(documentId)` | `DELETE BASE/:id` |

dove `BASE = '/puck-builder/puck-builder/templates'`.

## Autenticazione

L'autenticazione è quella standard dell'admin Strapi (JWT admin, gestito da `useFetchClient`). Le rotte sono `type: 'admin'`, quindi accessibili solo da utenti admin autenticati. Non sono esposte API content pubbliche per i template.

## Config API REST globale

`apps/strapi/config/api.ts`: `defaultLimit: 25`, `maxLimit: 100`, `withCount: true` (riguarda le API REST core di Strapi, non direttamente le rotte custom sopra che ritornano l'intero set via Documents API).
