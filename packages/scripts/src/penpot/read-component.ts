import { Lettura, PLACEMENT_PROPERTIES, registeredProperties } from "../core";
import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint, type McpCallToolResult, type McpEndpoint } from "./mcp-client";

/**
 * Adattatore Penpot `readComponent` (Story 2.23, AD-11 v3): l'unico punto
 * che legge un componente dal file Penpot vero e lo restituisce come
 * `Lettura` validata con zod. Esegue via `execute_code` il sorgente
 * {@link READ_COMPONENT_SOURCE}, che non scrive mai su Penpot (niente `set*`,
 * niente `storage`).
 *
 * Cosa legge e da dove: vedi `README.md` di questa cartella.
 */

/**
 * Le proprietà che il sorgente sa scrivere in `tokens` o in `style`. Ogni
 * proprietà del registro deve stare qui: lo controlla
 * {@link assertRegistryCovered} prima di ogni lettura. Una voce nuova del
 * registro senza la sua regola di lettura qui (e nel sorgente) ferma
 * l'adattatore, invece di arrivare al nucleo sempre assente.
 */
export const READ_PROPERTIES: readonly string[] = [
  // Riempimento e tratto (il primo della lista; gradiente e immagine come parola).
  "fill",
  "strokeColor",
  "strokeWidth",
  "strokeStyle",
  "strokeAlignment",
  // Raggio, padding e gap (> 0).
  "borderRadiusTopLeft",
  "borderRadiusTopRight",
  "borderRadiusBottomRight",
  "borderRadiusBottomLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "rowGap",
  "columnGap",
  // Testo.
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "fontFamily",
  // Opacità (≠ 1) e ombre (non vuote).
  "opacity",
  "shadow",
  // Layout del layer: valore grezzo del flex, `grid` per una griglia.
  "layoutDir",
  "layoutAlign",
  "layoutJustify",
  "layoutWrap",
  // Dimensionamento: `layoutChild`, oppure il flex del layer stesso.
  "sizingH",
  "sizingV",
  // Geometria (Story 2.21), arrotondata a 2 decimali.
  "x",
  "y",
  "width",
  "height",
  "position",
  "constraintH",
  "constraintV",
  "clip",
];

/**
 * Lancia un errore che nomina ogni proprietà del registro senza una regola
 * di lettura, e ogni voce di `read` che il sorgente non nomina né come
 * `style.<p>` né come letterale `"<p>"`. Gli argomenti servono ai test; di
 * default sono {@link READ_PROPERTIES}, il registro e
 * {@link READ_COMPONENT_SOURCE}.
 */
export function assertRegistryCovered(
  read: readonly string[] = READ_PROPERTIES,
  registered: readonly string[] = registeredProperties(),
  source: string = READ_COMPONENT_SOURCE,
): void {
  const missing = registered.filter((property) => !read.includes(property));
  if (missing.length > 0) {
    throw new Error(
      `L'adattatore Penpot non sa leggere le proprietà del registro [${missing.join(", ")}]: aggiungi a READ_PROPERTIES e al sorgente di src/penpot/read-component.ts la regola che le scrive in tokens o style.`,
    );
  }
  // La lista iniettata delle esclusioni degli override nomina tutta la geometria: non è una regola di lettura.
  const rules = source.replace(/^const PLACEMENT = .*$/m, "");
  const unwritten = read.filter((property) => !rules.includes(`style.${property}`) && !rules.includes(JSON.stringify(property)));
  if (unwritten.length > 0) {
    throw new Error(
      `READ_PROPERTIES elenca [${unwritten.join(", ")}] ma il sorgente di src/penpot/read-component.ts non le scrive (né style.<p> né "<p>"): aggiungi la regola di lettura o togli la voce.`,
    );
  }
}

/** Namespace degli shared plugin data del page builder. */
const NAMESPACE = "pagebuilder";

/**
 * Eseguito dentro il plugin Penpot. Definisce `readPenpotComponent(name)`,
 * che restituisce `{ lettura }` oppure `{ error }` (un messaggio in italiano):
 * gli errori attesi (nome ignoto, doppio, `variantError`) e quelli imprevisti
 * arrivano allo stesso modo, senza dipendere da come `execute_code` riporta
 * un'eccezione.
 */
