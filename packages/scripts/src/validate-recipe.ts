import { contractId, type ComponentContract } from "@app/contracts";

import { PLUGIN_DATA_PATTERN, contractByName } from "./component-reader";

import {
  FixtureSchema,
  JudgmentSchema,
  RecipeSchema,
  cellKeyOf,
  partBindings,
  type ComponentFixture,
  type ComponentRecipe,
} from "./recipe-schema";
import type { TokenCatalog } from "./theme-generator";

/**
 * Validatore puro della ricetta componente (Story 2.5, AC #1/#2): conformance
 * meccanica della fixture e della ricetta contro il contratto dichiarato dal
 * plugin data — assi, valori e parti = ESATTAMENTE quelli del contratto,
 * celle = prodotto cartesiano completo — gate token: ogni token delle celle
 * `proprietà → token` deve esistere nel catalogo Stadio 1 (un valore literal
 * non passa la validazione), e conformance ricetta↔fixture (change log loop
 * 1): ogni cella della ricetta coincide con i binding `shape.tokens` della
 * fixture per la stessa parte×cella, e `recipe.judgment` coincide col
 * contenuto del file di giudizio per contratto. Nessuna I/O, nessuna rete:
 * la stessa coppia fixture+ricetta contro lo stesso catalogo dà sempre lo
 * stesso verdetto.
 */
export interface RecipeValidationResult {
  valid: boolean;
  /** Errori di schema (Zod), di conformance e di token, con l'incriminato nominato. */
  errors: string[];
}

