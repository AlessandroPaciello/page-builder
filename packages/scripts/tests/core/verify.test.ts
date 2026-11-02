import { COMPONENT_CONTRACTS, multiselect, propsSchema } from "@app/contracts";
import { describe, expect, it } from "vitest";

import { analyzeComponent, Finding, isPartUsed, RENDERING_AXES, verifyComponent, type Lettura, type LetturaLayer } from "../../src/core";
import {
  badgeInstance,
  badgeLettura,
  badgeRoot,
  CONTRACTS,
  layer,
  multiselectLettura,
  SCALE,
  shopCardLettura,
  tokenTypeOf,
} from "../fixtures/components";

/**
 * Livello 1 della CI (Story 2.22): verifica di un componente intero — chiavi
 * di parte, istanze, assi e stati delle celle — con `Lettura` scritte a mano.
 */

const input = { tokenTypeOf, scale: SCALE, contracts: CONTRACTS };

const verify = (lettura: Lettura, extra: { existingTsx?: string } = {}): Finding[] => verifyComponent(lettura, { ...input, ...extra });

const of = (findings: readonly Finding[], level: Finding["level"]): Finding[] => findings.filter((finding) => finding.level === level);

const label = (): LetturaLayer => layer({ name: "Testo", kind: "text", pluginData: { part: "label" }, tokens: { fontSize: "text.xs" } });

describe("verifyComponent — matrice della spec", () => {
  it("ok: Badge, 2 assi, celle complete, parti con chiave → nessun finding", () => {
    expect(verify(badgeLettura())).toEqual([]);
    for (const finding of verify(badgeLettura())) Finding.parse(finding);
  });

  it("senza chiave: `Icon Left` → domanda `part` con [icon-left, ignora]", () => {
    const findings = verify(badgeLettura(() => [label(), layer({ name: "Icon Left", kind: "path" })]));
    const questions = of(findings, "domanda");
    expect(questions).toHaveLength(6);
    expect(questions[0]).toMatchObject({ key: "part", options: ["icon-left", "ignora"] });
    expect(questions[0]!.where).toContain('layer "Icon Left"');
    for (const finding of findings) Finding.parse(finding);
  });

  it("doppia: due fratelli `part: item` → domanda `repeat` sul secondo", () => {
    const children = (): LetturaLayer[] => [
      layer({ name: "Primo", pluginData: { part: "item" } }),
      layer({ name: "Secondo", pluginData: { part: "item" } }),
    ];
    const questions = of(verify(badgeLettura(children)), "domanda");
    expect(questions).toHaveLength(6);
    expect(questions[0]).toMatchObject({ key: "repeat", options: ["lista", "parte-nuova"] });
    expect(questions[0]!.where).toContain('layer "Secondo"');
  });

  it("risposta lista: nessuna domanda", () => {
    const children = (): LetturaLayer[] => [
      layer({ name: "Primo", pluginData: { part: "item" } }),
      layer({ name: "Secondo", pluginData: { part: "item", repeat: "lista" } }),
    ];
    expect(verify(badgeLettura(children))).toEqual([]);
  });

  it("risposta parte-nuova: resta aperta la domanda `part` con una chiave libera", () => {
    const children = (): LetturaLayer[] => [
      layer({ name: "Item", pluginData: { part: "item" } }),
      layer({ name: "Item", pluginData: { part: "item", repeat: "parte-nuova" } }),
    ];
    const questions = of(verify(badgeLettura(children)), "domanda");
    expect(questions[0]).toMatchObject({ key: "part", options: ["item-2", "ignora"] });
  });

  it("rosso: risposta `repeat` non valida → la domanda resta", () => {
    const children = (): LetturaLayer[] => [layer({ name: "A", pluginData: { part: "item" } }), layer({ name: "B", pluginData: { part: "item", repeat: "boh" } })];
    expect(of(verify(badgeLettura(children)), "domanda")[0]).toMatchObject({ key: "repeat" });
    expect(of(verify(badgeLettura(children)), "domanda")[0]!.message).toContain('"boh"');
  });

  it("istanza ok: ShopCard con Badge variant=destructive → nessun finding", () => {
    expect(verify(shopCardLettura())).toEqual([]);
  });

  it("rosso: variante ignota dell'istanza (`neon`) → blocco", () => {
    const blocks = of(verify(shopCardLettura(() => badgeInstance({ variant: "neon" }))), "blocco");
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]!.message).toContain('"neon"');
    expect(of(verify(shopCardLettura(() => badgeInstance({ tone: "x" }))), "blocco")[0]!.message).toContain('"tone"');
  });

  it('override: ["fill"] → blocco; ["sizingH", "width"] e la geometria → nessun blocco', () => {
    const blocks = of(verify(shopCardLettura(() => badgeInstance({ variant: "destructive" }, ["fill"]))), "blocco");
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]!.message).toContain("[fill]");
    expect(verify(shopCardLettura(() => badgeInstance({ variant: "destructive" }, ["sizingH", "width"])))).toEqual([]);
    expect(verify(shopCardLettura(() => badgeInstance({}, ["sizingV", "x", "y", "height", "position", "constraintH", "constraintV", "clip"])))).toEqual([]);
  });

  it("rosso: istanza di un componente senza contratto → blocco", () => {
    const lettura = shopCardLettura(() => ({ ...badgeInstance(), instance: { component: "Chip", variant: {}, overrides: [] } }));
    expect(of(verify(lettura), "blocco")[0]!.message).toContain('"chip"');
  });
});

