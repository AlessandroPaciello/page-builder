import { COMPONENT_CONTRACTS, SECTION_DEFINITIONS, type SectionDefinition } from "@app/contracts";

import { byString } from "./internal";
import { kebabOf } from "./naming";
import type { Finding, Lettura, LetturaLayer } from "./schemas";
import { isSlotLayer } from "./section";
import { contractOf, definitionOf, instanceName, type ContractRegistry } from "./verify";

/**
 * Ordine di generazione (Story 2.22, sezioni nella 2.31): un componente si
 * genera solo dopo i componenti che contiene. Ordine topologico dalle istanze
 * annidate, a parità in ordine alfabetico. Un componente annidato che non è né
 * tra le letture né tra i generati è un blocco, e lo sono anche un ciclo, una
 * lettura senza definizione valida e due letture con lo stesso nome: con un
 * blocco l'ordine è vuoto.
 *
 * Una lettura può portare il contratto di un componente o di una sezione
 * (`definitionOf`): gli esempi di uno slot di sezione non sono dipendenze.
 */

export interface BuildOrder {
  /** I nomi kebab delle letture, nell'ordine in cui generarle. */
  readonly order: string[];
  readonly findings: Finding[];
}

/** Il nome kebab di una lettura: il contratto (di componente o di sezione), se c'è, altrimenti il nome del componente. */
export function letturaName(
  lettura: Pick<Lettura, "component" | "pluginData">,
  contracts: ContractRegistry = COMPONENT_CONTRACTS,
  sections: Readonly<Record<string, SectionDefinition>> = SECTION_DEFINITIONS,
): string {
  const found = definitionOf(lettura.pluginData?.contract, contracts, sections);
  return found.component?.name ?? found.section?.name ?? kebabOf(lettura.component);
}

/**
 * I nomi dei contratti annidati e, per quelli con `instance.contract`
 * (`badge@1`), i problemi di `contractOf` (contratto sconosciuto o versione
 * diversa dal codice). I figli di uno slot di sezione non si visitano: sono
 * esempi del disegno.
 */
function instancesOf(
  layer: LetturaLayer,
  out: Set<string>,
  problems: Map<string, string>,
  contracts: ContractRegistry,
  section: SectionDefinition | undefined,
): void {
  if (section !== undefined && isSlotLayer(layer, section)) return;
  // I figli di un'istanza non si visitano: sono del componente annidato.
  if (layer.instance !== undefined) {
    if (layer.instance.contract !== undefined) {
      const found = contractOf(layer.instance.contract, contracts);
      if (found.contract === undefined) {
        // Il blocco del contratto basta: il nome non entra tra le dipendenze (niente "né letto né generato").
        if (!problems.has(layer.instance.contract)) problems.set(layer.instance.contract, found.problem!);
        return;
      }
    }
    out.add(instanceName(layer.instance));
    return;
  }
  for (const child of layer.children) instancesOf(child, out, problems, contracts, section);
}

export function buildOrder(
  letture: readonly Pick<Lettura, "component" | "pluginData" | "cells">[],
  generated: readonly string[],
  contracts: ContractRegistry = COMPONENT_CONTRACTS,
  sections: Readonly<Record<string, SectionDefinition>> = SECTION_DEFINITIONS,
): BuildOrder {
  const findings: Finding[] = [];
  const deps = new Map<string, Set<string>>();
  for (const lettura of letture) {
    const found = definitionOf(lettura.pluginData?.contract, contracts, sections);
    if (found.component === undefined && found.section === undefined) {
      findings.push({ level: "blocco", where: `componente "${lettura.component}"`, message: `Contratto: ${found.problem!}` });
      continue;
    }
    const name = found.component?.name ?? found.section!.name;
    if (deps.has(name)) {
      findings.push({ level: "blocco", where: `componente "${lettura.component}"`, message: `Due letture con lo stesso nome "${name}": un contratto o una sezione si generano una volta sola.` });
      continue;
    }
    const set = new Set<string>();
    const problems = new Map<string, string>();
    for (const cell of lettura.cells) {
      // Anche la radice: un componente che è un'istanza di sé stesso è un ciclo.
      instancesOf(cell.root, set, problems, contracts, found.section);
    }
    for (const [value, problem] of [...problems].sort(([a], [b]) => byString(a, b))) {
      findings.push({ level: "blocco", where: `componente "${lettura.component}"`, message: `Istanza annidata "${value}": ${problem}` });
    }
    deps.set(name, set);
  }
  for (const [name, set] of [...deps].sort(([a], [b]) => byString(a, b))) {
    for (const dep of [...set].sort()) {
      if (!deps.has(dep) && !generated.includes(dep)) {
        findings.push({ level: "blocco", where: `componente "${name}"`, message: `Contiene "${dep}", che non è né da generare né già generato: leggi anche "${dep}" o generalo prima.` });
      }
    }
  }
  const order: string[] = [];
  const done = new Set<string>();
  const pending = new Set(deps.keys());
  while (pending.size > 0) {
    const ready = [...pending].filter((name) => [...deps.get(name)!].every((dep) => done.has(dep) || !deps.has(dep))).sort();
    if (ready.length === 0) {
      findings.push({ level: "blocco", where: `componenti [${[...pending].sort().join(", ")}]`, message: "Ciclo tra le istanze annidate: un componente contiene, direttamente o no, sé stesso." });
      break;
    }
    for (const name of ready) {
      order.push(name);
      done.add(name);
      pending.delete(name);
    }
  }
  return { order: findings.some((finding) => finding.level === "blocco") ? [] : order, findings };
}
