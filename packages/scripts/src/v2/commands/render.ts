import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { toKebab } from "../../shared/naming";
import { PATHS } from "../../shared/paths";
import { propertyDefinition, radiusCorners, type EmitRule } from "../../shared/style-properties";
import { varSuffix, type TokenCatalog } from "../../shared/theme-generator";
import { ScriptError } from "../errors";
import { cellKey, expectedAxes } from "../library-plan";
import { knownExtractionNames, resolveExtraction } from "../registry";
import { parseArgs, type Command } from "../shell";
import { committedSnapshots, loadComponentSnapshot, type ComponentSnapshot } from "../components";
import type { ExtractionContract } from "../extraction";

/**
 * `render <Comp>|--all [--check]` (Story 2.14, CAP-5): da istantanea
 * committata + contratto di estrazione + registro genera i quattro file
 * `@generated` in `packages/ui/src/domains/<domain>/` (`<Comp>.tsx`,
 * `.test.tsx`, `.stories.tsx`, barrel), senza basi shadcn e senza `cva`.
 *
 * Mappatura fissa: `when` → condizionale, `repeat` → `map` sul primo layer
 * come modello, `attribute` → attributo, assi `state` → prefissi, headless →
 * elemento (`null` per la card), layout/posizione dal registro, `content` →
 * testo, `focusVisible` → classi con prefisso di stato tastiera. Token e
 * parole chiave diventano classi solo tramite il registro e il suffisso
 * condiviso con lo Stadio 1: nessun valore inventato, nessuna cella riempita
 * in silenzio.
 *
 * Mai scritture su Penpot, contratti o istantanee; mai in CI né in build
 * (in CI gira solo `--check` via `gates`). Un file senza marker non è mai
 * sovrascritto (skip, non errore); `--all` accumula i fallimenti e li elenca.
 */

export const RENDER_USAGE = "render <Comp>|--all [--check]";

/** Marker dei file generati: solo la prima riga conta (come l'emitter v1, mai importato). */
export const GENERATED_MARKER_V2 = "@generated";

export interface RenderedFileV2 {
  /** Percorso relativo a `domainsRoot` (es. `commerce/ProductCard.tsx`). */
  path: string;
  content: string;
  action: "write" | "skip";
}

