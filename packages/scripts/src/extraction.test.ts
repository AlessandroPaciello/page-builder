import { defineContract, productCard } from "@app/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ScriptError } from "./errors";
import { RENDER_DOMAINS, defineExtraction, fieldType, type ExtractionDefinition, type PartDefinition } from "./extraction";
import { productCardExtraction } from "./contracts/product-card.extract";

/**
 * Controlli a module load di `defineExtraction` (CAP-2, Story 2.12): una
 * prova rosso/verde per ogni riga della matrice della spec. Ogni rosso è uno
 * `ScriptError` di categoria `contract` che nomina componente, parte e campo.
 */

/** La card della simulazione, come base da rompere. */
const base: ExtractionDefinition = {
  penpot: { container: "ProductCard" },
  render: { domain: "commerce", headless: null },
  axes: { hover: { type: "state", values: ["off", "on"], default: "off" } },
  parts: {
    root: { role: "surface", element: "a", attribute: { href: "href" } },
    media: { role: "surface", element: "div", parent: "root" },
    image: { role: "image", element: "img", parent: "media", attribute: { src: "image" } },
    badge: { role: "surface", element: "span", parent: "media", when: { promo: ["offer", "discount"] } },
    badgeLabel: { role: "text", element: "span", parent: "badge", layer: "Badge/Label", content: "badgeLabel" },
    body: { role: "surface", element: "div", parent: "root" },
    price: { role: "text", element: "span", parent: "body", content: "price" },
    description: { role: "text", element: "p", parent: "body", content: "description" },
    tags: { role: "surface", element: "ul", parent: "body" },
    tag: { role: "surface", element: "li", parent: "tags", repeat: "tags" },
    tagLabel: { role: "text", element: "span", parent: "tag", layer: "Tag/Label", content: "$item" },
  },
  a11y: { role: null, focusVisible: true },
};

function withParts(parts: Record<string, PartDefinition | undefined>): ExtractionDefinition {
  const merged: Record<string, PartDefinition> = { ...base.parts };
  for (const [name, part] of Object.entries(parts)) {
    if (part === undefined) delete merged[name];
    else merged[name] = part;
  }
  return { ...base, parts: merged };
}

function expectContractError(def: ExtractionDefinition, part: string | undefined, message: RegExp): void {
  let caught: unknown;
  try {
    defineExtraction(productCard, def);
  } catch (error) {
    caught = error;
  }
  expect(caught, "atteso un ScriptError a module load").toBeInstanceOf(ScriptError);
  const error = caught as ScriptError;
  expect(error.kind).toBe("contract");
  expect(error.component).toBe("ProductCard");
  if (part !== undefined) expect(error.part).toBe(part);
  expect(error.message).toMatch(message);
}

describe("defineExtraction — verde", () => {
  it("la ProductCard carica: plugin data derivato, layer di default, 11 parti", () => {
    const extraction = defineExtraction(productCard, base);
    expect(extraction.contract).toBe(productCard);
    expect(extraction.pluginData).toBe("product-card@1");
    expect(Object.keys(extraction.parts)).toEqual([
      "root", "media", "image", "badge", "badgeLabel", "body", "price", "description", "tags", "tag", "tagLabel",
    ]);
    expect(extraction.parts.root!.layer).toBe("Root");
    expect(extraction.parts.badgeLabel!.layer).toBe("Badge/Label");
    expect(extraction.axes.hover!.type).toBe("state");
    expect(Object.isFrozen(extraction)).toBe(true);
    // Il modulo committato è la stessa definizione: non solo le parti, ma
    // anche penpot, render, assi e a11y (un drift lì resterebbe verde).
    expect(productCardExtraction).toEqual(extraction);
  });

  it("a11y.role per variante accetta esattamente i valori dell'asse option", () => {
    expect(() => defineExtraction(productCard, { ...base, a11y: { role: { none: null, offer: "status", discount: "status" }, focusVisible: true } })).not.toThrow();
  });

  it("fieldType: testo, url, array, altro", () => {
    expect(fieldType(productCard.fields.price)).toBe("text");
    expect(fieldType(productCard.fields.image)).toBe("url");
    expect(fieldType(productCard.fields.tags)).toBe("array");
    expect(fieldType({ schema: z.number(), kind: "content" })).toBe("other");
  });

  it("i domini sono quelli della v1 più commerce", () => {
    expect(RENDER_DOMAINS).toEqual(["data-display", "inputs", "feedback", "layout", "navigation", "overlays", "commerce"]);
  });
});

