import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { parseExecuteCodeEnvelope, withTimeout, type McpCallToolResult } from "./mcp-client";
import type { ComponentFixture } from "./recipe-schema";
import type { PenpotToken, TokenCatalog } from "./theme-generator";

/**
 * Component reader Penpot (Story 2.2, Task 4): legge struttura + matrice
 * varianti + CSS raw di UN componente per nome, via MCP `execute_code`, e
 * deriva il token binding per corrispondenza di valore esatto (hex/numero)
 * contro il catalogo Stadio 1 quando `shape.tokens` è vuoto — è una
 * scoperta (stesso valore byte-per-byte), mai un binding indovinato: un
 * valore senza corrispondenza esatta è un segnale di stop esplicito che
 * nomina la shape e il valore (Dev Notes Story 2.2).
 */

const DEFAULT_PENPOT_MCP_URL = "http://127.0.0.1:4401/mcp";

export type CallToolFn = (args: { name: string; arguments: { code: string } }) => Promise<unknown>;

export interface ReadComponentOptions {
  mcpUrl?: string;
  /** Seam per i test: transport mockato, zero rete. In produzione è assente. */
  callTool?: CallToolFn;
  timeoutMs?: number;
}

interface BoardFacts {
  id: string;
  name: string;
  variantProps: Record<string, string> | null;
  fills: Array<{ fillColor?: string }>;
  strokes: Array<{ strokeColor?: string }>;
  borderRadius: number | string | null;
  textColors: string[];
  rawCss: string;
}

interface ComponentFacts {
  container: { id: string; name: string };
  axes: string[];
  boards: BoardFacts[];
}

interface RawBoard {
  id: unknown;
  name: unknown;
  cellId: unknown;
  variantProps: unknown;
  variantError: unknown;
  matched: unknown;
  fills: unknown;
  strokes: unknown;
  borderRadius: unknown;
  textColors: unknown;
  rawCss: unknown;
}

/**
 * Codice eseguito dentro il plugin Penpot via `execute_code`: trova il
 * VariantContainer per nome, legge le celle da `variants.variantComponents()`
 * (che espongono `variantProps`) e le mappa sulle board figlie del container
 * via `shapeStructure(...).componentInstance.componentId` — le board NON
 * espongono `variantProps` direttamente (verificato empiricamente, Story
 * 2.2). La board "Default" ha `variantProps` null: istanza main, non una
 * cella con assi — viene comunque catturata come riga `variantProps: null`
 * della fixture, scelta documentata in recipe-schema.ts. Per ogni board
 * cattura fatti grezzi: fills/strokes/borderRadius letterali, i colori dei
 * figli di testo e il CSS raw generato da Penpot. Nessuna decisione su
 * dominio/headless/cva/a11y qui — quella è la ricetta (giudizio umano).
 */
function readComponentCode(targetName: string): string {
  return `
const targetName = ${JSON.stringify(targetName)};
function isVariant(shape) {
  try {
    return typeof shape.isVariantContainer === "function" && shape.isVariantContainer();
  } catch (error) {
    return false;
  }
}
// Match esatto prima (nome completo "Badge / Default"), poi convenzione
// VariantContainer "Componente / Variante": il CLI prende il nome del
// componente ("Badge"), non della singola variante.
let container = penpotUtils.findShape((shape) => shape.name === targetName && isVariant(shape));
if (!container) {
  container = penpotUtils.findShape((shape) => isVariant(shape) && (shape.name + " / ").split(" / ")[0] === targetName);
}
if (!container) {
  return { notFound: targetName };
}
if (typeof container.variants !== "object" || container.variants === null) {
  return { notAVariantContainer: targetName };
}
function collectChildColors(shape, acc) {
  (shape.children || []).forEach((child) => {
    (child.fills || []).forEach((fill) => {
      if (fill && fill.fillColor) acc.push(fill.fillColor);
    });
    collectChildColors(child, acc);
  });
  return acc;
}
const cells = container.variants.variantComponents();
const boardRows = (container.children || [])
  .filter((child) => child && child.type === "board")
  .map((board) => {
    const structure = penpotUtils.shapeStructure(board, 1);
    const componentId = structure && structure.componentInstance ? structure.componentInstance.componentId : null;
    const cell = componentId ? cells.find((c) => c.id === componentId) : null;
    return {
      id: board.id,
      name: board.name,
      cellId: cell ? cell.id : null,
      variantProps: cell ? cell.variantProps ?? null : null,
      variantError: cell ? cell.variantError ?? null : null,
      matched: Boolean(cell),
      fills: JSON.parse(JSON.stringify(board.fills ?? [])),
      strokes: JSON.parse(JSON.stringify(board.strokes ?? [])),
      borderRadius: board.borderRadius ?? null,
      textColors: Array.from(new Set(collectChildColors(board, []))),
      rawCss: penpot.generateStyle([board], { type: "css", withChildren: true }),
    };
  });
return {
  container: { id: container.id, name: container.name },
  axes: container.variants.properties,
  cellCount: cells.length,
  boards: boardRows,
};
`;
}