export interface RenderDeps {
  /** Seam per i test: cartella istantanee invece di `data/components/`. */
  readonly componentsDir?: string;
  /** Seam per i test: radice domini invece di `packages/ui/src/domains/`. */
  readonly domainsDir?: string;
  /** Seam per i test: catalogo iniettato. */
  readonly catalog?: TokenCatalog;
  readonly catalogPath?: string;
  readonly log?: (text: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Prima riga con il marker? */
export function isGeneratedFileV2(content: string): boolean {
  return content.split("\n", 1)[0]?.includes(GENERATED_MARKER_V2) === true;
}

/** Confronto in memoria per `--check` (skip esclusi, mai un errore). */
export function renderCheckV2(
  expected: readonly RenderedFileV2[],
  existing: Record<string, string>,
): { equal: boolean; divergences: Array<{ path: string; reason: "missing" | "divergente" }> } {
  const divergences: Array<{ path: string; reason: "missing" | "divergente" }> = [];
  for (const file of expected) {
    if (file.action === "skip") continue;
    const current = existing[file.path];
    if (current === undefined) divergences.push({ path: file.path, reason: "missing" });
    else if (current !== file.content) divergences.push({ path: file.path, reason: "divergente" });
  }
  return { equal: divergences.length === 0, divergences };
}

function assertCatalogShape(value: unknown, label: string): asserts value is TokenCatalog {
  if (value === null || typeof value !== "object" || !Array.isArray((value as { sets?: unknown }).sets)) {
    throw new ScriptError({ kind: "input", detail: `catalogo token malformato (${label}): atteso oggetto con array "sets".` });
  }
}

function loadCatalog(deps: RenderDeps): TokenCatalog {
  if (deps.catalog !== undefined) {
    assertCatalogShape(deps.catalog, "<injected>");
    return deps.catalog;
  }
  const path = deps.catalogPath ?? PATHS.catalogPath;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new ScriptError({ kind: "input", detail: `catalogo token non leggibile (${path}): ${messageOf(error)}` });
  }
  assertCatalogShape(parsed, path);
  return parsed;
}

function tokenTypeOf(catalog: TokenCatalog, tokenName: string): string | undefined {
  for (const set of catalog.sets) for (const token of set.tokens) if (token.name === tokenName) return token.type;
  return undefined;
}

/** Segmento spezzato come l'emitter v1: il gate di confine vieta il literal intero in `src/`. */
const UI_PKG = "@penpot-ds";
const CN_IMPORT_V2 = `import { cn } from "${UI_PKG}/ui/lib/utils";`;

function regenCommandForV2(componentName: string): string {
  return `pnpm --filter @penpot-ds/scripts render -- ${componentName}`;
}

function provenanceHeaderV2(snapshot: ComponentSnapshot, componentName: string): string {
  return [
    `// ${GENERATED_MARKER_V2} — DO NOT EDIT BY HAND.`,
    `// Source: pipeline due contratti → istantanea → render (contract ${snapshot.contract}, penpotComponentId ${snapshot.provenance.penpotComponentId}, snapshotHash ${snapshot.provenance.snapshotHash}).`,
    `// Regenerate with: ${regenCommandForV2(componentName)}`,
  ].join("\n");
}

const RADIUS_CORNERS_V2 = radiusCorners();

function collapseRadiusV2(classes: string[]): string[] {
  const corners = classes.filter((cls) => RADIUS_CORNERS_V2.some((corner) => cls.startsWith(corner)));
  if (corners.length !== RADIUS_CORNERS_V2.length) return classes;
  const suffixes = new Set(corners.map((cls) => cls.slice(cls.lastIndexOf("-") + 1)));
  if (suffixes.size !== 1) return classes;
  const suffix = [...suffixes][0];
  if (suffix === undefined) return classes;
  return [...classes.filter((cls) => !corners.includes(cls)), `rounded-${suffix}`];
}

function dedupeV2(classes: readonly string[]): string[] {
  return [...new Set(classes.map((cls) => cls.trim()).filter((cls) => cls.length > 0))];
}

function failRender(detail: string, extraction: ExtractionContract, part?: string, cell?: string): never {
  throw new ScriptError({
    kind: "contract",
    component: extraction.penpot.container,
    ...(cell === undefined ? {} : { cell }),
    ...(part === undefined ? {} : { part }),
    detail,
  });
}

/**
 * Classe da una voce di istantanea (token o parola chiave) tramite il solo
 * registro e il suffisso dello Stadio 1. `null` = nessuna classe per regola
 * dichiarata (default di parola chiave, coperto dalla base assente in v2).
 */
function classForSnapshotEntry(
  extraction: ExtractionContract,
  catalog: TokenCatalog,
  part: string,
  prop: string,
  value: string,
): string | null {
  const def = propertyDefinition(prop);
  if (def === undefined) {
    failRender(`proprietà "${prop}" (parte "${part}") non registrata: il registro non la conosce.`, extraction, part);
  }
  const definition = def!;
  if (definition.type.kind === "keyword") {
    const rule: EmitRule = definition.emitter;
    if (rule.emit !== "keywordClass") {
      failRender(`proprietà "${prop}" (parte "${part}") a parola chiave senza mappatura nel registro.`, extraction, part);
    }
    const mapped = (rule.classes as Record<string, string>)[value];
    if (mapped === undefined) {
      failRender(
        `valore "${value}" fuori lista per "${prop}" (parte "${part}"): ammessi [${definition.type.values.join(", ")}].`,
        extraction,
        part,
      );
    }
    const out = (mapped as string).trim();
    return out.length === 0 ? null : out;
  }
  // Token.
  const expectedType = definition.type.tokenType;
  const actualType = tokenTypeOf(catalog, value);
  if (actualType === undefined) {
    failRender(`token "${value}" (parte "${part}", proprietà "${prop}") non esiste nel catalogo Stadio 1.`, extraction, part);
  }
  if (actualType !== expectedType) {
    failRender(
      `proprietà "${prop}" (parte "${part}") legata al token "${value}" (type "${actualType}"), atteso type "${expectedType}".`,
      extraction,
      part,
    );
  }
  const rule: EmitRule = definition.emitter;
  if (rule.emit === "utility") {
    let prefix = rule.prefix;
    if (rule.byLayerKind !== undefined) {
      // Il ruolo decide il prefisso effettivo (stessa logica del ramo positivo v1):
      // testo → testo, icona → tratto, resto → default.
      const r = extraction.parts[part]!.role;
      if (r === "text" && (rule.byLayerKind as Record<string, string>)["text"] !== undefined) {
        prefix = (rule.byLayerKind as Record<string, string>)["text"]!;
      } else if (r === "icon") {
        const first = Object.values(rule.byLayerKind as Record<string, string>)[0];
        if (first !== undefined) prefix = first;
      }
    }
    return `${prefix}-${varSuffix(value, expectedType)}`;
  }
  if (rule.emit === "radiusCorner") {
    return `${rule.corner}-${varSuffix(value, expectedType)}`;
  }
  if (rule.emit === "coveredByBase") {
    // v2 senza basi: proprietà coperta non emessa (validata in extract, qui structural di default).
    return null;
  }
  failRender(`proprietà "${prop}" (parte "${part}") senza mappatura per il render v2.`, extraction, part);
}

interface PartClassesV2 {
  base: string[];
  hover: string[];
}

/** Classi base + `hover:` da tutte le celle (promo invariante, hover come prefisso). */
function classesForPart(
  extraction: ExtractionContract,
  catalog: TokenCatalog,
  snapshot: ComponentSnapshot,
  part: string,
): PartClassesV2 {
  const axes = expectedAxes(extraction);
  const promoAxis = extraction.contract.axes.find((a) => a.name === "promo");
  const hoverValues = (extraction.axes["hover"]?.values as readonly string[] | undefined) ?? ["off", "on"];
  const promoValues = (promoAxis?.values as readonly string[] | undefined) ?? [];
  // Celle dove la parte esiste.
  const presentKeys = Object.keys(snapshot.cells).filter((key) => snapshot.cells[key]![part] !== undefined);
  if (presentKeys.length === 0) return { base: [], hover: [] };
  // Invarianza su promo: tutti i valori a parità di hover devono coincidere, altrimenti blocco (mai infedele).
  const byHover = new Map<string, Set<string>>();
  for (const hover of hoverValues) {
    const set = new Set<string>();
    for (const promo of promoValues.length > 0 ? promoValues : [""]) {
      const key = promoValues.length > 0 ? cellKey({ promo, hover }, axes.map((a) => ({ name: a.name }))) : cellKey({ hover }, axes.map((a) => ({ name: a.name })));
      const cell = snapshot.cells[key];
      if (cell === undefined) continue;
      const entry = cell[part];
      if (entry === undefined) continue;
      set.add(JSON.stringify(Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : 1))));
    }
    // Se la parte non esiste per un hover (es. badge con promo=none non c'entra: qui promo copre), ignora.
    if (set.size > 0) byHover.set(hover, set);
  }
  // Controllo promo-invarianza: ogni hover ha un solo valore distinto.
  for (const [hover, set] of byHover) {
    if (set.size > 1) {
      failRender(
        `proprietà della parte "${part}" variano con l'asse option "promo" a parità di hover="${hover}" — interazione non esprimibile senza basi: allinea i token in Penpot o fattorizza nel contratto.`,
        extraction,
        part,
      );
    }
  }
  const offKey = [...(byHover.get(hoverValues[0]!) ?? new Set<string>())][0] as string | undefined;
  const onKey = hoverValues.length > 1 ? ([...(byHover.get(hoverValues[1]!) ?? new Set<string>())][0] as string | undefined) : undefined;
  const parseEntry = (flat: string | undefined): Record<string, string> => {
    if (flat === undefined) return {};
    return Object.fromEntries(JSON.parse(flat) as Array<[string, string]>);
  };
  const offEntry = parseEntry(offKey);
  const onEntry = parseEntry(onKey);
  const base: string[] = [];
  const hover: string[] = [];
  const props = new Set([...Object.keys(offEntry), ...Object.keys(onEntry)]);
  for (const prop of [...props].sort()) {
    const offValue = offEntry[prop];
    const onValue = onEntry[prop];
    if (offValue !== undefined && onValue !== undefined && offValue !== onValue) {
      const baseCls = classForSnapshotEntry(extraction, catalog, part, prop, offValue);
      const hoverCls = classForSnapshotEntry(extraction, catalog, part, prop, onValue);
      if (baseCls !== null) base.push(baseCls);
      if (hoverCls !== null) hover.push(`hover:${hoverCls}`);
    } else {
      const value = offValue ?? onValue;
      if (value === undefined) continue;
      const cls = classForSnapshotEntry(extraction, catalog, part, prop, value);
      if (cls !== null) base.push(cls);
    }
  }
  return { base: collapseRadiusV2(base).sort(), hover: [...hover].sort() };
}

