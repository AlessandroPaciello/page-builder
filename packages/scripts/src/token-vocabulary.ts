import { TYPE_NAMESPACE, varSuffix, type TokenType, type TokenCatalog } from "./theme-generator";

/**
 * Vocabolario delle classi Tailwind derivabili dal catalogo token Stadio 1
 * (Story 2.1). Un componente (ricetta, AC #2) può usare SOLO classi che una
 * utility Tailwind v4 produce realmente da un `@theme` var — il prefisso
 * utility per tipo è la controparte classi del contratto namespace di
 * `theme-generator.ts` (decisione review 2.1): il suffisso è lo stesso di
 * `varSuffix()`/`varName()`, riusato senza reimplementarlo.
 */

/**
 * Prefissi utility Tailwind v4 per tipo. SOLO namespace `@theme` reali:
 * `borderWidth` e `opacity` NON ne hanno in v4 (decisione review 2.1) —
 * nessuna utility esiste per loro, il consumo legittimo è solo
 * `var(--border-width-*)`/`var(--opacity-*)` inline, fuori dal set di classi
 * validate qui. Una classe `border-w-*`/`opacity-*` con suffisso token
 * quindi NON può mai derivare dal vocabolario.
 */
const TYPE_UTILITY_PREFIXES: Record<TokenType, readonly string[]> = {
  color: ["bg", "text", "border", "ring", "fill", "stroke"],
  spacing: [
    "p", "px", "py", "pt", "pr", "pb", "pl",
    "m", "mx", "my", "mt", "mr", "mb", "ml",
    "gap", "gap-x", "gap-y",
    "inset", "inset-x", "inset-y",
  ],
  borderRadius: ["rounded"],
  borderWidth: [],
  fontSizes: ["text"],
  fontWeights: ["font"],
  letterSpacing: ["tracking"],
  fontFamilies: ["font"],
  opacity: [],
  shadow: ["shadow"],
};

/**
 * Classi strutturali Tailwind non basate su token: non derivano da alcun
 * `@theme` var (Tailwind le ha di default o le genera da valori fissi) e non
 * esprimono un valore di design — richiedono quindi binding a un token.
 * Whitelist esplicita e minimale (decisione Story 2.2): ogni aggiunta è una
 * decisione consapevole, mai un pattern che accetta tutto ciò che non
 * matcha — vanificherebbe il gate dell'AC #2.
 */
const STRUCTURAL_CLASSES: readonly string[] = [
  "flex",
  "inline-flex",
  "items-center",
  "justify-center",
  "overflow-hidden",
  // Larghezza bordo fissa di Tailwind (1px): i token `borderWidth` NON hanno
  // namespace `@theme` v4 (decisione review 2.1) — nessuna utility da token
  // esiste per loro, quindi la classe `border` è strutturale, non un valore
  // di design. Il COLORE del bordo resta gated (border-<token>).
  "border",
];

const STRUCTURAL = new Set<string>(STRUCTURAL_CLASSES);

/**
 * Sintassi valore-arbitrario Tailwind (`bg-[#3b82f6]`, `p-[7px]`): fallisce
 * SEMPRE, indipendentemente dal vocabolario — è la regola esplicita dell'AC
 * #2 (una classe con valore literal fa fallire la validazione).
 */
const ARBITRARY_VALUE_PATTERN = /\[.+\]/;

/** Set di classi utility complete (`bg-mis-primary`, `rounded-full`, …) prodotte dal catalogo. */
export function buildTokenVocabulary(catalog: TokenCatalog): Set<string> {
  const vocabulary = new Set<string>();
  for (const set of catalog.sets) {
    for (const token of set.tokens) {
      const suffix = varSuffix(token.name, token.type);
      for (const prefix of TYPE_UTILITY_PREFIXES[token.type]) {
        vocabulary.add(`${prefix}-${suffix}`);
      }
    }
  }
  return vocabulary;
}

export interface ClassValidationResult {
  valid: boolean;
  invalidClasses: string[];
}

/**
 * Valida una lista di classi Tailwind contro il vocabolario token. Una classe
 * è accettata se: (a) non usa sintassi valore-arbitrario, e (b) è nel
 * vocabolario token oppure è una classe strutturale whitelisted. Le invalide
 * vengono nominate esplicitamente (fail-loud, stesso stile di
 * `theme-generator.ts`).
 */
export function validateClassesAgainstVocabulary(
  classes: readonly string[],
  vocabulary: Set<string>,
): ClassValidationResult {
  const invalidClasses = classes.filter(
    (cls) => ARBITRARY_VALUE_PATTERN.test(cls) || (!STRUCTURAL.has(cls) && !vocabulary.has(cls)),
  );
  return { valid: invalidClasses.length === 0, invalidClasses };
}

/** Esposto per test e per messaggi d'errore che mostrano la whitelist vigente. */
export function structuralClasses(): readonly string[] {
  return STRUCTURAL_CLASSES;
}

/** Esposto per test e documentazione: prefissi utility effettivi per tipo. */
export function utilityPrefixesFor(type: TokenType): readonly string[] {
  return TYPE_UTILITY_PREFIXES[type];
}

// Riuso esplicito del contratto namespace di theme-generator (Task 2):
// varSuffix deriva il suffisso; TYPE_NAMESPACE resta il riferimento per
// qualsiasi evoluzione futura del vocabolario (es. nuove utility per tipo).
export { TYPE_NAMESPACE as THEME_TYPE_NAMESPACE };
