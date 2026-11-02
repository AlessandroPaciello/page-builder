---
title: 'Ricerca nella Multiselect: celle `search` e asse sul contratto'
type: 'feature'
ticket: '37'
created: '2026-11-01'
status: 'done'
baseline_revision: '888ec69effa3e5b0aca6df947c1a67cfc62237dd'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** la Multiselect composta non mostra mai la ricerca: tutte le celle della composizione usano il pannello con `search=false`, quindi dal blocco `multiselect` la ricerca non si può accendere. Il pannello ha già l'asse `search` con le quattro celle e la ricerca disegnata; manca l'asse sulla composizione, e nel file Penpot vero (non la copia della prova della 2.39).

**Approach:** si applica la procedura DC della 2.39 al file Penpot vero — asse `search` sulla composizione, `false` sulle 12 celle esistenti, pannello `search=true` nelle due celle aperte `md` e `sm` — e solo dopo che il disegno lo mostra si aggiunge l'asse `search` (`false`, `true`, default `false`) al contratto `multiselect`. La versione dello schema resta 6 e la sua voce di fingerprint si riscrive, perché la 6 non è su `main`. Il blocco Puck che lo mostra come campo non esiste ancora: arriva con l'epica 3, che legge gli assi dal contratto.

**Decisioni (2026-11-02):**
- **Celle base:** si aggiungono due celle base per `search=true` (`md` e `sm`, `open=false`, `display=chips`, `state=default`), visivamente identiche alle chiuse, perché senza di loro `verify_component` dà «Cella di rendering senza la cella base» appena il container riceve `pagebuilder/contract`. Il disegno passa a 14 celle.
- **File vero:** la scrittura va sul file Penpot «tailwind» (non «tailwind (copia)», la prova della 2.39), con la conferma della procedura prima di scrivere.
- **Campo del blocco:** la 2.37 consegna design e asse sul contratto; il campo nel blocco Puck arriva con l'epica 3 (3.2), che legge gli assi dal contratto. Nessuna voce separata.

</frozen-after-approval>

## Implementation Notes
- 2026-11-02 — Disegno sul file Penpot «tailwind» (quello vero, non «tailwind (copia)»): il container `Multiselect` aveva già gli assi `size, open, display, state, search` con `search=false` su 10 celle e `true` sulle due aperte `md`/`sm`. Aggiunte le due celle base mancanti `md` e `sm` (`open=false`, `display=chips`, `state=default`, `search=true`), clonate dalla cella chiusa `search=false` corrispondente e posizionate sotto il blocco `sm` (5254, 1010 e 5254, 1074). Rilettura: 14 varianti, nessun `variantError`, nomi «Multiselect» e token `rowGap=spacing.1` invariati; `describe_component` legge `search` su tutte le 14 celle, `verify_component` dà il solo blocco «manca il contratto».
- 2026-11-02 — Il clone di una main instance dentro il container si registra da solo come variante (eredita le proprietà e riceve un valore nuovo per `search`, «Value 3»): non serve `createComponent` + `appendChild`, che sul clone fallisce con «Cannot create a component from the given shapes». Basta clonare e poi `setVariantProperty`; il valore provvisorio sparisce quando nessuna variante lo usa.
- 2026-11-02 — Contratto: asse `search` (`false`/`true`, default `false`) su `multiselect`; note aggiornate in `multiselect-panel.ts`, `rendering.ts` e nella voce 6 di `schema-version.ts`; voce 6 del fingerprint riscritta con l'hash nuovo (la 6 non è su `origin/main`). Test aggiornati: `components.test.ts` (assi), `verify.test.ts` (props schema), `group-variants.test.ts` (matrice `size × search × open × display`), `generate.test.ts` (`MultiselectAxes`).
- 2026-11-02 — Evidenza del requisito 1 sul file vero: nelle due celle aperte il pannello annidato ha variante `{content: options, search: true}` (verificato con `penpot.execute_code` sui figli delle 14 celle); le chiuse hanno il solo trigger.
- 2026-11-02 — Decisione A/A dopo la review: il pannello ha le sue quattro celle `content × search`, quindi `search` entra anche nel contratto `multiselect-panel` (stesso asse, default `false`) e la composizione lo passa come prop; per lo stato si aggiungono due celle `error` a `search=true` (`md` e `sm`, `open=false`, `chips`) clonate dalle celle `error` chiuse, così le classi di stato restano nella base. Disegno a 16 celle, 0 `variantError`; riferimento della skill `pds-design` aggiornato (contratto e nomi delle celle) nelle tre copie; test nuovi: pannello come asse, istanza del pannello con `search` → prop, classe di stato di `search` nella base.

## Review Triage Log

Pass 1 (quick): 0 high, 4 medium, 2 low, 1 false.

| Verdetto | Rotta | Esito |
|---|---|---|
| medium | HALT | Assi dell'istanza annidata: `read-component.ts:292` porta i `variantProps` del pannello in `instance.variant` e `verify.ts:487-491` blocca ogni asse non nel contratto annidato. Riprodotto con una Lettura di prova: «Istanza di "multiselect-panel": l'asse "search" non è nel contratto». **Risolto con A:** asse `search` aggiunto a `multiselect-panel`, istanza accettata e passata come prop (test in `verify.test.ts`). |
| medium | HALT | Stati: `verify.ts:750-765` generalizza le celle di stato alle celle base con tutti gli assi di contratto uguali, e le celle base `search=true` non hanno celle `error`. Riprodotto: `[&[aria-invalid=true]]:bg-destructive` finisce in `variants.search.false`. **Risolto con A:** due celle `error` a `search=true` nel file vero, e un test in `generate.test.ts` che pretende la classe nella base. |
| medium | defer | Nessun test modella `search` (`multiselectLettura` non ha celle search): **risolto** con tre test (pannello come asse, istanza con `search` → prop, stato di `search` nella base). |
| low | defer | L'AC2 del ticket dice «due celle con `search=true`», ora sono quattro (16 celle in tutto): il ticket è del PO e la build non lo scrive; resta da aggiornare. |
| low | patch | L'Intent dice che sul file vero «manca l'asse»: la lettura live mostra che c'era già, e il pannello annidato `search=true` è verificato. Aggiunta la nota nelle Implementation Notes. |
| medium | HALT | Riferimenti della skill `pds-design` (`contract-from-design.md:48`, esempio di nome cella in `draw-component.md:21`) dicono ancora che `search` non è un asse; **risolto**: aggiornati nelle tre copie, `diff -r` vuoto. |
| false | — | La voce vecchia di `deferred-work.md` sarebbe «non chiusa»: il file è append-only e la chiusura è una voce nuova, come per la 2.33; modificare le voci esistenti è vietato dal workflow. |


## Verification

**Commands:**
- `pnpm --filter @app/contracts test` — expected: verde, incluso il fingerprint della versione 6
- `pnpm --filter @penpot-ds/scripts test` — expected: verde
- `pnpm check-types` && `pnpm lint` — expected: verdi

**Manual checks (if no CLI):**
- `describe_component { name: "Multiselect" }` sul file vero — expected: `search` su ogni cella, `true` nelle due celle aperte `md`/`sm` col pannello `search=true`
- `verify_component { name: "Multiselect" }` — expected: l'unico blocco è la mancanza di `pagebuilder/contract`
