import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { LibrarySnapshot, SnapshotLayer } from "../library/library-snapshot";
import { PATHS } from "../shared/paths";
import { productCardExtraction } from "../contracts/product-card.extract";
import { ScriptError } from "../errors";
import { expectedAxes, expectedCells, partsForCell } from "../library-plan";
import { runShell, type ShellIo } from "../shell";
import { buildComponentSnapshot, componentSnapshotPathFor, loadComponentSnapshot, type ComponentSnapshot } from "../components";
import { extractCommandWith } from "./extract";
import { domainBarrelContent, isGeneratedFileV2, renderCheckV2, renderCommandWith, renderComponentV2 } from "./render";

/**
 * `render <Comp>|--all [--check]` (Story 2.14, CAP-5): da istantanea
 * committata genera i quattro file `@generated` senza basi. Una prova
 * rosso/verde per ogni riga della matrice, esito solo da exit code.
 * Categorie `input` 1 / `contract` 3 / `gate` 4 (mai scritture su Penpot,
 * contratti o istantanee; mai in CI né in build).
 */

const EXTRACTION = productCardExtraction;

function io(): ShellIo & { outLogs: string[]; errLogs: string[] } {
  const outLogs: string[] = [];
  const errLogs: string[] = [];
  return { outLogs, errLogs, out: (text) => outLogs.push(text), err: (text) => errLogs.push(text) };
}

const dirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "render-v2-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function boardName(variantProps: Readonly<Record<string, string>>): string {
  return `ProductCard ${Object.entries(variantProps).map(([axis, value]) => `${axis}=${value}`).join("|")}`;
}

function buildRoot(variantProps: Readonly<Record<string, string>>): SnapshotLayer {
  const parts = partsForCell(EXTRACTION, variantProps);
  const nodes = new Map<string, SnapshotLayer>();
  for (const part of parts) {
    const isRoot = part.name === "root";
    nodes.set(part.name, {
      name: isRoot ? boardName(variantProps) : part.layer,
      kind: part.kind === "text" ? "text" : "board",
      tokens: { ...part.tokens },
      style: {},
      children: [],
    });
  }
  for (const part of parts) {
    if (part.name === "root") continue;
    nodes.get(part.parent!)!.children.push(nodes.get(part.name)!);
  }
  return nodes.get("root")!;
}

function conformantLibrarySnapshot(): LibrarySnapshot {
  const axes = expectedAxes(EXTRACTION);
  return {
    sets: [],
    componentCount: 1,
    components: [
      {
        id: "container-id",
        name: "ProductCard",
        pluginData: EXTRACTION.pluginData,
        axes: axes.map((axis) => axis.name),
        axesValues: Object.fromEntries(axes.map((axis) => [axis.name, [...axis.values]])),
        cells: expectedCells(EXTRACTION).map((cell) => ({
          variantProps: { ...cell.variantProps },
          variantError: null,
          root: buildRoot(cell.variantProps),
        })),
      },
    ],
  };
}

function catalog(): { sets: Array<{ name: string; tokens: Array<{ name: string; type: string; value: unknown }> }> } {
  return JSON.parse(readFileSync(PATHS.catalogPath, "utf8")) as never;
}

async function writeCommittedSnapshot(componentsDir: string): Promise<ComponentSnapshot> {
  const shell = io();
  const command = extractCommandWith({ readSnapshot: async () => conformantLibrarySnapshot(), componentsDir, log: () => undefined, catalog: catalog() as never });
  expect(await runShell(["extract", "ProductCard"], [command], shell)).toBe(0);
  return loadComponentSnapshot("ProductCard", componentsDir);
}

describe("render — marker, skip e diff-zero (imitati dalla v1, mai importati)", () => {
  it("isGeneratedFileV2: solo la prima riga conta", () => {
    expect(isGeneratedFileV2("// @generated — DO NOT EDIT\nfoo")).toBe(true);
    expect(isGeneratedFileV2("// niente\n// @generated dopo")).toBe(false);
    expect(isGeneratedFileV2("")).toBe(false);
  });

  it("renderCheckV2: skip esclusi, missing/divergente nominati", () => {
    const expected = [
      { path: "commerce/A.tsx", content: "a", action: "write" as const },
      { path: "commerce/skip.tsx", content: "s", action: "skip" as const },
    ];
    expect(renderCheckV2(expected, { "commerce/A.tsx": "a" }).equal).toBe(true);
    expect(renderCheckV2(expected, {}).divergences).toEqual([{ path: "commerce/A.tsx", reason: "missing" }]);
    expect(renderCheckV2(expected, { "commerce/A.tsx": "b" }).divergences).toEqual([{ path: "commerce/A.tsx", reason: "divergente" }]);
  });
});

