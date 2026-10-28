import {
  describeGeometry,
  GEOMETRY_ENTRIES,
  geometryClasses,
  isValidGeometry,
  sizingOf,
  type GeometryEntry,
  type GeometryQuestion,
  type Scale,
} from "./geometry";
import { SIZING_DEFAULT, SIZING_VALUES, withInvalidAnswer } from "./internal";
import type { Finding, LetturaLayer, PluginData } from "./schemas";
import { varSuffix, type TokenType } from "./token-names";

/**
 * Registro unico delle proprietà Penpot (Story 2.20, AD-11 v3).
 *
 * Una voce per proprietà, con la sua traduzione in classi Tailwind: un token
 * del tipo dichiarato (`kind: "token"`), una parola chiave di una lista
 * chiusa (`kind: "keyword"`, il valore di default non dà classi) oppure una
 * voce di geometria (`kind: "geometry"`: misure, posizione, vincoli,
 * ritaglio, Story 2.21), che qui si valida soltanto e si traduce con le
 * regole di contesto di `geometry.ts` (genitore, figli, celle). Le chiavi
 * sono i nomi che la `Lettura` usa in `tokens` e `style`; la geometria si
 * legge solo da `style`.
 *
 * Una proprietà che il registro non sa tradurre non ferma mai la generazione:
 * diventa un `Finding` di tipo avviso, senza classe, che dice cosa aggiungere
 * (decisione di Alessandro, 2026-10-18). Insegnarne una = una voce qui + i
 * suoi casi verdi in `tests/core/registry.test.ts` (il rosso di ogni voce è
 * generato dal test); il livello 4
 * (`tests/core/registry-tailwind.test.ts`) prova da solo che le sue classi
 * producono CSS.
 */

/** Direzione del flex del genitore: decide come si traduce il dimensionamento "fill". */
export type ParentDir = "row" | "column" | "none";

export const PARENT_DIRS: readonly ParentDir[] = ["row", "column", "none"];

export interface TranslationContext {
  /** Tipo di layer Penpot (`rect`, `text`, `path`, …). */
  readonly layerKind: string;
  readonly parentDir: ParentDir;
  /** Dimensionamento del genitore per asse (`auto` = hug); assente per la radice. */
  readonly parentSizing?: { readonly H?: string; readonly V?: string };
  /** Plugin data del layer: le risposte alle domande. */
  readonly answers?: PluginData;
}

/** Classi di una proprietà, il motivo per cui il registro non la traduce, oppure una domanda. */
export type Translation = { readonly classes: readonly string[] } | { readonly unsupported: string } | { readonly question: GeometryQuestion };

export interface TokenEntry {
  readonly kind: "token";
  readonly tokenType: TokenType;
  /** `suffix` è il suffisso della variabile CSS del token (`varSuffix`). */
  readonly translate: (suffix: string, context: TranslationContext) => Translation;
}

export interface KeywordEntry {
  readonly kind: "keyword";
  readonly values: readonly string[];
  readonly default: string;
  /** Mai chiamata con il valore di default. */
  readonly translate: (value: string, context: TranslationContext) => Translation;
}

export type RegistryEntry = TokenEntry | KeywordEntry | GeometryEntry;

/** Layer Penpot che disegnano un'icona: il tratto è `stroke-*` e il suo spessore è geometria dell'icona. */
export const ICON_LAYER_KINDS: readonly string[] = ["path", "vector", "ellipse", "line"];

const isIcon = (context: TranslationContext): boolean => ICON_LAYER_KINDS.includes(context.layerKind);

const classes = (...list: string[]): Translation => ({ classes: list });

const utility =
  (prefix: string): TokenEntry["translate"] =>
  (suffix) =>
    classes(`${prefix}-${suffix}`);

const token = (tokenType: TokenType, translate: TokenEntry["translate"]): TokenEntry => ({ kind: "token", tokenType, translate });

/** Parola chiave → classi fisse; `null` = valore registrato ma senza traduzione, con il motivo. */
const keyword = (
  values: Readonly<Record<string, string | null>>,
  defaultValue: string,
  unsupported = "",
): KeywordEntry => ({
  kind: "keyword",
  values: Object.keys(values),
  default: defaultValue,
  translate: (value) => {
    const mapped = values[value];
    return mapped === null || mapped === undefined ? { unsupported } : classes(...mapped.split(" ").filter(Boolean));
  },
});

