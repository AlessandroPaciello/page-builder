/**
 * Spike 2026-10-11 — "stili generati, componente tuo".
 *
 * Il generatore possiede solo l'aspetto: `<Comp>.styles.ts` (@generated, una
 * `cva` per parte con tutti gli assi, più le varianti scelte in Penpot per i
 * componenti annidati). `<Comp>.tsx` è dello sviluppatore: GC lo crea una volta
 * (scaffold) e poi non lo tocca più. VC confronta le parti di Penpot con i
 * `data-slot` del file.
 */
import type { ComponentContract } from "@app/contracts";

import type { TokenCatalog } from "../shared/theme-generator";
import type { Binding, BindingPart } from "./binding";
import { camel, classesOf, kebab, pascal, walk, type Finding, type GeneratedFile, type TemplateNode } from "./generate";

const propsOfKey = (key: string): Record<string, string> => Object.fromEntries(key.split("|").map((kv) => kv.split("=") as [string, string]));
const slotOf = (contract: ComponentContract, part: string): string => (part === "root" ? contract.name : `${contract.name}-${kebab(part)}`);

/** Classi per cella → base + per valore d'asse + combinazioni (quando nessun asse da solo spiega la classe). */
function decompose(contract: ComponentContract, perCell: Map<string, string[]>) {
  const lists = [...perCell.values()];
  const base = lists.length === 0 ? [] : lists[0]!.filter((c) => lists.every((l) => l.includes(c)));
  const rest = [...new Set(lists.flat())].filter((c) => !base.includes(c)).sort();
  const variants: Record<string, Record<string, string[]>> = Object.fromEntries(contract.axes.map((a) => [a.name, Object.fromEntries(a.values.map((v) => [v, [] as string[]]))]));
  const compound = new Map<string, string[]>();
  for (const c of rest) {
    const has = (key: string): boolean => perCell.get(key)!.includes(c);
    const axis = contract.axes.find((a) =>
      a.values.every((v) => new Set([...perCell.keys()].filter((k) => propsOfKey(k)[a.name] === v).map(has)).size <= 1),
    );
    if (axis !== undefined) {
      for (const v of axis.values) if ([...perCell.keys()].some((k) => propsOfKey(k)[axis.name] === v && has(k))) variants[axis.name]![v]!.push(c);
    } else for (const k of perCell.keys()) if (has(k)) compound.set(k, [...(compound.get(k) ?? []), c]);
  }
  return { base, variants, compound };
}

