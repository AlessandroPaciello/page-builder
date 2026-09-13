import type { TokenType } from "./theme-generator";

/**
 * Registro unico delle proprietà di stile Penpot (Story 2.8 parte A, AD-11).
 *
 * Una riga per proprietà: come la legge il reader (`read`), il tipo (`kind`:
 * token con il suo tipo di token, oppure parola chiave di una lista chiusa),
 * lo stato (`supported` | `blocked` con motivo) e la mappatura dell'emitter
 * shadcn (`emit`). Reader, estrazione, `verify:library` ed emitter leggono
 * tutti da qui: non esistono più liste parallele.
 *
 * Solo due stati, nessuno skip: una proprietà o genera codice fedele o blocca
 * il componente con un errore nominativo. Una proprietà assente dal registro
 * blocca anch'essa. Sbloccarne una = una riga qui + la mappatura + un test
 * rosso/verde.
 */

/** Layer Penpot che disegnano un'icona: qui lo stroke è vettoriale e la sua geometria si ignora. */
export const ICON_LAYER_KINDS: readonly string[] = ["path", "vector", "ellipse", "line"];

/** Come il reader (codice eseguito in Penpot) valorizza la proprietà. */
export type ReadRule =
  /** `shape.fills` con `fillColor` → lista dei colori. */
  | { readonly source: "fills" }
  /** `shape.strokes` con `strokeColor` → lista dei colori. */
  | { readonly source: "strokeColor" }
  /** Primo `strokeWidth` > 0 degli stroke colorati. */
  | { readonly source: "strokeWidth" }
  /** Campo dello stroke registrato solo se diverso dal default della lista (`kind: keyword`). */
  | { readonly source: "strokeKeyword" }
  /** `shape[prop]` numerico > 0. */
  | { readonly source: "positiveNumber" }
  /** `shape[prop]` valorizzato, solo sui layer di testo. */
  | { readonly source: "text" }
  /** `shape.opacity` ≠ 1. */
  | { readonly source: "opacity" }
  /** `shape.shadows` non vuoto. */
  | { readonly source: "shadows" }
  /** Non letta dal reader: il motivo è dichiarato. */
  | { readonly source: "notRead"; readonly reason: string };

export type PropertyKind =
  | { readonly kind: "token"; readonly tokenType: TokenType }
  | { readonly kind: "keyword"; readonly values: readonly string[]; readonly default: string };

export type PropertyState = { readonly state: "supported" } | { readonly state: "blocked"; readonly reason: string };

/** Mappatura dell'emitter shadcn. */
export type EmitRule =
  /** Classe `<prefisso>-<suffisso token>`; il prefisso può dipendere dal tipo di layer. */
  | { readonly emit: "utility"; readonly prefix: string; readonly byLayerKind?: Readonly<Record<string, string>> }
  /** Angolo del radius (`rounded-tl-<sfx>`…), collassato in `rounded-<sfx>` se i quattro angoli coincidono. */
  | { readonly emit: "radiusCorner"; readonly corner: string }
  /**
   * Nessuna classe emessa: il valore del token deve coincidere con quello che
   * la base shadcn già esprime per quella parte (classi strutturali del
   * binding con lo stesso prefisso di stato). Se non coincide, o la base non
   * esprime nulla, il componente si blocca (decisione di Alessandro,
   * 2026-09-13).
   */
  | {
      readonly emit: "coveredByBase";
      /** Valore espresso da una classe della base, `null` se la classe non riguarda la proprietà. */
      readonly baseValue: (className: string) => number | null;
      readonly baseDescription: string;
    }
  /** Proprietà bloccata: nessuna mappatura. */
  | { readonly emit: "none" };

export interface PropertyDefinition {
  readonly read: ReadRule;
  readonly type: PropertyKind;
  readonly status: PropertyState;
  readonly emitter: EmitRule;
  /**
   * Regola dichiarata: sui layer di questi tipi la proprietà è geometria
   * dell'icona e si ignora (AD-11), non per omissione.
   */
  readonly ignoreOnLayerKinds?: readonly string[];
}

const SUPPORTED: PropertyState = { state: "supported" };

/** Tipo token con `kind` letterale: `StyleProperty` si deriva filtrando `kind: "token"`. */
const token = <T extends TokenType>(tokenType: T): { readonly kind: "token"; readonly tokenType: T } => ({
  kind: "token",
  tokenType,
});

/** Larghezze del bordo espresse dalle classi Tailwind senza valore (sempre 1px). */
const ONE_PX_BORDER_CLASSES = new Set(["border", "border-t", "border-r", "border-b", "border-l", "border-x", "border-y"]);

const OPACITY_CLASS = /^opacity-(\d+)$/;

/**
 * Il registro. L'ordine delle righe è quello in cui il reader scrive le
 * chiavi di `style` (fixture byte-identiche).
 */
