# Architecture — Strapi & plugin `puck-builder`

> ⚠️ **LEGACY** — sorgente di migrazione verso `apps/pagebuilder` (JHipster). Solo lettura fino al cutover (Epic 5). Non proporre modifiche al codice di questo pacchetto.
> Ultima ri-verifica: **2026-07-10** (deep scan, doc-project). Contenuto confermato accurato rispetto al codice attuale.

> Parte: `apps/strapi` · `@penpot-ds/strapi` · Strapi **5.41.1** · React 18

## Executive summary

App Strapi 5 il cui unico scopo applicativo è ospitare il **plugin custom `puck-builder`**: un page-builder drag-and-drop (basato su `@measured/puck`) integrato nell'admin panel. I layout creati vengono salvati come documenti JSON nel content-type `template`. Strapi funge da backend/admin + storage.

## Stack

| Categoria | Tecnologia | Versione |
|-----------|-----------|----------|
| Framework | `@strapi/strapi` | 5.41.1 |
| Plugin core | `@strapi/plugin-users-permissions`, `@strapi/plugin-cloud` | 5.41.1 |
| Runtime UI admin | React + react-dom | 18 |
| Routing admin plugin | react-router-dom | 6 |
| Editor | `@measured/puck` | ^0.20.2 |
| Validazione | zod | ^4.3.6 |
| Styling | tailwindcss + @tailwindcss/vite | ^4 |
| DB driver | better-sqlite3 (dev) | 12.8.0 |
| Node | `>=20 <=24` | engines |

## Pattern architetturale

Strapi standard (config-driven, plugin-based) + **plugin a doppio entry**:
- `strapi-server.ts` → `server/src` (content-type, controller, routes, services)
- `strapi-admin.ts` → `admin/src` (UI React dentro l'admin)

Registrazione del plugin in `config/plugins.ts`:
```ts
'puck-builder': { enabled: true, resolve: './src/plugins/puck-builder' }
```

## Lato server (`server/src`)

```
server/src/
├── index.ts                      # registra contentTypes/controllers/services/routes
├── content-types/template/schema.json   # collection `template` (vedi data-models)
├── controllers/index.ts          # CRUD via strapi.documents('plugin::puck-builder.template')
├── routes/index.ts               # rotte type:'admin' /puck-builder/templates[...]
└── services/index.ts             # minimale (logica nel controller)
```

- Le rotte sono **admin** (autenticazione admin Strapi). CRUD completo su `template`.
- Persistenza tramite **Documents API** di Strapi v5 (`documentId`).
- Dettagli endpoint → [api-contracts-strapi.md](./api-contracts-strapi.md); modello → [data-models-strapi.md](./data-models-strapi.md).

## Lato admin (`admin/src`)

```
admin/src/
├── index.tsx          # app.addMenuLink('/plugins/puck-builder', 'Layout Builder') + registerPlugin
├── App.tsx            # <Routes>: index→List, new→Editor, editor/:id→Editor, preview/:id→Preview
├── api/templates.ts   # useTemplateApi() su useFetchClient
└── pages/
    ├── TemplateList.tsx     # elenco template
    ├── TemplateEditor.tsx   # <Puck config={puckConfig}> + ActionBar custom, salva via API
    └── TemplatePreview.tsx  # render del template
```

### Flusso editor
1. L'admin apre **Layout Builder** dal menu → `TemplateList`.
2. "New" o "edit" → `TemplateEditor` carica (se esiste) `config` via `findOne` e monta `<Puck config={puckConfig} data={config}>`.
3. L'utente inserisce blocchi dalla `INSERTABLE` list; i container single-slot (`Section/Box/Flex/Grid/Hero`) accettano figli; `Columns` ha 3 slot.
4. Al salvataggio, il `Data` di Puck viene inviato come `config` (JSON) a `create`/`update`.
5. `TemplatePreview` renderizza il documento salvato.

I blocchi disponibili provengono da `@penpot-ds/puck-components` (`puckConfig`) → vedi [component-inventory.md](./component-inventory.md).

## Configurazione (`config/`)

| File | Punti chiave |
|------|--------------|
| `database.ts` | client da `DATABASE_CLIENT` (sqlite default `.tmp/data.db`; postgres/mysql con host/pool/SSL) |
| `server.ts` | `HOST=0.0.0.0`, `PORT=1337`, `app.keys` da `APP_KEYS` |
| `middlewares.ts` | stack standard + CSP `img-src` (picsum, market-assets) |
| `plugins.ts` | abilita `puck-builder` |
| `api.ts` | REST: defaultLimit 25, maxLimit 100, withCount |
| `admin/` | `app.ts`, `vite.config.ts` (build admin) |

### Env richieste (`.env.example`)
`HOST`, `PORT`, `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`.

## Sviluppo / build / deploy

| Comando | Azione |
|---------|--------|
| `pnpm dev:strapi` (root) | `turbo run develop --filter=@penpot-ds/strapi` (autoReload) |
| `pnpm build:strapi` (root) | build admin Strapi |
| `strapi start` | avvio senza autoReload |
| `strapi deploy` | deploy (Strapi Cloud) |

> Test: il pacchetto strapi non ha test automatici configurati.

## Contesto / migrazione

Strapi non è in produzione ed è usato come storage JSON dei layout Puck. La migrazione del backend a **Spring Boot / JHipster** è in corso in `apps/pagebuilder`, con Epic 4 ormai in gran parte completata: entità `Page` + `PageVersion` (relazione 1:N, versionamento, SEO, stato pubblicazione, audit Envers) sostituiscono il singolo content-type `template`. Vedi [data-models-strapi.md](./data-models-strapi.md) per il confronto dettagliato dei campi. Fino al cutover (Epic 5), `apps/strapi` resta la sorgente di verità di sola lettura per il dominio dati legacy.
