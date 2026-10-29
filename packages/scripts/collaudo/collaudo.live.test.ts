import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  fillInHugKey,
  layerClasses,
  type Lettura,
  registeredProperties,
  registryEntry,
  scaleClass,
  scaleFromThemeCss,
  type LetturaLayer,
  type Scale,
  type TokenType,
  type TokenTypeOf,
} from "../src/core";
import { readPenpotTokenCatalog } from "../src/penpot/penpot-reader";
import { readComponent } from "../src/penpot/read-component";
import { generateTheme, type TokenCatalog } from "../src/shared/theme-generator";

/**
 * Collaudo degli aggiornamenti di Penpot (Story 2.25). Legge il campione
 * `campione.penpot`, importato in un'istanza Penpot nuova, con
 * `readComponent` e `readPenpotTokenCatalog` così come sono. Si salta senza
 * `PDS_PENPOT_COLLAUDO=1`, quindi in CI non gira mai. Procedura, campione e
 * tabella proprietà → layer: `collaudo/README.md`. Nessuna lettura salvata.
 */

const COLLAUDO = process.env.PDS_PENPOT_COLLAUDO === "1";

/** I nomi del campione (README, § Il campione). */
const MAIN = "Collaudo";
const DOUBLE = "CollaudoDoppione";
const FILL_IN_HUG = "FillDentroHug";
const CONTRACT = "collaudo@1";
const SCALE_LAYER = "Quadrato";
const UNTOUCHED_FLEX = "FlexNonToccato";
const NESTED = "Etichetta";
/** Il default reale di `flex.alignItems` su un flex appena creato, misurato su Penpot 2.18.3 (README, § Esiti). */
const UNTOUCHED_ALIGN = "start";
/** Proprietà che l'adattatore scrive solo se non di default: su un flex non toccato non devono esserci. */
const DEFAULT_SUPPRESSED = [
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "rowGap", "columnGap", "opacity",
  "borderRadiusTopLeft", "borderRadiusTopRight", "borderRadiusBottomRight", "borderRadiusBottomLeft",
  "strokeColor", "strokeWidth", "shadow",
];

const PLUGIN_DATA_KEYS = ["contract", "part", "when", "slot"] as const;

const README_PATH = fileURLToPath(new URL("./README.md", import.meta.url));

/** Il titolo della tabella proprietà e chiavi → layer nel README: si legge solo quella sezione. */
const TABLE_HEADING = "### Proprietà e chiavi → layer → valore";