describe("verifyComponent — contratto dell'istanza annidata (Story 2.23)", () => {
  const withContract = (component: string, contract: string): Lettura =>
    shopCardLettura(() => ({ ...badgeInstance(), instance: { component, contract, variant: { variant: "destructive" }, overrides: [] } }));

  it("verde: `instance.contract` decide il contratto, il nome del componente non conta", () => {
    expect(verify(withContract("Pill", "badge@1"))).toEqual([]);
    expect(verify(withContract("Components / Badge", "badge"))).toEqual([]);
  });

  it("rosso: versione diversa dal codice → blocco che nomina la versione", () => {
    const blocks = of(verify(withContract("Badge", "badge@2")), "blocco");
    // Uno per cella di ShopCard.
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.message).toContain('"badge@2"');
    expect(blocks[0]!.message).toContain("versione");
  });

  it("rosso: contratto sconosciuto → blocco anche se il nome del componente ne ha uno", () => {
    const blocks = of(verify(withContract("Badge", "chip@1")), "blocco");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.message).toContain('"chip@1"');
  });
});

describe("verifyComponent — contratto, assi e stati", () => {
  it("rosso: contratto mancante, sconosciuto o di un'altra versione → blocco", () => {
    for (const pluginData of [undefined, { contract: "chip" }, { contract: "badge@2" }]) {
      const lettura = { ...badgeLettura(), ...(pluginData === undefined ? { pluginData: {} } : { pluginData }) };
      const findings = verify(lettura);
      expect(findings).toHaveLength(1);
      expect(findings[0]!.level).toBe("blocco");
    }
    expect(verify({ ...badgeLettura(), pluginData: { contract: "badge" } })).toEqual([]);
  });

  it("rosso: asse estraneo, valore fuori contratto, stato sconosciuto → blocco", () => {
    const cases: Record<string, string>[] = [
      { variant: "default", size: "md", tone: "x" },
      { variant: "neon", size: "md" },
      { variant: "default", size: "md", state: "pressed" },
    ];
    for (const variant of cases) {
      const lettura = badgeLettura();
      lettura.cells.push({ variant, root: badgeRoot("default", "md") });
      const blocks = of(verify(lettura), "blocco");
      expect(blocks, JSON.stringify(variant)).toHaveLength(1);
    }
  });

  it("celle mancanti non sono un errore; una cella doppia è un blocco", () => {
    const lettura = badgeLettura();
    expect(verify({ ...lettura, cells: lettura.cells.slice(0, 2) })).toEqual([]);
    expect(of(verify({ ...lettura, cells: [...lettura.cells, lettura.cells[0]!] }), "blocco")).toHaveLength(1);
  });

  it("rosso: cella di stato senza la cella base → blocco", () => {
    const lettura = badgeLettura();
    const only = { ...lettura, cells: [lettura.cells[0]!, { variant: { variant: "secondary", size: "md", state: "hover" }, root: badgeRoot("secondary", "md") }] };
    expect(of(verify(only), "blocco")[0]!.message).toContain("senza la cella base");
  });

  it("rosso: la stessa chiave in rami diversi → blocco", () => {
    const children = (): LetturaLayer[] => [
      layer({ name: "Box", pluginData: { part: "box" }, children: [layer({ name: "Testo", kind: "text", pluginData: { part: "label" } })] }),
      label(),
    ];
    const blocks = of(verify(badgeLettura(children)), "blocco");
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]!.message).toContain('"label"');
  });

  it("la radice senza chiave vale root, senza domanda; `ignora` fonde il layer con un avviso", () => {
    const children = (): LetturaLayer[] => [layer({ name: "Wrapper", pluginData: { part: "ignora" }, tokens: { fill: "accent" }, children: [label()] })];
    const findings = verify(badgeLettura(children));
    expect(of(findings, "domanda")).toEqual([]);
    expect(of(findings, "blocco")).toEqual([]);
    expect(of(findings, "avviso")[0]!.message).toContain("bg-accent");
  });

  it("i figli di un'istanza non si visitano", () => {
    // `badgeInstance` ha un figlio senza chiave: nessuna domanda.
    expect(of(verify(shopCardLettura()), "domanda")).toEqual([]);
  });

  it("elemento: un nome da titolo senza risposta → domanda `element` [h2, h3, p], solo senza TSX", () => {
    const children = (): LetturaLayer[] => [layer({ name: "Title", kind: "text", pluginData: { part: "title" } })];
    const questions = of(verify(badgeLettura(children)), "domanda");
    expect(questions).toEqual([expect.objectContaining({ key: "element", options: ["h2", "h3", "p"] })]);
    expect(of(verify(badgeLettura(children), { existingTsx: "s.title s.root" }), "domanda")).toEqual([]);
  });

  it("rosso: la stessa chiave layer in una cella e istanza in un'altra → blocco, in tutti e due gli ordini", () => {
    for (const instanceFirst of [true, false]) {
      const lettura = shopCardLettura();
      const target = lettura.cells[instanceFirst ? 1 : 0]!;
      target.root.children[2] = layer({ name: "Action", pluginData: { part: "action" } });
      const blocks = of(verify(lettura), "blocco");
      expect(blocks, `istanza ${instanceFirst ? "prima" : "dopo"}`).toHaveLength(1);
      expect(blocks[0]!.message).toContain('"action"');
    }
  });

  it("stati: una cella che toglie soltanto o una parte presente in una sola delle due celle → avviso che nomina cella e parte", () => {
    const lettura = badgeLettura();
    const base = badgeRoot("default", "md");
    // Toglie soltanto il padding della radice e non ha la parte `label`.
    lettura.cells.push({ variant: { variant: "default", size: "md", state: "hover" }, root: { ...base, tokens: { fill: "primary" }, children: [] } });
    const warnings = of(verify(lettura), "avviso");
    expect(warnings).toEqual([
      expect.objectContaining({ where: 'cella variant=default, size=md, state=hover › parte "root"', message: expect.stringContaining("toglie soltanto") }),
      expect.objectContaining({ where: 'cella variant=default, size=md, state=hover › parte "label"', message: expect.stringContaining("nella cella base ma non") }),
    ]);
    const extra = badgeLettura();
    extra.cells.push({ variant: { variant: "default", size: "md", state: "hover" }, root: badgeRoot("default", "md", [label(), layer({ name: "Ring", pluginData: { part: "ring" } })]) });
    expect(of(verify(extra), "avviso")).toEqual([expect.objectContaining({ where: 'cella variant=default, size=md, state=hover › parte "ring"', message: expect.stringContaining("solo") })]);
  });

  it("isPartUsed: `.item` non vale per `.items` né per `.item-2`", () => {
    expect(isPartUsed("s.items(axes) s.item-2", "item")).toBe(false);
    expect(isPartUsed("s.item(axes)", "item")).toBe(true);
    expect(isPartUsed('s["item"](axes)', "item")).toBe(true);
  });

  it("TSX esistente senza la chiave → avviso di export inutilizzato", () => {
    const findings = verify(badgeLettura(), { existingTsx: 'className={s.root(axes)}' });
    expect(findings).toEqual([expect.objectContaining({ level: "avviso", where: 'parte "label"' })]);
    expect(verify(badgeLettura(), { existingTsx: 's.root(axes) s["label"](axes)' })).toEqual([]);
  });

  it("le domande e gli avvisi del registro arrivano con la cella", () => {
    const children = (): LetturaLayer[] => [layer({ name: "Testo", kind: "text", pluginData: { part: "label" }, style: { lineHeight: 1.2 } })];
    const warnings = of(verify(badgeLettura(children)), "avviso");
    expect(warnings).toHaveLength(6);
    expect(warnings[0]!.where).toBe('cella variant=default, size=sm › layer "Testo"');
  });
});

