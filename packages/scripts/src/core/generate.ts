import type { ComponentContract } from "@app/contracts";

import { isGenerated, readGeneratedHeader, withGeneratedHeader } from "./hash";
import { camelCase, pascalCase, propAccess, propKey } from "./naming";
import type { Cella, Change, Finding, PluginData, Suggerimento } from "./schemas";
import { analyzeComponent, axesKey, isPartUsed, isStopping, ROOT_KEY, type ComponentModel, type CoreInput, type ModelCell, type ModelPart } from "./verify";

/**
 * Generatore unico (Story 2.22): dal modello di `analyzeComponent` scrive
 * `<Comp>.styles.ts` e `<Comp>.stories.tsx` (`@generated`, deterministici
 * byte per byte) e, solo se il `<Comp>.tsx` non esiste, il suo scaffold.
 * Nessun codice per componente: tutto viene dal contratto e dalla `Lettura`.
 */

/** La cartella dei componenti, relativa alla root del repo. */
export const DOMAINS_DIR = "packages/ui/src/domains";

export interface ComponentPaths {
  readonly styles: string;
  readonly stories: string;
  readonly tsx: string;
}

/** I tre file di un componente: una cartella per componente (`domains/<kebab>/`). */
export function componentPaths(name: string): ComponentPaths {
  const comp = pascalCase(name);
  const dir = `${DOMAINS_DIR}/${name}`;
  return { styles: `${dir}/${comp}.styles.ts`, stories: `${dir}/${comp}.stories.tsx`, tsx: `${dir}/${comp}.tsx` };
}

export interface GenerateInput extends CoreInput {
  /** I componenti già generati (nomi kebab): un'istanza annidata deve stare qui. */
  readonly generated: readonly string[];
  /** Lo `styles.ts` attuale, se esiste: per l'aggiornamento e per il confronto delle parti. */
  readonly existingStyles?: string;
  /** Lo `stories.tsx` attuale, se esiste. */
  readonly existingStories?: string;
}

export interface GenerateResult {
  readonly changes: Change[];
  readonly findings: Finding[];
  /** Cambi di struttura per il TSX dello sviluppatore: mai applicati. */
  readonly suggestions: Suggerimento[];
}

const importLine = (what: string, specifier: string): string => `import ${what} from ${JSON.stringify(specifier)};`;

const q = (text: string): string => JSON.stringify(text);

// --- Field del contratto: tipo TS e campione per le story -------------------

interface FieldShape {
  readonly ts: string;
  readonly optional: boolean;
  /** Il campione per le story; assente = nessun campione (field omesso o tipo non riconosciuto). */
  readonly sample?: unknown;
  /** Il tipo zod (o uno annidato) non è riconosciuto: `unknown`, con un avviso. */
  readonly unrecognized?: true;
}

const unrecognizedOf = (shape: FieldShape): { unrecognized?: true } => (shape.unrecognized ? { unrecognized: true } : {});

interface ZodDefLike {
  readonly type?: string;
  readonly innerType?: unknown;
  readonly element?: unknown;
  readonly entries?: Readonly<Record<string, string | number>>;
  readonly values?: readonly unknown[];
}

function defOf(schema: unknown): ZodDefLike {
  return ((schema as { _zod?: { def?: ZodDefLike } })._zod?.def ?? {}) as ZodDefLike;
}

/** Tipo TS e campione di un field, dallo schema zod: stringa → nome del field, numero 1, booleano false, enum → primo valore. */
export function fieldShape(name: string, schema: unknown): FieldShape {
  const def = defOf(schema);
  switch (def.type) {
    case "optional":
    case "default": {
      const inner = fieldShape(name, def.innerType);
      return { ts: inner.ts, optional: true, ...unrecognizedOf(inner) };
    }
    case "nullable": {
      const inner = fieldShape(name, def.innerType);
      return { ts: `${inner.ts} | null`, optional: inner.optional, ...(inner.sample === undefined ? {} : { sample: inner.sample }), ...unrecognizedOf(inner) };
    }
    case "string":
      return { ts: "string", optional: false, sample: name };
    case "number":
      return { ts: "number", optional: false, sample: 1 };
    case "boolean":
      return { ts: "boolean", optional: false, sample: false };
    case "enum": {
      const values = Object.values(def.entries ?? {});
      return values.length === 0
        ? { ts: "never", optional: false }
        : { ts: values.map((value) => JSON.stringify(value)).join(" | "), optional: false, sample: values[0] };
    }
    case "literal": {
      const values = def.values ?? [];
      return values.length === 0 ? { ts: "never", optional: false } : { ts: values.map((value) => JSON.stringify(value)).join(" | "), optional: false, sample: values[0] };
    }
    case "array": {
      const element = fieldShape(name, def.element);
      return { ts: `readonly (${element.ts})[]`, optional: false, sample: [], ...unrecognizedOf(element) };
    }
    default:
      return { ts: "unknown", optional: true, unrecognized: true };
  }
}

