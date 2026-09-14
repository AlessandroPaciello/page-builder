import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COMPONENT_CONTRACTS } from "@app/contracts";
import { describe, expect, it } from "vitest";

import { committedDesigns } from "./designs-loader";
import type { Operation } from "./library-plan";
import { planLibrary } from "./library-plan";
import { LIBRARY_SPEC, type SemanticSeed } from "./library-spec";
import { emptySnapshot, type LibrarySnapshot, type SnapshotLayer } from "./library-snapshot";
import { verifyLibrary } from "./verify-library";

const seed: SemanticSeed = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "semantic-tokens.seed.json"), "utf8"),
) as SemanticSeed;

const designs = committedDesigns();

const contracts = Object.values(COMPONENT_CONTRACTS);

/** Costruisce lo snapshot "verde" applicando il piano del bootstrap (ciò che il writer produrrebbe live). */
function greenSnapshot(): LibrarySnapshot {
  const plan = planLibrary({ mode: "bootstrap", contracts, spec: LIBRARY_SPEC, seed, designs, snapshot: emptySnapshot() });
  if (plan.refused) throw new Error(`piano di test rifiutato: ${plan.refused}`);
  const snapshot = emptySnapshot();
  for (const op of plan.operations as Operation[]) {
    if (op.kind === "createSet") {
      snapshot.sets.push({ name: op.set, active: true, tokens: [] });
    } else if (op.kind === "createToken") {
      snapshot.sets.find((set) => set.name === op.set)!.tokens.push({ name: op.name, type: op.type, value: op.value });
    } else if (op.kind === "createContainer") {
      snapshot.components.push({
        id: `id-${op.contract}`,
        name: op.containerName,
        pluginData: op.pluginData,
        axes: op.axes.map((axis) => axis.name),
        axesValues: Object.fromEntries(op.axes.map((axis) => [axis.name, [...axis.values]])),
        cells: op.cells.map((cell) => {
          const cellLayers = new Map<string, SnapshotLayer>();
          for (const part of cell.parts) {
            cellLayers.set(part.name, {
              name: part.name,
              kind: part.kind,
              tokens: { ...part.tokens },
              style: Object.fromEntries(Object.keys(part.tokens).map((property) => [property, "<valore>"])),
              children: [],
            });
          }
          const root = cellLayers.get("root")!;
          for (const part of cell.parts) {
            if (part.parent === "root") root.children.push(cellLayers.get(part.name)!);
            else if (part.parent) cellLayers.get(part.parent)!.children.push(cellLayers.get(part.name)!);
          }
          return { variantProps: { ...cell.variantProps }, variantError: null, root };
        }),
      });
    }
  }
  return snapshot;
}

function verify(snapshot: LibrarySnapshot) {
  return verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot });
}

function status(result: ReturnType<typeof verify>, component: string) {
  return result.components.find((verdict) => verdict.component === component)?.status;
}

