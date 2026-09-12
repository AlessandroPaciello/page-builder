import type { ComponentContract } from "@app/contracts";

import type { TokenCatalog } from "../theme-generator";
import { generateTheme } from "../theme-generator";
import { contrastRatio, parseHex } from "./contrast";
import { pascalCase, sameColorish } from "./library-plan";
import type { LibrarySpec, SemanticSeed } from "./library-spec";
import type { LibrarySnapshot, SnapshotLayer } from "./library-snapshot";

/**
 * Il verificatore che DECIDE l'esito (Story 2.4, Task 4, AC #3): funzione
 * pura, zero I/O, zero MCP. Ogni errore nomina contratto/cella/layer/token.
 * Il pass/fail sta qui e negli exit code dei CLI, mai nel prompt delle skill
 * (AD-11: "pass/fail sta negli script e negli schemi, mai nel prompt").
 */

export interface VerifyLibraryInput {
  readonly contracts: readonly ComponentContract[];
  readonly spec: LibrarySpec;
  readonly snapshot: LibrarySnapshot;
  /**
   * Seed opzionale (review 2.4, 2° pass): se presente, la regola 8 verifica
   * ANCHE che i valori dei token semantici coincidano con quelli decisi col
   * designer. Senza seed la regola copre solo nome e tipo, com'era prima.
   */
  readonly seed?: SemanticSeed;
}

export interface VerifyResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

interface TokenFacts {
  type: string;
  value: unknown;
  set: string;
}

function buildTokenIndex(snapshot: LibrarySnapshot): Map<string, TokenFacts> {
  const index = new Map<string, TokenFacts>();
  for (const set of snapshot.sets) {
    for (const token of set.tokens) {
      // Solo i set ATTIVI sono la sorgente della pipeline (generateTheme e
      // generate:theme leggono gli attivi): un token richiesto relegato in un
      // set inattivo deve restare un errore, non un falso verde.
      if (!set.active) continue;
      index.set(token.name, { type: token.type, value: token.value, set: set.name });
    }
  }
  return index;
}

function walkLayers(root: SnapshotLayer, visit: (layer: SnapshotLayer) => void): void {
  visit(root);
  for (const child of root.children) walkLayers(child, visit);
}

function cartesian(contract: ComponentContract): string[][] {
  let out: string[][] = [[]];
  for (const axis of contract.axes) {
    out = out.flatMap((prefix) => axis.values.map((value) => [...prefix, value]));
  }
  return out;
}

function cellKeyOf(contract: ComponentContract, variantProps: Record<string, string>): string {
  return contract.axes.map((axis) => `${axis.name}=${variantProps[axis.name] ?? "?"}`).join("|");
}

/**
 * Risolve un token colore seguendo i riferimenti `{…}` fino al valore
 * letterale. Restituisce `null` se il token manca, non è colore o il valore
 * non è un hex: il chiamante produce l'errore che nomina il token.
 */
function resolveColor(name: string, index: Map<string, TokenFacts>, seen: string[] = []): string | null {
  if (seen.includes(name)) return null;
  const token = index.get(name);
  if (!token || token.type !== "color" || typeof token.value !== "string") return null;
  const ref = /^\{(.+)\}$/.exec(token.value);
  if (ref?.[1]) return resolveColor(ref[1], index, [...seen, name]);
  return token.value;
}

/**
 * Le 10 regole del Task 4. Un container senza plugin data `pagebuilder` è un
 * errore SOLO se il suo nome coincide con quello di un contratto: i
 * container estranei (i segnaposto della Story 2.7) non sono affar suo.
 */
