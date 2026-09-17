import type { LibraryOperation } from "./library-plan";

/**
 * Traduce le operazioni del piano v2 in codice `execute_code` (Story 2.13,
 * CAP-6): UN'operazione per chiamata, così un errore live nomina l'operazione
 * fallita. Il writer NON esegue nulla: esegue il comando
 * (`commands/library.ts`) via `callPenpotTool`. Disegno da
 * `src/library/penpot-writer.ts` (v1, da non toccare): piano puro + writer +
 * comando.
 *
 * API Penpot usate (le stesse della v1, verificate 2026-09-12):
 * - `penpot.library.local.tokens.addSet({ name, active: true })`,
 *   `set.addToken({ type, name, value })`;
 * - board e parti `text` con `penpot.createBoard()` / `penpot.createText()`
 *   (`image` è una board senza `fill`: il contenuto arriva dal field);
 * - `penpot.library.local.createComponent([board])` per ogni cella;
 * - `penpotUtils.createVariantContainer([{ shape, properties }...])`;
 * - `shape.applyToken(token, [prop])`, asincrono;
 * - `container.setSharedPluginData("pagebuilder", "contract", contractId)`.
 *
 * Mai classi Tailwind qui: solo token del seed su proprietà del registro.
 */

export interface WriteStep {
  /** Nome dell'operazione, usato nei messaggi d'errore del comando. */
  readonly description: string;
  readonly code: string;
}

/** I valori colore hex in maiuscolo: convenzione dell'API Penpot (come v1). */
function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : value;
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
  }
  return value;
}

