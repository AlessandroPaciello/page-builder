/**
 * Spike 2026-10-10 — verifica (VC) e generazione (GC) generiche.
 *
 * Ingredienti: contratto dell'editor + collegamento + lettura di Penpot
 * (LibrarySnapshot) + catalogo token. Nessuna funzione per componente.
 * - Struttura: albero dei layer di Penpot, unione delle celle.
 * - Aspetto: token → classi Tailwind con il registro, per cella; le classi
 *   comuni a tutte le celle vanno nella base, le altre in una tabella per cella.
 * - Collegamento: elementi, field, componenti annidati, `when`.
 */
import type { ComponentContract } from "@app/contracts";

import type { LibrarySnapshot, SnapshotComponent, SnapshotLayer } from "../library/library-snapshot";
import { propertyDefinition } from "../shared/style-properties";
import { varSuffix, type TokenCatalog, type TokenType } from "../shared/theme-generator";
import type { Binding, BindingPart } from "./binding";

export interface Finding {
  readonly level: "blocco" | "avviso";
  readonly where: string;
  readonly message: string;
}

export interface TemplateNode {
  readonly part: string;
  readonly layer: string;
  readonly kind: string;
  readonly children: TemplateNode[];
  /** cella → layer di Penpot in quella cella. */
  readonly byCell: Map<string, SnapshotLayer>;
}

export const camel = (name: string): string => {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words.map((w, i) => (i === 0 ? w[0]!.toLowerCase() + w.slice(1) : w[0]!.toUpperCase() + w.slice(1))).join("");
};
export const pascal = (kebab: string): string => kebab.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
export const kebab = (camelName: string): string => camelName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

export function cellKeyOf(contract: ComponentContract, props: Readonly<Record<string, string>>): string {
  return contract.axes.map((a) => `${a.name}=${props[a.name]}`).join("|");
}

export function findContainer(snapshot: LibrarySnapshot, contract: ComponentContract): SnapshotComponent | undefined {
  return snapshot.components.find((c) => c.pluginData === `${contract.name}@${contract.version}`);
}

/** Unione degli alberi delle celle: stesso nome di layer allo stesso livello = stessa parte. */
function buildTemplate(container: SnapshotComponent, contract: ComponentContract): TemplateNode {
  const root: TemplateNode = { part: "root", layer: "(board)", kind: "board", children: [], byCell: new Map() };
  const merge = (node: TemplateNode, layer: SnapshotLayer, key: string): void => {
    node.byCell.set(key, layer);
    layer.children.forEach((child, index) => {
      let target = node.children.find((c) => c.layer === child.name);
      if (target === undefined) {
        target = { part: camel(child.name), layer: child.name, kind: child.kind, children: [], byCell: new Map() };
        // Mantiene l'ordine dei layer di Penpot: inserisce dopo il fratello che lo precede.
        const prev = index > 0 ? layer.children[index - 1]!.name : null;
        const at = prev === null ? 0 : node.children.findIndex((c) => c.layer === prev) + 1;
        node.children.splice(at <= 0 && prev !== null ? node.children.length : at, 0, target);
      }
      merge(target, child, key);
    });
  };
  for (const cell of container.cells) {
    if (cell.variantProps === null) continue;
    merge(root, cell.root, cellKeyOf(contract, cell.variantProps));
  }
  return root;
}

/** Esempi degli slot (figli in Penpot), per cella: servono agli stili dell'elemento che avvolge ogni figlio. */
export const slotExamples = new WeakMap<TemplateNode, Map<string, SnapshotLayer[]>>();

export function walk(node: TemplateNode, visit: (n: TemplateNode, parent: TemplateNode | null) => void, parent: TemplateNode | null = null): void {
  visit(node, parent);
  for (const child of node.children) walk(child, visit, node);
}

export function allCellKeys(contract: ComponentContract): string[] {
  let out: Record<string, string>[] = [{}];
  for (const axis of contract.axes) out = out.flatMap((p) => axis.values.map((v) => ({ ...p, [axis.name]: v })));
  return out.map((p) => cellKeyOf(contract, p));
}

