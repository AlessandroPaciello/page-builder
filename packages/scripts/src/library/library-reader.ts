import {
  callPenpotTool,
  parseExecuteCodeEnvelope,
  resolveMcpEndpoint,
  withTimeout,
  type McpCallToolResult,
  type McpEndpoint,
} from "../mcp-client";
import type { LibrarySnapshot, SnapshotToken } from "./library-snapshot";

/**
 * Library reader Penpot (Story 2.4, Task 4): legge via MCP `execute_code` uno
 * snapshot serializzabile della library locale — set di token (nome, attivo,
 * token), numero totale di componenti e, per ogni VariantContainer, nome,
 * assi, valori per asse, celle (variantProps, variantError), plugin data
 * `pagebuilder/contract` e l'albero dei layer di ogni cella con le proprietà
 * di stile valorizzate e `shape.tokens`. Il plugin data sta SUL
 * VariantContainer, non sull'istanza (forge).
 *
 * Lo stile di validazione è quello di `penpot-reader.ts#extractCatalog`:
 * errori che nominano il campo malformato, mai un TypeError generico a valle.
 */

export type CallToolFn = (args: { name: string; arguments: { code: string } }) => Promise<unknown>;

export interface ReadLibraryOptions {
  /** Default: `resolveMcpEndpoint()` (PENPOT_MCP_URL / PENPOT_MCP_TOKEN). */
  endpoint?: McpEndpoint;
  /** Seam per i test: transport mockato, zero rete. In produzione è assente. */
  callTool?: CallToolFn;
  timeoutMs?: number;
}

/**
 * Eseguito dentro il plugin Penpot. Per ogni shape valorizzata cattura SOLO
 * le proprietà di stile "valorizzate" (fills/strokes non vuoti, radius e
 * padding/gap > 0, opacity ≠ 1, proprietà testo): è l'insieme su cui la
 * regola 7 di `verifyLibrary` esige un binding in `shape.tokens`. La
 * geometria dei path è esclusa (AD-11: "geometria delle icone ignorata") —
 * lo stroke del path però è stile e resta soggetto a binding. Anche il
 * font family è escluso: `applyToken` non supporta i token fontFamilies su
 * Penpot 2.17.2 (verificato in Story 2.4), il font resta una scelta del
 * designer in Penpot.
 */
const READ_LIBRARY_CODE = `
function isVariantContainerShape(shape) {
  try {
    return typeof shape.isVariantContainer === "function" && shape.isVariantContainer();
  } catch (error) {
    return false;
  }
}
function styleOf(shape) {
  const style = {};
  const fills = (shape.fills || []).filter((f) => f && f.fillColor);
  if (fills.length > 0) style.fill = fills.map((f) => f.fillColor);
  const strokes = (shape.strokes || []).filter((s) => s && s.strokeColor);
  if (strokes.length > 0) {
    style.strokeColor = strokes.map((s) => s.strokeColor);
    const width = strokes.map((s) => s.strokeWidth).find((w) => typeof w === "number" && w > 0);
    if (width !== undefined) style.strokeWidth = width;
  }
  for (const prop of ["borderRadiusTopLeft", "borderRadiusTopRight", "borderRadiusBottomRight", "borderRadiusBottomLeft"]) {
    const value = shape[prop];
    if (typeof value === "number" && value > 0) style[prop] = value;
  }
  for (const prop of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "rowGap", "columnGap"]) {
    const value = shape[prop];
    if (typeof value === "number" && value > 0) style[prop] = value;
  }
  if (shape.type === "text") {
    if (shape.fontSize) style.fontSize = shape.fontSize;
    if (shape.fontWeight) style.fontWeight = shape.fontWeight;
    if (shape.letterSpacing) style.letterSpacing = shape.letterSpacing;
  }
  if (typeof shape.opacity === "number" && Math.abs(shape.opacity - 1) > 1e-6) style.opacity = shape.opacity;
  if (Array.isArray(shape.shadows) && shape.shadows.length > 0) style.shadow = JSON.parse(JSON.stringify(shape.shadows));
  return style;
}
function layerTree(shape) {
  return {
    name: shape.name,
    kind: shape.type,
    tokens: JSON.parse(JSON.stringify(shape.tokens ?? {})),
    style: styleOf(shape),
    children: (shape.children || []).map(layerTree),
  };
}
const catalog = penpot.library.local.tokens;
const sets = catalog.sets.map((set) => ({
  name: set.name,
  active: set.active,
  tokens: set.tokens.map((token) => ({ name: token.name, type: token.type, value: token.value })),
}));
const containers = penpotUtils.findShapes((shape) => isVariantContainerShape(shape)) || [];
const components = containers.map((container) => {
  const variants = container.variants;
  const axes = Array.from(variants.properties);
  const axesValues = {};
  for (const prop of axes) {
    axesValues[prop] = Array.from(variants.currentValues(prop) ?? []);
  }
  const cellsList = variants.variantComponents();
  const cells = (container.children || [])
    .filter((child) => child && child.type === "board")
    .map((board) => {
      const structure = penpotUtils.shapeStructure(board, 1);
      const componentId = structure && structure.componentInstance ? structure.componentInstance.componentId : null;
      const cell = componentId ? cellsList.find((c) => c.id === componentId) : null;
      return {
        variantProps: cell ? JSON.parse(JSON.stringify(cell.variantProps ?? null)) : null,
        variantError: cell ? cell.variantError ?? null : null,
        root: layerTree(board),
      };
    });
  let pluginData = null;
  try {
    pluginData = container.getSharedPluginData("pagebuilder", "contract") || null;
  } catch (error) {
    pluginData = null;
  }
  return { id: container.id, name: container.name, pluginData, axes, axesValues, cells };
});
return { sets, componentCount: penpot.library.local.components.length, components };
`;