function assertString(value: unknown, field: string, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Campo "${field}" malformato (${JSON.stringify(value)?.slice(0, 120) ?? String(value)}) — ${context}.`);
  }
  return value;
}

/** Validazione dell'inner shape dei fatti letti: un campo malformato è un errore che nomina il campo, mai un TypeError a valle. */
function parseComponentFacts(result: unknown, componentName: string): ComponentFacts {
  const facts = result as {
    notFound?: unknown;
    notAVariantContainer?: unknown;
    container?: { id?: unknown; name?: unknown };
    axes?: unknown;
    boards?: unknown;
  };

  if (facts && typeof facts.notFound === "string") {
    throw new Error(
      `Componente "${facts.notFound}" non trovato su Penpot — verifica il nome esatto della board (es. "Badge / Default", pagina Docs).`,
    );
  }
  if (facts && typeof facts.notAVariantContainer === "string") {
    throw new Error(
      `La shape "${facts.notAVariantContainer}" esiste ma non è un VariantContainer — l'estrazione richiede un componente con varianti (assi × celle).`,
    );
  }
  if (!facts || typeof facts.container !== "object" || facts.container === null) {
    throw new Error(
      `Risposta di execute_code malformata: manca \`container\` — impossibile leggere il componente "${componentName}".`,
    );
  }
  if (!Array.isArray(facts.boards)) {
    throw new Error(
      `Risposta di execute_code malformata: \`boards\` non è una lista — impossibile leggere le celle di "${componentName}".`,
    );
  }

  const boards: BoardFacts[] = [];
  const unmatched: string[] = [];
  facts.boards.forEach((raw: RawBoard, index: number) => {
    const context = `board #${index} di "${componentName}"`;
    if (raw.matched === false) {
      unmatched.push(assertString(raw.id, "id", context));
      return;
    }
    const variantError = raw.variantError ?? null;
    if (variantError !== null) {
      throw new Error(
        `La cella variante ${JSON.stringify(raw.cellId ?? null)} della board "${assertString(raw.name, "name", context)}" riporta variantError "${String(variantError)}" — la matrice varianti su Penpot è incoerente: correggi il componente in Penpot.`,
      );
    }
    boards.push({
      id: assertString(raw.id, "id", context),
      name: assertString(raw.name, "name", context),
      variantProps: (raw.variantProps ?? null) as Record<string, string> | null,
      fills: Array.isArray(raw.fills) ? raw.fills : [],
      strokes: Array.isArray(raw.strokes) ? raw.strokes : [],
      borderRadius: (raw.borderRadius ?? null) as number | string | null,
      textColors: Array.isArray(raw.textColors) ? (raw.textColors as string[]) : [],
      rawCss: typeof raw.rawCss === "string" ? raw.rawCss : "",
    });
  });

  if (unmatched.length > 1) {
    throw new Error(
      `Board non mappabili a una cella variante di "${componentName}": ${unmatched.join(", ")} — una sola board può restare senza cella (la Default); più di una indica una struttura incoerente del componente in Penpot.`,
    );
  }

  return {
    container: {
      id: assertString(facts.container.id, "container.id", `componente "${componentName}"`),
      name: assertString(facts.container.name, "container.name", `componente "${componentName}"`),
    },
    axes: Array.isArray(facts.axes) ? (facts.axes as string[]) : [],
    boards,
  };
}

