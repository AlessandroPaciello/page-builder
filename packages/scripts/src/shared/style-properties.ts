import { pascalCase } from "./naming";
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
 *
 * Dalla Story 2.12 (v2, CAP-3) il registro impara anche `layout` (direzione,
 * allineamento, giustificazione, wrap — i gap sono `rowGap`/`columnGap`) e
 * `position` (assoluta, x, y, z-index), letti dal layer Penpot per le parti
 * `surface`/`image`: nessuna classe Tailwind di layout entra a mano. Il
 * vocabolario dei ruoli di parte (`PART_ROLES`, con `image`) vive qui: è il
 * registro a possedere la tabella ruolo → proprietà.
 */

/**
 * Ruolo di parte (AD-11 v2): che cosa la parte È, dichiarato nel contratto
 * di estrazione e mai in Penpot. Vocabolario chiuso:
 * - `surface` → contenitore (sfondo, bordo, raggio, spaziatura, layout, posizione);
 * - `text`    → testo;
 * - `icon`    → icona vettoriale;
 * - `divider` → separatore (solo tratto);
 * - `image`   → immagine: raggio, opacità, layout, posizione e NESSUN `fill`
 *               (unica eccezione a "token su ogni stile": il contenuto arriva dal field).
 * `PART_ROLES` di `@app/contracts` (4 ruoli) è l'estensione deprecata della v1.
 */
export const PART_ROLES = ["surface", "text", "icon", "divider", "image"] as const;

export type PartRole = (typeof PART_ROLES)[number];

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
  /**
   * Flex layout della board (`shape.flex`, Story 2.12): `dir`, `alignItems`,
   * `justifyContent`, `wrap`. Registrata solo se diversa dal default della
   * lista (`kind: keyword`). I gap del flex sono `rowGap`/`columnGap`.
   */
  | { readonly source: "flexLayout"; readonly field: "dir" | "alignItems" | "justifyContent" | "wrap" }
  /**
   * Posizione del layer nel genitore (Story 2.12): `shape.layoutChild.absolute`
   * (parola chiave), `shape.parentX`/`parentY` (token di spaziatura),
   * `shape.layoutChild.zIndex` (parola chiave). Verifica sul reader MCP: Story 2.13.
   */
  | { readonly source: "layoutChild"; readonly field: "absolute" | "x" | "y" | "zIndex" }
  /** Non letta dal reader: il motivo è dichiarato. */
  | { readonly source: "notRead"; readonly reason: string };

export type PropertyKind =
  | { readonly kind: "token"; readonly tokenType: TokenType }
  | { readonly kind: "keyword"; readonly values: readonly string[]; readonly default: string };

export type PropertyState = { readonly state: "supported" } | { readonly state: "blocked"; readonly reason: string };