describe("verifyLibrary — snapshot verde", () => {
  it("il risultato del bootstrap passa tutte le 11 regole", () => {
    const result = verify(greenSnapshot());
    expect(result.errors).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("una voce ok per ogni contratto e le regole globali come righe globali", () => {
    const result = verify(greenSnapshot());
    expect(result.components.map((v) => [v.component, v.status])).toEqual(
      contracts.map((contract) => [contract.name.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(""), "ok"]),
    );
    expect(result.global.map((v) => v.component)).toEqual(["regola 8 — copertura spec", "regola 9 — tema", "regola 10 — contrasto"]);
  });
});

describe("verifyLibrary — esito per componente (Story 2.8 parte B)", () => {
  it("un rosso: solo la voce Badge è rossa, gli altri componenti sono valutati e ok", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.pluginData = "badge@9";
    const result = verify(snapshot);
    expect(result.ok).toBe(false);
    expect(status(result, "Badge")).toBe("red");
    expect(status(result, "Input")).toBe("ok");
    expect(status(result, "AccordionItem")).toBe("ok");
    const badge = result.components.find((v) => v.component === "Badge")!;
    expect(badge.problems.some((p) => p.message.includes('atteso "badge@1"'))).toBe(true);
  });

  it("variante non adottata (variant=info in Penpot) → Badge in attesa con rimando ad adopt:variant, exit ok", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axesValues.variant = [...badge.axesValues.variant!, "info"];
    const template = badge.cells.find((cell) => cell.variantProps?.variant === "default")!;
    for (const size of ["sm", "md"]) {
      badge.cells.push({ ...template, variantProps: { variant: "info", size } });
    }
    const result = verify(snapshot);
    expect(result.ok).toBe(true);
    expect(status(result, "Badge")).toBe("pending");
    expect(result.pending.some((e) => e.includes("in più [info]") && e.includes("pnpm adopt:variant -- Badge"))).toBe(true);
    expect(result.pending.some((e) => e.includes('cella "variant=info|size=sm"') && e.includes("non adottato"))).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("maiuscole e spazi: asse `Size` e valore ` SM ` sono normalizzati, nessun errore", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axes = ["variant", "Size"];
    badge.axesValues = { variant: badge.axesValues.variant!, Size: [" SM ", "md"] };
    for (const cell of badge.cells) {
      const { size, ...rest } = cell.variantProps!;
      cell.variantProps = { ...rest, Size: size === "sm" ? " SM " : size! };
    }
    const result = verify(snapshot);
    expect(result.errors).toEqual([]);
    expect(result.pending).toEqual([]);
  });

  it("ordine degli assi diverso dal contratto → nessun errore di regola 4", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axes = [...badge.axes].reverse();
    const result = verify(snapshot);
    expect(result.errors).toEqual([]);
  });

  it("collisione: `SM` e `sm` sullo stesso asse → voce rossa che nomina i due valori", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axesValues.size = ["SM", "sm", "md"];
    const result = verify(snapshot);
    expect(status(result, "Badge")).toBe("red");
    expect(result.errors.some((e) => e.includes('asse "size"') && e.includes('"SM", "sm"') && e.includes("collisione"))).toBe(true);
    expect(status(result, "Input")).toBe("ok");
  });

  it("alias: il layer `Label Text` con alias `label` nel binding soddisfa la regola 6", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    for (const cell of badge.cells) {
      for (const layer of cell.root.children) if (layer.name === "label") layer.name = "Label Text";
    }
    expect(verify(snapshot).errors.some((e) => e.includes('manca la parte "label"'))).toBe(true);
    const withAlias = verifyLibrary({
      contracts,
      spec: LIBRARY_SPEC,
      snapshot,
      bindings: { badge: { parts: { root: {}, label: { aliases: ["Label Text"] } } } },
    });
    expect(withAlias.errors).toEqual([]);
  });

  it("alias verso una parte inesistente → voce rossa nominativa", () => {
    const result = verifyLibrary({
      contracts,
      spec: LIBRARY_SPEC,
      snapshot: greenSnapshot(),
      bindings: { badge: { parts: { icon: { aliases: ["Icon"] } } } },
    });
    expect(status(result, "Badge")).toBe("red");
    expect(result.errors.some((e) => e.includes('l\'alias "Icon" punta alla parte "icon"'))).toBe(true);
  });

  it("cella mancante con assi fuori ordine o contratto non corrente: niente rimando ad add:library, dice cosa richiede addCell", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.cells = badge.cells.filter((cell) => cell.variantProps?.size !== "sm");
    badge.axes = [...badge.axes].reverse();
    const reversed = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot, designs });
    const question = reversed.pending.find((e) => e.includes("manca la cella"))!;
    expect(question).not.toContain("pnpm add:library la crea");
    expect(question).toMatch(/addCell richiede gli assi del container nell'ordine del contratto \[variant, size\]/);

    badge.axes = [...badge.axes].reverse();
    badge.pluginData = "badge@2";
    const stale = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot, designs });
    const staleQuestion = stale.pending.find((e) => e.includes("manca la cella"))!;
    expect(staleQuestion).not.toContain("pnpm add:library la crea");
    expect(staleQuestion).toContain("il contratto alla versione corrente");
  });

  it("cella di un valore non adottato su un asse non option → nessun rimando ad adopt:variant", () => {
    const contract = contracts.find((c) => c.axes.some((axis) => axis.type !== "option"))!;
    const axis = contract.axes.find((a) => a.type !== "option")!;
    const name = contract.name.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
    const snapshot = greenSnapshot();
    const container = snapshot.components.find((c) => c.name === name)!;
    container.axesValues[axis.name] = [...container.axesValues[axis.name]!, "nuovo"];
    const template = container.cells[0]!;
    container.cells.push({ ...template, variantProps: { ...template.variantProps!, [axis.name]: "nuovo" } });
    const result = verify(snapshot);
    const cellMessage = result.pending.find((e) => e.includes("di un valore non adottato"))!;
    expect(cellMessage).toContain("adopt:variant non lo adotta");
    expect(cellMessage).not.toContain("pnpm adopt:variant");
  });

  it("binding non caricabile e ricetta malformata → voci rosse (componente e file), nessun crash", () => {
    const result = verifyLibrary({
      contracts,
      spec: LIBRARY_SPEC,
      snapshot: greenSnapshot(),
      bindingErrors: { badge: "Binding malformato (/x/badge.binding.json): parts: Required" },
      malformedRecipes: [{ file: "rotta.recipe.json", error: "Ricetta malformata (test)" }],
    });
    expect(status(result, "Badge")).toBe("red");
    expect(result.errors).toContain("Binding malformato (/x/badge.binding.json): parts: Required");
    expect(status(result, "rotta.recipe.json")).toBe("red");
    expect(status(result, "Input")).toBe("ok");
  });

  it("snapshot committato: un componente committato assente dallo snapshot è rosso (\"snapshot da aggiornare\")", () => {
    const snapshot = greenSnapshot();
    snapshot.components = snapshot.components.filter((c) => c.name !== "Input");
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot, committedComponents: ["Badge", "Input"] });
    expect(status(result, "Input")).toBe("red");
    expect(result.errors.some((e) => e.includes('"Input"') && e.includes("snapshot da aggiornare"))).toBe(true);
    expect(status(result, "Badge")).toBe("ok");
    const fresh = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot: greenSnapshot(), committedComponents: ["Badge", "Input"] });
    expect(fresh.ok).toBe(true);
  });
});

