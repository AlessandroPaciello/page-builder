import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";
import { describe, expect, it } from "vitest";

import { committedDesigns } from "./designs-loader";
import { planLibrary, type Operation } from "./library-plan";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import { emptySnapshot } from "./library-snapshot";
import { operationsToSteps } from "./penpot-writer";

const seed: SemanticSeed = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "semantic-tokens.seed.json"), "utf8"),
) as SemanticSeed;

const designs = committedDesigns();

const contracts = Object.values(COMPONENT_CONTRACTS);

/** Celle del prodotto cartesiano di un contratto: derivato, non a mano. */
function cellCount(contract: (typeof contracts)[number]): number {
  return contract.axes.reduce((count, axis) => count * axis.values.length, 1);
}

function bootstrapSteps() {
  const plan = planLibrary({ mode: "bootstrap", contracts, spec: LIBRARY_SPEC, seed, designs, snapshot: emptySnapshot() });
  return operationsToSteps(plan.operations);
}

describe("operationsToSteps", () => {
  it("un'operazione per chiamata (i container in lotti piccoli: una cella + un step finale)", () => {
    const steps = bootstrapSteps();
    // 2 set + token del seed + per contratto (una cella per step + lo step del container)
    const containerSteps = contracts.reduce((total, contract) => total + cellCount(contract) + 1, 0);
    expect(steps).toHaveLength(2 + seed.palette.length + seed.semantic.length + containerSteps);
  });

  it("createSet usa addSet con active: true", () => {
    const steps = bootstrapSteps();
    expect(steps[0]!.description).toBe('createSet "palette"');
    expect(steps[0]!.code).toContain('addSet({ name: "palette", active: true })');
  });

  it("createToken usa set.addToken e scrive gli hex in maiuscolo", () => {
    const steps = bootstrapSteps();
    const gray = steps.find((step) => step.description.includes('"gray.1"'))!;
    expect(gray.code).toContain('type: "color"');
    expect(gray.code).toContain('"#FAF4E8"');
    const ring = steps.find((step) => step.description.includes('"shadow.ring"'))!;
    expect(ring.code).toContain("{color.ring}");
    const font = steps.find((step) => step.description.includes('"font.sans"'))!;
    expect(font.code).toContain('["Manrope"]');
  });

  it("le celle creano board con flex, testo e path, e legano i token con applyToken", () => {
    const steps = bootstrapSteps();
    const badgeCell = steps.find((step) => step.description.includes('createContainer "badge"'))!;
    expect(badgeCell.code).toContain("createBoard()");
    expect(badgeCell.code).toContain("addFlexLayout()");
    expect(badgeCell.code).toContain("penpot.createText");
    expect(badgeCell.code).toContain("applyToken");
    expect(badgeCell.code).toContain("createComponent([board])");

    const accordionCell = steps.find((step) => step.description.includes('createContainer "accordion-item"'))!;
    expect(accordionCell.code).toContain("penpot.createPath()");
    expect(accordionCell.code).toContain('strokeColor');
  });

  it("lo step finale crea il VariantContainer e scrive il plugin data del contratto", () => {
    const steps = bootstrapSteps();
    const badgeContainer = steps.find((step) => step.description.includes('createVariantContainer "Badge"'))!;
    expect(badgeContainer.code).toContain("penpotUtils.createVariantContainer(shapes)");
    expect(badgeContainer.code).toContain('setSharedPluginData("pagebuilder", "contract", "badge@1")');
    expect(badgeContainer.code).toContain('container.name = "Badge"');
  });

  it("ogni step ha una description che nomina l'operazione", () => {
    for (const step of bootstrapSteps()) {
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});

describe("operationsToSteps — il codice generato è JS valido", () => {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

  it("ogni step compila (un errore di sintassi silenterebbe lato execute_code)", () => {
    for (const step of bootstrapSteps()) {
      expect(() => new AsyncFunction(step.code), step.description).not.toThrow();
    }
  });

  it("il codice delle celle contiene la guardia anti-duplicato del componente (review 2.4)", () => {
    const cellSteps = bootstrapSteps().filter((step) => step.description.startsWith('createContainer "badge"'));
    expect(cellSteps.length).toBeGreaterThan(0);
    for (const step of cellSteps) {
      expect(step.code).toContain('c.name === spec.boardName');
      expect(step.code).toContain("esiste già");
    }
  });

  it("lo step del container contiene la guardia anti-duplicato del VariantContainer", () => {
    const containerSteps = bootstrapSteps().filter((step) => step.description.startsWith('createVariantContainer'));
    expect(containerSteps).toHaveLength(contracts.length); // uno per contratto
    for (const step of containerSteps) {
      expect(step.code).toContain("isVariantContainer");
      expect(step.code).toContain("esiste già");
    }
  });
});

/**
 * `addCell` (Story 2.7 parte B): i test ESEGUONO il codice generato contro
 * una Penpot finta in memoria — le guardie non si verificano come testo.
 */
describe("addCell — il codice generato eseguito su un container finto", () => {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
    ...args: string[]
  ) => (...params: unknown[]) => Promise<unknown>;

  interface FakeShape {
    type: string;
    name: string;
    x: number;
    y: number;
    fills: unknown[];
    children: FakeShape[];
    tokens: Record<string, string>;
    appendChild(child: FakeShape): void;
    addFlexLayout(): Record<string, unknown>;
    resize(w: number, h: number): void;
    applyToken(token: { name: string }, props: string[]): Promise<void>;
    size?: [number, number];
  }

  function shape(type: string): FakeShape {
    return {
      type,
      name: "",
      x: 0,
      y: 0,
      fills: [{ fillColor: "#FFFFFF" }],
      children: [],
      tokens: {},
      appendChild(child) {
        this.children.push(child);
      },
      addFlexLayout() {
        return {};
      },
      resize(w, h) {
        this.size = [w, h];
      },
      async applyToken(token, props) {
        for (const prop of props) this.tokens[prop] = token.name;
      },
    };
  }

  interface FakeVariant {
    id: string;
    variantProps: Record<string, string>;
    setVariantProperty(pos: number, value: string): void;
  }

  interface ContainerSpec {
    name: string;
    pluginData: string;
    properties: string[];
    variants: Array<Record<string, string>>;
    x?: number;
    y?: number;
  }

  /** `registerOnAppend: false` = appendChild non registra la variante; `setWorks: false` = setVariantProperty non fa nulla. */
  function fakePenpot(containerSpecs: ContainerSpec[], options: { registerOnAppend?: boolean; setWorks?: boolean } = {}) {
    const { registerOnAppend = true, setWorks = true } = options;
    const components: Array<{ id: string; name: string; board: FakeShape }> = [];
    const setCalls: Array<{ id: string; pos: number; value: string }> = [];
    const containers = containerSpecs.map((spec, index) => {
      const makeVariant = (id: string, variantProps: Record<string, string>): FakeVariant => ({
        id,
        variantProps,
        setVariantProperty(pos, value) {
          setCalls.push({ id: this.id, pos, value });
          if (setWorks) this.variantProps = { ...this.variantProps, [spec.properties[pos]!]: value };
        },
      });
      const variants = spec.variants.map((props, v) => makeVariant(`v${index}-${v}`, props));
      const appended: FakeShape[] = [];
      return {
        name: spec.name,
        x: spec.x ?? 0,
        y: spec.y ?? 0,
        appended,
        isVariantContainer: () => true,
        getSharedPluginData: (namespace: string, key: string) =>
          namespace === "pagebuilder" && key === "contract" ? spec.pluginData : "",
        variants: { properties: spec.properties, variantComponents: () => variants },
        appendChild(board: FakeShape) {
          appended.push(board);
          const component = components.find((c) => c.board === board);
          if (component && registerOnAppend) variants.push(makeVariant(component.id, {}));
        },
      };
    });
    const penpot = {
      createBoard: () => shape("board"),
      createText: (text: string) => ({ ...shape("text"), characters: text }),
      createPath: () => shape("path"),
      library: {
        local: {
          components,
          createComponent([board]: FakeShape[]) {
            const component = { id: `new-${components.length}`, name: board!.name, board: board! };
            components.push(component);
            return component;
          },
        },
      },
    };
    const penpotUtils = {
      findShapes: (predicate: (s: unknown) => boolean) => containers.filter(predicate),
      findTokenByName: (name: string) => ({ name }),
    };
    return { penpot, penpotUtils, containers, components, setCalls };
  }

  /** Cella `outline/sm` con un token PROPRIO (root fill `color.background`), diverso da ogni cella esistente. */
  function outlineOperation(): Extract<Operation, { kind: "addCell" }> {
    const bootstrap = planLibrary({ mode: "bootstrap", contracts, spec: LIBRARY_SPEC, seed, designs, snapshot: emptySnapshot() });
    const badge = bootstrap.operations.find((op) => op.kind === "createContainer" && op.contract === "badge");
    if (badge?.kind !== "createContainer") throw new Error("container badge assente dal bootstrap");
    const parts = badge.cells[0]!.parts.map((part) =>
      part.name === "root" ? { ...part, tokens: { ...part.tokens, fill: "color.background" } } : part,
    );
    return {
      kind: "addCell",
      contract: "badge",
      containerName: "Badge",
      cellKey: "variant=outline|size=sm",
      variantProps: { variant: "outline", size: "sm" },
      parts,
      index: 6,
    };
  }

  const run = (code: string, env: ReturnType<typeof fakePenpot>) => new AsyncFunction("penpotUtils", "penpot", code)(env.penpotUtils, env.penpot);
  const badgeVariants = [{ variant: "default", size: "sm" }];
  const badgeContainer = (extra: Partial<ContainerSpec> = {}): ContainerSpec => ({
    name: "Badge",
    pluginData: "badge@1",
    properties: ["variant", "size"],
    variants: badgeVariants,
    ...extra,
  });

  it("crea la board DA ZERO dal design, dentro il container, e imposta ogni asse sulla variante nuova", async () => {
    const env = fakePenpot([badgeContainer({ x: 500, y: 300 })]);
    const [step] = operationsToSteps([outlineOperation()]);
    expect(step!.description).toContain('addCell "badge"');
    expect(step!.code).not.toContain("addVariant");
    const result = (await run(step!.code, env)) as { boardName: string };
    expect(result.boardName).toBe("Badge variant=outline|size=sm");
    const board = env.containers[0]!.appended[0]!;
    expect(board.name).toBe("Badge variant=outline|size=sm");
    expect(board.x).toBe(500 + Math.max(240, designs.badge!.parts.root!.size![0] + 40) * 6);
    expect(board.y).toBe(300);
    expect(board.tokens.fill).toBe("color.background");
    expect(board.children.map((child) => child.name)).toEqual(["label"]);
    expect(env.setCalls).toEqual([
      { id: "new-0", pos: 0, value: "outline" },
      { id: "new-0", pos: 1, value: "sm" },
    ]);
  });

  it("indici di setVariantProperty corretti anche con assi in ordine diverso nel container", async () => {
    const env = fakePenpot([badgeContainer({ properties: ["size", "variant"], variants: [{ size: "sm", variant: "default" }] })]);
    const [step] = operationsToSteps([outlineOperation()]);
    await run(step!.code, env);
    expect(env.setCalls).toEqual([
      { id: "new-0", pos: 1, value: "outline" },
      { id: "new-0", pos: 0, value: "sm" },
    ]);
  });

  it("salta senza scrivere se una variante ha già gli stessi variantProps", async () => {
    const env = fakePenpot([badgeContainer({ variants: [...badgeVariants, { variant: "outline", size: "sm" }] })]);
    const [step] = operationsToSteps([outlineOperation()]);
    const result = (await run(step!.code, env)) as { skipped?: boolean; reason?: string };
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("Badge variant=outline|size=sm");
    expect(env.components).toEqual([]);
    expect(env.containers[0]!.appended).toEqual([]);
    expect(env.setCalls).toEqual([]);
  });

  it("0 o 2 container che dichiarano il contratto: errore nominativo, nessuna scrittura", async () => {
    const [step] = operationsToSteps([outlineOperation()]);
    const none = fakePenpot([{ name: "Input", pluginData: "input@1", properties: ["state"], variants: [] }]);
    await expect(run(step!.code, none)).rejects.toThrow(/addCell "badge", cella "variant=outline\|size=sm".*trovati 0/);
    expect(none.components).toEqual([]);

    const two = fakePenpot([badgeContainer(), badgeContainer({ name: "BadgeOld" })]);
    await expect(run(step!.code, two)).rejects.toThrow(/trovati 2 \("Badge", "BadgeOld"\)/);
    expect(two.components).toEqual([]);
  });

  it("container senza una proprietà d'asse del contratto: errore che la nomina", async () => {
    const env = fakePenpot([badgeContainer({ properties: ["variant"], variants: [{ variant: "default" }] })]);
    const [step] = operationsToSteps([outlineOperation()]);
    await expect(run(step!.code, env)).rejects.toThrow(/non ha la proprietà di variante "size"/);
    expect(env.components).toEqual([]);
  });

  it("appendChild che non registra la variante: errore nominativo, nessun setVariantProperty", async () => {
    const env = fakePenpot([badgeContainer()], { registerOnAppend: false });
    const [step] = operationsToSteps([outlineOperation()]);
    await expect(run(step!.code, env)).rejects.toThrow(
      /addCell "badge", cella "Badge variant=outline\|size=sm", container "Badge".*non risulta fra le varianti/,
    );
    expect(env.setCalls).toEqual([]);
  });

  it("setVariantProperty che non scrive: la rilettura dà errore nominativo", async () => {
    const env = fakePenpot([badgeContainer()], { setWorks: false });
    const [step] = operationsToSteps([outlineOperation()]);
    await expect(run(step!.code, env)).rejects.toThrow(
      /addCell "badge", cella "Badge variant=outline\|size=sm", container "Badge": dopo setVariantProperty variant = undefined \(atteso "outline"\)/,
    );
  });
});