describe("render — happy (4 file @generated con provenienza e mappatura, senza basi)", () => {
  it("da istantanea committata: 4 file in domains/commerce/ con when/repeat/attribute/state/layout/content/focus", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    const snapshot = await writeCommittedSnapshot(componentsDir);
    const shell = io();
    const logs: string[] = [];
    const command = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: (text) => logs.push(text) });
    expect(await runShell(["render", "ProductCard"], [command], shell)).toBe(0);
    expect(shell.errLogs).toEqual([]);
    const tsx = readFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "utf8");
    const test = readFileSync(join(domainsDir, "commerce/ProductCard.test.tsx"), "utf8");
    const stories = readFileSync(join(domainsDir, "commerce/ProductCard.stories.tsx"), "utf8");
    const barrel = readFileSync(join(domainsDir, "commerce/index.ts"), "utf8");
    for (const [label, content] of [["tsx", tsx], ["test", test], ["stories", stories], ["barrel", barrel]] as const) {
      expect(content.split("\n", 1)[0], label).toContain("@generated");
      expect(content, label).toContain(snapshot.contract);
      expect(content, label).toContain(snapshot.provenance.penpotComponentId);
      expect(content, label).toContain(snapshot.provenance.snapshotHash);
    }
    // Mappatura fissa, nessuna base.
    expect(tsx).toMatch(/promo === "offer" \|\| promo === "discount"/); // when → condizionale
    expect(tsx).toMatch(/tags\.map\(\(item\)/); // repeat → map (primo layer modello, chiave sul valore)
    expect(tsx).not.toContain("key={index}");
    expect(tsx).toContain("href={href}"); // attribute → attributo
    expect(tsx).toContain("src={image}"); // attribute → attributo
    expect(tsx).toContain("{price}"); // content → testo
    expect(tsx).toContain("{description}"); // content → testo
    expect(tsx).toContain("{badgeLabel}"); // content → testo (field, non statico)
    expect(tsx).toContain("{item}"); // content $item dentro repeat
    expect(tsx).toContain("focus-visible:"); // focusVisible → focus-visible:
    expect(tsx).not.toContain("cva(");
    expect(tsx).not.toContain("shadcn");
    expect(tsx).not.toContain("data/bases");
    expect(tsx).not.toContain("@base-ui");
    // Token dal registro (classi derivate, non scritte a mano nel comando).
    expect(tsx).toContain("bg-card");
    expect(tsx).toContain("rounded-");
    expect(test).toContain("Offerta");
    expect(test).toContain("data-slot");
    expect(test).toContain('href="https://example.com/p"');
    expect(stories).toContain("Commerce/ProductCard");
    expect(stories).toContain("EmptyTags");
    expect(stories).toContain("tags: []");
    expect(stories).toContain("Giudizio visivo — Alessandro (Story 2-15, CAP-10)");
    expect(barrel).toContain('from "./ProductCard"');
    expect(logs.join("\n")).toMatch(/Scritto:/);
  });

  it("puro: classi hover: da differenze di stato e layout dal registro", async () => {
    const componentsDir = tmp();
    const snapshot = await writeCommittedSnapshot(componentsDir);
    // Differenza di stato: root fill diverso con hover=on → prefisso hover:.
    const hovered: ComponentSnapshot = {
      ...snapshot,
      cells: Object.fromEntries(
        Object.entries(snapshot.cells).map(([key, parts]) => {
          if (key.endsWith("hover=on")) {
            return [key, { ...parts, root: { ...parts["root"]!, fill: "color.primary" } }];
          }
          return [key, parts];
        }),
      ),
    };
    const { files } = renderComponentV2(hovered, EXTRACTION, catalog() as never, {});
    const tsx = files.find((f) => f.path.endsWith("ProductCard.tsx"))!.content;
    expect(tsx).toMatch(/hover:bg-primary/);
  });

  it("rosso (contract): varianza promo a parità di hover nomina promo e parte", async () => {
    const componentsDir = tmp();
    const snapshot = await writeCommittedSnapshot(componentsDir);
    // Stessa parte (price), token diversi fra promo a parità di hover=off.
    const drifted: ComponentSnapshot = {
      ...snapshot,
      cells: Object.fromEntries(
        Object.entries(snapshot.cells).map(([key, parts]) => {
          if (key === "promo=offer|hover=off") {
            return [key, { ...parts, price: { ...parts["price"]!, fill: "color.primary" } }];
          }
          return [key, parts];
        }),
      ),
    };
    try {
      renderComponentV2(drifted, EXTRACTION, catalog() as never, {});
      expect.unreachable("atteso ScriptError contract");
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptError);
      expect((error as ScriptError).kind).toBe("contract");
      expect((error as ScriptError).part).toBe("price");
      expect((error as ScriptError).message).toMatch(/promo/);
    }
  });

  it("--check a diff zero dopo scrittura, senza riscrivere", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    await writeCommittedSnapshot(componentsDir);
    const writer = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "ProductCard"], [writer], io())).toBe(0);
    const before = readFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "utf8");
    const shell = io();
    const checker = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "ProductCard", "--check"], [checker], shell)).toBe(0);
    expect(readFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "utf8")).toBe(before);
    expect(shell.errLogs).toEqual([]);
  });

  it("--help: uso con <Comp>|--all [--check], senza letture né scritture", async () => {
    const shell = io();
    const logs: string[] = [];
    const command = renderCommandWith({
      componentsDir: tmp(),
      domainsDir: tmp(),
      catalog: catalog() as never,
      log: (text) => logs.push(text),
    });
    expect(await runShell(["render", "--help"], [command], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/render <Comp>\|--all \[--check\]/);
    expect(shell.errLogs).toEqual([]);
  });
});