/** Mappatura dell'emitter shadcn. */
export type EmitRule =
  /**
   * Classe `<prefisso>-<suffisso token>`; il prefisso può dipendere dal tipo
   * di layer. `removalClass` (Story 2.8 parte C) è la classe fissa di
   * rimozione per variante: quando la proprietà è assente da una cella option
   * non default ma presente nel default, la variante emette quella classe al
   * posto del token. `string` = una classe per ogni tipo di layer; object =
   * chiavi PREFISSI utility (`bg`, `text`…): l'emitter risolve il prefisso
   * con la STESSA logica del ramo positivo (`byLayerKind[kind] ?? prefix`) e
   * cerca la classe per quel prefisso — la rimozione annulla la STESSA
   * utility che il default emette (es. `fill`: `bg-transparent` sui layer
   * bg, `text-transparent` sui text). NON deriva dal vocabolario token
   * (`transparent` non è un token): è dichiarata qui, una volta per tutte —
   * sbloccarla è una riga del registro.
   */
  | {
      readonly emit: "utility";
      readonly prefix: string;
      readonly byLayerKind?: Readonly<Record<string, string>>;
      readonly removalClass?: string | Readonly<Record<string, string>>;
    }
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
  /**
   * Parola chiave → classi fisse (Story 2.12): per una proprietà `kind:
   * keyword` ogni valore della lista ha le sue classi (es. `layoutDir`:
   * `column` → `flex flex-col`). Le classi sono strutturali, dichiarate qui
   * e mai derivate dal vocabolario token. Solo il render v2 le consuma.
   */
  | { readonly emit: "keywordClass"; readonly classes: Readonly<Record<string, string>> }
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
    // Rimozione per PREFISSO utility risolto (Story 2.8 parte C): l'emitter
    // risolve `byLayerKind[kind] ?? prefix` come nel ramo positivo e cerca
    // qui. `bg-transparent` annulla `bg-*` sui layer bg, `text-transparent`
    // annulla `text-*` sui text. `transparent` non è un token: le classi sono
    // strutturali, dichiarate qui e NON derivate dal vocabolario.
    emitter: { emit: "utility", prefix: "bg", byLayerKind: { text: "text" }, removalClass: { bg: "bg-transparent", text: "text-transparent" } },
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
  // ---- Layout e posizione (Story 2.12, CAP-3): letti dal layer Penpot, mai
  // ---- scritti a mano. In coda al registro: l'ordine delle righe sopra è
  // ---- quello delle chiavi di `style` nelle fixture v1 (byte-identiche).
  layoutDir: {
    read: { source: "flexLayout", field: "dir" },
    type: { kind: "keyword", values: ["row", "column"], default: "row" },
    status: SUPPORTED,
    emitter: { emit: "keywordClass", classes: { row: "flex flex-row", column: "flex flex-col" } },
  },
  layoutAlign: {
    read: { source: "flexLayout", field: "alignItems" },
    type: { kind: "keyword", values: ["start", "center", "end", "stretch", "baseline"], default: "stretch" },
    status: SUPPORTED,
    emitter: {
      emit: "keywordClass",
      classes: { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch", baseline: "items-baseline" },
    },
  },
  layoutJustify: {
    read: { source: "flexLayout", field: "justifyContent" },
    type: { kind: "keyword", values: ["start", "center", "end", "space-between", "space-around", "space-evenly"], default: "start" },
    status: SUPPORTED,
    emitter: {
      emit: "keywordClass",
      classes: {
        start: "justify-start",
        center: "justify-center",
        end: "justify-end",
        "space-between": "justify-between",
        "space-around": "justify-around",
        "space-evenly": "justify-evenly",
      },
    },
  },
  layoutWrap: {
    read: { source: "flexLayout", field: "wrap" },
    type: { kind: "keyword", values: ["nowrap", "wrap"], default: "nowrap" },
    status: SUPPORTED,
    emitter: { emit: "keywordClass", classes: { nowrap: "flex-nowrap", wrap: "flex-wrap" } },
  },
  positionAbsolute: {
    read: { source: "layoutChild", field: "absolute" },
    type: { kind: "keyword", values: ["static", "absolute"], default: "static" },
    status: SUPPORTED,
    // `relative` sul genitore di una parte assoluta lo emette il render v2 (Story 2.14).
    emitter: { emit: "keywordClass", classes: { static: "", absolute: "absolute" } },
  },
  positionX: {
    read: { source: "layoutChild", field: "x" },
    type: token("spacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "left" },
  },
  positionY: {
    read: { source: "layoutChild", field: "y" },
    type: token("spacing"),
    status: SUPPORTED,
    emitter: { emit: "utility", prefix: "top" },
  },
  zIndex: {
    read: { source: "layoutChild", field: "zIndex" },
    type: { kind: "keyword", values: ["0", "10", "20", "30", "40", "50"], default: "0" },
    status: SUPPORTED,
    emitter: { emit: "keywordClass", classes: { "0": "z-0", "10": "z-10", "20": "z-20", "30": "z-30", "40": "z-40", "50": "z-50" } },
  },
} as const satisfies Record<string, PropertyDefinition>;

/** Le proprietà di layout (flex del board) e di posizione, ammesse a `surface` e `image`. */
const LAYOUT_PROPERTIES = ["layoutDir", "layoutAlign", "layoutJustify", "layoutWrap", "rowGap", "columnGap"] as const;
const POSITION_PROPERTIES = ["positionAbsolute", "positionX", "positionY", "zIndex"] as const;

/** Nome di una proprietà registrata (i nomi `TokenProperty` di Penpot). */
export type RegisteredProperty = keyof typeof STYLE_PROPERTIES;

/**
 * Tabella ruolo → proprietà ammesse (Story 2.10, A; decisione di Alessandro,
 * 2026-09-15; `image`, layout e posizione dalla Story 2.12): quali proprietà
 * del registro può portare una parte con quel ruolo del contratto di
 * estrazione (AD-11). Il contratto del page builder non conosce Penpot: il
 * vocabolario Penpot vive qui, accanto al registro. Una `surface` con solo
 * `strokeColor` (outline, senza `fill`) è valida. `image` non ammette `fill`.
 * Insegnare una proprietà a un ruolo = una riga qui + la mappatura + un test
 * rosso/verde, una volta per tutte.
 */
export const ROLE_PROPERTIES = {
  surface: [
    "fill",
    "strokeColor",
    "strokeWidth",
    "strokeStyle",
    "strokeAlignment",
    "borderRadiusTopLeft",
    "borderRadiusTopRight",
    "borderRadiusBottomRight",
    "borderRadiusBottomLeft",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "shadow",
    "opacity",
    ...LAYOUT_PROPERTIES,
    ...POSITION_PROPERTIES,
  ],
  // Tipografia del registro: dimensione, peso, spaziatura, famiglia (bloccata dal registro).
  text: ["fill", "fontSize", "fontWeight", "letterSpacing", "fontFamilies", "opacity"],
  icon: ["fill", "strokeColor", "strokeWidth"],
  divider: ["strokeColor", "strokeWidth", "strokeStyle"],
  // Nessun `fill`: il contenuto arriva dal field `src`, la regola "token su ogni stile" non si applica al bitmap.
  image: [
    "borderRadiusTopLeft",
    "borderRadiusTopRight",
    "borderRadiusBottomRight",
    "borderRadiusBottomLeft",
    "opacity",
    ...LAYOUT_PROPERTIES,
    ...POSITION_PROPERTIES,
  ],
} as const satisfies Record<PartRole, readonly RegisteredProperty[]>;

/** `true` se il ruolo ammette la proprietà (tabella ruolo → proprietà). */
export function roleAdmits(role: PartRole, property: string): boolean {
  return (ROLE_PROPERTIES[role] as readonly string[]).includes(property);
}

/**
 * Il messaggio di una proprietà fuori ruolo: nomina componente, cella, parte,
 * ruolo, proprietà e token, e propone i tre adattamenti nell'ordine fissato
 * (designer → il ruolo impara la proprietà → cambio di ruolo nel contratto).
 */
export function outsideRoleProblem(
  property: string,
  role: PartRole,
  where: { component?: string; cell?: string; part: string; token: string },
): string {
  const admitted = ROLE_PROPERTIES[role] as readonly string[];
  const otherRoles = (Object.keys(ROLE_PROPERTIES) as PartRole[]).filter((candidate) => candidate !== role && roleAdmits(candidate, property));
  const component = where.component !== undefined ? pascalCase(where.component) : "<Comp>";
  const location = [
    ...(where.component !== undefined ? [`componente "${component}"`] : []),
    ...(where.cell !== undefined ? [`cella "${where.cell}"`] : []),
    `parte "${where.part}"`,
    `ruolo "${role}"`,
    `proprietà "${property}"`,
    `token "${where.token}"`,
  ].join(", ");
  const roleHint = otherRoles.length > 0 ? `uno fra [${otherRoles.join(", ")}], che ammettono "${property}"` : "<ruolo>";
  return (
    `Proprietà fuori ruolo (${location}): il ruolo "${role}" ammette solo [${admitted.join(", ")}]. Adattamenti, in ordine: ` +
    `1) designer: in Penpot sposta il token "${where.token}" della parte "${where.part}" su una proprietà che il ruolo ammette; ` +
    `2) sviluppatore, se il design è voluto: insegna "${property}" al ruolo "${role}" — una riga di ROLE_PROPERTIES (style-properties.ts) + la mappatura dell'emitter + un test rosso/verde, una volta per tutte (il contratto non cambia); ` +
    `3) sviluppatore, se la parte è d'altro tipo: pnpm role:part -- ${component} ${where.part} ${roleHint} (diff, poi --yes; solo SCHEMA_VERSION).`
  );
}

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
export function layerTreeProblems(
  root: LayerLike,
  where: { component?: string; cell?: string },
  aliases: Readonly<Record<string, string>> = {},
  roles?: Readonly<Record<string, PartRole>>,
): string[] {
  return layerTreeIssues(root, where, aliases, roles).map((issue) => issue.message);
}

/** Un problema di proprietà: `blocked` e `outsideRole` mettono il componente in attesa, gli altri sono rossi. */
export interface LayerIssue {
  readonly blocked: boolean;
  /** Token su una proprietà che il ruolo della parte non ammette (Story 2.10, A). */
  readonly outsideRole: boolean;
  readonly message: string;
}

/**
 * Come `layerTreeProblems`, ma dice anche se il problema è una proprietà
 * BLOCCATA (registrata, stato `blocked`): è ciò che mette un componente "in
 * attesa" in `verify:library` (Story 2.8 parte B), mentre non registrata e
 * valore fuori lista restano rossi. Con i `roles` del contratto (Story 2.10,
 * A) controlla anche il ruolo: un token su una proprietà usabile che il
 * ruolo della parte non ammette è un problema `outsideRole`, mai corretto.
 */
export function layerTreeIssues(
  root: LayerLike,
  where: { component?: string; cell?: string },
  aliases: Readonly<Record<string, string>> = {},
  roles?: Readonly<Record<string, PartRole>>,
): LayerIssue[] {
  const issues: LayerIssue[] = [];
  const visit = (layer: LayerLike, part: string): void => {
    const properties = [...new Set([...Object.keys(layer.style), ...Object.keys(layer.tokens)])];
    const role = roles !== undefined && Object.hasOwn(roles, part) ? roles[part] : undefined;
    for (const property of properties) {
      const problem = propertyProblem(property, {
        ...where,
        part,
        ...(Object.hasOwn(layer.style, property) ? { value: layer.style[property] } : {}),
        ...(Object.hasOwn(layer.tokens, property) ? { token: layer.tokens[property] } : {}),
      });
      if (problem === null) {
        // Proprietà usabile: il ruolo della parte deve ammetterla (solo i token, lo stile senza binding è della regola 7).
        if (role !== undefined && Object.hasOwn(layer.tokens, property) && !roleAdmits(role, property)) {
          issues.push({ blocked: false, outsideRole: true, message: outsideRoleProblem(property, role, { ...where, part, token: layer.tokens[property]! }) });
        }
        continue;
      }
      // Bloccata = l'unico ramo di `propertyProblem` raggiunto a registro
      // noto e valore in lista: la riga esiste e il suo stato è `blocked`.
      const definition = propertyDefinition(property);
      const blocked = definition !== undefined && definition.status.state === "blocked" && problem.startsWith("Proprietà bloccata");
      issues.push({ blocked, outsideRole: false, message: problem });
    }
    for (const child of layer.children) visit(child, Object.hasOwn(aliases, child.name) ? aliases[child.name]! : child.name);
  };
  visit(root, "root");
  return issues;
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

/**
 * Classi fisse di rimozione dichiarate dal registro (Story 2.8 parte C),
 * nell'ordine del registro: una variante option senza una proprietà che il
 * default ha emette la classe della sua riga (per tipo di layer se la riga lo
 * dichiara così). Vivono SOLO qui — la validazione dell'emitter le accetta
 * perché vengono dal registro, non dal vocabolario token.
 */
export function removalClasses(): string[] {
  return registeredProperties().flatMap((property) => {
    const emitter: EmitRule = STYLE_PROPERTIES[property].emitter;
    if (emitter.emit !== "utility" || emitter.removalClass === undefined) return [];
    return typeof emitter.removalClass === "string" ? [emitter.removalClass] : Object.values(emitter.removalClass);
  });
}