function cellsMatchingWhen(contract: ComponentContract, when: BindingPart["when"]): string[] {
  return allCellKeys(contract).filter((key) => {
    const props = Object.fromEntries(key.split("|").map((kv) => kv.split("=") as [string, string]));
    return Object.entries(when ?? {}).every(([axis, values]) => values.includes(props[axis]!));
  });
}

/** [VC] Verifica: blocca solo per struttura; il resto sono avvisi. */
export function verify(binding: Binding, container: SnapshotComponent | undefined, contracts: Readonly<Record<string, ComponentContract>>): { findings: Finding[]; template?: TemplateNode } {
  const contract = binding.contract;
  const findings: Finding[] = [];
  if (container === undefined) {
    findings.push({ level: "blocco", where: contract.name, message: `nessun container Penpot con plugin data "${contract.name}@${contract.version}"` });
    return { findings };
  }
  const expectedKeys = allCellKeys(contract);
  const actualKeys = container.cells.filter((c) => c.variantProps !== null).map((c) => cellKeyOf(contract, c.variantProps!));
  for (const key of expectedKeys) if (!actualKeys.includes(key)) findings.push({ level: "blocco", where: `cella ${key}`, message: "cella assente in Penpot" });
  for (const key of actualKeys) if (!expectedKeys.includes(key)) findings.push({ level: "blocco", where: `cella ${key}`, message: "cella in più in Penpot (valore non previsto dal contratto)" });

  const template = buildTemplate(container, contract);
  // Spike 2026-10-11 — slot: i figli in Penpot sono esempi (istanze dei componenti ammessi).
  walk(template, (n) => {
    const def = binding.parts[n.part];
    if (def?.slot === undefined) return;
    const allow = binding.slots?.find((s) => s.id === def.slot)?.allow ?? [];
    const examples = new Map<string, SnapshotLayer[]>();
    for (const [key, layer] of n.byCell) {
      examples.set(key, layer.children);
      for (const child of layer.children) {
        const name = (child.instance?.contract ?? "").split("@")[0]!;
        if (child.instance === undefined || !allow.includes(name)) findings.push({ level: "blocco", where: `slot ${def.slot}, cella ${key}`, message: `"${child.name}" non è un'istanza di ${allow.join(" | ")}` });
        else for (const o of child.instance.overrides) findings.push({ level: "blocco", where: `slot ${def.slot}, cella ${key}`, message: `override sull'esempio (D2): ${o.split(": ")[0]}` });
      }
    }
    slotExamples.set(n, examples);
    n.children.splice(0);
  });
  const byPart = new Map<string, TemplateNode>();
  walk(template, (n) => byPart.set(n.part, n));

  for (const [part, def] of Object.entries(binding.parts)) {
    const node = byPart.get(part);
    if (node === undefined) {
      findings.push({ level: "blocco", where: `parte ${part}`, message: `nessun layer "${pascal(kebab(part))}" in Penpot per la parte collegata` });
      continue;
    }
    const present = [...node.byCell.keys()].sort();
    const instances = [...node.byCell.values()].map((l) => l.instance);
    if (def.component !== undefined) {
      instances.forEach((inst, i) => {
        const key = [...node.byCell.keys()][i]!;
        if (inst === undefined) findings.push({ level: "blocco", where: `parte ${part}, cella ${key}`, message: `doveva essere un'istanza di ${def.component}, è un layer disegnato` });
        else if ((inst.contract ?? "").split("@")[0] !== def.component) findings.push({ level: "blocco", where: `parte ${part}, cella ${key}`, message: `doveva essere un'istanza di ${def.component}, è un'istanza di ${inst.contract ?? "componente senza plugin data"}` });
        else {
          const inner = contracts[def.component!];
          for (const axis of inner?.axes ?? []) {
            const v = inst.props[axis.name];
            if (v === undefined || !(axis.values as readonly string[]).includes(v)) findings.push({ level: "blocco", where: `parte ${part}, cella ${key}`, message: `variante ${axis.name}=${String(v)} non prevista dal contratto ${def.component}` });
          }
          for (const o of inst.overrides) findings.push({ level: "blocco", where: `parte ${part}, cella ${key}`, message: `override sull'istanza (D2): ${o.split(": ")[0]}` });
          for (const f of Object.keys(inner?.fields ?? {})) {
            if (def.fields?.[f] === undefined) findings.push({ level: "avviso", where: `parte ${part}`, message: `il field "${f}" di ${def.component} non riceve nessun field: nel codice resterà vuoto` });
          }
        }
      });
    } else if (instances.some((i) => i !== undefined)) {
      findings.push({ level: "avviso", where: `parte ${part}`, message: `in Penpot è un'istanza di ${instances.find(Boolean)!.contract}, non registrata nel collegamento: aggiornalo con [MS]` });
    }
    if (def.when !== undefined) {
      const expected = cellsMatchingWhen(contract, def.when).sort();
      if (JSON.stringify(expected) !== JSON.stringify(present)) findings.push({ level: "blocco", where: `parte ${part}`, message: `presenza diversa dal collegamento: attesa in [${expected.join(", ")}], trovata in [${present.join(", ")}]` });
    }
  }
  for (const part of binding.behavior ?? []) {
    if (!byPart.has(part)) findings.push({ level: "blocco", where: `comportamento`, message: `la parte "${part}" che riceve il comportamento non esiste in Penpot` });
  }
  // Parti presenti solo in alcune celle e non registrate.
  walk(template, (n) => {
    if (n.part === "root") return;
    const def = binding.parts[n.part];
    if (n.byCell.size < expectedKeys.length && def?.when === undefined) {
      findings.push({ level: "blocco", where: `parte ${n.part}`, message: `esiste solo in [${[...n.byCell.keys()].sort().join(", ")}] ma il collegamento non dice quando (when): registralo con [MS]` });
    }
    if (n.kind === "text" && def?.content === undefined) {
      findings.push({ level: "blocco", where: `parte ${n.part}`, message: `testo senza field nel contratto: da dove arriva il contenuto? [MS]` });
    }
  });
  // Stili senza token (avvisi).
  walk(template, (n) => {
    for (const [key, layer] of n.byCell) {
      if (layer.instance !== undefined) continue;
      for (const prop of Object.keys(layer.style)) {
        const def = propertyDefinition(prop);
        if (def !== undefined && def.type.kind === "keyword") continue;
        if (["sizingH", "sizingV", "ownSizingH", "ownSizingV", "position", "constraintH", "constraintV", "left", "top", "right", "bottom", "width", "height", "clip"].includes(prop)) continue;
        if (layer.tokens[prop] === undefined) findings.push({ level: "avviso", where: `parte ${n.part}, cella ${key}`, message: `"${prop}" senza token: non arriverà nel codice` });
      }
    }
  });
  return { findings, template };
}

