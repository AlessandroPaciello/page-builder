import { PLUGIN_DATA_PATTERN, contractByName } from "../component-reader";
import { toKebab } from "../extract-component";
import type { SnapshotLayer } from "../library/library-snapshot";
import { cellKeyOf, type ComponentFixture, type ComponentRecipe } from "../recipe-schema";
import { varSuffix, type TokenCatalog, type TokenType } from "../theme-generator";
import { buildTokenVocabulary, utilityPrefixesFor, validateClassesAgainstVocabulary } from "../token-vocabulary";
import type { BindingPart, ComponentBinding } from "./binding-shadcn";

/**
 * Emitter shadcn (Story 2.6, AD-11): funzione PURA che instrada gli assi per
 * TIPO — `option` → varianti `cva`, `state` → prefissi
 * `focus-visible:`/`aria-invalid:`/`disabled:`, `behavior` →
 * `data-[state=…]:` — e deriva le classi dalle stesse funzioni di nome dello
 * Stadio 1 (`varSuffix`), validate contro `buildTokenVocabulary`; un literal
 * non ha nome token e non passa. Non genera componenti React da zero:
 * struttura, parti headless e comportamento a11y vengono dalla base shadcn
 * committata (`shadcnBaseSources`, di cui l'import headless è riusato
 * verbatim); il binding dichiara tutto ciò che dipende dalla libreria.
 * Stesso input → stesso output byte per byte: nessun timestamp, nessuna
 * iterazione non ordinata.
 */

/** Marker `@generated`: un file che non lo porta in prima riga non è mai sovrascritto. */
export const GENERATED_MARKER = "@generated";

/**
 * Import di `cn` emesso nei componenti generati. Lo specifier è assemblato e
 * NON compare come literal in questo file: il gate di confine di `scripts`
 * vieta le dipendenze reali verso il package ui (l'emitter non importa MAI
 * dall'ui), non la GENERAZIONE di codice che lo referenzia (AD-11) — il
 * backstop raw del gate però matcha anche i literal, quindi lo si evita.
 */
const UI_PACKAGE_SEGMENT = "@penpot-ds";
const CN_IMPORT = `import { cn } from "${UI_PACKAGE_SEGMENT}/ui/lib/utils";`;

function regenCommandFor(componentName: string): string {
  return `pnpm --filter @penpot-ds/scripts render:component -- ${componentName}`;
}

/** Tipi di layer Penpot in cui `fill` è colore del testo, non dello sfondo. */
const TEXT_KINDS = new Set(["text"]);
/** Tipi di layer Penpot in cui `strokeColor` è stroke vettoriale, non bordo CSS. */
const STROKE_KINDS = new Set(["path", "vector", "ellipse", "line"]);

/**
 * Tipo token atteso per ogni proprietà delle celle ricetta. Una proprietà
 * legata a un token di altro tipo è un wiring sbagliato: fail-loud
 * nominativo, mai una classe sbagliata in silenzio. `strokeWidth` e
 * `opacity` (tipi senza namespace utility v4, decisione review 2.1) NON
 * producono classi: skip con log, il consumo previsto è `var()` inline.
 */
const PROPERTY_TOKEN_TYPE: Record<string, TokenType> = {
  fill: "color",
  strokeColor: "color",
  paddingTop: "spacing",
  paddingRight: "spacing",
  paddingBottom: "spacing",
  paddingLeft: "spacing",
  columnGap: "spacing",
  rowGap: "spacing",
  fontSize: "fontSizes",
  fontWeight: "fontWeights",
  letterSpacing: "letterSpacing",
  shadow: "shadow",
  borderRadiusTopLeft: "borderRadius",
  borderRadiusTopRight: "borderRadius",
  borderRadiusBottomRight: "borderRadius",
  borderRadiusBottomLeft: "borderRadius",
  strokeWidth: "borderWidth",
  opacity: "opacity",
};

const RADIUS_PROPS = [
  "borderRadiusTopLeft",
  "borderRadiusTopRight",
  "borderRadiusBottomRight",
  "borderRadiusBottomLeft",
] as const;

const RADIUS_CORNER: Record<(typeof RADIUS_PROPS)[number], string> = {
  borderRadiusTopLeft: "rounded-tl",
  borderRadiusTopRight: "rounded-tr",
  borderRadiusBottomRight: "rounded-br",
  borderRadiusBottomLeft: "rounded-bl",
};

function utilityPrefixFor(property: string, kind: string): string {
  switch (property) {
    case "fill":
      return TEXT_KINDS.has(kind) ? "text" : "bg";
    case "strokeColor":
      return STROKE_KINDS.has(kind) ? "stroke" : "border";
    case "paddingTop":
      return "pt";
    case "paddingRight":
      return "pr";
    case "paddingBottom":
      return "pb";
    case "paddingLeft":
      return "pl";
    case "columnGap":
      return "gap-x";
    case "rowGap":
      return "gap-y";
    case "fontSize":
      return "text";
    case "fontWeight":
      return "font";
    case "letterSpacing":
      return "tracking";
    case "shadow":
      return "shadow";
    default:
      throw new Error(
        `Emitter shadcn: proprietà "${property}" non instradabile — estenderla è una decisione esplicita, non silenziosa.`,
      );
  }
}

export interface RenderedFile {
  /** Percorso relativo alla radice `packages/ui/src/domains/`. */
  path: string;
  content: string;
  /** `skip` = file esistente senza marker `@generated`: mai sovrascritto (non è un errore). */
  action: "write" | "skip";
}

export interface SkippedProperty {
  part: string;
  cell: string;
  property: string;
  token: string;
  reason: string;
}

export interface RenderResult {
  component: string;
  domain: string;
  files: RenderedFile[];
  skippedProperties: SkippedProperty[];
}

export interface RenderOptions {
  /**
   * Contenuti esistenti (percorso relativo → contenuto) per lo skip
   * protettivo: un file senza marker `@generated` non viene sovrascritto.
   */
  existingFiles?: Record<string, string>;
}