describe("render — rosso e skip protettivo", () => {
  it("skip: file esistente senza marker mai sovrascritto (non errore)", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    await writeCommittedSnapshot(componentsDir);
    const writer = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "ProductCard"], [writer], io())).toBe(0);
    const manual = "// scritto a mano\nmanuale";
    writeFileSync(join(domainsDir, "commerce/ProductCard.tsx"), manual);
    const shell = io();
    const logs: string[] = [];
    const second = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: (text) => logs.push(text) });
    expect(await runShell(["render", "ProductCard"], [second], shell)).toBe(0);
    expect(shell.errLogs).toEqual([]);
    expect(readFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "utf8")).toBe(manual);
    expect(logs.join("\n")).toMatch(/SKIP.*senza marker/);
    // --check ignora gli skip (resta verde).
    const checker = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "ProductCard", "--check"], [checker], io())).toBe(0);
  });

  it("--check divergente (exit 4 gate): nomina componente e file", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    await writeCommittedSnapshot(componentsDir);
    const writer = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "ProductCard"], [writer], io())).toBe(0);
    writeFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "// @generated\ndivergente");
    const shell = io();
    const checker = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "ProductCard", "--check"], [checker], shell)).toBe(4);
    expect(shell.errLogs.join("\n")).toMatch(/✖ gate[\s\S]*ProductCard[\s\S]*NON a diff zero/);
  });

  it("rosso (input, exit 1): nome ignoto nomina componente e contratti noti", async () => {
    const shell = io();
    const command = renderCommandWith({ componentsDir: tmp(), domainsDir: tmp(), catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "Foo"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*"Foo"[\s\S]*ProductCard/);
  });

  it("rosso (input): --all e nome alternativi, argomento mancante, istantanea assente", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    await writeCommittedSnapshot(componentsDir);
    const command = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    let shell = io();
    expect(await runShell(["render", "--all", "ProductCard"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*alternativi/);
    shell = io();
    expect(await runShell(["render"], [command], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*uso: render/);
    shell = io();
    const empty = renderCommandWith({ componentsDir: tmp(), domainsDir: tmp(), catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "ProductCard"], [empty], shell)).toBe(1);
    expect(shell.errLogs.join("\n")).toMatch(/✖ input[\s\S]*istantanea non trovata/);
  });

  it("rosso (contract): istantanea con contract diverso dal plugin data", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    const snapshot = await writeCommittedSnapshot(componentsDir);
    const drifted = { ...snapshot, contract: "product-card@2" };
    writeFileSync(componentSnapshotPathFor("ProductCard", componentsDir), JSON.stringify(drifted, null, 2));
    const shell = io();
    const command = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "ProductCard"], [command], shell)).toBe(3);
    expect(shell.errLogs.join("\n")).toMatch(/✖ contract[\s\S]*product-card@2/);
  });

  it("direct run lancia ScriptError con kind corretto", async () => {
    const command = renderCommandWith({ componentsDir: tmp(), domainsDir: tmp(), catalog: catalog() as never, log: () => undefined });
    try {
      await command.run(["Foo"]);
      expect.unreachable("atteso ScriptError input");
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptError);
      expect((error as ScriptError).kind).toBe("input");
    }
  });
});

