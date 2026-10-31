---
review: version-check
lens: 'Ogni decisione tecnologica impegnata è stata web-ricercata / reality-checked, non asserita da training data?'
target: '../ARCHITECTURE-SPINE.md'
reviewer: architecture-spine version-check
date: '2026-07-25'
verdict: CONCERNS
---

# Review — Version & Reality Check

**Lente unica:** verificare che ogni tecnologia/versione impegnata nello spine esista, sia corrente/consigliata a luglio 2026, e calzi col ruolo che le viene dato. Tutte le affermazioni sono state controllate contro il web attuale (non training data).

**Verdetto: CONCERNS.** Lo spine è, nella maggioranza, ben ricercato e aderente alla realtà: le tecnologie core (React 19, PostgreSQL 18, Better Auth con i suoi plugin, oRPC→OpenAPI, Tailwind 4, ISR/`revalidateTag`, Puck `resolveData`/external fields, Prisma partialIndexes preview) esistono e ricoprono correttamente il ruolo loro assegnato. Restano però **tre difetti fattuali/di attualità** e **due pin da svecchiare** che vanno corretti prima di considerare le versioni "vere al cold-start".

---

## Findings

### F1 — [HIGH] `@measured/puck ~0.20` è DEPRECATO: il pacchetto è stato rinominato in `@puckeditor/core`

- **Dove:** sezione Stack (riga `@measured/puck | ~0.20`), AD-5, AD-6, AD-10, `packages/puck-components`, Capability map (CAP-4).
- **Realtà verificata (web, lug 2026):** `@measured/puck@0.20.2` esiste (pubblicato ~set 2025), quindi il pin di versione non è inventato. **Ma** a partire da **Puck 0.21** il progetto ha traslocato sullo scope `@puckeditor`: il core è ora `@puckeditor/core` e il pacchetto npm `@measured/puck` è marcato **deprecato** con messaggio esplicito "Puck has moved. Please use @puckeditor/core instead". Anche i sotto-pacchetti sono migrati (`@puckeditor/field-contentful`, `@puckeditor/plugin-*`). Puck 0.21 (2026) aggiunge inoltre AI beta, rich text editing e un nuovo plugin rail.
- **Impatto:** lo spine pinnerebbe una libreria deprecata sotto un nome di pacchetto abbandonato. Poiché Puck è centrale (payload `{content,root,zones}`, schemi Zod, `resolveData`), è un rischio concreto di partire "già vecchi".
- **Raccomandazione:** aggiornare il pin a `@puckeditor/core` (Puck 0.21+). Verificare in fase di scaffold che `resolveData`/external fields e la forma payload restino invariati nella 0.21 (attesi compatibili, ma da riconfermare).

### F2 — [MEDIUM] `create-better-t-stack 3.37.0` non esiste ancora

- **Dove:** sezione Stack (`create-better-t-stack (scaffold) | 3.37.0`).
- **Realtà verificata (web, lug 2026):** l'ultima versione pubblicata su npm è **3.36.5** (pubblicata pochi giorni fa). La **3.37.0 non risulta pubblicata** — è un numero di versione futuro/inesistente, tipico artefatto da training data.
- **Impatto:** un pin a una versione inesistente rompe lo scaffold; sintomo che questa specifica riga non è stata reality-checked.
- **Raccomandazione:** usare `create-better-t-stack@latest` (oggi 3.36.5) e togliere il pin puntuale, oppure pinnare 3.36.5.

### F3 — [MEDIUM] AD-7: la citazione dell'issue Prisma #29386 è reale ma il razionale la applica al pattern sbagliato

- **Dove:** AD-7 — «gli indici parziali in Prisma v7.4 sono preview e hanno un bug noto sui partial unique varchar, issue #29386, proprio sul pattern `status='PUBLISHED'`».
- **Realtà verificata (web, lug 2026):**
  - `partialIndexes` **è** un preview feature introdotto in **Prisma 7.4.0** (blog ufficiale + release notes). Corretto.
  - L'**issue #29386 esiste ed è reale**: loop infinito di migration (no-op DROP+CREATE ad ogni `migrate dev`) su partial unique index con colonna `@db.VarChar` — **ma solo con predicato di NEGAZIONE** (es. `{ not: "superseded" }`), a causa dei cast `::text` che Postgres aggiunge e che il differ Prisma non normalizza. L'issue afferma **esplicitamente** che i **predicati di uguaglianza** (proprio come `status='PUBLISHED'`) e le colonne `String` semplici **funzionano correttamente**.
  - Il bug su predicati di *uguaglianza* era il precedente **#29263**, **già risolto in Prisma 7.5.0**.
