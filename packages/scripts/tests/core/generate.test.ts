import { badge, defineContract } from "@app/contracts";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  Change,
  componentPaths,
  decompose,
  fieldShape,
  generateComponent,
  partsOfStyles,
  verifyComponent,
  readGeneratedHeader,
  STATE_PREFIXES,
  Suggerimento,
  type GenerateInput,
  type Lettura,
  type LetturaLayer,
} from "../../src/core";
import { badgeInstance, badgeLettura, badgeRoot, CONTRACTS, layer, SCALE, shopCardLettura, tokenTypeOf } from "../fixtures/components";

/**
 * Livello 1 della CI (Story 2.22): generazione di `styles.ts`, story e
 * scaffold con `Lettura` scritte a mano. La matrice della spec, poi i casi
 * di scomposizione, stati, file esistenti e cambi di struttura.
 */

const base = { tokenTypeOf, scale: SCALE, contracts: CONTRACTS, generated: [] as string[] };

const generate = (lettura: Lettura, extra: Partial<GenerateInput> = {}) => generateComponent(lettura, { ...base, ...extra });

const contentOf = (changes: readonly Change[], suffix: string): string => {
  const change = changes.find((candidate) => candidate.path.endsWith(suffix));
  if (change === undefined || change.action === "elimina") throw new Error(`nessun Change con contenuto per ${suffix}`);
  return change.content;
};

const label = (): LetturaLayer => layer({ name: "Testo", kind: "text", pluginData: { part: "label" }, tokens: { fontSize: "text.xs" } });

