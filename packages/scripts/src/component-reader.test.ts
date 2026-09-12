import { describe, expect, it } from "vitest";

import { componentFixtureFromSnapshot } from "./component-reader";
import { emptySnapshot, type LibrarySnapshot, type SnapshotLayer, type SnapshotComponent } from "./library/library-snapshot";

/**
 * Test sul lettore di componente (Story 2.5): snapshot → fixture. Zero rete:
 * lo snapshot è costruito in memoria (stesso contratto di library-snapshot.ts,
 * la forma che `readLibrarySnapshot` produce live).
 */

function layer(name: string, tokens: Record<string, string>, children: SnapshotLayer[] = []): SnapshotLayer {
  return {
    name,
    kind: name === "label" ? "text" : "board",
    tokens,
    style: Object.fromEntries(Object.keys(tokens).map((property) => [property, "<valore>"])),
    children,
  };
}

function badgeContainer(overrides: Partial<SnapshotComponent> = {}): SnapshotComponent {
  return {
    id: "container-badge",
    name: "Badge",
    pluginData: "badge@1",
    axes: ["variant", "size"],
    axesValues: { variant: ["default", "secondary", "destructive"], size: ["sm", "md"] },
    cells: [
      {
        variantProps: { variant: "default", size: "sm" },
        variantError: null,
        root: layer("Badge", { fill: "color.primary", paddingTop: "spacing.1" }, [
          layer("label", { fill: "color.primary-foreground", fontSize: "text.xs" }),
        ]),
      },
      {
        variantProps: { variant: "secondary", size: "sm" },
        variantError: null,
        root: layer("Badge", { fill: "color.secondary", paddingTop: "spacing.1" }, [
          layer("label", { fill: "color.secondary-foreground", fontSize: "text.xs" }),
        ]),
      },
    ],
    ...overrides,
  };
}

function snapshotWith(...components: SnapshotComponent[]): LibrarySnapshot {
  const snapshot = emptySnapshot();
  snapshot.components.push(...components);
  return snapshot;
}

describe("componentFixtureFromSnapshot", () => {
  it("assembla la fixture dal plugin data e da shape.tokens", () => {
    const fixture = componentFixtureFromSnapshot("Badge", snapshotWith(badgeContainer()));
    expect(fixture.componentName).toBe("Badge");
    expect(fixture.contract).toBe("badge@1");
    expect(fixture.penpotComponentId).toBe("container-badge");
    expect(fixture.axes).toEqual([
      { name: "variant", values: ["default", "secondary", "destructive"] },
      { name: "size", values: ["sm", "md"] },
    ]);
    expect(fixture.cells).toHaveLength(2);
    const cell = fixture.cells.find((c) => c.variantProps.variant === "default")!;
    expect(cell.root.tokens).toEqual({ fill: "color.primary", paddingTop: "spacing.1" });
    expect(cell.root.children[0]!.tokens).toEqual({ fill: "color.primary-foreground", fontSize: "text.xs" });
  });

  it("non cerca per prefisso: un container chiamato 'Badge / Default' non è il container del contratto", () => {
    // Nella library verificata il nome del container è il PascalCase esatto
    // del contratto (regola 2 di verifyLibrary): un nome con separatore di
    // variante è legacy e non deve matchare.
    const snapshot = snapshotWith(badgeContainer({ name: "Badge / Default" }));
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(/Contratto senza container/);
  });

  it("AC #1 — fallisce su contratto duplicato (due container dichiarano lo stesso contratto)", () => {
    const snapshot = snapshotWith(badgeContainer(), badgeContainer({ id: "container-badge-2", name: "BadgeDue" }));
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(
      /Contratto "badge".*2 container lo dichiarano[\s\S]*"Badge"[\s\S]*"BadgeDue"/,
    );
  });

  it("AC #1 — fallisce su nome incoerente (container ≠ PascalCase del contratto)", () => {
    const snapshot = snapshotWith(badgeContainer({ name: "badge" }));
    expect(() => componentFixtureFromSnapshot("badge", snapshot)).toThrow(
      /Nome incoerente.*"badge".*atteso "Badge"/,
    );
  });

  it("AC #1 — fallisce su contratto senza container (nessun container col nome richiesto)", () => {
    expect(() => componentFixtureFromSnapshot("Input", snapshotWith(badgeContainer()))).toThrow(
      /Contratto senza container.*"Input"/,
    );
  });

  it("fallisce su un container col nome giusto ma senza plugin data", () => {
    const snapshot = snapshotWith(badgeContainer({ pluginData: null }));
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(
      /"Badge".*nessun plugin data pagebuilder\/contract/,
    );
  });

  it("fallisce su un plugin data malformato (senza versione)", () => {
    const snapshot = snapshotWith(badgeContainer({ pluginData: "badge" }));
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(/malformato.*"badge"/);
  });

  it("fallisce su un contratto non noto in @app/contracts", () => {
    const snapshot = snapshotWith(badgeContainer({ pluginData: "widget@1" }));
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(
      /"widget".*non esiste in @app\/contracts/,
    );
  });

  it("fallisce su una versione incoerente col contratto (badge@2)", () => {
    const snapshot = snapshotWith(badgeContainer({ pluginData: "badge@2" }));
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(/"badge@2".*atteso "badge@1"/);
  });

  it("fallisce su una board non mappata alle varianti (variantProps null)", () => {
    const snapshot = snapshotWith(
      badgeContainer({
        cells: [...badgeContainer().cells, { variantProps: null, variantError: null, root: layer("Orfana", {}) }],
      }),
    );
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(
      /board "Orfana".*non è mappata alle varianti/,
    );
  });

  it("fallisce su una cella con variantError (matrice varianti incoerente)", () => {
    const snapshot = snapshotWith(
      badgeContainer({
        cells: [{ ...badgeContainer().cells[0]!, variantError: "duplicate" }],
      }),
    );
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(/variantError "duplicate"/);
  });

  it("fallisce su un asse senza valori (fixture malformata, nominando il campo)", () => {
    const snapshot = snapshotWith(badgeContainer({ axesValues: { variant: [], size: ["sm", "md"] } }));
    expect(() => componentFixtureFromSnapshot("Badge", snapshot)).toThrow(/FixtureSchema[\s\S]*values/);
  });
});
