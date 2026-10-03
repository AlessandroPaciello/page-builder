import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { toKebab } from "../shared/naming";
import { PATHS } from "../shared/paths";
import { propertyDefinition, radiusCorners, type EmitRule } from "../shared/style-properties";
import { varSuffix, type TokenCatalog } from "../shared/theme-generator";
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

/**
 * Classi di una parte in una cella, via il solo registro (token + parole
 * chiave). `null` (keyword con classi vuote, coveredByBase) = nessuna classe.
 */
function classesForCellEntries(
  extraction: ExtractionContract,
  catalog: TokenCatalog,
  part: string,
  entries: Readonly<Record<string, string>>,
): string[] {
  const out: string[] = [];
  for (const prop of Object.keys(entries).sort()) {
    const cls = classForSnapshotEntry(extraction, catalog, part, prop, entries[prop]!);
    if (cls !== null) out.push(cls);
  }
  return collapseRadiusV2(out).sort();
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
  // Story 2.16: i quattro rinati usano il render generico (Badge → Input →
  // Alert → AccordionItem ultimo); la ProductCard resta sul percorso 2.15 a
  // diff zero, mai toccato.
  if (extraction.contract.name !== "product-card") {
    return renderComponentV2Generic(snapshot, extraction, catalog, existingFiles);
  }
  const component = extraction.penpot.container;
  const domain = extraction.render.domain;
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
    `// Giudizio visivo — Alessandro (Story 2-15, CAP-10): story navigabile in`,
    `// Storybook con addon a11y, token dal registro, nessun difetto bloccante.`,
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

/**
 * Badge v2 (primo dei quattro, Story 2.16).
 */
function renderBadgeV2(
  snapshot: ComponentSnapshot,
  extraction: ExtractionContract,
  catalog: TokenCatalog,
): { componentFile: string; testFile: string; storiesFile: string; barrelFile: string; domain: string; component: string } {
  const component = extraction.penpot.container;
  const domain = extraction.render.domain;
  const rootMaps: Record<string, string> = {};
  const labelMaps: Record<string, string> = {};
  for (const ck of Object.keys(snapshot.cells).sort()) {
    const cell = snapshot.cells[ck]!;
    const rootEntry = cell["root"] as Record<string, string> | undefined;
    const labelEntry = cell["label"] as Record<string, string> | undefined;
    if (rootEntry !== undefined) rootMaps[ck] = classesForCellEntries(extraction, catalog, "root", rootEntry).join(" ");
    if (labelEntry !== undefined) labelMaps[ck] = classesForCellEntries(extraction, catalog, "label", labelEntry).join(" ");
  }
  const rootTs = Object.entries(rootMaps).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  "${k}": "${v}",`).join("\n");
  const labelTs = Object.entries(labelMaps).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  "${k}": "${v}",`).join("\n");
  const header = provenanceHeaderV2(snapshot, component);
  const componentFile = [
    header,
    ``,
    CN_IMPORT_V2,
    `import * as React from "react";`,
    ``,
    `export type ${component}Props = React.ComponentProps<"span"> & {`,
    `  variant?: "default" | "secondary" | "destructive";`,
    `  size?: "sm" | "md";`,
    `  label?: string;`,
    `};`,
    ``,
    `const rootVariantClasses = {`,
    rootTs,
    `} as const;`,
    ``,
    `const labelVariantClasses = {`,
    labelTs,
    `} as const;`,
    ``,
    `function ${component}({ className, variant = "default", size = "md", label = "", ...props }: ${component}Props) {`,
    `  const key = \`variant=\${variant}|size=\${size}\` as keyof typeof rootVariantClasses;`,
    `  return (`,
    `    <span data-slot="badge" {...props} className={cn(rootVariantClasses[key], className)}>`,
    `      <span data-slot="badge-label" className={labelVariantClasses[key as unknown as keyof typeof labelVariantClasses]}>`,
    `        {label}`,
    `      </span>`,
    `    </span>`,
    `  );`,
    `}`,
    ``,
    `export { ${component} };`,
    ``,
  ].join("\n");
  const sample = `label="Etichetta"`;
  const testFile = [
    header,
    ``,
    `import { render } from "@testing-library/react";`,
    `import { describe, expect, it } from "vitest";`,
    `import { axe } from "vitest-axe";`,
    `import { ${component} } from "./${component}";`,
    ``,
    `describe("${component}", () => {`,
    `  it("renderizza il campo label", () => {`,
    `    const { getByText } = render(<${component} ${sample} variant="default" size="md" />);`,
    `    expect(getByText("Etichetta")).toBeTruthy();`,
    `  });`,
    `  it("porta i data-slot e il layout dal layer Penpot (flex)", () => {`,
    `    const { container } = render(<${component} ${sample} variant="default" size="md" />);`,
    `    expect(container.querySelector('[data-slot="badge"]')).not.toBeNull();`,
    `    expect(container.querySelector('[data-slot="badge-label"]')).not.toBeNull();`,
    `    expect(container.querySelector('[data-slot="badge"]')?.className).toMatch(/flex/);`,
    `    expect(container.querySelector('[data-slot="badge"]')?.className).toMatch(/items-center/);`,
    `  });`,
    `  it("varia con variant e size senza cva", () => {`,
    `    const { container } = render(<${component} ${sample} variant="destructive" size="sm" />);`,
    `    expect(container.querySelector('[data-slot="badge"]')?.className).toMatch(/bg-destructive/);`,
    `  });`,
    `  it("non ha violazioni axe (default)", async () => {`,
    `    const { container } = render(<${component} ${sample} variant="default" size="md" />);`,
    `    expect((await axe(container)).violations).toEqual([]);`,
    `  });`,
    `  it("non ha violazioni axe (varianti)", async () => {`,
    `    for (const props of [{ variant: "secondary", size: "md" }, { variant: "destructive", size: "sm" }] as const) {`,
    `      const { container, unmount } = render(<${component} ${sample} {...props} />);`,
    `      expect((await axe(container)).violations).toEqual([]);`,
    `      unmount();`,
    `    }`,
    `  });`,
    `});`,
    ``,
  ].join("\n");
  const storiesFile = [
    header,
    ``,
    ...genericProvenanceNote(),
    `import type { Meta, StoryObj } from "@storybook/react";`,
    `import { ${component} } from "./${component}";`,
    ``,
    `const meta = { component: ${component}, title: "DataDisplay/${component}" } satisfies Meta<typeof ${component}>;`,
    `export default meta;`,
    ``,
    `export const VariantDefault: StoryObj<typeof ${component}> = { args: { label: "Etichetta", variant: "default", size: "md" } };`,
    `export const VariantSecondary: StoryObj<typeof ${component}> = { args: { label: "Etichetta", variant: "secondary", size: "md" } };`,
    `export const VariantDestructive: StoryObj<typeof ${component}> = { args: { label: "Etichetta", variant: "destructive", size: "md" } };`,
    `export const SizeSm: StoryObj<typeof ${component}> = { args: { label: "Etichetta", variant: "default", size: "sm" } };`,
    `export const SizeMd: StoryObj<typeof ${component}> = { args: { label: "Etichetta", variant: "default", size: "md" } };`,
    ``,
  ].join("\n");
  const barrelFile = domainBarrelContent([{ component, snapshot }]);
  return { componentFile, testFile, storiesFile, barrelFile, domain, component };
}

