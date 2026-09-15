import type { Operation } from "./library-plan";

/**
 * Traduce le `Operation` del piano in codice `execute_code` (Story 2.4,
 * Task 5): UN'operazione per chiamata, o lotti piccoli per i container, così
 * un errore live nomina l'operazione fallita. Il writer NON esegue nulla:
 * esegue il CLI (`cli/library.ts`) via `callPenpotTool`.
 *
 * API usate (verificate con `high_level_overview`, 2026-09-12):
 * - `penpot.library.local.tokens.addSet({ name, active: true })`, `set.addToken({ type, name, value })`;
 * - board e parti con flex layout (`board.addFlexLayout()`) e
 *   `penpot.library.local.createComponent([board])` per ogni cella;
 * - `penpotUtils.createVariantContainer([{ shape, properties }...])`, NON la sequenza a basso livello;
 * - `shape.applyToken(token, [prop])`, asincrono: ~100 ms prima di rileggere;
 * - `container.setSharedPluginData("pagebuilder", "contract", contractId)`;
 * - `addCell`: `container.appendChild(board)` + `setVariantProperty(pos, value)`
 *   (indice da `container.variants.properties`), mai `addVariant()`.
 *
 * I valori colore hex vengono scritti IN MAIUSCOLO (convenzione dell'API).
 */

export interface WriteStep {
  /** Nome dell'operazione, usato nei messaggi d'errore del CLI. */
  readonly description: string;
  readonly code: string;
}

/** I valori colore hex in maiuscolo: convenzione dell'API Penpot. */
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
    const text = penpot.createText(part.text);
    if (!text) throw new Error("createText ha restituito null per la parte \\"" + part.name + "\\"");
    text.growType = "auto-width";
    return text;
  }
  if (part.kind === "path") {
    const path = penpot.createPath();
    path.d = part.d;
    return path;
  }
  const board = penpot.createBoard();
  if (part.dir) {
    const flex = board.addFlexLayout();
    flex.dir = part.dir;
    if (part.align) flex.alignItems = part.align;
  }
  if (part.size) board.resize(part.size[0], part.size[1]);
  // Le board nuove nascono con un fill bianco di default: senza token "fill"
  // nel design il fill va rimosso, altrimenti resta una proprietà di stile
  // valorizzata senza binding (la regola 7 di verifyLibrary la rifiuta).
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
    kind: string;
    parent: string | null;
    text?: string;
    size?: readonly [number, number];
    dir?: string;
    align?: string;
    tokens: Readonly<Record<string, string>>;
  }>;
};

/** `axis=v|…` nell'ordine dei `variantProps` (ordine contratto). */
function cellLabelOf(variantProps: Readonly<Record<string, string>>): string {
  return Object.entries(variantProps)
    .map(([axis, value]) => `${axis}=${value}`)
    .join("|");
}

/**
 * Lo spec di una board di cella: nome `"<Container> axis=v|…"`, posizione da
 * `index`, parti e token del SOLO design. Condiviso da `createContainer` e
 * `addCell`, così una cella aggiunta nasce identica a una del bootstrap.
 */
function cellSpec(containerName: string, cell: CellPlanLike, index: number, xOffset: number, yOffset: number) {
  const boardName = `${containerName} ${cellLabelOf(cell.variantProps)}`;
  // Il passo orizzontale segue la larghezza reale della board (review 2.4:
  // 240 fissi sovrapponevano le celle dell'AccordionItem, larga 340).
  const boardWidth = cell.parts.find((part) => part.name === "root")?.size?.[0] ?? 240;
  const step = Math.max(240, boardWidth + 40);
  return {
    boardName,
    variantProps: cell.variantProps,
    step,
    x: xOffset + step * index,
    y: yOffset,
    parts: cell.parts.map((part) => ({
      name: part.name,
      kind: part.kind,
      parent: part.parent,
      text: part.text,
      size: part.size,
      dir: part.dir,
      align: part.align,
      d: part.kind === "path" ? "M 0 0 L 8 8 L 0 16" : undefined,
      tokens: part.tokens,
    })),
  };
}

