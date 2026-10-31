import { z } from "zod";

import { Change, Finding, Lettura, Suggerimento } from "../core";

/**
 * Nomi, descrizioni e schemi zod dei sei strumenti del server `pds` (Story
 * 2.24). Le uscite sono oggetti: MCP vuole uno `structuredContent` oggetto,
 * quindi i `Finding[]` di `verify_component` stanno in `{ findings }`.
 */

const name = z.string().min(1).describe("Il componente: nome del contratto (`badge`, `badge@1`) o del layer in Penpot.");

/** Un token Penpot serializzato: lo stesso valore del catalogo (stringa, lista di family o layer shadow). */
const tokenValue = z.union([
  z.string(),
  z.array(z.string()),
  z.array(z.object({ offsetX: z.string(), offsetY: z.string(), blur: z.string(), spread: z.string(), color: z.string(), inset: z.boolean() })),
]);

const penpotToken = z.object({ name: z.string(), type: z.string(), value: tokenValue });
const penpotTokenSet = z.object({ name: z.string(), tokens: z.array(penpotToken) });
const penpotTheme = z.object({ group: z.string(), name: z.string(), sets: z.array(z.string()) });
const warning = z.object({ var: z.string(), why: z.string() });

export const TOOL_NAMES = ["tokens_from_css", "describe_component", "verify_component", "build_order", "generate_component", "extract_theme"] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

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
    description:
      "Dal seme theme.css (Tailwind v4 + ruoli shadcn) ai set e temi Penpot. Il server antepone il default di Tailwind letto dal pacchetto installato. Restituisce set, temi e un avviso per ogni spread negativo, colore fuori sRGB o variabile saltata. Non scrive niente, né su Penpot né su disco.",
    input: { css: z.string().min(1).describe("Il contenuto del seme theme.css.") },
    output: z.object({ sets: z.array(penpotTokenSet), themes: z.array(penpotTheme), warnings: z.array(warning) }),
  },
  extract_theme: {
    description:
      "Legge da Penpot tutti i set e i temi (non solo quelli attivi) e scrive in packages/tokens/src/ theme.css, themes/<gruppo>-<nome>.css, fonts.css e tokens.generated.ts (@generated, con l'hash del corpo). Restituisce i file scritti e i pacchetti @fontsource/* da installare.",
    input: z.object({ fonts: z.enum(["fontsource"]).optional().describe('Solo "fontsource": un altro valore è un rifiuto esplicito.') }).strict(),
    output: z.object({ written: z.array(z.string()), packages: z.array(z.string()) }),
  },
} as const satisfies Record<ToolName, { description: string; input: z.ZodRawShape | z.ZodObject; output?: z.ZodType }>;
