import type { ComponentContract } from "@app/contracts";

import type { PenpotTokenValue, TokenType } from "../theme-generator";
import type { LibrarySpec, SemanticSeed } from "./library-spec";
import type { LibrarySnapshot } from "./library-snapshot";

/**
 * Piano di bootstrap/additiva come FUNZIONE PURA (Story 2.4, Task 3): niente
 * I/O, nessuna chiamata MCP. Decide COSA scrivere su Penpot; lo scrive
 * `penpot-writer.ts` (Task 5), l'esito lo decide `verifyLibrary` (Task 4).
 *
 * Invariante garantita dal tipo: `Operation` NON ha varianti per update o
 * delete — l'additiva crea solo ciò che manca e segnala le differenze senza
 * correggerle (sistemarle è del designer in Penpot o di un cambio esplicito
 * di contratto).
 */

/** Le proprietà di stile che un design può legare a un token (nomi `TokenProperty` di Penpot). */
export type StyleProperty =
  | "fill"
  | "strokeColor"
  | "strokeWidth"
  | "borderRadiusTopLeft"
  | "borderRadiusTopRight"
  | "borderRadiusBottomRight"
  | "borderRadiusBottomLeft"
  | "rowGap"
  | "columnGap"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "fontSize"
  | "fontWeight"
  | "fontFamilies"
  | "letterSpacing"
  | "opacity"
  | "shadow";

/** Il tipo di shape da creare per una parte: `root` è sempre la board della cella. */
export type PartKind = "board" | "text" | "path";

export interface DesignPart {
  readonly kind: PartKind;
  /** Parte contenitore (`"root"` = la board della cella); assente = figlia diretta della board. */
  readonly parent?: string;
  /** Contenuto campione per `kind: "text"` (il designer lo cambia in Penpot). */
  readonly text?: string;
  /** Dimensione della board (solo `kind: "board"`): è layout, libera, non tokenizzata. */
  readonly size?: readonly [number, number];
  /** Direzione del flex layout della board. */
  readonly dir?: "row" | "column";
  /** Allineamento verticale/orizzontale del flex (`alignItems`). */
  readonly align?: "start" | "center" | "end" | "baseline" | "stretch";
}

/**
 * Il disegno di partenza per un contratto: ruolo → token per parte × cella.
 * Ogni proprietà di stile è un'applicazione di token, mai un literal senza
 * binding; il designer poi cambia tutto in Penpot.
 */
export interface ComponentDesign {
  readonly parts: Readonly<Record<string, DesignPart>>;
  /** Chiave cella (`"variant=default|size=sm"`, assi in ordine contratto) → parte → proprietà → token. */
  readonly cells: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>>;
}

/** Parte di una cella nel piano: cosa creare e quali token legare. */
export interface ContainerPartPlan {
  readonly name: string;
  readonly kind: PartKind;
  readonly parent: string | null;
  readonly text?: string;
  readonly size?: readonly [number, number];
  readonly dir?: "row" | "column";
  readonly align?: "start" | "center" | "end" | "baseline" | "stretch";
  /** `TokenProperty` → nome token (risolto dal design, validato contro la spec). */
  readonly tokens: Readonly<Record<string, string>>;
}

export interface ContainerCellPlan {
  readonly variantProps: Readonly<Record<string, string>>;
  readonly parts: readonly ContainerPartPlan[];
}

export type Operation =
  | { readonly kind: "createSet"; readonly set: string }
  | { readonly kind: "createToken"; readonly set: string; readonly name: string; readonly type: TokenType; readonly value: PenpotTokenValue }
  | {
      readonly kind: "createContainer";
      readonly contract: string;
      readonly containerName: string;
      readonly pluginData: string;
      readonly axes: ReadonlyArray<{ readonly name: string; readonly values: readonly string[] }>;
      readonly cells: readonly ContainerCellPlan[];
    };

/** Una divergenza trovata dall'additiva: nomina il soggetto, l'atteso e il trovato. */
export interface Difference {
  readonly subject: string;
  readonly expected: string;
  readonly found: string;
}

export interface LibraryPlanResult {
  /** Solo in bootstrap su library non vuota: motivo che nomina cosa ha trovato. */
  readonly refused?: string;
  readonly operations: readonly Operation[];
  readonly differences: readonly Difference[];
}