describe("generateComponent — matrice della spec", () => {
  it("ok: Badge → crea styles, stories e tsx, nessun finding bloccante", () => {
    const result = generate(badgeLettura());
    expect(result.findings).toEqual([]);
    expect(result.suggestions).toEqual([]);
    const paths = componentPaths("badge");
    expect(paths).toEqual({
      styles: "packages/ui/src/domains/badge/Badge.styles.ts",
      stories: "packages/ui/src/domains/badge/Badge.stories.tsx",
      tsx: "packages/ui/src/domains/badge/Badge.tsx",
    });
    expect(result.changes.map((change) => [change.action, change.path])).toEqual([
      ["crea", paths.styles],
      ["crea", paths.stories],
      ["crea", paths.tsx],
    ]);
    for (const change of result.changes) Change.parse(change);
    const styles = contentOf(result.changes, ".styles.ts");
    expect(readGeneratedHeader(styles)?.ok).toBe(true);
    expect(readGeneratedHeader(contentOf(result.changes, ".stories.tsx"))?.ok).toBe(true);
    expect(readGeneratedHeader(contentOf(result.changes, "Badge.tsx"))).toBeUndefined();
    expect(styles).toContain('export const badgeParts = ["root", "label"] as const;');
    expect(styles).toContain("export type BadgeAxes = {");
    expect(styles).toContain('  root: cva("flex flex-row", {');
    expect(styles).toContain('        default: "bg-primary",');
    expect(styles).toContain('        sm: "pl-2",');
    expect(styles).toContain('    defaultVariants: { variant: "default", size: "md" },');
    expect(styles).not.toContain("compoundVariants");
  });

  it("rosso: senza chiave (`Icon Left`) → nessun Change, la domanda lo nomina", () => {
    const result = generate(badgeLettura(() => [label(), layer({ name: "Icon Left", kind: "path" })]));
    expect(result.changes).toEqual([]);
    expect(result.findings.find((finding) => finding.level === "domanda")).toMatchObject({ key: "part", options: ["icon-left", "ignora"] });
  });

  it("rosso: chiave doppia → nessun Change; risposta lista → una cva `item`", () => {
    const children = (repeat?: string) => (): LetturaLayer[] => [
      layer({ name: "Item", pluginData: { part: "item" }, tokens: { paddingLeft: "spacing.1" } }),
      layer({ name: "Item", pluginData: { part: "item", ...(repeat === undefined ? {} : { repeat }) }, tokens: { paddingLeft: "spacing.1" } }),
    ];
    expect(generate(badgeLettura(children())).changes).toEqual([]);
    const result = generate(badgeLettura(children("lista")));
    expect(result.findings).toEqual([]);
    const styles = contentOf(result.changes, ".styles.ts");
    expect(styles.match(/^ {2}item: cva\(/gm)).toHaveLength(1);
    expect(styles).toContain('export const badgeListParts = ["item"] as const;');
    const tsx = contentOf(result.changes, "Badge.tsx");
    expect(tsx).toContain("{Array.from({ length: 2 }, (_, i) => (");
    expect(tsx).toContain('<div key={i} data-slot="item" className={s.item(axes)} />');
  });

  it("istanza ok: ShopCard con Badge destructive → `<Badge {...shopCardInstances.action(axes)} />`", () => {
    const result = generate(shopCardLettura(), { generated: ["badge"] });
    expect(result.findings).toEqual([]);
    const styles = contentOf(result.changes, ".styles.ts");
    expect(styles).toContain('import type { BadgeAxes } ' + "from" + ' "../badge/Badge.styles";');
    expect(styles).toContain('  action: (_axes: ShopCardAxes = {}): BadgeAxes => ({ variant: "destructive" }),');
    const tsx = contentOf(result.changes, "ShopCard.tsx");
    expect(tsx).toContain("{...shopCardInstances.action(axes)}");
    expect(tsx).toContain('<Badge className={s.action(axes)} {...shopCardInstances.action(axes)} label={"label"} />');
    expect(tsx).toContain('import { Badge } ' + "from" + ' "../badge/Badge";');
    expect(tsx).toContain('<h3 data-slot="heading" className={s.heading(axes)}>{heading}</h3>');
  });

  it("istanza con variante per cella → una tabella per cella", () => {
    const result = generate(shopCardLettura((promo) => badgeInstance({ variant: promo === "offer" ? "destructive" : "secondary" })), { generated: ["badge"] });
    const styles = contentOf(result.changes, ".styles.ts");
    expect(styles).toContain("const shopCardActionInstances: Readonly<Record<string, BadgeAxes>> = {");
    expect(styles).toContain('  "offer": { variant: "destructive" },');
    expect(styles).toContain('  action: (axes: ShopCardAxes = {}): BadgeAxes => shopCardActionInstances[[axes.promo ?? "none"].join("|")] ?? {},');
  });

  it("rosso: variante ignota o override → blocco, nessun Change", () => {
    for (const instance of [badgeInstance({ variant: "neon" }), badgeInstance({ variant: "default" }, ["fill"])]) {
      const result = generate(shopCardLettura(() => instance), { generated: ["badge"] });
      expect(result.changes).toEqual([]);
      expect(result.findings.some((finding) => finding.level === "blocco")).toBe(true);
    }
    expect(generate(shopCardLettura(() => badgeInstance({ variant: "default" }, ["sizingH", "width"])), { generated: ["badge"] }).changes).toHaveLength(3);
  });

  it("rosso: istanza di `badge` con generated: [] → blocco che nomina badge", () => {
    const result = generate(shopCardLettura());
    expect(result.changes).toEqual([]);
    expect(result.findings).toEqual([expect.objectContaining({ level: "blocco", where: 'parte "action"' })]);
    expect(result.findings[0]!.message).toContain('"badge"');
  });

  it("hover su size=md, variant=default → `hover:bg-…` su tutte le taglie di default", () => {
    const lettura = badgeLettura();
    const hover = badgeRoot("default", "md");
    lettura.cells.push({ variant: { variant: "default", size: "md", state: "hover" }, root: { ...hover, tokens: { ...hover.tokens, fill: "accent" } } });
    const result = generate(lettura);
    expect(result.findings).toEqual([]);
    const styles = contentOf(result.changes, ".styles.ts");
    expect(styles).toContain('        default: "bg-primary hover:bg-accent",');
    expect(styles).toContain('        secondary: "bg-secondary",');
    expect(styles).not.toContain("compoundVariants");
    // Nessuna story per le celle di stato.
    expect(contentOf(result.changes, ".stories.tsx")).not.toContain("hover");
  });

  it("rosso/verde: un hover soltanto additivo su default/md arriva a default/sm, non a secondary", () => {
    const lettura = badgeLettura();
    const hover = badgeRoot("default", "md");
    lettura.cells.push({ variant: { variant: "default", size: "md", state: "hover" }, root: { ...hover, tokens: { ...hover.tokens, paddingTop: "spacing.1" } } });
    const styles = contentOf(generate(lettura).changes, ".styles.ts");
    expect(styles).toContain('        default: "bg-primary hover:pt-1",');
    expect(styles).toContain('        secondary: "bg-secondary",');
    expect(styles).toContain('        destructive: "bg-destructive",');
  });

  it("stati su più taglie: ogni taglia disegnata tiene la sua differenza", () => {
    const lettura = badgeLettura();
    for (const [size, token] of [["sm", "spacing.1"], ["md", "spacing.2"]] as const) {
      const hover = badgeRoot("default", size);
      lettura.cells.push({ variant: { variant: "default", size, state: "hover" }, root: { ...hover, tokens: { ...hover.tokens, paddingTop: token } } });
    }
    const styles = contentOf(generate(lettura).changes, ".styles.ts");
    expect(styles).toContain('      { variant: "default", size: "sm", class: "hover:pt-1" },');
    expect(styles).toContain('      { variant: "default", size: "md", class: "hover:pt-2" },');
  });

  it("disabled disegnato: il prefisso ricalca il default di globals.css; focus non disegnato non dà classi", () => {
    const lettura = badgeLettura();
    for (const size of ["sm", "md"]) {
      const cell = badgeRoot("secondary", size);
      lettura.cells.push({ variant: { variant: "secondary", size, state: "disabled" }, root: { ...cell, tokens: { ...cell.tokens, fill: "muted" } } });
    }
    const styles = contentOf(generate(lettura).changes, ".styles.ts");
    expect(STATE_PREFIXES.disabled).toBe("[&:is(:disabled,[data-disabled],[aria-disabled=true])]:");
    expect(styles).toContain(`        secondary: "${STATE_PREFIXES.disabled}bg-muted bg-secondary",`);
    expect(styles).not.toContain("focus-visible:");
    expect(styles).not.toContain("hover:");
  });

  it("TSX esistente: nessun Change sul .tsx; due giri danno lo stesso output byte per byte", () => {
    const existingTsx = "export function Badge() { return <div className={s.root(axes)}><span className={s.label(axes)} /></div>; }\n";
    const first = generate(badgeLettura(), { existingTsx });
    const second = generate(badgeLettura(), { existingTsx });
    expect(second).toEqual(first);
    expect(first.changes.map((change) => change.path)).toEqual([componentPaths("badge").styles, componentPaths("badge").stories]);
    // Il giro dopo, con i file scritti dal primo: niente da cambiare, il .tsx resta intatto.
    const again = generate(badgeLettura(), {
      existingTsx,
      existingStyles: contentOf(first.changes, ".styles.ts"),
      existingStories: contentOf(first.changes, ".stories.tsx"),
    });
    expect(again).toEqual({ changes: [], findings: [], suggestions: [] });
  });

  it("output deterministico: l'ordine delle celle in Penpot non conta", () => {
    const lettura = badgeLettura();
    const shuffled = { ...lettura, cells: [...lettura.cells].reverse() };
    expect(generate(shuffled)).toEqual(generate(lettura));
  });

  it("parte nuova: `<id>Parts` vecchie senza `price` → aggiorna styles + suggerimento `aggiunta`", () => {
    const withoutPrice = shopCardLettura();
    for (const cell of withoutPrice.cells) cell.root.children.splice(1, 1);
    const old = generate(withoutPrice, { generated: ["badge"] });
    const existingTsx = contentOf(old.changes, "ShopCard.tsx");
    const result = generate(shopCardLettura(), {
      generated: ["badge"],
      existingTsx,
      existingStyles: contentOf(old.changes, ".styles.ts"),
      existingStories: contentOf(old.changes, ".stories.tsx"),
    });
    expect(result.changes.map((change) => [change.action, change.path])).toEqual([["aggiorna", componentPaths("shop-card").styles]]);
    expect(result.suggestions).toHaveLength(1);
    const [suggestion] = result.suggestions;
    Suggerimento.parse(suggestion);
    expect(suggestion).toMatchObject({ part: "price", kind: "aggiunta" });
    expect(suggestion!.example).toContain('<div data-slot="shop-card" className={cn(s.root(axes), className)} {...props}>');
    expect(suggestion!.example).toContain('<span data-slot="price" className={s.price(axes)} />');
    // Il TSX non usa `price`: avviso di export inutilizzato, non un blocco.
    expect(result.findings).toEqual([expect.objectContaining({ level: "avviso", where: 'parte "price"' })]);
  });

  it("parte tolta e parte diventata lista → suggerimenti `rimozione` e `lista` dal TSX attuale", () => {
    const twoItems = (repeat: boolean) => (): LetturaLayer[] => [
      label(),
      layer({ name: "Item", pluginData: { part: "item" } }),
      ...(repeat ? [layer({ name: "Item", pluginData: { part: "item", repeat: "lista" } })] : [layer({ name: "Extra", pluginData: { part: "extra" } })]),
    ];
    const old = generate(badgeLettura(twoItems(false)));
    const existingTsx = contentOf(old.changes, "Badge.tsx");
    const result = generate(badgeLettura(twoItems(true)), { existingTsx, existingStyles: contentOf(old.changes, ".styles.ts") });
    expect(result.suggestions.map((s) => [s.kind, s.part])).toEqual([
      ["rimozione", "extra"],
      ["lista", "item"],
    ]);
    expect(result.suggestions[0]!.example).toContain('data-slot="extra"');
    // La stessa forma dello scaffold, con l'indentazione della riga originale.
    expect(result.suggestions[1]!.example).toBe(
      '      {Array.from({ length: 2 }, (_, i) => (\n        <div key={i} data-slot="item" className={s.item(axes)} />\n      ))}',
    );
  });

  it("rosso: styles.ts esistente senza marker @generated → blocco, nessun Change", () => {
    const result = generate(badgeLettura(), { existingStyles: "export const mio = 1;\n" });
    expect(result.changes).toEqual([]);
    expect(result.findings).toEqual([expect.objectContaining({ level: "blocco", where: componentPaths("badge").styles })]);
  });

  it("una copia di lavoro in CRLF del file generato non dà un aggiorna perpetuo", () => {
    const first = generate(badgeLettura());
    const crlf = (suffix: string): string => contentOf(first.changes, suffix).replace(/\n/g, "\r\n");
    const again = generate(badgeLettura(), { existingTsx: "s.root s.label", existingStyles: crlf(".styles.ts"), existingStories: crlf(".stories.tsx") });
    expect(again.changes).toEqual([]);
  });

  it("partsOfStyles è ancorato all'id: `navListListParts` non si scambia per `navListParts`", () => {
    const text = 'export const navListListParts = ["item"] as const;\nexport const navListParts = ["root", "item"] as const;\n';
    expect(partsOfStyles(text, "navList")).toEqual({ parts: ["root", "item"], lists: ["item"] });
    expect(partsOfStyles(text, "nav")).toBeUndefined();
  });

  it("styles.ts @generated modificato a mano → aggiorna con un avviso", () => {
    const first = generate(badgeLettura());
    const edited = contentOf(first.changes, ".styles.ts").replace("bg-primary", "bg-red-500");
    const result = generate(badgeLettura(), { existingStyles: edited, existingTsx: "s.root s.label" });
    expect(result.changes[0]).toMatchObject({ action: "aggiorna", path: componentPaths("badge").styles });
    expect(result.findings).toEqual([expect.objectContaining({ level: "avviso", where: componentPaths("badge").styles })]);
  });

  it("chiave kebab: `s[\"icon-left\"]` nel TSX e chiave tra virgolette nello styles.ts", () => {
    const result = generate(badgeLettura(() => [label(), layer({ name: "Icon Left", kind: "path", pluginData: { part: "icon-left" } })]));
    expect(contentOf(result.changes, ".styles.ts")).toContain('  "icon-left": cva(');
    expect(contentOf(result.changes, "Badge.tsx")).toContain('<div data-slot="icon-left" className={s["icon-left"](axes)} />');
  });

  it("scaffold: elemento dalla risposta, dall'indizio nel nome, poi dal tipo di layer", () => {
    const result = generate(
      badgeLettura(() => [
        layer({ name: "Buy Button", pluginData: { part: "buy" } }),
        layer({ name: "More link", pluginData: { part: "more" } }),
        layer({ name: "Cover image", kind: "image", pluginData: { part: "cover" } }),
        layer({ name: "Caption", kind: "text", pluginData: { part: "caption", element: "p" } }),
        layer({ name: "Box", pluginData: { part: "box" } }),
      ]),
    );
    const tsx = contentOf(result.changes, "Badge.tsx");
    expect(tsx).toContain('<button data-slot="buy"');
    expect(tsx).toContain('<a data-slot="more"');
    expect(tsx).toContain('<img data-slot="cover" className={s.cover(axes)} alt="" />');
    expect(tsx).toContain('<p data-slot="caption"');
    expect(tsx).toContain('<div data-slot="box"');
  });

  it("rosso: un titolo senza risposta → domanda `element`, nessun Change; con TSX esistente si genera", () => {
    const children = (): LetturaLayer[] => [layer({ name: "Card Title", kind: "text", pluginData: { part: "title" } })];
    expect(generate(badgeLettura(children)).changes).toEqual([]);
    expect(generate(badgeLettura(children), { existingTsx: "s.root s.title" }).changes).toHaveLength(2);
  });
});

describe("story CSF3", () => {
  it("una story per cella non di stato, args = assi + campioni dei field, nome PascalCase dei valori", () => {
    const stories = contentOf(generate(shopCardLettura(), { generated: ["badge"] }).changes, ".stories.tsx");
    expect(stories).toContain('const meta = { title: "Domains/ShopCard", component: ShopCard } satisfies Meta<typeof ShopCard>;');
    expect(stories).toContain('export const None: Story = { args: { promo: "none", price: "price", heading: "heading" } };');
    expect(stories).toContain('export const Offer: Story = { args: { promo: "offer", price: "price", heading: "heading" } };');
    // `note` è opzionale: omesso.
    expect(stories).not.toContain("note");
  });

  it("campioni dallo schema zod: stringa → nome, numero 1, booleano false, enum → primo valore, opzionale omesso", () => {
    expect(fieldShape("title", z.string())).toEqual({ ts: "string", optional: false, sample: "title" });
    expect(fieldShape("href", z.url())).toMatchObject({ ts: "string", sample: "href" });
    expect(fieldShape("count", z.number())).toEqual({ ts: "number", optional: false, sample: 1 });
    expect(fieldShape("on", z.boolean())).toEqual({ ts: "boolean", optional: false, sample: false });
    expect(fieldShape("tone", z.enum(["a", "b"]))).toEqual({ ts: '"a" | "b"', optional: false, sample: "a" });
    expect(fieldShape("note", z.string().optional())).toEqual({ ts: "string", optional: true });
    expect(fieldShape("tags", z.array(z.string()))).toEqual({ ts: "readonly (string)[]", optional: false, sample: [] });
  });
});

describe("misura della radice per cella", () => {
  const scale = [...SCALE, { suffix: "16", px: 64 }, { suffix: "24", px: 96 }];
  const sized = (widths: Record<string, number>): Lettura => {
    const lettura = badgeLettura();
    for (const cell of lettura.cells) cell.root.style = { ...cell.root.style, sizingH: "fix", width: widths[cell.variant["size"]!]! };
    return { ...lettura, cells: [...lettura.cells].reverse() };
  };

  it("la larghezza fissa che varia con `size` finisce in variants.size (celle in ordine sparso)", () => {
    const styles = contentOf(generate(sized({ sm: 64, md: 96 }), { scale }).changes, ".styles.ts");
    expect(styles).toContain('        sm: "pl-2 w-16",');
    expect(styles).toContain('        md: "pl-3 w-24",');
  });

  it("una larghezza della radice fuori scala arriva ai finding di verifyComponent", () => {
    const findings = verifyComponent(sized({ sm: 64, md: 97 }), { tokenTypeOf, scale, contracts: CONTRACTS });
    expect(findings.filter((f) => f.level === "avviso")).toEqual([
      expect.objectContaining({ where: 'layer "Badge" (cella variant=default, size=md)', message: expect.stringContaining("w-[97px]") }),
      expect.objectContaining({ where: 'layer "Badge" (cella variant=secondary, size=md)' }),
      expect.objectContaining({ where: 'layer "Badge" (cella variant=destructive, size=md)' }),
    ]);
  });
});

describe("field con un tipo zod non riconosciuto", () => {
  it("diventa `unknown` opzionale con un avviso che lo nomina", () => {
    const dated = defineContract({ name: "dated", version: 1, axes: [], fields: { when: { schema: z.date(), kind: "content" }, heading: { schema: z.string(), kind: "content" } } });
    const lettura: Lettura = { component: "Dated", pluginData: { contract: "dated" }, cells: [{ variant: {}, root: layer({ name: "Box", kind: "board" }) }] };
    const result = generate(lettura, { contracts: { ...CONTRACTS, dated } });
    expect(result.findings).toEqual([expect.objectContaining({ level: "avviso", where: 'field "when"' })]);
    expect(contentOf(result.changes, "Dated.tsx")).toContain("  readonly when?: unknown;");
    expect(fieldShape("when", z.date())).toMatchObject({ ts: "unknown", optional: true, unrecognized: true });
    expect(fieldShape("whens", z.array(z.date()))).toMatchObject({ unrecognized: true });
  });
});

describe("decompose", () => {
  const cells = [
    { axes: { variant: "default", size: "sm" }, classes: ["flex", "bg-primary", "pl-2", "ring-1"] },
    { axes: { variant: "default", size: "md" }, classes: ["flex", "bg-primary", "pl-3"] },
    { axes: { variant: "secondary", size: "sm" }, classes: ["flex", "bg-secondary", "pl-2"] },
    { axes: { variant: "secondary", size: "md" }, classes: ["flex", "bg-secondary", "pl-3"] },
  ];

  it("comuni nella base, un asse in variants, il resto in compoundVariants", () => {
    const result = decompose(badge, cells);
    expect(result.base).toEqual(["flex"]);
    expect(result.variants).toEqual({
      variant: { default: ["bg-primary"], secondary: ["bg-secondary"], destructive: [] },
      size: { sm: ["pl-2"], md: ["pl-3"] },
    });
    expect(result.compounds).toEqual([{ when: { variant: "default", size: "sm" }, classes: ["ring-1"] }]);
  });

  it("contano solo le celle in cui la parte c'è", () => {
    expect(decompose(badge, cells.slice(0, 1))).toMatchObject({ base: ["bg-primary", "flex", "pl-2", "ring-1"], compounds: [] });
    expect(decompose(badge, [])).toMatchObject({ base: [], compounds: [] });
  });
});
