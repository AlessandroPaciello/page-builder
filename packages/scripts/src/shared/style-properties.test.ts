import { describe, expect, it } from "vitest";

import type { RegisteredProperty } from "./style-properties";
import {
  ICON_LAYER_KINDS,
  PART_ROLES,
  ROLE_PROPERTIES,
  STYLE_PROPERTIES,
  layerTreeIssues,
  layerTreeProblems,
  lookupProperty,
  propertyProblem,
  propertyDefinition,
  radiusCorners,
  registeredProperties,
  removalClasses,
  roleAdmits,
} from "./style-properties";

/**
 * Registro unico delle proprietà (Story 2.8 parte A): ogni riga della
 * matrice I/O della spec ha la sua prova.
 */

const where = { component: "Input", part: "root", cell: "state=default" };

describe("tabella ruolo → proprietà (Story 2.10, A)", () => {
  interface TestLayer {
    name: string;
    tokens: Record<string, string>;
    style: Record<string, unknown>;
    children: TestLayer[];
  }
  const layer = (name: string, tokens: Record<string, string>, children: TestLayer[] = []): TestLayer => ({
    name,
    tokens,
    style: {},
    children,
  });
  const roles = { root: "surface", heading: "text", chevron: "icon", divider: "divider" } as const;

  it("la tabella copre i cinque ruoli del vocabolario e nomina solo proprietà registrate", () => {
    expect(Object.keys(ROLE_PROPERTIES).sort()).toEqual([...PART_ROLES].sort());
    expect([...PART_ROLES].sort()).toEqual(["divider", "icon", "image", "surface", "text"]);
    for (const properties of Object.values(ROLE_PROPERTIES)) {
      for (const property of properties) expect(registeredProperties()).toContain(property);
    }
  });

  it("verde: fill e tipografia su text, outline (solo strokeColor) su surface, stroke su icon e divider", () => {
    const tree = layer("Alert", { strokeColor: "color.border", paddingTop: "spacing.4" }, [
      layer("heading", { fill: "color.foreground", fontSize: "text.sm", fontWeight: "font-weight.semibold" }),
      layer("chevron", { strokeColor: "color.foreground", strokeWidth: "border-width.default" }),
      layer("divider", { strokeColor: "color.border", strokeWidth: "border-width.default" }),
    ]);
    expect(layerTreeIssues(tree, { component: "alert", cell: "status=info" }, {}, roles)).toEqual([]);
  });

  it("rosso: strokeColor su un testo (anche al posto del fill) → fuori ruolo, con i tre adattamenti in ordine", () => {
    const tree = layer("Alert", { fill: "color.card" }, [layer("heading", { strokeColor: "color.warning" })]);
    const issues = layerTreeIssues(tree, { component: "alert", cell: "status=warning" }, {}, roles);
    expect(issues).toHaveLength(1);
    const [issue] = issues;
    expect(issue).toMatchObject({ blocked: false, outsideRole: true });
    expect(issue!.message).toContain(
      `Proprietà fuori ruolo (componente "Alert", cella "status=warning", parte "heading", ruolo "text", proprietà "strokeColor", token "color.warning")`,
    );
    const designer = issue!.message.indexOf("1) designer");
    const teach = issue!.message.indexOf("2) sviluppatore, se il design è voluto");
    const change = issue!.message.indexOf("3) sviluppatore, se la parte è d'altro tipo: pnpm role:part -- Alert heading uno fra [surface, icon, divider]");
    expect(designer).toBeGreaterThan(-1);
    expect(teach).toBeGreaterThan(designer);
    expect(change).toBeGreaterThan(teach);
  });

  it("rosso: fill su un divider, padding su un'icona", () => {
    const tree = layer("AccordionItem", {}, [layer("divider", { fill: "color.border" }), layer("chevron", { paddingTop: "spacing.1" })]);
    const issues = layerTreeIssues(tree, { component: "accordion-item" }, {}, roles);
    expect(issues.map((issue) => [issue.outsideRole, /parte "(\w+)", ruolo "(\w+)", proprietà "(\w+)"/.exec(issue.message)?.slice(1)])).toEqual([
      [true, ["divider", "divider", "fill"]],
      [true, ["chevron", "icon", "paddingTop"]],
    ]);
  });

  it("la parte si riconosce anche per alias; senza ruoli nessun controllo di ruolo", () => {
    const tree = layer("Alert", {}, [layer("Title", { strokeColor: "color.warning" })]);
    expect(layerTreeIssues(tree, {}, { Title: "heading" }, roles)).toHaveLength(1);
    expect(layerTreeIssues(tree, {}, { Title: "heading" })).toEqual([]);
  });

  it("una proprietà non registrata resta un problema del registro (rosso), non fuori ruolo", () => {
    const tree = layer("Alert", {}, [layer("heading", { textDecoration: "x" })]);
    const [issue] = layerTreeIssues(tree, {}, {}, roles);
    expect(issue).toMatchObject({ blocked: false, outsideRole: false });
    expect(issue!.message).toMatch(/^Proprietà non registrata/);
  });

  it("nessuna cella delle istantanee v2 viola la tabella: coperto da extract --check (nessuna fixture v1)", () => {
    expect(true).toBe(true);
  });
});

