import { contractId } from "@app/contracts";

import { pascalCase } from "../shared/naming";
import { ScriptError } from "./errors";import type { PenpotTokenValue, TokenType } from "../shared/theme-generator";
import type { LibrarySnapshot, SnapshotComponent } from "../library/library-snapshot";
import type { SemanticSeed } from "../library/library-spec";
import type { ExtractionContract } from "./extraction";

/**
 * Piano puro della `library` v2 (Story 2.13, CAP-6): dal contratto di
 * estrazione, mai da giudizio/binding. Nessun I/O, nessuna chiamata MCP:
 * decide COSA scrivere su Penpot; lo scrive `library-writer.ts`, l'esito lo
 * decide l'exit code. `when` governa la presenza (`badge`/`badgeLabel` solo in
 * 4 celle), mai l'assenza come errore.
 *
 * Celle = cartesiano assi page builder (`promo` 3 valori) × assi di rendering
 * (`hover` 2 valori) = 6 board. Layer dal contratto di estrazione (default
 * PascalCase della parte, override `layer` per gli alias `Badge/Label` e
 * `Tag/Label`); token legati su ogni proprietà di stile secondo il registro e
 * il ruolo della parte (`ROLE_PROPERTIES`).
 */

export type PartKind = "board" | "text";

export interface ContainerPartPlan {
  /** Nome della parte nel contratto di estrazione (`badgeLabel`). */
  readonly name: string;
  /** Nome del layer Penpot (`Badge/Label`, default PascalCase). */
  readonly layer: string;
  readonly kind: PartKind;
  /** Parte contenitrice (`null` = figlia diretta della board, solo `root`). */
  readonly parent: string | null;
  /** Contenuto campione per le parti `text` (il designer lo cambia in Penpot). */
  readonly text?: string;
  /** `TokenProperty` → nome token, solo proprietà ammesse al ruolo. */
  readonly tokens: Readonly<Record<string, string>>;
}

export interface ContainerCellPlan {
  readonly variantProps: Readonly<Record<string, string>>;
  readonly parts: readonly ContainerPartPlan[];
}

export type LibraryOperation =
  | { readonly kind: "createSet"; readonly set: string }
  | { readonly kind: "createToken"; readonly set: string; readonly name: string; readonly type: TokenType; readonly value: PenpotTokenValue }
  | {
      readonly kind: "createContainer";
      readonly contract: string;
      readonly containerName: string;
      readonly pluginData: string;
      readonly axes: ReadonlyArray<{ readonly name: string; readonly values: readonly string[] }>;
      readonly cells: readonly ContainerCellPlan[];
    };

export interface Difference {
  readonly subject: string;
  readonly expected: string;
  readonly found: string;
}

export interface LibraryPlanResult {
  /** Solo in bootstrap su library non vuota: motivo che nomina cosa ha trovato. */
  readonly refused?: string;
  readonly operations: readonly LibraryOperation[];
  readonly differences: readonly Difference[];
}

/**
 * Token legati per parte della ProductCard: solo token del seed, solo
 * proprietà ammesse al ruolo (`ROLE_PROPERTIES`). Stessa mano dei design v1
 * (badge): `surface` con fill/radius/padding/gap, `text` con
 * fill/tipografia, `image` solo raggio (nessun `fill`: il contenuto arriva dal
 * field). Nessuna classe Tailwind, nessun token inventato.
 */