export function verifyLibrary(input: VerifyLibraryInput): VerifyResult {
  const { contracts, spec, snapshot, seed } = input;
  const errors: string[] = [];
  const tokenIndex = buildTokenIndex(snapshot);
  const containers = snapshot.components;

  for (const contract of contracts) {
    const containerName = pascalCase(contract.name);
    const expectedPluginData = `${contract.name}@${contract.version}`;
    const declaring = containers.filter(
      (container) => (container.pluginData ?? "").split("@")[0] === contract.name,
    );

    // Regola 1: un container per contratto, non zero e non due.
    if (declaring.length === 0) {
      const namesake = containers.find((container) => container.name === containerName || container.name === contract.name);
      if (namesake) {
        errors.push(
          `Contratto "${contract.name}": il container "${namesake.name}" ha il nome giusto ma nessun plugin data pagebuilder/contract — il legame al contratto manca (lo scrivono solo le skill).`,
        );
      } else {
        errors.push(`Contratto "${contract.name}": nessun VariantContainer lo dichiara via plugin data pagebuilder/contract.`);
      }
      continue;
    }
    if (declaring.length > 1) {
      errors.push(
        `Contratto "${contract.name}": ${declaring.length} container lo dichiarano (${declaring.map((c) => `"${c.name}"`).join(", ")}) — un solo container per contratto.`,
      );
      continue;
    }

    const container = declaring[0]!;

    // Regola 2: il nome del container coincide con il PascalCase del contratto.
    if (container.name !== containerName) {
      errors.push(
        `Contratto "${contract.name}": il container che lo dichiara si chiama "${container.name}", atteso "${containerName}" (PascalCase del contratto).`,
      );
    }

    // Regola 3: la versione nel plugin data coincide con contractId(contract).
    if (container.pluginData !== expectedPluginData) {
      errors.push(
        `Contratto "${contract.name}": plugin data pagebuilder/contract = ${container.pluginData === null ? "assente" : `"${container.pluginData}"`}, atteso "${expectedPluginData}".`,
      );
    }

    // Regola 4: proprietà di variante = assi del contratto (nome, numero e ordine); valori per insieme.
    const expectedAxes = contract.axes.map((axis) => axis.name);
    const axesDiffer =
      container.axes.length !== expectedAxes.length || container.axes.some((axis, index) => axis !== expectedAxes[index]);
    if (axesDiffer) {
      errors.push(
        `Contratto "${contract.name}": proprietà di variante [${container.axes.join(", ")}] ≠ assi del contratto [${expectedAxes.join(", ")}].`,
      );
    }
    for (const axis of contract.axes) {
      const found = container.axesValues[axis.name];
      if (!found) {
        errors.push(`Contratto "${contract.name}": manca la proprietà d'asse "${axis.name}" (currentValues assente).`);
        continue;
      }
      const missing = axis.values.filter((value) => !found.includes(value));
      const extra = found.filter((value) => !axis.values.includes(value));
      if (missing.length > 0 || extra.length > 0) {
        const parts: string[] = [];
        if (missing.length > 0) parts.push(`mancanti [${missing.join(", ")}]`);
        if (extra.length > 0) parts.push(`in più [${extra.join(", ")}]`);
        errors.push(
          `Contratto "${contract.name}", asse "${axis.name}": valori [${found.join(", ")}] ≠ valori del contratto [${axis.values.join(", ")}] (${parts.join("; ")}).`,
        );
      }
    }

    // Regola 5: celle = prodotto cartesiano completo; nessun variantError.
    const expectedKeys = cartesian(contract).map((values) =>
      contract.axes.map((axis, index) => `${axis.name}=${values[index]}`).join("|"),
    );
    const foundKeys = new Map<string, number>();
    for (const cell of container.cells) {
      // Una board non mappata alle varianti non può essere verificata: è un
      // errore che nomina la board, mai un salto silenzioso (review 2.4).
      if (cell.variantProps === null) {
        errors.push(
          `Contratto "${contract.name}": la board "${cell.root.name}" non è mappata alle varianti (variantProps assente) — non è verificabile come cella.`,
        );
        continue;
      }
      const key = cellKeyOf(contract, cell.variantProps);
      foundKeys.set(key, (foundKeys.get(key) ?? 0) + 1);
      if (cell.variantError !== null) {
        errors.push(
          `Contratto "${contract.name}", cella "${key}": variantError "${String(cell.variantError)}" — la matrice varianti è incoerente.`,
        );
      }
    }
    for (const key of expectedKeys) {
      if (!foundKeys.has(key)) {
        errors.push(`Contratto "${contract.name}": manca la cella "${key}" — le celle devono coprire il prodotto cartesiano completo.`);
      } else if (foundKeys.get(key)! > 1) {
        errors.push(`Contratto "${contract.name}": la cella "${key}" compare ${foundKeys.get(key)} volte — duplicato.`);
      }
    }
    for (const key of foundKeys.keys()) {
      if (!expectedKeys.includes(key)) {
        errors.push(`Contratto "${contract.name}": cella "${key}" in più — non fa parte del prodotto cartesiano del contratto.`);
      }
    }

    // Regola 6: nessuna parte del contratto manca in una cella ("root" È la board della cella).
    for (const cell of container.cells) {
      if (cell.variantProps === null) continue; // già segnalata dalla regola 5
      const key = cellKeyOf(contract, cell.variantProps);
      const names = new Set<string>();
      walkLayers(cell.root, (layer) => names.add(layer.name));
      for (const part of contract.parts) {
        if (part === "root") continue;
        if (!names.has(part)) {
          errors.push(`Contratto "${contract.name}", cella "${key}": manca la parte "${part}" (nessun layer con questo nome).`);
        }
      }
    }

    // Regola 7: ogni proprietà di stile valorizzata ha un binding, e il
    // binding punta a un token presente nel catalogo.
    for (const cell of container.cells) {
      if (cell.variantProps === null) continue; // già segnalata dalla regola 5
      const key = cellKeyOf(contract, cell.variantProps);
      walkLayers(cell.root, (layer) => {
        for (const property of Object.keys(layer.style)) {
          const binding = layer.tokens[property];
          if (!binding) {
            errors.push(
              `Contratto "${contract.name}", cella "${key}", layer "${layer.name}": la proprietà di stile "${property}" è valorizzata ma non ha binding in shape.tokens.`,
            );
            continue;
          }
          if (!tokenIndex.has(binding)) {
            errors.push(
              `Contratto "${contract.name}", cella "${key}", layer "${layer.name}": il binding di "${property}" punta al token "${binding}", assente dal catalogo.`,
            );
          }
        }
      });
    }
  }

  // Regola 8: la spec è coperta dal catalogo (nome e tipo); con il seed,
  // anche i valori coincidono con quelli decisi col designer (review 2.4).
  for (const required of spec.tokens) {
    const found = tokenIndex.get(required.name);
    if (!found) {
      errors.push(`Token richiesto dalla spec "${required.name}" (type "${required.type}") assente dal catalogo.`);
    } else if (found.type !== required.type) {
      errors.push(
        `Token "${required.name}": type "${found.type}" ≠ type richiesto dalla spec "${required.type}".`,
      );
    }
  }
  if (seed) {
    const seedTokens = [...seed.palette, ...seed.semantic];
    for (const seedToken of seedTokens) {
      const found = tokenIndex.get(seedToken.name);
      if (!found) continue; // l'assenza è già segnalata dalla regola 8
      const valueMatches = sameColorish(
        seedToken.value,
        found.value as Parameters<typeof sameColorish>[1],
      );
      if (!valueMatches) {
        errors.push(
          `Token "${seedToken.name}": valore ${JSON.stringify(found.value)} ≠ valore del seed ${JSON.stringify(seedToken.value)} — il ripuntamento in Penpot è una differenza da riportare (additiva), non un silenzio del verify.`,
        );
      }
    }
  }

  // Regola 9: il catalogo (soli set attivi, come lo legge la pipeline) passa generateTheme().
  const activeCatalog: TokenCatalog = {
    sets: snapshot.sets
      .filter((set) => set.active)
      .map((set) => ({
        name: set.name,
        tokens: set.tokens.map((token) => ({
          name: token.name,
          type: token.type as TokenCatalog["sets"][number]["tokens"][number]["type"],
          value: token.value as TokenCatalog["sets"][number]["tokens"][number]["value"],
        })),
      })),
  };
  try {
    generateTheme(activeCatalog);
  } catch (error) {
    errors.push(`Il catalogo non passa generateTheme(): ${(error as Error).message}`);
  }

  // Regola 10: le coppie di contrasto della spec rispettano la soglia sui valori risolti.
  for (const pair of spec.contrastPairs) {
    const foreground = resolveColor(pair.foreground, tokenIndex);
    const background = resolveColor(pair.background, tokenIndex);
    const scope = pair.fillPairOnly ? " (coppia fill+foreground)" : "";
    if (!foreground || !background || !parseHex(foreground) || !parseHex(background)) {
      errors.push(
        `Coppia di contrasto ${pair.foreground} su ${pair.background}: valore non risolvibile a un colore (foreground=${JSON.stringify(foreground)}, background=${JSON.stringify(background)}).`,
      );
      continue;
    }
    const ratio = contrastRatio(foreground, background);
    if (ratio < pair.minRatio) {
      errors.push(
        `Coppia di contrasto ${pair.foreground} su ${pair.background}${scope}: ${ratio.toFixed(2)}:1 < soglia ${pair.minRatio}:1 (${foreground} su ${background}).`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}