function fieldsOf(contract: ComponentContract): [string, FieldShape][] {
  return Object.entries(contract.fields).map(([name, field]) => [name, fieldShape(name, field.schema)]);
}

// --- Scomposizione in cva ---------------------------------------------------

export interface Decomposition {
  readonly base: string[];
  /** Asse → valore → classi (tutti gli assi e tutti i valori, liste vuote dove non cambia niente). */
  readonly variants: Record<string, Record<string, string[]>>;
  readonly compounds: { readonly when: Readonly<Record<string, string>>; readonly classes: string[] }[];
}

/**
 * Le classi per cella → `cva`: comuni a tutte le celle nella base, spiegate
 * da un solo asse in `variants`, le altre in `compoundVariants` (una voce per
 * combinazione di valori). Contano solo le celle in cui la parte c'è.
 */
export function decompose(contract: ComponentContract, cells: readonly { readonly axes: Readonly<Record<string, string>>; readonly classes: readonly string[] }[]): Decomposition {
  const variants: Record<string, Record<string, string[]>> = {};
  for (const axis of contract.axes) variants[axis.name] = Object.fromEntries(axis.values.map((value) => [value, [] as string[]]));
  if (cells.length === 0) return { base: [], variants, compounds: [] };
  const base = cells[0]!.classes.filter((cls) => cells.every((cell) => cell.classes.includes(cls)));
  const rest = [...new Set(cells.flatMap((cell) => cell.classes.filter((cls) => !base.includes(cls))))].sort();
  const compounds = new Map<string, { when: Record<string, string>; classes: string[] }>();
  for (const cls of rest) {
    const having = cells.filter((cell) => cell.classes.includes(cls));
    const axis = contract.axes.find((candidate) => {
      const values = new Set(having.map((cell) => cell.axes[candidate.name]));
      return cells.every((cell) => cell.classes.includes(cls) === values.has(cell.axes[candidate.name]));
    });
    if (axis !== undefined) {
      for (const value of new Set(having.map((cell) => cell.axes[axis.name]!))) variants[axis.name]![value]!.push(cls);
      continue;
    }
    for (const cell of having) {
      const key = axesKey(contract, cell.axes);
      const entry = compounds.get(key) ?? { when: Object.fromEntries(contract.axes.map((a) => [a.name, cell.axes[a.name]!])), classes: [] };
      entry.classes.push(cls);
      compounds.set(key, entry);
    }
  }
  const rank = (when: Readonly<Record<string, string>>): number[] => contract.axes.map((a) => (a.values as readonly string[]).indexOf(when[a.name]!));
  const ordered = [...compounds.values()].sort((a, b) => {
    const ra = rank(a.when);
    const rb = rank(b.when);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i]! - rb[i]!;
    return 0;
  });
  return { base: [...base].sort(), variants, compounds: ordered };
}

// --- styles.ts --------------------------------------------------------------

function axesType(contract: ComponentContract, comp: string): string {
  if (contract.axes.length === 0) return `export type ${comp}Axes = Record<never, never>;`;
  const lines = contract.axes.map((axis) => `  readonly ${propKey(axis.name)}?: ${axis.values.map(q).join(" | ")};`);
  return [`export type ${comp}Axes = {`, ...lines, "};"].join("\n");
}

function partCells(model: ComponentModel, part: ModelPart): { axes: Readonly<Record<string, string>>; classes: readonly string[] }[] {
  return model.baseCells.filter((cell) => part.classes.has(cell.index)).map((cell) => ({ axes: cell.axes, classes: part.classes.get(cell.index)! }));
}