/** Chiave di plugin data della risposta a "fill dentro hug" sull'asse: `fill` | `hug`. */
export const fillInHugKey = (axis: "H" | "V"): string => `fillInHug${axis}`;

export const FILL_IN_HUG_ANSWERS = ["fill", "hug"] as const;

/**
 * "Fill" su un asse: riempie il genitore. In un flex la classe dipende da
 * quale asse è quello principale; fuori da un flex è la larghezza o
 * l'altezza piena. Dentro un genitore che abbraccia il contenuto (hug) sullo
 * stesso asse è ambiguo: domanda, finché la risposta in plugin data non dice
 * `fill` (classi di fill) o `hug` (nessuna classe).
 */
const fillSizing =
  (axis: "H" | "V"): KeywordEntry["translate"] =>
  (value, { parentDir, parentSizing, answers }) => {
    if (value !== "fill") return classes();
    if (parentSizing?.[axis] === "auto") {
      const key = fillInHugKey(axis);
      const answer = answers?.[key];
      if (answer === "hug") return classes();
      if (answer !== "fill") {
        const label = axis === "H" ? "orizzontale" : "verticale";
        return {
          question: {
            key,
            message: withInvalidAnswer(
              `Il layer è "fill" in ${label} ma il genitore abbraccia il contenuto (hug) sullo stesso asse: "fill" lo allarga quanto il genitore, "hug" lo lascia della sua misura.`,
              answer,
            ),
            options: [...FILL_IN_HUG_ANSWERS],
          },
        };
      }
    }
    if (parentDir === "none") return classes(axis === "H" ? "w-full" : "h-full");
    const mainAxis = parentDir === "row" ? "H" : "V";
    return classes(axis === mainAxis ? "flex-1" : "self-stretch");
  };

/** Angoli del raggio, nell'ordine del registro: quattro uguali collassano in `rounded-<sfx>`. */
export const RADIUS_CORNERS = ["rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"] as const;

export const REGISTRY = {
  fill: token("color", (suffix, context) => classes(`${isIcon(context) ? "fill" : context.layerKind === "text" ? "text" : "bg"}-${suffix}`)),
  strokeColor: token("color", (suffix, context) => classes(`${isIcon(context) ? "stroke" : "border"}-${suffix}`)),
  // Bug 4: lo spessore è una classe. `borderWidth` non ha un namespace in Tailwind v4: si usa la variabile del tema.
  strokeWidth: token("borderWidth", (suffix, context) => (isIcon(context) ? classes() : classes(`border-(length:--border-width-${suffix})`))),
  strokeStyle: keyword({ solid: "", dashed: "border-dashed", dotted: "border-dotted" }, "solid"),
  strokeAlignment: keyword(
    { inner: "", center: null, outer: null },
    "inner",
    'solo "inner" corrisponde al bordo CSS (box-sizing: border-box); per center/outer serve una traduzione nel registro (es. outline con offset)',
  ),
  borderRadiusTopLeft: token("borderRadius", utility("rounded-tl")),
  borderRadiusTopRight: token("borderRadius", utility("rounded-tr")),
  borderRadiusBottomRight: token("borderRadius", utility("rounded-br")),
  borderRadiusBottomLeft: token("borderRadius", utility("rounded-bl")),
  paddingTop: token("spacing", utility("pt")),
  paddingRight: token("spacing", utility("pr")),
  paddingBottom: token("spacing", utility("pb")),
  paddingLeft: token("spacing", utility("pl")),
  rowGap: token("spacing", utility("gap-y")),
  columnGap: token("spacing", utility("gap-x")),
  fontSize: token("fontSizes", utility("text")),
  fontWeight: token("fontWeights", utility("font")),
  letterSpacing: token("letterSpacing", utility("tracking")),
  // Bug 5: Penpot 2.18 chiama la proprietà al singolare; il tipo del token resta `fontFamilies`.
  fontFamily: token("fontFamilies", utility("font")),
  // `opacity` non ha un namespace in Tailwind v4: si usa la variabile del tema.
  opacity: token("opacity", (suffix) => classes(`opacity-(--opacity-${suffix})`)),
  shadow: token("shadow", utility("shadow")),
  layoutDir: keyword({ none: "", row: "flex flex-row", column: "flex flex-col" }, "none"),
  layoutAlign: keyword(
    // Il default (`stretch`) non dà classi: è già il comportamento CSS del flex.
    { start: "items-start", center: "items-center", end: "items-end", stretch: "", baseline: "items-baseline" },
    "stretch",
  ),
  layoutJustify: keyword(
    {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      "space-between": "justify-between",
      "space-around": "justify-around",
      "space-evenly": "justify-evenly",
    },
    "start",
  ),
  layoutWrap: keyword({ nowrap: "", wrap: "flex-wrap" }, "nowrap"),
  // Bug 3: dimensionamento. `fix` e `auto` (hug) non danno classi qui: la misura fissa è una regola di geometria (`geometry.ts`).
  sizingH: { kind: "keyword", values: SIZING_VALUES, default: SIZING_DEFAULT, translate: fillSizing("H") },
  sizingV: { kind: "keyword", values: SIZING_VALUES, default: SIZING_DEFAULT, translate: fillSizing("V") },
  // Story 2.21: misure, posizione, vincoli e ritaglio (bug 11, lato nucleo).
  ...GEOMETRY_ENTRIES,
} as const satisfies Record<string, RegistryEntry>;

