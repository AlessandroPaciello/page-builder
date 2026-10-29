# RBAC — matrice ruolo → operazione

Companion di [SPEC.md](./SPEC.md) (CAP-12). Ruoli di **dominio** stack-agnostici; l'identità e il provider auth sono decisi in fase architecture. Principio: **deny-by-default**, enforcement **server-side** (non solo nascondimento UI), su **ogni** via di modifica.

## Ruoli di dominio

| Ruolo | Descrizione |
|---|---|
| Admin | Superset di tutte le operazioni; unico a consultare l'audit trail |
| Editor | Crea/salva/pubblica/rollback/archivia pagine; **non** consulta l'audit |
| Cliente | Solo modifiche **content-only** su pagine a cui è **esplicitamente assegnato**; niente create/publish/rollback/archive |

## Matrice operazioni

| Operazione | Admin | Editor | Cliente |
|---|:---:|:---:|:---:|
| Creare pagina | ✅ | ✅ | ❌ |
| Salvare versione (structure + content) | ✅ | ✅ | ❌ |
| Salvare versione **content-only** su pagina assegnata | ✅ | ✅ | ✅ |
| Pubblicare | ✅ | ✅ | ❌ |
| Rollback | ✅ | ✅ | ❌ |
| Archiviare / Ripristinare | ✅ | ✅ | ❌ |
| Consultare storico versioni | ✅ | ✅ | ❌ |
| Consultare audit trail | ✅ | ❌ | ❌ |
| Leggere pagina renderizzata (by-slug) | ✅ | ✅ | ✅ |

## Regole di enforcement

- **Deny-by-default:** ogni operazione è negata salvo autorizzazione esplicita.
- **Copertura totale:** l'autorizzazione copre ogni endpoint/azione che modifica pagine o versioni. (Anti-pattern legacy da NON ripetere: nel progetto di riferimento gli endpoint CRUD generici erano privi di controllo di ruolo e bypassavano questa matrice — vedi Open Question in SPEC.md.)
- **Confine content vs structure:** il diritto "content-only" del Cliente si appoggia alla classificazione dei campi (CAP-13); solo i campi `content` dei blocchi sono modificabili, i campi `structure` restano bloccati.
- L'assegnazione Cliente↔pagina esiste come capability; la UI di gestione fine-grained è fuori scope in questo SPEC (vedi Non-goals).
