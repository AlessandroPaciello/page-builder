import { byString, SIZING_DEFAULT, SIZING_VALUES, variantLabel, withInvalidAnswer } from "./internal";
import type { Cella, Finding, LetturaLayer } from "./schemas";

/**
 * Geometria del registro (Story 2.21, forgia dei punti aperti v3: regola a′,
 * fuori scala, ritaglio, vincoli, "fill" dentro hug).
 *
 * Le voci di geometria (`GEOMETRY_ENTRIES`, chiavi di `style`) non si
 * traducono da sole: `layerClasses` le valida una per una, poi le regole di
 * contesto qui sotto leggono il layer, il genitore, i figli e le celle. Un
 * valore malformato non entra mai in una regola: per il layer stesso dà
 * l'avviso di `layerClasses`, per genitore e figli conta come assente.
 *
 * Misure e posizioni diventano classi sulla scala del tema: i token `spacing`
 * (`scale`), non i multipli di 4px, perché un tema può ridefinire un passo
 * (`--spacing-5` = 24px). Fuori scala si usa un valore arbitrario (`w-[37px]`)
 * con un avviso che nomina il passo più vicino.
 */

/** Un passo della scala: il suffisso del token `spacing` (`varSuffix`) e il suo valore in px. */
export interface ScaleStep {
  readonly suffix: string;
  readonly px: number;
}

export type Scale = readonly ScaleStep[];

/** Voce di geometria del registro: un numero (px), un interruttore o una parola chiave di una lista chiusa. */
export interface GeometryEntry {
  readonly kind: "geometry";
  readonly valueType: "number" | "boolean" | "string";
  /** Solo per `valueType: "string"`: i valori ammessi. */
  readonly values?: readonly string[];
  /** Solo per `valueType: "string"`: il valore quando la chiave manca. */
  readonly default?: string;
  /** Solo per `valueType: "number"`: il minimo ammesso. */
  readonly min?: number;
}

const length = (min?: number): GeometryEntry => (min === undefined ? { kind: "geometry", valueType: "number" } : { kind: "geometry", valueType: "number", min });

const list = (values: readonly string[], defaultValue: string): GeometryEntry => ({ kind: "geometry", valueType: "string", values, default: defaultValue });

/**
 * `x`/`y` sono relativi all'angolo del genitore, `width`/`height` sono la
 * misura del layer, tutto in px. `clip` assente = nessun ritaglio.
 */
export const GEOMETRY_ENTRIES = {
  x: length(),
  y: length(),
  width: length(0),
  height: length(0),
  position: list(["flow", "absolute"], "flow"),
  constraintH: list(["left", "right", "leftright", "center", "scale"], "left"),
  constraintV: list(["top", "bottom", "topbottom", "center", "scale"], "top"),
  clip: { kind: "geometry", valueType: "boolean" },
} as const satisfies Record<string, GeometryEntry>;

export type GeometryProperty = keyof typeof GEOMETRY_ENTRIES;

/** Il valore va bene per la voce? */
export function isValidGeometry(entry: GeometryEntry, value: unknown): boolean {
  if (entry.valueType === "boolean") return typeof value === "boolean";
  if (entry.valueType === "number") return typeof value === "number" && Number.isFinite(value) && (entry.min === undefined || value >= entry.min);
  return typeof value === "string" && (entry.values ?? []).includes(value);
}

/** Cosa ammette la voce, per gli avvisi. */
export function describeGeometry(entry: GeometryEntry): string {
  if (entry.valueType === "boolean") return "true o false";
  if (entry.valueType === "number") return entry.min === undefined ? "un numero (px)" : `un numero ≥ ${entry.min} (px)`;
  return `uno di [${(entry.values ?? []).join(", ")}]`;
}

function styleOf(layer: LetturaLayer, property: string): unknown {
  return Object.hasOwn(layer.style, property) ? layer.style[property] : undefined;
}

/** Il numero valido della voce, `undefined` se manca o è malformato. */
function num(layer: LetturaLayer, property: "x" | "y" | "width" | "height"): number | undefined {
  const value = styleOf(layer, property);
  return isValidGeometry(GEOMETRY_ENTRIES[property], value) ? (value as number) : undefined;
}

/** La parola chiave valida della voce, il default se manca o è malformata. */
function pick(layer: LetturaLayer, property: "position" | "constraintH" | "constraintV"): string {
  const value = styleOf(layer, property);
  const entry: GeometryEntry = GEOMETRY_ENTRIES[property];
  return isValidGeometry(entry, value) ? (value as string) : entry.default!;
}

const isAbsolute = (layer: LetturaLayer): boolean => pick(layer, "position") === "absolute";

export type Axis = "H" | "V";

