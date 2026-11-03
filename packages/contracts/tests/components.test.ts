import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { accordionItem } from "../src/components/accordion-item";
import { badge } from "../src/components/badge";
import { checkbox } from "../src/components/checkbox";
import { chip } from "../src/components/chip";
import { input } from "../src/components/input";
import { multiselect } from "../src/components/multiselect";
import { multiselectPanel } from "../src/components/multiselect-panel";
import { multiselectTrigger } from "../src/components/multiselect-trigger";
import { option } from "../src/components/option";
import { shopCard } from "../src/components/shop-card";
import { contractId, propsSchema, type ComponentContract } from "../src/contract";
import { COMPONENT_CONTRACTS } from "../src/registry";

describe("badge@1 (ridotto, Story 2.16)", () => {
  it("ha assi option, nessun parts/partRoles, un field content", () => {
    expect(badge.name).toBe("badge");
    expect(badge.version).toBe(1);
    expect(badge.axes).toEqual([
      { name: "variant", type: "option", values: ["default", "secondary", "destructive"], default: "default" },
      { name: "size", type: "option", values: ["sm", "md"], default: "md" },
    ]);
    expect("parts" in badge).toBe(false);
    expect("partRoles" in badge).toBe(false);
    expect(Object.keys(badge.fields)).toEqual(["label"]);
    expect(badge.fields.label.kind).toBe("content");
  });

  it("valida le props, applica i default e preserva i campi ignoti", () => {
    const schema = propsSchema(badge);
    expect(schema.parse({ variant: "destructive", size: "sm", label: "Nuovo" })).toEqual({
      variant: "destructive",
      size: "sm",
      label: "Nuovo",
    });
    expect(schema.parse({ label: "x" })).toEqual({ variant: "default", size: "md", label: "x" });
    expect(schema.safeParse({ variant: "outline", label: "x" }).success).toBe(false);
    expect(schema.parse({ id: "Badge-1", label: "x", ignoto: true })).toMatchObject({ id: "Badge-1", ignoto: true });
  });
});

describe("input@1 (ridotto, Story 2.16: state nel contratto di estrazione)", () => {
  it("ha zero assi option, nessun parts/partRoles, un field content", () => {
    expect(input.name).toBe("input");
    expect(input.version).toBe(1);
    expect(input.axes).toEqual([]);
    expect("parts" in input).toBe(false);
    expect("partRoles" in input).toBe(false);
    expect(Object.keys(input.fields)).toEqual(["placeholder"]);
    expect(input.fields.placeholder.kind).toBe("content");
  });

  it("non espone lo stato come prop", () => {
    expect(Object.keys(propsSchema(input).shape)).toEqual(["placeholder"]);
  });
});

describe("accordion-item@1 (ridotto, Story 2.16: behavior nel contratto di estrazione)", () => {
  it("ha zero assi option, nessun parts/partRoles, due field content", () => {
    expect(accordionItem.name).toBe("accordion-item");
    expect(accordionItem.version).toBe(1);
    expect(accordionItem.axes).toEqual([]);
    expect("parts" in accordionItem).toBe(false);
    expect("partRoles" in accordionItem).toBe(false);
    expect(Object.keys(accordionItem.fields)).toEqual(["label", "body"]);
    expect(accordionItem.fields.label.kind).toBe("content");
    expect(accordionItem.fields.body.kind).toBe("content");
  });

  it("non espone lo stato come prop", () => {
    expect(Object.keys(propsSchema(accordionItem).shape)).toEqual(["label", "body"]);
  });
});

describe("alert@1 (ridotto, Story 2.16)", () => {
  it("ha un asse option status, nessun parts/partRoles", async () => {
    const { alert } = await import("../src/components/alert");
    expect(alert.name).toBe("alert");
    expect(alert.version).toBe(1);
    expect(alert.axes).toEqual([
      { name: "status", type: "option", values: ["info", "success", "warning", "error"], default: "info" },
    ]);
    expect("parts" in alert).toBe(false);
    expect("partRoles" in alert).toBe(false);
    expect(Object.keys(alert.fields).sort()).toEqual(["description", "heading"]);
  });
});

describe("shop-card@1 (Story 2.40, contratto dalla forma disegnata)", () => {
  it("ha un asse option, nove field content e nessuna estensione v1", () => {
    expect(shopCard.name).toBe("shop-card");
    expect(shopCard.version).toBe(1);
    expect(shopCard.axes).toEqual([{ name: "size", type: "option", values: ["default", "sm"], default: "default" }]);
    expect(Object.keys(shopCard.fields)).toEqual([
      "href",
      "image",
      "imageAlt",
      "heading",
      "description",
      "price",
      "tagLabel",
      "stockLabel",
      "ctaLabel",
    ]);
    expect("parts" in shopCard).toBe(false);
    expect("partRoles" in shopCard).toBe(false);
    for (const field of Object.values(shopCard.fields)) expect(field.kind).toBe("content");
  });

  it("valida le props: url per href e image, gli altri field sono testo obbligatorio", () => {
    const schema = propsSchema(shopCard);
    const valid = {
      href: "https://example.test/p/1",
      image: "https://example.test/a.png",
      imageAlt: "Fragole",
      heading: "Strawberry",
      description: "Desc",
      price: "$50",
      tagLabel: "Seasonal Favorite",
      stockLabel: "9 left",
      ctaLabel: "Add to cart",
    };
    expect(schema.parse(valid)).toEqual({ size: "default", ...valid });
    expect(schema.safeParse({ ...valid, image: "non-un-url" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, href: "non-un-url" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, size: "lg" }).success).toBe(false);
    for (const field of ["imageAlt", "heading", "description", "price", "tagLabel", "stockLabel", "ctaLabel"]) {
      const rest: Record<string, unknown> = { ...valid };
      delete rest[field];
      expect(schema.safeParse(rest).success, `field mancante: ${field}`).toBe(false);
    }
  });
});