/** Token o parola chiave → classe Tailwind, con il registro. `parentDir` serve al dimensionamento "fill". */
/** Distanza/dimensione in px → passo della scala Tailwind (4px), o null se fuori scala. */
const step = (px: unknown): string | null => (typeof px === "number" && Number.isInteger(px * 2 / 4) ? String(px / 4) : null);

export function classesOf(layer: SnapshotLayer, catalog: TokenCatalog, parentDir?: string, isRoot = false): string[] {
  const out: string[] = [];
  const st = layer.style;
  // Spike 2026-10-11: ritaglio, dimensioni fisse (solo se né "fill" né "auto"), posizione degli assoluti.
  if (st["clip"] === true) out.push("overflow-hidden");
  // Figli in posizione assoluta: il genitore fa da riferimento.
  if (layer.children.some((k) => k.style["position"] === "absolute")) out.push("relative");
  if (!isRoot) {
    // Tutti i figli in "fill" su un asse: Penpot impone "fix" al genitore, ma la misura la decide il contenuto.
    const kids = layer.children;
    const fillW = kids.length > 0 && kids.every((k) => k.style["sizingH"] === "fill");
    const fillH = kids.length > 0 && kids.every((k) => k.style["sizingV"] === "fill");
    const fixW = !fillW && st["sizingH"] !== "fill" && st["sizingH"] !== "auto" && st["ownSizingH"] !== "auto" ? step(st["width"]) : null;
    const fixH = !fillH && st["sizingV"] !== "fill" && st["sizingV"] !== "auto" && st["ownSizingV"] !== "auto" ? step(st["height"]) : null;
    if (fixW !== null && fixW === fixH) out.push(`size-${fixW}`);
    else {
      if (fixW !== null) out.push(`w-${fixW}`);
      if (fixH !== null) out.push(`h-${fixH}`);
    }
  }
  if (st["position"] === "absolute") {
    const at = (side: string, px: unknown): string => (step(px) !== null ? `${side}-${step(px)}` : `${side}-[${String(px)}px]`);
    const h = st["constraintH"];
    out.push(h === "right" ? at("right", st["right"]) : h === "center" ? "left-1/2 -translate-x-1/2" : at("left", st["left"]));
    const v = st["constraintV"];
    out.push(v === "bottom" ? at("bottom", st["bottom"]) : v === "center" ? "top-1/2 -translate-y-1/2" : at("top", st["top"]));
  }
  // Spike: "fill" nel genitore → si allarga (colonna) o cresce (riga).
  if (parentDir === "column" && layer.style["sizingH"] === "fill") out.push("self-stretch");
  if (parentDir === "row" && layer.style["sizingH"] === "fill") out.push("flex-1");
  if (layer.style["position"] === "absolute") out.push("absolute");
  // (le classi con spazi, es. "left-1/2 -translate-x-1/2", si spezzano qui sotto)
  // Spike 2026-10-11: "fill" in verticale → cresce (colonna) o si allunga (riga).
  if (parentDir === "column" && layer.style["sizingV"] === "fill") out.push("flex-1");
  if (parentDir === "row" && layer.style["sizingV"] === "fill") out.push("self-stretch");
  const typeOf = (token: string): TokenType | undefined => {
    for (const set of catalog.sets) for (const t of set.tokens) if (t.name === token) return t.type as TokenType;
    return undefined;
  };
  for (const [prop, token] of Object.entries(layer.tokens)) {
    const def = propertyDefinition(prop);
    if (def === undefined || def.type.kind !== "token") continue;
    const rule = def.emitter;
    const type = typeOf(token);
    if (type === undefined) continue;
    if (rule.emit === "utility") {
      let prefix = rule.prefix;
      // Spike 2026-10-11: il prefisso per tipo di layer vale per tutti i tipi (es. tratto di un'icona → stroke-*).
      if (rule.byLayerKind?.[layer.kind] !== undefined) prefix = rule.byLayerKind[layer.kind]!;
      out.push(`${prefix}-${varSuffix(token, type)}`);
    } else if (rule.emit === "radiusCorner") out.push(`${rule.corner}-${varSuffix(token, type)}`);
    // Spike: lo spessore del bordo nel registro è "coveredByBase" (residuo v1): qui diventa una classe.
    else if (prop === "strokeWidth") out.push(`border-(length:--border-width-${varSuffix(token, type)})`);
  }
  for (const [prop, value] of Object.entries(layer.style)) {
    const def = propertyDefinition(prop);
    if (def === undefined || def.type.kind !== "keyword" || def.emitter.emit !== "keywordClass" || typeof value !== "string") continue;
    if (value === def.type.default) continue;
    const cls = (def.emitter.classes as Record<string, string>)[value];
    if (cls) out.push(...cls.split(" ").filter(Boolean));
  }
  // Quattro angoli uguali → rounded-<sfx>.
  out.splice(0, out.length, ...out.flatMap((c) => c.split(" ")));
  const corners = ["rounded-tl-", "rounded-tr-", "rounded-br-", "rounded-bl-"].map((p) => out.find((c) => c.startsWith(p)));
  if (corners.every(Boolean) && new Set(corners.map((c) => c!.split("-").slice(2).join("-"))).size === 1) {
    const sfx = corners[0]!.split("-").slice(2).join("-");
    return [...new Set([...out.filter((c) => !corners.includes(c)), `rounded-${sfx}`])].sort();
  }
  return [...new Set(out)].sort();
}

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