/** [GC] `<Comp>.styles.ts`: sempre rigenerato. */
export function generateStyles(args: { binding: Binding; template: TemplateNode; catalog: TokenCatalog; contracts: Readonly<Record<string, ComponentContract>> }): GeneratedFile {
  const { binding, template, catalog, contracts } = args;
  const contract = binding.contract;
  const comp = pascal(contract.name);
  const id = camel(contract.name);
  const styles: string[] = [];
  const instances: string[] = [];
  walk(template, (node, parent) => {
    const def: BindingPart = binding.parts[node.part] ?? {};
    if (def.component !== undefined) {
      const inner = contracts[def.component]!;
      const perCell = new Map([...node.byCell].map(([k, l]) => [k, JSON.stringify(Object.fromEntries(inner.axes.map((a) => [a.name, l.instance?.props[a.name]])))] as const));
      const distinct = new Set(perCell.values());
      if (distinct.size === 1) instances.push(`  ${node.part}: (_axes: ${comp}Axes) => (${[...distinct][0]}) as const,`);
      else instances.push(`  ${node.part}: (axes: ${comp}Axes) => (({\n${[...perCell].sort().map(([k, v]) => `    "${k}": ${v},`).join("\n")}\n  }) as const)[${"`"}${contract.axes.map((a) => `${a.name}=\${axes.${a.name}}`).join("|")}${"`"}]!,`);
      return;
    }
    const perCell = new Map<string, string[]>();
    for (const [key, layer] of node.byCell) {
      const dir = parent?.byCell.get(key)?.style["layoutDir"];
      perCell.set(key, classesOf(layer, catalog, typeof dir === "string" ? dir : undefined));
    }
    const { base, variants, compound } = decompose(contract, perCell);
    const v = contract.axes.map((a) => `      ${a.name}: { ${a.values.map((val) => `${/^[a-z]\w*$/.test(val) ? val : `"${val}"`}: "${variants[a.name]![val]!.join(" ")}"`).join(", ")} },`).join("\n");
    const cv = [...compound].sort().map(([k, cls]) => `      { ${Object.entries(propsOfKey(k)).map(([a, val]) => `${a}: "${val}"`).join(", ")}, class: "${cls.join(" ")}" },`);
    styles.push(`  ${node.part}: cva("${base.join(" ")}", {\n    variants: {\n${v}\n    },${cv.length > 0 ? `\n    compoundVariants: [\n${cv.join("\n")}\n    ],` : ""}\n  }),`);
  });
  const content = [
    `// @generated — DO NOT EDIT BY HAND. Aspetto di ${comp} letto da Penpot (container ${contract.name}@${contract.version}).`,
    `// Regenerate with: node --import tsx src/v3/cli.ts styles ${comp}`,
    ``,
    `import { cva } from "class-variance-authority";`,
    ``,
    `/** Assi del componente: ogni parte li accetta tutti, così un cambio in Penpot non cambia le chiamate. */`,
    `export type ${comp}Axes = { ${contract.axes.map((a) => `${a.name}: ${a.values.map((x) => `"${x}"`).join(" | ")}`).join("; ")} };`,
    ``,
    `/** Classi per parte (token Penpot → Tailwind). */`,
    `export const ${id}Styles = {`,
    ...styles,
    `};`,
    ...(instances.length > 0 ? [``, `/** Varianti scelte in Penpot per i componenti annidati. */`, `export const ${id}Instances = {`, ...instances, `};`] : []),
    ``,
  ].join("\n");
  return { path: `${binding.domain}/${comp}.styles.ts`, content };
}

