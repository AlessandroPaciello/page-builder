# Retrospettiva — Epic 1: Fondamenta e accesso

Data: 2026-09-06
Partecipanti: Alessandro (Project Lead), Amelia (Developer, facilitatrice), Alice (Product Owner), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev)

## Riepilogo epic

- Story completate: 6/6 (100%) — 1.1 Scaffolding, 1.2 Dominio esagonale, 1.3 Modello dati + invariante DB, 1.4 Auth RBAC, 1.5 Context oRPC + Principal, 1.6 Envelope Docker + migration
- Periodo: 2026-07-26 → 2026-09-06
- Blocchi architetturali incontrati: 1 (AD-11, risolto via Sprint Change Proposal)
- Debito tecnico tracciato in `deferred-work.md`: ~19 voci originate durante l'epic, la maggior parte chiuse o ri-mirate con precisione a una story successiva specifica
- Deploy reale: nessuno ancora — solo verifica E2E su `docker compose` locale (AD-7 verificato in `pg_indexes`, idempotenza, fail-closed su DB irraggiungibile)

## Successi

1. **Debito tecnico tracciato con precisione chirurgica.** Ogni voce di `deferred-work.md` porta origine (quale review, quale story), destinazione (quale story futura la riprenderà) e motivazione. Su 6 story, nessuna voce risulta persa o dimenticata — tutte le voci aperte in Story 1.1 sono state richiuse o ri-mirate esplicitamente nelle story successive (1.2 → test/CI, 1.4 → hardening auth, 1.5 → CSRF, 1.6 → deploy/security).
2. **Gate verificati rosso→verde sistematicamente**, mai dati per assunti: boundary check `domains/` ↛ `editor/`, invariante DB AD-7 (pubblicazione unica), guard Origin/CSRF, drift check schema↔migrations. Ogni gate critico ha un momento documentato in cui è stato dimostrato che fallisce prima di essere dimostrato che passa.
3. **La decisione architetturale critica (AD-11) è stata gestita correttamente**: bloccata esplicitamente come "decision needed" in code review, escalata via Sprint Change Proposal, risolta da Alessandro, non aggirata né rimandata silenziosamente.
4. **Il debito di sicurezza è stato chiuso nella story che aveva il contesto giusto**, non subito alla prima occasione: CSRF rimandato a 1.5 (prima mutation reale), hardening auth (rate limit, password policy) a 1.4, trustedProxies/SameSite/email verification all'envelope reale in 1.6. Rimirare invece di risolvere prematuramente ha evitato di indovinare male le API prima che il contesto reale esistesse (lezione esplicita già in Story 1.2 sul repository concreto).

## Aree di attrito

1. **I gate "bloccanti" alla prima stesura erano quasi sempre aggirabili.** `check-boundaries.mjs` di `packages/ui` è stato bypassato da un import multi-riga (la forma di default di un formatter, già presente nel repo); quello di `packages/api` non copriva i path relativi verso `db`; il gate della reference OpenAPI leggeva `NODE_ENV` in un modo fail-open. **Nessuno di questi script ha oggi un test automatico proprio** — solo canary manuali, verificati a mano ogni volta e registrati due volte come deferred (Story 1.2, Story 1.5) senza mai essere risolti.
2. **Bookkeeping disallineato dopo le decisioni**: Story 1.1 ha richiesto 3 correzioni di documentazione (semver TypeScript, sotto-task non aggiornato dopo la decisione, file mancante dal File List) trovate solo in review, non prima.
3. **`next-env.d.ts` flip-flop dev↔build**, emerso dopo il merge di Story 1.6 (2026-09-06): rumore non bloccante ma da tenere d'occhio se cresce di fastidio.

## Anteprima Epic 2 — Design system: token e componenti da Penpot

Nessuna scoperta di Epic 1 richiede di riscrivere la definizione di Epic 2 — l'epic è già stato aggiornato durante la Sprint Change Proposal su AD-11. Epic 2 è però il primo banco di prova reale del regime `fixture → ricetta → renderer puro`.