function conditionForWhen(when: Record<string, readonly string[]> | undefined, optionProp: string): string | null {
  if (when === undefined) return null;
  const clauses: string[] = [];
  for (const [axis, values] of Object.entries(when)) {
    // Oggi solo `promo`; la forma resta generica (AND fra assi, OR fra valori).
    const prop = axis === "promo" ? optionProp : axis;
    clauses.push(`(${(values as readonly string[]).map((v) => `${prop} === "${v}"`).join(" || ")})`);
  }
  if (clauses.length === 0) return null;
  return clauses.join(" && ");
}

function childrenOf(extraction: ExtractionContract, parent: string): string[] {
  return Object.keys(extraction.parts).filter((name) => extraction.parts[name]!.parent === parent);
}

function renderPartJsxV2(
  extraction: ExtractionContract,
  classMap: Readonly<Record<string, string>>,
  node: string,
  indent: string,
  optionProp: string,
): string {
  const def = extraction.parts[node]!;
  const isRoot = node === "root";
  const className = classMap[node] ?? "";
  const slot = isRoot ? toKebab(extraction.penpot.container) : `${toKebab(extraction.penpot.container)}-${node}`;
  const attrs: string[] = [`data-slot="${slot}"`];
  // Attributi dal contratto (href/src verso i field).
  for (const [attr, field] of Object.entries(def.attribute ?? {})) {
    if (field === "$item") continue;
    attrs.push(`${attr}={${field}}`);
  }
  if (isRoot) attrs.push("{...props}");
  const classAttr = isRoot ? `className={cn("${className}", className)}` : `className="${className}"`;
  // Contenuto testuale.
  const contentField = def.content;
  const hasElementChildren = childrenOf(extraction, node).length > 0;
  const elementChildren = childrenOf(extraction, node);
  const inner: string[] = [];
  if (contentField !== undefined) {
    if (contentField === "$item") {
      inner.push(`${indent}  {item}`);
    } else {
      inner.push(`${indent}  {${contentField}}`);
    }
  }
  for (const child of elementChildren) {
    const childDef = extraction.parts[child]!;
    // `repeat` → `map` sul field array (primo layer come modello, validato in extract).
    if (childDef.repeat !== undefined) {
      const arrayField = childDef.repeat;
      // Il figlio ripetuto è un elemento con i suoi figli (es. tag > tagLabel).
      inner.push(
        `${indent}  {${arrayField}.map((item) => (`,
        `${indent}    <${childDef.element} key={item} data-slot="${toKebab(extraction.penpot.container)}-${child}" className="${classMap[child] ?? ""}">`,
        // Dentro il map, i figli del ripetuto (tagLabel) con {item}.
        ...renderRepeatChildren(extraction, classMap, child, `${indent}      `),
        `${indent}    </${childDef.element}>`,
        `${indent}  ))}`,
      );
      continue;
    }
    const when = conditionForWhen(childDef.when as Record<string, readonly string[]> | undefined, optionProp);
    const childJsx = renderPartJsxV2(extraction, classMap, child, when !== null ? `${indent}    ` : `${indent}  `, optionProp);
    if (when !== null) {
      inner.push(`${indent}  {${when} && (`);
      inner.push(childJsx);
      inner.push(`${indent}  )}`);
    } else {
      inner.push(childJsx);
    }
  }
  const open = `<${def.element} ${attrs.join(" ")} ${classAttr}${def.element === "img" ? ' alt=""' : ""}`;
  if (def.element === "img") {
    return `${indent}${open} />`;
  }
  if (inner.length === 0 && !hasElementChildren && contentField === undefined) {
    return `${indent}${open} />`;
  }
  if (inner.length === 0) {
    // Caso senza figli né contenuto (es. contenitore vuoto): mai self-closing con figli attesi.
    return `${indent}${open}></${def.element}>`;
  }
  return `${indent}${open}>\n${inner.join("\n")}\n${indent}</${def.element}>`;
}