export const READ_COMPONENT_SOURCE = `
const NAMESPACE = ${JSON.stringify(NAMESPACE)};
const PLACEMENT = ${JSON.stringify(PLACEMENT_PROPERTIES)};
const RADIUS = ["borderRadiusTopLeft", "borderRadiusTopRight", "borderRadiusBottomRight", "borderRadiusBottomLeft"];
const PADDING = [["topPadding", "paddingTop"], ["rightPadding", "paddingRight"], ["bottomPadding", "paddingBottom"], ["leftPadding", "paddingLeft"]];
const TEXT = ["fontSize", "fontWeight", "letterSpacing", "fontFamily"];

function round(value) {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}
function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isVariantContainer(shape) {
  try {
    return typeof shape.isVariantContainer === "function" && shape.isVariantContainer();
  } catch (error) {
    return false;
  }
}
function isInstanceHead(shape) {
  try {
    return shape.isComponentCopyInstance() && shape.isComponentHead();
  } catch (error) {
    return false;
  }
}
// Stesse regole di kebabOf (src/core/naming.ts).
function kebab(name) {
  return String(name)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-");
}
function contractOf(shape) {
  try {
    const value = shape.getSharedPluginData(NAMESPACE, "contract");
    return typeof value === "string" ? value : "";
  } catch (error) {
    return "";
  }
}
function pluginDataOf(shape) {
  const out = {};
  const keys = shape.getSharedPluginDataKeys(NAMESPACE) || [];
  for (const key of keys) {
    const value = shape.getSharedPluginData(NAMESPACE, key);
    if (typeof value === "string" && value.length > 0) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
function tokensOf(shape) {
  const out = {};
  const raw = shape.tokens || {};
  for (const key of Object.keys(raw)) out[key === "fontFamilies" ? "fontFamily" : key] = raw[key];
  return out;
}
function paintOf(color, gradient, image) {
  if (typeof color === "string" && color.length > 0) return color;
  if (gradient) return "gradient";
  if (image) return "image";
  return undefined;
}
function shadowOf(shadow) {
  const color = shadow.color || {};
  const inset = shadow.style === "inner-shadow" ? "inset " : "";
  const opacity = isNumber(color.opacity) && color.opacity !== 1 ? "/" + round(color.opacity) : "";
  return inset + [shadow.offsetX, shadow.offsetY, shadow.blur, shadow.spread].map((v) => (isNumber(v) ? round(v) : 0) + "px").join(" ") + " " + (color.color || "") + opacity;
}
function styleOf(shape) {
  const style = {};
  if (shape.fills === "mixed") style.fill = "mixed";
  else if (Array.isArray(shape.fills)) {
    const fill = shape.fills.find((f) => f && paintOf(f.fillColor, f.fillColorGradient, f.fillImage) !== undefined);
    if (fill) {
      style.fill = paintOf(fill.fillColor, fill.fillColorGradient, fill.fillImage);
      // Non è una voce del registro: arriva come "non registrata" (avviso) e conta negli override.
      if (isNumber(fill.fillOpacity) && fill.fillOpacity !== 1) style.fillOpacity = round(fill.fillOpacity);
    }
  }
  const strokes = Array.isArray(shape.strokes) ? shape.strokes.filter((s) => s && paintOf(s.strokeColor, s.strokeColorGradient, s.strokeImage) !== undefined) : [];
  if (strokes.length > 0) {
    const stroke = strokes[0];
    style.strokeColor = paintOf(stroke.strokeColor, stroke.strokeColorGradient, stroke.strokeImage);
    if (isNumber(stroke.strokeWidth) && stroke.strokeWidth > 0) style.strokeWidth = round(stroke.strokeWidth);
    if (typeof stroke.strokeStyle === "string") style.strokeStyle = stroke.strokeStyle;
    if (typeof stroke.strokeAlignment === "string") style.strokeAlignment = stroke.strokeAlignment;
    if (isNumber(stroke.strokeOpacity) && stroke.strokeOpacity !== 1) style.strokeOpacity = round(stroke.strokeOpacity);
  }
  for (const property of RADIUS) {
    const value = shape[property];
    if (isNumber(value) && value > 0) style[property] = round(value);
  }
  const layout = shape.flex || shape.grid;
  if (layout) {
    for (const [from, to] of PADDING) {
      const value = layout[from];
      if (isNumber(value) && value > 0) style[to] = round(value);
    }
    for (const property of ["rowGap", "columnGap"]) {
      const value = layout[property];
      if (isNumber(value) && value > 0) style[property] = round(value);
    }
  }
  if (shape.type === "text") {
    for (const property of TEXT) {
      const value = shape[property];
      if (value === undefined || value === null || value === "") continue;
      if (property === "letterSpacing" && Number(value) === 0) continue;
      style[property] = isNumber(value) ? value : String(value);
    }
  }
  if (isNumber(shape.opacity) && shape.opacity !== 1) style.opacity = round(shape.opacity);
  // Come fillOpacity: non registrata, quindi un avviso e non un layer visibile per sbaglio.
  if (shape.hidden === true) style.hidden = true;
  if (Array.isArray(shape.shadows)) {
    const shadows = shape.shadows.filter((s) => s && s.hidden !== true);
    if (shadows.length > 0) style.shadow = shadows.map(shadowOf).join(", ");
  }
  if (shape.flex) {
    const flex = shape.flex;
    if (typeof flex.dir === "string") style.layoutDir = flex.dir;
    if (typeof flex.alignItems === "string") style.layoutAlign = flex.alignItems;
    if (typeof flex.justifyContent === "string") style.layoutJustify = flex.justifyContent;
    if (typeof flex.wrap === "string") style.layoutWrap = flex.wrap;
  } else if (shape.grid) {
    style.layoutDir = "grid";
  }
  const child = shape.layoutChild;
  const own = shape.flex || shape.grid;
  const sizing = (axis) => {
    const key = axis === "H" ? "horizontalSizing" : "verticalSizing";
    if (child && typeof child[key] === "string") return child[key];
    if (own && typeof own[key] === "string") return own[key];
    return undefined;
  };
  const sizingH = sizing("H");
  const sizingV = sizing("V");
  if (sizingH !== undefined) style.sizingH = sizingH;
  if (sizingV !== undefined) style.sizingV = sizingV;
  if (isNumber(shape.width)) style.width = round(shape.width);
  if (isNumber(shape.height)) style.height = round(shape.height);
  if (isNumber(shape.parentX)) style.x = round(shape.parentX);
  if (isNumber(shape.parentY)) style.y = round(shape.parentY);
  if (typeof shape.constraintsHorizontal === "string") style.constraintH = shape.constraintsHorizontal;
  if (typeof shape.constraintsVertical === "string") style.constraintV = shape.constraintsVertical;
  if (child && child.absolute === true) style.position = "absolute";
  if (shape.type === "board" && shape.clipContent === true) style.clip = true;
  return style;
}
// Penpot non espone gli override (componentRefShape() restituisce null): si
// confrontano, per indice, token e stile dell'istanza e dei suoi discendenti
// con l'istanza principale. Collocazione e testo non contano.
function overridesOf(instance, main) {
  const out = new Set();
  const differ = (a, b) => {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (PLACEMENT.includes(key)) continue;
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) out.add(key);
    }
  };
  const compare = (a, b) => {
    if (!b || a.type !== b.type) {
      out.add("struttura");
      return;
    }
    differ(tokensOf(a), tokensOf(b));
    differ(styleOf(a), styleOf(b));
    const ca = a.children || [];
    const cb = b.children || [];
    if (cb.length > ca.length) out.add("struttura");
    ca.forEach((childA, index) => compare(childA, cb[index]));
  };
  compare(instance, main);
  return [...out].sort();
}
function instanceOf(shape) {
  const component = shape.component();
  const main = component ? component.mainInstance() : null;
  if (!component || !main) throw new Error('istanza "' + shape.name + '" senza componente d\\'origine o senza istanza principale');
  const origin = main.parent && isVariantContainer(main.parent) ? main.parent : main;
  const instance = {
    component: component.name,
    variant: JSON.parse(JSON.stringify(component.variantProps || {})),
    overrides: overridesOf(shape, main),
  };
  const contract = contractOf(origin);
  if (contract.length > 0) instance.contract = contract;
  return instance;
}
function readLayer(shape) {
  const layer = { name: shape.name, kind: shape.type, tokens: tokensOf(shape), style: styleOf(shape), children: [] };
  const pluginData = pluginDataOf(shape);
  if (pluginData) layer.pluginData = pluginData;
  if (isInstanceHead(shape)) {
    // I figli di un'istanza sono del componente annidato: non si leggono.
    layer.instance = instanceOf(shape);
    return layer;
  }
  layer.children = (shape.children || []).map(readLayer);
  return layer;
}
function candidates() {
  const byId = new Map();
  for (const component of penpot.library.local.components) {
    let main = null;
    try {
      main = component.mainInstance();
    } catch (error) {
      main = null;
    }
    if (!main) continue;
    const target = main.parent && isVariantContainer(main.parent) ? main.parent : main;
    byId.set(target.id, target);
  }
  return [...byId.values()];
}
function describe(shape) {
  const contract = contractOf(shape);
  return '"' + shape.name + '" (id ' + shape.id + (contract ? ", contract " + contract : "") + ")";
}
function readPenpotComponent(name) {
  try {
    const all = candidates();
    let found = all.filter((shape) => {
      const contract = contractOf(shape);
      return contract === name || contract.startsWith(name + "@");
    });
    if (found.length === 0) found = all.filter((shape) => shape.name === name || kebab(shape.name) === name);
    if (found.length === 0) {
      return {
        error:
          'Nessun componente "' + name + '" in Penpot: nessun container (o componente principale) ha il plugin data pagebuilder.contract "' + name + '" o "' + name + '@<versione>", e nessuno si chiama così. Componenti nel file: [' + all.map(describe).join(", ") + "].",
      };
    }
    if (found.length > 1) {
      return { error: 'Più componenti rispondono a "' + name + '": [' + found.map(describe).join(", ") + "]. Un contratto (o un nome) deve indicare un componente solo." };
    }
    const target = found[0];
    const cells = [];
    if (isVariantContainer(target)) {
      const byMain = new Map();
      for (const variant of target.variants.variantComponents()) {
        const main = variant.mainInstance();
        if (main) byMain.set(main.id, variant);
      }
      for (const board of target.children || []) {
        const variant = byMain.get(board.id);
        if (!variant) return { error: 'Componente "' + target.name + '": il layer "' + board.name + '" (id ' + board.id + ") nel container non è l'istanza principale di nessuna variante." };
        if (variant.variantError) return { error: 'Componente "' + target.name + '": la cella "' + board.name + '" ha un errore di variante (' + variant.variantError + "). Correggi il nome della variante in Penpot." };
        cells.push({ variant: JSON.parse(JSON.stringify(variant.variantProps || {})), root: readLayer(board) });
      }
    } else {
      cells.push({ variant: {}, root: readLayer(target) });
    }
    const lettura = { component: target.name, cells };
    const pluginData = pluginDataOf(target);
    if (pluginData) lettura.pluginData = pluginData;
    return { lettura };
  } catch (error) {
    return { error: 'Lettura del componente "' + name + '" fallita in Penpot: ' + (error && error.message ? error.message : String(error)) };
  }
}
`;

