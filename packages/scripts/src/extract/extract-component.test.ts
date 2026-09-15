import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { committedComponents, loadFixture } from "../emitter/artifacts";
import {
  buildRecipe,
  extract,
  loadCatalogFixture,
  loadJudgment,
  loadPartAliases,
  recipePathFor,
} from "./extract-component";
import { parseArgs } from "../cli/extract-component";
import { PATHS } from "../shared/paths";
import type { ComponentJudgment, ComponentFixture } from "./recipe-schema";
import type { TokenCatalog } from "../shared/theme-generator";


describe("parseArgs", () => {
  it("accetta 'extract' + nome componente, rimuovendo il separatore pnpm '--'", () => {
    expect(parseArgs(["--", "extract", "Badge"])).toEqual({ mode: "extract", componentName: "Badge" });
  });

  it("accetta 'validate' + nome componente", () => {
    expect(parseArgs(["--", "validate", "Badge"])).toEqual({ mode: "validate", componentName: "Badge" });
  });

  it("accetta '--snapshot <path>' su extract (seam offline)", () => {
    expect(parseArgs(["--", "extract", "Badge", "--snapshot", "/tmp/snap.json"])).toEqual({
      mode: "extract",
      componentName: "Badge",
      snapshotPath: "/tmp/snap.json",
    });
  });

  it("rifiuta '--snapshot' senza percorso", () => {
    expect(() => parseArgs(["--", "extract", "Badge", "--snapshot"])).toThrow(/--snapshot richiede un percorso/);
  });

  it("rifiuta un '--snapshot' duplicato — l'ultimo che vinceva in silenzio (review loop 1, ECH#4)", () => {
    expect(() => parseArgs(["--", "extract", "Badge", "--snapshot", "/tmp/snap.json", "--snapshot", "/tmp/other.json"])).toThrow(
      /--snapshot duplicata.*"\/tmp\/snap\.json".*"\/tmp\/other\.json"/,
    );
  });

  it("rifiuta '--snapshot' su validate (validate è già offline)", () => {
    expect(() => parseArgs(["--", "validate", "Badge", "--snapshot", "/tmp/snap.json"])).toThrow(
      /--snapshot è valido solo su extract/,
    );
  });

  it("rifiuta una modalità sconosciuta nominandola", () => {
    expect(() => parseArgs(["--", "extrct", "Badge"])).toThrow(/"extrct"/);
  });

  it("rifiuta l'assenza di modalità", () => {
    expect(() => parseArgs([])).toThrow(/<mancante>/);
  });

  it("rifiuta il nome componente mancante", () => {
    expect(() => parseArgs(["--", "extract"])).toThrow(/Nome componente mancante/);
  });

  it("rifiuta un nome componente che sembra un flag", () => {
    expect(() => parseArgs(["--", "extract", "--live"])).toThrow(/Nome componente mancante/);
  });

  it("rifiuta argomenti extra dopo il nome componente, nominandoli", () => {
    expect(() => parseArgs(["--", "extract", "Badge", "--live"])).toThrow(/--live/);
  });
});

const fixture: ComponentFixture = {
  componentName: "Badge",
  contract: "badge@1",
  penpotComponentId: "container-badge",
  axes: [
    { name: "variant", values: ["default", "secondary"] },
    { name: "size", values: ["sm"] },
  ],
  cells: [
    {
      variantProps: { variant: "default", size: "sm" },
      root: {
        name: "Badge",
        kind: "board",
        tokens: { fill: "color.primary", paddingTop: "spacing.1" },
        style: {},
        children: [
          { name: "label", kind: "text", tokens: { fill: "color.primary-foreground" }, style: {}, children: [] },
        ],
      },
    },
    {
      variantProps: { variant: "secondary", size: "sm" },
      root: {
        name: "Badge",
        kind: "board",
        tokens: { fill: "color.secondary" },
        style: {},
        children: [
          { name: "label", kind: "text", tokens: { fill: "color.secondary-foreground" }, style: {}, children: [] },
        ],
      },
    },
  ],
};