function renderRepeatChildren(
  extraction: ExtractionContract,
  classMap: Readonly<Record<string, string>>,
  repeatPart: string,
  indent: string,
): string[] {
  const out: string[] = [];
  for (const child of childrenOf(extraction, repeatPart)) {
    const childDef = extraction.parts[child]!;
    const slot = `${toKebab(extraction.penpot.container)}-${child}`;
    const attrs = [`data-slot="${slot}"`];
    for (const [attr, field] of Object.entries(childDef.attribute ?? {})) {
      if (field === "$item") continue;
      attrs.push(`${attr}={${field}}`);
    }
    const classAttr = `className="${classMap[child] ?? ""}"`;
    if (childDef.content === "$item") {
      out.push(`${indent}<${childDef.element} ${attrs.join(" ")} ${classAttr}>{item}</${childDef.element}>`);
    } else if (childDef.content !== undefined) {
      out.push(`${indent}<${childDef.element} ${attrs.join(" ")} ${classAttr}>{${childDef.content}}</${childDef.element}>`);
    } else {
      out.push(`${indent}<${childDef.element} ${attrs.join(" ")} ${classAttr} />`);
    }
    // Nipoti del ripetuto (non attesi per la card): ricorsione semplice senza map annidate.
    for (const grand of childrenOf(extraction, child)) {
      const grandDef = extraction.parts[grand]!;
      out.push(`${indent}<${grandDef.element} data-slot="${toKebab(extraction.penpot.container)}-${grand}" className="${classMap[grand] ?? ""}" />`);
    }
  }
  return out;
}