function zodIssues(label: string, error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string[] {
  return error.issues.map((issue) => `${label} ${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
}

/** Serializzazione stabile (chiavi ordinate) per confronti deep-equal senza dipendere dall'ordine delle chiavi. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function cartesian(contract: ComponentContract): string[] {
  let out: string[][] = [[]];
  for (const axis of contract.axes) {
    out = out.flatMap((prefix) => axis.values.map((value) => [...prefix, value]));
  }
  return out.map((values) => contract.axes.map((axis, index) => `${axis.name}=${values[index]}`).join("|"));
}

function diff(expected: readonly string[], found: readonly string[]): { missing: string[]; extra: string[] } {
  const foundSet = new Set(found);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((item) => !foundSet.has(item)),
    extra: found.filter((item) => !expectedSet.has(item)),
  };
}

/** Le differenze fra due celle `proprietà → token`, nominate proprietà per proprietà. */
function tokenMapDiff(expected: Record<string, string>, found: Record<string, string>): string | null {
  const properties = [...new Set([...Object.keys(expected), ...Object.keys(found)])].sort();
  const differing = properties.filter((property) => expected[property] !== found[property]);
  if (differing.length === 0) return null;
  return differing
    .map(
      (property) =>
        `proprietà "${property}": ricetta ${JSON.stringify(found[property] ?? "<assente>")} ≠ fixture ${JSON.stringify(
          expected[property] ?? "<assente>",
        )}`,
    )
    .join("; ");
}

export function validateRecipe(
  fixture: unknown,
  recipe: unknown,
  catalog: TokenCatalog,
  judgment: unknown,
): RecipeValidationResult {
  const errors: string[] = [];

  const parsedFixture = FixtureSchema.safeParse(fixture);
  const parsedRecipe = RecipeSchema.safeParse(recipe);
  const parsedJudgment = JudgmentSchema.safeParse(judgment);
  if (!parsedFixture.success) errors.push(...zodIssues("fixture", parsedFixture.error));
  if (!parsedRecipe.success) errors.push(...zodIssues("ricetta", parsedRecipe.error));
  if (!parsedJudgment.success) errors.push(...zodIssues("giudizio", parsedJudgment.error));
  if (!parsedFixture.success || !parsedRecipe.success) return { valid: false, errors };

  const f: ComponentFixture = parsedFixture.data;
  const r: ComponentRecipe = parsedRecipe.data;

  const pluginDataMatch = PLUGIN_DATA_PATTERN.exec(f.contract);
  const contractName = pluginDataMatch?.[1] ?? null;
  if (contractName === null) {
    errors.push(`fixture contract: ${JSON.stringify(f.contract)} non è un plugin data "nome@versione".`);
    return { valid: false, errors };
  }

  const contract = contractByName(contractName);
  if (contract === undefined) {
    errors.push(
      `fixture contract: il contratto "${f.contract}" non esiste in @app/contracts — la conformance richiede un contratto noto.`,
    );
    return { valid: false, errors };
  }

  if (f.contract !== contractId(contract)) {
    errors.push(`fixture contract: "${f.contract}" ≠ contractId "${contractId(contract)}".`);
  }

  // Conformance assi: nomi, numero e ordine = assi del contratto; valori per
  // insieme (stessa regola 4 di verifyLibrary, qui sulla fixture committata).
  const contractAxes = contract.axes.map((axis) => axis.name);
  const fixtureAxes = f.axes.map((axis) => axis.name);
  if (fixtureAxes.length !== contractAxes.length || fixtureAxes.some((axis, index) => axis !== contractAxes[index])) {
    errors.push(`fixture axes: [${fixtureAxes.join(", ")}] ≠ assi del contratto [${contractAxes.join(", ")}].`);
  }
  for (const axis of contract.axes) {
    const found = f.axes.find((fixtureAxis) => fixtureAxis.name === axis.name)?.values ?? [];
    const { missing, extra } = diff(axis.values, found);
    if (missing.length > 0 || extra.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`mancanti [${missing.join(", ")}]`);
      if (extra.length > 0) parts.push(`in più [${extra.join(", ")}]`);
      errors.push(`fixture asse "${axis.name}": valori [${found.join(", ")}] ≠ valori del contratto [${axis.values.join(", ")}] (${parts.join("; ")}).`);
    }
  }

  // Conformance celle della fixture: prodotto cartesiano completo, niente
  // duplicati, niente extra (stessa regola 5 di verifyLibrary). Una cella
  // senza valore per un asse è un errore che nomina l'asse (review loop 1,
  // ECH#1), mai una chiave "?" che collasserebbe con altre celle malformate.
  const expectedKeys = cartesian(contract);
  const fixtureKeys = new Map<string, number>();
  for (const cell of f.cells) {
    let key: string;
    try {
      key = cellKeyOf(contract.axes, cell.variantProps);
    } catch (error) {
      errors.push(`fixture celle: ${(error as Error).message}`);
      continue;
    }
    fixtureKeys.set(key, (fixtureKeys.get(key) ?? 0) + 1);
  }
  for (const key of expectedKeys) {
    if (!fixtureKeys.has(key)) errors.push(`fixture celle: manca la cella "${key}" — la fixture deve coprire il prodotto cartesiano del contratto.`);
    else if (fixtureKeys.get(key)! > 1) errors.push(`fixture celle: la cella "${key}" compare ${fixtureKeys.get(key)} volte — duplicato.`);
  }
  for (const key of fixtureKeys.keys()) {
    if (!expectedKeys.includes(key)) errors.push(`fixture celle: la cella "${key}" in più non fa parte del prodotto cartesiano del contratto.`);
  }

  // Conformance parti della ricetta: esattamente le parti piatte del contratto.
  const recipeParts = Object.keys(r.parts);
  const { missing: missingParts, extra: extraParts } = diff(contract.parts, recipeParts);
  if (missingParts.length > 0) errors.push(`ricetta parti: mancano [${missingParts.join(", ")}] — le parti della ricetta = parti del contratto.`);
  if (extraParts.length > 0) errors.push(`ricetta parti: in più [${extraParts.join(", ")}] — non sono parti del contratto.`);

  // Conformance celle della ricetta: ogni parte copre lo stesso prodotto cartesiano.
  for (const [part, cells] of Object.entries(r.parts)) {
    const { missing: missingCells, extra: extraCells } = diff(expectedKeys, Object.keys(cells));
    if (missingCells.length > 0) errors.push(`ricetta parte "${part}": mancano le celle [${missingCells.join(", ")}].`);
    if (extraCells.length > 0) errors.push(`ricetta parte "${part}": celle in più [${extraCells.join(", ")}].`);
  }

  // Gate token Stadio 1: ogni token referenziato esiste nel catalogo; un
  // valore literal non ha nome token e fallisce qui (AC #2).
  const tokenNames = new Set(catalog.sets.flatMap((set) => set.tokens.map((token) => token.name)));
  for (const [part, cells] of Object.entries(r.parts)) {
    for (const [cellKey, cell] of Object.entries(cells)) {
      for (const [property, token] of Object.entries(cell)) {
        if (!tokenNames.has(token)) {
          errors.push(
            `ricetta parte "${part}", cella "${cellKey}", proprietà "${property}": "${token}" non è un token del catalogo Stadio 1 — un valore literal non passa la validazione.`,
          );
        }
      }
    }
  }

  // Conformance ricetta↔fixture (change log loop 1, BH#2+ECH#6): ogni cella
  // `proprietà → token` di ogni parte coincide con i binding `shape.tokens`
  // della fixture per la stessa parte e cella — una ricetta editata a mano
  // con token validi ma mai estratti NON passa. Anche l'inverso: un binding
  // della fixture su un layer che non è una parte del contratto è drift
  // (l'estrazione lo rifiuta, il validate non può lasciarlo passare).
  if (missingParts.length === 0 && extraParts.length === 0) {
    for (const cell of f.cells) {
      let key: string;
      try {
        key = cellKeyOf(contract.axes, cell.variantProps);
      } catch {
        continue; // già segnalata sopra (cella malformata)
      }
      const { bindings, duplicates } = partBindings(cell.root);
      if (duplicates.length > 0) {
        errors.push(
          `fixture cella "${key}": due layer chiamati "${duplicates.join(", ")}" hanno binding token — ambiguo quale sia la parte: rinomina i layer in Penpot.`,
        );
      }
      for (const [bindingPart, tokens] of bindings) {
        if (!contract.parts.includes(bindingPart)) {
          errors.push(
            `fixture cella "${key}": il layer "${bindingPart}" ha binding token (${Object.keys(tokens).join(", ")}) ma non è una parte del contratto "${contract.name}" — la ricetta non può conformarsi: allinea la library o il contratto.`,
          );
        }
      }
      for (const part of contract.parts) {
        const expected = bindings.get(part) ?? {};
        const mismatch = tokenMapDiff(expected, r.parts[part]?.[key] ?? {});
        if (mismatch) {
          errors.push(`ricetta↔fixture parte "${part}", cella "${key}": ${mismatch}.`);
        }
      }
    }
  }

  // Giudizio (change log loop 1, BH#3): recipe.judgment deve coincidere col
  // contenuto del file di giudizio per contratto (`judgments/<nome>.json`,
  // validato con JudgmentSchema) — il drift silenzioso del giudizio non passa.
  if (parsedJudgment.success && stableStringify(r.judgment) !== stableStringify(parsedJudgment.data)) {
    errors.push(
      `ricetta judgment: ≠ contenuto di judgments/"${contract.name}".json — la ricetta porta lo stesso giudizio del file per contratto (ricetta = fatti + giudizio).`,
    );
  }

  return { valid: errors.length === 0, errors };
}