export interface PlanLibraryInput {
  readonly mode: "bootstrap" | "additive";
  /** I contratti, nell'ordine del registry: è l'ordine dei container nel piano. */
  readonly contracts: readonly ComponentContract[];
  readonly spec: LibrarySpec;
  readonly seed: SemanticSeed;
  readonly designs: Readonly<Record<string, ComponentDesign>>;
  readonly snapshot: LibrarySnapshot;
}

/** `badge` → `Badge`, `accordion-item` → `AccordionItem`: il nome del container in Penpot. */
export function pascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((word) => (word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join("");
}

/** Chiave cella nel design: assi in ordine contratto, `variant=default|size=sm`. */
function cellKey(contract: ComponentContract, values: readonly string[]): string {
  return contract.axes.map((axis, index) => `${axis.name}=${values[index]}`).join("|");
}

/** Prodotto cartesiano completo dei valori degli assi, in ordine contratto. */
function cartesian(contract: ComponentContract): string[][] {
  let out: string[][] = [[]];
  for (const axis of contract.axes) {
    out = out.flatMap((prefix) => axis.values.map((value) => [...prefix, value]));
  }
  return out;
}

function sameValue(a: PenpotTokenValue, b: PenpotTokenValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Confronto tollerante sul case per i colori hex (Penpot può restituire lowercase). */
function sameColorish(a: PenpotTokenValue, b: PenpotTokenValue): boolean {
  if (typeof a === "string" && typeof b === "string" && /^#[0-9a-fA-F]{6}$/.test(a) && /^#[0-9a-fA-F]{6}$/.test(b)) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return sameValue(a, b);
}

function designFor(contract: ComponentContract, designs: PlanLibraryInput["designs"]): ComponentDesign {
  const design = designs[contract.name];
  if (!design) {
    throw new Error(`Design mancante per il contratto "${contract.name}" — aggiungi designs/${contract.name}.design.json.`);
  }
  return design;
}

function containerOperation(contract: ComponentContract, designs: PlanLibraryInput["designs"]): Operation {
  const design = designFor(contract, designs);

  const cells: ContainerCellPlan[] = cartesian(contract).map((values) => {
    const key = cellKey(contract, values);
    const cellDesign = design.cells[key];
    if (!cellDesign) {
      throw new Error(`Design "${contract.name}": manca la cella "${key}" — ogni cella del prodotto cartesiano deve essere coperta.`);
    }
    const variantProps: Record<string, string> = {};
    contract.axes.forEach((axis, index) => {
      variantProps[axis.name] = values[index]!;
    });
    const parts: ContainerPartPlan[] = contract.parts.map((partName) => {
      const partDesign = design.parts[partName];
      if (!partDesign) {
        throw new Error(`Design "${contract.name}": manca la parte "${partName}" (cella "${key}").`);
      }
      const styleTokens = cellDesign[partName] ?? {};
      return {
        name: partName,
        kind: partDesign.kind,
        parent: partDesign.parent ?? null,
        ...(partDesign.text !== undefined ? { text: partDesign.text } : {}),
        ...(partDesign.size !== undefined ? { size: partDesign.size } : {}),
        ...(partDesign.dir !== undefined ? { dir: partDesign.dir } : {}),
        ...(partDesign.align !== undefined ? { align: partDesign.align } : {}),
        tokens: styleTokens,
      };
    });
    return { variantProps, parts };
  });

  return {
    kind: "createContainer",
    contract: contract.name,
    containerName: pascalCase(contract.name),
    pluginData: `${contract.name}@${contract.version}`,
    axes: contract.axes.map((axis) => ({ name: axis.name, values: [...axis.values] })),
    cells,
  };
}

/**
 * Il piano. Bootstrap: o rifiuta (library non vuota) o produce TUTTO in ordine
 * deterministico. Additiva: crea solo i token mancanti e i container dei
 * contratti senza container legato via plugin data; per ciò che esiste ma
 * diverge produce `differences` e nessuna operazione.
 */
export function planLibrary(input: PlanLibraryInput): LibraryPlanResult {
  const { mode, contracts, seed, designs, snapshot } = input;

  if (mode === "bootstrap") {
    const found: string[] = [];
    if (snapshot.sets.length > 0) {
      const sets = snapshot.sets.length;
      found.push(`${sets} ${sets === 1 ? "set di token" : "set di token"} (${snapshot.sets.map((set) => set.name).join(", ")})`);
    }
    if (snapshot.componentCount > 0) {
      const count = snapshot.componentCount;
      found.push(`${count} ${count === 1 ? "componente" : "componenti"} in library.local`);
    }
    if (found.length > 0) {
      return {
        refused: `Bootstrap rifiutato: la library non è vuota — trovati ${found.join(" e ")}. Usa la modalità additiva o un file nuovo.`,
        operations: [],
        differences: [],
      };
    }

    const operations: Operation[] = [
      { kind: "createSet", set: "palette" },
      { kind: "createSet", set: "semantic" },
      ...seed.palette.map(
        (token): Operation => ({ kind: "createToken", set: "palette", name: token.name, type: token.type, value: token.value }),
      ),
      ...seed.semantic.map(
        (token): Operation => ({ kind: "createToken", set: "semantic", name: token.name, type: token.type, value: token.value }),
      ),
      ...contracts.map((contract) => containerOperation(contract, designs)),
    ];
    return { operations, differences: [] };
  }

  // Modalità additiva
  const operations: Operation[] = [];
  const differences: Difference[] = [];

  const existingTokens = new Map<string, { type: TokenType; value: PenpotTokenValue; set: string }>();
  for (const set of snapshot.sets) {
    for (const token of set.tokens) {
      existingTokens.set(token.name, { type: token.type, value: token.value, set: set.name });
    }
  }

  const missingSets = new Set<string>();
  const seedSets: Array<{ name: string; tokens: SemanticSeed["palette"] | SemanticSeed["semantic"] }> = [
    { name: "palette", tokens: seed.palette },
    { name: "semantic", tokens: seed.semantic },
  ];
  const existingSetNames = new Set(snapshot.sets.map((set) => set.name));

  for (const { name: setName, tokens } of seedSets) {
    for (const seedToken of tokens) {
      const existing = existingTokens.get(seedToken.name);
      if (!existing) {
        if (!existingSetNames.has(setName) && !missingSets.has(setName)) {
          missingSets.add(setName);
          operations.push({ kind: "createSet", set: setName });
        }
        operations.push({ kind: "createToken", set: setName, name: seedToken.name, type: seedToken.type, value: seedToken.value });
        continue;
      }
      if (existing.type !== seedToken.type || !sameColorish(existing.value, seedToken.value)) {
        differences.push({
          subject: `token ${seedToken.name}`,
          expected: `${seedToken.type} = ${JSON.stringify(seedToken.value)}`,
          found: `${existing.type} = ${JSON.stringify(existing.value)}`,
        });
      }
    }
  }

  for (const contract of contracts) {
    const containerName = pascalCase(contract.name);
    const expectedPluginData = `${contract.name}@${contract.version}`;
    const covered = snapshot.components.filter(
      (component) =>
        component.pluginData?.split("@")[0] === contract.name ||
        component.name === containerName ||
        component.name === contract.name,
    );
    if (covered.length === 0) {
      operations.push(containerOperation(contract, designs));
      continue;
    }
    for (const component of covered) {
      if (component.name !== containerName) {
        differences.push({
          subject: `container ${containerName}`,
          expected: `nome "${containerName}"`,
          found: `nome "${component.name}"`,
        });
      }
      if (component.pluginData !== expectedPluginData) {
        differences.push({
          subject: `container ${containerName}`,
          expected: `plugin data pagebuilder/contract = "${expectedPluginData}"`,
          found: `plugin data = ${component.pluginData === null ? "assente" : `"${component.pluginData}"`}`,
        });
      }
      const expectedAxes = contract.axes.map((axis) => axis.name);
      const axesMismatch =
        component.axes.length !== expectedAxes.length || component.axes.some((axis, index) => axis !== expectedAxes[index]);
      if (axesMismatch) {
        differences.push({
          subject: `container ${containerName}`,
          expected: `assi [${expectedAxes.join(", ")}]`,
          found: `assi [${component.axes.join(", ")}]`,
        });
      }
      for (const axis of contract.axes) {
        const found = component.axesValues[axis.name];
        if (!found) continue;
        const missing = axis.values.filter((value) => !found.includes(value));
        const extra = found.filter((value) => !axis.values.includes(value));
        if (missing.length > 0 || extra.length > 0) {
          differences.push({
            subject: `container ${containerName}, asse ${axis.name}`,
            expected: `valori [${axis.values.join(", ")}]`,
            found: `valori [${found.join(", ")}]`,
          });
        }
      }
    }
  }

  return { operations, differences };
}