- **Impatto:** la giustificazione tecnica di AD-7 è inaccurata: attribuisce a `status='PUBLISHED'` (uguaglianza) un bug che riguarda la *negazione* su varchar. Sul pattern effettivamente usato dallo spine, il DSL Prisma odierno (7.5+) **non** ha quel bug.
- **Nota:** la **decisione architetturale** di AD-7 (indice unico parziale come backstop autoritativo del DB, applicato via migration SQL esplicita, promote/demote in transazione unica) resta **sana e prudente** a prescindere — usare SQL esplicito evita di dipendere da un preview feature ed è difendibile. Va corretto solo il *razionale citato*: aggiornare a "bug #29263 (uguaglianza) risolto in 7.5; #29386 (negazione su varchar) tuttora aperto — preferiamo comunque migration SQL esplicita per non dipendere da un preview feature".

### F4 — [LOW] Next.js "15+ (RSC stabile)" è stale: la corrente è 16.x

- **Dove:** Stack (`Next.js (App Router) | 15+ (RSC stabile)`).
- **Realtà verificata (web, lug 2026):** **Next.js 16** è stabile da ottobre 2025; la corrente è **16.2.11** (rilasci di sicurezza a luglio 2026). "15+" tecnicamente include la 16, quindi non è *sbagliato*, ma indica come baseline una major superata. React 19 come richiesto da Next resta corretto.
- **Raccomandazione:** portare la baseline a **Next.js 16+** per allinearsi al corrente/consigliato.

### F5 — [INFO] Pin minori da riconfermare allo scaffold

- **Prisma "7.4+":** ok, ma la corrente è **7.5+** (dev fino a 7.10); 7.5 ha risolto #29263. Suggerito "7.5+". Nota: Prisma ha annunciato "Prisma Next" (mar 2026), ma Prisma 7 resta la versione raccomandata per produzione.
- **Tailwind "4":** corretto e corrente (ultima 4.3.x a lug 2026).
- **create-better-t-stack:** vedi F2.

---

## Affermazioni verificate CORRETTE (nessuna azione)

| Affermazione nello spine | Esito verifica web (lug 2026) |
| --- | --- |
| React 19 | Corretto/corrente (19.2.x). |
| PostgreSQL 18 | Corretto/corrente (GA set 2025, patch 18.4 a mag 2026). |
| Better Auth = identità + ruolo grossolano; plugin **admin** (ban/impersonate), **organization**, **access-control** | Confermati esistenti. |
| Better Auth come issuer **OIDC/JWT** (Deferred) | Confermato: plugin **OIDC Provider** + integrazione **JWT plugin** (firma asimmetrica, JWKS). Il rinvio in Deferred è corretto. |
| oRPC per editor→dominio con **contratto OpenAPI derivato** | Confermato: `@orpc/openapi` genera lo spec dal router; supporta OpenAPI 3.1.1 + Zod. |
| Puck: `resolveData` / **external fields** per dati esterni server-side (AD-10) | Confermati come API reali di Puck (resolveData async su ComponentData; external fields con filtri/mapRow). Vedi però F1 sul nome pacchetto/versione. |
| Puck payload forma `{content, root, zones}` (AD-6) | Coerente con il modello dati Puck. |
| Next ISR + **`revalidateTag`** su publish (AD-9) | Confermato: `revalidateTag()` server-side (Server Action/Route Handler), semantica stale-while-revalidate — calza col flusso publish→invalidazione. |
| Tailwind CSS 4 | Corretto/corrente. |
| Prisma `partialIndexes` preview esiste in 7.4 | Confermato (community-contributed, dietro preview flag). |

---

## Sintesi

Lo spine dimostra un buon livello di reality-check: la parte "difficile" (capacità dei plugin Better Auth, generazione OpenAPI di oRPC, API `resolveData`/external fields di Puck, semantica `revalidateTag`, esistenza del preview `partialIndexes`) è tutta **corretta e web-verificabile**, non asserita a vuoto. I problemi si concentrano su **attualità dei pin** e su **una citazione di bug applicata al caso sbagliato**:

1. **F1 (HIGH)** — Puck deprecato → migrare a `@puckeditor/core` (0.21+).
2. **F2 (MEDIUM)** — `create-better-t-stack 3.37.0` inesistente → usare 3.36.5/`@latest`.
3. **F3 (MEDIUM)** — razionale AD-7: #29386 è su *negazione* varchar, non su `status='PUBLISHED'`; #29263 (uguaglianza) già fixato in 7.5. Decisione architetturale comunque valida.
4. **F4 (LOW)** — baseline Next.js a 16+.
5. **F5 (INFO)** — Prisma 7.5+, riconferme minori.
