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

  it("ordine canonico delle celle (Story 2.9): l'ordine dei figli in Penpot non cambia la fixture", () => {
    const cell = (variant: string, size: string) => ({
      variantProps: { variant, size },
      variantError: null,
      root: layer("Badge", { fill: `color.${variant === "default" ? "primary" : variant}` }),
    });
    const contractOrder = [cell("default", "sm"), cell("default", "md"), cell("secondary", "sm"), cell("destructive", "md")];
    const penpotOrder = [cell("destructive", "md"), cell("secondary", "sm"), cell("default", "md"), cell("default", "sm")];
    const fromContractOrder = componentFixtureFromSnapshot("Badge", snapshotWith(badgeContainer({ cells: contractOrder })));
    const fromPenpotOrder = componentFixtureFromSnapshot("Badge", snapshotWith(badgeContainer({ cells: penpotOrder })));
    expect(JSON.stringify(fromPenpotOrder)).toBe(JSON.stringify(fromContractOrder));
    expect(fromPenpotOrder.cells.map((c) => `${c.variantProps.variant}/${c.variantProps.size}`)).toEqual([
      "default/sm",
      "default/md",
      "secondary/sm",
      "destructive/md",
    ]);
  });

  it("ordine canonico dei valori d'asse (Story 2.9): una cella ricreata in Penpot non riordina la fixture", () => {
    const penpotOrder = badgeContainer({ axesValues: { variant: ["secondary", "destructive", "default"], size: ["md", "sm"] } });
    const fixture = componentFixtureFromSnapshot("Badge", snapshotWith(penpotOrder));
    expect(fixture.axes).toEqual([
      { name: "variant", values: ["default", "secondary", "destructive"] },
      { name: "size", values: ["sm", "md"] },
    ]);
  });

  it("valori che il contratto non ha (variante non adottata): dopo quelli noti, in ordine alfabetico; due ordini Penpot → stessa fixture", () => {
    const cell = (variant: string) => ({
      variantProps: { variant, size: "sm" },
      variantError: null,
      root: layer("Badge", { fill: "color.primary" }),
    });
    const container = (variants: string[], cellOrder: string[]) =>
      badgeContainer({ axesValues: { variant: variants, size: ["sm", "md"] }, cells: cellOrder.map(cell) });
    const first = componentFixtureFromSnapshot(
      "Badge",
      snapshotWith(container(["outline", "default", "info", "secondary", "destructive"], ["outline", "secondary", "info", "default"])),
    );
    const second = componentFixtureFromSnapshot(
      "Badge",
      snapshotWith(container(["info", "destructive", "secondary", "outline", "default"], ["default", "info", "outline", "secondary"])),
    );
    expect(first.axes[0]!.values).toEqual(["default", "secondary", "destructive", "info", "outline"]);
    expect(first.cells.map((c) => c.variantProps.variant)).toEqual(["default", "secondary", "info", "outline"]);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
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

describe("componentFixtureFromSnapshot — normalizzazione di assi e valori (Story 2.8 parte B)", () => {
  it("maiuscole, spazi e ordine degli assi: la fixture è identica a quella del container già allineato", () => {
    const aligned = componentFixtureFromSnapshot("Badge", snapshotWith(badgeContainer()));
    const messy = badgeContainer();
    messy.axes = ["Size", "variant"];
    messy.axesValues = { Size: [" SM ", "md"], variant: ["default", "secondary", "destructive"] };
    for (const cell of messy.cells) {
      const { size, variant } = cell.variantProps!;
      cell.variantProps = { Size: size === "sm" ? " SM " : size!, variant: variant! };
    }
    const fixture = componentFixtureFromSnapshot("Badge", snapshotWith(messy));
    expect(fixture.axes).toEqual(aligned.axes);
    expect(fixture.cells.map((cell) => cell.variantProps)).toEqual(aligned.cells.map((cell) => cell.variantProps));
  });

  it("collisione (`SM` e `sm`) → errore nominativo, nessuna fixture", () => {
    const container = badgeContainer();
    container.axesValues = { ...container.axesValues, size: ["SM", "sm", "md"] };
    expect(() => componentFixtureFromSnapshot("Badge", snapshotWith(container))).toThrow(/asse "size".*"SM", "sm".*collisione/);
  });
});
