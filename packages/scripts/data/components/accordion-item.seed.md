# AccordionItem — seed MCP rieseguibile (Story 2-16, CAP-11, ultimo)

Container `AccordionItem` creato dalla v2 (`library add AccordionItem`):
plugin data `accordion-item@1`, asse di RENDERING `state` (`behavior`, closed,
open) = 2 board, layer delle 7 parti piatte (`root` = board, `Trigger`,
`Label`, `Chevron`, `Content`, `Body`, `Divider`). Solo `library` scrive su
Penpot; solo `extract` scrive l'istantanea. Dai file v1 cancellati (judgment +
binding dalla storia git: dominio `layout`, `focusVisible: true`). L'asse è
`behavior` nel contratto di estrazione; l'headless è Base UI
(`@base-ui/react`, `Item`/`Trigger`/`Panel` — `Panel`, non `Content`),
coerente con DROPDOWN-BASEUI. Le parti restano piatte (`label`/`chevron`
dentro `trigger`, `body`/`divider` dentro `content`); `divider` sta dentro
`content` (come nel binding v1, non come nel design v1 dove stava in `root`).

## 1. Prerequisiti

- Token Stadio 1 verdi; MCP per il live; mai in CI/build.

## 2. Riempimento via `execute_code` (live)

1. `library add AccordionItem --dry-run` — piano (1 container, 2 celle).
2. `library add AccordionItem` — crea le 2 board
   (`AccordionItem state=closed`, `state=open`) con i token del registro:
   `root` fill `color.card` radius `md`; `Trigger` padding + `columnGap`;
   `Label` testo `color.foreground`; `Chevron` (`icon`) tratto
   `color.foreground`; `Content` padding; `Body` testo
   `color.muted-foreground`; `Divider` tratto `color.border`.
3. Verifica in Penpot (dai design v1, celle identiche closed/open: il
   comportamento è dell'headless `data-state`, non dei token): layout
   `column`/`start` su `root`/`content`, `row`/`center` su `trigger`;
   ogni stile con binding.
4. `propose -- AccordionItem` — nessun diff.

## 3. Riesecuzione offline

Il file `accordion-item.seed-library.json` (id `seed-accordionitem-2-16`,
2 celle) è il seam:

- `extract -- AccordionItem --snapshot data/components/accordion-item.seed-library.json`
  scrive `data/components/accordion-item.json`; con `--check` confronta.

## 4. Render, gate e Storybook

- `render -- AccordionItem` rigenera i 4 file in
  `packages/ui/src/domains/layout/` su Base UI (`Accordion.Item/Header/
  Trigger/Panel`, `ChevronDownIcon`, `value` dai props, `focusVisible` sul
  trigger). Nessuna base shadcn, nessun Radix, nessuna `cva`.
- `render -- --check --all` a diff zero; `gates` verdi (axe con Root).
- Storybook: `Layout/AccordionItem` (Default in `Accordion.Root`) con nota
  `Giudizio visivo`.
