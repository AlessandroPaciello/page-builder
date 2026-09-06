import type { TokenCatalog } from "./theme-generator";
import { buildTokenVocabulary, validateClassesAgainstVocabulary } from "./token-vocabulary";
import { RecipeSchema } from "./recipe-schema";

/**
 * Validatore puro della ricetta componente (AC #1, #2): (a) contratto shape
 * via `RecipeSchema`; (b) gate token — ogni classe del blocco `cva` (base +
 * ogni variante) deve risolvere al vocabolario Stadio 1 o essere una classe
 * strutturale whitelisted. Classi con valore literal (`bg-[#3b82f6]`,
 * `p-[7px]`) falliscono sempre. Nessuna I/O, nessuna rete: la stessa
 * ricetta contro lo stesso catalogo dà sempre lo stesso verdetto.
 */
export interface RecipeValidationResult {
  valid: boolean;
  /** Errori di contratto (Zod), con il campo incriminato nominato. */
  errors: string[];
  /** Classi non risolte al vocabolario (o valore-arbitrario), nominate. */
  invalidClasses: string[];
}

function collectCvaClasses(cva: {
  base: string[];
  variants: Record<string, Record<string, string[]>>;
}): string[] {
  const classes = [...cva.base];
  for (const variantValues of Object.values(cva.variants)) {
    for (const valueClasses of Object.values(variantValues)) {
      classes.push(...valueClasses);
    }
  }
  return classes;
}

export function validateRecipe(recipe: unknown, fixture: TokenCatalog): RecipeValidationResult {
  const parsed = RecipeSchema.safeParse(recipe);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`,
    );
    return { valid: false, errors, invalidClasses: [] };
  }

  const classes = collectCvaClasses(parsed.data.cva);
  const vocabulary = buildTokenVocabulary(fixture);
  const { invalidClasses } = validateClassesAgainstVocabulary(classes, vocabulary);

  const errors =
    invalidClasses.length > 0
      ? [
          `Classi non risolte al vocabolario token Stadio 1 (né whitelisted come strutturali): ${invalidClasses.join(", ")}. Correggi la ricetta, non il validatore.`,
        ]
      : [];

  return { valid: invalidClasses.length === 0, errors, invalidClasses };
}