/**
 * Indice di binding: per i token di tipo `color` il valore normalizzato
 * (lowercase) → candidati; per i tipi numerici (borderRadius) il valore
 * risolto (riferimenti `{...}` seguiti) → candidati. La preferenza fra
 * candidati che condividono lo stesso valore è deterministica: prima i token
 * semantici di design ("color.mis.*", "color.feedback.*", "radius.mis.*"),
 * poi gli alias di scala ("accent.9", "radius.full") — stesso ordine
 * dell'elenco di Story 2.2 nei Dev Notes.
 */
interface BindingIndex {
  colors: Map<string, Array<{ name: string; priority: number }>>;
  radii: Map<number, Array<{ name: string; priority: number }>>;
}

function semanticPriority(tokenName: string): number {
  return /^(color\.mis\.|color\.feedback\.|radius\.mis\.)/.test(tokenName) ? 0 : 1;
}

function buildBindingIndex(catalog: TokenCatalog): BindingIndex {
  const colors = new Map<string, Array<{ name: string; priority: number }>>();
  const radii = new Map<number, Array<{ name: string; priority: number }>>();

  const numericByName = new Map<string, { type: string; value: PenpotToken["value"] }>();
  for (const set of catalog.sets) {
    for (const token of set.tokens) {
      numericByName.set(token.name, { type: token.type, value: token.value });
    }
  }

  function resolveNumeric(tokenName: string, seen: string[] = []): number | null {
    if (seen.includes(tokenName)) return null;
    const token = numericByName.get(tokenName);
    if (!token) return null;
    if (typeof token.value === "string") {
      const ref = /^\{(.+)\}$/.exec(token.value);
      if (ref?.[1]) return resolveNumeric(ref[1], [...seen, tokenName]);
      const parsed = Number(token.value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  // I token color possono referenziarsi tra loro (es. color.mis.primary =
  // {accent.9}): per il binding conta il valore finale risolto, attribuito
  // al token che lo espone (il semantico, non l'alias di scala).
  function resolveColor(tokenName: string, seen: string[] = []): string | null {
    if (seen.includes(tokenName)) return null;
    const token = numericByName.get(tokenName);
    if (!token || token.type !== "color" || typeof token.value !== "string") return null;
    const ref = /^\{(.+)\}$/.exec(token.value);
    if (ref?.[1]) return resolveColor(ref[1], [...seen, tokenName]);
    return token.value;
  }

  for (const set of catalog.sets) {
    for (const token of set.tokens) {
      if (token.type === "color") {
        const resolved = resolveColor(token.name);
        if (resolved !== null) {
          const key = resolved.toLowerCase();
          const list = colors.get(key) ?? [];
          list.push({ name: token.name, priority: semanticPriority(token.name) });
          colors.set(key, list);
        }
      }
      if (token.type === "borderRadius") {
        const resolved = resolveNumeric(token.name);
        if (resolved !== null) {
          const list = radii.get(resolved) ?? [];
          list.push({ name: token.name, priority: semanticPriority(token.name) });
          radii.set(resolved, list);
        }
      }
    }
  }

  for (const list of colors.values()) list.sort((a, b) => a.priority - b.priority);
  for (const list of radii.values()) list.sort((a, b) => a.priority - b.priority);

  return { colors, radii };
}

function firstColor(paints: Array<{ fillColor?: string; strokeColor?: string }>, field: "fillColor" | "strokeColor"): string | null {
  for (const paint of paints) {
    const value = paint?.[field];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function bindColor(value: string, index: BindingIndex, shapeName: string, property: string): string {
  const candidates = index.colors.get(value.toLowerCase());
  if (candidates && candidates.length > 0) return candidates[0]!.name;
  throw new Error(
    `Token binding non derivabile per "${property}" = "${value}" sulla shape "${shapeName}" — nessun token di tipo color nel catalogo Stadio 1 con questo valore esatto. È un segnale di stop: applica il token in Penpot (fuori scope di questa estrazione) o correggi il valore.`,
  );
}

function bindRadius(value: number | string, index: BindingIndex, shapeName: string): string {
  const numeric = typeof value === "number" ? value : Number(value);
  const candidates = Number.isFinite(numeric) ? index.radii.get(numeric) : undefined;
  if (candidates && candidates.length > 0) return candidates[0]!.name;
  throw new Error(
    `Token binding non derivabile per "borderRadius" = "${value}" sulla shape "${shapeName}" — nessun token di tipo borderRadius nel catalogo Stadio 1 con questo valore esatto. È un segnale di stop: applica il token in Penpot o correggi il valore.`,
  );
}

function deriveBindings(board: BoardFacts, index: BindingIndex): Record<string, string> {
  const bindings: Record<string, string> = {};
  const fill = firstColor(board.fills, "fillColor");
  if (fill) bindings.fill = bindColor(fill, index, board.name, "fill");
  const stroke = firstColor(board.strokes, "strokeColor");
  if (stroke) bindings.stroke = bindColor(stroke, index, board.name, "stroke");
  const text = board.textColors.find((color) => typeof color === "string" && color.length > 0);
  if (text) bindings.text = bindColor(text, index, board.name, "text");
  if (board.borderRadius !== null && board.borderRadius !== undefined) {
    bindings.borderRadius = bindRadius(board.borderRadius, index, board.name);
  }
  return bindings;
}

export async function readComponentFixture(
  componentName: string,
  catalog: TokenCatalog,
  options: ReadComponentOptions = {},
): Promise<ComponentFixture> {
  const { mcpUrl = DEFAULT_PENPOT_MCP_URL, timeoutMs } = options;
  const bindingIndex = buildBindingIndex(catalog);

  async function callToolRaw(args: { name: string; arguments: { code: string } }): Promise<McpCallToolResult> {
    if (options.callTool) {
      return (await withTimeout(
        Promise.resolve(options.callTool(args)) as Promise<McpCallToolResult>,
        `chiamata al tool execute_code (lettura componente "${componentName}")`,
        timeoutMs,
      )) as McpCallToolResult;
    }
    const client = new Client({ name: "penpot-ds-scripts", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    try {
      await withTimeout(client.connect(transport), `connessione al server MCP Penpot (${mcpUrl})`, timeoutMs);
      return (await withTimeout(
        client.callTool(args as never),
        `chiamata al tool execute_code (lettura componente "${componentName}")`,
        timeoutMs,
      )) as McpCallToolResult;
    } finally {
      // La close non deve mai mascherare l'errore primario, né lasciare socket
      // aperti che tengono vivo l'event loop del CLI.
      try {
        await client.close();
      } catch {
        // ignorato deliberatamente: conta l'esito dell'operazione
      }
    }
  }

  const raw = await callToolRaw({ name: "execute_code", arguments: { code: readComponentCode(componentName) } });
  const envelope = parseExecuteCodeEnvelope(raw, `lettura del componente "${componentName}"`);
  const facts = parseComponentFacts(envelope.result, componentName);
  return assembleFixture(facts, bindingIndex);
}

/**
 * Assembla la `ComponentFixture` dai fatti letti: assi derivati dalle celle
 * (union in ordine d'incontro, la board Default non contribuisce valori),
 * celle = board lette con il binding derivato. `componentName` è la parte
 * prima del separatore di variante ("Badge / Default" → "Badge").
 */
function assembleFixture(facts: ComponentFacts, bindingIndex: BindingIndex): ComponentFixture {
  const componentName = facts.container.name.split(" / ")[0] ?? facts.container.name;

  const variantAxes = facts.axes.map((axis) => {
    const values: string[] = [];
    for (const board of facts.boards) {
      const value = board.variantProps?.[axis];
      if (typeof value === "string" && !values.includes(value)) values.push(value);
    }
    return { name: axis, values };
  });

  const cells = facts.boards.map((board) => ({
    variantProps: board.variantProps,
    penpotComponentId: board.id,
    // shapeStructure = fatti di stile letti dalla board (senza React, AC #3).
    shapeStructure: {
      style: {
        fills: board.fills,
        strokes: board.strokes,
        borderRadius: board.borderRadius,
        textColors: board.textColors,
      },
    },
    tokenBindings: deriveBindings(board, bindingIndex),
    rawCss: board.rawCss,
  }));

  return {
    componentName,
    penpotComponentId: facts.container.id,
    variantAxes,
    cells,
  };
}