describe("assi di rendering (Story 2.28)", () => {
  it("la tabella nomina solo contratti registrati, con il valore base tra i valori", () => {
    expect(Object.keys(RENDERING_AXES).sort()).toEqual(["checkbox", "chip", "multiselect", "multiselect-panel", "multiselect-trigger", "option"]);
    for (const [name, axes] of Object.entries(RENDERING_AXES)) {
      expect(Object.hasOwn(COMPONENT_CONTRACTS, name), `contratto "${name}" non registrato`).toBe(true);
      for (const axis of axes) expect(axis.values).toContain(axis.base);
    }
  });

  it("i valori della tabella sono quelli delle celle lette in Penpot (Multiselect, Trigger, Panel)", () => {
    const axes = (name: string) => Object.fromEntries(RENDERING_AXES[name]!.map((axis) => [axis.name, axis.values]));
    expect(axes("multiselect")).toEqual({ open: ["false", "true"], display: ["chips", "placeholder"] });
    expect(axes("multiselect-trigger")).toEqual({ display: ["chips", "overflow", "placeholder"] });
    expect(axes("multiselect-panel")).toEqual({ content: ["options", "empty"] });
  });

  it("verde: `open` e `state` su multiselect, contratto con gli assi option `size` e `search`", () => {
    const findings = verify(multiselectLettura());
    expect(of(findings, "blocco")).toEqual([]);
    expect(of(findings, "domanda")).toEqual([]);
    expect(of(findings, "avviso")).toEqual([]);
    // `open` non diventa una prop: il contratto dell'editor resta `option` + field.
    expect(Object.keys(propsSchema(multiselect).shape)).toEqual(["size", "search", "helper", "placeholder", "selected", "options", "searchPlaceholder", "emptyLabel"]);
  });

  it("le celle non base contribuiscono alla base le classi con il prefisso dell'asse", () => {
    const { model, findings } = analyzeComponent(multiselectLettura(), input);
    expect(of(findings, "blocco")).toEqual([]);
    expect(model?.baseCells).toHaveLength(1);
    const root = model!.parts[0]!;
    const classes = [...(root.classes.get(model!.baseCells[0]!.index) ?? [])];
    expect(classes).toEqual(
      expect.arrayContaining(["bg-primary", "hover:bg-secondary", "data-[open=true]:bg-accent", "data-[open=true]:hover:bg-destructive"]),
    );
    // La cella non base non compare tra le celle da cui si genera.
    expect(model!.cells.filter((cell) => cell.rendering.open === "true")).toHaveLength(2);
  });

  it("rosso: una proprietà di variante non dichiarata resta il blocco «asse estraneo»", () => {
    const lettura = multiselectLettura();
    lettura.cells.push({ variant: { open: "false", state: "default", size: "md", foo: "bar" }, root: layer({ name: "Multiselect", kind: "board" }) });
    const blocks = of(verify(lettura), "blocco");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.message).toContain('Asse "foo" estraneo al contratto "multiselect"');
    expect(blocks[0]!.message).toContain("open");
  });

  it("rosso: un valore fuori dagli assi di rendering è un blocco", () => {
    const lettura = multiselectLettura();
    lettura.cells.push({ variant: { open: "forse", state: "default", size: "md" }, root: layer({ name: "Multiselect", kind: "board" }) });
    const blocks = of(verify(lettura), "blocco");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.message).toContain('Valore "forse" fuori dagli assi di rendering per l\'asse "open"');
    expect(blocks[0]!.message).toContain("false, true");
  });

  it("rosso: una cella di rendering senza la cella base è un blocco", () => {
    const cell = multiselectLettura().cells.find((candidate) => candidate.variant.open === "true" && candidate.variant.state === "default")!;
    const blocks = of(verify({ component: "Multiselect", pluginData: { contract: "multiselect@1" }, cells: [cell] }), "blocco");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.message).toContain("senza la cella base");
    expect(blocks[0]!.message).toContain("open=false");
  });

  it("contratto senza voce nella tabella: nessun asse di rendering ammesso", () => {
    const lettura = badgeLettura();
    lettura.cells.push({ variant: { variant: "default", size: "md", open: "true" }, root: badgeRoot("default", "md") });
    expect(of(verify(lettura), "blocco")[0]!.message).toContain('Asse "open" estraneo al contratto "badge"');
  });

  it("`display` sul container della Multiselect è resa: nessun blocco, classi con il prefisso dell'asse", () => {
    const lettura = multiselectLettura();
    lettura.cells.push({
      variant: { open: "false", state: "default", size: "md", display: "placeholder" },
      root: layer({ name: "Multiselect", kind: "board", tokens: { fill: "muted" }, style: { layoutDir: "column" } }),
    });
    const findings = verify(lettura);
    expect(of(findings, "blocco")).toEqual([]);
    const { model } = analyzeComponent(lettura, input);
    const base = model!.baseCells[0]!;
    expect([...(model!.parts[0]!.classes.get(base.index) ?? [])]).toContain("data-[display=placeholder]:bg-muted");
  });

  it("`content` sul pannello: la cella `empty` è resa con il prefisso dell'asse", () => {
    const root = (fill: string) => layer({ name: "Multiselect Panel", kind: "board", tokens: { fill } });
    const lettura: Lettura = {
      component: "Multiselect Panel",
      pluginData: { contract: "multiselect-panel@1" },
      cells: [
        { variant: { content: "options" }, root: root("primary") },
        { variant: { content: "empty" }, root: root("muted") },
      ],
    };
    const { findings, model } = analyzeComponent(lettura, { ...input, contracts: COMPONENT_CONTRACTS });
    expect(of(findings, "blocco")).toEqual([]);
    expect([...(model!.parts[0]!.classes.get(model!.baseCells[0]!.index) ?? [])]).toContain("data-[content=empty]:bg-muted");
  });

  it("`search` sul pannello è un asse del contratto (Story 2.37): le celle lo portano senza blocchi", () => {
    const root = (fill: string) => layer({ name: "Multiselect Panel", kind: "board", tokens: { fill } });
    const findings = verifyComponent(
      {
        component: "Multiselect Panel",
        pluginData: { contract: "multiselect-panel@1" },
        cells: [
          { variant: { content: "options", search: "false" }, root: root("primary") },
          { variant: { content: "empty", search: "false" }, root: root("muted") },
          { variant: { content: "options", search: "true" }, root: root("primary") },
        ],
      },
      { ...input, contracts: COMPONENT_CONTRACTS },
    );
    expect(of(findings, "blocco")).toEqual([]);
  });

  it("verde: `state=error` con la sua cella base, classi con `[&[aria-invalid=true]]:`", () => {
    const lettura = multiselectLettura();
    lettura.cells.push({
      variant: { open: "false", state: "error", size: "md" },
      root: layer({ name: "Multiselect", kind: "board", tokens: { fill: "muted" }, style: { layoutDir: "column" } }),
    });
    expect(of(verify(lettura), "blocco")).toEqual([]);
    const { model } = analyzeComponent(lettura, input);
    const base = model!.baseCells[0]!;
    const classes = [...(model!.parts[0]!.classes.get(base.index) ?? [])];
    expect(classes).toContain("[&[aria-invalid=true]]:bg-muted");
  });

  it("rosso: `state=error` senza la cella base resta un blocco", () => {
    const blocks = of(
      verify({
        component: "Multiselect",
        pluginData: { contract: "multiselect@1" },
        cells: [{ variant: { open: "false", state: "error", size: "md" }, root: layer({ name: "Multiselect", kind: "board" }) }],
      }),
      "blocco",
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.message).toContain("senza la cella base");
    expect(blocks[0]!.message).toContain("state=default");
  });

  it("istanza annidata con un asse di rendering e uno stato: accettati, e non diventano prop", () => {
    const trigger = (display: string) =>
      layer({
        name: "Trigger",
        kind: "board",
        pluginData: { part: "trigger" },
        instance: { component: "multiselect-trigger", variant: { size: "md", state: "focus", display }, overrides: [] },
      });
    const root = (display: string) => layer({ name: "Multiselect", kind: "board", children: [trigger(display)] });
    const { model, findings } = analyzeComponent(
      {
        component: "Multiselect",
        pluginData: { contract: "multiselect@1" },
        cells: [
          { variant: { open: "false", size: "md" }, root: root("chips") },
          { variant: { open: "false", size: "md", display: "placeholder" }, root: root("placeholder") },
        ],
      },
      { ...input, contracts: COMPONENT_CONTRACTS },
    );
    expect(of(findings, "blocco")).toEqual([]);
    const part = model!.parts.find((candidate) => candidate.key === "trigger")!;
    // `display` e `state` sono resa: si validano, ma le props dell'istanza restano il solo `size`.
    expect(part.instanceProps.get(model!.baseCells[0]!.index)).toEqual({ size: "md" });
  });

  it("istanza del pannello con `search` (Story 2.37): l'asse è del contratto e diventa prop", () => {
    const panel = (search: string) =>
      layer({
        name: "Multiselect Panel",
        kind: "board",
        pluginData: { part: "panel" },
        instance: { component: "multiselect-panel", variant: { content: "options", search }, overrides: [] },
      });
    const root = (search: string) => layer({ name: "Multiselect", kind: "board", children: [panel(search)] });
    const { model, findings } = analyzeComponent(
      {
        component: "Multiselect",
        pluginData: { contract: "multiselect@1" },
        cells: [
          { variant: { open: "false", size: "md", search: "false" }, root: root("false") },
          { variant: { open: "false", size: "md", search: "true" }, root: root("true") },
        ],
      },
      { ...input, contracts: COMPONENT_CONTRACTS },
    );
    expect(of(findings, "blocco")).toEqual([]);
    const part = model!.parts.find((candidate) => candidate.key === "panel")!;
    const base = model!.baseCells.find((cell) => cell.axes.search === "true")!;
    expect(part.instanceProps.get(base.index)).toEqual({ search: "true" });
  });
});
