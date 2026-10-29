# Review avversariale — ARCHITECTURE-SPINE page-builder

- **Data:** 2026-07-25
- **Revisore:** lente avversariale (build-substrate consistency review)
- **Target:** `../ARCHITECTURE-SPINE.md`
- **Companion letti:** SPEC.md, design-system.md, penpot-pipeline.md, rbac-matrix.md, a11y-baseline.md, glossary.md, `.memlog.md`
- **Verdetto:** **CONCERNS**

## Metodo

Non giudico se le Architecture Decision siano "giuste". Assumo che siano legge e che due sviluppatori indipendenti, su due story diverse, le rispettino **alla lettera**. Cerco le coppie di implementazioni che, pur obbedendo a ogni AD e a ogni convention, producono artefatti **incompatibili tra loro** o **bucano un invariante** perché lo spine non ha fissato abbastanza. Ogni coppia incompatibile è un buco: propongo la regola mancante (AD nuovo o irrigidimento).

Lo spine è nel complesso solido e ben ragionato: il paradigma esagonale, l'unico punto di mutazione (AD-1), la copertura RBAC nel core (AD-4), il backstop DB (AD-7) e la single-source Zod (AD-5) sono scelte forti. Ma esistono **contratti di dato condivisi lasciati sotto-specificati** e una **asimmetria lettura/scrittura** nell'enforcement, sufficienti a far divergere unità parallele. Verdetto CONCERNS: lo spine va irrigidito su ~6 contratti prima di aprire il lavoro in parallelo, non riscritto.

---

## Buchi trovati (coppie incompatibili)

### H1 — Shape di `audit_log` non fissata (AD-8)

**AD invocati:** AD-8, AD-1. **Convention:** "Audit applicativo nel core, sui metadati".

**Coppia incompatibile:**
- *Story A — `publish` use-case.* Scrive `audit_log` con record `{ actorId, action: "PUBLISH", entityType: "PageVersion", entityId, at, diff: { status: { from: "DRAFT", to: "PUBLISHED" } } }`.
- *Story B — `save-version` / `archive` use-case.* Scrive `{ who, verb: "archive", target: "page:123", ts, changes: [ { field: "status", old, new } ] }`.

Entrambe obbediscono ad AD-8 ("actor, azione, entità, timestamp, diff sui metadati"): la frase non fissa **nomi di colonna**, **enum delle azioni**, **valori di `entityType`** (Page vs PageVersion per la stessa operazione), né **serializzazione del diff** (oggetto vs array). Il terzo lettore — la query Admin di consultazione audit (CAP-14, "cronologia per pagina e per utente") — non può renderizzare due forme divergenti né filtrare per `action`/`entity` in modo uniforme. Il diff a livello di blocco (abilitato dal block-id, AD-6) non ha un formato canonico: due story lo scrivono in modi non confrontabili.