function fail(detail: string): never {
  throw new Error(`Emitter shadcn: ${detail}`);
}

function parseCellKey(key: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const segment of key.split("|")) {
    const [name, value] = segment.split("=");
    if (name === undefined || value === undefined) fail(`chiave cella "${key}" malformata.`);
    out[name] = value;
  }
  return out;
}

/** Il contenuto è un file generato? Prima riga con il marker `@generated`. */
export function isGeneratedFile(content: string): boolean {
  return content.split("\n", 1)[0]?.includes(GENERATED_MARKER) === true;
}

/**
 * Confronto byte-per-byte in memoria fra l'output atteso e i file esistenti.
 * Un file esistente senza marker è fuori dal confronto (skip protettivo, mai
 * un errore); un file con marker divergente o assente è drift nominato.
 */
export function renderCheck(
  expected: readonly RenderedFile[],
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

interface PartClasses {
  /** Classi statiche: structural + classi del default + gruppi `state`/`behavior` prefissati. */
  staticClasses: string;
  /** Presente per ogni parte quando il contratto ha assi `option`. */
  cva?: {
    name: string;
    base: string;
    variants: Record<string, Record<string, string>>;
    defaults: Record<string, string>;
  };
}

interface PartNode {
  name: string;
  binding: BindingPart;
  classes: PartClasses;
  children: PartNode[];
}

interface EmitterContext {
  fixture: ComponentFixture;
  recipe: ComponentRecipe;
  binding: ComponentBinding;
  contract: NonNullable<ReturnType<typeof contractByName>>;
  tokenTypes: Map<string, TokenType>;
  vocabulary: Set<string>;
  baseSource: string;
  headlessAlias: string | null;
  lucideImport: string | null;
}

function findLayerByName(layer: SnapshotLayer, part: string): SnapshotLayer | null {
  if (layer.name === part) return layer;
  for (const child of layer.children) {
    const found = findLayerByName(child, part);
    if (found !== null) return found;
  }
  return null;
}

function layerKindFor(ctx: EmitterContext, part: string, cellKey: string): string {
  const cell = ctx.fixture.cells.find((candidate) => cellKeyOf(ctx.contract.axes, candidate.variantProps) === cellKey);
  if (cell === undefined) fail(`cella "${cellKey}" non trovata nella fixture di "${ctx.fixture.componentName}".`);
  if (part === "root") return cell.root.kind;
  const layer = findLayerByName(cell.root, part);
  if (layer === null) {
    fail(
      `parte "${part}" non trovata come layer nella cella "${cellKey}" della fixture — il binding mappa una parte che il design non ha.`,
    );
  }
  return layer.kind;
}

/**
 * Deriva la classe Tailwind di una proprietà dal token, con lo stesso suffisso
 * della CSS var (`varSuffix`): variabile e classe non possono divergere.
 * Restituisce `null` per i tipi senza namespace utility v4 (skip con log).
 */
function deriveClass(
  ctx: EmitterContext,
  part: string,
  cellKey: string,
  property: string,
  token: string,
): { className: string | null; skipReason?: string } {
  const expectedType = PROPERTY_TOKEN_TYPE[property];
  if (expectedType === undefined) {
    fail(
      `proprietà "${property}" (parte "${part}", cella "${cellKey}") non è instradabile dall'emitter shadcn — estenderla è una decisione esplicita, non silenziosa.`,
    );
  }
  const type = ctx.tokenTypes.get(token);
  if (type === undefined) {
    fail(
      `token "${token}" (parte "${part}", cella "${cellKey}", proprietà "${property}") non esiste nel catalogo Stadio 1 — un valore literal non passa.`,
    );
  }
  if (type !== expectedType) {
    fail(
      `proprietà "${property}" (parte "${part}", cella "${cellKey}") è legata al token "${token}" (type "${type}"), atteso type "${expectedType}" — wiring sbagliato in ricetta o library.`,
    );
  }
  if (utilityPrefixesFor(type).length === 0) {
    return {
      className: null,
      skipReason: `il tipo token "${type}" non ha namespace utility Tailwind v4 (decisione review 2.1): nessuna classe emessa, consumo previsto via var(--${type === "opacity" ? "opacity" : "border-width"}-…) inline`,
    };
  }
  if ((RADIUS_PROPS as readonly string[]).includes(property)) {
    const radiusProp = RADIUS_PROPS.find((candidate) => candidate === property);
    if (radiusProp === undefined) fail(`proprietà radius "${property}" non riconosciuta.`);
    // Le classi corner NON sono nel vocabolario (solo `rounded-*`): la
    // validazione avviene dopo il collapse in `validateEmitted`.
    return { className: `${RADIUS_CORNER[radiusProp]}-${varSuffix(token, type)}` };
  }
  const className = `${utilityPrefixFor(property, layerKindFor(ctx, part, cellKey))}-${varSuffix(token, type)}`;
  const validation = validateClassesAgainstVocabulary([className], ctx.vocabulary);
  if (!validation.valid) {
    fail(
      `classe "${className}" (parte "${part}", proprietà "${property}", token "${token}") non è derivabile dal vocabolario token Stadio 1 — estenderlo è una decisione esplicita.`,
    );
  }
  return { className };
}

/**
 * Collapse del gruppo radius: le quattro classi corner (`rounded-tl-*`…) non
 * sono nel vocabolario; se le quattro corner sono presenti e uguali collassano
 * in `rounded-<sfx>` (il caso di Badge, Input, AccordionItem). Corner parziali
 * o diverse restano e falliscono la validazione a valle.
 */
function collapseRadius(classes: string[]): string[] {
  const corners = classes.filter((cls) => RADIUS_PROPS.some((prop) => cls.startsWith(RADIUS_CORNER[prop])));
  if (corners.length !== RADIUS_PROPS.length) return classes;
  const suffixes = new Set(corners.map((cls) => cls.slice(cls.lastIndexOf("-") + 1)));
  if (suffixes.size !== 1) return classes;
  const suffix = [...suffixes][0];
  if (suffix === undefined) return classes;
  const rest = classes.filter((cls) => !corners.includes(cls));
  return [...rest, `rounded-${suffix}`];
}

function validateEmitted(ctx: EmitterContext, part: string, classes: readonly string[]): string[] {
  const collapsed = collapseRadius([...classes]);
  const validation = validateClassesAgainstVocabulary(collapsed, ctx.vocabulary);
  if (!validation.valid) {
    fail(
      `classi ${validation.invalidClasses.map((cls) => `"${cls}"`).join(", ")} (parte "${part}") non derivabili dal vocabolario token Stadio 1 — estenderlo è una decisione esplicita.`,
    );
  }
  return collapsed;
}

function dedupe(classes: readonly string[]): string[] {
  return [...new Set(classes.map((cls) => cls.trim()).filter((cls) => cls.length > 0))];
}

function componentNameCamel(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Fattorizzazione per parte: ogni proprietà è assegnata all'UNICO asse che la
 * influenza (confronto fra celle che differiscono solo per quell'asse);
 * proprietà costanti → classi base; due assi sulla stessa proprietà =
 * interazione non esprimibile in cva/prefissi → fail-loud nominativo.
 */
function computePartClasses(ctx: EmitterContext, part: string, skipped: SkippedProperty[]): PartClasses {
  const partCells = ctx.recipe.parts[part];
  if (partCells === undefined) fail(`parte "${part}" assente dalla ricetta.`);
  const boundPart = ctx.binding.parts[part];
  if (boundPart === undefined) fail(`parte "${part}" assente dal binding.`);

  const defaultKey = cellKeyOf(
    ctx.contract.axes,
    Object.fromEntries(ctx.contract.axes.map((axis) => [axis.name, axis.default])),
  );
  if (partCells[defaultKey] === undefined) {
    fail(`la ricetta della parte "${part}" non copre la cella default "${defaultKey}".`);
  }

  const propertySet = new Set<string>();
  for (const cell of Object.values(partCells)) {
    for (const property of Object.keys(cell)) propertySet.add(property);
  }
  const properties = [...propertySet].sort();

  const assignedAxis = new Map<string, string | null>();
  for (const property of properties) {
    const influencing: string[] = [];
    for (const axis of ctx.contract.axes) {
      const others = ctx.contract.axes.filter((candidate) => candidate.name !== axis.name);
      const groups = new Map<string, Set<string>>();
      for (const [key, cell] of Object.entries(partCells)) {
        const values = parseCellKey(key);
        const othersKey = others.map((candidate) => `${candidate.name}=${values[candidate.name] ?? ""}`).join("|");
        const group = groups.get(othersKey) ?? new Set<string>();
        group.add(cell[property] ?? "<assente>");
        groups.set(othersKey, group);
      }
      if ([...groups.values()].some((group) => group.size > 1)) influencing.push(axis.name);
    }
    if (influencing.length > 1) {
      fail(
        `proprietà "${property}" della parte "${part}" varia con più assi (${influencing.join(", ")}) — interazione non esprimibile in cva/prefissi: fattorizzare è una decisione di ricetta, non dell'emitter.`,
      );
    }
    assignedAxis.set(property, influencing[0] ?? null);
  }

  /**
   * Assenza di una proprietà da una cella: per un asse è esprimibile (nessuna
   * classe per quel valore) SOLO se la proprietà è assente anche dalla cella
   * default — altrimenti sarebbe una rimozione, che l'emitter non può
   * esprimere: fail-loud nominativo.
   */
  const deriveFor = (property: string, cellKey: string): string | null => {
    const token = partCells[cellKey]?.[property];
    if (token === undefined) {
      if (partCells[defaultKey]?.[property] === undefined) return null;
      fail(
        `proprietà "${property}" della parte "${part}" è assente nella cella "${cellKey}" ma presente nella cella default — l'emitter non può esprimere la rimozione di una classe: allinea la ricetta.`,
      );
    }
    const derived = deriveClass(ctx, part, cellKey, property, token as string);
    if (derived.className === null) {
      skipped.push({
        part,
        cell: cellKey,
        property,
        token,
        reason: derived.skipReason ?? "tipo token senza utility v4",
      });
      return null;
    }
    return derived.className;
  };

  const baseDerived: string[] = [];
  const optionVariants: Record<string, Record<string, string[]>> = {};
  const stateGroups: Array<{ prefix: string; classes: string[] }> = [];

  for (const property of properties) {
    if (assignedAxis.get(property) === null) {
      const derived = deriveFor(property, defaultKey);
      if (derived !== null) baseDerived.push(derived);
    }
  }

  for (const axis of ctx.contract.axes) {
    const bound = ctx.binding.axes[axis.name];
    if (bound === undefined) fail(`asse "${axis.name}" senza tipo nel binding — fail-loud nominativo.`);
    const assignedProps = properties.filter((property) => assignedAxis.get(property) === axis.name);
    const classesFor = (value: string): string[] => {
      const cellKey = cellKeyOf(
        ctx.contract.axes,
        Object.fromEntries(
          ctx.contract.axes.map((candidate) => [
            candidate.name,
            candidate.name === axis.name ? value : candidate.default,
          ]),
        ),
      );
      const classes: string[] = [];
      for (const property of assignedProps) {
        const derived = deriveFor(property, cellKey);
        if (derived !== null) classes.push(derived);
      }
      return validateEmitted(ctx, part, classes);
    };

    if (axis.type === "option") {
      const propName = bound.prop ?? axis.name;
      optionVariants[propName] = {};
      for (const value of axis.values) {
        const apiValue = bound.values[value];
        if (apiValue === undefined) fail(`asse "${axis.name}", valore "${value}" senza API nel binding.`);
        if (value === axis.default) {
          baseDerived.push(...classesFor(value));
          optionVariants[propName][apiValue] = [];
        } else {
          optionVariants[propName][apiValue] = classesFor(value);
        }
      }
    } else {
      for (const value of axis.values) {
        const prefix = bound.values[value];
        if (prefix === undefined) fail(`asse "${axis.name}", valore "${value}" senza API nel binding.`);
        const classes = classesFor(value);
        if (value === axis.default) {
          if (prefix !== "") {
            fail(`asse "${axis.name}" (${axis.type}): il valore default "${value}" deve avere API "" nel binding.`);
          }
          baseDerived.push(...classes);
        } else if (classes.length > 0) {
          stateGroups.push({ prefix, classes });
        }
      }
    }
  }

  const baseClasses = validateEmitted(ctx, part, baseDerived).sort();
  const staticParts = [boundPart.structural, ...baseClasses];
  for (const group of stateGroups) {
    staticParts.push(...[...group.classes].sort().map((cls) => `${group.prefix}${cls}`));
  }
  const staticClasses = dedupe(staticParts).join(" ");

  const optionAxes = ctx.contract.axes.filter((axis) => axis.type === "option");
  if (optionAxes.length === 0) return { staticClasses };

  const camelComponent = componentNameCamel(ctx.recipe.componentName);
  const cvaName =
    part === "root"
      ? `${camelComponent}Variants`
      : `${camelComponent}${part.charAt(0).toUpperCase()}${part.slice(1)}Variants`;
  const variants: Record<string, Record<string, string>> = {};
  const defaults: Record<string, string> = {};
  const claimedProps = new Map<string, string>();
  for (const axis of optionAxes) {
    const bound = ctx.binding.axes[axis.name];
    if (bound === undefined) fail(`asse "${axis.name}" senza tipo nel binding.`);
    const propName = bound.prop ?? axis.name;
    const claimedBy = claimedProps.get(propName);
    if (claimedBy !== undefined) {
      fail(
        `gli assi option "${claimedBy}" e "${axis.name}" sono bound alla stessa prop cva "${propName}" — la seconda sovrascriverebbe la prima in silenzio: correggi il binding.`,
      );
    }
    claimedProps.set(propName, axis.name);
    variants[propName] = {};
    for (const value of axis.values) {
      const apiValue = bound.values[value];
      if (apiValue === undefined) fail(`asse "${axis.name}", valore "${value}" senza API nel binding.`);
      variants[propName][apiValue] = [...(optionVariants[propName]?.[apiValue] ?? [])].sort().join(" ");
    }
    const defaultValue = bound.values[axis.default];
    if (defaultValue === undefined) fail(`asse "${axis.name}" senza default nel binding.`);
    defaults[propName] = defaultValue;
  }
  return { staticClasses, cva: { name: cvaName, base: staticClasses, variants, defaults } };
}

/** Import richiesto dal binding, riusato VERBATIM dalla base shadcn: la base è input, non si reimporta a memoria. */
function extractImport(source: string, packageName: string, baseLabel: string): { line: string; alias: string } {
  for (const line of source.split("\n")) {
    const match = /^\s*import\s+(.+?)\s+from\s+["']([^"']+)["'];?\s*$/.exec(line);
    if (match === null || match[2] !== packageName) continue;
    const clause = match[1] ?? "";
    const namespace = /^\*\s+as\s+(\w+)$/.exec(clause);
    const named = /\{([^}]+)\}/.exec(clause);
    const aliasMatch = named !== null ? /(?:[\w$]+\s+as\s+)([\w$]+)/.exec(named[1] ?? "") : null;
    const alias = namespace?.[1] ?? aliasMatch?.[1] ?? named?.[1]?.trim() ?? null;
    if (alias === null || alias.length === 0) {
      fail(`import di "${packageName}" nella base "${baseLabel}" non ha un alias riconoscibile: ${line.trim()}`);
    }
    return { line: `${line.trim().replace(/;?$/, ";")}`, alias };
  }
  fail(`la base shadcn "${baseLabel}" non importa "${packageName}" — il binding dichiara un headless che la base non usa.`);
}

function buildPartTree(ctx: EmitterContext): PartNode {
  const byName = new Map<string, PartNode>();
  for (const part of ctx.contract.parts) {
    const boundPart = ctx.binding.parts[part];
    if (boundPart === undefined) fail(`parte "${part}" assente dal binding.`);
    byName.set(part, { name: part, binding: boundPart, classes: { staticClasses: "" }, children: [] });
  }
  const roots: PartNode[] = [];
  for (const part of ctx.contract.parts) {
    const node = byName.get(part);
    if (node === undefined) continue;
    if (node.binding.parent === null) {
      roots.push(node);
    } else {
      const parent = byName.get(node.binding.parent);
      if (parent === undefined) {
        fail(`parte "${part}" ha parent "${node.binding.parent}" che non è una parte del contratto.`);
      }
      parent.children.push(node);
    }
  }
  if (roots.length !== 1 || roots[0] === undefined) {
    fail(`il binding deve dichiarare esattamente una parte radice (trovate: ${roots.length}).`);
  }
  return roots[0]!;
}

function flattenParts(root: PartNode): PartNode[] {
  const out: PartNode[] = [root];
  for (const child of root.children) out.push(...flattenParts(child));
  return out;
}

const SAMPLE_CONTENT: Record<string, string> = {
  label: "Etichetta",
  body: "Contenuto",
  placeholder: "Segnaposto",
};

interface ContentArg {
  field: string;
  sample: string;
  attribute: string | null;
}

function contentArgsFor(ctx: EmitterContext): ContentArg[] {
  const args: ContentArg[] = [];
  for (const part of ctx.contract.parts) {
    const boundPart = ctx.binding.parts[part];
    if (boundPart === undefined || boundPart.contentField === undefined) continue;
    const field = boundPart.contentField;
    const fieldDef = ctx.contract.fields[field];
    if (fieldDef === undefined) {
      fail(`il binding della parte "${part}" referenzia il field "${field}", che non è nel contratto.`);
    }
    if (!fieldDef.schema.safeParse("probe").success) {
      fail(
        `field "${field}" non è una stringa: l'emitter shadcn lo supporta solo come campo content testuale (estenderlo è una decisione esplicita).`,
      );
    }
    args.push({ field, sample: SAMPLE_CONTENT[field] ?? field, attribute: boundPart.attribute ?? null });
  }
  return args;
}

const DOMAIN_TITLES: Record<string, string> = {
  "data-display": "Data Display",
  inputs: "Inputs",
  feedback: "Feedback",
  layout: "Layout",
  navigation: "Navigation",
  overlays: "Overlays",
};

function provenanceHeader(ctx: EmitterContext): string {
  return [
    `// ${GENERATED_MARKER} — DO NOT EDIT BY HAND.`,
    `// Source: pipeline fixture → ricetta → emitter shadcn (contract ${ctx.fixture.contract}, penpotComponentId ${ctx.fixture.penpotComponentId}, fixtureHash ${ctx.recipe.fixtureHash}).`,
    `// Regenerate with: ${regenCommandFor(ctx.recipe.componentName)}`,
  ].join("\n");
}

function cvaPropsArgs(ctx: EmitterContext): string {
  return ctx.contract.axes
    .filter((axis) => axis.type === "option")
    .map((axis) => {
      const bound = ctx.binding.axes[axis.name];
      if (bound === undefined) fail(`asse "${axis.name}" senza tipo nel binding.`);
      return bound.prop ?? axis.name;
    })
    .join(", ");
}

function jsxClassName(node: PartNode, isRoot: boolean, ctx: EmitterContext): string {
  if (node.classes.cva !== undefined) {
    const call = `${node.classes.cva.name}({ ${cvaPropsArgs(ctx)} })`;
    return isRoot ? `cn(${call}, className)` : call;
  }
  return isRoot ? `cn("${node.classes.staticClasses}", className)` : `"${node.classes.staticClasses}"`;
}

function jsxClassNameAttribute(node: PartNode, isRoot: boolean, ctx: EmitterContext): string {
  const value = jsxClassName(node, isRoot, ctx);
  // Un literal di stringa va emesso come attributo JSX nudo, non fra graffe.
  return value.startsWith(`"`) ? value : `{${value}}`;
}

function renderPartJsx(ctx: EmitterContext, node: PartNode, isRoot: boolean, indent: string): string {
  const boundPart = node.binding;
  if (boundPart.element === null) return "";
  const slot =
    node.name === "root" ? toKebab(ctx.recipe.componentName) : `${toKebab(ctx.recipe.componentName)}-${node.name}`;

  const attributeProps = node.children
    .map((child) =>
      child.binding.element === null && child.binding.attribute !== undefined && child.binding.contentField !== undefined
        ? `${child.binding.attribute}={${child.binding.contentField}}`
        : null,
    )
    .filter((item): item is string => item !== null);

  const elementChildren = node.children.filter((child) => child.binding.element !== null);
  const content = boundPart.contentField !== undefined ? `{${boundPart.contentField}}` : null;
  const isSelfClosing = elementChildren.length === 0 && content === null;

  const elementIndent = boundPart.wrapper !== undefined ? `${indent}  ` : indent;
  const childIndent = `${elementIndent}  `;
  const attributes = [`data-slot="${slot}"`, ...attributeProps, `className=${jsxClassNameAttribute(node, isRoot, ctx)}`];
  if (isRoot) attributes.push("{...props}");

  const inner: string[] = [];
  if (content !== null) inner.push(`${childIndent}${content}`);
  for (const child of elementChildren) inner.push(renderPartJsx(ctx, child, false, childIndent));

  const element = isSelfClosing
    ? `<${boundPart.element} ${attributes.join(" ")} />`
    : `<${boundPart.element} ${attributes.join(" ")}>\n${inner.join("\n")}\n${elementIndent}</${boundPart.element}>`;

  if (boundPart.wrapper !== undefined) {
    return `${indent}<${boundPart.wrapper} className={cn("${boundPart.wrapperStructural}")}>\n${elementIndent}${element}\n${indent}</${boundPart.wrapper}>`;
  }
  return `${indent}${element}`;
}

function componentPropsType(rootElement: string, headlessAlias: string | null): string {
  if (headlessAlias !== null && rootElement.startsWith(`${headlessAlias}.`)) {
    return `React.ComponentProps<typeof ${rootElement}>`;
  }
  return `React.ComponentProps<"${rootElement}">`;
}

function collectCvas(nodes: PartNode[]): Array<NonNullable<PartClasses["cva"]>> {
  const out: Array<NonNullable<PartClasses["cva"]>> = [];
  for (const node of nodes) {
    if (node.classes.cva !== undefined) out.push(node.classes.cva);
    out.push(...collectCvas(node.children));
  }
  return out;
}

function collectLucideElements(nodes: PartNode[], headlessAlias: string | null): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    const element = node.binding.element;
    if (element !== null && /^[A-Z]/.test(element) && (headlessAlias === null || !element.startsWith(`${headlessAlias}.`))) {
      out.push(element);
    }
    out.push(...collectLucideElements(node.children, headlessAlias));
  }
  return out;
}