export const STYLE_PROPERTIES = {
  fill: {
    read: { source: "fills" },
    type: token("color"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "bg", byLayerKind: { text: "text" } },
  },
  strokeColor: {
    read: { source: "strokeColor" },
    type: token("color"),
    status: SUPPORTED,
    emitter: {
      emit: "utility",
      prefix: "border",
      byLayerKind: Object.fromEntries(ICON_LAYER_KINDS.map((kind) => [kind, "stroke"])),
    },
  },
  strokeWidth: {
    read: { source: "strokeWidth" },
    type: token("borderWidth"),
    status: SUPPORTED,
    emitter: {
      emit: "coveredByBase",
      baseValue: (className) => (ONE_PX_BORDER_CLASSES.has(className) ? 1 : null),
      baseDescription: "border / border-t / border-b / … = 1px",
    },
    ignoreOnLayerKinds: ICON_LAYER_KINDS,
  },
  strokeStyle: {
    read: { source: "strokeKeyword" },
    type: { kind: "keyword", values: ["solid", "dashed", "dotted"], default: "solid" },
    status: {
      state: "blocked",
      reason: "il tratteggio non ha ancora una mappatura nell'emitter: resta bloccato finché un componente reale non lo richiede",
    },
    emitter: { emit: "none" },
  },
  strokeAlignment: {
    read: { source: "strokeKeyword" },
    type: { kind: "keyword", values: ["inner", "center", "outer"], default: "inner" },
    status: {
      state: "blocked",
      reason:
        "solo \"inner\" corrisponde al bordo CSS (box-sizing: border-box); center/outer non hanno una mappatura nell'emitter",
    },
    emitter: { emit: "none" },
  },
  borderRadiusTopLeft: {
    read: { source: "positiveNumber" },
    type: token("borderRadius"),
    status: SUPPORTED,
    emitter: { emit: "radiusCorner", corner: "rounded-tl" },
  },
  borderRadiusTopRight: {
    read: { source: "positiveNumber" },
    type: token("borderRadius"),
    status: SUPPORTED,
    emitter: { emit: "radiusCorner", corner: "rounded-tr" },
  },
  borderRadiusBottomRight: {
    read: { source: "positiveNumber" },
    type: token("borderRadius"),
    status: SUPPORTED,
    emitter: { emit: "radiusCorner", corner: "rounded-br" },
  },
  borderRadiusBottomLeft: {
    read: { source: "positiveNumber" },
    type: token("borderRadius"),
    status: SUPPORTED,
    emitter: { emit: "radiusCorner", corner: "rounded-bl" },
  },
  paddingTop: {
    read: { source: "positiveNumber" },
    type: token("spacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "pt" },
  },
  paddingRight: {
    read: { source: "positiveNumber" },
    type: token("spacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "pr" },
  },
  paddingBottom: {
    read: { source: "positiveNumber" },
    type: token("spacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "pb" },
  },
  paddingLeft: {
    read: { source: "positiveNumber" },
    type: token("spacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "pl" },
  },
  rowGap: {
    read: { source: "positiveNumber" },
    type: token("spacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "gap-y" },
  },
  columnGap: {
    read: { source: "positiveNumber" },
    type: token("spacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "gap-x" },
  },
  fontSize: {
    read: { source: "text" },
    type: token("fontSizes"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "text" },
  },
  fontWeight: {
    read: { source: "text" },
    type: token("fontWeights"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "font" },
  },
  letterSpacing: {
    read: { source: "text" },
    type: token("letterSpacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "tracking" },
  },
  opacity: {
    read: { source: "opacity" },
    type: token("opacity"),
    status: SUPPORTED,
    emitter: {
      emit: "coveredByBase",
      baseValue: (className) => {
        const match = OPACITY_CLASS.exec(className);
        return match === null ? null : Number(match[1]) / 100;
      },
      baseDescription: "opacity-N = N/100 (es. disabled:opacity-50 = 0.5)",
    },
  },
  shadow: {
    read: { source: "shadows" },
    type: token("shadow"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "shadow" },
  },
  fontFamilies: {
    read: {
      source: "notRead",
      reason: "applyToken non supporta i token fontFamilies su Penpot 2.17.2 (Story 2.4): il font resta una scelta del designer",
    },
    type: token("fontFamilies"),
    status: {
      state: "blocked",
      reason: "applyToken non supporta i token fontFamilies su Penpot 2.17.2 (Story 2.4) e l'emitter non ha una mappatura",
    },
    emitter: { emit: "none" },
  },
} as const satisfies Record<string, PropertyDefinition>;

/** Nome di una proprietà registrata (i nomi `TokenProperty` di Penpot). */
export type RegisteredProperty = keyof typeof STYLE_PROPERTIES;

const REGISTRY: Readonly<Record<string, PropertyDefinition>> = STYLE_PROPERTIES;

export function registeredProperties(): RegisteredProperty[] {
  return Object.keys(STYLE_PROPERTIES) as RegisteredProperty[];
}

/** La riga del registro, o `undefined` se la proprietà non è registrata. */
export function propertyDefinition(property: string): PropertyDefinition | undefined {
  return Object.hasOwn(REGISTRY, property) ? REGISTRY[property] : undefined;
}

/** Dove si trova la proprietà: tutto ciò che serve a un errore nominativo. */
export interface PropertyLocation {
  readonly component?: string;
  readonly part?: string;
  readonly cell?: string;
  /** Valore grezzo letto da Penpot (stile). */
  readonly value?: unknown;
  /** Token legato alla proprietà. */
  readonly token?: string;
}

function describeLocation(property: string, where: PropertyLocation): string {
  const pieces: string[] = [];
  if (where.component !== undefined) pieces.push(`componente "${where.component}"`);
  if (where.part !== undefined) pieces.push(`parte "${where.part}"`);
  if (where.cell !== undefined) pieces.push(`cella "${where.cell}"`);
  pieces.push(`proprietà "${property}"`);
  if (where.token !== undefined) pieces.push(`token "${where.token}"`);
  if (where.value !== undefined) pieces.push(`valore ${JSON.stringify(where.value)}`);
  return pieces.join(", ");
}

const UNLOCK_HINT = "sbloccarla = una riga del registro (style-properties.ts) + la mappatura + un test rosso/verde";

/**
 * Il problema di una proprietà in un punto, o `null` se è usabile. Ordine:
 * non registrata → valore fuori lista (parola chiave) → parola chiave legata
 * a un token → bloccata.
 */
export function propertyProblem(property: string, where: PropertyLocation): string | null {
  const definition = propertyDefinition(property);
  const location = describeLocation(property, where);
  if (definition === undefined) {
    return `Proprietà non registrata (${location}): il registro delle proprietà non la conosce — ${UNLOCK_HINT}.`;
  }
  if (definition.type.kind === "keyword") {
    if (where.token !== undefined) {
      return `Proprietà a parola chiave legata a un token (${location}): "${property}" ammette solo i valori [${definition.type.values.join(", ")}], senza token.`;
    }
    if (where.value !== undefined && !definition.type.values.includes(String(where.value))) {
      return `Valore fuori lista (${location}): "${property}" ammette solo [${definition.type.values.join(", ")}].`;
    }
  }
  if (definition.status.state === "blocked") {
    return `Proprietà bloccata (${location}): ${definition.status.reason} — ${UNLOCK_HINT}.`;
  }
  return null;
}

/** Come `propertyProblem`, ma lancia: restituisce la riga del registro di una proprietà usabile. */
export function lookupProperty(property: string, where: PropertyLocation = {}): PropertyDefinition {
  const problem = propertyProblem(property, where);
  if (problem !== null) throw new Error(problem);
  return propertyDefinition(property)!;
}

/** Layer minimo su cui controllare le proprietà (stessa forma di `SnapshotLayer`). */
interface LayerLike {
  readonly name: string;
  readonly tokens: Readonly<Record<string, string>>;
  readonly style: Readonly<Record<string, unknown>>;
  readonly children: readonly LayerLike[];
}

/**
 * Tutti i problemi di proprietà di un albero di layer (stile e binding):
 * condiviso da estrazione e `verify:library`. La board radice è la parte
 * "root" (stessa convenzione di `partBindings`), gli altri layer contano per
 * nome. Una proprietà presente sia nello stile sia nei token è segnalata una
 * volta sola.
 */
export function layerTreeProblems(root: LayerLike, where: { component?: string; cell?: string }): string[] {
  const problems: string[] = [];
  const visit = (layer: LayerLike, part: string): void => {
    const properties = [...new Set([...Object.keys(layer.style), ...Object.keys(layer.tokens)])];
    for (const property of properties) {
      const problem = propertyProblem(property, {
        ...where,
        part,
        ...(Object.hasOwn(layer.style, property) ? { value: layer.style[property] } : {}),
        ...(Object.hasOwn(layer.tokens, property) ? { token: layer.tokens[property] } : {}),
      });
      if (problem !== null) problems.push(problem);
    }
    for (const child of layer.children) visit(child, child.name);
  };
  visit(root, "root");
  return problems;
}

/** Proprietà che il reader legge con una data regola, nell'ordine del registro. */
export function propertiesReadAs(source: ReadRule["source"]): RegisteredProperty[] {
  return registeredProperties().filter((property) => STYLE_PROPERTIES[property].read.source === source);
}

/** Proprietà a parola chiave lette dagli stroke, con il default che non si registra. */
export function strokeKeywordReads(): Array<{ prop: RegisteredProperty; default: string }> {
  return propertiesReadAs("strokeKeyword").map((property) => {
    const type = STYLE_PROPERTIES[property].type;
    if (type.kind !== "keyword") {
      throw new Error(`Registro incoerente: "${property}" è letta come parola chiave ma il suo tipo è "${type.kind}".`);
    }
    return { prop: property, default: type.default };
  });
}

/** Prefissi degli angoli radius, nell'ordine del registro (per il collapse in `rounded-<sfx>`). */
export function radiusCorners(): string[] {
  return registeredProperties().flatMap((property) => {
    const emitter: EmitRule = STYLE_PROPERTIES[property].emitter;
    return emitter.emit === "radiusCorner" ? [emitter.corner] : [];
  });
}