const PRODUCT_CARD_TOKENS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  root: {
    fill: "color.card",
    strokeColor: "color.border",
    strokeWidth: "border-width.default",
    borderRadiusTopLeft: "radius.md",
    borderRadiusTopRight: "radius.md",
    borderRadiusBottomRight: "radius.md",
    borderRadiusBottomLeft: "radius.md",
    paddingTop: "spacing.4",
    paddingRight: "spacing.4",
    paddingBottom: "spacing.4",
    paddingLeft: "spacing.4",
  },
  media: {
    fill: "color.muted",
    borderRadiusTopLeft: "radius.md",
    borderRadiusTopRight: "radius.md",
    borderRadiusBottomRight: "radius.md",
    borderRadiusBottomLeft: "radius.md",
  },
  image: {
    borderRadiusTopLeft: "radius.md",
    borderRadiusTopRight: "radius.md",
    borderRadiusBottomRight: "radius.md",
    borderRadiusBottomLeft: "radius.md",
  },
  badge: {
    fill: "color.primary",
    borderRadiusTopLeft: "radius.full",
    borderRadiusTopRight: "radius.full",
    borderRadiusBottomRight: "radius.full",
    borderRadiusBottomLeft: "radius.full",
    paddingTop: "spacing.1",
    paddingBottom: "spacing.1",
    paddingLeft: "spacing.2",
    paddingRight: "spacing.2",
  },
  badgeLabel: {
    fill: "color.primary-foreground",
    fontSize: "text.xs",
    fontWeight: "font-weight.medium",
    letterSpacing: "tracking.none",
  },
  body: {
    fill: "color.card",
    paddingTop: "spacing.4",
    paddingRight: "spacing.4",
    paddingBottom: "spacing.4",
    paddingLeft: "spacing.4",
    rowGap: "spacing.3",
  },
  price: {
    fill: "color.foreground",
    fontSize: "text.lg",
    fontWeight: "font-weight.bold",
    letterSpacing: "tracking.none",
  },
  description: {
    fill: "color.muted-foreground",
    fontSize: "text.sm",
    fontWeight: "font-weight.regular",
    letterSpacing: "tracking.none",
  },
  tags: {
    rowGap: "spacing.2",
    columnGap: "spacing.2",
  },
  tag: {
    fill: "color.secondary",
    borderRadiusTopLeft: "radius.full",
    borderRadiusTopRight: "radius.full",
    borderRadiusBottomRight: "radius.full",
    borderRadiusBottomLeft: "radius.full",
    paddingTop: "spacing.1",
    paddingBottom: "spacing.1",
    paddingLeft: "spacing.2",
    paddingRight: "spacing.2",
  },
  tagLabel: {
    fill: "color.secondary-foreground",
    fontSize: "text.xs",
    fontWeight: "font-weight.medium",
    letterSpacing: "tracking.none",
  },
};

/** Contenuto campione per le parti `text` (il designer lo cambia in Penpot). */
const SAMPLE_TEXT: Readonly<Record<string, string>> = {
  badgeLabel: "Offerta",
  price: "19,99 €",
  description: "Descrizione prodotto",
  tagLabel: "Tag",
};

const TEXT_ROLES: ReadonlySet<string> = new Set(["text"]);

/** Assi attesi: page builder prima (ordine contratto), poi rendering (ordine definizione). */
export function expectedAxes(extraction: ExtractionContract): Array<{ name: string; values: readonly string[] }> {
  const pageBuilder = extraction.contract.axes.map((axis) => ({ name: axis.name, values: [...axis.values] }));
  const rendering = Object.entries(extraction.axes).map(([name, axis]) => ({ name, values: [...axis.values] }));
  return [...pageBuilder, ...rendering];
}

/** Prodotto cartesiano dei valori, in ordine assi: una riga per cella. */
export function cartesianValues(axes: ReadonlyArray<{ values: readonly string[] }>): string[][] {
  let out: string[][] = [[]];
  for (const axis of axes) {
    out = out.flatMap((prefix) => axis.values.map((value) => [...prefix, value]));
  }
  return out;
}

/** Chiave cella `promo=none|hover=off`, assi in ordine atteso. */
export function cellKey(variantProps: Readonly<Record<string, string>>, axes: ReadonlyArray<{ name: string }>): string {
  return axes.map((axis) => `${axis.name}=${variantProps[axis.name]}`).join("|");
}

/** `true` se la parte esiste nella cella: `when` governa la presenza, ereditata dagli antenati. */
export function partInCell(extraction: ExtractionContract, partName: string, variantProps: Readonly<Record<string, string>>): boolean {
  const part = extraction.parts[partName];
  if (part === undefined) return false;
  for (const [axis, values] of Object.entries(part.when ?? {})) {
    const actual = variantProps[axis];
    if (actual === undefined || !(values as readonly string[]).includes(actual)) return false;
  }
  // Un figlio non esiste senza il genitore: `badgeLabel` (senza `when`,
  // figlia di `badge` con `when`) è solo nelle 4 celle del badge.
  if (part.parent !== undefined && !partInCell(extraction, part.parent, variantProps)) return false;
  return true;
}