/** Dimensionamento del layer sull'asse (`auto` = hug); `fix` se manca, `undefined` se malformato. */
export function sizingOf(layer: LetturaLayer, axis: Axis): string | undefined {
  const value = styleOf(layer, `sizing${axis}`);
  if (value === undefined) return SIZING_DEFAULT;
  return typeof value === "string" && (SIZING_VALUES as readonly string[]).includes(value) ? value : undefined;
}

/**
 * Tutti i figli nel flusso sono "fill" sull'asse: Penpot impone "fix" al
 * genitore, ma la misura la decide chi lo contiene, quindi quella del
 * genitore si ignora. Gli assoluti non contano: non stanno nel flusso.
 */
export function allChildrenFill(layer: LetturaLayer, axis: Axis): boolean {
  const flow = layer.children.filter((child) => !isAbsolute(child));
  return flow.length > 0 && flow.every((child) => sizingOf(child, axis) === "fill");
}

/** Classe di una misura o distanza sulla scala del tema; `nearest` solo se fuori scala. */
export interface ScaleClass {
  readonly cls: string;
  readonly offScale: boolean;
  /** Il passo più vicino (a parità di distanza il più piccolo), se la scala non è vuota. */
  readonly nearest?: ScaleStep;
}

/**
 * `prefix` + misura in px → `w-<sfx>` se un token `spacing` vale esattamente
 * quella misura, altrimenti `w-[37px]`. Negativi: `-left-<sfx>` o
 * `left-[-3px]`. Zero: `<prefix>-0`, sempre in Tailwind.
 */
export function scaleClass(prefix: string, px: number, scale: Scale): ScaleClass {
  if (px === 0) return { cls: `${prefix}-0`, offScale: false };
  const size = Math.abs(px);
  const sign = px < 0 ? "-" : "";
  // Più token con la stessa misura: vince il suffisso minore, così il risultato non dipende dall'ordine del catalogo.
  const exact = scale.filter((step) => step.px === size).sort((a, b) => byString(a.suffix, b.suffix))[0];
  if (exact !== undefined) return { cls: `${sign}${prefix}-${exact.suffix}`, offScale: false };
  let nearest: ScaleStep | undefined;
  for (const step of scale) {
    if (!Number.isFinite(step.px)) continue;
    const distance = Math.abs(step.px - size);
    const best = nearest === undefined ? Infinity : Math.abs(nearest.px - size);
    if (distance < best || (distance === best && step.px < nearest!.px)) nearest = step;
  }
  return nearest === undefined ? { cls: `${prefix}-[${px}px]`, offScale: true } : { cls: `${prefix}-[${px}px]`, offScale: true, nearest };
}

/** I prefissi delle classi di misura e di posizione (livello 4). */
export const GEOMETRY_PREFIXES = ["w", "h", "left", "right", "top", "bottom"] as const;

/** Le classi fisse della geometria (livello 4). */
export const GEOMETRY_FIXED_CLASSES = [
  "absolute",
  "relative",
  "overflow-hidden",
  "left-1/2",
  "-translate-x-1/2",
  "top-1/2",
  "-translate-y-1/2",
] as const;

/** Chiave di plugin data della risposta "ritaglio": `hidden` | `visible`. */
export const OVERFLOW_KEY = "overflow";

export const OVERFLOW_ANSWERS = ["hidden", "visible"] as const;

/** Proprietà del raggio: un genitore con raggio taglia i figli che toccano un bordo. */
const RADIUS_PROPERTIES = ["borderRadiusTopLeft", "borderRadiusTopRight", "borderRadiusBottomRight", "borderRadiusBottomLeft"];

/** Layer dal contenuto variabile: un testo (lo riempie un field, lo decide il TSX), un'immagine, uno slot. */
export function hasVariableContent(layer: LetturaLayer): boolean {
  return layer.kind === "text" || layer.kind === "image" || layer.pluginData?.slot !== undefined;
}

function hasVariableDescendant(layer: LetturaLayer): boolean {
  return layer.children.some((child) => hasVariableContent(child) || hasVariableDescendant(child));
}

interface Box {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}

const boxOf = (layer: LetturaLayer): Box => ({ x: num(layer, "x"), y: num(layer, "y"), width: num(layer, "width"), height: num(layer, "height") });

/** Il figlio esce dal riquadro del genitore (misure mancanti = quel lato non si sa, non esce). */
function exits(child: Box, width?: number, height?: number): boolean {
  if (child.x !== undefined && child.x < 0) return true;
  if (child.y !== undefined && child.y < 0) return true;
  if (width !== undefined && child.x !== undefined && child.width !== undefined && child.x + child.width > width) return true;
  return height !== undefined && child.y !== undefined && child.height !== undefined && child.y + child.height > height;
}