function renderCva(model: ComponentModel, part: ModelPart): string {
  const { contract } = model;
  const d = decompose(contract, partCells(model, part));
  const base = q(d.base.join(" "));
  if (contract.axes.length === 0) return `  ${propKey(part.key)}: cva(${base}),`;
  const lines = [`  ${propKey(part.key)}: cva(${base}, {`, "    variants: {"];
  for (const axis of contract.axes) {
    lines.push(`      ${propKey(axis.name)}: {`);
    for (const value of axis.values) lines.push(`        ${propKey(value)}: ${q(d.variants[axis.name]![value]!.join(" "))},`);
    lines.push("      },");
  }
  lines.push("    },");
  if (d.compounds.length > 0) {
    lines.push("    compoundVariants: [");
    for (const compound of d.compounds) {
      const when = contract.axes.map((axis) => `${propKey(axis.name)}: ${q(compound.when[axis.name]!)}`).join(", ");
      lines.push(`      { ${when}, class: ${q(compound.classes.join(" "))} },`);
    }
    lines.push("    ],");
  }
  const defaults = contract.axes.map((axis) => `${propKey(axis.name)}: ${q(axis.default)}`).join(", ");
  lines.push(`    defaultVariants: { ${defaults} },`, "  }),");
  return lines.join("\n");
}

function objectLiteral(props: Readonly<Record<string, string>>): string {
  const entries = Object.entries(props);
  return entries.length === 0 ? "{}" : `{ ${entries.map(([key, value]) => `${propKey(key)}: ${q(value)}`).join(", ")} }`;
}

function renderInstance(model: ComponentModel, part: ModelPart): { table?: string; entry: string } {
  const { comp, id, contract } = model;
  const nested = pascalCase(part.instance!.name);
  const perCell = model.baseCells.filter((cell) => part.instanceProps.has(cell.index)).map((cell) => [axesKey(contract, cell.axes), part.instanceProps.get(cell.index)!] as const);
  const distinct = new Set(perCell.map(([, props]) => JSON.stringify(props)));
  if (distinct.size <= 1) {
    const props = perCell[0]?.[1] ?? {};
    return { entry: `  ${propKey(part.key)}: (_axes: ${comp}Axes = {}): ${nested}Axes => (${objectLiteral(props)}),` };
  }
  const table = `${id}${pascalCase(part.key)}Instances`;
  const rows = perCell.map(([key, props]) => `  ${q(key)}: ${objectLiteral(props)},`);
  const lookup = contract.axes.map((axis) => `axes${propAccess(axis.name)} ?? ${q(axis.default)}`).join(", ");
  return {
    table: [`const ${table}: Readonly<Record<string, ${nested}Axes>> = {`, ...rows, "};"].join("\n"),
    entry: `  ${propKey(part.key)}: (axes: ${comp}Axes = {}): ${nested}Axes => ${table}[[${lookup}].join("|")] ?? {},`,
  };
}

/** Il corpo di `<Comp>.styles.ts`, senza intestazione. */
export function renderStyles(model: ComponentModel): string {
  const { comp, id, contract, parts } = model;
  const instances = parts.filter((part) => part.instance !== undefined);
  const nestedImports = [...new Set(instances.map((part) => part.instance!.name))]
    .sort()
    .map((name) => importLine(`type { ${pascalCase(name)}Axes }`, `../${name}/${pascalCase(name)}.styles`));
  const lists = parts.filter((part) => part.list).map((part) => q(part.key));
  const out = [importLine("{ cva }", "class-variance-authority"), ""];
  if (nestedImports.length > 0) out.push(...nestedImports, "");
  out.push(
    `/** Assi \`option\` del contratto "${contract.name}" (v${contract.version}). */`,
    axesType(contract, comp),
    "",
    "/** Le parti: la chiave è il `data-slot` dell'elemento nel TSX. */",
    `export const ${id}Parts = [${parts.map((part) => q(part.key)).join(", ")}] as const;`,
    "",
    "/** Le parti che si ripetono (un `.map` nel TSX, una `cva` sola). */",
    `export const ${id}ListParts = [${lists.join(", ")}] as const;`,
    "",
    `export const ${id}Styles = {`,
    ...parts.map((part) => renderCva(model, part)),
    "};",
  );
  if (instances.length > 0) {
    const rendered = instances.map((part) => renderInstance(model, part));
    const tables = rendered.flatMap((item) => (item.table === undefined ? [] : [item.table, ""]));
    out.push("", ...tables, "/** Le props di variante delle istanze annidate, per gli assi del componente. */", `export const ${id}Instances = {`, ...rendered.map((item) => item.entry), "};");
  }
  return `${out.join("\n")}\n`;
}

// --- stories.tsx ------------------------------------------------------------

