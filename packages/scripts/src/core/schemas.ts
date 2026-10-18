import { z } from "zod";

/**
 * Tipi della pipeline v3 (Story 2.20, AD-11 v3): `Lettura`, `Finding`,
 * `Change`. Hanno un nome e nessuna versione: chi li produce e chi li legge
 * vivono nello stesso package e cambiano insieme.
 */

/**
 * Shared plugin data `pagebuilder` di un container o di un layer: `contract`,
 * `part`, `when`, `slot` e le risposte alle domande (chiavi libere). Penpot
 * salva solo stringhe.
 */
export const PluginData = z
  .object({
    contract: z.string().min(1).optional(),
    part: z.string().min(1).optional(),
    when: z.string().min(1).optional(),
    slot: z.string().min(1).optional(),
  })
  .catchall(z.string());

export type PluginData = z.infer<typeof PluginData>;

/** Valore grezzo di una proprietà letta da Penpot (parola chiave, misura, interruttore). */
export const StyleValue = z.union([z.string(), z.number(), z.boolean()]);

export type StyleValue = z.infer<typeof StyleValue>;

/** Istanza di un altro componente: componente d'origine, variante scelta e override rispetto all'istanza principale. */
export const Instance = z.object({
  component: z.string().min(1),
  variant: z.record(z.string(), z.string()),
  overrides: z.array(z.string()),
});

export type Instance = z.infer<typeof Instance>;

/**
 * Un layer letto da Penpot. `tokens` e `style` sono chiavi del registro
 * (proprietà → nome del token, proprietà → valore grezzo); `kind` è il tipo di
 * layer Penpot (`rect`, `text`, `path`, `board`, …).
 */
export const LetturaLayer = z.object({
  name: z.string().min(1),
  kind: z.string().min(1),
  pluginData: PluginData.optional(),
  tokens: z.record(z.string(), z.string().min(1)),
  style: z.record(z.string(), StyleValue),
  instance: Instance.optional(),
  get children() {
    return z.array(LetturaLayer);
  },
});

export type LetturaLayer = z.infer<typeof LetturaLayer>;

/** Una cella del componente: i valori di variante e l'albero dei layer. */
export const Cella = z.object({
  variant: z.record(z.string(), z.string()),
  root: LetturaLayer,
});

export type Cella = z.infer<typeof Cella>;

/** Un componente letto da Penpot: lo produce l'adattatore (Story 2.23), lo consuma il nucleo. */
export const Lettura = z.object({
  component: z.string().min(1),
  pluginData: PluginData.optional(),
  cells: z.array(Cella).min(1),
});

export type Lettura = z.infer<typeof Lettura>;

const where = z.string().min(1);
const message = z.string().min(1);

/**
 * Esito del nucleo. `avviso`: si genera lo stesso. `blocco`: non si genera.
 * `domanda`: non si genera finché qualcuno non sceglie una delle opzioni;
 * `key` è la chiave di plugin data in cui `pds-code` scriverà la risposta
 * (Story 2.21).
 */
export const Finding = z.discriminatedUnion("level", [
  z.object({ level: z.literal("avviso"), where, message }),
  z.object({ level: z.literal("blocco"), where, message }),
  z.object({ level: z.literal("domanda"), where, message, key: z.string().min(1), options: z.array(z.string().min(1)).min(2) }),
]);

export type Finding = z.infer<typeof Finding>;

const path = z.string().min(1);

/** Un file da creare, aggiornare o eliminare (lo scrive il server, Story 2.24). */
export const Change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("crea"), path, content: z.string() }),
  z.object({ action: z.literal("aggiorna"), path, content: z.string() }),
  z.object({ action: z.literal("elimina"), path }).strict(),
]);

export type Change = z.infer<typeof Change>;
