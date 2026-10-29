# Rubric Walker Review — ARCHITECTURE-SPINE (page-builder)

- **Target:** `../ARCHITECTURE-SPINE.md`
- **Altitudine:** feature
- **Contesto valutato:** SPEC + companions in `_bmad-output/specs/spec-page-builder/` (SPEC, design-system, penpot-pipeline, rbac-matrix, a11y-baseline, glossary)
- **Data:** 2026-07-25
- **Verdetto:** **CONCERNS**

## Sintesi

La spine è densa, ben strutturata e allineata allo SPEC: 11 AD che coprono i seam critici (unico punto di mutazione nel core, RBAC deny-by-default nel dominio, schemi Zod + classifier condivisi FE/BE, id di blocco stabili, invariante ≤1 PUBLISHED enforced dal DB, CommerceProvider come astrazione, pipeline Penpot preservata). La Capability→Architecture Map copre tutte e 14 le CAP. Il Deferred è pulito: ogni voce differita ha un seam che impedisce la divergenza. Nessun problema fatale.

Restano però alcune dimensioni non completamente chiuse che, all'altitudine feature, possono lasciar divergere due epic sotto: l'**envelope operativo** è quasi muto oltre il container Docker; il **modello di assegnazione Cliente↔pagina** — dato di dominio su cui poggia la RBAC fine — non è fissato come invariante/entità; e la lingua del seed ("packages/* restano invariati") è in tensione con la realtà greenfield (workspace vuoto) e con AD-11/CAP-1-2 che li **generano**. Da qui il verdetto CONCERNS.

## Checklist

### 1. Fissa i veri punti di divergenza per l'epic e non ne manca nessuno? — CONCERNS

I punti di divergenza portanti sono tutti fissati e mappati sulle CAP. Due lacune degne di nota:

- **[MEDIUM] Modello di assegnazione Cliente↔pagina non fissato.** AD-4 tratta "questo Cliente è assegnato a questa pagina?" come dato di dominio deciso dal core, ma né gli AD né le Consistency Conventions (Naming entità: solo `Page`/`PageVersion`/`AuditLog`) fissano *dove/come* vive questa relazione (entità, colonna, tabella-ponte). Lo SPEC mette fuori scope solo la **UI di gestione avanzata**, non il concetto — che resta capability attiva (CAP-12, rbac-matrix). Due epic — quella RBAC e quella save-content-only del Cliente — devono concordare sulla stessa forma dati; oggi non c'è un invariante che la vincoli. Rischio di divergenza reale.
- **[LOW] Evoluzione/migrazione del payload versionato non trattata.** AD-6 introduce `schemaVersion` nel payload ma nessuna Rule dice cosa succede quando cambia lo schema di un blocco: come rende il render un payload persistito con `schemaVersion` precedente? L'epic authoring e l'epic render potrebbero assumere contratti diversi. Fissarlo o differirlo esplicitamente.

### 2. Ogni Rule degli AD è enforceable e previene davvero la divergenza dichiarata? — PASS

