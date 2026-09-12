import type { ComponentContract, FieldDef, FieldKind } from "./contract";
import { COMPONENT_CONTRACTS, SECTION_DEFINITIONS } from "./registry";
import type { SectionDefinition } from "./section";

const contracts: Readonly<Record<string, ComponentContract>> = COMPONENT_CONTRACTS;
const sections: Readonly<Record<string, SectionDefinition>> = SECTION_DEFINITIONS;

/** Solo chiavi proprie: `constructor`, `toString`, `__proto__` non sono campi. */
function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * Classificazione structure/content di un campo (AD-5, NFR3). Non esiste una
 * tabella separata: il `kind` vive dentro `FieldDef`, quindi un campo non può
 * esistere senza classificazione. Fail-safe: tutto ciò che non è riconosciuto
 * (componente ignoto, campo ignoto, asse `state`/`behavior` usato come prop) è
 * `content`, cioè modificabile ma sanitizzato, mai strutturale per sbaglio.
 */
export function classifyField(blockName: string, fieldName: string): FieldKind {
  const contract = own(contracts, blockName);
  if (contract) {
    if (contract.axes.some((axis) => axis.type === "option" && axis.name === fieldName)) return "structure";
    return own<FieldDef>(contract.fields, fieldName)?.kind ?? "content";
  }
  const section = own(sections, blockName);
  return (section && own(section.fields, fieldName)?.kind) ?? "content";
}