/** Proprietà o chiave → layer atteso, dalle righe `| \`nome\` | layer | valore |` della sezione {@link TABLE_HEADING}. */
function expectedLayers(): Map<string, string> {
  const out = new Map<string, string>();
  const text = readFileSync(README_PATH, "utf8");
  const start = text.indexOf(TABLE_HEADING);
  if (start < 0) return out;
  const rest = text.slice(start + TABLE_HEADING.length);
  const end = rest.search(/^#{1,3} /m);
  for (const line of (end < 0 ? rest : rest.slice(0, end)).split("\n")) {
    const match = /^\|\s*`([A-Za-z]+)`\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (match && !out.has(match[1]!)) out.set(match[1]!, match[2]!);
  }
  return out;
}

interface Visited {
  readonly layer: LetturaLayer;
  readonly parent?: LetturaLayer;
}

function visit(layer: LetturaLayer, parent?: LetturaLayer): Visited[] {
  return [parent === undefined ? { layer } : { layer, parent }, ...layer.children.flatMap((child) => visit(child, layer))];
}

const visitedOf = (lettura: Lettura): Visited[] => lettura.cells.flatMap((cell) => visit(cell.root));

describe.skipIf(!COLLAUDO)("collaudo di Penpot sul campione", { timeout: 120_000 }, () => {
  let main: Lettura;
  let fillInHug: Lettura;
  let catalog: TokenCatalog;
  let scale: Scale;
  let tokenTypeOf: TokenTypeOf;
  const layers = expectedLayers();
  const where = (name: string): string => layers.get(name) ?? "nessuna riga nella tabella di collaudo/README.md: aggiungila";

  beforeAll(async () => {
    // readComponent valida già con Lettura.safeParse e lancia se la lettura non passa lo schema.
    main = await readComponent(MAIN);
    fillInHug = await readComponent(FILL_IN_HUG);
    catalog = await readPenpotTokenCatalog();
    scale = scaleFromThemeCss(generateTheme(catalog).css);
    const types = new Map<string, TokenType>();
    for (const set of catalog.sets) for (const token of set.tokens) types.set(token.name, token.type);
    tokenTypeOf = (name) => types.get(name);
  }, 240_000);

  it(`il container ${MAIN} ha il contratto ${CONTRACT}, almeno due celle, un'istanza annidata e un figlio assoluto`, () => {
    expect(main.pluginData?.contract, `contratto sul container "${MAIN}"`).toBe(CONTRACT);
    expect(main.cells.length, `celle di "${MAIN}"`).toBeGreaterThanOrEqual(2);
    const all = visitedOf(main).map((entry) => entry.layer);
    const instances = all.filter((layer) => layer.instance !== undefined);
    expect(instances.length, `istanza annidata in "${MAIN}" (${where("instance")})`).toBeGreaterThan(0);
    for (const layer of instances) {
      expect(layer.instance!.component, `componente dell'istanza "${layer.name}"`).toBe(NESTED);
      expect(layer.instance!.overrides, `override dell'istanza "${layer.name}"`).toEqual([]);
    }
    expect(all.some((layer) => layer.style["position"] === "absolute"), `figlio assoluto in "${MAIN}" (${where("position")})`).toBe(true);
  });

  it("ogni proprietà del registro, ogni chiave di plugin data e l'istanza hanno una riga nella tabella del README", () => {
    const missing = [...registeredProperties(), ...PLUGIN_DATA_KEYS, "instance"].filter((name) => !layers.has(name));
    expect(missing.map((name) => `"${name}" non ha una riga in "${TABLE_HEADING}" di collaudo/README.md: aggiungila`)).toEqual([]);
  });

  it("ogni proprietà del registro compare nella lettura (le voci token in tokens e in style), con un valore diverso dal default se ne ha uno", () => {
    const all = [...visitedOf(main), ...visitedOf(fillInHug)].map((entry) => entry.layer);
    const problems: string[] = [];
    for (const property of registeredProperties()) {
      const entry = registryEntry(property)!;
      const inTokens = all.some((layer) => Object.hasOwn(layer.tokens, property));
      const styleValues = all.filter((layer) => Object.hasOwn(layer.style, property)).map((layer) => layer.style[property]);
      if (entry.kind === "token") {
        // Ogni layer legato deve avere anche il valore grezzo: un import che perde il legame su un layer non si nasconde dietro un altro.
        const bound = all.filter((layer) => Object.hasOwn(layer.tokens, property));
        if (!inTokens) problems.push(`"${property}" non compare in tokens: legame del token perso (layer atteso: ${where(property)})`);
        if (styleValues.length === 0) problems.push(`"${property}" non compare in style: valore grezzo non letto (layer atteso: ${where(property)})`);
        for (const layer of bound.filter((candidate) => !Object.hasOwn(candidate.style, property))) {
          problems.push(`"${property}" su "${layer.name}" ha il token ma non il valore grezzo (layer atteso: ${where(property)})`);
        }
        continue;
      }
      const values = [...(inTokens ? all.filter((layer) => Object.hasOwn(layer.tokens, property)).map((layer) => layer.tokens[property]) : []), ...styleValues];
      if (values.length === 0) {
        problems.push(`"${property}" non compare nella lettura (layer atteso: ${where(property)})`);
        continue;
      }
      const fallback = entry.kind === "keyword" ? entry.default : entry.kind === "geometry" ? entry.default : undefined;
      if (fallback !== undefined && !values.some((value) => value !== fallback)) {
        problems.push(`"${property}" compare solo col default "${fallback}" (layer atteso con un altro valore: ${where(property)})`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("i valori senza default della tabella arrivano come nel campione", () => {
    const all = visitedOf(main).map((entry) => entry.layer);
    for (const cell of main.cells) expect(cell.root.style["clip"], `clip della cella "${cell.root.name}" (${where("clip")})`).toBe(true);
    const squares = all.filter((layer) => layer.name === SCALE_LAYER);
    expect(squares.length, `layer "${SCALE_LAYER}" nel campione`).toBeGreaterThan(0);
    for (const layer of squares) {
      expect([layer.style["width"], layer.style["height"]], `misura di "${SCALE_LAYER}" (${where("width")})`).toEqual([16, 16]);
    }
  });

  it("ogni token legato nella lettura è nel catalogo", () => {
    const all = [...visitedOf(main), ...visitedOf(fillInHug)].map((entry) => entry.layer);
    const unknown = [...new Set(all.flatMap((layer) => Object.values(layer.tokens)))].filter((name) => tokenTypeOf(name) === undefined);
    expect(unknown.map((name) => `il token "${name}" è legato nel campione ma manca nel catalogo letto da readPenpotTokenCatalog`)).toEqual([]);
  });

  it("ogni chiave di plugin data compare nella lettura", () => {
    const all = visitedOf(main).map((entry) => entry.layer);
    const missing = PLUGIN_DATA_KEYS.filter((key) => main.pluginData?.[key] === undefined && !all.some((layer) => layer.pluginData?.[key] !== undefined));
    expect(missing.map((key) => `"${key}" non compare nella lettura (layer atteso: ${where(key)})`)).toEqual([]);
  });

  it("il catalogo ha il set collaudo", () => {
    expect(
      catalog.sets.map((set) => set.name),
      'nessun set attivo "collaudo" nel catalogo: la lettura forse non viene dall\'istanza di collaudo (controlla PENPOT_MCP_TOKEN e il file aperto)',
    ).toContain("collaudo");
  });

  it(`la scala del catalogo non è vuota e la misura in scala di "${SCALE_LAYER}" dà la sua classe`, () => {
    expect(scale.length, "passi --spacing-<sfx> nel tema generato dal catalogo").toBeGreaterThan(0);
    const entry = visitedOf(main).find((candidate) => candidate.layer.name === SCALE_LAYER && candidate.parent !== undefined);
    expect(entry, `layer "${SCALE_LAYER}" (${where("width")})`).toBeDefined();
    const width = entry!.layer.style["width"];
    expect(typeof width, `larghezza di "${SCALE_LAYER}"`).toBe("number");
    const expected = scaleClass("w", width as number, scale);
    expect(expected.offScale, `${String(width)}px non è un passo della scala [${scale.map((step) => `${step.suffix}=${step.px}`).join(", ")}]`).toBe(false);
    expect(layerClasses(entry!.layer, { parent: entry!.parent, tokenTypeOf, scale }).classes).toContain(expected.cls);
  });

  it(`"${FILL_IN_HUG}" è leggibile e il fill dentro hug arriva come domanda`, () => {
    const questions = visitedOf(fillInHug)
      .filter((entry) => entry.parent !== undefined)
      .flatMap((entry) => layerClasses(entry.layer, { parent: entry.parent, tokenTypeOf, scale }).findings)
      .filter((finding) => finding.level === "domanda" && finding.key === fillInHugKey("H"));
    expect(questions.length, `domanda ${fillInHugKey("H")} su "${FILL_IN_HUG}" (${where("sizingH")})`).toBeGreaterThan(0);
  });

  it(`il doppione: due container ${CONTRACT} danno l'errore che li elenca`, async () => {
    const error = await readComponent("collaudo").then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error, `readComponent("collaudo") con "${MAIN}" e "${DOUBLE}" nel file`).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toMatch(/Più componenti rispondono a "collaudo"/);
    for (const name of [MAIN, DOUBLE]) expect(message).toContain(`"${name}" (id `);
  });

  // Il default reale di Penpot 2.18.3 è `start`, non il `default` del registro (`stretch`, il valore senza classi del CSS):
  // un flex non toccato dà quindi `items-start`. Se Penpot cambia default, questo controllo va rosso.
  it(`il default reale di layoutAlign su un flex non toccato ("${UNTOUCHED_FLEX}") è ${UNTOUCHED_ALIGN} e dà items-start`, () => {
    const flexes = visitedOf(main).filter((entry) => entry.layer.name === UNTOUCHED_FLEX);
    expect(flexes.length, `layer "${UNTOUCHED_FLEX}" nel campione`).toBeGreaterThan(0);
    for (const { layer, parent } of flexes) {
      expect(layer.style["layoutAlign"], `layoutAlign di "${UNTOUCHED_FLEX}"`).toBe(UNTOUCHED_ALIGN);
      expect(layerClasses(layer, { parent, tokenTypeOf, scale }).classes, `classi di "${UNTOUCHED_FLEX}"`).toContain("items-start");
      expect(DEFAULT_SUPPRESSED.filter((property) => Object.hasOwn(layer.style, property)), `proprietà di default in style su "${UNTOUCHED_FLEX}"`).toEqual([]);
    }
  });

  it("nome ignoto: l'errore dice che il componente non c'è", async () => {
    await expect(readComponent("collaudo-nome-che-non-esiste")).rejects.toThrow(/Nessun componente "collaudo-nome-che-non-esiste"/);
  });
});