/** [GC] Genera componente e story. Deterministico: stesso input, stesso output. */
export function generate(args: {
  binding: Binding;
  template: TemplateNode;
  catalog: TokenCatalog;
  contracts: Readonly<Record<string, ComponentContract>>;
  domains: Readonly<Record<string, string>>;
}): GeneratedFile[] {
  const { binding, template, catalog, contracts, domains } = args;
  const contract = binding.contract;
  const comp = pascal(contract.name);
  const allKeys = allCellKeys(contract);
  const optional = (field: string): boolean => contract.fields[field]!.schema.safeParse(undefined).success;
  const imports = new Map<string, Set<string>>();
  const tables: string[] = [];
  const behaviorParts = new Set(binding.behavior ?? []);
  /** Elemento HTML di ogni parte (per tipizzare le props del comportamento). */
  const elementOf = new Map<string, string>();

  const classExpr = (node: TemplateNode, extra: string[] = [], parent: TemplateNode | null = null): string => {
    const perCell = new Map<string, string[]>();
    for (const [key, layer] of node.byCell) {
      const dir = parent?.byCell.get(key)?.style["layoutDir"];
      perCell.set(key, classesOf(layer, catalog, typeof dir === "string" ? dir : undefined));
    }
    const lists = [...perCell.values()];
    const base = lists.length === 0 ? [] : lists[0]!.filter((c) => lists.every((l) => l.includes(c)));
    const baseAll = [...new Set([...base, ...extra])].sort().join(" ");
    const diffs = new Map([...perCell].map(([k, l]) => [k, l.filter((c) => !base.includes(c)).join(" ")] as const));
    if ([...diffs.values()].every((d) => d === "")) return `"${baseAll}"`;
    const table = `${node.part}Classes`;
    tables.push(`const ${table}: Record<string, string> = {\n${[...diffs].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, d]) => `  "${k}": "${d}",`).join("\n")}\n};`);
    return `cn("${baseAll}", ${table}[key])`;
  };

  const whenExpr = (when: BindingPart["when"]): string | null =>
    when === undefined ? null : Object.entries(when).map(([axis, values]) => (values.length === 1 ? `${axis} === "${values[0]}"` : `[${values.map((v) => `"${v}"`).join(", ")}].includes(${axis})`)).join(" && ");

  const jsx = (node: TemplateNode, indent: string, parent: TemplateNode | null = null): string => {
    const def = binding.parts[node.part] ?? {};
    elementOf.set(node.part, def.component !== undefined ? `component:${pascal(def.component)}` : (def.element ?? (node.kind === "text" ? "span" : "div")));
    const slot = node.part === "root" ? contract.name : `${contract.name}-${kebab(node.part)}`;
    let body: string;
    if (def.component !== undefined) {
      const target = pascal(def.component);
      const from = domains[def.component] === binding.domain ? `./${target}` : `../${domains[def.component]}`;
      imports.set(from, (imports.get(from) ?? new Set()).add(target));
      const inner = contracts[def.component]!;
      const propsAttrs = inner.axes.map((axis) => {
        const values = new Map([...node.byCell].map(([k, l]) => [k, l.instance?.props[axis.name]] as const));
        const distinct = new Set(values.values());
        if (distinct.size === 1) return `${axis.name}="${[...distinct][0]}"`;
        const table = `${node.part}${pascal(axis.name)}`;
        tables.push(`const ${table}: Record<string, "${inner.axes.find((a) => a.name === axis.name)!.values.join('" | "')}"> = {\n${[...values].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  "${k}": "${v}",`).join("\n")}\n};`);
        return `${axis.name}={${table}[key]}`;
      });
      const fieldAttrs = Object.entries(def.fields ?? {}).map(([inner2, outer]) => `${inner2}={${outer}${optional(outer) ? ' ?? ""' : ""}}`);
      const behaviorAttrs = behaviorParts.has(node.part) ? [`{...behavior.${node.part}}`] : [];
      body = `${indent}<${target} ${[...propsAttrs, ...fieldAttrs, ...behaviorAttrs].join(" ")} />`;
    } else {
      const element = def.element ?? (node.kind === "text" ? "span" : "div");
      const attrs = [`data-slot="${slot}"`];
      if (node.part === "root") attrs.push("{...props}");
      for (const [attr, field] of Object.entries(def.attribute ?? {})) attrs.push(`${attr}={${field}}`);
      for (const [attr, value] of Object.entries(def.aria ?? {})) attrs.push(`${attr}="${value}"`);
      if (behaviorParts.has(node.part)) attrs.push(`{...behavior.${node.part}}`);
      const focus = node.part === "root" && binding.a11y.focusVisible ? ["focus-visible:outline-2", "focus-visible:outline-offset-2"] : [];
      const imgExtra = element === "img" ? ["w-full", "object-cover"] : [];
      const cls = classExpr(node, [...focus, ...imgExtra], parent);
      attrs.push(node.part === "root" ? `className={cn(${cls.startsWith("cn(") ? cls.slice(3, -1) : cls}, className)}` : `className={${cls.startsWith('"') ? cls : cls}}`);
      if (element === "img") body = `${indent}<img ${attrs.join(" ")} />`;
      else if (def.content !== undefined) body = `${indent}<${element} ${attrs.join(" ")}>{${def.content}}</${element}>`;
      else if (node.children.length === 0) body = `${indent}<${element} ${attrs.join(" ")} />`;
      else body = `${indent}<${element} ${attrs.join(" ")}>\n${node.children.map((c) => jsx(c, indent + "  ", node)).join("\n")}\n${indent}</${element}>`;
      // className letterale: niente graffe attorno alla stringa.
      body = body.replace(/className=\{"([^"]*)"\}/g, 'className="$1"');
    }
    const cond = whenExpr(def.when);
    const imgOptional = def.element === "img" && def.attribute?.src !== undefined && optional(def.attribute.src) ? def.attribute.src : null;
    const guard = [cond, imgOptional].filter(Boolean).join(" && ");
    if (guard) return `${indent}{${guard} && (\n${body.replace(/^/gm, "  ")}\n${indent})}`;
    return body;
  };

  const rootElement = binding.parts["root"]?.element ?? "div";
  const rootJsx = jsx(template, "    ");
  const fieldNames = Object.keys(contract.fields);
  const propsType = [
    `export type ${comp}Props = Omit<React.ComponentProps<"${rootElement}">, ${[...fieldNames, ...contract.axes.map((a) => a.name)].map((n) => `"${n}"`).join(" | ")}> & {`,
    ...contract.axes.map((a) => `  ${a.name}?: ${a.values.map((v) => `"${v}"`).join(" | ")};`),
    ...fieldNames.map((f) => `  ${f}?: string;`),
    `};`,
  ].join("\n");
  const defaults = [
    ...contract.axes.map((a) => `${a.name} = "${a.default}"`),
    ...fieldNames.map((f) => (optional(f) ? f : `${f} = ""`)),
  ];
  const usesKey = tables.length > 0;
  const hasBehavior = behaviorParts.size > 0;
  const behaviorTypes = hasBehavior
    ? [
        `/** Stato passato al comportamento scritto a mano (${comp}.behavior.ts). */`,
        `export type ${comp}State = { ${[...contract.axes.map((a) => `${a.name}: ${a.values.map((v) => `"${v}"`).join(" | ")}`), ...fieldNames.map((f) => `${f}${optional(f) ? "?" : ""}: string`)].join("; ")} };`,
        ``,
        `/** Props che il comportamento può aggiungere, per parte. */`,
        `export type ${comp}Behavior = {`,
        ...[...behaviorParts].sort().map((p) => {
          const el = elementOf.get(p) ?? "div";
          return `  ${p}?: ${el.startsWith("component:") ? `Partial<React.ComponentProps<typeof ${el.slice(10)}>>` : `React.ComponentProps<"${el}">`};`;
        }),
        `};`,
        ``,
      ]
    : [];
  if (hasBehavior) imports.set(`./${comp}.behavior`, new Set([`use${comp}Behavior`]));
  const importLines = [...imports].sort(([a], [b]) => (a < b ? -1 : 1)).map(([from, names]) => `import { ${[...names].sort().join(", ")} } from "${from}";`);
  const component = [
    `// @generated — DO NOT EDIT BY HAND. (spike v3: contratto + collegamento + Penpot)`,
    `// Regenerate with: node --import tsx src/v3/cli.ts generate ${comp}`,
    ``,
    `import { cn } from "@penpot-ds/ui/lib/utils";`,
    `import * as React from "react";`,
    ``,
    ...importLines,
    ...(importLines.length > 0 ? [""] : []),
    propsType,
    ``,
    ...behaviorTypes,
    ...tables.flatMap((t) => [t, ""]),
    `function ${comp}({ className, ${defaults.join(", ")}, ...props }: ${comp}Props) {`,
    ...(hasBehavior ? [`  const behavior = use${comp}Behavior({ ${[...contract.axes.map((a) => a.name), ...fieldNames].join(", ")} });`] : []),
    ...(usesKey ? [`  const key = ${"`"}${contract.axes.map((a) => `${a.name}=\${${a.name}}`).join("|")}${"`"};`] : []),
    `  return (`,
    rootJsx,
    `  );`,
    `}`,
    ``,
    `export { ${comp} };`,
    ``,
  ].join("\n");

  const sample = (f: string): string => {
    const s = contract.fields[f]!.schema;
    if (f === "image") return `"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='340'><rect width='100%' height='100%' fill='%23e5e5e5'/></svg>"`;
    if (s.safeParse("https://example.com").success && !s.safeParse("testo").success) return `"https://example.com"`;
    return JSON.stringify({ heading: "Nome prodotto", category: "Scarpe", description: "Descrizione breve del prodotto.", price: "€ 49,90", badgeLabel: "-20%", ctaLabel: "Vedi prodotto", href: "/prodotti/esempio", imageAlt: "Foto del prodotto" }[f] ?? f);
  };
  const stories = [
    `// @generated — DO NOT EDIT BY HAND. (spike v3)`,
    `import type { Meta, StoryObj } from "@storybook/react";`,
    ``,
    `import { ${comp} } from "./${comp}";`,
    ``,
    `const meta = { component: ${comp}, title: "${pascal(binding.domain)}/${comp}" } satisfies Meta<typeof ${comp}>;`,
    `export default meta;`,
    ``,
    `const content = { ${fieldNames.map((f) => `${f}: ${sample(f)}`).join(", ")} };`,
    ``,
    ...allKeys.map((key) => {
      const props = key.split("|").map((kv) => kv.split("=") as [string, string]);
      const name = props.map(([, v]) => pascal(v)).join("");
      return `export const ${name}: StoryObj<typeof ${comp}> = { args: { ...content, ${props.map(([a, v]) => `${a}: "${v}"`).join(", ")} } };`;
    }),
    ``,
  ].join("\n");
  return [
    { path: `${binding.domain}/${comp}.tsx`, content: component },
    { path: `${binding.domain}/${comp}.stories.tsx`, content: stories },
  ];
}
