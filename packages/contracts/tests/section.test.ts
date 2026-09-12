import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SECTION_DEFINITIONS } from "../src/registry";
import { type SectionDefinition, type SectionNode, SectionDefinitionSchema, validateSectionDefinition } from "../src/section";
import { accordion } from "../src/sections/accordion";

/** Sezione di test con `max: 1`, per non dipendere dall'Accordion (che non ha `max`). */
function demoList(overrides: Partial<SectionDefinition> = {}): SectionDefinition {
  return {
    name: "demo-list",
    version: 1,
    fields: { dense: { schema: z.boolean().default(false), kind: "structure" } },
    root: {
      id: "root",
      component: "demo-list",
      props: {},
      slot: "items",
      children: [{ id: "b1", component: "badge", props: { label: "Uno" } }],
    },
    slots: [{ id: "items", allow: ["badge"], max: 1 }],
    ...overrides,
  };
}

function errorsOf(def: unknown): string[] {
  const result = validateSectionDefinition(def);
  if (result.valid) throw new Error("attesa una definizione non valida");
  return result.errors;
}

describe("Accordion Root", () => {
  it("è una definizione di sezione valida", () => {
    expect(validateSectionDefinition(accordion)).toEqual({ valid: true });
    expect(SectionDefinitionSchema.safeParse(accordion).success).toBe(true);
  });

  it("ha il field type structure e lo slot items aperto ad accordion-item senza max", () => {
    expect(accordion.name).toBe("accordion");
    expect(accordion.version).toBe(1);
    expect(accordion.fields.type?.kind).toBe("structure");
    expect(accordion.fields.type?.schema.parse(undefined)).toBe("single");
    expect(accordion.fields.type?.schema.safeParse("multiple").success).toBe(true);
    expect(accordion.slots).toEqual([{ id: "items", allow: ["accordion-item"] }]);
    expect(accordion.root.component).toBe("accordion");
    expect(accordion.root.slot).toBe("items");
    expect(accordion.root.children?.map((child) => child.component)).toEqual(["accordion-item", "accordion-item"]);
  });

  it("è elencata nel registry delle sezioni", () => {
    expect(SECTION_DEFINITIONS).toEqual({ accordion });
  });

  it("ogni sezione del registry è valida (iterazione, come il classifier)", () => {
    for (const section of Object.values(SECTION_DEFINITIONS)) {
      expect(validateSectionDefinition(section), `sezione "${section.name}"`).toEqual({ valid: true });
    }
  });
});

describe("validateSectionDefinition", () => {
  it("accetta la sezione di test", () => {
    expect(validateSectionDefinition(demoList())).toEqual({ valid: true });
  });

  it("rifiuta una forma non valida senza lanciare", () => {
    expect(errorsOf({ name: "Demo", version: 0 }).join("\n")).toMatch(/name|version/);
  });

  it("nomina il componente ignoto", () => {
    const def = demoList();
    def.root.children = [{ id: "c1", component: "carousel", props: {} }];
    def.slots = [{ id: "items", allow: ["badge"] }];
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*nodo "c1".*componente "carousel"/);
  });

  it("nomina le props non valide di un nodo", () => {
    const errors = errorsOf({
      ...accordion,
      root: { ...accordion.root, children: [{ id: "i1", component: "accordion-item", props: { body: "x" } }] },
    });
    expect(errors.join("\n")).toMatch(/accordion.*nodo "i1".*label/);
  });

  it("nomina le props non valide del nodo sezione", () => {
    const errors = errorsOf({ ...accordion, root: { ...accordion.root, props: { type: "tutti" } } });
    expect(errors.join("\n")).toMatch(/accordion.*nodo "root".*type/);
  });

  it("nomina l'id di nodo duplicato", () => {
    const def = demoList({ slots: [{ id: "items", allow: ["badge"] }] });
    def.root.children = [
      { id: "b1", component: "badge", props: { label: "Uno" } },
      { id: "b1", component: "badge", props: { label: "Due" } },
    ];
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*id di nodo "b1" duplicato/);
  });

  it("nomina l'id di slot duplicato", () => {
    const def = demoList({ slots: [{ id: "items", allow: ["badge"] }, { id: "items", allow: ["input"] }] });
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*slot "items" duplicato/);
  });

  it("nomina un allow verso un contratto inesistente", () => {
    const def = demoList({ slots: [{ id: "items", allow: ["badge", "tooltip"] }] });
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*slot "items".*allow.*"tooltip"/);
  });

  it("nomina il figlio fuori allow", () => {
    const def = demoList();
    def.root.children = [{ id: "i1", component: "input", props: { placeholder: "x" } }];
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*nodo "i1".*"input".*non è in allow.*slot "items"/);
  });

  it("nomina i figli oltre max", () => {
    const def = demoList();
    def.root.children = [
      { id: "b1", component: "badge", props: { label: "Uno" } },
      { id: "b2", component: "badge", props: { label: "Due" } },
    ];
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*slot "items".*2 figli.*max 1/);
  });

  it("nomina lo slot che punta a uno SlotDef inesistente", () => {
    const def = demoList();
    def.root.slot = "elementi";
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*nodo "root".*slot "elementi".*non dichiarato/);
  });

  it("nomina i figli di un nodo senza slot", () => {
    const def = demoList();
    def.root.children = [
      { id: "b1", component: "badge", props: { label: "Uno" }, children: [{ id: "b2", component: "badge", props: {} }] },
    ];
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*nodo "b1".*figli.*senza slot/);
  });

  it("richiede che il nodo sezione porti il nome della sezione", () => {
    const def = demoList();
    def.root.component = "badge";
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*nodo "root".*"demo-list"/);
  });

  it("rifiuta una sezione con il nome di un contratto di componente", () => {
    const def = demoList({ name: "badge" });
    def.root.component = "badge";
    expect(errorsOf(def).join("\n")).toMatch(/badge.*collide.*contratto/);
  });

  it("rifiuta una chiave sconosciuta o con typo nelle definizioni (strict)", () => {
    // Oggetto non tipizzato: il typo arriva a validateSectionDefinition come
    // dati (es. da un JSON), dove il controllo meccanico è lo schema strict.
    const def = { ...demoList(), slots: [{ id: "items", allow: ["badge"], maxx: 1 }] };
    expect(errorsOf(def).join("\n")).toMatch(/demo-list.*maxx|demo-list.*Unrecognized key|demo-list.*riconosciut/i);
  });

  it("non lancia su un albero patologicamente annidato: segnala la profondità", () => {
    let node: SectionNode = { id: "foglia", component: "badge", props: { label: "x" } };
    for (let i = 0; i < 150; i++) {
      node = { id: `n-${i}`, component: "badge", props: { label: "x" }, children: [node] };
    }
    const def = demoList();
    def.root.children = [node];
    def.slots = [{ id: "items", allow: ["badge"] }];
    const errors = errorsOf(def);
    expect(errors.join("\n")).toMatch(/più profondo di 100 livelli/);
  });
});
