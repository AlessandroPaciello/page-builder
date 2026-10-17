import type { ComponentContract, SectionDefinition } from "@app/contracts";

/**
 * Spike 2026-10-10 — "collegamento" (binding) Penpot ↔ editor.
 *
 * Dichiara solo ciò che Penpot non sa o che cambia la STRUTTURA del codice:
 * elemento HTML, field che alimentano le parti, componenti annidati, parti
 * condizionali, accessibilità, cartella. Aspetto, annidamento, ruoli e nomi
 * del container si leggono da Penpot (container con plugin data `nome@versione`).
 */
export interface BindingPart {
  /** Elemento HTML. Default: `span` per i testi, `div` per il resto. */
  readonly element?: string;
  /** Field reso come testo della parte. */
  readonly content?: string;
  /** `{ attributoHtml: field }`. */
  readonly attribute?: Readonly<Record<string, string>>;
  /** La parte è un'istanza del componente con questo nome di contratto. Struttura: registrata. */
  readonly component?: string;
  /** Field del componente annidato ← field di questo componente. */
  readonly fields?: Readonly<Record<string, string>>;
  /** La parte esiste solo in queste celle. Struttura: registrata. */
  readonly when?: Readonly<Record<string, readonly string[]>>;
  /** La parte è uno slot della sezione: i figli in Penpot sono esempi, nel codice diventano `children`. */
  readonly slot?: string;
  /** La parte si ripete una volta per figlio dello slot (es. i pallini): i figli in Penpot sono esempi. */
  readonly repeat?: string;
  /** La parte è un'icona: tracciato vettoriale in Penpot, componente di libreria nel codice (`lucide:Nome`). */
  readonly icon?: string;
  /** Attributi fissi di accessibilità (es. `aria-hidden: "true"`). Semantica: registrata qui, non in Penpot. */
  readonly aria?: Readonly<Record<string, string>>;
}

export interface Binding<C extends ComponentContract = ComponentContract> {
  readonly contract: C;
  /** Slot della sezione, se il collegamento è di una sezione (vedi `sectionContract`). */
  readonly slots?: readonly { readonly id: string; readonly allow: readonly string[] }[];
  /** Figli di default della sezione (per le story). */
  readonly examples?: readonly { readonly id: string; readonly component: string; readonly props: Readonly<Record<string, unknown>> }[];
  /** Props di default del nodo sezione (per le story). */
  readonly rootProps?: Readonly<Record<string, unknown>>;
  readonly domain: string;
  readonly a11y: { readonly focusVisible: boolean };
  readonly parts: Readonly<Record<string, BindingPart>>;
  /**
   * Parti che ricevono props da `use<Comp>Behavior` (file `<Comp>.behavior.ts`,
   * scritto a mano accanto al generato, mai sovrascritto). Comportamento: stato, eventi.
   */
  readonly behavior?: readonly string[];
}

/**
 * Spike 2026-10-11 — una sezione vista dalla pipeline come un contratto: i
 * field `enum` indicati diventano gli assi delle celle Penpot, gli altri
 * restano field. Gli slot passano al collegamento.
 */
export function sectionContract(section: SectionDefinition, opts: { axes: readonly string[] }): ComponentContract & { readonly slots: SectionDefinition["slots"]; readonly examples: NonNullable<SectionDefinition["root"]["children"]>; readonly rootProps: Record<string, unknown> } {
  const axes = opts.axes.map((name) => {
    const field = section.fields[name];
    if (field === undefined) throw new Error(`sezione ${section.name}: asse "${name}" non è un field`);
    let schema = field.schema as unknown as { def?: { type?: string; innerType?: unknown; defaultValue?: unknown; entries?: Record<string, string> } };
    let def: string | undefined;
    if (schema.def?.type === "default") {
      def = schema.def.defaultValue as string;
      schema = schema.def.innerType as typeof schema;
    }
    if (schema.def?.type !== "enum") throw new Error(`sezione ${section.name}: asse "${name}" deve essere un enum`);
    const values = Object.values(schema.def.entries!) as [string, ...string[]];
    return { name, type: "option" as const, values, default: def ?? values[0] };
  });
  const fields = Object.fromEntries(Object.entries(section.fields).filter(([k]) => !opts.axes.includes(k)));
  return { name: section.name, version: section.version, axes, fields, slots: section.slots, examples: section.root.children ?? [], rootProps: section.root.props };
}

/** Controlli locali (senza Penpot): i field citati esistono nel contratto dell'editor, i `when` usano assi e valori veri. */
export function defineBinding<C extends ComponentContract>(contract: C, def: Omit<Binding<C>, "contract" | "slots" | "examples" | "rootProps">): Binding<C> {
  const fields = new Set(Object.keys(contract.fields));
  const problems: string[] = [];
  for (const [part, p] of Object.entries(def.parts)) {
    if (p.content !== undefined && !fields.has(p.content)) problems.push(`parte "${part}": content "${p.content}" non è un field di ${contract.name}`);
    for (const [attr, field] of Object.entries(p.attribute ?? {})) {
      if (!fields.has(field)) problems.push(`parte "${part}": attributo ${attr} ← "${field}" non è un field di ${contract.name}`);
    }
    for (const [inner, field] of Object.entries(p.fields ?? {})) {
      if (!fields.has(field)) problems.push(`parte "${part}": ${inner} ← "${field}" non è un field di ${contract.name}`);
      if (p.component === undefined) problems.push(`parte "${part}": "fields" senza "component"`);
    }
    const slotIds = ((contract as { slots?: { id: string }[] }).slots ?? []).map((s) => s.id);
    for (const ref of [p.slot, p.repeat]) if (ref !== undefined && !slotIds.includes(ref)) problems.push(`parte "${part}": slot "${ref}" non dichiarato nella sezione`);
    if (p.icon !== undefined && !/^lucide:[A-Z][A-Za-z0-9]*$/.test(p.icon)) problems.push(`parte "${part}": icona "${p.icon}" non nel formato lucide:Nome`);
    for (const attr of Object.keys(p.aria ?? {})) {
      if (!/^(aria-[a-z]+|role)$/.test(attr)) problems.push(`parte "${part}": aria "${attr}" non è un attributo aria-* o role`);
    }
    for (const [axis, values] of Object.entries(p.when ?? {})) {
      const a = contract.axes.find((x) => x.name === axis);
      if (a === undefined) problems.push(`parte "${part}": when su asse inesistente "${axis}"`);
      else for (const v of values) if (!(a.values as readonly string[]).includes(v)) problems.push(`parte "${part}": when ${axis}="${v}" non è un valore dell'asse`);
    }
  }
  if (problems.length > 0) throw new Error(`collegamento ${contract.name} non valido:\n- ${problems.join("\n- ")}`);
  const { slots, examples, rootProps } = contract as { slots?: Binding["slots"]; examples?: Binding["examples"]; rootProps?: Binding["rootProps"] };
  return { contract, ...def, ...(slots !== undefined ? { slots, examples, rootProps } : {}) };
}
