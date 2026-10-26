import { z } from "zod";

import { Change, Finding, Lettura, Suggerimento } from "../core";

/**
 * Nomi, descrizioni e schemi zod dei sei strumenti del server `pds` (Story
 * 2.24). Le uscite sono oggetti: MCP vuole uno `structuredContent` oggetto,
 * quindi i `Finding[]` di `verify_component` stanno in `{ findings }`.
 */

const name = z.string().min(1).describe("Il componente: nome del contratto (`badge`, `badge@1`) o del layer in Penpot.");

export const TOOL_NAMES = ["tokens_from_css", "describe_component", "verify_component", "build_order", "generate_component", "extract_theme"] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** Gli strumenti che la Story 2.26 riempie: oggi solo lo schema d'ingresso. */
export const NOT_YET = "disponibile dalla Story 2.26";

export const TOOLS = {
  describe_component: {
    description: "Legge il componente da Penpot e restituisce la sua Lettura (celle, layer, token, stile, istanze, plugin data). Non scrive niente.",
    input: { name },
    output: Lettura,
  },
  verify_component: {
    description: "Legge il componente da Penpot e lo verifica contro il suo contratto: restituisce gli esiti (avviso, blocco, domanda). Il <Comp>.tsx esistente si legge dal disco. Non scrive niente.",
    input: { name },
    output: z.object({ findings: z.array(Finding) }),
  },
  build_order: {
    description: "Legge i componenti da Penpot e restituisce l'ordine in cui generarli (un componente dopo quelli che contiene). I componenti già generati sono quelli con un <Comp>.styles.ts @generated nel repo. Non scrive niente.",
    input: { names: z.array(name).min(1).describe("I componenti da generare.") },
    output: z.object({ order: z.array(z.string()), findings: z.array(Finding) }),
  },
  generate_component: {
    description:
      "Legge il componente da Penpot, lo verifica e scrive in packages/ui/src/domains/<nome>/ <Comp>.styles.ts e <Comp>.stories.tsx (@generated) e, solo se manca, lo scaffold di <Comp>.tsx. Con un blocco o una domanda aperta non scrive niente. Il TSX esistente non si tocca mai: i cambi di struttura arrivano come suggerimenti.",
    input: { name },
    output: z.object({ changes: z.array(Change), findings: z.array(Finding), suggestions: z.array(Suggerimento), written: z.array(z.string()) }),
  },
  tokens_from_css: {
    description: `Dal seme theme.css (Tailwind v4 + ruoli shadcn) ai token Penpot. Non ancora implementato: ${NOT_YET}.`,
    input: { css: z.string().min(1).describe("Il contenuto del seme theme.css.") },
  },
  extract_theme: {
    description: `Dal catalogo token Penpot a theme.css, un file per variante di tema e fonts.css. Non ancora implementato: ${NOT_YET}.`,
    // Nessun argomento: uno estraneo è rifiutato (un oggetto vuoto non stretto lo lascerebbe passare in silenzio).
    input: z.object({}).strict(),
  },
} as const satisfies Record<ToolName, { description: string; input: z.ZodRawShape | z.ZodObject; output?: z.ZodType }>;