function literal(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

function setStep(set: string): WriteStep {
  return {
    description: `createSet "${set}"`,
    code: `
const set = penpot.library.local.tokens.addSet({ name: ${JSON.stringify(set)}, active: true });
if (!set.active) set.toggleActive();
return { id: set.id, name: set.name };
`,
  };
}

function tokenStep(set: string, name: string, type: string, value: unknown): WriteStep {
  return {
    description: `createToken "${name}" (set "${set}")`,
    code: `
const set = penpot.library.local.tokens.sets.find((s) => s.name === ${JSON.stringify(set)});
if (!set) throw new Error('Set ${JSON.stringify(set)} non trovato: createToken presuppone il set esistente.');
const token = set.addToken({ type: ${JSON.stringify(type)}, name: ${JSON.stringify(name)}, value: ${literal(value)} });
return { id: token.id, name: token.name };
`,
  };
}

/** Il codice condiviso della cella: crea board/parti e lega i token, poi crea il componente. */
const CELL_RUNTIME = `
function makeShape(part) {
  if (part.kind === "text") {
    const text = penpot.createText(part.text || part.name);
    if (!text) throw new Error("createText ha restituito null per la parte \\"" + part.name + "\\"");
    text.growType = "auto-width";
    return text;
  }
  const board = penpot.createBoard();
  if (part.size) board.resize(part.size[0], part.size[1]);
  // Le board nuove nascono con un fill bianco di default: senza token "fill"
  // nel piano il fill va rimosso, altrimenti resta una proprietà di stile
  // valorizzata senza binding (la regola di verify la rifiuta).
  if (!part.tokens || !part.tokens.fill) board.fills = [];
  return board;
}
function findToken(name) {
  const token = penpotUtils.findTokenByName(name);
  if (!token) throw new Error("Token \\"" + name + "\\" non trovato nel catalogo locale: l'operazione createToken lo presuppone esistente.");
  return token;
}
async function applyPartTokens(shape, part) {
  for (const [property, tokenName] of Object.entries(part.tokens)) {
    const token = findToken(tokenName);
    await shape.applyToken(token, [property]);
  }
}
`;

type CellPlanLike = {
  variantProps: Readonly<Record<string, string>>;
  parts: ReadonlyArray<{
    name: string;
    layer: string;
    kind: string;
    parent: string | null;
    text?: string;
    tokens: Readonly<Record<string, string>>;
  }>;
};

/** `promo=none|hover=off` nell'ordine dei `variantProps` (ordine assi atteso). */
function cellLabelOf(variantProps: Readonly<Record<string, string>>): string {
  return Object.entries(variantProps)
    .map(([axis, value]) => `${axis}=${value}`)
    .join("|");
}

/**
 * Lo spec di una board di cella: nome `"<Container> promo=..|hover=.."`,
 * posizione da `index`, parti e token del SOLO piano. `root` diventa la board
 * (nome = boardName); le altre parti prendono il `layer` del contratto di
 * estrazione (alias con `/` inclusi).
 */
function cellSpec(containerName: string, cell: CellPlanLike, index: number) {
  const boardName = `${containerName} ${cellLabelOf(cell.variantProps)}`;
  const rootWidth = 320;
  const step = Math.max(240, rootWidth + 40);
  return {
    boardName,
    variantProps: cell.variantProps,
    step,
    x: step * index,
    y: 0,
    parts: cell.parts.map((part) => ({
      name: part.name,
      layer: part.layer,
      kind: part.kind,
      parent: part.parent,
      text: part.text,
      tokens: part.tokens,
    })),
  };
}

/**
 * Codice runtime condiviso: guardia per nome, board DA ZERO dalle parti del
 * piano, token, `createComponent`. Lascia `board` e `component` in scope.
 * La `root` è la board (nome = boardName); le altre parti sono figlie secondo
 * `parent` (nomi di parte, non di layer).
 */
const BUILD_CELL_RUNTIME = `
const existing = penpot.library.local.components.find((c) => c.name === spec.boardName);
if (existing) throw new Error("Componente \\"" + spec.boardName + "\\" esiste già in library.local: scritture parziali di un run precedente? Rimuovilo a mano in Penpot e rilancia.");
const byName = new Map();
let board = null;
for (const part of spec.parts) {
  const shape = makeShape(part);
  shape.name = part.name === "root" ? spec.boardName : part.layer;
  byName.set(part.name, shape);
  if (part.name === "root") {
    board = shape;
    board.x = spec.x;
    board.y = spec.y;
  } else {
    const parentShape = part.parent === "root" ? board : byName.get(part.parent);
    if (!parentShape) throw new Error("Parte padre \\"" + part.parent + "\\" non trovata per \\"" + part.name + "\\"");
    parentShape.appendChild(shape);
  }
}
if (!board) throw new Error("La cella non ha una parte \\"root\\" (la board della cella).");
for (const part of spec.parts) {
  await applyPartTokens(byName.get(part.name), part);
}
// 'applyToken' è asincrono: ~150 ms prima di 'createComponent' (pattern ereditato dalla v1).
await new Promise((resolve) => setTimeout(resolve, 150));
const component = penpot.library.local.createComponent([board]);
`;

function cellStep(contract: string, containerName: string, cell: CellPlanLike, index: number): WriteStep {
  const spec = cellSpec(containerName, cell, index);
  return {
    description: `createContainer "${contract}", cella "${cellLabelOf(cell.variantProps)}"`,
    code: `
${CELL_RUNTIME}
const spec = ${literal(spec)};
${BUILD_CELL_RUNTIME}
return { componentId: component.id, name: component.name, boardName: spec.boardName };
`,
  };
}

function containerStep(containerName: string, pluginData: string, cells: ReadonlyArray<{ variantProps: Readonly<Record<string, string>> }>): WriteStep {
  const boardNames = cells.map((cell) => `${containerName} ${cellLabelOf(cell.variantProps)}`);
  const entries = cells.map((cell, index) => ({
    name: boardNames[index],
    properties: cell.variantProps,
  }));
  return {
    description: `createVariantContainer "${containerName}" + plugin data ${pluginData}`,
    code: `
const entries = ${literal(entries)};
const existingContainer = penpot.library.local.components.find(
  (c) => c.name === ${JSON.stringify(containerName)} && typeof c.isVariantContainer === "function" && c.isVariantContainer(),
);
if (existingContainer) throw new Error("VariantContainer \\"" + ${JSON.stringify(containerName)} + "\\" esiste già: library add rifiuta di duplicarlo. Rimuovilo a mano in Penpot.");
const shapes = entries.map((entry) => {
  const component = penpot.library.local.components.find((c) => c.name === entry.name);
  if (!component) throw new Error("Componente \\"" + entry.name + "\\" non trovato in library.local: l'operazione della cella lo presuppone creato.");
  return { shape: component.mainInstance(), properties: entry.properties };
});
const container = penpotUtils.createVariantContainer(shapes);
container.name = ${JSON.stringify(containerName)};
container.setSharedPluginData("pagebuilder", "contract", ${JSON.stringify(pluginData)});
return { id: container.id, name: container.name, pluginData: container.getSharedPluginData("pagebuilder", "contract") };
`,
  };
}

/** Traduce le operazioni del piano in step eseguibili, nell'ordine del piano. */
export function operationsToSteps(operations: readonly LibraryOperation[]): WriteStep[] {
  const steps: WriteStep[] = [];
  for (const operation of operations) {
    if (operation.kind === "createSet") {
      steps.push(setStep(operation.set));
    } else if (operation.kind === "createToken") {
      steps.push(tokenStep(operation.set, operation.name, operation.type, operation.value));
    } else {
      for (const [index, cell] of operation.cells.entries()) {
        steps.push(cellStep(operation.contract, operation.containerName, cell, index));
      }
      steps.push(containerStep(operation.containerName, operation.pluginData, operation.cells));
    }
  }
  return steps;
}
