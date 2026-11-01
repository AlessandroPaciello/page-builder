# CN — Contratto nuovo

Da una ricetta a un contratto dell'editor approvato. È l'unico punto in cui nasce un file in `packages/contracts`; tutto il resto lo leggerà Penpot. La ricetta serve a non partire da zero: dà parti, assi e comportamento di riferimento, non la verità del contratto.

## Ricetta

Ordine di ricerca:

1. `_bmad-output/spikes/penpot-ai-kit-2026-10-10/recipes/<nome>.md` (ci sono `card.md` e `carousel.md`, ricavate dai sorgenti shadcn `base`, v4).
2. La sorgente shadcn del componente, chiesta all'utente o letta dal repo se c'è: la ricetta è la sintesi di parti, assi e comportamento con l'API headless, non il codice da copiare.
3. Il pattern APG, se il componente è di interazione e non c'è una ricetta shadcn.

Se non trovi niente di questi tre, dillo e fermati: un contratto inventato è peggio di un contratto mancante.

## Domande (una volta, con una proposta per ognuna)

1. **Componente o sezione?** Se il contenuto lo compone chi usa l'editor (almeno uno slot), è una **sezione**; se è un pezzo chiuso, un componente.
2. **Assi e valori.** Quali scelte hanno un senso per l'editor (assi `option`, con default)? Vale il criterio di P3 (`contract-from-design.md`): `state` e i valori che cambiano senza che chi compone tocchi la pagina (`open`, `checked`, `value`, `content`, `display`, `removable`) non sono assi `option` — restano in Penpot, e se il disegno non ha le celle non si aggiungono.
3. **Field.** Quali testi o valori scrive chi compone la pagina? Uno per uno: nome, tipo (stringa, url, numero, intero, booleano, lista di stringhe, enum), obbligatorio sì/no.
4. **Struttura o contenuto.** Cosa cambia il disegno (`structure`) e cosa è solo testo da mostrare (`content`)? Un field `structure` con lo stesso nome di una proprietà di variante in Penpot diventa l'asse delle celle: chiedi anche quali valori disegnerà (`perView` 1/2/3, `status` info/success/…).
5. **Slot (solo sezioni).** Quali contratti ammette ogni slot e con quale massimo? I figli di esempio (tre, di solito) sono esempi, non struttura.
6. **Parti.** Quali pezzi restano fissi e quali cambiano per cella? Le parti non entrano nel contratto (le legge `pds-code` da Penpot): servono a decidere i nomi dei layer che DC disegnerà.
7. **Comportamento e a11y.** Cosa deve fare (primitive Base UI se esiste, altrimenti pattern APG)? Non entra nel contratto, ma va deciso ora: `pds-code` lo proporrà come diff sul componente dello sviluppatore.

## Proposta

Mostra una tabella: assi (nome, valori, default), field (nome, tipo, `structure`/`content`, obbligatorio), slot (id, ammessi, max). Poi il **file completo** che scriverai e, **elencati uno per uno**, i file che toccherai: `packages/contracts/src/registry.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/schema-version.ts`, `packages/contracts/tests/contracts.fingerprint.json` (es. `SCHEMA_VERSION` 6 → 7), `packages/contracts/tests/components.test.ts`; per una sezione anche l'elenco in `packages/contracts/tests/section.test.ts`. Controlla i nomi di assi e field con `IDENTIFIER`, `HTML_GLOBAL_ATTRIBUTES` e `REACT_RESERVED_PROPS` di `contract.ts` (P4): un nome riservato si cambia nella proposta, non nella regola.

Dì esplicitamente cosa **non** entra: parti, ruoli, comportamento, a11y. Se l'utente vuole aggiungerli al contratto, spiega perché non si può (non è il vocabolario dell'editor) e dove vivono.

Una domanda sola: approvi questo contratto (e il bump)? Se cambia qualcosa, rifai la tabella e il file: il sì vale per ciò che hai mostrato.

## Scrittura

Dopo il sì: `references/contract-rules.md`, fino a `pnpm --filter @app/contracts test` verde. Riepiloga in tre righe cosa è cambiato e con quale `SCHEMA_VERSION`.

Se il test è rosso su una regola di `defineContract` (nome riservato, default fuori dai valori, field che collide), correggi **la proposta**, non la regola.

## Poi

Non disegni nulla in CN. Il passo successivo è **DC** con questo contratto: le celle sono gli assi che hai approvato. Il codice arriva dopo, con `pds-code` GC.