/** Il figlio tocca un bordo del genitore. */
function touchesEdge(child: Box, width?: number, height?: number): boolean {
  if (child.x === 0 || child.y === 0) return true;
  if (width !== undefined && child.x !== undefined && child.width !== undefined && child.x + child.width === width) return true;
  return height !== undefined && child.y !== undefined && child.height !== undefined && child.y + child.height === height;
}

/** Una domanda la cui risposta `pds-code` scriverà nella chiave di plugin data `key`. */
export interface GeometryQuestion {
  readonly key: string;
  readonly message: string;
  readonly options: readonly string[];
}

export interface GeometryInput {
  /** Il genitore; assente = il layer è la radice della cella. */
  readonly parent?: LetturaLayer;
  readonly scale: Scale;
}

export interface GeometryResult {
  readonly classes: string[];
  readonly findings: Finding[];
}

interface AxisNames {
  readonly size: "width" | "height";
  readonly pos: "x" | "y";
  readonly constraint: "constraintH" | "constraintV";
  readonly measure: "w" | "h";
  readonly start: "left" | "top";
  readonly end: "right" | "bottom";
  readonly stretch: "leftright" | "topbottom";
  readonly center: readonly string[];
  readonly label: string;
}

const AXES: Readonly<Record<Axis, AxisNames>> = {
  H: {
    size: "width",
    pos: "x",
    constraint: "constraintH",
    measure: "w",
    start: "left",
    end: "right",
    stretch: "leftright",
    center: ["left-1/2", "-translate-x-1/2"],
    label: "orizzontale",
  },
  V: {
    size: "height",
    pos: "y",
    constraint: "constraintV",
    measure: "h",
    start: "top",
    end: "bottom",
    stretch: "topbottom",
    center: ["top-1/2", "-translate-y-1/2"],
    label: "verticale",
  },
};

function offScaleMessage(what: string, px: number, result: ScaleClass): string {
  const near =
    result.nearest === undefined
      ? "la scala spacing del tema è vuota"
      : `il passo più vicino è --spacing-${result.nearest.suffix} (${result.nearest.px}px)`;
  return `${what} ${px}px fuori scala: classe arbitraria "${result.cls}", ${near}. Usa un passo della scala in Penpot o aggiungi un token spacing da ${Math.abs(px)}px.`;
}

/**
 * Le classi di geometria di un layer: misura fissa (regola a′), posizione
 * degli assoluti con i vincoli, `relative` se ha figli assoluti, ritaglio.
 * Gli avvisi sono nell'ordine delle regole, le classi non sono ordinate
 * (le ordina `layerClasses`).
 */
