import { contractOf, instanceName, type ContractRegistry } from "./verify";
import { kebabOf } from "./naming";
import type { Finding, Lettura, LetturaLayer } from "./schemas";
import { COMPONENT_CONTRACTS } from "@app/contracts";

/**
 * Ordine di generazione (Story 2.22): un componente si genera solo dopo i
 * componenti che contiene. Ordine topologico dalle istanze annidate, a
 * parità in ordine alfabetico. Un componente annidato che non è né tra le
 * letture né tra i generati è un blocco, e lo sono anche un ciclo, una lettura
 * senza contratto valido e due letture con lo stesso contratto: con un blocco
 * l'ordine è vuoto.
 */

export interface BuildOrder {
  /** I nomi kebab delle letture, nell'ordine in cui generarle. */
  readonly order: string[];
  readonly findings: Finding[];
}

/** Il nome kebab di una lettura: il contratto, se c'è, altrimenti il nome del componente. */
export function letturaName(lettura: Pick<Lettura, "component" | "pluginData">, contracts: ContractRegistry = COMPONENT_CONTRACTS): string {
  const found = contractOf(lettura.pluginData?.contract, contracts);
  return found.contract?.name ?? kebabOf(lettura.component);
}

function instancesOf(layer: LetturaLayer, out: Set<string>): void {
  // I figli di un'istanza non si visitano: sono del componente annidato.
  if (layer.instance !== undefined) {
    out.add(instanceName(layer.instance.component));
    return;
  }
  for (const child of layer.children) instancesOf(child, out);
}

export function buildOrder(letture: readonly Pick<Lettura, "component" | "pluginData" | "cells">[], generated: readonly string[], contracts: ContractRegistry = COMPONENT_CONTRACTS): BuildOrder {
  const findings: Finding[] = [];
  const deps = new Map<string, Set<string>>();
  for (const lettura of letture) {
    const found = contractOf(lettura.pluginData?.contract, contracts);
    if (found.contract === undefined) {
      findings.push({ level: "blocco", where: `componente "${lettura.component}"`, message: `Contratto: ${found.problem!}` });
      continue;
    }
    const name = found.contract.name;
    if (deps.has(name)) {
      findings.push({ level: "blocco", where: `componente "${lettura.component}"`, message: `Due letture con lo stesso contratto "${name}": un contratto è un componente solo.` });
      continue;
    }
    const set = new Set<string>();
    for (const cell of lettura.cells) {
      // Anche la radice: un componente che è un'istanza di sé stesso è un ciclo.
      instancesOf(cell.root, set);
    }
    deps.set(name, set);
  }
  for (const [name, set] of [...deps].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
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
