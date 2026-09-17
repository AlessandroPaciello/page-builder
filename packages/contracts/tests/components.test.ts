import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { accordionItem } from "../src/components/accordion-item";
import { badge } from "../src/components/badge";
import { input } from "../src/components/input";
import { productCard } from "../src/components/product-card";
import { contractId, propsSchema, type ComponentContract } from "../src/contract";
import { COMPONENT_CONTRACTS } from "../src/registry";

describe("badge@1", () => {
  it("ha assi, tipi, valori, default e parti del prototipo", () => {
    expect(badge.name).toBe("badge");
    expect(badge.version).toBe(1);
    expect(badge.axes).toEqual([
      { name: "variant", type: "option", values: ["default", "secondary", "destructive"], default: "default" },
      { name: "size", type: "option", values: ["sm", "md"], default: "md" },
    ]);
    expect(badge.parts).toEqual(["root", "label"]);
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

describe("input@1", () => {
  it("ha solo l'asse state di tipo state", () => {
    expect(input.name).toBe("input");
    expect(input.version).toBe(1);
    expect(input.axes).toEqual([
      { name: "state", type: "state", values: ["default", "focus", "error", "disabled"], default: "default" },
    ]);
    expect(input.parts).toEqual(["root", "placeholder"]);
    expect(Object.keys(input.fields)).toEqual(["placeholder"]);
    expect(input.fields.placeholder.kind).toBe("content");
  });

  it("non espone lo stato come prop", () => {
    expect(Object.keys(propsSchema(input).shape)).toEqual(["placeholder"]);
  });
});

describe("accordion-item@1", () => {
  it("ha l'asse state di tipo behavior e parti piatte", () => {
    expect(accordionItem.name).toBe("accordion-item");
    expect(accordionItem.version).toBe(1);
    expect(accordionItem.axes).toEqual([
      { name: "state", type: "behavior", values: ["closed", "open"], default: "closed" },
    ]);
    expect(accordionItem.parts).toEqual(["root", "trigger", "label", "chevron", "content", "body", "divider"]);
    expect(Object.keys(accordionItem.fields)).toEqual(["label", "body"]);
    expect(accordionItem.fields.label.kind).toBe("content");
    expect(accordionItem.fields.body.kind).toBe("content");
  });

  it("non espone lo stato come prop", () => {
    expect(Object.keys(propsSchema(accordionItem).shape)).toEqual(["label", "body"]);
  });
});

describe("product-card@1 (Story 2.12, primo contratto ridotto)", () => {
  it("ha un solo asse option, sei field e nessuna estensione v1", () => {
    expect(productCard.name).toBe("product-card");
    expect(productCard.version).toBe(1);
    expect(productCard.axes).toEqual([
      { name: "promo", type: "option", values: ["none", "offer", "discount"], default: "none" },
    ]);
    expect(Object.keys(productCard.fields)).toEqual(["image", "price", "description", "tags", "href", "badgeLabel"]);
    expect("parts" in productCard).toBe(false);
    expect("partRoles" in productCard).toBe(false);
    for (const field of Object.values(productCard.fields)) expect(field.kind).toBe("content");
  });

  it("valida le props: url per image e href, array di stringhe per tags, badgeLabel testo dell'editor", () => {
    const schema = propsSchema(productCard);
    const valid = {
      image: "https://example.test/a.png",
      price: "9,90 €",
      description: "Desc",
      tags: ["nuovo", "bio"],
      href: "https://example.test/p/1",
      badgeLabel: "Offerta",
    };
    expect(schema.parse(valid)).toEqual({ promo: "none", ...valid });
    expect(schema.safeParse({ ...valid, image: "non-un-url" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, tags: "bio" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, promo: "sale" }).success).toBe(false);
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
    expect(Object.keys(COMPONENT_CONTRACTS).sort()).toEqual(files.map((file) => file.replace(/\.ts$/, "")));
    for (const [name, contract] of Object.entries(COMPONENT_CONTRACTS)) expect(contract.name).toBe(name);
  });

  it("produce il formato nome@versione del plugin data Penpot", () => {
    expect(contractId(badge)).toBe("badge@1");
    expect(contractId(input)).toBe("input@1");
    expect(contractId(accordionItem)).toBe("accordion-item@1");
  });
});