/** I quattro file `@generated` da istantanea + estrazione + registro. */
export function renderComponentV2(
  snapshot: ComponentSnapshot,
  extraction: ExtractionContract,
  catalog: TokenCatalog,
  existingFiles: Record<string, string> = {},
): { domain: string; files: RenderedFileV2[] } {
  const component = extraction.penpot.container;
  const domain = extraction.render.domain;
  if (extraction.render.headless !== null) {
    failRender(`headless non null non supportato dal render v2 di questa story (solo card con headless null).`, extraction);
  }
  // Classi per parte (base + hover:), poi `relative` sul genitore di un assoluto.
  const classMap: Record<string, string> = {};
  for (const part of Object.keys(extraction.parts)) {
    const { base, hover } = classesForPart(extraction, catalog, snapshot, part);
    classMap[part] = dedupeV2([...base, ...hover]).join(" ");
  }
  // Posizione: il genitore di una parte assoluta diventa relativo (nota del registro).
  const needsRelative = new Set<string>();
  for (const part of Object.keys(extraction.parts)) {
    const cell = Object.values(snapshot.cells).find((c) => c[part]?.["positionAbsolute"] === "absolute");
    if (cell !== undefined) {
      const parent = extraction.parts[part]!.parent;
      if (parent !== undefined && parent !== "root") needsRelative.add(parent);
      else if (parent === "root") needsRelative.add("root");
    }
  }
  // Ricerca diretta: classe "absolute" già emessa per la parte.
  for (const part of Object.keys(extraction.parts)) {
    const current = classMap[part] ?? "";
    if (current.split(/\s+/).includes("absolute")) {
      const parent = extraction.parts[part]!.parent;
      if (parent !== undefined) needsRelative.add(parent);
    }
  }
  for (const parent of needsRelative) {
    const current = (classMap[parent] ?? "").split(/\s+/).filter((c) => c.length > 0);
    if (!current.includes("relative") && !current.includes("absolute")) current.push("relative");
    classMap[parent] = dedupeV2(current).join(" ");
  }
  // Focus visibile sul root (strutturale, senza token: visibile da tastiera).
  if (extraction.a11y.focusVisible) {
    const current = (classMap["root"] ?? "").split(/\s+/).filter((c) => c.length > 0);
    for (const cls of ["focus-visible:outline-2", "focus-visible:outline-offset-2"]) {
      if (!current.includes(cls)) current.push(cls);
    }
    classMap["root"] = dedupeV2(current).join(" ");
  }

  const optionAxes = extraction.contract.axes.filter((a) => a.type === "option");
  const optionProp = optionAxes[0]?.name ?? "promo";
  const optionValues = (optionAxes[0]?.values as readonly string[] | undefined) ?? [];
  const fields = extraction.contract.fields;

  const fieldProps = Object.keys(fields)
    .sort()
    .map((name) => {
      if (name === "tags") return `  ${name}?: string[];`;
      return `  ${name}?: string;`;
    });
  const propsType = `React.ComponentProps<"a"> & {\n${optionValues.length > 0 ? `  ${optionProp}?: ${optionValues.map((v) => `"${v}"`).join(" | ")};\n` : ""}${fieldProps.join("\n")}\n}`;
  const destructure = [
    "className",
    ...(optionValues.length > 0 ? [optionProp] : []),
    ...Object.keys(fields).sort(),
  ];
  const defaults = [
    ...(optionValues.length > 0 ? [`${optionProp} = "${optionAxes[0]!.default}"`] : []),
    ...Object.keys(fields)
      .sort()
      .map((name) => (name === "tags" ? `${name} = []` : `${name} = ""`)),
  ];

  const rootJsx = renderPartJsxV2(extraction, classMap, "root", "    ", optionProp);

  const componentFile = [
    provenanceHeaderV2(snapshot, component),
    "",
    CN_IMPORT_V2,
    `import * as React from "react";`,
    "",
    `export type ${component}Props = ${propsType}`,
    "",
    `function ${component}({ ${destructure.join(", ")}, ...props }: ${component}Props) {`,
    `  return (`,
    rootJsx,
    `  );`,
    `}`,
    "",
    `export { ${component} };`,
    "",
  ].join("\n");

  // Il destructuring con default va nella firma: ricostruisce la riga corretta.
  const withDefaults = componentFile.replace(
    `function ${component}({ ${destructure.join(", ")}, ...props }: ${component}Props) {`,
    `function ${component}({ className${defaults.length > 0 ? `, ${defaults.join(", ")}` : ""}, ...props }: ${component}Props) {`,
  );

  // Test: campi, when, repeat, axe. Deterministico, senza rete.
  const sampleArgs = sampleArgsFor(extraction);
  const sampleArgsNoTags = sampleArgsForNoTags(extraction);
  const testFile = [
    provenanceHeaderV2(snapshot, component),
    "",
    `import { render } from "@testing-library/react";`,
    `import { describe, expect, it } from "vitest";`,
    `import { axe } from "vitest-axe";`,
    `import { ${component} } from "./${component}";`,
    "",
    `describe("${component}", () => {`,
    `  it("renderizza i campi content", () => {`,
    `    const { getByText } = render(<${component} ${sampleArgs} />);`,
    `    expect(getByText("19,99 €")).toBeTruthy();`,
    `  });`,
    ...(optionValues.length > 0
      ? [
          `  it("nasconde le parti fuori when con ${optionProp}=${optionAxes[0]!.default}", () => {`,
          `    const { queryByText } = render(<${component} ${sampleArgs} ${optionProp}="${optionAxes[0]!.default}" />);`,
          `    expect(queryByText("Offerta")).toBeNull();`,
          `  });`,
          `  it("mostra le parti in when con ${optionProp}=${optionValues.find((v) => v !== optionAxes[0]!.default) ?? optionValues[0]}", () => {`,
          `    const { getByText } = render(<${component} ${sampleArgs} ${optionProp}="${optionValues.find((v) => v !== optionAxes[0]!.default) ?? optionValues[0]}" />);`,
          `    expect(getByText("Offerta")).toBeTruthy();`,
          `  });`,
        ]
      : []),
    `  it("ripete le parti repeat per ogni elemento", () => {`,
    `    const { getByText } = render(<${component} ${sampleArgsNoTags} tags={["A", "B"]} />);`,
    `    expect(getByText("A")).toBeTruthy();`,
    `    expect(getByText("B")).toBeTruthy();`,
    `  });`,
    `  it("porta i data-slot e il wiring href/src", () => {`,
    `    const { container } = render(<${component} ${sampleArgs} />);`,
    `    expect(container.querySelector('[data-slot="${toKebab(component)}"]')).not.toBeNull();`,
    `    expect(container.querySelector('[data-slot="${toKebab(component)}-price"]')).not.toBeNull();`,
    `    expect(container.querySelector('a[data-slot="${toKebab(component)}"][href="https://example.com/p"]')).not.toBeNull();`,
    `    expect(container.querySelector('img[data-slot="${toKebab(component)}-image"][src="https://example.com/p.jpg"]')).not.toBeNull();`,
    `  });`,
    `  it("non ha violazioni axe (default)", async () => {`,
    `    const { container } = render(<${component} ${sampleArgs} />);`,
    `    expect((await axe(container)).violations).toEqual([]);`,
    `  });`,
    `});`,
    "",
  ].join("\n");

  const domainTitle = domain.charAt(0).toUpperCase() + domain.slice(1);
  const storiesFile = [
    provenanceHeaderV2(snapshot, component),
    "",
    `import type { Meta, StoryObj } from "@storybook/react";`,
    `import { ${component} } from "./${component}";`,
    "",
    `const meta = { component: ${component}, title: "${domainTitle}/${component}" } satisfies Meta<typeof ${component}>;`,
    `export default meta;`,
    "",
    ...optionValues.map(
      (value) => `export const ${capitalize(value)}: StoryObj<typeof ${component}> = { args: { ${optionProp}: "${value}", ${sampleArgsForStory(extraction)} } };`,
    ),
    ...(optionValues.length === 0 ? [`export const Default: StoryObj<typeof ${component}> = { args: { ${sampleArgsForStory(extraction)} } };`] : []),
    `export const EmptyTags: StoryObj<typeof ${component}> = { args: { ${optionValues.length > 0 ? `${optionProp}: "${optionAxes[0]!.default}", ` : ""}${sampleArgsForStoryNoTags(extraction)}, tags: [] } };`,
    "",
  ].join("\n");

  const barrelFile = domainBarrelContent([{ component, snapshot }]);

  const expected: Array<{ path: string; content: string }> = [
    { path: `${domain}/${component}.tsx`, content: withDefaults },
    { path: `${domain}/${component}.test.tsx`, content: testFile },
    { path: `${domain}/${component}.stories.tsx`, content: storiesFile },
    { path: `${domain}/index.ts`, content: barrelFile },
  ];

  const files: RenderedFileV2[] = expected.map((file) => {
    const current = existingFiles[file.path];
    if (current !== undefined && !isGeneratedFileV2(current)) {
      return { ...file, action: "skip" as const };
    }
    return { ...file, action: "write" as const };
  });

  return { domain, files };
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

/**
 * Barrel per dominio: un solo `index.ts` per dominio con gli export di tutti
 * i componenti del dominio, ordinati. Con un solo componente equivale al
 * barrel del singolo render (stesso header e stesso comando di rigenerazione),
 * così `--check` resta verde in entrambi i modi.
 */
export function domainBarrelContent(entries: ReadonlyArray<{ component: string; snapshot: ComponentSnapshot }>): string {
  const sorted = [...entries].sort((a, b) => (a.component < b.component ? -1 : 1));
  const header =
    sorted.length === 1
      ? provenanceHeaderV2(sorted[0]!.snapshot, sorted[0]!.component)
      : [
          `// ${GENERATED_MARKER_V2} — DO NOT EDIT BY HAND.`,
          `// Source: pipeline due contratti → istantanea → render (components: ${sorted.map((e) => `${e.component} ${e.snapshot.contract}/${e.snapshot.provenance.snapshotHash}`).join(", ")}).`,
          `// Regenerate with: pnpm --filter @penpot-ds/scripts render -- --all`,
        ].join("\n");
  return [header, "", ...sorted.map((e) => `export { ${e.component}, type ${e.component}Props } from "./${e.component}";`), ""].join("\n");
}

function sampleArgsFor(extraction: ExtractionContract): string {
  const parts: string[] = [];
  for (const name of Object.keys(extraction.contract.fields).sort()) {
    if (name === "image") parts.push(`image="https://example.com/p.jpg"`);
    else if (name === "href") parts.push(`href="https://example.com/p"`);
    else if (name === "price") parts.push(`price="19,99 €"`);
    else if (name === "description") parts.push(`description="Descrizione prodotto"`);
    else if (name === "badgeLabel") parts.push(`badgeLabel="Offerta"`);
    else if (name === "tags") parts.push(`tags={["Novità", "Eco"]}`);
    else parts.push(`${name}="..."`);
  }
  return parts.join(" ");
}

function sampleArgsForStory(extraction: ExtractionContract): string {
  const parts: string[] = [];
  for (const name of Object.keys(extraction.contract.fields).sort()) {
    if (name === "image") parts.push(`image: "https://example.com/p.jpg"`);
    else if (name === "href") parts.push(`href: "https://example.com/p"`);
    else if (name === "price") parts.push(`price: "19,99 €"`);
    else if (name === "description") parts.push(`description: "Descrizione prodotto"`);
    else if (name === "badgeLabel") parts.push(`badgeLabel: "Offerta"`);
    else if (name === "tags") parts.push(`tags: ["Novità", "Eco"]`);
    else parts.push(`${name}: "..."`);
  }
  return parts.join(", ");
}

function sampleArgsForNoTags(extraction: ExtractionContract): string {
  return sampleArgsFor(extraction)
    .replace(`tags={["Novità", "Eco"]} `, "")
    .replace(` tags={["Novità", "Eco"]}`, "")
    .replace(`tags={["Novità", "Eco"]}`, "")
    .trim();
}

function sampleArgsForStoryNoTags(extraction: ExtractionContract): string {
  return sampleArgsForStory(extraction)
    .replace(`tags: ["Novità", "Eco"], `, "")
    .replace(`, tags: ["Novità", "Eco"]`, "")
    .replace(`tags: ["Novità", "Eco"]`, "")
    .trim();
}

function readExistingFiles(root: string): Record<string, string> {
  const existing: Record<string, string> = {};
  const visit = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      const rel = prefix.length > 0 ? `${prefix}/${entry}` : entry;
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (isDir) visit(full, rel);
      else {
        try {
          existing[rel] = readFileSync(full, "utf8");
        } catch {
          continue;
        }
      }
    }
  };
  visit(root, "");
  return existing;
}

