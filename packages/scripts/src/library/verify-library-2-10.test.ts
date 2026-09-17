import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { legacyContracts } from "../extract/component-reader";
import { PATHS } from "../shared/paths";
import { committedDesigns } from "./designs-loader";
import type { ComponentDesign } from "./library-plan";
import { parseLibrarySnapshot } from "./library-reader";
import { LIBRARY_SPEC } from "./library-spec";
import type { LibrarySnapshot, SnapshotLayer } from "./library-snapshot";
import { verifyLibrary } from "./verify-library";

/**
 * Prova rosso/verde dei controlli nuovi di `verify:library` (Story 2.10) sullo
 * snapshot committato della library (i token "live" dell'ultima lettura):
 * proprietà fuori ruolo (A), `design-drift` (C), regola 10 per componente (B).
 */

const contracts = legacyContracts();
const snapshot = (): LibrarySnapshot => parseLibrarySnapshot(JSON.parse(readFileSync(PATHS.librarySnapshotPath, "utf8")));

function verify(input: LibrarySnapshot, designs?: Record<string, ComponentDesign>) {
  return verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot: input, ...(designs ? { designs } : {}) });
}

function verdict(result: ReturnType<typeof verify>, component: string) {
  return result.components.find((entry) => entry.component === component)!;
}

/** Il layer `name` della cella di `component` con `axis=value`. */
function layerOf(input: LibrarySnapshot, component: string, axis: string, value: string, name: string): SnapshotLayer {
  const cell = input.components.find((entry) => entry.name === component)!.cells.find((entry) => entry.variantProps?.[axis] === value)!;
  if (name === "root") return cell.root;
  const found: SnapshotLayer[] = [];
  const visit = (layer: SnapshotLayer): void => {
    if (layer.name === name) found.push(layer);
    layer.children.forEach(visit);
  };
  visit(cell.root);
  return found[0]!;
}

describe("verify:library sullo snapshot committato — verde", () => {
  it("4 componenti ok, nessun rosso, regola 10 per componente verde sui token live", () => {
    const result = verify(snapshot());
    expect(result.errors).toEqual([]);
    expect(result.components.map((entry) => [entry.component, entry.status])).toEqual([
      ["Badge", "ok"],
      ["Input", "ok"],
      ["AccordionItem", "ok"],
      ["Alert", "ok"],
    ]);
  });
});

describe("proprietà fuori ruolo (Story 2.10, A)", () => {
  it("strokeColor al posto del fill sull'heading di Alert → solo Alert in attesa, kind property-outside-role, messaggio nominativo", () => {
    const input = snapshot();
    const heading = layerOf(input, "Alert", "status", "warning", "heading");
    heading.tokens = { ...heading.tokens, strokeColor: heading.tokens.fill! };
    delete heading.tokens.fill;
    heading.style = { ...heading.style, strokeColor: heading.style.fill };
    delete heading.style.fill;
    const result = verify(input);
    const alert = verdict(result, "Alert");
    expect(alert.status).toBe("pending");
    expect(alert.problems).toEqual([
      expect.objectContaining({
        severity: "pending",
        kind: "property-outside-role",
        message: expect.stringContaining(
          `componente "Alert", cella "status=warning", parte "heading", ruolo "text", proprietà "strokeColor", token "color.warning"`,
        ),
      }),
    ]);
    expect(alert.problems[0]!.message).toMatch(/1\) designer.*2\) sviluppatore.*3\) sviluppatore.*pnpm role:part -- Alert heading/);
    for (const other of ["Badge", "Input", "AccordionItem"]) expect(verdict(result, other).status).toBe("ok");
    expect(result.ok).toBe(true);
  });
});

describe("design-drift (Story 2.10, C)", () => {
  it("design uguale alle celle live → Alert ok; una cella diversa → Alert in attesa con kind design-drift e sync:design", () => {
    const designs = committedDesigns();
    const aligned = structuredClone(designs);
    const warning = aligned.alert!.cells["status=warning"] as Record<string, Record<string, string>>;
    warning.description = { ...warning.description, fill: "color.card-foreground" };
    expect(verdict(verify(snapshot(), aligned), "Alert").status).toBe("ok");

    const drifted = structuredClone(aligned);
    (drifted.alert!.cells["status=warning"] as Record<string, Record<string, string>>).description!.fill = "color.muted-foreground";
    const result = verify(snapshot(), drifted);
    const alert = verdict(result, "Alert");
    expect(alert.status).toBe("pending");
    expect(alert.problems).toEqual([
      expect.objectContaining({
        severity: "pending",
        kind: "design-drift",
        message: expect.stringMatching(
          /cella "status=warning".*parte "description", proprietà "fill": design "color.muted-foreground" ≠ Penpot "color.card-foreground".*pnpm sync:design -- Alert/,
        ),
      }),
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("regola 10 per componente sui token live (Story 2.10, B)", () => {
  it("rosso: Alert status=warning con la root su color.muted-foreground (1.82:1) → voce Alert rossa, kind contrast; le altre ok", () => {
    const input = snapshot();
    layerOf(input, "Alert", "status", "warning", "root").tokens.fill = "color.muted-foreground";
    const result = verify(input);
    const alert = verdict(result, "Alert");
    expect(alert.status).toBe("red");
    expect(alert.problems.every((problem) => problem.kind === "contrast")).toBe(true);
    const messages = alert.problems.map((problem) => problem.message);
    expect(messages).toContainEqual(
      expect.stringMatching(
        /cella "status=warning": contrasto della parte "description" \(text, fill color.card-foreground\) su "root" \(surface, fill color.muted-foreground\): 1\.82:1 < soglia 4\.5:1/,
      ),
    );
    expect(messages).toContainEqual(expect.stringMatching(/parte "heading" \(text, fill color.warning\).*1\.93:1 < soglia 4\.5:1/));
    for (const other of ["Badge", "Input", "AccordionItem"]) expect(verdict(result, other).status).toBe("ok");
    // Le coppie di catalogo restano una riga globale, verde.
    expect(result.global.find((entry) => entry.component === "regola 10 — contrasto")!.status).toBe("ok");
  });

  it("icona: strokeColor dello chevron contro la surface antenata con fill (3:1), saltando il trigger senza fill", () => {
    const input = snapshot();
    const chevron = layerOf(input, "AccordionItem", "state", "closed", "chevron");
    chevron.tokens.strokeColor = "color.card";
    const result = verify(input);
    expect(verdict(result, "AccordionItem").problems).toEqual([
      expect.objectContaining({
        kind: "contrast",
        message: expect.stringMatching(/parte "chevron" \(icon, strokeColor color.card\) su "root" \(surface, fill color.card\): 1\.00:1 < soglia 3:1/),
      }),
    ]);
  });

  it("senza surface antenata con fill ripiega sulla pagina (color.background); token non colore → rosso nominativo", () => {
    const input = snapshot();
    const root = layerOf(input, "Alert", "status", "info", "root");
    delete root.tokens.fill;
    delete root.style.fill;
    layerOf(input, "Alert", "status", "info", "heading").tokens.fill = "spacing.1";
    const messages = verdict(verify(input), "Alert").problems.map((problem) => problem.message);
    expect(messages).toContainEqual(expect.stringMatching(/parte "heading" \(text, fill spacing.1\) sulla pagina \(color.background\): valore non risolvibile/));
  });
});
