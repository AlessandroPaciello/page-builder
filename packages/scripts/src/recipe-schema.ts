import { z } from "zod";

import type { SnapshotLayer } from "./library/library-snapshot";

/**
 * Contratto degli artefatti committati della pipeline Stage 2 (AD-11,
 * Story 2.5): fixture = fatti letti da Penpot senza sapere cosa sia React
 * (plugin data `pagebuilder/contract` + `shape.tokens` dallo snapshot di
 * library); ricetta = mappa di parti a profondità 1 con celle
 * `proprietà → token`, più i campi di giudizio. Schema = fonte unica di
 * verità per `validate-recipe.ts` e per i test.
 */

/**
 * Un layer dell'albero di una cella: stessa forma di `SnapshotLayer`
 * (library-snapshot.ts). `tokens` = `shape.tokens` (proprietà → nome token),
 * `style` = proprietà di stile valorizzate. La geometria dei path è esclusa
 * alla fonte (library-reader, AD-11).
 */
export const LayerSchema: z.ZodType<SnapshotLayer> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    kind: z.string().min(1),
    tokens: z.record(z.string(), z.string()),
    style: z.record(z.string(), z.unknown()),
    children: z.array(LayerSchema),
  }),
);

/**
 * Fixture di un componente estratto dallo snapshot di library (Story 2.5).
 * Nessun campo qui richiede React. `contract` è il plugin data
 * `pagebuilder/contract` letto dal VariantContainer (`nome@versione`): è il
 * legame al contratto che rende la fixture verificabile (AC #1). Le celle
 * NON hanno righe `variantProps: null`: nella library verificata ogni board
 * è mappata alle varianti (regola 5 di `verifyLibrary`).
 */
export const FixtureSchema = z.object({
  componentName: z.string().min(1),
  contract: z.string().min(1),
  penpotComponentId: z.string().min(1),
  axes: z.array(
    z.object({
      name: z.string().min(1),
      values: z.array(z.string().min(1)).min(1),
    }),
  ),
  cells: z.array(
    z.object({
      variantProps: z.record(z.string(), z.string()),
      root: LayerSchema,
    }),
  ),
});

export type ComponentFixture = z.infer<typeof FixtureSchema>;

const DESIGN_DOMAINS = [
  "data-display",
  "inputs",
  "feedback",
  "layout",
  "navigation",
  "overlays",
] as const;

export type DesignDomain = (typeof DESIGN_DOMAINS)[number];

/**
 * Campi di giudizio della ricetta (domain, headless, a11y): stanno in un
 * file di giudizio per contratto committato (`recipes/judgments/`), fuso con
 * le celle estratte dallo snapshot da `extract-component.ts` (decisione
 * Story 2.5). `headless: null` = nessuna libreria headless necessaria.
 * `comment` è il posto per le note in file JSON (niente commenti liberi).
 */
export const JudgmentSchema = z.object({
  domain: z.enum(DESIGN_DOMAINS),
  headless: z
    .object({
      package: z.string().min(1),
      parts: z.array(z.string().min(1)).min(1),
    })
    .nullable(),
  a11y: z.object({
    role: z.string().nullable(),
    ariaAttributes: z.array(z.string()),
    focusVisible: z.boolean(),
    stateConveyedByTextAndColor: z.boolean(),
  }),
  comment: z.string().optional(),
});

export type ComponentJudgment = z.infer<typeof JudgmentSchema>;

/** Parte/proprietà: identificatore minuscolo, come `IDENTIFIER` in @app/contracts. */
const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Chiave cella: `asse=valore` uniti da `|`, nell'ordine degli assi del
 * contratto. I separatori `|` e `=` sono VETATI dentro i valori (review
 * loop 1, BH#6+ECH#8): una chiave `variant=a=b` o valori che contengono
 * `|` colliderebbero — due celle diverse collasserebbero nella stessa
 * chiave. Il contratto della ricetta non deve dipendere dalla disciplina
 * a monte sui nomi.
 */
const CELL_KEY = /^[a-z][a-zA-Z0-9]*=[^\s|=]+(\|[a-z][a-zA-Z0-9]*=[^\s|=]+)*$/;

/** Nome token: stesso charset di `TOKEN_NAME_PATTERN` in theme-generator.ts. */
const TOKEN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Ricetta di un componente (giudizio committato e validato, Story 2.5): mappa
 * di parti a profondità 1 — le chiavi di primo livello sono i nomi `parts`
 * piatti del contratto; ogni parte mappa chiavi cella (`asse=valore|…`) a
 * celle `proprietà → token`. Una parte annidata con assi propri NON è
 * esprimibile: come chiave cella fallisce CELL_KEY, come valore di cella
 * fallisce perché una cella è `proprietà → token` (stringa), non un oggetto —
 * è il criterio di stop meccanico (AC #2). Nessuna classe di una libreria:
 * il blocco `cva` è della Story 2.6 (emitter).
 */
export const RecipeSchema = z.object({
  componentName: z.string().min(1),
  parts: z.record(
    z.string().regex(IDENTIFIER),
    z.record(
      z.string().regex(CELL_KEY),
      z.record(z.string().regex(IDENTIFIER), z.string().regex(TOKEN_NAME)),
    ),
  ),
  judgment: JudgmentSchema,
  penpotComponentId: z.string().min(1),
  fixtureHash: z.string().length(12),
});

export type ComponentRecipe = z.infer<typeof RecipeSchema>;

/**
 * Chiave cella di una riga di variantProps: `asse=valore|…` nell'ordine degli
 * assi passati (quelli del contratto). Un valore d'asse mancante è un errore
 * che nomina l'asse, mai una chiave "?" a valle (review loop 1, ECH#1): due
 * celle malformate diverse non possono più collassare nella stessa chiave.
 */
export function cellKeyOf(
  axes: readonly { readonly name: string }[],
  variantProps: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const axis of axes) {
    const value = variantProps[axis.name];
    if (value === undefined) {
      throw new Error(
        `Cella senza valore per l'asse "${axis.name}" (${JSON.stringify(variantProps)}) — la matrice varianti è incoerente.`,
      );
    }
    parts.push(`${axis.name}=${value}`);
  }
  return parts.join("|");
}

/**
 * Raccolta dei binding `proprietà → token` per parte dall'albero di layer di
 * una cella: la board radice È la parte "root" a prescindere dal suo nome
 * (stessa convenzione della regola 6 di `verifyLibrary`), gli altri layer
 * contano per nome. Solo layer con binding diventano parti (review loop 1,
 * BH#8 defer: una parte senza binding è coperta da `verify:library`, non
 * duplicata qui). `duplicates` elenca i nomi di parte portati da PIÙ layer
 * con binding: è ambiguo quale sia la parte — si segnala, non si corregge.
 */
export function partBindings(root: SnapshotLayer): {
  bindings: Map<string, Record<string, string>>;
  duplicates: string[];
} {
  const bindings = new Map<string, Record<string, string>>();
  const duplicates = new Set<string>();
  const visit = (layer: SnapshotLayer, partName: string): void => {
    if (Object.keys(layer.tokens).length > 0) {
      if (bindings.has(partName)) duplicates.add(partName);
      else bindings.set(partName, { ...layer.tokens });
    }
    for (const child of layer.children) visit(child, child.name);
  };
  visit(root, "root");
  return { bindings, duplicates: [...duplicates] };
}