const catalog: TokenCatalog = {
  sets: [
    {
      name: "semantic",
      tokens: [
        { name: "color.primary", type: "color", value: "#006C49" },
        { name: "color.primary-foreground", type: "color", value: "#FFFFFF" },
        { name: "color.secondary", type: "color", value: "#E8F5EF" },
        { name: "color.secondary-foreground", type: "color", value: "#004830" },
        { name: "color.destructive", type: "color", value: "#BA1A1A" },
        { name: "spacing.1", type: "spacing", value: "4" },
      ],
    },
  ],
};

const badgeJudgment: ComponentJudgment = {
  domain: "data-display",
  headless: null,
  a11y: { role: null, ariaAttributes: [], focusVisible: false, stateConveyedByTextAndColor: false },
};

describe("buildRecipe", () => {
  it("produce celle proprietà→token per parte × combinazione d'assi, con giudizio e provenienza", () => {
    const recipe = buildRecipe(fixture, catalog, badgeJudgment);
    expect(recipe.componentName).toBe("Badge");
    expect(recipe.penpotComponentId).toBe("container-badge");
    expect(typeof recipe.fixtureHash).toBe("string");
    expect(recipe.parts.root).toEqual({
      "variant=default|size=sm": { fill: "color.primary", paddingTop: "spacing.1" },
      "variant=secondary|size=sm": { fill: "color.secondary" },
    });
    expect(recipe.parts.label).toEqual({
      "variant=default|size=sm": { fill: "color.primary-foreground" },
      "variant=secondary|size=sm": { fill: "color.secondary-foreground" },
    });
    // Il giudizio arriva dal file per contratto committato (badge.json),
    // fuso in ricetta da extract() — vedi i test end-to-end su extract().
    expect(recipe.judgment).toEqual(badgeJudgment);
  });

  it("rifiuta un binding su un layer che non è una parte del contratto (segnala, non corregge)", () => {
    const broken: ComponentFixture = {
      ...fixture,
      cells: [
        {
          ...fixture.cells[0]!,
          root: {
            ...fixture.cells[0]!.root,
            children: [
              ...fixture.cells[0]!.root.children,
              { name: "icona", kind: "path", tokens: { strokeColor: "color.border" }, style: {}, children: [] },
            ],
          },
        },
      ],
    };
    expect(() => buildRecipe(broken, catalog, badgeJudgment)).toThrow(/"icona".*non è una parte del contratto "badge"/);
  });

  it("rifiuta due layer con lo stesso nome di parte e binding (ambiguo)", () => {
    const broken: ComponentFixture = {
      ...fixture,
      cells: [
        {
          ...fixture.cells[0]!,
          root: {
            ...fixture.cells[0]!.root,
            children: [
              ...fixture.cells[0]!.root.children,
              { name: "label", kind: "text", tokens: { fill: "color.secondary" }, style: {}, children: [] },
            ],
          },
        },
      ],
    };
    expect(() => buildRecipe(broken, catalog, badgeJudgment)).toThrow(/due layer chiamati "label"/);
  });

  describe("registro delle proprietà (Story 2.8)", () => {
    const withRoot = (patch: (root: ComponentFixture["cells"][number]["root"]) => void): ComponentFixture => {
      const broken = structuredClone(fixture);
      patch(broken.cells[0]!.root);
      return broken;
    };

    it("tratteggio: strokeStyle dashed nello stile blocca il componente", () => {
      const broken = withRoot((root) => (root.style.strokeStyle = "dashed"));
      expect(() => buildRecipe(broken, catalog, badgeJudgment)).toThrow(
        /Estrazione di "Badge" bloccata[\s\S]*Proprietà bloccata.*componente "Badge", parte "root", cella "variant=default\|size=sm", proprietà "strokeStyle", valore "dashed"/,
      );
    });

    it("fuori lista: strokeStyle mixed blocca nominando la lista", () => {
      const broken = withRoot((root) => (root.style.strokeStyle = "mixed"));
      expect(() => buildRecipe(broken, catalog, badgeJudgment)).toThrow(/Valore fuori lista.*\[solid, dashed, dotted\]/);
    });

    it("allineamento: strokeAlignment outer blocca", () => {
      const broken = withRoot((root) => (root.style.strokeAlignment = "outer"));
      expect(() => buildRecipe(broken, catalog, badgeJudgment)).toThrow(/Proprietà bloccata.*"strokeAlignment"/);
    });

    it("non registrata: una proprietà ignota nei binding blocca", () => {
      const broken = withRoot((root) => (root.children[0]!.tokens.fooBar = "color.primary"));
      expect(() => buildRecipe(broken, catalog, badgeJudgment)).toThrow(
        /Proprietà non registrata.*parte "label".*proprietà "fooBar", token "color.primary"/,
      );
    });

    it("icona: strokeWidth su un layer path non blocca l'estrazione", () => {
      const iconCatalog: TokenCatalog = {
        sets: [...catalog.sets, { name: "border", tokens: [{ name: "border-width.default", type: "borderWidth", value: "1" }] }],
      };
      const withIcon = withRoot((root) => {
        const label = root.children[0]!;
        label.kind = "path";
        label.tokens.strokeWidth = "border-width.default";
        label.style.strokeWidth = 1;
      });
      expect(buildRecipe(withIcon, iconCatalog, badgeJudgment).parts.label!["variant=default|size=sm"]).toMatchObject({
        strokeWidth: "border-width.default",
      });
    });

    it("le ricette committate si riottengono byte per byte dalle fixture committate", () => {
      const committedCatalog = loadCatalogFixture();
      const recipesDir = PATHS.recipesDir;
      for (const component of committedComponents()) {
        const committedFixture = loadFixture(component);
        const recipe = buildRecipe(committedFixture, committedCatalog, loadJudgment(committedFixture.contract.split("@")[0]!));
        expect(`${JSON.stringify(recipe, null, 2)}\n`, component).toBe(readFileSync(recipePathFor(component, recipesDir), "utf8"));
      }
    });
  });

  it("rifiuta una cella duplicata nel prodotto cartesiano", () => {
    const broken: ComponentFixture = { ...fixture, cells: [fixture.cells[0]!, fixture.cells[0]!] };
    expect(() => buildRecipe(broken, catalog, badgeJudgment)).toThrow(/Cella duplicata "variant=default\|size=sm"/);
  });

  it("rifiuta una cella senza valore per un asse del contratto", () => {
    const broken: ComponentFixture = {
      ...fixture,
      cells: [{ ...fixture.cells[0]!, variantProps: { variant: "default" } }],
    };
    expect(() => buildRecipe(broken, catalog, badgeJudgment)).toThrow(/senza valore per l'asse "size"/);
  });
});

/** Snapshot di library valido per il contratto badge@1: 6 celle, prodotto cartesiano completo. */
function badgeSnapshot() {
  const cells = ["default", "secondary", "destructive"].flatMap((variant) =>
    ["sm", "md"].map((size) => ({
      variantProps: { variant, size },
      variantError: null,
      root: {
        name: "Badge",
        kind: "board",
        tokens: { fill: variant === "default" ? "color.primary" : variant === "secondary" ? "color.secondary" : "color.destructive" },
        style: { fill: ["<valore>"] },
        children: [{ name: "label", kind: "text", tokens: { fill: "color.primary-foreground" }, style: { fill: ["<valore>"] }, children: [] }],
      },
    })),
  );
  return {
    sets: [],
    componentCount: 1,
    components: [
      {
        id: "container-badge",
        name: "Badge",
        pluginData: "badge@1",
        axes: ["variant", "size"],
        axesValues: { variant: ["default", "secondary", "destructive"], size: ["sm", "md"] },
        cells,
      },
    ],
  };
}

let tmpRoots: string[] = [];

afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots = [];
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpRoots.push(dir);
  return dir;
}

