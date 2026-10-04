# Alert — seed MCP rieseguibile (Story 2-16, CAP-11, terzo)

Container `Alert` creato dalla v2 (`library add Alert`): plugin data `alert@1`,
asse `status` (info, success, warning, error) = 4 board, layer delle 3 parti
(`root` = board, `Heading`, `Description`). Solo `library` scrive su Penpot;
solo `extract` scrive l'istantanea. Dai file v1 cancellati (judgment +
binding dalla storia git: dominio `feedback`, headless null, `role` per
variante). Il `role` ARIA è per valore di `status` (`info`/`success` →
`status`, `warning`/`error` → `alert`), emesso dal render (decisione
ALERT-ROLE).

## 1. Prerequisiti

- Token Stadio 1 verdi; MCP raggiungibile per il live; mai in CI/build.

## 2. Riempimento via `execute_code` (live)

1. `library add Alert --dry-run` — piano (1 container, 4 celle) senza scrivere.
2. `library add Alert` — crea le 4 board (`Alert status=info`, …) con i token
   del registro: `root` (`surface`) fill `color.card`, radius `lg`, padding
   `spacing.4`; `Heading` (`text`) fill per status (`info`/`success`/`warning`/
   `destructive`) + tipografia semibold; `Description` (`text`) fill
   `color.card-foreground` (`warning`: `color.muted-foreground`).
3. Verifica in Penpot (dai design v1): layout `column`/`start` dal layer;
   ogni stile con binding; `heading` si chiama così (non `title`, attributo
   HTML globale).
4. `propose -- Alert` — nessun diff.

## 3. Riesecuzione offline

Il file `alert.seed-library.json` (id `seed-alert-2-16`, 4 celle) è il seam:

- `extract -- Alert --snapshot data/components/alert.seed-library.json`
  scrive `data/components/alert.json`; con `--check` confronta senza scrivere.

## 4. Render, gate e Storybook

- `render -- Alert` rigenera i 4 file in `packages/ui/src/domains/feedback/`
  (lookup per `status` senza cva, `role={alertRoles[status]}`).
- `render -- --check --all` a diff zero; `gates` verdi.
- Storybook: `Feedback/Alert` (StatusInfo/Success/Warning/Error) con nota
  `Giudizio visivo`.
