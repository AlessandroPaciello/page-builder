---
name: pds-bootstrap
description: Bootstrap una tantum della library Penpot sui contratti. Use when the user says "bootstrap della library", "crea la library Penpot", or wants the one-time Penpot library bootstrap.
---

# pds-bootstrap

Guida il bootstrap una tantum della library Penpot a partire dai contratti di `@app/contracts`: il comando `pnpm --filter @penpot-ds/scripts bootstrap:library` crea i set `palette` e `semantic`, i token semantici e un VariantContainer per ogni contratto. L'esito lo decide l'exit code di `pnpm --filter @penpot-ds/scripts verify:library`, non questo prompt.

## Resolution rules

- `{project-root}` → la working directory del progetto.
- `{skill-name}` → il basename della directory di questa skill.

## On Activation

1. Load config from `{project-root}/_bmad/config.yaml` (and `.user.yaml` if present). Use sensible defaults for anything missing rather than requiring configuration.

## Guida e domande

Il compito di questa skill è guidare e fare domande, in quest'ordine:

1. **File Penpot connesso.** Chiedi conferma che il file Penpot aperto sia quello nuovo e vuoto destinato alla library e che il plugin MCP sia connesso (token in `PENPOT_MCP_TOKEN`). Un file con già set di token o componenti viene rifiutato dal comando senza scrivere nulla: in quel caso il percorso è `pds-additive`.
2. **Revisione del seed e dei design con il designer.** Mostra `{project-root}/packages/scripts/src/library/semantic-tokens.seed.json` e i file in `{project-root}/packages/scripts/src/library/designs/` e chiedi conferma dei valori: dopo il bootstrap i valori sono del designer in Penpot.
3. **Dry-run.** Lancia `pnpm --filter @penpot-ds/scripts bootstrap:library -- --dry-run` dalla root del progetto e mostra il piano: rifiuto, operazioni previste, nessuna scrittura. Chiedi conferma prima di procedere.
4. **Esecuzione.** Lancia `pnpm --filter @penpot-ds/scripts bootstrap:library`. Se esce con 1 senza scritture, riporta il motivo (library non vuota) e ferma.
5. **Esito.** Lancia `pnpm --filter @penpot-ds/scripts verify:library` e riporta l'exit code. Verde: bootstrap riuscito. Rosso: riporta gli errori così come lo script li nomina — la correzione sta nel designer o nel seed, non in una rettifica a mano.

## Guardrail

- Questa skill non chiama mai `execute_code` per scrivere su Penpot al di fuori dei comandi CLI: ogni scrittura passa da `bootstrap:library`.
- Nessun criterio di successo qui: il pass/fail sta nell'exit code di `verify:library` e negli script di `packages/scripts`.
- I comandi `*:library` sono live e su richiesta, mai in CI né in build: Penpot non è raggiungibile dal runner.

<!-- module-code: pds -->
<!-- phase-name: anytime -->
<!-- is-required: false -->
