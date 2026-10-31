# Da v1 a v2: cancella e rigenera

Companion di [SPEC.md](./SPEC.md) (CAP-10, CAP-11). Ordine deciso nella forge del 2026-09-16 e rivisto lo stesso giorno: i componenti v1 non migrano, si cancellano e rinascono in v2.

## Ordine

1. **Fondamenta** in `packages/scripts/src/v2`: CAP-1 (contratto ridotto, `SCHEMA_VERSION`), CAP-2 (`defineExtraction`), CAP-3 (registro con layout e posizione), CAP-8 (guscio ed errore). La v1 resta intatta e verde.
2. **ProductCard** (CAP-10): contratti, `library add`, disegno, `extract`, `render`, `gates`. Primo giudizio visivo di Alessandro in Storybook. Da qui in poi diff zero in CI per la card.
3. **Rimozione v1** (CAP-11, prima metà): cartelle `data/judgments`, `data/bindings`, `data/designs`, `data/bases`, `data/recipes`; comandi v1 in `package.json`; codice v1; i quattro componenti generati in `packages/ui/src/domains/*`; `shadcn` e Radix dalle dipendenze; `src/v2` si appiattisce in `src`.
4. **Rigenerazione** (CAP-11, seconda metà), uno alla volta: Badge, Input, Alert, AccordionItem (ultimo, verifica pratica di Base UI). Per ciascuno: contratto del page builder ridotto, contratto di estrazione scritto dai file v1 cancellati (judgment + binding letti dalla storia git), `extract`, `render`, diff zero.
5. **Skill `pds-*`** riscritte sui sei comandi (citano `verify:library` 26 volte, `add:library` 14, `gates:render` 11, `adopt:variant` 10, `sync:design` 8, `extract:component` 8, `bump:contract` 8, `bootstrap:library` 8, `role:part` 4, `render:component` 4).

## Criterio di accettazione

Uno solo, per ogni componente, card inclusa: `extract` e `render` verdi, test generati e axe verdi, diff zero in CI dal primo commit. Nessun confronto con la v1: non esiste più.

## Cosa cambia fuori da `packages/scripts`

- `@app/contracts`: `parts`, `partRoles`, assi `state`/`behavior` rimossi; fingerprint e `SCHEMA_VERSION` aggiornati; `defineContract` perde i controlli sulle parti.
- `packages/ui`: quattro componenti cancellati e rigenerati; `shadcn`, `radix-ui`, `@radix-ui/react-accordion` escono; entra `@base-ui/react`; nessun file a mano.
- `apps/web`: la finestra tra il passo 3 e il passo 4 lascia `packages/ui` senza i quattro componenti; nessun consumatore oggi (Epic 3 non è iniziata), da ricontrollare al momento.
- Documenti: AD-11 e `penpot-pipeline.md` (Stadio 2, tre artefatti, emitter shadcn, ruolo nel contratto) via correct-course; Story 2.11 e 2.12 riposizionate dopo la v2.