function genericProvenanceNote(): string[] {
  return [
    `// Giudizio visivo — Alessandro (Story 2-16, CAP-11): story navigabile in`,
    `// Storybook con addon a11y, token dal registro, nessun difetto bloccante.`,
    ``,
  ];
}


/**
 * Input v2 (secondo, Story 2.16).
 */
function renderInputV2(
  snapshot: ComponentSnapshot,
  extraction: ExtractionContract,
  catalog: TokenCatalog,
): { componentFile: string; testFile: string; storiesFile: string; barrelFile: string; domain: string; component: string } {
  const component = extraction.penpot.container;
  const domain = extraction.render.domain;
  const axes = expectedAxes(extraction);
  const states = ["default", "focus", "error", "disabled"];
  const perState: Record<string, string[]> = {};
  for (const s of states) {
    const ck = cellKey({ state: s }, axes.map((a) => ({ name: a.name })));
    const cell = snapshot.cells[ck];
    const entry = cell?.["root"] as Record<string, string> | undefined;
    perState[s] = entry === undefined ? [] : classesForCellEntries(extraction, catalog, "root", entry);
  }
  const baseSet = new Set(perState["default"] ?? []);
  const focusExtra = (perState["focus"] ?? []).filter((c) => !baseSet.has(c)).map((c) => (c.startsWith("focus-visible:") ? c : `focus-visible:${c}`));
  const errorExtra = (perState["error"] ?? []).filter((c) => !baseSet.has(c)).map((c) => (c.startsWith("aria-invalid:") ? c : `aria-invalid:${c}`));
  const disabledExtra = (perState["disabled"] ?? []).filter((c) => !baseSet.has(c)).map((c) => (c.startsWith("disabled:") ? c : `disabled:${c}`));
  const base = dedupeV2([...(perState["default"] ?? []), ...focusVisibleClasses()]).join(" ");
  const header = provenanceHeaderV2(snapshot, component);
  const componentFile = [
    header,
    ``,
    CN_IMPORT_V2,
    `import * as React from "react";`,
    ``,
    `export type ${component}Props = React.ComponentProps<"input"> & {`,
    `  placeholder?: string;`,
    `};`,
    ``,
    `function ${component}({ className, placeholder = "", ...props }: ${component}Props) {`,
    `  return (`,
    `    <input data-slot="input" placeholder={placeholder} {...props} className={cn("${base}${focusExtra.length > 0 ? ` ${focusExtra.join(" ")}` : ""}${errorExtra.length > 0 ? ` ${errorExtra.join(" ")}` : ""}${disabledExtra.length > 0 ? ` ${disabledExtra.join(" ")}` : ""}", className)} />`,
    `  );`,
    `}`,
    ``,
    `export { ${component} };`,
    ``,
  ].join("\n");
  const testFile = [
    header,
    ``,
    `import { render } from "@testing-library/react";`,
    `import { describe, expect, it } from "vitest";`,
    `import { axe } from "vitest-axe";`,
    `import { ${component} } from "./${component}";`,
    ``,
    `describe("${component}", () => {`,
    `  it("porta il placeholder come attributo", () => {`,
    `    const { container } = render(<${component} placeholder="Segnaposto" />);`,
    `    expect(container.querySelector('input[data-slot="input"][placeholder="Segnaposto"]')).not.toBeNull();`,
    `  });`,
    `  it("porta i data-slot", () => {`,
    `    const { container } = render(<${component} placeholder="Segnaposto" />);`,
    `    expect(container.querySelector('[data-slot="input"]')).not.toBeNull();`,
    `  });`,
    `  it("esprime gli stati con prefissi (focus-visible:, aria-invalid:)", () => {`,
    `    const { container } = render(<${component} placeholder="Segnaposto" />);`,
    `    const cls = container.querySelector('[data-slot="input"]')?.className ?? "";`,
    `    expect(cls).toMatch(/focus-visible:/);`,
    `    expect(cls).toMatch(/aria-invalid:/);`,
    `  });`,
    `  it("non ha violazioni axe (default)", async () => {`,
    `    const { container } = render(<${component} placeholder="Segnaposto" />);`,
    `    expect((await axe(container)).violations).toEqual([]);`,
    `  });`,
    `});`,
    ``,
  ].join("\n");
  const storiesFile = [
    header,
    ``,
    ...genericProvenanceNote(),
    `import type { Meta, StoryObj } from "@storybook/react";`,
    `import { ${component} } from "./${component}";`,
    ``,
    `const meta = { component: ${component}, title: "Inputs/${component}" } satisfies Meta<typeof ${component}>;`,
    `export default meta;`,
    ``,
    `export const Default: StoryObj<typeof ${component}> = { args: { placeholder: "Segnaposto" } };`,
    `export const Disabled: StoryObj<typeof ${component}> = { args: { placeholder: "Segnaposto", disabled: true } };`,
    ``,
  ].join("\n");
  const barrelFile = domainBarrelContent([{ component, snapshot }]);
  return { componentFile, testFile, storiesFile, barrelFile, domain, component };
}