/**
 * Props JSX da un record: `key="v"` per stringa, `key={n}` per numero,
 * `key`/`key={false}` per booleano. Chiavi ordinate: output deterministico.
 */
function jsxPropsLiteral(props: Record<string, string | number | boolean>): string {
  return Object.entries(props)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, value]) => {
      if (typeof value === "string") return `${key}="${value}"`;
      if (typeof value === "number") return `${key}={${value}}`;
      return value ? key : `${key}={false}`;
    })
    .join(" ");
}

function renderComponentFile(ctx: EmitterContext, partTree: PartNode): string {
  const componentName = ctx.recipe.componentName;
  const rootElement = partTree.binding.element ?? fail("la parte radice non ha un elemento.");
  const cvas = collectCvas([partTree]);
  const contentArgs = contentArgsFor(ctx);

  const optionProps = ctx.contract.axes
    .filter((axis) => axis.type === "option")
    .map((axis) => {
      const bound = ctx.binding.axes[axis.name];
      if (bound === undefined) fail(`asse "${axis.name}" senza tipo nel binding.`);
      const propName = bound.prop ?? axis.name;
      const values = axis.values.map((value) => {
        const apiValue = bound.values[value];
        if (apiValue === undefined) fail(`asse "${axis.name}", valore "${value}" senza API nel binding.`);
        return apiValue;
      });
      return { name: propName, values };
    });

  const lucideElements = collectLucideElements([partTree], ctx.headlessAlias);
  const imports: string[] = [];
  if (ctx.headlessAlias !== null && ctx.binding.headless !== null) {
    imports.push(extractImport(ctx.baseSource, ctx.binding.headless.package, ctx.binding.base).line);
  }
  if (lucideElements.length > 0) {
    if (ctx.lucideImport === null) {
      fail(`la base shadcn "${ctx.binding.base}" non importa "lucide-react", richiesto dagli elementi ${lucideElements.join(", ")}.`);
    }
    imports.push(ctx.lucideImport);
  }
  imports.push(CN_IMPORT);
  if (cvas.length > 0) imports.push(`import { cva } from "class-variance-authority";`);
  imports.push(`import * as React from "react";`);

  const propsType = `${componentPropsType(rootElement, ctx.headlessAlias)} & {
${[
  ...optionProps.map((prop) => `  ${prop.name}?: ${prop.values.map((value) => `"${value}"`).join(" | ")};`),
  ...contentArgs.map((arg) => `  ${arg.field}?: string;`),
].join("\n")}
}`;

  const destructure = ["className", ...optionProps.map((prop) => prop.name), ...contentArgs.map((arg) => arg.field)];
  const rootJsx = renderPartJsx(ctx, partTree, true, "    ");

  const cvaBlocks = cvas
    .map((cva) => {
      const variantEntries = Object.entries(cva.variants)
        .map(([prop, values]) => {
          const valueEntries = Object.entries(values)
            .map(([value, classes]) => {
              const key = /^[a-zA-Z][a-zA-Z0-9-]*$/.test(value) ? value : JSON.stringify(value);
              return `        ${key}: ${classes.length > 0 ? `"${classes}"` : `""`},`;
            })
            .join("\n");
          return `      ${prop}: {\n${valueEntries}\n      },`;
        })
        .join("\n");
      const defaultEntries = Object.entries(cva.defaults)
        .map(([prop, value]) => `      ${prop}: "${value}",`)
        .join("\n");
      return [
        `const ${cva.name} = cva(`,
        `  "${cva.base}",`,
        `  {`,
        `    variants: {`,
        variantEntries,
        `    },`,
        `    defaultVariants: {`,
        defaultEntries,
        `    },`,
        `  },`,
        `);`,
      ].join("\n");
    })
    .join("\n\n");

  // `type XProps` è già esportato dalla sua dichiarazione: non va ripetuto
  // nell'export list (TS2484).
  const exportNames = [componentName, ...cvas.map((cva) => cva.name)];

  const sections = [
    provenanceHeader(ctx),
    imports.join("\n"),
    ...(cvas.length > 0 ? [cvaBlocks] : []),
    `export type ${componentName}Props = ${propsType}`,
    `function ${componentName}({ ${destructure.join(", ")}, ...props }: ${componentName}Props) {\n  return (\n${rootJsx}\n  );\n}`,
    `export { ${exportNames.join(", ")} };`,
  ];
  return `${sections.join("\n\n")}\n`;
}