function assertArray(value: unknown, field: string, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Campo "${field}" malformato (${JSON.stringify(value)?.slice(0, 120) ?? String(value)}) — ${context}.`);
  }
  return value;
}

function assertString(value: unknown, field: string, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Campo "${field}" malformato (${JSON.stringify(value)?.slice(0, 120) ?? String(value)}) — ${context}.`);
  }
  return value;
}

/** Validazione dell'inner shape dello snapshot: un campo malformato è un errore che nomina il campo. */
export function parseLibrarySnapshot(result: unknown): LibrarySnapshot {
  const raw = result as {
    sets?: unknown;
    componentCount?: unknown;
    components?: unknown;
  };
  const context = "lettura della library Penpot";
  const setsRaw = assertArray(raw?.sets, "sets", context);
  const componentsRaw = assertArray(raw?.components, "components", context);
  if (typeof raw?.componentCount !== "number") {
    throw new Error(`Campo "componentCount" malformato (${JSON.stringify(raw?.componentCount)}) — ${context}.`);
  }

  const sets = setsRaw.map((setRaw, setIndex) => {
    const setContext = `set #${setIndex}`;
    const set = setRaw as { name?: unknown; active?: unknown; tokens?: unknown };
    const name = assertString(set?.name, "set.name", setContext);
    if (typeof set?.active !== "boolean") {
      throw new Error(`Campo "set.active" malformato per il set "${name}" (${JSON.stringify(set?.active)}) — ${context}.`);
    }
    const tokens = assertArray(set?.tokens, "set.tokens", `set "${name}"`).map((tokenRaw, tokenIndex) => {
      const token = tokenRaw as { name?: unknown; type?: unknown; value?: unknown };
      const tokenContext = `token #${tokenIndex} del set "${name}"`;
      const tokenName = assertString(token?.name, "token.name", tokenContext);
      const tokenType = assertString(token?.type, "token.type", tokenContext);
      if (token?.value == null) {
        throw new Error(`Campo "token.value" mancante per "${tokenName}" (set "${name}") — ${context}.`);
      }
      return { name: tokenName, type: tokenType as SnapshotToken["type"], value: token.value } as SnapshotToken;
    });
    return { name, active: set.active, tokens };
  });

  const components = componentsRaw.map((componentRaw, componentIndex) => {
    const componentContext = `componente #${componentIndex}`;
    const component = componentRaw as {
      id?: unknown;
      name?: unknown;
      pluginData?: unknown;
      axes?: unknown;
      axesValues?: unknown;
      cells?: unknown;
    };
    const name = assertString(component?.name, "component.name", componentContext);
    const id = assertString(component?.id, "component.id", `componente "${name}"`);
    if (component?.pluginData !== null && typeof component?.pluginData !== "string") {
      throw new Error(
        `Campo "component.pluginData" malformato per "${name}" (${JSON.stringify(component?.pluginData)}) — atteso stringa o null.`,
      );
    }
    const axes = assertArray(component?.axes, "component.axes", `componente "${name}"`).map((axis, axisIndex) =>
      assertString(axis, `component.axes[${axisIndex}]`, `componente "${name}"`),
    );
    const axesValuesRaw = component?.axesValues;
    if (typeof axesValuesRaw !== "object" || axesValuesRaw === null) {
      throw new Error(`Campo "component.axesValues" malformato per "${name}" — atteso un oggetto.`);
    }
    const axesValues: Record<string, string[]> = {};
    for (const [axis, values] of Object.entries(axesValuesRaw as Record<string, unknown>)) {
      axesValues[axis] = assertArray(values, `component.axesValues["${axis}"]`, `componente "${name}"`).map((value, valueIndex) =>
        assertString(value, `component.axesValues["${axis}"][${valueIndex}]`, `componente "${name}"`),
      );
    }
    const cells = assertArray(component?.cells, "component.cells", `componente "${name}"`).map((cellRaw, cellIndex) => {
      const cell = cellRaw as { variantProps?: unknown; variantError?: unknown; root?: unknown };
      const cellContext = `cella #${cellIndex} di "${name}"`;
      if (cell?.variantProps !== null && (typeof cell?.variantProps !== "object" || cell.variantProps === null)) {
        throw new Error(
          `Campo "cell.variantProps" malformato (${JSON.stringify(cell?.variantProps)?.slice(0, 120)}) — ${cellContext}: atteso oggetto o null.`,
        );
      }
      if (cell?.variantError !== null && typeof cell?.variantError !== "string") {
        throw new Error(
          `Campo "cell.variantError" malformato (${JSON.stringify(cell?.variantError)}) — ${cellContext}: atteso stringa o null.`,
        );
      }
      return {
        variantProps: (cell.variantProps ?? null) as Record<string, string> | null,
        variantError: cell.variantError ?? null,
        root: parseLayer(cell?.root, `board della ${cellContext}`),
      };
    });
    return {
      id,
      name,
      pluginData: component.pluginData as string | null,
      axes,
      axesValues,
      cells,
    };
  });

  return { sets, componentCount: raw.componentCount, components };
}