function literal(value: unknown): string {
  return JSON.stringify(value);
}

function storyName(contract: ComponentContract, cell: ModelCell, taken: Set<string>): string {
  let name = contract.axes.map((axis) => pascalCase(camelCase(cell.axes[axis.name]!))).join("") || "Default";
  name = name.replace(/[^A-Za-z0-9_$]/g, "");
  if (name === "" || /^\d/.test(name)) name = `V${name}`;
  let unique = name;
  for (let i = 2; taken.has(unique); i++) unique = `${name}${i}`;
  taken.add(unique);
  return unique;
}

function fieldArgs(contract: ComponentContract): string[] {
  return fieldsOf(contract).flatMap(([name, shape]) => (shape.optional || shape.sample === undefined ? [] : [`${propKey(name)}: ${literal(shape.sample)}`]));
}

/** Il corpo di `<Comp>.stories.tsx`, senza intestazione: una story per cella non di stato. */
export function renderStories(model: ComponentModel): string {
  const { comp, contract } = model;
  const taken = new Set<string>();
  const fields = fieldArgs(contract);
  const stories = model.baseCells.map((cell) => {
    const args = [...contract.axes.map((axis) => `${propKey(axis.name)}: ${q(cell.axes[axis.name]!)}`), ...fields];
    return `export const ${storyName(contract, cell, taken)}: Story = { args: { ${args.join(", ")} } };`;
  });
  return [
    importLine("type { Meta, StoryObj }", "@storybook/react"),
    "",
    importLine(`{ ${comp} }`, `./${comp}`),
    "",
    `const meta = { title: ${q(`Domains/${comp}`)}, component: ${comp} } satisfies Meta<typeof ${comp}>;`,
    "",
    "export default meta;",
    "",
    "type Story = StoryObj<typeof meta>;",
    "",
    ...stories,
    "",
  ].join("\n");
}

// --- scaffold <Comp>.tsx ----------------------------------------------------

const VOID_ELEMENTS = new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

function nestedFieldAttributes(contract: ComponentContract): string {
  return fieldsOf(contract)
    .flatMap(([name, shape]) => (shape.optional || shape.sample === undefined ? [] : [` ${name}={${literal(shape.sample)}}`]))
    .join("");
}

function renderPart(model: ComponentModel, part: ModelPart, fields: ReadonlySet<string>, depth: number): string[] {
  const pad = "  ".repeat(depth);
  const { id } = model;
  const className = `s${propAccess(part.key)}(axes)`;
  let lines: string[];
  if (part.instance !== undefined) {
    const nested = pascalCase(part.instance.name);
    lines = [`${pad}<${nested} className={${className}} {...${id}Instances${propAccess(part.key)}(axes)}${nestedFieldAttributes(part.instance.contract)} />`];
  } else {
    const tag = part.element ?? "div";
    const field = fields.has(camelCase(part.key)) ? camelCase(part.key) : undefined;
    const attributes = [`data-slot=${q(part.key)}`, `className={${className}}`];
    if (tag === "img") attributes.push(field === undefined ? 'alt=""' : `src={${field}}`, ...(field === undefined ? [] : ['alt=""']));
    const open = `${pad}<${tag} ${attributes.join(" ")}`;
    if (VOID_ELEMENTS.has(tag)) lines = [`${open} />`];
    else if (part.children.length === 0) lines = [field === undefined || tag === "img" ? `${open} />` : `${open}>{${field}}</${tag}>`];
    else {
      lines = [`${open}>`];
      for (const child of part.children) {
        const childPart = model.parts.find((candidate) => candidate.key === child);
        if (childPart !== undefined) lines.push(...renderPart(model, childPart, fields, depth + 1));
      }
      lines.push(`${pad}</${tag}>`);
    }
  }
  if (!part.list) return lines;
  const inner = lines.map((line) => `  ${line}`);
  inner[0] = inner[0]!.replace(/^(\s*)<(\S+)/, "$1<$2 key={i}");
  return [`${pad}{Array.from({ length: ${part.copies} }, (_, i) => (`, ...inner, `${pad}))}`];
}

