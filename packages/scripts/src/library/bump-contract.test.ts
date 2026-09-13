import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { COMPONENT_CONTRACTS, type ComponentContract } from "@app/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { main, parseBumpArgs, resolveContract } from "./bump-cli";
import { bumpStep, planBump } from "./bump-contract";
import type { LibrarySnapshot, SnapshotComponent } from "./library-snapshot";

const badge2 = { ...COMPONENT_CONTRACTS.badge, version: 2 } as ComponentContract;
const contracts = Object.values(COMPONENT_CONTRACTS).map((c) => (c.name === "badge" ? badge2 : c));

function container(name: string, pluginData: string | null): SnapshotComponent {
  return { id: `id-${name}`, name, pluginData, axes: ["variant", "size"], axesValues: {}, cells: [] };
}

function snapshotWith(...components: SnapshotComponent[]): LibrarySnapshot {
  return { sets: [], componentCount: components.length, components };
}

describe("planBump", () => {
  it("container a badge@1, contratto a version 2 → aggiorna badge@1 → badge@2", () => {
    expect(planBump(badge2, snapshotWith(container("Badge", "badge@1")))).toEqual({
      kind: "update",
      contract: "badge",
      containerName: "Badge",
      from: "badge@1",
      to: "badge@2",
    });
  });

  it("plugin data già = contractId → nulla da fare", () => {
    const plan = planBump(badge2, snapshotWith(container("Badge", "badge@2")));
    expect(plan.kind).toBe("nothing");
    if (plan.kind === "nothing") expect(plan.message).toContain('"badge@2"');
  });

  it("versione in Penpot ≥ di quella del contratto → errore, niente downgrade", () => {
    const plan = planBump(badge2, snapshotWith(container("Badge", "badge@3")));
    expect(plan.kind).toBe("error");
    if (plan.kind === "error") expect(plan.message).toMatch(/"badge@3".*"badge@2".*niente downgrade/);
  });

  it("nessun container dichiarante → errore che spiega la rinomina e non suggerisce add:library", () => {
    const plan = planBump(badge2, snapshotWith(container("Label", "label@1")));
    expect(plan.kind).toBe("error");
    if (plan.kind === "error") {
      expect(plan.message).toContain('Contratto "badge"');
      expect(plan.message).toContain("non è un bump");
      expect(plan.message).toContain("regola 11");
      expect(plan.message).not.toContain("add:library");
    }
  });

  it("due container dichiaranti → errore che li nomina", () => {
    const plan = planBump(badge2, snapshotWith(container("Badge", "badge@1"), container("BadgeOld", "badge@1")));
    expect(plan.kind).toBe("error");
    if (plan.kind === "error") expect(plan.message).toContain('"Badge", "BadgeOld"');
  });

  it.each(["badge@x", "badge@01", "badge@1.0", "badge@0x2", "badge@", "badge@0", "badge@-1", "badge@ 1"])(
    "plugin data malformato %s → errore \"malformato\" nominativo, non un downgrade",
    (pluginData) => {
      const plan = planBump(badge2, snapshotWith(container("Badge", pluginData)));
      expect(plan.kind).toBe("error");
      if (plan.kind === "error") {
        expect(plan.message).toContain(`malformato "${pluginData}"`);
        expect(plan.message).not.toContain("downgrade");
      }
    },
  );
});

describe("bumpStep — il codice generato eseguito su un container finto", () => {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
    ...args: string[]
  ) => (...params: unknown[]) => Promise<unknown>;

  function fakeContainer(name: string, initial: string) {
    const writes: string[] = [];
    let value = initial;
    return {
      name,
      writes,
      isVariantContainer: () => true,
      getSharedPluginData: () => value,
      setSharedPluginData: (_ns: string, _key: string, next: string) => {
        writes.push(next);
        value = next;
      },
    };
  }

  function run(code: string, containers: Array<ReturnType<typeof fakeContainer>>) {
    const penpotUtils = { findShapes: (predicate: (s: unknown) => boolean) => containers.filter(predicate) };
    return new AsyncFunction("penpotUtils", "penpot", code)(penpotUtils, {});
  }

  const plan = { kind: "update", contract: "badge", containerName: "Badge", from: "badge@1", to: "badge@2" } as const;

  it("scrive il nuovo contractId e restituisce il valore riletto", async () => {
    const badge = fakeContainer("Badge", "badge@1");
    await expect(run(bumpStep(plan).code, [badge])).resolves.toEqual({ container: "Badge", pluginData: "badge@2" });
    expect(badge.writes).toEqual(["badge@2"]);
  });

  it("valore live cambiato dopo la lettura → errore con atteso e trovato, nessuna scrittura", async () => {
    const badge = fakeContainer("Badge", "badge@3");
    // Il filtro per nome del contratto trova comunque il container: la guardia è sul valore.
    await expect(run(bumpStep(plan).code, [badge])).rejects.toThrow(/atteso "badge@1", trovato "badge@3"/);
    expect(badge.writes).toEqual([]);
  });

  it("0 o 2 container → errore, nessuna scrittura", async () => {
    await expect(run(bumpStep(plan).code, [])).rejects.toThrow(/trovati 0/);
    const a = fakeContainer("Badge", "badge@1");
    const b = fakeContainer("BadgeOld", "badge@1");
    await expect(run(bumpStep(plan).code, [a, b])).rejects.toThrow(/trovati 2/);
    expect([...a.writes, ...b.writes]).toEqual([]);
  });
});