/** [GC] `<Comp>.tsx`: scritto solo se non esiste. Da lì il file è dello sviluppatore. */
export function scaffold(args: { binding: Binding; template: TemplateNode; contracts: Readonly<Record<string, ComponentContract>>; domains: Readonly<Record<string, string>> }): GeneratedFile {
  const { binding, template, domains } = args;
  const contract = binding.contract;
  const comp = pascal(contract.name);
  const id = camel(contract.name);
  const optional = (field: string): boolean => contract.fields[field]!.schema.safeParse(undefined).success;
  const imports = new Map<string, Set<string>>();
  const jsx = (node: TemplateNode, indent: string): string => {
    const def: BindingPart = binding.parts[node.part] ?? {};
    let body: string;
    if (def.component !== undefined) {
      const target = pascal(def.component);
      const from = domains[def.component] === binding.domain ? `./${target}` : `../${domains[def.component]}`;
      imports.set(from, (imports.get(from) ?? new Set()).add(target));
      const fieldAttrs = Object.entries(def.fields ?? {}).map(([inner, outer]) => `${inner}={${outer}${optional(outer) ? ' ?? ""' : ""}}`);
      body = `${indent}<${target} {...${id}Instances.${node.part}(axes)} ${fieldAttrs.join(" ")} />`;
    } else {
      const element = def.element ?? (node.kind === "text" ? "span" : "div");
      const attrs = [`data-slot="${slotOf(contract, node.part)}"`];
      if (node.part === "root") attrs.push("{...props}");
      for (const [attr, field] of Object.entries(def.attribute ?? {})) attrs.push(`${attr}={${field}}`);
      const extra = node.part === "root" ? [`"focus-visible:outline-2 focus-visible:outline-offset-2"`, "className"] : element === "img" ? [`"w-full object-cover"`] : [];
      attrs.push(extra.length > 0 ? `className={cn(s.${node.part}(axes), ${extra.join(", ")})}` : `className={s.${node.part}(axes)}`);
      if (element === "img") body = `${indent}<img ${attrs.join(" ")} />`;
      else if (def.content !== undefined) body = `${indent}<${element} ${attrs.join(" ")}>{${def.content}}</${element}>`;
      else if (node.children.length === 0) body = `${indent}<${element} ${attrs.join(" ")} />`;
      else body = `${indent}<${element} ${attrs.join(" ")}>\n${node.children.map((c) => jsx(c, indent + "  ")).join("\n")}\n${indent}</${element}>`;
    }
    const when = def.when === undefined ? null : Object.entries(def.when).map(([a, vs]) => (vs.length === 1 ? `${a} === "${vs[0]}"` : `[${vs.map((x) => `"${x}"`).join(", ")}].includes(${a})`)).join(" && ");
    const img = def.element === "img" && def.attribute?.src !== undefined && optional(def.attribute.src) ? def.attribute.src : null;
    const guard = [when, img].filter(Boolean).join(" && ");
    return guard ? `${indent}{${guard} && (\n${body.replace(/^/gm, "  ")}\n${indent})}` : body;
  };
  const rootElement = binding.parts["root"]?.element ?? "div";
  const fieldNames = Object.keys(contract.fields);
  const body = jsx(template, "    ");
  const importLines = [...imports].sort(([a], [b]) => (a < b ? -1 : 1)).map(([from, names]) => `import { ${[...names].sort().join(", ")} } from "${from}";`);
  const content = [
    `// ${comp} — creato da GC (scaffold) il ${new Date().toISOString().slice(0, 10)}. Da qui il file è tuo: GC non lo riscrive.`,
    `// L'aspetto sta in ${comp}.styles.ts (@generated da Penpot). VC controlla che ogni parte di Penpot abbia il suo data-slot.`,
    ``,
    `import { cn } from "@penpot-ds/ui/lib/utils";`,
    `import * as React from "react";`,
    ``,
    ...importLines,
    `import { ${id}Instances, ${id}Styles as s } from "./${comp}.styles";`,
    ``,
    `export type ${comp}Props = Omit<React.ComponentProps<"${rootElement}">, ${[...fieldNames, ...contract.axes.map((a) => a.name)].map((n) => `"${n}"`).join(" | ")}> & {`,
    ...contract.axes.map((a) => `  ${a.name}?: ${a.values.map((v) => `"${v}"`).join(" | ")};`),
    ...fieldNames.map((f) => `  ${f}?: string;`),
    `};`,
    ``,
    `function ${comp}({ className, ${[...contract.axes.map((a) => `${a.name} = "${a.default}"`), ...fieldNames.map((f) => (optional(f) ? f : `${f} = ""`))].join(", ")}, ...props }: ${comp}Props) {`,
    `  const axes = { ${contract.axes.map((a) => a.name).join(", ")} };`,
    `  return (`,
    body,
    `  );`,
    `}`,
    ``,
    `export { ${comp} };`,
    ``,
  ].join("\n");
  return { path: `${binding.domain}/${comp}.tsx`, content };
}

/** [VC] Parti di Penpot ↔ `data-slot` nel file dello sviluppatore. */
export function checkSlots(binding: Binding, template: TemplateNode, source: string): Finding[] {
  const contract = binding.contract;
  const id = camel(contract.name);
  const inCode = new Set([...source.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1]!));
  const expected = new Set<string>();
  const findings: Finding[] = [];
  walk(template, (n) => {
    const def = binding.parts[n.part] ?? {};
    if (def.component !== undefined) {
      if (!source.includes(`${id}Instances.${n.part}`)) findings.push({ level: "blocco", where: `parte ${n.part}`, message: `istanza di ${def.component} in Penpot, assente nel codice: [AC] propone il diff` });
      return;
    }
    const slot = slotOf(contract, n.part);
    expected.add(slot);
    if (!inCode.has(slot)) findings.push({ level: "blocco", where: `parte ${n.part}`, message: `in Penpot c'è, nel codice manca data-slot="${slot}": [AC] propone il diff` });
  });
  for (const slot of inCode) {
    if (slot.startsWith(contract.name) && !expected.has(slot)) findings.push({ level: "avviso", where: slot, message: "nel codice ma non in Penpot (elemento solo del codice: va bene se voluto)" });
  }
  return findings;
}