describe("contratti della Multiselect (Story 2.28)", () => {
  it("multiselect: assi option size e search, i field dei figli ripetuti, nessun asse di rendering", () => {
    expect(multiselect.name).toBe("multiselect");
    expect(multiselect.version).toBe(1);
    expect(multiselect.axes).toEqual([
      { name: "size", type: "option", values: ["md", "sm"], default: "md" },
      { name: "search", type: "option", values: ["false", "true"], default: "false" },
    ]);
    expect(Object.keys(multiselect.fields)).toEqual(["helper", "placeholder", "selected", "options", "searchPlaceholder", "emptyLabel"]);
    for (const name of ["open", "display", "removable", "checked", "state"]) {
      expect(Object.keys(propsSchema(multiselect).shape)).not.toContain(name);
    }
    expect(multiselect.fields.selected.schema.safeParse([]).success).toBe(true);
    expect(multiselect.fields.options.schema.safeParse([]).success).toBe(true);
  });

  it("multiselect-trigger: size option, placeholder facoltativo, selected obbligatorio", () => {
    expect(multiselectTrigger.name).toBe("multiselect-trigger");
    expect(multiselectTrigger.axes).toEqual([{ name: "size", type: "option", values: ["md", "sm"], default: "md" }]);
    expect(Object.keys(multiselectTrigger.fields)).toEqual(["placeholder", "selected"]);
    expect(multiselectTrigger.fields.placeholder.schema.safeParse(undefined).success).toBe(true);
    expect(multiselectTrigger.fields.selected.schema.safeParse(undefined).success).toBe(false);
  });

  it("multiselect-panel: asse option search (`content` è resa)", () => {
    expect(multiselectPanel.name).toBe("multiselect-panel");
    expect(multiselectPanel.axes).toEqual([{ name: "search", type: "option", values: ["false", "true"], default: "false" }]);
    expect(Object.keys(multiselectPanel.fields)).toEqual(["options", "searchPlaceholder", "emptyLabel"]);
    expect(Object.keys(propsSchema(multiselectPanel).shape)).toEqual(["search", "options", "searchPlaceholder", "emptyLabel"]);
  });

  it("chip, option e checkbox: solo le scelte dell'editor; removable e checked restano rendering", () => {
    expect(chip.axes).toEqual([{ name: "size", type: "option", values: ["md", "sm"], default: "md" }]);
    expect(Object.keys(chip.fields)).toEqual(["label"]);
    expect(option.axes).toEqual([]);
    expect(Object.keys(option.fields)).toEqual(["label"]);
    expect(checkbox.axes).toEqual([]);
    expect(checkbox.fields).toEqual({});
    for (const contract of [chip, option, checkbox]) {
      expect(Object.keys(propsSchema(contract).shape)).not.toContain("removable");
      expect(Object.keys(propsSchema(contract).shape)).not.toContain("checked");
    }
  });
});

describe("registry e contractId", () => {
  it("ogni file in src/components/ è nel registry con chiave = nome, e il registry non ha altro", async () => {
    const dir = resolve(import.meta.dirname, "../src/components");
    const files = readdirSync(dir)
      .filter((entry) => entry.endsWith(".ts"))
      .sort();
    expect(files.length).toBeGreaterThan(0);
    const registered = COMPONENT_CONTRACTS as Readonly<Record<string, ComponentContract>>;
    for (const file of files) {
      const name = file.replace(/\.ts$/, "");
      const module = (await import(/* @vite-ignore */ pathToFileURL(resolve(dir, file)).href)) as Record<string, unknown>;
      const exported = Object.values(module).filter(
        (value): value is ComponentContract =>
          typeof value === "object" && value !== null && "name" in value && "axes" in value,
      );
      expect(exported, `src/components/${file}: nessun contratto esportato`).toHaveLength(1);
      expect(exported[0]!.name, `src/components/${file}: il nome del contratto ≠ nome del file`).toBe(name);
      expect(registered[name], `src/components/${file}: il contratto "${name}" non è nel registry`).toBe(exported[0]);
    }
    // Ordino i nomi senza estensione: con l'estensione `multiselect-panel.ts` precede `multiselect.ts` (`-` < `.`).
    expect(Object.keys(COMPONENT_CONTRACTS).sort()).toEqual(files.map((file) => file.replace(/\.ts$/, "")).sort());
    for (const [name, contract] of Object.entries(COMPONENT_CONTRACTS)) expect(contract.name).toBe(name);
  });

  it("un nome prefisso di un altro (multiselect / multiselect-panel) resta due contratti distinti", () => {
    expect(Object.hasOwn(COMPONENT_CONTRACTS, "multiselect")).toBe(true);
    expect(Object.hasOwn(COMPONENT_CONTRACTS, "multiselect-panel")).toBe(true);
    expect(contractId(COMPONENT_CONTRACTS["multiselect"]!)).toBe("multiselect@1");
    expect(contractId(COMPONENT_CONTRACTS["multiselect-panel"]!)).toBe("multiselect-panel@1");
    expect(COMPONENT_CONTRACTS["multiselect"]).not.toBe(COMPONENT_CONTRACTS["multiselect-panel"]);
  });

  it("produce il formato nome@versione del plugin data Penpot", () => {
    expect(contractId(badge)).toBe("badge@1");
    expect(contractId(input)).toBe("input@1");
    expect(contractId(accordionItem)).toBe("accordion-item@1");
    expect(contractId(shopCard)).toBe("shop-card@1");
  });
});
