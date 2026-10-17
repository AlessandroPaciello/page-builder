/**
 * Prototipo dello spike (2026-10-10): Penpot (set + temi) → theme.css + un file per variante.
 *
 * Uso (dalla root del repo, con PENPOT_MCP_TOKEN):
 *   pnpm --filter @penpot-ds/scripts exec node --import tsx \
 *     ../../_bmad-output/spikes/penpot-ai-kit-2026-10-10/tailwind-to-penpot/extract-themes.ts [cartella-uscita]
 *
 * Regole:
 * - un gruppo di temi con più di un tema è un asse di varianti (es. `brand`);
 *   il tema `default` del gruppo non aggiunge set;
 * - un set che compare solo nei temi non-default di un asse è un set di variante;
 *   tutti gli altri set formano il tema base (letti anche se non attivi);
 * - base → `theme.css` con il generatore esistente (`generateTheme`);
 * - ogni variante → `themes/<gruppo>-<nome>.css` con le sole variabili che
 *   cambiano rispetto alla base, sotto `[data-<gruppo>="<nome>"]`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { callPenpotTool, parseExecuteCodeEnvelope, resolveMcpEndpoint } from "../../../../packages/scripts/src/shared/mcp-client";
import { generateTheme, type PenpotTokenSet, type TokenCatalog } from "../../../../packages/scripts/src/shared/theme-generator";

interface PenpotTheme {
  group: string;
  name: string;
  sets: string[];
}

const READ_CODE = `
const cat = penpot.library.local.tokens;
return {
  sets: cat.sets.map((s) => ({ name: s.name, tokens: s.tokens.map((t) => ({ name: t.name, type: t.type, value: t.value })) })),
  themes: cat.themes.map((t) => ({ group: t.group, name: t.name, sets: t.activeSets.map((s) => s.name) })),
};
`;

function cssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const m of css.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) vars.set(m[1]!, m[2]!);
  return vars;
}

async function main(): Promise<void> {
  const outDir = resolve(process.argv[2] ?? join(import.meta.dirname, "out"));
  const result = await callPenpotTool(resolveMcpEndpoint(), { name: "execute_code", arguments: { code: READ_CODE } }, "lettura set e temi", 60_000);
  const { sets, themes } = parseExecuteCodeEnvelope(result, "set e temi").result as { sets: PenpotTokenSet[]; themes: PenpotTheme[] };

  const groups = new Map<string, PenpotTheme[]>();
  for (const t of themes) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  const variants = [...groups.values()].filter((g) => g.length > 1).flatMap((g) => g.filter((t) => t.name !== "default"));
  const variantSetNames = new Set(variants.flatMap((t) => t.sets));

  const base: TokenCatalog = { sets: sets.filter((s) => !variantSetNames.has(s.name)) };
  const baseCss = generateTheme(base).css;
  const baseVars = cssVars(baseCss);

  mkdirSync(join(outDir, "themes"), { recursive: true });
  writeFileSync(join(outDir, "theme.css"), baseCss);
  const report: string[] = [`base: ${base.sets.map((s) => s.name).join(", ")} → theme.css (${baseVars.size} variabili)`];

  for (const variant of variants) {
    const overrides = new Map(sets.filter((s) => variant.sets.includes(s.name)).flatMap((s) => s.tokens.map((t) => [t.name, t] as const)));
    const unknown = [...overrides.keys()].filter((n) => !base.sets.some((s) => s.tokens.some((t) => t.name === n)));
    if (unknown.length > 0) throw new Error(`variante ${variant.group}/${variant.name}: token assenti dalla base ${unknown.join(", ")}`);
    const merged: TokenCatalog = { sets: base.sets.map((s) => ({ ...s, tokens: s.tokens.map((t) => overrides.get(t.name) ?? t) })) };
    const changed = [...cssVars(generateTheme(merged).css)].filter(([k, v]) => baseVars.get(k) !== v);
    const file = `themes/${variant.group}-${variant.name}.css`;
    writeFileSync(
      join(outDir, file),
      `/* @generated dal tema Penpot "${variant.group}/${variant.name}" — DO NOT EDIT BY HAND. */\n[data-${variant.group}="${variant.name}"] {\n${changed.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n`,
    );
    report.push(`variante ${variant.group}/${variant.name}: set ${variant.sets.join(", ")} → ${file} (${changed.length} variabili)`);
  }
  console.log(report.join("\n"));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
