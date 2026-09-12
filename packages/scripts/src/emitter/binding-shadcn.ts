import { z } from "zod";

/**
 * Tabella di binding per componente per l'emitter shadcn (Story 2.6, AD-11):
 * emitter + binding = tutto ciò che dipende dalla libreria. La tabella è
 * committata (`src/emitter/bindings/<kebab>.binding.json`) e dichiara:
 * componente base shadcn, parti ricetta → parti libreria, headless, valori
 * d'asse → API della libreria. L'emitter (`render-component.ts`) legge, non
 * giudica: il TIPO d'asse vive solo nel contratto (`@app/contracts`), qui è
 * ripetuto solo come controllo incrociato fail-loud.
 */

/** Parte ricetta → parte libreria. `element: null` = parte senza proprio nodo (solo attributo/contenuto dell'host). */
export const BindingPartSchema = z
  .object({
    /** Nome della parte nella base shadcn di provenienza (documentazione). */
    library: z.string().min(1),
    /**
     * Elemento JSX: tag intrinseco minuscolo (`span`, `div`, `input`),
     * componente headless prefissato dall'alias della base
     * (`AccordionPrimitive.Item`) o icona lucide (`ChevronDownIcon`).
     * `null` = la parte non ha un nodo proprio (renderizza come attributo
     * dell'host, campo `attribute`).
     */
    element: z.string().min(1).nullable(),
    /** Parte ricetta che contiene questa parte; `null` = radice del componente. */
    parent: z.string().nullable(),
    /** Classi strutturali della base shadcn (provenienza libreria, non derivate dai token). */
    structural: z.string().default(""),
    /** Wrapper della base attorno all'elemento (es. `AccordionPrimitive.Header`). */
    wrapper: z.string().optional(),
    /** Classi strutturali del wrapper. */
    wrapperStructural: z.string().default(""),
    /** Campo `content` del contratto renderizzato dentro questa parte. */
    contentField: z.string().optional(),
    /** Attributo dell'host che riceve il campo content (es. `placeholder`). */
    attribute: z.string().optional(),
    /** Prefisso di classe della parte sull'host (es. `placeholder:`). */
    classPrefix: z.string().default(""),
  })
  .refine((part) => part.attribute === undefined || part.contentField !== undefined, {
    message:
      "attribute richiede anche contentField: un attributo senza campo content da cui trarre il valore verrebbe droppato in silenzio dal rendering",
    path: ["attribute"],
  });

/** Valore d'asse → API della libreria: per `option` il valore della prop, per `state`/`behavior` il prefisso di classe. */
export const BindingAxisSchema = z.object({
  /** Controllo incrociato col contratto: mancante o divergente → fail-loud nominativo. */
  type: z.enum(["option", "state", "behavior"]),
  /** Nome della prop cva per gli assi `option` (default: nome dell'asse). */
  prop: z.string().min(1).optional(),
  /** Valore del contratto → API della libreria (`""` = nessun prefisso/valore default). */
  values: z.record(z.string(), z.string()),
});

export const BindingSchema = z.object({
  componentName: z.string().min(1),
  /** Plugin data `nome@versione`: deve coincidere con `fixture.contract`. */
  contract: z.string().min(1),
  /** Directory della base shadcn committata sotto `src/emitter/bases/`. */
  base: z.string().min(1),
  /** Libreria headless: import riusato verbatim dalla base, parte Root per i wrap di test/story. */
  headless: z
    .object({
      package: z.string().min(1),
      /** Nomi dei COMPONENTI dell'headless usati dalla base (specchio del giudizio). */
      parts: z.array(z.string()).default([]),
      /** Nome del componente Root nell'headless (es. `Root`); null = nessuno. */
      root: z.string().nullable(),
      /** Props del Root nei render di test/story (es. `{"type":"single","collapsible":true}`): conoscenza libreria, non hard-coded nell'emitter. */
      rootProps: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    })
    .nullable(),
  /**
   * Props richieste dall'API della libreria che il contratto non esprime
   * (es. `value` di Radix Accordion in modalità single): aggiunte ai render di
   * test e story. È conoscenza della libreria → sta nel binding.
   */
  testProps: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  parts: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/), BindingPartSchema),
  axes: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/), BindingAxisSchema),
});

export type ComponentBinding = z.infer<typeof BindingSchema>;
export type BindingPart = z.infer<typeof BindingPartSchema>;
export type BindingAxis = z.infer<typeof BindingAxisSchema>;
