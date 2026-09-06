import { z } from "zod";

/**
 * Contratto degli artefatti committati della pipeline Stage 2 (AD-11):
 * fixture = fatti letti da Penpot senza sapere cosa sia React (AC #3);
 * ricetta = giudizio (dominio, headless, CVA, a11y). Schema = fonte unica
 * di verità per `validate-recipe.ts` e per i test.
 */

/**
 * Fixture di un componente estratto da Penpot (Story 2.2, Task 4). Nessun
 * campo qui richiede React: `shapeStructure` è l'output grezzo della lettura
 * della shape, `rawCss` è il CSS generato da `penpot.generateStyle`,
 * `tokenBindings` mappa proprietà di stile → nome token del catalogo Stadio 1.
 */
export const FixtureSchema = z.object({
  componentName: z.string().min(1),
  penpotComponentId: z.string().min(1),
  variantAxes: z.array(
    z.object({
      name: z.string().min(1),
      values: z.array(z.string().min(1)).min(1),
    }),
  ),
  cells: z.array(
    z.object({
      // `null` = cella "Default": l'istanza main del VariantContainer, non una
      // cella con assi (vedi Dev Notes Task 1/4: scelta documentata — la
      // matrice celle esplicita esclude il default, che resta referenziato
      // qui come riga separata).
      variantProps: z.record(z.string(), z.string()).nullable(),
      penpotComponentId: z.string().min(1),
      shapeStructure: z.unknown(),
      tokenBindings: z.record(z.string(), z.string()),
      rawCss: z.string(),
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
 * Ricetta di un componente (giudizio committato e validato). `headless: null`
 * = nessuna libreria headless necessaria (es. Badge presentazionale). Le
 * classi del blocco `cva` sono validate contro il vocabolario token Stadio 1
 * da `validate-recipe.ts` (AC #2).
 */
export const RecipeSchema = z.object({
  componentName: z.string().min(1),
  domain: z.enum(DESIGN_DOMAINS),
  headless: z
    .object({
      package: z.string().min(1),
      parts: z.array(z.string().min(1)).min(1),
    })
    .nullable(),
  cva: z.object({
    base: z.array(z.string()),
    variants: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
    defaultVariants: z.record(z.string(), z.string()),
  }),
  a11y: z.object({
    role: z.string().nullable(),
    ariaAttributes: z.array(z.string()),
    focusVisible: z.boolean(),
    stateConveyedByTextAndColor: z.boolean(),
  }),
  penpotComponentId: z.string().min(1),
  fixtureHash: z.string().length(12),
});

export type ComponentRecipe = z.infer<typeof RecipeSchema>;