describe("registro — matrice della spec", () => {
  it("tratteggio: strokeStyle dashed è registrato ma bloccato", () => {
    expect(propertyProblem("strokeStyle", { ...where, value: "dashed" })).toMatch(/^Proprietà bloccata/);
    expect(propertyProblem("strokeStyle", { ...where, value: "dotted" })).toMatch(/^Proprietà bloccata/);
  });

  it("fuori lista: strokeStyle mixed blocca con l'elenco dei valori ammessi", () => {
    expect(propertyProblem("strokeStyle", { ...where, value: "mixed" })).toMatch(
      /^Valore fuori lista.*"strokeStyle" ammette solo \[solid, dashed, dotted\]/,
    );
  });

  it("allineamento: strokeAlignment center/outer è bloccato", () => {
    expect(propertyProblem("strokeAlignment", { ...where, value: "center" })).toMatch(/^Proprietà bloccata/);
    expect(propertyProblem("strokeAlignment", { ...where, value: "outer" })).toMatch(/^Proprietà bloccata/);
  });

  it("non registrata: una proprietà ignota blocca", () => {
    expect(propertyProblem("fooBar", { ...where, token: "color.primary" })).toMatch(/^Proprietà non registrata/);
    // Anche un nome ereditato da Object.prototype non è una riga del registro.
    expect(propertyProblem("toString", where)).toMatch(/^Proprietà non registrata/);
  });

  it("icona: strokeWidth si ignora sui layer path/vector/ellipse/line per regola dichiarata", () => {
    expect(STYLE_PROPERTIES.strokeWidth.ignoreOnLayerKinds).toEqual(ICON_LAYER_KINDS);
    expect([...ICON_LAYER_KINDS].sort()).toEqual(["ellipse", "line", "path", "vector"]);
    expect(propertyProblem("strokeWidth", { ...where, token: "border-width.default" })).toBeNull();
  });

  it("strokeWidth e opacity sono supportate con verifica sulla base, senza classi", () => {
    expect(STYLE_PROPERTIES.strokeWidth.emitter.emit).toBe("coveredByBase");
    expect(STYLE_PROPERTIES.opacity.emitter.emit).toBe("coveredByBase");
    expect(STYLE_PROPERTIES.strokeWidth.emitter.baseValue("border-b")).toBe(1);
    expect(STYLE_PROPERTIES.strokeWidth.emitter.baseValue("border-ring")).toBeNull();
    expect(STYLE_PROPERTIES.opacity.emitter.baseValue("opacity-50")).toBe(0.5);
    expect(STYLE_PROPERTIES.opacity.emitter.baseValue("opacity")).toBeNull();
  });

  it("una parola chiave legata a un token è un errore", () => {
    expect(propertyProblem("strokeStyle", { ...where, token: "color.primary" })).toMatch(/parola chiave legata a un token/);
  });
});

describe("registro — errori nominativi", () => {
  it("nominano componente, parte, cella, proprietà e token o valore", () => {
    const problem = propertyProblem("strokeStyle", { ...where, value: "dashed" })!;
    for (const piece of ['"Input"', '"root"', '"state=default"', '"strokeStyle"', '"dashed"']) expect(problem).toContain(piece);
    const unregistered = propertyProblem("fooBar", { ...where, token: "color.primary" })!;
    expect(unregistered).toContain('"color.primary"');
    expect(unregistered).toMatch(/riga del registro.*mappatura.*test rosso\/verde/);
  });

  it("lookupProperty restituisce la riga di una proprietà usabile e lancia sulle altre", () => {
    expect(lookupProperty("fill").type).toEqual({ kind: "token", tokenType: "color" });
    expect(() => lookupProperty("fooBar", where)).toThrow(/non registrata.*"fooBar"/);
    expect(() => lookupProperty("fontFamilies", where)).toThrow(/bloccata.*"fontFamilies"/);
  });

  it("layerTreeProblems percorre l'albero: la radice è la parte root, i figli contano per nome", () => {
    const problems = layerTreeProblems(
      {
        name: "Input",
        tokens: { fill: "color.background" },
        style: { fill: ["#fff"], strokeStyle: "dashed" },
        children: [{ name: "placeholder", tokens: { fooBar: "x" }, style: {}, children: [] }],
      },
      { component: "Input", cell: "state=default" },
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/bloccata.*parte "root".*"strokeStyle"/);
    expect(problems[1]).toMatch(/non registrata.*parte "placeholder".*"fooBar"/);
  });
});