export function renderCommandWith(deps: RenderDeps = {}): Command {
  const log = deps.log ?? console.log;
  return {
    name: "render",
    usage: RENDER_USAGE,
    async run(argv) {
      const parsed = parseArgs(argv, { usage: RENDER_USAGE, flags: ["--check", "--all", "--help"], positional: { min: 0, max: 1 } });
      if (parsed.flags.has("--help")) {
        log(`Uso: ${RENDER_USAGE}`);
        log(`  Genera i 4 file @generated da istantanea + estrazione + registro (senza basi, mai in CI né in build).`);
        log(`  --check confronta senza scrivere (diff zero); --all opera su tutte le istantanee committate, accumulando i fallimenti.`);
        log(`  Contratti v2 noti: ${knownExtractionNames().join(", ")}`);
        return 0;
      }
      const [comp] = parsed.positional;
      const all = parsed.flags.has("--all");
      const check = parsed.flags.has("--check");
      if (all && comp !== undefined) {
        throw new ScriptError({ kind: "input", detail: `--all e il nome componente "${comp}" sono alternativi — uso: ${RENDER_USAGE}` });
      }
      if (!all && comp === undefined) {
        throw new ScriptError({ kind: "input", detail: `argomento mancante (il componente o --all) — uso: ${RENDER_USAGE}` });
      }
      const componentsDir = deps.componentsDir ?? PATHS.componentsDir;
      const domainsDir = deps.domainsDir ?? PATHS.domainsRoot;
      const catalog = loadCatalog(deps);

      const targets: string[] = all ? committedSnapshots(componentsDir) : [resolveExtraction(comp!).penpot.container];
      if (all && targets.length === 0) {
        throw new ScriptError({
          kind: "input",
          detail: `nessuna istantanea committata in ${componentsDir} — lancia prima "extract <Comp>".`,
        });
      }
      // `--all` accumula: ogni componente gira comunque, l'elenco finale nomina tutti i falliti.
      const failed: Array<{ target: string; kind: string; detail: string }> = [];
      const diverged: string[] = [];
      const skipped: string[] = [];
      const barrels = new Map<string, Array<{ component: string; snapshot: ComponentSnapshot }>>();
      for (const target of targets) {
        try {
          const result = await runSingleRender(target, { componentsDir, domainsDir, catalog, check, log, omitBarrel: all });
          if (result.skipped.length > 0) skipped.push(...result.skipped.map((path) => `${target}: ${path}`));
          if (result.divergences.length > 0) diverged.push(target);
          // In --check i divergenti non fermano gli altri; senza --check gli scritti sono già su disco.
          if (all && result.barrel !== undefined) {
            const list = barrels.get(result.barrel.domain) ?? [];
            list.push({ component: result.barrel.component, snapshot: result.barrel.snapshot });
            barrels.set(result.barrel.domain, list);
          }
        } catch (error) {
          if (error instanceof ScriptError) {
            failed.push({ target, kind: error.kind, detail: error.message });
          } else {
            failed.push({ target, kind: "input", detail: messageOf(error) });
          }
        }
      }
      if (!all) {
        if (failed.length > 0) {
          const first = failed[0]!;
          const single = targets[0]!;
          // Singolo: rilancia nominativo con la categoria originale (il guscio decide l'exit).
          if (first.kind === "contract") throw new ScriptError({ kind: "contract", component: single, detail: `${first.target}: ${first.detail}` });
          if (first.kind === "input") throw new ScriptError({ kind: "input", component: single, detail: `${first.target}: ${first.detail}` });
          if (first.kind === "penpot") throw new ScriptError({ kind: "penpot", component: single, detail: `${first.target}: ${first.detail}` });
          throw new ScriptError({ kind: "gate", component: single, detail: `${first.target}: ${first.detail}` });
        }
        if (diverged.length > 0) {
          throw new ScriptError({
            kind: "gate",
            component: targets[0]!,
            detail: `rigenerazione di "${targets[0]}" NON a diff zero — rigenera con "render ${targets[0]}".`,
          });
        }
        return 0;
      }
      if (all) {
        const barrelOutcome = writeOrCheckDomainBarrels(domainsDir, barrels, check, log);
        skipped.push(...barrelOutcome.skipped);
        for (const component of barrelOutcome.divergedComponents) {
          if (!diverged.includes(component)) diverged.push(component);
        }
      }
      if (failed.length > 0 || diverged.length > 0) {
        const parts: string[] = [];
        if (failed.length > 0) parts.push(`${failed.length} di ${targets.length} componenti in errore: ${failed.map((f) => `${f.target}: ${f.kind}: ${f.detail}`).join(" | ")}`);
        if (diverged.length > 0) parts.push(`${diverged.length} di ${targets.length} componenti NON a diff zero: ${diverged.join(", ")}`);
        if (skipped.length > 0) log(`Skip protettivi (${skipped.length}, mai sovrascritti): ${skipped.join(" | ")}`);
        throw new ScriptError({ kind: "gate", detail: `Check fallito: ${parts.join(" — ")}.` });
      }
      if (all) {
        if (skipped.length > 0) log(`Skip protettivi (${skipped.length}, mai sovrascritti): ${skipped.join(" | ")}`);
        log(`${check ? "Verificati" : "Resi"} ${targets.length} componenti: ${targets.join(", ")}.`);
      }
      return 0;
    },
  };
}