describe("verifyLibrary — un caso rosso per regola", () => {
  it("regola 1: contratto senza container", () => {
    const snapshot = greenSnapshot();
    snapshot.components = snapshot.components.filter((c) => c.name !== "Badge");
    const result = verify(snapshot);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("nessun VariantContainer"))).toBe(true);
  });

  it("regola 1: due container dichiarano lo stesso contratto", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    snapshot.components.push({ ...badge, id: "id-badge-2" });
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("2 container lo dichiarano"))).toBe(true);
  });

  it("regola 1: container con il nome giusto ma senza plugin data", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.pluginData = null;
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("plugin data pagebuilder/contract"))).toBe(true);
  });

  it("regola 2: nome del container ≠ PascalCase del contratto", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.name = "badge";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes('atteso "Badge"'))).toBe(true);
  });

  it("regola 3: versione nel plugin data ≠ contractId", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.pluginData = "badge@2";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes('atteso "badge@1"'))).toBe(true);
  });

  it("regola 4: proprietà di variante ≠ assi del contratto", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.axes = ["variant", "tone"];
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes("proprietà di variante"))).toBe(true);
  });

  it("regola 4: valori del contratto assenti in Penpot → in attesa (non rosso), nominati", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axesValues.variant = ["default", "secondary"];
    const result = verify(snapshot);
    expect(result.pending.some((e) => e.includes('asse "variant"') && e.includes("[destructive] assenti in Penpot"))).toBe(true);
    expect(result.errors).toEqual([]);
    expect(status(result, "Badge")).toBe("pending");
  });

  it("regola 5: cella mancante → in attesa con domanda al designer, mai inventata; rimando ad add:library se il design la prevede", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.cells = badge.cells.filter((cell) => cell.variantProps?.size !== "sm");
    const cellsBefore = badge.cells.length;
    const withoutDesign = verify(snapshot);
    const question = withoutDesign.pending.find((e) => e.includes('"badge"') && e.includes("manca la cella"));
    expect(question).toContain("domanda al designer");
    expect(question).not.toContain("add:library");
    expect(withoutDesign.ok).toBe(true);
    expect(status(withoutDesign, "Badge")).toBe("pending");
    // Il design committato prevede la cella: rimando ad add:library (addCell).
    const withDesign = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot, designs });
    expect(withDesign.pending.some((e) => e.includes("manca la cella") && e.includes("pnpm add:library"))).toBe(true);
    // Nessuna cella inventata: lo snapshot resta com'è.
    expect(badge.cells).toHaveLength(cellsBefore);
  });

  it("regola 5: variantError non nullo", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.cells[0]!.variantError = "duplicate";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes('variantError "duplicate"'))).toBe(true);
  });

  it("regola 5: board non mappata alle varianti (variantProps null) è un errore, non un salto", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.cells[0]!.variantProps = null;
    const result = verify(snapshot);
    expect(
      result.errors.some((e) => e.includes('"badge"') && e.includes("non è mappata alle varianti") && e.includes('"root"')),
    ).toBe(true);
  });

  it("regola 8: token richiesto relegato in un set inattivo resta un errore", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((set) => set.name === "semantic")!;
    semantic.active = false;
    const result = verify(snapshot);
    // Con il set inattivo l'indice non copre i token: mancano tutti i
    // richiesti dalla spec (e i binding puntano a token "assenti").
    expect(result.errors.some((e) => e.includes('Token richiesto dalla spec "color.primary"'))).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("regola 8 (seed): un token ripuntato in Penpot è un errore che nomina atteso e trovato", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((set) => set.name === "semantic")!;
    const primary = semantic.tokens.find((token) => token.name === "color.primary")!;
    primary.value = "{accent.12}";
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot, seed });
    expect(
      result.errors.some((e) => e.includes('"color.primary"') && e.includes("{accent.12}") && e.includes("valore del seed")),
    ).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("regola 8 (seed): hex con case diverso non è una differenza", () => {
    const snapshot = greenSnapshot();
    const palette = snapshot.sets.find((set) => set.name === "palette")!;
    const accent = palette.tokens.find((token) => token.name === "accent.9")!;
    const hex = accent.value;
    expect(typeof hex).toBe("string");
    const hexString = String(hex);
    const toggled = hexString === hexString.toLowerCase() ? hexString.toUpperCase() : hexString.toLowerCase();
    accent.value = toggled;
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot, seed });
    expect(result.errors.some((e) => e.includes("valore del seed"))).toBe(false);
    expect(result.ok).toBe(true);
  });

  it("regola 6: manca una parte del contratto in una cella", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    for (const cell of badge.cells) {
      cell.root.children = cell.root.children.filter((layer) => layer.name !== "label");
    }
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"badge"') && e.includes('manca la parte "label"'))).toBe(true);
  });

  it("regola 7: proprietà di stile valorizzata senza binding", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    const label = badge.cells[0]!.root.children.find((layer) => layer.name === "label")!;
    delete label.tokens.fill;
    const result = verify(snapshot);
    expect(
      result.errors.some((e) => e.includes('"badge"') && e.includes('"label"') && e.includes('"fill"') && e.includes("non ha binding")),
    ).toBe(true);
  });

  it("regola 7: binding che punta a un token assente dal catalogo", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    const label = badge.cells[0]!.root.children.find((layer) => layer.name === "label")!;
    label.tokens.fill = "color.nonesisto";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"color.nonesisto"') && e.includes("assente dal catalogo"))).toBe(true);
  });

  it("regola 7 (registro): strokeStyle dashed è ammesso senza token ma bloccato", () => {
    const green = verify(greenSnapshot());
    expect(green.ok).toBe(true);
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.cells[0]!.root.style.strokeStyle = "dashed";
    const result = verify(snapshot);
    // Proprietà bloccata dal registro → componente in attesa, gli altri restano ok.
    expect(result.pending.some((e) => e.includes('"badge"') && /Proprietà bloccata.*"strokeStyle".*"dashed"/.test(e))).toBe(true);
    expect(result.errors.some((e) => e.includes('"strokeStyle"'))).toBe(false);
    expect(status(result, "Badge")).toBe("pending");
    expect(status(result, "Input")).toBe("ok");
  });

  it("regola 7 (registro): strokeStyle fuori lista è un errore che elenca i valori ammessi", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.cells[0]!.root.style.strokeStyle = "mixed";
    const result = verify(snapshot);
    expect(result.errors.some((e) => /Valore fuori lista.*"strokeStyle".*\[solid, dashed, dotted\]/.test(e))).toBe(true);
  });

  it("regola 7 (registro): strokeAlignment center è bloccato", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.cells[0]!.root.style.strokeAlignment = "center";
    const result = verify(snapshot);
    expect(result.pending.some((e) => /Proprietà bloccata.*"strokeAlignment".*"center"/.test(e))).toBe(true);
  });

  it("regola 7 (registro): una proprietà non registrata nei binding è un errore nominativo", () => {
    const snapshot = greenSnapshot();
    const label = snapshot.components.find((c) => c.name === "Badge")!.cells[0]!.root.children.find((l) => l.name === "label")!;
    label.tokens.fooBar = "color.primary";
    const result = verify(snapshot);
    expect(result.errors.some((e) => /Proprietà non registrata.*parte "label".*"fooBar"/.test(e))).toBe(true);
  });

  it("regola 8: manca un token richiesto dalla spec", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((s) => s.name === "semantic")!;
    semantic.tokens = semantic.tokens.filter((t) => t.name !== "opacity.disabled");
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"opacity.disabled"') && e.includes("assente dal catalogo"))).toBe(true);
  });

  it("regola 8: token con tipo diverso da quello richiesto", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((s) => s.name === "semantic")!;
    const spacing = semantic.tokens.find((t) => t.name === "spacing.1")!;
    spacing.type = "color";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes('"spacing.1"') && e.includes('type "color"'))).toBe(true);
  });

  it("regola 9: il catalogo non passa generateTheme()", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((s) => s.name === "semantic")!;
    semantic.tokens.find((t) => t.name === "color.primary")!.value = "{colore.inesistente}";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes("generateTheme()"))).toBe(true);
  });

  it("regola 10: coppia di contrasto sotto soglia", () => {
    const snapshot = greenSnapshot();
    const palette = snapshot.sets.find((s) => s.name === "palette")!;
    palette.tokens.find((t) => t.name === "gray.8")!.value = "#EFE8DA";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes("color.border") && e.includes("< soglia 3"))).toBe(true);
  });

  it("regola 10: valore non risolvibile a un colore è un errore che nomina la coppia", () => {
    const snapshot = greenSnapshot();
    const semantic = snapshot.sets.find((s) => s.name === "semantic")!;
    semantic.tokens.find((t) => t.name === "color.border")!.value = "not-a-color";
    const result = verify(snapshot);
    expect(result.errors.some((e) => e.includes("color.border") && e.includes("non risolvibile"))).toBe(true);
  });

  it("regola 11: container con plugin data di un contratto fuori registry è un errore sul container", () => {
    const snapshot = greenSnapshot();
    snapshot.components.push({
      // "ghost": un nome che non sarà mai un contratto reale (aggiungere un componente non rompe il test).
      id: "id-ghost",
      name: "Ghost",
      pluginData: "ghost@1",
      axes: [],
      axesValues: {},
      cells: [],
    });
    const result = verify(snapshot);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Container "Ghost"');
    expect(result.errors[0]).toContain('"ghost@1"');
    expect(result.errors[0]).toContain("assente dal registry");
  });

  it("regola 11: verde quando il contratto del container è nel registry", () => {
    const snapshot = greenSnapshot();
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot });
    expect(result.errors.some((e) => e.includes("assente dal registry"))).toBe(false);
    // Senza il contratto nel registry lo stesso container diventa orfano.
    const withoutBadge = verifyLibrary({ contracts: contracts.filter((c) => c.name !== "badge"), spec: LIBRARY_SPEC, snapshot });
    expect(withoutBadge.errors.some((e) => e.includes('Container "Badge"') && e.includes("assente dal registry"))).toBe(true);
  });

  it("i container estranei senza plugin data sono ignorati", () => {
    const snapshot = greenSnapshot();
    snapshot.components.push({
      id: "id-placeholder",
      name: "Placeholder",
      pluginData: null,
      axes: [],
      axesValues: {},
      cells: [],
    });
    const result = verify(snapshot);
    expect(result.ok).toBe(true);
  });
});

