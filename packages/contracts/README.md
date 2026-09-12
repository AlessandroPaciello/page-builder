# @app/contracts

Contratti dei componenti del page builder: il vocabolario delle props appartiene a questo package, non alla libreria generata (AD-5, AD-11). Penpot possiede solo valori e aspetto. Qui vivono gli schemi Zod delle props, i tipi d'asse, le parti, la classificazione structure/content, le definizioni di sezione e `SCHEMA_VERSION` (AD-6).

## Zero dipendenze UI

In `src/` sono ammessi solo `zod` (senza traversate tipo `zod/../…`) e import relativi che restano dentro `src/`: niente React, Puck, Radix, Tailwind, `@app/*`, e nemmeno i builtin `node:*`, perché i contratti girano sia nel browser sia nel server. Il gate è allowlist anche sui file: un file in `src/` con estensione non riconosciuta è un errore di scan, non un buco. Anche `package.json` è in allowlist: niente alias (`npm:…`), URL o sezioni `overrides`/`resolutions`. Un template interpolato in clausola `from` è rosso, come gli `import()`/`require()` non letterali. Il gate è bloccante in CI e ha test propri (`tests/check-boundaries.test.ts`):

```sh
pnpm --filter @app/contracts lint
```

## Tipi d'asse

Il tipo d'asse è dichiarato nel contratto, mai in Penpot, e decide l'instradamento a valle:

| Tipo | Prop? | Emitter (Story 2.6) | Editor Puck |
|---|---|---|---|
| `option` | sì, `z.enum` con default, sempre `structure` | variante `cva` | field |
| `state` | no | `focus-visible:` / `aria-invalid:` / `disabled:` | — |
| `behavior` | no | `data-[state=…]:` (headless) | — |

Ogni voce di `fields` porta il suo `kind` (`structure` o `content`). `classifyField` restituisce `content` per tutto ciò che non conosce (fail-safe).

## Aggiungere o cambiare un contratto

1. Un file in `src/components/` con `defineContract({...})`, che fallisce a module load se il contratto è incoerente.
2. Una voce in `COMPONENT_CONTRACTS` (`src/registry.ts`), l'unico punto che elenca i contratti. Le sezioni vanno in `src/sections/` e in `SECTION_DEFINITIONS`.
3. Incrementa `SCHEMA_VERSION` (`src/schema-version.ts`) e **aggiungi** a `tests/contracts.fingerprint.json` la voce della nuova versione con l'hash che il test stampa. Le voci sono append-only: non si riscrive mai l'hash di una versione esistente.

### Le due versioni, e quando bumparle

- **`SCHEMA_VERSION`** copre tutto il registry (contratti **e** sezioni): qualsiasi cambiamento — un asse, un valore, una parte, un field, il `kind` di un field — richiede il bump e la nuova voce del fingerprint. È la versione con cui il core etichetta i payload salvati (AD-6).
- **`contract.version`** (quella dentro `contractId()`, es. `badge@1`) cambia **ogni volta che cambia il vocabolario di quel componente**: assi, valori, parti o fields. Il plugin data Penpot `nome@versione` cambia con essa, così il bootstrap (Story 2.4) e l'estrazione (Story 2.5) sanno quale versione di contratto hanno davanti e le pagine salvate restano etichettate con la versione che le ha generate. Un cambio di contratto senza bump di `contract.version` è una review finding, non una scelta.
- **`SectionDefinition.version`** segue la stessa regola della `contract.version`, ma oggi non ha consumer: la 3.4 deciderà come esporne il legame.

## Plugin data Penpot

Il VariantContainer di Penpot è legato al contratto dal plugin data `pagebuilder/contract = nome@versione` (es. `badge@1`), prodotto da `contractId(contract)`. Il `nome` è kebab-case.
