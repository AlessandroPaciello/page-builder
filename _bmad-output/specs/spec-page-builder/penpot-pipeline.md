# Pipeline Penpot → codice

Companion di [SPEC.md](./SPEC.md). Descrive **cosa** fa la pipeline design→codice e le regole di aderenza. Il transport verso Penpot (oggi un server MCP) è dettaglio realizzativo da confermare in fase architecture; il contratto qui è: Penpot è la sorgente, la generazione è data-driven, i valori sono fedeli al design.

## Principio guida

Questo è un progetto di **design system**: la coerenza coi token e i componenti esistenti viene prima della creazione di nuovi elementi. Penpot è la single source of truth dei valori. Aderenza stretta: usare **esattamente** i valori del design; non inventare valori mancanti (in assenza, default neutri — mai colori casuali). I nomi di token/componenti Penpot restano allineati 1:1 a quelli in codice, così la mappatura non diverge.

## Stadio 1 — Generazione TOKEN

```
Penpot (catalogo token) ──► TokenCatalog (JSON) ──► mapping puro ──► [ CSS vars @theme | scala TS + opzioni editor ]
```

- Mapping data-driven dal **tipo** del token (non dal nome del set): un nuovo set Penpot genera automaticamente una nuova sezione.
- La stessa funzione di derivazione del nome è riusata sia per le variabili CSS sia per le classi generate dai componenti, così i due lati non possono divergere (es. `color.mis.primary` → sempre sia `--color-mis-primary` sia `bg-mis-primary`).
- Output sovrascritto ad ogni run, con header `@generated`.

## Stadio 2 — Generazione COMPONENTI

```
Penpot (pagina componenti) ──► PenpotComponent[] (shape, matrice varianti, token binding)
   ──► analisi (deriva dominio; se variant matrix → modello varianti reale)
   ──► mapping strategia (primitiva nota | alternativa | custom)
   ──► generazione componente + test + story + barrel (@generated)
```

- Divisione delle responsabilità per non emettere classi in conflitto: i binding token espliciti (colore/radius/font) da una fonte, layout/spacing/sizing dal CSS raw dall'altra.
- **Skip protettivo:** se un artefatto esiste già ed è marcato `@generated` → skip salvo forzatura; se esiste senza marker (editato a mano) → skip sempre (protegge le modifiche manuali); se non esiste → genera.
- I componenti senza corrispondenza diretta con una primitiva nota sono strategia `custom` e vengono **saltati** (implementati a mano).

## Gate di verifica

Un controllo di completezza scandisce le directory dei componenti: ogni componente deve avere il proprio file + test + story + barrel, altrimenti fallisce (pensato per CI).

## Convenzione @generated

Tutti i file generati iniziano con un commento `@generated` e l'istruzione di rigenerazione. Non si editano mai a mano; per cambiarli si rigenera dalla sorgente Penpot.
