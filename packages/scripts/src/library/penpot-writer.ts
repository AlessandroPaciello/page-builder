import type { Operation } from "./library-plan";

/**
 * Traduce le `Operation` del piano in codice `execute_code` (Story 2.4,
 * Task 5): UN'operazione per chiamata, o lotti piccoli per i container, così
 * un errore live nomina l'operazione fallita. Il writer NON esegue nulla:
 * esegue il CLI (`library-cli.ts`) via `callPenpotTool`.
 *
 * API usate (verificate con `high_level_overview`, 2026-09-12):
 * - `penpot.library.local.tokens.addSet({ name, active: true })`, `set.addToken({ type, name, value })`;
 * - board e parti con flex layout (`board.addFlexLayout()`) e
 *   `penpot.library.local.createComponent([board])` per ogni cella;
 * - `penpotUtils.createVariantContainer([{ shape, properties }...])`, NON la sequenza a basso livello;
 * - `shape.applyToken(token, [prop])`, asincrono: ~100 ms prima di rileggere;
 * - `container.setSharedPluginData("pagebuilder", "contract", contractId)`.
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

function cellStep(contract: string, containerName: string, cell: {
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
}, index: number): WriteStep {
  const cellLabel = Object.entries(cell.variantProps)
    .map(([axis, value]) => `${axis}=${value}`)
    .join("|");
  const boardName = `${containerName} ${cellLabel}`;
  const spec = {
    boardName,
    x: 240 * index,
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
  return {
    description: `createContainer "${contract}", cella "${cellLabel}"`,
    code: `
${CELL_RUNTIME}
const spec = ${literal(spec)};
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
return { componentId: component.id, name: component.name, boardName: spec.boardName };
`,
  };
}

function containerStep(containerName: string, pluginData: string, cells: ReadonlyArray<{ variantProps: Readonly<Record<string, string>> }>): WriteStep {
  const boardNames = cells.map((cell) =>
    `${containerName} ${Object.entries(cell.variantProps).map(([axis, value]) => `${axis}=${value}`).join("|")}`,
  );
  const entries = cells.map((cell, index) => ({
    name: boardNames[index],
    properties: cell.variantProps,
  }));
  return {
    description: `createVariantContainer "${containerName}" + plugin data ${pluginData}`,
    code: `
const entries = ${literal(entries)};
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
