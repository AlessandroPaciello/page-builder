# MS — Modifica struttura

Il disegno in Penpot è cambiato (un asse in più, una parte nuova, una sezione che ammette un altro componente) e il contratto dell'editor deve seguirlo. MS legge Penpot, confronta col contratto, mostra il diff e scrive solo dopo il sì.

Un cambio di **aspetto** (un colore, un raggio, una spaziatura, una token) non passa da qui: è già in Penpot e lo porta in codice `pds-code` AC.

## Confronto

1. Leggi il contratto attuale: `packages/contracts/src/components/<nome>.ts` (o `sections/<nome>.ts`) e la voce del `registry.ts`. Annota `version` e `SCHEMA_VERSION`.
2. `describe_component { name }` sul server `pds` (nome del contratto o del layer). Se la lettura fallisce, fermati: senza lettura non c'è diff.
3. Metti in tabella solo le differenze che riguardano il vocabolario dell'editor:

| Cosa | Da Penpot | Cosa proporre |
|---|---|---|
| assi | chiavi di `variant` (tranne `state` e gli assi di rendering dichiarati in `packages/scripts/src/core/rendering.ts`: `open`, `display`, `removable`, `checked`, `content`), valori, cella base | asse/valore **aggiunto** in Penpot → nuovo valore (o nuovo asse) nel contratto; valore che il contratto ha e Penpot non disegna più → **avviso**, non rimozione automatica |
| field | celle con un testo che ora cambia per pagina, o una lista | field nuovo (nome, tipo, `structure`/`content`) o `.optional()`; un field che non ha più una parte nel disegno → avviso di field morto |
| slot (sezioni) | istanze dentro uno slot | `allow` da estendere o restringere, `max` se dichiarato; un annidato non ammesso è una proposta esplicita |
| struttura/contenuto | un field `structure` con un asse omonimo in Penpot | la classificazione `structure` e la cella corrispondente |

Le parti non sono nel contratto: se sono cambiate, il diff lo dirà `pds-code` VC, non MS.

4. Dai a ogni riga il file e la riga da toccare (`packages/contracts/src/components/<nome>.ts:12`) e il verso (`values: [...] → [...]`). Un cambio che tocca un valore o un field che una pagina salvata può usare è **incompatibile**: regola A, anche `version` + 1, e il plugin data `nome@versione` in Penpot andrà riallineato da `pds-code`.

## Proposta e scrittura

Mostra la tabella, il diff del contratto e degli altri file, **elencando ogni file che scriverai** (registry, `index.ts`, `SCHEMA_VERSION`, fingerprint, `packages/contracts/tests/components.test.ts`; per una sezione l'elenco in `section.test.ts`), più la frase esplicita «questo cambio è compatibile / incompatibile». Una domanda sola. Se cambia qualcosa, rifai il diff. Un file che non era nell'elenco non si scrive; un file che cambia dopo il sì richiede un nuovo sì.

Dopo il sì scrivi seguendo `references/contract-rules.md` (bump, voce del fingerprint, `pnpm --filter @app/contracts test` verde, `pnpm check-types`, `pnpm lint`).

## Poi

Di' cosa resta a `pds-code`: AC rigenera `styles.ts` e propone al massimo il diff del componente dello sviluppatore; se il contratto ha alzato `version`, il plugin data va riallineato in Penpot con la conferma. Tu non scrivi né l'uno né l'altro.

## Non fai

- Non scrivi su Penpot e non scrivi plugin data.
- Non tocchi `packages/scripts`, i file `@generated` o il componente dello sviluppatore.
- Non riscrivi una voce **rilasciata** di `contracts.fingerprint.json` (una versione mai rilasciata si riscrive, con il sì).
- Non rimuovi valori o field «per pulizia»: una rimozione è un cambio incompatibile e va approvata come tale.
