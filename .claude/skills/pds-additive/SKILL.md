---
name: pds-additive
description: Aggiunta additiva alla library Penpot esistente. Use when the user says "aggiunta additiva", "add alla library Penpot", or wants to add tokens or component containers to an existing Penpot library.
---

# pds-additive

Guida l'aggiunta additiva alla library Penpot esistente: il comando `pnpm --filter @penpot-ds/scripts add:library` crea solo i token mancanti e i container dei contratti che non hanno ancora un container legato via plugin data, e segnala le differenze senza correggerle. L'esito lo decide l'exit code di `pnpm --filter @penpot-ds/scripts verify:library`, non questo prompt.

## Resolution rules

- `{project-root}` → la working directory del progetto.
- `{skill-name}` → il basename della directory di questa skill.

## On Activation

1. Load config from `{project-root}/_bmad/config.yaml` (and `.user.yaml` if present). Use sensible defaults for anything missing rather than requiring configuration.

## Guida e domande

Il compito di questa skill è guidare e fare domande, in quest'ordine:

1. **File Penpot connesso.** Chiedi conferma che il file Penpot aperto sia la library esistente e che il plugin MCP sia connesso (token in `PENPOT_MCP_TOKEN`).
2. **Dry-run.** Lancia `pnpm --filter @penpot-ds/scripts add:library -- --dry-run` dalla root del progetto e mostra il piano: le operazioni di creazione previste e le differenze trovate.
3. **Differenze: riportare e basta.** Per ogni differenza riporta soggetto, atteso e trovato, così come lo script li nomina. Non proporre correzioni automatiche: sistemarle è del designer in Penpot o di un cambio esplicito di contratto.
4. **Esecuzione.** Con la conferma del designer, lancia `pnpm --filter @penpot-ds/scripts add:library`: crea solo ciò che manca, le differenze restano tali.
5. **Esito.** Lancia `pnpm --filter @penpot-ds/scripts verify:library` e riporta l'exit code. Verde: aggiunta riuscita. Rosso: riporta gli errori — la correzione sta nel designer o nel seed, non in una rettifica a mano.

## Guardrail

- Questa skill non chiama mai `execute_code` per scrivere su Penpot al di fuori dei comandi CLI: ogni scrittura passa da `add:library`.
- Nessun criterio di successo qui: il pass/fail sta nell'exit code di `verify:library` e negli script di `packages/scripts`.
- I comandi `*:library` sono live e su richiesta, mai in CI né in build: Penpot non è raggiungibile dal runner.

<!-- module-code: pds -->
<!-- phase-name: anytime -->
<!-- after: pds-bootstrap:bootstrap -->
<!-- is-required: false -->