export type RegisteredProperty = keyof typeof REGISTRY;

const ENTRIES: Readonly<Record<string, RegistryEntry>> = REGISTRY;

/** La voce del registro, o `undefined` se la proprietà non è registrata. */
export function registryEntry(property: string): RegistryEntry | undefined {
  return Object.hasOwn(ENTRIES, property) ? ENTRIES[property] : undefined;
}

export function registeredProperties(): RegisteredProperty[] {
  return Object.keys(REGISTRY) as RegisteredProperty[];
}

/** Il tipo di un token del tema, `undefined` se il catalogo non lo conosce. */
export type TokenTypeOf = (tokenName: string) => TokenType | undefined;

export interface LayerClassesInput {
  /** Il genitore; assente = il layer è la radice della cella. La direzione del flex si ricava da `parent.style.layoutDir`. */
  readonly parent?: LetturaLayer;
  readonly tokenTypeOf: TokenTypeOf;
  /** La scala del tema: i token `spacing` con il loro valore in px. */
  readonly scale: Scale;
}

/** Direzione del flex di un layer, come genitore: `none` se non è un flex o il valore è malformato. */
export function parentDirOf(parent: LetturaLayer | undefined): ParentDir {
  const value = parent?.style["layoutDir"];
  return value === "row" || value === "column" ? value : "none";
}

export interface LayerClasses {
  readonly classes: string[];
  readonly findings: Finding[];
}

const HOW_TO_TEACH = "una voce in REGISTRY (src/core/registry.ts) con la sua traduzione in classi + i suoi casi verdi in tests/core/registry.test.ts";

/**
 * Le classi di un layer (le sue proprietà, più le regole di geometria che
 * leggono genitore e figli), gli avvisi per ciò che il registro non traduce
 * e le domande. Deterministica: classi ordinate e senza doppioni, avvisi
 * delle proprietà in ordine alfabetico e poi quelli della geometria.
 */