**Dipendenze dirette da Epic 1:**
- `packages/ui` con `domains/` + `editor/` e lint di confine bloccante: pronto da Story 1.1, mai popolato con contenuto reale finché Story 2.4 non arriva.
- Namespace `@penpot-ds/ui` e regola "niente Radix fuori da `domains/**`": già nello Spine (AD-11), non ancora esercitata da codice.

**Debito deferred che diventa rilevante ora:**
- Alias shadcn puntati al barrel `editor/index.ts` invece che a una directory — innocuo finché nessuno lancia il CLI shadcn. **Nota di correzione (2026-09-06, creazione Story 2.3)**: si materializza già in **Story 2.3** (Task 0), non in 2.4 — l'AC #1 di 2.3 richiede esplicitamente `npx shadcn add <comp>` per ottenere la base del renderer, prima che Story 2.4 generalizzi ai sei domini.
- Robustezza del dropdown-menu scritto a mano (focus trap, portal/collision detection, ARIA) — deferred esplicitamente a quando `domains/` genera il primitivo reale.
- A11y dei form di auth (`aria-invalid`, live region) — rimandata alla riscrittura delle primitive accessibili di questo epic.

**Segnale critico da sorvegliare:** Story 2.3 ha un criterio di stop esplicito nell'AC — se la ricetta di Accordion smette di essere una tabella piatta e diventa un albero annidato, la story si ferma e il regime AD-11 si rivaluta. Non è una novità emersa oggi, ma il punto in cui la decisione presa durante Epic 1 viene davvero messa alla prova. **Nota correct-course 2026-09-12:** il criterio è stato riformulato e meccanizzato in `RecipeSchema` (Story 2.5: una parte annidata con assi propri fa fallire lo schema); il renderer è ora la Story 2.6 e i gate CI sono 5.

## Azioni concrete

**Critiche, prima di iniziare Story 2.1:**
1. Aggiungere test automatici rosso/verde per gli script di boundary-check esistenti (`packages/ui/scripts/check-boundaries.mjs`, `packages/domain/scripts/check-boundaries.mjs`, `packages/api/scripts/check-boundaries.mjs`), sostituendo la verifica a canary manuale. Motivazione: due dei tre script hanno già avuto bypass reali trovati solo in review; una regressione futura potrebbe restare verde in silenzio.

**Da applicare durante Epic 2:**
2. Estendere la stessa disciplina "test del gate, non solo canary" ai 4 nuovi gate CI introdotti da Story 2.3 (completezza artefatti, rigenerazione, a11y con vitest-axe, drift fixture vs Penpot) fin dalla loro introduzione, non a posteriori.
3. Sorvegliare esplicitamente il criterio di stop di Story 2.3 (Accordion) come checkpoint di validazione del regime AD-11.
4. Alias shadcn (`components.json`) da correggere in **Story 2.3** (Task 0), quando il renderer inizia a usare il CLI shadcn per davvero — non attendere la 2.4 (vedi nota di correzione sopra).
5. Dropdown-menu hand-rolled: rivalutare la sua robustezza quando Story 2.4 genera il primo primitivo reale via Radix.

**Non bloccanti, restano in `deferred-work.md`:**
- Deploy reale (staging/produzione): rimandato, non è prerequisito per Epic 2 (design system, non envelope).
- `next-env.d.ts` flip-flop: monitorare, nessuna azione ora.

## Readiness assessment

- Testing & qualità: 66 test verdi su tutti i package, CI comprensiva (check-types, lint, test, build, drift check, docker smoke) — solido.
- Deployment: solo locale, nessun deploy reale — accettato come non bloccante per Epic 2.
- Debito tecnico: tracciato e attuale, nessuna voce orfana.
- Salute tecnica: buona: nessun blocco strutturale nuovo; il rischio principale identificato (gate senza test propri) è ora un'azione esplicita.

## Prossimi passi

1. Eseguire l'azione critica (test dei boundary-check) prima di `create-story` per Story 2.1.
2. Iniziare Epic 2 con Story 2.1 (pipeline token Penpot→codice) una volta completata la prep.
3. Tenere d'occhio il segnale di stop di Story 2.3 durante l'esecuzione.