async function runSingleRender(
  componentName: string,
  args: {
    componentsDir: string;
    domainsDir: string;
    catalog: TokenCatalog;
    check: boolean;
    log: (text: string) => void;
    /** In `--all` il barrel è accumulato per dominio e scritto a parte: qui si esclude. */
    omitBarrel?: boolean;
  },
): Promise<{
  skipped: string[];
  divergences: Array<{ path: string; reason: "missing" | "divergente" }>;
  barrel?: { domain: string; component: string; snapshot: ComponentSnapshot };
}> {
  const extraction = resolveExtraction(componentName);
  const snapshot = loadComponentSnapshot(extraction.penpot.container, args.componentsDir);
  if (snapshot.contract !== extraction.pluginData) {
    throw new ScriptError({
      kind: "contract",
      component: extraction.penpot.container,
      detail: `istantanea con contract "${snapshot.contract}", atteso "${extraction.pluginData}" — riestrai con "extract ${extraction.penpot.container}".`,
    });
  }
  const existing = readExistingFiles(args.domainsDir);
  const { files } = renderComponentV2(snapshot, extraction, args.catalog, existing);
  const actionable = args.omitBarrel === true ? files.filter((file) => !file.path.endsWith("/index.ts")) : files;
  const barrel =
    args.omitBarrel === true
      ? { domain: extraction.render.domain, component: extraction.penpot.container, snapshot }
      : undefined;
  if (args.check) {
    const check = renderCheckV2(actionable, existing);
    if (!check.equal) {
      for (const divergence of check.divergences) {
        args.log(`divergente: ${divergence.path} (${divergence.reason})`);
      }
    }
    return { skipped: actionable.filter((f) => f.action === "skip").map((f) => f.path), divergences: check.divergences, barrel };
  }
  for (const file of actionable) {
    const absolute = resolve(args.domainsDir, file.path);
    if (file.action === "skip") {
      args.log(`SKIP (senza marker @generated, mai sovrascritto): ${absolute}`);
      continue;
    }
    mkdirSync(dirname(absolute), { recursive: true });
    const tmp = `${absolute}.tmp`;
    writeFileSync(tmp, file.content, "utf8");
    renameSync(tmp, absolute);
    args.log(`Scritto: ${absolute}`);
  }
  return { skipped: actionable.filter((f) => f.action === "skip").map((f) => f.path), divergences: [], barrel };
}