/**
 * Codice runtime condiviso: guardia per nome, board DA ZERO dalle parti del
 * design, token, `createComponent`. Lascia `board` e `component` in scope.
 */
const BUILD_CELL_RUNTIME = `
// Guardia di ripartenza (review 2.4): se una scrittura precedente è stata
// interrotta a metà, la cella può esistere già come componente orfano.
// Rifiutare qui evita duplicati: la pulizia è manuale in Penpot.
const existing = penpot.library.local.components.find((c) => c.name === spec.boardName);
if (existing) throw new Error("Componente \\"" + spec.boardName + "\\" esiste già in library.local: scritture parziali di un run precedente? Rimuovilo a mano in Penpot e rilancia.");
const byName = new Map();
let board = null;
for (const part of spec.parts) {
  const shape = makeShape(part);
  shape.name = part.name;
  byName.set(part.name, shape);
  if (part.name === "root") {
    board = shape;
    board.name = spec.boardName;
    board.x = spec.x;
    board.y = 0;
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
await new Promise((resolve) => setTimeout(resolve, 150));
const component = penpot.library.local.createComponent([board]);
`;

function cellStep(contract: string, containerName: string, cell: CellPlanLike, index: number, xOffset: number, yOffset: number): WriteStep {
  const spec = cellSpec(containerName, cell, index, xOffset, yOffset);
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

/**
 * `addCell` (Story 2.7 parte B): la cella mancante di un container ESISTENTE.
 * Meccanismo provato nel test Alert: board costruita come `cellStep` →
 * `createComponent` → `container.appendChild(board)` → `setVariantProperty`
 * per asse (indice da `variants.properties`). NON `addVariant()`: duplica una
 * variante esistente e ne eredita geometria, stili e binding token.
 * Non tocca celle esistenti né il plugin data.
 */
function addCellStep(contract: string, containerName: string, cell: CellPlanLike, index: number): WriteStep {
  const spec = cellSpec(containerName, cell, index, 0, 0);
  return {
    description: `addCell "${contract}", cella "${cellLabelOf(cell.variantProps)}" nel container "${containerName}"`,
    code: `
${CELL_RUNTIME}
const contractName = ${JSON.stringify(contract)};
const spec = ${literal(spec)};
function isVariantContainerShape(shape) {
  try {
    return typeof shape.isVariantContainer === "function" && shape.isVariantContainer();
  } catch (error) {
    return false;
  }
}
function declaredContract(shape) {
  try {
    return (shape.getSharedPluginData("pagebuilder", "contract") || "").split("@")[0];
  } catch (error) {
    return "";
  }
}
const declaring = (penpotUtils.findShapes((shape) => isVariantContainerShape(shape)) || []).filter(
  (shape) => declaredContract(shape) === contractName,
);
if (declaring.length !== 1) {
  throw new Error("addCell \\"" + contractName + "\\", cella \\"" + ${JSON.stringify(cellLabelOf(cell.variantProps))} + "\\": attesa UN container che dichiara il contratto via plugin data, trovati " + declaring.length + (declaring.length > 0 ? " (" + declaring.map((c) => "\\"" + c.name + "\\"").join(", ") + ")" : "") + ".");
}
const container = declaring[0];
const properties = Array.from(container.variants.properties);
const positions = Object.keys(spec.variantProps).map((axis) => {
  const pos = properties.indexOf(axis);
  if (pos < 0) throw new Error("addCell \\"" + contractName + "\\": il container \\"" + container.name + "\\" non ha la proprietà di variante \\"" + axis + "\\" (proprietà: " + properties.join(", ") + ").");
  return { axis, pos, value: spec.variantProps[axis] };
});
// Guardia anti-duplicato: una variante con gli stessi variantProps esiste già.
const same = container.variants.variantComponents().find((variant) => {
  const props = variant.variantProps || {};
  return positions.every((p) => props[p.axis] === p.value);
});
if (same) {
  return { skipped: true, reason: "la variante \\"" + spec.boardName + "\\" esiste già nel container \\"" + container.name + "\\"" };
}
${BUILD_CELL_RUNTIME}
// Posizione (prova live 2026-09-13): dopo la cella più a destra, sulla sua
// stessa riga, col passo del bootstrap; il container si allarga per
// contenerla col suo margine. Senza celle, dall'angolo del container.
const cellsInContainer = (container.children || []).filter((child) => child.id !== board.id);
const last = cellsInContainer.reduce((right, child) => (right === null || child.x > right.x ? child : right), null);
board.x = last ? last.x + spec.step : (container.x || 0) + spec.x;
board.y = last ? last.y : (container.y || 0) + spec.y;
container.appendChild(board);
const margin = last ? Math.max(0, Math.min(...cellsInContainer.map((child) => child.x)) - container.x) : 0;
const neededWidth = board.x + board.width + margin - container.x;
if (neededWidth > container.width) container.resize(neededWidth, container.height);
const cellLabel = "addCell \\"" + contractName + "\\", cella \\"" + spec.boardName + "\\", container \\"" + container.name + "\\"";
const variant = container.variants.variantComponents().find((c) => c.id === component.id);
if (!variant) throw new Error(cellLabel + ": il componente creato non risulta fra le varianti del container dopo appendChild — cella scritta a metà, rimuovila a mano in Penpot.");
for (const p of positions) {
  variant.setVariantProperty(p.pos, p.value);
}
// Rilettura: ogni asse deve avere il valore della cella.
const written = container.variants.variantComponents().find((c) => c.id === component.id);
const props = (written && written.variantProps) || {};
const wrong = positions.filter((p) => props[p.axis] !== p.value);
if (wrong.length > 0) throw new Error(cellLabel + ": dopo setVariantProperty " + wrong.map((p) => p.axis + " = " + JSON.stringify(props[p.axis]) + " (atteso \\"" + p.value + "\\")").join(", ") + " — cella scritta a metà, rimuovila a mano in Penpot.");
return { componentId: component.id, boardName: spec.boardName, container: container.name };
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
// Guardia di ripartenza (review 2.4): il container è l'ULTIMO step del
// contratto — se esiste già, un run precedente è arrivato fino in fondo.
const existingContainer = penpot.library.local.components.find(
  (c) => c.name === ${JSON.stringify(containerName)} && c.isVariantContainer && c.isVariantContainer(),
);
if (existingContainer) throw new Error("VariantContainer \\"" + ${JSON.stringify(containerName)} + "\\" esiste già: bootstrap/additiva rifiuta di duplicarlo. Rimuovilo a mano in Penpot o usa la modalità additiva.");
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
export function operationsToSteps(operations: readonly Operation[]): WriteStep[] {
  const steps: WriteStep[] = [];
  // Le celle di contratti diversi NON si sovrappongono (review 2.4): ogni
  // contratto occupa la sua fila, con uno scarto verticale per contratto.
  let yOffset = 0;
  for (const operation of operations) {
    if (operation.kind === "createSet") {
      steps.push(setStep(operation.set));
    } else if (operation.kind === "createToken") {
      steps.push(tokenStep(operation.set, operation.name, operation.type, operation.value));
    } else if (operation.kind === "addCell") {
      steps.push(addCellStep(operation.contract, operation.containerName, operation, operation.index));
    } else {
      for (const [index, cell] of operation.cells.entries()) {
        steps.push(cellStep(operation.contract, operation.containerName, cell, index, 0, yOffset));
      }
      steps.push(containerStep(operation.containerName, operation.pluginData, operation.cells));
      yOffset += 160 + 80;
    }
  }
  return steps;
}
