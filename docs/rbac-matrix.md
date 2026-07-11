# RBAC Role→Operation Matrix (Scaffold)

> **Epic 2 — Story 2.2**: Scaffolding deny-by-default per il page-builder.
> Questa matrice è uno **scaffolding**; le righe marcate "(deferred 2.12)" indicano che l'enforcement fine-grained è rimandato a Story 2.12.

## Ruoli di dominio

| Ruolo | Costante Spring | Descrizione |
|---|---|---|
| Admin | `ROLE_ADMIN` | Superset di tutte le operazioni; può consultare audit trail |
| Editor Interno | `ROLE_EDITOR` | Può creare/salvare/pubblicare/rollback/archiviare Page; **non** consulta audit |
| Cliente | `ROLE_CLIENTE` | v1: **bloccato da tutto** (deny-by-default). Story 2.12 aprirà "solo contenuti" |

> `ROLE_USER` esiste per compatibilità JHipster ma **non è usato nel dominio page-builder**.

## Matrice Operazioni

| Operazione | Admin | Editor Interno | Cliente |
|---|---|---|---|
| Creare Page | ✅ | ✅ | ❌ |
| Salvare PageVersion (struttura+contenuto) | ✅ | ✅ | ❌ (deferred 2.12) |
| Pubblicare | ✅ | ✅ | ❌ |
| Rollback | ✅ | ✅ | ❌ |
| Archiviare/Ripristinare | ✅ | ✅ | ❌ |
| Consultare storico versioni | ✅ | ✅ | ❌ |
| Consultare audit trail | ✅ | ❌ | ❌ |
| Modificare solo contenuti (dataJson) | ✅ | ✅ | ✅ (deferred 2.12) |

## Note di implementazione

- **Deny-by-default**: tutte le operazioni sono negate di default; solo i ruoli esplicitamente autorizzati possono eseguirle.
- **`@PreAuthorize` sui service**: le annotazioni sono applicate a livello di classe su `PageService` e `PageVersionService`.
- **Patch post-rigenerazione**: i service sono file generati da JHipster; le annotazioni `@PreAuthorize` si perdono alla rigenerazione. Vedere `docs/development-guide.md` per l'ADR.
- **Enforcement server-side**: l'autorizzazione è applicata lato server (`@PreAuthorize`), non solo tramite nascondimento UI.
