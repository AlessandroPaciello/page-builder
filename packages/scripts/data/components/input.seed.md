# Input — seed MCP rieseguibile (Story 2-16, CAP-11, secondo)

Container `Input` creato dalla v2 (`library add Input`): plugin data `input@1`,
asse di RENDERING `state` (default, focus, error, disabled) = 4 board, layer
della sola parte `root` (`input`, `surface`). Solo `library` scrive su Penpot;
solo `extract` scrive l'istantanea; `render`/`gates` leggono gli artefatti
committati. Dai file v1 cancellati (judgment + binding dalla storia git:
dominio `inputs`, headless null, `focusVisible: true`). L'asse `state` vive
nel contratto di estrazione, non nel page builder (contratto ridotto, zero
assi option).

## 1. Prerequisiti

- Library con i token Stadio 1 (`theme` verde).
- Penpot locale con server MCP raggiungibile (`PENPOT_MCP_URL`,
  `PENPOT_MCP_TOKEN`).
- Nessun passo di questa guida gira in CI né in build.

## 2. Riempimento via `execute_code` (live)

1. `library add Input --dry-run` — piano (1 container, 4 celle) senza scrivere.
2. `library add Input` — crea le 4 board (`Input state=default`, …,
   `state=disabled`) con `root` (`surface`, `input`) e i token del registro:
   fill `color.background`, bordo `color.border` (focus: `color.ring` +
   `shadow.ring`; error: `color.destructive`; disabled: `opacity.disabled`),
   radius `md`, padding `spacing.2`/`spacing.3`.
3. Verifica in Penpot, cella per cella (dai design v1): il field
   `placeholder` arriva come attributo `placeholder` (nessuna parte separata:
   semplificazione v2, nessun confronto con la v1); ogni stile ha un binding.
4. `propose -- Input` — nessun diff.

## 3. Riesecuzione offline

Il file `input.seed-library.json` (id `seed-input-2-16`, 4 celle) è il seam
di lettura/test:

- `pnpm --filter @penpot-ds/scripts extract -- Input --snapshot data/components/input.seed-library.json`
  scrive `data/components/input.json` (tmp + rename).
- Con `--check --snapshot` confronta senza scrivere.

## 4. Render, gate e Storybook

- `pnpm --filter @penpot-ds/scripts render -- Input` rigenera i 4 file in
  `packages/ui/src/domains/inputs/` (stati come prefissi `focus-visible:`,
  `aria-invalid:`, `disabled:`, `focusVisible` strutturale).
- `render -- --check --all` a diff zero; `gates` con suite `ui` + axe verdi.
- Storybook: `Inputs/Input` (Default, Disabled) con nota `Giudizio visivo`.