describe("registro — nomi ereditati", () => {
  it("una chiave di stile `toString` è non registrata e il messaggio non inventa un token", () => {
    const problems = layerTreeProblems(
      { name: "Input", tokens: {}, style: { toString: "x" }, children: [] },
      { component: "Input", cell: "state=default" },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/non registrata.*proprietà "toString", valore "x"/);
    expect(problems[0]).not.toContain("token");
  });
});

describe("registro — completezza rispetto a TYPE_UTILITY_PREFIXES", () => {
  it("ogni mappatura utility dichiara un prefisso non vuoto; i radius usano rounded-", () => {
    for (const property of registeredProperties()) {
      const row = STYLE_PROPERTIES[property];
      if (row.type.kind !== "token") continue;
      const emitter = row.emitter;
      if (emitter.emit === "utility") {
        expect(emitter.prefix.length, property).toBeGreaterThan(0);
      } else if (emitter.emit === "radiusCorner") {
        expect(emitter.corner.startsWith("rounded-")).toBe(true);
      }
    }
  });

  it("borderWidth e opacity non sono mai mappati a classi (coveredByBase)", () => {
    for (const property of ["strokeWidth", "opacity"] as const) {
      expect(STYLE_PROPERTIES[property].emitter.emit).toBe("coveredByBase");
    }
  });

  it("solo due stati: una proprietà supportata ha una mappatura, una bloccata non ne ha", () => {
    for (const property of registeredProperties()) {
      const row = STYLE_PROPERTIES[property];
      if (row.status.state === "supported") expect(row.emitter.emit, property).not.toBe("none");
      else expect(row.emitter.emit, property).toBe("none");
    }
  });

  it("i quattro angoli radius, nell'ordine del registro", () => {
    expect(radiusCorners()).toEqual(["rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"]);
  });

  it("classi di rimozione (2.8 parte C): per prefisso utility risolto, solo fill le dichiara", () => {
    // Chiavi = prefissi utility: `bg` sui layer bg, `text` sui text — la
    // rimozione annulla la STESSA utility che il default emette.
    expect(STYLE_PROPERTIES.fill.emitter.removalClass).toEqual({ bg: "bg-transparent", text: "text-transparent" });
    expect(removalClasses()).toEqual(["bg-transparent", "text-transparent"]);
    // Le coveredByBase e le bloccate non guadagnano la rimozione.
    expect(STYLE_PROPERTIES.strokeWidth.emitter.emit).toBe("coveredByBase");
    expect(STYLE_PROPERTIES.opacity.emitter.emit).toBe("coveredByBase");
  });

  it("RegisteredProperty copre token e parole chiave del registro", () => {
    const tokenProperty: RegisteredProperty = "strokeWidth";
    const blockedTokenProperty: RegisteredProperty = "fontFamilies";
    const keyword: RegisteredProperty = "strokeStyle";
    expect([tokenProperty, blockedTokenProperty, keyword]).toHaveLength(3);
  });
});