export function geometryClasses(layer: LetturaLayer, input: GeometryInput): GeometryResult {
  const { parent, scale } = input;
  const where = `layer "${layer.name}"`;
  const out: string[] = [];
  const findings: Finding[] = [];
  const warn = (message: string): void => {
    findings.push({ level: "avviso", where, message });
  };
  const emit = (prefix: string, px: number, what: string): void => {
    const result = scaleClass(prefix, px, scale);
    out.push(result.cls);
    if (result.offScale) warn(offScaleMessage(what, px, result));
  };

  // La radice non è mai posizionata: lo è l'istanza, nel componente che la contiene.
  const positioned = parent !== undefined && isAbsolute(layer);
  if (positioned) out.push("absolute");
  // Un layer `absolute` fa già da riferimento ai suoi figli assoluti: `relative` gli toglierebbe la posizione.
  else if (layer.children.some(isAbsolute)) out.push("relative");

  for (const axis of ["H", "V"] as const) {
    const names = AXES[axis];
    // Radice: la misura la decidono le celle (`rootSizeClasses`).
    let measured = parent !== undefined && sizingOf(layer, axis) === "fix" && !allChildrenFill(layer, axis);
    if (parent !== undefined && isAbsolute(layer)) {
      const constraint = pick(layer, names.constraint);
      const pos = num(layer, names.pos);
      const size = num(layer, names.size);
      const parentSize = num(parent, names.size);
      const missing = (what: string): void => {
        warn(`Layer assoluto con vincolo ${names.label} "${constraint}" senza ${what} valido: nessuna classe di posizione ${names.label}.`);
      };
      const endOffset = (): number | undefined =>
        pos === undefined || size === undefined || parentSize === undefined ? undefined : parentSize - pos - size;
      if (constraint === names.start || constraint === names.stretch) {
        if (pos === undefined) missing(`"${names.pos}"`);
        else emit(names.start, pos, `Posizione "${names.start}"`);
      }
      if (constraint === names.end || constraint === names.stretch) {
        const offset = endOffset();
        if (offset === undefined) missing(`"${names.pos}", "${names.size}" o "${names.size}" del genitore`);
        else emit(names.end, offset, `Posizione "${names.end}"`);
      }
      // Ancorato ai due lati: la misura viene dai lati, non da `w-`/`h-`.
      if (constraint === names.stretch) measured = false;
      if (constraint === "center") {
        out.push(...names.center);
        if (pos !== undefined && size !== undefined && parentSize !== undefined && 2 * pos + size !== parentSize) {
          warn(
            `Layer centrato in ${names.label} ma non esattamente (${names.pos} ${pos}px, ${names.size} ${size}px, genitore ${parentSize}px): la classe lo centra davvero. Centralo in Penpot o cambia vincolo.`,
          );
        }
      }
      if (constraint === "scale") {
        measured = false;
        warn(
          `Vincolo ${names.label} "scale" non tradotto: nessuna classe ${names.label}. Usa un altro vincolo in Penpot, oppure per tradurlo aggiungi la regola in src/core/geometry.ts con un test rosso/verde.`,
        );
      }
    }
    if (measured) {
      const size = num(layer, names.size);
      if (size !== undefined) emit(names.measure, size, `Misura "${names.size}"`);
    }
  }

  if (styleOf(layer, "clip") === true) {
    const width = num(layer, "width");
    const height = num(layer, "height");
    const boxes = layer.children.map(boxOf);
    const hasRadius = RADIUS_PROPERTIES.some((property) => Object.hasOwn(layer.tokens, property) || Object.hasOwn(layer.style, property));
    const cut = boxes.some((box) => exits(box, width, height)) || (hasRadius && boxes.some((box) => touchesEdge(box, width, height)));
    if (cut) out.push("overflow-hidden");
    else if (hasVariableDescendant(layer)) {
      const answer = layer.pluginData?.[OVERFLOW_KEY];
      if (answer === "hidden") out.push("overflow-hidden");
      else if (answer !== "visible") {
        findings.push({
          level: "domanda",
          where,
          key: OVERFLOW_KEY,
          message: withInvalidAnswer(
            `Il layer ritaglia il contenuto ("clip") e oggi niente esce, ma un discendente ha contenuto variabile (testo, immagine o slot): "hidden" lo taglia se cresce (e taglia anche l'anello di focus), "visible" lo lascia uscire.`,
            answer,
          ),
          options: [...OVERFLOW_ANSWERS],
        });
      }
    }
  }

  return { classes: out, findings };
}

function rootMeasure(root: LetturaLayer, axis: Axis): number | undefined {
  if (sizingOf(root, axis) !== "fix" || allChildrenFill(root, axis)) return undefined;
  return num(root, AXES[axis].size);
}

export interface RootSizeClasses {
  /** Le classi di misura della radice, una lista per cella, nell'ordine delle celle. */
  readonly classes: string[][];
  readonly findings: Finding[];
}

/**
 * Le misure fisse della radice, per cella. Su un asse dove la misura è
 * uguale in tutte le celle non ci sono classi: la decide chi usa il
 * componente. Se varia, ogni cella ha la sua classe (la `cva` della Story
 * 2.22 le raggruppa sotto l'asse).
 */
export function rootSizeClasses(cells: readonly Cella[], input: { readonly scale: Scale }): RootSizeClasses {
  const classes: string[][] = cells.map(() => []);
  const findings: Finding[] = [];
  for (const axis of ["H", "V"] as const) {
    const measures = cells.map((cell) => rootMeasure(cell.root, axis));
    if (new Set(measures).size <= 1) continue;
    cells.forEach((cell, i) => {
      const px = measures[i];
      if (px === undefined) return;
      const result = scaleClass(AXES[axis].measure, px, input.scale);
      classes[i]!.push(result.cls);
      if (result.offScale) {
        findings.push({ level: "avviso", where: `layer "${cell.root.name}" (cella ${variantLabel(cell.variant)})`, message: offScaleMessage(`Misura "${AXES[axis].size}"`, px, result) });
      }
    });
  }
  return { classes: classes.map((list) => [...new Set(list)].sort()), findings };
}


/**
 * La scala del tema dal CSS generato (Story 2.22, voce deferred della 2.21):
 * ogni `--spacing-<sfx>: <n>px;`. La base `--spacing` (senza suffisso) e i
 * valori non in px non sono passi. Un suffisso ripetuto vale la prima volta.
 */
export function scaleFromThemeCss(css: string): Scale {
  const steps = new Map<string, number>();
  for (const [, suffix, px] of css.matchAll(/^\s*--spacing-([\w-]+)\s*:\s*(-?\d+(?:\.\d+)?)px\s*;/gm)) {
    if (!steps.has(suffix!)) steps.set(suffix!, Number(px));
  }
  return [...steps].map(([suffix, px]) => ({ suffix, px }));
}