function parseLayer(raw: unknown, context: string): LibrarySnapshot["components"][number]["cells"][number]["root"] {
  const layer = raw as { name?: unknown; kind?: unknown; tokens?: unknown; style?: unknown; children?: unknown };
  const name = assertString(layer?.name, "layer.name", context);
  const kind = assertString(layer?.kind, "layer.kind", `layer "${name}"`);
  if (typeof layer?.tokens !== "object" || layer.tokens === null) {
    throw new Error(`Campo "layer.tokens" malformato per "${name}" (${context}) — atteso un oggetto.`);
  }
  if (typeof layer?.style !== "object" || layer.style === null) {
    throw new Error(`Campo "layer.style" malformato per "${name}" (${context}) — atteso un oggetto.`);
  }
  const tokens: Record<string, string> = {};
  for (const [property, tokenName] of Object.entries(layer.tokens as Record<string, unknown>)) {
    if (tokenName === null || tokenName === undefined || tokenName === "") continue;
    if (typeof tokenName !== "string") {
      throw new Error(`Binding malformato per "${property}" sul layer "${name}" (${context}): atteso nome token o assente.`);
    }
    tokens[property] = tokenName;
  }
  return {
    name,
    kind,
    tokens,
    style: JSON.parse(JSON.stringify(layer.style)),
    children: assertArray(layer?.children ?? [], "layer.children", `layer "${name}"`).map((child, index) =>
      parseLayer(child, `figlio #${index} di "${name}" (${context})`),
    ),
  };
}

/** L'endpoint si risolve alla chiamata, così il percorso offline non legge mai l'ambiente MCP. */
export async function readLibrarySnapshot(options: ReadLibraryOptions = {}): Promise<LibrarySnapshot> {
  const { timeoutMs } = options;
  async function callToolRaw(args: { name: string; arguments: { code: string } }): Promise<McpCallToolResult> {
    if (options.callTool) {
      return (await withTimeout(
        Promise.resolve(options.callTool(args)) as Promise<McpCallToolResult>,
        "chiamata al tool execute_code (lettura library)",
        timeoutMs,
      )) as McpCallToolResult;
    }
    return callPenpotTool(
      options.endpoint ?? resolveMcpEndpoint(),
      args,
      "chiamata al tool execute_code (lettura library)",
      timeoutMs,
    );
  }

  const raw = await callToolRaw({ name: "execute_code", arguments: { code: READ_LIBRARY_CODE } });
  const envelope = parseExecuteCodeEnvelope(raw, "lettura della library Penpot");
  return parseLibrarySnapshot(envelope.result);
}
