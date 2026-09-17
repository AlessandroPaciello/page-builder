import { COMPONENT_CONTRACTS, contractId, hasLegacyExtension, type ComponentContract, type LegacyComponentContract } from "@app/contracts";

import { pascalCase } from "../shared/naming";
import { readLibrarySnapshot, type ReadLibraryOptions } from "../library/library-reader";
import type { LibrarySnapshot } from "../library/library-snapshot";
import { FixtureSchema, type ComponentFixture } from "./recipe-schema";
import { normalizeVariants } from "./variant-normalize";

/**
 * Component reader Penpot (Story 2.5): l'estrazione NON deriva più i binding
 * per hex — legge lo snapshot di library (`library-reader.ts`, live o seam
 * `--snapshot`) e da lì il plugin data `pagebuilder/contract` del
 * VariantContainer e `shape.tokens` dei layer. Fallisce loud sui tre casi
 * malformati del plugin data (contratto duplicato, nome incoerente,
 * contratto senza container) e su ogni cella non mappabile o incoerente:
 * exit ≠ 0, zero artefatti. Nessuna decisione su dominio/headless/a11y qui —
 * quella è la ricetta (giudizio, file per contratto).
 */

export type ReadComponentOptions = ReadLibraryOptions;

/**
 * Plugin data `pagebuilder/contract = nome@versione`: kebab-case @ intero.
 * Esportato (review loop 1, BH#7+ECH#2): è la definizione UNICA — il
 * validatore la riusa, niente copie inline che driftano.
 */
export const PLUGIN_DATA_PATTERN = /^([a-z][a-z0-9-]*)@(\d+)$/;

/**
 * I contratti che la pipeline v1 vede (Story 2.12, CAP-1 in due tempi): SOLO
 * quelli con l'estensione deprecata `parts` + `partRoles`. Un contratto
 * ridotto della v2 (`product-card`) sta nel registry e nel fingerprint ma è
 * invisibile qui: nessun container, nessuna ricetta, nessun gate v1 lo
 * riguarda. È l'UNICO punto in cui la v1 sceglie i contratti; si cancella
 * con la v1 (Story 2.16).
 */
const LEGACY_CONTRACTS: readonly LegacyComponentContract[] = (Object.values(COMPONENT_CONTRACTS) as readonly ComponentContract[]).filter(hasLegacyExtension);

const CONTRACTS_BY_NAME = new Map<string, LegacyComponentContract>(LEGACY_CONTRACTS.map((contract) => [contract.name, contract]));

/** I contratti v1 nell'ordine del registry (sostituisce `Object.values(COMPONENT_CONTRACTS)` nella v1). */
export function legacyContracts(): readonly LegacyComponentContract[] {
  return LEGACY_CONTRACTS;
}

/**
 * I contratti su cui `adopt:variant` e `role:part` calcolano il fingerprint:
 * TUTTO il registry (il fingerprint copre anche i contratti ridotti, es.
 * `product-card`), con i contratti v1 passati dal chiamante al posto degli
 * omonimi. Il fingerprint resta quello del test di `@app/contracts`.
 */
export function fingerprintComponents(overrides: readonly ComponentContract[]): readonly ComponentContract[] {
  const names = new Set((Object.values(COMPONENT_CONTRACTS) as readonly ComponentContract[]).map((contract) => contract.name));
  for (const override of overrides) {
    if (!names.has(override.name)) {
      throw new Error(`fingerprintComponents: override "${override.name}" non è nel registry di @app/contracts — il fingerprint segue il chiamante solo per nomi noti.`);
    }
  }
  return (Object.values(COMPONENT_CONTRACTS) as readonly ComponentContract[]).map(
    (contract) => overrides.find((candidate) => candidate.name === contract.name) ?? contract,
  );
}

/** Contratto v1 noto per nome kebab, o undefined — `COMPONENT_CONTRACTS` non è indicizzabile per stringa libera. */
export function contractByName(name: string): LegacyComponentContract | undefined {
  return CONTRACTS_BY_NAME.get(name);
}

