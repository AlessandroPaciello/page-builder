import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ComponentContract } from "@app/contracts";

import { PATHS } from "../shared/paths";
import type { ComponentDesign } from "./library-plan";

/**
 * Loader dei design committati (Story 2.7, problema 3): i design sono
 * `data/designs/<contratto>.design.json`, e la chiave è il nome del file. Nessuna
 * lista a mano nel CLI o nei test: un design nuovo entra per costruzione, e
 * la copertura design↔registry dei contratti la verifica `designCoverage`.
 * Stesso schema di `committedComponents` (emitter/artifacts.ts).
 */

export const designsDir = PATHS.designsDir;

const DESIGN_SUFFIX = ".design.json";

function isDesignShape(value: unknown): value is ComponentDesign {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const isRecord = (entry: unknown): boolean => typeof entry === "object" && entry !== null && !Array.isArray(entry);
  return isRecord(candidate.parts) && isRecord(candidate.cells);
}

/**
 * Design committati, chiave = nome del contratto (nome file senza
 * `.design.json`), in ordine alfabetico per output deterministico. Errore
 * nominativo su JSON malformato, forma sbagliata o directory senza design.
 */
export function committedDesigns(dir: string = designsDir): Record<string, ComponentDesign> {
  const entries = readdirSync(dir)
    .filter((entry) => entry.endsWith(DESIGN_SUFFIX))
    .sort();
  if (entries.length === 0) {
    throw new Error(`Nessun design committato in ${dir} — attesi file <contratto>${DESIGN_SUFFIX}.`);
  }
  const designs: Record<string, ComponentDesign> = {};
  for (const entry of entries) {
    const path = resolve(dir, entry);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      throw new Error(`Il design "${path}" non è JSON leggibile: ${(error as Error).message}`);
    }
    if (!isDesignShape(json)) {
      throw new Error(`Il design "${path}" non ha la forma { parts: {…}, cells: {…} }.`);
    }
    designs[entry.slice(0, -DESIGN_SUFFIX.length)] = json;
  }
  return designs;
}

export interface DesignCoverage {
  readonly ok: boolean;
  /** Contratti del registry senza `designs/<nome>.design.json`. */
  readonly contractsWithoutDesign: readonly string[];
  /** Design senza contratto omonimo nel registry. */
  readonly designsWithoutContract: readonly string[];
}

/** Copertura design↔registry in entrambi i sensi: i nomi mancanti, ordinati. */
export function designCoverage(
  designs: Readonly<Record<string, ComponentDesign>>,
  contracts: readonly Pick<ComponentContract, "name">[],
): DesignCoverage {
  const contractNames = new Set(contracts.map((contract) => contract.name));
  const designNames = new Set(Object.keys(designs));
  const contractsWithoutDesign = [...contractNames].filter((name) => !designNames.has(name)).sort();
  const designsWithoutContract = [...designNames].filter((name) => !contractNames.has(name)).sort();
  return {
    ok: contractsWithoutDesign.length === 0 && designsWithoutContract.length === 0,
    contractsWithoutDesign,
    designsWithoutContract,
  };
}