function kindOf(role: string): PartKind {
  return TEXT_ROLES.has(role) ? "text" : "board";
}

/** Parti attese nella cella, nell'ordine del contratto di estrazione. */
export function partsForCell(extraction: ExtractionContract, variantProps: Readonly<Record<string, string>>): ContainerPartPlan[] {
  const out: ContainerPartPlan[] = [];
  const seen = new Set<string>();
  for (const [name, part] of Object.entries(extraction.parts)) {
    if (!partInCell(extraction, name, variantProps)) continue;
    const parent = (part.parent ?? null) as string | null;
    if (parent !== null && parent !== "root" && !seen.has(parent)) {
      throw new ScriptError({
        kind: "contract",
        component: extraction.penpot.container,
        part: name,
        detail: `parte "${name}" prima del genitore "${parent}" nel contratto di estrazione: il writer assume genitori primi — riordina le parti.`,
      });
    }
    const tokens = (PRODUCT_CARD_TOKENS as Record<string, Record<string, string>>)[name];
    if (tokens === undefined) {
      throw new ScriptError({
        kind: "contract",
        component: extraction.penpot.container,
        part: name,
        detail: `parte "${name}" senza token nel piano: aggiungi la voce in PRODUCT_CARD_TOKENS (o il registro) invece di zeri silenziosi.`,
      });
    }
    out.push({
      name,
      layer: part.layer,
      kind: kindOf(part.role),
      parent,
      ...(part.role === "text" && SAMPLE_TEXT[name] !== undefined ? { text: SAMPLE_TEXT[name] } : {}),
      tokens: { ...tokens },
    });
    seen.add(name);
  }
  return out;
}

/** Le 6 celle attese (cartesiano completo, nessuna cella inventata né mancante). */
export function expectedCells(extraction: ExtractionContract): ContainerCellPlan[] {
  const axes = expectedAxes(extraction);
  return cartesianValues(axes).map((values) => {
    const variantProps: Record<string, string> = {};
    axes.forEach((axis, index) => {
      variantProps[axis.name] = values[index]!;
    });
    return { variantProps, parts: partsForCell(extraction, variantProps) };
  });
}

function containerOperation(extraction: ExtractionContract): LibraryOperation {
  return {
    kind: "createContainer",
    contract: extraction.contract.name,
    containerName: extraction.penpot.container,
    pluginData: extraction.pluginData,
    axes: expectedAxes(extraction),
    cells: expectedCells(extraction),
  };
}

/** Container che dichiarano il contratto (plugin data o nome come controllo incrociato). */
export function findContainers(snapshot: LibrarySnapshot, extraction: ExtractionContract): SnapshotComponent[] {
  return snapshot.components.filter(
    (component) =>
      component.pluginData === extraction.pluginData ||
      component.pluginData?.split("@")[0] === extraction.contract.name ||
      component.name === extraction.penpot.container,
  );
}

/** Layer attesi nella cella (tutte le parti presenti tranne `root`, che è la board). */
function expectedLayerNames(extraction: ExtractionContract, variantProps: Readonly<Record<string, string>>): Set<string> {
  const names = new Set<string>();
  for (const [name, part] of Object.entries(extraction.parts)) {
    if (name === "root") continue;
    if (!partInCell(extraction, name, variantProps)) continue;
    names.add(part.layer);
  }
  return names;
}

function tokensOf(cell: SnapshotComponent["cells"][number], layerName: string): Array<Readonly<Record<string, string>>> {
  const out: Array<Readonly<Record<string, string>>> = [];
  const visit = (layer: SnapshotComponent["cells"][number]["root"]): void => {
    if (layer.name === layerName) out.push(layer.tokens);
    for (const child of layer.children) visit(child);
  };
  for (const child of cell.root.children) visit(child);
  return out;
}