/**
 * Barrel accumulati per dominio (solo `--all`): un solo `index.ts` per
 * dominio con gli export di tutti i suoi componenti. Senza marker esistente
 * vale lo skip protettivo (mai sovrascritto, non errore).
 */
function writeOrCheckDomainBarrels(
  domainsDir: string,
  barrels: ReadonlyMap<string, ReadonlyArray<{ component: string; snapshot: ComponentSnapshot }>>,
  check: boolean,
  log: (text: string) => void,
): { skipped: string[]; divergedComponents: string[] } {
  const skipped: string[] = [];
  const divergedComponents: string[] = [];
  for (const [domain, entries] of [...barrels.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const expected = domainBarrelContent(entries);
    const rel = `${domain}/index.ts`;
    const absolute = resolve(domainsDir, rel);
    let current: string | undefined;
    try {
      current = readFileSync(absolute, "utf8");
    } catch {
      current = undefined;
    }
    if (current !== undefined && !isGeneratedFileV2(current)) {
      skipped.push(rel);
      continue;
    }
    if (check) {
      if (current !== expected) {
        log(`divergente: ${rel} (${current === undefined ? "missing" : "divergente"})`);
        divergedComponents.push(...entries.map((entry) => entry.component));
      }
      continue;
    }
    mkdirSync(dirname(absolute), { recursive: true });
    const tmp = `${absolute}.tmp`;
    writeFileSync(tmp, expected, "utf8");
    renameSync(tmp, absolute);
    log(`Scritto: ${absolute}`);
  }
  return { skipped, divergedComponents };
}

export const renderCommand: Command = renderCommandWith();