/** Lo scaffold di `<Comp>.tsx`: si scrive una volta sola, poi è dello sviluppatore. */
export function renderScaffold(model: ComponentModel): string {
  const { comp, id, contract, parts } = model;
  const root = parts[0]!;
  const tag = root.element ?? "div";
  const fields = fieldsOf(contract);
  const fieldNames = new Set(fields.map(([name]) => name));
  const instances = [...new Set(parts.filter((part) => part.instance !== undefined).map((part) => part.instance!.name))].sort();
  const stylesImports = [`type ${comp}Axes`, ...(instances.length > 0 ? [`${id}Instances`] : []), `${id}Styles as s`];
  const axisNames = contract.axes.map((axis) => axis.name);
  const destructured = ["className", ...axisNames, ...fields.map(([name]) => name), "...props"];
  const fieldsType =
    fields.length === 0
      ? `export type ${comp}Fields = Record<never, never>;`
      : [`export type ${comp}Fields = {`, ...fields.map(([name, shape]) => `  readonly ${propKey(name)}${shape.optional ? "?" : ""}: ${shape.ts};`), "};"].join("\n");
  const rootLines = renderPart(model, { ...root, list: false }, fieldNames, 2);
  // La radice: `data-slot` = nome del contratto, `cn(…, className)` e `{...props}`.
  rootLines[0] = rootLines[0]!
    .replace(`data-slot=${q(root.key)}`, `data-slot=${q(contract.name)}`)
    .replace(`className={s${propAccess(root.key)}(axes)}`, `className={cn(s${propAccess(root.key)}(axes), className)} {...props}`);
  return [
    "// Scaffold di pds: da qui in poi questo file è dello sviluppatore e la rigenerazione non lo tocca.",
    importLine("type { ComponentProps }", "react"),
    "",
    importLine("{ cn }", "../../lib/utils"),
    ...instances.map((name) => importLine(`{ ${pascalCase(name)} }`, `../${name}/${pascalCase(name)}`)),
    importLine(`{ ${stylesImports.join(", ")} }`, `./${comp}.styles`),
    "",
    fieldsType,
    "",
    `export type ${comp}Props = Omit<ComponentProps<${q(tag)}>, keyof ${comp}Axes | keyof ${comp}Fields> & ${comp}Axes & ${comp}Fields;`,
    "",
    `export function ${comp}({ ${destructured.join(", ")} }: ${comp}Props) {`,
    axisNames.length === 0 ? "  const axes = {};" : `  const axes = { ${axisNames.map(propKey).join(", ")} };`,
    "  return (",
    ...rootLines,
    "  );",
    "}",
    "",
  ].join("\n");
}

// --- Cambio di struttura ----------------------------------------------------