/** Uguaglianza token (condivisa con propose-diff: un'unica definizione). */
export function sameTokens(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Differenze fra il container esistente e l'atteso: nome, plugin data, assi,
 * valori, celle e layer/token per cella. Mai un'operazione: l'additiva
 * segnala, non corregge.
 */
export function diffContainer(extraction: ExtractionContract, component: SnapshotComponent): Difference[] {
  const differences: Difference[] = [];
  const containerName = extraction.penpot.container;
  const axes = expectedAxes(extraction);
  const expectedNames = axes.map((axis) => axis.name);

  if (component.name !== containerName) {
    differences.push({
      subject: `container ${containerName}`,
      expected: `nome "${containerName}"`,
      found: `nome "${component.name}"`,
    });
  }
  if (component.pluginData !== extraction.pluginData) {
    differences.push({
      subject: `container ${containerName}`,
      expected: `plugin data pagebuilder/contract = "${extraction.pluginData}"`,
      found: component.pluginData === null ? "plugin data assente" : `plugin data = "${component.pluginData}"`,
    });
  }
  if (component.axes.length !== expectedNames.length || component.axes.some((axis, index) => axis !== expectedNames[index])) {
    differences.push({
      subject: `container ${containerName}`,
      expected: `assi [${expectedNames.join(", ")}]`,
      found: `assi [${component.axes.join(", ")}]`,
    });
  }
  for (const axis of axes) {
    const found = component.axesValues[axis.name];
    if (found === undefined) {
      differences.push({
        subject: `container ${containerName}, asse ${axis.name}`,
        expected: `valori [${axis.values.join(", ")}]`,
        found: "assente",
      });
      continue;
    }
    const missing = axis.values.filter((value) => !found.includes(value));
    const extra = found.filter((value) => !axis.values.includes(value));
    if (missing.length > 0 || extra.length > 0) {
      differences.push({
        subject: `container ${containerName}, asse ${axis.name}`,
        expected: `valori [${axis.values.join(", ")}]`,
        found: `valori [${found.join(", ")}]`,
      });
    }
  }

  // Celle: chiave `promo=..|hover=..` in ordine atteso. Una `variantProps`
  // nulla (istanza main "Default") non è una cella verificabile (ma un suo
  // `variantError` si segnala comunque).
  const expectedKeys = new Set(expectedCells(extraction).map((cell) => cellKey(cell.variantProps, axes)));
  const actualByKey = new Map<string, SnapshotComponent["cells"][number]>();
  const actualKeyCounts = new Map<string, number>();
  component.cells.forEach((cell, index) => {
    if (cell.variantError !== null) {
      const label = cell.variantProps === null ? `cella #${index}` : `cella ${cellKey(cell.variantProps, axes)}`;
      differences.push({
        subject: `container ${containerName}, ${label}`,
        expected: "nessun errore di variante",
        found: `variantError: "${cell.variantError}"`,
      });
    }
    if (cell.variantProps === null) return;
    const dupKey = cellKey(cell.variantProps, axes.map((axis) => ({ name: axis.name })));
    actualKeyCounts.set(dupKey, (actualKeyCounts.get(dupKey) ?? 0) + 1);
    for (const extra of Object.keys(cell.variantProps)
      .filter((name) => !expectedNames.includes(name))
      .sort()) {
      differences.push({
        subject: `container ${containerName}, cella ${cellKey(cell.variantProps, axes)}`,
        expected: `solo assi [${expectedNames.join(", ")}]`,
        found: `prop d'asse extra "${extra}"="${cell.variantProps[extra]}"`,
      });
    }
    actualByKey.set(cellKey(cell.variantProps, axes.map((axis) => ({ name: axis.name }))), cell);
  });
  for (const [key, count] of [...actualKeyCounts.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (count > 1) {
      differences.push({
        subject: `container ${containerName}, cella ${key}`,
        expected: "una sola cella per variantProps",
        found: `${count} celle duplicate`,
      });
    }
  }
  const actualKeys = new Set(actualByKey.keys());
  for (const key of [...expectedKeys].filter((candidate) => !actualKeys.has(candidate)).sort()) {
    differences.push({ subject: `container ${containerName}, cella ${key}`, expected: "cella presente", found: "assente" });
  }
  for (const key of [...actualKeys].filter((candidate) => !expectedKeys.has(candidate)).sort()) {
    differences.push({ subject: `container ${containerName}, cella ${key}`, expected: "cella del cartesiano atteso", found: "cella in più" });
  }

  // Layer e token per le celle in comune. `when` governa la presenza: un
  // `badge` assente in `promo=none` è atteso, mai una differenza.
  const byVariant = new Map(expectedCells(extraction).map((cell) => [cellKey(cell.variantProps, axes), cell]));
  type SeenLayer = {
    readonly name: string;
    readonly tokens: Readonly<Record<string, string>>;
    readonly style: unknown;
    /** Nome del layer genitore; `null` = figlio diretto della board. */
    readonly parentLayer: string | null;
  };
  const collectSeen = (actual: SnapshotComponent["cells"][number]): SeenLayer[] => {
    const seen: SeenLayer[] = [];
    const visit = (node: SnapshotComponent["cells"][number]["root"], parentLayer: string | null): void => {
      seen.push({ name: node.name, tokens: node.tokens, style: node.style, parentLayer });
      for (const child of node.children) visit(child, node.name);
    };
    for (const child of actual.root.children) visit(child, null);
    return seen;
  };
  for (const [key, actual] of [...actualByKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const expected = byVariant.get(key);
    if (expected === undefined) continue;
    const expectedLayers = new Set([...expectedLayerNames(extraction, expected.variantProps)].sort());
    const seen = collectSeen(actual);
    const actualLayers = new Set(seen.map((layer) => layer.name));
    const counts = new Map<string, number>();
    for (const layer of seen) counts.set(layer.name, (counts.get(layer.name) ?? 0) + 1);
    for (const [layer, count] of [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (count > 1) {
        differences.push({
          subject: `container ${containerName}, cella ${key}, layer "${layer}"`,
          expected: `un solo layer "${layer}"`,
          found: `${count} layer duplicati`,
        });
      }
    }
    for (const layer of [...expectedLayers].filter((candidate) => !actualLayers.has(candidate))) {
      differences.push({
        subject: `container ${containerName}, cella ${key}, layer "${layer}"`,
        expected: "layer presente",
        found: "assente",
      });
    }
    for (const layer of [...actualLayers].filter((candidate) => !expectedLayers.has(candidate))) {
      differences.push({
        subject: `container ${containerName}, cella ${key}, layer "${layer}"`,
        expected: "layer del contratto di estrazione",
        found: "layer in più",
      });
    }
    // Genitore reale contro `parent` del contratto (nomi di parte, non di layer).
    const partOfExpectedLayer = new Map<string, string>();
    for (const part of expected.parts) {
      if (part.name !== "root") partOfExpectedLayer.set(part.layer, part.name);
    }
    for (const occurrence of seen) {
      const part = partOfExpectedLayer.get(occurrence.name);
      if (part === undefined) continue;
      const expectedParent = expected.parts.find((candidate) => candidate.name === part)!.parent;
      const expectedParentLayer = expectedParent === "root" || expectedParent === null ? null : extraction.parts[expectedParent]!.layer;
      if (occurrence.parentLayer !== expectedParentLayer) {
        differences.push({
          subject: `container ${containerName}, cella ${key}, parte "${part}" (layer "${occurrence.name}")`,
          expected: expectedParentLayer === null ? `genitore "root" (la board)` : `genitore "${expectedParent}" (layer "${expectedParentLayer}")`,
          found: occurrence.parentLayer === null ? `genitore "root" (la board "${actual.root.name}")` : `genitore (layer "${occurrence.parentLayer}")`,
        });
      }
    }
    // Token della `root` (la board) e delle altre parti.
    const expectedRoot = expected.parts.find((part) => part.name === "root")!;
    if (!sameTokens(expectedRoot.tokens, actual.root.tokens)) {
      differences.push({
        subject: `container ${containerName}, cella ${key}, parte "root"`,
        expected: `token ${JSON.stringify(expectedRoot.tokens)}`,
        found: `token ${JSON.stringify(actual.root.tokens)}`,
      });
    }
    for (const part of expected.parts) {
      if (part.name === "root") continue;
      const actualTokens = tokensOf(actual, part.layer);
      if (actualTokens.length === 0) continue; // già segnalato come layer assente
      const matches = actualTokens.some((tokens) => sameTokens(tokens, part.tokens));
      if (!matches) {
        differences.push({
          subject: `container ${containerName}, cella ${key}, parte "${part.name}"`,
          expected: `token ${JSON.stringify(part.tokens)}`,
          found: `token ${JSON.stringify(actualTokens[0])}`,
        });
      }
    }
    // Stili valorizzati senza binding: ogni proprietà di `style` vuole un
    // binding in `shape.tokens` (come la regola 7 della v1).
    const styleHolders: Array<{ label: string; tokens: Readonly<Record<string, string>>; style: unknown }> = [
      { label: `layer "${actual.root.name}" (parte "root")`, tokens: actual.root.tokens, style: actual.root.style },
      ...seen.map((layer) => ({ label: `layer "${layer.name}"`, tokens: layer.tokens, style: layer.style })),
    ];
    for (const holder of styleHolders) {
      if (holder.style === null || typeof holder.style !== "object" || Array.isArray(holder.style)) {
        differences.push({
          subject: `container ${containerName}, cella ${key}, ${holder.label}`,
          expected: "stile leggibile nello snapshot",
          found: "style non disponibile",
        });
        continue;
      }
      for (const property of Object.keys(holder.style as Record<string, unknown>).sort()) {
        if (holder.tokens[property] === undefined) {
          differences.push({
            subject: `container ${containerName}, cella ${key}, ${holder.label}`,
            expected: `binding per "${property}"`,
            found: "stile valorizzato senza binding",
          });
        }
      }
    }
  }
  return differences;
}

/**
 * Piano `add`: crea il container solo se assente; se presente, nessuna
 * operazione e solo differenze segnalate (idempotente).
 */
export function planAdd(extraction: ExtractionContract, snapshot: LibrarySnapshot): LibraryPlanResult {
  const containers = findContainers(snapshot, extraction);
  if (containers.length === 0) {
    return { operations: [containerOperation(extraction)], differences: [] };
  }
  const differences = containers.flatMap((component) => diffContainer(extraction, component));
  if (containers.length > 1) {
    differences.unshift({
      subject: `container ${extraction.penpot.container}`,
      expected: "un solo container che dichiara il contratto",
      found: `${containers.length} container (${containers.map((component) => `"${component.name}"`).join(", ")})`,
    });
  }
  return { operations: [], differences };
}

export interface PlanBootstrapInput {
  readonly extractions: readonly ExtractionContract[];
  readonly seed: SemanticSeed;
  readonly snapshot: LibrarySnapshot;
}

/**
 * Piano `bootstrap`: su library vuota crea set, token (inclusi gli
 * shadow/ring del seed) e un container per contratto; su library esistente
 * rifiuta con motivo nominativo e zero operazioni.
 */
export function planBootstrap(input: PlanBootstrapInput): LibraryPlanResult {
  const { extractions, seed, snapshot } = input;
  const found: string[] = [];
  if (snapshot.sets.length > 0) {
    found.push(`${snapshot.sets.length} set di token (${snapshot.sets.map((set) => set.name).join(", ")})`);
  }
  if (snapshot.componentCount > 0) {
    found.push(`${snapshot.componentCount} componenti in library.local`);
  } else if (snapshot.components.length > 0) {
    found.push(`${snapshot.components.length} VariantContainer (${snapshot.components.map((component) => component.name).join(", ")})`);
  }
  if (found.length > 0) {
    return {
      refused: `Bootstrap rifiutato: la library non è vuota — trovati ${found.join(" e ")}. Usa "library add <Comp>" o un file nuovo.`,
      operations: [],
      differences: [],
    };
  }
  // Nome container come controllo incrociato: un contratto senza container
  // coerente non arriva al piano.
  for (const extraction of extractions) {
    const expected = pascalCase(extraction.contract.name);
    if (extraction.penpot.container !== expected) {
      throw new ScriptError({
        kind: "contract",
        component: extraction.penpot.container,
        detail: `Contratto "${extraction.contract.name}": il container "${extraction.penpot.container}" non corrisponde — atteso "${expected}" (plugin data "${contractId(extraction.contract)}").`,
      });
    }
  }
  return {
    operations: [
      { kind: "createSet", set: "palette" },
      { kind: "createSet", set: "semantic" },
      ...seed.palette.map(
        (token): LibraryOperation => ({ kind: "createToken", set: "palette", name: token.name, type: token.type, value: token.value }),
      ),
      ...seed.semantic.map(
        (token): LibraryOperation => ({ kind: "createToken", set: "semantic", name: token.name, type: token.type, value: token.value }),
      ),
      ...extractions.map((extraction) => containerOperation(extraction)),
    ],
    differences: [],
  };
}