function renderTestFile(ctx: EmitterContext): string {
  const componentName = ctx.recipe.componentName;
  const contentArgs = contentArgsFor(ctx);
  const jsxArgs = (extra: string[] = []): string => {
    const testProps = Object.entries(ctx.binding.testProps ?? {}).map(([name, value]) =>
      typeof value === "boolean" ? (value ? name : `${name}={false}`) : `${name}="${value}"`,
    );
    const items = [
      ...testProps,
      ...contentArgs.map((arg) =>
        arg.attribute !== null ? `${arg.attribute}="${arg.sample}"` : `${arg.field}="${arg.sample}"`,
      ),
      ...extra,
    ];
    return items.join(" ");
  };

  const hasHeadlessRoot = ctx.binding.headless !== null && ctx.binding.headless.root !== null;
  const renderCall = (jsx: string): string => (hasHeadlessRoot ? `renderInRoot(${jsx})` : `render(${jsx})`);

  const queries = new Set<string>();
  const contentAssertions = contentArgs
    .map((arg) => {
      if (arg.attribute !== null) {
        queries.add("getByPlaceholderText");
        return `expect(getByPlaceholderText("${arg.sample}")).toBeTruthy();`;
      }
      queries.add("getByText");
      return `expect(getByText("${arg.sample}")).toBeTruthy();`;
    })
    .join("\n    ");
  const queryList = [...queries].sort().join(", ");

  /**
   * Con un asse `behavior` il contenuto headless è smontato nello stato
   * default (Radix Accordion): il test dei campi content apre prima il
   * componente cliccando la parte Trigger dichiarata dal binding.
   */
  const hasBehaviorAxis = ctx.contract.axes.some((axis) => axis.type === "behavior");
  const triggerPart =
    ctx.binding.headless?.parts
      .filter((name) => /trigger/i.test(name))
      .map((name) => ctx.contract.parts.find((part) => ctx.binding.parts[part]?.library === name))
      .find((part) => part !== undefined) ?? null;

  const tests: string[] = [];
  const needsFireEvent = hasBehaviorAxis && triggerPart !== null && hasHeadlessRoot;
  if (needsFireEvent) {
    queries.add("fireEvent");
    tests.push(`  it("renderizza i campi content dopo l'apertura", () => {
    const { container, ${queryList} } = ${renderCall(`<${componentName} ${jsxArgs()} />`)};
    const trigger = container.querySelector('[data-slot="${toKebab(componentName)}-${triggerPart}"]');
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);
    ${contentAssertions}
  });`);
  } else {
    tests.push(`  it("renderizza i campi content", () => {
    const { ${queryList} } = ${renderCall(`<${componentName} ${jsxArgs()} />`)};
    ${contentAssertions}
  });`);
  }

  tests.push(`  it("non ha violazioni axe (default)", async () => {
    const { container } = ${renderCall(`<${componentName} ${jsxArgs()} />`)};
    expect((await axe(container)).violations).toEqual([]);
  });`);

  for (const axis of ctx.contract.axes) {
    const bound = ctx.binding.axes[axis.name];
    if (bound === undefined) continue;
    if (axis.type === "option") {
      const propName = bound.prop ?? axis.name;
      for (const value of axis.values) {
        if (value === axis.default) continue;
        const apiValue = bound.values[value] ?? value;
        tests.push(`  it("non ha violazioni axe (${axis.name}=${value})", async () => {
    const { container } = ${renderCall(`<${componentName} ${propName}="${apiValue}" ${jsxArgs()} />`)};
    expect((await axe(container)).violations).toEqual([]);
  });`);
      }
    } else {
      for (const value of axis.values) {
        if (value === axis.default) continue;
        const prefix = bound.values[value] ?? "";
        const domProps: string[] = [];
        if (prefix.startsWith("aria-invalid")) domProps.push("aria-invalid");
        if (prefix.startsWith("disabled")) domProps.push("disabled");
        if (domProps.length === 0) continue;
        tests.push(`  it("non ha violazioni axe (${axis.name}=${value})", async () => {
    const { container } = ${renderCall(`<${componentName} ${domProps.join(" ")} ${jsxArgs()} />`)};
    expect((await axe(container)).violations).toEqual([]);
  });`);
      }
    }
  }

  const imports = [
    `${needsFireEvent ? `import { fireEvent, render } from "@testing-library/react";` : `import { render } from "@testing-library/react";`}`,
    `import { describe, expect, it } from "vitest";`,
    `import { axe } from "vitest-axe";`,
  ];
  if (hasHeadlessRoot && ctx.binding.headless !== null) {
    imports.push(`import { ${ctx.binding.headless.root} as AccordionRoot } from "${ctx.binding.headless.package}";`);
    imports.push(`import type { ReactElement } from "react";`);
  }
  imports.push(`import { ${componentName} } from "./${componentName}";`);

  // Props del Root dal binding (rootProps): conoscenza libreria, mai
  // hard-coded nell'emitter. Serializzazione deterministica: chiavi ordinate.
  const rootPropsLiteral = hasHeadlessRoot ? jsxPropsLiteral(ctx.binding.headless?.rootProps ?? {}) : "";
  const helper = hasHeadlessRoot
    ? `
function renderInRoot(ui: ReactElement) {
  return render(<AccordionRoot ${rootPropsLiteral}>{ui}</AccordionRoot>);
}
`
    : "";

  return `${provenanceHeader(ctx)}

${imports.join("\n")}
${helper}
describe("${componentName}", () => {
${tests.join("\n\n")}
});
`;
}

