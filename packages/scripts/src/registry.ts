import { accordionItemExtraction } from "./contracts/accordion-item.extract";
import { alertExtraction } from "./contracts/alert.extract";
import { badgeExtraction } from "./contracts/badge.extract";
import { inputExtraction } from "./contracts/input.extract";
import { productCardExtraction } from "./contracts/product-card.extract";
import { ScriptError } from "./errors";
import type { ExtractionContract } from "./extraction";

/**
 * Registro dei contratti di estrazione v2 (Story 2.13, CAP-6/CAP-7): l'unica
 * fonte dei comandi `library` e `propose`. Un componente è noto se il suo
 * container Penpot (`penpot.container`, PascalCase) o il suo nome page builder
 * (`contract.name`, kebab-case) è qui. Ordine di rigenerazione della 2.16:
 * Badge → Input → Alert → AccordionItem ultimo (ProductCard resta prima, verde).
 */
export const EXTRACTION_CONTRACTS: Readonly<Record<string, ExtractionContract>> = {
  ProductCard: productCardExtraction,
  Badge: badgeExtraction,
  Input: inputExtraction,
  Alert: alertExtraction,
  AccordionItem: accordionItemExtraction,
};

/** Nomi dei container v2 noti, nell'ordine di registrazione. */
export function knownExtractionNames(): string[] {
  return Object.keys(EXTRACTION_CONTRACTS);
}

/**
 * Risolve `<Comp>` al contratto di estrazione: accetta il nome del container
 * (`ProductCard`) o del contratto page builder (`product-card`). Sconosciuto =
 * `ScriptError` `input` (exit 1) che nomina il componente e i contratti v2 noti.
 */
export function resolveExtraction(name: string): ExtractionContract {
  const direct = (EXTRACTION_CONTRACTS as Record<string, ExtractionContract | undefined>)[name];
  if (direct !== undefined) return direct;
  const byContract = Object.values(EXTRACTION_CONTRACTS).find((candidate) => candidate.contract.name === name);
  if (byContract !== undefined) return byContract;
  const known = knownExtractionNames().join(", ") || "<nessuno>";
  throw new ScriptError({
    kind: "input",
    component: name,
    detail: `componente "${name}" sconosciuto — contratti v2 noti: ${known}.`,
  });
}