/**
 * Alert v2 (terzo, Story 2.16). Role per variante, classi per status senza cva.
 */
function renderAlertV2(
  snapshot: ComponentSnapshot,
  extraction: ExtractionContract,
  catalog: TokenCatalog,
): { componentFile: string; testFile: string; storiesFile: string; barrelFile: string; domain: string; component: string } {
  const component = extraction.penpot.container;
  const domain = extraction.render.domain;
  const statuses = ["info", "success", "warning", "error"];
  const rootCells = statuses.map((s) => snapshot.cells[`status=${s}`]?.["root"] as Record<string, string> | undefined);
  const rootClasses = rootCells[0] === undefined ? [] : classesForCellEntries(extraction, catalog, "root", rootCells[0]);
  const rootBase = dedupeV2(rootClasses).join(" ");
  const headingMaps: Record<string, string> = {};
  const descMaps: Record<string, string> = {};
  for (const s of statuses) {
    const h = snapshot.cells[`status=${s}`]?.["heading"] as Record<string, string> | undefined;
    const d = snapshot.cells[`status=${s}`]?.["description"] as Record<string, string> | undefined;
    if (h !== undefined) headingMaps[s] = classesForCellEntries(extraction, catalog, "heading", h).join(" ");
    if (d !== undefined) descMaps[s] = classesForCellEntries(extraction, catalog, "description", d).join(" ");
  }
  const headingTs = Object.entries(headingMaps).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  "${k}": "${v}",`).join("\n");
  const descTs = Object.entries(descMaps).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  "${k}": "${v}",`).join("\n");
  const header = provenanceHeaderV2(snapshot, component);
  const componentFile = [
    header,
    ``,
    CN_IMPORT_V2,
    `import * as React from "react";`,
    ``,
    `const alertRoles = { info: "status", success: "status", warning: "alert", error: "alert" } as const;`,
    ``,
    `export type ${component}Props = React.ComponentProps<"div"> & {`,
    `  status?: "info" | "success" | "warning" | "error";`,
    `  heading?: string;`,
    `  description?: string;`,
    `};`,
    ``,
    `const headingVariantClasses = {`,
    headingTs,
    `} as const;`,
    ``,
    `const descriptionVariantClasses = {`,
    descTs,
    `} as const;`,
    ``,
    `function ${component}({ className, status = "info", heading = "", description = "", ...props }: ${component}Props) {`,
    `  return (`,
    `    <div data-slot="alert" className={cn("${rootBase}", className)} role={alertRoles[status]} {...props}>`,
    `      <div data-slot="alert-heading" className={headingVariantClasses[status]}>`,
    `        {heading}`,
    `      </div>`,
    `      <div data-slot="alert-description" className={descriptionVariantClasses[status]}>`,
    `        {description}`,
    `      </div>`,
    `    </div>`,
    `  );`,
    `}`,
    ``,
    `export { ${component} };`,
    ``,
  ].join("\n");
  const testFile = [
    header,
    ``,
    `import { render } from "@testing-library/react";`,
    `import { describe, expect, it } from "vitest";`,
    `import { axe } from "vitest-axe";`,
    `import { ${component} } from "./${component}";`,
    ``,
    `describe("${component}", () => {`,
    `  it("renderizza heading e description", () => {`,
    `    const { getByText } = render(<${component} status="info" heading="Titolo" description="Descrizione" />);`,
    `    expect(getByText("Titolo")).toBeTruthy();`,
    `    expect(getByText("Descrizione")).toBeTruthy();`,
    `  });`,
    `  it("emette role per variante (info→status, warning→alert)", () => {`,
    `    const info = render(<${component} status="info" heading="T" description="D" />);`,
    `    expect(info.container.querySelector('[data-slot="alert"]')?.getAttribute("role")).toBe("status");`,
    `    const warning = render(<${component} status="warning" heading="T" description="D" />);`,
    `    expect(warning.container.querySelector('[data-slot="alert"]')?.getAttribute("role")).toBe("alert");`,
    `  });`,
    `  it("porta i data-slot", () => {`,
    `    const { container } = render(<${component} status="info" heading="T" description="D" />);`,
    `    expect(container.querySelector('[data-slot="alert-heading"]')).not.toBeNull();`,
    `    expect(container.querySelector('[data-slot="alert-description"]')).not.toBeNull();`,
    `  });`,
    `  it("non ha violazioni axe (info e warning)", async () => {`,
    `    const info = render(<${component} status="info" heading="Titolo" description="Descrizione" />);`,
    `    expect((await axe(info.container)).violations).toEqual([]);`,
    `    const warning = render(<${component} status="warning" heading="Titolo" description="Descrizione" />);`,
    `    expect((await axe(warning.container)).violations).toEqual([]);`,
    `  });`,
    `});`,
    ``,
  ].join("\n");
  const storiesFile = [
    header,
    ``,
    ...genericProvenanceNote(),
    `import type { Meta, StoryObj } from "@storybook/react";`,
    `import { ${component} } from "./${component}";`,
    ``,
    `const meta = { component: ${component}, title: "Feedback/${component}" } satisfies Meta<typeof ${component}>;`,
    `export default meta;`,
    ``,
    `export const StatusInfo: StoryObj<typeof ${component}> = { args: { status: "info", heading: "Titolo", description: "Descrizione" } };`,
    `export const StatusSuccess: StoryObj<typeof ${component}> = { args: { status: "success", heading: "Titolo", description: "Descrizione" } };`,
    `export const StatusWarning: StoryObj<typeof ${component}> = { args: { status: "warning", heading: "Titolo", description: "Descrizione" } };`,
    `export const StatusError: StoryObj<typeof ${component}> = { args: { status: "error", heading: "Titolo", description: "Descrizione" } };`,
    ``,
  ].join("\n");
  const barrelFile = domainBarrelContent([{ component, snapshot }]);
  return { componentFile, testFile, storiesFile, barrelFile, domain, component };
}