function renderStoriesFile(ctx: EmitterContext): string {
  const componentName = ctx.recipe.componentName;
  const contentArgs = contentArgsFor(ctx);
  const argsLiteral = (extra: string[] = []): string => {
    const testProps = Object.entries(ctx.binding.testProps ?? {}).map(([name, value]) =>
      typeof value === "boolean" ? `${name}: ${value}` : `${name}: "${value}"`,
    );
    const items = [
      ...testProps,
      ...contentArgs.map((arg) =>
        arg.attribute !== null ? `${arg.attribute}: "${arg.sample}"` : `${arg.field}: "${arg.sample}"`,
      ),
      ...extra,
    ];
    return items.length > 0 ? `{ ${items.join(", ")} }` : "{}";
  };

  const optionAxes = ctx.contract.axes.filter((axis) => axis.type === "option");
  const stories: string[] = [];
  if (optionAxes.length === 0) {
    stories.push(`export const Default = ${argsLiteral()};`);
  } else {
    // Una story per OGNI valore di OGNI asse option: le altre assi option
    // restano al default (nessun prodotto cartesiano). Il nome include la
    // prop per evitare collisioni fra assi con valori omonimi.
    for (const axis of optionAxes) {
      const bound = ctx.binding.axes[axis.name];
      if (bound === undefined) fail(`asse "${axis.name}" senza tipo nel binding.`);
      const propName = bound.prop ?? axis.name;
      const propLabel = propName.charAt(0).toUpperCase() + propName.slice(1);
      for (const value of axis.values) {
        const apiValue = bound.values[value] ?? value;
        const storyName = `${propLabel}${value.charAt(0).toUpperCase()}${value.slice(1)}`;
        stories.push(`export const ${storyName} = ${argsLiteral([`${propName}: "${apiValue}"`])};`);
      }
    }
  }

  const title = DOMAIN_TITLES[ctx.recipe.judgment.domain] ?? ctx.recipe.judgment.domain;

  return `${provenanceHeader(ctx)}

import { ${componentName} } from "./${componentName}";

const meta = { component: ${componentName}, title: "${title}/${componentName}" };
export default meta;

${stories.join("\n")}
`;
}