describe("bump-cli", () => {
  it("parseBumpArgs: componente, --yes / --dry-run alternativi, --snapshot solo in lettura", () => {
    expect(parseBumpArgs(["--", "Badge"])).toEqual({ component: "Badge", yes: false, snapshotPath: undefined });
    expect(parseBumpArgs(["badge", "--dry-run"])).toEqual({ component: "badge", yes: false, snapshotPath: undefined });
    expect(parseBumpArgs(["badge", "--yes"])).toEqual({ component: "badge", yes: true, snapshotPath: undefined });
    expect(parseBumpArgs(["badge", "--snapshot", "/tmp/s.json"]).snapshotPath).toBe("/tmp/s.json");
    expect(() => parseBumpArgs([])).toThrow(/Componente mancante/);
    expect(() => parseBumpArgs(["badge", "--yes", "--dry-run"])).toThrow(/alternativi/);
    expect(() => parseBumpArgs(["badge", "--yes", "--snapshot", "/tmp/s.json"])).toThrow(/solo senza --yes/);
    expect(() => parseBumpArgs(["badge", "--force"])).toThrow(/--force/);
    expect(() => parseBumpArgs(["badge", "input"])).toThrow(/Un solo componente/);
  });

  it("resolveContract accetta Badge o badge e nomina i contratti se non trova", () => {
    expect(resolveContract("Badge", contracts).name).toBe("badge");
    expect(resolveContract("accordion-item", contracts).name).toBe("accordion-item");
    expect(() => resolveContract("Alert", contracts)).toThrow(/"Alert" non trovato.*badge/);
  });

  describe("main", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const envelope = (result: unknown) => ({ content: [{ type: "text", text: JSON.stringify({ result }) }] });

    /** Transport finto: legge lo snapshot; la scrittura aggiorna il plugin data solo se `applyWrites`. */
    function transport(applyWrites: boolean) {
      const state = snapshotWith(container("Badge", "badge@1"));
      const writes: string[] = [];
      const callTool = async (args: { name: string; arguments: { code: string } }) => {
        if (args.arguments.code.includes("setSharedPluginData")) {
          writes.push(args.arguments.code);
          if (applyWrites) state.components[0]!.pluginData = "badge@2";
          return envelope({ container: "Badge", pluginData: "badge@2" });
        }
        return envelope(state);
      };
      return { callTool, writes };
    }

    it("senza --yes stampa badge@1 → badge@2, non scrive, exit 0", async () => {
      const { callTool, writes } = transport(true);
      expect(await main({ component: "Badge", yes: false }, { contracts, callTool })).toBe(0);
      expect(writes).toEqual([]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("badge@1 → badge@2"));
    });

    it("con --yes scrive e la rilettura è verde → exit 0", async () => {
      const { callTool, writes } = transport(true);
      expect(await main({ component: "Badge", yes: true }, { contracts, callTool })).toBe(0);
      expect(writes).toHaveLength(1);
    });

    it("con --yes e un transport che ignora la scrittura → exit 1", async () => {
      const { callTool, writes } = transport(false);
      expect(await main({ component: "Badge", yes: true }, { contracts, callTool })).toBe(1);
      expect(writes).toHaveLength(1);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('trovato "badge@1"'));
    });

    it("nulla da fare → exit 0 senza scrittura; errore del piano → exit 1", async () => {
      const { callTool, writes } = transport(true);
      expect(await main({ component: "Input", yes: true }, { contracts, callTool })).toBe(1); // nessun container Input
      expect(await main({ component: "Badge", yes: true }, { contracts: Object.values(COMPONENT_CONTRACTS), callTool })).toBe(0);
      expect(writes).toEqual([]);
    });

    it("--snapshot legge da file, senza transport", async () => {
      const dir = mkdtempSync(join(tmpdir(), "bump-"));
      const path = join(dir, "snapshot.json");
      writeFileSync(path, JSON.stringify(snapshotWith(container("Badge", "badge@1"))));
      expect(await main({ component: "badge", yes: false, snapshotPath: path }, { contracts })).toBe(0);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("badge@1 → badge@2"));
    });
  });
});