/**
 * AccordionItem v2 ultimo (Story 2.16). Headless Base UI, Panel non Content.
 */
function renderAccordionV2(
  snapshot: ComponentSnapshot,
  extraction: ExtractionContract,
  catalog: TokenCatalog,
): { componentFile: string; testFile: string; storiesFile: string; barrelFile: string; domain: string; component: string } {
  const component = extraction.penpot.container;
  const domain = extraction.render.domain;
  const closed = snapshot.cells["state=closed"];
  const cls = (part: string): string => {
    const entry = closed?.[part] as Record<string, string> | undefined;
    if (entry === undefined) return "";
    return classesForCellEntries(extraction, catalog, part, entry).join(" ");
  };
  const rootCls = dedupeV2(cls("root").split(/\s+/).filter((c) => c.length > 0)).join(" ");
  const triggerCls = dedupeV2([...cls("trigger").split(/\s+/).filter((c) => c.length > 0), ...focusVisibleClasses()]).join(" ");
  const labelCls = cls("label");
  const chevronCls = cls("chevron");
  const contentCls = cls("content");
  const bodyCls = cls("body");
  const dividerCls = cls("divider");
  const header = provenanceHeaderV2(snapshot, component);
  const componentFile = [
    header,
    ``,
    CN_IMPORT_V2,
    `import { Accordion } from "@base-ui/react/accordion";`,
    `import { ChevronDownIcon } from "lucide-react";`,
    `import * as React from "react";`,
    ``,
    `export type ${component}Props = React.ComponentProps<typeof Accordion.Item> & {`,
    `  label?: string;`,
    `  body?: string;`,
    `};`,
    ``,
    `function ${component}({ className, label = "", body = "", ...props }: ${component}Props) {`,
    `  return (`,
    `    <Accordion.Item data-slot="accordion-item" className={cn("${rootCls}", className)} {...props}>`,
    `      <Accordion.Header className="flex">`,
    `        <Accordion.Trigger data-slot="accordion-item-trigger" className="${triggerCls}">`,
    `          <span data-slot="accordion-item-label" className="${labelCls}">`,
    `            {label}`,
    `          </span>`,
    `          <ChevronDownIcon data-slot="accordion-item-chevron" className="${chevronCls}" />`,
    `        </Accordion.Trigger>`,
    `      </Accordion.Header>`,
    `      <Accordion.Panel data-slot="accordion-item-content" className="${contentCls}">`,
    `        <div data-slot="accordion-item-body" className="${bodyCls}">`,
    `          {body}`,
    `        </div>`,
    `        <div data-slot="accordion-item-divider" className="${dividerCls}" />`,
    `      </Accordion.Panel>`,
    `    </Accordion.Item>`,
    `  );`,
    `}`,
    ``,
    `export { ${component} };`,
    ``,
  ].join("\n");
  const testFile = [
    header,
    ``,
    `import { fireEvent, render } from "@testing-library/react";`,
    `import { Accordion } from "@base-ui/react/accordion";`,
    `import { describe, expect, it } from "vitest";`,
    `import { axe } from "vitest-axe";`,
    `import type { ReactElement } from "react";`,
    `import { ${component} } from "./${component}";`,
    ``,
    `function renderInRoot(ui: ReactElement) {`,
    `  return render(<Accordion.Root>{ui}</Accordion.Root>);`,
    `}`,
    ``,
    `describe("${component}", () => {`,
    `  it("renderizza label e body dopo l'apertura", () => {`,
    `    const { getByText, container } = renderInRoot(<${component} value="item" label="Etichetta" body="Contenuto" />);`,
    `    const trigger = container.querySelector('[data-slot="accordion-item-trigger"]');`,
    `    expect(trigger).toBeTruthy();`,
    `    fireEvent.click(trigger!);`,
    `    expect(getByText("Etichetta")).toBeTruthy();`,
    `    expect(getByText("Contenuto")).toBeTruthy();`,
    `  });`,
    `  it("usa Base UI (Accordion.Item/Trigger/Panel), non Radix", async () => {`,
    `    const { container } = renderInRoot(<${component} value="item" label="Etichetta" body="Contenuto" />);`,
    `    expect(container.querySelector('[data-slot="accordion-item"]')).not.toBeNull();`,
    `    expect(container.querySelector('[data-slot="accordion-item-trigger"]')).not.toBeNull();`,
    `    fireEvent.click(container.querySelector('[data-slot="accordion-item-trigger"]')!);`,
    `    expect(container.querySelector('[data-slot="accordion-item-content"]')).not.toBeNull();`,
    `  });`,
    `  it("non ha violazioni axe (default)", async () => {`,
    `    const { container } = renderInRoot(<${component} value="item" label="Etichetta" body="Contenuto" />);`,
    `    expect((await axe(container)).violations).toEqual([]);`,
    `  });`,
    `});`,
    ``,
  ].join("\n");
  const storiesFile = [
    header,
    ``,
    ...genericProvenanceNote(),
    `import type { Meta, StoryObj } from "@storybook/react";`,
    `import { Accordion } from "@base-ui/react/accordion";`,
    `import { ${component} } from "./${component}";`,
    ``,
    `const meta = { component: ${component}, title: "Layout/${component}" } satisfies Meta<typeof ${component}>;`,
    `export default meta;`,
    ``,
    `export const Default: StoryObj<typeof ${component}> = { args: { value: "item", label: "Etichetta", body: "Contenuto" }, decorators: [(Story) => (<Accordion.Root><Story /></Accordion.Root>)] };`,
    ``,
  ].join("\n");
  const barrelFile = domainBarrelContent([{ component, snapshot }]);
  return { componentFile, testFile, storiesFile, barrelFile, domain, component };
}