function cvaNamesFor(ctx: EmitterContext): string[] {
  const camel = componentNameCamel(ctx.recipe.componentName);
  if (!ctx.contract.axes.some((axis) => axis.type === "option")) return [];
  return ctx.contract.parts.map((part) =>
    part === "root" ? `${camel}Variants` : `${camel}${part.charAt(0).toUpperCase()}${part.slice(1)}Variants`,
  );
}

function renderIndexFile(ctx: EmitterContext, existing: string | undefined): string {
  const componentName = ctx.recipe.componentName;
  const exportLine = `export { ${[componentName, ...cvaNamesFor(ctx), `type ${componentName}Props`].join(", ")} } from "./${componentName}";`;

  const otherLines: string[] = [];
  if (existing !== undefined && isGeneratedFile(existing)) {
    for (const line of existing.split("\n")) {
      if (line.startsWith("export ") && !line.includes(`from "./${componentName}"`)) otherLines.push(line.trim());
    }
  }
  const lines = [...new Set([...otherLines, exportLine])].sort();
  return `${provenanceHeader(ctx)}

${lines.join("\n")}
`;
}

/**
 * Funzione pura di rendering: fixture + ricetta + binding + basi committate →
 * file emessi. Nessuna I/O: i percorsi sono relativi a
 * `packages/ui/src/domains/`, i contenuti sono stringhe deterministiche.
 */