Le Rule sono operative e verificabili, non aspirazionali. AD-1 (ogni mutazione via caso d'uso; niente CRUD auto-generato) e AD-4 (principal passato al core, deny-by-default) si rinforzano e danno copertura totale enforceable. AD-7 àncora l'invariante ≤1 PUBLISHED a un indice univoco parziale Postgres via migration SQL esplicita — enforcement autoritativo, non applicativo, con razionale specifico (bug Prisma preview #29386). AD-5 (single source Zod+classifier con default fail-safe `content`) previene concretamente il drift structure/content. Enforcement solido.

### 3. Niente sotto Deferred potrebbe lasciar divergere due unità? — PASS

Ogni voce differita ha un seam che tiene la scelta aperta senza costo di divergenza: sorgente commerce concreta dietro AD-10/CommerceProvider; provider DB/hosting dietro Prisma/Postgres + envelope Docker; Better Auth come issuer OIDC attivabile in futuro; migrazione dati legacy fuori scope SPEC; envelope perf da misurare. Nessun differimento lascia due unità libere di scegliere contratti incompatibili.

### 4. Tech nominata verificata-corrente (plausibilità/coerenza)? — PASS

Lo stack è plausibile e internamente coerente per lug 2026: Next 15+ (RSC stabile), React 19, Postgres 18, Prisma 7.4+, Tailwind 4, Puck ~0.20, pnpm 10, Turborepo 2, create-better-t-stack 3.37.0. Il caveat "verificate come correnti al 2026-07-25; da riconfermare allo scaffold" è appropriato e i pin sono trattati come seed. La nota su Prisma 7.4 (indici parziali ancora preview, bug #29386) è specifica e coerente con la scelta di AD-7 di usare migration SQL esplicita anziché il DSL. Dettaglio delegato correttamente.

### 5. Greenfield: ratifica coerentemente il design system esistente invece di contraddirlo? — CONCERNS

Il *design* del design system è ratificato con coerenza: layering `tokens ← primitives ← {puck-components, ui}`, regola di confine (le primitive non conoscono il dominio, non importano da `ui`), catalogo e slot — tutto combacia con `design-system.md`. AD-3 blinda "consuma il design system, non uno stack UI parallelo".

- **[LOW-MEDIUM] Tensione "invariati" vs greenfield reale.** Il Structural Seed dichiara "i `packages/*` del design system restano **invariati**", ma il workspace è **vuoto**: nessun `packages/`, nessun `apps/`, nessun `package.json` (solo `docs/` come riferimento legacy ereditato). I package esistono nella codebase di *riferimento*, non qui. Inoltre CAP-1/CAP-2 e AD-11 richiedono di **generare** token e componenti dalla pipeline Penpot. La parola "invariati/restano" presume un artefatto presente e immutato, e potrebbe indurre un epic a "non toccare/non creare" ciò che invece va portato/generato. Riconciliare: chiarire che il *layout e i confini* del design system sono ratificati dal riferimento, mentre gli artefatti vanno (ri)generati/importati nel nuovo workspace.

### 6. Copre le CAP-1..CAP-14? C'è una capability senza casa? — PASS

Tutte e 14 le CAP hanno "Lives in" + "Governed by" nella Capability→Architecture Map, più la riga integrazione commerce. Nessuna capability orfana. Il binding front-matter elenca CAP-1..CAP-14. Corrispondenza piena con lo SPEC.

### 7. Ogni dimensione dell'altitudine 'feature' è decisa/deferred/aperta? Envelope operativo coperto e non in silenzio? — CONCERNS

Deployment è parzialmente coperto (container Docker self-host, Next standalone, ISR via cache handler standard) e infra/provider è **esplicitamente differito** (Neon/Supabase/self-managed, orchestratore) — corretto. Ma:

- **[MEDIUM] La dimensione "operations" è quasi muta.** Oltre al container non c'è parola su: osservabilità/logging/error-monitoring, gestione secret/config, **come e quando gira la migration SQL** dell'indice parziale al deploy (proprio quella che AD-7 rende load-bearing), backup/DR, pipeline CI/CD, ambienti oltre a "dev su Docker Postgres" (staging/prod non nominati). Parte è legittimamente sotto l'altitudine feature, ma l'envelope operativo come dimensione non dovrebbe restare in silenzio: almeno dichiarare cosa è deciso vs differito. In particolare il momento di esecuzione della migration parziale è un contratto operativo che tocca l'invariante centrale.

### 8. Coerenza interna: gli AD si contraddicono tra loro o con convention/diagrammi? — CONCERNS (nit minori)

Nessuna contraddizione sostanziale; AD, conventions e diagrammi sono per lo più allineati (stati lifecycle coerenti tra a11y-baseline e conventions; il grafo delle dipendenze consentite combacia con AD-3; commerce risolto server-side a render-time coerente con `web→core→commerce` senza far importare CommerceProvider ai blocchi). Due nit:

- **[LOW] "Core estraibile" vs collocazione in `apps/web/src/server/domain/`.** AD-2/conventions promettono un core "estraibile" in "modulo/package separato"; il Structural Seed lo mette *dentro* `apps/web`. È separato dagli adapter per directory (accettabile come "modulo"), ma l'estrazione futura richiede comunque di spostarlo fuori dall'app — la promessa di estraibilità è indebolita rispetto a un `packages/domain` a sé. Coerente ma vale un chiarimento.
- **[LOW] Vedi punto 5:** "packages invariati" vs CAP-1/2/AD-11 che li generano è anche una micro-incoerenza interna della spine.

## Findings (severità)

| # | Punto | Severità | Finding |
|---|---|---|---|
| F1 | 7 | MEDIUM | Envelope operativo quasi muto: operations (logging/monitoring, secret, backup, CI/CD), ambienti staging/prod e soprattutto *quando gira la migration SQL* dell'indice parziale non dichiarati (né decisi né differiti). |
| F2 | 1 | MEDIUM | Modello di assegnazione Cliente↔pagina non fissato come entità/invariante, pur essendo dato di dominio load-bearing per la RBAC fine (AD-4). Rischio divergenza tra epic RBAC e epic save-content. |
| F3 | 5 / 8 | LOW-MEDIUM | "packages/* restano invariati" in un workspace vuoto e in tensione con CAP-1/2/AD-11 che li generano: chiarire ratifica-del-design vs (ri)generazione-degli-artefatti. |
| F4 | 1 | LOW | Nessuna Rule sull'evoluzione/migrazione del payload versionato quando cambia `schemaVersion` (contratto authoring↔render). |
| F5 | 8 | LOW | Core in `apps/web/src/server/domain/` indebolisce la promessa "estraibile" di AD-2 (vs `packages/domain`). |

## Raccomandazione

CONCERNS: la spine è solida sui seam critici e può reggere l'entrata negli epic, ma prima conviene (a) fissare il modello di assegnazione Cliente↔pagina (F2), (b) chiudere esplicitamente l'envelope operativo almeno dichiarando deciso/differito e il momento della migration parziale (F1), e (c) riallineare la lingua "invariati" alla realtà greenfield (F3). F4/F5 sono note minori.