export type CallToolFn = (args: { name: string; arguments: { code: string } }) => Promise<McpCallToolResult>;

export interface ReadComponentOptions {
  /** Di default `resolveMcpEndpoint()` (PENPOT_MCP_URL / PENPOT_MCP_TOKEN), risolto alla chiamata. */
  endpoint?: McpEndpoint;
  /** Punto di iniezione per i test: niente rete. In produzione è assente. */
  callTool?: CallToolFn;
  timeoutMs?: number;
}

/** Leggere un componente grande richiede più del timeout di default del client. */
export const READ_COMPONENT_TIMEOUT_MS = 60_000;

/** Il codice eseguito in Penpot per il componente `name`. */
export function readComponentCode(name: string): string {
  return `${READ_COMPONENT_SOURCE}\nreturn readPenpotComponent(${JSON.stringify(name)});\n`;
}

/**
 * Legge il componente `name` (contratto `name` o `name@<versione>` nei plugin
 * data, oppure il nome del layer) e restituisce la sua `Lettura`. Ogni
 * problema è un errore esplicito: envelope malformato, componente ignoto o
 * doppio, cella con `variantError`, `Lettura` che non passa lo schema (con il
 * percorso zod).
 */
export async function readComponent(name: string, options: ReadComponentOptions = {}): Promise<Lettura> {
  assertRegistryCovered();
  if (name.trim().length === 0) throw new Error("readComponent: il nome del componente è vuoto.");
  const what = `lettura del componente "${name}"`;
  const callTool: CallToolFn =
    options.callTool ??
    ((args) => callPenpotTool(options.endpoint ?? resolveMcpEndpoint(), args, `execute_code (${what})`, options.timeoutMs ?? READ_COMPONENT_TIMEOUT_MS));
  const result = await callTool({ name: "execute_code", arguments: { code: readComponentCode(name) } });
  const envelope = parseExecuteCodeEnvelope(result, what);
  const payload = envelope.result as { error?: unknown; lettura?: unknown } | null;
  if (payload !== null && typeof payload === "object" && typeof payload.error === "string") throw new Error(payload.error);
  if (payload === null || typeof payload !== "object" || !("lettura" in payload)) {
    throw new Error(`La risposta di execute_code non contiene né "lettura" né "error" — ${what}: ${JSON.stringify(payload)?.slice(0, 200)}`);
  }
  const parsed = Lettura.safeParse(payload.lettura);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(radice)"}: ${issue.message}`);
    throw new Error(`La Lettura di "${name}" letta da Penpot non passa lo schema — ${issues.join("; ")}`);
  }
  return parsed.data;
}