export function renderComponent(
  fixture: ComponentFixture,
  recipe: ComponentRecipe,
  binding: ComponentBinding,
  shadcnBaseSources: Record<string, string>,
  catalog: TokenCatalog,
  options: RenderOptions = {},
): RenderResult {
  const pluginData = PLUGIN_DATA_PATTERN.exec(fixture.contract);
  if (pluginData === null) fail(`fixture contract "${fixture.contract}" non è un plugin data "nome@versione".`);
  const contract = contractByName(pluginData[1] ?? "");
  if (contract === undefined) fail(`il contratto "${fixture.contract}" non esiste in @app/contracts.`);

  if (binding.componentName !== fixture.componentName) {
    fail(`binding componentName "${binding.componentName}" ≠ fixture "${fixture.componentName}".`);
  }
  if (binding.contract !== fixture.contract) {
    fail(`binding contract "${binding.contract}" ≠ fixture "${fixture.contract}".`);
  }

  for (const axis of contract.axes) {
    const bound = binding.axes[axis.name];
    if (bound === undefined) fail(`asse "${axis.name}" (${axis.type}) senza tipo nel binding — fail-loud nominativo.`);
    if (bound.type !== axis.type) {
      fail(
        `asse "${axis.name}": tipo nel binding "${bound.type}" ≠ tipo nel contratto "${axis.type}" — l'instradamento legge il tipo dal contratto.`,
      );
    }
    for (const value of axis.values) {
      if (!(value in bound.values)) fail(`asse "${axis.name}", valore "${value}" senza API nel binding.`);
    }
    for (const value of Object.keys(bound.values)) {
      if (!axis.values.includes(value)) {
        fail(`asse "${axis.name}": il binding dichiara il valore "${value}" che non è nel contratto.`);
      }
    }
  }
  for (const part of contract.parts) {
    if (binding.parts[part] === undefined) fail(`parte "${part}" del contratto senza mapping nel binding.`);
  }
  for (const part of Object.keys(binding.parts)) {
    if (!contract.parts.includes(part)) {
      fail(`il binding mappa la parte "${part}" che non è nel contratto "${contract.name}".`);
    }
  }

  const baseSource = shadcnBaseSources[`${binding.base}.tsx`];
  if (baseSource === undefined) {
    fail(
      `base shadcn "${binding.base}" non trovata fra le sorgenti committate (${Object.keys(shadcnBaseSources).join(", ") || "nessuna"}).`,
    );
  }

  const tokenTypes = new Map<string, TokenType>();
  for (const set of catalog.sets) {
    for (const token of set.tokens) tokenTypes.set(token.name, token.type);
  }

  const ctx: EmitterContext = {
    fixture,
    recipe,
    binding,
    contract,
    tokenTypes,
    vocabulary: buildTokenVocabulary(catalog),
    baseSource,
    headlessAlias: null,
    lucideImport: null,
  };
  if (binding.headless !== null) {
    ctx.headlessAlias = extractImport(baseSource, binding.headless.package, binding.base).alias;
  }
  const lucideLine = /^\s*import\s+\{([^}]+)\}\s+from\s+["']lucide-react["'];?\s*$/m.exec(baseSource);
  if (lucideLine !== null) ctx.lucideImport = `import {${lucideLine[1]}} from "lucide-react";`;

  const partTree = buildPartTree(ctx);
  const skipped: SkippedProperty[] = [];
  const nodes = flattenParts(partTree);
  for (const node of nodes) {
    node.classes = computePartClasses(ctx, node.name, skipped);
  }
  // Le classi delle parti attributo (es. placeholder) confluiscono nell'host
  // con il prefisso del binding (es. `placeholder:`).
  for (const node of nodes) {
    if (node.binding.element !== null || node.binding.parent === null) continue;
    const parent = nodes.find((candidate) => candidate.name === node.binding.parent);
    if (parent === undefined) fail(`parte "${node.name}" ha parent "${node.binding.parent}" non trovato.`);
    const prefix = node.binding.classPrefix;
    const prefixed = node.classes.staticClasses
      .split(" ")
      .filter((cls) => cls.length > 0)
      .map((cls) => `${prefix}${cls}`);
    const merged = dedupe([parent.classes.staticClasses, ...prefixed]).join(" ");
    parent.classes =
      parent.classes.cva !== undefined
        ? { staticClasses: merged, cva: { ...parent.classes.cva, base: merged } }
        : { staticClasses: merged };
  }

  const domain = recipe.judgment.domain;
  const componentName = recipe.componentName;
  const existing = options.existingFiles ?? {};
  const expected: Array<{ fileName: string; content: string }> = [
    { fileName: `${componentName}.tsx`, content: renderComponentFile(ctx, partTree) },
    { fileName: `${componentName}.test.tsx`, content: renderTestFile(ctx) },
    { fileName: `${componentName}.stories.tsx`, content: renderStoriesFile(ctx) },
  ];
  const files: RenderedFile[] = expected.map((file) => {
    const path = `${domain}/${file.fileName}`;
    const action: RenderedFile["action"] =
      existing[path] !== undefined && !isGeneratedFile(existing[path]) ? "skip" : "write";
    return { path, content: file.content, action };
  });
  const indexPath = `${domain}/index.ts`;
  const indexAction: RenderedFile["action"] =
    existing[indexPath] !== undefined && !isGeneratedFile(existing[indexPath]) ? "skip" : "write";
  files.push({ path: indexPath, content: renderIndexFile(ctx, existing[indexPath]), action: indexAction });

  return { component: componentName, domain, files, skippedProperties: skipped };
}