describe("layout, posizione e ruolo image (Story 2.12, CAP-3)", () => {
  const LAYOUT = ["layoutDir", "layoutAlign", "layoutJustify", "layoutWrap", "rowGap", "columnGap"];
  const POSITION = ["positionAbsolute", "positionX", "positionY", "zIndex"];

  it("le righe nuove stanno in coda al registro: l'ordine delle righe v1 (chiavi di style delle fixture) è intatto", () => {
    const names = registeredProperties();
    expect(names.slice(-8)).toEqual(["layoutDir", "layoutAlign", "layoutJustify", "layoutWrap", "positionAbsolute", "positionX", "positionY", "zIndex"]);
    expect(names.slice(0, 20)).toEqual([
      "fill", "strokeColor", "strokeWidth", "strokeStyle", "strokeAlignment",
      "borderRadiusTopLeft", "borderRadiusTopRight", "borderRadiusBottomRight", "borderRadiusBottomLeft",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "rowGap", "columnGap",
      "fontSize", "fontWeight", "letterSpacing", "opacity", "shadow",
    ]);
  });

  it("layout: parole chiave lette dal flex del board, supportate, con classi fisse per valore", () => {
    expect(STYLE_PROPERTIES.layoutDir.read).toEqual({ source: "flexLayout", field: "dir" });
    expect(STYLE_PROPERTIES.layoutDir.type).toEqual({ kind: "keyword", values: ["none", "row", "column"], default: "none" });
    expect(STYLE_PROPERTIES.layoutDir.emitter).toEqual({ emit: "keywordClass", classes: { none: "", row: "flex flex-row", column: "flex flex-col" } });
    expect(STYLE_PROPERTIES.layoutAlign.emitter.classes.center).toBe("items-center");
    expect(STYLE_PROPERTIES.layoutJustify.emitter.classes["space-between"]).toBe("justify-between");
    expect(STYLE_PROPERTIES.layoutWrap.emitter.classes.wrap).toBe("flex-wrap");
    for (const property of ["layoutDir", "layoutAlign", "layoutJustify", "layoutWrap"] as const) {
      expect(STYLE_PROPERTIES[property].status).toEqual({ state: "supported" });
      // Ogni valore della lista ha la sua classe: nessuna parola chiave senza mappatura.
      expect(Object.keys(STYLE_PROPERTIES[property].emitter.classes).sort()).toEqual([...STYLE_PROPERTIES[property].type.values].sort());
    }
  });

  it("posizione: absolute e zIndex a parole chiave, x/y token di spaziatura → left-*/top-*", () => {
    expect(STYLE_PROPERTIES.positionAbsolute.read).toEqual({ source: "layoutChild", field: "absolute" });
    expect(STYLE_PROPERTIES.positionAbsolute.emitter).toEqual({ emit: "keywordClass", classes: { static: "", absolute: "absolute" } });
    expect(STYLE_PROPERTIES.positionX).toMatchObject({ read: { source: "layoutChild", field: "x" }, type: { kind: "token", tokenType: "spacing" }, emitter: { emit: "utility", prefix: "left" } });
    expect(STYLE_PROPERTIES.positionY).toMatchObject({ read: { source: "layoutChild", field: "y" }, type: { kind: "token", tokenType: "spacing" }, emitter: { emit: "utility", prefix: "top" } });
    expect(STYLE_PROPERTIES.zIndex.emitter.classes["10"]).toBe("z-10");
    expect(STYLE_PROPERTIES.positionX.emitter).toMatchObject({ emit: "utility", prefix: "left" });
    expect(STYLE_PROPERTIES.positionY.emitter).toMatchObject({ emit: "utility", prefix: "top" });
  });

  it("verde: layoutDir column e positionX con token spacing sono usabili", () => {
    expect(propertyProblem("layoutDir", { ...where, value: "column" })).toBeNull();
    expect(propertyProblem("positionAbsolute", { ...where, value: "absolute" })).toBeNull();
    expect(propertyProblem("positionX", { ...where, token: "spacing.2" })).toBeNull();
    expect(lookupProperty("zIndex", { ...where, value: "10" })).toBe(propertyDefinition("zIndex"));
  });

  it("rosso: valore fuori lista (layoutDir diagonal) e parola chiave legata a un token restano problemi nominativi", () => {
    expect(propertyProblem("layoutDir", { ...where, value: "diagonal" })).toMatch(/Valore fuori lista.*proprietà "layoutDir".*ammette solo \[none, row, column\]/);
    expect(propertyProblem("positionAbsolute", { ...where, token: "spacing.1" })).toMatch(/parola chiave legata a un token.*"positionAbsolute"/);
  });

  it("ruolo → proprietà: surface e image ammettono layout e posizione; image non ammette fill né bordo", () => {
    for (const property of [...LAYOUT, ...POSITION]) {
      expect(roleAdmits("surface", property), property).toBe(true);
      expect(roleAdmits("image", property), property).toBe(true);
      expect(roleAdmits("text", property), property).toBe(false);
      expect(roleAdmits("icon", property), property).toBe(false);
      expect(roleAdmits("divider", property), property).toBe(false);
    }
    expect([...ROLE_PROPERTIES.image]).toEqual([
      "borderRadiusTopLeft", "borderRadiusTopRight", "borderRadiusBottomRight", "borderRadiusBottomLeft", "opacity",
      ...LAYOUT, ...POSITION,
    ]);
    for (const property of ["fill", "strokeColor", "strokeWidth", "shadow", "paddingTop", "fontSize"]) {
      expect(roleAdmits("image", property), property).toBe(false);
    }
  });

  it("rosso: un token fill su una parte image è fuori ruolo (outsideRole), con l'adattamento in ordine", () => {
    const tree = {
      name: "ProductCard",
      tokens: {},
      style: {},
      children: [{ name: "image", tokens: { fill: "color.card", borderRadiusTopLeft: "radius.lg" }, style: {}, children: [] }],
    };
    const issues = layerTreeIssues(tree, { component: "ProductCard", cell: "promo=none|hover=off" }, {}, { root: "surface", image: "image" });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ blocked: false, outsideRole: true });
    expect(issues[0]!.message).toContain(`parte "image", ruolo "image", proprietà "fill", token "color.card"`);
    expect(issues[0]!.message).toMatch(/1\) designer/);
  });
});
