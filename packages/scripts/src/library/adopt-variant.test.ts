import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_CONTRACTS, fingerprintPayload, SCHEMA_VERSION, SECTION_DEFINITIONS, type ComponentContract } from "@app/contracts";
import { describe, expect, it, vi } from "vitest";

import { BindingSchema } from "../emitter/binding-shadcn";
import { FixtureSchema, type ComponentFixture } from "../recipe-schema";
import { DEFAULT_PATHS } from "./adopt-cli";
import {
  addValuesToContractSource,
  planAdoption,
  readContractAxes,
  writeAdoption,
  type AdoptionFile,
  type AdoptionPlan,
  type AdoptionSources,
} from "./adopt-variant";
import type { ComponentDesign } from "./library-plan";
import type { LibrarySnapshot, SnapshotCell, SnapshotLayer } from "./library-snapshot";
import { verifyLibrary } from "./verify-library";

const recipesDir = resolve(import.meta.dirname, "../recipes");

function fixture(name: string): ComponentFixture {
  return FixtureSchema.parse(JSON.parse(readFileSync(resolve(recipesDir, `${name}.fixture.json`), "utf8")));
}

function snapshotFrom(f: ComponentFixture): LibrarySnapshot {
  return {
    sets: [],
    componentCount: 1,
    components: [
      {
        id: f.penpotComponentId,
        name: f.componentName,
        pluginData: f.contract,
        axes: f.axes.map((axis) => axis.name),
        axesValues: Object.fromEntries(f.axes.map((axis) => [axis.name, [...axis.values]])),
        cells: f.cells.map((cell) => ({ variantProps: { ...cell.variantProps }, variantError: null, root: structuredClone(cell.root) })),
      },
    ],
  };
}

function retoken(layer: SnapshotLayer, map: Record<string, string>): SnapshotLayer {
  return {
    ...layer,
    tokens: Object.fromEntries(Object.entries(layer.tokens).map(([property, token]) => [property, map[token] ?? token])),
    children: layer.children.map((child) => retoken(child, map)),
  };
}

const OUTLINE_TOKENS = { "color.primary": "color.background", "color.primary-foreground": "color.foreground" };

/** Badge con `variant=outline` aggiunto in Penpot: celle outline×{sm,md} copiate da default e ritokenizzate. */
function badgeWithOutline(
  tweak: (cell: SnapshotCell) => SnapshotCell | null = (cell) => cell,
  value = "outline",
): LibrarySnapshot {
  const snapshot = snapshotFrom(fixture("badge"));
  const container = snapshot.components[0]!;
  const outline = container.cells
    .filter((cell) => cell.variantProps?.variant === "default")
    .map((cell) => ({ ...cell, variantProps: { ...cell.variantProps!, variant: value }, root: retoken(cell.root, OUTLINE_TOKENS) }))
    .map(tweak)
    .filter((cell): cell is SnapshotCell => cell !== null);
  container.cells.push(...outline);
  container.axesValues.variant = [...container.axesValues.variant!, value];
  return snapshot;
}

function readSources(name: string): AdoptionSources {
  const read = (path: string) => ({ path, text: readFileSync(path, "utf8") });
  return {
    contract: read(resolve(DEFAULT_PATHS.contractsSrcDir, "components", `${name}.ts`)),
    schemaVersion: read(resolve(DEFAULT_PATHS.contractsSrcDir, "schema-version.ts")),
    fingerprint: read(DEFAULT_PATHS.fingerprintPath),
    binding: read(resolve(DEFAULT_PATHS.bindingsDir, `${name}.binding.json`)),
    design: read(resolve(DEFAULT_PATHS.designsDir, `${name}.design.json`)),
  };
}

function plan(contract: ComponentContract, snapshot: LibrarySnapshot, sources = readSources(contract.name)): AdoptionPlan {
  const design = JSON.parse(sources.design.text) as ComponentDesign;
  const binding = BindingSchema.parse(JSON.parse(sources.binding.text));
  return planAdoption(contract, snapshot, design, binding, sources);
}

function expectError(result: AdoptionPlan, ...fragments: string[]): void {
  expect(result.kind).toBe("error");
  if (result.kind === "error") for (const fragment of fragments) expect(result.message).toContain(fragment);
}