describe("extract — end-to-end (review loop 1, BH#10: gate-before-write osservato, seam --snapshot come percorso)", () => {
  it("un snapshot malformato (JSON valido, non-snapshot) fa throw PRIMA di scrivere: la directory recipes resta intatta", async () => {
    const snapshotPath = join(tempDir("snapshot-malformato-"), "snap.json");
    writeFileSync(snapshotPath, JSON.stringify({ sets: "non-una-lista" }), "utf8");
    const recipesDir = tempDir("extract-gate-");
    mkdirSync(recipesDir, { recursive: true });
    writeFileSync(join(recipesDir, "sentinella.txt"), "intatta", "utf8");

    await expect(extract("Badge", { snapshotPath, recipesDir })).rejects.toThrow(/non è uno snapshot di library valido[\s\S]*"sets"/);
    expect(readdirSync(recipesDir).sort()).toEqual(["sentinella.txt"]);
  });

  it("un snapshot che non è nemmeno JSON fa throw nominando il file", async () => {
    const snapshotPath = join(tempDir("snapshot-nonjson-"), "snap.json");
    writeFileSync(snapshotPath, "{ non è json", "utf8");
    const recipesDir = tempDir("extract-gate-2-");
    await expect(extract("Badge", { snapshotPath, recipesDir })).rejects.toThrow(/snapshot-nonjson|non è JSON leggibile/);
    expect(readdirSync(recipesDir)).toEqual([]);
  });

  it("un snapshot valido produce la coppia fixture+ricetta che passa validateRecipe (seam --snapshot esercitato)", async () => {
    const snapshotPath = join(tempDir("snapshot-valido-"), "snap.json");
    writeFileSync(snapshotPath, JSON.stringify(badgeSnapshot()), "utf8");
    const recipesDir = tempDir("extract-happy-");

    const { fixturePath, recipePath } = await extract("Badge", { snapshotPath, recipesDir });
    expect(fixturePath).toContain("badge.fixture.json");
    expect(recipePath).toContain("badge.recipe.json");

    const writtenFixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    const writtenRecipe = JSON.parse(readFileSync(recipePath, "utf8"));
    expect(writtenFixture.contract).toBe("badge@1");
    expect(writtenRecipe.judgment.domain).toBe("data-display");
    expect(writtenRecipe.parts.root["variant=destructive|size=md"]).toEqual({ fill: "color.destructive" });
  });

  it("la coppia scritta da extract() passa validateRecipe con i file committati (gate = validateRecipe)", async () => {
    const snapshotPath = join(tempDir("snapshot-valido-2-"), "snap.json");
    writeFileSync(snapshotPath, JSON.stringify(badgeSnapshot()), "utf8");
    const recipesDir = tempDir("extract-happy-2-");

    const { fixturePath, recipePath } = await extract("Badge", { snapshotPath, recipesDir });
    const writtenFixture: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
    const writtenRecipe: unknown = JSON.parse(readFileSync(recipePath, "utf8"));
    const judgment = JSON.parse(readFileSync(resolve(PATHS.judgmentsDir, "badge.json"), "utf8"));
    // Stesso gate del CLI validate:recipe.
    const { validateRecipe: runGate } = await import("./validate-recipe");
    const result = runGate(writtenFixture, writtenRecipe, catalog, judgment);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe("extract — alias dei layer e byte-identità (Story 2.8 parte B)", () => {
  it("dalle fixture committate l'estrazione riproduce fixture e ricetta committate byte per byte", async () => {
    for (const component of committedComponents()) {
      const fixture = loadFixture(component);
      const snapshot = {
        sets: [],
        componentCount: 1,
        components: [
          {
            id: fixture.penpotComponentId,
            name: fixture.componentName,
            pluginData: fixture.contract,
            axes: fixture.axes.map((axis) => axis.name),
            axesValues: Object.fromEntries(fixture.axes.map((axis) => [axis.name, axis.values])),
            cells: fixture.cells.map((cell) => ({ variantProps: cell.variantProps, variantError: null, root: cell.root })),
          },
        ],
      };
      const snapshotPath = join(tempDir(`snapshot-${component}-`), "snap.json");
      writeFileSync(snapshotPath, JSON.stringify(snapshot), "utf8");
      const outDir = tempDir(`extract-${component}-`);
      const log = console.log;
      console.log = () => {};
      try {
        const { fixturePath, recipePath } = await extract(component, { snapshotPath, recipesDir: outDir });
        expect(readFileSync(fixturePath, "utf8")).toBe(readFileSync(resolve(PATHS.recipesDir, fixturePath.split("/").pop()!), "utf8"));
        expect(readFileSync(recipePath, "utf8")).toBe(readFileSync(resolve(PATHS.recipesDir, recipePath.split("/").pop()!), "utf8"));
      } finally {
        console.log = log;
      }
    }
  });

  it("layer `Label Text` + alias `label` nel binding → stessa ricetta; alias verso una parte inesistente → errore", async () => {
    const renamed = badgeSnapshot();
    for (const cell of renamed.components[0]!.cells) cell.root.children[0]!.name = "Label Text";
    const snapshotPath = join(tempDir("snapshot-alias-"), "snap.json");
    writeFileSync(snapshotPath, JSON.stringify(renamed), "utf8");
    const plainPath = join(tempDir("snapshot-plain-"), "snap.json");
    writeFileSync(plainPath, JSON.stringify(badgeSnapshot()), "utf8");

    const binding = JSON.parse(readFileSync(resolve(PATHS.bindingsDir, "badge.binding.json"), "utf8"));
    const log = console.log;
    console.log = () => {};
    try {
      // Senza alias il layer rinominato non è una parte: l'estrazione si ferma.
      await expect(extract("Badge", { snapshotPath, recipesDir: tempDir("extract-noalias-") })).rejects.toThrow(/"Label Text".*non è una parte/);

      const bindingsDir = tempDir("bindings-alias-");
      binding.parts.label.aliases = ["Label Text"];
      writeFileSync(join(bindingsDir, "badge.binding.json"), JSON.stringify(binding), "utf8");
      const withAlias = await extract("Badge", { snapshotPath, recipesDir: tempDir("extract-alias-"), bindingsDir });
      const plain = await extract("Badge", { snapshotPath: plainPath, recipesDir: tempDir("extract-plain-") });
      expect(readFileSync(withAlias.recipePath, "utf8")).toBe(readFileSync(plain.recipePath, "utf8"));

      const badDir = tempDir("bindings-bad-");
      binding.parts.icon = { ...binding.parts.label, aliases: ["Icon"] };
      writeFileSync(join(badDir, "badge.binding.json"), JSON.stringify(binding), "utf8");
      await expect(extract("Badge", { snapshotPath, recipesDir: tempDir("extract-bad-"), bindingsDir: badDir })).rejects.toThrow(
        /alias "Icon" punta alla parte "icon"/,
      );
    } finally {
      console.log = log;
    }
  });
});

describe("loadPartAliases — contratto sconosciuto", () => {
  it("un binding che dichiara un contratto inesistente è un errore nominativo, non «nessun alias»", () => {
    const dir = tempDir("bindings-unknown-");
    const binding = JSON.parse(readFileSync(resolve(PATHS.bindingsDir, "badge.binding.json"), "utf8"));
    binding.contract = "fantasma@1";
    writeFileSync(join(dir, "badge.binding.json"), JSON.stringify(binding), "utf8");
    expect(() => loadPartAliases("Badge", dir)).toThrow(/"fantasma@1", che non esiste in @app\/contracts/);
    expect(loadPartAliases("Badge")).toEqual({});
  });
});