export function layerClasses(layer: LetturaLayer, input: LayerClassesInput): LayerClasses {
  const { parent } = input;
  // Un layer assoluto è fuori dal flusso del flex: "fill" vale come fuori da un flex e il genitore non conta.
  const inFlow = parent !== undefined && layer.style["position"] !== "absolute";
  const context: TranslationContext = {
    layerKind: layer.kind,
    parentDir: inFlow ? parentDirOf(parent) : "none",
    ...(inFlow ? { parentSizing: { H: sizingOf(parent, "H"), V: sizingOf(parent, "V") } } : {}),
    ...(layer.pluginData === undefined ? {} : { answers: layer.pluginData }),
  };
  const where = `layer "${layer.name}"`;
  const out: string[] = [];
  const findings: Finding[] = [];
  const warn = (message: string): void => {
    findings.push({ level: "avviso", where, message });
  };
  const properties = [...new Set([...Object.keys(layer.tokens), ...Object.keys(layer.style)])].sort();
  for (const property of properties) {
    const entry = registryEntry(property);
    const tokenName = Object.hasOwn(layer.tokens, property) ? layer.tokens[property] : undefined;
    const value = Object.hasOwn(layer.style, property) ? layer.style[property] : undefined;
    if (entry === undefined) {
      const seen = tokenName !== undefined ? `token "${tokenName}"` : `valore ${JSON.stringify(value)}`;
      warn(`Proprietà "${property}" (${seen}) non registrata: nessuna classe. Per tradurla aggiungi ${HOW_TO_TEACH}.`);
      continue;
    }
    let translation: Translation;
    if (entry.kind === "geometry") {
      if (tokenName !== undefined) {
        warn(`Proprietà "${property}" legata al token "${tokenName}": la geometria si legge solo dal valore in style (${describeGeometry(entry)}), il token è ignorato.`);
      } else if (!isValidGeometry(entry, value)) {
        warn(`Proprietà "${property}" con valore ${typeof value === "number" ? String(value) : JSON.stringify(value)} malformato: ammette ${describeGeometry(entry)}. Nessuna classe.`);
      }
      // Le classi di geometria vengono dalle regole di contesto, dopo il ciclo.
      continue;
    }
    if (entry.kind === "token") {
      if (tokenName === undefined) {
        warn(
          `Proprietà "${property}" con valore ${JSON.stringify(value)} senza token: nessuna classe. In Penpot lega un token di tipo "${entry.tokenType}".`,
        );
        continue;
      }
      const type = input.tokenTypeOf(tokenName);
      if (type === undefined) {
        warn(`Proprietà "${property}": il token "${tokenName}" non è nel tema, nessuna classe. Aggiungi il token al catalogo o lega un token esistente.`);
        continue;
      }
      if (type !== entry.tokenType) {
        warn(
          `Proprietà "${property}": il token "${tokenName}" è di tipo "${type}", il registro si aspetta "${entry.tokenType}". Nessuna classe: in Penpot lega un token "${entry.tokenType}".`,
        );
        continue;
      }
      let suffix: string;
      try {
        suffix = varSuffix(tokenName, type);
      } catch (error) {
        warn(`Proprietà "${property}": ${(error as Error).message} Nessuna classe.`);
        continue;
      }
      translation = entry.translate(suffix, context);
    } else {
      if (tokenName !== undefined) {
        warn(`Proprietà "${property}" legata al token "${tokenName}": ammette solo i valori [${entry.values.join(", ")}], senza token. Nessuna classe.`);
        continue;
      }
      const raw = String(value);
      if (!entry.values.includes(raw)) {
        warn(
          `Proprietà "${property}" con valore "${raw}" fuori lista [${entry.values.join(", ")}]: nessuna classe. Per tradurlo aggiungi "${raw}" ai valori della voce "${property}" in REGISTRY con le sue classi + un test rosso/verde.`,
        );
        continue;
      }
      if (raw === entry.default) continue;
      translation = entry.translate(raw, context);
    }
    if ("unsupported" in translation) {
      warn(`Proprietà "${property}" con valore "${String(value)}" non tradotta: ${translation.unsupported}. Nessuna classe.`);
      continue;
    }
    if ("question" in translation) {
      const { key, message, options } = translation.question;
      findings.push({ level: "domanda", where, key, message, options: [...options] });
      continue;
    }
    out.push(...translation.classes);
  }
  const geometry = geometryClasses(layer, { ...(parent === undefined ? {} : { parent }), scale: input.scale });
  out.push(...geometry.classes);
  findings.push(...geometry.findings);
  return { classes: collapseRadius([...new Set(out)]).sort(), findings };
}

/** Quattro angoli con lo stesso suffisso → `rounded-<sfx>`. */
export function collapseRadius(list: readonly string[]): string[] {
  const corners = RADIUS_CORNERS.map((corner) => list.find((cls) => cls.startsWith(`${corner}-`)));
  if (corners.some((cls) => cls === undefined)) return [...list];
  const suffixes = new Set(corners.map((cls, i) => cls!.slice(RADIUS_CORNERS[i]!.length + 1)));
  if (suffixes.size !== 1) return [...list];
  return [...list.filter((cls) => !corners.includes(cls)), `rounded-${[...suffixes][0]}`];
}