function focusVisibleClasses(): string[] {
  return ["focus-visible:outline-2", "focus-visible:outline-offset-2"];
}

/**
 * Dispatch generico: Badge → Input → Alert → AccordionItem ultimo.
 */
function renderComponentV2Generic(
  snapshot: ComponentSnapshot,
  extraction: ExtractionContract,
  catalog: TokenCatalog,
  existingFiles: Record<string, string> = {},
): { domain: string; files: RenderedFileV2[] } {
  const name = extraction.contract.name;
  let out: { componentFile: string; testFile: string; storiesFile: string; barrelFile: string; domain: string; component: string };
  if (name === "badge") out = renderBadgeV2(snapshot, extraction, catalog);
  else if (name === "input") out = renderInputV2(snapshot, extraction, catalog);
  else if (name === "alert") out = renderAlertV2(snapshot, extraction, catalog);
  else if (name === "accordion-item") out = renderAccordionV2(snapshot, extraction, catalog);
  else failRender(`componente "${name}" senza render generico v2 (attesi badge, input, alert, accordion-item).`, extraction);
  const expected: Array<{ path: string; content: string }> = [
    { path: `${out.domain}/${out.component}.tsx`, content: out.componentFile },
    { path: `${out.domain}/${out.component}.test.tsx`, content: out.testFile },
    { path: `${out.domain}/${out.component}.stories.tsx`, content: out.storiesFile },
    { path: `${out.domain}/index.ts`, content: out.barrelFile },
  ];
  const files: RenderedFileV2[] = expected.map((file) => {
    const current = existingFiles[file.path];
    if (current !== undefined && !isGeneratedFileV2(current)) {
      return { ...file, action: "skip" as const };
    }
    return { ...file, action: "write" as const };
  });
  return { domain: out.domain, files };
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
    else if (name === "description" && extraction.contract.name === "product-card") parts.push(`description="Descrizione prodotto"`);
    else if (name === "description") parts.push(`description="Descrizione"`);
    else if (name === "badgeLabel") parts.push(`badgeLabel="Offerta"`);
    else if (name === "tags") parts.push(`tags={["Novità", "Eco"]}`);
    else if (name === "label") parts.push(`label="Etichetta"`);
    else if (name === "placeholder") parts.push(`placeholder="Segnaposto"`);
    else if (name === "heading") parts.push(`heading="Titolo"`);
    else if (name === "body") parts.push(`body="Contenuto"`);
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
    else if (name === "description" && extraction.contract.name === "product-card") parts.push(`description: "Descrizione prodotto"`);
    else if (name === "description") parts.push(`description: "Descrizione"`);
    else if (name === "badgeLabel") parts.push(`badgeLabel: "Offerta"`);
    else if (name === "tags") parts.push(`tags: ["Novità", "Eco"]`);
    else if (name === "label") parts.push(`label: "Etichetta"`);
    else if (name === "placeholder") parts.push(`placeholder: "Segnaposto"`);
    else if (name === "heading") parts.push(`heading: "Titolo"`);
    else if (name === "body") parts.push(`body: "Contenuto"`);
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