**Regola proposta — AD-8bis (Schema canonico dell'evento di audit):** un tipo di dominio `AuditEvent` unico e chiuso vive nel core (`{ actorId, action: AuditAction, entityType: "Page"|"PageVersion", entityId, occurredAt, metaDiff: MetaDiff }`), con `AuditAction` **enum chiuso** (CREATE_PAGE, SAVE_VERSION, PUBLISH, ROLLBACK, ARCHIVE, RESTORE, ASSIGN_CLIENT) e `MetaDiff` di forma fissa (lista tipizzata di `{ field, from, to }`). Tutti gli use-case scrivono l'audit **attraverso un unico `AuditWriter` (outbound port)**, mai con INSERT ad-hoc. Vietato aggiungere azioni fuori dall'enum senza toccare il tipo condiviso.

---

### H2 — Shape del `principal` nel context oRPC non fissata (AD-4)

**AD invocati:** AD-4, AD-1. **Convention:** "`principal + ruolo` nel context oRPC; authz fine sempre nel core".

**Coppia incompatibile:**
- *Story A — procedure editor.* Costruisce il context come `principal = { userId: string, role: "EDITOR" }` (ruolo stringa singola).
- *Story B — procedure commerce/altre.* Better Auth con plugin `organization` + `access-control` (vedi memlog) espone ruoli come **array** e `activeOrganizationId`; la story mappa `principal = { id, roles: ["editor"], orgId }`.

Entrambe rispettano AD-4 ("ogni adapter inbound passa il `principal` al core"). Ma il core deve leggere `principal` per il deny-by-default e per l'authz fine (assegnazione Cliente↔pagina): un use-case che legge `principal.role === "CLIENTE"` funziona con A e rompe con B (`roles` array), e la chiave dell'id (`userId` vs `id`) diverge → la verifica "questo Cliente è assegnato a questa pagina?" fa lookup sbagliato o su chiave inesistente. Nessun AD fissa **il tipo `Principal` e chi lo costruisce**.

**Regola proposta — AD-4bis (Principal canonico + mapper unico):** il core definisce e possiede il tipo `Principal = { userId: string; role: "ADMIN"|"EDITOR"|"CLIENTE" }` (ruolo **grossolano singolo**, non array — coerente con AD-4 "ruolo grossolano"). Esiste **un solo `SessionToPrincipal` mapper** nell'adapter auth che traduce la sessione Better Auth → `Principal`; ogni adapter inbound lo riusa, nessuno costruisce il principal a mano. L'assegnazione Cliente↔pagina e ogni permesso su risorsa **non** stanno nel principal: sono dato di dominio letto dal core (già in AD-4).

---

### H3 — Interfaccia `CommerceProvider` non fissata (AD-10)

**AD invocati:** AD-10. **Convention:** "commerce-provider come package a sé".

**Coppia incompatibile:**
- *Story A — blocco ProductCard.* Definisce/consuma `CommerceProvider.getProduct(id): { id, title, priceCents: number, image: string }`.
- *Story B — blocco ProductGrid.* Definisce/consuma `CommerceProvider.listProducts(q): { sku, name, price: { amount, currency }, media: string[] }[]`.

AD-10 impone l'astrazione ("a un'interfaccia CommerceProvider") ma **non fissa il set di metodi né la forma dei DTO** (Product/Collection/Cart), né la rappresentazione del prezzo (minor units vs decimale + valuta), né la shape di errore del provider, né il contratto `resolveData`. Risultato: l'adapter Shopify e l'adapter custom devono implementare **due interfacce divergenti e mutuamente incompatibili**; un blocco scritto contro A non renderizza con l'adapter pensato per B. È esattamente il lock-in/riscrittura che AD-10 voleva prevenire, spostato di un livello.

**Regola proposta — AD-10bis (Port CommerceProvider fissato):** `packages/commerce-provider` esporta **l'interfaccia canonica** (firme dei metodi: `getProduct`, `listProducts`/`getCollection`, `createCart`/`addToCart`, …) e i **DTO canonici** (`Product`, `Collection`, `CartLine` con prezzo in **minor units + ISO 4217**, immagini normalizzate) e una **shape di errore commerce** unica. Tutti i blocchi consumano solo questi tipi; ogni adapter (Shopify/custom) li implementa. Il contratto `resolveData` (input external field → DTO) è parte del port.

---

### H4 — Mapping errori di dominio → oRPC: taxonomy e semantica non fissate

**AD invocati:** AD-1, AD-4. **Convention:** "errori di dominio tipizzati mappati a errori oRPC (shape unico), non stringhe libere".

**Coppia incompatibile:**
- *Story A.* Lancia sottoclassi `DomainError` con `code` e mappa in `ORPCError("FORBIDDEN")`; un authz-fail deny-by-default → `403 FORBIDDEN`.
- *Story B.* Ritorna `Result<{ kind: "not_allowed" }>` e mappa tutto a `BAD_REQUEST` con `message` libero; un authz-fail → `404 NOT_FOUND` (per non rivelare l'esistenza della risorsa).

La convention dice "shape unico" ma **non fissa la tassonomia degli errori di dominio** (NotFound/Forbidden/Validation/Conflict), **né il mapper**, **né la semantica dell'authz-fail** (403 che rivela l'esistenza vs 404 che la nasconde). Due story mappano lo stesso fallimento a status/shape diversi: il FE non può discriminare in modo affidabile, e la scelta 403-vs-404 incoerente crea sia un leak informativo sia un branch UI rotto.

**Regola proposta — AD-Errori:** union chiusa di errori di dominio nel core (`NotFound | Forbidden | Validation | Conflict | Unauthorized`), **un solo mapper** dominio→oRPC nel confine inbound, un **envelope serializzato stabile** `{ code, message, details? }`, e una **regola esplicita sulla semantica authz-fail** (es. deny-by-default su risorsa esistente ma non autorizzata → codice uniforme scelto una volta, applicato ovunque, per non fare leak differenziale).

---

### H5 — Proprietà di block-id, `schemaVersion`, `versionNumber` non assegnata (AD-6)

**AD invocati:** AD-6, AD-1, AD-7. **Convention:** "id di blocco stabili"; "operazioni multi-riga in transazione".

**Tre coppie incompatibili in una:**

1. **Block-id.** *Story A (editor client)* genera gli id blocco client-side (nanoid di Puck). *Story B (core save-version)* normalizza/rigenera gli id server-side "per garantirne la stabilità". Risultato: id client ≠ id persistito → il diff/audit a livello di blocco (lo scopo dichiarato di AD-6) si rompe tra due salvataggi. AD-6 dice "id stabile indipendente dalla posizione" ma **non dice chi lo conia né che il core non deve riscriverlo**.

2. **`schemaVersion`.** *Story A* fa stampare la `schemaVersion` corrente dall'editor. *Story B* la (ri)scrive nel core alla persistenza. Se entrambi la toccano, un payload autorato con vN può essere sovrascritto a vM senza migrazione → payload marcato come una versione di schema che non è.

3. **`versionNumber`.** *Story A (save-version/autosave)* alloca `max(versionNumber)+1` in codice applicativo; *Story B (publish)* fa lo stesso. Con autosave ottimistico concorrente (TanStack Query, citato nel memlog) → **race sul progressivo**: numeri duplicati o buchi. Nessun AD prevede un `UNIQUE (page_id, version_number)` (a differenza dell'invariante ≤1 PUBLISHED che invece è protetto da AD-7).

**Regola proposta — AD-6bis (Proprietà degli identificatori):**
- **Block-id:** coniati **una sola volta dall'editor**, immutabili; il core li **valida** (presenza + unicità nel payload, rifiuta id mancanti/duplicati) ma **non li riscrive mai**.
- **`schemaVersion`:** costante **posseduta da `packages/puck-components`** (single source condivisa, AD-5); l'editor stampa la versione con cui autora, il core è **l'unico** autorizzato a eseguire migrazioni di schema (mai rewrite silenziosi).
- **`versionNumber`:** allocato **solo dal core, dentro la stessa transazione** della scrittura, monotono per pagina, protetto da **`UNIQUE (page_id, version_number)` a livello DB** (stesso pattern backstop di AD-7). Mai dal client.

---

### H6 — Due proprietari della "verità di pubblicazione": `PageStatus` vs `PageVersionStatus`

**AD invocati:** AD-7, AD-9, AD-1. **Convention naming:** "stati `PageStatus` DRAFT/PUBLISHED/ARCHIVED, `PageVersionStatus` DRAFT/PUBLISHED".

Esistono **due campi di stato** per lo stesso concetto "questa pagina è live": lo stato sulla `Page` e lo stato sulla `PageVersion`. Il backstop DB (AD-7) protegge **solo** il version-status (≤1 PUBLISHED per pagina). La `Page.status` non è vincolata alla presenza di una versione pubblicata.

**Coppia incompatibile:**
- *Story A (publish)* setta `PageVersion.status = PUBLISHED` **e** `Page.status = PUBLISHED`.
- *Story B (archive)* setta `Page.status = ARCHIVED` ma **lascia** una `PageVersion` PUBLISHED (obbedisce ad AD-1/AD-7: non tocca il version-status). Risultato: una pagina ARCHIVED conserva una versione PUBLISHED → il render SSG by-slug (AD-9), che potrebbe filtrare per version-status, continua a **servire pubblicamente una pagina archiviata** (leak/incoerenza). Al contrario, se il render filtra per `Page.status`, un rollback che tocca solo i version-status non aggiorna nulla di visibile.

**Coppia incompatibile aggiuntiva (percorso Cliente content-only):** *Story C (Cliente content-save su pagina assegnata)* — AD-4/RBAC concede "content-only". Su **quale** versione scrive? Se muta in-place il payload della versione **PUBLISHED** → cambia il contenuto pubblicato **senza un publish**, viola l'immutabilità dello snapshot, aggira audit/versioning e il concetto stesso di ≤1 pubblicata. Se crea una nuova DRAFT (come *Story D (Editor save)*) → coerente. Lo spine **non dice su quale versione atterra un content-save**.

**Regola proposta — AD-Stato-Pubblicazione:** una **sola autorità** per "la pagina è live". Opzione consigliata: `Page.status` **derivato** dallo stato delle versioni (o accoppiato come invariante di dominio scritto in **un'unica transazione** dal core). Regole esplicite: (a) `archive` deve **demotare/tombstonare** la versione PUBLISHED **e** invalidare la cache (H8); (b) il render valuta sia `Page.status` sia la versione; (c) **ogni scrittura di contenuto — incluso il content-only del Cliente — crea sempre una nuova versione DRAFT**, mai muta una versione esistente (le versioni sono snapshot immutabili). Nessun doppio scrittore della verità di pubblicazione.

---

### H7 — Copertura RBAC asimmetrica: il lato LETTURA può essere costruito fuori dal core (AD-1/AD-4)

**AD invocati:** AD-1, AD-4, AD-9. **Questa è la falla più vicina all'anti-pattern legacy "CRUD scoperti".**

AD-1 vincola al core "ogni **mutazione**". AD-4 dice "ogni **via di modifica**". Entrambi parlano di scrittura. Ma esistono **letture di dominio non pubbliche** con authz fine: (a) **anteprima draft** (AD-9, "protetta da auth" — ma un Cliente può vedere solo pagine assegnate, un Editor sì); (b) **storico versioni** (RBAC: Admin/Editor sì, Cliente no); (c) **audit trail** (Admin only).

**Coppia incompatibile:**
- *Story A (query use-case)* legge lo storico versioni via un use-case del core con `principal` e deny-by-default.
- *Story B (route SSR anteprima draft, o pannello version-list)* legge **direttamente via Prisma** dentro la route/server-component, perché è una **lettura** e AD-1 vincola solo le mutazioni. Fa solo un check grossolano "utente loggato" (o nessuno). → un Cliente vede la draft di una pagina **non** assegnata; o l'audit è leggibile fuori dal check Admin.

Lo spine lascia scoperto proprio il pattern che voleva evitare, ma sul lato read: "endpoint che leggono dominio senza principal e senza check" (frase testuale del memlog, riferita però solo alla scrittura).

**Regola proposta — AD-4ter (Copertura letture sensibili):** ogni **lettura di dominio non-pubblica** (anteprima draft, storico versioni, audit, qualsiasi lettura filtrata per assegnazione/ruolo) passa da un **query use-case del core** con `principal` e deny-by-default, esattamente come le mutazioni. **Unica** lettura anonima ammessa fuori dal core-authz: il render della versione **PUBLISHED** by-slug, e solo su una **proiezione pubblicata** (nessun campo draft/interno). Vietato l'accesso Prisma diretto al dominio dalle route/adapter per dati non-pubblici.

---

### H8 — Render draft e cache: funzioni/tag condivisi possono far leakare la bozza (AD-9)

**AD invocati:** AD-9. **Prevents (dichiarato):** "leak di bozze non pubblicate".

**Coppia incompatibile:**
- *Story A (render published)* implementa il fetch con `unstable_cache`/fetch **taggato per slug** (`revalidateTag(slug)`).
- *Story B (anteprima draft)*, per DRY, **riusa la stessa funzione di data-fetch** taggata per slug, cambiando solo il filtro versione. → il contenuto draft finisce **nella cache condivisa sotto il tag slug** e può essere servito a una richiesta pubblica anonima. Oppure: la chiave di cache ISR è **solo lo slug** (non `slug+versionState`), e un render draft popola la cache pubblica.

AD-9 dice "draft = render dinamico non cachato", ma **non vieta la condivisione di funzioni/tag/chiavi di cache** tra i due percorsi, che è il modo realistico in cui il leak si verifica.

**Regola proposta — AD-9bis (Domini di cache disgiunti):** il render **published** è **l'unico scrittore** della cache taggata per slug e legge **solo** la proiezione pubblicata; il percorso **draft/preview** usa `no-store`/segment `dynamic` e **non deve condividere** funzioni di fetch, tag o chiavi di cache con il percorso published. Enforce via **due query use-case distinti** (proiezione-pubblicata vs proiezione-draft) che non si sovrappongono.

---

### H9 — Chi possiede l'invalidazione cache e dove sta la transazione (AD-7 vs AD-9 vs AD-2)

**AD invocati:** AD-7, AD-9, AD-1, AD-2.

**Contraddizione letterale nello spine:** AD-9 dice "**il core** invoca `revalidateTag(slug)`". Ma AD-1/AD-2 dicono che **il core non importa React/HTTP/Next** ed è estraibile. `revalidateTag` è una funzione Next.js. Non si può obbedire a entrambe.

**Coppia incompatibile:**
- *Story A* mette `revalidateTag` **dentro** l'use-case del core (obbedisce alla lettera di AD-9) → viola la purezza del core (AD-1/AD-2) e, peggio, se la transazione fa rollback dopo la revalidate, si è invalidata la cache per un publish che non è avvenuto (ordine sbagliato).
- *Story B* tiene il core puro e chiama `revalidateTag` **nell'adapter oRPC** dopo l'use-case. Ma allora una **seconda via inbound** (server action, citata in AD-1) che pubblica potrebbe **dimenticare** di revalidare → HTML stantio. L'invalidazione non è più garantita da "ogni via passa dal core".

**Regola proposta — AD-9ter (CacheInvalidator come outbound port):** l'invalidazione è un **port outbound** (`CacheInvalidator`) iniettato nel core; l'use-case chiama il port **dopo il commit** della transazione (staying pure, coerente con AD-1/AD-2). L'adapter Next implementa il port con `revalidateTag`. Così **ogni** via inbound (oRPC, server action, futura API HTTP) eredita l'invalidazione perché passa dallo stesso use-case, e l'ordine commit→revalidate è garantito. Corregge la contraddizione testuale di AD-9.

---

## Riepilogo dei buchi

| # | Buco | AD toccati | Severità | Regola proposta |
|---|---|---|---|---|
| H1 | Shape `audit_log` non fissata | AD-8 | Alta | AD-8bis: `AuditEvent` canonico + `AuditAction` enum chiuso + `AuditWriter` port unico |
| H2 | Shape `principal` oRPC non fissata | AD-4 | Alta | AD-4bis: `Principal` canonico (ruolo singolo) + mapper `SessionToPrincipal` unico |
| H3 | Interfaccia CommerceProvider non fissata | AD-10 | Alta | AD-10bis: port + DTO canonici (prezzo minor-units+ISO) + contratto resolveData |
| H4 | Errori dominio→oRPC: taxonomy/semantica | AD-1/4 | Media | AD-Errori: union chiusa + mapper unico + envelope + regola 403/404 |
| H5 | Proprietà block-id / schemaVersion / versionNumber | AD-6/7 | Alta | AD-6bis: id dal client immutabili; schemaVersion in puck-components; versionNumber dal core in tx + UNIQUE(page_id,version_number) |
| H6 | Due proprietari della verità di pubblicazione + target del content-save | AD-7/9 | Alta | AD-Stato: `Page.status` derivato/accoppiato in una tx; content-save crea sempre nuova DRAFT |
| H7 | Copertura RBAC asimmetrica sul lato lettura | AD-1/4/9 | **Critica** | AD-4ter: letture sensibili via query use-case del core; solo published anonimo |
| H8 | Cache condivisa draft↔published (leak) | AD-9 | Alta | AD-9bis: domini di cache disgiunti, due query use-case distinti |
| H9 | Proprietà invalidazione cache + contraddizione core-puro | AD-7/9/1/2 | Media | AD-9ter: `CacheInvalidator` port, chiamato post-commit dal core |

---

## Verdetto: CONCERNS

Lo spine ha ossatura corretta e previene bene gli anti-pattern legacy sul lato **scrittura**. Ma lascia **sotto-fissati sei contratti di dato condivisi** (audit, principal, CommerceProvider, errori, identificatori, verità di pubblicazione) che permettono a due unità conformi di divergere silenziosamente, presenta **una vera falla di copertura RBAC sul lato lettura** (H7, la più grave — riapre l'anti-pattern "CRUD scoperti" sulle read), un **vettore di leak draft via cache condivisa** (H8) e una **contraddizione testuale** su chi invoca `revalidateTag` (H9). Nessuno di questi richiede di rifare lo spine: si chiudono con gli AD proposti (o irrigidendo AD-4/6/8/9/10). Fino ad allora, aprire più story in parallelo su questi confini è a rischio.

**Azione minima consigliata prima del parallelismo:** chiudere H7 (RBAC read), H5 e H6 (identificatori + stato) e H1/H2/H3 (contratti condivisi core-attraversanti), che sono i confini toccati da più unità contemporaneamente.