describe("verifyLibrary — copertura design↔registry (code review 2.7)", () => {
  it("contratto senza design → errore nominativo prima delle regole su Penpot", () => {
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot: emptySnapshot(), designs: {} });
    expect(result.ok).toBe(false);
    // I nomi vengono dal registry, non da una lista a mano: un contratto nuovo non rompe il test.
    const coverage = result.errors.find((e) => e.includes("non hanno un design committato"));
    expect(coverage).toBeDefined();
    for (const contract of contracts) expect(coverage).toContain(contract.name);
  });

  it("design senza contratto → errore nominativo", () => {
    const result = verifyLibrary({
      contracts,
      spec: LIBRARY_SPEC,
      snapshot: emptySnapshot(),
      designs: { ...designs, fantasma: { parts: {}, cells: {} } as never },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("i design [fantasma] non hanno un contratto"))).toBe(true);
  });

  it("design allineati al registry → nessun errore di copertura", () => {
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot: emptySnapshot(), designs });
    expect(result.errors.some((e) => e.includes("Copertura design↔registry"))).toBe(false);
  });
});

describe("verifyLibrary — kind per problema (Story 2.9)", () => {
  function kinds(result: ReturnType<typeof verifyLibrary>, component: string): string[] {
    return result.components.find((verdict) => verdict.component === component)?.problems.map((p) => p.kind) ?? [];
  }

  it("verde: lo snapshot del bootstrap non ha nessun problema, quindi nessun kind", () => {
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot: greenSnapshot(), designs });
    expect(result.components.flatMap((v) => v.problems)).toEqual([]);
    expect(result.global.flatMap((v) => v.problems)).toEqual([]);
  });

  it("contract-version: plugin data a una versione diversa dal contratto (regola 3)", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.pluginData = "badge@2";
    expect(kinds(verify(snapshot), "Badge")).toContain("contract-version");
    expect(kinds(verify(greenSnapshot()), "Badge")).toEqual([]);
  });

  it("variant-not-adopted: valore option in più e le sue celle", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axesValues.variant = [...badge.axesValues.variant!, "info"];
    const template = badge.cells.find((cell) => cell.variantProps?.variant === "default")!;
    for (const size of ["sm", "md"]) badge.cells.push({ ...template, variantProps: { variant: "info", size } });
    const found = kinds(verify(snapshot), "Badge");
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(found)).toEqual(new Set(["variant-not-adopted"]));
  });

  it("variant-not-adoptable: valore in più su un asse state/behavior e la sua cella", () => {
    const contract = contracts.find((c) => c.axes.some((axis) => axis.type !== "option"))!;
    const axis = contract.axes.find((a) => a.type !== "option")!;
    const name = contract.name.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
    const snapshot = greenSnapshot();
    const container = snapshot.components.find((c) => c.name === name)!;
    container.axesValues[axis.name] = [...container.axesValues[axis.name]!, "nuovo"];
    const template = container.cells[0]!;
    container.cells.push({ ...template, variantProps: { ...template.variantProps!, [axis.name]: "nuovo" } });
    const found = kinds(verify(snapshot), name);
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(found)).toEqual(new Set(["variant-not-adoptable"]));
  });

  function withoutSmCells(): LibrarySnapshot {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.cells = badge.cells.filter((cell) => cell.variantProps?.size !== "sm");
    return snapshot;
  }

  it("missing-cell: cella assente in Penpot, prevista dal design e creabile con addCell", () => {
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot: withoutSmCells(), designs });
    expect(new Set(kinds(result, "Badge"))).toEqual(new Set(["missing-cell"]));
  });

  it("missing-cell-blocked: la stessa cella con gli assi fuori ordine (addCell non gira)", () => {
    const snapshot = withoutSmCells();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    badge.axes = [...badge.axes].reverse();
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot, designs });
    expect(kinds(result, "Badge")).toContain("missing-cell-blocked");
    expect(kinds(result, "Badge")).not.toContain("missing-cell");
  });

  it("missing-cell-undesigned: la cella manca anche dal design → domanda al designer", () => {
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot: withoutSmCells() });
    expect(new Set(kinds(result, "Badge"))).toEqual(new Set(["missing-cell-undesigned"]));
  });

  it("cell-not-in-contract: una cella fuori dal prodotto cartesiano del contratto", () => {
    const snapshot = greenSnapshot();
    const badge = snapshot.components.find((c) => c.name === "Badge")!;
    const template = badge.cells[0]!;
    badge.cells.push({ ...template, variantProps: { variant: "default" } });
    expect(kinds(verify(snapshot), "Badge")).toEqual(["cell-not-in-contract"]);
  });

  it("blocked-property: proprietà bloccata dal registro (strokeStyle dashed)", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.cells[0]!.root.style.strokeStyle = "dashed";
    expect(kinds(verify(snapshot), "Badge")).toEqual(["blocked-property"]);
  });

  it("snapshot-stale: componente committato assente dallo snapshot da file", () => {
    const snapshot = greenSnapshot();
    snapshot.components = snapshot.components.filter((c) => c.name !== "Input");
    const result = verifyLibrary({ contracts, spec: LIBRARY_SPEC, snapshot, committedComponents: ["Badge", "Input"] });
    expect(kinds(result, "Input")).toContain("snapshot-stale");
    expect(kinds(result, "Badge")).toEqual([]);
  });

  it("other: un rosso senza percorso proprio (variantError) e le righe globali", () => {
    const snapshot = greenSnapshot();
    snapshot.components.find((c) => c.name === "Badge")!.cells[0]!.variantError = "duplicate";
    expect(kinds(verify(snapshot), "Badge")).toEqual(["other"]);
    const noTokens = greenSnapshot();
    noTokens.sets = [];
    const globalKinds = verify(noTokens).global.flatMap((v) => v.problems.map((p) => p.kind));
    expect(globalKinds.length).toBeGreaterThan(0);
    expect(new Set(globalKinds)).toEqual(new Set(["other"]));
  });
});
