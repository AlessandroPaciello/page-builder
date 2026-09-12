import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";
import { describe, expect, it } from "vitest";

import { planLibrary } from "./library-plan";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import { emptySnapshot } from "./library-snapshot";
import { operationsToSteps } from "./penpot-writer";

const seed: SemanticSeed = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "semantic-tokens.seed.json"), "utf8"),
) as SemanticSeed;

const designs = {
  badge: JSON.parse(readFileSync(resolve(import.meta.dirname, "designs/badge.design.json"), "utf8")),
  input: JSON.parse(readFileSync(resolve(import.meta.dirname, "designs/input.design.json"), "utf8")),
  "accordion-item": JSON.parse(
    readFileSync(resolve(import.meta.dirname, "designs/accordion-item.design.json"), "utf8"),
  ),
};

const contracts = Object.values(COMPONENT_CONTRACTS);

function bootstrapSteps() {
  const plan = planLibrary({ mode: "bootstrap", contracts, spec: LIBRARY_SPEC, seed, designs, snapshot: emptySnapshot() });
  return operationsToSteps(plan.operations);
}

describe("operationsToSteps", () => {
  it("un'operazione per chiamata (i container in lotti piccoli: una cella + un step finale)", () => {
    const steps = bootstrapSteps();
    // 2 set + 76 token + (6+1 badge + 4+1 input + 2+1 accordion-item)
    expect(steps).toHaveLength(2 + seed.palette.length + seed.semantic.length + 15);
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
    expect(containerSteps).toHaveLength(3); // uno per contratto
    for (const step of containerSteps) {
      expect(step.code).toContain("isVariantContainer");
      expect(step.code).toContain("esiste già");
    }
  });
});
