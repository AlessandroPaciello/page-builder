import type { ComponentContract } from "@app/contracts";

import { VerdictCollector, type ComponentReport, type ComponentVerdict, type ProblemKind } from "../component-report";
import { partOfLayer, resolvePartAliases, type AliasSource } from "../recipe-schema";
import { layerTreeIssues, propertyDefinition } from "../style-properties";
import type { TokenCatalog } from "../theme-generator";
import { generateTheme } from "../theme-generator";
import { contrastRatio, parseHex } from "./contrast";
import { designCoverage } from "./designs-loader";
import { cartesian, pascalCase, sameColorish, type ComponentDesign } from "./library-plan";
import type { LibrarySpec, SemanticSeed } from "./library-spec";
import type { LibrarySnapshot, SnapshotLayer } from "./library-snapshot";
import { normalizeVariants } from "../variant-normalize";

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
  /**
   * Design committati (code review 2.7 gruppo 1): se presenti, la copertura
   * design↔registry viene verificata PRIMA delle regole su Penpot — un
   * design senza contratto o un contratto senza design è rosso qui, non
   * solo in silenzio nel loader.
   */
  readonly designs?: Readonly<Record<string, ComponentDesign>>;
  /**
   * Binding committati per contratto (Story 2.8 parte B): gli alias dei
   * layer (`parts.<parte>.aliases`) legano un layer con un nome diverso
   * alla parte, per la regola 6. Assente = nessun alias.
   */
  readonly bindings?: Readonly<Record<string, AliasSource>>;
  /**
   * Componenti committati (ricette), da passare quando lo snapshot viene da
   * un file (decisione 3): uno assente dallo snapshot è rosso ("snapshot da
   * aggiornare").
   */
  readonly committedComponents?: readonly string[];
  /** Binding non caricabili, per contratto (messaggio che nomina il file): voce rossa del componente. */
  readonly bindingErrors?: Readonly<Record<string, string>>;
  /** Ricette committate malformate: voce rossa col nome del file. */
  readonly malformedRecipes?: ReadonlyArray<{ readonly file: string; readonly error: string }>;
}

export interface VerifyResult {
  /** Nessuna voce rossa (decisione 1): gli "in attesa" non rendono il run rosso. */
  readonly ok: boolean;
  /** Tutti i problemi ROSSI (componenti + globali), piatti, per i messaggi e i test. */
  readonly errors: readonly string[];
  /** Tutti i problemi IN ATTESA (componenti), piatti. */
  readonly pending: readonly string[];
  /** Una voce per componente (PascalCase del contratto, o nome del container orfano). */
  readonly components: readonly ComponentVerdict[];
  /** Regole globali (8 copertura spec, 9 tema, 10 contrasto, copertura design↔registry). */
  readonly global: readonly ComponentVerdict[];
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
  const verdicts = new VerdictCollector();
  const global = new VerdictCollector();
  for (const contract of contracts) verdicts.declare(pascalCase(contract.name));

  // Copertura design↔registry: un contratto senza design o un design senza
  // contratto è una riga globale rossa; le regole su Penpot girano comunque,
  // così gli altri componenti restano valutati (Story 2.8 parte B).
  if (input.designs !== undefined) {
    const coverage = designCoverage(input.designs, contracts);
    const label = "copertura design↔registry";
    global.declare(label);
    if (coverage.contractsWithoutDesign.length > 0) {
      global.red(
        label,
        `Copertura design↔registry: i contratti [${coverage.contractsWithoutDesign.join(", ")}] non hanno un design committato — committa designs/<contratto>.design.json.`,
      );
    }
    if (coverage.designsWithoutContract.length > 0) {
      global.red(
        label,
        `Copertura design↔registry: i design [${coverage.designsWithoutContract.join(", ")}] non hanno un contratto nel registry — aggiungi il contratto o rimuovi il design.`,
      );
    }
  }

  const tokenIndex = buildTokenIndex(snapshot);
  const containers = snapshot.components;