describe("render — barrel per dominio (uno solo in --all, mai sovrascritture parziali)", () => {
  it("singolo: equivale al barrel del singolo render (stesso header, --check verde in entrambi i modi)", async () => {
    const componentsDir = tmp();
    const snapshot = await writeCommittedSnapshot(componentsDir);
    const { files } = renderComponentV2(snapshot, EXTRACTION, catalog() as never, {});
    const single = files.find((f) => f.path.endsWith("/index.ts"))!.content;
    expect(domainBarrelContent([{ component: "ProductCard", snapshot }])).toBe(single);
  });

  it("multiplo: accumula gli export ordinati con header --all", async () => {
    const componentsDir = tmp();
    const snapshot = await writeCommittedSnapshot(componentsDir);
    const other = buildComponentSnapshot({
      contract: "other-comp@1",
      penpotComponentId: "other-id",
      cells: { "x=1": { root: { fill: "color.card" } } },
      readAt: "2026-09-27T00:00:00.000Z",
    });
    const merged = domainBarrelContent([
      { component: "ProductCard", snapshot },
      { component: "OtherComp", snapshot: other },
    ]);
    expect(merged.split("\n", 1)[0]).toContain("@generated");
    const lines = merged.split("\n").filter((line) => line.startsWith("export {"));
    expect(lines).toEqual([`export { OtherComp, type OtherCompProps } from "./OtherComp";`, `export { ProductCard, type ProductCardProps } from "./ProductCard";`]);
    expect(merged).toContain("render -- --all");
  });
});

describe("render --all: accumula i fallimenti e li elenca alla fine", () => {
  it("--all scrive tutti e --check --all verifica a diff zero", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    await writeCommittedSnapshot(componentsDir);
    const shell = io();
    const logs: string[] = [];
    const writer = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: (text) => logs.push(text) });
    expect(await runShell(["render", "--all"], [writer], shell)).toBe(0);
    expect(logs.join("\n")).toMatch(/1 componenti: ProductCard/);
    const checker = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "--check", "--all"], [checker], io())).toBe(0);
  });

  it("--check --all divergente: exit 4 gate che elenca il componente", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    await writeCommittedSnapshot(componentsDir);
    const writer = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "--all"], [writer], io())).toBe(0);
    writeFileSync(join(domainsDir, "commerce/ProductCard.tsx"), "// @generated\ndivergente");
    const shell = io();
    const checker = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "--check", "--all"], [checker], shell)).toBe(4);
    expect(shell.errLogs.join("\n")).toMatch(/✖ gate[\s\S]*NON a diff zero[\s\S]*ProductCard/);
  });

  it("--all accumula: istantanea corrotta = gate che elenca la fallita senza fermarsi", async () => {
    const componentsDir = tmp();
    const domainsDir = tmp();
    await writeCommittedSnapshot(componentsDir);
    // Istantanea illeggibile: fallisce in load, accumulata ed elencata (exit 4).
    writeFileSync(join(componentsDir, "product-card.json"), "{corrotta");
    const shell = io();
    const command = renderCommandWith({ componentsDir, domainsDir, catalog: catalog() as never, log: () => undefined });
    expect(await runShell(["render", "--all"], [command], shell)).toBe(4);
    const err = shell.errLogs.join("\n");
    expect(err).toMatch(/✖ gate[\s\S]*1 di 1 componenti in errore/);
    expect(err).toMatch(/ProductCard/);
  });
});