const badge = COMPONENT_CONTRACTS.badge as ComponentContract;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
/** Versione corrente e successiva, dal sorgente: i test reggono ogni bump futuro del catalogo. */
const CURRENT = SCHEMA_VERSION;
const NEXT = SCHEMA_VERSION + 1;

describe("planAdoption — adozione", () => {
  const result = plan(badge, badgeWithOutline());
  const adopt = result.kind === "adopt" ? result : undefined;
  const file = (label: AdoptionFile["label"]) => adopt!.files.find((entry) => entry.label === label)!;

  it("piano adopt con i cinque file, SCHEMA_VERSION N→N+1, default e contract.version invariati", () => {
    expect(result.kind).toBe("adopt");
    expect(adopt!.added).toEqual([{ axis: "variant", values: ["outline"] }]);
    expect(adopt!.schemaVersion).toEqual({ from: CURRENT, to: NEXT });
    expect(adopt!.files.map((entry) => entry.label)).toEqual(["contratto", "SCHEMA_VERSION", "fingerprint", "binding", "design"]);
    expect(adopt!.adopted.axes[0]!.values).toEqual(["default", "secondary", "destructive", "outline"]);
    expect(adopt!.adopted.axes[0]!.default).toBe("default");
    expect(adopt!.adopted.version).toBe(badge.version);
    expect(adopt!.cells).toEqual(["variant=outline|size=sm", "variant=outline|size=md"]);
  });

  it("contratto: il valore entra in coda nell'array values e il sorgente riletto lo conferma", () => {
    expect(file("contratto").after).toContain('values: ["default", "secondary", "destructive", "outline"]');
    expect(readContractAxes(file("contratto").after, "badge.ts", "badge")).toEqual({
      variant: ["default", "secondary", "destructive", "outline"],
      size: ["sm", "md"],
    });
    expect(file("contratto").after.replace(', "outline"', "")).toBe(file("contratto").before);
  });

  it("SCHEMA_VERSION e fingerprint: voce 1 identica, voce 2 = sha256 del payload col contratto adottato", () => {
    expect(file("SCHEMA_VERSION").after).toContain(`export const SCHEMA_VERSION = ${NEXT};`);
    const before = JSON.parse(file("fingerprint").before) as Record<string, string>;
    const after = JSON.parse(file("fingerprint").after) as Record<string, string>;
    // Le voci esistenti (1…corrente) restano identiche; si aggiunge solo la successiva.
    for (const [version, hash] of Object.entries(before)) expect(after[version]).toBe(hash);
    expect(Object.keys(after)).toEqual([...Object.keys(before), String(NEXT)]);
    const components = Object.values(COMPONENT_CONTRACTS).map((c) => (c.name === "badge" ? adopt!.adopted : c));
    expect(after[String(NEXT)]).toBe(sha256(fingerprintPayload(components, Object.values(SECTION_DEFINITIONS))));
    expect(adopt!.hash).toBe(after[String(NEXT)]);
  });

  it("binding: outline → \"outline\", e passa BindingSchema", () => {
    const binding = BindingSchema.parse(JSON.parse(file("binding").after));
    expect(binding.axes.variant!.values.outline).toBe("outline");
    expect(Object.keys(binding.axes.variant!.values)).toEqual(["default", "secondary", "destructive", "outline"]);
  });

  it("design: due celle nuove dai token Penpot, celle esistenti invariate", () => {
    const before = JSON.parse(file("design").before) as ComponentDesign;
    const after = JSON.parse(file("design").after) as ComponentDesign;
    for (const [key, cell] of Object.entries(before.cells)) expect(after.cells[key]).toEqual(cell);
    expect(after.cells["variant=outline|size=sm"]!.root!.fill).toBe("color.background");
    expect(after.cells["variant=outline|size=md"]!.label!.fill).toBe("color.foreground");
    expect(after.cells["variant=outline|size=md"]!.root!.paddingLeft).toBe("spacing.3");
  });

  it("dopo l'adozione le regole 4 e 5 di verify:library sono verdi sullo stesso snapshot", () => {
    const before = verifyLibrary({ contracts: [badge], spec: { tokens: [], contrastPairs: [] }, snapshot: badgeWithOutline() });
    // Story 2.8 parte B: una variante non adottata mette il componente "in attesa", non rosso.
    expect(before.pending.some((message) => message.includes("in più [outline]"))).toBe(true);
    const badgeProblems = before.components.find((verdict) => verdict.component === "Badge")?.problems ?? [];
    expect(badgeProblems.find((problem) => problem.message.includes("in più [outline]"))?.severity).toBe("pending");
    const after = verifyLibrary({ contracts: [adopt!.adopted], spec: { tokens: [], contrastPairs: [] }, snapshot: badgeWithOutline() });
    const rules45 = [...after.errors, ...after.pending].filter((message) => /valori del contratto|manca la cella|cella ".*" in più|proprietà di variante/.test(message));
    expect(rules45).toEqual([]);
  });

  it("secondo run col contratto adottato → nulla da adottare", () => {
    const again = plan(adopt!.adopted, badgeWithOutline());
    expect(again.kind).toBe("nothing");
    if (again.kind === "nothing") expect(again.message).toContain("nulla da adottare");
  });
});