  for (const contract of contracts) {
    const containerName = pascalCase(contract.name);
    // Ogni problema ha il suo `kind` (Story 2.9): senza, rosso = `other`, in attesa = `pending`.
    const red = (message: string, kind: ProblemKind = "other"): void => verdicts.red(containerName, message, kind);
    const pending = (message: string, kind: ProblemKind = "pending"): void => verdicts.pending(containerName, message, kind);
    const expectedPluginData = `${contract.name}@${contract.version}`;
    const declaring = containers.filter(
      (container) => (container.pluginData ?? "").split("@")[0] === contract.name,
    );

    // Regola 1: un container per contratto, non zero e non due.
    if (declaring.length === 0) {
      const namesake = containers.find((container) => container.name === containerName || container.name === contract.name);
      if (namesake) {
        red(
          `Contratto "${contract.name}": il container "${namesake.name}" ha il nome giusto ma nessun plugin data pagebuilder/contract — il legame al contratto manca (lo scrivono solo le skill).`,
        );
      } else {
        red(`Contratto "${contract.name}": nessun VariantContainer lo dichiara via plugin data pagebuilder/contract.`);
      }
      continue;
    }
    if (declaring.length > 1) {
      red(
        `Contratto "${contract.name}": ${declaring.length} container lo dichiarano (${declaring.map((c) => `"${c.name}"`).join(", ")}) — un solo container per contratto.`,
      );
      continue;
    }

    const raw = declaring[0]!;

    // Regola 2: il nome del container coincide con il PascalCase del contratto.
    if (raw.name !== containerName) {
      red(
        `Contratto "${contract.name}": il container che lo dichiara si chiama "${raw.name}", atteso "${containerName}" (PascalCase del contratto).`,
      );
    }

    // Regola 3: la versione nel plugin data coincide con contractId(contract).
    if (raw.pluginData !== expectedPluginData) {
      red(
        `Contratto "${contract.name}": plugin data pagebuilder/contract = ${raw.pluginData === null ? "assente" : `"${raw.pluginData}"`}, atteso "${expectedPluginData}".`,
        "contract-version",
      );
    }

    // Normalizzazione unica verso il contratto (maiuscole, spazi, ordine
    // degli assi): le regole sotto vedono i nomi del contratto. Una
    // collisione è rossa e nomina i valori.
    const normalized = normalizeVariants(containerName, contract, {
      axes: raw.axes,
      axesValues: raw.axesValues,
      cells: raw.cells.map((cell) => cell.variantProps),
    });
    for (const collision of normalized.collisions) red(collision);
    const container = {
      axes: normalized.axes,
      axesValues: normalized.axesValues,
      cells: raw.cells.map((cell, index) => ({ ...cell, variantProps: normalized.cells[index] ?? null })),
    };

    // Alias dei layer dal binding (parte B): mai una rinomina in Penpot.
    const { aliases, errors: aliasErrors } = resolvePartAliases(input.bindings?.[contract.name], contract);
    for (const error of aliasErrors) red(error);
    const bindingError = input.bindingErrors?.[contract.name];
    if (bindingError !== undefined) red(bindingError);

    // Regola 4: proprietà di variante = assi del contratto (nome e numero,
    // non l'ordine: lo normalizza la pipeline); valori per insieme.
    const expectedAxes = contract.axes.map((axis) => axis.name);
    const design = input.designs?.[contract.name];
    const expectedKeys = cartesian(contract.axes).map((values) =>
      contract.axes.map((axis, index) => `${axis.name}=${values[index]}`).join("|"),
    );
    // `addCell` pianifica solo alle stesse condizioni di `library-plan`: assi
    // del container (grezzi) nell'ordine del contratto e plugin data = contractId.
    const rawAxesInOrder =
      raw.axes.length === expectedAxes.length && raw.axes.every((axis, index) => axis === expectedAxes[index]);
    const addCellBlockers: string[] = [];
    if (!rawAxesInOrder) {
      addCellBlockers.push(`gli assi del container nell'ordine del contratto [${expectedAxes.join(", ")}] (trovati [${raw.axes.join(", ")}])`);
    }
    if (raw.pluginData !== expectedPluginData) {
      addCellBlockers.push(`il contratto alla versione corrente (plugin data "${expectedPluginData}", prima bump:contract)`);
    }
    /** Kind di un gruppo di celle mancanti: come per la singola cella (design, poi blocchi di addCell). */
    const missingCellsKind = (keys: readonly string[]): ProblemKind => {
      if (keys.some((key) => design?.cells[key] === undefined)) return "missing-cell-undesigned";
      return addCellBlockers.length === 0 ? "missing-cell" : "missing-cell-blocked";
    };
    const axesDiffer =
      container.axes.length !== expectedAxes.length || expectedAxes.some((axis) => !container.axes.includes(axis));
    if (axesDiffer) {
      red(
        `Contratto "${contract.name}": proprietà di variante [${raw.axes.join(", ")}] ≠ assi del contratto [${expectedAxes.join(", ")}].`,
      );
    }
    for (const axis of contract.axes) {
      const found = container.axesValues[axis.name];
      if (!found) {
        red(`Contratto "${contract.name}": manca la proprietà d'asse "${axis.name}" (currentValues assente).`);
        continue;
      }
      const missing = axis.values.filter((value) => !found.includes(value));
      const extra = found.filter((value) => !axis.values.includes(value));
      if (extra.length > 0) {
        // Variante nata in Penpot, non adottata: in attesa, mai adottata da sola.
        const adoptable = axis.type === "option";
        pending(
          `Contratto "${contract.name}", asse "${axis.name}": valori in più [${extra.join(", ")}] in Penpot, non adottati nel contratto [${axis.values.join(", ")}] — ${
            adoptable
              ? `se la variante va adottata: pnpm adopt:variant -- ${containerName}`
              : `asse "${axis.type}": adopt:variant non lo adotta, da discutere col designer`
          }.`,
          adoptable ? "variant-not-adopted" : "variant-not-adoptable",
        );
      }
      if (missing.length > 0) {
        pending(
          `Contratto "${contract.name}", asse "${axis.name}": valori del contratto [${missing.join(", ")}] assenti in Penpot (valori trovati [${found.join(", ")}]) — le celle relative mancano: vedi le domande al designer sotto.`,
          missingCellsKind(
            expectedKeys.filter((key) => missing.some((value) => key.split("|").includes(`${axis.name}=${value}`))),
          ),
        );
      }
    }

    // Regola 5: celle = prodotto cartesiano completo; nessun variantError.
    const foundKeys = new Map<string, number>();
    /** Chiave della cella di un valore non adottato → adottabile (solo assi `option`). */
    const extraValueKeys = new Map<string, boolean>();
    for (const cell of container.cells) {
      // Una board non mappata alle varianti non può essere verificata: è un
      // errore che nomina la board, mai un salto silenzioso (review 2.4).
      if (cell.variantProps === null) {
        red(
          `Contratto "${contract.name}": la board "${cell.root.name}" non è mappata alle varianti (variantProps assente) — non è verificabile come cella.`,
        );
        continue;
      }
      const key = cellKeyOf(contract, cell.variantProps);
      foundKeys.set(key, (foundKeys.get(key) ?? 0) + 1);
      const props = cell.variantProps;
      const extraAxes = contract.axes.filter(
        (axis) => props[axis.name] !== undefined && !axis.values.includes(props[axis.name]!),
      );
      if (extraAxes.length > 0) extraValueKeys.set(key, extraAxes.every((axis) => axis.type === "option"));
      if (cell.variantError !== null) {
        red(
          `Contratto "${contract.name}", cella "${key}": variantError "${String(cell.variantError)}" — la matrice varianti è incoerente.`,
        );
      }
    }
    for (const key of expectedKeys) {
      if (!foundKeys.has(key)) {
        // Cella mancante: una domanda al designer, mai una cella inventata.
        let designHint = "";
        const kind = missingCellsKind([key]);
        if (design?.cells[key] !== undefined) {
          designHint =
            addCellBlockers.length === 0
              ? ` Il design committato la prevede: pnpm add:library la crea (addCell).`
              : ` Il design committato la prevede, ma addCell richiede ${addCellBlockers.join(" e ")}: finché no, add:library non la crea.`;
        }
        pending(
          `Contratto "${contract.name}": manca la cella "${key}" in Penpot — domanda al designer: questa combinazione va disegnata?${designHint}`,
          kind,
        );
      } else if (foundKeys.get(key)! > 1) {
        red(`Contratto "${contract.name}": la cella "${key}" compare ${foundKeys.get(key)} volte — duplicato.`);
      }
    }
    for (const key of foundKeys.keys()) {
      if (expectedKeys.includes(key)) continue;
      if (extraValueKeys.has(key)) {
        pending(
          `Contratto "${contract.name}": cella "${key}" di un valore non adottato — ${
            extraValueKeys.get(key)
              ? `in attesa dell'adozione (pnpm adopt:variant -- ${containerName})`
              : `valore di un asse state/behavior: adopt:variant non lo adotta, da discutere col designer`
          }.`,
          extraValueKeys.get(key) ? "variant-not-adopted" : "variant-not-adoptable",
        );
      } else {
        red(
          `Contratto "${contract.name}": cella "${key}" in più — non fa parte del prodotto cartesiano del contratto.`,
          "cell-not-in-contract",
        );
      }
    }

    // Regola 6: nessuna parte del contratto manca in una cella ("root" È la
    // board della cella); un layer si lega alla parte per nome o per alias.
    for (const cell of container.cells) {
      if (cell.variantProps === null) continue; // già segnalata dalla regola 5
      const key = cellKeyOf(contract, cell.variantProps);
      const names = new Set<string>();
      walkLayers(cell.root, (layer) => names.add(partOfLayer(layer.name, aliases)));
      for (const part of contract.parts) {
        if (part === "root") continue;
        if (!names.has(part)) {
          red(
            `Contratto "${contract.name}", cella "${key}": manca la parte "${part}" (nessun layer con questo nome né alias nel binding).`,
          );
        }
      }
    }

    // Regola 7: ogni proprietà (stile o binding) è nel registro delle
    // proprietà; una proprietà BLOCCATA mette il componente in attesa, una
    // non registrata o fuori lista è rossa. Ogni altra proprietà di stile
    // valorizzata ha un binding, e il binding punta a un token del catalogo.
    for (const cell of container.cells) {
      if (cell.variantProps === null) continue; // già segnalata dalla regola 5
      const key = cellKeyOf(contract, cell.variantProps);
      for (const issue of layerTreeIssues(cell.root, { component: contract.name, cell: key }, aliases)) {
        const message = `Contratto "${contract.name}", cella "${key}": ${issue.message}`;
        if (issue.blocked) pending(message, "blocked-property");
        else red(message);
      }
      walkLayers(cell.root, (layer) => {
        for (const property of Object.keys(layer.style)) {
          const definition = propertyDefinition(property);
          // Non registrata o parola chiave: già giudicata sopra dal registro.
          if (definition === undefined || definition.type.kind === "keyword") continue;
          const binding = layer.tokens[property];
          if (!binding) {
            red(
              `Contratto "${contract.name}", cella "${key}", layer "${layer.name}": la proprietà di stile "${property}" è valorizzata ma non ha binding in shape.tokens.`,
            );
            continue;
          }
          if (!tokenIndex.has(binding)) {
            red(
              `Contratto "${contract.name}", cella "${key}", layer "${layer.name}": il binding di "${property}" punta al token "${binding}", assente dal catalogo.`,
            );
          }
        }
      });
    }
  }

  // Snapshot committato (decisione 3): un componente committato assente
  // dallo snapshot letto è rosso — lo snapshot va riscritto dal vivo.
  for (const component of input.committedComponents ?? []) {
    if (!containers.some((container) => container.name === component)) {
      verdicts.red(
        component,
        `Componente committato "${component}" assente dallo snapshot della library — snapshot da aggiornare: pnpm verify:library --write-snapshot src/library/library.snapshot.json (lettura live).`,
        "snapshot-stale",
      );
    }
  }

  // Ricette committate malformate (snapshot da file): voce rossa col nome del file.
  for (const { file, error } of input.malformedRecipes ?? []) {
    verdicts.red(file, `Ricetta committata malformata: ${error}`);
  }

  // Regola 11: ogni container che dichiara un contratto via plugin data deve
  // nominare un contratto del registry — un `alert@1` senza contratto `alert`
  // non è verificato da nessuna delle regole 1–7 e resterebbe un verde finto.
  const registered = new Set(contracts.map((contract) => contract.name));
  for (const container of containers) {
    if (container.pluginData === null) continue;
    const declared = container.pluginData.split("@")[0] ?? "";
    if (!registered.has(declared)) {
      verdicts.red(
        container.name,
        `Container "${container.name}": plugin data pagebuilder/contract = "${container.pluginData}" nomina il contratto "${declared}", assente dal registry (${[...registered].join(", ")}) — container orfano: aggiungi il contratto in @app/contracts o togli il plugin data.`,
      );
    }
  }

  // Regola 8: la spec è coperta dal catalogo (nome e tipo); con il seed,
  // anche i valori coincidono con quelli decisi col designer (review 2.4).
  const rule8 = "regola 8 — copertura spec";
  global.declare(rule8);
  for (const required of spec.tokens) {
    const found = tokenIndex.get(required.name);
    if (!found) {
      global.red(rule8, `Token richiesto dalla spec "${required.name}" (type "${required.type}") assente dal catalogo.`);
    } else if (found.type !== required.type) {
      global.red(rule8, `Token "${required.name}": type "${found.type}" ≠ type richiesto dalla spec "${required.type}".`);
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
        global.red(
          rule8,
          `Token "${seedToken.name}": valore ${JSON.stringify(found.value)} ≠ valore del seed ${JSON.stringify(seedToken.value)} — il ripuntamento in Penpot è una differenza da riportare (additiva), non un silenzio del verify.`,
        );
      }
    }
  }

  // Regola 9: il catalogo (soli set attivi, come lo legge la pipeline) passa generateTheme().
  const rule9 = "regola 9 — tema";
  global.declare(rule9);
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
    global.red(rule9, `Il catalogo non passa generateTheme(): ${(error as Error).message}`);
  }

  // Regola 10: le coppie di contrasto della spec rispettano la soglia sui valori risolti.
  const rule10 = "regola 10 — contrasto";
  global.declare(rule10);
  for (const pair of spec.contrastPairs) {
    const foreground = resolveColor(pair.foreground, tokenIndex);
    const background = resolveColor(pair.background, tokenIndex);
    const scope = pair.fillPairOnly ? " (coppia fill+foreground)" : "";
    if (!foreground || !background || !parseHex(foreground) || !parseHex(background)) {
      global.red(
        rule10,
        `Coppia di contrasto ${pair.foreground} su ${pair.background}: valore non risolvibile a un colore (foreground=${JSON.stringify(foreground)}, background=${JSON.stringify(background)}).`,
      );
      continue;
    }
    const ratio = contrastRatio(foreground, background);
    if (ratio < pair.minRatio) {
      global.red(
        rule10,
        `Coppia di contrasto ${pair.foreground} su ${pair.background}${scope}: ${ratio.toFixed(2)}:1 < soglia ${pair.minRatio}:1 (${foreground} su ${background}).`,
      );
    }
  }

  const components = verdicts.verdicts();
  const globalVerdicts = global.verdicts();
  const all = [...components, ...globalVerdicts].flatMap((verdict) => verdict.problems);
  const errors = all.filter((problem) => problem.severity === "red").map((problem) => problem.message);
  const pendingMessages = all.filter((problem) => problem.severity === "pending").map((problem) => problem.message);
  return { ok: errors.length === 0, errors, pending: pendingMessages, components, global: globalVerdicts };
}

/** Il risultato di `verifyLibrary` come report per componente (terminale + Markdown). */
export function verifyReport(result: VerifyResult, notes: readonly string[] = []): ComponentReport {
  return { title: "verify:library", components: result.components, global: result.global, notes };
}