/** Le parti e le liste dichiarate in uno `styles.ts` generato. */
export function partsOfStyles(text: string, id: string): { parts: string[]; lists: string[] } | undefined {
  const read = (suffix: string): string[] | undefined => {
    const match = new RegExp(`export const ${id}${suffix} = \\[([^\\]]*)\\] as const;`).exec(text);
    if (match === null) return undefined;
    return [...match[1]!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(([, key]) => JSON.parse(`"${key!}"`) as string);
  };
  const parts = read("Parts");
  if (parts === undefined) return undefined;
  return { parts, lists: read("ListParts") ?? [] };
}

function usageLines(tsx: string, key: string): string[] {
  return tsx.split("\n").filter((line) => isPartUsed(line, key));
}

function suggest(model: ComponentModel, previous: { parts: string[]; lists: string[] }, tsx: string): Suggerimento[] {
  const out: Suggerimento[] = [];
  const now = model.parts.map((part) => part.key);
  for (const part of model.parts) {
    if (previous.parts.includes(part.key)) continue;
    const parentLine = part.parent === undefined ? undefined : usageLines(tsx, part.parent)[0];
    const indent = parentLine === undefined ? "" : `${/^\s*/.exec(parentLine)![0]}  `;
    const snippet =
      part.instance === undefined
        ? `${indent}<${part.element ?? "div"} data-slot=${q(part.key)} className={s${propAccess(part.key)}(axes)} />`
        : `${indent}<${pascalCase(part.instance.name)} className={s${propAccess(part.key)}(axes)} {...${model.id}Instances${propAccess(part.key)}(axes)} />`;
    out.push({
      part: part.key,
      kind: "aggiunta",
      message: `Parte nuova "${part.key}" (layer "${part.layerName}") dentro "${part.parent ?? ROOT_KEY}": aggiungila al TSX con data-slot="${part.key}".`,
      example: parentLine === undefined ? snippet : `${parentLine}\n${snippet}`,
    });
  }
  for (const key of previous.parts) {
    if (now.includes(key)) continue;
    out.push({
      part: key,
      kind: "rimozione",
      message: `La parte "${key}" non c'è più in Penpot: toglila dal TSX (s${propAccess(key)} non esiste più).`,
      example: usageLines(tsx, key).join("\n"),
    });
  }
  for (const part of model.parts) {
    if (!part.list || previous.lists.includes(part.key) || !previous.parts.includes(part.key)) continue;
    const line = usageLines(tsx, part.key)[0] ?? `<${part.element ?? "div"} data-slot=${q(part.key)} className={s${propAccess(part.key)}(axes)} />`;
    const indent = /^\s*/.exec(line)![0];
    const item = line.trimStart().replace(/^<(\S+)/, "<$1 key={i}");
    out.push({
      part: part.key,
      kind: "lista",
      message: `La parte "${part.key}" ora si ripete (${part.copies} copie in Penpot): rendila con un .map, la cva resta una.`,
      example: `${indent}{Array.from({ length: ${part.copies} }, (_, i) => (\n${indent}  ${item}\n${indent}))}`,
    });
  }
  return out;
}

// --- generateComponent ------------------------------------------------------

function fileChange(path: string, content: string, existing: string | undefined, findings: Finding[]): Change | undefined {
  if (existing === undefined) return { action: "crea", path, content };
  if (!isGenerated(existing)) {
    findings.push({ level: "blocco", where: path, message: "Il file esiste ma non ha il marker @generated di pds: non si sovrascrive mai. Spostalo o cancellalo a mano." });
    return undefined;
  }
  // Una copia di lavoro in CRLF è lo stesso file: si confronta dopo aver portato tutto a LF.
  if (existing.replace(/\r\n?/g, "\n") === content) return undefined;
  if (readGeneratedHeader(existing)?.ok === false) {
    findings.push({ level: "avviso", where: path, message: "Il file @generated era stato modificato a mano (hash diverso): la rigenerazione lo sovrascrive." });
  }
  return { action: "aggiorna", path, content };
}

/**
 * Verifica e generazione di un componente. Con un blocco o una domanda
 * aperta non c'è nessun `Change`. Il `<Comp>.tsx` si crea solo se
 * `existingTsx` manca e non compare mai in un `aggiorna`/`elimina`.
 */
export function generateComponent(
  lettura: { readonly component: string; readonly pluginData?: PluginData; readonly cells: readonly Cella[] },
  input: GenerateInput,
): GenerateResult {
  const { model, findings } = analyzeComponent(lettura, input);
  if (model !== undefined) {
    for (const part of model.parts) {
      if (part.instance !== undefined && !input.generated.includes(part.instance.name)) {
        findings.push({
          level: "blocco",
          where: `parte "${part.key}"`,
          message: `Istanza di "${part.instance.name}", che non è ancora generato: genera prima "${part.instance.name}" (build_order).`,
        });
      }
    }
  }
  if (model !== undefined) {
    for (const [name, shape] of fieldsOf(model.contract)) {
      if (shape.unrecognized) {
        findings.push({
          level: "avviso",
          where: `field "${name}"`,
          message: `Il tipo zod del field "${name}" non è riconosciuto: nel TSX diventa "${shape.ts}" (opzionale se non ha campione) e la story non ha un campione. Per tradurlo aggiungi il tipo a fieldShape (src/core/generate.ts) con un test.`,
        });
      }
    }
  }
  if (model === undefined || findings.some(isStopping)) return { changes: [], findings, suggestions: [] };

  const paths = componentPaths(model.name);
  const styles = withGeneratedHeader(renderStyles(model));
  const stories = withGeneratedHeader(renderStories(model));
  const changes: Change[] = [];
  const pending = [fileChange(paths.styles, styles, input.existingStyles, findings), fileChange(paths.stories, stories, input.existingStories, findings)];
  if (findings.some(isStopping)) return { changes: [], findings, suggestions: [] };
  for (const change of pending) if (change !== undefined) changes.push(change);
  const scaffold = input.existingTsx === undefined ? renderScaffold(model) : undefined;
  if (scaffold !== undefined) changes.push({ action: "crea", path: paths.tsx, content: scaffold });

  const previous = input.existingStyles === undefined ? undefined : partsOfStyles(input.existingStyles, model.id);
  const suggestions = previous === undefined ? [] : suggest(model, previous, input.existingTsx ?? scaffold ?? "");
  return { changes, findings, suggestions };
}