describe("planAdoption — casi rifiutati (nessun file)", () => {
  it("nulla da adottare: nessun valore in più", () => {
    const result = plan(badge, snapshotFrom(fixture("badge")));
    expect(result.kind).toBe("nothing");
  });

  it("valori mancanti in Penpot non si rimuovono: senza valori in più resta nothing", () => {
    const snapshot = snapshotFrom(fixture("badge"));
    snapshot.components[0]!.axesValues.variant = ["default", "secondary"];
    expect(plan(badge, snapshot).kind).toBe("nothing");
  });

  it.each([
    ["input", "state", "hover"],
    ["accordion-item", "state", "half"],
  ])("asse non option (%s, %s) → errore mapping 1:1", (name, axis, value) => {
    const contract = COMPONENT_CONTRACTS[name as keyof typeof COMPONENT_CONTRACTS] as ComponentContract;
    const snapshot = snapshotFrom(fixture(name));
    snapshot.components[0]!.axesValues[axis] = [...snapshot.components[0]!.axesValues[axis]!, value];
    expectError(plan(contract, snapshot), `asse "${axis}"`, value, "mapping 1:1");
  });

  it("due assi: fill di root varia con variant e size dopo l'adozione", () => {
    const snapshot = badgeWithOutline((cell) =>
      cell.variantProps!.size === "md" ? { ...cell, root: { ...cell.root, tokens: { ...cell.root.tokens, fill: "color.accent" } } } : cell,
    );
    expectError(plan(badge, snapshot), 'proprietà "fill"', 'parte "root"', "(variant, size)");
  });

  it("literal: proprietà di stile senza binding in una cella nuova", () => {
    const snapshot = badgeWithOutline((cell) => {
      if (cell.variantProps!.size !== "sm") return cell;
      const label = cell.root.children[0]!;
      const { fill: _fill, ...tokens } = label.tokens;
      return { ...cell, root: { ...cell.root, children: [{ ...label, tokens }] } };
    });
    expectError(plan(badge, snapshot), 'cella "variant=outline|size=sm"', 'layer "label"', 'proprietà di stile "fill"');
  });

  it("cella mancante in Penpot", () => {
    const snapshot = badgeWithOutline((cell) => (cell.variantProps!.size === "sm" ? null : cell));
    expectError(plan(badge, snapshot), 'manca in Penpot la cella "variant=outline|size=sm"');
  });

  it("container: nessuno dichiarante", () => {
    const snapshot = badgeWithOutline();
    snapshot.components[0]!.pluginData = null;
    expectError(plan(badge, snapshot), 'Contratto "badge"', "nessun VariantContainer");
  });

  it("container: due dichiaranti", () => {
    const snapshot = badgeWithOutline();
    snapshot.components.push({ ...snapshot.components[0]!, name: "BadgeOld" });
    expectError(plan(badge, snapshot), '"Badge", "BadgeOld"');
  });

  it("container: plugin data ≠ contractId", () => {
    const snapshot = badgeWithOutline();
    snapshot.components[0]!.pluginData = "badge@2";
    expectError(plan(badge, snapshot), '"badge@2"', 'atteso "badge@1"');
  });

  it("container: assi in ordine diverso", () => {
    const snapshot = badgeWithOutline();
    snapshot.components[0]!.axes = ["size", "variant"];
    expectError(plan(badge, snapshot), "[size, variant]", "[variant, size]");
  });

  it.each(["Outline", "out line"])("valore non valido %j → errore col pattern", (value) => {
    expectError(plan(badge, badgeWithOutline((cell) => cell, value)), `"${value}"`, "/^[a-z][a-z0-9-]*$/");
  });

  it("SCHEMA_VERSION non unica → errore, nessun file calcolato", () => {
    const sources = readSources("badge");
    const broken = { ...sources, schemaVersion: { ...sources.schemaVersion, text: `${sources.schemaVersion.text}export const SCHEMA_VERSION = ${NEXT};\n` } };
    const result = plan(badge, badgeWithOutline(), broken);
    expectError(result, "trovate 2");
    expect("files" in result).toBe(false);
  });

  it("fingerprint già oltre la versione corrente → errore, non si riscrive una voce", () => {
    const sources = readSources("badge");
    const broken = { ...sources, fingerprint: { ...sources.fingerprint, text: JSON.stringify({ ...JSON.parse(sources.fingerprint.text), [String(NEXT)]: "x" }) } };
    expectError(plan(badge, badgeWithOutline(), broken), "oltre la SCHEMA_VERSION corrente");
  });

  it("cella nuova senza il layer di una parte del contratto → errore con cella e parte", () => {
    const snapshot = badgeWithOutline((cell) =>
      cell.variantProps!.size === "sm" ? { ...cell, root: { ...cell.root, children: [] } } : cell,
    );
    expectError(plan(badge, snapshot), 'cella "variant=outline|size=sm"', 'manca la parte "label"');
  });

  it("cella nuova senza una proprietà del default senza rimozione mappata (fontWeight) → errore nominativo", () => {
    // fontWeight non dichiara `removalClass` nel registro: se l'adopt
    // scrivesse i cinque file, `render:component` fallirebbe dopo.
    const snapshot = badgeWithOutline((cell) => {
      if (cell.variantProps!.variant !== "outline") return cell;
      const label = cell.root.children[0]!;
      const { fontWeight: _t, ...tokens } = label.tokens;
      const { fontWeight: _s, ...style } = label.style;
      return { ...cell, root: { ...cell.root, children: [{ ...label, tokens, style }] } };
    });
    expectError(
      plan(badge, snapshot),
      'cella "variant=outline|size=sm"',
      'parte "label"',
      'proprietà "fontWeight"',
      "la classe di rimozione non è mappata nel registro",
    );
  });

  it("cella nuova senza una proprietà del default CON rimozione mappata (fill) → adottata, la cella scritta nel design non la ha", () => {
    const snapshot = badgeWithOutline((cell) => {
      if (cell.variantProps!.variant !== "outline") return cell;
      const { fill: _f, ...tokens } = cell.root.tokens;
      const { fill: _s, ...style } = cell.root.style;
      return { ...cell, root: { ...cell.root, tokens, style } };
    });
    const result = plan(badge, snapshot);
    expect(result.kind).toBe("adopt");
    if (result.kind === "adopt") {
      const design = JSON.parse(result.files.find((file) => file.label === "design")!.after) as ComponentDesign;
      expect(design.cells["variant=outline|size=sm"]!.root!.fill).toBeUndefined();
      expect(design.cells["variant=outline|size=md"]!.root!.fill).toBeUndefined();
      // La parte label, che non omette nulla, conserva i suoi token.
      expect(design.cells["variant=outline|size=sm"]!.label!.fill).toBeDefined();
    }
  });

  it("cella nuova senza una proprietà CON rimozione mappata solo su parte del prodotto cartesiano → errore due assi (variant, size)", () => {
    // fill ha la rimozione mappata, ma assente solo da outline/sm e presente
    // altrove varia con due assi: resta non esprimibile (compoundVariants).
    const snapshot = badgeWithOutline((cell) => {
      if (cell.variantProps!.variant !== "outline" || cell.variantProps!.size !== "sm") return cell;
      const { fill: _f, ...tokens } = cell.root.tokens;
      const { fill: _s, ...style } = cell.root.style;
      return { ...cell, root: { ...cell.root, tokens, style } };
    });
    expectError(plan(badge, snapshot), 'proprietà "fill"', 'parte "root"', "(variant, size)");
  });

  it("registry con un contratto cambiato senza bump → errore", () => {
    const sources = readSources("badge");
    const design = JSON.parse(sources.design.text) as ComponentDesign;
    const binding = BindingSchema.parse(JSON.parse(sources.binding.text));
    const components = Object.values(COMPONENT_CONTRACTS).map((c) => (c.name === "input" ? { ...c, version: 2 } : c)) as ComponentContract[];
    const result = planAdoption(badge, badgeWithOutline(), design, binding, sources, {
      components,
      sections: Object.values(SECTION_DEFINITIONS),
    });
    expectError(result, "senza bump");
  });

  it("fingerprint senza la voce della versione corrente → errore", () => {
    const sources = readSources("badge");
    const broken = { ...sources, fingerprint: { ...sources.fingerprint, text: "{}" } };
    expectError(plan(badge, badgeWithOutline(), broken), `manca la voce "${CURRENT}"`);
  });

  it("cella nuova duplicata in Penpot → errore", () => {
    const snapshot = badgeWithOutline();
    const cells = snapshot.components[0]!.cells;
    cells.push(structuredClone(cells[cells.length - 1]!));
    const duplicated = cells[cells.length - 1]!.variantProps!;
    expectError(plan(badge, snapshot), `la cella "variant=outline|size=${duplicated.size}" compare 2 volte`);
  });

  it("cella nuova con variantError → errore", () => {
    const snapshot = badgeWithOutline((cell) => (cell.variantProps!.size === "sm" ? { ...cell, variantError: "dup" } : cell));
    expectError(plan(badge, snapshot), 'cella "variant=outline|size=sm"', 'variantError "dup"');
  });

  it("cella default mancante in Penpot → errore nominativo, non confronto in silenzio", () => {
    const snapshot = badgeWithOutline();
    snapshot.components[0]!.cells = snapshot.components[0]!.cells.filter(
      (cell) => !(cell.variantProps!.variant === "default" && cell.variantProps!.size === "md"),
    );
    expectError(plan(badge, snapshot), 'manca in Penpot la cella default "variant=default|size=md"');
  });

  it("cella default duplicata in Penpot → errore nominativo", () => {
    const snapshot = badgeWithOutline();
    const cells = snapshot.components[0]!.cells;
    const defaultCell = cells.find((cell) => cell.variantProps!.variant === "default" && cell.variantProps!.size === "md")!;
    cells.push(structuredClone(defaultCell));
    expectError(plan(badge, snapshot), 'la cella default "variant=default|size=md" compare 2 volte');
  });

  it("parte ambigua: due layer con binding e lo stesso nome → errore", () => {
    const snapshot = badgeWithOutline((cell) =>
      cell.variantProps!.size === "sm" ? { ...cell, root: { ...cell.root, children: [...cell.root.children, cell.root.children[0]!] } } : cell,
    );
    expectError(plan(badge, snapshot), 'più layer con binding si chiamano "label"');
  });

  it("layer con binding che non è una parte del contratto → errore", () => {
    const icon: SnapshotLayer = { name: "icon", kind: "path", tokens: { fill: "color.primary" }, style: {}, children: [] };
    const snapshot = badgeWithOutline((cell) =>
      cell.variantProps!.size === "sm" ? { ...cell, root: { ...cell.root, children: [...cell.root.children, icon] } } : cell,
    );
    expectError(plan(badge, snapshot), 'layer "icon"', "non è una parte del contratto");
  });

  it("parte assente da design.parts → errore", () => {
    const sources = readSources("badge");
    const design = JSON.parse(sources.design.text) as { parts: Record<string, unknown> };
    delete design.parts.label;
    const broken = { ...sources, design: { ...sources.design, text: JSON.stringify(design) } };
    expectError(plan(badge, badgeWithOutline(), broken), 'la parte "label" non è nel design');
  });

  it("valore già presente nel binding → errore", () => {
    const sources = readSources("badge");
    const raw = JSON.parse(sources.binding.text) as { axes: { variant: { values: Record<string, string> } } };
    raw.axes.variant.values.outline = "outline";
    const broken = { ...sources, binding: { ...sources.binding, text: JSON.stringify(raw) } };
    expectError(plan(badge, badgeWithOutline(), broken), 'il binding ha già il valore "outline"');
  });

  it("binding senza l'asse option → errore", () => {
    const sources = readSources("badge");
    const raw = JSON.parse(sources.binding.text) as { axes: Record<string, unknown> };
    delete raw.axes.variant;
    const broken = { ...sources, binding: { ...sources.binding, text: JSON.stringify(raw) } };
    expectError(plan(badge, badgeWithOutline(), broken), 'non ha l\'asse option "variant"');
  });

  it("valore \"constructor\" (chiave del prototipo) → adottato, non scambiato per già presente", () => {
    const result = plan(badge, badgeWithOutline((cell) => cell, "constructor"));
    expect(result.kind).toBe("adopt");
    if (result.kind === "adopt") {
      const binding = JSON.parse(result.files.find((file) => file.label === "binding")!.after) as {
        axes: { variant: { values: Record<string, string> } };
      };
      expect(Object.hasOwn(binding.axes.variant.values, "constructor")).toBe(true);
    }
  });

  it("design con la cella già presente → errore, non si riscrive una voce", () => {
    const sources = readSources("badge");
    const design = JSON.parse(sources.design.text) as { cells: Record<string, unknown> };
    design.cells["variant=outline|size=sm"] = {};
    const broken = { ...sources, design: { ...sources.design, text: JSON.stringify(design) } };
    expectError(plan(badge, badgeWithOutline(), broken), 'il design ha già la cella "variant=outline|size=sm"');
  });
});