describe("defineExtraction — rosso, un ScriptError contract che nomina parte e campo", () => {
  it("field inesistente in content", () => {
    expectContractError(withParts({ price: { ...base.parts.price!, content: "prezzo" } }), "price", /parte "price".*"content" nomina il field "prezzo", che il contratto "product-card" non ha/);
  });

  it("field inesistente in attribute e in repeat", () => {
    expectContractError(withParts({ image: { ...base.parts.image!, attribute: { src: "img" } } }), "image", /"attribute\.src" nomina il field "img"/);
    expectContractError(withParts({ tag: { ...base.parts.tag!, repeat: "tag" } }), "tag", /"repeat" nomina il field "tag"/);
  });

  it("tipo sbagliato: src su un field testo, repeat su un field non array, content su un field array", () => {
    expectContractError(withParts({ image: { ...base.parts.image!, attribute: { src: "price" } } }), "image", /"attribute\.src" vuole un field url: il field "price" è di tipo "text"/);
    expectContractError(withParts({ tag: { ...base.parts.tag!, repeat: "price" } }), "tag", /"repeat" vuole un field array di stringhe: il field "price" è di tipo "text"/);
    expectContractError(withParts({ price: { ...base.parts.price!, content: "tags" } }), "price", /"content" vuole un field di testo: il field "tags" è di tipo "array"/);
  });

  it("$item fuori da repeat (né sulla parte né su un antenato)", () => {
    expectContractError(withParts({ price: { ...base.parts.price!, content: "$item" } }), "price", /"content: \\"\$item\\"" è ammesso solo dentro una parte con "repeat"/);
    // Sotto una parte ripetuta è ammesso: è la forma della card (tagLabel sotto tag).
    expect(() => defineExtraction(productCard, base)).not.toThrow();
  });

  it("parent void (img), when/repeat sulla radice, repeat annidato, layer vuoto, content fuori dal ruolo text", () => {
    expectContractError(withParts({ badge: { ...base.parts.badge!, parent: "image" } }), "badge", /"parent" è la parte "image", il cui elemento "img" è void e non può avere figli/);
    expectContractError(withParts({ root: { ...base.parts.root!, when: { promo: ["offer"] } } }), "root", /"when" sulla radice/);
    expectContractError(withParts({ root: { ...base.parts.root!, repeat: "tags" } }), "root", /"repeat" sulla radice/);
    expectContractError(withParts({ tagLabel: { ...base.parts.tagLabel!, repeat: "tags" } }), "tagLabel", /"repeat" annidato sotto la parte ripetuta "tag"/);
    expectContractError(withParts({ price: { ...base.parts.price!, layer: "" } }), "price", /"layer" vuoto/);
    expectContractError(withParts({ tag: { ...base.parts.tag!, content: "price" } }), "tag", /"content" su una parte di ruolo "surface".*il testo appartiene a una parte "text"/);
  });

  it("when su un asse di rendering, su un asse inesistente, su un valore assente", () => {
    expectContractError(withParts({ badge: { ...base.parts.badge!, when: { hover: ["on"] } } }), "badge", /"when" nomina l'asse "hover".*non ha tra gli assi option \(promo\).*asse di rendering \(state\)/);
    expectContractError(withParts({ badge: { ...base.parts.badge!, when: { size: ["sm"] } } }), "badge", /"when" nomina l'asse "size"/);
    expectContractError(withParts({ badge: { ...base.parts.badge!, when: { promo: ["sale"] } } }), "badge", /"when\.promo" nomina il valore "sale", che l'asse non ha \(valori: none, offer, discount\)/);
  });

  it("il page builder rifiuta assi state/behavior: stanno nel contratto di estrazione (Story 2.16)", () => {
    expect(() =>
      defineContract({
        name: "demo-chip",
        version: 1,
        axes: [{ name: "state", type: "state", values: ["default", "focus"], default: "default" }],
        fields: {},
      } as never),
    ).toThrow(/asse "state" di tipo "state".*solo assi "option"/);
  });

  it("albero: senza root, root con parent, ciclo a due, parte irraggiungibile", () => {
    expectContractError(withParts({ root: undefined }), undefined, /albero senza radice: manca la parte "root"/);
    expectContractError(withParts({ root: { ...base.parts.root!, parent: "body" } }), "root", /la radice "root" non ha un genitore \(dichiarato "body"\)/);
    expectContractError(withParts({ tags: { ...base.parts.tags!, parent: "tag" } }), "tags", /albero con cicli: le parti \[tags, tag, tagLabel\] non discendono da "root"/);
    expectContractError(withParts({ price: { ...base.parts.price!, parent: "ghost" } }), "price", /"parent" nomina la parte "ghost", che il contratto di estrazione non ha/);
    expectContractError(withParts({ price: { ...base.parts.price!, parent: "price" } }), "price", /genitore di sé stessa: ciclo/);
    expectContractError(withParts({ price: { role: "text", element: "span", content: "price" } }), "price", /parte senza "parent"/);
  });

  it("parte senza ruolo o con ruolo fuori vocabolario", () => {
    expectContractError(withParts({ price: { element: "span", parent: "body", content: "price" } as never }), "price", /parte senza ruolo.*\(surface, text, icon, divider, image\)/);
    expectContractError(withParts({ price: { ...base.parts.price!, role: "heading" as never } }), "price", /ruolo "heading" non è nel vocabolario \(surface, text, icon, divider, image\)/);
  });

  it("plugin data incoerente: il container non corrisponde al contratto", () => {
    expectContractError({ ...base, penpot: { container: "Card" } }, undefined, /plugin data incoerente: il container "Card" non corrisponde al contratto "product-card" — atteso il container "ProductCard" \(plugin data derivato "product-card@1"\)/);
  });

  it("radice con href ma elemento diverso da a", () => {
    expectContractError(withParts({ root: { ...base.parts.root!, element: "div" } }), "root", /la radice con "attribute\.href" è un link: l'elemento deve essere "a", non "div"/);
  });

  it("image con content, layer duplicato, headless su parte ignota, dominio ignoto", () => {
    expectContractError(withParts({ image: { ...base.parts.image!, content: "price" } }), "image", /una parte "image" non ha "content"/);
    expectContractError(withParts({ price: { ...base.parts.price!, layer: "Description" } }), "description", /il layer "Description" è già della parte "price"/);
    expectContractError({ ...base, render: { domain: "commerce", headless: { package: "@base-ui/react", parts: { trigger: "Trigger" } } } }, "trigger", /headless nomina la parte "trigger"/);
    expectContractError({ ...base, render: { domain: "shop" as never, headless: null } }, undefined, /dominio "shop" non è nel vocabolario/);
  });

  it("assi di rendering: tipo option, collisione con asse o field del page builder, default fuori lista", () => {
    expectContractError({ ...base, axes: { promo: { type: "state", values: ["a"], default: "a" } } }, undefined, /asse di rendering "promo" collide con l'asse "promo" del contratto del page builder/);
    expectContractError({ ...base, axes: { price: { type: "state", values: ["a"], default: "a" } } }, undefined, /asse di rendering "price" collide con il field "price"/);
    expectContractError({ ...base, axes: { hover: { type: "option" as never, values: ["a"], default: "a" } } }, undefined, /asse di rendering "hover" ha tipo "option"/);
    expectContractError({ ...base, axes: { hover: { type: "state", values: ["off", "on"], default: "hover" } } }, undefined, /default "hover" non è tra i values/);
  });

  it("a11y.role per variante con chiavi che non sono i valori di un asse option", () => {
    expectContractError({ ...base, a11y: { role: { none: null, offer: null }, focusVisible: true } }, undefined, /a11y\.role per variante ha le chiavi \[none, offer\], che non coincidono con i valori di un asse option.*promo \[none, offer, discount\]/);
  });

  it("nomi non validi e duplicati: asse di rendering, parte, elemento", () => {
    expectContractError(
      { ...base, axes: { Hover: { type: "state", values: ["off", "on"], default: "off" } } },
      undefined,
      /asse di rendering "Hover" ha un nome non valido/,
    );
    expectContractError(
      { ...base, axes: { hover: { type: "state", values: ["off", "off"], default: "off" } } },
      undefined,
      /asse di rendering "hover" ha valori duplicati/,
    );
    expectContractError(
      withParts({ Price: { role: "text", element: "span", parent: "body", content: "price" } }),
      "Price",
      /parte "Price" ha un nome non valido/,
    );
    expectContractError(
      withParts({ price: { ...base.parts.price!, element: "Span" } }),
      "price",
      /non è un tag HTML valido/,
    );
  });

  it("attributo non-url su field non di testo", () => {
    expectContractError(
      withParts({ price: { ...base.parts.price!, attribute: { title: "tags" } } }),
      "price",
      /"attribute\.title" vuole un field di testo: il field "tags" è di tipo "array"/,
    );
  });

  it("when con valori duplicati", () => {
    expectContractError(
      withParts({ badge: { ...base.parts.badge!, when: { promo: ["offer", "offer"] } } }),
      "badge",
      /"when\.promo" ha valori duplicati/,
    );
  });

  it("headless senza package", () => {
    expectContractError(
      { ...base, render: { domain: "commerce", headless: { package: "", parts: { root: "Root" } } } },
      undefined,
      /headless senza "package"/,
    );
  });
});
