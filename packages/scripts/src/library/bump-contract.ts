import { contractId, type ComponentContract } from "@app/contracts";

import type { LibrarySnapshot } from "./library-snapshot";
import type { WriteStep } from "./penpot-writer";

/**
 * `bump:contract` (Story 2.7 parte B) — regola A, decisa da Alessandro il
 * 2026-09-13: i cambi compatibili (valori, parti, field aggiunti) alzano solo
 * `SCHEMA_VERSION`; `contract.version` si alza solo per cambi incompatibili
 * (rimozioni, rinomine di valori o field), e allora il plugin data
 * `pagebuilder/contract` del container va portato al `contractId` corrente.
 *
 * Il piano è una FUNZIONE PURA (nessun I/O). Non tocca contratti,
 * `SCHEMA_VERSION` né fingerprint: li cambia chi sviluppa.
 */

export type BumpPlan =
  | { readonly kind: "nothing"; readonly message: string }
  | {
      readonly kind: "update";
      readonly contract: string;
      readonly containerName: string;
      readonly from: string;
      readonly to: string;
    }
  | { readonly kind: "error"; readonly message: string };

export function planBump(contract: ComponentContract, snapshot: LibrarySnapshot): BumpPlan {
  const to = contractId(contract);
  const declaring = snapshot.components.filter((component) => component.pluginData?.split("@")[0] === contract.name);

  if (declaring.length === 0) {
    return {
      kind: "error",
      message:
        `Contratto "${contract.name}": nessun VariantContainer lo dichiara via plugin data pagebuilder/contract — bump:contract aggiorna solo il plugin data di un container esistente. ` +
        `Se hai rinominato il contratto, non è un bump: è un contratto nuovo, e il container col nome vecchio resta orfano (regola 11 di verify:library) finché non lo rimuovi in Penpot.`,
    };
  }
  if (declaring.length > 1) {
    return {
      kind: "error",
      message: `Contratto "${contract.name}": ${declaring.length} container lo dichiarano (${declaring.map((c) => `"${c.name}"`).join(", ")}) — un solo container per contratto; bump:contract non sceglie quale aggiornare.`,
    };
  }

  const container = declaring[0]!;
  const from = container.pluginData!;
  if (from === to) {
    return {
      kind: "nothing",
      message: `Contratto "${contract.name}": il container "${container.name}" ha già plugin data "${to}" — nulla da fare.`,
    };
  }

  const versionPart = from.slice(contract.name.length + 1);
  // Solo interi decimali canonici: `01`, `1.0`, `0x2` sono malformati, non versioni.
  const foundVersion = /^[1-9]\d*$/.test(versionPart) ? Number(versionPart) : Number.NaN;
  if (Number.isNaN(foundVersion)) {
    return {
      kind: "error",
      message: `Contratto "${contract.name}": il container "${container.name}" ha plugin data malformato "${from}" (atteso "${contract.name}@<intero ≥1>") — correggilo prima del bump.`,
    };
  }
  if (foundVersion >= contract.version) {
    return {
      kind: "error",
      message: `Contratto "${contract.name}": il container "${container.name}" ha "${from}", il contratto è "${to}" — bump:contract non abbassa la versione (niente downgrade). Alza contract.version sopra ${foundVersion} o riallinea il contratto.`,
    };
  }

  return { kind: "update", contract: contract.name, containerName: container.name, from, to };
}

/**
 * Lo step del writer: ritrova l'unico container per plugin data, rilegge il
 * valore LIVE e scrive solo se è ancora `from` (guardia contro un cambio fra
 * lettura e scrittura); restituisce il valore riletto.
 */
export function bumpStep(plan: Extract<BumpPlan, { kind: "update" }>): WriteStep {
  return {
    description: `bump:contract "${plan.contract}": plugin data ${plan.from} → ${plan.to} sul container "${plan.containerName}"`,
    code: `
const spec = ${JSON.stringify({ contract: plan.contract, from: plan.from, to: plan.to })};
function isVariantContainerShape(shape) {
  try {
    return typeof shape.isVariantContainer === "function" && shape.isVariantContainer();
  } catch (error) {
    return false;
  }
}
function pluginDataOf(shape) {
  try {
    return shape.getSharedPluginData("pagebuilder", "contract") || null;
  } catch (error) {
    return null;
  }
}
const declaring = (penpotUtils.findShapes((shape) => isVariantContainerShape(shape)) || []).filter(
  (shape) => (pluginDataOf(shape) || "").split("@")[0] === spec.contract,
);
if (declaring.length !== 1) {
  throw new Error("bump:contract \\"" + spec.contract + "\\": atteso UN container che dichiara il contratto, trovati " + declaring.length + " — nessuna scrittura.");
}
const container = declaring[0];
const current = pluginDataOf(container);
if (current !== spec.from) {
  throw new Error("bump:contract \\"" + spec.contract + "\\": plugin data del container \\"" + container.name + "\\" atteso \\"" + spec.from + "\\", trovato \\"" + current + "\\" — cambiato dopo la lettura, nessuna scrittura.");
}
container.setSharedPluginData("pagebuilder", "contract", spec.to);
return { container: container.name, pluginData: pluginDataOf(container) };
`,
  };
}