describe("sorgente del contratto via AST", () => {
  it("rispetta gli apici singoli e più assi", () => {
    const text = `defineContract({ name: 'x', axes: [{ name: 'a', values: ['p'] }, { name: 'b', values: ['q', 'r',] }] })`;
    const out = addValuesToContractSource(text, "x.ts", "x", [
      { axis: "a", values: ["s"] },
      { axis: "b", values: ["t", "u"] },
    ]);
    expect(readContractAxes(out, "x.ts", "x")).toEqual({ a: ["p", "s"], b: ["q", "r", "t", "u"] });
    expect(out).toContain("['p', 's']");
  });

  it("values non letterale → errore nominativo", () => {
    const text = `defineContract({ name: "x", axes: [{ name: "a", values: VALUES }] })`;
    expect(() => addValuesToContractSource(text, "x.ts", "x", [{ axis: "a", values: ["s"] }])).toThrow('asse "a"');
  });
});

describe("writeAdoption — tmp + rename, nessun file toccato se un tmp fallisce", () => {
  const files: AdoptionFile[] = ["a", "b", "c"].map((name) => ({ label: "design", path: `/x/${name}`, before: "", after: `${name}!` }));

  it("scrive tutti i tmp con i contenuti del piano, poi rinomina", () => {
    const calls: string[] = [];
    writeAdoption(files, {
      writeFileSync: (path, content) => calls.push(`write ${path} ${content}`),
      renameSync: (from, to) => calls.push(`rename ${from} ${to}`),
      rmSync: vi.fn(),
    });
    expect(calls.slice(0, 3).every((call) => call.startsWith("write"))).toBe(true);
    expect(calls.slice(3).every((call) => call.startsWith("rename"))).toBe(true);
    expect(calls[0]).toMatch(/^write \/x\/a\.adopt-\d+\.tmp a!$/);
    expect(calls[5]).toMatch(/^rename \/x\/c\.adopt-\d+\.tmp \/x\/c$/);
  });

  it("il terzo tmp fallisce → nessun rename, tmp già scritti rimossi", () => {
    const renameSync = vi.fn();
    const rmSync = vi.fn();
    let count = 0;
    expect(() =>
      writeAdoption(files, {
        writeFileSync: () => {
          if (++count === 3) throw new Error("disco pieno");
        },
        renameSync,
        rmSync,
      }),
    ).toThrow(/prima di toccare i file: disco pieno/);
    expect(renameSync).not.toHaveBeenCalled();
    expect(rmSync).toHaveBeenCalledTimes(2);
  });

  it("il terzo rename fallisce → errore che nomina sostituiti e invariati, tmp residui rimossi", () => {
    const rmSync = vi.fn();
    let count = 0;
    expect(() =>
      writeAdoption(files, {
        writeFileSync: vi.fn(),
        renameSync: () => {
          if (++count === 3) throw new Error("EXDEV");
        },
        rmSync,
      }),
    ).toThrow(/a metà: EXDEV.*sostituiti: \[\/x\/a, \/x\/b\].*invariati: \[\/x\/c\].*git/);
    expect(rmSync).toHaveBeenCalledTimes(1);
    expect(rmSync.mock.calls[0]![0]).toMatch(/^\/x\/c\.adopt-\d+\.tmp$/);
  });
});