/** Nome contratto dal plugin data `nome@versione`; null se malformato/assente. */
function contractNameOf(pluginData: string | null): string | null {
  if (pluginData === null) return null;
  const match = PLUGIN_DATA_PATTERN.exec(pluginData);
  return match?.[1] ?? null;
}

/**
 * Funzione pura: snapshot di library → `ComponentFixture` per UN componente,
 * cercato per nome container ESATTO — nella library verificata il nome del
 * container è il PascalCase del contratto (regola 2 di `verifyLibrary`), non
 * ci sono varianti nel nome. Il contratto viene dal plugin data, mai dal
 * nome: il nome è il controllo incrociato, non la fonte.
 */
export function componentFixtureFromSnapshot(componentName: string, snapshot: LibrarySnapshot): ComponentFixture {
  const matches = snapshot.components.filter((container) => container.name === componentName);
  if (matches.length === 0) {
    throw new Error(
      `Contratto senza container: nessun VariantContainer della library si chiama "${componentName}" — l'estrazione richiede il container che dichiara il contratto via plugin data pagebuilder/contract.`,
    );
  }

  for (const container of matches) {
    if (container.pluginData === null) {
      throw new Error(
        `Il container "${container.name}" ha il nome giusto ma nessun plugin data pagebuilder/contract — il legame al contratto manca (lo scrivono solo le skill).`,
      );
    }
  }

  const declaredContracts = new Set<string>();
  for (const container of matches) {
    const name = contractNameOf(container.pluginData);
    if (name === null) {
      throw new Error(
        `Plugin data pagebuilder/contract malformato sul container "${container.name}": ${JSON.stringify(
          container.pluginData,
        )} — atteso "nome@versione".`,
      );
    }
    declaredContracts.add(name);
  }
  if (declaredContracts.size > 1) {
    throw new Error(
      `I container nominati "${componentName}" dichiarano contratti diversi (${[...declaredContracts]
        .map((name) => `"${name}"`)
        .join(", ")}) — nome incoerente con il plugin data: correggi la library in Penpot.`,
    );
  }
  // `matches[0]!.pluginData` è non-null e malformato è già stato escluso sopra.
  const contractName = contractNameOf(matches[0]!.pluginData) as string;

  // Contratto duplicato: cerco nell'intera snapshot chi dichiara lo stesso
  // contratto, non solo i container col nome richiesto — un duplicato può
  // chiamarsi diversamente e resterebbe altrimenti non visto.
  const declaring = snapshot.components.filter((container) => contractNameOf(container.pluginData) === contractName);
  if (declaring.length > 1) {
    throw new Error(
      `Contratto "${contractName}": ${declaring.length} container lo dichiarano (${declaring
        .map((container) => `"${container.name}"`)
        .join(", ")}) — un solo container per contratto (contratto duplicato).`,
    );
  }

  const contract = contractByName(contractName);
  if (contract === undefined) {
    throw new Error(
      `Il plugin data del container "${matches[0]!.name}" dichiara il contratto "${contractName}", che non esiste in @app/contracts — l'estrazione non può conformare a un contratto ignoto.`,
    );
  }

  const container = matches[0]!;

  // Nome incoerente: il nome del container è il controllo incrociato del
  // plugin data (stessa regola 2 di verifyLibrary, qui per un solo container).
  if (container.name !== pascalCase(contractName)) {
    throw new Error(
      `Nome incoerente: il container che dichiara il contratto "${contractName}" si chiama "${container.name}", atteso "${pascalCase(
        contractName,
      )}" (PascalCase del contratto).`,
    );
  }

  // Versione: il plugin data deve coincidere con contractId(contract)
  // (stessa regola 3 di verifyLibrary).
  if (container.pluginData !== contractId(contract)) {
    throw new Error(
      `Contratto "${contractName}": plugin data pagebuilder/contract = "${container.pluginData}", atteso "${contractId(
        contract,
      )}".`,
    );
  }

  // Normalizzazione unica (Story 2.8 parte B): maiuscole, spazi e ordine
  // degli assi di Penpot verso il contratto, per nome. Una collisione
  // (due valori che normalizzati coincidono) ferma l'estrazione.
  const normalized = normalizeVariants(container.name, contract, {
    axes: container.axes,
    axesValues: container.axesValues,
    cells: container.cells.map((cell) => cell.variantProps),
  });
  if (normalized.collisions.length > 0) {
    throw new Error(normalized.collisions.join("\n"));
  }

  for (const cell of container.cells) {
    if (cell.variantProps === null) {
      throw new Error(
        `Componente "${container.name}": la board "${cell.root.name}" non è mappata alle varianti (variantProps assente) — nella library verificata ogni board è una cella del prodotto cartesiano.`,
      );
    }
    if (cell.variantError !== null) {
      throw new Error(
        `Componente "${container.name}", cella ${JSON.stringify(cell.variantProps)}: variantError "${cell.variantError}" — la matrice varianti su Penpot è incoerente: correggi il componente in Penpot.`,
      );
    }
  }

  const fixture = {
    componentName: container.name,
    contract: container.pluginData,
    penpotComponentId: container.id,
    axes: normalized.axes.map((name) => ({ name, values: canonicalValues(contract, name, normalized.axesValues[name] ?? []) })),
    // Ordine canonico (Story 2.9): Penpot non garantisce l'ordine dei figli
    // del container (l'aggiunta di un container l'ha invertito), e una fixture
    // che dipende da quell'ordine fa un drift finto. Le celle seguono il
    // prodotto cartesiano del contratto: assi e valori nell'ordine dichiarato.
    cells: container.cells
      .map((cell, index) => ({ variantProps: { ...normalized.cells[index] }, root: cell.root }))
      .sort((left, right) => compareCells(contract, left.variantProps, right.variantProps)),
  };

  const parsed = FixtureSchema.safeParse(fixture);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`);
    throw new Error(`La fixture derivata dallo snapshot non passa FixtureSchema:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

type ContractAxes = { readonly axes: readonly { readonly name: string; readonly values: readonly string[] }[] };

/**
 * Ordine canonico di due valori d'asse: per posizione fra quelli dichiarati
 * dal contratto. Un valore che il contratto non ha (variante non ancora
 * adottata) va dopo quelli noti, in ordine alfabetico: l'ordinamento non
 * fallisce mai, la segnalazione resta a verify/validate.
 */
function compareValues(declared: readonly string[], a: string, b: string): number {
  if (a === b) return 0;
  const rankA = declared.indexOf(a);
  const rankB = declared.indexOf(b);
  if (rankA !== -1 && rankB !== -1) return rankA - rankB;
  if (rankA !== -1) return -1;
  if (rankB !== -1) return 1;
  return a < b ? -1 : 1;
}

/** Valori di un asse della fixture nell'ordine del contratto (non in quello di Penpot). */
function canonicalValues(contract: ContractAxes, axisName: string, values: readonly string[]): string[] {
  const declared = contract.axes.find((axis) => axis.name === axisName)?.values ?? [];
  return [...values].sort((a, b) => compareValues(declared, a, b));
}

/** Ordine canonico di due celle: asse per asse nell'ordine del contratto, valore per valore come `compareValues`. */
function compareCells(
  contract: ContractAxes,
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): number {
  for (const axis of contract.axes) {
    const order = compareValues(axis.values, left[axis.name] ?? "", right[axis.name] ?? "");
    if (order !== 0) return order;
  }
  return 0;
}

/** Estrazione live: legge lo snapshot da Penpot via MCP, poi `componentFixtureFromSnapshot`. */
export async function readComponentFixture(
  componentName: string,
  options: ReadComponentOptions = {},
): Promise<ComponentFixture> {
  const snapshot = await readLibrarySnapshot(options);
  return componentFixtureFromSnapshot(componentName, snapshot);
}
