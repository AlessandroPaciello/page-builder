/**
 * Spike 2026-10-10 — CLI del test v3.
 *   node --import tsx src/v3/cli.ts verify   <Comp> [--snapshot f] [--save-snapshot f]
 *   node --import tsx src/v3/cli.ts generate <Comp> [--snapshot f] [--save-snapshot f]
 *   node --import tsx src/v3/cli.ts styles   <Comp> [--snapshot f] [--save-snapshot f]
 *     (2026-10-11) stili generati, componente tuo: riscrive solo <Comp>.styles.ts e la story;
 *     <Comp>.tsx lo crea se manca, altrimenti ne controlla i data-slot.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";

import { shopCardBinding } from "../contracts/shop-card.binding";
import { parseLibrarySnapshot, readLibrarySnapshot } from "../library/library-reader";
import type { LibrarySnapshot } from "../library/library-snapshot";
import { PATHS } from "../shared/paths";
import type { TokenCatalog } from "../shared/theme-generator";
import type { Binding } from "./binding";
import { findContainer, generate, verify } from "./generate";
import { checkSlots, generateStyles, scaffold } from "./styles";

const BINDINGS: Record<string, Binding> = { ShopCard: shopCardBinding as unknown as Binding };
/** Cartella dei componenti già esistenti (per gli import dei componenti annidati). */
const DOMAINS: Record<string, string> = { badge: "data-display", input: "inputs", alert: "feedback", "accordion-item": "layout", "product-card": "commerce", "shop-card": "commerce" };

async function main(): Promise<number> {
  const [command, comp, ...rest] = process.argv.slice(2);
  const opt = (name: string): string | undefined => {
    const i = rest.indexOf(name);
    return i === -1 ? undefined : rest[i + 1];
  };
  const binding = comp === undefined ? undefined : BINDINGS[comp];
  if ((command !== "verify" && command !== "generate" && command !== "styles") || binding === undefined) {
    console.error("uso: verify|generate|styles <Comp> [--snapshot f] [--save-snapshot f]  (noti: " + Object.keys(BINDINGS).join(", ") + ")");
    return 1;
  }
  const snapshotFile = opt("--snapshot");
  const snapshot: LibrarySnapshot = snapshotFile ? parseLibrarySnapshot(JSON.parse(readFileSync(snapshotFile, "utf8"))) : await readLibrarySnapshot({});
  const save = opt("--save-snapshot");
  if (save) {
    mkdirSync(dirname(resolve(save)), { recursive: true });
    writeFileSync(save, JSON.stringify(snapshot, null, 1));
  }
  const out = resolve(process.cwd(), "../ui/src/domains");
  const comp2 = comp!;
  const target = join(out, binding.domain, `${comp2}.tsx`);
  /** [E] File senza `@generated`: staccato a mano, il generatore non lo tocca. */
  const detached = existsSync(target) && !readFileSync(target, "utf8").split("\n", 1)[0]!.includes("@generated");
  const behaviorFile = join(out, binding.domain, `${comp2}.behavior.ts`);
  const contracts = COMPONENT_CONTRACTS as unknown as Record<string, (typeof COMPONENT_CONTRACTS)[keyof typeof COMPONENT_CONTRACTS]>;
  const { findings, template } = verify(binding, findContainer(snapshot, binding.contract), contracts);
  /** File senza @generated: è dello sviluppatore (modello "stili generati"), si controllano i data-slot. */
  const owned = detached;
  /** Blocchi sui data-slot del file dello sviluppatore: li risolve AC con un diff, quindi non fermano gli stili. */
  const slotFindings = owned && template !== undefined ? checkSlots(binding, template, readFileSync(target, "utf8")) : [];
  findings.push(...slotFindings);
  if (detached && command === "generate") findings.push({ level: "avviso", where: `${binding.domain}/${comp2}.tsx`, message: "staccato: senza @generated, non viene rigenerato; i cambi in Penpot non arrivano" });
  if (command === "generate" && (binding.behavior?.length ?? 0) > 0 && !existsSync(behaviorFile)) findings.push({ level: "blocco", where: `${binding.domain}/${comp2}.behavior.ts`, message: "il collegamento dichiara un comportamento ma il file non esiste" });
  const blocks = findings.filter((f) => f.level === "blocco");
  const warns = findings.filter((f) => f.level === "avviso");
  console.log(`[VC] ${binding.contract.name}: ${blocks.length} blocchi, ${warns.length} avvisi`);
  for (const f of findings) console.log(`  ${f.level === "blocco" ? "✖" : "⚠"} ${f.where}: ${f.message}`);
  if (command === "verify") return blocks.length > 0 ? 3 : 0;
  const blocking = command === "styles" ? blocks.filter((f) => !slotFindings.includes(f)) : blocks;
  if (blocking.length > 0 || template === undefined) {
    console.log("[GC] non genero: ci sono blocchi di struttura.");
    return 3;
  }
  const catalog = JSON.parse(readFileSync(PATHS.catalogPath, "utf8")) as TokenCatalog;
  const full = generate({ binding, template, catalog, contracts, domains: DOMAINS });
  const files =
    command === "styles"
      ? [generateStyles({ binding, template, catalog, contracts }), ...(owned ? [] : [scaffold({ binding, template, contracts, domains: DOMAINS })]), full[1]!]
      : full;
  if (owned) console.log(`[GC] ${comp2}.tsx esiste: è tuo, non lo tocco`);
  const toAlign = slotFindings.filter((f) => f.level === "blocco");
  if (toAlign.length > 0) console.log(`[AC] da allineare nel tuo ${comp2}.tsx (proposta di diff): ${toAlign.map((f) => f.where).join(", ")}`);
  for (const f of files) {
    if (detached && f.path.endsWith(`${comp2}.tsx`)) {
      console.log(`[GC] salto ${f.path}: staccato`);
      continue;
    }
    mkdirSync(dirname(join(out, f.path)), { recursive: true });
    writeFileSync(join(out, f.path), f.content);
    console.log(`[GC] scritto ${f.path}`);
  }
  return toAlign.length > 0 ? 3 : 0;
}

main().then((code) => process.exit(code), (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
